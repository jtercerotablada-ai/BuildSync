import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyWorkspaceAccess,
  verifyProjectAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";
import { notifyMembershipGranted } from "@/lib/membership-notifications";
import { sendInvitationEmail } from "@/lib/email";
import { PROJECT_ROLE_META } from "@/lib/people-types";
import type { ProjectRole } from "@prisma/client";

const addMemberSchema = z
  .object({
    // Add an existing workspace user by id …
    userId: z.string().min(1).optional(),
    // … OR invite a non-member by email (sends a WorkspaceInvitation that
    // binds this project + role on accept). Exactly one of userId / email.
    email: z.string().email().max(255).optional(),
    role: z.enum(["ADMIN", "EDITOR", "COMMENTER", "VIEWER"]).optional(),
    // Bind the new member to a firm participating in the project.
    // Optional — null/missing means "unaffiliated", typically a holdover
    // from pre-multi-firm projects.
    companyId: z.string().min(1).optional().nullable(),
  })
  .refine((d) => !!d.userId !== !!d.email, {
    message: "Provide exactly one of userId or email",
  });

/**
 * Only the project's OWNER or an ADMIN-level ProjectMember can
 * mutate the project's membership. Workspace members at large CANNOT
 * — that was a leak that let anyone in the workspace add/remove/
 * re-role themselves and others on projects they had no business
 * touching.
 *
 * Returns null on success. Returns an error NextResponse the caller
 * should return directly when the user fails the gate.
 */
async function requireProjectAdmin(
  userId: string,
  projectId: string
): Promise<NextResponse | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      members: {
        where: { userId },
        select: { role: true },
      },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const isProjectOwner = project.ownerId === userId;
  const isProjectAdmin = project.members[0]?.role === "ADMIN";
  if (!isProjectOwner && !isProjectAdmin) {
    return NextResponse.json(
      {
        error:
          "Only the project owner or an ADMIN member can modify project members",
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Invite a non-member email to the project. Creates (or refreshes) a
 * PENDING WorkspaceInvitation that binds this project + companyId +
 * projectRole; the /api/invite/[token]/accept route already applies the
 * project bind on accept. Sends the invitation email best-effort — the
 * row is kept even if delivery fails so the inviter can Resend later.
 *
 * The caller (project members POST) has already verified admin rights and
 * validated the companyId against the project.
 */
async function inviteByEmail(args: {
  email: string;
  projectId: string;
  projectName: string;
  workspaceId: string;
  inviterId: string;
  role: ProjectRole;
  companyId: string | null;
}): Promise<NextResponse> {
  const { email, projectId, projectName, workspaceId, inviterId, role } = args;

  // Reuse any still-pending invitation for this email/workspace so a
  // second invite doesn't pile up duplicate rows — refresh its project
  // bind + token + expiry instead (upsert semantics on the email flow).
  const existingInvite = await prisma.workspaceInvitation.findFirst({
    where: { email, workspaceId, status: "PENDING" },
    select: { id: true },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invitation = existingInvite
    ? await prisma.workspaceInvitation.update({
        where: { id: existingInvite.id },
        data: {
          token,
          expiresAt,
          inviterId,
          projectId,
          companyId: args.companyId,
          projectRole: role,
        },
      })
    : await prisma.workspaceInvitation.create({
        data: {
          email,
          role: "MEMBER",
          token,
          expiresAt,
          workspaceId,
          inviterId,
          projectId,
          companyId: args.companyId,
          projectRole: role,
        },
      });

  // Inviter + workspace names for the email body.
  const [inviter, workspace] = await Promise.all([
    prisma.user.findUnique({
      where: { id: inviterId },
      select: { name: true, email: true },
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    }),
  ]);
  const inviterName = inviter?.name || inviter?.email || "A teammate";

  try {
    await sendInvitationEmail({
      email,
      token,
      inviterName,
      workspaceName: workspace?.name || "your workspace",
      roleLabel: PROJECT_ROLE_META[role]?.label || role,
      personalMessage: null,
      projectName,
    });
  } catch (mailErr) {
    console.error(
      "[project members POST] invite email failed — row kept:",
      mailErr
    );
    return NextResponse.json(
      {
        invited: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          status: invitation.status,
          expiresAt: invitation.expiresAt.toISOString(),
        },
        warning:
          "Invitation saved but email delivery failed. Use Resend to retry.",
      },
      { status: 201 }
    );
  }

  return NextResponse.json(
    {
      invited: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        status: invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    },
    { status: 201 }
  );
}

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

    // Read the roster only when the caller can read the PROJECT (matches the
    // page). Bare workspace membership leaked PRIVATE-project rosters to any
    // L1–L3 workspace member, including GUEST/CLIENT.
    await verifyProjectAccess(userId, projectId);

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
      select: { workspaceId: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await verifyWorkspaceAccess(userId, project.workspaceId);

    // Gate: only project Owner or Admin may add members.
    const forbidden = await requireProjectAdmin(userId, projectId);
    if (forbidden) return forbidden;

    const body = await req.json();
    const data = addMemberSchema.parse(body);

    // If a companyId was supplied, validate it belongs to this project so
    // callers can't bind members to a company on another project. Shared by
    // both the add-user and invite-by-email paths.
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

    // Resolve the target user id. A typed email that already belongs to a
    // workspace user is treated exactly like adding that user directly;
    // an email with no workspace user falls through to the invite path.
    let targetUserId = data.userId ?? null;
    if (!targetUserId && data.email) {
      const email = data.email.toLowerCase().trim();
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existingUser) {
        const existingWsMember = await prisma.workspaceMember.findUnique({
          where: {
            userId_workspaceId: {
              userId: existingUser.id,
              workspaceId: project.workspaceId,
            },
          },
          select: { id: true },
        });
        if (existingWsMember) {
          targetUserId = existingUser.id;
        }
      }

      // ── Invite-by-email path — the email isn't a workspace member yet.
      // Create/refresh a WorkspaceInvitation that binds this project +
      // role on accept (the accept route already handles the project bind)
      // and send the invitation email.
      if (!targetUserId) {
        return inviteByEmail({
          email,
          projectId,
          projectName: project.name,
          workspaceId: project.workspaceId,
          inviterId: userId,
          role: (data.role || "EDITOR") as ProjectRole,
          companyId: data.companyId ?? null,
        });
      }
    }

    // ── Add existing workspace user path ───────────────────────────────
    // Verify the target user belongs to the same workspace
    const targetMembership = await prisma.workspaceMember.findFirst({
      where: {
        userId: targetUserId!,
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
          userId: targetUserId!,
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

    const member = await prisma.projectMember.create({
      data: {
        userId: targetUserId!,
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

    // Notify the newly-added member that they now have project access.
    // Best-effort (never throws). This is a genuine change of access — an
    // existing project member is rejected above — so there's no re-grant
    // spam to guard against here.
    await notifyMembershipGranted({
      userId: targetUserId!,
      type: "PROJECT_INVITATION",
      title: `You were added to the project "${project.name}"`,
      data: { projectId },
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

    // Gate: only project Owner/Admin may remove members. EXCEPT
    // members can always remove themselves (leave the project).
    if (targetUserId !== userId) {
      const forbidden = await requireProjectAdmin(userId, projectId);
      if (forbidden) return forbidden;
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

    // Gate: only project Owner/Admin may change other members'
    // roles or company bindings.
    const forbidden = await requireProjectAdmin(userId, projectId);
    if (forbidden) return forbidden;

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
