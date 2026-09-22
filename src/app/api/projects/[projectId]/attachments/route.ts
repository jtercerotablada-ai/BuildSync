import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyProjectAccess,
  getErrorStatus,
  AuthorizationError,
  NotFoundError,
} from "@/lib/auth-guards";
import { taskPrivacyClause } from "@/lib/project-visibility";
import { fileReadUrl } from "@/lib/storage";

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
    const { access } = await verifyProjectAccess(userId, projectId);

    // Get all attachments for tasks in this project (including tasks without
    // sections). A private task's files are listed only to the people who may
    // open the task — the same audience /api/files/attachment/:id serves, so
    // no tile names a task (or file) the caller would get a 404 for.
    // Workspace OWNER/ADMIN keep the key to private tasks there, so here too.
    const attachments = await prisma.attachment.findMany({
      where: {
        task: {
          AND: [
            { OR: [{ projectId }, { section: { projectId } }] },
            access.isWorkspaceManager ? {} : taskPrivacyClause(userId),
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
    // uploaderId is required on Attachment but optional on DeliverableFile
    // (SetNull on user delete), so nulls are filtered out of the lookup.
    const uploaderIds = [
      ...new Set(attachments.map((a) => a.uploaderId).filter((id): id is string => !!id)),
    ];
    const uploaders = await prisma.user.findMany({
      where: { id: { in: uploaderIds } },
      select: { id: true, name: true, email: true, image: true },
    });
    const uploaderMap = new Map(uploaders.map(u => [u.id, u]));

    // Never the stored blob url: it is a storage address (private, or a
    // public one that must not leak). Every url below is the authenticated
    // door that re-runs the owning record's rule; only a LINK resource, which
    // holds no bytes, travels as the address somebody pasted.
    const taskResult = attachments.map(a => ({
      id: a.id,
      name: a.name,
      url: fileReadUrl("attachment", a.id),
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
      url: `/api/messages/${a.messageId ?? a.message?.id ?? ""}/attachments?file=${a.id}`,
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
      url: r.type === "FILE" ? fileReadUrl("resource", r.id) : r.url,
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

    // Deliverable files (revision files and RFI attachments). Listed here so
    // the Files tab shows every file in the project; they are managed — and
    // deleted — only in the Deliverables tab. Same read rule as the tab.
    const deliverableFiles = await prisma.deliverableFile.findMany({
      where: { deliverable: { projectId } },
      select: {
        id: true,
        name: true,
        size: true,
        mimeType: true,
        createdAt: true,
        deliverableId: true,
        deliverable: { select: { number: true } },
        revision: { select: { label: true } },
        uploader: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const deliverableResult = deliverableFiles.map((f) => ({
      id: f.id,
      name: f.name,
      url: fileReadUrl("deliverable", f.id),
      size: f.size,
      mimeType: f.mimeType,
      createdAt: f.createdAt.toISOString(),
      taskId: null,
      taskName: f.revision
        ? `${f.deliverable.number} · Rev ${f.revision.label}`
        : f.deliverable.number,
      messageId: null,
      source: "deliverable" as const,
      resourceType: null as "FILE" | "LINK" | null,
      deliverableId: f.deliverableId,
      uploader: f.uploader ?? null,
    }));

    // Merge, newest first.
    const result = [
      ...taskResult,
      ...messageResult,
      ...resourceResult,
      ...deliverableResult,
    ].sort(
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
