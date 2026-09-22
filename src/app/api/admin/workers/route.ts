import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getPrimaryWorkspaceMembership } from "@/lib/auth-guards";
import crypto from "crypto";
import { z } from "zod";
import type { WorkspaceRole } from "@prisma/client";
import { sendInvitationEmail } from "@/lib/email";
import { WORKSPACE_ROLE_META } from "@/lib/people-types";

const inviteSchema = z.object({
  email: z.string().trim().email().max(255),
  role: z.enum(["WORKER", "ADMIN"]).optional(),
});

// Roles this page manages. ADMIN is offered by the invite dialog, so it must
// be listed too, or an Admin invite vanishes from the page right after it is
// sent. OWNER is managed from Settings > People.
const MANAGED_ROLES: WorkspaceRole[] = ["WORKER", "MEMBER", "ADMIN"];

async function verifyAdmin(userId: string) {
  // The PRIMARY membership, not an arbitrary one: with a bare findFirst an
  // OWNER of their personal singleton workspace passed this admin gate and
  // then managed "workers" in the wrong workspace.
  const member = await getPrimaryWorkspaceMembership(userId);

  if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
    return null;
  }

  return member;
}

// GET /api/admin/workers - List workspace members with role WORKER, MEMBER or ADMIN
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
        role: { in: MANAGED_ROLES },
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
        role: { in: MANAGED_ROLES },
        status: "PENDING",
        expiresAt: { gt: new Date() },
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
//
// Same contract as the canonical invite flow (/api/workspace/invitations):
// normalized email, an upsert on the (email, workspace) key so a re-invite
// after an expired/declined row does not collide, and the invitation email is
// actually sent. Before, this only stored a token nobody ever received.
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

    const body = await req.json().catch(() => null);
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }
    // Lowercased: the accept route looks the account up by exact email, so a
    // mixed-case invite for an existing user would otherwise create a second
    // account.
    const email = parsed.data.email.toLowerCase().trim();
    const role: WorkspaceRole = parsed.data.role ?? "WORKER";

    // Case-insensitive, like the login lookup: a legacy mixed-case row is
    // still the same person.
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });

    if (existingUser) {
      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: existingUser.id,
            workspaceId: admin.workspaceId,
          },
        },
        select: { id: true },
      });

      if (existingMember) {
        return NextResponse.json(
          { error: "User is already a member of this workspace" },
          { status: 409 }
        );
      }
    }

    // An expired PENDING row does not count: the upsert below turns it into
    // a fresh invitation instead of blocking the retry forever.
    const existingInvitation = await prisma.workspaceInvitation.findFirst({
      where: {
        email,
        workspaceId: admin.workspaceId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: "An invitation is already pending for this email" },
        { status: 409 }
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.workspaceInvitation.upsert({
      where: {
        email_workspaceId: { email, workspaceId: admin.workspaceId },
      },
      create: {
        email,
        role,
        token,
        expiresAt,
        workspaceId: admin.workspaceId,
        inviterId: userId,
      },
      // Reset every bind field a prior invite may have carried, so accepting
      // this one does not silently re-apply a stale project/team binding.
      update: {
        role,
        status: "PENDING",
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
        portfolioId: null,
        portfolioRole: null,
        teamId: null,
        acceptedAt: null,
        acceptedUserId: null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    const [inviter, workspace] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      }),
      prisma.workspace.findUnique({
        where: { id: admin.workspaceId },
        select: { name: true },
      }),
    ]);

    // Best-effort send: the row is kept either way, and the caller is told
    // plainly when the email did not go out.
    let warning: string | undefined;
    try {
      await sendInvitationEmail({
        email,
        token,
        inviterName: inviter?.name || inviter?.email || "A teammate",
        workspaceName: workspace?.name || "your firm",
        roleLabel: WORKSPACE_ROLE_META[role]?.label || role,
      });
    } catch (mailErr) {
      console.error("[admin/workers POST] email send failed, row kept:", mailErr);
      warning =
        "Invitation saved, but the email could not be sent. Resend it from Settings > People.";
    }

    return NextResponse.json({ invitation, warning }, { status: 201 });
  } catch (error) {
    console.error("Error inviting worker:", error);
    return NextResponse.json(
      { error: "Failed to invite worker" },
      { status: 500 }
    );
  }
}
