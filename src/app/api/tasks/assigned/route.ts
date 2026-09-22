import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { contributorSeatSatisfied } from "@/lib/auth-guards";

// GET /api/tasks/assigned - Get tasks assigned by current user to others
export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Tasks where the current user is the CREATOR but NOT the assignee.
    // Consumed only by the assigned-tasks widget, so the select is slimmed
    // to exactly the fields it renders (id/name/completed/dueDate + assignee
    // and project stubs).
    // Completed history is windowed to the last 30 days so old done work
    // doesn't eat into the 200-row budget; completedAt: null rows are kept
    // (pending tasks, plus legacy completions from before the column).
    // A creator tie only counts while the caller still holds a contributor
    // seat in the task's workspace (see decideTaskAccess): someone removed
    // from the firm must not keep listing the tasks they created there, whose
    // details now answer 404. Personal (projectless) tasks have no workspace
    // and always count.
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true, role: true },
    });
    const seatWorkspaceIds = memberships
      .filter((m) => contributorSeatSatisfied(m.role))
      .map((m) => m.workspaceId);

    const completedCutoff = new Date();
    completedCutoff.setDate(completedCutoff.getDate() - 30);

    const tasks = await prisma.task.findMany({
      where: {
        creatorId: userId,
        assigneeId: {
          not: userId,
        },
        parentTaskId: null, // Only top-level tasks
        AND: [
          {
            OR: [
              { completed: false },
              { completedAt: null },
              { completedAt: { gte: completedCutoff } },
            ],
          },
          {
            OR: [
              { projectId: null },
              { project: { workspaceId: { in: seatWorkspaceIds } } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        completed: true,
        dueDate: true,
        assignee: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: [
        { completed: "asc" }, // Pending first
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
      take: 200,
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching assigned tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch assigned tasks" },
      { status: 500 }
    );
  }
}
