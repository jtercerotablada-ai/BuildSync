import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { uploadFile } from "@/lib/storage";
import { loadMessageWithAccess } from "@/lib/message-access";

/**
 * POST /api/messages/:messageId/attachments
 *
 * Upload a file and bind it to an existing message. Works for both
 * project and portfolio messages (Message is the shared model).
 *
 * Access: the actor must be able to read the message's scope AND
 * must be the message author (attachments are part of the message,
 * not a global comment thread).
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

    const access = await loadMessageWithAccess(messageId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }
    if (!access.isAuthor) {
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
