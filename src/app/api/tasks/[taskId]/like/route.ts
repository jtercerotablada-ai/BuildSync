import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTaskAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";

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

    // Verify user has access to this task's workspace
    // Read access ON PURPOSE: a reaction is read-adjacent, the same bar
    // message reactions use. It writes a row, but only the caller's own
    // like/unlike, and it carries no content.
    await verifyTaskAccess(userId, taskId);

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
      // Unlike. deleteMany, not delete: a double click sends two unlikes, and
      // the second must find nothing to remove rather than throw a 500.
      await prisma.taskLike.deleteMany({
        where: { taskId, userId },
      });

      const count = await prisma.taskLike.count({ where: { taskId } });
      return NextResponse.json({ liked: false, count });
    } else {
      // Like. Two quick clicks can both miss the row above; the unique index
      // stops the second insert, and the outcome — liked — is the same.
      try {
        await prisma.taskLike.create({
          data: {
            taskId,
            userId,
          },
        });
      } catch (err) {
        if (
          !(err instanceof Prisma.PrismaClientKnownRequestError) ||
          err.code !== "P2002"
        ) {
          throw err;
        }
      }

      const count = await prisma.taskLike.count({ where: { taskId } });
      return NextResponse.json({ liked: true, count });
    }
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
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

    // Verify user has access to this task's workspace
    await verifyTaskAccess(userId, taskId);

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
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error checking like:", error);
    return NextResponse.json(
      { error: "Failed to check like" },
      { status: 500 }
    );
  }
}
