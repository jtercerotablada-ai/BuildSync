import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import crypto from "crypto";

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

// GET /api/admin/clients - List all workspace members with role CLIENT
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await verifyAdmin(userId);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const clients = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: admin.workspaceId,
        role: "CLIENT",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            clientProjectAccesses: {
              include: {
                project: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    // Also fetch pending client invitations
    const pendingInvitations = await prisma.workspaceInvitation.findMany({
      where: {
        workspaceId: admin.workspaceId,
        role: "CLIENT",
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ clients, pendingInvitations });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

// POST /api/admin/clients - Invite a new client + create ClientProjectAccess records
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await verifyAdmin(userId);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { email, projectAccess = [] } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: existingUser.id,
            workspaceId: admin.workspaceId,
          },
        },
      });

      if (existingMember) {
        return NextResponse.json(
          { error: "User is already a member of this workspace" },
          { status: 400 }
        );
      }
    }

    // Check for existing pending invitation
    const existingInvitation = await prisma.workspaceInvitation.findFirst({
      where: {
        email,
        workspaceId: admin.workspaceId,
        status: "PENDING",
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: "An invitation is already pending for this email" },
        { status: 400 }
      );
    }

    // Create invitation
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.workspaceInvitation.create({
      data: {
        email,
        role: "CLIENT",
        token,
        expiresAt,
        workspaceId: admin.workspaceId,
        inviterId: userId,
      },
    });

    // If the user already exists, create ClientProjectAccess records immediately
    if (existingUser && projectAccess.length > 0) {
      const accessRecords = projectAccess.map(
        (access: {
          projectId: string;
          canComment?: boolean;
          canUpload?: boolean;
          canApprove?: boolean;
        }) => ({
          userId: existingUser.id,
          projectId: access.projectId,
          canComment: access.canComment ?? true,
          canUpload: access.canUpload ?? true,
          canApprove: access.canApprove ?? false,
        })
      );

      await prisma.clientProjectAccess.createMany({
        data: accessRecords,
        skipDuplicates: true,
      });
    }

    return NextResponse.json(
      { invitation, note: "Project access will be created when the user accepts the invitation." },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error inviting client:", error);
    return NextResponse.json(
      { error: "Failed to invite client" },
      { status: 500 }
    );
  }
}
