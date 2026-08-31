"use client";

import { useState } from "react";
import { Icon } from "@/components/Icons";
import { CalendarView } from "@/components/views/CalendarView";
import { ListsView } from "@/components/views/ListsView";
import { readPlainKey, writePlainKey } from "@/lib/client/storage";

type View = "list" | "calendar";

/** The to-dos tab has two lenses on the same shared items: the list, and the
 *  calendar. The choice sticks per space. */
export function TodosView({ code }: { code: string }) {
  const storageKey = `liszt:todoview:${code}`;
  const [view, setView] = useState<View>(() =>
    typeof window !== "undefined" && readPlainKey(storageKey) === "calendar"
      ? "calendar"
      : "list"
  );

  function choose(next: View) {
    setView(next);
    writePlainKey(storageKey, next);
  }

  return (
    <>
      <div className="view-switch">
        <div className="seg" role="group" aria-label="To-do view">
          <button
            className={`seg-btn ${view === "list" ? "seg-btn-on" : ""}`}
            aria-pressed={view === "list"}
            onClick={() => choose("list")}
          >
            <Icon name="list" size={16} />
            List
          </button>
          <button
            className={`seg-btn ${view === "calendar" ? "seg-btn-on" : ""}`}
            aria-pressed={view === "calendar"}
            onClick={() => choose("calendar")}
          >
            <Icon name="calendar" size={16} />
            Calendar
          </button>
        </div>
      </div>
      {view === "list" ? (
        <ListsView listType="todo" code={code} />
      ) : (
        <CalendarView code={code} />
      )}
    </>
  );
}
