/**
 * DELETE /api/projects/:projectId/custom-fields/:linkId
 *
 * Unlinks a custom field from a project. The CustomFieldDefinition
 * itself is kept (other projects may still use it) — only the
 * ProjectCustomField row is removed. CustomFieldValue rows are
 * cascade-deleted by Prisma via the relation.
 *
 * The route accepts the linkId (ProjectCustomField.id) — NOT the
 * underlying definition id — because the definition can be shared
 * across projects.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

export async function DELETE(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ projectId: string; linkId: string }>;
  }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { projectId, linkId } = await params;

    // Confirm the link belongs to this project + the user can edit
    // the project before unlinking.
    const link = await prisma.projectCustomField.findUnique({
      where: { id: linkId },
      select: {
        id: true,
        projectId: true,
        fieldId: true,
        project: {
          select: {
            ownerId: true,
            workspaceId: true,
            members: { select: { userId: true, role: true } },
          },
        },
      },
    });
    if (!link || link.projectId !== projectId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const member = link.project.members.find((m) => m.userId === userId);
    const isOwner = link.project.ownerId === userId;
    const canEdit =
      isOwner || (member && (member.role === "ADMIN" || member.role === "EDITOR"));
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.projectCustomField.delete({ where: { id: linkId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[custom-fields DELETE] error:", err);
    return NextResponse.json(
      { error: "Failed to delete custom field" },
      { status: 500 }
    );
  }
}
