import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { deleteFile } from "@/lib/storage";
import { loadMessageWithAccess } from "@/lib/message-access";

/**
 * DELETE /api/messages/:messageId/attachments/:attachmentId
 *
 * Remove a file from a message. Author of the message OR a scope
 * admin (project owner/ADMIN, portfolio owner/EDITOR) may delete.
 */
export async function DELETE(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ messageId: string; attachmentId: string }>;
  }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { messageId, attachmentId } = await params;

    const access = await loadMessageWithAccess(messageId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }
    if (!access.isAuthor && !access.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const attachment = await prisma.messageAttachment.findFirst({
      where: { id: attachmentId, messageId },
    });
    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.messageAttachment.delete({ where: { id: attachmentId } });

    try {
      await deleteFile(attachment.url);
    } catch (err) {
      console.error(
        "[message attachment DELETE] blob delete failed (row removed):",
        err
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[message attachment DELETE] error:", err);
    return NextResponse.json(
      { error: "Failed to delete attachment" },
      { status: 500 }
    );
  }
}
