import { describe, expect, it } from "vitest";
import {
  firmTodayDateOnly,
  firmYear,
  nextProjectNumber,
  projectNumberPrefix,
} from "./project-number";

describe("nextProjectNumber", () => {
  const prefix = projectNumberPrefix(2026);

  it("starts at 001", () => {
    expect(nextProjectNumber([], prefix)).toBe("TT-2026-001");
  });

  it("follows the highest number, not the last string", () => {
    expect(
      nextProjectNumber(["TT-2026-999", "TT-2026-1000", "TT-2026-002"], prefix)
    ).toBe("TT-2026-1001");
  });

  it("ignores other years, nulls and junk", () => {
    expect(
      nextProjectNumber(
        ["TT-2025-040", null, "TT-2026-abc", "TT-2026-007"],
        prefix
      )
    ).toBe("TT-2026-008");
  });
});

describe("firm-zone day", () => {
  it("keeps Dec 31 evening in Miami in the old year", () => {
    // 2027-01-01T01:30Z is 20:30 on Dec 31 in Miami (EST, UTC-5).
    const now = new Date("2027-01-01T01:30:00Z");
    expect(firmYear(now)).toBe(2026);
    expect(firmTodayDateOnly(now).toISOString()).toBe(
      "2026-12-31T00:00:00.000Z"
    );
  });

  it("uses the Miami day during daylight time", () => {
    // 2026-09-22T01:00Z is 21:00 on Sep 21 in Miami (EDT, UTC-4).
    expect(
      firmTodayDateOnly(new Date("2026-09-22T01:00:00Z")).toISOString()
    ).toBe("2026-09-21T00:00:00.000Z");
  });
});
