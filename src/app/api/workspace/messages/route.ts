import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId, getEffectiveAccess } from "@/lib/auth-utils";
import { requireWorkspaceContributor, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";

// GET /api/workspace/messages - Get workspace messages
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50") || 50, 1), 100);

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (!workspaceMember) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const messages = await prisma.message.findMany({
      where: {
        workspaceId: workspaceMember.workspaceId,
        projectId: null, // Only workspace-level messages
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        attachments: true,
        reactions: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
    });

    return NextResponse.json({
      messages: messages.reverse(),
      nextCursor: messages.length === limit ? messages[0]?.id : null,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST /api/workspace/messages - Create a new message
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireWorkspaceContributor(userId);

    const { content } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (!workspaceMember) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const message = await prisma.message.create({
      data: {
        content,
        workspaceId: workspaceMember.workspaceId,
        authorId: userId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        attachments: true,
        reactions: true,
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error creating message:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}

// PUT /api/workspace/messages - Update a message (edit or pin)
export async function PUT(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireWorkspaceContributor(userId);

    const { messageId, content, isPinned } = await req.json();

    if (!messageId) {
      return NextResponse.json({ error: "Message ID required" }, { status: 400 });
    }

    // Verify message belongs to user (for editing) or user is admin (for pinning)
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Scope the message to the caller's workspace. Without this, any
    // authenticated user could pin/unpin or edit messages in other
    // workspaces by id — audit (cross-workspace tampering).
    const access = await getEffectiveAccess(userId);
    if (!access || message.workspaceId !== access.workspaceId) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (content !== undefined && message.authorId !== userId) {
      return NextResponse.json({ error: "Cannot edit others' messages" }, { status: 403 });
    }

    // Pinning is an admin action, not something any member can do.
    if (isPinned !== undefined && !["OWNER", "ADMIN"].includes(access.workspaceRole)) {
      return NextResponse.json(
        { error: "Only workspace admins can pin messages" },
        { status: 403 }
      );
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        ...(content !== undefined && { content }),
        ...(isPinned !== undefined && { isPinned }),
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        attachments: true,
        reactions: true,
      },
    });

    return NextResponse.json(updatedMessage);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error updating message:", error);
    return NextResponse.json(
      { error: "Failed to update message" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspace/messages - Delete a message
export async function DELETE(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireWorkspaceContributor(userId);

    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("id");

    if (!messageId) {
      return NextResponse.json({ error: "Message ID required" }, { status: 400 });
    }

    // Verify message belongs to user or user is admin
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Scope to the caller's workspace first, so an admin of workspace A
    // cannot delete a message in workspace B — audit (the previous admin
    // check used findFirst without matching the message's workspace).
    const access = await getEffectiveAccess(userId);
    if (!access || message.workspaceId !== access.workspaceId) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (
      message.authorId !== userId &&
      !["OWNER", "ADMIN"].includes(access.workspaceRole)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.message.delete({
      where: { id: messageId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error deleting message:", error);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
