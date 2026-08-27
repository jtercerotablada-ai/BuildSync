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
import { notifyTaskCompleted } from "@/lib/task-notifications";
import { resolveTaskPlacements } from "@/lib/task-placement";

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

      case "incomplete":
        await prisma.task.updateMany({
          where: { id: { in: taskIds } },
          data: { completed: false, completedAt: null },
        });
        return NextResponse.json({ success: true, count: taskIds.length });

      case "delete":
        await prisma.task.deleteMany({
          where: { id: { in: taskIds } },
        });
        return NextResponse.json({ success: true, count: taskIds.length });

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
        await prisma.task.updateMany({
          where: { id: { in: taskIds } },
          data: { assigneeId: value === "unassign" ? null : value },
        });
        return NextResponse.json({ success: true, count: taskIds.length });

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
        await prisma.$transaction([
          ...(homeIds.length
            ? [
                prisma.task.updateMany({
                  where: { id: { in: homeIds } },
                  data: { sectionId: value },
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
