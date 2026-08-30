import { describe, expect, it } from "vitest";

import { cascadeActivityRows, cascadeShiftMoved } from "./cascade-activity";
import type { CascadeShift } from "./dependency-cascade";

/**
 * The cascade used to move dates with no history row at all, so the feed on
 * a task that slipped three weeks said nothing. These cases pin the shape of
 * what now gets written — chiefly that the row is attributed to the MOVED
 * task, that it carries both the old and the new dates, and that a shift
 * which did not actually move anything writes nothing.
 *
 * Dates are UTC midnight because that is how date-only values are stored.
 */
const utc = (day: string) => new Date(`${day}T00:00:00.000Z`);

const ctx = {
  userId: "user_1",
  causedByTaskId: "task_blocker",
  causedByTaskName: "Field inspection complete",
};

const shift = (over: Partial<CascadeShift> = {}): CascadeShift => ({
  taskId: "task_a",
  taskName: "Generate recertification reports",
  oldStart: utc("2026-09-14"),
  oldEnd: utc("2026-09-18"),
  newStart: utc("2026-09-21"),
  newEnd: utc("2026-09-25"),
  ...over,
});

describe("cascadeActivityRows", () => {
  it("writes one attributed row for a single shift", () => {
    const rows = cascadeActivityRows([shift()], ctx);

    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("DUE_DATE_CHANGED");
    // The row lives on the task that moved, not on the one the user edited.
    expect(rows[0].taskId).toBe("task_a");
    expect(rows[0].userId).toBe("user_1");

    const data = rows[0].data as Record<string, unknown>;
    expect(data.automatic).toBe(true);
    expect(data.causedByTaskId).toBe("task_blocker");
    expect(data.causedByTaskName).toBe("Field inspection complete");
    expect(data.dueDate).toBe("2026-09-25T00:00:00.000Z");
    expect(data.previousDueDate).toBe("2026-09-18T00:00:00.000Z");
    expect(data.startDate).toBe("2026-09-21T00:00:00.000Z");
    expect(data.previousStartDate).toBe("2026-09-14T00:00:00.000Z");
  });

  it("writes one row per shifted task and keeps their order", () => {
    const rows = cascadeActivityRows(
      [
        shift({ taskId: "task_a" }),
        shift({ taskId: "task_b", newEnd: utc("2026-10-02") }),
        shift({ taskId: "task_c", newStart: null, oldStart: null }),
      ],
      ctx
    );

    expect(rows.map((r) => r.taskId)).toEqual(["task_a", "task_b", "task_c"]);
    // Every row names the SAME origin — on a multi-hop chain the reader is
    // asking what set the whole thing off, not which hop touched them last.
    for (const row of rows) {
      const data = row.data as Record<string, unknown>;
      expect(data.causedByTaskId).toBe("task_blocker");
    }
  });

  it("skips a shift whose dates did not actually change", () => {
    // A diamond graph re-visits the same dependent and can land it back
    // where it started; writing that row would claim a move that never
    // happened.
    const rows = cascadeActivityRows(
      [
        shift({
          taskId: "task_still",
          newStart: utc("2026-09-14"),
          newEnd: utc("2026-09-18"),
        }),
        shift({ taskId: "task_moved" }),
      ],
      ctx
    );

    expect(rows.map((r) => r.taskId)).toEqual(["task_moved"]);
  });

  it("records a shift that only moves the start date", () => {
    const rows = cascadeActivityRows(
      [
        shift({
          oldStart: utc("2026-09-14"),
          newStart: utc("2026-09-16"),
          oldEnd: utc("2026-09-18"),
          newEnd: utc("2026-09-18"),
        }),
      ],
      ctx
    );

    expect(rows).toHaveLength(1);
    const data = rows[0].data as Record<string, unknown>;
    expect(data.startDate).toBe("2026-09-16T00:00:00.000Z");
    expect(data.previousStartDate).toBe("2026-09-14T00:00:00.000Z");
    // Due date unchanged but still written, so the row is self-contained.
    expect(data.dueDate).toBe("2026-09-18T00:00:00.000Z");
    expect(data.previousDueDate).toBe("2026-09-18T00:00:00.000Z");
  });

  it("carries nulls through for a task that had, or gained, no date", () => {
    // A due-only dependent has no startDate; the cascade never fabricates
    // one, so the row must say null rather than invent a day.
    const rows = cascadeActivityRows(
      [
        shift({
          taskId: "task_due_only",
          oldStart: null,
          newStart: null,
          oldEnd: null,
          newEnd: utc("2026-09-25"),
        }),
      ],
      ctx
    );

    expect(rows).toHaveLength(1);
    const data = rows[0].data as Record<string, unknown>;
    expect(data.startDate).toBeNull();
    expect(data.previousStartDate).toBeNull();
    expect(data.previousDueDate).toBeNull();
    expect(data.dueDate).toBe("2026-09-25T00:00:00.000Z");
  });

  it("skips a shift that is null on both sides of both dates", () => {
    const rows = cascadeActivityRows(
      [
        shift({
          oldStart: null,
          newStart: null,
          oldEnd: null,
          newEnd: null,
        }),
      ],
      ctx
    );

    expect(rows).toEqual([]);
  });

  it("returns nothing when the cascade moved nothing", () => {
    expect(cascadeActivityRows([], ctx)).toEqual([]);
  });
});

describe("cascadeShiftMoved", () => {
  // The toast on the Gantt counts shifts through this same rule, so a drag
  // can never report more tasks moved than the feed recorded.
  it("is true when either end moved", () => {
    expect(cascadeShiftMoved(shift())).toBe(true);
    expect(
      cascadeShiftMoved(shift({ newEnd: utc("2026-09-18") }))
    ).toBe(true); // start still moved
  });

  it("is false when neither end moved", () => {
    expect(
      cascadeShiftMoved(
        shift({ newStart: utc("2026-09-14"), newEnd: utc("2026-09-18") })
      )
    ).toBe(false);
  });

  it("reads the ISO copy the browser receives, not just Dates", () => {
    expect(
      cascadeShiftMoved({
        oldStart: "2026-09-14T00:00:00.000Z",
        newStart: "2026-09-14T00:00:00.000Z",
        oldEnd: "2026-09-18T00:00:00.000Z",
        newEnd: "2026-09-25T00:00:00.000Z",
      })
    ).toBe(true);
    expect(
      cascadeShiftMoved({
        oldEnd: "2026-09-18T00:00:00.000Z",
        newEnd: "2026-09-18T00:00:00.000Z",
        oldStart: null,
        newStart: null,
      })
    ).toBe(false);
  });

  it("treats a shift with no date fields as moved", () => {
    // Nothing to disprove it with; the caller was told the cascade ran.
    expect(cascadeShiftMoved({})).toBe(true);
  });

  it("counts a date appearing or disappearing as a move", () => {
    expect(
      cascadeShiftMoved({ oldEnd: null, newEnd: utc("2026-09-25") })
    ).toBe(true);
    expect(
      cascadeShiftMoved({ oldEnd: utc("2026-09-25"), newEnd: null })
    ).toBe(true);
  });
});
