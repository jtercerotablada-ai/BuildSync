import { describe, expect, it } from "vitest";
import {
  buildTemplateStructure,
  customRowToProjectTemplate,
  normalizeStructure,
  MAX_CAPTURED_PARENT_TASKS,
  MAX_CAPTURED_SUBTASKS,
  type CaptureInput,
  type CaptureTask,
  type CustomTemplateRow,
} from "./custom-templates";

/**
 * CUSTOM TEMPLATES — the parse half and the capture half.
 *
 * `ProjectTemplate.structure` is an untyped Json column: nothing in the
 * database can reject what is written to it, and rows written before the
 * structure grew (sections + accent, and nothing else) are still there. So
 * the guarantee the gallery depends on has to be held here — a row it cannot
 * read degrades to "sections only" and never throws, because a single bad row
 * throwing takes the whole gallery with it.
 *
 * The capture half is where the product decisions live: assignees never carry
 * over, a finished task comes back as work to do, a private task is not in a
 * shared template at all, and dates become offsets from an anchor. Those are
 * asserted here rather than through the endpoint because none of them need a
 * database to be true.
 *
 * No database and no network — vitest.config.ts blanks DATABASE_URL and
 * nothing in this module imports Prisma at runtime.
 */

function row(structure: unknown, overrides: Partial<CustomTemplateRow> = {}): CustomTemplateRow {
  return {
    id: "tpl_1",
    name: "40-year recertification",
    description: null,
    icon: "Building2",
    color: "#c9a84c",
    isPublic: false,
    structure,
    creatorId: "user_1",
    createdAt: "2026-08-28T00:00:00.000Z",
    ...overrides,
  };
}

function task(overrides: Partial<CaptureTask> & { id: string; name: string }): CaptureTask {
  return {
    taskType: "TASK",
    dueDate: null,
    sectionId: "sec_1",
    parentTaskId: null,
    isPrivate: false,
    ...overrides,
  };
}

function capture(overrides: Partial<CaptureInput> = {}): CaptureInput {
  return {
    project: { type: "RECERTIFICATION", color: null, startDate: null },
    sections: [{ id: "sec_1", name: "Field Work" }],
    tasks: [],
    dependencies: [],
    customFields: [],
    ...overrides,
  };
}

describe("normalizeStructure — the old shape still works", () => {
  it("parses a sections-only row saved before the structure grew", () => {
    const st = normalizeStructure({ sections: ["To do", "Doing", "Done"], accent: "blue" });

    expect(st.sections).toEqual(["To do", "Doing", "Done"]);
    expect(st.accent).toBe("blue");
    expect(st.tasks).toBeUndefined();
    expect(st.customFields).toBeUndefined();
    expect(st.defaults).toBeUndefined();
  });

  it("keeps the old row renderable through customRowToProjectTemplate", () => {
    const tpl = customRowToProjectTemplate(row({ sections: ["Field Work"] }));

    expect(tpl.id).toBe("custom:tpl_1");
    expect(tpl.sections).toEqual(["Field Work"]);
    expect(tpl.custom).toBe(true);
    // The row's own color still seeds the project when the structure has none.
    expect(tpl.defaults.color).toBe("#c9a84c");
  });
});

describe("normalizeStructure — the rich shape round-trips", () => {
  const rich = {
    sections: ["Field Work", "Report"],
    accent: "amber",
    defaults: { type: "RECERTIFICATION", stage: "recert.field_work", color: "#111111" },
    workflowTemplateId: "recertification",
    customFields: [
      {
        name: "Responsible",
        type: "DROPDOWN",
        options: [
          { id: "eng", label: "Engineer" },
          { id: "insp", label: "Inspector", color: "#888888" },
        ],
      },
    ],
    tasks: [
      {
        section: "Field Work",
        name: "Site visit",
        type: "MILESTONE",
        relativeDueDate: -14,
        subtasks: ["Photos", "Measurements"],
        customFieldValues: { Responsible: "insp" },
      },
      {
        section: "Report",
        name: "Draft report",
        dependsOn: ["Site visit"],
        relativeDueDate: 21,
      },
    ],
  };

  it("preserves every field the provisioner reads", () => {
    expect(normalizeStructure(rich)).toEqual(rich);
  });

  it("survives a JSON round-trip through the column", () => {
    const once = normalizeStructure(rich);
    expect(normalizeStructure(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });

  it("derives the legacy gate from the stage instead of storing it", () => {
    const tpl = customRowToProjectTemplate(row(rich));

    expect(tpl.defaults.stage).toBe("recert.field_work");
    expect(tpl.defaults.gate).toBe("DESIGN");
    // A gate written into the column by an older client is not carried.
    const stored = normalizeStructure({ ...rich, defaults: { ...rich.defaults, gate: "CLOSEOUT" } });
    expect(stored.defaults).not.toHaveProperty("gate");
  });
});

describe("normalizeStructure — a bad row degrades, it never throws", () => {
  it("returns empty sections for garbage", () => {
    for (const bad of [null, undefined, 42, "sections", [], { sections: "Field Work" }]) {
      expect(() => normalizeStructure(bad)).not.toThrow();
      expect(normalizeStructure(bad).sections).toEqual([]);
    }
  });

  it("drops the unreadable parts and keeps the sections", () => {
    const st = normalizeStructure({
      sections: ["Field Work", "", "  Report  ", 7],
      tasks: [
        { section: "Field Work", name: "Site visit" },
        { section: "Field Work" }, // no name — unmaterializable
        { name: "Orphan" }, // no section — unmaterializable
        "not a task",
        null,
      ],
      customFields: [
        { name: "Responsible", type: "DROPDOWN", options: [{ id: "eng", label: "Engineer" }] },
        { name: "Broken", type: "NOT_A_TYPE" },
        { type: "TEXT" },
      ],
      accent: "chartreuse",
    });

    expect(st.sections).toEqual(["Field Work", "Report"]);
    expect(st.tasks).toEqual([{ section: "Field Work", name: "Site visit" }]);
    expect(st.customFields).toHaveLength(1);
    expect(st.customFields?.[0].name).toBe("Responsible");
    expect(st.accent).toBeUndefined();
  });

  it("falls back to default sections when the gallery renders an empty row", () => {
    const tpl = customRowToProjectTemplate(row({ tasks: [] }));
    expect(tpl.sections).toEqual(["To do", "In progress", "Done"]);
  });

  it("keeps a non-integer relativeDueDate out of the structure", () => {
    const st = normalizeStructure({
      sections: ["Field Work"],
      tasks: [{ section: "Field Work", name: "Site visit", relativeDueDate: "soon" }],
    });
    expect(st.tasks?.[0]).not.toHaveProperty("relativeDueDate");
  });
});

describe("defaults.stage belongs to the template's own type", () => {
  it("keeps a stage from the type's own pipeline", () => {
    const st = normalizeStructure({
      sections: ["Field Work"],
      defaults: { type: "RECERTIFICATION", stage: "recert.city_comments" },
    });
    expect(st.defaults?.stage).toBe("recert.city_comments");
  });

  it("rejects a recert stage on a design template", () => {
    const st = normalizeStructure({
      sections: ["Design"],
      defaults: { type: "DESIGN", stage: "recert.field_work" },
    });
    expect(st.defaults).toEqual({ type: "DESIGN" });
  });

  it("rejects a stage with no type to validate it against", () => {
    const st = normalizeStructure({
      sections: ["Field Work"],
      defaults: { stage: "recert.field_work" },
    });
    expect(st.defaults).toBeUndefined();
  });

  it("rejects a stage key that resolves to nothing", () => {
    const st = normalizeStructure({
      sections: ["Field Work"],
      defaults: { type: "RECERTIFICATION", stage: "recert.renamed_last_year" },
    });
    expect(st.defaults?.stage).toBeUndefined();
  });

  it("accepts a recert stage on a BSIP template — same pipeline", () => {
    const st = normalizeStructure({
      sections: ["Field Work"],
      defaults: { type: "BSIP", stage: "recert.reinspection" },
    });
    expect(st.defaults?.stage).toBe("recert.reinspection");
  });
});

describe("capture — dates become offsets from the anchor", () => {
  it("anchors on the project start date and keeps a negative offset", () => {
    const { structure } = buildTemplateStructure(
      capture({
        project: { type: "RECERTIFICATION", startDate: "2026-01-15T00:00:00.000Z" },
        tasks: [
          task({ id: "t1", name: "Order the survey", dueDate: "2026-01-01T00:00:00.000Z" }),
          task({ id: "t2", name: "Kickoff", dueDate: "2026-01-15T00:00:00.000Z" }),
          task({ id: "t3", name: "Report due", dueDate: "2026-03-01T00:00:00.000Z" }),
        ],
      })
    );

    expect(structure.tasks?.map((t) => t.relativeDueDate)).toEqual([-14, 0, 45]);
  });

  it("anchors on the earliest due date when the project has no start date", () => {
    const { structure } = buildTemplateStructure(
      capture({
        tasks: [
          task({ id: "t1", name: "Report due", dueDate: "2026-03-10T00:00:00.000Z" }),
          task({ id: "t2", name: "Site visit", dueDate: "2026-03-01T00:00:00.000Z" }),
        ],
      })
    );

    expect(structure.tasks?.map((t) => t.relativeDueDate)).toEqual([9, 0]);
  });

  it("measures whole calendar days from a start date that carries a time", () => {
    // POST /api/projects stores `new Date()` when the creator picks no start,
    // so the anchor is an instant; due dates are UTC midnight. Differencing
    // them raw rounds the fraction away and every offset lands a day early.
    const { structure } = buildTemplateStructure(
      capture({
        project: { type: "RECERTIFICATION", startDate: "2026-03-02T18:42:11.000Z" },
        tasks: [
          task({ id: "t1", name: "Site visit", dueDate: "2026-03-09T00:00:00.000Z" }),
          task({ id: "t2", name: "Report due", dueDate: "2026-05-15T00:00:00.000Z" }),
        ],
      })
    );

    expect(structure.tasks?.map((t) => t.relativeDueDate)).toEqual([7, 74]);
  });

  it("omits relativeDueDate entirely when nothing is dated", () => {
    const { structure } = buildTemplateStructure(
      capture({ tasks: [task({ id: "t1", name: "Site visit" })] })
    );

    expect(structure.tasks).toEqual([{ section: "Field Work", name: "Site visit" }]);
  });

  it("leaves an undated task undated inside a dated plan", () => {
    const { structure } = buildTemplateStructure(
      capture({
        project: { type: "RECERTIFICATION", startDate: "2026-01-01T00:00:00.000Z" },
        tasks: [
          task({ id: "t1", name: "Site visit", dueDate: "2026-01-11T00:00:00.000Z" }),
          task({ id: "t2", name: "Someday" }),
        ],
      })
    );

    expect(structure.tasks?.[0].relativeDueDate).toBe(10);
    expect(structure.tasks?.[1]).not.toHaveProperty("relativeDueDate");
  });
});

describe("capture — dependencies are names, and only names inside the set", () => {
  it("resolves a dependency to the blocking task's name", () => {
    const { structure } = buildTemplateStructure(
      capture({
        tasks: [
          task({ id: "t1", name: "Site visit" }),
          task({ id: "t2", name: "Draft report" }),
        ],
        dependencies: [{ dependentTaskId: "t2", blockingTaskId: "t1" }],
      })
    );

    expect(structure.tasks?.[1].dependsOn).toEqual(["Site visit"]);
  });

  it("drops a dependency pointing outside the captured set", () => {
    const { structure } = buildTemplateStructure(
      capture({
        tasks: [
          task({ id: "t1", name: "Draft report" }),
          task({ id: "t2", name: "Fee agreement", isPrivate: true }),
        ],
        dependencies: [
          // Another project's task, and a private one — neither has a name a
          // template could reference.
          { dependentTaskId: "t1", blockingTaskId: "other_project_task" },
          { dependentTaskId: "t1", blockingTaskId: "t2" },
        ],
      })
    );

    expect(structure.tasks).toHaveLength(1);
    expect(structure.tasks?.[0]).not.toHaveProperty("dependsOn");
  });

  it("drops a link whose blocking name two captured tasks share", () => {
    // The provisioner resolves `dependsOn` through a name→id map where the
    // last writer wins, so this link would materialize against the SECOND
    // "Photo documentation" — a Gantt arrow to the wrong task, in the wrong
    // section, with nothing anywhere saying so.
    const { structure } = buildTemplateStructure(
      capture({
        sections: [
          { id: "sec_1", name: "Field Work" },
          { id: "sec_2", name: "Report" },
        ],
        tasks: [
          task({ id: "t1", name: "Photo documentation", sectionId: "sec_1" }),
          task({ id: "t2", name: "Photo documentation", sectionId: "sec_2" }),
          task({ id: "t3", name: "Draft report", sectionId: "sec_2" }),
        ],
        dependencies: [{ dependentTaskId: "t3", blockingTaskId: "t1" }],
      })
    );

    expect(structure.tasks?.map((t) => t.name)).toEqual([
      "Photo documentation",
      "Photo documentation",
      "Draft report",
    ]);
    expect(structure.tasks?.every((t) => !t.dependsOn)).toBe(true);
  });
});

describe("capture — what carries over and what does not", () => {
  it("skips private tasks and their names entirely", () => {
    const { structure } = buildTemplateStructure(
      capture({
        tasks: [
          task({ id: "t1", name: "Site visit" }),
          task({ id: "t2", name: "Owner's fee dispute", isPrivate: true }),
          task({ id: "t3", name: "Private detail", parentTaskId: "t2" }),
          task({ id: "t4", name: "Photos", parentTaskId: "t1" }),
        ],
      })
    );

    expect(JSON.stringify(structure)).not.toContain("fee dispute");
    // A subtask whose parent was skipped has nowhere to live either.
    expect(JSON.stringify(structure)).not.toContain("Private detail");
    expect(structure.tasks).toEqual([
      { section: "Field Work", name: "Site visit", subtasks: ["Photos"] },
    ]);
  });

  it("captures roles as custom-field values but never an assignee", () => {
    const { structure } = buildTemplateStructure(
      capture({
        customFields: [
          {
            id: "f1",
            name: "Responsible",
            type: "DROPDOWN",
            options: [{ id: "insp", label: "Inspector" }],
          },
          { id: "f2", name: "Bogus", type: "NOT_A_TYPE" },
        ],
        tasks: [
          task({
            id: "t1",
            name: "Site visit",
            customFieldValues: [
              { fieldId: "f1", value: "insp" },
              { fieldId: "f2", value: "x" },
              { fieldId: "gone", value: "y" },
            ],
          }),
        ],
      })
    );

    expect(structure.customFields).toEqual([
      { name: "Responsible", type: "DROPDOWN", options: [{ id: "insp", label: "Inspector" }] },
    ]);
    expect(structure.tasks?.[0].customFieldValues).toEqual({ Responsible: "insp" });
  });

  it("keeps the milestone glyph and groups tasks by section order", () => {
    const { structure, truncated } = buildTemplateStructure(
      capture({
        sections: [
          { id: "sec_1", name: "Field Work" },
          { id: "sec_2", name: "Report" },
        ],
        tasks: [
          task({ id: "t1", name: "Report issued", sectionId: "sec_2", taskType: "MILESTONE" }),
          task({ id: "t2", name: "Site visit", sectionId: "sec_1" }),
          task({ id: "t3", name: "No section", sectionId: null }),
        ],
      })
    );

    expect(structure.tasks).toEqual([
      { section: "Field Work", name: "Site visit" },
      { section: "Report", name: "Report issued", type: "MILESTONE" },
    ]);
    // A task whose Section row was deleted (SetNull) cannot be placed — it is
    // reported, not quietly missing from a plan the user was given a count for.
    expect(truncated?.parentTasks).toBe(1);
    expect(truncated?.message).toBe(
      "1 task was left out because no matching section is part of the template."
    );
  });

  it("never carries the project's stage — a template is a plan, not a record", () => {
    const { structure } = buildTemplateStructure(
      capture({ project: { type: "RECERTIFICATION", color: "#c9a84c" } })
    );

    // The source job may well be signed off; starting the next twenty there
    // would open every one of them already closed out.
    expect(structure.defaults).toEqual({
      type: "RECERTIFICATION",
      color: "#c9a84c",
    });
  });

  it("keeps a PEOPLE field but never the people in it", () => {
    const { structure } = buildTemplateStructure(
      capture({
        customFields: [
          { id: "f1", name: "Reviewed by", type: "PEOPLE" },
          { id: "f2", name: "Responsible", type: "DROPDOWN", options: [{ id: "eng", label: "Engineer" }] },
        ],
        tasks: [
          task({
            id: "t1",
            name: "Site visit",
            customFieldValues: [
              { fieldId: "f1", value: ["user_1", "user_2"] },
              { fieldId: "f2", value: "eng" },
            ],
          }),
        ],
      })
    );

    expect(structure.customFields?.map((f) => f.name)).toEqual([
      "Reviewed by",
      "Responsible",
    ]);
    expect(structure.tasks?.[0].customFieldValues).toEqual({ Responsible: "eng" });
    expect(JSON.stringify(structure)).not.toContain("user_1");
  });

  it("captures the skeleton only when includeTasks is false", () => {
    const { structure } = buildTemplateStructure(
      capture({
        includeTasks: false,
        tasks: [task({ id: "t1", name: "Site visit" })],
        dependencies: [],
      })
    );

    expect(structure.sections).toEqual(["Field Work"]);
    expect(structure.tasks).toBeUndefined();
  });
});

describe("capture — the caps report what they left out", () => {
  it("says nothing when nothing was dropped", () => {
    const result = buildTemplateStructure(
      capture({ tasks: [task({ id: "t1", name: "Site visit" })] })
    );
    expect(result.truncated).toBeUndefined();
  });

  it("truncates parent tasks and names the count", () => {
    const tasks: CaptureTask[] = [];
    for (let i = 0; i < MAX_CAPTURED_PARENT_TASKS + 5; i++) {
      tasks.push(task({ id: `t${i}`, name: `Task ${i}` }));
    }
    // Two subtasks hanging off a parent the cap will drop.
    tasks.push(task({ id: "s1", name: "Sub A", parentTaskId: `t${MAX_CAPTURED_PARENT_TASKS}` }));
    tasks.push(task({ id: "s2", name: "Sub B", parentTaskId: `t${MAX_CAPTURED_PARENT_TASKS}` }));

    const { structure, truncated } = buildTemplateStructure(capture({ tasks }));

    expect(structure.tasks).toHaveLength(MAX_CAPTURED_PARENT_TASKS);
    expect(truncated?.parentTasks).toBe(5);
    expect(truncated?.subtasks).toBe(2);
    expect(truncated?.message).toContain("5 tasks");
    expect(truncated?.message).toContain("2 subtasks");
  });

  it("truncates subtasks across the whole plan, not per task", () => {
    const tasks: CaptureTask[] = [
      task({ id: "p1", name: "Parent 1" }),
      task({ id: "p2", name: "Parent 2" }),
    ];
    for (let i = 0; i < MAX_CAPTURED_SUBTASKS; i++) {
      tasks.push(task({ id: `a${i}`, name: `A${i}`, parentTaskId: "p1" }));
    }
    tasks.push(task({ id: "b1", name: "B1", parentTaskId: "p2" }));

    const { structure, truncated } = buildTemplateStructure(capture({ tasks }));

    expect(structure.tasks?.[0].subtasks).toHaveLength(MAX_CAPTURED_SUBTASKS);
    expect(structure.tasks?.[1]).not.toHaveProperty("subtasks");
    expect(truncated?.parentTasks).toBe(0);
    expect(truncated?.subtasks).toBe(1);
    expect(truncated?.message).toBe(
      "1 subtask was left out because this project is larger than a template can hold."
    );
  });

  it("reports the sections past the cap, and the tasks filed under them", () => {
    const sections = Array.from({ length: 22 }, (_, i) => ({
      id: `sec_${i}`,
      name: `Section ${i}`,
    }));
    const { structure, truncated } = buildTemplateStructure(
      capture({
        sections,
        tasks: [task({ id: "t1", name: "Late task", sectionId: "sec_21" })],
      })
    );

    // The workspace PUT would truncate the row to 20 sections on the first
    // edit; capturing 22 makes that a silent loss instead of a warning.
    expect(structure.sections).toHaveLength(20);
    expect(truncated?.sections).toBe(2);
    expect(truncated?.parentTasks).toBe(1);
    expect(truncated?.message).toContain("2 sections were left out");
    expect(truncated?.message).toContain("1 task was left out");
  });

  it("reports a custom field whose type a template cannot carry", () => {
    const { truncated } = buildTemplateStructure(
      capture({
        customFields: [
          { id: "f1", name: "Linked drawing", type: "REFERENCE" },
          { id: "f2", name: "Time on site", type: "TIME_TRACKING" },
        ],
      })
    );

    expect(truncated?.customFields).toBe(2);
    expect(truncated?.message).toBe(
      "2 custom fields were left out because a template cannot carry that field type."
    );
  });

  it("says so when the read was bounded before the caps were reached", () => {
    const { truncated } = buildTemplateStructure(
      capture({ tasks: [task({ id: "t1", name: "Site visit" })], moreTasksExist: true })
    );

    expect(truncated?.message).toBe(
      "Some tasks were left out because this project is larger than a template can hold."
    );
  });
});

describe("captured instructions", () => {
  it("carries a task's description and priority into the template", () => {
    const out = buildTemplateStructure({
      project: { type: "RECERTIFICATION", color: "#4573D2", startDate: null },
      sections: [{ id: "s1", name: "Inspection" }],
      tasks: [
        {
          id: "t1",
          name: "Structural inspection",
          taskType: "TASK",
          description: "  Photograph every elevation; note spalling by column line.  ",
          priority: "HIGH",
          dueDate: null,
          sectionId: "s1",
          parentTaskId: null,
          isPrivate: false,
        },
      ],
      dependencies: [],
      customFields: [],
    });
    const task = out.structure.tasks?.[0];
    expect(task?.description).toBe(
      "Photograph every elevation; note spalling by column line."
    );
    expect(task?.priority).toBe("HIGH");
  });

  it("omits an empty description and a NONE priority rather than storing noise", () => {
    const out = buildTemplateStructure({
      project: { type: "RECERTIFICATION", color: "#4573D2", startDate: null },
      sections: [{ id: "s1", name: "Inspection" }],
      tasks: [
        {
          id: "t1",
          name: "Schedule site visit",
          taskType: "TASK",
          description: "   ",
          priority: "NONE",
          dueDate: null,
          sectionId: "s1",
          parentTaskId: null,
          isPrivate: false,
        },
      ],
      dependencies: [],
      customFields: [],
    });
    const task = out.structure.tasks?.[0];
    expect(task).toBeDefined();
    expect(task).not.toHaveProperty("description");
    expect(task).not.toHaveProperty("priority");
  });
});
