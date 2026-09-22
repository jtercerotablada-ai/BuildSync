import { describe, expect, it } from "vitest";
import { computePmiSnapshot, type ProjectMinimal } from "./pmi-metrics";

const NOW = new Date("2026-09-21T12:00:00Z");

function project(overrides: Partial<ProjectMinimal> = {}): ProjectMinimal {
  return {
    startDate: "2026-06-01T00:00:00Z",
    endDate: "2026-09-30T00:00:00Z",
    budget: 40000,
    status: "ON_TRACK",
    taskCount: 12,
    completedTaskCount: 0,
    ...overrides,
  };
}

describe("computePmiSnapshot health", () => {
  it("flags a late project with zero progress as off track", () => {
    expect(computePmiSnapshot(project(), NOW).health).toBe("OFF_TRACK");
  });

  it("judges schedule without a budget", () => {
    const snap = computePmiSnapshot(project({ budget: null }), NOW);
    expect(snap.health).toBe("OFF_TRACK");
    expect(snap.spi).toBe(0);
  });

  it("reads on track when progress keeps pace, with or without a budget", () => {
    // ~93% of the schedule elapsed, 12/12 done.
    const done = { completedTaskCount: 12 };
    expect(computePmiSnapshot(project(done), NOW).health).toBe("ON_TRACK");
    expect(computePmiSnapshot(project({ ...done, budget: null }), NOW).health).toBe("ON_TRACK");
  });

  it("does not judge a project in the first 10% of its schedule", () => {
    const early = new Date("2026-06-05T00:00:00Z");
    expect(computePmiSnapshot(project(), early).health).toBe("ON_TRACK");
  });

  it("does not judge schedule for a project with no tasks", () => {
    expect(computePmiSnapshot(project({ taskCount: 0 }), NOW).health).toBe("ON_TRACK");
  });

  it("does not judge schedule for a project with no dates", () => {
    const snap = computePmiSnapshot(project({ startDate: null, endDate: null }), NOW);
    expect(snap.health).toBe("ON_TRACK");
  });

  it("ignores the assumed CPI when actual cost is not tracked", () => {
    const snap = computePmiSnapshot(project({ completedTaskCount: 12 }), NOW);
    expect(snap.cpi).toBe(1);
    expect(snap.health).toBe("ON_TRACK");
  });

  it("uses a tracked actual cost", () => {
    // EV = 40000 (all done), AC = 80000 -> CPI 0.5.
    const snap = computePmiSnapshot(project({ completedTaskCount: 12, actualCost: 80000 }), NOW);
    expect(snap.health).toBe("OFF_TRACK");
  });

  it("reads a delivered project past its end date as on track", () => {
    const snap = computePmiSnapshot(
      project({
        status: "COMPLETE",
        budget: null,
        endDate: "2026-09-01T00:00:00Z",
        completedTaskCount: 6,
      }),
      NOW
    );
    expect(snap.health).toBe("ON_TRACK");
  });

  it("does not judge schedule for a project on hold", () => {
    const snap = computePmiSnapshot(
      project({
        status: "ON_HOLD",
        budget: null,
        endDate: "2026-09-01T00:00:00Z",
        completedTaskCount: 6,
      }),
      NOW
    );
    expect(snap.health).not.toBe("OFF_TRACK");
    expect(snap.health).toBe("ON_TRACK");
  });

  it("still honours a manual OFF_TRACK status", () => {
    const snap = computePmiSnapshot(project({ completedTaskCount: 12, status: "OFF_TRACK" }), NOW);
    expect(snap.health).toBe("OFF_TRACK");
  });
});
