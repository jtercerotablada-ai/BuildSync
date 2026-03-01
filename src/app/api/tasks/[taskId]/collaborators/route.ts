import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTaskAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";

// POST /api/tasks/:taskId/collaborators - Add collaborator
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

    // Verify user has access to this task
    await verifyTaskAccess(userId, taskId);

    const { userId: collaboratorId } = await req.json();

    if (!collaboratorId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Check if already a collaborator
    const existing = await prisma.taskCollaborator.findUnique({
      where: {
        taskId_userId: { taskId, userId: collaboratorId },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Already a collaborator" },
        { status: 409 }
      );
    }

    await prisma.taskCollaborator.create({
      data: { taskId, userId: collaboratorId },
    });

    const user = await prisma.user.findUnique({
      where: { id: collaboratorId },
      select: { id: true, name: true, image: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error adding collaborator:", error);
    return NextResponse.json(
      { error: "Failed to add collaborator" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/:taskId/collaborators - Remove collaborator (self or by userId)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to this task
    await verifyTaskAccess(userId, taskId);

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId") || userId;

    const existing = await prisma.taskCollaborator.findUnique({
      where: {
        taskId_userId: { taskId, userId: targetUserId },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Not a collaborator" },
        { status: 404 }
      );
    }

    await prisma.taskCollaborator.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error removing collaborator:", error);
    return NextResponse.json(
      { error: "Failed to remove collaborator" },
      { status: 500 }
    );
  }
}
