import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { taskPrivacyClause } from "@/lib/project-visibility";
import { verifyProjectAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";
import { resolveSectionStage } from "@/lib/pipelines";

const updateSectionSchema = z.object({
  name: z.string().min(1, "Section name is required").optional(),
  // Target index among the project's sections (0-based). Used by the
  // workflow builder's drag-to-reorder.
  position: z.number().int().min(0).optional(),
  // Re-point (or clear, with null) the pipeline stage whose work this column
  // carries. OMITTING it leaves the stage untouched — including across a
  // rename: the join is a decision somebody made, not something a new name
  // silently re-derives underneath them. Validated against THIS project's own
  // pipeline, so a column cannot be moved onto another pipeline's stage.
  stage: z.string().min(1).max(80).nullable().optional(),
});

// PATCH /api/sections/:sectionId - Rename and/or reorder a section
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { sectionId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify section exists and user has access to its project
    const existingSection = await prisma.section.findUnique({
      where: { id: sectionId },
      // `project.type` decides which pipeline's stages this column may claim.
      select: { projectId: true, project: { select: { type: true } } },
    });
    if (!existingSection) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    // Renaming and reordering a column are WRITES. Without requireWrite this
    // only proved the caller could READ the project.
    await verifyProjectAccess(userId, existingSection.projectId, {
      requireWrite: true,
    });

    const body = await req.json();
    const data = updateSectionSchema.parse(body);

    // Only a stage the caller actually sent is resolved — `undefined` here
    // means "leave it alone", not "re-derive it from the name".
    let nextStage: string | null | undefined;
    if (data.stage !== undefined) {
      const resolved = resolveSectionStage(
        existingSection.project?.type ?? null,
        // The name is deliberately not passed: resolveSectionStage reads it
        // ONLY on its derive-from-name branch, which `stage !== undefined`
        // above has already ruled out. Handing it `data.name` read as though
        // a rename re-derived the stage, which is the opposite of the rule —
        // renaming a column must never move the job to another desk.
        "",
        data.stage
      );
      if (!resolved.ok) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      nextStage = resolved.stage;
    }

    // Reorder: pull the project's sections in order, move this one to
    // the requested index, and rewrite positions 0..n atomically.
    if (data.position !== undefined) {
      const siblings = await prisma.section.findMany({
        where: { projectId: existingSection.projectId },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      const ids = siblings.map((s) => s.id).filter((id) => id !== sectionId);
      const target = Math.min(data.position, ids.length);
      ids.splice(target, 0, sectionId);
      await prisma.$transaction(
        ids.map((id, idx) =>
          prisma.section.update({ where: { id }, data: { position: idx } })
        )
      );
    }

    const section = await prisma.section.update({
      where: { id: sectionId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(nextStage !== undefined && { stage: nextStage }),
      },
      include: {
        // Renaming a column echoed back every task in it, unfiltered, so
        // the response carried other people's private tasks across the
        // wire even though no list would render them.
        tasks: { where: taskPrivacyClause(userId) },
      },
    });

    return NextResponse.json(section);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error updating section:", error);
    return NextResponse.json(
      { error: "Failed to update section" },
      { status: 500 }
    );
  }
}

// DELETE /api/sections/:sectionId - Delete a section
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { sectionId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if section exists
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        _count: { select: { tasks: true } },
      },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Deleting a column HARD-DELETES every task in it (below) — the most
    // destructive verb in the project surface. Without requireWrite this only
    // proved the caller could READ the project, so any VIEWER/COMMENTER could
    // permanently destroy a whole column of work.
    await verifyProjectAccess(userId, section.projectId, { requireWrite: true });

    // Delete tasks in this section first, then the section
    await prisma.$transaction([
      prisma.task.deleteMany({ where: { sectionId } }),
      prisma.section.delete({ where: { id: sectionId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error deleting section:", error);
    return NextResponse.json(
      { error: "Failed to delete section" },
      { status: 500 }
    );
  }
}
