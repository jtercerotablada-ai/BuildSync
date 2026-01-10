import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// POST /api/tasks/:taskId/like - Toggle like on a task
export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if like already exists
    const existingLike = await prisma.taskLike.findUnique({
      where: {
        taskId_userId: {
          taskId,
          userId,
        },
      },
    });

    if (existingLike) {
      // Unlike - remove the like
      await prisma.taskLike.delete({
        where: {
          id: existingLike.id,
        },
      });

      return NextResponse.json({ liked: false });
    } else {
      // Like - create new like
      await prisma.taskLike.create({
        data: {
          taskId,
          userId,
        },
      });

      return NextResponse.json({ liked: true });
    }
  } catch (error) {
    console.error("Error toggling like:", error);
    return NextResponse.json(
      { error: "Failed to toggle like" },
      { status: 500 }
    );
  }
}

// GET /api/tasks/:taskId/like - Check if user liked the task
export async function GET(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const like = await prisma.taskLike.findUnique({
      where: {
        taskId_userId: {
          taskId,
          userId,
        },
      },
    });

    return NextResponse.json({ liked: !!like });
  } catch (error) {
    console.error("Error checking like:", error);
    return NextResponse.json(
      { error: "Failed to check like" },
      { status: 500 }
    );
  }
}
