import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { q } from "@/lib/db";
import { ApiError, cleanText, toDateStr } from "@/lib/server/space";
import { jsonError, readJson, requireOperator } from "@/lib/server/http";
import { MAX_TERM_LENGTH, normalizeItemKey } from "@/lib/normalize";

export const dynamic = "force-dynamic";

/** Terms returned per page of the review queue. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

/** Ceiling on the backfill scan, so promoting a very common term can't turn
 *  one request into an unbounded table walk. `scanTruncated` says when it bit. */
const BACKFILL_SCAN_LIMIT = 2000;
const BACKFILL_BATCH = 200;

/**
 * Catalog curation — the review queue for terms the catalog didn't recognize,
 * and the one door into `canonical_items` / `item_aliases`.
 *
 * Operator-only (`Authorization: Bearer $CRON_SECRET`). Deliberately not an
 * end-user surface: `unmatched_terms` is global, so showing it in the app
 * would show people each other's grocery text. Users contribute only
 * indirectly, by categorizing their own unrecognized items — those votes
 * arrive here as `suggested`, and a human still decides.
 */
export async function GET(req: Request) {
  try {
    requireOperator(req);
    const limitParam = Number(
      new URL(req.url).searchParams.get("limit") ?? DEFAULT_LIMIT
    );
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(Math.floor(limitParam), MAX_LIMIT)
        : DEFAULT_LIMIT;

    // The lateral join picks each term's leading vote, if it has one.
    const rows = await q(
      `SELECT u.term_key, u.occurrences, u.last_seen,
              v.category_slug AS suggested_category,
              v.occurrences   AS suggested_votes
       FROM unmatched_terms u
       LEFT JOIN LATERAL (
         SELECT category_slug, occurrences
         FROM term_category_votes
         WHERE term_key = u.term_key
         ORDER BY occurrences DESC, category_slug
         LIMIT 1
       ) v ON true
       ORDER BY u.occurrences DESC, u.term_key
       LIMIT $1`,
      [limit]
    );

    return NextResponse.json({
      terms: rows.map((r) => ({
        term: r.term_key as string,
        occurrences: Number(r.occurrences),
        lastSeen: toDateStr(r.last_seen),
        suggested: r.suggested_category
          ? {
              category: r.suggested_category as string,
              votes: Number(r.suggested_votes),
            }
          : null,
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * Promote a term into the catalog, either as an alias of an item that already
 * exists (`{ term, canonical }`) or as a new canonical item of its own
 * (`{ term, name, category }`).
 *
 * Promotion also backfills: existing items carrying that text get the link,
 * and pick up the category if — and only if — they don't already have one. A
 * category somebody chose is never overwritten.
 */
export async function POST(req: Request) {
  try {
    requireOperator(req);
    const body = await readJson(req);

    if (typeof body.term !== "string") throw new ApiError(400, "Missing term");
    const term = normalizeItemKey(body.term);
    if (!term) throw new ApiError(400, "Term is empty once normalized");
    if (term.length > MAX_TERM_LENGTH) throw new ApiError(400, "Term is too long");

    let canonicalId: string;
    let created = false;

    if (body.canonical != null) {
      const key = normalizeItemKey(String(body.canonical));
      const rows = await q("SELECT id FROM canonical_items WHERE key = $1", [key]);
      if (rows.length === 0) {
        throw new ApiError(404, `No canonical item with key "${key}"`);
      }
      canonicalId = rows[0].id as string;
    } else {
      // Establish which mode this is before validating its fields, or a
      // request that named neither gets told its name is invalid.
      if (typeof body.category !== "string") {
        throw new ApiError(400, "Provide either `canonical` or `name` + `category`");
      }
      const name = cleanText(body.name, "Name", 60);
      // Insert against the category slug; a bad slug matches no row, which we
      // report rather than letting it fail on the not-null constraint.
      const inserted = await q(
        `INSERT INTO canonical_items (id, key, name, category_id, source)
         SELECT $1, $2, $3, c.id, 'curated'
         FROM item_categories c WHERE c.slug = $4
         ON CONFLICT (key) DO NOTHING
         RETURNING id`,
        [randomUUID(), term, name, body.category]
      );
      if (inserted.length > 0) {
        canonicalId = inserted[0].id as string;
        created = true;
      } else {
        // Either the key already existed or the slug was bogus — tell them apart.
        const existing = await q("SELECT id FROM canonical_items WHERE key = $1", [term]);
        if (existing.length === 0) {
          throw new ApiError(400, `No category with slug "${body.category}"`);
        }
        canonicalId = existing[0].id as string;
      }
    }

    const aliased = await q(
      `INSERT INTO item_aliases (alias_key, canonical_item_id, source)
       VALUES ($1, $2, 'curated')
       ON CONFLICT (alias_key) DO NOTHING
       RETURNING alias_key`,
      [term, canonicalId]
    );

    // Backfill items already carrying this text.
    //
    // The stored text is not the key — "2x whole milk 1L" normalizes to
    // "whole milk" — and normalization lives in JS, not SQL. But `cleanText`
    // has already collapsed whitespace on the way in, and normalization only
    // strips a prefix and a suffix from there, so the key is always a
    // contiguous substring of the lowercased text. That makes LIKE a sound
    // (if loose) prefilter, and the exact test happens here. A `%` or `_`
    // inside the term only widens the prefilter, which the exact test then
    // narrows again.
    const candidates = await q(
      `SELECT i.id, i.text
       FROM items i JOIN lists l ON l.id = i.list_id
       WHERE l.type = 'grocery'
         AND i.canonical_item_id IS NULL
         AND lower(i.text) LIKE '%' || $1 || '%'
       LIMIT $2`,
      [term, BACKFILL_SCAN_LIMIT + 1]
    );
    const scanTruncated = candidates.length > BACKFILL_SCAN_LIMIT;
    const ids = candidates
      .slice(0, BACKFILL_SCAN_LIMIT)
      .filter((r) => normalizeItemKey(r.text as string) === term)
      .map((r) => r.id as string);

    let itemsBackfilled = 0;
    for (let i = 0; i < ids.length; i += BACKFILL_BATCH) {
      const batch = ids.slice(i, i + BACKFILL_BATCH);
      const holes = batch.map((_, n) => `$${n + 2}`).join(", ");
      const done = await q(
        `UPDATE items
         SET canonical_item_id = $1,
             category = COALESCE(category, (
               SELECT c.name FROM canonical_items ci
               JOIN item_categories c ON c.id = ci.category_id
               WHERE ci.id = $1))
         WHERE id IN (${holes})
         RETURNING id`,
        [canonicalId, ...batch]
      );
      itemsBackfilled += done.length;
    }

    // It is matched now, so it is no longer a gap.
    await q("DELETE FROM unmatched_terms WHERE term_key = $1", [term]);
    await q("DELETE FROM term_category_votes WHERE term_key = $1", [term]);

    return NextResponse.json({
      term,
      canonicalItemId: canonicalId,
      createdCanonicalItem: created,
      aliasAdded: aliased.length > 0,
      itemsBackfilled,
      scanTruncated,
    });
  } catch (err) {
    return jsonError(err);
  }
}
