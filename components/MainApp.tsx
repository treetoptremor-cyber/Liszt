"use client";

import { useEffect, useState } from "react";
import { SyncProvider, useSync } from "@/components/SyncContext";
import { Wordmark } from "@/components/Wordmark";
import { Icon } from "@/components/Icons";
import { Toast } from "@/components/Toast";
import { ListsView } from "@/components/views/ListsView";
import { NotesView } from "@/components/views/NotesView";
import { TodosView } from "@/components/views/TodosView";
import { FamilyView } from "@/components/views/FamilyView";
import {
  readPlainKey,
  removeSpaceEntry,
  touchSpaceEntry,
  upsertSpaceEntry,
  writePlainKey,
  type SpaceEntry,
} from "@/lib/client/storage";

type Tab = "groceries" | "todos" | "notes" | "family";

const TABS: { id: Tab; label: string; icon: "cart" | "todo" | "note" | "people" }[] = [
  { id: "groceries", label: "Groceries", icon: "cart" },
  { id: "todos", label: "To-dos", icon: "todo" },
  { id: "notes", label: "Notes", icon: "note" },
  { id: "family", label: "Family", icon: "people" },
];

export function MainApp({ code, entry }: { code: string; entry: SpaceEntry }) {
  return (
    <SyncProvider code={code} memberId={entry.memberId}>
      <AppShell code={code} entry={entry} />
    </SyncProvider>
  );
}

function AppShell({ code, entry }: { code: string; entry: SpaceEntry }) {
  const { snap, memberId, clearError } = useSync();
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "groceries";
    const saved = readPlainKey(`liszt:tab:${code}`);
    return (TABS.some((t) => t.id === saved) ? saved : "groceries") as Tab;
  });

  useEffect(() => {
    touchSpaceEntry(code);
  }, [code]);

  // Keep the device registry in step with server-side renames.
  const spaceName = snap.state?.space.name;
  const selfName = snap.state?.members.find((m) => m.id === memberId)?.name;
  useEffect(() => {
    if (!spaceName || !selfName) return;
    if (spaceName !== entry.name || selfName !== entry.memberName) {
      upsertSpaceEntry({
        code,
        name: spaceName,
        memberId,
        memberName: selfName,
      });
    }
  }, [code, memberId, spaceName, selfName, entry.name, entry.memberName]);

  function selectTab(next: Tab) {
    setTab(next);
    writePlainKey(`liszt:tab:${code}`, next);
  }

  if (snap.fatal) {
    return (
      <div className="landing">
        <div className="landing-inner">
          <header className="landing-hero">
            <Wordmark className="wordmark-hero" />
          </header>
          <div className="card landing-card">
            <h2 className="section-title">
              {snap.fatal === "not-found"
                ? "This space no longer exists"
                : "You're no longer a member here"}
            </h2>
            <p className="landing-note">
              {snap.fatal === "not-found"
                ? "It may have been deleted, or the code changed."
                : "Rejoin with the share code, or head back to start."}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                removeSpaceEntry(code);
                window.location.href = "/?home=1";
              }}
            >
              Back to start
            </button>
          </div>
        </div>
      </div>
    );
  }

  const state = snap.state;

  return (
    <div className="app">
      <header className="topbar">
        <Wordmark className="wordmark-bar" />
        <h1 className="topbar-title">{state?.space.name ?? entry.name}</h1>
        {(() => {
          const label =
            snap.status === "synced"
              ? "Synced"
              : snap.status === "syncing"
                ? "Saving…"
                : `Offline${snap.pendingCount ? ` — ${snap.pendingCount} change${snap.pendingCount === 1 ? "" : "s"} queued` : ""}`;
          return (
            <div className="sync-status" role="status" aria-label={label}>
              {snap.status === "offline" && (
                <span className="sync-pill">
                  {snap.pendingCount > 0
                    ? `Offline · ${snap.pendingCount} queued`
                    : "Offline"}
                </span>
              )}
              <span className={`sync-dot sync-${snap.status}`} title={label} />
            </div>
          );
        })()}
      </header>

      <main className="view-wrap">
        {!state ? (
          <div className="empty">
            <p className="empty-title">Loading your lists…</p>
          </div>
        ) : tab === "groceries" ? (
          <ListsView key="grocery" listType="grocery" code={code} />
        ) : tab === "todos" ? (
          <TodosView code={code} />
        ) : tab === "notes" ? (
          <NotesView />
        ) : (
          <FamilyView code={code} />
        )}
      </main>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? "tab-active" : ""}`}
            onClick={() => selectTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
          >
            <Icon name={t.icon} size={23} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <Toast message={snap.lastError} onDone={clearError} />
    </div>
  );
}
