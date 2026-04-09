import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

async function verifyAdmin(userId: string) {
  const member = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true, role: true },
  });

  if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
    return null;
  }

  return member;
}

// GET /api/admin/clients/[clientId]/access - List ClientProjectAccess for a specific client
export async function GET(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await verifyAdmin(userId);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { clientId } = await params;

    const accesses = await prisma.clientProjectAccess.findMany({
      where: { userId: clientId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(accesses);
  } catch (error) {
    console.error("Error fetching client access:", error);
    return NextResponse.json(
      { error: "Failed to fetch client access" },
      { status: 500 }
    );
  }
}

// POST /api/admin/clients/[clientId]/access - Add new project access
export async function POST(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await verifyAdmin(userId);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { clientId } = await params;
    const { projectId, canComment = true, canUpload = true, canApprove = false } = await req.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // Verify the project belongs to this workspace
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspaceId: admin.workspaceId,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found in this workspace" },
        { status: 404 }
      );
    }

    // Check if access already exists
    const existing = await prisma.clientProjectAccess.findUnique({
      where: {
        userId_projectId: {
          userId: clientId,
          projectId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Client already has access to this project" },
        { status: 400 }
      );
    }

    const access = await prisma.clientProjectAccess.create({
      data: {
        userId: clientId,
        projectId,
        canComment,
        canUpload,
        canApprove,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(access, { status: 201 });
  } catch (error) {
    console.error("Error adding client access:", error);
    return NextResponse.json(
      { error: "Failed to add client access" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/clients/[clientId]/access - Update permissions
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await verifyAdmin(userId);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { clientId } = await params;
    const { projectId, canComment, canUpload, canApprove } = await req.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const data: Record<string, boolean> = {};
    if (canComment !== undefined) data.canComment = canComment;
    if (canUpload !== undefined) data.canUpload = canUpload;
    if (canApprove !== undefined) data.canApprove = canApprove;

    const access = await prisma.clientProjectAccess.update({
      where: {
        userId_projectId: {
          userId: clientId,
          projectId,
        },
      },
      data,
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(access);
  } catch (error) {
    console.error("Error updating client access:", error);
    return NextResponse.json(
      { error: "Failed to update client access" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/clients/[clientId]/access - Remove project access
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await verifyAdmin(userId);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { clientId } = await params;
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId query parameter is required" },
        { status: 400 }
      );
    }

    await prisma.clientProjectAccess.delete({
      where: {
        userId_projectId: {
          userId: clientId,
          projectId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing client access:", error);
    return NextResponse.json(
      { error: "Failed to remove client access" },
      { status: 500 }
    );
  }
}
