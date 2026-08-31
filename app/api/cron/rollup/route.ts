import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { jsonError, requireOperator } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Days recomputed on each run. Yesterday is the one that matters; the extra
 *  days are cheap insurance against a missed or half-finished run. */
const ROLLUP_WINDOW_DAYS = 3;

/** How long an event stays linked to the member who caused it.
 *
 *  `member_id` exists for one reason: `COUNT(DISTINCT member_id)` per
 *  space-day, which is the difference between "one person added forty items"
 *  and "four people added ten" — the engagement signal a shared app lives or
 *  dies by. That count only needs members to be *distinct within a bucket*,
 *  never identifiable across time, so once a day has been rolled up the id has
 *  done its job and is cleared. What remains is a space-level activity log.
 *
 *  Deliberately wider than ROLLUP_WINDOW_DAYS: a missed run (or a backfill
 *  with a temporarily widened window) still has real ids to count. */
const MEMBER_ID_RETENTION_DAYS = 7;

/** Raw events are pruned at this age. The rollups they feed are permanent. */
const EVENT_RETENTION_DAYS = 180;

/** How long an unmatched term — and the category votes cast on it — is kept.
 *
 *  This is the only table holding text a person typed, so it gets the
 *  shortest life of anything here. A term that is a real catalog gap recurs
 *  well inside this window — groceries are a weekly habit — and each sighting
 *  pushes `last_seen` forward, so recurring terms never age out. Only
 *  genuinely abandoned one-offs expire. */
const TERM_RETENTION_DAYS = 90;

const MS_PER_DAY = 86_400_000;

/** Midnight UTC, `days` ago, as an ISO timestamp.
 *
 *  Computed here rather than with CURRENT_DATE so the bound can't drift with
 *  the database session's time zone — it has to line up exactly with the
 *  UTC-day grouping below, or the oldest day in the window would be
 *  recomputed from a partial slice and undercounted. */
function utcMidnightDaysAgo(days: number): string {
  const now = new Date();
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  return new Date(midnight - days * MS_PER_DAY).toISOString();
}

/** The same instant as a bare "YYYY-MM-DD", for comparing against `date`
 *  columns such as `unmatched_terms.last_seen`. */
function utcDateDaysAgo(days: number): string {
  return utcMidnightDaysAgo(days).slice(0, 10);
}

/**
 * Daily rollup: fold recent `events` into `daily_space_stats`, then walk the
 * retention ladder — unlink members from events that have been counted, drop
 * events past their retention window, and expire stale unmatched terms.
 *
 * Invoked by Vercel Cron (see vercel.json), which sends
 * `Authorization: Bearer $CRON_SECRET`. Local dev has no scheduler — hit the
 * route by hand.
 *
 * The SQL is deliberately plain `GROUP BY` with no extensions, so it runs the
 * same on Neon and on the embedded PGlite database.
 */
export async function GET(req: Request) {
  try {
    requireOperator(req);

    const since = utcMidnightDaysAgo(ROLLUP_WINDOW_DAYS);
    const rolled = await q(
      `INSERT INTO daily_space_stats
         (space_id, day, active_members, items_added, items_completed,
          notes_touched, events_total)
       SELECT
         space_id,
         (occurred_at AT TIME ZONE 'UTC')::date,
         COUNT(DISTINCT member_id)::int,
         COUNT(*) FILTER (WHERE event_type = 'item.added')::int,
         COUNT(*) FILTER (WHERE event_type = 'item.completed')::int,
         COUNT(*) FILTER (
           WHERE event_type IN ('note.created', 'note.updated', 'note.deleted')
         )::int,
         COUNT(*)::int
       FROM events
       WHERE occurred_at >= $1::timestamptz
       GROUP BY space_id, (occurred_at AT TIME ZONE 'UTC')::date
       ON CONFLICT (space_id, day) DO UPDATE SET
         active_members = EXCLUDED.active_members,
         items_added = EXCLUDED.items_added,
         items_completed = EXCLUDED.items_completed,
         notes_touched = EXCLUDED.notes_touched,
         events_total = EXCLUDED.events_total
       RETURNING space_id`,
      [since]
    );

    // Now that those days are counted, the ids that made them countable go.
    const unlinkBefore = utcMidnightDaysAgo(MEMBER_ID_RETENTION_DAYS);
    const unlinked = await q(
      `WITH cleared AS (
         UPDATE events SET member_id = NULL
         WHERE member_id IS NOT NULL AND occurred_at < $1::timestamptz
         RETURNING 1
       )
       SELECT COUNT(*)::int AS n FROM cleared`,
      [unlinkBefore]
    );

    const cutoff = utcMidnightDaysAgo(EVENT_RETENTION_DAYS);
    const pruned = await q(
      `WITH gone AS (
         DELETE FROM events WHERE occurred_at < $1::timestamptz RETURNING 1
       )
       SELECT COUNT(*)::int AS n FROM gone`,
      [cutoff]
    );

    const termCutoff = utcDateDaysAgo(TERM_RETENTION_DAYS);
    const termsExpired = await q(
      `WITH gone AS (
         DELETE FROM unmatched_terms WHERE last_seen < $1::date RETURNING 1
       )
       SELECT COUNT(*)::int AS n FROM gone`,
      [termCutoff]
    );
    // Votes are typed text too, and age out on the same clock.
    const votesExpired = await q(
      `WITH gone AS (
         DELETE FROM term_category_votes WHERE last_seen < $1::date RETURNING 1
       )
       SELECT COUNT(*)::int AS n FROM gone`,
      [termCutoff]
    );

    return NextResponse.json({
      rolledUp: rolled.length,
      since,
      unlinked: Number(unlinked[0]?.n ?? 0),
      unlinkBefore,
      pruned: Number(pruned[0]?.n ?? 0),
      cutoff,
      termsExpired: Number(termsExpired[0]?.n ?? 0),
      votesExpired: Number(votesExpired[0]?.n ?? 0),
      termCutoff,
    });
  } catch (err) {
    return jsonError(err);
  }
}
