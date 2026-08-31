"use client";

import { useMemo, useState } from "react";
import { DaySheet } from "@/components/DaySheet";
import { Icon } from "@/components/Icons";
import { ItemSheet } from "@/components/ItemSheet";
import { RecurrenceSheet, ScheduleSheet } from "@/components/ScheduleSheet";
import { Sheet } from "@/components/Sheet";
import { useSync } from "@/components/SyncContext";
import { readPlainKey, writePlainKey } from "@/lib/client/storage";
import {
  WEEKDAY_INITIALS,
  WEEK_STARTS_ON,
  addDays,
  addMonths,
  dateRange,
  dayNumber,
  dayOfWeek,
  daysInMonth,
  formatMonthYear,
  formatRelative,
  formatSpan,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  todayStr,
} from "@/lib/client/dates";
import {
  buildSchedule,
  overdueItems,
  type DayEntry,
} from "@/lib/client/schedule";
import { RECURRENCE_HISTORY_DAYS } from "@/lib/types";

type Mode = "2w" | "month";

/** Only one sheet is open at a time; `from` remembers the day to step back to
 *  when you drill into an item or a repeating rule. */
type CalSheet =
  | { kind: "day"; date: string }
  | { kind: "new"; date: string; from: string | null }
  | { kind: "item"; itemId: string; from: string | null }
  | { kind: "rule"; ruleId: string; from: string | null }
  | { kind: "overdue" }
  | null;

/** How many entries fit in a cell before they collapse into a "+N". */
const PER_CELL: Record<Mode, number> = { "2w": 4, month: 2 };

export function CalendarView({ code }: { code: string }) {
  const { snap, mutate, memberById } = useSync();
  const state = snap.state;
  const today = todayStr();

  const lists = useMemo(
    () => (state?.lists ?? []).filter((l) => l.type === "todo"),
    [state],
  );

  const modeKey = `liszt:calmode:${code}`;
  const listKey = `liszt:callist:${code}`;

  const [mode, setMode] = useState<Mode>(() =>
    typeof window !== "undefined" && readPlainKey(modeKey) === "month"
      ? "month"
      : "2w",
  );
  const [anchor, setAnchor] = useState(today);
  const [sheet, setSheet] = useState<CalSheet>(null);
  const [chosenListId, setChosenListId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readPlainKey(listKey),
  );

  const addList =
    lists.find((l) => l.id === chosenListId) ??
    (lists.length > 0 ? lists[0] : null);

  function chooseList(id: string) {
    setChosenListId(id);
    writePlainKey(listKey, id);
  }

  function chooseMode(next: Mode) {
    setMode(next);
    writePlainKey(modeKey, next);
  }

  // ---- visible range ----------------------------------------------------

  const { days, label, monthStart } = useMemo(() => {
    if (mode === "2w") {
      const start = startOfWeek(anchor);
      const range = dateRange(start, 14);
      return {
        days: range,
        label: formatSpan(range[0], range[13]),
        monthStart: null as string | null,
      };
    }
    const first = startOfMonth(anchor);
    const gridStart = startOfWeek(first);
    const lead = (dayOfWeek(first) - WEEK_STARTS_ON + 7) % 7;
    const cells = Math.ceil((lead + daysInMonth(first)) / 7) * 7;
    return {
      days: dateRange(gridStart, cells),
      label: formatMonthYear(first),
      monthStart: first,
    };
  }, [mode, anchor]);

  // Paging back is bounded by the window of completion history the server
  // ships — beyond it, checked-off repeats would render as unchecked.
  const earliest = addDays(today, -RECURRENCE_HISTORY_DAYS);
  const canGoBack = days[0] > earliest;
  const showsToday = days.includes(today);

  const schedule = useMemo(
    () =>
      state ? buildSchedule(state, days, today) : new Map<string, DayEntry[]>(),
    [state, days, today],
  );

  const overdue = useMemo(
    () => (state ? overdueItems(state, today) : []),
    [state, today],
  );

  const listTitle = useMemo(() => {
    const map = new Map(lists.map((l) => [l.id, l.title]));
    return (id: string) => map.get(id) ?? "";
  }, [lists]);

  function step(direction: -1 | 1) {
    setAnchor((a) =>
      mode === "2w" ? addDays(a, 14 * direction) : addMonths(a, direction),
    );
  }

  // ---- sheet plumbing ---------------------------------------------------

  const openItem =
    sheet?.kind === "item"
      ? (lists.flatMap((l) => l.items).find((i) => i.id === sheet.itemId) ??
        null)
      : null;
  const openRule =
    sheet?.kind === "rule"
      ? (state?.recurrences.find((r) => r.id === sheet.ruleId) ?? null)
      : null;

  const backToDay = (from: string | null) => () =>
    setSheet(from ? { kind: "day", date: from } : null);

  // If the thing a drilled-in sheet points at was deleted (by anyone, since
  // state is shared), fall back to the day it was opened from.
  const shown: CalSheet =
    (sheet?.kind === "item" && !openItem) ||
    (sheet?.kind === "rule" && !openRule)
      ? sheet.from
        ? { kind: "day", date: sheet.from }
        : null
      : sheet;

  if (lists.length === 0) {
    return (
      <div className="view view-calendar">
        <div className="empty">
          <p className="empty-title">No to-do lists yet</p>
          <p className="empty-sub">
            The calendar draws from your to-do lists — make one and you can
            start scheduling.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              const id = crypto.randomUUID();
              mutate({
                type: "list.add",
                id,
                listType: "todo",
                title: "To-dos",
              });
              chooseList(id);
            }}
          >
            Create a to-do list
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="view view-calendar">
      <div className="cal-head">
        <button
          className="icon-btn"
          onClick={() => step(-1)}
          disabled={!canGoBack}
          aria-label={mode === "2w" ? "Previous two weeks" : "Previous month"}
        >
          <Icon name="chevron-left" size={20} />
        </button>
        <h2 className="cal-title">{label}</h2>
        <button
          className="icon-btn"
          onClick={() => step(1)}
          aria-label={mode === "2w" ? "Next two weeks" : "Next month"}
        >
          <Icon name="chevron-right" size={20} />
        </button>
      </div>

      <div className="cal-controls">
        <div
          className="seg seg-compact"
          role="group"
          aria-label="Calendar span"
        >
          <button
            className={`seg-btn ${mode === "2w" ? "seg-btn-on" : ""}`}
            aria-pressed={mode === "2w"}
            onClick={() => chooseMode("2w")}
          >
            2 weeks
          </button>
          <button
            className={`seg-btn ${mode === "month" ? "seg-btn-on" : ""}`}
            aria-pressed={mode === "month"}
            onClick={() => chooseMode("month")}
          >
            Month
          </button>
        </div>
        <button
          className="link-btn"
          onClick={() => setAnchor(today)}
          disabled={showsToday}
        >
          Today
        </button>
      </div>

      {overdue.length > 0 && (
        <button
          className="overdue-pill"
          onClick={() => setSheet({ kind: "overdue" })}
        >
          <span className="overdue-dot" />
          {overdue.length} overdue
          <Icon name="chevron-right" size={15} />
        </button>
      )}

      <div className={`cal-frame ${mode === "month" ? "cal-month" : "cal-2w"}`}>
        <div className="cal-dows" aria-hidden="true">
          {WEEKDAY_INITIALS.map((letter, i) => (
            <div key={i} className="cal-dow">
              {letter}
            </div>
          ))}
        </div>
        <div className="cal-grid">
          {days.map((date) => {
            const entries = schedule.get(date) ?? [];
            const shown = entries.slice(0, PER_CELL[mode]);
            const extra = entries.length - shown.length;
            const outside =
              monthStart != null && !isSameMonth(date, monthStart);
            return (
              <button
                key={date}
                className={[
                  "cal-cell",
                  date === today ? "cal-cell-today" : "",
                  outside ? "cal-cell-out" : "",
                  date < today ? "cal-cell-past" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setSheet({ kind: "day", date })}
                aria-label={`${formatRelative(date, today)}, ${
                  entries.length === 0
                    ? "nothing scheduled"
                    : `${entries.length} scheduled`
                }`}
              >
                <span className="cal-daynum">{dayNumber(date)}</span>
                <span className="cal-entries">
                  {shown.map((entry) => (
                    <span
                      key={entry.key}
                      className={[
                        "cal-ent",
                        entry.done ? "cal-ent-done" : "",
                        entry.overdue ? "cal-ent-overdue" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {entry.text}
                    </span>
                  ))}
                  {extra > 0 && <span className="cal-more">+{extra}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        className="fab"
        aria-label="New scheduled to-do"
        onClick={() =>
          setSheet({
            kind: "new",
            date: showsToday ? today : days[0],
            from: null,
          })
        }
      >
        <Icon name="plus" size={24} />
      </button>

      {shown?.kind === "day" && addList && (
        <DaySheet
          date={shown.date}
          lists={lists}
          listId={addList.id}
          onOpenItem={(itemId) =>
            setSheet({ kind: "item", itemId, from: shown.date })
          }
          onOpenRule={(ruleId) =>
            setSheet({ kind: "rule", ruleId, from: shown.date })
          }
          onNew={() =>
            setSheet({ kind: "new", date: shown.date, from: shown.date })
          }
          onClose={() => setSheet(null)}
        />
      )}

      {shown?.kind === "new" && addList && (
        <ScheduleSheet
          date={shown.date}
          lists={lists}
          listId={addList.id}
          onListChange={chooseList}
          onBack={shown.from ? backToDay(shown.from) : undefined}
          onClose={() => setSheet(null)}
        />
      )}

      {shown?.kind === "item" && openItem && (
        <ItemSheet
          item={openItem}
          listType="todo"
          onBack={shown.from ? backToDay(shown.from) : undefined}
          onClose={() => setSheet(null)}
        />
      )}

      {shown?.kind === "rule" && openRule && (
        <RecurrenceSheet
          rule={openRule}
          lists={lists}
          onBack={shown.from ? backToDay(shown.from) : undefined}
          onClose={() => setSheet(null)}
        />
      )}

      {shown?.kind === "overdue" && (
        <Sheet title="Overdue" onClose={() => setSheet(null)}>
          <div className="sheet-body">
            <p className="day-sub">
              Dated to-dos whose day has passed. Repeating ones aren&apos;t
              counted — a missed Tuesday just stays unticked on that Tuesday.
            </p>
            <div className="card list-card">
              {overdue.map((item) => {
                const assignee = memberById(item.assignedTo);
                return (
                  <div key={item.id} className="item-row item-overdue">
                    <button
                      className="checkbox"
                      onClick={() =>
                        mutate({
                          type: "item.update",
                          id: item.id,
                          patch: { done: true },
                        })
                      }
                      aria-label={`Check off ${item.text}`}
                    />
                    <button
                      className="item-main"
                      onClick={() =>
                        setSheet({ kind: "item", itemId: item.id, from: null })
                      }
                    >
                      <span className="item-text">{item.text}</span>
                      {lists.length > 1 && (
                        <span className="list-tag">
                          {listTitle(item.listId)}
                        </span>
                      )}
                    </button>
                    <span className="overdue-when">
                      {formatRelative(item.dueDate as string, today)}
                    </span>
                    {assignee && (
                      <span className="overdue-who" title={assignee.name}>
                        <span
                          className="credit-dot"
                          style={{ backgroundColor: assignee.color }}
                        />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}
