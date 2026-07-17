/**
 * Project-management style dependency cascade.
 *
 * When a "blocking" task's startDate or dueDate moves, every task that
 * depends on it (its "dependents") may need to shift forward so the
 * dependency constraint still holds. This module computes those shifts.
 *
 * Dependency types follow standard PERT/CPM notation:
 *
 *   FS  (Finish-to-Start)   dependent.start ≥ blocker.end       (default)
 *   SS  (Start-to-Start)    dependent.start ≥ blocker.start
 *   FF  (Finish-to-Finish)  dependent.end   ≥ blocker.end
 *   SF  (Start-to-Finish)   dependent.end   ≥ blocker.start
 *
 * The cascade preserves each dependent's *duration* (end − start). If a
 * dependent only has one of the two dates set, we adjust the one we can
 * compute and leave the other null. Tasks with no dates are skipped —
 * the user has not committed to a schedule yet, so we don't fabricate
 * one.
 *
 * We never shift a task *earlier*. Dependencies only push forward.
 *
 * A task can have SEVERAL blockers (diamond graphs: A→B, A→C, B→D, C→D).
 * Each one is a separate constraint, so a dependent must be re-evaluated
 * every time one of its blockers moves — not just the first time we reach
 * it. Cycle protection therefore counts *visits per task* rather than
 * marking a task seen forever: the dependency-create endpoint already
 * refuses cycles, and this bound keeps a corrupt graph from hanging the
 * request while still letting every blocker have its say.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

export type DependencyType =
  | "FINISH_TO_START"
  | "START_TO_START"
  | "FINISH_TO_FINISH"
  | "START_TO_FINISH";

export interface CascadeShift {
  taskId: string;
  taskName: string;
  oldStart: Date | null;
  oldEnd: Date | null;
  newStart: Date | null;
  newEnd: Date | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * MS_PER_DAY);
}

/**
 * Compute the new (start, end) for a dependent task so that the
 * dependency constraint to `blocker` is satisfied — without ever
 * shifting earlier. Returns `null` if no change is required.
 */
function computeShiftedDates(
  type: DependencyType,
  dep: { start: Date | null; end: Date | null },
  blocker: { start: Date | null; end: Date | null }
): { start: Date | null; end: Date | null } | null {
  // Determine the anchor the dependent must be ≥
  let anchor: Date | null = null;
  let constrains: "start" | "end" = "start";

  switch (type) {
    case "FINISH_TO_START":
      anchor = blocker.end;
      constrains = "start";
      break;
    case "START_TO_START":
      anchor = blocker.start;
      constrains = "start";
      break;
    case "FINISH_TO_FINISH":
      anchor = blocker.end;
      constrains = "end";
      break;
    case "START_TO_FINISH":
      anchor = blocker.start;
      constrains = "end";
      break;
  }

  if (!anchor) return null; // Blocker has no relevant date — nothing to enforce
  if (!dep.start && !dep.end) return null; // Dependent has no schedule yet

  if (constrains === "start") {
    const currentStart = dep.start;
    if (currentStart && currentStart.getTime() >= anchor.getTime()) {
      return null; // Constraint already holds
    }
    const newStart = anchor;
    // Preserve duration when both ends exist; otherwise leave the
    // other date null/unchanged.
    let newEnd: Date | null = dep.end;
    if (dep.start && dep.end) {
      const duration = daysBetween(dep.start, dep.end);
      newEnd = addDays(newStart, duration);
    } else if (!dep.start && dep.end) {
      // Only end was set — we now also have a start (the anchor).
      // Keep end unchanged unless newStart > end, in which case
      // we have to push end out by (newStart − end) so the task has
      // non-negative duration.
      if (newStart.getTime() > dep.end.getTime()) {
        newEnd = newStart;
      }
    }
    return { start: newStart, end: newEnd };
  }

  // constrains === "end"
  const currentEnd = dep.end;
  if (currentEnd && currentEnd.getTime() >= anchor.getTime()) {
    return null;
  }
  const newEnd = anchor;
  let newStart: Date | null = dep.start;
  if (dep.start && dep.end) {
    const duration = daysBetween(dep.start, dep.end);
    newStart = addDays(newEnd, -duration);
  } else if (dep.start && !dep.end) {
    if (dep.start.getTime() > newEnd.getTime()) {
      newStart = newEnd;
    }
  }
  return { start: newStart, end: newEnd };
}

/**
 * Apply ONE dependency edge (after it was created or retyped), then cascade
 * onward from whatever it moved.
 *
 * Deliberately narrower than `cascadeDependentDates(tx, blockingTaskId)`:
 * that would re-evaluate every OTHER edge out of the same blocker too, so
 * retyping A→B could silently reschedule an unrelated A→C dependent the
 * user never touched.
 */
export async function cascadeFromDependency(
  tx: Prisma.TransactionClient | PrismaClient,
  dependencyId: string
): Promise<CascadeShift[]> {
  const dep = await tx.taskDependency.findUnique({
    where: { id: dependencyId },
    include: {
      blockingTask: { select: { id: true, startDate: true, dueDate: true } },
      dependentTask: {
        select: {
          id: true,
          name: true,
          startDate: true,
          dueDate: true,
          completed: true,
        },
      },
    },
  });
  if (!dep || dep.dependentTask.completed) return [];

  const result = computeShiftedDates(
    dep.type as DependencyType,
    { start: dep.dependentTask.startDate, end: dep.dependentTask.dueDate },
    { start: dep.blockingTask.startDate, end: dep.blockingTask.dueDate }
  );
  if (!result) return [];

  const sameStart =
    (result.start?.getTime() ?? null) ===
    (dep.dependentTask.startDate?.getTime() ?? null);
  const sameEnd =
    (result.end?.getTime() ?? null) ===
    (dep.dependentTask.dueDate?.getTime() ?? null);
  if (sameStart && sameEnd) return [];

  await tx.task.update({
    where: { id: dep.dependentTask.id },
    data: { startDate: result.start, dueDate: result.end },
  });

  const shifts: CascadeShift[] = [
    {
      taskId: dep.dependentTask.id,
      taskName: dep.dependentTask.name,
      oldStart: dep.dependentTask.startDate,
      oldEnd: dep.dependentTask.dueDate,
      newStart: result.start,
      newEnd: result.end,
    },
  ];

  // Everything downstream of the task we just moved.
  const downstream = await cascadeDependentDates(tx, dep.dependentTask.id);
  for (const s of downstream) {
    if (!shifts.some((x) => x.taskId === s.taskId)) shifts.push(s);
  }
  return shifts;
}

/**
 * Cascade date changes from `rootTaskId` outward through its dependent
 * tasks, persisting any shifted dates inside the supplied transaction.
 * Returns the list of shifts so the caller can surface them to the user.
 *
 * The supplied `tx` should be a Prisma transaction client so the entire
 * cascade is atomic with the original task update.
 */
export async function cascadeDependentDates(
  tx: Prisma.TransactionClient | PrismaClient,
  rootTaskId: string
): Promise<CascadeShift[]> {
  const shifts: CascadeShift[] = [];
  // Tasks whose dates we have just committed and whose dependents
  // therefore need re-evaluation. Each entry holds the *current*
  // start/end for that task (post-update).
  const queue: { id: string; start: Date | null; end: Date | null }[] = [];

  const root = await tx.task.findUnique({
    where: { id: rootTaskId },
    select: { id: true, startDate: true, dueDate: true },
  });
  if (!root) return shifts;
  queue.push({ id: root.id, start: root.startDate, end: root.dueDate });

  // How many times each task has been re-evaluated. A task legitimately
  // repeats once per blocker; the cap only exists to bound a cyclic graph.
  const visits = new Map<string, number>([[root.id, 1]]);
  const MAX_VISITS = 32;

  while (queue.length > 0) {
    const blocker = queue.shift()!;
    // Find every TaskDependency where blocker.id blocks something
    const deps = await tx.taskDependency.findMany({
      where: { blockingTaskId: blocker.id },
      include: {
        dependentTask: {
          select: {
            id: true,
            name: true,
            startDate: true,
            dueDate: true,
            completed: true,
          },
        },
      },
    });

    for (const dep of deps) {
      const dt = dep.dependentTask;
      const seen = visits.get(dt.id) ?? 0;
      if (seen >= MAX_VISITS) continue; // cyclic/pathological graph guard
      visits.set(dt.id, seen + 1);
      // Completed tasks aren't auto-reshuffled — once it's done it's done.
      if (dt.completed) continue;

      // Re-read the dependent: an earlier blocker in this same cascade may
      // have already moved it, and `dependentTask` above is the snapshot
      // from when the query ran.
      const current = await tx.task.findUnique({
        where: { id: dt.id },
        select: { startDate: true, dueDate: true },
      });
      if (!current) continue;

      const result = computeShiftedDates(
        dep.type as DependencyType,
        { start: current.startDate, end: current.dueDate },
        { start: blocker.start, end: blocker.end }
      );
      if (!result) continue;

      const sameStart =
        (result.start?.getTime() ?? null) ===
        (current.startDate?.getTime() ?? null);
      const sameEnd =
        (result.end?.getTime() ?? null) === (current.dueDate?.getTime() ?? null);
      if (sameStart && sameEnd) continue;

      await tx.task.update({
        where: { id: dt.id },
        data: { startDate: result.start, dueDate: result.end },
      });

      // Report one shift per task: fold repeats into the existing entry so
      // the caller's "N tasks rescheduled" counts tasks, not edges.
      const prior = shifts.find((s) => s.taskId === dt.id);
      if (prior) {
        prior.newStart = result.start;
        prior.newEnd = result.end;
      } else {
        shifts.push({
          taskId: dt.id,
          taskName: dt.name,
          oldStart: current.startDate,
          oldEnd: current.dueDate,
          newStart: result.start,
          newEnd: result.end,
        });
      }

      // Continue cascading from the dependent's new schedule
      queue.push({ id: dt.id, start: result.start, end: result.end });
    }
  }

  return shifts;
}
