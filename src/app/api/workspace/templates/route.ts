import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";

// GET /api/workspace/templates - Get project templates
export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (!workspaceMember) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const templates = await prisma.projectTemplate.findMany({
      where: {
        OR: [
          { workspaceId: workspaceMember.workspaceId },
          { isPublic: true },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST /api/workspace/templates - Create a new template
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, description, icon, color, isPublic, structure } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (!workspaceMember) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const template = await prisma.projectTemplate.create({
      data: {
        name,
        description,
        icon,
        color,
        isPublic: isPublic || false,
        structure: structure || { sections: [], defaultTasks: [] },
        workspaceId: workspaceMember.workspaceId,
        creatorId: userId,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}

// PUT /api/workspace/templates - Update a template
export async function PUT(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, name, description, icon, color, isPublic, structure } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Template ID required" }, { status: 400 });
    }

    // Verify template belongs to user's workspace
    const workspaceId = await getUserWorkspaceId(userId);
    const existing = await prisma.projectTemplate.findUnique({
      where: { id },
      select: { workspaceId: true },
    });
    if (!existing) {
      throw new NotFoundError("Template not found");
    }
    if (existing.workspaceId !== workspaceId) {
      throw new AuthorizationError("You don't have access to this template");
    }

    const template = await prisma.projectTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
        ...(isPublic !== undefined && { isPublic }),
        ...(structure !== undefined && { structure }),
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspace/templates - Delete a template
export async function DELETE(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Template ID required" }, { status: 400 });
    }

    // Verify template belongs to user's workspace
    const workspaceId = await getUserWorkspaceId(userId);
    const template = await prisma.projectTemplate.findUnique({
      where: { id },
      select: { workspaceId: true, creatorId: true },
    });

    if (!template) {
      throw new NotFoundError("Template not found");
    }
    if (template.workspaceId !== workspaceId) {
      throw new AuthorizationError("You don't have access to this template");
    }
    if (template.creatorId !== userId) {
      throw new AuthorizationError("Only the creator can delete this template");
    }

    await prisma.projectTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
