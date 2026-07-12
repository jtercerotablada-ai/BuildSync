import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyProjectAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";

const updateSectionSchema = z.object({
  name: z.string().min(1, "Section name is required").optional(),
  // Target index among the project's sections (0-based). Used by the
  // workflow builder's drag-to-reorder.
  position: z.number().int().min(0).optional(),
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
      select: { projectId: true },
    });
    if (!existingSection) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    await verifyProjectAccess(userId, existingSection.projectId);

    const body = await req.json();
    const data = updateSectionSchema.parse(body);

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
      },
      include: {
        tasks: true,
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

    // Verify user has access to the project
    await verifyProjectAccess(userId, section.projectId);

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
