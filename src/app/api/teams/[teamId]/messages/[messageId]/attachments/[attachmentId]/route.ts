import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { deleteFile } from "@/lib/storage";
import {
  verifyTeamAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";

/**
 * DELETE /api/teams/:teamId/messages/:messageId/attachments/:attachmentId
 *
 * Remove a file from a team message. Author of the message OR team
 * LEAD may delete (mirrors the message-deletion permission model:
 * authors own their content, but team leadership can moderate).
 *
 * Best-effort blob cleanup — the DB row is removed first; if the
 * blob delete fails the row stays gone so we don't end up with
 * stale phantom attachments.
 */
export async function DELETE(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{
      teamId: string;
      messageId: string;
      attachmentId: string;
    }>;
  }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { teamId, messageId, attachmentId } = await params;
    await verifyTeamAccess(userId, teamId);

    const attachment = await prisma.messageAttachment.findFirst({
      where: { id: attachmentId, teamMessageId: messageId },
      include: {
        teamMessage: {
          select: { id: true, teamId: true, authorId: true },
        },
      },
    });
    if (
      !attachment ||
      !attachment.teamMessage ||
      attachment.teamMessage.teamId !== teamId
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isAuthor = attachment.teamMessage.authorId === userId;
    const teamMember = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });
    const isLead = teamMember?.role === "LEAD";

    if (!isAuthor && !isLead) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.messageAttachment.delete({ where: { id: attachmentId } });

    try {
      await deleteFile(attachment.url);
    } catch (err) {
      console.error(
        "[team message attachment DELETE] blob delete failed:",
        err
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof NotFoundError
    ) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[team message attachment DELETE] error:", error);
    return NextResponse.json(
      { error: "Failed to delete attachment" },
      { status: 500 }
    );
  }
}
