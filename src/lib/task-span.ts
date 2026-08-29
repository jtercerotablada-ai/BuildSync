/**
 * The date logic the two schedule charts share.
 *
 * Lived inside timeline-view.tsx until the Gantt — the other half of the
 * same view switcher — needed the identical rules. A start-only task was
 * drawn on one chart and invisible on the other, and "late" was red on one
 * and not the other, because each fork carried its own copy of "what dates
 * does this task have". There is one copy now.
 */

import { addDays, differenceInCalendarDays, format } from "date-fns";

import { dueDateToLocalMidnight } from "@/lib/date-only";

/** The date-only fields every span/overdue helper reads. */
export type TaskDates = {
  startDate?: string | null;
  dueDate: string | null;
  completed?: boolean;
};

/**
 * The calendar span a task occupies on the chart, or null when it carries
 * no date at all.
 *
 * `open` is the "started, no end committed" case — a startDate with no
 * dueDate, which is how a field survey is planned before anyone knows when
 * it closes. Every caller here used to gate on `task.dueDate`, so such a
 * task was drawn nowhere AND listed as "No date" in the not-shown popover
 * even though it had one. It gets a one-day span anchored on its start; the
 * renderer fades its right edge so it does not read as a one-day task.
 */
export function taskSpan(
  task: TaskDates
): { start: Date; end: Date; open: boolean } | null {
  if (task.dueDate) {
    const end = dueDateToLocalMidnight(task.dueDate);
    let start = task.startDate ? dueDateToLocalMidnight(task.startDate) : end;
    // Legacy rows can be inverted; the bar must still draw somewhere sane.
    if (start > end) start = end;
    return { start, end, open: false };
  }
  if (task.startDate) {
    const start = dueDateToLocalMidnight(task.startDate);
    return { start, end: start, open: true };
  }
  return null;
}

/** Whole calendar days from `today` to a due date (negative = past due).
 *  Takes today as an argument instead of reading the clock: on the server
 *  the local day IS the UTC day, so from 20:00 in Miami every date-derived
 *  accent was computed against tomorrow — and React does not repair a
 *  className mismatch on hydration. */
export function daysUntilDue(today: Date, dueDate: string | Date): number {
  return differenceInCalendarDays(dueDateToLocalMidnight(dueDate), today);
}

/**
 * Late: not completed, and the due day is STRICTLY before today. Due today
 * is not late — the same boundary the list view's red date tone and this
 * view's due-soon ring already use.
 *
 * A start-only task has committed no end date, so it can never be late, and
 * `today` is null until the hook mounts — neither paints an overdue accent.
 */
export function isTaskOverdue(task: TaskDates, today: Date | null): boolean {
  if (!today || !task.dueDate || task.completed) return false;
  return daysUntilDue(today, task.dueDate) < 0;
}

/**
 * The PATCH body a finished drag writes.
 *
 * Pure and exported because this is the part that reaches the database.
 * The invariants it encodes, each one verified end-to-end against it:
 *   - a body move preserves duration and NEVER invents a dueDate the
 *     engineer has not committed to;
 *   - the right handle is the only gesture that gives a start-only task an
 *     end date, and it then sends BOTH edges so the API can validate the
 *     pair ("startDate must be on or before dueDate");
 *   - the left handle clamps at the due day rather than bouncing the drag.
 * `deltaDays` is already snapped to whole days by the caller.
 */
export function dragCommitBody(
  originalStart: string | null,
  originalDue: string | null,
  handle: "left" | "right" | "move",
  deltaDays: number
): Record<string, string | null> {
  // Read the originals by their UTC calendar day (they're UTC-midnight
  // instants). Round-tripping through parseISO+local format shifted every
  // saved date one day earlier for users west of UTC.
  const origDue = originalDue ? dueDateToLocalMidnight(originalDue) : null;
  // No startDate = 1-day bar sitting on the due date. No dueDate = a
  // start-only task, one day wide and open on the right.
  const impliedStart = originalStart
    ? dueDateToLocalMidnight(originalStart)
    : origDue;
  if (!impliedStart) return {};

  const body: Record<string, string | null> = {};
  if (handle === "left") {
    let newStart = addDays(impliedStart, deltaDays);
    if (origDue && newStart > origDue) newStart = origDue;
    body.startDate = format(newStart, "yyyy-MM-dd");
  } else if (handle === "right") {
    let newDue = addDays(origDue ?? impliedStart, deltaDays);
    if (newDue < impliedStart) newDue = impliedStart;
    body.dueDate = format(newDue, "yyyy-MM-dd");
    // Pin the left edge: with no persisted startDate the 1-day bar would
    // otherwise translate instead of growing. A start-only task needs it
    // sent too — that write is what commits its end date.
    if (!originalStart || !origDue) {
      body.startDate = format(impliedStart, "yyyy-MM-dd");
    }
  } else {
    // "move" — shift the whole bar; duration preserved.
    if (origDue) {
      body.dueDate = format(addDays(origDue, deltaDays), "yyyy-MM-dd");
    }
    if (originalStart) {
      body.startDate = format(addDays(impliedStart, deltaDays), "yyyy-MM-dd");
    }
  }
  return body;
}

