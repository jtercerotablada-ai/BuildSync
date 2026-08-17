/**
 * The projection is the whole security boundary of the client link, and the
 * part of it that can be tested without a database is the SHAPE: which
 * columns the select names, and the pure decisions layered on top of them.
 * That is exactly the part that rots — someone adds a field to
 * `CLIENT_PROJECT_SELECT` while chasing a UI bug and a budget ends up on an
 * unauthenticated page.
 *
 * These tests import only constants and pure functions, so nothing here
 * touches Prisma (DATABASE_URL is blanked for the test run and points at
 * production).
 */

import { describe, it, expect } from "vitest";
import {
  CLIENT_PROJECT_SELECT,
  WITHHELD_FIELDS,
  toClientStatus,
  friendlySentence,
  computeProgress,
  computeRecertStages,
  gateCurrentStage,
  computeWhoHasTheBall,
  buildClientActivityFeed,
} from "./projection";

describe("CLIENT_PROJECT_SELECT", () => {
  it("contains none of the withheld fields", () => {
    const selected = Object.keys(CLIENT_PROJECT_SELECT);
    for (const forbidden of WITHHELD_FIELDS) {
      expect(
        selected,
        `${forbidden} must never be selectable on a client link`
      ).not.toContain(forbidden);
    }
  });

  it("is exactly the agreed field set — no more, no less", () => {
    // An exact match, not a subset check: a subset check would let a new
    // field in silently as long as it wasn't on the withheld list. Adding a
    // column to a client-visible page should require editing this line.
    expect(Object.keys(CLIENT_PROJECT_SELECT).sort()).toEqual(
      [
        "color",
        "endDate",
        "gate",
        "id",
        "location",
        "name",
        "projectNumber",
        "startDate",
        "status",
        "type",
      ].sort()
    );
  });

  it("selects every named column (no `false` entries)", () => {
    for (const [key, value] of Object.entries(CLIENT_PROJECT_SELECT)) {
      expect(value, `${key} should be selected with true`).toBe(true);
    }
  });

  it("is frozen, so a caller cannot widen the shared select", () => {
    expect(Object.isFrozen(CLIENT_PROJECT_SELECT)).toBe(true);
    expect(Object.isFrozen(WITHHELD_FIELDS)).toBe(true);
  });

  it("withholds the commercial and tenancy columns by name", () => {
    for (const f of [
      "budget",
      "currency",
      "notes",
      "workspaceId",
      "visibility",
      "clientName",
    ]) {
      expect(WITHHELD_FIELDS).toContain(f);
    }
  });
});

describe("status is now read but translated, never leaked raw", () => {
  // A deliberate reversal of the original "status is withheld" rule: the
  // column IS selected, but the raw enum is never emitted — it is collapsed
  // into a friendly label by toClientStatus before it can reach the view.
  it("selects status but does NOT list it as withheld", () => {
    expect(Object.keys(CLIENT_PROJECT_SELECT)).toContain("status");
    expect(WITHHELD_FIELDS).not.toContain("status");
  });

  it("never emits a raw ProjectStatus enum as the label", () => {
    const raw = ["ON_TRACK", "AT_RISK", "OFF_TRACK", "ON_HOLD", "COMPLETE"];
    for (const s of raw) {
      const badge = toClientStatus(s);
      expect(raw).not.toContain(badge.label);
      expect(badge.label).not.toMatch(/_/);
    }
  });

  it("collapses AT_RISK and OFF_TRACK to one identical neutral label", () => {
    // The client must never be able to tell the firm's two alarm states apart.
    expect(toClientStatus("AT_RISK")).toEqual(toClientStatus("OFF_TRACK"));
    expect(toClientStatus("AT_RISK")).toEqual({
      label: "In Progress",
      tone: "neutral",
    });
  });

  it("never says the alarming words 'Off Track' or 'risk'", () => {
    for (const s of ["ON_TRACK", "AT_RISK", "OFF_TRACK", "ON_HOLD", "COMPLETE"]) {
      const label = toClientStatus(s).label.toLowerCase();
      expect(label).not.toContain("off track");
      expect(label).not.toContain("risk");
    }
  });

  it("maps the friendly, non-alarming labels", () => {
    expect(toClientStatus("ON_TRACK")).toEqual({
      label: "On Track",
      tone: "positive",
    });
    expect(toClientStatus("COMPLETE")).toEqual({
      label: "Complete",
      tone: "positive",
    });
    expect(toClientStatus("ON_HOLD")).toEqual({
      label: "On Hold",
      tone: "neutral",
    });
  });

  it("falls back to a neutral label for anything unexpected", () => {
    expect(toClientStatus("SOME_FUTURE_ENUM")).toEqual({
      label: "In Progress",
      tone: "neutral",
    });
  });
});

describe("friendlySentence", () => {
  it("prefers the firm's own client paraphrase when present", () => {
    expect(friendlySentence("We poured the slab this week.", "neutral")).toBe(
      "We poured the slab this week."
    );
  });

  it("falls back to a tone-only sentence, never anything finer", () => {
    // Positive and neutral must be the ONLY two outcomes, so the sentence can
    // never betray the AT_RISK/OFF_TRACK collapse.
    expect(friendlySentence(null, "positive")).toMatch(/progressing as planned/);
    expect(friendlySentence(null, "neutral")).toMatch(/moving forward/);
  });

  it("treats a blank clientSummary as absent", () => {
    expect(friendlySentence("   ", "neutral")).toMatch(/moving forward/);
  });
});

describe("computeProgress", () => {
  it("is null for a project with no root tasks — never a bare 0%", () => {
    expect(computeProgress([])).toBeNull();
  });

  it("counts completed over total and rounds the percent", () => {
    // 11 of 23 → 47.8% → 48
    const tasks = Array.from({ length: 23 }, (_, i) => ({ completed: i < 11 }));
    expect(computeProgress(tasks)).toEqual({ done: 11, total: 23, percent: 48 });
  });

  it("is 100% only when everything is done", () => {
    expect(
      computeProgress([{ completed: true }, { completed: true }])
    ).toEqual({ done: 2, total: 2, percent: 100 });
  });
});

describe("computeRecertStages", () => {
  it("returns null when no canonical recert phase is present", () => {
    expect(
      computeRecertStages([{ name: "Some ad-hoc lane", tasks: [] }])
    ).toBeNull();
  });

  it("labels the canonical phases and drops internal lanes", () => {
    const result = computeRecertStages([
      { name: "Kickoff & scheduling", tasks: [{ completed: true }, { completed: false }] },
      { name: "Inspection & Reports", tasks: [{ completed: false }] },
      { name: "Building Official Review", tasks: [] },
      { name: "Repairs (if required)", tasks: [] },
      { name: "Recertification Complete", tasks: [] },
      // Internal field-inspection lanes — must NOT appear on the client rail.
      { name: "Performed", tasks: [{ completed: true }] },
      { name: "Report Issued", tasks: [{ completed: true }] },
    ]);
    expect(result).not.toBeNull();
    expect(result!.stages.map((s) => s.label)).toEqual([
      "Kickoff",
      "Inspection & Reports",
      "City Review",
      "Repairs",
      "Recertified",
    ]);
  });

  it("marks the first phase with an incomplete task as current", () => {
    const result = computeRecertStages([
      { name: "Kickoff & scheduling", tasks: [{ completed: true }, { completed: false }] },
      { name: "Inspection & Reports", tasks: [{ completed: false }] },
      { name: "Recertification Complete", tasks: [] },
    ]);
    expect(result!.stages.map((s) => s.state)).toEqual([
      "current",
      "upcoming",
      "upcoming",
    ]);
    expect(result!.currentStage).toEqual({ label: "Kickoff", subline: "Step 1 of 3" });
  });

  it("marks earlier fully-complete phases done and the next as current", () => {
    const result = computeRecertStages([
      { name: "Kickoff & scheduling", tasks: [{ completed: true }] },
      { name: "Inspection & Reports", tasks: [{ completed: true }, { completed: false }] },
      { name: "Recertification Complete", tasks: [{ completed: false }] },
    ]);
    expect(result!.stages.map((s) => s.state)).toEqual([
      "done",
      "current",
      "upcoming",
    ]);
    expect(result!.currentStage).toEqual({
      label: "Inspection & Reports",
      subline: "Step 2 of 3",
    });
  });

  it("marks every phase done and reports Complete when nothing is incomplete", () => {
    const result = computeRecertStages([
      { name: "Kickoff & scheduling", tasks: [{ completed: true }] },
      { name: "Recertification Complete", tasks: [{ completed: true }] },
    ]);
    expect(result!.stages.every((s) => s.state === "done")).toBe(true);
    expect(result!.currentStage).toEqual({ label: "Recertified", subline: "Complete" });
  });
});

describe("gateCurrentStage", () => {
  it("names the gate and its position for the non-recert fallback", () => {
    expect(gateCurrentStage("PERMITTING")).toEqual({
      label: "Permitting",
      subline: "Step 3 of 5",
    });
  });

  it("is null for a missing or unknown gate", () => {
    expect(gateCurrentStage(null)).toBeNull();
    expect(gateCurrentStage("NOT_A_GATE")).toBeNull();
  });
});

describe("computeWhoHasTheBall", () => {
  it("puts the ball on the client when an action item is theirs", () => {
    expect(
      computeWhoHasTheBall(2, "Owner submits reports to Building Official", "PRE_DESIGN")
    ).toEqual({ side: "CLIENT", reason: "Owner submits reports to Building Official" });
  });

  it("puts the ball on the firm with a STATIC per-gate reason otherwise", () => {
    expect(computeWhoHasTheBall(0, null, "DESIGN")).toEqual({
      side: "US",
      reason: "We're preparing your design documents.",
    });
  });

  it("never surfaces a live internal task name when the ball is on the firm", () => {
    // Even if a name is passed, zero client items means the reason is static.
    const ball = computeWhoHasTheBall(0, "Internal: chase senior PE seal", "CONSTRUCTION");
    expect(ball.side).toBe("US");
    expect(ball.reason).toBe("We're coordinating construction activities.");
  });

  it("falls back to a generic firm reason for an unknown gate", () => {
    expect(computeWhoHasTheBall(0, null, null).reason).toMatch(/moving your project forward/);
  });
});

describe("buildClientActivityFeed", () => {
  const d = (iso: string) => new Date(iso);

  it("names the firm as the actor and never an individual", () => {
    const feed = buildClientActivityFeed({
      updates: [{ id: "u1", createdAt: d("2026-08-01") }],
      milestones: [
        { id: "m1", name: "Field inspection complete", completed: true, completedAt: d("2026-08-05") },
      ],
      documents: [{ id: "f1", name: "Sealed report.pdf", createdAt: d("2026-08-03") }],
    });
    for (const e of feed) expect(e.actor).toBe("Tercero Tablada");
  });

  it("only lists COMPLETED milestones", () => {
    const feed = buildClientActivityFeed({
      updates: [],
      milestones: [
        { id: "m1", name: "Done thing", completed: true, completedAt: d("2026-08-05") },
        { id: "m2", name: "Not done", completed: false, completedAt: null },
        { id: "m3", name: "Done but no timestamp", completed: true, completedAt: null },
      ],
      documents: [],
    });
    expect(feed.map((e) => e.text)).toEqual(["Done thing completed"]);
  });

  it("merges the three sources newest-first and caps at eight", () => {
    const updates = Array.from({ length: 10 }, (_, i) => ({
      id: `u${i}`,
      createdAt: d(`2026-08-${String(i + 1).padStart(2, "0")}`),
    }));
    const feed = buildClientActivityFeed({ updates, milestones: [], documents: [] });
    expect(feed).toHaveLength(8);
    // Newest first: 2026-08-10 leads.
    expect(feed[0].at.getTime()).toBe(d("2026-08-10").getTime());
    expect(feed[0].at.getTime()).toBeGreaterThan(feed[1].at.getTime());
  });
});
