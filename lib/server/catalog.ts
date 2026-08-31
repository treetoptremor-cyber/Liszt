/**
 * Canonical item matching.
 *
 * Free-text grocery input is normalized to a key, looked up in `item_aliases`
 * and — on a hit — linked to a `canonical_items` row, which is what gives the
 * item its category for free.
 *
 * Privacy invariant P3: this is grocery-only. Callers must have established
 * that the item's list is `type = 'grocery'` before calling in. To-do text is
 * personal ("call the clinic about the results"); it is never matched against
 * the catalog and never contributes to `unmatched_terms`.
 */

import { q } from "@/lib/db";
import { MAX_TERM_LENGTH, depluralizeKey, normalizeItemKey } from "@/lib/normalize";

export interface CatalogMatch {
  canonicalItemId: string;
  /** Stable slug — what analytics groups by. */
  categorySlug: string;
  /** Display name, e.g. "Dairy & Eggs" — what lands in `items.category`. */
  categoryName: string;
}

/**
 * Resolve grocery item text to a canonical catalog item, recording the term
 * as unmatched when nothing fits.
 *
 * Never throws: the catalog is an enrichment, so a failure here leaves the
 * item uncategorized rather than failing the user's write.
 */
export async function matchGroceryItem(
  text: string
): Promise<CatalogMatch | null> {
  const key = normalizeItemKey(text);
  if (!key) return null;

  try {
    // At most two candidates — the key as typed, and a de-pluralized guess.
    // Looking both up in one statement keeps this to a single round trip, and
    // the ORDER BY makes an exact hit win over the guess. Passing the exact
    // key twice when there is nothing to de-pluralize keeps the SQL fixed.
    const singular = depluralizeKey(key);
    const rows = await q(
      `SELECT a.canonical_item_id, c.slug AS category_slug, c.name AS category_name
       FROM item_aliases a
       JOIN canonical_items ci ON ci.id = a.canonical_item_id
       JOIN item_categories c ON c.id = ci.category_id
       WHERE a.alias_key IN ($1, $2)
       ORDER BY (a.alias_key = $1) DESC
       LIMIT 1`,
      [key, singular ?? key]
    );

    const hit = rows[0];
    if (!hit) {
      await noteUnmatchedTerm(key);
      return null;
    }
    return {
      canonicalItemId: hit.canonical_item_id as string,
      categorySlug: hit.category_slug as string,
      categoryName: hit.category_name as string,
    };
  } catch (err) {
    console.error("[liszt] canonical match failed", err);
    return null;
  }
}

/**
 * Bump the global counter for a term the catalog doesn't know.
 *
 * Privacy invariant P4: `unmatched_terms` carries the normalized key, a count
 * and a date — no space, no member, no timestamp finer than a day. Long
 * strings are sentences rather than products, so they are dropped outright.
 */
async function noteUnmatchedTerm(key: string): Promise<void> {
  if (key.length > MAX_TERM_LENGTH) return;
  try {
    await q(
      `INSERT INTO unmatched_terms (term_key, occurrences, last_seen)
       VALUES ($1, 1, CURRENT_DATE)
       ON CONFLICT (term_key) DO UPDATE
         SET occurrences = unmatched_terms.occurrences + 1,
             last_seen = CURRENT_DATE`,
      [key]
    );
  } catch (err) {
    console.error("[liszt] unmatched term insert failed", err);
  }
}

/**
 * Record that someone filed an unrecognized grocery item under a category.
 *
 * This is the only way end users teach the catalog, and it is deliberately
 * indirect: the vote is aggregated globally with no link to the person or
 * space that cast it (the same shape as `unmatched_terms`), and nothing
 * reaches `canonical_items` until a human promotes it through
 * `/api/catalog/curate`. Nobody is ever shown anyone else's text.
 *
 * Only explicit re-categorization counts. An `item.add` may carry a category
 * the client guessed by substring ("chicken feed" → Meat & Fish), which is
 * noise; changing a category in the item sheet is unambiguously a decision.
 *
 * Best-effort, like everything else in this file.
 */
export async function recordCategoryVote(
  text: string,
  categoryName: string
): Promise<void> {
  const key = normalizeItemKey(text);
  if (!key || key.length > MAX_TERM_LENGTH) return;
  try {
    // Items store a category display name; votes are keyed by stable slug, so
    // a name that isn't one of ours simply doesn't vote.
    await q(
      `INSERT INTO term_category_votes (term_key, category_slug, occurrences, last_seen)
       SELECT $1, c.slug, 1, CURRENT_DATE
       FROM item_categories c
       WHERE lower(c.name) = lower($2)
       ON CONFLICT (term_key, category_slug) DO UPDATE
         SET occurrences = term_category_votes.occurrences + 1,
             last_seen = CURRENT_DATE`,
      [key, categoryName]
    );
  } catch (err) {
    console.error("[liszt] category vote failed", err);
  }
}
