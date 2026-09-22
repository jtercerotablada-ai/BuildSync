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

    // Does this email already correspond to a usable account? The page uses
    // this to pick "Sign in" vs "Create account". A row with no password (a
    // sign-up that was never finished) cannot sign in, so it counts as no
    // account: the accept route sets the password on that row. Matched
    // case-insensitively, like every other auth lookup.
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: invitation.email, mode: "insensitive" } },
      select: { id: true, password: true },
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
      hasAccount: !!existingUser?.password,
    });
  } catch (err) {
    console.error("[invite GET] error:", err);
    return NextResponse.json(
      { error: "Failed to resolve invitation" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/invite/:token — decline the invitation.
 *
 * Public like GET: holding the token (it arrived in the invitee's inbox) is the
 * credential, the same one that would let them accept. Only a PENDING, unexpired
 * row can be declined; the inviter gets an inbox notification so the pending
 * row does not just sit there until someone revokes it.
 */
export async function DELETE(
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
      select: {
        id: true,
        email: true,
        status: true,
        expiresAt: true,
        inviterId: true,
        workspaceId: true,
      },
    });
    if (!invitation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This invitation can no longer be declined" },
        { status: 410 }
      );
    }

    // Conditional on PENDING so a decline racing an accept cannot flip an
    // invitation that was just accepted.
    const { count } = await prisma.workspaceInvitation.updateMany({
      where: { id: invitation.id, status: "PENDING" },
      data: { status: "DECLINED" },
    });
    if (count === 0) {
      return NextResponse.json(
        { error: "This invitation can no longer be declined" },
        { status: 410 }
      );
    }

    try {
      await prisma.notification.create({
        data: {
          userId: invitation.inviterId,
          // Same type the accept route uses for "accepted your invitation".
          type: "PROJECT_INVITATION",
          title: `${invitation.email} declined your invitation`,
          data: {
            workspaceId: invitation.workspaceId,
            invitationId: invitation.id,
          },
        },
      });
    } catch (err) {
      // The decline itself stands; the notification is best-effort.
      console.error("[invite DELETE] notify failed:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[invite DELETE] error:", err);
    return NextResponse.json(
      { error: "Failed to decline invitation" },
      { status: 500 }
    );
  }
}
