/**
 * Custom (user-created) project templates.
 *
 * A custom template is a `ProjectTemplate` DB row (prisma model) whose
 * `structure` JSON mirrors the buildable parts of the built-in
 * ProjectTemplate shape from project-templates.ts. That symmetry is the
 * whole point: once mapped, a custom template renders in the gallery and
 * creates a project through the EXACT same inline path as a built-in one
 * (POST /api/projects with sections + customFields + tasks) — so there is
 * one creation code path, not two.
 *
 * The structure grew: it used to carry only `sections` + `accent`, and rows
 * saved in that shape are still in the database. Everything here parses the
 * old shape and the new one, and a structure it cannot read degrades to
 * "sections only" rather than throwing — the column has no schema behind it,
 * so a single bad row must never blank the gallery.
 *
 * Used by:
 *   - components/projects/create-project-gallery.tsx  (modal gallery)
 *   - app/(dashboard)/templates/page.tsx              (full-page gallery)
 *   - components/projects/new-template-dialog.tsx     (serializes on save)
 *   - api/projects/[projectId]/save-as-template       (captures a real job)
 */

import type { ProjectGate } from "@prisma/client";
import { isStageValidForType, legacyGateFor, type StageKey } from "./pipelines";
import type {
  ProjectTemplate,
  ProjectTemplateTask,
  ProjectTemplateCustomField,
} from "./project-templates";

/** The project types a template can seed — the built-in union, reused so the
 *  two cannot drift. */
export type TemplateProjectType = NonNullable<ProjectTemplate["defaults"]["type"]>;

/**
 * Template defaults. `stage` is new and `gate` is deliberately ABSENT: the
 * gate is derived from the stage by legacyGateFor() at read time, and a
 * second stored copy is exactly how the pair desyncs. A stored `gate` from an
 * old row is dropped on parse.
 */
export interface CustomTemplateDefaults {
  type?: TemplateProjectType;
  /** Pipeline stage key the new project starts at, e.g. "recert.field_work".
   *  Only ever kept when it belongs to `type`'s own pipeline. Capturing a
   *  project does NOT write one — see buildTemplateStructure's exclusions. */
  stage?: StageKey;
  color?: string;
}

/** The JSON persisted in ProjectTemplate.structure. */
export interface CustomTemplateStructure {
  sections: string[];
  customFields?: ProjectTemplateCustomField[];
  tasks?: ProjectTemplateTask[];
  defaults?: CustomTemplateDefaults;
  accent?: ProjectTemplate["accent"];
  workflowTemplateId?: string;
}

/** Raw row shape returned by GET /api/workspace/templates. */
export interface CustomTemplateRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isPublic: boolean;
  structure: unknown;
  creatorId: string;
  createdAt: string;
  creator?: { id: string; name: string | null; image: string | null } | null;
  mine?: boolean;
}

/** A built-in ProjectTemplate augmented with custom-template metadata. */
export type CustomProjectTemplate = ProjectTemplate & {
  custom: true;
  creator?: CustomTemplateRow["creator"];
  mine?: boolean;
  /** Present when the template names a starting stage; `defaults.gate` beside
   *  it is derived from this and never stored. */
  defaults: CustomTemplateDefaults & { gate?: ProjectGate };
};

const ACCENTS: ProjectTemplate["accent"][] = [
  "amber",
  "blue",
  "violet",
  "rose",
  "emerald",
  "slate",
];

const PROJECT_TYPES: TemplateProjectType[] = [
  "CONSTRUCTION",
  "DESIGN",
  "RECERTIFICATION",
  "PERMIT",
  "BSIP",
];

const FIELD_TYPES: ProjectTemplateCustomField["type"][] = [
  "TEXT",
  "NUMBER",
  "DATE",
  "DROPDOWN",
  "MULTI_SELECT",
  "PEOPLE",
  "CHECKBOX",
  "CURRENCY",
  "PERCENTAGE",
];

const TASK_TYPES: NonNullable<ProjectTemplateTask["type"]>[] = [
  "TASK",
  "MILESTONE",
  "APPROVAL",
];

const TASK_PRIORITIES: NonNullable<ProjectTemplateTask["priority"]>[] = [
  "NONE",
  "LOW",
  "MEDIUM",
  "HIGH",
];

/** Prefix so a custom template id can never collide with a built-in id and
 *  the galleries can tell the two apart at pick time. */
export const CUSTOM_PREFIX = "custom:";

export function isCustomTemplateId(id: string): boolean {
  return id.startsWith(CUSTOM_PREFIX);
}

export function customIdToDbId(id: string): string {
  return isCustomTemplateId(id) ? id.slice(CUSTOM_PREFIX.length) : id;
}

function trimmedString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, max) : undefined;
}

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const s = trimmedString(item, max);
    if (s) out.push(s);
  }
  return out;
}

function normalizeOptions(
  raw: unknown
): NonNullable<ProjectTemplateCustomField["options"]> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: NonNullable<ProjectTemplateCustomField["options"]> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = trimmedString(o.id, 80);
    const label = trimmedString(o.label, 80);
    // The id is what a task's customFieldValues reference; an option without
    // one can never be selected, so it is not worth storing.
    if (!id || !label) continue;
    const color = trimmedString(o.color, 32);
    out.push({ id, label, ...(color ? { color } : {}) });
  }
  return out.length > 0 ? out : undefined;
}

function normalizeDefaults(raw: unknown): CustomTemplateDefaults | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const d = raw as Record<string, unknown>;
  const type = PROJECT_TYPES.includes(d.type as TemplateProjectType)
    ? (d.type as TemplateProjectType)
    : undefined;
  const color = trimmedString(d.color, 32);
  // A stage key only means anything inside its own pipeline: a recert stage
  // on a design template provisions a job whose strip shows a stage nobody
  // can move. Without a type there is no pipeline to check it against, so the
  // stage is dropped rather than trusted.
  const stage =
    typeof d.stage === "string" && isStageValidForType(type ?? null, d.stage)
      ? (d.stage as StageKey)
      : undefined;
  if (!type && !color && !stage) return undefined;
  return {
    ...(type ? { type } : {}),
    ...(stage ? { stage } : {}),
    ...(color ? { color } : {}),
  };
}

function normalizeCustomFields(
  raw: unknown
): ProjectTemplateCustomField[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ProjectTemplateCustomField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    const name = trimmedString(f.name, 80);
    if (!name) continue;
    if (!FIELD_TYPES.includes(f.type as ProjectTemplateCustomField["type"])) continue;
    const type = f.type as ProjectTemplateCustomField["type"];
    const options = normalizeOptions(f.options);
    out.push({ name, type, ...(options ? { options } : {}) });
  }
  return out.length > 0 ? out : undefined;
}

function normalizeTasks(raw: unknown): ProjectTemplateTask[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ProjectTemplateTask[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const section = trimmedString(t.section, 80);
    const name = trimmedString(t.name, 200);
    // Both are required by the provisioner (it matches the section by name);
    // a task missing either can never be materialized.
    if (!section || !name) continue;
    const task: ProjectTemplateTask = { section, name };
    if (TASK_TYPES.includes(t.type as NonNullable<ProjectTemplateTask["type"]>)) {
      task.type = t.type as NonNullable<ProjectTemplateTask["type"]>;
    }
    // The step's instructions and its priority. This validator drops anything
    // it does not name, so a field the capture writes but this does not read is
    // silently lost on the way into the column — which is how the description
    // went missing the first time.
    const description = trimmedString(t.description, 5000);
    if (description) task.description = description;
    if (TASK_PRIORITIES.includes(t.priority as NonNullable<ProjectTemplateTask["priority"]>)) {
      task.priority = t.priority as NonNullable<ProjectTemplateTask["priority"]>;
    }
    // Whole days only, and negative is legitimate ("order the survey two
    // weeks before kickoff").
    if (typeof t.relativeDueDate === "number" && Number.isInteger(t.relativeDueDate)) {
      task.relativeDueDate = t.relativeDueDate;
    }
    const dependsOn = stringList(t.dependsOn, 200);
    if (dependsOn.length > 0) task.dependsOn = dependsOn;
    const subtasks = stringList(t.subtasks, 200);
    if (subtasks.length > 0) task.subtasks = subtasks;
    if (
      t.customFieldValues &&
      typeof t.customFieldValues === "object" &&
      !Array.isArray(t.customFieldValues)
    ) {
      task.customFieldValues = t.customFieldValues as Record<string, unknown>;
    }
    out.push(task);
  }
  return out.length > 0 ? out : undefined;
}

/** Defensively normalize an untyped `structure` JSON into a well-formed
 *  structure — old (sections-only) or malformed rows degrade to safe defaults
 *  instead of crashing the gallery. */
export function normalizeStructure(raw: unknown): CustomTemplateStructure {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sections = Array.isArray(s.sections)
    ? (s.sections as unknown[])
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
    : [];
  const accent = ACCENTS.includes(s.accent as ProjectTemplate["accent"])
    ? (s.accent as ProjectTemplate["accent"])
    : undefined;
  return {
    sections,
    customFields: normalizeCustomFields(s.customFields),
    tasks: normalizeTasks(s.tasks),
    defaults: normalizeDefaults(s.defaults),
    accent,
    workflowTemplateId: trimmedString(s.workflowTemplateId, 80),
  };
}

/** Map a DB custom-template row into the client ProjectTemplate shape so the
 *  gallery renders + creates it identically to a built-in template. */
export function customRowToProjectTemplate(
  row: CustomTemplateRow
): CustomProjectTemplate {
  const st = normalizeStructure(row.structure);
  const color = st.defaults?.color || row.color || undefined;
  const stage = st.defaults?.stage;
  return {
    id: `${CUSTOM_PREFIX}${row.id}`,
    name: row.name,
    description: row.description || "Custom template created by your team.",
    icon: row.icon || "Folder",
    accent: st.accent || "slate",
    // Custom templates live under their own "Created by your team" tab; the
    // category value is never used to filter them, so any valid value works.
    category: "for_you",
    defaults: {
      ...st.defaults,
      ...(color ? { color } : {}),
      // Derived here, never stored — see legacyGateFor().
      ...(stage ? { gate: legacyGateFor(stage) } : {}),
    },
    sections: st.sections.length ? st.sections : ["To do", "In progress", "Done"],
    customFields: st.customFields,
    tasks: st.tasks,
    workflowTemplateId: st.workflowTemplateId,
    custom: true,
    creator: row.creator,
    mine: row.mine,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Capture — turning a real project into a template
// ───────────────────────────────────────────────────────────────────────────

/** A task row as the capture endpoint reads it. */
export interface CaptureTask {
  id: string;
  name: string;
  taskType: NonNullable<ProjectTemplateTask["type"]>;
  description?: string | null;
  priority?: NonNullable<ProjectTemplateTask["priority"]> | null;
  dueDate: Date | string | null;
  sectionId: string | null;
  parentTaskId: string | null;
  isPrivate: boolean;
  customFieldValues?: { fieldId: string; value: unknown }[];
}

export interface CaptureInput {
  project: {
    type?: TemplateProjectType | null;
    color?: string | null;
    startDate?: Date | string | null;
  };
  /** Sections in position order. */
  sections: { id: string; name: string }[];
  /** Every task of the project (parents and subtasks) in position order. */
  tasks: CaptureTask[];
  /** TaskDependency rows for the project — resolved to task NAMES below. */
  dependencies: { dependentTaskId: string; blockingTaskId: string }[];
  /** The project's custom-field definitions, in position order. */
  customFields: { id: string; name: string; type: string; options?: unknown }[];
  workflowTemplateId?: string | null;
  /** False captures the skeleton only: sections, fields and defaults. */
  includeTasks?: boolean;
  /** The reader bounded its query and the project has more tasks than it
   *  returned — so the counts below understate what was left out, and the
   *  user is told that rather than given a number that is too small. */
  moreTasksExist?: boolean;
}

export interface CaptureTruncation {
  /** Parent tasks left out, for any reason. */
  parentTasks: number;
  /** Subtasks left out, including those of a dropped parent. */
  subtasks: number;
  /** Sections left out because the cap was reached. */
  sections: number;
  /** Custom fields left out — an unsupported type, or the cap. */
  customFields: number;
  /** English, ready for a toast — the user must never be told "saved" when
   *  part of the plan was silently dropped. */
  message: string;
}

export interface CaptureResult {
  structure: CustomTemplateStructure;
  truncated?: CaptureTruncation;
}

/**
 * The biggest built-in template is 37 tasks / 183 subtasks, so these leave
 * plenty of room for a real job. They are bounded from ABOVE by the apply
 * path, not by what a JSON column can hold: POST /api/projects materializes a
 * template with one sequential `task.create` per parent plus one
 * `customFieldValue.create` per value, all inside a single transaction with a
 * 20 s timeout. A capture bigger than that transaction can replay saves fine
 * and then fails at create time, rolling the whole project back — which is a
 * worse outcome than telling the user at capture time that some of the plan
 * did not fit.
 */
export const MAX_CAPTURED_PARENT_TASKS = 150;
export const MAX_CAPTURED_SUBTASKS = 600;

/** The same caps the workspace-templates PUT applies when it sanitizes an
 *  incoming structure. Capturing past them would work until the first edit
 *  saved the row back through that sanitizer, which would truncate the
 *  sections server-side and orphan every task filed under the dropped ones. */
const MAX_CAPTURED_SECTIONS = 20;
const MAX_CAPTURED_CUSTOM_FIELDS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The UTC calendar day of an instant, as a UTC-midnight timestamp.
 *
 * A due date is stored at UTC midnight (the composers send "YYYY-MM-DD" and
 * the API stores `new Date(str)`), but `Project.startDate` is a real instant:
 * POST /api/projects stores the moment of creation when nobody picked a start.
 * Differencing the two raw leaves a fraction of a day that rounds away, and
 * every offset in the captured plan comes out one day short — silently, and
 * forever, in every project made from the template.
 */
function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** "1 task was left out" / "2 tasks and 1 sub-task were left out". */
function leftOut(parts: { n: number; noun: string }[]): string {
  const worded = parts.map((p) => `${p.n} ${p.noun}${p.n === 1 ? "" : "s"}`);
  const subject =
    worded.length > 1
      ? `${worded.slice(0, -1).join(", ")} and ${worded[worded.length - 1]}`
      : worded[0];
  const singular = parts.length === 1 && parts[0].n === 1;
  return `${subject} ${singular ? "was" : "were"} left out`;
}

/**
 * Turn a real project into the structure a template stores.
 *
 * Pure on purpose — the endpoint does the reads and the write, and everything
 * that is a judgement call (which tasks carry over, what a date becomes, what
 * gets dropped) is decided here where it can be tested without a database.
 *
 * WHAT IS DELIBERATELY NOT CAPTURED
 *  - Assignees. People change between jobs; a template that quietly assigns
 *    every task to whoever ran the last one is wrong the first time it is
 *    used. A "Responsible" CUSTOM FIELD is captured, because that is a ROLE
 *    (Engineer, Inspector, Owner) and roles do carry over.
 *  - Completion. A template is a plan, not a record of what happened, so a
 *    finished task comes back as work still to do. Archiving a task in this
 *    product IS completing it (there is no archived column — see
 *    /api/tasks/:taskId/archive), so an archived task carries over the same
 *    way: as a step still to do.
 *  - Private tasks. A template is shared with the whole team; it must not
 *    carry the name of a task its author marked private.
 *  - The PEOPLE values of a custom field. The FIELD carries over — "Reviewed
 *    by" is part of the plan — but its value is a list of user ids, which is
 *    an assignee by another name.
 *  - The project's current stage. A template is a plan, not a record: a
 *    recertification captured after it was signed off would otherwise open
 *    every one of the next twenty jobs already closed out. A new project
 *    starts at its pipeline's first stage, which is what POST /api/projects
 *    seeds on its own.
 */
export function buildTemplateStructure(input: CaptureInput): CaptureResult {
  const includeTasks = input.includeTasks !== false;

  // Sections, in position order. Two sections can share a name; the
  // provisioner keys tasks by name, so a duplicate would create a column that
  // can never receive a task.
  const sections: string[] = [];
  const sectionNameById = new Map<string, string>();
  let droppedSections = 0;
  for (const section of input.sections) {
    const name = trimmedString(section.name, 80);
    if (!name) continue;
    if (!sections.includes(name)) {
      if (sections.length >= MAX_CAPTURED_SECTIONS) {
        droppedSections++;
        // Its id stays out of the map, so its tasks are counted as having no
        // section rather than filed under a column that will not exist.
        continue;
      }
      sections.push(name);
    }
    sectionNameById.set(section.id, name);
  }

  const fieldNameById = new Map<string, string>();
  // A PEOPLE value is a list of user ids — see the exclusions above.
  const peopleFieldNames = new Set<string>();
  const customFields: ProjectTemplateCustomField[] = [];
  let droppedFieldTypes = 0;
  let droppedFieldsOverCap = 0;
  for (const field of input.customFields) {
    const name = trimmedString(field.name, 80);
    if (!name) continue;
    // REFERENCE / FORMULA / TIMER and friends are real field types a project
    // can carry and a template cannot express.
    if (!FIELD_TYPES.includes(field.type as ProjectTemplateCustomField["type"])) {
      droppedFieldTypes++;
      continue;
    }
    if (customFields.length >= MAX_CAPTURED_CUSTOM_FIELDS) {
      droppedFieldsOverCap++;
      continue;
    }
    fieldNameById.set(field.id, name);
    if (field.type === "PEOPLE") peopleFieldNames.add(name);
    const options = normalizeOptions(field.options);
    customFields.push({
      name,
      type: field.type as ProjectTemplateCustomField["type"],
      ...(options ? { options } : {}),
    });
  }

  // A private task is skipped entirely, and so is a subtask whose parent was
  // skipped — a subtask on its own has no section and no place to live.
  const visible = includeTasks ? input.tasks.filter((t) => !t.isPrivate) : [];
  const rootRows = visible.filter((t) => !t.parentTaskId);
  const parentRows = rootRows.filter(
    (t) => t.sectionId && sectionNameById.has(t.sectionId)
  );
  // A task whose Section row was deleted keeps a null sectionId (SetNull), and
  // one filed under a section the cap dropped has nowhere to go either. The
  // provisioner matches by section name and would skip them, so they are
  // reported rather than quietly missing from a plan the user was given a
  // count for.
  const sectionlessParents = rootRows.length - parentRows.length;

  /**
   * THE ANCHOR. Dates become offsets in whole days from: the project's start
   * date; failing that, the earliest due date in the project (a job the firm
   * ran without ever setting a start still has a real first deadline, and
   * anchoring there keeps every gap between tasks intact); failing that,
   * nothing — a plan with no dates ships with no dates rather than a schedule
   * invented from today. An offset before the anchor stays negative: "order
   * the survey two weeks before kickoff" is a real instruction, not an error.
   */
  const anchor =
    toDate(input.project.startDate) ??
    parentRows
      .map((t) => toDate(t.dueDate))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0] ??
    null;

  const keptParents = parentRows.slice(0, MAX_CAPTURED_PARENT_TASKS);
  const cappedParentIds = new Set(
    parentRows.slice(MAX_CAPTURED_PARENT_TASKS).map((t) => t.id)
  );
  const droppedParents = cappedParentIds.size;
  const keptParentIds = new Set(keptParents.map((t) => t.id));

  const subtasksByParent = new Map<string, string[]>();
  for (const t of visible) {
    if (!t.parentTaskId || !keptParentIds.has(t.parentTaskId)) continue;
    const name = trimmedString(t.name, 200);
    if (!name) continue;
    const list = subtasksByParent.get(t.parentTaskId);
    if (list) list.push(name);
    else subtasksByParent.set(t.parentTaskId, [name]);
  }
  // Subtasks of a parent the CAP dropped are lost with it — count them so the
  // user is told the real number. Subtasks of a parent that was skipped for
  // being private are not truncation and are not reported.
  let droppedSubtasks = 0;
  for (const t of visible) {
    if (t.parentTaskId && cappedParentIds.has(t.parentTaskId)) droppedSubtasks++;
  }

  const nameById = new Map<string, string>();
  for (const t of keptParents) {
    const name = trimmedString(t.name, 200);
    if (name) nameById.set(t.id, name);
  }
  // A NAME is the only address a template has for a task, and the provisioner
  // resolves one through a name→id map whose last writer wins. So a name two
  // captured tasks share cannot address either of them: emitting the link
  // anyway would draw a Gantt arrow to the wrong task, in the wrong section,
  // with nothing anywhere saying it is wrong. A link the template cannot
  // express is not captured.
  const timesUsed = new Map<string, number>();
  for (const name of nameById.values()) {
    timesUsed.set(name, (timesUsed.get(name) ?? 0) + 1);
  }
  const dependsOnByTaskId = new Map<string, string[]>();
  for (const dep of input.dependencies) {
    // A dependency pointing at a task outside the captured set (a private
    // task, a subtask, one the cap dropped, or one in another project) has no
    // name to reference and is dropped.
    const dependentName = nameById.get(dep.dependentTaskId);
    const blockingName = nameById.get(dep.blockingTaskId);
    if (!dependentName || !blockingName) continue;
    if (timesUsed.get(dependentName) !== 1 || timesUsed.get(blockingName) !== 1) {
      continue;
    }
    if (dep.dependentTaskId === dep.blockingTaskId) continue;
    const list = dependsOnByTaskId.get(dep.dependentTaskId) ?? [];
    if (!list.includes(blockingName)) list.push(blockingName);
    dependsOnByTaskId.set(dep.dependentTaskId, list);
  }

  // Grouped by section so the board reads top-to-bottom the way the finished
  // job did, and so the provisioner's per-section positions come out in order.
  const tasks: ProjectTemplateTask[] = [];
  let subtaskBudget = MAX_CAPTURED_SUBTASKS;
  for (const sectionName of sections) {
    for (const row of keptParents) {
      if (!row.sectionId || sectionNameById.get(row.sectionId) !== sectionName) {
        continue;
      }
      const name = nameById.get(row.id);
      if (!name) continue;
      const task: ProjectTemplateTask = { section: sectionName, name };
      if (row.taskType && row.taskType !== "TASK") task.type = row.taskType;
      // Instructions and priority ARE part of the plan, unlike the assignee:
      // "photograph every elevation" reads the same on the next twenty jobs,
      // whereas the person who did it last time does not carry over.
      const description = typeof row.description === "string" ? row.description.trim() : "";
      if (description) task.description = description.slice(0, 5000);
      if (row.priority && row.priority !== "NONE") task.priority = row.priority;

      const due = toDate(row.dueDate);
      if (anchor && due) {
        // Both reduced to their calendar day first — see utcDay().
        task.relativeDueDate = Math.round((utcDay(due) - utcDay(anchor)) / DAY_MS);
      }

      const dependsOn = dependsOnByTaskId.get(row.id);
      if (dependsOn && dependsOn.length > 0) task.dependsOn = dependsOn;

      const subtasks = subtasksByParent.get(row.id);
      if (subtasks && subtasks.length > 0) {
        const kept = subtasks.slice(0, Math.max(0, subtaskBudget));
        droppedSubtasks += subtasks.length - kept.length;
        subtaskBudget -= kept.length;
        if (kept.length > 0) task.subtasks = kept;
      }

      const values: Record<string, unknown> = {};
      for (const value of row.customFieldValues ?? []) {
        const fieldName = fieldNameById.get(value.fieldId);
        if (!fieldName || value.value === null || value.value === undefined) continue;
        if (peopleFieldNames.has(fieldName)) continue;
        values[fieldName] = value.value;
      }
      if (Object.keys(values).length > 0) task.customFieldValues = values;

      tasks.push(task);
    }
  }

  // No `stage`: see the exclusions above — the job this came from may well be
  // finished, and a template that opens the next twenty jobs at the last stage
  // is a plan nobody asked for.
  const defaults = normalizeDefaults({
    type: input.project.type ?? undefined,
    color: input.project.color ?? undefined,
  });

  // Round-trip through the reader so what is stored is, by construction,
  // exactly what the gallery will read back.
  const structure = normalizeStructure({
    sections,
    customFields,
    tasks,
    defaults,
    workflowTemplateId: input.workflowTemplateId ?? undefined,
  });

  // Everything the capture could not carry, said out loud with its reason. A
  // count the user was shown before saving is a promise; anything short of it
  // has to come back as a sentence, not as a template that is quietly smaller
  // than the job it came from.
  const droppedFields = droppedFieldTypes + droppedFieldsOverCap;
  const sentences: string[] = [];

  if (droppedParents > 0 || droppedSubtasks > 0 || input.moreTasksExist) {
    const parts: { n: number; noun: string }[] = [];
    if (droppedParents > 0) parts.push({ n: droppedParents, noun: "task" });
    if (droppedSubtasks > 0) parts.push({ n: droppedSubtasks, noun: "subtask" });
    sentences.push(
      parts.length > 0
        ? `${leftOut(parts)} because this project is larger than a template can hold.`
        : "Some tasks were left out because this project is larger than a template can hold."
    );
  }
  if (sectionlessParents > 0) {
    sentences.push(
      `${leftOut([
        { n: sectionlessParents, noun: "task" },
      ])} because no matching section is part of the template.`
    );
  }
  if (droppedSections > 0) {
    sentences.push(
      `${leftOut([
        { n: droppedSections, noun: "section" },
      ])} because a template holds at most ${MAX_CAPTURED_SECTIONS}.`
    );
  }
  if (droppedFieldTypes > 0) {
    sentences.push(
      `${leftOut([
        { n: droppedFieldTypes, noun: "custom field" },
      ])} because a template cannot carry that field type.`
    );
  }
  if (droppedFieldsOverCap > 0) {
    sentences.push(
      `${leftOut([
        { n: droppedFieldsOverCap, noun: "custom field" },
      ])} because a template holds at most ${MAX_CAPTURED_CUSTOM_FIELDS}.`
    );
  }

  if (sentences.length === 0) return { structure };

  return {
    structure,
    truncated: {
      parentTasks: droppedParents + sectionlessParents,
      subtasks: droppedSubtasks,
      sections: droppedSections,
      customFields: droppedFields,
      message: sentences.join(" "),
    },
  };
}
