import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId, getEffectiveAccess } from "@/lib/auth-utils";
import { isWorkspaceOwner } from "@/lib/people-types";

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  color: z.string().optional(),
  status: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK", "ON_HOLD", "COMPLETE"]).optional(),
  visibility: z.enum(["PRIVATE", "WORKSPACE", "PUBLIC"]).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  // Engineering firm extensions — mirrors the create schema in route.ts
  type: z.enum(["CONSTRUCTION", "DESIGN", "RECERTIFICATION", "PERMIT"]).optional().nullable(),
  gate: z.enum(["PRE_DESIGN", "DESIGN", "PERMITTING", "CONSTRUCTION", "CLOSEOUT"]).optional().nullable(),
  location: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  budget: z.number().optional().nullable(),
  currency: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
});

// GET /api/projects/:projectId - Get project details
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

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        sections: {
          orderBy: { position: "asc" },
        },
        views: true,
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // ── Access control ────────────────────────────────────────
    // Hierarchical: OWNER + L5+ + L4 see any workspace project.
    // L1–L3 need explicit project membership or PUBLIC visibility —
    // workspace membership alone no longer grants access (that was
    // the bug that leaked all workspace projects to invited users).
    const access = await getEffectiveAccess(userId);
    if (!access) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const isExecutive =
      isWorkspaceOwner(access.workspaceRole) || access.level >= 5;
    const isManagement = isExecutive || access.level >= 4;

    const isProjectOwner = project.ownerId === userId;
    const isProjectMember = project.members.some((m) => m.userId === userId);
    const isPublic = project.visibility === "PUBLIC";

    let hasAccess = isProjectOwner || isProjectMember || isPublic;

    // L4+ also see any project in the same workspace.
    if (!hasAccess && isManagement) {
      const workspaceMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: project.workspaceId,
          },
        },
      });
      if (workspaceMember) hasAccess = true;
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/:projectId - Update project
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { projectId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = updateProjectSchema.parse(body);

    // Check if user has edit access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const member = project.members.find((m) => m.userId === userId);
    const canEdit =
      project.ownerId === userId ||
      (member && ["ADMIN", "EDITOR"].includes(member.role));

    if (!canEdit) {
      return NextResponse.json(
        { error: "You don't have permission to edit this project" },
        { status: 403 }
      );
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : data.startDate === null ? null : undefined,
        endDate: data.endDate ? new Date(data.endDate) : data.endDate === null ? null : undefined,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        sections: {
          orderBy: { position: "asc" },
        },
      },
    });

    return NextResponse.json(updatedProject);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return NextResponse.json(
        { error: zodError.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/:projectId - Delete project
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { projectId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Only owner or admin can delete
    const member = project.members.find((m) => m.userId === userId);
    const canDelete = project.ownerId === userId || member?.role === "ADMIN";

    if (!canDelete) {
      return NextResponse.json(
        { error: "You don't have permission to delete this project" },
        { status: 403 }
      );
    }

    await prisma.project.delete({
      where: { id: projectId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
