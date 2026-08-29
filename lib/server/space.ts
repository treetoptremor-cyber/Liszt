import { q } from "@/lib/db";
import { normalizeCode } from "@/lib/codes";
import type { Item, List, Member, Note, Op, SpaceState } from "@/lib/types";

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
  const [memberRows, listRows, itemRows, noteRows, freqRows] =
    await Promise.all([
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
                i.assigned_to, i.created_by, i.position, i.created_at
         FROM items i JOIN lists l ON l.id = i.list_id
         WHERE l.space_id = $1
         ORDER BY i.position, i.created_at`,
        [space.id]
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
      assignedTo: (r.assigned_to as string | null) ?? null,
      createdBy: (r.created_by as string | null) ?? null,
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
      await assertListInSpace(listId, space.id);
      const inserted = await q(
        `INSERT INTO items (id, list_id, text, qty, category, created_by, position)
         VALUES ($1, $2, $3, $4, $5, $6,
           (SELECT COALESCE(MAX(position), 0) + 1 FROM items WHERE list_id = $2))
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [id, listId, text, qty, category, member.id]
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
        sets.push(patch.done ? "done_at = now()" : "done_at = NULL");
      }
      if (patch.assignedTo !== undefined) {
        let assignee: string | null = null;
        if (patch.assignedTo != null) {
          assignee = assertUuid(patch.assignedTo, "member id");
          const rows = await q(
            "SELECT 1 FROM members WHERE id = $1 AND space_id = $2",
            [assignee, space.id]
          );
          if (rows.length === 0) {
            throw new ApiError(400, "That person isn't in this space");
          }
        }
        add("assigned_to = ?", assignee);
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
