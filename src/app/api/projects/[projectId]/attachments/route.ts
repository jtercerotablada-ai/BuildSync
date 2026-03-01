import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// GET /api/projects/:projectId/attachments - Get all attachments for a project
export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { projectId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify project exists and user has access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get all attachments for tasks in this project
    const attachments = await prisma.attachment.findMany({
      where: {
        task: {
          section: {
            projectId,
          },
        },
      },
      include: {
        task: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get uploader info for all attachments
    const uploaderIds = [...new Set(attachments.map(a => a.uploaderId))];
    const uploaders = await prisma.user.findMany({
      where: { id: { in: uploaderIds } },
      select: { id: true, name: true, email: true, image: true },
    });
    const uploaderMap = new Map(uploaders.map(u => [u.id, u]));

    const result = attachments.map(a => ({
      id: a.id,
      name: a.name,
      url: a.url,
      size: a.size,
      mimeType: a.mimeType,
      createdAt: a.createdAt.toISOString(),
      taskId: a.task?.id || null,
      taskName: a.task?.name || null,
      uploader: uploaderMap.get(a.uploaderId) || null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching project attachments:", error);
    return NextResponse.json(
      { error: "Failed to fetch attachments" },
      { status: 500 }
    );
  }
}
