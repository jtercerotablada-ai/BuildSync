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
  // Optional explicit target workspace — the Invite dialog sends the workspace
  // the admin is currently viewing so multi-workspace callers don't get their
  // invite mis-scoped by an unordered findFirst (audit: wrong-workspace invite).
  workspaceId: z.string().min(1).optional().nullable(),
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

/**
 * Resolve the workspace the caller is acting in. Prefer an explicit client-
 * supplied workspaceId (verified against the caller's memberships) so multi-
 * workspace admins invite into the workspace they're actually looking at.
 * Falls back to the existing multi-member heuristic (first workspace with >1
 * member, else the oldest) when no id is given. Returns null when the caller
 * has no eligible membership.
 */
async function resolveCallerWorkspace(
  userId: string,
  requestedWorkspaceId: string | null | undefined
) {
  if (requestedWorkspaceId) {
    const member = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: requestedWorkspaceId },
      },
      select: {
        workspaceId: true,
        role: true,
        user: { select: { id: true, name: true, email: true } },
        workspace: { select: { id: true, name: true } },
      },
    });
    if (member) return member;
    // An explicit but non-member workspaceId is a caller error, not a reason
    // to silently fall back onto some other workspace — signal not-found.
    return null;
  }
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: {
      workspaceId: true,
      role: true,
      user: { select: { id: true, name: true, email: true } },
      workspace: {
        select: { id: true, name: true, _count: { select: { members: true } } },
      },
    },
    orderBy: { joinedAt: "asc" },
  });
  if (memberships.length === 0) return null;
  const chosen =
    memberships.find((m) => m.workspace._count.members > 1) ?? memberships[0];
  return {
    workspaceId: chosen.workspaceId,
    role: chosen.role,
    user: chosen.user,
    workspace: { id: chosen.workspace.id, name: chosen.workspace.name },
  };
}

// GET /api/workspace/invitations - Pending invitations for current workspace
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceMember = await resolveCallerWorkspace(userId, null);

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
        // Echo the resolved workspaceId so the Invite dialog can send it
        // back on POST/resend/revoke — pins multi-workspace admins to the
        // workspace they're actually viewing (audit: wrong-workspace invite).
        workspaceId: i.workspaceId,
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

    // Resolve the target workspace (explicit id preferred, else heuristic).
    const currentMember = await resolveCallerWorkspace(userId, data.workspaceId);
    // Caller must be ADMIN or OWNER of the target workspace.
    if (!currentMember) {
      return NextResponse.json(
        { error: "No workspace found" },
        { status: 404 }
      );
    }
    if (!["OWNER", "ADMIN"].includes(currentMember.role)) {
      return NextResponse.json(
        { error: "Only Owner / Admin can invite people" },
        { status: 403 }
      );
    }

    // Already a member? Treat as a conflict (409), not a validation error —
    // the caller sent a well-formed request, the target simply already belongs.
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
          { status: 409 }
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
        { status: 409 }
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

    // Upsert on the (email, workspaceId) unique key. A prior ACCEPTED /
    // DECLINED / EXPIRED row for this pair would otherwise collide with the
    // @@unique constraint and throw a 500 on re-invite. We reset it back to a
    // fresh PENDING invite: new token + expiry + inviter + all bind fields, and
    // clear the previous acceptance bookkeeping.
    const role = (data.role || "MEMBER") as WorkspaceRole;
    const position = (data.position as Position | null) ?? null;
    const customTitle = data.customTitle ?? null;
    const department = data.department ?? null;
    const personalMessage = data.personalMessage ?? null;
    const projectId = data.projectId ?? null;
    const companyId = data.companyId ?? null;
    const projectRole = (data.projectRole as ProjectRole | null) ?? null;

    const invitation = await prisma.workspaceInvitation.upsert({
      where: {
        email_workspaceId: {
          email,
          workspaceId: currentMember.workspaceId,
        },
      },
      create: {
        email,
        role,
        token,
        expiresAt,
        workspaceId: currentMember.workspaceId,
        inviterId: userId,
        position,
        customTitle,
        department,
        personalMessage,
        projectId,
        companyId,
        projectRole,
      },
      update: {
        role,
        status: "PENDING",
        token,
        expiresAt,
        inviterId: userId,
        position,
        customTitle,
        department,
        personalMessage,
        projectId,
        companyId,
        projectRole,
        // This dialog never binds a portfolio; clear any stale bind from a
        // prior invite so a re-invite here doesn't silently resurrect it.
        portfolioId: null,
        portfolioRole: null,
        acceptedAt: null,
        acceptedUserId: null,
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

    const currentMember = await resolveCallerWorkspace(
      userId,
      searchParams.get("workspaceId")
    );
    if (!currentMember || !["OWNER", "ADMIN"].includes(currentMember.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Scope the delete to the caller's workspace AND to PENDING invites only —
    // revoking an already-ACCEPTED invitation must not silently drop the audit
    // row for someone who is now a real member (matches the resend gate).
    const invitation = await prisma.workspaceInvitation.findFirst({
      where: {
        id: invitationId,
        workspaceId: currentMember.workspaceId,
        status: "PENDING",
      },
      select: { id: true },
    });
    if (!invitation) {
      return NextResponse.json(
        { error: "Pending invitation not found" },
        { status: 404 }
      );
    }

    await prisma.workspaceInvitation.delete({
      where: { id: invitation.id },
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
