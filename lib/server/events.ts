/**
 * First-party product analytics.
 *
 * One append-only `events` table, written server-side from the op pipeline.
 * The point of keeping the taxonomy and the per-type prop allowlist in this
 * one file is that the privacy invariants are reviewable in a single place:
 *
 * - P1 — no free text. Events carry ids, enum-ish slugs and numbers. Item
 *   text, note titles and bodies, list titles, space names and member names
 *   never appear. `EVENT_PROPS` is the allowlist and `isEventValue` is the
 *   shape check; anything else is dropped rather than stored.
 * - P2 — notes are opaque. Note events carry no props at all, not even
 *   lengths.
 * - P5 — `events.space_id` cascades, so deleting a space deletes its
 *   analytics.
 * - P6 — analytics never fail user writes. `recordEvent` swallows and logs
 *   its own errors, so no caller can forget to.
 */

import { q } from "@/lib/db";

/**
 * Event taxonomy and, per type, the props that may be stored. A prop not
 * listed here is dropped on the way in — extending an event means editing
 * this table, which is exactly the review point we want.
 */
export const EVENT_PROPS = {
  "space.created": [],
  "member.joined": ["member_count"],
  "list.created": ["list_type"],
  "list.deleted": ["list_type"],
  "item.added": [
    "list_type",
    "has_qty",
    "has_category",
    "has_due_date",
    "assigned",
    "matched",
    "canonical_item_id",
    "category_slug",
  ],
  "item.completed": ["list_type", "canonical_item_id", "category_slug"],
  "item.uncompleted": ["list_type"],
  "item.deleted": ["list_type"],
  "items.cleared": ["list_type", "cleared_count"],
  "recur.created": ["days_count"],
  "recur.completed": [],
  "note.created": [],
  "note.updated": [],
  "note.deleted": [],
} as const satisfies Record<string, readonly string[]>;

export type EventType = keyof typeof EVENT_PROPS;

export interface AnalyticsEvent {
  type: EventType;
  /** The list/item/note/recurrence the event is about. */
  entityId?: string | null;
  props?: Record<string, unknown>;
}

/** What `applyOp` hands back so the route can log without re-deriving op
 *  semantics. Handlers with nothing to report return `{}`. */
export interface OpResult {
  event?: AnalyticsEvent;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Slugs, uuids and other enum-ish tokens — never a sentence. The second line
 *  of defense for P1, behind the per-type allowlist. */
const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

function isEventValue(value: unknown): boolean {
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return SLUG_RE.test(value);
  return false;
}

/** Keep only allowlisted keys holding allowlisted shapes. */
function filterProps(
  type: EventType,
  props: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!props) return {};
  const allowed: readonly string[] = EVENT_PROPS[type];
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (!allowed.includes(key) || !isEventValue(value)) {
      console.error(
        `[liszt] dropped disallowed prop "${key}" on event "${type}"`
      );
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Append one event. Best-effort by construction (P6): a failure here is
 * logged and swallowed, never propagated into the request that triggered it.
 */
export async function recordEvent(
  spaceId: string,
  memberId: string | null,
  event: AnalyticsEvent
): Promise<void> {
  try {
    const entityId =
      typeof event.entityId === "string" && UUID_RE.test(event.entityId)
        ? event.entityId
        : null;
    await q(
      `INSERT INTO events (space_id, member_id, event_type, entity_id, props)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        spaceId,
        memberId,
        event.type,
        entityId,
        JSON.stringify(filterProps(event.type, event.props)),
      ]
    );
  } catch (err) {
    console.error("[liszt] event insert failed", err);
  }
}
