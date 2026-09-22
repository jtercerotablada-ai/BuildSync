import { describe, expect, it } from "vitest";

import {
  cascadeDependentDates,
  cascadeFromDependency,
  type DependencyType,
} from "./dependency-cascade";

// An in-memory stand-in for the four Prisma calls the cascade makes. Only
// the shapes the cascade reads are modelled; everything else is absent on
// purpose so a new query shows up as a crash here, not as a silent no-op.
type Row = {
  id: string;
  name: string;
  startDate: Date | null;
  dueDate: Date | null;
  completed: boolean;
};
type Edge = {
  id: string;
  blockingTaskId: string;
  dependentTaskId: string;
  type: DependencyType;
};

const d = (day: string, time = "00:00:00") => new Date(`${day}T${time}.000Z`);
const day = (v: Date | null) => (v ? v.toISOString().slice(0, 10) : null);

function fakeTx(tasks: Row[], edges: Edge[]) {
  const byId = new Map(tasks.map((t) => [t.id, { ...t }]));
  let queries = 0;
  const pick = (id: string) => {
    const t = byId.get(id)!;
    return { ...t };
  };
  const tx = {
    task: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        queries++;
        const t = byId.get(where.id);
        return t ? { ...t } : null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { startDate: Date | null; dueDate: Date | null };
      }) => {
        queries++;
        const t = byId.get(where.id)!;
        t.startDate = data.startDate;
        t.dueDate = data.dueDate;
        return { ...t };
      },
    },
    taskDependency: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        queries++;
        const e = edges.find((x) => x.id === where.id);
        if (!e) return null;
        return {
          ...e,
          blockingTask: pick(e.blockingTaskId),
          dependentTask: pick(e.dependentTaskId),
        };
      },
      findMany: async ({
        where,
      }: {
        where: { blockingTaskId?: string; dependentTaskId?: string };
      }) => {
        queries++;
        if (where.blockingTaskId) {
          return edges
            .filter((e) => e.blockingTaskId === where.blockingTaskId)
            .map((e) => ({ ...e, dependentTask: pick(e.dependentTaskId) }));
        }
        return edges
          .filter((e) => e.dependentTaskId === where.dependentTaskId)
          .map((e) => ({ ...e, blockingTask: pick(e.blockingTaskId) }));
      },
    },
  };
  return {
    // The cascade only touches the members above.
    tx: tx as unknown as Parameters<typeof cascadeDependentDates>[0],
    get: (id: string) => byId.get(id)!,
    move: (id: string, start: Date | null, due: Date | null) => {
      const t = byId.get(id)!;
      const old = { start: t.startDate, end: t.dueDate };
      t.startDate = start;
      t.dueDate = due;
      return old;
    },
    queries: () => queries,
  };
}

const task = (
  id: string,
  start: string | null,
  due: string | null,
  completed = false
): Row => ({
  id,
  name: id,
  startDate: start ? d(start) : null,
  dueDate: due ? d(due) : null,
  completed,
});

describe("cascadeDependentDates — calendar-day deltas", () => {
  it("moves an FS dependent by whole UTC days when the blocker lands on a noon instant", async () => {
    const f = fakeTx(
      [task("A", null, "2026-09-22"), task("B", "2026-09-24", "2026-09-26")],
      [{ id: "e1", blockingTaskId: "A", dependentTaskId: "B", type: "FINISH_TO_START" }]
    );
    // A My Tasks calendar drag stores local noon: 16:00Z three days later.
    const old = f.move("A", null, d("2026-09-25", "16:00:00"));
    await cascadeDependentDates(f.tx, "A", old);
    expect(day(f.get("B").startDate)).toBe("2026-09-27");
    expect(day(f.get("B").dueDate)).toBe("2026-09-29");
    // And the written dates are clean UTC midnights.
    expect(f.get("B").startDate!.toISOString()).toBe("2026-09-27T00:00:00.000Z");
  });

  it("still follows a blocker moved from a noon instant back to midnight one day later", async () => {
    const f = fakeTx(
      [
        { ...task("A", null, null), dueDate: d("2026-09-25", "16:00:00") },
        task("B", "2026-09-27", "2026-09-29"),
      ],
      [{ id: "e1", blockingTaskId: "A", dependentTaskId: "B", type: "FINISH_TO_START" }]
    );
    const old = f.move("A", null, d("2026-09-26"));
    await cascadeDependentDates(f.tx, "A", old);
    expect(day(f.get("B").startDate)).toBe("2026-09-28");
  });
});

describe("cascadeDependentDates — diamonds", () => {
  it("shifts downstream of a twice-visited task by the gap-preserving amount", async () => {
    // A→B (SS), A→C (FS), B→D (FS), C→D (FS), D→E (FS), with slack.
    const f = fakeTx(
      [
        task("A", "2026-09-10", "2026-09-12"),
        task("B", "2026-09-10", "2026-09-11"),
        task("C", "2026-09-14", "2026-09-15"),
        task("D", "2026-09-20", "2026-09-21"),
        task("E", "2026-09-25", "2026-09-26"),
      ],
      [
        { id: "1", blockingTaskId: "A", dependentTaskId: "B", type: "START_TO_START" },
        { id: "2", blockingTaskId: "A", dependentTaskId: "C", type: "FINISH_TO_START" },
        { id: "3", blockingTaskId: "B", dependentTaskId: "D", type: "FINISH_TO_START" },
        { id: "4", blockingTaskId: "C", dependentTaskId: "D", type: "FINISH_TO_START" },
        { id: "5", blockingTaskId: "D", dependentTaskId: "E", type: "FINISH_TO_START" },
      ]
    );
    // Start two days earlier, due three days later.
    const old = f.move("A", d("2026-09-08"), d("2026-09-15"));
    await cascadeDependentDates(f.tx, "A", old);
    // D's final position is the FS-via-C one: baseline + 3.
    expect(day(f.get("D").startDate)).toBe("2026-09-23");
    // E follows D's net move from its baseline (+3), not the +5 difference
    // between the two paths.
    expect(day(f.get("E").startDate)).toBe("2026-09-28");
    expect(day(f.get("E").dueDate)).toBe("2026-09-29");
  });

  it("does not double-apply a root delta through two equal paths", async () => {
    const f = fakeTx(
      [
        task("A", "2026-09-01", "2026-09-02"),
        task("B", "2026-09-03", "2026-09-04"),
        task("C", "2026-09-03", "2026-09-04"),
        task("D", "2026-09-06", "2026-09-07"),
      ],
      [
        { id: "1", blockingTaskId: "A", dependentTaskId: "B", type: "FINISH_TO_START" },
        { id: "2", blockingTaskId: "A", dependentTaskId: "C", type: "FINISH_TO_START" },
        { id: "3", blockingTaskId: "B", dependentTaskId: "D", type: "FINISH_TO_START" },
        { id: "4", blockingTaskId: "C", dependentTaskId: "D", type: "FINISH_TO_START" },
      ]
    );
    const old = f.move("A", d("2026-09-03"), d("2026-09-04"));
    const shifts = await cascadeDependentDates(f.tx, "A", old);
    expect(day(f.get("D").startDate)).toBe("2026-09-08");
    expect(shifts.map((s) => s.taskId).sort()).toEqual(["B", "C", "D"]);
  });
});

describe("cascadeDependentDates — single-dated blockers", () => {
  it("moves an SS dependent of a due-only blocker", async () => {
    const f = fakeTx(
      [task("A", null, "2026-09-10"), task("B", "2026-09-10", "2026-09-12")],
      [{ id: "1", blockingTaskId: "A", dependentTaskId: "B", type: "START_TO_START" }]
    );
    const old = f.move("A", null, d("2026-09-17"));
    await cascadeDependentDates(f.tx, "A", old);
    expect(day(f.get("B").startDate)).toBe("2026-09-17");
    expect(day(f.get("B").dueDate)).toBe("2026-09-19");
  });

  it("pushes an FS dependent of a start-only blocker", async () => {
    const f = fakeTx(
      [task("A", "2026-09-10", null), task("B", "2026-09-12", "2026-09-13")],
      [{ id: "1", blockingTaskId: "A", dependentTaskId: "B", type: "FINISH_TO_START" }]
    );
    const old = f.move("A", d("2026-09-14"), null);
    await cascadeDependentDates(f.tx, "A", old);
    expect(day(f.get("B").startDate)).toBe("2026-09-16");
  });
});

describe("cascadeDependentDates — blocker gains or loses a date", () => {
  // The delta is only taken between like-for-like fields. Diffing old start
  // against new due (or the reverse) would read a date being filled in or
  // cleared as a schedule move.
  it("does not move an FS dependent when a start-only blocker gains a due date", async () => {
    const f = fakeTx(
      [task("A", "2026-09-01", null), task("B", "2026-10-15", "2026-10-16")],
      [{ id: "1", blockingTaskId: "A", dependentTaskId: "B", type: "FINISH_TO_START" }]
    );
    const old = f.move("A", d("2026-09-01"), d("2026-09-10"));
    const shifts = await cascadeDependentDates(f.tx, "A", old);
    expect(shifts).toEqual([]);
    expect(day(f.get("B").startDate)).toBe("2026-10-15");
    expect(day(f.get("B").dueDate)).toBe("2026-10-16");
  });

  it("does not move an FS dependent when the blocker loses its due date", async () => {
    const f = fakeTx(
      [task("A", "2026-09-01", "2026-09-30"), task("B", "2026-10-01", "2026-10-02")],
      [{ id: "1", blockingTaskId: "A", dependentTaskId: "B", type: "FINISH_TO_START" }]
    );
    const old = f.move("A", d("2026-09-01"), null);
    const shifts = await cascadeDependentDates(f.tx, "A", old);
    expect(shifts).toEqual([]);
    expect(day(f.get("B").startDate)).toBe("2026-10-01");
    expect(day(f.get("B").dueDate)).toBe("2026-10-02");
  });

  it("does not pull SS dependents back when a due-only blocker gains a start date", async () => {
    const f = fakeTx(
      [
        task("A", null, "2026-09-20"),
        task("B", "2026-09-20", "2026-09-22"),
        task("C", "2026-09-25", "2026-09-26"),
      ],
      [
        { id: "1", blockingTaskId: "A", dependentTaskId: "B", type: "START_TO_START" },
        { id: "2", blockingTaskId: "A", dependentTaskId: "C", type: "START_TO_START" },
      ]
    );
    const old = f.move("A", d("2026-09-10"), d("2026-09-20"));
    const shifts = await cascadeDependentDates(f.tx, "A", old);
    expect(shifts).toEqual([]);
    expect(day(f.get("B").startDate)).toBe("2026-09-20");
    expect(day(f.get("B").dueDate)).toBe("2026-09-22");
    expect(day(f.get("C").startDate)).toBe("2026-09-25");
  });

  it("still shifts an SS dependent when a due-only blocker stays due-only", async () => {
    const f = fakeTx(
      [task("A", null, "2026-09-20"), task("B", "2026-09-20", "2026-09-22")],
      [{ id: "1", blockingTaskId: "A", dependentTaskId: "B", type: "START_TO_START" }]
    );
    const old = f.move("A", null, d("2026-09-25"));
    await cascadeDependentDates(f.tx, "A", old);
    expect(day(f.get("B").startDate)).toBe("2026-09-25");
    expect(day(f.get("B").dueDate)).toBe("2026-09-27");
  });
});

describe("cascadeDependentDates — invariants", () => {
  it("never moves completed tasks and skips unscheduled ones", async () => {
    const f = fakeTx(
      [
        task("A", "2026-09-01", "2026-09-02"),
        task("B", "2026-09-03", "2026-09-04", true),
        task("C", null, null),
      ],
      [
        { id: "1", blockingTaskId: "A", dependentTaskId: "B", type: "FINISH_TO_START" },
        { id: "2", blockingTaskId: "A", dependentTaskId: "C", type: "FINISH_TO_START" },
      ]
    );
    const old = f.move("A", d("2026-09-05"), d("2026-09-06"));
    const shifts = await cascadeDependentDates(f.tx, "A", old);
    expect(shifts).toEqual([]);
    expect(day(f.get("B").startDate)).toBe("2026-09-03");
  });

  it("clamps a pull-back against the dependent's other blocker", async () => {
    const f = fakeTx(
      [
        task("A", "2026-09-01", "2026-09-05"),
        task("X", "2026-09-01", "2026-09-06"),
        task("B", "2026-09-07", "2026-09-08"),
      ],
      [
        { id: "1", blockingTaskId: "A", dependentTaskId: "B", type: "FINISH_TO_START" },
        { id: "2", blockingTaskId: "X", dependentTaskId: "B", type: "FINISH_TO_START" },
      ]
    );
    const old = f.move("A", d("2026-09-01"), d("2026-09-02"));
    await cascadeDependentDates(f.tx, "A", old);
    // A pulled back 3 days, but X still ends on the 6th.
    expect(day(f.get("B").startDate)).toBe("2026-09-06");
    expect(day(f.get("B").dueDate)).toBe("2026-09-07");
  });

  it("does not re-query edges for every visit of a long chain", async () => {
    const n = 40;
    const tasks = Array.from({ length: n }, (_, i) =>
      task(`T${i}`, `2026-10-${String((i % 28) + 1).padStart(2, "0")}`, null)
    );
    const edges: Edge[] = Array.from({ length: n - 1 }, (_, i) => ({
      id: `e${i}`,
      blockingTaskId: `T${i}`,
      dependentTaskId: `T${i + 1}`,
      type: "START_TO_START" as const,
    }));
    const f = fakeTx(tasks, edges);
    const old = f.move("T0", d("2026-10-05"), null);
    const shifts = await cascadeDependentDates(f.tx, "T0", old);
    expect(shifts).toHaveLength(n - 1);
    // 1 root read + per moved task: outgoing edges, incoming edges, update.
    expect(f.queries()).toBeLessThanOrEqual(1 + 3 * n);
  });
});

describe("cascadeFromDependency", () => {
  it("enforces a new FS edge forward-only and writes a UTC midnight", async () => {
    const f = fakeTx(
      [
        { ...task("A", null, null), dueDate: d("2026-09-10", "16:00:00") },
        task("B", "2026-09-08", "2026-09-09"),
      ],
      [{ id: "1", blockingTaskId: "A", dependentTaskId: "B", type: "FINISH_TO_START" }]
    );
    await cascadeFromDependency(f.tx, "1");
    expect(f.get("B").startDate!.toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(day(f.get("B").dueDate)).toBe("2026-09-11");
  });

  it("treats a same-day noon blocker as already satisfied", async () => {
    const f = fakeTx(
      [
        { ...task("A", null, null), dueDate: d("2026-09-10", "16:00:00") },
        task("B", "2026-09-10", "2026-09-11"),
      ],
      [{ id: "1", blockingTaskId: "A", dependentTaskId: "B", type: "FINISH_TO_START" }]
    );
    const shifts = await cascadeFromDependency(f.tx, "1");
    expect(shifts).toEqual([]);
  });
});
