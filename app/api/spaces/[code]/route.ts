import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { getSpaceByCode } from "@/lib/server/space";
import { jsonError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Join preview: only the space name and member count — shown on the join
 *  screen before someone becomes a member. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await ctx.params;
    const space = await getSpaceByCode(code);
    const rows = await q(
      "SELECT COUNT(*)::int AS n FROM members WHERE space_id = $1",
      [space.id]
    );
    return NextResponse.json({
      name: space.name,
      code: space.code,
      memberCount: Number(rows[0]?.n ?? 0),
    });
  } catch (err) {
    return jsonError(err);
  }
}
