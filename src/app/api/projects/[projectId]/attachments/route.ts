import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyProjectAccess,
  getErrorStatus,
  AuthorizationError,
  NotFoundError,
} from "@/lib/auth-guards";

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
    await verifyProjectAccess(userId, projectId);

    // Get all attachments for tasks in this project (including tasks without sections)
    const attachments = await prisma.attachment.findMany({
      where: {
        task: {
          OR: [
            { projectId },
            { section: { projectId } },
          ],
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

    const taskResult = attachments.map(a => ({
      id: a.id,
      name: a.name,
      url: a.url,
      size: a.size,
      mimeType: a.mimeType,
      createdAt: a.createdAt.toISOString(),
      taskId: a.task?.id || null,
      taskName: a.task?.name || null,
      messageId: null as string | null,
      source: "task" as const,
      resourceType: null as "FILE" | "LINK" | null,
      uploader: uploaderMap.get(a.uploaderId) || null,
    }));

    // Message attachments — the Files tab explicitly promises "all task AND
    // message attachments"; these were never collected before.
    const messageAttachments = await prisma.messageAttachment.findMany({
      where: { message: { projectId } },
      include: {
        message: {
          select: {
            id: true,
            author: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const messageResult = messageAttachments.map((a) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      size: a.size,
      mimeType: a.mimeType,
      createdAt: a.createdAt.toISOString(),
      taskId: null,
      taskName: null,
      messageId: a.message?.id ?? null,
      source: "message" as const,
      resourceType: null as "FILE" | "LINK" | null,
      uploader: a.message?.author ?? null,
    }));

    // Overview "Key resources" (ProjectResource) — the unified Files tab
    // must surface files/links added ANYWHERE in the project, so the
    // curated Overview resources belong here too (a FILE uploads to the
    // same blob store; a LINK is an external URL).
    const resources = await prisma.projectResource.findMany({
      where: { projectId },
      select: {
        id: true,
        type: true,
        name: true,
        url: true,
        size: true,
        mimeType: true,
        createdAt: true,
        uploader: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const resourceResult = resources.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      size: r.size ?? 0,
      mimeType:
        r.mimeType ??
        (r.type === "LINK" ? "text/uri-list" : "application/octet-stream"),
      createdAt: r.createdAt.toISOString(),
      taskId: null,
      taskName: null,
      messageId: null,
      source: "resource" as const,
      resourceType: r.type as "FILE" | "LINK",
      uploader: r.uploader ?? null,
    }));

    // Merge, newest first.
    const result = [...taskResult, ...messageResult, ...resourceResult].sort(
      (x, y) => (x.createdAt < y.createdAt ? 1 : x.createdAt > y.createdAt ? -1 : 0)
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching project attachments:", error);
    return NextResponse.json(
      { error: "Failed to fetch attachments" },
      { status: 500 }
    );
  }
}
