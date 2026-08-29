import { describe, expect, it } from "vitest";

import {
  localDayOf,
  msUntilNextLocalMidnight,
  nextLocalMidnight,
} from "./use-today";

describe("localDayOf", () => {
  it("returns local midnight of the moment's calendar day", () => {
    const d = localDayOf(new Date(2026, 7, 28, 22, 56, 50));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(28);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("stays on the LOCAL day when UTC has already rolled over", () => {
    // 22:56 in Miami on Aug 28 is 02:56 UTC on Aug 29. The whole bug this
    // module exists for: the marker must read 28, not 29.
    const evening = new Date(2026, 7, 28, 22, 56, 50);
    expect(evening.getUTCDate()).not.toBe(evening.getDate());
    expect(localDayOf(evening).getDate()).toBe(28);
  });

  it("is idempotent — a local midnight maps to itself", () => {
    const midnight = new Date(2026, 7, 28);
    expect(localDayOf(midnight).getTime()).toBe(midnight.getTime());
  });
});

describe("nextLocalMidnight", () => {
  it("is the following calendar day at 00:00 local", () => {
    const next = nextLocalMidnight(new Date(2026, 7, 28, 22, 56));
    expect(next.getDate()).toBe(29);
    expect(next.getHours()).toBe(0);
  });

  it("rolls the month", () => {
    expect(nextLocalMidnight(new Date(2026, 7, 31, 12, 0)).getMonth()).toBe(8);
    expect(nextLocalMidnight(new Date(2026, 7, 31, 12, 0)).getDate()).toBe(1);
  });

  it("rolls the year", () => {
    const next = nextLocalMidnight(new Date(2026, 11, 31, 23, 59));
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(0);
    expect(next.getDate()).toBe(1);
  });

  it("lands on the real boundary across a DST transition", () => {
    // Built by calendar arithmetic, not now + 86_400_000, so a 23- or
    // 25-hour day still resolves to the next local midnight.
    const beforeSpringForward = new Date(2027, 2, 13, 15, 0);
    const next = nextLocalMidnight(beforeSpringForward);
    expect(next.getDate()).toBe(14);
    expect(next.getHours()).toBe(0);
  });
});

describe("msUntilNextLocalMidnight", () => {
  it("counts down to the boundary", () => {
    const ms = msUntilNextLocalMidnight(new Date(2026, 7, 28, 23, 0, 0));
    expect(ms).toBe(60 * 60 * 1000);
  });

  it("never returns a zero or negative delay at the boundary itself", () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 7, 28, 0, 0, 0))).toBeGreaterThanOrEqual(1000);
    expect(
      msUntilNextLocalMidnight(new Date(2026, 7, 28, 23, 59, 59, 999))
    ).toBeGreaterThanOrEqual(1000);
  });
});
