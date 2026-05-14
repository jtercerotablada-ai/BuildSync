import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyWorkspaceAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";

const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ADMIN", "EDITOR", "COMMENTER", "VIEWER"]).optional(),
  // Bind the new member to a firm participating in the project.
  // Optional — null/missing means "unaffiliated", typically a holdover
  // from pre-multi-firm projects.
  companyId: z.string().min(1).optional().nullable(),
});

// GET /api/projects/:projectId/members - List members
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
      select: { workspaceId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await verifyWorkspaceAccess(userId, project.workspaceId);

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            jobTitle: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    return NextResponse.json(members);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching project members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

// POST /api/projects/:projectId/members - Add a member to a project
export async function POST(
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
      select: { workspaceId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await verifyWorkspaceAccess(userId, project.workspaceId);

    const body = await req.json();
    const data = addMemberSchema.parse(body);

    // Verify the target user belongs to the same workspace
    const targetMembership = await prisma.workspaceMember.findFirst({
      where: {
        userId: data.userId,
        workspaceId: project.workspaceId,
      },
      select: { id: true },
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: "User is not a member of this workspace" },
        { status: 404 }
      );
    }

    // Check if already a project member
    const existing = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: data.userId,
          projectId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "User is already a member of this project" },
        { status: 400 }
      );
    }

    // If a companyId was supplied, validate it belongs to this
    // project so callers can't bind members to a company on another
    // project they don't have access to.
    if (data.companyId) {
      const company = await prisma.projectCompany.findFirst({
        where: { id: data.companyId, projectId },
        select: { id: true },
      });
      if (!company) {
        return NextResponse.json(
          { error: "Company not found on this project" },
          { status: 400 }
        );
      }
    }

    const member = await prisma.projectMember.create({
      data: {
        userId: data.userId,
        projectId,
        role: data.role || "EDITOR",
        companyId: data.companyId ?? null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            jobTitle: true,
            position: true,
            customTitle: true,
          },
        },
        company: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json(member, { status: 201 });
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
    console.error("Error adding project member:", error);
    return NextResponse.json(
      { error: "Failed to add member" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/:projectId/members?userId=... - Remove a member
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
      select: { workspaceId: true, ownerId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await verifyWorkspaceAccess(userId, project.workspaceId);

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");

    if (!targetUserId) {
      return NextResponse.json(
        { error: "userId required" },
        { status: 400 }
      );
    }

    // Owner cannot be removed via this endpoint
    if (targetUserId === project.ownerId) {
      return NextResponse.json(
        { error: "Cannot remove the project owner" },
        { status: 400 }
      );
    }

    await prisma.projectMember.delete({
      where: {
        userId_projectId: {
          userId: targetUserId,
          projectId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error removing project member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/:projectId/members - Update a member's role
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

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true, ownerId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await verifyWorkspaceAccess(userId, project.workspaceId);

    const body = await req.json();
    const schema = z.object({
      userId: z.string().min(1),
      role: z.enum(["ADMIN", "EDITOR", "COMMENTER", "VIEWER"]).optional(),
      // Move this member between companies within the same project,
      // or clear the binding by passing null.
      companyId: z.string().min(1).nullable().optional(),
    });
    const data = schema.parse(body);

    if (data.userId === project.ownerId && data.role !== undefined) {
      return NextResponse.json(
        { error: "Cannot change owner role here" },
        { status: 400 }
      );
    }

    if (data.companyId) {
      const company = await prisma.projectCompany.findFirst({
        where: { id: data.companyId, projectId },
        select: { id: true },
      });
      if (!company) {
        return NextResponse.json(
          { error: "Company not found on this project" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.projectMember.update({
      where: {
        userId_projectId: {
          userId: data.userId,
          projectId,
        },
      },
      data: {
        ...(data.role !== undefined && { role: data.role }),
        ...(data.companyId !== undefined && { companyId: data.companyId }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            jobTitle: true,
            position: true,
            customTitle: true,
          },
        },
        company: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json(updated);
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
    console.error("Error updating project member:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}
