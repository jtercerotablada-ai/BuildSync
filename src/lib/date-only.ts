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

/** Local midnight of the given moment (defaults to now). */
export function startOfLocalDay(from: Date = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate());
}

/** Whole calendar days from today to the due date (negative = overdue). */
export function daysFromToday(value: string | Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round(
    (dueDateToLocalMidnight(value).getTime() - startOfLocalDay().getTime()) /
      MS_PER_DAY
  );
}
