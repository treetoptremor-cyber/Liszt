/**
 * Calendar dates as plain "YYYY-MM-DD" strings in the device's local zone.
 *
 * Everything scheduling-related deliberately avoids timestamps: a to-do due
 * Tuesday should be due Tuesday regardless of timezone, and ISO date strings
 * compare correctly with `<` / `>` so range checks stay trivial.
 */

export const WEEK_STARTS_ON = 0; // 0 = Sunday

export const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateStr(v: unknown): v is string {
  return typeof v === "string" && DATE_RE.test(v);
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Local Y-M-D of a Date. */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse to a local Date anchored at noon, so ±1 day arithmetic can't be
 *  knocked into the wrong day by a DST transition. */
export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function addDays(s: string, n: number): string {
  const d = fromDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function addMonths(s: string, n: number): string {
  const d = fromDateStr(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  // Clamp to the last valid day (Jan 31 + 1 month → Feb 28/29).
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toDateStr(d);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(s: string): number {
  return fromDateStr(s).getDay();
}

export function startOfWeek(s: string): string {
  const shift = (dayOfWeek(s) - WEEK_STARTS_ON + 7) % 7;
  return addDays(s, -shift);
}

export function startOfMonth(s: string): string {
  return `${s.slice(0, 7)}-01`;
}

export function daysInMonth(s: string): number {
  const d = fromDateStr(s);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** `count` consecutive dates starting at `start`. */
export function dateRange(start: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(addDays(start, i));
  return out;
}

export function dayNumber(s: string): number {
  return Number(s.slice(8, 10));
}

export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** "Aug 30" / "Aug 30, 2027" once the year differs from today's. */
export function formatShort(s: string, today = todayStr()): string {
  const month = MONTHS_SHORT[Number(s.slice(5, 7)) - 1];
  const day = dayNumber(s);
  const year = s.slice(0, 4);
  return year === today.slice(0, 4)
    ? `${month} ${day}`
    : `${month} ${day}, ${year}`;
}

/** "Today" / "Tomorrow" / "Yesterday", else "Sat, Aug 30". */
export function formatRelative(s: string, today = todayStr()): string {
  if (s === today) return "Today";
  if (s === addDays(today, 1)) return "Tomorrow";
  if (s === addDays(today, -1)) return "Yesterday";
  return `${WEEKDAY_SHORT[dayOfWeek(s)]}, ${formatShort(s, today)}`;
}

/** "Saturday, August 30" — the day sheet's heading. */
export function formatLong(s: string): string {
  const month = MONTHS_LONG[Number(s.slice(5, 7)) - 1];
  return `${WEEKDAY_NAMES[dayOfWeek(s)]}, ${month} ${dayNumber(s)}`;
}

export function formatMonthYear(s: string): string {
  return `${MONTHS_LONG[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;
}

/** Label for a span of days: "Aug 30 – Sep 12" (month repeated only when it
 *  changes), plus the year when the span isn't in the current one. */
export function formatSpan(start: string, end: string): string {
  const today = todayStr();
  const left = `${MONTHS_SHORT[Number(start.slice(5, 7)) - 1]} ${dayNumber(start)}`;
  const right = isSameMonth(start, end)
    ? String(dayNumber(end))
    : `${MONTHS_SHORT[Number(end.slice(5, 7)) - 1]} ${dayNumber(end)}`;
  const year =
    start.slice(0, 4) === today.slice(0, 4) && end.slice(0, 4) === today.slice(0, 4)
      ? ""
      : ` ${end.slice(0, 4)}`;
  return `${left} – ${right}${year}`;
}

// ———— weekday bitmasks ————

export function maskHasDay(mask: number, dow: number): boolean {
  return (mask & (1 << dow)) !== 0;
}

export function toggleMaskDay(mask: number, dow: number): number {
  return mask ^ (1 << dow);
}

export function maskDays(mask: number): number[] {
  const out: number[] = [];
  for (let d = 0; d < 7; d++) if (maskHasDay(mask, d)) out.push(d);
  return out;
}

const EVERY_DAY = 0b1111111;
const WEEKDAYS_MASK = 0b0111110; // Mon–Fri
const WEEKEND_MASK = 0b1000001; // Sat + Sun

/** "Every day" / "Weekdays" / "Weekends" / "Mon, Thu" — how a rule reads. */
export function describeMask(mask: number): string {
  const days = maskDays(mask);
  if (days.length === 0) return "Never";
  if (mask === EVERY_DAY) return "Every day";
  if (mask === WEEKDAYS_MASK) return "Weekdays";
  if (mask === WEEKEND_MASK) return "Weekends";
  if (days.length === 1) return `Every ${WEEKDAY_NAMES[days[0]]}`;
  return days.map((d) => WEEKDAY_SHORT[d]).join(", ");
}
