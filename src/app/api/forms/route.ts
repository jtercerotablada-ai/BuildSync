import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const createFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  fields: z.array(z.any()).default([]),
  projectId: z.string().min(1, "Project is required"),
  visibility: z.enum(["anyone", "organization"]).optional().default("organization"),
});

// GET /api/forms - List forms for current user's workspace
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // Get user's projects to scope forms
    const userProjects = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });

    const ownedProjects = await prisma.project.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });

    const projectIds = [
      ...new Set([
        ...userProjects.map((p) => p.projectId),
        ...ownedProjects.map((p) => p.id),
      ]),
    ];

    const forms = await prisma.form.findMany({
      where: {
        projectId: { in: projectIds },
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        _count: {
          select: { submissions: true },
        },
      },
      orderBy: { id: "desc" },
      take: limit,
    });

    const result = forms.map((form) => ({
      id: form.id,
      name: form.name,
      projectName: form.project.name,
      responsesCount: form._count.submissions,
      createdAt: form.id, // cuid is time-sortable
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching forms:", error);
    return NextResponse.json(
      { error: "Failed to fetch forms" },
      { status: 500 }
    );
  }
}

// POST /api/forms - Create a new form
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, fields, projectId } = createFormSchema.parse(body);

    // Verify user has access to the project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
      select: { id: true, name: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or you don't have access" },
        { status: 403 }
      );
    }

    const form = await prisma.form.create({
      data: {
        name,
        description: description || null,
        fields: fields as any,
        projectId,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(
      {
        id: form.id,
        name: form.name,
        projectName: form.project.name,
        responsesCount: 0,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error creating form:", error);
    return NextResponse.json(
      { error: "Failed to create form" },
      { status: 500 }
    );
  }
}
