import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dateBucketKey,
  dateBucketLabel,
  lastNBuckets,
  resolveTaskDimension,
  type ResolveMaps,
  type TaskRow,
} from "./report-query";
import type { DateGrain } from "./report-config";

/**
 * The time axis of a custom chart.
 *
 * report-query.ts is the engine behind POST /api/reports/query. Importing it
 * pulls in the Prisma singleton, but nothing here calls it: every function
 * under test is pure and is handed its inputs by the test. No database, no
 * network (DATABASE_URL is blanked for the whole run; see vitest.config.ts).
 *
 * These tests exist because the chronological window was wrong three separate
 * ways at once, and each way had its own user-visible symptom:
 *
 *   1. It sorted buckets by the human LABEL. Day and week labels carry no
 *      year ("Dec 30", "Jan 2"), so December sorted after January and a chart
 *      spanning New Year drew its bars in the wrong order.
 *   2. It kept the FIRST `limit` buckets after sorting — the twelve OLDEST
 *      months on record. A project with two years of history rendered 2024
 *      and looked to the owner like the team had stopped working.
 *   3. Once the window was anchored on today, it clamped to END at today and
 *      threw the future away: two months of history plus eleven months of
 *      planned work rendered as two bars, which is not a schedule.
 *
 * The window selection itself lives inside runTaskQuery, which is async and
 * DB-bound, so it is not reachable from a test that touches no database. What
 * IS reachable is every primitive the window is built on — the keys it sorts,
 * the labels it must NOT sort, the today-anchored series it slices, and the
 * "No date" bucket it has to keep off the time axis. Those are pinned below,
 * so the three regressions cannot come back quietly.
 *
 * Due dates are stored at UTC midnight (see date-only.ts), so every fixture
 * date is written as an explicit UTC instant. That keeps these assertions
 * independent of the machine's timezone.
 */

/** A due date exactly as the API stores one: UTC midnight of the due day. */
function due(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

const GRAINS: DateGrain[] = ["day", "week", "month", "quarter"];

afterEach(() => {
  vi.useRealTimers();
});

describe("dateBucketKey — which column of the chart a date lands in", () => {
  it("puts a due date in its own UTC calendar day, not the viewer's", () => {
    // The convention exists because reading a UTC-midnight due date with
    // local getters moves it a day west of UTC, so a task due today would
    // render in yesterday's column for every viewer in the Americas.
    expect(dateBucketKey(due("2026-03-05"), "day")).toBe("2026-03-05");
  });

  it("zero-pads month and day so single-digit dates stay comparable", () => {
    expect(dateBucketKey(due("2026-01-02"), "day")).toBe("2026-01-02");
    expect(dateBucketKey(due("2026-01-02"), "month")).toBe("2026-01");
  });

  it("files a whole week under its Monday", () => {
    // 2026-03-02 is a Monday; 2026-03-08 the Sunday that closes that week.
    expect(dateBucketKey(due("2026-03-02"), "week")).toBe("2026-03-02");
    expect(dateBucketKey(due("2026-03-05"), "week")).toBe("2026-03-02");
    expect(dateBucketKey(due("2026-03-08"), "week")).toBe("2026-03-02");
    expect(dateBucketKey(due("2026-03-09"), "week")).toBe("2026-03-09");
  });

  it("keeps a week whole across a month and a year boundary", () => {
    // Thu 2026-01-01 belongs to the week starting Mon 2025-12-29 — the week
    // must not split into two half-columns at the turn of the year.
    expect(dateBucketKey(due("2026-01-01"), "week")).toBe("2025-12-29");
    expect(dateBucketKey(due("2025-12-31"), "week")).toBe("2025-12-29");
    expect(dateBucketKey(due("2026-04-01"), "week")).toBe("2026-03-30");
  });

  it("maps every month to the right quarter", () => {
    const byQuarter = [
      ["2026-01-15", "2026-Q1"],
      ["2026-03-31", "2026-Q1"],
      ["2026-04-01", "2026-Q2"],
      ["2026-06-30", "2026-Q2"],
      ["2026-07-01", "2026-Q3"],
      ["2026-09-30", "2026-Q3"],
      ["2026-10-01", "2026-Q4"],
      ["2026-12-31", "2026-Q4"],
    ] as const;
    for (const [iso, key] of byQuarter) {
      expect(dateBucketKey(due(iso), "quarter")).toBe(key);
    }
  });

  it("separates two dates only at the grain the reader picked", () => {
    const a = due("2026-03-05");
    const b = due("2026-03-06");
    expect(dateBucketKey(a, "day")).not.toBe(dateBucketKey(b, "day"));
    expect(dateBucketKey(a, "month")).toBe(dateBucketKey(b, "month"));
    expect(dateBucketKey(a, "quarter")).toBe(dateBucketKey(b, "quarter"));
  });
});

describe("bucket keys sort chronologically as plain strings", () => {
  // The property the whole window rests on: runTaskQuery sorts with
  // `a.__sortKey.localeCompare(b.__sortKey)`, buildBurn decides what happened
  // before the window with `key < firstKey`, and the today-anchor compares
  // `__sortKey <= todayKey`. All three are string comparisons on these keys.
  const sorted = (keys: string[]) => [...keys].sort((a, b) => a.localeCompare(b));

  it("orders December before the January that follows it", () => {
    expect(sorted(["2026-01-02", "2025-12-30"])).toEqual([
      "2025-12-30",
      "2026-01-02",
    ]);
  });

  it("orders September before October (the zero-padding pays off here)", () => {
    expect(sorted(["2026-10", "2026-09"])).toEqual(["2026-09", "2026-10"]);
  });

  it("orders Q4 before the next year's Q1", () => {
    expect(sorted(["2027-Q1", "2026-Q4"])).toEqual(["2026-Q4", "2027-Q1"]);
  });

  it.each(GRAINS)(
    "sorts 400 consecutive days of %s buckets into real calendar order",
    (grain) => {
      const start = due("2025-06-01").getTime();
      const chronological: string[] = [];
      for (let i = 0; i < 400; i++) {
        const key = dateBucketKey(new Date(start + i * 86400000), grain);
        if (chronological[chronological.length - 1] !== key) {
          chronological.push(key);
        }
      }
      // Walking forward day by day must never revisit a bucket…
      expect(new Set(chronological).size).toBe(chronological.length);
      // …and sorting the reversed list the way the engine does restores it.
      expect(sorted([...chronological].reverse())).toEqual(chronological);
    }
  );
});

describe("dateBucketLabel — what the axis reads, and must never be sorted on", () => {
  it("spells out the month with its year", () => {
    expect(dateBucketLabel("2026-03", "month")).toBe("Mar 2026");
    expect(dateBucketLabel("2026-12", "month")).toBe("Dec 2026");
  });

  it("passes a quarter key through unchanged", () => {
    expect(dateBucketLabel("2026-Q3", "quarter")).toBe("2026-Q3");
  });

  it("drops the leading zero from a day label", () => {
    expect(dateBucketLabel("2026-03-05", "day")).toBe("Mar 5");
    expect(dateBucketLabel("2026-01-02", "day")).toBe("Jan 2");
  });

  it("labels a week by its Monday", () => {
    expect(
      dateBucketLabel(dateBucketKey(due("2026-03-05"), "week"), "week")
    ).toBe("Mar 2");
  });

  it("gives two days a year apart the SAME label — the sort-by-label bug", () => {
    // Regression pin for symptom #1. Day and week labels deliberately carry
    // no year: fine for an axis, fatal as a sort key.
    expect(dateBucketLabel("2025-03-05", "day")).toBe("Mar 5");
    expect(dateBucketLabel("2026-03-05", "day")).toBe("Mar 5");
  });

  it("scrambles the axis when the label is used as the sort key", () => {
    // Three months of one project, in the order they happened.
    const keys = ["2025-12-30", "2026-01-02", "2026-02-11"];
    const labels = keys.map((k) => dateBucketLabel(k, "day"));
    expect(labels).toEqual(["Dec 30", "Jan 2", "Feb 11"]);

    // Sorting the KEYS keeps the chart chronological…
    expect([...keys].sort((a, b) => a.localeCompare(b))).toEqual(keys);
    // …sorting the LABELS sorts them alphabetically by month name, which puts
    // February — a month that had not happened yet — before January.
    expect([...labels].sort((a, b) => a.localeCompare(b))).toEqual([
      "Dec 30",
      "Feb 11",
      "Jan 2",
    ]);
  });

  it("cannot tell last March from this March by label alone", () => {
    // The year-less label also collapses two real, distinct buckets, so a
    // label sort has no way to separate them at all.
    const older = dateBucketLabel("2025-03-05", "day");
    const newer = dateBucketLabel("2026-03-05", "day");
    expect(older).toBe(newer);
    expect(older.localeCompare(newer)).toBe(0);
    expect("2025-03-05".localeCompare("2026-03-05")).toBeLessThan(0);
  });

  it.each(GRAINS)("always produces a non-empty %s label", (grain) => {
    const key = dateBucketKey(due("2026-07-09"), grain);
    expect(dateBucketLabel(key, grain).length).toBeGreaterThan(0);
    expect(dateBucketLabel(key, grain)).not.toContain("undefined");
    expect(dateBucketLabel(key, grain)).not.toContain("NaN");
  });
});

describe("lastNBuckets — the burn window ends at today, not at the oldest bucket", () => {
  /** Freeze the clock at local noon of the given local calendar day. */
  function freezeLocalNoon(y: number, monthIndex: number, day: number) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(y, monthIndex, day, 12, 0, 0));
  }

  it("returns exactly n month buckets ending with the current month", () => {
    freezeLocalNoon(2026, 1, 10); // 10 Feb 2026
    expect(lastNBuckets("month", 4)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("rolls the year back correctly when the window crosses New Year", () => {
    freezeLocalNoon(2026, 0, 5); // 5 Jan 2026
    expect(lastNBuckets("month", 3)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });

  it("returns quarter buckets ending with the current quarter", () => {
    freezeLocalNoon(2026, 1, 10); // Q1 2026
    expect(lastNBuckets("quarter", 6)).toEqual([
      "2024-Q4",
      "2025-Q1",
      "2025-Q2",
      "2025-Q3",
      "2025-Q4",
      "2026-Q1",
    ]);
  });

  it("never emits a quarter zero when walking back past January", () => {
    freezeLocalNoon(2026, 0, 31);
    const keys = lastNBuckets("quarter", 5);
    expect(keys).toEqual([
      "2025-Q1",
      "2025-Q2",
      "2025-Q3",
      "2025-Q4",
      "2026-Q1",
    ]);
    for (const k of keys) expect(k).toMatch(/^\d{4}-Q[1-4]$/);
  });

  it.each([
    ["day", 1],
    ["week", 7],
  ] as const)("steps %s buckets by %i calendar day(s), oldest first", (grain, stepDays) => {
    freezeLocalNoon(2026, 1, 10);
    const keys = lastNBuckets(grain, 8);
    expect(keys).toHaveLength(8);
    for (let i = 1; i < keys.length; i++) {
      const prev = new Date(`${keys[i - 1]}T00:00:00.000Z`).getTime();
      const cur = new Date(`${keys[i]}T00:00:00.000Z`).getTime();
      expect(cur - prev).toBe(stepDays * 86400000);
    }
  });

  it.each(GRAINS)("puts the NEWEST %s bucket last, not first", (grain) => {
    // Regression pin for symptom #2: a window that keeps the head of the list
    // keeps the oldest end of the series.
    freezeLocalNoon(2026, 1, 10);
    const keys = lastNBuckets(grain, 5);
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
    const newest = keys.reduce((max, k) => (k.localeCompare(max) > 0 ? k : max));
    expect(keys[keys.length - 1]).toBe(newest);
  });

  it.each(["month", "quarter"] as const)(
    "ends on the very %s bucket today falls into",
    (grain) => {
      // The invariant the window's today-anchor relies on: it cuts at the
      // last bucket <= dateBucketKey(new Date(), grain).
      freezeLocalNoon(2026, 1, 10);
      const keys = lastNBuckets(grain, 6);
      expect(keys[keys.length - 1]).toBe(dateBucketKey(new Date(), grain));
    }
  );

  it.each(GRAINS)("asks for one %s bucket and gets a single one", (grain) => {
    freezeLocalNoon(2026, 1, 10);
    expect(lastNBuckets(grain, 1)).toHaveLength(1);
  });

  it.each(GRAINS)("returns nothing for n = 0 rather than everything (%s)", (grain) => {
    freezeLocalNoon(2026, 1, 10);
    expect(lastNBuckets(grain, 0)).toEqual([]);
  });

  it.each(GRAINS)("never repeats a %s bucket over a two-year window", (grain) => {
    freezeLocalNoon(2026, 1, 10);
    const keys = lastNBuckets(grain, 24);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("holds up on a day that starts a month, a quarter and a year at once", () => {
    freezeLocalNoon(2026, 0, 1); // 1 Jan 2026
    expect(lastNBuckets("month", 2)).toEqual(["2025-12", "2026-01"]);
    expect(lastNBuckets("quarter", 2)).toEqual(["2025-Q4", "2026-Q1"]);
  });

  it("spans a leap February without losing or duplicating a day", () => {
    freezeLocalNoon(2028, 2, 1); // 1 Mar 2028, a leap year
    const keys = lastNBuckets("day", 3);
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
    const spanMs =
      new Date(`${keys[2]}T00:00:00.000Z`).getTime() -
      new Date(`${keys[0]}T00:00:00.000Z`).getTime();
    expect(spanMs).toBe(2 * 86400000);
  });
});

// ─── The dimension bucket a task resolves to ─────────────────────

function emptyMaps(): ResolveMaps {
  return {
    users: new Map(),
    projects: new Map(),
    sections: new Map(),
    portfolios: new Map(),
    taskPortfolios: new Map(),
    projectPortfolios: new Map(),
    cfDefs: new Map(),
    cfValues: new Map(),
  };
}

function task(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: "task_1",
    name: "Check the beam schedule",
    completed: false,
    completedAt: null,
    dueDate: null,
    createdAt: due("2026-01-01"),
    taskType: "TASK",
    priority: "NONE",
    projectId: null,
    sectionId: null,
    assigneeId: null,
    creatorId: null,
    ...overrides,
  };
}

describe("the date dimension — which column a task lands on", () => {
  it("buckets an open task by its due date", () => {
    const dim = resolveTaskDimension(
      task({ dueDate: due("2026-03-05") }),
      "date",
      "month",
      emptyMaps()
    );
    expect(dim.key).toBe("2026-03");
    expect(dim.label).toBe("Mar 2026");
  });

  it("buckets a finished task by when it was FINISHED, not when it was due", () => {
    // A task due in March but closed in January belongs to January's column;
    // otherwise a burnup credits work to a month nobody worked in.
    const dim = resolveTaskDimension(
      task({
        dueDate: due("2026-03-05"),
        completed: true,
        completedAt: due("2026-01-20"),
      }),
      "date",
      "month",
      emptyMaps()
    );
    expect(dim.key).toBe("2026-01");
  });

  it("falls back to the due date when a task is closed with no completedAt", () => {
    const dim = resolveTaskDimension(
      task({ dueDate: due("2026-03-05"), completed: true, completedAt: null }),
      "date",
      "month",
      emptyMaps()
    );
    expect(dim.key).toBe("2026-03");
  });

  it("ignores a stale completedAt while the task is still open", () => {
    const dim = resolveTaskDimension(
      task({
        dueDate: due("2026-03-05"),
        completed: false,
        completedAt: due("2026-01-20"),
      }),
      "date",
      "month",
      emptyMaps()
    );
    expect(dim.key).toBe("2026-03");
  });

  it("defaults to a monthly column when no grain was chosen", () => {
    const dim = resolveTaskDimension(
      task({ dueDate: due("2026-03-05") }),
      "date",
      undefined,
      emptyMaps()
    );
    expect(dim.key).toBe("2026-03");
    expect(dim.label).toBe("Mar 2026");
  });

  it.each(GRAINS)("labels a %s column exactly as dateBucketLabel would", (grain) => {
    const dim = resolveTaskDimension(
      task({ dueDate: due("2026-07-09") }),
      "date",
      grain,
      emptyMaps()
    );
    expect(dim.label).toBe(dateBucketLabel(dim.key, grain));
  });
});

describe("the 'No date' bucket stays off the time axis", () => {
  it("gives an undated task its own bucket instead of dropping it", () => {
    const dim = resolveTaskDimension(task(), "date", "month", emptyMaps());
    expect(dim.key).toBe("__nodate");
    expect(dim.label).toBe("No date");
  });

  it("keeps a finished task with no dates at all in that same bucket", () => {
    const dim = resolveTaskDimension(
      task({ completed: true, completedAt: null, dueDate: null }),
      "date",
      "month",
      emptyMaps()
    );
    expect(dim.key).toBe("__nodate");
  });

  it.each(GRAINS)("uses the same sentinel at every grain (%s)", (grain) => {
    expect(resolveTaskDimension(task(), "date", grain, emptyMaps()).key).toBe(
      "__nodate"
    );
  });

  it("cannot be mistaken for a period: its key parses as no date at all", () => {
    const { key } = resolveTaskDimension(task(), "date", "day", emptyMaps());
    expect(key).not.toMatch(/^\d{4}-\d{2}(-\d{2})?$/);
    expect(key).not.toMatch(/^\d{4}-Q[1-4]$/);
    expect(Number.isNaN(new Date(key).getTime())).toBe(true);
  });

  it("lands in the middle of the periods if left in the plain sort", () => {
    // Why runTaskQuery pulls "__nodate" out of the list BEFORE sorting and
    // pins it ahead of the window rather than trusting the comparison: the
    // two string comparisons the engine uses disagree about where it goes.
    const keys = ["2026-01", "__nodate", "2025-12"];

    // localeCompare (how the buckets are sorted) files it as the OLDEST
    // period — a phantom column at the left edge of the time axis.
    expect([...keys].sort((a, b) => a.localeCompare(b))).toEqual([
      "__nodate",
      "2025-12",
      "2026-01",
    ]);
    // Raw `<` (how buildBurn decides what predates the window) files it as
    // the NEWEST. Either way it is being read as a point in time.
    expect([...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual([
      "2025-12",
      "2026-01",
      "__nodate",
    ]);
  });

  it("does not collide with the sentinel for a task nobody is assigned to", () => {
    const undated = resolveTaskDimension(task(), "date", "month", emptyMaps());
    const unassigned = resolveTaskDimension(
      task(),
      "assignee",
      undefined,
      emptyMaps()
    );
    expect(unassigned.key).toBe("__none");
    expect(unassigned.label).toBe("Unassigned");
    expect(undated.key).not.toBe(unassigned.key);
  });
});
