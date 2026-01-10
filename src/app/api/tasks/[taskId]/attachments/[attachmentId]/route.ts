import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

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

    // TODO: Also delete from storage (S3, Cloudinary, etc.) if needed
    // await deleteFromStorage(attachment.url);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Error deleting attachment:", error);
    return NextResponse.json(
      { error: "Failed to delete attachment" },
      { status: 500 }
    );
  }
}
