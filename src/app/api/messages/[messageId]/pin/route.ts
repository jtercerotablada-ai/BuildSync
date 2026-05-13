import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

/**
 * POST /api/messages/:messageId/pin
 *
 * Toggles the pinned state of a message. Any project member can pin
 * a message; the use-case is collaborative — anyone on the team
 * should be able to flag an important update. Only project admins
 * and owners can DELETE a pin (handled by the same toggle when the
 * actor was the one who pinned). For now, toggle is open to all
 * members.
 */

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { messageId } = await params;

    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        project: {
          select: {
            id: true,
            ownerId: true,
            visibility: true,
            workspaceId: true,
            members: { select: { userId: true } },
          },
        },
      },
    });
    if (!msg) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Replies aren't pinnable on purpose — pinning lives at the
    // root level so the thread surface stays the unit of "important".
    if (msg.parentMessageId) {
      return NextResponse.json(
        { error: "Replies can't be pinned — pin the parent message" },
        { status: 400 }
      );
    }

    // Access gate — must be able to read the project at minimum.
    if (msg.project) {
      const member = msg.project.members.find((m) => m.userId === userId);
      const isOwner = msg.project.ownerId === userId;
      const isMember = !!member;
      let allowed =
        isOwner || isMember || msg.project.visibility === "PUBLIC";
      if (!allowed && msg.project.visibility === "WORKSPACE") {
        const wsMember = await prisma.workspaceMember.findUnique({
          where: {
            userId_workspaceId: {
              userId,
              workspaceId: msg.project.workspaceId,
            },
          },
        });
        if (wsMember) allowed = true;
      }
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { isPinned: !msg.isPinned },
      select: { id: true, isPinned: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[message pin] error:", err);
    return NextResponse.json(
      { error: "Failed to toggle pin" },
      { status: 500 }
    );
  }
}
