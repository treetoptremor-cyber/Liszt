export type ListType = "grocery" | "todo";

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
      };
    }
  | { type: "item.delete"; id: string }
  | { type: "items.clearDone"; listId: string }
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
