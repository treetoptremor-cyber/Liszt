# Spec: Analytics layer + structured item data

Status: **built** (Parts A and B, plus the rollup cron). This document was the
handoff for implementation and is kept as the design record; P7 below is the
one open item.
It extends the existing schema in [lib/db.ts](../lib/db.ts) and the op pipeline in
[lib/server/space.ts](../lib/server/space.ts) / [app/api/spaces/[code]/mutate/route.ts](../app/api/spaces/%5Bcode%5D/mutate/route.ts).

## Goals

1. **Product analytics** we can query ourselves: retention, feature usage,
   items added/completed per space, active members — enough to steer the
   product and, later, to support a freemium tier decision.
2. **Structured item data**: turn free-text grocery items into a canonical
   catalog with a category taxonomy. Immediate user payoff (auto-categorized
   items, aisle-ordered lists); long-term it is the substrate any aggregate
   insight or in-app sponsorship model would need.

## Non-goals

- No third-party analytics SDK, no external event export, no per-user tracking
  identifiers beyond the existing `member_id`.
- No changes to the sync protocol or the client op vocabulary in v1.
- No profiling of todo items or notes (see privacy invariants).

## Privacy invariants (hard rules, enforce in code review)

These are load-bearing. The implementing agent must not relax them.

- **P1 — No free text in events.** The `events` table never stores item text,
  note titles/bodies, list titles, space names, or member names. Events carry
  ids, enum-ish slugs, and numbers only.
- **P2 — Notes are opaque.** Note events record only that a note was
  created/updated/deleted. No content, no lengths.
- **P3 — Canonicalization is grocery-only.** Items on `type = 'todo'` lists
  are never matched against the catalog and never contribute to
  `unmatched_terms`. Todo text is personal ("call mom about biopsy results");
  grocery text is products.
- **P4 — `unmatched_terms` is global and unlinked.** It stores normalized term
  keys and counters only — no `space_id`, no `member_id`, no timestamps finer
  than day. Skip terms longer than 40 chars (long strings are sentences, not
  products).
- **P5 — Deleting a space deletes its analytics.** `events` and rollups carry
  `space_id` FKs with `ON DELETE CASCADE`.
- **P6 — Analytics failures never fail user writes.** Event inserts are
  best-effort: wrap in try/catch, log, continue.
- **P7 — Disclosure.** Before any public launch, the privacy policy must state
  that first-party usage analytics are collected. (Not a code task; recorded
  here so it isn't forgotten.)
- **P8 — Nothing person-linked accumulates.** `events.member_id` exists only
  so the rollup can count distinct members per space-day. Once a day has been
  rolled up the id is cleared, leaving a space-level activity log. No table
  keeps a person-linked history beyond `MEMBER_ID_RETENTION_DAYS`.
- **P9 — Typed text expires first.** `unmatched_terms` and
  `term_category_votes` are the only tables holding words a person typed, so
  they carry the shortest retention of anything here. Terms that are real
  catalog gaps recur and have their `last_seen` pushed forward; abandoned
  one-offs age out.
- **P10 — Nobody is shown anyone else's text.** `unmatched_terms` is global,
  so it is never surfaced in the app. Curation is an operator-only endpoint
  behind `CRON_SECRET`. Users contribute only indirectly, by categorizing
  their *own* unrecognized items.

---

## Part A — Analytics events

### A1. `events` table

Append-only. Add to the `SCHEMA` array in [lib/db.ts](../lib/db.ts) in the same
idempotent style:

```sql
CREATE TABLE IF NOT EXISTS events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  entity_id uuid,          -- the list/item/note/recurrence the event is about
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_space_time ON events(space_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_type_time ON events(event_type, occurred_at);
```

Notes:
- `bigint identity` not uuid — append-only log, ordering is useful, ids never
  leave the server.
- `props` is jsonb but **allowlisted per event type** (table below). Reject
  the temptation to stuff anything else in; that is how P1 erodes.

### A2. Event taxonomy

Server-derived events map 1:1 from the existing `Op` vocabulary plus two
lifecycle endpoints. `entity_id` is the op's primary id where applicable.

| `event_type`        | Emitted from                          | `props` allowlist |
|---------------------|---------------------------------------|-------------------|
| `space.created`     | `POST /api/spaces` (creation route)   | — |
| `member.joined`     | `POST /api/spaces/[code]/join`        | `{ member_count }` |
| `list.created`      | op `list.add`                         | `{ list_type }` |
| `list.deleted`      | op `list.delete`                      | `{ list_type }` |
| `item.added`        | op `item.add`                         | `{ list_type, has_qty, has_category, has_due_date, assigned, matched, canonical_item_id, category_slug }` |
| `item.completed`    | op `item.update` with `done: true`    | `{ list_type, canonical_item_id, category_slug }` |
| `item.uncompleted`  | op `item.update` with `done: false`   | `{ list_type }` |
| `item.deleted`      | op `item.delete`                      | `{ list_type }` |
| `items.cleared`     | op `items.clearDone`                  | `{ list_type, cleared_count }` |
| `recur.created`     | op `recur.add`                        | `{ days_count }` (popcount of mask) |
| `recur.completed`   | op `recur.setDone` with `done: true`  | — |
| `note.created`      | op `note.add`                         | — |
| `note.updated`      | op `note.update`                      | — (P2: no lengths) |
| `note.deleted`      | op `note.delete`                      | — |

Deliberately **not** logged: state polls (`/state` — far too noisy; active-day
metrics come from having any event that day), renames (content-adjacent, low
value), `list.setGroup`, assignment changes.

`matched` / `canonical_item_id` / `category_slug` come from Part B; until Part B
lands, emit `matched: false` and omit the other two.

### A3. Write path

Instrument in **[app/api/spaces/[code]/mutate/route.ts](../app/api/spaces/%5Bcode%5D/mutate/route.ts)**, not inside `applyOp`:

1. Change `applyOp` to return a small result object (e.g.
   `{ event?: { type: string; entityId?: string; props?: Record<string, unknown> } }`)
   instead of `void`, so op handlers that know outcome details
   (`cleared_count`, canonical match) can surface them without the route
   re-deriving op semantics. Handlers with nothing to report return `{}`.
2. In the route, after `applyOp` succeeds and before/parallel with
   `bumpVersion`, insert the event. Best-effort (P6):
   ```ts
   try { await recordEvent(space.id, member.id, ev); } catch (e) { console.error("event insert failed", e); }
   ```
3. `space.created` and `member.joined` are inserted directly in their
   respective routes.

Put `recordEvent` in a new `lib/server/events.ts` along with the
event-type/props constants, so the allowlist lives in one file.

Idempotency caveat: op adds use `ON CONFLICT DO NOTHING` for offline retry.
`item.add` already knows (via `RETURNING id`) whether the insert actually
happened — only emit `item.added` when it did. Apply the same pattern to
`list.add`, `recur.add`, `note.add` (add `RETURNING id`). For `item.update`
done-toggles, retries can double-log; accept this (rollups count distinct
enough that the noise is negligible) rather than complicating the pipeline.

### A4. Retention and rollups

Raw events are pruned; aggregates are permanent.

```sql
CREATE TABLE IF NOT EXISTS daily_space_stats (
  space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  day date NOT NULL,
  active_members int NOT NULL DEFAULT 0,   -- distinct member_id with any event
  items_added int NOT NULL DEFAULT 0,
  items_completed int NOT NULL DEFAULT 0,
  notes_touched int NOT NULL DEFAULT 0,
  events_total int NOT NULL DEFAULT 0,
  PRIMARY KEY (space_id, day)
);
```

- Rollup job: a route `app/api/cron/rollup/route.ts`, invoked by **Vercel
  Cron** daily, guarded by a `CRON_SECRET` env check. It upserts yesterday's
  (and, defensively, the last 3 days') rows via `INSERT ... ON CONFLICT ... DO
  UPDATE`, then walks the retention ladder:
  1. clear `member_id` on events older than **7 days** (P8) — wider than the
     rollup window so a missed run can still be backfilled;
  2. delete `events` rows older than **180 days**;
  3. delete `unmatched_terms` whose `last_seen` is older than **90 days** (P9).
- Local dev (PGlite) has no cron; the route can be hit manually. Do not build
  a dev-side scheduler.
- Keep rollup SQL to plain `GROUP BY space_id, day` — it must run identically
  on Neon and PGlite (no extensions).

---

## Part B — Structured item data

### B1. Tables

```sql
CREATE TABLE IF NOT EXISTS item_categories (
  id uuid PRIMARY KEY,
  slug text UNIQUE NOT NULL,       -- 'produce', 'dairy', ...
  name text NOT NULL,              -- display name, e.g. 'Produce'
  sort_order int NOT NULL          -- default aisle order for grouped lists
);

CREATE TABLE IF NOT EXISTS canonical_items (
  id uuid PRIMARY KEY,
  key text UNIQUE NOT NULL,        -- normalized canonical key, e.g. 'milk'
  name text NOT NULL,              -- display name, e.g. 'Milk'
  category_id uuid NOT NULL REFERENCES item_categories(id),
  source text NOT NULL DEFAULT 'seed' CHECK (source IN ('seed','curated')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS item_aliases (
  alias_key text PRIMARY KEY,      -- normalized form that maps to a canonical item
  canonical_item_id uuid NOT NULL REFERENCES canonical_items(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'seed' CHECK (source IN ('seed','curated'))
);

-- Global, unlinked (P4). Feeds catalog curation only.
CREATE TABLE IF NOT EXISTS unmatched_terms (
  term_key text PRIMARY KEY,
  occurrences int NOT NULL DEFAULT 1,
  last_seen date NOT NULL DEFAULT CURRENT_DATE
);

-- What people file unrecognized items under. Same privacy shape as
-- unmatched_terms and the same expiry; supplies the suggested category in
-- the curation queue. Nothing here reaches the catalog without a human.
CREATE TABLE IF NOT EXISTS term_category_votes (
  term_key text NOT NULL,
  category_slug text NOT NULL REFERENCES item_categories(slug) ON DELETE CASCADE,
  occurrences int NOT NULL DEFAULT 1,
  last_seen date NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (term_key, category_slug)
);
```

Column additions (idempotent, same pattern as the existing migrations at the
bottom of the `SCHEMA` array):

```sql
ALTER TABLE items ADD COLUMN IF NOT EXISTS canonical_item_id uuid REFERENCES canonical_items(id) ON DELETE SET NULL;
ALTER TABLE frequent_items ADD COLUMN IF NOT EXISTS canonical_item_id uuid REFERENCES canonical_items(id) ON DELETE SET NULL;
```

### B2. Category taxonomy (seed)

Flat, aisle-ordered, grocery-oriented. Seed exactly this set (slugs stable
forever; display names editable):

`produce`, `dairy-eggs`, `meat-seafood`, `bakery`, `frozen`, `pantry`,
`beverages`, `snacks`, `household`, `personal-care`, `baby`, `pet`, `other`.

Seeding runs inside `createDb()` after the DDL loop: `INSERT ... ON CONFLICT
(slug) DO NOTHING` per category, and the same for a starter catalog of
~150–250 common canonical items + aliases shipped as a constant in a new
`lib/server/catalog-seed.ts` (e.g. canonical `milk` with aliases `milk`,
`whole milk`, `2% milk`, `oat milk` → its own canonical, etc.). Generating a
sensible starter list is part of the implementation task; favor breadth of
common items over exhaustive variants.

### B3. Normalization

One pure function, `normalizeItemKey(text: string): string`, in a new shared
module (client may want it later; put it in `lib/` not `lib/server/`):

1. Lowercase; trim; collapse whitespace (input already passed `cleanText`).
2. Strip leading count/quantity tokens: `2x `, `3 `, `a dozen ` etc. —
   `^\d+\s*[x×]?\s+`.
3. Strip trailing parenthesized qualifiers: `milk (the blue one)` → `milk`.
4. Strip trailing size/unit tokens: `\s+\d+(\.\d+)?\s*(l|ml|g|kg|oz|lb|lbs|pack|pk|ct)$`.
5. Naive singularization: trailing `s` → drop **only when** the resulting key
   is an existing alias (lookup-guarded, so `hummus` stays `hummus`). This
   means singularization happens at match time, not inside the pure function —
   the matcher tries the exact key first, then the de-pluralized key.

Note: `frequent_items.text_key` today is plain `text.toLowerCase()`. Leave it
as-is (its uniqueness semantics are user-facing); canonical matching is a
separate lookup, not a replacement for `text_key`.

### B4. Matching flow

On `item.add` and on `item.update` when `patch.text` is present, **grocery
lists only** (P3 — the handler must check `lists.type`):

1. `key = normalizeItemKey(text)`.
2. Look up `item_aliases` by `key`, then by de-pluralized `key`.
3. Hit → set `items.canonical_item_id`; on `item.add`, if the op carried no
   `category`, auto-fill `items.category` with the canonical item's category
   **name** (user-visible payoff; the client sees it on next sync — the
   optimistic reducer needs no change, the poll reconciles).
4. Miss → `canonical_item_id = NULL` and upsert into `unmatched_terms`
   (`occurrences + 1`, `last_seen = CURRENT_DATE`), subject to the 40-char cap
   (P4). Best-effort like events (P6).
5. Also stamp `frequent_items.canonical_item_id` in the existing upsert.

`item.update` text changes that no longer match must clear
`canonical_item_id` (and never touch a user-set `category`).

### B5. Type changes

- `lib/types.ts`: add `canonicalItemId: string | null` to `Item`, and include
  it in `loadState`'s item mapping. Nothing else in the state payload changes;
  the client can ignore the field until a feature uses it.
- The `Op` vocabulary is unchanged (categorization is server-side enrichment,
  which keeps old clients fully compatible).

---

## Implementation order

1. Part B tables + seed + normalization + matching (self-contained, immediate
   user value).
2. Part A `events` table + `recordEvent` + route instrumentation (depends on
   B only for the `item.added` match props — stub them if built first).
3. Rollup cron + retention.
4. (Separate task, not this agent) privacy policy page before public launch.

## Acceptance checklist

- [ ] All DDL runs idempotently on both Neon and PGlite (no extensions, no
      `CREATE OR REPLACE FUNCTION`).
- [ ] Adding `2x whole milk 1L` to a grocery list yields a matched item with
      `category` auto-filled to `Dairy & Eggs`; adding gibberish yields an
      unmatched item and a row in `unmatched_terms`.
- [ ] Adding any item to a **todo** list touches neither the catalog nor
      `unmatched_terms`.
- [ ] Note create/update/delete events contain empty `props`.
- [ ] Killing the `events` insert (e.g. drop the table in a dev branch) does
      not fail the mutate request.
- [ ] `DELETE FROM spaces WHERE id = ...` removes that space's `events` and
      `daily_space_stats` rows.
- [ ] No event row contains free text (spot-check `props` and confirm the
      allowlist constants are the only construction site).

## Targeting unit for any future sponsorship (decided 2026-08-30)

If the Bring!-style in-app sponsorship idea ever ships, the targeting unit is
the **space (household), never the member**. This is a decision, not an
accident of P8:

- Intent targeting ("typed milk → sponsored oat milk") runs off live items +
  the catalog; unaffected by analytics retention.
- Habit targeting ("this household buys pet products") runs off
  `frequent_items` (permanent, per-space, canonical-linked) and 180 days of
  space-level events.
- Conversion measurement is space-level: placement shown → `item.added` with
  that `canonical_item_id` in that space.
- Per-member frequency capping fits inside the 7-day linked window or lives
  client-side.

Cross-time *individual* profiles are deliberately unsupported — they're what
P8 exists to prevent, and they'd move the app from "first-party analytics"
into consent-grade behavioral profiling. Don't re-link members to build an ad
feature; extend the space-level substrate instead (e.g. a per-category
rollup, see below).

## Open questions (product decisions, don't block on them)

- Client-originated events (`app_open`, install prompt shown/accepted) would
  make retention metrics real. Needs a small authenticated endpoint; deferred
  to keep v1 server-derived only.
- A `daily_space_category_stats` rollup (space × day × category_slug) if
  long-horizon household category mix ever needs more than `frequent_items`
  provides. Additive; nothing shipped blocks it.
- Multi-language aliases (the app may get non-English users; `alias_key` is
  language-agnostic by design, so this is additive later).
- ~~Whether `unmatched_terms` review becomes a periodic curation task feeding
  `canonical_items` with `source = 'curated'`.~~ **Built.** `GET/POST
  /api/catalog/curate`, operator-only. `GET` is the review queue, ranked by
  occurrences, each term carrying the category users most often filed it
  under. `POST` promotes a term either as an alias of an existing canonical
  item (`{ term, canonical }`) or as a new one (`{ term, name, category }`),
  then backfills existing grocery items whose *normalized* text matches,
  filling a blank category but never overwriting one somebody chose.
