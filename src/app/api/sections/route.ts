import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const createSectionSchema = z.object({
  name: z.string().min(1, "Section name is required"),
  projectId: z.string().min(1, "Project ID is required"),
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

    console.error("Error creating section:", error);
    return NextResponse.json(
      { error: "Failed to create section" },
      { status: 500 }
    );
  }
}
