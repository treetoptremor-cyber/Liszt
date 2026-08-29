import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { generateCode } from "@/lib/codes";
import { cleanText } from "@/lib/server/space";
import { jsonError, readJson } from "@/lib/server/http";
import { MEMBER_COLORS } from "@/lib/types";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

/** Create a space plus its founding member and starter lists. */
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const spaceName = cleanText(body.spaceName, "Space name", 60);
    const memberName = cleanText(body.memberName, "Your name", 40);

    const spaceId = randomUUID();
    // Insert-with-retry: the unique index on code is the arbiter, so two
    // concurrent creations picking the same code can't both slip through.
    let code = "";
    for (let attempt = 0; attempt < 8 && !code; attempt++) {
      const candidate = generateCode();
      try {
        await q("INSERT INTO spaces (id, code, name) VALUES ($1, $2, $3)", [
          spaceId,
          candidate,
          spaceName,
        ]);
        code = candidate;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/duplicate key|unique constraint|23505/i.test(msg)) throw err;
      }
    }
    if (!code) throw new Error("Could not generate a unique code");

    const memberId = randomUUID();
    await q(
      "INSERT INTO members (id, space_id, name, color) VALUES ($1, $2, $3, $4)",
      [memberId, spaceId, memberName, MEMBER_COLORS[0]]
    );

    await q(
      `INSERT INTO lists (id, space_id, type, title, position) VALUES
       ($1, $3, 'grocery', 'Groceries', 1),
       ($2, $3, 'todo', 'To-dos', 2)`,
      [randomUUID(), randomUUID(), spaceId]
    );

    return NextResponse.json({
      space: { id: spaceId, code, name: spaceName },
      member: { id: memberId, name: memberName, color: MEMBER_COLORS[0] },
    });
  } catch (err) {
    return jsonError(err);
  }
}
