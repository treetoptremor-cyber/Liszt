import { NextResponse } from "next/server";
import { ApiError } from "@/lib/server/space";

export function jsonError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[liszt] API error:", err);
  return NextResponse.json(
    { error: "Something went wrong" },
    { status: 500 }
  );
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  throw new ApiError(400, "Invalid JSON body");
}

/**
 * Gate an operator-only endpoint (the rollup cron, catalog curation).
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`, and the same header
 * is how you reach these routes by hand. With no secret configured the route
 * stays open only against the local PGlite database — a real database with no
 * secret set is treated as a misconfiguration, not an invitation.
 */
export function requireOperator(req: Request): void {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new ApiError(401, "Unauthorized");
    }
    return;
  }
  if (process.env.DATABASE_URL) {
    throw new ApiError(401, "CRON_SECRET is not configured");
  }
}
