import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { uploadFile } from "@/lib/storage";

// POST /api/teams/:teamId/messages/:messageId/attachments - Upload message attachment
export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string; messageId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId, messageId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is team member
    const teamMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId, teamId },
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "You must be a team member" },
        { status: 403 }
      );
    }

    // Verify message exists and belongs to the team
    const message = await prisma.teamMessage.findFirst({
      where: { id: messageId, teamId },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
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
        teamMessageId: messageId,
      },
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error("Error uploading message attachment:", error);
    return NextResponse.json(
      { error: "Failed to upload attachment" },
      { status: 500 }
    );
  }
}
