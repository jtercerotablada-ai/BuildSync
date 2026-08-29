import { describe, expect, it } from "vitest";

import { daysFrom, dueRangeText } from "./gantt-view";

// Dates arrive from the API as UTC-midnight instants; these strings are
// exactly what the client receives.
const utc = (day: string) => `${day}T00:00:00.000Z`;
// "Today" as the hook hands it over: local midnight of the viewer's day.
const localDay = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("daysFrom", () => {
  it("counts whole calendar days forward", () => {
    expect(daysFrom(localDay(2026, 8, 28), utc("2026-09-04"))).toBe(7);
  });

  it("returns 0 for a task due today", () => {
    expect(daysFrom(localDay(2026, 8, 28), utc("2026-08-28"))).toBe(0);
  });

  it("goes negative for an overdue task", () => {
    expect(daysFrom(localDay(2026, 8, 28), utc("2026-08-18"))).toBe(-10);
  });

  it("counts by the calendar, not by 24h blocks, across a DST change", () => {
    // Nov 1 2026 is the US fall-back: the Nov 1 → Nov 2 "day" is 25 hours.
    // A wall-clock difference truncates that to 0 extra days.
    expect(daysFrom(localDay(2026, 10, 31), utc("2026-11-03"))).toBe(3);
  });

  it("measures from the DAY it is given, never from the clock", () => {
    // The bug this exists for: at 20:00 Miami the server's own day is
    // already tomorrow, so a task due today counted as -1 (overdue).
    const dueToday = utc("2026-08-28");
    expect(daysFrom(localDay(2026, 8, 28), dueToday)).toBe(0);
    expect(daysFrom(localDay(2026, 8, 29), dueToday)).toBe(-1);
  });
});

describe("dueRangeText", () => {
  it("says Today for a task due on the given day", () => {
    expect(
      dueRangeText({ startDate: null, dueDate: utc("2026-08-28") }, localDay(2026, 8, 28))
    ).toBe("Today");
  });

  it("collapses a same-day range to the single label", () => {
    expect(
      dueRangeText(
        { startDate: utc("2026-09-14"), dueDate: utc("2026-09-14") },
        localDay(2026, 8, 28)
      )
    ).toBe("Sep 14");
  });

  it("keeps the month off the second date inside one month", () => {
    expect(
      dueRangeText(
        { startDate: utc("2026-09-14"), dueDate: utc("2026-09-18") },
        localDay(2026, 8, 28)
      )
    ).toBe("Sep 14 – 18");
  });

  it("ends a range with Today when it closes on the given day", () => {
    expect(
      dueRangeText(
        { startDate: utc("2026-08-24"), dueDate: utc("2026-08-28") },
        localDay(2026, 8, 28)
      )
    ).toBe("Aug 24 – Today");
  });

  it("never says Today before today is known", () => {
    // useToday() is null on the server render and the first client render.
    // The plain date is right in every timezone; "Today" would be a guess
    // made from the server's UTC clock.
    expect(dueRangeText({ startDate: null, dueDate: utc("2026-08-28") }, null)).toBe(
      "Aug 28"
    );
    expect(
      dueRangeText({ startDate: utc("2026-08-24"), dueDate: utc("2026-08-28") }, null)
    ).toBe("Aug 24 – 28");
  });

  it("names the start of a task that has no end date yet", () => {
    // "the field survey starts the 14th, we do not know yet when it
    // closes" — the em dash this printed said "no date" about the one
    // date the task does carry.
    expect(
      dueRangeText({ startDate: utc("2026-09-14"), dueDate: null }, localDay(2026, 8, 28))
    ).toBe("Starts Sep 14");
  });

  it("has no range to show for a task with no dates at all", () => {
    expect(dueRangeText({ startDate: null, dueDate: null }, localDay(2026, 8, 28))).toBe(
      "—"
    );
  });
});
