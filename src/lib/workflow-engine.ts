/**
 * Workflow engine — runs WorkflowRule actions when their trigger
 * matches a state change.
 *
 * Currently only handles "TASK_MOVED_TO_SECTION" triggers because
 * that's the only trigger type the schema models today. Adding more
 * triggers is additive: extend the trigger union in workflow-types,
 * add a new public `executeRulesOnX()` function here, hook it in
 * whatever API endpoint owns that state transition.
 *
 * Design rules:
 * - The engine NEVER throws on the caller. Action failures are
 *   logged + non-fatal so a misconfigured rule (e.g. ADD_COMMENT
 *   with no content) doesn't break the task-move that triggered it.
 * - Each action is independent. We run them in declared order but
 *   don't short-circuit on first failure — the rest still try.
 * - We pass the acting userId so audit/activity rows on inserted
 *   comments and collaborators attribute correctly.
 * - The engine is server-only (`server-only` is imported by callers)
 *   and runs after the originating mutation commits.
 */

import prisma from "@/lib/prisma";
import type {
  WorkflowAction,
  WorkflowTrigger,
} from "@/lib/workflow-types";

interface ExecuteContext {
  /** The task that triggered the rule (e.g. the one that just moved). */
  taskId: string;
  /** Who performed the action that fired the trigger. Used for
   *  attributing comments / collaborators. */
  actorUserId: string;
}

/**
 * Apply every rule on the project's workflow whose trigger matches
 * "task moved into `toSectionId`". Called from PATCH /api/tasks/:id
 * AFTER the task's sectionId update commits.
 */
export async function executeRulesOnSectionChange(
  ctx: ExecuteContext,
  toSectionId: string,
  projectId: string
): Promise<void> {
  try {
    // Pull every active workflow for the project, plus their rules.
    const workflows = await prisma.workflow.findMany({
      where: { projectId, isActive: true },
      include: { rules: true },
    });

    for (const wf of workflows) {
      for (const rule of wf.rules) {
        const trigger = rule.trigger as unknown as WorkflowTrigger;
        if (
          trigger?.type !== "TASK_MOVED_TO_SECTION" ||
          trigger.sectionId !== toSectionId
        ) {
          continue;
        }

        const actions = (rule.actions as unknown as WorkflowAction[]) || [];
        for (const action of actions) {
          try {
            await runAction(ctx, action);
          } catch (err) {
            // Swallow — never propagate a single action's failure
            // back to the caller (the task move already succeeded).
            console.error(
              `[workflow-engine] action ${action.type} failed for rule ${rule.id}:`,
              err
            );
          }
        }
      }
    }
  } catch (err) {
    console.error("[workflow-engine] section-change run failed:", err);
  }
}

/**
 * Dispatch a single action against the task. New action types extend
 * this switch — they should be additive and idempotent where possible
 * so re-running a rule (e.g. user moves task back and forth) doesn't
 * compound side effects.
 */
async function runAction(
  ctx: ExecuteContext,
  action: WorkflowAction
): Promise<void> {
  switch (action.type) {
    case "SET_ASSIGNEE":
      // null = unassign (intentional config), otherwise the
      // user must exist in the workspace.
      await prisma.task.update({
        where: { id: ctx.taskId },
        data: { assigneeId: action.userId },
      });
      return;

    case "ADD_COLLABORATORS":
      // Idempotent: skipDuplicates on the unique (taskId, userId)
      // index prevents re-adding the same collaborator if the rule
      // fires more than once.
      if (!action.userIds || action.userIds.length === 0) return;
      await prisma.taskCollaborator.createMany({
        data: action.userIds.map((uid) => ({
          taskId: ctx.taskId,
          userId: uid,
        })),
        skipDuplicates: true,
      });
      return;

    case "ADD_COMMENT":
      if (!action.content?.trim()) return;
      await prisma.comment.create({
        data: {
          taskId: ctx.taskId,
          authorId: ctx.actorUserId,
          content: action.content.trim(),
        },
      });
      return;

    case "MARK_COMPLETE":
      await prisma.task.update({
        where: { id: ctx.taskId },
        data: { completed: true, completedAt: new Date() },
      });
      return;

    case "ADD_TO_PROJECT":
      // "Add to another project" — duplicate the task into the
      // target project's first section. Idempotent against
      // re-runs by checking for an existing twin task with the
      // same name + parentTaskId pointing at the source.
      if (!action.projectId) return;
      // Confirm the target project exists + has at least one section.
      const target = await prisma.project.findUnique({
        where: { id: action.projectId },
        select: {
          id: true,
          sections: {
            orderBy: { position: "asc" },
            take: 1,
            select: { id: true },
          },
        },
      });
      if (!target || target.sections.length === 0) return;

      const src = await prisma.task.findUnique({
        where: { id: ctx.taskId },
        select: {
          name: true,
          description: true,
          dueDate: true,
          startDate: true,
          priority: true,
          taskType: true,
        },
      });
      if (!src) return;

      // De-dup: don't re-create if a twin task already exists.
      const existingTwin = await prisma.task.findFirst({
        where: {
          projectId: action.projectId,
          name: src.name,
          parentTaskId: ctx.taskId,
        },
        select: { id: true },
      });
      if (existingTwin) return;

      await prisma.task.create({
        data: {
          name: src.name,
          description: src.description,
          dueDate: src.dueDate,
          startDate: src.startDate,
          priority: src.priority,
          taskType: src.taskType,
          projectId: action.projectId,
          sectionId: target.sections[0].id,
          creatorId: ctx.actorUserId,
          parentTaskId: ctx.taskId,
        },
      });
      return;
  }
}
