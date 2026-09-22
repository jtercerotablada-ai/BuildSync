import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "./date-utils";

describe("formatRelativeTime", () => {
  it("labels by calendar day, not elapsed 24h periods", () => {
    const now = new Date(2026, 8, 21, 9, 0);
    // 11 hours earlier, but on the previous calendar day.
    expect(formatRelativeTime(new Date(2026, 8, 20, 22, 0), now)).toMatch(/^Yesterday at /);
    // Earlier the same day.
    expect(formatRelativeTime(new Date(2026, 8, 21, 0, 30), now)).toMatch(/^Today at /);
  });

  it("does not call a two-calendar-day-old item Yesterday", () => {
    const now = new Date(2026, 8, 20, 9, 0);
    // 34 hours earlier = two calendar days back.
    const label = formatRelativeTime(new Date(2026, 8, 18, 23, 0), now);
    expect(label.startsWith("Yesterday")).toBe(false);
    expect(label.startsWith("Today")).toBe(false);
  });
});
