import { describe, expect, it } from "vitest";

import {
  dragCommitBody,
  daysUntilDue,
  isTaskOverdue,
  taskSpan,
} from "./task-span";

// Dates arrive from the API as UTC-midnight instants; these strings are
// exactly what the client receives.
const utc = (day: string) => `${day}T00:00:00.000Z`;

describe("taskSpan", () => {
  it("spans start → due when both dates are set", () => {
    const span = taskSpan({ startDate: utc("2026-09-14"), dueDate: utc("2026-09-18") });
    expect(span).not.toBeNull();
    expect(span!.start.getDate()).toBe(14);
    expect(span!.end.getDate()).toBe(18);
    expect(span!.open).toBe(false);
  });

  it("sits a due-only task on its due date as a one-day bar", () => {
    const span = taskSpan({ startDate: null, dueDate: utc("2026-09-18") });
    expect(span!.start.getTime()).toBe(span!.end.getTime());
    expect(span!.start.getDate()).toBe(18);
    expect(span!.open).toBe(false);
  });

  it("draws a START-ONLY task on its start date, marked open", () => {
    // "SOLO INICIO 14 sep" — the field survey that starts the 14th with no
    // committed close date. This used to return nothing at all, so the task
    // was drawn nowhere and then listed as "No date".
    const span = taskSpan({ startDate: utc("2026-09-14"), dueDate: null });
    expect(span).not.toBeNull();
    expect(span!.start.getDate()).toBe(14);
    expect(span!.end.getDate()).toBe(14);
    expect(span!.open).toBe(true);
  });

  it("is null only when BOTH dates are absent", () => {
    expect(taskSpan({ startDate: null, dueDate: null })).toBeNull();
    expect(taskSpan({ dueDate: null })).toBeNull();
  });

  it("reads the UTC calendar day, not the local one", () => {
    // A viewer west of UTC reading these with local getters lands on the
    // 13th and draws every bar a day early.
    const span = taskSpan({ startDate: utc("2026-09-14"), dueDate: null });
    expect(span!.start.getMonth()).toBe(8);
    expect(span!.start.getDate()).toBe(14);
  });

  it("collapses an inverted legacy row onto the due date", () => {
    const span = taskSpan({ startDate: utc("2026-09-20"), dueDate: utc("2026-09-18") });
    expect(span!.start.getTime()).toBe(span!.end.getTime());
    expect(span!.start.getDate()).toBe(18);
  });
});

describe("daysUntilDue", () => {
  const today = new Date(2026, 7, 28); // local midnight, Fri Aug 28

  it("counts whole calendar days forward and back", () => {
    expect(daysUntilDue(today, utc("2026-08-28"))).toBe(0);
    expect(daysUntilDue(today, utc("2026-08-29"))).toBe(1);
    expect(daysUntilDue(today, utc("2026-08-18"))).toBe(-10);
  });

  it("does not drift across a DST transition", () => {
    // Nov 1 2026 is the fall-back Sunday in Miami: a 25-hour day, which a
    // millisecond division would round to the wrong side.
    const oct31 = new Date(2026, 9, 31);
    expect(daysUntilDue(oct31, utc("2026-11-02"))).toBe(2);
  });
});

describe("isTaskOverdue", () => {
  const today = new Date(2026, 7, 28);

  it("flags a task whose due day is strictly before today", () => {
    expect(
      isTaskOverdue({ dueDate: utc("2026-08-18"), completed: false }, today)
    ).toBe(true);
  });

  it("does NOT flag a task due today — the settled product rule", () => {
    expect(
      isTaskOverdue({ dueDate: utc("2026-08-28"), completed: false }, today)
    ).toBe(false);
  });

  it("does not flag a completed task, however late", () => {
    expect(
      isTaskOverdue({ dueDate: utc("2026-01-01"), completed: true }, today)
    ).toBe(false);
  });

  it("does not flag a start-only task — no end date was ever committed", () => {
    expect(
      isTaskOverdue({ startDate: utc("2026-01-01"), dueDate: null, completed: false }, today)
    ).toBe(false);
  });

  it("paints nothing while today is null (server render / first frame)", () => {
    expect(
      isTaskOverdue({ dueDate: utc("2026-08-18"), completed: false }, null)
    ).toBe(false);
  });
});

describe("dragCommitBody", () => {
  const START = utc("2026-09-14");
  const DUE = utc("2026-09-18");

  describe("a task with both dates — behaviour that was verified live", () => {
    it("body move writes both dates and preserves duration", () => {
      expect(dragCommitBody(START, DUE, "move", 3)).toEqual({
        startDate: "2026-09-17",
        dueDate: "2026-09-21",
      });
    });

    it("right handle writes dueDate only", () => {
      expect(dragCommitBody(START, DUE, "right", 2)).toEqual({
        dueDate: "2026-09-20",
      });
    });

    it("left handle writes startDate only and clamps at the due date", () => {
      expect(dragCommitBody(START, DUE, "left", 1)).toEqual({
        startDate: "2026-09-15",
      });
      expect(dragCommitBody(START, DUE, "left", 99)).toEqual({
        startDate: "2026-09-18",
      });
    });

    it("right handle cannot be pulled before the start", () => {
      expect(dragCommitBody(START, DUE, "right", -99)).toEqual({
        dueDate: "2026-09-14",
      });
    });
  });

  describe("a due-only task", () => {
    it("body move writes dueDate only — no startDate is invented", () => {
      expect(dragCommitBody(null, DUE, "move", 1)).toEqual({
        dueDate: "2026-09-19",
      });
    });

    it("right handle pins the left edge so the bar grows instead of sliding", () => {
      expect(dragCommitBody(null, DUE, "right", 4)).toEqual({
        startDate: "2026-09-18",
        dueDate: "2026-09-22",
      });
    });
  });

  describe("a START-ONLY task", () => {
    it("body move moves the start and NEVER invents a due date", () => {
      expect(dragCommitBody(START, null, "move", 5)).toEqual({
        startDate: "2026-09-19",
      });
    });

    it("left handle moves the start, unclamped in both directions", () => {
      expect(dragCommitBody(START, null, "left", -6)).toEqual({
        startDate: "2026-09-08",
      });
      expect(dragCommitBody(START, null, "left", 30)).toEqual({
        startDate: "2026-10-14",
      });
    });

    it("right handle COMMITS an end date and sends both edges", () => {
      // The API validates the pair, so a lone dueDate would be checked
      // against a startDate it cannot see in the same request.
      expect(dragCommitBody(START, null, "right", 7)).toEqual({
        startDate: "2026-09-14",
        dueDate: "2026-09-21",
      });
    });

    it("right handle dragged left cannot commit an end before the start", () => {
      expect(dragCommitBody(START, null, "right", -4)).toEqual({
        startDate: "2026-09-14",
        dueDate: "2026-09-14",
      });
    });
  });

  it("writes nothing for a task with no dates at all", () => {
    expect(dragCommitBody(null, null, "move", 3)).toEqual({});
  });
});
