import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { deleteFile } from "@/lib/storage";
import {
  verifyProjectAccess,
  getErrorStatus,
  AuthorizationError,
  NotFoundError,
} from "@/lib/auth-guards";

// DELETE /api/projects/:projectId/resources/:resourceId
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; resourceId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { projectId, resourceId } = await params;
    await verifyProjectAccess(userId, projectId, { requireWrite: true });

    // Scope by project so a caller can't delete another project's resource
    // by guessing an id.
    const resource = await prisma.projectResource.findUnique({
      where: { id: resourceId },
      select: { id: true, projectId: true, type: true, url: true },
    });
    if (!resource || resource.projectId !== projectId) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    await prisma.projectResource.delete({ where: { id: resourceId } });

    // Best-effort blob cleanup for uploaded files (links have nothing to
    // free). A failed blob delete must not fail the request — the DB row is
    // already gone, which is what the user asked for.
    if (resource.type === "FILE") {
      await deleteFile(resource.url).catch((err) =>
        console.error("[project resource DELETE] blob cleanup failed:", err)
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[project resource DELETE] error:", error);
    return NextResponse.json(
      { error: "Failed to delete resource" },
      { status: 500 }
    );
  }
}
