import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { taskPrivacyClause } from "@/lib/project-visibility";
import { readTimeTracking, WORK_HOURS_PER_DAY } from "@/lib/duration";

// GET /api/portfolios/:portfolioId/workload
// Returns all open tasks across projects in this portfolio + the
// distinct assignees, so the Workload view can render a member×day
// heatmap without making one request per project.
//
// Each task also carries `estimatedMinutes` (summed from every
// TIME_TRACKING custom field on the task, minutes) so the client can
// switch the Measure between "Task count" and "Hours" without a second
// request. The projects list backs Group-by / Filter-by project.

/** Estimated minutes from a TIME_TRACKING value blob. TIME_TRACKING now
 *  stores { estimatedDays, actualDays } in working days (readTimeTracking
 *  also handles the legacy minutes shape); convert days → minutes for the
 *  client's Hours measure. */
function estimatedMinutesOf(value: unknown): number {
  const { estimatedDays } = readTimeTracking(value);
  return estimatedDays && estimatedDays > 0
    ? estimatedDays * WORK_HOURS_PER_DAY * 60
    : 0;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { portfolioId } = await params;

    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: {
        id: true,
        ownerId: true,
        privacy: true,
        workspaceId: true,
        members: { select: { userId: true } },
        projects: { select: { projectId: true } },
      },
    });

    if (!portfolio) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const isOwner = portfolio.ownerId === userId;
    const isMember = portfolio.members.some((m) => m.userId === userId);
    // Membership of the portfolio's OWN workspace is required for EVERY
    // caller — the blanket check the canonical GET /api/portfolios/
    // [portfolioId] runs via verifyWorkspaceAccess, which this endpoint
    // skipped. Closes both PUBLIC granting any authenticated user of any
    // workspace (cross-tenant read of every open task + assignee) and an
    // offboarded owner/member whose PortfolioMember row survived (it does NOT
    // cascade on WorkspaceMember delete). PUBLIC = "everyone in THIS
    // workspace".
    const wsMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: portfolio.workspaceId },
      },
    });
    const allowed =
      !!wsMember && (isOwner || isMember || portfolio.privacy === "PUBLIC");
    if (!allowed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const projectIds = portfolio.projects.map((p) => p.projectId);
    if (projectIds.length === 0) {
      return NextResponse.json({ tasks: [], assignees: [], projects: [] });
    }

    // Root tasks only, matching /api/teams/:id/workload. Counting subtasks as
    // their own assignments listed each one next to its parent and summed the
    // parent's TIME_TRACKING estimate twice, so the same engineer showed a
    // different load here than on Team > Workload.
    // PRIVACY: a portfolio groups projects the viewer may read, which is
    // not permission to read every task inside them. Without this clause
    // the workload grid listed other people's private task NAMES and who
    // they were assigned to. Same leak the project activity feed had.
    const tasks = await prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
        parentTaskId: null,
        completed: false,
        ...taskPrivacyClause(userId),
      },
      select: {
        id: true,
        name: true,
        assigneeId: true,
        dueDate: true,
        completed: true,
        projectId: true,
        taskStatus: true,
        priority: true,
      },
    });

    // ── Estimated hours per task, from TIME_TRACKING custom fields ──
    // TIME_TRACKING values are stored as { estimatedMin, actualMin } in
    // MINUTES (see PATCH /api/tasks/[id]/custom-fields/[fieldId]). We sum
    // estimatedMin across every TIME_TRACKING field on the task, then let
    // the client convert to hours. No schema change — we join the existing
    // CustomFieldValue rows for TIME_TRACKING defs in this workspace.
    const taskIds = tasks.map((t) => t.id);
    const estimatedMinutesByTask = new Map<string, number>();
    if (taskIds.length) {
      const timeDefs = await prisma.customFieldDefinition.findMany({
        where: { workspaceId: portfolio.workspaceId, type: "TIME_TRACKING" },
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
          },
        })
      : [];

    // Projects that actually own the returned tasks — backs the Group-by
    // and Filter-by project controls (names + colors for the client).
    const usedProjectIds = [
      ...new Set(tasks.map((t) => t.projectId).filter((v): v is string => !!v)),
    ];
    const projects = usedProjectIds.length
      ? await prisma.project.findMany({
          where: { id: { in: usedProjectIds } },
          select: { id: true, name: true, color: true },
        })
      : [];

    return NextResponse.json({
      tasks: tasks.map((t) => ({
        ...t,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        estimatedMinutes: estimatedMinutesByTask.get(t.id) || 0,
      })),
      assignees,
      projects,
    });
  } catch (err) {
    console.error("[portfolio workload GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch workload" },
      { status: 500 }
    );
  }
}
