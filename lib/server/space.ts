import { q } from "@/lib/db";
import { normalizeCode } from "@/lib/codes";
import { matchGroceryItem, recordCategoryVote } from "@/lib/server/catalog";
import { RECURRENCE_HISTORY_DAYS } from "@/lib/types";
import type { OpResult } from "@/lib/server/events";
import type {
  Item,
  List,
  ListType,
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
export function toDateStr(v: unknown): string | null {
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
                i.canonical_item_id, i.position, i.created_at
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
      canonicalItemId: (r.canonical_item_id as string | null) ?? null,
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

/** Assert the list belongs to this space, and report its type — callers need
 *  it both to scope catalog matching to grocery lists (P3) and to tag events. */
async function listTypeInSpace(
  listId: string,
  spaceId: string
): Promise<ListType> {
  const rows = await q(
    "SELECT type FROM lists WHERE id = $1 AND space_id = $2",
    [listId, spaceId]
  );
  if (rows.length === 0) throw new ApiError(404, "List not found");
  return rows[0].type as ListType;
}

/** How many weekdays a recurrence bitmask selects. */
function countDays(mask: number): number {
  let n = 0;
  for (let m = mask; m > 0; m >>= 1) n += m & 1;
  return n;
}

/** The category slug behind an item's canonical link, as a scalar subquery so
 *  a completion event can be tagged without a second round trip. */
const CATEGORY_SLUG_SUBQUERY = `(SELECT c.slug FROM canonical_items ci
       JOIN item_categories c ON c.id = ci.category_id
      WHERE ci.id = items.canonical_item_id)`;

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
 *  (ON CONFLICT DO NOTHING) so the client's offline queue can safely retry.
 *
 *  Returns the analytics event this op produced, if any — handlers know
 *  outcome details (whether an idempotent insert actually landed, how many
 *  rows a clear removed, which canonical item matched) that the route would
 *  otherwise have to re-derive. The route does the writing; see
 *  lib/server/events.ts for the props allowlist. */
export async function applyOp(
  space: SpaceRow,
  member: Member,
  op: Op
): Promise<OpResult> {
  switch (op.type) {
    case "space.rename": {
      const name = cleanText(op.name, "Space name", 60);
      await q("UPDATE spaces SET name = $1 WHERE id = $2", [name, space.id]);
      return {};
    }
    case "member.rename": {
      const name = cleanText(op.name, "Name", 40);
      await q("UPDATE members SET name = $1 WHERE id = $2 AND space_id = $3", [
        name,
        member.id,
        space.id,
      ]);
      return {};
    }
    case "list.add": {
      const id = assertUuid(op.id, "list id");
      const title = cleanText(op.title, "List title", 60);
      if (op.listType !== "grocery" && op.listType !== "todo") {
        throw new ApiError(400, "Invalid list type");
      }
      const inserted = await q(
        `INSERT INTO lists (id, space_id, type, title, position)
         VALUES ($1, $2, $3, $4,
           (SELECT COALESCE(MAX(position), 0) + 1 FROM lists WHERE space_id = $2))
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [id, space.id, op.listType, title]
      );
      // Nothing inserted means this is a retry of an op that already landed.
      if (inserted.length === 0) return {};
      return {
        event: {
          type: "list.created",
          entityId: id,
          props: { list_type: op.listType },
        },
      };
    }
    case "list.rename": {
      const id = assertUuid(op.id, "list id");
      const title = cleanText(op.title, "List title", 60);
      await q(
        "UPDATE lists SET title = $1 WHERE id = $2 AND space_id = $3",
        [title, id, space.id]
      );
      return {};
    }
    case "list.delete": {
      const id = assertUuid(op.id, "list id");
      const deleted = await q(
        "DELETE FROM lists WHERE id = $1 AND space_id = $2 RETURNING type",
        [id, space.id]
      );
      if (deleted.length === 0) return {};
      return {
        event: {
          type: "list.deleted",
          entityId: id,
          props: { list_type: deleted[0].type as string },
        },
      };
    }
    case "list.setGroup": {
      const id = assertUuid(op.id, "list id");
      await q(
        "UPDATE lists SET group_by_category = $1 WHERE id = $2 AND space_id = $3",
        [Boolean(op.groupByCategory), id, space.id]
      );
      return {};
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
      const listType = await listTypeInSpace(listId, space.id);
      const assignedTo = await resolveAssignee(op.assignedTo ?? null, space.id);

      // P3: only grocery text meets the catalog. Matching before the insert
      // means a retry of an already-applied add re-counts the term in
      // `unmatched_terms`; that only happens when a response was lost, and
      // the counter is a curation signal, not a metric.
      const match =
        listType === "grocery" ? await matchGroceryItem(text) : null;
      // A category the user picked always wins — the catalog only fills a blank.
      const resolvedCategory = category ?? match?.categoryName ?? null;
      const canonicalItemId = match?.canonicalItemId ?? null;

      const inserted = await q(
        `INSERT INTO items (id, list_id, text, qty, category, created_by,
                            due_date, assigned_to, canonical_item_id, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
           (SELECT COALESCE(MAX(position), 0) + 1 FROM items WHERE list_id = $2))
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [
          id,
          listId,
          text,
          qty,
          resolvedCategory,
          member.id,
          dueDate,
          assignedTo,
          canonicalItemId,
        ]
      );
      if (inserted.length === 0) return {};

      await q(
        `INSERT INTO frequent_items (space_id, text_key, text, category, canonical_item_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (space_id, text_key)
         DO UPDATE SET uses = frequent_items.uses + 1, last_used = now(),
                       text = EXCLUDED.text,
                       category = COALESCE(EXCLUDED.category, frequent_items.category),
                       canonical_item_id = COALESCE(EXCLUDED.canonical_item_id,
                                                    frequent_items.canonical_item_id)`,
        [space.id, text.toLowerCase(), text, resolvedCategory, canonicalItemId]
      );

      return {
        event: {
          type: "item.added",
          entityId: id,
          props: {
            list_type: listType,
            // What the op carried, not what the item ended up with — these
            // measure what people type, not what the catalog filled in.
            has_qty: qty !== null,
            has_category: category !== null,
            has_due_date: dueDate !== null,
            assigned: assignedTo !== null,
            matched: match !== null,
            canonical_item_id: canonicalItemId,
            category_slug: match?.categorySlug ?? null,
          },
        },
      };
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
      const newText =
        patch.text === undefined ? null : cleanText(patch.text, "Item", 200);
      if (newText !== null) {
        add("text = ?", newText);
      }
      if (patch.qty !== undefined) {
        add("qty = ?", patch.qty == null ? null : cleanText(patch.qty, "Quantity", 40));
      }
      const newCategory =
        patch.category == null ? null : cleanText(patch.category, "Category", 40);
      if (patch.category !== undefined) {
        add("category = ?", newCategory);
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
      if (sets.length === 0) return {};
      sets.push("updated_at = now()");
      params.push(id, space.id);
      const updated = await q(
        `UPDATE items SET ${sets.join(", ")}
         FROM lists
         WHERE items.id = $${params.length - 1}
           AND items.list_id = lists.id
           AND lists.space_id = $${params.length}
         RETURNING lists.type, items.text, items.canonical_item_id,
                   ${CATEGORY_SLUG_SUBQUERY} AS category_slug`,
        params
      );
      const row = updated[0];
      // No row means the item isn't in this space (or is already gone).
      if (!row) return {};
      const listType = row.type as ListType;

      let canonicalItemId = (row.canonical_item_id as string | null) ?? null;
      let categorySlug = (row.category_slug as string | null) ?? null;
      // Re-match on a text change, grocery only (P3). Text that no longer
      // matches clears the link; a category the user set is left alone.
      if (newText !== null && listType === "grocery") {
        const match = await matchGroceryItem(newText);
        canonicalItemId = match?.canonicalItemId ?? null;
        categorySlug = match?.categorySlug ?? null;
        await q(
          `UPDATE items SET canonical_item_id = $1
           FROM lists
           WHERE items.id = $2
             AND items.list_id = lists.id
             AND lists.space_id = $3`,
          [canonicalItemId, id, space.id]
        );
      }

      // Filing an item the catalog didn't recognize under a category is the
      // one signal end users give it. Aggregated globally and unlinked; a
      // human still has to promote it (see recordCategoryVote).
      if (newCategory !== null && listType === "grocery" && !canonicalItemId) {
        await recordCategoryVote(row.text as string, newCategory);
      }

      if (patch.done === undefined) return {};
      return patch.done
        ? {
            event: {
              type: "item.completed",
              entityId: id,
              props: {
                list_type: listType,
                canonical_item_id: canonicalItemId,
                category_slug: categorySlug,
              },
            },
          }
        : {
            event: {
              type: "item.uncompleted",
              entityId: id,
              props: { list_type: listType },
            },
          };
    }
    case "item.delete": {
      const id = assertUuid(op.id, "item id");
      const removed = await q(
        `DELETE FROM items USING lists
         WHERE items.id = $1 AND items.list_id = lists.id AND lists.space_id = $2
         RETURNING lists.type`,
        [id, space.id]
      );
      if (removed.length === 0) return {};
      return {
        event: {
          type: "item.deleted",
          entityId: id,
          props: { list_type: removed[0].type as string },
        },
      };
    }
    case "items.clearDone": {
      const listId = assertUuid(op.listId, "list id");
      const cleared = await q(
        `DELETE FROM items USING lists
         WHERE items.list_id = $1 AND items.done
           AND items.list_id = lists.id AND lists.space_id = $2
         RETURNING lists.type`,
        [listId, space.id]
      );
      if (cleared.length === 0) return {};
      return {
        event: {
          type: "items.cleared",
          entityId: listId,
          props: {
            list_type: cleared[0].type as string,
            cleared_count: cleared.length,
          },
        },
      };
    }
    case "recur.add": {
      const id = assertUuid(op.id, "rule id");
      const listId = assertUuid(op.listId, "list id");
      const text = cleanText(op.text, "To-do", 200);
      const daysMask = assertDaysMask(op.daysMask);
      const startDate = assertDate(op.startDate, "start date");
      await assertTodoList(listId, space.id);
      const assignedTo = await resolveAssignee(op.assignedTo ?? null, space.id);
      const inserted = await q(
        `INSERT INTO recurrences
           (id, space_id, list_id, text, days_mask, assigned_to, created_by, start_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [id, space.id, listId, text, daysMask, assignedTo, member.id, startDate]
      );
      if (inserted.length === 0) return {};
      return {
        event: {
          type: "recur.created",
          entityId: id,
          props: { days_count: countDays(daysMask) },
        },
      };
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
      if (sets.length === 0) return {};
      params.push(id, space.id);
      await q(
        `UPDATE recurrences SET ${sets.join(", ")}
         WHERE id = $${params.length - 1} AND space_id = $${params.length}`,
        params
      );
      return {};
    }
    case "recur.delete": {
      const id = assertUuid(op.id, "rule id");
      await q("DELETE FROM recurrences WHERE id = $1 AND space_id = $2", [
        id,
        space.id,
      ]);
      return {};
    }
    case "recur.setDone": {
      const id = assertUuid(op.id, "rule id");
      const date = assertDate(op.date, "date");
      if (op.done) {
        // The join against recurrences keeps the write scoped to this space,
        // and doubles as the existence check for the rule.
        const done = await q(
          `INSERT INTO recurrence_done (recurrence_id, on_date, completed_by)
           SELECT r.id, $2::date, $3 FROM recurrences r
           WHERE r.id = $1 AND r.space_id = $4
           ON CONFLICT (recurrence_id, on_date)
           DO UPDATE SET completed_by = EXCLUDED.completed_by, done_at = now()
           RETURNING recurrence_id`,
          [id, date, member.id, space.id]
        );
        if (done.length === 0) return {};
        return { event: { type: "recur.completed", entityId: id } };
      }
      await q(
        `DELETE FROM recurrence_done d USING recurrences r
         WHERE d.recurrence_id = $1 AND d.on_date = $2::date
           AND r.id = d.recurrence_id AND r.space_id = $3`,
        [id, date, space.id]
      );
      return {};
    }
    case "note.add": {
      const id = assertUuid(op.id, "note id");
      const inserted = await q(
        `INSERT INTO notes (id, space_id, updated_by) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [id, space.id, member.id]
      );
      if (inserted.length === 0) return {};
      // P2: notes are opaque — the event says a note happened, nothing more.
      return { event: { type: "note.created", entityId: id } };
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
      if (sets.length === 0) return {};
      params.push(member.id);
      sets.push(`updated_by = $${params.length}`, "updated_at = now()");
      params.push(id, space.id);
      const updated = await q(
        `UPDATE notes SET ${sets.join(", ")}
         WHERE id = $${params.length - 1} AND space_id = $${params.length}
         RETURNING id`,
        params
      );
      if (updated.length === 0) return {};
      return { event: { type: "note.updated", entityId: id } };
    }
    case "note.delete": {
      const id = assertUuid(op.id, "note id");
      const removed = await q(
        "DELETE FROM notes WHERE id = $1 AND space_id = $2 RETURNING id",
        [id, space.id]
      );
      if (removed.length === 0) return {};
      return { event: { type: "note.deleted", entityId: id } };
    }
    default:
      throw new ApiError(400, "Unknown operation");
  }
}
