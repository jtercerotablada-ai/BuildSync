import { describe, expect, it } from "vitest";
import type { ProjectType } from "@prisma/client";
import { resolveStage } from "@/lib/pipelines";
import {
  DEADLINE_DORMANT_STAGE_KEYS,
  SOUTH_FLORIDA_AHJS,
  SUBMITTED_STAGE_KEYS,
  TERMINAL_STAGE_KEYS,
  deadlineBucket,
  deadlineCopyFor,
  deadlineState,
  formatDaysOut,
  isDeadlineLive,
  isValidEmail,
  isValidPhone,
  jurisdictionKey,
  normalizeJurisdiction,
  referenceFieldsFor,
  regulatoryFieldsForDuplicate,
} from "@/lib/regulatory";

describe("deadlineBucket", () => {
  it.each([
    [61, "later"],
    [60, "60d"],
    [31, "60d"],
    [30, "30d"],
    [8, "30d"],
    [7, "7d"],
    [1, "7d"],
    [0, "today"],
    [-1, "overdue"],
  ] as const)("%i -> %s", (n, bucket) => {
    expect(deadlineBucket(n)).toBe(bucket);
  });
});

describe("stage sets", () => {
  it("TERMINAL_STAGE_KEYS is exactly the four terminal stages", () => {
    expect([...TERMINAL_STAGE_KEYS].sort()).toEqual(
      [
        "recert.recertified",
        "design.permit_issued",
        "permit.permit_issued",
        "construction.closed_out",
      ].sort()
    );
    for (const k of TERMINAL_STAGE_KEYS) {
      expect(resolveStage(k)?.stage.terminal).toBe(true);
    }
  });

  it("SUBMITTED_STAGE_KEYS exist and are held by the city", () => {
    for (const k of SUBMITTED_STAGE_KEYS) {
      const r = resolveStage(k);
      expect(r).not.toBeNull();
      expect(r?.stage.holder).toBe("CITY");
    }
  });

  it("dormant = terminal + submitted", () => {
    expect([...DEADLINE_DORMANT_STAGE_KEYS].sort()).toEqual(
      [...TERMINAL_STAGE_KEYS, ...SUBMITTED_STAGE_KEYS].sort()
    );
  });
});

describe("deadlineState", () => {
  const base = { isArchived: false, status: "ON_TRACK", stage: null as string | null };
  it.each([
    [{ ...base, isArchived: true }, "archived"],
    [{ ...base, status: "COMPLETE" }, "complete"],
    [{ ...base, stage: "recert.recertified" }, "closed"],
    [{ ...base, stage: "recert.submitted_to_city" }, "submitted"],
    [{ ...base, stage: "design.submitted_to_city" }, "submitted"],
    [{ ...base, stage: "recert.city_comments" }, "live"],
    [{ ...base, stage: "design.city_comments" }, "live"],
    [{ ...base, stage: "permit.submitted_to_city" }, "live"],
    [{ ...base, stage: "construction.submitted_to_city" }, "live"],
    [base, "live"],
  ] as const)("%o -> %s", (p, state) => {
    expect(deadlineState(p)).toBe(state);
    expect(isDeadlineLive(p)).toBe(state === "live");
  });

  it("archived wins over complete", () => {
    expect(
      deadlineState({ isArchived: true, status: "COMPLETE", stage: null })
    ).toBe("archived");
  });
});

describe("deadlineCopyFor", () => {
  const types: (ProjectType | null)[] = [
    "RECERTIFICATION",
    "BSIP",
    "PERMIT",
    "CONSTRUCTION",
    "DESIGN",
    null,
  ];
  it.each(types)("%s has non-empty copy", (t) => {
    const c = deadlineCopyFor(t);
    expect(c.label.length).toBeGreaterThan(0);
    expect(c.short.length).toBeGreaterThan(0);
    expect(c.help.length).toBeGreaterThan(0);
  });
  it("labels per type", () => {
    expect(deadlineCopyFor("RECERTIFICATION").label).toBe(
      "Recertification report due"
    );
    expect(deadlineCopyFor("CONSTRUCTION").label).toBe("Permit expires");
    expect(deadlineCopyFor(null).short).toBe("Deadline");
  });
});

describe("formatDaysOut", () => {
  it.each([
    [0, "Today"],
    [1, "Tomorrow"],
    [5, "in 5 days"],
    [-1, "1 day ago"],
    [-3, "3 days ago"],
  ] as const)("%i -> %s", (n, s) => {
    expect(formatDaysOut(n)).toBe(s);
  });
});

describe("AHJ list", () => {
  it("is unique and includes the counties", () => {
    expect(new Set(SOUTH_FLORIDA_AHJS).size).toBe(SOUTH_FLORIDA_AHJS.length);
    expect(SOUTH_FLORIDA_AHJS).toContain("Miami-Dade County");
    expect(SOUTH_FLORIDA_AHJS).toContain("Broward County");
  });
});

describe("regulatoryFieldsForDuplicate", () => {
  it("copies exactly jurisdiction + contact", () => {
    const src = {
      jurisdiction: "City of Hialeah",
      clientContactName: "Ana",
      clientContactEmail: "a@b.co",
      clientContactPhone: "305 555 0142",
      folioNumber: "01-1",
      permitNumber: "BD25",
      caseNumber: "RC-1",
      regulatoryDeadline: new Date(),
    };
    const out = regulatoryFieldsForDuplicate(src);
    expect(Object.keys(out).sort()).toEqual(
      [
        "clientContactEmail",
        "clientContactName",
        "clientContactPhone",
        "jurisdiction",
      ].sort()
    );
    expect(out.jurisdiction).toBe("City of Hialeah");
  });
});

describe("referenceFieldsFor", () => {
  it("recert/BSIP get the case number", () => {
    expect(referenceFieldsFor("RECERTIFICATION")).toEqual([
      "folioNumber",
      "caseNumber",
      "permitNumber",
    ]);
    expect(referenceFieldsFor("BSIP")).toContain("caseNumber");
    expect(referenceFieldsFor("DESIGN")).toEqual(["folioNumber", "permitNumber"]);
    expect(referenceFieldsFor(null)).toEqual(["folioNumber", "permitNumber"]);
  });
});

describe("contact validation", () => {
  it.each([
    ["ana@firm.com", true],
    ["  ana@firm.com ", true],
    ["ana@firm", false],
    ["ana firm.com", false],
    ["", false],
  ] as const)("email %s -> %s", (s, ok) => {
    expect(isValidEmail(s)).toBe(ok);
  });
  it.each([
    ["(305) 555-0142", true],
    ["+1 305 555 0142 ext 12", true],
    ["555-0142", true],
    ["555-014", false],
    ["305-555-0142!", false],
    ["call me", false],
  ] as const)("phone %s -> %s", (s, ok) => {
    expect(isValidPhone(s)).toBe(ok);
  });
});

describe("jurisdiction text", () => {
  it("normalizes and groups case variants", () => {
    expect(normalizeJurisdiction("  City   of  Hialeah ")).toBe("City of Hialeah");
    expect(jurisdictionKey("City of Hialeah")).toBe(
      jurisdictionKey(" city  of hialeah ")
    );
  });
});
