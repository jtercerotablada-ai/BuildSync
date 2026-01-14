import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const updateMessageSchema = z.object({
  content: z.string().min(1).optional(),
  isPinned: z.boolean().optional(),
});

// PATCH /api/teams/:teamId/messages/:messageId - Update message
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ teamId: string; messageId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId, messageId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = updateMessageSchema.parse(body);

    // Get the message
    const message = await prisma.teamMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.teamId !== teamId) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Check permissions - only author can edit content, but any member can pin/unpin
    if (data.content && message.authorId !== userId) {
      return NextResponse.json(
        { error: "Only the author can edit message content" },
        { status: 403 }
      );
    }

    const updatedMessage = await prisma.teamMessage.update({
      where: { id: messageId },
      data,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json(updatedMessage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error updating message:", error);
    return NextResponse.json(
      { error: "Failed to update message" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/:teamId/messages/:messageId - Delete message
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ teamId: string; messageId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId, messageId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the message
    const message = await prisma.teamMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.teamId !== teamId) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Check permissions - author or team lead can delete
    const teamMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    const canDelete =
      message.authorId === userId || teamMember?.role === "LEAD";

    if (!canDelete) {
      return NextResponse.json(
        { error: "You don't have permission to delete this message" },
        { status: 403 }
      );
    }

    await prisma.teamMessage.delete({
      where: { id: messageId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting message:", error);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
