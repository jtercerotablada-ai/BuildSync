/**
 * History rows for the dependency cascade.
 *
 * THE BUG THIS FILE EXISTS TO FIX: `dependency-cascade.ts` moves a
 * dependent's dates with a bare `tx.task.update` (:203, :404). No Activity
 * row is written, so a task that slipped three weeks because its blocker
 * moved showed a new due date and an activity feed that said nothing — on a
 * 40-year recertification that is the difference between answering "why did
 * the filing slip?" and guessing. The shifts were already being computed and
 * returned (`CascadeShift[]`); nobody was writing them down.
 *
 * This module turns those shifts into `Activity` rows. It is PURE — no
 * Prisma client, no clock, no `new Date()` — so the exact shape that lands
 * in `Activity.data` is testable without a database. The three call sites
 * (tasks/[taskId] PATCH, and dependencies POST + PATCH) hand the result to
 * `prisma.activity.createMany` AFTER their transaction commits, next to the
 * activity write that is already there.
 *
 * WHOSE FEED THESE LAND ON. The cascade walks `findMany({blockingTaskId})`
 * with no project scope, so it can move a task in a DIFFERENT project from
 * the one the actor edited. We write the row anyway, on the moved task:
 * the alternative is the state we are fixing — a task whose dates changed
 * with no record of who or why. The row is read through that task's own
 * access guard, so it is only ever shown to someone who can already open
 * the task.
 *
 * That guard is the whole of the argument, and it is worth being exact
 * about what it does NOT cover: `causedByTaskName` is the cascade's ORIGIN,
 * which past the first hop is not the reader's own blocker. On A → B → C,
 * C's row names A — and C's "Blocked by" names B, so on a private A the
 * name reaches a reader who cannot open the task it belongs to. It is one
 * task name, on a feed only the moved task's own readers see, and the
 * alternative on the table (dropping the cause) leaves exactly the silent
 * move this module exists to end. Naming each row's IMMEDIATE blocker
 * instead is the real answer, and it needs `CascadeShift` to carry the edge
 * it came from — a dependency-cascade.ts change, deliberately not made
 * here.
 */

import type { Prisma } from "@prisma/client";

import type { CascadeShift } from "./dependency-cascade";

export type CascadeActivityRow = Prisma.ActivityCreateManyInput;

export interface CascadeActivityContext {
  /** The user whose edit set the cascade off — the feed attributes the
   *  automatic move to them, because they are the answer to "who". */
  userId: string;
  /** The task the user actually edited (the ROOT of the cascade), not
   *  necessarily the direct blocker of each shifted task: on a two-hop
   *  chain the origin is what the reader is looking for. */
  causedByTaskId: string;
  /** Denormalized on purpose. The row must still read correctly after the
   *  cause is renamed or deleted — `Activity.data` is a record of what was
   *  true at the time, and there is no FK from it to a task. The id travels
   *  alongside for anything that wants to resolve the live name. */
  causedByTaskName: string;
}

/** Date-only values are stored at UTC midnight; ISO keeps that instant
 *  intact through JSON so the reader can rebuild the calendar day with
 *  `dueDateToLocalMidnight`. */
function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/** ISO in, Date in, null in — one number-or-null out, so the same
 *  comparison serves a `CascadeShift` here and the JSON copy of it that
 *  reaches the browser. */
function instant(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const t = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

function sameInstant(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined
): boolean {
  return instant(a) === instant(b);
}

/** The date fields of a shift, as they arrive server-side (Date) or over
 *  the wire (ISO string). */
export interface CascadeShiftDates {
  oldStart?: Date | string | null;
  oldEnd?: Date | string | null;
  newStart?: Date | string | null;
  newEnd?: Date | string | null;
}

/**
 * Whether a shift actually moved something.
 *
 * `cascadeDependentDates` folds repeat visits of the same task into one
 * entry and re-writes its `new*` fields, so a diamond graph can leave a
 * shift whose end position equals where it started. One rule, two readers:
 * the history skips such a shift (writing "moved the due date to Sep 18"
 * on a task still due Sep 18 is a lie in the feed) and so does the toast
 * that counts them — the alternative is a drag that says "3 tasks moved"
 * and leaves two rows behind, which is the same event answered twice.
 *
 * A shift carrying none of the four fields is treated as moved: the caller
 * knows something changed and this function has nothing to disprove it.
 */
export function cascadeShiftMoved(shift: CascadeShiftDates): boolean {
  const known =
    shift.oldStart !== undefined ||
    shift.newStart !== undefined ||
    shift.oldEnd !== undefined ||
    shift.newEnd !== undefined;
  if (!known) return true;
  return (
    !sameInstant(shift.oldStart, shift.newStart) ||
    !sameInstant(shift.oldEnd, shift.newEnd)
  );
}

/**
 * One DUE_DATE_CHANGED row per shift that actually moved something —
 * `cascadeShiftMoved` above is the rule, skipped here rather than filtered
 * at three call sites.
 */
export function cascadeActivityRows(
  shifts: CascadeShift[],
  opts: CascadeActivityContext
): CascadeActivityRow[] {
  const rows: CascadeActivityRow[] = [];

  for (const shift of shifts) {
    if (!cascadeShiftMoved(shift)) continue;

    rows.push({
      type: "DUE_DATE_CHANGED",
      // The row belongs to the task that MOVED, not to the one the user
      // edited: that is the feed someone opens when the date surprises them.
      taskId: shift.taskId,
      userId: opts.userId,
      data: {
        // `dueDate` keeps the key every existing DUE_DATE_CHANGED row uses,
        // so the feed renderer needs no new type to display these.
        dueDate: iso(shift.newEnd),
        previousDueDate: iso(shift.oldEnd),
        startDate: iso(shift.newStart),
        previousStartDate: iso(shift.oldStart),
        // The one flag that separates "someone picked this date" from
        // "the schedule moved underneath you".
        automatic: true,
        causedByTaskId: opts.causedByTaskId,
        causedByTaskName: opts.causedByTaskName,
      },
    });
  }

  return rows;
}
