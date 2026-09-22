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

// Task dates are DATE-ONLY values: every chart reads them by their UTC
// calendar day. Most writers store UTC midnight, but not all of them (a My
// Tasks calendar drag stores local noon, 16:00Z), so a raw-millisecond delta
// is not a whole number of days — rounded, 00:00Z → 16:00Z three days later
// moved dependents FOUR days, and 16:00Z → 00:00Z the next day moved them
// not at all. All cascade arithmetic therefore runs on UTC day numbers, and
// every date it writes is a clean UTC midnight.
function utcDayNumber(d: Date): number {
  return Math.floor(d.getTime() / MS_PER_DAY);
}

/** Whole UTC calendar days from `a` to `b`. */
function daysBetween(a: Date, b: Date): number {
  return utcDayNumber(b) - utcDayNumber(a);
}

/** UTC midnight of `d`'s UTC calendar day, shifted by `days`. */
function addDays(d: Date, days: number): Date {
  return new Date((utcDayNumber(d) + days) * MS_PER_DAY);
}

/** Same UTC calendar day (or both unset). A stored 16:00Z and a computed
 *  00:00Z on the same day are the same date — rewriting one as the other
 *  is not a move worth a write or a "rescheduled" report. */
function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return a === b;
  return daysBetween(a, b) === 0;
}

interface DateRange {
  start: Date | null;
  end: Date | null;
}

/** The blocker date the dependency type anchors on, and which dependent
 *  field it constrains.
 *
 *  A single-dated blocker occupies its one day, so that day is BOTH its
 *  start and its finish — the same day-occupancy rule the charts draw by
 *  (taskSpan gives a due-only task start = end) and the clamp below applies
 *  to the dependent side. Without the fallback an SS arrow drawn from a
 *  due-only tick never moved its dependent, and a start-only blocker never
 *  pushed an FS dependent. */
function edgeAnchor(
  type: DependencyType,
  blocker: DateRange
): { anchor: Date | null; constrains: "start" | "end" } {
  const start = blocker.start ?? blocker.end;
  const end = blocker.end ?? blocker.start;
  switch (type) {
    case "FINISH_TO_START":
      return { anchor: end, constrains: "start" };
    case "START_TO_START":
      return { anchor: start, constrains: "start" };
    case "FINISH_TO_FINISH":
      return { anchor: end, constrains: "end" };
    case "START_TO_FINISH":
      return { anchor: start, constrains: "end" };
  }
}

/** The before/after anchor pair a gap-preserving shift may diff, or null
 *  when there is no like-for-like pair.
 *
 *  The single-date fallback in edgeAnchor is right for constraint checks but
 *  wrong for a delta: when the blocker gains or loses its second date the
 *  fallback would compare two DIFFERENT fields (old start vs new due) and
 *  read the difference as a schedule move, rescheduling dependents whose
 *  constraint never changed. So the delta is taken only when the field the
 *  edge type anchors on exists on both sides, or when the blocker is
 *  single-dated on the same other field both times. Anything else falls
 *  through to forward-only enforcement. */
function deltaAnchors(
  type: DependencyType,
  before: DateRange,
  after: DateRange
): { anchorOld: Date; anchorNew: Date } | null {
  const field: keyof DateRange =
    type === "FINISH_TO_START" || type === "FINISH_TO_FINISH" ? "end" : "start";
  const other: keyof DateRange = field === "end" ? "start" : "end";
  const o = before[field];
  const n = after[field];
  if (o && n) return { anchorOld: o, anchorNew: n };
  if (!o && !n && before[other] && after[other]) {
    return { anchorOld: before[other]!, anchorNew: after[other]! };
  }
  return null;
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
      return daysBetween(anchor, dep.end) >= 0
        ? null
        : { start: null, end: addDays(anchor, 0) };
    }
    const currentStart = dep.start;
    if (currentStart && daysBetween(anchor, currentStart) >= 0) {
      return null; // Constraint already holds
    }
    const newStart = addDays(anchor, 0);
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
    return daysBetween(anchor, dep.start) >= 0
      ? null
      : { start: addDays(anchor, 0), end: null };
  }
  const currentEnd = dep.end;
  if (currentEnd && daysBetween(anchor, currentEnd) >= 0) {
    return null;
  }
  const newEnd = addDays(anchor, 0);
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

  if (
    sameDay(result.start, dep.dependentTask.startDate) &&
    sameDay(result.end, dep.dependentTask.dueDate)
  ) {
    return [];
  }

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

  // The dates this cascade has WRITTEN, by task. Every write inside the
  // cascade goes through this function, so this map plus the first read of
  // a task is the whole truth — no need to re-read a task from the database
  // before each edge. That, and the per-task edge caches below, keep the
  // query count proportional to the tasks touched instead of four round
  // trips per edge: the caller runs all of this inside one interactive
  // transaction, and a long chained recert schedule has to finish well
  // inside its timeout.
  const latest = new Map<string, DateRange>();
  latest.set(root.id, { start: root.startDate, end: root.dueDate });

  type OutgoingEdge = {
    type: string;
    dependentTask: {
      id: string;
      name: string;
      startDate: Date | null;
      dueDate: Date | null;
      completed: boolean;
    };
  };
  type IncomingEdge = {
    type: string;
    blockingTask: { id: string; startDate: Date | null; dueDate: Date | null };
  };
  const outgoingCache = new Map<string, OutgoingEdge[]>();
  const incomingCache = new Map<string, IncomingEdge[]>();

  while (queue.length > 0) {
    const blocker = queue.shift()!;
    // Find every TaskDependency where blocker.id blocks something
    let deps = outgoingCache.get(blocker.id);
    if (!deps) {
      deps = await tx.taskDependency.findMany({
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
      outgoingCache.set(blocker.id, deps);
    }

    for (const dep of deps) {
      const dt = dep.dependentTask;
      const seen = visits.get(dt.id) ?? 0;
      if (seen >= MAX_VISITS) continue; // cyclic/pathological graph guard
      visits.set(dt.id, seen + 1);
      // Completed tasks aren't auto-reshuffled — once it's done it's done.
      if (dt.completed) continue;

      // An earlier blocker in this same cascade may already have moved the
      // dependent; `dependentTask` above is only its first-read snapshot.
      const current: DateRange = latest.get(dt.id) ?? {
        start: dt.startDate,
        end: dt.dueDate,
      };
      if (!current.start && !current.end) continue; // unscheduled

      // First touch records the pre-cascade baseline; later paths from the
      // same root move shift from THIS, not from already-shifted dates.
      if (!baseline.has(dt.id)) {
        baseline.set(dt.id, { start: current.start, end: current.end });
      }
      const base = baseline.get(dt.id)!;

      const type = dep.type as DependencyType;
      const pair = blocker.old ? deltaAnchors(type, blocker.old, blocker.now) : null;

      let result: { start: Date | null; end: Date | null } | null = null;

      if (pair) {
        const { anchorOld, anchorNew } = pair;
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
        // No like-for-like before/after picture (dependency just
        // created/retyped, or the blocker gained or lost the anchored date)
        // — enforce forward-only.
        result = computeShiftedDates(type, current, blocker.now);
      }
      if (!result) continue;

      // CLAMP — a shift (especially a pull-back) must still satisfy every
      // OTHER blocker of this dependent. Push the whole proposal forward by
      // the largest deficit; duration is preserved because both dates move.
      let otherEdges = incomingCache.get(dt.id);
      if (!otherEdges) {
        otherEdges = await tx.taskDependency.findMany({
          where: { dependentTaskId: dt.id },
          include: {
            blockingTask: { select: { id: true, startDate: true, dueDate: true } },
          },
        });
        incomingCache.set(dt.id, otherEdges);
      }
      let maxDeficit = 0;
      for (const edge of otherEdges) {
        // A blocker this cascade already moved is read from memory — its
        // row in the edge snapshot may predate the move.
        const bDates: DateRange = latest.get(edge.blockingTask.id) ?? {
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

      if (sameDay(result.start, current.start) && sameDay(result.end, current.end)) {
        continue;
      }

      await tx.task.update({
        where: { id: dt.id },
        data: { startDate: result.start, dueDate: result.end },
      });
      latest.set(dt.id, { start: result.start, end: result.end });

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
          oldStart: current.start,
          oldEnd: current.end,
          newStart: result.start,
          newEnd: result.end,
        });
      }

      // Continue cascading from the dependent's new schedule. `old` is its
      // BASELINE — the same reference the shift above was applied to — not
      // the dates it had at this visit. When a diamond reaches it twice by
      // paths that moved it by different amounts, the second visit's dates
      // are already shifted, so the next hop read the difference between
      // the two paths as a fresh delta and stacked it on its own baseline.
      queue.push({
        id: dt.id,
        now: { start: result.start, end: result.end },
        old: base,
      });
    }
  }

  return shifts;
}
