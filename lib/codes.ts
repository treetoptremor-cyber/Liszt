/** Share codes: two short words + two digits, e.g. PLUM-FOX-42.
 *  Easy to say out loud across the kitchen, easy to type on a phone. */

const WORDS = [
  "acorn", "amber", "apple", "aspen", "badge", "bagel", "basil", "beach",
  "berry", "birch", "bloom", "brave", "bread", "breeze", "brook", "candle",
  "cedar", "cherry", "china", "cider", "clover", "cocoa", "comet", "coral",
  "cozy", "creek", "crisp", "dawn", "daisy", "dove", "drift", "ember",
  "fable", "fern", "field", "flint", "forest", "fox", "frost", "garden",
  "ginger", "glade", "goose", "grape", "grove", "harbor", "hazel", "heron",
  "holly", "honey", "ivy", "juniper", "lake", "lark", "lemon", "lilac",
  "linden", "lotus", "maple", "meadow", "melon", "mint", "moss", "north",
  "oak", "ocean", "olive", "onyx", "otter", "pear", "pebble", "pine",
  "plum", "pond", "poppy", "quartz", "quill", "raven", "reed", "ridge",
  "river", "robin", "rose", "sage", "salt", "sand", "shell", "sky",
  "slate", "snow", "sparrow", "spring", "spruce", "stone", "storm", "summer",
  "sunny", "swan", "thyme", "tulip", "vale", "violet", "walnut", "wave",
  "willow", "winter", "wren", "zephyr",
] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateCode(): string {
  const a = pick(WORDS);
  let b = pick(WORDS);
  while (b === a) b = pick(WORDS);
  const n = Math.floor(Math.random() * 90) + 10;
  return `${a}-${b}-${n}`.toUpperCase();
}

/** Forgiving normalization of user-typed codes: any case, spaces or dashes. */
export function normalizeCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
