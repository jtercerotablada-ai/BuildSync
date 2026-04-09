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

// GET /api/admin/workers - List all workspace members with role WORKER or MEMBER
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

    const workers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: admin.workspaceId,
        role: { in: ["WORKER", "MEMBER"] },
      },
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
      orderBy: { joinedAt: "desc" },
    });

    // Also fetch pending worker invitations
    const pendingInvitations = await prisma.workspaceInvitation.findMany({
      where: {
        workspaceId: admin.workspaceId,
        role: { in: ["WORKER", "MEMBER"] },
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ workers, pendingInvitations });
  } catch (error) {
    console.error("Error fetching workers:", error);
    return NextResponse.json(
      { error: "Failed to fetch workers" },
      { status: 500 }
    );
  }
}

// POST /api/admin/workers - Invite a new worker
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

    const { email, role = "WORKER" } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate role
    const validRoles = ["WORKER", "ADMIN"] as const;
    const safeRole = validRoles.includes(role as typeof validRoles[number]) ? role : "WORKER";

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
        role: safeRole,
        token,
        expiresAt,
        workspaceId: admin.workspaceId,
        inviterId: userId,
      },
    });

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    console.error("Error inviting worker:", error);
    return NextResponse.json(
      { error: "Failed to invite worker" },
      { status: 500 }
    );
  }
}
