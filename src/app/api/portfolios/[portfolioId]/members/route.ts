import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { sendInvitationEmail } from "@/lib/email";
import { notifyMembershipGranted } from "@/lib/membership-notifications";
import { WORKSPACE_ROLE_META } from "@/lib/people-types";
import type { PortfolioRole } from "@prisma/client";
import {
  verifyWorkspaceAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";

/**
 * Members API for a PORTFOLIO. Backs the "Share" modal on the portfolio
 * detail page.
 *
 *   • GET    — directory: explicit members + owner + (PUBLIC) the rest of
 *              the workspace, used by the @-mention typeahead AND the
 *              "Who has access" list. (unchanged shape)
 *   • POST   — invite a workspace user as OWNER/EDITOR/VIEWER, OR — when
 *              the email isn't a workspace member yet — create a pending
 *              WorkspaceInvitation that binds this portfolio on accept
 *              and email the invitee.
 *   • PATCH  — change an existing member's role.
 *   • DELETE — remove a member's access (?userId=).
 *
 * Membership management (POST / PATCH / DELETE) requires ADMIN capability
 * — the portfolio owner or a member whose role is OWNER. Editors can edit
 * portfolio CONTENT elsewhere but cannot manage the member list. Only the
 * portfolio owner (or an OWNER member) may grant/revoke the OWNER role.
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

// ─── Portfolio view / edit gate (matches widgets/route.ts) ─────────

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
   * owner or a member whose role is OWNER. Editors cannot — membership
   * management is admin-only (Asana parity).
   */
  canManageMembers: boolean;
}

/**
 * Load a portfolio and resolve the caller's view + edit + manage
 * capability. Returns null when the portfolio is missing, cross-workspace,
 * or the caller cannot VIEW it (owner | member | PUBLIC) — the caller maps
 * null to 404 to mask existence.
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
  await verifyWorkspaceAccess(userId, portfolio.workspaceId);

  const isPortfolioOwner = portfolio.ownerId === userId;
  const membership = portfolio.members.find((m) => m.userId === userId);
  const isMember = membership != null;
  const isPublic = portfolio.privacy === "PUBLIC";
  if (!isPortfolioOwner && !isMember && !isPublic) return null;

  const memberRole = membership?.role;
  const canEdit =
    isPortfolioOwner || memberRole === "OWNER" || memberRole === "EDITOR";
  const canManageMembers = isPortfolioOwner || memberRole === "OWNER";

  return {
    workspaceId: portfolio.workspaceId,
    ownerId: portfolio.ownerId,
    portfolioName: portfolio.name,
    workspaceName: portfolio.workspace.name,
    isPortfolioOwner,
    canEdit,
    canManageMembers,
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

    // Callers must be able to read the portfolio.
    const isCallerMember = portfolio.members.some((m) => m.user.id === userId);
    const isOwner = portfolio.ownerId === userId;
    const isPublic = portfolio.privacy === "PUBLIC";
    if (!isCallerMember && !isOwner && !isPublic) {
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
    // workspace so they can be @-mentioned. We tag those with role
    // "WORKSPACE" so the UI can dim them if needed.
    if (portfolio.privacy === "PUBLIC") {
      const existingIds = new Set(rows.map((r) => r.user.id));
      const wsMembers = await prisma.workspaceMember.findMany({
        where: { workspaceId: portfolio.workspaceId },
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

    // Only the portfolio owner (or an OWNER member) may grant the OWNER
    // role — canManageMembers already guarantees the caller is one of
    // those, so no extra check is needed for the OWNER grant here.

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
        // Non-member email → create/refresh a pending WorkspaceInvitation
        // that binds this portfolio on accept, then email the invitee.
        // Batch C's accept route reads portfolioId/portfolioRole and adds
        // the PortfolioMember when they accept.
        const inviter = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        });
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await prisma.workspaceInvitation.upsert({
          where: {
            email_workspaceId: { email, workspaceId: gate.workspaceId },
          },
          create: {
            email,
            role: "MEMBER",
            token,
            expiresAt,
            workspaceId: gate.workspaceId,
            inviterId: userId,
            portfolioId,
            portfolioRole: data.role as PortfolioRole,
          },
          update: {
            // Refresh a still-pending invite so the newest link works and
            // the portfolio bind reflects this latest invite.
            status: "PENDING",
            token,
            expiresAt,
            inviterId: userId,
            portfolioId,
            portfolioRole: data.role as PortfolioRole,
            acceptedAt: null,
            acceptedUserId: null,
          },
        });

        // Best-effort email — mirror the workspace invite send. Reuse the
        // same accept URL (built from the token inside sendInvitationEmail).
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
          });
        } catch (mailErr) {
          console.error(
            "[portfolio members POST] invite email failed — row kept:",
            mailErr
          );
        }

        return NextResponse.json(
          { invited: true, email, message: `Invitation sent to ${email}` },
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
    // portfolio that the CALLER administers (owner or ProjectMember
    // ADMIN). Gated per-project so a caller can't escalate access to
    // projects they don't admin. VIEWER portfolio role → no project
    // access (view-only shouldn't imply project edit).
    if (data.grantProjectAccess && data.role !== "VIEWER") {
      const links = await prisma.portfolioProject.findMany({
        where: { portfolioId },
        select: { projectId: true },
      });
      for (const { projectId } of links) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { ownerId: true },
        });
        if (!project) continue;
        const callerMembership = await prisma.projectMember.findUnique({
          where: { userId_projectId: { userId, projectId } },
          select: { role: true },
        });
        const callerAdmins =
          project.ownerId === userId || callerMembership?.role === "ADMIN";
        if (!callerAdmins) continue;
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

    // Only the portfolio OWNER may promote/demote to/from the OWNER role.
    const touchesOwner = data.role === "OWNER" || existing.role === "OWNER";
    if (touchesOwner && !gate.isPortfolioOwner) {
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
