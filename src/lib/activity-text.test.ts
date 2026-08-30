import { describe, it, expect } from "vitest";

import { activityText, dueDateActivityText } from "@/lib/activity-text";

describe("activityText", () => {
  it("names a manual due-date change with the date that was picked", () => {
    expect(activityText("DUE_DATE_CHANGED", { dueDate: "2026-09-10" })).toBe(
      "changed due date to Sep 10"
    );
  });

  it("reads a UTC-midnight value as its own calendar day, not the day before", () => {
    // The bug this replaces: `new Date("2026-09-10").toLocaleDateString()`
    // prints Sep 9 for every viewer west of UTC, i.e. the whole office.
    expect(
      activityText("DUE_DATE_CHANGED", {
        dueDate: "2026-09-10T00:00:00.000Z",
      })
    ).toBe("changed due date to Sep 10");
  });

  it("says a cascade moved the date, and names what caused it", () => {
    expect(
      activityText("DUE_DATE_CHANGED", {
        automatic: true,
        dueDate: "2026-09-11",
        previousDueDate: "2026-09-01",
        causedByTaskName: "Schedule site inspection",
      })
    ).toBe(
      "automatically moved the due date to Sep 11 after Schedule site inspection was rescheduled"
    );
  });

  it("names the START date when a cascade moved a task that has no due date", () => {
    expect(
      dueDateActivityText({
        automatic: true,
        dueDate: null,
        startDate: "2026-09-11",
        causedByTaskName: "Schedule site inspection",
      })
    ).toBe(
      "automatically moved the start date to Sep 11 after Schedule site inspection was rescheduled"
    );
  });

  it("still reads as a sentence when the cause was not recorded", () => {
    expect(
      dueDateActivityText({ automatic: true, dueDate: "2026-09-11" })
    ).toBe("automatically moved the due date to Sep 11");
  });

  it("never crashes on a row whose data is missing or the wrong shape", () => {
    expect(activityText("DUE_DATE_CHANGED")).toBe("changed due date to none");
    expect(activityText("DUE_DATE_CHANGED", null)).toBe(
      "changed due date to none"
    );
    expect(
      activityText("DUE_DATE_CHANGED", { dueDate: 12345 as unknown as string })
    ).toBe("changed due date to none");
    expect(activityText("DUE_DATE_CHANGED", { dueDate: "not-a-date" })).toBe(
      "changed due date to none"
    );
  });

  it("covers the ordinary rows", () => {
    expect(activityText("TASK_CREATED")).toBe("created this task");
    expect(activityText("TASK_COMPLETED")).toBe("completed this task");
    expect(activityText("TASK_UNCOMPLETED")).toBe(
      "marked this task incomplete"
    );
    expect(activityText("TASK_RENAMED", { newName: "Roof survey" })).toBe(
      "renamed this task to Roof survey"
    );
    expect(activityText("TASK_RENAMED", {})).toBe("renamed this task");
    expect(activityText("SUBTASK_ADDED", { subtaskName: "Photos" })).toBe(
      "added subtask Photos"
    );
    expect(activityText("SUBTASK_ADDED")).toBe("added a subtask");
  });

  it("humanises an unknown type instead of dropping the row", () => {
    // A type added to the schema later must still read as something.
    expect(activityText("SOMETHING_NEW_HAPPENED")).toBe(
      "something new happened"
    );
  });
});
