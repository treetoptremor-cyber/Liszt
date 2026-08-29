/** localStorage helpers. A device can belong to several spaces; each entry
 *  remembers the member identity used there. */

export interface SpaceEntry {
  code: string;
  name: string;
  memberId: string;
  memberName: string;
  lastUsed: number;
}

const REGISTRY_KEY = "liszt:spaces";

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage full or blocked — the app still works, just without persistence
  }
}

function safeRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getRegistry(): SpaceEntry[] {
  const raw = safeGet(REGISTRY_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (e) => e && typeof e.code === "string" && typeof e.memberId === "string"
    );
  } catch {
    return [];
  }
}

export function upsertSpaceEntry(entry: Omit<SpaceEntry, "lastUsed">) {
  const rest = getRegistry().filter((e) => e.code !== entry.code);
  const next = [{ ...entry, lastUsed: Date.now() }, ...rest];
  safeSet(REGISTRY_KEY, JSON.stringify(next.slice(0, 20)));
}

export function touchSpaceEntry(code: string) {
  const reg = getRegistry();
  const found = reg.find((e) => e.code === code);
  if (!found) return;
  found.lastUsed = Date.now();
  safeSet(REGISTRY_KEY, JSON.stringify(reg));
}

export function removeSpaceEntry(code: string) {
  safeSet(
    REGISTRY_KEY,
    JSON.stringify(getRegistry().filter((e) => e.code !== code))
  );
  safeRemove(`liszt:state:${code}`);
  safeRemove(`liszt:queue:${code}`);
  safeRemove(`liszt:tab:${code}`);
}

export function getSpaceEntry(code: string): SpaceEntry | null {
  return getRegistry().find((e) => e.code === code) ?? null;
}

export function readJsonKey<T>(key: string): T | null {
  const raw = safeGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJsonKey(key: string, value: unknown) {
  safeSet(key, JSON.stringify(value));
}

export function readPlainKey(key: string): string | null {
  return safeGet(key);
}

export function writePlainKey(key: string, value: string) {
  safeSet(key, value);
}
