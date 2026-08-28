import { NextResponse } from "next/server";
import { startOfTodayUtc, startOfTomorrowUtc } from "@/lib/date-only";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// GET /api/dashboard/stats - Get dashboard statistics
export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    // Due dates are stored at UTC midnight; bucketing them with local
    // getters only happened to work because the server runs in UTC.
    const today = startOfTodayUtc(now);
    const tomorrow = startOfTomorrowUtc(now);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // An archived project is off every list the user can reach, so its open
    // tasks can't be opened, reassigned or closed — counting them here leaves
    // a number the user has no way to work down. Tasks with no project at all
    // are real load and still count.
    const openTaskScope = [{ projectId: null }, { project: { isArchived: false } }];

    // Run all queries in parallel for better performance
    const [dueToday, overdue, completedThisWeek, activeProjects] = await Promise.all([
      // Tasks due today (assigned to user, not completed)
      prisma.task.count({
        where: {
          assigneeId: userId,
          completed: false,
          dueDate: {
            gte: today,
            lt: tomorrow,
          },
          OR: openTaskScope,
        },
      }),

      // Overdue tasks (assigned to user, not completed, due before today)
      prisma.task.count({
        where: {
          assigneeId: userId,
          completed: false,
          dueDate: {
            lt: today,
          },
          OR: openTaskScope,
        },
      }),

      // Completed this week (by user). Not archive-scoped, unlike the two
      // above: this is what the person shipped, and archiving the job they
      // just finished must not erase it.
      prisma.task.count({
        where: {
          assigneeId: userId,
          completed: true,
          completedAt: {
            gte: weekAgo,
          },
        },
      }),

      // Active projects (user is owner or member, not completed)
      prisma.project.count({
        where: {
          status: {
            not: "COMPLETE",
          },
          // Archiving is a separate axis from status — a shelved project
          // can still be mid-gate — but neither one is active work.
          isArchived: false,
          OR: [
            { ownerId: userId },
            { members: { some: { userId } } },
          ],
        },
      }),
    ]);

    return NextResponse.json({
      dueToday,
      overdue,
      completedThisWeek,
      activeProjects,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
