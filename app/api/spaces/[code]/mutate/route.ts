import { NextResponse } from "next/server";
import {
  ApiError,
  applyOp,
  bumpVersion,
  getSpaceByCode,
  requireMember,
} from "@/lib/server/space";
import { jsonError, readJson } from "@/lib/server/http";
import { recordEvent } from "@/lib/server/events";
import type { Op } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Single mutation endpoint. The body is one Op; the same vocabulary the
 *  client applies optimistically. Returns the new space version. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await ctx.params;
    const space = await getSpaceByCode(code);
    const member = await requireMember(space.id, req.headers.get("x-member-id"));

    const body = await readJson(req);
    if (typeof body.type !== "string") {
      throw new ApiError(400, "Missing op type");
    }
    const result = await applyOp(space, member, body as unknown as Op);
    const [version] = await Promise.all([
      bumpVersion(space.id),
      // Best-effort by construction — `recordEvent` swallows its own errors,
      // so analytics can never fail the write that produced it (P6).
      result.event
        ? recordEvent(space.id, member.id, result.event)
        : Promise.resolve(),
    ]);
    return NextResponse.json({ version });
  } catch (err) {
    return jsonError(err);
  }
}
