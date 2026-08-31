import type {
  Item,
  List,
  Note,
  Op,
  Recurrence,
  SpaceState,
} from "@/lib/types";

/** Pure optimistic reducer — mirrors the server's semantics for each op so
 *  pending (unflushed) ops can be layered over the last known server state. */
export function applyOpToState(
  state: SpaceState,
  op: Op,
  memberId: string
): SpaceState {
  const now = new Date().toISOString();
  switch (op.type) {
    case "space.rename":
      return { ...state, space: { ...state.space, name: op.name } };

    case "member.rename":
      return {
        ...state,
        members: state.members.map((m) =>
          m.id === memberId ? { ...m, name: op.name } : m
        ),
      };

    case "list.add": {
      if (state.lists.some((l) => l.id === op.id)) return state;
      const maxPos = Math.max(0, ...state.lists.map((l) => l.position));
      const list: List = {
        id: op.id,
        type: op.listType,
        title: op.title,
        groupByCategory: true,
        position: maxPos + 1,
        createdAt: now,
        items: [],
      };
      return { ...state, lists: [...state.lists, list] };
    }

    case "list.rename":
      return {
        ...state,
        lists: state.lists.map((l) =>
          l.id === op.id ? { ...l, title: op.title } : l
        ),
      };

    case "list.delete": {
      // Rules (and their completions) cascade with the list on the server;
      // mirror that so the calendar doesn't keep drawing a deleted list's
      // chores until the next poll.
      const dropped = new Set(
        state.recurrences.filter((r) => r.listId === op.id).map((r) => r.id)
      );
      return {
        ...state,
        lists: state.lists.filter((l) => l.id !== op.id),
        recurrences: state.recurrences.filter((r) => !dropped.has(r.id)),
        recurrenceDone: state.recurrenceDone.filter(
          (d) => !dropped.has(d.recurrenceId)
        ),
      };
    }

    case "list.setGroup":
      return {
        ...state,
        lists: state.lists.map((l) =>
          l.id === op.id ? { ...l, groupByCategory: op.groupByCategory } : l
        ),
      };

    case "item.add":
      return {
        ...state,
        lists: state.lists.map((l) => {
          if (l.id !== op.listId) return l;
          if (l.items.some((i) => i.id === op.id)) return l;
          const maxPos = Math.max(0, ...l.items.map((i) => i.position));
          const item: Item = {
            id: op.id,
            listId: l.id,
            text: op.text,
            qty: op.qty ?? null,
            category: op.category ?? null,
            done: false,
            doneAt: null,
            completedBy: null,
            assignedTo: op.assignedTo ?? null,
            createdBy: memberId,
            dueDate: op.dueDate ?? null,
            // Filled in by the server on the next poll, if the text matches.
            canonicalItemId: null,
            position: maxPos + 1,
            createdAt: now,
          };
          return { ...l, items: [...l.items, item] };
        }),
      };

    case "item.update":
      return {
        ...state,
        lists: state.lists.map((l) => {
          if (!l.items.some((i) => i.id === op.id)) return l;
          return {
            ...l,
            items: l.items.map((i) => {
              if (i.id !== op.id) return i;
              const next = { ...i, ...op.patch };
              if (op.patch.done !== undefined) {
                next.doneAt = op.patch.done ? now : null;
                next.completedBy = op.patch.done ? memberId : null;
              }
              return next;
            }),
          };
        }),
      };

    case "item.delete":
      return {
        ...state,
        lists: state.lists.map((l) =>
          l.items.some((i) => i.id === op.id)
            ? { ...l, items: l.items.filter((i) => i.id !== op.id) }
            : l
        ),
      };

    case "items.clearDone":
      return {
        ...state,
        lists: state.lists.map((l) =>
          l.id === op.listId
            ? { ...l, items: l.items.filter((i) => !i.done) }
            : l
        ),
      };

    case "recur.add": {
      if (state.recurrences.some((r) => r.id === op.id)) return state;
      const rule: Recurrence = {
        id: op.id,
        listId: op.listId,
        text: op.text,
        daysMask: op.daysMask,
        assignedTo: op.assignedTo ?? null,
        createdBy: memberId,
        startDate: op.startDate,
        createdAt: now,
      };
      return { ...state, recurrences: [...state.recurrences, rule] };
    }

    case "recur.update":
      return {
        ...state,
        recurrences: state.recurrences.map((r) =>
          r.id === op.id ? { ...r, ...op.patch } : r
        ),
      };

    case "recur.delete":
      return {
        ...state,
        recurrences: state.recurrences.filter((r) => r.id !== op.id),
        // Completions cascade on the server; mirror that so a deleted-then-
        // recreated rule can't inherit the old one's checkmarks.
        recurrenceDone: state.recurrenceDone.filter(
          (d) => d.recurrenceId !== op.id
        ),
      };

    case "recur.setDone": {
      const without = state.recurrenceDone.filter(
        (d) => !(d.recurrenceId === op.id && d.date === op.date)
      );
      return {
        ...state,
        recurrenceDone: op.done
          ? [
              ...without,
              {
                recurrenceId: op.id,
                date: op.date,
                completedBy: memberId,
              },
            ]
          : without,
      };
    }

    case "note.add": {
      if (state.notes.some((n) => n.id === op.id)) return state;
      const note: Note = {
        id: op.id,
        title: "",
        body: "",
        updatedBy: memberId,
        updatedAt: now,
        createdAt: now,
      };
      return { ...state, notes: [note, ...state.notes] };
    }

    case "note.update":
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === op.id
            ? { ...n, ...op.patch, updatedBy: memberId, updatedAt: now }
            : n
        ),
      };

    case "note.delete":
      return { ...state, notes: state.notes.filter((n) => n.id !== op.id) };

    default:
      return state;
  }
}
