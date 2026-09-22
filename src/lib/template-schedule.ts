/**
 * Turning a template's relative day offsets into a task's real dates.
 *
 * POST /api/projects materializes template tasks in TWO places — the
 * custom/payload path (sections + tasks sent inline, which is also how a
 * custom template applies) and the built-in `template.tasks` path. They have
 * always computed the due date with the same three lines, and the second copy
 * is exactly the kind of duplicated write this codebase has shipped a no-op
 * fix to before. The rule lives here once so neither path can drift, and so
 * the clamp below can be tested without a database.
 */

/** UTC midnight of the UTC calendar day `from` falls on.
 *
 *  Stored start/due dates are date-only values at UTC midnight, read back by
 *  their UTC day. The anchor that reaches this module is either already one
 *  of those (a "YYYY-MM-DD" start the engineer picked, or the firm's today)
 *  or an instant carrying a time of day. Adding days to the instant stored
 *  the creation time on every task, and anything created after 20:00 in
 *  Miami (00:xx UTC) landed a whole day late. */
function utcDay(from: Date): Date {
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  );
}

/** Whole days added in UTC, so the result stays at UTC midnight across a DST
 *  change (local-calendar arithmetic would drift it to 23:00 or 01:00). */
function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export interface TemplateTaskDates {
  startDate: Date | null;
  dueDate: Date | null;
}

/**
 * The dates one template task gets when a project is created from it.
 *
 * A template that carries only `relativeDueDate` produces one-day bars the
 * engineer has to stretch by hand, one right-handle at a time — a 40-year
 * recertification opens as ~35 of them. `relativeStartDate` is the mirror
 * offset and gives the bar its real duration.
 *
 * Either offset may be absent (no date), and either may be negative — "order
 * the survey two weeks before kickoff" is a real instruction.
 *
 * Both dates come back at UTC midnight of the anchor's UTC day plus the
 * offset, the date-only convention every reader of a due date assumes.
 */
export function templateTaskDates(
  projectStart: Date,
  relativeStartDate: number | null | undefined,
  relativeDueDate: number | null | undefined
): TemplateTaskDates {
  const anchor = utcDay(projectStart);
  const dueDate =
    typeof relativeDueDate === "number" ? addDays(anchor, relativeDueDate) : null;
  let startDate =
    typeof relativeStartDate === "number" ? addDays(anchor, relativeStartDate) : null;

  // A template must not be able to create a row the product would refuse to
  // save: both POST /api/tasks and PATCH /api/tasks/:taskId reject
  // "startDate must be on or before dueDate", so a template whose offsets
  // crossed would seed a task that cannot be edited through the very pickers
  // that would repair it. Clamped rather than dropped — the duration the
  // author meant is wrong either way, but a same-day bar is still a bar the
  // engineer can see and drag.
  if (startDate && dueDate && startDate.getTime() > dueDate.getTime()) {
    startDate = new Date(dueDate);
  }

  return { startDate, dueDate };
}
