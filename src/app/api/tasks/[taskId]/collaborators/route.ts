import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTaskAccess, assertUserInWorkspace, getUserWorkspaceId, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";

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

    const { userId: collaboratorId } = await req.json();

    if (!collaboratorId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Anyone with read access may follow a task themselves; adding
    // SOMEONE ELSE as a collaborator requires write access on the task.
    const task = await verifyTaskAccess(userId, taskId, {
      requireWrite: collaboratorId !== userId,
    });

    // The collaborator must be a member of the task's workspace. Without
    // this, collaboratorId is trusted from the body and the endpoint returns
    // { id, name, image } for ANY user id — a cross-workspace enumeration
    // oracle and PII leak — plus it attaches out-of-workspace users — audit SEC-03.
    const workspaceId = task.project?.workspaceId ?? (await getUserWorkspaceId(userId));
    await assertUserInWorkspace(collaboratorId, workspaceId);

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

    // Touch the task so the "Last modified" field reflects the change.
    await prisma.task.update({
      where: { id: taskId },
      data: { updatedAt: new Date() },
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

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId") || userId;

    // Leaving a task yourself only needs read access; removing ANOTHER
    // collaborator requires write access on the task.
    await verifyTaskAccess(userId, taskId, {
      requireWrite: targetUserId !== userId,
    });

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

    // Touch the task so the "Last modified" field reflects the change.
    await prisma.task.update({
      where: { id: taskId },
      data: { updatedAt: new Date() },
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
