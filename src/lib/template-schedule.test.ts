import { describe, expect, it } from "vitest";
import { templateTaskDates } from "./template-schedule";

/**
 * TEMPLATE SCHEDULE — the offsets a template ships become the dates a task
 * opens with.
 *
 * Both template paths in POST /api/projects call this, which is the point:
 * the due-date arithmetic used to be written out twice, and the second copy
 * is where a fix goes to become a no-op. Everything here is pure, so it is
 * asserted without a database.
 */

const START = new Date("2026-09-01T00:00:00.000Z");

/** Whole days between two instants, so an assertion reads as a duration. */
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

describe("templateTaskDates", () => {
  it("gives a task a real duration from the two offsets", () => {
    const { startDate, dueDate } = templateTaskDates(START, 2, 16);

    expect(startDate).not.toBeNull();
    expect(dueDate).not.toBeNull();
    expect(daysBetween(START, startDate!)).toBe(2);
    expect(daysBetween(START, dueDate!)).toBe(16);
    // The whole reason fix #5 exists: a 14-day bar instead of a one-day one.
    expect(daysBetween(startDate!, dueDate!)).toBe(14);
  });

  it("keeps the old behaviour for a template that carries only a due date", () => {
    const { startDate, dueDate } = templateTaskDates(START, undefined, 30);

    expect(startDate).toBeNull();
    expect(daysBetween(START, dueDate!)).toBe(30);
  });

  it("dates a start-only task — the survey that starts the 14th and has no close", () => {
    const { startDate, dueDate } = templateTaskDates(START, 13, undefined);

    expect(dueDate).toBeNull();
    expect(daysBetween(START, startDate!)).toBe(13);
  });

  it("keeps a negative offset — work that begins before kickoff", () => {
    const { startDate, dueDate } = templateTaskDates(START, -14, -7);

    expect(daysBetween(START, startDate!)).toBe(-14);
    expect(daysBetween(START, dueDate!)).toBe(-7);
  });

  it("leaves both dates unset when the template carries no offsets", () => {
    expect(templateTaskDates(START, undefined, undefined)).toEqual({
      startDate: null,
      dueDate: null,
    });
  });

  it("allows a same-day start and due — a one-day task is not inverted", () => {
    const { startDate, dueDate } = templateTaskDates(START, 5, 5);

    expect(startDate!.getTime()).toBe(dueDate!.getTime());
  });

  it("clamps a start the template put after its own due date", () => {
    // Both /api/tasks POST and PATCH reject "startDate must be on or before
    // dueDate", so writing this range would seed a row the product refuses to
    // save back.
    const { startDate, dueDate } = templateTaskDates(START, 20, 4);

    expect(daysBetween(START, dueDate!)).toBe(4);
    expect(startDate!.getTime()).toBe(dueDate!.getTime());
  });

  it("does not clamp when there is no due date to clamp against", () => {
    const { startDate, dueDate } = templateTaskDates(START, 20, undefined);

    expect(dueDate).toBeNull();
    expect(daysBetween(START, startDate!)).toBe(20);
  });

  it("does not mutate the project start it is given", () => {
    const anchor = new Date(START);
    templateTaskDates(anchor, 3, 9);

    expect(anchor.getTime()).toBe(START.getTime());
  });

  it("counts calendar days from a start that carries a time of day", () => {
    // POST /api/projects stores `new Date()` when the creator picks no start,
    // so the anchor is an instant, not a midnight.
    const anchor = new Date("2026-09-01T18:42:11.000Z");
    const { startDate, dueDate } = templateTaskDates(anchor, 1, 8);

    expect(daysBetween(anchor, startDate!)).toBe(1);
    expect(daysBetween(anchor, dueDate!)).toBe(8);
  });
});
