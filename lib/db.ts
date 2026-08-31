/**
 * Database access layer.
 *
 * - In production (Vercel), set DATABASE_URL to a Neon Postgres connection
 *   string (added via the Vercel Marketplace) and queries go over Neon's
 *   serverless HTTP driver.
 * - In local dev with no DATABASE_URL, an embedded Postgres (PGlite) is used,
 *   persisted to ./.pglite — zero setup, `npm run dev` just works.
 */

type Row = Record<string, unknown>;

interface Db {
  query(text: string, params?: unknown[]): Promise<Row[]>;
}

const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS spaces (
    id uuid PRIMARY KEY,
    code text UNIQUE NOT NULL,
    name text NOT NULL,
    version bigint NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS members (
    id uuid PRIMARY KEY,
    space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    color text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS lists (
    id uuid PRIMARY KEY,
    space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('grocery','todo')),
    title text NOT NULL,
    group_by_category boolean NOT NULL DEFAULT true,
    position double precision NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS items (
    id uuid PRIMARY KEY,
    list_id uuid NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    text text NOT NULL,
    qty text,
    category text,
    done boolean NOT NULL DEFAULT false,
    done_at timestamptz,
    completed_by uuid REFERENCES members(id) ON DELETE SET NULL,
    assigned_to uuid REFERENCES members(id) ON DELETE SET NULL,
    created_by uuid REFERENCES members(id) ON DELETE SET NULL,
    position double precision NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS notes (
    id uuid PRIMARY KEY,
    space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    title text NOT NULL DEFAULT '',
    body text NOT NULL DEFAULT '',
    updated_by uuid REFERENCES members(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS recurrences (
    id uuid PRIMARY KEY,
    space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    list_id uuid NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    text text NOT NULL,
    days_mask int NOT NULL CHECK (days_mask > 0 AND days_mask < 128),
    assigned_to uuid REFERENCES members(id) ON DELETE SET NULL,
    created_by uuid REFERENCES members(id) ON DELETE SET NULL,
    start_date date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS recurrence_done (
    recurrence_id uuid NOT NULL REFERENCES recurrences(id) ON DELETE CASCADE,
    on_date date NOT NULL,
    completed_by uuid REFERENCES members(id) ON DELETE SET NULL,
    done_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (recurrence_id, on_date)
  )`,
  `CREATE TABLE IF NOT EXISTS frequent_items (
    space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    text_key text NOT NULL,
    text text NOT NULL,
    category text,
    uses int NOT NULL DEFAULT 1,
    last_used timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (space_id, text_key)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_members_space ON members(space_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lists_space ON lists(space_id)`,
  `CREATE INDEX IF NOT EXISTS idx_items_list ON items(list_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notes_space ON notes(space_id)`,
  `CREATE INDEX IF NOT EXISTS idx_recurrences_space ON recurrences(space_id)`,
  `CREATE INDEX IF NOT EXISTS idx_recurrence_done_date ON recurrence_done(on_date)`,
  // Migrations for spaces created before a column existed (idempotent).
  `ALTER TABLE items ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES members(id) ON DELETE SET NULL`,
  `ALTER TABLE items ADD COLUMN IF NOT EXISTS due_date date`,
];

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  let db: Db;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    db = {
      query: async (text, params = []) =>
        (await sql.query(text, params as unknown[])) as Row[],
    };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite(".pglite");
    db = {
      query: async (text, params = []) =>
        (await pg.query(text, params as unknown[])).rows as Row[],
    };
  }
  for (const stmt of SCHEMA) {
    await db.query(stmt);
  }
  return db;
}

// Cached across hot reloads (dev) and across invocations within a warm
// serverless instance (prod).
const globalForDb = globalThis as unknown as { __lisztDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__lisztDb) {
    globalForDb.__lisztDb = createDb().catch((err) => {
      // Don't cache a failed init — allow the next request to retry.
      globalForDb.__lisztDb = undefined;
      throw err;
    });
  }
  return globalForDb.__lisztDb;
}

export async function q(text: string, params: unknown[] = []): Promise<Row[]> {
  const db = await getDb();
  return db.query(text, params);
}
