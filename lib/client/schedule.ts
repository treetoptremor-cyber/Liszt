import type { Item, Op, Recurrence, SpaceState } from "@/lib/types";
import { dayOfWeek, maskHasDay } from "@/lib/client/dates";

/** One thing to do on one day — either a dated to-do or a single occurrence
 *  of a repeating rule. The calendar only ever deals in these; the difference
 *  between the two kinds matters when you tick one off. */
export interface DayEntry {
  kind: "item" | "recur";
  /** Item id, or rule id for an occurrence. */
  id: string;
  /** Unique per rendered row (a rule appears on many dates). */
  key: string;
  date: string;
  text: string;
  done: boolean;
  listId: string;
  assignedTo: string | null;
  completedBy: string | null;
  /** Dated, unfinished, and the day has passed. */
  overdue: boolean;
  item: Item | null;
  rule: Recurrence | null;
}

/** Checking off an occurrence records the rule + that one date; checking off
 *  a dated to-do is an ordinary item update. */
export function toggleEntryOp(entry: DayEntry): Op {
  return entry.kind === "recur"
    ? {
        type: "recur.setDone",
        id: entry.id,
        date: entry.date,
        done: !entry.done,
      }
    : { type: "item.update", id: entry.id, patch: { done: !entry.done } };
}

export function doneKey(recurrenceId: string, date: string): string {
  return `${recurrenceId} ${date}`;
}

/** A rule shows on `date` if the weekday matches and the rule had started. */
export function occursOn(rule: Recurrence, date: string): boolean {
  return date >= rule.startDate && maskHasDay(rule.daysMask, dayOfWeek(date));
}

/** Lookup of which (rule, date) pairs are checked off. */
export function doneIndex(state: SpaceState): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const d of state.recurrenceDone) {
    map.set(doneKey(d.recurrenceId, d.date), d.completedBy);
  }
  return map;
}

function entryForItem(item: Item, today: string): DayEntry {
  const date = item.dueDate as string;
  return {
    kind: "item",
    id: item.id,
    key: `i:${item.id}`,
    date,
    text: item.text,
    done: item.done,
    listId: item.listId,
    assignedTo: item.assignedTo,
    completedBy: item.completedBy,
    overdue: !item.done && date < today,
    item,
    rule: null,
  };
}

function entryForOccurrence(
  rule: Recurrence,
  date: string,
  done: Map<string, string | null>
): DayEntry {
  const key = doneKey(rule.id, date);
  const isDone = done.has(key);
  return {
    kind: "recur",
    id: rule.id,
    key: `r:${rule.id}:${date}`,
    date,
    text: rule.text,
    done: isDone,
    listId: rule.listId,
    assignedTo: rule.assignedTo,
    completedBy: isDone ? (done.get(key) ?? null) : null,
    // A repeating chore doesn't accumulate a backlog — a missed Tuesday just
    // stays unticked on that Tuesday.
    overdue: false,
    item: null,
    rule,
  };
}

/** Unfinished work first, repeats above one-offs, then stable by text. */
function compareEntries(a: DayEntry, b: DayEntry): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.kind !== b.kind) return a.kind === "recur" ? -1 : 1;
  if (a.item && b.item && a.item.position !== b.item.position) {
    return a.item.position - b.item.position;
  }
  return a.text.localeCompare(b.text);
}

/** Everything scheduled on each of `dates`, keyed by date. Every requested
 *  date is present (possibly with an empty array) so cells render uniformly. */
export function buildSchedule(
  state: SpaceState,
  dates: string[],
  today: string
): Map<string, DayEntry[]> {
  const byDate = new Map<string, DayEntry[]>();
  for (const d of dates) byDate.set(d, []);

  for (const list of state.lists) {
    if (list.type !== "todo") continue;
    for (const item of list.items) {
      const bucket = item.dueDate ? byDate.get(item.dueDate) : undefined;
      if (bucket) bucket.push(entryForItem(item, today));
    }
  }

  const done = doneIndex(state);
  for (const rule of state.recurrences) {
    for (const date of dates) {
      if (!occursOn(rule, date)) continue;
      byDate.get(date)!.push(entryForOccurrence(rule, date, done));
    }
  }

  for (const entries of byDate.values()) entries.sort(compareEntries);
  return byDate;
}

/** Everything scheduled on a single day. */
export function entriesForDay(
  state: SpaceState,
  date: string,
  today: string
): DayEntry[] {
  return buildSchedule(state, [date], today).get(date) ?? [];
}

/** Dated to-dos left unfinished before today, oldest first. Repeating
 *  occurrences are excluded by design — see `overdue` above. */
export function overdueItems(state: SpaceState, today: string): Item[] {
  const out: Item[] = [];
  for (const list of state.lists) {
    if (list.type !== "todo") continue;
    for (const item of list.items) {
      if (!item.done && item.dueDate && item.dueDate < today) out.push(item);
    }
  }
  out.sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string));
  return out;
}
