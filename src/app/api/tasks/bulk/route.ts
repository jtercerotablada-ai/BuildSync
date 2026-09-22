import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyBulkTaskAccess, verifySectionWritable, assertUserInWorkspace, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";
import { GoalProgressService } from "@/lib/goal-progress";
import {
  executeRulesOnSectionChange,
  executeRulesOnTaskCompleted,
} from "@/lib/workflow-engine";
import { notifyTaskAssigned, notifyTaskCompleted, autoFollowTasks } from "@/lib/task-notifications";
import { resolveTaskPlacements } from "@/lib/task-placement";
import { recomputeRollupsForAncestors } from "@/lib/formula-eval";
import { deleteFile } from "@/lib/storage";

/**
 * The selected tasks plus every descendant (subtasks cascade with them), so
 * their attachments and goal links can be looked up before the delete.
 * `seen` guards against a corrupt cycle.
 */
async function collectSubtreeIds(rootIds: string[]): Promise<string[]> {
  const seen = new Set<string>(rootIds);
  let frontier = [...rootIds];
  while (frontier.length > 0) {
    const children = await prisma.task.findMany({
      where: { parentTaskId: { in: frontier } },
      select: { id: true },
    });
    frontier = [];
    for (const c of children) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      frontier.push(c.id);
    }
  }
  return [...seen];
}

/** Same rule as single-task DELETE: form and tracking blobs belong to the submission. */
function isSubmissionBlob(url: string): boolean {
  try {
    const path = new URL(url).pathname.replace(/^\/+/, "");
    return path.startsWith("forms/") || path.startsWith("tracking/");
  } catch {
    return false;
  }
}

const bulkSchema = z.object({
  taskIds: z.array(z.string()).min(1),
  action: z.enum(["complete", "incomplete", "delete", "assign", "set_priority", "move_section"]),
  value: z.string().optional(),
});

// POST /api/tasks/bulk - Bulk operations on tasks
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { taskIds, action, value } = bulkSchema.parse(body);

    // Verify all tasks belong to user's workspace
    const workspaceId = await verifyBulkTaskAccess(userId, taskIds);

    switch (action) {
      case "complete": {
        // Only flip tasks that are NOT already completed — otherwise we'd
        // overwrite their original completedAt (shown in the "Completion
        // date" column). Then run the SAME post-completion side effects as
        // the single-task PATCH: goal recalc, workflow rules, notifications
        // and an activity row (audit: bulk complete skipped all of these).
        const toComplete = await prisma.task.findMany({
          where: { id: { in: taskIds }, completed: false },
          select: {
            id: true,
            name: true,
            projectId: true,
            creatorId: true,
            project: { select: { name: true } },
          },
        });
        if (toComplete.length > 0) {
          await prisma.task.updateMany({
            where: { id: { in: toComplete.map((t) => t.id) } },
            data: { completed: true, completedAt: new Date() },
          });
        }
        for (const t of toComplete) {
          try {
            await prisma.activity.create({
              data: { type: "TASK_COMPLETED", taskId: t.id, userId, data: {} },
            });
          } catch (e) {
            console.error("[bulk complete] activity failed:", e);
          }
          try {
            await GoalProgressService.recalculateForTask(t.id);
          } catch (e) {
            console.error("[bulk complete] goal recalc failed:", e);
          }
          if (t.projectId) {
            try {
              await executeRulesOnTaskCompleted(
                { taskId: t.id, actorUserId: userId },
                t.projectId
              );
            } catch (e) {
              console.error("[bulk complete] workflow rules failed:", e);
            }
            if (t.creatorId && t.creatorId !== userId) {
              try {
                await notifyTaskCompleted({
                  taskId: t.id,
                  recipientUserId: t.creatorId,
                  completerUserId: userId,
                  taskName: t.name,
                  projectId: t.projectId,
                  projectName: t.project?.name ?? null,
                });
              } catch (e) {
                console.error("[bulk complete] notify failed:", e);
              }
            }
          }
        }
        return NextResponse.json({
          success: true,
          count: toComplete.length,
          alreadyComplete: taskIds.length - toComplete.length,
        });
      }

      case "incomplete": {
        // Mirror the single-task PATCH, which recalculates goal progress in
        // BOTH directions and logs TASK_UNCOMPLETED. Without this, un-checking
        // from a multi-select left every linked goal stuck on the higher
        // percentage until something unrelated recalculated it. Only rows that
        // were actually completed are touched, so we don't write audit entries
        // for tasks that were already open.
        const toReopen = await prisma.task.findMany({
          where: { id: { in: taskIds }, completed: true },
          select: { id: true },
        });
        if (toReopen.length > 0) {
          await prisma.task.updateMany({
            where: { id: { in: toReopen.map((t) => t.id) } },
            data: { completed: false, completedAt: null },
          });
        }
        for (const t of toReopen) {
          try {
            await prisma.activity.create({
              data: { type: "TASK_UNCOMPLETED", taskId: t.id, userId, data: {} },
            });
          } catch (e) {
            console.error("[bulk incomplete] activity failed:", e);
          }
          try {
            await GoalProgressService.recalculateForTask(t.id);
          } catch (e) {
            console.error("[bulk incomplete] goal recalc failed:", e);
          }
        }
        return NextResponse.json({ success: true, count: toReopen.length });
      }

      case "delete": {
        // Deleting a task moves a goal's denominator exactly like completing
        // one does, so the objectives it feeds have to be recalculated. Their
        // ids must be collected BEFORE the delete: the join rows go with the
        // tasks, so afterwards there is nothing left to look them up by.
        //
        // The rest is the same cleanup single-task DELETE does: attachment
        // rows cascade but the (public, unguessable) blobs behind them do not,
        // and a deleted subtask leaves its parent's roll-ups stale.
        const subtreeIds = await collectSubtreeIds(taskIds);
        const doomed = await prisma.task.findMany({
          where: { id: { in: taskIds } },
          select: { projectId: true, parentTaskId: true },
        });
        const doomedIdSet = new Set(subtreeIds);
        // A parent that is itself being deleted has nothing left to recompute.
        const survivingParentIds = [
          ...new Set(
            doomed
              .map((t) => t.parentTaskId)
              .filter((id): id is string => id !== null && !doomedIdSet.has(id))
          ),
        ];
        const attachments = await prisma.attachment.findMany({
          where: {
            OR: [
              { taskId: { in: subtreeIds } },
              { comment: { taskId: { in: subtreeIds } } },
            ],
          },
          select: { url: true },
        });
        const blobUrls = [...new Set(attachments.map((a) => a.url))];
        const doomedProjectIds = [
          ...new Set(
            doomed
              .map((t) => t.projectId)
              .filter((id): id is string => id !== null)
          ),
        ];
        const [objectiveTasks, keyResultTasks, objectiveProjects] =
          await Promise.all([
            prisma.objectiveTask.findMany({
              where: { taskId: { in: subtreeIds } },
              select: { objectiveId: true },
            }),
            prisma.keyResultTask.findMany({
              where: { taskId: { in: subtreeIds } },
              select: { keyResult: { select: { objectiveId: true } } },
            }),
            doomedProjectIds.length
              ? prisma.objectiveProject.findMany({
                  where: { projectId: { in: doomedProjectIds } },
                  select: { objectiveId: true },
                })
              : Promise.resolve([] as { objectiveId: string }[]),
          ]);
        const affectedObjectiveIds = new Set<string>([
          ...objectiveTasks.map((o) => o.objectiveId),
          ...keyResultTasks.map((k) => k.keyResult.objectiveId),
          ...objectiveProjects.map((o) => o.objectiveId),
        ]);
        await prisma.task.deleteMany({
          where: { id: { in: taskIds } },
        });
        for (const parentId of survivingParentIds) {
          try {
            await recomputeRollupsForAncestors(parentId);
          } catch (e) {
            console.error("[bulk delete] roll-up recompute failed:", e);
          }
        }
        for (const objectiveId of affectedObjectiveIds) {
          try {
            await GoalProgressService.recalculateProgress(objectiveId);
          } catch (e) {
            console.error("[bulk delete] goal recalc failed:", e);
          }
        }
        // Best-effort, after the rows are gone; a url still referenced by
        // another row is left alone.
        const blobResults = await Promise.allSettled(
          blobUrls.map(async (url) => {
            if (isSubmissionBlob(url)) return;
            const stillUsed =
              (await prisma.attachment.count({ where: { url } })) +
              (await prisma.file.count({ where: { url } })) +
              (await prisma.projectResource.count({ where: { url } })) +
              (await prisma.messageAttachment.count({ where: { url } }));
            if (stillUsed === 0) await deleteFile(url);
          })
        );
        const failedBlobs = blobResults.filter((r) => r.status === "rejected").length;
        if (failedBlobs > 0) {
          console.error(
            `[bulk delete] ${failedBlobs} of ${blobUrls.length} blob deletions failed`
          );
        }
        return NextResponse.json({ success: true, count: taskIds.length });
      }

      case "assign":
        if (!value) {
          return NextResponse.json({ error: "User ID required" }, { status: 400 });
        }
        // The assignee must be a member of the caller's workspace — otherwise
        // an arbitrary userId could be written as assignee (integrity/cross-
        // workspace leak). "unassign" clears it.
        if (value !== "unassign") {
          await assertUserInWorkspace(value, workspaceId);
        }
        const newAssigneeId = value === "unassign" ? null : value;
        // Only rows whose assignee actually changes get written, logged and
        // announced — the same side effects a single-task PATCH has.
        const toReassign = await prisma.task.findMany({
          where: {
            id: { in: taskIds },
            ...(newAssigneeId
              ? { OR: [{ assigneeId: null }, { assigneeId: { not: newAssigneeId } }] }
              : { assigneeId: { not: null } }),
          },
          select: {
            id: true,
            name: true,
            projectId: true,
            creatorId: true,
            dueDate: true,
            project: { select: { name: true } },
          },
        });
        if (toReassign.length > 0) {
          await prisma.task.updateMany({
            where: { id: { in: toReassign.map((t) => t.id) } },
            data: { assigneeId: newAssigneeId },
          });
          try {
            await prisma.activity.createMany({
              data: toReassign.map((t) => ({
                type: newAssigneeId ? ("TASK_ASSIGNED" as const) : ("TASK_UNASSIGNED" as const),
                taskId: t.id,
                userId,
                data: { assigneeId: newAssigneeId },
              })),
            });
          } catch (e) {
            console.error("[bulk assign] activity failed:", e);
          }
        }
        if (newAssigneeId) {
          // The assignee follows what they now own (see task PATCH); the
          // creator is already notified of comments and completion.
          await autoFollowTasks(
            toReassign
              .filter((t) => t.creatorId !== newAssigneeId)
              .map((t) => ({ taskId: t.id, userId: newAssigneeId })),
            "bulk assign"
          );
          if (newAssigneeId !== userId) {
            for (const t of toReassign) {
              try {
                await notifyTaskAssigned({
                  taskId: t.id,
                  assigneeId: newAssigneeId,
                  assignerUserId: userId,
                  taskName: t.name,
                  projectId: t.projectId,
                  projectName: t.project?.name ?? null,
                  dueDate: t.dueDate,
                });
              } catch (e) {
                console.error("[bulk assign] notify failed:", e);
              }
            }
          }
        }
        return NextResponse.json({ success: true, count: toReassign.length });

      case "set_priority":
        if (!value) {
          return NextResponse.json({ error: "Priority required" }, { status: 400 });
        }
        const validPriorities = ["NONE", "LOW", "MEDIUM", "HIGH"];
        if (!validPriorities.includes(value)) {
          return NextResponse.json({ error: "Invalid priority value" }, { status: 400 });
        }
        await prisma.task.updateMany({
          where: { id: { in: taskIds } },
          data: { priority: value as "NONE" | "LOW" | "MEDIUM" | "HIGH" },
        });
        return NextResponse.json({ success: true, count: taskIds.length });

      case "move_section": {
        if (!value) {
          return NextResponse.json({ error: "Section ID required" }, { status: 400 });
        }
        // Require WRITE on the project that owns the destination section.
        // Same-workspace alone is not authorization — see verifySectionWritable.
        const destSection = await verifySectionWritable(userId, value, {
          expectWorkspaceId: workspaceId,
        });
        // A selection can mix tasks HOMED in this project with tasks merely
        // multi-homed into it. Writing Task.sectionId for a guest re-homed it
        // and made it vanish from its own project's board — see
        // lib/task-placement.ts.
        const { placements, unrelated } = await resolveTaskPlacements(
          taskIds,
          destSection.projectId,
        );
        // Skipped, not rejected — same reasoning as /api/tasks/reorder: one
        // bad row must not fail the whole selection, and skipping writes
        // nothing for it.
        if (unrelated.length > 0) {
          console.warn(
            `[tasks bulk move_section] skipping ${unrelated.length} task(s) not in project ${destSection.projectId}: ${unrelated.join(", ")}`,
          );
        }
        const homeIds = placements
          .filter((p) => p.kind === "home")
          .map((p) => p.taskId);
        const guestLinkIds = placements
          .filter((p): p is { taskId: string; kind: "guest"; linkId: string } =>
            p.kind === "guest"
          )
          .map((p) => p.linkId);

        // Snapshot prior sections so we can fire section-change workflow
        // rules only for tasks that actually moved (audit: bulk move never
        // fired rules, contradicting "rules fire from any view"). Guests are
        // excluded — their home sectionId is not what changed, and the rule
        // lookup below is keyed on the home project.
        const beforeMove = await prisma.task.findMany({
          where: { id: { in: homeIds } },
          select: { id: true, sectionId: true, projectId: true },
        });
        // Subtasks share their parent's column. Moving only the parents left
        // them in the old column, where deleting that column (which deletes
        // its tasks) destroyed the checklist of a card that now lives here.
        const descendantIds: string[] = [];
        {
          const seen = new Set<string>(homeIds);
          let frontier = homeIds;
          while (frontier.length > 0) {
            const children = await prisma.task.findMany({
              where: { parentTaskId: { in: frontier } },
              select: { id: true },
            });
            frontier = [];
            for (const c of children) {
              if (seen.has(c.id)) continue;
              seen.add(c.id);
              descendantIds.push(c.id);
              frontier.push(c.id);
            }
          }
        }
        await prisma.$transaction([
          ...(homeIds.length
            ? [
                prisma.task.updateMany({
                  where: { id: { in: homeIds } },
                  data: { sectionId: value },
                }),
              ]
            : []),
          ...(descendantIds.length
            ? [
                prisma.task.updateMany({
                  where: { id: { in: descendantIds } },
                  data: { sectionId: value, projectId: destSection.projectId },
                }),
              ]
            : []),
          ...(guestLinkIds.length
            ? [
                prisma.taskProject.updateMany({
                  where: { id: { in: guestLinkIds } },
                  data: { sectionId: value },
                }),
              ]
            : []),
        ]);
        // Same TASK_MOVED row a single PATCH or a reorder writes, so a bulk
        // move leaves a trail in each task's feed. Best-effort: the move
        // already committed.
        const movedHome = beforeMove.filter((t) => t.sectionId !== value);
        if (movedHome.length > 0) {
          try {
            await prisma.activity.createMany({
              data: movedHome.map((t) => ({
                type: "TASK_MOVED" as const,
                taskId: t.id,
                userId,
                data: { newSectionId: value },
              })),
            });
          } catch (err) {
            console.error("[tasks bulk move_section] activity failed:", err);
          }
        }
        for (const t of beforeMove) {
          if (t.projectId && t.sectionId !== value) {
            await executeRulesOnSectionChange(
              { taskId: t.id, actorUserId: userId },
              value,
              t.projectId
            );
          }
        }
        // Report what actually moved, not what was asked for — the toast
        // shows this number.
        return NextResponse.json({ success: true, count: placements.length });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error in bulk operation:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk operation" },
      { status: 500 }
    );
  }
}
