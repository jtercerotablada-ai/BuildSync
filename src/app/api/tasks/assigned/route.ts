import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

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
    const tasks = await prisma.task.findMany({
      where: {
        creatorId: userId,
        assigneeId: {
          not: userId,
        },
        parentTaskId: null, // Only top-level tasks
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
