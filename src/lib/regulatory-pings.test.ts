import { describe, expect, it } from "vitest";
import {
  planDeadlinePings,
  projectDueKey,
  seenKey,
  type DeadlinePingProject,
} from "@/lib/regulatory-pings";

const TODAY = new Date("2026-09-21T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function project(
  offsetDays: number,
  over: Partial<DeadlinePingProject> = {}
): DeadlinePingProject {
  return {
    id: `p${offsetDays}`,
    name: "Brickell Tower",
    type: "RECERTIFICATION",
    stage: null,
    status: "ON_TRACK",
    isArchived: false,
    jurisdiction: null,
    regulatoryDeadline: new Date(TODAY.getTime() + offsetDays * DAY),
    ...over,
  };
}

function plan(
  projects: DeadlinePingProject[],
  eligible: Record<string, string[]> = {},
  seen: Set<string> = new Set()
) {
  const map = new Map<string, string[]>();
  for (const p of projects) map.set(p.id, eligible[p.id] ?? ["juan"]);
  return planDeadlinePings({
    projects,
    todayUtc: TODAY,
    eligibleUserIdsByProject: map,
    seen,
  });
}

describe("planDeadlinePings buckets", () => {
  it.each([
    [60, "60d"],
    [45, "60d"],
    [30, "30d"],
    [7, "7d"],
    [0, "today"],
    [-1, "overdue"],
    [-14, "overdue"],
  ] as const)("+%i -> %s", (offset, bucket) => {
    const { pings } = plan([project(offset)]);
    expect(pings).toHaveLength(1);
    expect(pings[0].bucket).toBe(bucket);
  });

  it.each([-15, 61, 90])("%i -> nothing", (offset) => {
    expect(plan([project(offset)]).pings).toHaveLength(0);
  });
});

describe("liveness", () => {
  it.each([
    { stage: "recert.recertified" },
    { stage: "recert.submitted_to_city" },
    { isArchived: true },
    { status: "COMPLETE" },
  ])("%o -> nothing", (over) => {
    expect(plan([project(30, over)]).pings).toHaveLength(0);
  });

  it("city comments re-arms", () => {
    expect(
      plan([project(30, { stage: "recert.city_comments" })]).pings
    ).toHaveLength(1);
  });

  it("no deadline -> nothing", () => {
    expect(
      plan([project(30, { regulatoryDeadline: null })]).pings
    ).toHaveLength(0);
  });
});

describe("recipients & dedupe", () => {
  it("owner who is also a member is pinged once", () => {
    const p = project(30, { id: "a" });
    const { pings } = plan([p], { a: ["juan", "juan", "maria"] });
    expect(pings.map((x) => x.userId).sort()).toEqual(["juan", "maria"]);
  });

  it("only the eligible users the route passes are pinged", () => {
    const p = project(30, { id: "a" });
    const { pings } = plan([p], { a: ["maria"] });
    expect(pings.map((x) => x.userId)).toEqual(["maria"]);
  });

  it("one recipient already seen does not suppress the other", () => {
    const p = project(30, { id: "a" });
    const key = projectDueKey("a", p.regulatoryDeadline!, "30d");
    const { pings } = plan(
      [p],
      { a: ["juan", "maria"] },
      new Set([seenKey("juan", key)])
    );
    expect(pings.map((x) => x.userId)).toEqual(["maria"]);
  });

  it("a second run with everything seen creates nothing", () => {
    const p = project(30, { id: "a" });
    const first = plan([p], { a: ["juan", "maria"] });
    const seen = new Set(first.pings.map((x) => seenKey(x.userId, x.dueKey)));
    expect(plan([p], { a: ["juan", "maria"] }, seen).pings).toHaveLength(0);
  });

  it("a moved deadline re-arms", () => {
    const old = project(30, { id: "a" });
    const oldKey = projectDueKey("a", old.regulatoryDeadline!, "30d");
    const moved = project(29, { id: "a" });
    const { pings } = plan(
      [moved],
      { a: ["juan"] },
      new Set([seenKey("juan", oldKey)])
    );
    expect(pings).toHaveLength(1);
    expect(pings[0].dueKey).not.toBe(oldKey);
  });

  it("lists projects with no eligible recipients", () => {
    const p = project(30, { id: "lonely" });
    const r = plan([p], { lonely: [] });
    expect(r.pings).toHaveLength(0);
    expect(r.noRecipientProjectIds).toEqual(["lonely"]);
  });

  it("dueKey shape", () => {
    expect(
      projectDueKey("a", new Date("2026-12-15T00:00:00.000Z"), "7d")
    ).toBe("project:a|2026-12-15|7d");
    expect(seenKey("u", "k")).toBe("u::k");
  });
});

describe("copy", () => {
  it("threshold ping with jurisdiction and holder suffix", () => {
    const deadline = new Date("2026-12-15T00:00:00.000Z");
    const offset = Math.round((deadline.getTime() - TODAY.getTime()) / DAY);
    const p = project(offset, {
      jurisdiction: "City of Hialeah",
      stage: "recert.submitted_to_client",
    });
    // 85 days out is outside the window; plan from 60 days before instead.
    const { pings } = planDeadlinePings({
      projects: [p],
      todayUtc: new Date(deadline.getTime() - 30 * DAY),
      eligibleUserIdsByProject: new Map([[p.id, ["juan"]]]),
      seen: new Set(),
    });
    expect(pings[0].title).toBe("Recert report due in 30 days: Brickell Tower");
    expect(pings[0].message).toBe(
      "Recert report due on Dec 15, 2026 (City of Hialeah) — on the client's desk."
    );
  });

  it("threshold ping without jurisdiction or stage", () => {
    const { pings } = plan([project(7)]);
    expect(pings[0].title).toBe("Recert report due in 7 days: Brickell Tower");
    expect(pings[0].message).toBe("Recert report due on Sep 28, 2026.");
  });

  it("one day out reads '1 day'", () => {
    const { pings } = plan([project(1)]);
    expect(pings[0].title).toBe("Recert report due in 1 day: Brickell Tower");
  });

  it("today ping", () => {
    const { pings } = plan([project(0, { jurisdiction: "City of Miami" })]);
    expect(pings[0].title).toBe("Recert report due today: Brickell Tower");
    expect(pings[0].message).toBe(
      "Recert report due today, Sep 21, 2026 (City of Miami)."
    );
  });

  it("overdue ping", () => {
    const { pings } = plan([
      project(-1, { stage: "recert.field_work", type: "BSIP" }),
    ]);
    expect(pings[0].title).toBe("Deadline passed: Brickell Tower");
    expect(pings[0].message).toBe(
      "BSIP report due was Sep 20, 2026 and the job is still open — on our desk."
    );
  });

  it("data carries the project and the kind, never a taskId", () => {
    const { pings } = plan([project(30, { id: "a" })]);
    expect(pings[0].data).toMatchObject({
      projectId: "a",
      projectName: "Brickell Tower",
      kind: "regulatory-deadline",
      bucket: "30d",
      regulatoryDeadline: "2026-10-21T00:00:00.000Z",
    });
    expect("taskId" in pings[0].data).toBe(false);
  });
});
