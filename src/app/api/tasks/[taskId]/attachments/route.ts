import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

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

    const attachments = await prisma.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(attachments);
  } catch (error) {
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

    // Verify task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Get file extension
    const fileName = file.name;
    const fileType = fileName.split('.').pop()?.toLowerCase() || 'unknown';
    const fileSize = file.size;

    // TODO: Upload to storage (S3, Cloudinary, etc.)
    // For now, we'll create a placeholder URL
    // In production, you would upload the file and get the real URL
    const fileUrl = `/uploads/${taskId}/${Date.now()}-${fileName}`;

    // Create attachment record
    const attachment = await prisma.attachment.create({
      data: {
        name: fileName,
        url: fileUrl,
        mimeType: file.type || fileType,
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
    console.error("Error uploading attachment:", error);
    return NextResponse.json(
      { error: "Failed to upload attachment" },
      { status: 500 }
    );
  }
}
