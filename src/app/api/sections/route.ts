import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyProjectAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";
import { resolveSectionStage } from "@/lib/pipelines";

const createSectionSchema = z.object({
  name: z.string().min(1, "Section name is required"),
  projectId: z.string().min(1, "Project ID is required"),
  // Which pipeline stage this column's work belongs to — the same join the
  // recert templates ship (a column IS a stage), reachable by hand so a
  // column somebody adds later is not permanently outside the vocabulary.
  // Send null to say "this column is deliberately free-form"; omit it and the
  // stage is derived from the name. Validated against THIS project's own
  // pipeline, so a column on a recertification cannot claim a design stage.
  stage: z.string().min(1).max(80).nullable().optional(),
});

// POST /api/sections - Create a new section
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createSectionSchema.parse(body);

    // Creating a column is a WRITE. Without requireWrite this only proved the
    // caller could READ the project, so a VIEWER/COMMENTER could add columns.
    await verifyProjectAccess(userId, data.projectId, { requireWrite: true });

    // The type decides which pipeline's stages this column may claim.
    // verifyProjectAccess does not read it, so ask for it on its own rather
    // than widening a guard every other route shares.
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { type: true },
    });
    const resolved = resolveSectionStage(
      project?.type ?? null,
      data.name.trim(),
      data.stage
    );
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    // Get the next position for the section within this project
    const lastSection = await prisma.section.findFirst({
      where: { projectId: data.projectId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (lastSection?.position ?? -1) + 1;

    const section = await prisma.section.create({
      data: {
        name: data.name,
        projectId: data.projectId,
        position,
        stage: resolved.stage,
      },
      include: {
        tasks: true,
      },
    });

    return NextResponse.json(section, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return NextResponse.json(
        { error: zodError.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error creating section:", error);
    return NextResponse.json(
      { error: "Failed to create section" },
      { status: 500 }
    );
  }
}
