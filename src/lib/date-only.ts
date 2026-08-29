/**
 * Calendar-day helpers for task due dates.
 *
 * Due dates reach the client as UTC-midnight timestamps: composers send
 * date-only strings ("YYYY-MM-DD") and the API stores `new Date(str)`,
 * which the JS spec parses as 00:00 UTC. Reading those with local getters
 * (getDate/toDateString) shifts the calendar day for every viewer west of
 * UTC — a task due "today" renders as overdue "Yesterday". Widgets must
 * bucket and label by the UTC calendar day instead.
 */

/** Rebuild a due date as local midnight of its UTC calendar day, so it can
 *  be compared against `startOfLocalDay()` and formatted with local APIs. */
export function dueDateToLocalMidnight(value: string | Date): Date {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Local midnight of the given moment (defaults to now).
 *
 *  The no-argument form READS THE CLOCK, which is safe on the server, in an
 *  event handler or in an effect — and wrong during the RENDER of a client
 *  component. The server render runs in UTC, so from 20:00 in Miami (00:00
 *  UTC) it answers TOMORROW, and React does not repair a text or className
 *  mismatch when it hydrates: the wrong day stays on screen all evening.
 *  In a client render take the day from `useToday()` (src/lib/use-today.ts)
 *  instead of calling this. */
export function startOfLocalDay(from: Date = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate());
}

/** Format a picked local Date as a date-only "YYYY-MM-DD" string of its
 *  local calendar day. Send this to the API (which stores it at UTC
 *  midnight via `new Date(str)`) so every surface writes the SAME
 *  convention as the list/calendar/timeline and reads back correctly
 *  with `dueDateToLocalMidnight`. Avoids the local-midnight-ISO instant
 *  that shifted the calendar day for non-UTC users. */
export function toDateOnlyISO(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Whole calendar days from `today` to the due date (negative = overdue).
 *
 *  `today` is REQUIRED and must be LOCAL MIDNIGHT of the day the caller
 *  means: `useToday()` in a client component, `startOfLocalDay()` on the
 *  server. This function used to read the clock itself, and that was the
 *  bug — the server render runs in UTC, so from 20:00 in Miami (00:00 UTC)
 *  it counted from TOMORROW, and React does not repair a text or className
 *  mismatch when it hydrates: a task due today read "Tomorrow", and the
 *  Timeline lit the wrong column, for the whole evening. There is
 *  deliberately NO default: a default is exactly what let one hidden clock
 *  read spread to nineteen call sites without any of them saying so. */
export function daysFromToday(value: string | Date, today: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round(
    (dueDateToLocalMidnight(value).getTime() - today.getTime()) / MS_PER_DAY
  );
}

/** UTC midnight of today — the server-side boundary for "overdue".
 *
 *  Due dates are stored at UTC midnight of the due day, so comparing them to
 *  `new Date()` marks everything due TODAY as overdue from 00:00 onward.
 *  Every overdue count must compare against this instead. */
export function startOfTodayUtc(from: Date = new Date()): Date {
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  );
}

/** UTC midnight of the day AFTER `from` — the exclusive end of "due today". */
export function startOfTomorrowUtc(from: Date = new Date()): Date {
  return new Date(startOfTodayUtc(from).getTime() + 24 * 60 * 60 * 1000);
}
