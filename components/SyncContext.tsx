"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { SpaceSync, type SyncSnapshot } from "@/lib/client/sync";
import type { Member, Op } from "@/lib/types";

interface SyncContextValue {
  snap: SyncSnapshot;
  memberId: string;
  mutate: (op: Op) => void;
  clearError: () => void;
  memberById: (id: string | null) => Member | null;
}

const Ctx = createContext<SyncContextValue | null>(null);

const EMPTY_SNAPSHOT: SyncSnapshot = {
  state: null,
  status: "offline",
  pendingCount: 0,
  lastError: null,
  fatal: null,
};

export function SyncProvider({
  code,
  memberId,
  children,
}: {
  code: string;
  memberId: string;
  children: React.ReactNode;
}) {
  const engineRef = useRef<SpaceSync | null>(null);
  if (!engineRef.current) {
    engineRef.current = new SpaceSync(code, memberId);
  }
  const engine = engineRef.current;

  useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, [engine]);

  const snap = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    () => EMPTY_SNAPSHOT
  );

  const mutate = useCallback((op: Op) => engine.mutate(op), [engine]);
  const clearError = useCallback(() => engine.clearError(), [engine]);

  const value: SyncContextValue = {
    snap,
    memberId,
    mutate,
    clearError,
    memberById: (id) =>
      id ? snap.state?.members.find((m) => m.id === id) ?? null : null,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSync(): SyncContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSync must be used inside SyncProvider");
  return v;
}
