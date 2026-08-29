import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { cleanText, getSpaceByCode } from "@/lib/server/space";
import { jsonError, readJson } from "@/lib/server/http";
import { MEMBER_COLORS } from "@/lib/types";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await ctx.params;
    const space = await getSpaceByCode(code);
    const body = await readJson(req);
    const name = cleanText(body.name, "Your name", 40);

    const countRows = await q(
      "SELECT COUNT(*)::int AS n FROM members WHERE space_id = $1",
      [space.id]
    );
    const n = Number(countRows[0]?.n ?? 0);
    const color = MEMBER_COLORS[n % MEMBER_COLORS.length];

    const memberId = randomUUID();
    await q(
      "INSERT INTO members (id, space_id, name, color) VALUES ($1, $2, $3, $4)",
      [memberId, space.id, name, color]
    );
    await q("UPDATE spaces SET version = version + 1 WHERE id = $1", [
      space.id,
    ]);

    return NextResponse.json({
      space: { id: space.id, code: space.code, name: space.name },
      member: { id: memberId, name, color },
    });
  } catch (err) {
    return jsonError(err);
  }
}
