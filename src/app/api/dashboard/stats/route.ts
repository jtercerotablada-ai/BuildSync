import { NextResponse } from "next/server";
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
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

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
        },
      }),

      // Completed this week (by user)
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
