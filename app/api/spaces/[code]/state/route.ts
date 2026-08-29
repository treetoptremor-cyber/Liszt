import { NextResponse } from "next/server";
import {
  getSpaceByCode,
  loadState,
  requireMember,
} from "@/lib/server/space";
import { jsonError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Full space state, or `{version, unchanged:true}` when the client's version
 *  is current — the poll loop hits this every few seconds. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await ctx.params;
    const space = await getSpaceByCode(code);
    await requireMember(space.id, req.headers.get("x-member-id"));

    const url = new URL(req.url);
    const clientVersion = Number(url.searchParams.get("v") ?? -1);
    if (clientVersion === space.version) {
      return NextResponse.json({ version: space.version, unchanged: true });
    }

    const state = await loadState(space);
    return NextResponse.json(state);
  } catch (err) {
    return jsonError(err);
  }
}
