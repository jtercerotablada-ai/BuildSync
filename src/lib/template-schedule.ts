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

/** Days added on the LOCAL calendar, matching what the due-date line in
 *  POST /api/projects has always done: `new Date(start)` then
 *  `setDate(getDate() + n)`. Deliberately not UTC arithmetic — changing it
 *  would move the due date of every project made from a template, which is a
 *  different bug than the one this file exists for. */
function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
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
 */
export function templateTaskDates(
  projectStart: Date,
  relativeStartDate: number | null | undefined,
  relativeDueDate: number | null | undefined
): TemplateTaskDates {
  const dueDate =
    typeof relativeDueDate === "number" ? addDays(projectStart, relativeDueDate) : null;
  let startDate =
    typeof relativeStartDate === "number" ? addDays(projectStart, relativeStartDate) : null;

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
