import { describe, expect, it } from "vitest";
import {
  NO_STATUS_LABEL,
  STAGE_STALE_DAYS,
  countOverdue,
  daysSince,
  isStatusEarned,
  statusNudge,
} from "./project-status";

/**
 * A status has to be EARNED, and a nudge has to be a FACT.
 *
 * The bug these tests pin down is not a crash: `Project.status` defaults to
 * ON_TRACK, so a project nobody ever looked at rendered a confident green
 * "On track". Every assertion below is named after what the owner sees.
 *
 * Pure arithmetic on Dates — no database, no network, no clock read inside
 * the module. Fixtures are built from LOCAL calendar components and asserted
 * the same way, so the file passes in any timezone.
 */

/** Local midnight `n` days before/after the fixed test day. */
function day(offset = 0): Date {
  return new Date(2026, 7, 30 + offset); // Aug 30 2026, local
}

const TODAY = day(0);

describe("isStatusEarned — has a human ever chosen this status?", () => {
  it("says no for a project nobody set (the default green)", () => {
    expect(isStatusEarned(null)).toBe(false);
    expect(isStatusEarned(undefined)).toBe(false);
  });

  it("says yes for a Date, the shape a server component spreads through", () => {
    expect(isStatusEarned(new Date("2026-08-20T14:00:00.000Z"))).toBe(true);
  });

  it("says yes for an ISO string, the shape an API payload carries", () => {
    expect(isStatusEarned("2026-08-20T14:00:00.000Z")).toBe(true);
  });

  it("treats an unreadable value as NOT earned rather than as green", () => {
    expect(isStatusEarned("not a date")).toBe(false);
    expect(isStatusEarned(new Date("nope"))).toBe(false);
  });

  it("keeps one word for the unearned state", () => {
    expect(NO_STATUS_LABEL).toBe("No status");
  });
});

describe("daysSince — how long has it been?", () => {
  it("is null when nothing recorded the arrival (never 0 days)", () => {
    expect(daysSince(null, TODAY)).toBeNull();
    expect(daysSince(undefined, TODAY)).toBeNull();
    expect(daysSince("garbage", TODAY)).toBeNull();
  });

  it("is null before the browser's own clock is known", () => {
    expect(daysSince(day(-5), null)).toBeNull();
  });

  it("counts calendar days, not 24-hour blocks", () => {
    // Entered at 18:00 yesterday: 15 hours ago, but one calendar day.
    const yesterdayEvening = new Date(2026, 7, 29, 18, 0, 0);
    expect(daysSince(yesterdayEvening, TODAY)).toBe(1);
  });

  it("counts today as 0", () => {
    expect(daysSince(new Date(2026, 7, 30, 9, 30), TODAY)).toBe(0);
  });
});

describe("countOverdue — open work already past its due date", () => {
  it("counts nothing before the browser's own clock is known", () => {
    // Due dates live at UTC midnight; measuring them against a UTC server
    // render marks work due TODAY overdue for every viewer west of UTC.
    expect(
      countOverdue([{ completed: false, dueDate: "2026-08-01" }], null)
    ).toBe(0);
  });

  it("ignores completed work and undated work", () => {
    expect(
      countOverdue(
        [
          { completed: true, dueDate: "2026-08-01" },
          { completed: false, dueDate: null },
        ],
        TODAY
      )
    ).toBe(0);
  });

  it("does not count work due today", () => {
    expect(
      countOverdue([{ completed: false, dueDate: "2026-08-30" }], TODAY)
    ).toBe(0);
  });

  it("counts open work whose date has passed", () => {
    expect(
      countOverdue(
        [
          { completed: false, dueDate: "2026-08-28" },
          { completed: false, dueDate: "2026-08-29" },
          { completed: false, dueDate: "2026-09-04" },
        ],
        TODAY
      )
    ).toBe(2);
  });
});

describe("statusNudge — the fact that sits next to the claim", () => {
  const earned = { statusSetAt: day(-3), today: TODAY };

  it("says nothing while nobody has claimed anything", () => {
    // "No status" has already said the honest thing; a second line under it
    // would be arguing with a claim that was never made.
    expect(
      statusNudge({
        status: "ON_TRACK",
        statusSetAt: null,
        overdueCount: 4,
        today: TODAY,
      })
    ).toBeNull();
  });

  it("says nothing on the first frame, before the clock is known", () => {
    expect(
      statusNudge({
        status: "ON_TRACK",
        statusSetAt: day(-3),
        overdueCount: 4,
        today: null,
      })
    ).toBeNull();
  });

  it("names overdue work under an On track claim", () => {
    expect(statusNudge({ ...earned, status: "ON_TRACK", overdueCount: 3 })).toBe(
      "3 tasks past due"
    );
  });

  it("keeps the count grammatical for one task", () => {
    expect(statusNudge({ ...earned, status: "ON_TRACK", overdueCount: 1 })).toBe(
      "1 task past due"
    );
  });

  it("contradicts a Complete claim the same way", () => {
    expect(statusNudge({ ...earned, status: "COMPLETE", overdueCount: 2 })).toBe(
      "2 tasks past due"
    );
  });

  it("stays quiet under At risk, Off track and On hold", () => {
    // Those already say something is wrong (or that the pause is deliberate).
    for (const status of ["AT_RISK", "OFF_TRACK", "ON_HOLD"]) {
      expect(statusNudge({ ...earned, status, overdueCount: 5 })).toBeNull();
    }
  });

  it("names a long wait when there is no overdue work", () => {
    expect(
      statusNudge({
        ...earned,
        status: "ON_TRACK",
        overdueCount: 0,
        stageEnteredAt: day(-STAGE_STALE_DAYS),
      })
    ).toBe(`${STAGE_STALE_DAYS} days in this stage`);
  });

  it("stays quiet for an ordinary wait", () => {
    expect(
      statusNudge({
        ...earned,
        status: "ON_TRACK",
        overdueCount: 0,
        stageEnteredAt: day(-(STAGE_STALE_DAYS - 1)),
      })
    ).toBeNull();
  });

  it("prefers the overdue work, which the firm can act on today", () => {
    expect(
      statusNudge({
        ...earned,
        status: "ON_TRACK",
        overdueCount: 2,
        stageEnteredAt: day(-90),
      })
    ).toBe("2 tasks past due");
  });

  it("says nothing when the facts agree with the claim", () => {
    expect(
      statusNudge({
        ...earned,
        status: "ON_TRACK",
        overdueCount: 0,
        stageEnteredAt: day(-2),
      })
    ).toBeNull();
  });
});
