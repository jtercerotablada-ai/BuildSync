/**
 * Workflow types — shared between API, UI, and (future) engine.
 *
 * A Workflow belongs to a project. It contains N rules. Each rule is:
 *   (trigger) → (actions[])
 *
 * Currently the only trigger is "task moved to section X". When such
 * a move happens, the engine looks up rules whose trigger matches the
 * destination section and runs every action in order.
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
  | { type: "ADD_SUBTASK"; name: string };

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
};

export const TRIGGER_LABELS: Record<WorkflowTriggerType, string> = {
  TASK_MOVED_TO_SECTION: "When a task moves to this section",
  TASK_COMPLETED: "When a task is marked complete",
};
