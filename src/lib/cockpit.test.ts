import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  PIPELINE_ORDER,
  STALE_AFTER_DAYS,
  assembleOverdue,
  daysInStage,
  formatDwell,
  groupJobsByPipeline,
  holderTotals,
  isStale,
  missingDeadlineCount,
  pickPeUserIds,
  resolveCallerToday,
  resolveJobStage,
  unstagedJobs,
  upcomingDeadlines,
  waitingSubline,
  type CockpitJob,
} from "./cockpit";
import { buildCockpitScopes } from "./cockpit-scopes";
import { PIPELINES, type StageHolder } from "./pipelines";
import { TERMINAL_STAGE_KEYS } from "./regulatory";
import { taskPrivacyClause } from "./project-visibility";

/** Pure — no database (DATABASE_URL is blanked in vitest.config.ts). */

function job(overrides: Partial<CockpitJob> = {}): CockpitJob {
  return {
    id: overrides.id ?? "p1",
    name: "Job",
    projectNumber: null,
    color: "#000",
    type: "RECERTIFICATION",
    status: "ON_TRACK",
    clientName: null,
    location: null,
    latitude: null,
    longitude: null,
    owner: null,
    stage: "recert.field_work",
    pipelineId: "recert",
    stageLabel: "Field Work",
    stageIndex: 1,
    stageCount: 11,
    holder: "FIRM",
    stageEnteredAt: null,
    daysInStage: null,
    staleAfterDays: 10,
    stale: false,
    blocker: null,
    regulatoryDeadline: null,
    jurisdiction: null,
    permitNumber: null,
    caseNumber: null,
    folioNumber: null,
    openTasks: 0,
    overdueTasks: 0,
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("daysInStage", () => {
  const now = new Date("2026-09-21T12:00:00Z");
  it("null or invalid input is null", () => {
    expect(daysInStage(null, now)).toBeNull();
    expect(daysInStage(undefined, now)).toBeNull();
    expect(daysInStage("not a date", now)).toBeNull();
  });
  it("floors: 36 hours is 1 day", () => {
    expect(daysInStage(new Date(now.getTime() - 36 * 3600 * 1000), now)).toBe(1);
  });
  it("a future arrival clamps to 0", () => {
    expect(daysInStage("2026-09-25T00:00:00Z", now)).toBe(0);
  });
});

describe("isStale", () => {
  it("applies the holder's limit", () => {
    expect(isStale("FIRM", 9)).toBe(false);
    expect(isStale("FIRM", 10)).toBe(true);
    expect(isStale("PE", 3)).toBe(true);
  });
  it("NONE, a null holder or null days are never stale", () => {
    expect(isStale("NONE", 500)).toBe(false);
    expect(isStale(null, 500)).toBe(false);
    expect(isStale("FIRM", null)).toBe(false);
  });
  it("every non-NONE holder has a positive limit", () => {
    for (const [holder, limit] of Object.entries(STALE_AFTER_DAYS)) {
      if (holder === "NONE") expect(limit).toBeNull();
      else expect(limit).toBeGreaterThan(0);
    }
  });
});

describe("formatDwell", () => {
  it("formats", () => {
    expect(formatDwell(0)).toBe("today");
    expect(formatDwell(1)).toBe("1 day");
    expect(formatDwell(5)).toBe("5 days");
    expect(formatDwell(null)).toBeNull();
  });
});

describe("resolveJobStage", () => {
  it("no type → no pipeline", () => {
    expect(resolveJobStage(null, "recert.draft").pipelineId).toBeNull();
  });
  it("a stage from another pipeline → the type's pipeline with null stage fields", () => {
    const r = resolveJobStage("RECERTIFICATION", "design.awaiting_pe");
    expect(r.pipelineId).toBe("recert");
    expect(r.stageKey).toBeNull();
    expect(r.stageLabel).toBeNull();
    expect(r.stageIndex).toBeNull();
    expect(r.holder).toBeNull();
    expect(r.stageCount).toBe(11);
  });
  it("BSIP runs the recert stages", () => {
    const r = resolveJobStage("BSIP", "recert.awaiting_pe");
    expect(r.pipelineId).toBe("recert");
    expect(r.holder).toBe("PE");
    expect(r.stageCount).toBe(11);
    expect(r.terminal).toBe(false);
  });
  it("the terminal stage is terminal", () => {
    expect(resolveJobStage("RECERTIFICATION", "recert.recertified").terminal).toBe(true);
  });
});

describe("pickPeUserIds", () => {
  const u = (id: string, position: string | null = null) => ({ id, name: id, image: null, position });
  const granted = new Date("2026-09-01T00:00:00.000Z");
  it("the OWNER may seal implicitly", () => {
    expect(
      pickPeUserIds([
        { role: "OWNER", user: u("owner") },
        { role: "MEMBER", user: u("m1", "DRAFTER") },
      ])
    ).toEqual(["owner"]);
  });
  it("a seat granted seal authority is a PE, whatever its position", () => {
    expect(
      pickPeUserIds([
        { role: "OWNER", user: u("owner") },
        { role: "MEMBER", sealAuthorizedAt: granted, user: u("eng", "DRAFTER") },
      ])
    ).toEqual(["owner", "eng"]);
  });
  it("a stamping Position alone is NOT seal authority", () => {
    expect(
      pickPeUserIds([
        { role: "OWNER", user: u("owner") },
        { role: "ADMIN", user: u("admin", "PROJECT_ENGINEER") },
      ])
    ).toEqual(["owner"]);
  });
  it("never a GUEST or CLIENT seat, even when granted", () => {
    expect(
      pickPeUserIds([
        { role: "GUEST", sealAuthorizedAt: granted, user: u("g", "PROJECT_ENGINEER") },
        { role: "CLIENT", sealAuthorizedAt: granted, user: u("c", "PRINCIPAL_ENGINEER") },
        { role: "OWNER", user: u("o") },
      ])
    ).toEqual(["o"]);
  });
  it("empty → []", () => {
    expect(pickPeUserIds([])).toEqual([]);
  });
  it("has no duplicates", () => {
    expect(
      pickPeUserIds([
        { role: "OWNER", user: u("pe") },
        { role: "ADMIN", sealAuthorizedAt: granted, user: u("pe") },
      ])
    ).toEqual(["pe"]);
  });
});

describe("buildCockpitScopes", () => {
  const clause: Prisma.ProjectWhereInput = {
    workspaceId: "ws",
    OR: [{ ownerId: "u" }, { visibility: { in: ["WORKSPACE", "PUBLIC"] } }],
  };
  const { projectWhere, taskScope, finishedWhere } = buildCockpitScopes(clause, "u");
  const and = projectWhere.AND as Prisma.ProjectWhereInput[];

  it("ANDs the caller clause untouched with the active-job rule", () => {
    expect(and).toContain(clause);
    expect(and[0]).toBe(clause);
    expect(and).toContainEqual({ isArchived: false });
    expect(and).toContainEqual({ status: { not: "COMPLETE" } });
    const stageArm = and.find((c) => c.OR && c !== clause)!;
    expect(stageArm.OR).toContainEqual({ stage: null });
    const notIn = (stageArm.OR as Prisma.ProjectWhereInput[]).find(
      (c) => typeof c.stage === "object" && c.stage !== null
    )!.stage as { notIn: string[] };
    expect([...notIn.notIn].sort()).toEqual([...TERMINAL_STAGE_KEYS].sort());
  });
  it("keeps the caller's OR intact and never spreads an OR at the top level", () => {
    expect(clause.OR).toHaveLength(2);
    expect((projectWhere as Record<string, unknown>).OR).toBeUndefined();
  });
  it("task scope = project scope + privacy + top-level only", () => {
    const tAnd = taskScope.AND as Prisma.TaskWhereInput[];
    expect(tAnd).toContainEqual({ project: projectWhere });
    expect(tAnd).toContainEqual(taskPrivacyClause("u"));
    expect(tAnd).toContainEqual({ parentTaskId: null });
  });
  it("finishedWhere reads the terminal stages with `in`", () => {
    const since = new Date("2026-08-22T00:00:00Z");
    const f = finishedWhere(since).AND as Prisma.ProjectWhereInput[];
    expect(f[0]).toBe(clause);
    expect(f).toContainEqual({ stage: { in: [...TERMINAL_STAGE_KEYS] } });
    expect(f).toContainEqual({ stageEnteredAt: { gte: since } });
    expect(f).toContainEqual({ isArchived: false });
  });
});

describe("resolveCallerToday", () => {
  // 21:00 EDT on Sep 21 is already Sep 22 in UTC.
  const now = new Date("2026-09-22T01:00:00Z");
  it("trusts the caller's calendar day, so a task due today is not overdue", () => {
    const today = resolveCallerToday("2026-09-21", now);
    expect(today.toISOString()).toBe("2026-09-21T00:00:00.000Z");
    const due = new Date("2026-09-21T00:00:00Z");
    expect(due < today).toBe(false);
    // Documents the bug the param fixes: the UTC fallback calls it overdue.
    const utcFallback = resolveCallerToday(undefined, now);
    expect(utcFallback.toISOString()).toBe("2026-09-22T00:00:00.000Z");
    expect(due < utcFallback).toBe(true);
  });
  it("a value 3 days away, or garbage, falls back to the UTC day", () => {
    expect(resolveCallerToday("2026-09-25", now).toISOString()).toBe(
      "2026-09-22T00:00:00.000Z"
    );
    expect(resolveCallerToday("tomorrow", now).toISOString()).toBe(
      "2026-09-22T00:00:00.000Z"
    );
    expect(resolveCallerToday("2026-13-45", now).toISOString()).toBe(
      "2026-09-22T00:00:00.000Z"
    );
  });
});

describe("groupJobsByPipeline", () => {
  const jobs = [
    job({ id: "a", stageIndex: 3, daysInStage: 2, holder: "PE" }),
    job({ id: "b", stageIndex: 1, daysInStage: null }),
    job({ id: "c", stageIndex: 1, daysInStage: 8, stale: true }),
    job({ id: "d", stageIndex: null, holder: null, stage: null, stageLabel: null }),
    job({ id: "e", type: "BSIP", stageIndex: 1, daysInStage: 3 }),
    job({ id: "f", type: "PERMIT", pipelineId: "permit", stageIndex: 0, stageCount: 7 }),
    job({ id: "g", type: null, pipelineId: null, stageIndex: null, holder: null, stageCount: 0 }),
  ];
  const groups = groupJobsByPipeline(jobs);

  it("always four groups, in order", () => {
    expect(groups.map((g) => g.pipelineId)).toEqual([
      "recert",
      "design",
      "permit",
      "construction",
    ]);
  });
  it("BSIP lands in recert; no-stage first; stage order then longest wait, nulls last", () => {
    expect(groups[0].jobs.map((j) => j.id)).toEqual(["d", "c", "e", "b", "a"]);
  });
  it("counts", () => {
    expect(groups[0].count).toBe(5);
    expect(groups[0].staleCount).toBe(1);
    expect(groups[0].noStageCount).toBe(1);
    expect(groups[1].count).toBe(0);
    expect(groups[2].count).toBe(1);
  });
  it("typeless jobs are unstaged", () => {
    expect(unstagedJobs(jobs).map((j) => j.id)).toEqual(["g"]);
  });
});

describe("holderTotals & waitingSubline", () => {
  const holders: (StageHolder | null)[] = [
    "FIRM",
    "FIRM",
    "PE",
    "CLIENT",
    "CITY",
    "ARCHITECT",
    "NONE",
    null,
    null,
  ];
  const totals = holderTotals(holders.map((holder) => ({ holder })));

  it("ours = FIRM + PE; NONE and null excluded", () => {
    expect(totals.ours).toBe(3);
    expect(totals.others).toBe(3);
    expect(totals.byHolder.NONE).toBeUndefined();
  });
  it("ours + others = staged jobs whose holder is not NONE", () => {
    const staged = holders.filter((h) => h && h !== "NONE").length;
    expect(totals.ours + totals.others).toBe(staged);
  });
  it("unstaged is counted", () => {
    expect(totals.unstaged).toBe(2);
  });
  it("unstaged splits into typeless and per-pipeline no-stage", () => {
    const t = holderTotals([
      { holder: null, pipelineId: null },
      { holder: null, pipelineId: "permit" },
      { holder: null, pipelineId: "permit" },
      { holder: null, pipelineId: "recert" },
      { holder: "FIRM", pipelineId: "permit" },
    ]);
    expect(t.unstaged).toBe(4);
    expect(t.untyped).toBe(1);
    expect(t.noStageByPipeline).toEqual({ permit: 2, recert: 1 });
  });
  it("waitingSubline lists only non-zero holders", () => {
    expect(waitingSubline(totals.byHolder)).toBe("Client 1 · Architect 1 · City 1");
    expect(waitingSubline({ CLIENT: 3, CITY: 0, CONTRACTOR: 0 })).toBe("Client 3");
    expect(waitingSubline({})).toBe("");
  });
});

describe("upcomingDeadlines", () => {
  const today = new Date(2026, 8, 21);
  const jobs = [
    job({ id: "none", regulatoryDeadline: null }),
    job({ id: "soon", regulatoryDeadline: "2026-09-30" }),
    job({ id: "past", regulatoryDeadline: "2026-09-18" }),
    job({ id: "far", regulatoryDeadline: "2027-03-01" }),
    job({
      id: "construction",
      type: "CONSTRUCTION",
      stage: "construction.under_construction",
      regulatoryDeadline: "2026-10-10",
    }),
    job({ id: "design", type: "DESIGN", stage: "design.design_work", regulatoryDeadline: "2026-10-01" }),
    job({ id: "complete", status: "COMPLETE", regulatoryDeadline: "2026-09-25" }),
    job({ id: "closed", stage: "recert.recertified", regulatoryDeadline: "2026-09-25" }),
  ];
  const rows = upcomingDeadlines(jobs, today);
  const ids = rows.map((r) => r.job.id);

  it("skips null, far and not-live deadlines; keeps past ones", () => {
    expect(ids).toEqual(["past", "soon", "design", "construction"]);
  });
  it("counts calendar days from the viewer's day", () => {
    expect(rows.find((r) => r.job.id === "soon")!.daysOut).toBe(9);
    expect(rows.find((r) => r.job.id === "past")!.daysOut).toBe(-3);
  });
  it("rows carry the shared bucket", () => {
    expect(rows[0].bucket).toBe("overdue");
    expect(rows.find((r) => r.job.id === "soon")!.bucket).toBe("30d");
  });
  it("the horizon cuts off later dates", () => {
    expect(upcomingDeadlines(jobs, today, 9).map((r) => r.job.id)).toEqual([
      "past",
      "soon",
    ]);
  });
});

describe("missingDeadlineCount", () => {
  it("counts only live recert / BSIP / permit jobs with no deadline", () => {
    expect(
      missingDeadlineCount([
        job({ type: "RECERTIFICATION" }),
        job({ type: "BSIP" }),
        job({ type: "PERMIT", stage: "permit.preparing_submittal" }),
        job({ type: "DESIGN", stage: "design.design_work" }),
        job({ type: "CONSTRUCTION", stage: "construction.draft" }),
        job({ type: "RECERTIFICATION", regulatoryDeadline: "2026-10-01" }),
        job({ type: "RECERTIFICATION", status: "COMPLETE" }),
        job({ type: null }),
      ])
    ).toBe(3);
  });
});

describe("assembleOverdue", () => {
  const members = [
    { role: "OWNER", user: { id: "juan", name: "Juan" } },
    { role: "MEMBER", user: { id: "ana", name: "Ana" } },
    { role: "MEMBER", user: { id: "zoe", name: "Zoe" } },
    { role: "GUEST", user: { id: "guest", name: "Guest" } },
  ];
  const groups = [
    { assigneeId: "ana", count: 4, oldestDueDate: new Date("2026-09-01T00:00:00Z") },
    { assigneeId: "juan", count: 1, oldestDueDate: new Date("2026-09-10T00:00:00Z") },
    { assigneeId: null, count: 2, oldestDueDate: null },
    { assigneeId: "former", count: 3, oldestDueDate: null },
    { assigneeId: "guest", count: 5, oldestDueDate: null },
  ];
  const r = assembleOverdue(groups, members);

  it("adds up", () => {
    const sum = r.people.reduce((s, p) => s + p.count, 0) + r.unassigned + r.others;
    expect(r.totalCount).toBe(15);
    expect(sum).toBe(r.totalCount);
  });
  it("former members and GUEST/CLIENT seats go to others", () => {
    expect(r.others).toBe(8);
    expect(r.people.map((p) => p.user.id)).not.toContain("guest");
  });
  it("every contributor appears, zero included, biggest first", () => {
    expect(r.people.map((p) => [p.user.id, p.count])).toEqual([
      ["ana", 4],
      ["juan", 1],
      ["zoe", 0],
    ]);
    expect(r.people[0].oldestDueDate).toBe("2026-09-01T00:00:00.000Z");
    expect(r.unassigned).toBe(2);
  });
});

describe("PIPELINE_ORDER", () => {
  it("covers exactly the registry's pipelines", () => {
    expect([...PIPELINE_ORDER].sort()).toEqual(Object.keys(PIPELINES).sort());
  });
});
