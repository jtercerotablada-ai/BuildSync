import { describe, it, expect } from "vitest";
import {
  currentQuarterPeriod,
  goalPeriodOptions,
  goalPeriodRange,
  goalPeriodRank,
  formatGoalPeriodRange,
} from "./types";

describe("goal periods", () => {
  it("defaults to the quarter today falls in", () => {
    expect(currentQuarterPeriod(new Date(2026, 8, 21))).toBe("Q3 FY26");
    expect(currentQuarterPeriod(new Date(2027, 0, 2))).toBe("Q1 FY27");
    expect(currentQuarterPeriod(new Date(2026, 11, 31))).toBe("Q4 FY26");
  });

  it("offers last, this and next fiscal year in picker order", () => {
    const opts = goalPeriodOptions(new Date(2026, 8, 21));
    expect(opts).toHaveLength(21);
    expect(opts.slice(7, 14)).toEqual([
      "Q1 FY26",
      "Q2 FY26",
      "Q3 FY26",
      "Q4 FY26",
      "H1 FY26",
      "H2 FY26",
      "FY26",
    ]);
    expect(opts[0]).toBe("Q1 FY25");
    expect(opts[20]).toBe("FY27");
  });

  it("keeps an extra label in use and ignores duplicates", () => {
    const opts = goalPeriodOptions(new Date(2026, 8, 21), {
      extra: ["Q2 FY22", "Q3 FY26", "Custom", null],
    });
    expect(opts[0]).toBe("Q2 FY22");
    expect(opts[opts.length - 1]).toBe("Custom");
    expect(opts.filter((p) => p === "Q3 FY26")).toHaveLength(1);
  });

  it("maps a period to its calendar range", () => {
    const q3 = goalPeriodRange("Q3 FY26")!;
    expect([q3.start.getMonth(), q3.start.getDate()]).toEqual([6, 1]);
    expect([q3.end.getMonth(), q3.end.getDate()]).toEqual([8, 30]);
    const h2 = goalPeriodRange("H2 FY26")!;
    expect([h2.start.getMonth(), h2.end.getMonth(), h2.end.getDate()]).toEqual([6, 11, 31]);
    const fy = goalPeriodRange("FY27")!;
    expect([fy.start.getFullYear(), fy.start.getMonth(), fy.end.getMonth()]).toEqual([2027, 0, 11]);
    expect(goalPeriodRange("Next sprint")).toBeNull();
    expect(goalPeriodRange(null)).toBeNull();
  });

  it("ranks unknown labels last and formats ranges", () => {
    expect(goalPeriodRank("FY26")).toBeLessThan(goalPeriodRank("Q1 FY27"));
    expect(goalPeriodRank("Q4 FY26")).toBeLessThan(goalPeriodRank("H1 FY26"));
    expect(goalPeriodRank("x")).toBe(Number.MAX_SAFE_INTEGER);
    expect(formatGoalPeriodRange("Q1 FY26")).toBe("Jan 1 – Mar 31");
    expect(formatGoalPeriodRange("?")).toBe("");
  });
});
