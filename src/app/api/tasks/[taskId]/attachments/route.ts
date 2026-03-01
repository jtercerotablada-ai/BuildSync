import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { uploadFile } from "@/lib/storage";
import { verifyTaskAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";

// GET /api/tasks/:taskId/attachments - Get task attachments
export async function GET(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to this task
    await verifyTaskAccess(userId, taskId);

    const attachments = await prisma.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(attachments);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching attachments:", error);
    return NextResponse.json(
      { error: "Failed to fetch attachments" },
      { status: 500 }
    );
  }
}

// POST /api/tasks/:taskId/attachments - Upload attachment
export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to this task
    await verifyTaskAccess(userId, taskId);

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = file.name;
    const fileSize = file.size;

    if (fileSize > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
    }

    const { url: fileUrl } = await uploadFile(file, `tasks/${taskId}`);

    // Create attachment record
    const attachment = await prisma.attachment.create({
      data: {
        name: fileName,
        url: fileUrl,
        mimeType: file.type || "application/octet-stream",
        size: fileSize,
        taskId,
        uploaderId: userId,
      },
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        type: "ATTACHMENT_ADDED",
        taskId,
        userId,
        data: { attachmentId: attachment.id, attachmentName: fileName },
      },
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error uploading attachment:", error);
    return NextResponse.json(
      { error: "Failed to upload attachment" },
      { status: 500 }
    );
  }
}
