/**
 * Cross-surface task-mutation signal.
 *
 * The task detail panel stays mounted while the user works the list /
 * board / gantt behind it, and it derives state from its own fetched copy
 * of the task — chiefly the "Blocked" chip, which should clear the moment
 * the last incomplete blocker is completed. Completing that blocker from a
 * row checkbox never touched the panel's copy, so the chip sat stale until
 * the panel was closed and reopened.
 *
 * Any surface that mutates a task (completion toggles above all) fires
 * this window CustomEvent after a successful PATCH; the open panel listens
 * and silently refetches. Same pattern as SIDEBAR_REFRESH_EVENT in
 * lib/open-create-project.
 */

export const TASK_MUTATED_EVENT = "buildsync:task-mutated";

export interface TaskMutatedDetail {
  taskId: string;
}

export function notifyTaskMutated(taskId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<TaskMutatedDetail>(TASK_MUTATED_EVENT, {
      detail: { taskId },
    })
  );
}
