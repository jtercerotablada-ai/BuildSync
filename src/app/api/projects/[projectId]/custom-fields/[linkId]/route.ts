/**
 * DELETE /api/projects/:projectId/custom-fields/:linkId
 *
 * Removes a custom field from a project, with its values on this
 * project's tasks — the UI promises "removes the column and its values for
 * every task". CustomFieldValue relates to Task and CustomFieldDefinition
 * only, NOT to ProjectCustomField, so deleting the link alone left every
 * value behind: deleted Time-tracking fields kept feeding workload, and a
 * definition with no links is treated as a personal field anyone in the
 * workspace may write. When no other project links the definition it is
 * deleted too (its remaining values cascade with it).
 *
 * The route accepts the linkId (ProjectCustomField.id) — NOT the
 * underlying definition id — because the definition can be shared
 * across projects.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { resolveProjectAccess } from "@/lib/project-access";

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
            id: true,
            ownerId: true,
            workspaceId: true,
            visibility: true,
            teamId: true,
            members: { select: { userId: true, role: true } },
          },
        },
      },
    });
    if (!link || link.projectId !== projectId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Canonical resolver so team-shared members (Editor-level) can unlink
    // fields consistently with what they can add.
    const access = await resolveProjectAccess(link.project, userId);
    if (!access.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!access.canWrite) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.customFieldValue.deleteMany({
        where: {
          fieldId: link.fieldId,
          task: { OR: [{ projectId }, { section: { projectId } }] },
        },
      });
      await tx.projectCustomField.delete({ where: { id: linkId } });
      const remainingLinks = await tx.projectCustomField.count({
        where: { fieldId: link.fieldId },
      });
      if (remainingLinks === 0) {
        await tx.customFieldDefinition.delete({ where: { id: link.fieldId } });
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[custom-fields DELETE] error:", err);
    return NextResponse.json(
      { error: "Failed to delete custom field" },
      { status: 500 }
    );
  }
}
