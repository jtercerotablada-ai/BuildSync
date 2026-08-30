/**
 * The sentence one Activity row reads as, in one place.
 *
 * WHY THIS EXISTS. There were two activity renderers and only one of them was
 * mounted. `task-comments-section.tsx` carries a careful switch over every
 * ActivityType — and nothing imports it. The feed the user actually sees is
 * inside task-detail-panel.tsx's "All activity" tab, and it printed the raw
 * enum: `activity.type.replace(/_/g, " ").toLowerCase()`, so a row written by
 * the dependency cascade read "due date changed" with no date, no mention of
 * WHICH date it moved to, and no hint that nobody chose it. The whole point of
 * writing those rows was to answer "why did this slip", and the live feed
 * could not say. This module is the one copy both call, so the mounted one can
 * never again be the worse of the two.
 *
 * Plain strings, not JSX, so it is testable in this suite (vitest runs node,
 * no jsdom) and usable from any renderer.
 */

import { dueDateToLocalMidnight } from "@/lib/date-only";

/** The `data` blob is a Json column — anything may be in there. */
export type ActivityData = Record<string, unknown> | null | undefined;

function str(data: ActivityData, key: string): string | null {
  const v = data?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * A stored date-only value as a short human label.
 *
 * Due dates are stored at UTC midnight, so a bare
 * `new Date(value).toLocaleDateString()` prints the day BEFORE for every
 * viewer west of UTC — which is the entire office. Same read as every other
 * date on the schedule surfaces.
 */
function dateLabel(value: string | null): string {
  if (!value) return "none";
  try {
    const d = dueDateToLocalMidnight(value);
    // An unparseable string does NOT throw here — it comes back as an Invalid
    // Date, which formats as the literal words "Invalid Date". Printing that
    // into a history row is exactly the kind of sentence this file exists to
    // stop, so the check is on the value, not on a thrown error.
    if (Number.isNaN(d.getTime())) return "none";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "none";
  }
}

/**
 * What a DUE_DATE_CHANGED row means. Split out because it is the only row
 * type with two readings, and the difference matters to the reader: a date a
 * person picked, versus a date the dependency cascade moved on their behalf.
 */
export function dueDateActivityText(data: ActivityData): string {
  const isAutomatic = data?.automatic === true;
  const dueDate = str(data, "dueDate");
  const startDate = str(data, "startDate");

  if (!isAutomatic) {
    return `changed due date to ${dateLabel(dueDate)}`;
  }

  // A cascade can move a task that carries only a start date. Calling its due
  // date "none" would be a second untrue sentence inside the row written to
  // stop the first one.
  const movedField = !dueDate && startDate ? "start date" : "due date";
  const movedValue = movedField === "start date" ? startDate : dueDate;
  const causedBy = str(data, "causedByTaskName");
  const base = `automatically moved the ${movedField} to ${dateLabel(movedValue)}`;
  return causedBy ? `${base} after ${causedBy} was rescheduled` : base;
}

/**
 * The whole line, minus the actor's name and the timestamp the caller draws.
 *
 * The default deliberately keeps the old behaviour — a humanised enum — so a
 * type added to the schema later reads as something rather than disappearing.
 */
export function activityText(type: string, data?: ActivityData): string {
  switch (type) {
    case "TASK_CREATED":
      return "created this task";
    case "TASK_COMPLETED":
      return "completed this task";
    case "TASK_UNCOMPLETED":
      return "marked this task incomplete";
    case "TASK_ASSIGNED":
      return "assigned this task";
    case "TASK_UNASSIGNED":
      return "unassigned this task";
    case "TASK_MOVED":
      return "moved this task";
    case "TASK_RENAMED": {
      const name = str(data, "newName");
      return name ? `renamed this task to ${name}` : "renamed this task";
    }
    case "TASK_DESCRIPTION_CHANGED":
      return "updated the description";
    case "DUE_DATE_CHANGED":
      return dueDateActivityText(data);
    case "COMMENT_ADDED":
      return "added a comment";
    case "ATTACHMENT_ADDED":
      return "added an attachment";
    case "ATTACHMENT_REMOVED":
      return "removed an attachment";
    case "CUSTOM_FIELD_CHANGED": {
      const field = str(data, "fieldName");
      return field ? `updated ${field}` : "updated a custom field";
    }
    case "SUBTASK_ADDED": {
      const name = str(data, "subtaskName");
      return name ? `added subtask ${name}` : "added a subtask";
    }
    case "DEPENDENCY_ADDED":
      return "added a dependency";
    case "FORM_SUBMITTED":
      return "created this task from a form submission";
    default:
      return type.replace(/_/g, " ").toLowerCase();
  }
}
