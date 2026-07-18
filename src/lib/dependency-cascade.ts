/**
 * Project-management style dependency cascade (MS-Project / Asana model).
 *
 * When a "blocking" task's startDate or dueDate moves, every task that
 * depends on it (its "dependents") auto-adjusts. This module computes
 * those shifts.
 *
 * Dependency types follow standard PERT/CPM notation:
 *
 *   FS  (Finish-to-Start)   dependent.start ≥ blocker.end       (default)
 *   SS  (Start-to-Start)    dependent.start ≥ blocker.start
 *   FF  (Finish-to-Finish)  dependent.end   ≥ blocker.end
 *   SF  (Start-to-Finish)   dependent.end   ≥ blocker.start
 *
 * SCHEDULING SEMANTICS — two modes:
 *
 * 1. GAP-PRESERVING SHIFT (the MS-Project behaviour, used when we know how
 *    far the blocker's relevant anchor moved): the dependent shifts by the
 *    SAME delta, in EITHER direction, keeping whatever buffer the user had
 *    scheduled between the two tasks (Asana calls this "maintaining the
 *    buffer"; MSP calls the buffer lag). Moving a blocker 3 days later
 *    moves its dependents 3 days later; moving it earlier pulls them
 *    earlier. A pulled-back dependent is then CLAMPED against every one of
 *    its OTHER blockers so no constraint is ever violated (diamond graphs).
 *
 * 2. CONSTRAINT ENFORCEMENT (used when there is no before/after delta —
 *    e.g. a dependency was just created or retyped, or the blocker
 *    previously had no relevant date): push the dependent forward only as
 *    far as needed for the constraint to hold; never move it earlier.
 *
 * The cascade preserves each dependent's *duration* (end − start). If a
 * dependent only has one of the two dates set, we shift the one that
 * exists. Tasks with no dates are skipped — the user has not committed to
 * a schedule yet, so we don't fabricate one. Completed tasks never move.
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

interface DateRange {
  start: Date | null;
  end: Date | null;
}

/** The blocker date the dependency type anchors on, and which dependent
 *  field it constrains. */
function edgeAnchor(
  type: DependencyType,
  blocker: DateRange
): { anchor: Date | null; constrains: "start" | "end" } {
  switch (type) {
    case "FINISH_TO_START":
      return { anchor: blocker.end, constrains: "start" };
    case "START_TO_START":
      return { anchor: blocker.start, constrains: "start" };
    case "FINISH_TO_FINISH":
      return { anchor: blocker.end, constrains: "end" };
    case "START_TO_FINISH":
      return { anchor: blocker.start, constrains: "end" };
  }
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
  const { anchor, constrains } = edgeAnchor(type, blocker);

  if (!anchor) return null; // Blocker has no relevant date — nothing to enforce
  if (!dep.start && !dep.end) return null; // Dependent has no schedule yet

  if (constrains === "start") {
    // Single-dated dependent (due only): treat that one day as the task's
    // whole occupancy — its effective start IS its due date. Never
    // fabricate a startDate; if the constraint fails, shift the one date
    // that exists forward.
    if (!dep.start && dep.end) {
      return dep.end.getTime() >= anchor.getTime()
        ? null
        : { start: null, end: anchor };
    }
    const currentStart = dep.start;
    if (currentStart && currentStart.getTime() >= anchor.getTime()) {
      return null; // Constraint already holds
    }
    const newStart = anchor;
    // Preserve duration when both ends exist.
    let newEnd: Date | null = dep.end;
    if (dep.start && dep.end) {
      const duration = daysBetween(dep.start, dep.end);
      newEnd = addDays(newStart, duration);
    }
    return { start: newStart, end: newEnd };
  }

  // constrains === "end"
  // Single-dated dependent (start only): its effective finish IS its start
  // day. Forward-only: satisfied when start ≥ anchor; otherwise shift the
  // one existing date to the anchor — never pull it back, never fabricate
  // a due date.
  if (dep.start && !dep.end) {
    return dep.start.getTime() >= anchor.getTime()
      ? null
      : { start: anchor, end: null };
  }
  const currentEnd = dep.end;
  if (currentEnd && currentEnd.getTime() >= anchor.getTime()) {
    return null;
  }
  const newEnd = anchor;
  let newStart: Date | null = dep.start;
  if (dep.start && dep.end) {
    const duration = daysBetween(dep.start, dep.end);
    newStart = addDays(newEnd, -duration);
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

  // Everything downstream of the task we just moved — carrying its
  // before-dates so deeper hops shift gap-preserving too.
  const downstream = await cascadeDependentDates(tx, dep.dependentTask.id, {
    start: dep.dependentTask.startDate,
    end: dep.dependentTask.dueDate,
  });
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
  rootTaskId: string,
  /** The root task's dates BEFORE the edit that triggered this cascade.
   *  When supplied, dependents shift by the same delta the relevant anchor
   *  moved (gap-preserving, both directions — the MS-Project behaviour).
   *  When omitted, falls back to forward-only constraint enforcement. */
  rootOld?: DateRange
): Promise<CascadeShift[]> {
  const shifts: CascadeShift[] = [];
  // Tasks whose dates we have just committed and whose dependents
  // therefore need re-evaluation. Each entry holds the task's dates
  // before (`old`) and after (`now`) its move, so each outgoing edge can
  // compute how far its anchor travelled.
  const queue: { id: string; now: DateRange; old: DateRange | null }[] = [];

  const root = await tx.task.findUnique({
    where: { id: rootTaskId },
    select: { id: true, startDate: true, dueDate: true },
  });
  if (!root) return shifts;
  queue.push({
    id: root.id,
    now: { start: root.startDate, end: root.dueDate },
    old: rootOld ?? null,
  });

  // How many times each task has been re-evaluated. A task legitimately
  // repeats once per blocker; the cap only exists to bound a cyclic graph.
  const visits = new Map<string, number>([[root.id, 1]]);
  const MAX_VISITS = 32;

  // Each task's dates BEFORE this cascade touched it. Delta shifts are
  // always computed from this baseline, never from the current (possibly
  // already-shifted) dates — otherwise a diamond graph (A→B, A→C, B→D,
  // C→D) applies the same root delta to D once per path, doubling the
  // move. With the baseline, the second path proposes baseline+delta ==
  // current → no-op → convergence. Also neutralizes delta re-application
  // on corrupt cyclic graphs.
  const baseline = new Map<string, DateRange>();
  baseline.set(root.id, rootOld ?? { start: root.startDate, end: root.dueDate });

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
      if (!current.startDate && !current.dueDate) continue; // unscheduled

      // First touch records the pre-cascade baseline; later paths from the
      // same root move shift from THIS, not from already-shifted dates.
      if (!baseline.has(dt.id)) {
        baseline.set(dt.id, { start: current.startDate, end: current.dueDate });
      }
      const base = baseline.get(dt.id)!;

      const type = dep.type as DependencyType;
      const { anchor: anchorNew } = edgeAnchor(type, blocker.now);
      const anchorOld = blocker.old ? edgeAnchor(type, blocker.old).anchor : null;

      let result: { start: Date | null; end: Date | null } | null = null;

      if (anchorNew && anchorOld) {
        // GAP-PRESERVING SHIFT — move the dependent by exactly as far as
        // the anchor moved, keeping the user's scheduled buffer. Works in
        // both directions. Computed from the BASELINE so a diamond's second
        // path proposes the same position (no double-application).
        const delta = daysBetween(anchorOld, anchorNew);
        if (delta !== 0) {
          result = {
            start: base.start ? addDays(base.start, delta) : null,
            end: base.end ? addDays(base.end, delta) : null,
          };
        }
      } else {
        // No before/after picture (dependency just created/retyped, or the
        // blocker previously had no relevant date) — enforce forward-only.
        result = computeShiftedDates(
          type,
          { start: current.startDate, end: current.dueDate },
          blocker.now
        );
      }
      if (!result) continue;

      // CLAMP — a shift (especially a pull-back) must still satisfy every
      // OTHER blocker of this dependent. Push the whole proposal forward by
      // the largest deficit; duration is preserved because both dates move.
      const otherEdges = await tx.taskDependency.findMany({
        where: { dependentTaskId: dt.id },
        include: {
          blockingTask: { select: { id: true, startDate: true, dueDate: true } },
        },
      });
      let maxDeficit = 0;
      for (const edge of otherEdges) {
        // The blocker we're cascading FROM may not be persisted yet inside
        // this loop's snapshot — use the in-memory dates for it.
        const bDates: DateRange =
          edge.blockingTask.id === blocker.id
            ? blocker.now
            : {
                start: edge.blockingTask.startDate,
                end: edge.blockingTask.dueDate,
              };
        const { anchor, constrains } = edgeAnchor(
          edge.type as DependencyType,
          bDates
        );
        if (!anchor) continue;
        // Day-occupancy fallback: a single-dated proposal uses its one
        // existing date as the effective value for BOTH ends, so a due-only
        // dependent still gets clamped against FS/SS blockers (and a
        // start-only one against FF/SF).
        const field =
          constrains === "start"
            ? result.start ?? result.end
            : result.end ?? result.start;
        if (!field) continue; // fully unscheduled — nothing to clamp
        const deficit = daysBetween(field, anchor);
        if (deficit > maxDeficit) maxDeficit = deficit;
      }
      if (maxDeficit > 0) {
        result = {
          start: result.start ? addDays(result.start, maxDeficit) : null,
          end: result.end ? addDays(result.end, maxDeficit) : null,
        };
      }

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

      // Continue cascading from the dependent's new schedule, carrying its
      // before-dates so the next hop can also preserve gaps.
      queue.push({
        id: dt.id,
        now: { start: result.start, end: result.end },
        old: { start: current.startDate, end: current.dueDate },
      });
    }
  }

  return shifts;
}
