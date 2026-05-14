import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

/**
 * GET /api/invite/:token — public; resolves the token into a
 * lightweight invitation summary so the landing page can render
 * "X invites you to join Y as Z" without leaking ids/emails of
 * unrelated rows.
 *
 * Returns:
 *  - 404 if no such token
 *  - 410 (Gone) if the invitation is expired / accepted / declined
 *  - 200 with { ok: true, invitation } otherwise
 *
 * If the caller is logged in we also return whether their email
 * matches the invitee so the page can pick the right path
 * (accept directly / sign in / sign out).
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
      include: {
        workspace: { select: { id: true, name: true } },
        inviter: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });
    if (!invitation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Status / expiration gates
    const now = new Date();
    if (invitation.status === "ACCEPTED") {
      return NextResponse.json(
        { error: "This invitation has already been accepted", code: "accepted" },
        { status: 410 }
      );
    }
    if (invitation.status === "DECLINED") {
      return NextResponse.json(
        { error: "This invitation was declined", code: "declined" },
        { status: 410 }
      );
    }
    if (invitation.expiresAt < now) {
      return NextResponse.json(
        { error: "This invitation has expired", code: "expired" },
        { status: 410 }
      );
    }

    // Resolve project name if invitation was bound to one (lookup
    // is separate because we don't have a Prisma relation defined).
    let projectName: string | null = null;
    if (invitation.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: invitation.projectId },
        select: { name: true },
      });
      projectName = project?.name ?? null;
    }

    // Is the current viewer already signed in? If so flag whether
    // their email matches so the UI can short-circuit the path.
    const currentUserId = await getCurrentUserId();
    let viewer: {
      signedIn: boolean;
      emailMatches: boolean;
      email: string | null;
    } = { signedIn: false, emailMatches: false, email: null };
    if (currentUserId) {
      const me = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: { email: true },
      });
      viewer = {
        signedIn: true,
        email: me?.email ?? null,
        emailMatches:
          !!me?.email &&
          me.email.toLowerCase() === invitation.email.toLowerCase(),
      };
    }

    // Does this email already correspond to a registered user? The
    // page uses this to pre-select "Log in" vs "Create account".
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    });

    return NextResponse.json({
      ok: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
        personalMessage: invitation.personalMessage,
        position: invitation.position,
        customTitle: invitation.customTitle,
        department: invitation.department,
        projectId: invitation.projectId,
        companyId: invitation.companyId,
        projectRole: invitation.projectRole,
        projectName,
        workspace: invitation.workspace,
        inviter: invitation.inviter,
      },
      viewer,
      hasAccount: !!existingUser,
    });
  } catch (err) {
    console.error("[invite GET] error:", err);
    return NextResponse.json(
      { error: "Failed to resolve invitation" },
      { status: 500 }
    );
  }
}
