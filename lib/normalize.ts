/**
 * Turning free-text item input into a lookup key for the canonical catalog.
 *
 * Lives in `lib/` rather than `lib/server/` on purpose: the key has to mean
 * exactly the same thing wherever it is computed, so if the client ever wants
 * to match locally it imports this module rather than reimplementing it.
 *
 * `normalizeItemKey` is pure — same text in, same key out, no I/O.
 */

/** Leading count/quantity token: "2x ", "2 x ", "3 ", "12× ", "12 pack ". The
 *  optional unit only ever follows a leading numeral, so this can't eat the
 *  start of a real product name. */
const LEADING_COUNT = /^\d+\s*(?:x|×|pack|pk|ct)?\s+/;

/** Trailing parenthesized qualifier(s): "milk (the blue one)" → "milk". */
const TRAILING_PARENS = /(?:\s*\([^()]*\))+\s*$/;

/** Trailing size/unit: "milk 1l", "flour 2.5 kg", "yogurt 6 pack".
 *  Longer units come first so "lbs" isn't half-eaten as "lb". */
const TRAILING_UNIT = /\s+\d+(?:\.\d+)?\s*(?:lbs|lb|pack|pk|ml|kg|oz|ct|l|g)$/;

/**
 * Normalize item text to a catalog lookup key.
 *
 * Input is expected to have already passed `cleanText` (trimmed, whitespace
 * collapsed), but this is defensive about both. May return "" for input that
 * is nothing but a quantity — callers must treat an empty key as "no match".
 */
export function normalizeItemKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(LEADING_COUNT, "")
    .replace(TRAILING_PARENS, "")
    .replace(TRAILING_UNIT, "")
    .trim();
}

/**
 * A candidate singular form for `key`, or null if there is nothing to try.
 *
 * Deliberately not folded into `normalizeItemKey`: dropping a trailing "s"
 * blindly turns "hummus" into "hummu". The matcher looks the candidate up in
 * `item_aliases` and only uses it on a hit, so a wrong guess here costs
 * nothing (see `matchCanonicalItem`).
 */
export function depluralizeKey(key: string): string | null {
  if (key.length > 3 && key.endsWith("s") && !key.endsWith("ss")) {
    return key.slice(0, -1);
  }
  return null;
}

/** Terms longer than this are sentences, not products — never recorded as
 *  unmatched (privacy invariant P4). */
export const MAX_TERM_LENGTH = 40;
