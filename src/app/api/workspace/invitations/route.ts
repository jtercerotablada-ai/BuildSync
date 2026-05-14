import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import crypto from "crypto";
import { sendInvitationEmail } from "@/lib/email";
import { WORKSPACE_ROLE_META } from "@/lib/people-types";
import type { Position, ProjectRole, WorkspaceRole } from "@prisma/client";

/**
 * Workspace invitations — admin-only invite flow.
 *
 * GET    list pending invitations for the caller's workspace.
 * POST   create an invitation, generate a 7-day token, send email.
 * DELETE revoke a pending invitation.
 *
 * Invitations carry enough metadata to land the invitee in a useful
 * state on accept: a pre-assigned Position/Title/Department, an
 * optional personal message shown in the email + landing page, and
 * an optional project + company + project role auto-bind so a
 * newcomer can be dropped straight onto the right project team.
 *
 * Access: workspace OWNER or ADMIN only.
 */

const POSITION_VALUES = [
  "CEO",
  "COO",
  "PRINCIPAL_ENGINEER",
  "DIRECTOR_OF_ENGINEERING",
  "OFFICE_ADMIN",
  "ACCOUNTANT",
  "HR",
  "MARKETING",
  "PROJECT_MANAGER",
  "PROJECT_ENGINEER",
  "SENIOR_STRUCTURAL_ENGINEER",
  "STRUCTURAL_ENGINEER",
  "JUNIOR_ENGINEER",
  "DRAFTER",
  "ENGINEERING_INTERN",
  "ARCHITECT",
  "CIVIL_ENGINEER",
  "MEP_ENGINEER",
  "GEOTECH_ENGINEER",
  "SITE_SUPERINTENDENT",
  "CONSULTANT",
  "CONTRACTOR",
  "OTHER",
] as const;

const createSchema = z.object({
  email: z.string().email().max(255),
  role: z.enum(["ADMIN", "MEMBER", "WORKER", "GUEST"]).optional(),
  position: z.enum(POSITION_VALUES).optional().nullable(),
  customTitle: z.string().max(120).optional().nullable(),
  department: z.string().max(80).optional().nullable(),
  personalMessage: z.string().max(500).optional().nullable(),
  projectId: z.string().min(1).optional().nullable(),
  companyId: z.string().min(1).optional().nullable(),
  projectRole: z
    .enum(["ADMIN", "EDITOR", "COMMENTER", "VIEWER"])
    .optional()
    .nullable(),
});

// GET /api/workspace/invitations - Pending invitations for current workspace
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true, role: true },
    });

    if (!workspaceMember) {
      return NextResponse.json(
        { error: "No workspace found" },
        { status: 404 }
      );
    }

    const invitations = await prisma.workspaceInvitation.findMany({
      where: {
        workspaceId: workspaceMember.workspaceId,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
      include: {
        inviter: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return NextResponse.json(
      invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        position: i.position,
        customTitle: i.customTitle,
        department: i.department,
        personalMessage: i.personalMessage,
        projectId: i.projectId,
        companyId: i.companyId,
        projectRole: i.projectRole,
        status: i.status,
        expiresAt: i.expiresAt.toISOString(),
        createdAt: i.createdAt.toISOString(),
        inviter: i.inviter,
      }))
    );
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }
}

// POST /api/workspace/invitations - Create + email
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const email = data.email.toLowerCase().trim();

    // Caller must be ADMIN or OWNER of their workspace.
    const currentMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: {
        workspaceId: true,
        role: true,
        user: { select: { id: true, name: true, email: true } },
        workspace: { select: { id: true, name: true } },
      },
    });
    if (
      !currentMember ||
      !["OWNER", "ADMIN"].includes(currentMember.role)
    ) {
      return NextResponse.json(
        { error: "Only Owner / Admin can invite people" },
        { status: 403 }
      );
    }

    // Already a member?
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: existingUser.id,
            workspaceId: currentMember.workspaceId,
          },
        },
        select: { id: true },
      });
      if (existingMember) {
        return NextResponse.json(
          { error: "This user is already a member of this workspace" },
          { status: 400 }
        );
      }
    }

    // Already pending?
    const existingInvitation = await prisma.workspaceInvitation.findFirst({
      where: {
        email,
        workspaceId: currentMember.workspaceId,
        status: "PENDING",
      },
      select: { id: true },
    });
    if (existingInvitation) {
      return NextResponse.json(
        {
          error:
            "An invitation is already pending for this email — use Resend instead",
        },
        { status: 400 }
      );
    }

    // Optional project / company validation.
    let projectName: string | null = null;
    if (data.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: data.projectId },
        select: {
          id: true,
          name: true,
          workspaceId: true,
          ownerId: true,
          members: { select: { userId: true, role: true } },
        },
      });
      if (!project || project.workspaceId !== currentMember.workspaceId) {
        return NextResponse.json(
          { error: "Project not found in your workspace" },
          { status: 400 }
        );
      }
      // Inviter must be allowed to add members to that project.
      const isProjOwner = project.ownerId === userId;
      const isProjAdmin = project.members.some(
        (m) => m.userId === userId && m.role === "ADMIN"
      );
      if (!isProjOwner && !isProjAdmin && currentMember.role !== "OWNER") {
        return NextResponse.json(
          {
            error:
              "You can only auto-add to projects where you are Owner or Admin",
          },
          { status: 403 }
        );
      }
      projectName = project.name;

      if (data.companyId) {
        const company = await prisma.projectCompany.findFirst({
          where: { id: data.companyId, projectId: data.projectId },
          select: { id: true },
        });
        if (!company) {
          return NextResponse.json(
            { error: "Company doesn't belong to that project" },
            { status: 400 }
          );
        }
      }
    } else if (data.companyId) {
      return NextResponse.json(
        { error: "companyId requires projectId" },
        { status: 400 }
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.workspaceInvitation.create({
      data: {
        email,
        role: (data.role || "MEMBER") as WorkspaceRole,
        token,
        expiresAt,
        workspaceId: currentMember.workspaceId,
        inviterId: userId,
        position: (data.position as Position | null) ?? null,
        customTitle: data.customTitle ?? null,
        department: data.department ?? null,
        personalMessage: data.personalMessage ?? null,
        projectId: data.projectId ?? null,
        companyId: data.companyId ?? null,
        projectRole: (data.projectRole as ProjectRole | null) ?? null,
      },
    });

    // Best-effort email send — if Resend chokes, we keep the row
    // and surface the error so the inviter can hit Resend later
    // without having to recreate.
    const inviterName =
      currentMember.user.name ||
      currentMember.user.email ||
      "A teammate";
    try {
      await sendInvitationEmail({
        email,
        token,
        inviterName,
        workspaceName: currentMember.workspace.name,
        roleLabel:
          WORKSPACE_ROLE_META[invitation.role as WorkspaceRole]?.label ||
          invitation.role,
        personalMessage: invitation.personalMessage,
        projectName,
      });
    } catch (mailErr) {
      console.error(
        "[invitations POST] email send failed — row kept:",
        mailErr
      );
      return NextResponse.json(
        {
          invitation: {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            status: invitation.status,
            expiresAt: invitation.expiresAt.toISOString(),
            createdAt: invitation.createdAt.toISOString(),
          },
          warning:
            "Invitation saved but email delivery failed. Use Resend to retry.",
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating invitation:", error);
    return NextResponse.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspace/invitations?id=... - Revoke
export async function DELETE(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const invitationId = searchParams.get("id");
    if (!invitationId) {
      return NextResponse.json(
        { error: "Invitation id required" },
        { status: 400 }
      );
    }

    const currentMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true, role: true },
    });
    if (
      !currentMember ||
      !["OWNER", "ADMIN"].includes(currentMember.role)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Scope the delete to the caller's workspace.
    const invitation = await prisma.workspaceInvitation.findFirst({
      where: {
        id: invitationId,
        workspaceId: currentMember.workspaceId,
      },
      select: { id: true },
    });
    if (!invitation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.workspaceInvitation.delete({
      where: { id: invitationId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting invitation:", error);
    return NextResponse.json(
      { error: "Failed to delete invitation" },
      { status: 500 }
    );
  }
}
