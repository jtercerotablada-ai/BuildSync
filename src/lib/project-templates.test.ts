import { describe, expect, it } from "vitest";

import { PROJECT_TEMPLATES, type ProjectTemplateTask } from "./project-templates";

/**
 * Guards the template SCHEDULE, not the copy. A project created from a
 * template used to open as a wall of one-day bars because tasks carried
 * only a relativeDueDate; relativeStartDate is what gives each bar a
 * length. These invariants exist so the next person editing 1700 lines of
 * template data cannot silently reintroduce that — or ship a task whose
 * bar runs backwards.
 */

/** Every parent task in every built-in template, tagged with enough
 *  context that a failure names the exact task instead of an index. */
const ALL_TASKS: { template: string; task: ProjectTemplateTask }[] =
  PROJECT_TEMPLATES.flatMap((t) =>
    (t.tasks ?? []).map((task) => ({ template: t.id, task })),
  );

/** Milestones and approvals are points in time (the PE seal, the city
 *  submittal). The Timeline draws them as markers, not bars, so a start
 *  date on one is meaningless at best and a stray bar at worst. */
const isPointInTime = (task: ProjectTemplateTask) =>
  task.type === "MILESTONE" || task.type === "APPROVAL";

const label = (e: { template: string; task: ProjectTemplateTask }) =>
  `${e.template} :: ${e.task.name}`;

describe("PROJECT_TEMPLATES schedule invariants", () => {
  it("ships tasks to check (guards against an empty flatMap passing vacuously)", () => {
    expect(ALL_TASKS.length).toBeGreaterThan(0);
    expect(
      ALL_TASKS.filter((e) => e.task.relativeStartDate !== undefined).length,
    ).toBeGreaterThan(0);
  });

  it("never carries a relativeStartDate without a relativeDueDate", () => {
    const orphans = ALL_TASKS.filter(
      (e) =>
        e.task.relativeStartDate !== undefined &&
        typeof e.task.relativeDueDate !== "number",
    ).map(label);
    expect(orphans).toEqual([]);
  });

  it("never starts a task after its own due date", () => {
    const backwards = ALL_TASKS.filter(
      (e) =>
        typeof e.task.relativeStartDate === "number" &&
        typeof e.task.relativeDueDate === "number" &&
        e.task.relativeStartDate > e.task.relativeDueDate,
    ).map((e) => `${label(e)} (${e.task.relativeStartDate} > ${e.task.relativeDueDate})`);
    expect(backwards).toEqual([]);
  });

  it("uses whole days for every relativeStartDate", () => {
    const fractional = ALL_TASKS.filter(
      (e) =>
        e.task.relativeStartDate !== undefined &&
        !Number.isInteger(e.task.relativeStartDate),
    ).map(label);
    expect(fractional).toEqual([]);
  });

  it("gives no MILESTONE or APPROVAL a relativeStartDate", () => {
    const markersWithBars = ALL_TASKS.filter(
      (e) => isPointInTime(e.task) && e.task.relativeStartDate !== undefined,
    ).map(label);
    expect(markersWithBars).toEqual([]);
  });

  // Note what this does and does not claim: every dated bar task HAS a
  // start, which is what makes it a bar the provisioner can write a span
  // for. It does NOT claim every span is longer than a day — a step with no
  // slack before the next one legitimately starts and ends on the same day,
  // and inventing wider durations would be a scheduling opinion.
  it("gives every dated bar task a start, so none is written with no span at all", () => {
    const undated = ALL_TASKS.filter(
      (e) =>
        !isPointInTime(e.task) &&
        typeof e.task.relativeDueDate === "number" &&
        e.task.relativeStartDate === undefined,
    ).map(label);
    expect(undated).toEqual([]);
  });

  it("names only real tasks in dependsOn, so the derived starts are anchored", () => {
    const dangling: string[] = [];
    for (const template of PROJECT_TEMPLATES) {
      const names = new Set((template.tasks ?? []).map((t) => t.name));
      for (const task of template.tasks ?? []) {
        for (const dep of task.dependsOn ?? []) {
          if (!names.has(dep)) dangling.push(`${template.id} :: ${task.name} -> ${dep}`);
        }
      }
    }
    expect(dangling).toEqual([]);
  });

  it("starts no task before the tasks it depends on are due", () => {
    const early: string[] = [];
    for (const template of PROJECT_TEMPLATES) {
      const dueByName = new Map(
        (template.tasks ?? []).map((t) => [t.name, t.relativeDueDate]),
      );
      for (const task of template.tasks ?? []) {
        if (typeof task.relativeStartDate !== "number") continue;
        for (const dep of task.dependsOn ?? []) {
          const depDue = dueByName.get(dep);
          if (typeof depDue !== "number") continue;
          // Equal is allowed: the clamp to relativeDueDate can pull a start
          // back onto the predecessor's due date (a same-day handoff).
          if (task.relativeStartDate < depDue) {
            early.push(
              `${template.id} :: ${task.name} starts ${task.relativeStartDate}, "${dep}" due ${depDue}`,
            );
          }
        }
      }
    }
    expect(early).toEqual([]);
  });
});
