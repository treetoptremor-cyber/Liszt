export type ListType = "grocery" | "todo";

/** How far back completed occurrences of repeating to-dos are kept in the
 *  state payload. The calendar clamps its own back-navigation to match, so
 *  you never page into a stretch whose checkmarks weren't sent. */
export const RECURRENCE_HISTORY_DAYS = 95;

export interface Space {
  id: string;
  code: string;
  name: string;
}

export interface Member {
  id: string;
  name: string;
  color: string;
}

export interface Item {
  id: string;
  listId: string;
  text: string;
  qty: string | null;
  category: string | null;
  done: boolean;
  doneAt: string | null;
  completedBy: string | null;
  assignedTo: string | null;
  createdBy: string | null;
  /** Local calendar date (YYYY-MM-DD) this to-do is scheduled for, or null
   *  for an undated item. Deliberately a plain date, not a timestamp — a
   *  to-do due Tuesday is due Tuesday wherever you open the app. */
  dueDate: string | null;
  position: number;
  createdAt: string;
}

export interface List {
  id: string;
  type: ListType;
  title: string;
  groupByCategory: boolean;
  position: number;
  createdAt: string;
  items: Item[];
}

/** A to-do that repeats on chosen weekdays. One rule renders an occurrence on
 *  every matching day from `startDate` onward; whether a given day's occurrence
 *  is checked off lives in `recurrenceDone`, so ticking this Tuesday leaves
 *  next Tuesday untouched. */
export interface Recurrence {
  id: string;
  listId: string;
  text: string;
  /** Weekday bitmask: bit 0 = Sunday … bit 6 = Saturday. */
  daysMask: number;
  assignedTo: string | null;
  createdBy: string | null;
  startDate: string;
  createdAt: string;
}

export interface RecurrenceDone {
  recurrenceId: string;
  date: string;
  completedBy: string | null;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  updatedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface FrequentItem {
  text: string;
  category: string | null;
  uses: number;
}

export interface SpaceState {
  version: number;
  space: Space;
  members: Member[];
  lists: List[];
  recurrences: Recurrence[];
  /** Completions for the recent past and the future; older ones are pruned
   *  from the payload (see RECURRENCE_DONE_WINDOW_DAYS on the server). */
  recurrenceDone: RecurrenceDone[];
  notes: Note[];
  frequent: FrequentItem[];
}

/** Mutation operations. The same vocabulary is applied optimistically on the
 *  client (reducer) and executed transactionally on the server (SQL). */
export type Op =
  | { type: "space.rename"; name: string }
  | { type: "member.rename"; name: string }
  | { type: "list.add"; id: string; listType: ListType; title: string }
  | { type: "list.rename"; id: string; title: string }
  | { type: "list.delete"; id: string }
  | { type: "list.setGroup"; id: string; groupByCategory: boolean }
  | {
      type: "item.add";
      id: string;
      listId: string;
      text: string;
      qty?: string | null;
      category?: string | null;
      dueDate?: string | null;
      assignedTo?: string | null;
    }
  | {
      type: "item.update";
      id: string;
      patch: {
        text?: string;
        qty?: string | null;
        category?: string | null;
        done?: boolean;
        assignedTo?: string | null;
        dueDate?: string | null;
      };
    }
  | { type: "item.delete"; id: string }
  | { type: "items.clearDone"; listId: string }
  | {
      type: "recur.add";
      id: string;
      listId: string;
      text: string;
      daysMask: number;
      startDate: string;
      assignedTo?: string | null;
    }
  | {
      type: "recur.update";
      id: string;
      patch: { text?: string; daysMask?: number; assignedTo?: string | null };
    }
  | { type: "recur.delete"; id: string }
  | { type: "recur.setDone"; id: string; date: string; done: boolean }
  | { type: "note.add"; id: string }
  | { type: "note.update"; id: string; patch: { title?: string; body?: string } }
  | { type: "note.delete"; id: string };

export const MEMBER_COLORS = [
  "#B65C3F",
  "#3E7CB1",
  "#6A994E",
  "#7E5BA6",
  "#B08900",
  "#A34E78",
  "#3A8F85",
  "#8A6F4D",
];
