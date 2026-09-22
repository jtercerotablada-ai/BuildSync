import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { taskPrivacyClause } from "@/lib/project-visibility";
import { getProjectAccess } from "@/lib/project-access";
import { startOfTodayUtc as utcTodayStart } from "@/lib/date-only";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The caller's calendar day as "YYYY-MM-DD" (?today=). The server runs in
// UTC, so from 20:00 in Miami its own date is already tomorrow and a task due
// today was counted overdue. A client-sent day is only trusted within one day
// of the UTC day (every real time zone falls inside that window); otherwise
// fall back to the UTC day. Same rule as /api/ai/assist.
function resolveToday(value: string | null): Date {
  const utcToday = utcTodayStart();
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (
      !Number.isNaN(parsed.getTime()) &&
      Math.abs(parsed.getTime() - utcToday.getTime()) <= MS_PER_DAY
    ) {
      return parsed;
    }
  }
  return utcToday;
}

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
 * Query: ?today=YYYY-MM-DD — the caller's local day, which decides
 * "overdue" and "upcoming" (see resolveToday).
 *
 * All counts are over the user's accessible scope (the projectId
 * itself is access-gated below). The endpoint is read-only and safe
 * to call on composer open + any refresh.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;

    // Canonical read access (matches the project page). An unreadable
    // project answers 404 like a missing one, so ids cannot be probed.
    const access = await getProjectAccess(projectId, userId);
    if (!access.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Workspace OWNER/ADMIN hold the key to private tasks elsewhere
    // (decideTaskAccess, the Files tab), so the same here.
    const taskVisible = access.isWorkspaceManager
      ? {}
      : taskPrivacyClause(userId);

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
    // Due dates are stored at UTC midnight of the due day, so the caller's
    // day expressed the same way is the boundary: a task/milestone due TODAY
    // is neither counted overdue nor excluded from upcoming.
    const startOfTodayUtc = resolveToday(
      new URL(req.url).searchParams.get("today")
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
      // Root tasks completed in window (checklist subtasks are not tasks)
      prisma.task.count({
        where: {
          projectId,
          parentTaskId: null,
          completed: true,
          completedAt: { gte: windowStart, lte: now },
        },
      }),
      // Currently overdue — strictly BEFORE the caller's day, so a task due
      // today isn't counted overdue. Root tasks the caller can see, the same
      // set the Overview's overdue nudge counts, so the two agree.
      prisma.task.count({
        where: {
          projectId,
          parentTaskId: null,
          ...taskVisible,
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
// PRIVACY: reading the project is not the same as reading every task in
// it. A private task is visible only to its creator, its assignee, or a
// workspace manager —
// taskPrivacyClause() is the rule the rest of the product lists by, and
// without it this endpoint printed other people's private milestone
// NAMES. Same leak the project activity feed had.
      prisma.task.findMany({
        where: {
          projectId,
          ...taskVisible,
          taskType: "MILESTONE",
          completed: false,
          dueDate: {
            gte: startOfTodayUtc,
            lte: new Date(startOfTodayUtc.getTime() + 14 * MS_PER_DAY),
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
    // See the privacy note on the upcoming-milestones query above.
    const recentMilestones = await prisma.task.findMany({
      where: {
        projectId,
        ...taskVisible,
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
