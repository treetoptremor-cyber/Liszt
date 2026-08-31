import { q } from "@/lib/db";
import { normalizeCode } from "@/lib/codes";
import { RECURRENCE_HISTORY_DAYS } from "@/lib/types";
import type {
  Item,
  List,
  Member,
  Note,
  Op,
  Recurrence,
  RecurrenceDone,
  SpaceState,
} from "@/lib/types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(v: unknown, label: string): string {
  if (typeof v !== "string" || !UUID_RE.test(v)) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  return v.toLowerCase();
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A calendar date must be a real "YYYY-MM-DD" — 2026-02-31 is rejected
 *  rather than silently rolling into March. */
export function assertDate(v: unknown, label: string): string {
  if (typeof v !== "string" || !DATE_RE.test(v)) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  const [y, m, d] = v.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  return v;
}

/** Weekday bitmask: bit 0 = Sunday … bit 6 = Saturday, at least one day set. */
export function assertDaysMask(v: unknown): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 127) {
    throw new ApiError(400, "Pick at least one day of the week");
  }
  return v;
}

/** Postgres `date` comes back as a string on Neon and as a Date (UTC
 *  midnight) on PGlite — normalize both to "YYYY-MM-DD". */
function toDateStr(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

export function cleanText(v: unknown, label: string, max: number): string {
  if (typeof v !== "string") throw new ApiError(400, `Invalid ${label}`);
  const t = v.replace(/\s+/g, " ").trim();
  if (!t) throw new ApiError(400, `${label} cannot be empty`);
  if (t.length > max) throw new ApiError(400, `${label} is too long`);
  return t;
}

interface SpaceRow {
  id: string;
  code: string;
  name: string;
  version: number;
}

export async function getSpaceByCode(code: string): Promise<SpaceRow> {
  const rows = await q(
    "SELECT id, code, name, version FROM spaces WHERE code = $1",
    [normalizeCode(code)]
  );
  if (rows.length === 0) throw new ApiError(404, "Space not found");
  const r = rows[0];
  return {
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    version: Number(r.version),
  };
}

/** All state/mutation requests must carry the id of a member of this space
 *  (x-member-id header). The share code admits you via /join; this check
 *  keeps every other endpoint scoped to actual members. */
export async function requireMember(
  spaceId: string,
  memberId: string | null
): Promise<Member> {
  if (!memberId || !UUID_RE.test(memberId)) {
    throw new ApiError(401, "Missing member id");
  }
  const rows = await q(
    "SELECT id, name, color FROM members WHERE id = $1 AND space_id = $2",
    [memberId, spaceId]
  );
  if (rows.length === 0) throw new ApiError(403, "Not a member of this space");
  const r = rows[0];
  return { id: r.id as string, name: r.name as string, color: r.color as string };
}

export async function bumpVersion(spaceId: string): Promise<number> {
  const rows = await q(
    "UPDATE spaces SET version = version + 1 WHERE id = $1 RETURNING version",
    [spaceId]
  );
  return Number(rows[0]?.version ?? 0);
}

export async function loadState(space: SpaceRow): Promise<SpaceState> {
  const [
    memberRows,
    listRows,
    itemRows,
    recurRows,
    recurDoneRows,
    noteRows,
    freqRows,
  ] = await Promise.all([
      q(
        "SELECT id, name, color FROM members WHERE space_id = $1 ORDER BY created_at",
        [space.id]
      ),
      q(
        "SELECT id, type, title, group_by_category, position, created_at FROM lists WHERE space_id = $1 ORDER BY position, created_at",
        [space.id]
      ),
      q(
        `SELECT i.id, i.list_id, i.text, i.qty, i.category, i.done, i.done_at,
                i.completed_by, i.assigned_to, i.created_by, i.due_date,
                i.position, i.created_at
         FROM items i JOIN lists l ON l.id = i.list_id
         WHERE l.space_id = $1
         ORDER BY i.position, i.created_at`,
        [space.id]
      ),
      q(
        `SELECT id, list_id, text, days_mask, assigned_to, created_by,
                start_date, created_at
         FROM recurrences WHERE space_id = $1 ORDER BY created_at`,
        [space.id]
      ),
      // Only the recent past — a years-old completion log would bloat every
      // poll, and the calendar won't page back beyond this window either.
      q(
        `SELECT d.recurrence_id, d.on_date, d.completed_by
         FROM recurrence_done d JOIN recurrences r ON r.id = d.recurrence_id
         WHERE r.space_id = $1 AND d.on_date >= CURRENT_DATE - $2::int`,
        [space.id, RECURRENCE_HISTORY_DAYS]
      ),
      q(
        "SELECT id, title, body, updated_by, updated_at, created_at FROM notes WHERE space_id = $1 ORDER BY updated_at DESC",
        [space.id]
      ),
      q(
        "SELECT text, category, uses FROM frequent_items WHERE space_id = $1 ORDER BY uses DESC, last_used DESC LIMIT 60",
        [space.id]
      ),
    ]);

  const members: Member[] = memberRows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    color: r.color as string,
  }));

  const itemsByList = new Map<string, Item[]>();
  for (const r of itemRows) {
    const item: Item = {
      id: r.id as string,
      listId: r.list_id as string,
      text: r.text as string,
      qty: (r.qty as string | null) ?? null,
      category: (r.category as string | null) ?? null,
      done: Boolean(r.done),
      doneAt: r.done_at ? new Date(r.done_at as string).toISOString() : null,
      completedBy: (r.completed_by as string | null) ?? null,
      assignedTo: (r.assigned_to as string | null) ?? null,
      createdBy: (r.created_by as string | null) ?? null,
      dueDate: toDateStr(r.due_date),
      position: Number(r.position),
      createdAt: new Date(r.created_at as string).toISOString(),
    };
    const arr = itemsByList.get(item.listId) ?? [];
    arr.push(item);
    itemsByList.set(item.listId, arr);
  }

  const lists: List[] = listRows.map((r) => ({
    id: r.id as string,
    type: r.type as List["type"],
    title: r.title as string,
    groupByCategory: Boolean(r.group_by_category),
    position: Number(r.position),
    createdAt: new Date(r.created_at as string).toISOString(),
    items: itemsByList.get(r.id as string) ?? [],
  }));

  const recurrences: Recurrence[] = recurRows.map((r) => ({
    id: r.id as string,
    listId: r.list_id as string,
    text: r.text as string,
    daysMask: Number(r.days_mask),
    assignedTo: (r.assigned_to as string | null) ?? null,
    createdBy: (r.created_by as string | null) ?? null,
    startDate: toDateStr(r.start_date) ?? "1970-01-01",
    createdAt: new Date(r.created_at as string).toISOString(),
  }));

  const recurrenceDone: RecurrenceDone[] = recurDoneRows.map((r) => ({
    recurrenceId: r.recurrence_id as string,
    date: toDateStr(r.on_date) ?? "",
    completedBy: (r.completed_by as string | null) ?? null,
  }));

  const notes: Note[] = noteRows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    body: r.body as string,
    updatedBy: (r.updated_by as string | null) ?? null,
    updatedAt: new Date(r.updated_at as string).toISOString(),
    createdAt: new Date(r.created_at as string).toISOString(),
  }));

  return {
    version: space.version,
    space: { id: space.id, code: space.code, name: space.name },
    members,
    lists,
    recurrences,
    recurrenceDone,
    notes,
    frequent: freqRows.map((r) => ({
      text: r.text as string,
      category: (r.category as string | null) ?? null,
      uses: Number(r.uses),
    })),
  };
}

async function assertListInSpace(listId: string, spaceId: string) {
  const rows = await q("SELECT id FROM lists WHERE id = $1 AND space_id = $2", [
    listId,
    spaceId,
  ]);
  if (rows.length === 0) throw new ApiError(404, "List not found");
}

/** Recurrences are a to-do feature; a grocery list can't own one. */
async function assertTodoList(listId: string, spaceId: string) {
  const rows = await q(
    "SELECT id FROM lists WHERE id = $1 AND space_id = $2 AND type = 'todo'",
    [listId, spaceId]
  );
  if (rows.length === 0) throw new ApiError(404, "To-do list not found");
}

/** Resolve an optional assignee to a member of this space. */
async function resolveAssignee(
  value: unknown,
  spaceId: string
): Promise<string | null> {
  if (value == null) return null;
  const id = assertUuid(value, "member id");
  const rows = await q("SELECT 1 FROM members WHERE id = $1 AND space_id = $2", [
    id,
    spaceId,
  ]);
  if (rows.length === 0) {
    throw new ApiError(400, "That person isn't in this space");
  }
  return id;
}

/** Execute one mutation op. Every statement is scoped to the space so an id
 *  from another space can never be read or written. Adds are idempotent
 *  (ON CONFLICT DO NOTHING) so the client's offline queue can safely retry. */
export async function applyOp(
  space: SpaceRow,
  member: Member,
  op: Op
): Promise<void> {
  switch (op.type) {
    case "space.rename": {
      const name = cleanText(op.name, "Space name", 60);
      await q("UPDATE spaces SET name = $1 WHERE id = $2", [name, space.id]);
      return;
    }
    case "member.rename": {
      const name = cleanText(op.name, "Name", 40);
      await q("UPDATE members SET name = $1 WHERE id = $2 AND space_id = $3", [
        name,
        member.id,
        space.id,
      ]);
      return;
    }
    case "list.add": {
      const id = assertUuid(op.id, "list id");
      const title = cleanText(op.title, "List title", 60);
      if (op.listType !== "grocery" && op.listType !== "todo") {
        throw new ApiError(400, "Invalid list type");
      }
      await q(
        `INSERT INTO lists (id, space_id, type, title, position)
         VALUES ($1, $2, $3, $4,
           (SELECT COALESCE(MAX(position), 0) + 1 FROM lists WHERE space_id = $2))
         ON CONFLICT (id) DO NOTHING`,
        [id, space.id, op.listType, title]
      );
      return;
    }
    case "list.rename": {
      const id = assertUuid(op.id, "list id");
      const title = cleanText(op.title, "List title", 60);
      await q(
        "UPDATE lists SET title = $1 WHERE id = $2 AND space_id = $3",
        [title, id, space.id]
      );
      return;
    }
    case "list.delete": {
      const id = assertUuid(op.id, "list id");
      await q("DELETE FROM lists WHERE id = $1 AND space_id = $2", [
        id,
        space.id,
      ]);
      return;
    }
    case "list.setGroup": {
      const id = assertUuid(op.id, "list id");
      await q(
        "UPDATE lists SET group_by_category = $1 WHERE id = $2 AND space_id = $3",
        [Boolean(op.groupByCategory), id, space.id]
      );
      return;
    }
    case "item.add": {
      const id = assertUuid(op.id, "item id");
      const listId = assertUuid(op.listId, "list id");
      const text = cleanText(op.text, "Item", 200);
      const qty =
        op.qty == null ? null : cleanText(op.qty, "Quantity", 40);
      const category =
        op.category == null ? null : cleanText(op.category, "Category", 40);
      const dueDate =
        op.dueDate == null ? null : assertDate(op.dueDate, "due date");
      await assertListInSpace(listId, space.id);
      const assignedTo = await resolveAssignee(op.assignedTo ?? null, space.id);
      const inserted = await q(
        `INSERT INTO items (id, list_id, text, qty, category, created_by,
                            due_date, assigned_to, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
           (SELECT COALESCE(MAX(position), 0) + 1 FROM items WHERE list_id = $2))
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [id, listId, text, qty, category, member.id, dueDate, assignedTo]
      );
      if (inserted.length > 0) {
        await q(
          `INSERT INTO frequent_items (space_id, text_key, text, category)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (space_id, text_key)
           DO UPDATE SET uses = frequent_items.uses + 1, last_used = now(),
                         text = EXCLUDED.text,
                         category = COALESCE(EXCLUDED.category, frequent_items.category)`,
          [space.id, text.toLowerCase(), text, category]
        );
      }
      return;
    }
    case "item.update": {
      const id = assertUuid(op.id, "item id");
      const patch = op.patch ?? {};
      const sets: string[] = [];
      const params: unknown[] = [];
      const add = (fragment: string, value: unknown) => {
        params.push(value);
        sets.push(fragment.replace("?", `$${params.length}`));
      };
      if (patch.text !== undefined) {
        add("text = ?", cleanText(patch.text, "Item", 200));
      }
      if (patch.qty !== undefined) {
        add("qty = ?", patch.qty == null ? null : cleanText(patch.qty, "Quantity", 40));
      }
      if (patch.category !== undefined) {
        add(
          "category = ?",
          patch.category == null ? null : cleanText(patch.category, "Category", 40)
        );
      }
      if (patch.done !== undefined) {
        add("done = ?", Boolean(patch.done));
        if (patch.done) {
          sets.push("done_at = now()");
          add("completed_by = ?", member.id);
        } else {
          sets.push("done_at = NULL", "completed_by = NULL");
        }
      }
      if (patch.assignedTo !== undefined) {
        add("assigned_to = ?", await resolveAssignee(patch.assignedTo, space.id));
      }
      if (patch.dueDate !== undefined) {
        add(
          "due_date = ?",
          patch.dueDate == null ? null : assertDate(patch.dueDate, "due date")
        );
      }
      if (sets.length === 0) return;
      sets.push("updated_at = now()");
      params.push(id, space.id);
      await q(
        `UPDATE items SET ${sets.join(", ")}
         FROM lists
         WHERE items.id = $${params.length - 1}
           AND items.list_id = lists.id
           AND lists.space_id = $${params.length}`,
        params
      );
      return;
    }
    case "item.delete": {
      const id = assertUuid(op.id, "item id");
      await q(
        `DELETE FROM items USING lists
         WHERE items.id = $1 AND items.list_id = lists.id AND lists.space_id = $2`,
        [id, space.id]
      );
      return;
    }
    case "items.clearDone": {
      const listId = assertUuid(op.listId, "list id");
      await q(
        `DELETE FROM items USING lists
         WHERE items.list_id = $1 AND items.done
           AND items.list_id = lists.id AND lists.space_id = $2`,
        [listId, space.id]
      );
      return;
    }
    case "recur.add": {
      const id = assertUuid(op.id, "rule id");
      const listId = assertUuid(op.listId, "list id");
      const text = cleanText(op.text, "To-do", 200);
      const daysMask = assertDaysMask(op.daysMask);
      const startDate = assertDate(op.startDate, "start date");
      await assertTodoList(listId, space.id);
      const assignedTo = await resolveAssignee(op.assignedTo ?? null, space.id);
      await q(
        `INSERT INTO recurrences
           (id, space_id, list_id, text, days_mask, assigned_to, created_by, start_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [id, space.id, listId, text, daysMask, assignedTo, member.id, startDate]
      );
      return;
    }
    case "recur.update": {
      const id = assertUuid(op.id, "rule id");
      const patch = op.patch ?? {};
      const sets: string[] = [];
      const params: unknown[] = [];
      const add = (fragment: string, value: unknown) => {
        params.push(value);
        sets.push(fragment.replace("?", `$${params.length}`));
      };
      if (patch.text !== undefined) {
        add("text = ?", cleanText(patch.text, "To-do", 200));
      }
      if (patch.daysMask !== undefined) {
        add("days_mask = ?", assertDaysMask(patch.daysMask));
      }
      if (patch.assignedTo !== undefined) {
        add("assigned_to = ?", await resolveAssignee(patch.assignedTo, space.id));
      }
      if (sets.length === 0) return;
      params.push(id, space.id);
      await q(
        `UPDATE recurrences SET ${sets.join(", ")}
         WHERE id = $${params.length - 1} AND space_id = $${params.length}`,
        params
      );
      return;
    }
    case "recur.delete": {
      const id = assertUuid(op.id, "rule id");
      await q("DELETE FROM recurrences WHERE id = $1 AND space_id = $2", [
        id,
        space.id,
      ]);
      return;
    }
    case "recur.setDone": {
      const id = assertUuid(op.id, "rule id");
      const date = assertDate(op.date, "date");
      if (op.done) {
        // The join against recurrences keeps the write scoped to this space,
        // and doubles as the existence check for the rule.
        await q(
          `INSERT INTO recurrence_done (recurrence_id, on_date, completed_by)
           SELECT r.id, $2::date, $3 FROM recurrences r
           WHERE r.id = $1 AND r.space_id = $4
           ON CONFLICT (recurrence_id, on_date)
           DO UPDATE SET completed_by = EXCLUDED.completed_by, done_at = now()`,
          [id, date, member.id, space.id]
        );
        return;
      }
      await q(
        `DELETE FROM recurrence_done d USING recurrences r
         WHERE d.recurrence_id = $1 AND d.on_date = $2::date
           AND r.id = d.recurrence_id AND r.space_id = $3`,
        [id, date, space.id]
      );
      return;
    }
    case "note.add": {
      const id = assertUuid(op.id, "note id");
      await q(
        `INSERT INTO notes (id, space_id, updated_by) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [id, space.id, member.id]
      );
      return;
    }
    case "note.update": {
      const id = assertUuid(op.id, "note id");
      const patch = op.patch ?? {};
      const sets: string[] = [];
      const params: unknown[] = [];
      if (patch.title !== undefined) {
        if (typeof patch.title !== "string" || patch.title.length > 200) {
          throw new ApiError(400, "Invalid note title");
        }
        params.push(patch.title);
        sets.push(`title = $${params.length}`);
      }
      if (patch.body !== undefined) {
        if (typeof patch.body !== "string" || patch.body.length > 20000) {
          throw new ApiError(400, "Invalid note body");
        }
        params.push(patch.body);
        sets.push(`body = $${params.length}`);
      }
      if (sets.length === 0) return;
      params.push(member.id);
      sets.push(`updated_by = $${params.length}`, "updated_at = now()");
      params.push(id, space.id);
      await q(
        `UPDATE notes SET ${sets.join(", ")}
         WHERE id = $${params.length - 1} AND space_id = $${params.length}`,
        params
      );
      return;
    }
    case "note.delete": {
      const id = assertUuid(op.id, "note id");
      await q("DELETE FROM notes WHERE id = $1 AND space_id = $2", [
        id,
        space.id,
      ]);
      return;
    }
    default:
      throw new ApiError(400, "Unknown operation");
  }
}
