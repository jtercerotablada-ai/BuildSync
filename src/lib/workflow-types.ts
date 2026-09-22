/**
 * Workflow types — shared between API, UI, and (future) engine.
 *
 * A Workflow belongs to a project. It contains N rules. Each rule is:
 *   (trigger) → (actions[])
 *
 * Triggers are "task moved to section X" and "task completed". When one
 * fires on a top-level task, the engine runs every matching rule's actions
 * in rule-creation order.
 *
 * Actions are intentionally narrow today (5 types) — adding more is
 * additive: extend WorkflowAction union, extend the engine switch,
 * and add a UI chip in the action picker.
 */

// ─── Triggers ────────────────────────────────────────────────────

export type WorkflowTrigger =
  | { type: "TASK_MOVED_TO_SECTION"; sectionId: string }
  | { type: "TASK_COMPLETED" };
// Future: TASK_CREATED, TASK_DUE_TOMORROW (needs cron),
// CUSTOM_FIELD_CHANGED, ASSIGNEE_CHANGED.

export type WorkflowTriggerType = WorkflowTrigger["type"];

// ─── Actions ─────────────────────────────────────────────────────

export type WorkflowAction =
  | { type: "SET_ASSIGNEE"; userId: string | null }
  | { type: "ADD_COLLABORATORS"; userIds: string[] }
  | { type: "ADD_COMMENT"; content: string }
  | { type: "MARK_COMPLETE" }
  | { type: "ADD_TO_PROJECT"; projectId: string }
  | {
      type: "SET_PRIORITY";
      priority: "NONE" | "LOW" | "MEDIUM" | "HIGH";
    }
  | { type: "ADD_SUBTASK"; name: string }
  // "Add a trigger to move tasks to this section" (Asana's builder
  // slot above each stage): paired with a non-section trigger, it
  // moves the task INTO the configured section.
  | { type: "MOVE_TO_SECTION"; sectionId: string };

export type WorkflowActionType = WorkflowAction["type"];

/**
 * The DB shape — `trigger` and `actions` arrive as Prisma JSON.
 * Front-end normalizes them to the union types above before use.
 */
export interface WorkflowRuleRow {
  id: string;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRow {
  id: string;
  name: string;
  isActive: boolean;
  /** Whether the caller may change rules/sections (project write access). */
  canEdit?: boolean;
  /** The project's workspace — scopes the people/project pickers. */
  workspaceId?: string | null;
  rules: WorkflowRuleRow[];
}

// ─── UI metadata for the action picker ───────────────────────────

export const ACTION_LABELS: Record<WorkflowActionType, string> = {
  SET_ASSIGNEE: "Set assignee",
  ADD_COLLABORATORS: "Add collaborators",
  ADD_COMMENT: "Add comment",
  MARK_COMPLETE: "Mark complete",
  ADD_TO_PROJECT: "Add to another project",
  SET_PRIORITY: "Set priority",
  ADD_SUBTASK: "Add a subtask",
  MOVE_TO_SECTION: "Move task to this section",
};

export const TRIGGER_LABELS: Record<WorkflowTriggerType, string> = {
  TASK_MOVED_TO_SECTION: "When a task moves to this section",
  TASK_COMPLETED: "When a task is marked complete",
};

/**
 * Key-order-independent JSON for comparing rule triggers/actions. Postgres
 * jsonb reorders object keys, so a stored rule never matches a plain
 * JSON.stringify of the spec it was created from.
 */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
