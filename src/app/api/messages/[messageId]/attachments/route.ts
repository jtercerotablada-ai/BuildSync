import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { uploadFile } from "@/lib/storage";

/**
 * POST /api/messages/:messageId/attachments
 *
 * Upload a file and bind it to an existing project message. The
 * flow is "create the message first, then attach" — this keeps the
 * primary POST /api/projects/:id/messages endpoint simple and
 * tolerant to partial failures (a successful message + a failed
 * file upload still leaves a coherent state instead of orphaning
 * blobs).
 *
 * Access: the actor must be able to read the message's project
 * (owner, project member, workspace member when visibility is
 * WORKSPACE, or anyone if PUBLIC). For attachment writes specifically
 * we also require that the actor is the message author — attachments
 * are part of the message, not a global comment thread.
 */

export async function POST(
  req: Request,
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

    // Only the author may add files to their own message — keeps
    // the message immutable for everyone else (matching the edit
    // policy in PATCH /api/messages/:id).
    if (msg.authorId !== userId) {
      return NextResponse.json(
        { error: "Only the author can attach files to their message" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    const { url } = await uploadFile(file, `messages/${messageId}`);

    const attachment = await prisma.messageAttachment.create({
      data: {
        name: file.name,
        url,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        messageId,
      },
    });

    return NextResponse.json(
      {
        id: attachment.id,
        name: attachment.name,
        url: attachment.url,
        size: attachment.size,
        mimeType: attachment.mimeType,
        createdAt: attachment.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[message attachment POST] error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to upload attachment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
