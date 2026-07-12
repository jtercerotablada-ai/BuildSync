import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyProjectAccess, getErrorStatus } from "@/lib/auth-guards";
import { readTimeTracking, WORK_HOURS_PER_DAY } from "@/lib/duration";

// GET /api/projects/:projectId/workload
// Project-scoped mirror of /api/portfolios/:id/workload — returns the
// project's open tasks + their distinct assignees so the Workload view can
// render an assignee×day heatmap. Each task carries `estimatedMinutes`
// (summed from TIME_TRACKING custom fields) for the Hours measure.

/** Estimated minutes from a TIME_TRACKING value blob. TIME_TRACKING now
 *  stores { estimatedDays, actualDays } in working days (readTimeTracking
 *  also handles the legacy minutes shape); the client's Hours measure wants
 *  minutes, so convert days → minutes via the standard work-day length. */
function estimatedMinutesOf(value: unknown): number {
  const { estimatedDays } = readTimeTracking(value);
  return estimatedDays && estimatedDays > 0
    ? estimatedDays * WORK_HOURS_PER_DAY * 60
    : 0;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;

    // Read access — throws for non-members of a private project.
    await verifyProjectAccess(userId, projectId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, color: true, workspaceId: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const tasks = await prisma.task.findMany({
      where: { projectId, completed: false },
      select: {
        id: true,
        name: true,
        assigneeId: true,
        startDate: true,
        dueDate: true,
        completed: true,
        projectId: true,
        taskStatus: true,
        priority: true,
      },
    });

    // ── Estimated minutes per task from TIME_TRACKING custom fields ──
    const taskIds = tasks.map((t) => t.id);
    const estimatedMinutesByTask = new Map<string, number>();
    if (taskIds.length) {
      const timeDefs = await prisma.customFieldDefinition.findMany({
        where: { workspaceId: project.workspaceId, type: "TIME_TRACKING" },
        select: { id: true },
      });
      const timeFieldIds = timeDefs.map((d) => d.id);
      if (timeFieldIds.length) {
        const values = await prisma.customFieldValue.findMany({
          where: { taskId: { in: taskIds }, fieldId: { in: timeFieldIds } },
          select: { taskId: true, value: true },
        });
        for (const v of values) {
          const mins = estimatedMinutesOf(v.value);
          if (mins > 0) {
            estimatedMinutesByTask.set(
              v.taskId,
              (estimatedMinutesByTask.get(v.taskId) || 0) + mins
            );
          }
        }
      }
    }

    const assigneeIds = [
      ...new Set(tasks.map((t) => t.assigneeId).filter((v): v is string => !!v)),
    ];
    const assignees = assigneeIds.length
      ? await prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            jobTitle: true,
            position: true,
            customTitle: true,
          },
        })
      : [];

    return NextResponse.json({
      tasks: tasks.map((t) => ({
        ...t,
        startDate: t.startDate ? t.startDate.toISOString() : null,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        estimatedMinutes: estimatedMinutesByTask.get(t.id) || 0,
      })),
      assignees,
      // Single-project shape parity with the portfolio endpoint.
      projects: [{ id: project.id, name: project.name, color: project.color }],
    });
  } catch (err) {
    const { status, message } = getErrorStatus(err);
    if (status !== 500) return NextResponse.json({ error: message }, { status });
    console.error("[project workload GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch workload" },
      { status: 500 }
    );
  }
}
