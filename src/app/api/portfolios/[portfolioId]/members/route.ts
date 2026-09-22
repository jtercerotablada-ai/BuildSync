import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { sendInvitationEmail } from "@/lib/email";
import { notifyMembershipGranted } from "@/lib/membership-notifications";
import { WORKSPACE_ROLE_META } from "@/lib/people-types";
import { resolveProjectAccess } from "@/lib/project-access";
import type { PortfolioRole, WorkspaceRole } from "@prisma/client";
import {
  verifyWorkspaceAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";
import {
  NON_CONTRIBUTOR_ROLES,
  isNonContributorRole,
} from "@/lib/workspace-roles";

/**
 * Members API for a PORTFOLIO. Backs the "Share" modal on the portfolio
 * detail page.
 *
 *   • GET    — directory: explicit members + owner + (PUBLIC) the rest of
 *              the workspace / (WORKSPACE) its contributors, used by the
 *              @-mention typeahead AND the "Who has access" list.
 *   • POST   — invite a workspace user as OWNER/EDITOR/VIEWER, OR — when
 *              the email isn't a workspace member yet — create a pending
 *              WorkspaceInvitation that binds this portfolio on accept
 *              and email the invitee.
 *   • PATCH  — change an existing member's role.
 *   • DELETE — remove a member's access (?userId=).
 *
 * Membership management (POST / PATCH / DELETE) requires ADMIN capability
 * — the portfolio owner, a member whose role is OWNER, or a workspace
 * OWNER/ADMIN. Editors can edit portfolio CONTENT elsewhere but cannot manage
 * the member list. Only the portfolio owner or a workspace manager may grant
 * or revoke the OWNER (admin) role — on every verb, not just PATCH. Inviting
 * someone who is not in the workspace yet creates a WORKSPACE seat, so that
 * path needs workspace OWNER/ADMIN, exactly like /api/workspace/invitations.
 */

// ─── Shared user select + row shape ───────────────────────────────

const memberUserSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  jobTitle: true,
  position: true,
  customTitle: true,
} as const;

interface MemberRow {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    jobTitle: string | null;
    position: string | null;
    customTitle: string | null;
  };
}

// ─── Portfolio view / edit gate (matches ../route.ts) ──────────────

interface PortfolioGate {
  workspaceId: string;
  ownerId: string | null;
  /** The portfolio's own name — used in invite emails / notifications. */
  portfolioName: string;
  /** The workspace's display name — used in the invite email. */
  workspaceName: string;
  /** Caller is the Portfolio.ownerId (the ultimate owner). */
  isPortfolioOwner: boolean;
  /** Caller may edit CONTENT: portfolio owner or member role OWNER/EDITOR. */
  canEdit: boolean;
  /**
   * Caller may MANAGE MEMBERS (invite / change role / remove): portfolio
   * owner, a member whose role is OWNER, or a workspace manager. Editors
   * cannot — membership management is admin-only (Asana parity).
   */
  canManageMembers: boolean;
  /** Caller may grant or revoke the member OWNER (admin) role: the portfolio
   *  owner or a workspace manager, never a member-admin. */
  canGrantAdmin: boolean;
  /** Caller is OWNER/ADMIN of the portfolio's workspace — the only people
   *  who may bring someone new INTO the workspace. */
  isWorkspaceManager: boolean;
}

/**
 * Load a portfolio and resolve the caller's view + edit + manage
 * capability (decidePortfolioAccess in ../route.ts, restated here). Returns
 * null when the portfolio is missing, cross-workspace, or the caller cannot
 * VIEW it — the caller maps null to 404 to mask existence.
 */
async function resolvePortfolioGate(
  userId: string,
  portfolioId: string
): Promise<PortfolioGate | null> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    select: {
      name: true,
      workspaceId: true,
      ownerId: true,
      privacy: true,
      members: { select: { userId: true, role: true } },
      workspace: { select: { name: true } },
    },
  });
  if (!portfolio) return null;

  // Must belong to the portfolio's workspace at all.
  const wsMember = await verifyWorkspaceAccess(userId, portfolio.workspaceId);
  const isContributor = !isNonContributorRole(wsMember.role);
  const isWorkspaceManager =
    wsMember.role === "OWNER" || wsMember.role === "ADMIN";

  const isPortfolioOwner = portfolio.ownerId === userId;
  const membership = portfolio.members.find((m) => m.userId === userId);
  const isMember = membership != null;
  const canView =
    isPortfolioOwner ||
    isMember ||
    isWorkspaceManager ||
    portfolio.privacy === "PUBLIC" ||
    (portfolio.privacy === "WORKSPACE" && isContributor);
  if (!canView) return null;

  const memberRole = membership?.role;
  const canEdit =
    isContributor &&
    (isPortfolioOwner ||
      isWorkspaceManager ||
      memberRole === "OWNER" ||
      memberRole === "EDITOR");
  const canManageMembers =
    isContributor &&
    (isPortfolioOwner || isWorkspaceManager || memberRole === "OWNER");
  const canGrantAdmin =
    isContributor && (isPortfolioOwner || isWorkspaceManager);

  return {
    workspaceId: portfolio.workspaceId,
    ownerId: portfolio.ownerId,
    portfolioName: portfolio.name,
    workspaceName: portfolio.workspace.name,
    isPortfolioOwner,
    canEdit,
    canManageMembers,
    canGrantAdmin,
    isWorkspaceManager: isContributor && isWorkspaceManager,
  };
}

/**
 * GET /api/portfolios/:portfolioId/members
 *
 * Directory used by the @-mention typeahead in MessagesView AND the
 * "Who has access" list in the Share modal. We return: the explicit
 * portfolio members + the portfolio owner + (for PUBLIC portfolios) the
 * rest of the workspace so anyone reachable can be mentioned.
 *
 * Shape matches /api/projects/:id/members so the typeahead doesn't need
 * scope-aware code.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { portfolioId } = await params;

    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: {
        id: true,
        ownerId: true,
        privacy: true,
        workspaceId: true,
        members: {
          select: {
            id: true,
            role: true,
            joinedAt: true,
            user: { select: memberUserSelect },
          },
        },
      },
    });
    if (!portfolio) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Callers must be able to read the portfolio. Membership of its OWN
    // workspace is required for EVERY caller — the blanket check the canonical
    // GET /api/portfolios/[portfolioId] (and this file's own POST/PATCH/DELETE
    // via verifyWorkspaceAccess) run, which this GET skipped. Without it a
    // PUBLIC portfolio leaked the entire workspace staff directory (name,
    // email, job title, position) to any authenticated user of any OTHER
    // workspace.
    const isCallerMember = portfolio.members.some((m) => m.user.id === userId);
    const isOwner = portfolio.ownerId === userId;
    const isPublic = portfolio.privacy === "PUBLIC";
    const isWorkspaceShared = portfolio.privacy === "WORKSPACE";
    const wsMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: portfolio.workspaceId },
      },
    });
    const callerIsContributor =
      !!wsMember && !isNonContributorRole(wsMember.role);
    const callerIsManager =
      !!wsMember && (wsMember.role === "OWNER" || wsMember.role === "ADMIN");
    if (
      !wsMember ||
      (!isCallerMember &&
        !isOwner &&
        !isPublic &&
        !callerIsManager &&
        !(isWorkspaceShared && callerIsContributor))
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Start with the explicit members.
    const rows: MemberRow[] = portfolio.members.map((m) => ({
      id: m.id,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      user: m.user,
    }));

    // Add the owner if missing from members.
    if (portfolio.ownerId && !rows.find((r) => r.user.id === portfolio.ownerId)) {
      const owner = await prisma.user.findUnique({
        where: { id: portfolio.ownerId },
        select: memberUserSelect,
      });
      if (owner) {
        rows.unshift({
          id: `owner-${owner.id}`,
          role: "OWNER",
          joinedAt: new Date(0).toISOString(),
          user: owner,
        });
      }
    }

    // For PUBLIC portfolios, expand the audience to anyone in the
    // workspace (for WORKSPACE ones, every contributor) so they can be
    // @-mentioned. We tag those with role "WORKSPACE" so the UI can dim
    // them if needed.
    if (isPublic || isWorkspaceShared) {
      const existingIds = new Set(rows.map((r) => r.user.id));
      const wsMembers = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: portfolio.workspaceId,
          ...(isPublic
            ? {}
            : {
                role: {
                  notIn: [...NON_CONTRIBUTOR_ROLES] as WorkspaceRole[],
                },
              }),
        },
        select: { user: { select: memberUserSelect } },
      });
      for (const wm of wsMembers) {
        if (existingIds.has(wm.user.id)) continue;
        rows.push({
          id: `ws-${wm.user.id}`,
          role: "WORKSPACE",
          joinedAt: new Date(0).toISOString(),
          user: wm.user,
        });
      }
    }

    return NextResponse.json(rows);
  } catch (err) {
    if (err instanceof AuthorizationError || err instanceof NotFoundError) {
      const { status, message } = getErrorStatus(err);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[portfolio members GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

// ─── POST — invite a workspace user as a portfolio member ─────────

const inviteSchema = z
  .object({
    email: z.string().email().optional(),
    userId: z.string().min(1).optional(),
    role: z.enum(["OWNER", "EDITOR", "VIEWER"]).default("EDITOR"),
    grantProjectAccess: z.boolean().optional(),
    // notifyOnWorkAdded has no backing column — it's a client-side
    // preference (useUiState). Accepted here so the client can send a
    // single payload, but ignored server-side.
    notifyOnWorkAdded: z.boolean().optional(),
  })
  .refine((d) => d.email != null || d.userId != null, {
    message: "Provide an email or a userId to invite",
  });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { portfolioId } = await params;
    const gate = await resolvePortfolioGate(userId, portfolioId);
    if (!gate) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }
    if (!gate.canManageMembers) {
      return NextResponse.json(
        { error: "Only the portfolio owner or an admin can invite people" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const data = inviteSchema.parse(body);

    // Granting the OWNER (admin) role is reserved to the portfolio owner and
    // workspace managers — the same rule PATCH enforces. canManageMembers is
    // not enough: it also admits member-admins.
    if (data.role === "OWNER" && !gate.canGrantAdmin) {
      return NextResponse.json(
        { error: "Only the portfolio owner can grant or revoke admin access" },
        { status: 403 }
      );
    }

    // Resolve the target user, requiring workspace membership.
    let target: { id: string } | null = null;
    if (data.userId) {
      const wm = await prisma.workspaceMember.findFirst({
        where: { userId: data.userId, workspaceId: gate.workspaceId },
        select: { userId: true },
      });
      if (!wm) {
        return NextResponse.json(
          { error: "User is not in this workspace" },
          { status: 404 }
        );
      }
      target = { id: data.userId };
    } else if (data.email) {
      const email = data.email.toLowerCase().trim();
      const user = await prisma.user.findFirst({
        where: {
          email,
          workspaceMembers: { some: { workspaceId: gate.workspaceId } },
        },
        select: { id: true },
      });
      if (!user) {
        // Non-member email → a pending WorkspaceInvitation that binds this
        // portfolio on accept, then email the invitee. The accept route reads
        // portfolioId/portfolioRole and adds the PortfolioMember.
        //
        // Accepting it creates a WORKSPACE seat, so only a workspace
        // OWNER/ADMIN may send it — the rule /api/workspace/invitations
        // enforces. Owning a portfolio (which any staff member can) must not
        // be a side door into the firm's workspace.
        if (!gate.isWorkspaceManager) {
          return NextResponse.json(
            {
              error:
                "This person isn't in the workspace yet. Ask a workspace owner or admin to invite them.",
            },
            { status: 403 }
          );
        }

        // Never overwrite a live invitation: it may carry a different role
        // or a project binding someone else set up, and refreshing it would
        // silently change what the invitee gets. Any other state (expired,
        // declined, or accepted by someone who has since left) is replaced
        // wholesale below.
        const prior = await prisma.workspaceInvitation.findUnique({
          where: {
            email_workspaceId: { email, workspaceId: gate.workspaceId },
          },
          select: { status: true, expiresAt: true },
        });
        if (
          prior &&
          prior.status === "PENDING" &&
          prior.expiresAt.getTime() > Date.now()
        ) {
          return NextResponse.json(
            {
              error:
                "An invitation to this workspace is already pending for that email. Resend or cancel it from the workspace members page.",
            },
            { status: 409 }
          );
        }

        const inviter = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        });
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Every field is written on update too: an old row keeps whatever
        // role and bindings it was created with (an ADMIN invite, a project
        // bind), and reviving it must not resurrect those.
        const fields = {
          role: "MEMBER" as const,
          status: "PENDING" as const,
          token,
          expiresAt,
          inviterId: userId,
          position: null,
          customTitle: null,
          department: null,
          personalMessage: null,
          projectId: null,
          companyId: null,
          projectRole: null,
          teamId: null,
          portfolioId,
          portfolioRole: data.role as PortfolioRole,
          acceptedAt: null,
          acceptedUserId: null,
        };
        await prisma.workspaceInvitation.upsert({
          where: {
            email_workspaceId: { email, workspaceId: gate.workspaceId },
          },
          create: { email, workspaceId: gate.workspaceId, ...fields },
          update: fields,
        });

        // The row is kept even when the email fails, so say so — and hand
        // back the link so the inviter can share it by other means.
        const inviterName = inviter?.name || inviter?.email || "A teammate";
        try {
          await sendInvitationEmail({
            email,
            token,
            inviterName,
            workspaceName: gate.workspaceName,
            roleLabel: WORKSPACE_ROLE_META.MEMBER?.label || "Member",
            personalMessage: null,
            projectName: gate.portfolioName,
            contextLabel: "Portfolio",
          });
        } catch (mailErr) {
          console.error(
            "[portfolio members POST] invite email failed — row kept:",
            mailErr
          );
          const appUrl = process.env.APP_URL || "http://localhost:3000";
          return NextResponse.json(
            {
              invited: true,
              emailSent: false,
              email,
              acceptUrl: `${appUrl}/invite/${token}`,
              message: `Invitation saved, but the email to ${email} could not be sent. Copy the invite link and share it with them.`,
            },
            { status: 201 }
          );
        }

        return NextResponse.json(
          {
            invited: true,
            emailSent: true,
            email,
            message: `Invitation sent to ${email}`,
          },
          { status: 201 }
        );
      }
      target = { id: user.id };
    }
    if (!target) {
      return NextResponse.json(
        { error: "Provide an email or a userId to invite" },
        { status: 400 }
      );
    }

    // Inviting the portfolio owner as a member is a no-op (they already
    // have full access via Portfolio.ownerId).
    if (target.id === gate.ownerId) {
      return NextResponse.json(
        { error: "That person already owns this portfolio" },
        { status: 409 }
      );
    }

    // Look up the prior membership so we can tell a NEW add / real role
    // change (→ notify) apart from a re-grant of the same role (→ skip,
    // to avoid notification spam).
    const priorMembership = await prisma.portfolioMember.findUnique({
      where: {
        portfolioId_userId: { portfolioId, userId: target.id },
      },
      select: { role: true },
    });

    // Re-inviting an existing admin under a lower role revokes admin, which
    // is as reserved as granting it.
    if (priorMembership?.role === "OWNER" && !gate.canGrantAdmin) {
      return NextResponse.json(
        { error: "Only the portfolio owner can grant or revoke admin access" },
        { status: 403 }
      );
    }

    // Upsert on the @@unique([portfolioId, userId]) so re-inviting an
    // existing member updates their role instead of erroring.
    const member = await prisma.portfolioMember.upsert({
      where: {
        portfolioId_userId: { portfolioId, userId: target.id },
      },
      create: { portfolioId, userId: target.id, role: data.role },
      update: { role: data.role },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        user: { select: memberUserSelect },
      },
    });

    // Best-effort in-app notification — only for a fresh add or a real
    // role change (never throws; skipped when re-granting the same role).
    const isNewMember = priorMembership == null;
    const roleChanged =
      priorMembership != null && priorMembership.role !== data.role;
    if (isNewMember || roleChanged) {
      await notifyMembershipGranted({
        userId: target.id,
        type: "PORTFOLIO_INVITATION",
        title: `You were added to the portfolio "${gate.portfolioName}"`,
        data: { portfolioId },
      });
    }

    // Optional: grant the invitee EDITOR access to every project in this
    // portfolio that the CALLER manages — the same canManage rule the
    // project members route enforces (owner, project ADMIN or workspace
    // OWNER/ADMIN). Gated per-project so a caller can't escalate access to
    // projects they don't manage. VIEWER portfolio role → no project
    // access (view-only shouldn't imply project edit).
    if (data.grantProjectAccess && data.role !== "VIEWER") {
      const links = await prisma.portfolioProject.findMany({
        where: { portfolioId },
        select: { projectId: true },
      });
      for (const { projectId } of links) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: {
            id: true,
            ownerId: true,
            workspaceId: true,
            visibility: true,
            teamId: true,
            members: { select: { userId: true, role: true } },
          },
        });
        if (!project) continue;
        const callerAccess = await resolveProjectAccess(project, userId);
        if (!callerAccess.canManage) continue;
        // A client (or someone with no seat in the project's workspace) must
        // never get a ProjectMember row: it would open the /api/projects/*
        // surface to them, which the project members route refuses too.
        const targetSeat = await prisma.workspaceMember.findUnique({
          where: {
            userId_workspaceId: {
              userId: target.id,
              workspaceId: project.workspaceId,
            },
          },
          select: { role: true },
        });
        if (!targetSeat || targetSeat.role === "CLIENT") continue;
        // Don't clobber an existing (possibly higher) project role.
        await prisma.projectMember.upsert({
          where: {
            userId_projectId: { userId: target.id, projectId },
          },
          create: { userId: target.id, projectId, role: "EDITOR" },
          update: {},
        });
      }
    }

    const row: MemberRow = {
      id: member.id,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
      user: member.user,
    };
    return NextResponse.json(row, { status: 201 });
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
    console.error("[portfolio members POST] error:", error);
    return NextResponse.json(
      { error: "Failed to invite member" },
      { status: 500 }
    );
  }
}

// ─── PATCH — change an existing member's role ─────────────────────

const roleChangeSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["OWNER", "EDITOR", "VIEWER"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { portfolioId } = await params;
    const gate = await resolvePortfolioGate(userId, portfolioId);
    if (!gate) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }
    if (!gate.canManageMembers) {
      return NextResponse.json(
        { error: "Only the portfolio owner or an admin can change roles" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const data = roleChangeSchema.parse(body);

    // The portfolio owner's access is managed via Portfolio.ownerId, not
    // a PortfolioMember row — never a target here (its GET row uses a
    // sentinel 'owner-*' id and carries the real ownerId as user.id).
    if (data.userId === gate.ownerId) {
      return NextResponse.json(
        { error: "The portfolio owner's role can't be changed here" },
        { status: 403 }
      );
    }

    // Load the existing membership row to change.
    const existing = await prisma.portfolioMember.findUnique({
      where: { portfolioId_userId: { portfolioId, userId: data.userId } },
      select: { role: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Only the portfolio owner (or a workspace manager) may promote/demote
    // to/from the OWNER role.
    const touchesOwner = data.role === "OWNER" || existing.role === "OWNER";
    if (touchesOwner && !gate.canGrantAdmin) {
      return NextResponse.json(
        { error: "Only the portfolio owner can grant or revoke admin access" },
        { status: 403 }
      );
    }

    const member = await prisma.portfolioMember.update({
      where: { portfolioId_userId: { portfolioId, userId: data.userId } },
      data: { role: data.role },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        user: { select: memberUserSelect },
      },
    });

    const row: MemberRow = {
      id: member.id,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
      user: member.user,
    };
    return NextResponse.json(row);
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
    console.error("[portfolio members PATCH] error:", error);
    return NextResponse.json(
      { error: "Failed to change role" },
      { status: 500 }
    );
  }
}

// ─── DELETE — remove a member's access (?userId=) ─────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { portfolioId } = await params;
    const gate = await resolvePortfolioGate(userId, portfolioId);
    if (!gate) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }
    if (!gate.canManageMembers) {
      return NextResponse.json(
        { error: "Only the portfolio owner or an admin can remove people" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");
    if (!targetUserId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    // The portfolio owner is never a PortfolioMember row — their access
    // is Portfolio.ownerId and can't be revoked here.
    if (targetUserId === gate.ownerId) {
      return NextResponse.json(
        { error: "Cannot remove the portfolio owner" },
        { status: 403 }
      );
    }

    // Removing an admin revokes admin: reserved to the portfolio owner and
    // workspace managers, like PATCH — otherwise one member-admin could
    // strip another.
    const targetRow = await prisma.portfolioMember.findUnique({
      where: { portfolioId_userId: { portfolioId, userId: targetUserId } },
      select: { role: true },
    });
    if (!targetRow) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (targetRow.role === "OWNER" && !gate.canGrantAdmin) {
      return NextResponse.json(
        { error: "Only the portfolio owner can grant or revoke admin access" },
        { status: 403 }
      );
    }

    const deleted = await prisma.portfolioMember.deleteMany({
      where: { portfolioId, userId: targetUserId },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[portfolio members DELETE] error:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
