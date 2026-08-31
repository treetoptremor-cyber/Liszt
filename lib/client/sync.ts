import type { Op, SpaceState } from "@/lib/types";
import { applyOpToState } from "@/lib/client/reducer";
import { readJsonKey, writeJsonKey } from "@/lib/client/storage";

export type SyncStatus = "synced" | "syncing" | "offline";

export interface SyncSnapshot {
  /** Last server state with pending local ops layered on top. */
  state: SpaceState | null;
  status: SyncStatus;
  pendingCount: number;
  /** Message of the most recently rejected op (4xx), for a toast. */
  lastError: string | null;
  /** Set when the server says we can't be here (deleted space / not a member). */
  fatal: "not-found" | "not-member" | null;
}

interface PendingOp {
  opId: string;
  op: Op;
  inFlight?: boolean;
}

/** State cached by an older build (or an older server) can be missing whole
 *  collections. Fill them in so the reducer and views never meet `undefined`. */
function hydrate(state: SpaceState | null): SpaceState | null {
  if (!state) return null;
  return {
    ...state,
    members: state.members ?? [],
    lists: state.lists ?? [],
    recurrences: state.recurrences ?? [],
    recurrenceDone: state.recurrenceDone ?? [],
    notes: state.notes ?? [],
    frequent: state.frequent ?? [],
  };
}

const POLL_MS = 3000;
/** A hidden tab still polls every Nth tick so it never drifts far behind. */
const HIDDEN_POLL_EVERY = 7;
const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 15000;

/** Client sync engine: optimistic mutations through a persisted offline
 *  queue, plus near-live polling. One instance per open space.
 *
 *  The queue is persisted under a per-space localStorage key that may be
 *  shared by several open tabs. Writes are merge-based: each engine only
 *  adds/removes the ops it owns and preserves other tabs' entries. Ops it
 *  finds at startup are adopted (they're orphans of a closed tab); because
 *  server ops are idempotent, the rare double-flush from two adopting tabs
 *  is harmless. */
export class SpaceSync {
  private code: string;
  private memberId: string;
  private server: SpaceState | null = null;
  private pending: PendingOp[] = [];
  /** opIds this engine is responsible for flushing (its own + adopted). */
  private ownOpIds = new Set<string>();
  private lastError: string | null = null;
  private fatal: SyncSnapshot["fatal"] = null;
  private online = true;
  /** Lowest server version we may accept from a poll — set from mutate
   *  responses so a slow in-flight GET can't roll the UI back. */
  private versionFloor = 0;

  private listeners = new Set<() => void>();
  private snapshot: SyncSnapshot;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = RETRY_BASE_MS;
  private flushing = false;
  private polling = false;
  private pollQueued = false;
  private stopped = false;
  private tick = 0;

  constructor(code: string, memberId: string) {
    this.code = code;
    this.memberId = memberId;
    this.server = hydrate(readJsonKey<SpaceState>(`liszt:state:${code}`));
    this.pending = readJsonKey<PendingOp[]>(`liszt:queue:${code}`) ?? [];
    this.pending.forEach((p) => {
      p.inFlight = false;
      this.ownOpIds.add(p.opId);
    });
    this.online = typeof navigator === "undefined" ? true : navigator.onLine;
    this.snapshot = this.buildSnapshot();
  }

  // ---- React integration -------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SyncSnapshot => this.snapshot;

  private invalidate() {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((l) => l());
  }

  private buildSnapshot(): SyncSnapshot {
    let state = this.server;
    if (state) {
      for (const p of this.pending) {
        state = applyOpToState(state, p.op, this.memberId);
      }
    }
    let status: SyncStatus = "synced";
    if (!this.online) status = "offline";
    else if (this.pending.length > 0) status = "syncing";
    return {
      state,
      status,
      pendingCount: this.pending.length,
      lastError: this.lastError,
      fatal: this.fatal,
    };
  }

  // ---- lifecycle ---------------------------------------------------------

  start() {
    this.stopped = false;
    void this.poll(true);
    void this.flush();
    this.pollTimer = setInterval(() => {
      this.tick = (this.tick + 1) % HIDDEN_POLL_EVERY;
      if (document.hidden && this.tick !== 0) return;
      void this.poll(true);
    }, POLL_MS);
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
    window.addEventListener("focus", this.handleVisibility);
    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  stop() {
    this.stopped = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.pollTimer = null;
    this.retryTimer = null;
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    window.removeEventListener("focus", this.handleVisibility);
    document.removeEventListener("visibilitychange", this.handleVisibility);
  }

  /** A dead space stays dead — stop generating traffic for it. */
  private setFatal(kind: "not-found" | "not-member") {
    if (this.fatal === kind) return;
    this.fatal = kind;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.pollTimer = null;
    this.retryTimer = null;
    this.invalidate();
  }

  private handleOnline = () => {
    this.online = true;
    this.retryDelay = RETRY_BASE_MS;
    this.invalidate();
    void this.flush();
    void this.poll(true);
  };

  private handleOffline = () => {
    this.online = false;
    this.invalidate();
  };

  private handleVisibility = () => {
    void this.poll(true);
    void this.flush();
  };

  clearError() {
    if (this.lastError !== null) {
      this.lastError = null;
      this.invalidate();
    }
  }

  // ---- mutations ---------------------------------------------------------

  mutate(op: Op) {
    if (this.fatal) return;
    // Coalesce rapid successive updates to the same entity (typing in a note,
    // toggling fields in the item sheet) into one queued op.
    const last = this.pending[this.pending.length - 1];
    if (
      last &&
      !last.inFlight &&
      (op.type === "note.update" || op.type === "item.update") &&
      last.op.type === op.type &&
      last.op.id === op.id
    ) {
      last.op = {
        ...last.op,
        patch: { ...last.op.patch, ...op.patch },
      } as Op;
    } else {
      const opId = crypto.randomUUID();
      this.pending.push({ opId, op });
      this.ownOpIds.add(opId);
    }
    this.persistQueue();
    this.invalidate();
    void this.flush();
  }

  /** Merge-write the shared queue key: keep other tabs' entries, replace ours. */
  private persistQueue() {
    const stored = readJsonKey<PendingOp[]>(`liszt:queue:${this.code}`) ?? [];
    const foreign = stored.filter(
      (e) => e && typeof e.opId === "string" && !this.ownOpIds.has(e.opId)
    );
    writeJsonKey(`liszt:queue:${this.code}`, [
      ...foreign,
      ...this.pending.map(({ opId, op }) => ({ opId, op })),
    ]);
  }

  private async flush() {
    if (this.flushing || this.stopped || this.fatal) return;
    this.flushing = true;
    try {
      while (this.pending.length > 0 && !this.stopped && !this.fatal) {
        const entry = this.pending[0];
        entry.inFlight = true;
        let res: Response;
        try {
          res = await fetch(
            `/api/spaces/${encodeURIComponent(this.code)}/mutate`,
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-member-id": this.memberId,
              },
              body: JSON.stringify(entry.op),
            }
          );
        } catch {
          // Network down — keep the op queued, retry with backoff.
          entry.inFlight = false;
          this.online = false;
          this.invalidate();
          this.scheduleRetry();
          return;
        }
        this.online = true;
        if (res.ok) {
          try {
            const body = await res.json();
            if (typeof body?.version === "number") {
              this.versionFloor = Math.max(this.versionFloor, body.version);
            }
          } catch {
            // version floor is an optimization; safe to skip
          }
          this.pending.shift();
          this.persistQueue();
          this.retryDelay = RETRY_BASE_MS;
          this.invalidate();
        } else if (res.status >= 400 && res.status < 500) {
          if (res.status === 403 || res.status === 404) {
            const stillThere = await this.checkFatal();
            if (!stillThere) return;
          }
          // The server refused this op — drop it and tell the user.
          this.pending.shift();
          this.persistQueue();
          let message = "That change couldn't be saved";
          try {
            const body = await res.json();
            if (typeof body?.error === "string") message = body.error;
          } catch {
            // keep default message
          }
          this.lastError = message;
          this.invalidate();
        } else {
          // Server hiccup — retry later without dropping the op.
          entry.inFlight = false;
          this.scheduleRetry();
          return;
        }
      }
      if (!this.stopped) void this.poll(true);
    } finally {
      this.flushing = false;
    }
  }

  private scheduleRetry() {
    if (this.retryTimer || this.stopped || this.fatal) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.retryDelay = Math.min(this.retryDelay * 2, RETRY_MAX_MS);
      void this.flush();
    }, this.retryDelay);
  }

  /** On 403/404 for a mutation, find out whether the whole space/membership is
   *  gone (fatal) or just the one entity. Returns true if membership is OK. */
  private async checkFatal(): Promise<boolean> {
    try {
      const res = await fetch(
        `/api/spaces/${encodeURIComponent(this.code)}/state?v=-2`,
        { headers: { "x-member-id": this.memberId } }
      );
      if (res.status === 404) {
        this.setFatal("not-found");
        return false;
      }
      if (res.status === 401 || res.status === 403) {
        this.setFatal("not-member");
        return false;
      }
      return true;
    } catch {
      return true;
    }
  }

  // ---- polling -----------------------------------------------------------

  private async poll(force = false) {
    if (this.stopped || this.fatal) return;
    if (this.polling) {
      // Remember that fresher state was requested while a GET was in flight.
      this.pollQueued = this.pollQueued || force;
      return;
    }
    if (!force && typeof document !== "undefined" && document.hidden) return;
    this.polling = true;
    try {
      const v = this.server?.version ?? -1;
      const res = await fetch(
        `/api/spaces/${encodeURIComponent(this.code)}/state?v=${v}`,
        { headers: { "x-member-id": this.memberId } }
      );
      if (res.status === 404) {
        this.setFatal("not-found");
        return;
      }
      if (res.status === 401 || res.status === 403) {
        this.setFatal("not-member");
        return;
      }
      if (!res.ok) return;
      this.online = true;
      const body = await res.json();
      if (body.unchanged) {
        if (this.snapshot.status === "offline") this.invalidate();
        return;
      }
      // Never accept state older than what we already have or what our own
      // acknowledged mutations imply — a slow response must not roll us back.
      const incoming = body as SpaceState;
      const known = Math.max(this.server?.version ?? -1, this.versionFloor);
      if (typeof incoming.version === "number" && incoming.version < known) {
        this.pollQueued = true;
        return;
      }
      this.server = hydrate(incoming);
      writeJsonKey(`liszt:state:${this.code}`, this.server);
      this.invalidate();
    } catch {
      this.online = false;
      this.invalidate();
    } finally {
      this.polling = false;
      if (this.pollQueued && !this.stopped && !this.fatal) {
        this.pollQueued = false;
        void this.poll(true);
      }
    }
  }
}
