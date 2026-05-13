import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { deleteFile } from "@/lib/storage";

/**
 * DELETE /api/messages/:messageId/attachments/:attachmentId
 *
 * Remove a file from a message. Author of the message OR a project
 * owner/ADMIN may delete (mirrors the message-deletion permission
 * model: authors own their content, but project leadership can
 * moderate).
 *
 * Best-effort blob cleanup: the DB row is removed first; if the
 * blob delete fails the row stays gone so we don't end up with
 * stale phantom attachments — the orphan blob is acceptable noise
 * for now and can be GC'd later.
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

    const attachment = await prisma.messageAttachment.findFirst({
      where: { id: attachmentId, messageId },
      include: {
        message: {
          select: {
            id: true,
            authorId: true,
            project: {
              select: {
                ownerId: true,
                members: { select: { userId: true, role: true } },
              },
            },
          },
        },
      },
    });
    if (!attachment || !attachment.message) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isAuthor = attachment.message.authorId === userId;
    const isOwner = attachment.message.project?.ownerId === userId;
    const member = attachment.message.project?.members.find(
      (m) => m.userId === userId
    );
    const isAdmin = member?.role === "ADMIN";
    if (!isAuthor && !isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
