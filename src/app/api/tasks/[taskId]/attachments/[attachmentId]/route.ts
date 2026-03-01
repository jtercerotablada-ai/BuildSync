import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { deleteFile } from "@/lib/storage";
import { verifyTaskAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";

// DELETE /api/tasks/:taskId/attachments/:attachmentId - Delete attachment
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ taskId: string; attachmentId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId, attachmentId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to this task
    await verifyTaskAccess(userId, taskId);

    // Verify attachment exists and belongs to task
    const attachment = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        taskId: taskId,
      },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // Delete from database
    await prisma.attachment.delete({
      where: { id: attachmentId },
    });

    // Delete from blob storage
    await deleteFile(attachment.url);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error deleting attachment:", error);
    return NextResponse.json(
      { error: "Failed to delete attachment" },
      { status: 500 }
    );
  }
}
