import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { resolveProjectAccess } from "@/lib/project-access";

/**
 * GET /api/projects/:projectId/status-highlights
 *
 * Returns the auto-pulled metrics the Status Update composer surfaces
 * as the "Highlights" strip + pre-fills into the "What we've
 * accomplished" block. Mirrors Asana's Status Builder highlights
 * (milestones, tasks completed, etc.) but tuned for engineering work
 * (RFIs/forms submissions also counted, overdue work flagged).
 *
 * Window:
 *   - When the project has at least one prior status update, the
 *     window starts at that update's createdAt → "what's happened
 *     since the last check-in".
 *   - When the project has none, the window is the last 7 days →
 *     "what's happened this week" so a first update isn't empty.
 *
 * All counts are over the user's accessible scope (the projectId
 * itself is access-gated below). The endpoint is read-only and safe
 * to call on composer open + any refresh.
 */
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

    // Canonical read access (matches the project page): owner, member,
    // PUBLIC, or workspace OWNER/ADMIN / L4+. The old inline check leaked
    // WORKSPACE-visibility projects to any member and 403'd workspace admins.
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        ownerId: true,
        visibility: true,
        workspaceId: true,
        members: { select: { userId: true, role: true } },
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const access = await resolveProjectAccess(project, userId);
    if (!access.ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Compute the time window.
    const lastUpdate = await prisma.statusUpdate.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const windowStart = lastUpdate
      ? lastUpdate.createdAt
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    // Due dates are stored at UTC midnight of the due day. Bucket "overdue"
    // and "upcoming" by the UTC calendar day so a task/milestone due TODAY
    // is neither counted overdue nor excluded from upcoming.
    const startOfTodayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    // Run the counts in parallel — each one is small + indexed.
    const [
      milestonesCompleted,
      tasksCompleted,
      tasksOverdue,
      newFormSubmissions,
      commentsCount,
      milestonesUpcoming,
    ] = await Promise.all([
      // Milestones marked complete in window
      prisma.task.count({
        where: {
          projectId,
          taskType: "MILESTONE",
          completed: true,
          completedAt: { gte: windowStart, lte: now },
        },
      }),
      // Total tasks completed in window
      prisma.task.count({
        where: {
          projectId,
          completed: true,
          completedAt: { gte: windowStart, lte: now },
        },
      }),
      // Currently overdue — strictly BEFORE today (UTC day), so a task due
      // today isn't counted overdue from the moment the day begins.
      prisma.task.count({
        where: {
          projectId,
          completed: false,
          dueDate: { lt: startOfTodayUtc },
        },
      }),
      // New form submissions (RFIs, change orders, inspections) in window
      prisma.formSubmission.count({
        where: {
          form: { projectId },
          createdAt: { gte: windowStart, lte: now },
        },
      }),
      // Discussion volume — comments on this project's tasks
      prisma.comment.count({
        where: {
          task: { projectId },
          createdAt: { gte: windowStart, lte: now },
        },
      }),
      // Milestones approaching in the NEXT 14 days — surfaces what's
      // coming up so the composer can pre-fill the "Next steps" block
      prisma.task.findMany({
        where: {
          projectId,
          taskType: "MILESTONE",
          completed: false,
          dueDate: {
            gte: startOfTodayUtc,
            lte: new Date(startOfTodayUtc.getTime() + 14 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
        select: { id: true, name: true, dueDate: true },
      }),
    ]);

    // Pull the names of the milestones that landed so the
    // "Accomplished" block can pre-fill with real titles instead of
    // a bare count.
    const recentMilestones = await prisma.task.findMany({
      where: {
        projectId,
        taskType: "MILESTONE",
        completed: true,
        completedAt: { gte: windowStart, lte: now },
      },
      orderBy: { completedAt: "desc" },
      take: 5,
      select: { id: true, name: true, completedAt: true },
    });

    return NextResponse.json({
      windowStart: windowStart.toISOString(),
      windowDays: Math.max(
        1,
        Math.round((now.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24))
      ),
      hadPriorUpdate: !!lastUpdate,
      counts: {
        milestonesCompleted,
        tasksCompleted,
        tasksOverdue,
        newFormSubmissions,
        commentsCount,
      },
      milestonesRecent: recentMilestones.map((m) => ({
        id: m.id,
        name: m.name,
        completedAt: m.completedAt?.toISOString() ?? null,
      })),
      milestonesUpcoming: milestonesUpcoming.map((m) => ({
        id: m.id,
        name: m.name,
        dueDate: m.dueDate?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    console.error("[status-highlights] error:", err);
    return NextResponse.json(
      { error: "Failed to load highlights" },
      { status: 500 }
    );
  }
}
