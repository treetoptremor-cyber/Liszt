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
