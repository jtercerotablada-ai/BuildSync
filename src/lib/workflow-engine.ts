/**
 * Workflow engine — runs WorkflowRule actions when their trigger
 * matches a state change.
 *
 * Handles the two trigger types in workflow-types: "TASK_MOVED_TO_SECTION"
 * and "TASK_COMPLETED". Rules only ever run on top-level tasks. Adding more
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
import { GoalProgressService } from "@/lib/goal-progress";
import {
  notifyTaskAssigned,
  notifyTaskCollaborators,
  notifyTaskCompleted,
} from "@/lib/task-notifications";
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
  /** How many rule hops got us here. Actions that themselves change state
   *  (MOVE_TO_SECTION, MARK_COMPLETE) re-enter the engine so rules chain
   *  like Asana's; this bounds the chain so two rules pointing at each
   *  other can't loop forever. */
  depth?: number;
}

/** A rule chain deeper than this is a misconfiguration (e.g. A→B→A). */
const MAX_CHAIN_DEPTH = 5;

/** Every descendant of `rootId` (subtasks, their subtasks, ...), not
 *  including the root, walked level by level. `seen` guards a corrupt cycle. */
async function collectDescendantIds(rootId: string): Promise<string[]> {
  const seen = new Set<string>([rootId]);
  const out: string[] = [];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = await prisma.task.findMany({
      where: { parentTaskId: { in: frontier } },
      select: { id: true },
    });
    frontier = [];
    for (const c of children) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c.id);
      frontier.push(c.id);
    }
  }
  return out;
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
  await executeRulesMatching(ctx, projectId, (trigger) => {
    return (
      trigger?.type === "TASK_MOVED_TO_SECTION" &&
      trigger.sectionId === toSectionId
    );
  });
}

/**
 * Apply every rule whose trigger is TASK_COMPLETED. Called from
 * PATCH /api/tasks/:id AFTER the task's completed flag flips to
 * true. Uncompleting doesn't fire — only the positive transition.
 */
export async function executeRulesOnTaskCompleted(
  ctx: ExecuteContext,
  projectId: string
): Promise<void> {
  await executeRulesMatching(ctx, projectId, (trigger) => {
    return trigger?.type === "TASK_COMPLETED";
  });
}

/**
 * Shared core — pulls every rule on the project's active workflows,
 * runs those whose trigger satisfies `matches`. Single error
 * boundary; per-action errors are caught + logged inside runAction.
 */
async function executeRulesMatching(
  ctx: ExecuteContext,
  projectId: string,
  matches: (trigger: WorkflowTrigger) => boolean
): Promise<void> {
  if ((ctx.depth ?? 0) > MAX_CHAIN_DEPTH) {
    console.warn(
      `[workflow-engine] rule chain exceeded depth ${MAX_CHAIN_DEPTH} on task ${ctx.taskId} — stopping (check for rules pointing at each other)`
    );
    return;
  }
  try {
    // Section and completion rules govern top-level tasks only, the same
    // rule POST /api/tasks applies. Subtasks carry their parent's projectId
    // and sectionId, so without this every checklist tick re-ran the
    // project's completion rules on the subtask (duplicate comments, hidden
    // subtasks moved between columns, sub-subtasks created).
    const subject = await prisma.task.findUnique({
      where: { id: ctx.taskId },
      select: { parentTaskId: true },
    });
    if (!subject || subject.parentTaskId) return;

    const workflows = await prisma.workflow.findMany({
      where: { projectId, isActive: true },
      orderBy: { createdAt: "asc" },
      // Deterministic order: rules run in the order they were created, so
      // two rules touching the same field always resolve the same way
      // instead of following Postgres heap order.
      include: { rules: { orderBy: { createdAt: "asc" } } },
    });

    // One trigger event moves the task at most once. Several "Task
    // completed → moved here" slots can exist; letting each run would bounce
    // the task through every target (and each one's chained rules), so the
    // oldest rule wins and the rest are skipped. The slot is claimed only by
    // a move that actually lands: a stale rule aimed at a deleted section
    // must not silently swallow the valid move behind it.
    let moved = false;

    for (const wf of workflows) {
      for (const rule of wf.rules) {
        const trigger = rule.trigger as unknown as WorkflowTrigger;
        if (!matches(trigger)) continue;

        const actions = (rule.actions as unknown as WorkflowAction[]) || [];
        for (const action of actions) {
          if (action.type === "MOVE_TO_SECTION") {
            if (moved) {
              console.warn(
                `[workflow-engine] MOVE_TO_SECTION in rule ${rule.id} skipped: the task was already moved by an earlier rule for this trigger`
              );
              continue;
            }
          }
          try {
            const landed = await runAction(ctx, action);
            if (action.type === "MOVE_TO_SECTION" && landed === true) {
              moved = true;
            }
          } catch (err) {
            console.error(
              `[workflow-engine] action ${action.type} failed for rule ${rule.id}:`,
              err
            );
            // The move may have landed before a later step (a chained rule)
            // threw; if the task sits in the target now, the slot is used.
            if (action.type === "MOVE_TO_SECTION" && action.sectionId) {
              const now = await prisma.task
                .findUnique({
                  where: { id: ctx.taskId },
                  select: { sectionId: true },
                })
                .catch(() => null);
              if (now?.sectionId === action.sectionId) moved = true;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[workflow-engine] rule execution failed:", err);
  }
}

/**
 * Dispatch a single action against the task. New action types extend
 * this switch — they should be additive and idempotent where possible
 * so re-running a rule (e.g. user moves task back and forth) doesn't
 * compound side effects.
 */
/**
 * Runs one action. MOVE_TO_SECTION resolves to whether the task ends up in
 * the target section (true when it moved or was already there, false when
 * the move was skipped); every other action resolves to nothing.
 */
async function runAction(
  ctx: ExecuteContext,
  action: WorkflowAction
): Promise<boolean | void> {
  switch (action.type) {
    case "SET_ASSIGNEE": {
      // null = unassign (intentional config). The target is re-checked at
      // execution time: a user validated when the rule was saved may have
      // since left the workspace, and assigning them would make the task
      // invisible to its own assignee.
      if (action.userId) {
        const task = await prisma.task.findUnique({
          where: { id: ctx.taskId },
          select: { assigneeId: true, name: true, dueDate: true, projectId: true },
        });
        if (!task) return;
        const ok = await isMemberOfTaskWorkspace(ctx.taskId, action.userId);
        if (!ok) {
          console.warn(
            `[workflow-engine] SET_ASSIGNEE skipped: ${action.userId} is not in the task's workspace`
          );
          return;
        }
        if (task.assigneeId === action.userId) return; // already there
        await prisma.task.update({
          where: { id: ctx.taskId },
          data: { assigneeId: action.userId },
        });
        await logActivity(ctx, "TASK_ASSIGNED", { assigneeId: action.userId });
        // Same courtesy the manual PATCH path extends: tell the assignee.
        if (action.userId !== ctx.actorUserId) {
          const project = await projectOf(task.projectId);
          await notifyTaskAssigned({
            taskId: ctx.taskId,
            assigneeId: action.userId,
            assignerUserId: ctx.actorUserId,
            taskName: task.name,
            projectId: task.projectId,
            projectName: project?.name ?? null,
            dueDate: task.dueDate,
          }).catch((e) =>
            console.error("[workflow-engine] assign notify failed:", e)
          );
        }
        return;
      }
      await prisma.task.update({
        where: { id: ctx.taskId },
        data: { assigneeId: null },
      });
      await logActivity(ctx, "TASK_UNASSIGNED", {});
      return;
    }

    case "ADD_COLLABORATORS": {
      // Idempotent: skipDuplicates on the unique (taskId, userId)
      // index prevents re-adding the same collaborator if the rule
      // fires more than once.
      if (!action.userIds || action.userIds.length === 0) return;
      // Re-checked at execution time like SET_ASSIGNEE: an id validated when
      // the rule was saved may have left the workspace, and adding them kept
      // sending that task's notifications to someone who is gone — while a
      // deleted user's FK violation made the whole action fail silently.
      const checked = await Promise.all(
        action.userIds.map(async (uid) => ({
          uid,
          ok: await isMemberOfTaskWorkspace(ctx.taskId, uid),
        }))
      );
      const allowed = checked.filter((c) => c.ok).map((c) => c.uid);
      for (const c of checked) {
        if (!c.ok) {
          console.warn(
            `[workflow-engine] ADD_COLLABORATORS skipped: ${c.uid} is not in the task's workspace`
          );
        }
      }
      if (allowed.length === 0) return;
      const added = await prisma.taskCollaborator.createMany({
        data: allowed.map((uid) => ({
          taskId: ctx.taskId,
          userId: uid,
        })),
        skipDuplicates: true,
      });
      if (added.count > 0) {
        await logActivity(ctx, "CUSTOM_FIELD_CHANGED", {
          fieldName: "Collaborators",
          addedUserIds: allowed,
        });
      }
      return;
    }

    case "ADD_COMMENT": {
      if (!action.content?.trim()) return;
      await prisma.comment.create({
        data: {
          taskId: ctx.taskId,
          authorId: ctx.actorUserId,
          content: action.content.trim(),
        },
      });
      await logActivity(ctx, "COMMENT_ADDED", { automated: true });
      // A rule-posted comment is still a comment — followers expect it in
      // their inbox, exactly like one typed by hand.
      const t = await prisma.task.findUnique({
        where: { id: ctx.taskId },
        select: { name: true, projectId: true },
      });
      if (t) {
        const project = await projectOf(t.projectId);
        await notifyTaskCollaborators({
          taskId: ctx.taskId,
          actorUserId: ctx.actorUserId,
          type: "COMMENT_ADDED",
          taskName: t.name,
          projectId: t.projectId,
          projectName: project?.name ?? null,
        }).catch((e) =>
          console.error("[workflow-engine] comment notify failed:", e)
        );
      }
      return;
    }

    case "MARK_COMPLETE": {
      const task = await prisma.task.findUnique({
        where: { id: ctx.taskId },
        select: { completed: true, name: true, projectId: true, creatorId: true },
      });
      // Already done → don't rewrite completedAt (that would move the task
      // in "recently completed" lists every time the rule re-fires).
      if (!task || task.completed) return;

      await prisma.task.update({
        where: { id: ctx.taskId },
        data: { completed: true, completedAt: new Date() },
      });
      await logActivity(ctx, "TASK_COMPLETED", {});

      // Everything the manual complete path does, which a rule-driven
      // completion silently skipped before: goal rollups + notifications.
      await GoalProgressService.recalculateForTask(ctx.taskId).catch((e) =>
        console.error("[workflow-engine] goal recalc failed:", e)
      );
      const project = await projectOf(task.projectId);
      if (task.creatorId && task.creatorId !== ctx.actorUserId) {
        await notifyTaskCompleted({
          taskId: ctx.taskId,
          recipientUserId: task.creatorId,
          completerUserId: ctx.actorUserId,
          taskName: task.name,
          projectId: task.projectId,
          projectName: project?.name ?? null,
        }).catch((e) =>
          console.error("[workflow-engine] complete notify failed:", e)
        );
      }
      await notifyTaskCollaborators({
        taskId: ctx.taskId,
        actorUserId: ctx.actorUserId,
        type: "TASK_COMPLETED",
        taskName: task.name,
        projectId: task.projectId,
        projectName: project?.name ?? null,
      }).catch((e) =>
        console.error("[workflow-engine] complete notify failed:", e)
      );

      // Chain: completing a task is a state change, so any
      // "when a task is completed" rule must now run (Asana chains too).
      if (task.projectId) {
        await executeRulesOnTaskCompleted(
          { ...ctx, depth: (ctx.depth ?? 0) + 1 },
          task.projectId
        );
      }
      return;
    }

    case "SET_PRIORITY": {
      const task = await prisma.task.findUnique({
        where: { id: ctx.taskId },
        select: { priority: true },
      });
      if (!task || task.priority === action.priority) return;
      await prisma.task.update({
        where: { id: ctx.taskId },
        data: { priority: action.priority },
      });
      // Without a history row nobody can tell why the priority changed.
      await logActivity(ctx, "CUSTOM_FIELD_CHANGED", {
        fieldName: "Priority",
        from: task.priority,
        to: action.priority,
      });
      return;
    }

    case "MOVE_TO_SECTION": {
      // Move the task into the configured section (e.g. "when a task
      // is completed → move it to Done").
      if (!action.sectionId) return false;
      const task = await prisma.task.findUnique({
        where: { id: ctx.taskId },
        select: { sectionId: true, projectId: true },
      });
      if (!task) return false;
      if (task.sectionId === action.sectionId) return true;
      // Never let a rule fling a task into another project's board.
      const dest = await prisma.section.findUnique({
        where: { id: action.sectionId },
        select: { projectId: true },
      });
      if (!dest || (task.projectId && dest.projectId !== task.projectId)) {
        console.warn(
          "[workflow-engine] MOVE_TO_SECTION skipped: section is not in the task's project"
        );
        return false;
      }
      // Land at the end of the column — without a position the task keeps
      // its old index and collides with whatever already sits there.
      const last = await prisma.task.findFirst({
        where: { sectionId: action.sectionId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      await prisma.task.update({
        where: { id: ctx.taskId },
        data: {
          sectionId: action.sectionId,
          position: (last?.position ?? -1) + 1,
        },
      });
      // Subtasks live in their parent's column (same rule as PATCH
      // /api/tasks/:id); moving only the parent stranded them in the old one.
      const descendantIds = await collectDescendantIds(ctx.taskId);
      if (descendantIds.length > 0) {
        await prisma.task.updateMany({
          where: { id: { in: descendantIds } },
          data: { sectionId: action.sectionId },
        });
      }
      await logActivity(ctx, "TASK_MOVED", { sectionId: action.sectionId });

      // Chain: the task just entered a section, so that section's own
      // rules must run (Asana chains; the depth guard stops A⇄B loops).
      if (task.projectId) {
        await executeRulesOnSectionChange(
          { ...ctx, depth: (ctx.depth ?? 0) + 1 },
          action.sectionId,
          task.projectId
        );
      }
      return true;
    }

    case "ADD_SUBTASK": {
      // Idempotent: don't double-add the same subtask if the rule re-fires
      // on the same task. Keyed on (parent, name) — renaming the subtask by
      // hand does let the rule re-add it, which is the same trade-off Asana
      // makes and is preferable to never re-adding a deleted one.
      if (!action.name?.trim()) return;
      const existingSub = await prisma.task.findFirst({
        where: {
          parentTaskId: ctx.taskId,
          name: action.name.trim(),
        },
        select: { id: true },
      });
      if (existingSub) return;
      const parent = await prisma.task.findUnique({
        where: { id: ctx.taskId },
        select: { projectId: true, sectionId: true },
      });
      // Append: every rule-created subtask defaulted to position 0, so a
      // rule adding several of them produced an unstable order.
      const lastSub = await prisma.task.findFirst({
        where: { parentTaskId: ctx.taskId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const sub = await prisma.task.create({
        data: {
          name: action.name.trim(),
          parentTaskId: ctx.taskId,
          projectId: parent?.projectId ?? null,
          sectionId: parent?.sectionId ?? null,
          creatorId: ctx.actorUserId,
          position: (lastSub?.position ?? -1) + 1,
        },
        select: { id: true, name: true },
      });
      // Same parent-feed row the manual subtask path writes.
      await logActivity(ctx, "SUBTASK_ADDED", {
        subtaskId: sub.id,
        subtaskName: sub.name,
      });
      return;
    }

    case "ADD_TO_PROJECT": {
      // "Add to another project" = Asana's MULTI-HOMING: the SAME task now
      // lives in two projects, sharing its assignee, comments and dates.
      // (This used to deep-copy the task, which forked the data — edits and
      // comments on one copy never reached the other.)
      if (!action.projectId) return;
      const task = await prisma.task.findUnique({
        where: { id: ctx.taskId },
        select: { id: true, projectId: true, parentTaskId: true },
      });
      if (!task) return;
      // Its own home project isn't an "add".
      if (task.projectId === action.projectId) return;
      // Subtasks are not board citizens; multi-homing one would strand it.
      if (task.parentTaskId) return;

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
      if (!target) return;

      // Idempotent on the (taskId, projectId) unique index — re-firing the
      // rule is a no-op instead of the old "same name = skip" heuristic,
      // which silently swallowed the action whenever the target project
      // happened to already contain an unrelated task with that name.
      await prisma.taskProject.createMany({
        data: [
          {
            taskId: ctx.taskId,
            projectId: action.projectId,
            sectionId: target.sections[0]?.id ?? null,
          },
        ],
        skipDuplicates: true,
      });
      await logActivity(ctx, "TASK_MOVED", {
        addedToProjectId: action.projectId,
      });
      return;
    }
  }
}

// ─── Small helpers ───────────────────────────────────────────────

async function projectOf(projectId: string | null) {
  if (!projectId) return null;
  return prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
}

/** Is `userId` still a member of the workspace that owns the task? */
async function isMemberOfTaskWorkspace(
  taskId: string,
  userId: string
): Promise<boolean> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { project: { select: { workspaceId: true } } },
  });
  const workspaceId = task?.project?.workspaceId;
  if (!workspaceId) return true; // no project → nothing to check against
  const member = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { userId: true },
  });
  return !!member;
}

/** Rule-driven changes belong in the task's history like manual ones. */
async function logActivity(
  ctx: ExecuteContext,
  type:
    | "TASK_COMPLETED"
    | "TASK_ASSIGNED"
    | "TASK_UNASSIGNED"
    | "TASK_MOVED"
    | "COMMENT_ADDED"
    | "SUBTASK_ADDED"
    | "CUSTOM_FIELD_CHANGED",
  data: Record<string, unknown>
) {
  try {
    await prisma.activity.create({
      data: {
        type,
        taskId: ctx.taskId,
        userId: ctx.actorUserId,
        data: { ...data, viaWorkflowRule: true },
      },
    });
  } catch (err) {
    console.error("[workflow-engine] activity log failed:", err);
  }
}
