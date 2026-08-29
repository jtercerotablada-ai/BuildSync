import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  daysFromToday,
  dueDateToLocalMidnight,
  startOfLocalDay,
  startOfTodayUtc,
  startOfTomorrowUtc,
  toDateOnlyISO,
} from "./date-only";

/**
 * Due dates are DATE-ONLY, stored at UTC midnight.
 *
 * A composer sends "YYYY-MM-DD"; the API does `new Date(str)`, which the JS
 * spec parses as 00:00 UTC. Every surface that decides "is this OVERDUE?"
 * therefore has to bucket by the UTC calendar day. Two whole families of bugs
 * lived here this session:
 *
 *   CLIENT  — reading a stored due date with LOCAL getters (getDate,
 *             toDateString). For anyone west of UTC that reads one day early,
 *             so a task due TODAY rendered "Yesterday" and was counted overdue.
 *   SERVER  — comparing a stored due date against `new Date()` instead of UTC
 *             midnight. That marks everything due TODAY overdue from 00:00
 *             onward, in four separate counters (dashboard stats, reports, the
 *             AI coach, team workload).
 *
 * These tests are named after what the user SEES, not after the function.
 * They touch no database and no network — the module is pure arithmetic on
 * Date objects, and every fixture is built in this file.
 *
 * TIMEZONE STRATEGY — both, deliberately:
 *   1. The main blocks are timezone-INDEPENDENT by construction: fixtures are
 *      built from local calendar components (`new Date(y, m, d)`) and asserted
 *      on local calendar components, never on an absolute instant. They pass in
 *      any TZ, including whatever the developer's machine is set to.
 *   2. The last blocks FAKE the timezone (`process.env.TZ`, honoured at runtime
 *      by Node >= 16) to America/Los_Angeles — UTC-7/-8 — and re-assert the
 *      same guarantees. Those blocks first prove the naive local-getter reading
 *      really is off by a day there, so they cannot pass vacuously on a machine
 *      where the fake failed to take effect.
 */

/** Zero-padded "YYYY-MM-DD" of a Date's LOCAL calendar day. Written out by
 *  hand so fixtures do not depend on the function under test. */
function localDateOnly(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The date-only string a composer would send for "N days from today" in the
 *  VIEWER's local calendar. Day arithmetic via the Date constructor, so month
 *  and year rollover are handled for us. */
function dueInDays(n: number): string {
  const t = new Date();
  return localDateOnly(new Date(t.getFullYear(), t.getMonth(), t.getDate() + n));
}

/** Local calendar day of a Date, as a comparable tuple. */
function localYMD(d: Date): [number, number, number] {
  return [d.getFullYear(), d.getMonth(), d.getDate()];
}

/** Local midnight of the machine's current day — the argument a caller who
 *  legitimately means "now" passes to `daysFromToday`. Written out by hand
 *  so the fixture does not depend on the function under test. */
function todayLocal(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

/** Freeze "now" at an absolute instant for the duration of a block. */
function freezeAt(iso: string) {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  });
  afterAll(() => {
    vi.useRealTimers();
  });
}

// ---------------------------------------------------------------------------

describe("a stored due date keeps the calendar day the composer picked", () => {
  it("shows Aug 27 for a task saved as due Aug 27", () => {
    // The whole client-side bug in one assertion: local getters on
    // new Date("2026-08-27") answer Aug 26 west of UTC.
    expect(localYMD(dueDateToLocalMidnight("2026-08-27"))).toEqual([2026, 7, 27]);
  });

  it("shows the same day whether the API sent a string or a Date", () => {
    // Prisma hands route handlers a Date; `fetch` + JSON hands the client the
    // ISO string of the same instant. Both must land on the same day.
    const asString = dueDateToLocalMidnight("2026-08-27T00:00:00.000Z");
    const asDate = dueDateToLocalMidnight(new Date("2026-08-27T00:00:00.000Z"));
    expect(localYMD(asString)).toEqual([2026, 7, 27]);
    expect(localYMD(asDate)).toEqual(localYMD(asString));
  });

  it("hands back local midnight, so it can be compared with startOfLocalDay", () => {
    const d = dueDateToLocalMidnight("2026-08-27");
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()])
      .toEqual([0, 0, 0, 0]);
  });

  it("does not roll a New Year's Day due date back into the old year", () => {
    expect(localYMD(dueDateToLocalMidnight("2027-01-01"))).toEqual([2027, 0, 1]);
  });

  it("keeps Feb 29 on a leap year", () => {
    expect(localYMD(dueDateToLocalMidnight("2028-02-29"))).toEqual([2028, 1, 29]);
  });

  it("keeps the first of the month off the previous month", () => {
    expect(localYMD(dueDateToLocalMidnight("2026-09-01"))).toEqual([2026, 8, 1]);
  });
});

describe("startOfLocalDay", () => {
  it("strips the clock time off a moment, keeping its local day", () => {
    const evening = new Date(2026, 7, 27, 23, 59, 59, 999);
    const start = startOfLocalDay(evening);
    expect(localYMD(start)).toEqual([2026, 7, 27]);
    expect(start.getHours()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });

  it("leaves a moment that is already local midnight alone", () => {
    const midnight = new Date(2026, 7, 27);
    expect(startOfLocalDay(midnight).getTime()).toBe(midnight.getTime());
  });

  it("defaults to today when called with no argument", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-27T18:30:00.000Z"));
      const now = new Date();
      expect(localYMD(startOfLocalDay())).toEqual(localYMD(now));
      expect(startOfLocalDay().getHours()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------

describe("a task due TODAY is never overdue (the client-side counters)", () => {
  // Mid-afternoon UTC: unambiguous, and far from any DST boundary.
  freezeAt("2026-08-27T15:00:00.000Z");

  it("reads as Today — 0 days from today, not -1", () => {
    expect(daysFromToday(dueInDays(0), todayLocal())).toBe(0);
  });

  it("is excluded from the overdue count, which is strictly days < 0", () => {
    // The exact predicate my-tasks, the portfolio API and the assigned-tasks
    // widget all use.
    const isOverdue = (due: string) => daysFromToday(due, todayLocal()) < 0;
    expect(isOverdue(dueInDays(0))).toBe(false);
  });

  it("counts as overdue only once the day it was due has passed", () => {
    expect(daysFromToday(dueInDays(-1), todayLocal())).toBe(-1);
    expect(daysFromToday(dueInDays(-1), todayLocal()) < 0).toBe(true);
  });

  it("reads as Tomorrow for a task due the next day", () => {
    expect(daysFromToday(dueInDays(1), todayLocal())).toBe(1);
  });

  it("counts whole days into the past as negative", () => {
    expect(daysFromToday(dueInDays(-7), todayLocal())).toBe(-7);
    expect(daysFromToday(dueInDays(-30), todayLocal())).toBe(-30);
  });

  it("counts whole days into the future as positive", () => {
    expect(daysFromToday(dueInDays(7), todayLocal())).toBe(7);
    expect(daysFromToday(dueInDays(30), todayLocal())).toBe(30);
  });

  it("keeps the Next 30 Days band inclusive of today and of day 30", () => {
    // my-tasks: dueDate >= 0 && <= 30. Today must be in it, day 31 must not.
    const inBand = (due: string) =>
      daysFromToday(due, todayLocal()) >= 0 &&
      daysFromToday(due, todayLocal()) <= 30;
    expect(inBand(dueInDays(0))).toBe(true);
    expect(inBand(dueInDays(30))).toBe(true);
    expect(inBand(dueInDays(31))).toBe(false);
    expect(inBand(dueInDays(-1))).toBe(false);
  });

  it("accepts the stored Date object as well as the string", () => {
    const today = dueInDays(0);
    expect(daysFromToday(new Date(today), todayLocal())).toBe(0);
  });

  it("still says 0 when the day is nearly over", () => {
    // The counter must not flip at some hour of the evening. Same fixture,
    // clock moved to one millisecond before UTC midnight.
    vi.setSystemTime(new Date("2026-08-27T23:59:59.999Z"));
    expect(daysFromToday(dueInDays(0), todayLocal())).toBe(0);
    vi.setSystemTime(new Date("2026-08-27T00:00:00.000Z"));
    expect(daysFromToday(dueInDays(0), todayLocal())).toBe(0);
    vi.setSystemTime(new Date("2026-08-27T15:00:00.000Z"));
  });
});

// ---------------------------------------------------------------------------

/**
 * The day is an ARGUMENT, and nothing else may decide it.
 *
 * `daysFromToday` used to call `startOfLocalDay()` itself. On the server that
 * reads the UTC day, so from 20:00 in Miami it counted from TOMORROW — and
 * React does not repair a text or className mismatch when it hydrates, so the
 * wrong answer stayed on screen for the rest of the evening. Measured live at
 * 22:56 EDT on Fri Aug 28 2026: the Timeline lit Sat the 29th. The parameter
 * is required precisely so no caller can inherit that clock read silently.
 */
describe("the caller says which day it means, and is believed", () => {
  // 22:56 in Miami on Friday Aug 28 — where the machine (UTC) already says
  // Saturday the 29th and the person at the desk still says Friday.
  const miamiFridayEvening = new Date("2026-08-29T02:56:00.000Z");
  const friday = new Date(2026, 7, 28);

  it("counts from the day it was given, not from the machine clock", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(miamiFridayEvening);
      expect(daysFromToday("2026-08-28", friday)).toBe(0); // "Today"
      expect(daysFromToday("2026-08-29", friday)).toBe(1); // "Tomorrow"
      expect(daysFromToday("2026-08-27", friday)).toBe(-1); // "Yesterday"
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a task due today OUT of the overdue count on that evening", () => {
    // The regression the firm hits every night: the day boundary the counter
    // uses must be the viewer's, not the one the server happens to be in.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(miamiFridayEvening);
      expect(daysFromToday("2026-08-28", friday) < 0).toBe(false);
      // What the server's own day would have said — one day ahead.
      const saturday = new Date(2026, 7, 29);
      expect(daysFromToday("2026-08-28", saturday) < 0).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("moves when the day it is handed moves, so a tab left open re-arms", () => {
    const due = "2026-08-28";
    expect(daysFromToday(due, new Date(2026, 7, 27))).toBe(1);
    expect(daysFromToday(due, new Date(2026, 7, 28))).toBe(0);
    expect(daysFromToday(due, new Date(2026, 7, 29))).toBe(-1);
  });

  it("gives the same answer at every hour of every clock — it is pure now", () => {
    vi.useFakeTimers();
    try {
      const answers = [
        "2026-08-01T00:00:00.000Z",
        "2026-08-28T12:00:00.000Z",
        "2026-08-29T02:56:00.000Z", // the evening that used to break it
        "2027-01-01T00:00:00.000Z",
      ].map((iso) => {
        vi.setSystemTime(new Date(iso));
        return daysFromToday("2026-08-28", friday);
      });
      expect(answers).toEqual([0, 0, 0, 0]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("still crosses months and years off the day it was given", () => {
    expect(daysFromToday("2027-01-01", new Date(2026, 11, 31))).toBe(1);
    expect(daysFromToday("2026-08-31", new Date(2026, 8, 1))).toBe(-1);
    expect(daysFromToday("2028-02-29", new Date(2028, 1, 28))).toBe(1);
  });
});

// ---------------------------------------------------------------------------

describe("the composer writes back the day the user picked", () => {
  it("formats a picked local date as YYYY-MM-DD", () => {
    expect(toDateOnlyISO(new Date(2026, 7, 27))).toBe("2026-08-27");
  });

  it("zero-pads single-digit months and days", () => {
    expect(toDateOnlyISO(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toDateOnlyISO(new Date(2026, 8, 9))).toBe("2026-09-09");
  });

  it("ignores the clock time on the picked date", () => {
    expect(toDateOnlyISO(new Date(2026, 7, 27, 23, 59, 59, 999))).toBe(
      "2026-08-27"
    );
    expect(toDateOnlyISO(new Date(2026, 7, 27, 0, 0, 0, 1))).toBe("2026-08-27");
  });

  it("survives the round trip: pick a day, store it, read it back", () => {
    // toDateOnlyISO -> `new Date(str)` on the server (UTC midnight) ->
    // dueDateToLocalMidnight on the client. Same calendar day, or the task
    // silently moves every time somebody opens the composer.
    for (const picked of [
      new Date(2026, 7, 27),
      new Date(2026, 0, 1),
      new Date(2026, 11, 31),
      new Date(2028, 1, 29),
      new Date(2026, 10, 1),
    ]) {
      const stored = toDateOnlyISO(picked);
      expect(localYMD(dueDateToLocalMidnight(stored))).toEqual(localYMD(picked));
    }
  });

  it("survives the round trip starting from a stored string", () => {
    for (const stored of [
      "2026-08-27",
      "2026-01-05",
      "2026-12-31",
      "2028-02-29",
      "2027-01-01",
    ]) {
      expect(toDateOnlyISO(dueDateToLocalMidnight(stored))).toBe(stored);
    }
  });

  it("round-trips a stored UTC-midnight timestamp, not just the short form", () => {
    expect(toDateOnlyISO(dueDateToLocalMidnight("2026-08-27T00:00:00.000Z"))).toBe(
      "2026-08-27"
    );
  });
});

// ---------------------------------------------------------------------------

describe("the server counts a task due TODAY as due, not overdue", () => {
  // The four counters: /api/dashboard/stats, /api/reports, /api/ai/coach and
  // the team workload route all bucket with `dueDate < startOfTodayUtc(now)`.
  const now = new Date("2026-08-27T15:00:00.000Z");
  const dueToday = new Date("2026-08-27T00:00:00.000Z"); // as Prisma stores it
  const dueYesterday = new Date("2026-08-26T00:00:00.000Z");
  const dueTomorrow = new Date("2026-08-28T00:00:00.000Z");

  it("puts the boundary at UTC midnight, not at the current moment", () => {
    const today = startOfTodayUtc(now);
    expect(today.toISOString()).toBe("2026-08-27T00:00:00.000Z");
  });

  it("does NOT count a task due today as overdue (dueDate < today is false)", () => {
    // The regression. Comparing against `now` instead made this true from
    // 00:00:00.001 onward and every dashboard reported phantom overdue work.
    expect(dueToday < startOfTodayUtc(now)).toBe(false);
    expect(dueToday < now).toBe(true); // ...which is exactly what the bug did
  });

  it("counts a task due yesterday as overdue", () => {
    expect(dueYesterday < startOfTodayUtc(now)).toBe(true);
  });

  it("does not count a task due tomorrow as overdue", () => {
    expect(dueTomorrow < startOfTodayUtc(now)).toBe(false);
  });

  it("puts a task due today in the Due Today bucket [today, tomorrow)", () => {
    const today = startOfTodayUtc(now);
    const tomorrow = startOfTomorrowUtc(now);
    const dueTodayBucket = (d: Date) => d >= today && d < tomorrow;
    expect(dueTodayBucket(dueToday)).toBe(true);
    expect(dueTodayBucket(dueYesterday)).toBe(false);
    expect(dueTodayBucket(dueTomorrow)).toBe(false);
  });

  it("holds the same boundary at every hour of the UTC day", () => {
    // The counter must not change its answer between 00:00 and 23:59.
    for (const hour of [0, 1, 7, 12, 17, 23]) {
      const at = new Date(Date.UTC(2026, 7, 27, hour, 30, 0, 0));
      expect(startOfTodayUtc(at).toISOString()).toBe("2026-08-27T00:00:00.000Z");
      expect(dueToday < startOfTodayUtc(at)).toBe(false);
    }
  });

  it("holds at the very first and very last millisecond of the day", () => {
    expect(
      startOfTodayUtc(new Date("2026-08-27T00:00:00.000Z")).toISOString()
    ).toBe("2026-08-27T00:00:00.000Z");
    expect(
      startOfTodayUtc(new Date("2026-08-27T23:59:59.999Z")).toISOString()
    ).toBe("2026-08-27T00:00:00.000Z");
  });

  it("makes tomorrow exactly 24 hours after today", () => {
    expect(startOfTomorrowUtc(now).getTime() - startOfTodayUtc(now).getTime())
      .toBe(24 * 60 * 60 * 1000);
    expect(startOfTomorrowUtc(now).toISOString()).toBe(
      "2026-08-28T00:00:00.000Z"
    );
  });

  it("rolls the boundary over a month end and a year end", () => {
    expect(
      startOfTomorrowUtc(new Date("2026-08-31T22:00:00.000Z")).toISOString()
    ).toBe("2026-09-01T00:00:00.000Z");
    expect(
      startOfTomorrowUtc(new Date("2026-12-31T22:00:00.000Z")).toISOString()
    ).toBe("2027-01-01T00:00:00.000Z");
    expect(
      startOfTomorrowUtc(new Date("2028-02-28T22:00:00.000Z")).toISOString()
    ).toBe("2028-02-29T00:00:00.000Z");
  });

  it("agrees with the client: server-overdue and daysFromToday < 0 match", () => {
    // OWNER reads the dashboard counter (server, UTC) while MEMBER reads the
    // task list (client, daysFromToday). The two must not disagree about the
    // same task, or the two people see different numbers for the same project.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(now);
      for (const [stored, expectedOverdue] of [
        [dueYesterday, true],
        [dueToday, false],
        [dueTomorrow, false],
      ] as const) {
        const serverSaysOverdue = stored < startOfTodayUtc(new Date());
        const clientSaysOverdue = daysFromToday(stored, todayLocal()) < 0;
        expect(serverSaysOverdue).toBe(expectedOverdue);
        expect(clientSaysOverdue).toBe(expectedOverdue);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("defaults to the current moment when called with no argument", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(now);
      expect(startOfTodayUtc().toISOString()).toBe("2026-08-27T00:00:00.000Z");
      expect(startOfTomorrowUtc().toISOString()).toBe(
        "2026-08-28T00:00:00.000Z"
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------

/**
 * Everything above is timezone-independent. This block FAKES the viewer's
 * timezone to America/Los_Angeles (UTC-7 in August) by setting process.env.TZ,
 * which Node honours at runtime, and re-asserts the guarantees there — because
 * "works in UTC" is exactly the illusion that hid all of these bugs.
 */
describe("a viewer west of UTC (America/Los_Angeles)", () => {
  const REAL_TZ = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "America/Los_Angeles";
  });
  afterAll(() => {
    if (REAL_TZ === undefined) delete process.env.TZ;
    else process.env.TZ = REAL_TZ;
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("really is west of UTC here — the naive reading IS off by a day", () => {
    // Guards the guard. If the TZ fake did not take effect, every assertion
    // below would pass vacuously and this file would prove nothing about
    // non-UTC viewers.
    expect(new Date("2026-08-27").getTimezoneOffset()).toBeGreaterThan(0);
    expect(new Date("2026-08-27").getDate()).toBe(26); // the old bug, verbatim
  });

  it("still shows Aug 27 for a task saved as due Aug 27", () => {
    expect(localYMD(dueDateToLocalMidnight("2026-08-27"))).toEqual([2026, 7, 27]);
  });

  it("still says Today for a task due today, and Yesterday for one day late", () => {
    vi.useFakeTimers();
    // 19:00 in Los Angeles on Aug 26 — the evening window where the local and
    // the UTC calendar day disagree, and where the counters used to flip.
    vi.setSystemTime(new Date("2026-08-27T02:00:00.000Z"));
    expect(new Date().getDate()).toBe(26); // local day really is the 26th

    // The viewer's day — Aug 26 in Los Angeles — which is what a client
    // passes from useToday(). The UTC day is already the 27th.
    const viewerDay = todayLocal();
    expect(daysFromToday("2026-08-26", viewerDay)).toBe(0); // due today  -> "Today"
    expect(daysFromToday("2026-08-25", viewerDay)).toBe(-1); // one day late
    expect(daysFromToday("2026-08-27", viewerDay)).toBe(1); // "Tomorrow"
    expect(daysFromToday("2026-08-26", viewerDay) < 0).toBe(false); // not overdue
  });

  it("sends back the day the user picked, not the UTC day of that instant", () => {
    // The composer bug: `picked.toISOString().slice(0, 10)` on an evening
    // selection shifts the task one day forward for every viewer west of UTC.
    const pickedThisEvening = new Date(2026, 7, 26, 18, 0, 0);
    expect(toDateOnlyISO(pickedThisEvening)).toBe("2026-08-26");
    expect(pickedThisEvening.toISOString().slice(0, 10)).toBe("2026-08-27");
  });

  it("round-trips the picked day through storage and back", () => {
    for (const picked of [
      new Date(2026, 7, 26, 18, 0, 0),
      new Date(2026, 0, 1, 23, 30, 0),
      new Date(2026, 11, 31, 22, 0, 0),
    ]) {
      const stored = new Date(toDateOnlyISO(picked)); // what the API persists
      expect(localYMD(dueDateToLocalMidnight(stored))).toEqual(localYMD(picked));
    }
  });

  it("keeps the server boundary on the UTC day, not the viewer's local day", () => {
    // startOfTodayUtc must NOT follow the process timezone: due dates are
    // stored in UTC, so the boundary is UTC. At 19:00 Aug 26 in Los Angeles it
    // is already Aug 27 in UTC, and the boundary has to say so.
    const now = new Date("2026-08-27T02:00:00.000Z");
    expect(now.getDate()).toBe(26); // local
    expect(startOfTodayUtc(now).toISOString()).toBe("2026-08-27T00:00:00.000Z");
    expect(startOfTomorrowUtc(now).toISOString()).toBe(
      "2026-08-28T00:00:00.000Z"
    );
  });

  it("counts whole days correctly across the end of daylight saving", () => {
    // Nov 1 2026 is a 25-hour local day in Los Angeles. Dividing elapsed
    // milliseconds by 24h without rounding turns "tomorrow" into 1.04 days and
    // the label into the wrong bucket.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T19:00:00.000Z")); // Oct 31, noon PDT
    expect(new Date().getDate()).toBe(31);
    expect(daysFromToday(dueInDays(0), todayLocal())).toBe(0);
    expect(daysFromToday(dueInDays(1), todayLocal())).toBe(1); // across the 25-hour day
    expect(daysFromToday(dueInDays(2), todayLocal())).toBe(2);
    expect(daysFromToday(dueInDays(-1), todayLocal())).toBe(-1);
  });

  it("counts whole days correctly across the start of daylight saving", () => {
    // Mar 8 2026 is a 23-hour local day.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-07T20:00:00.000Z")); // Mar 7, noon PST
    expect(new Date().getDate()).toBe(7);
    expect(daysFromToday(dueInDays(1), todayLocal())).toBe(1); // across the 23-hour day
    expect(daysFromToday(dueInDays(2), todayLocal())).toBe(2);
    expect(daysFromToday(dueInDays(-1), todayLocal())).toBe(-1);
  });
});
