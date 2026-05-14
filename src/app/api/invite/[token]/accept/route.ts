import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";
import { getCurrentUserId, validatePassword } from "@/lib/auth-utils";

/**
 * POST /api/invite/:token/accept
 *
 * Accept a workspace invitation. Three paths the caller might be on:
 *
 *  A) Already signed in with the SAME email as the invitation
 *     → just create the WorkspaceMember (idempotent), mark accepted,
 *       optionally auto-add to project + company.
 *
 *  B) Already signed in with a DIFFERENT email
 *     → 409 — we don't move the invitation to another user silently.
 *       UI tells them to sign out and use the right account.
 *
 *  C) Not signed in
 *     C1) Email already has a user → return 401 with code "needs-login".
 *         UI redirects to /login with a return param.
 *     C2) Email has no user yet → require a password in this same
 *         POST; we create the user, hash the password, mark the
 *         email verified (the invitation IS the verification),
 *         create the workspace member, mark accepted, return ok.
 *         The UI completes by signing in on success.
 *
 * Returns { ok: true, redirect: string } on success — the redirect
 * is where the page should send the user next (either the bound
 * project or the workspace root).
 */

const bodySchema = z.object({
  // Only required for path C2 (new user signup). Validated against
  // validatePassword() so the same rules as registration apply.
  password: z.string().optional(),
  // Optional human name for new accounts. Falls back to the email
  // local part when missing.
  name: z.string().max(120).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
    });
    if (!invitation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: `Invitation is ${invitation.status.toLowerCase()}` },
        { status: 410 }
      );
    }
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invitation expired", code: "expired" },
        { status: 410 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }
    const { password, name } = parsed.data;

    // Resolve who's claiming the invitation.
    const currentUserId = await getCurrentUserId();
    let acceptingUserId: string | null = null;

    if (currentUserId) {
      const me = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: { id: true, email: true },
      });
      if (!me?.email) {
        return NextResponse.json(
          { error: "Your account is missing an email" },
          { status: 400 }
        );
      }
      if (me.email.toLowerCase() !== invitation.email.toLowerCase()) {
        // Path B — email mismatch.
        return NextResponse.json(
          {
            error:
              `This invitation is for ${invitation.email}. ` +
              `Sign out and sign in with that email to accept.`,
            code: "email-mismatch",
          },
          { status: 409 }
        );
      }
      // Path A — same email, same session.
      acceptingUserId = me.id;
    } else {
      // Not signed in. Does the invitation email already have an
      // account?
      const existing = await prisma.user.findUnique({
        where: { email: invitation.email },
        select: { id: true },
      });

      if (existing) {
        // Path C1 — need to log in first.
        return NextResponse.json(
          {
            error: "Please sign in to accept this invitation",
            code: "needs-login",
          },
          { status: 401 }
        );
      }

      // Path C2 — brand new user. Need a password from the body.
      if (!password) {
        return NextResponse.json(
          { error: "Password required to create your account", code: "needs-password" },
          { status: 400 }
        );
      }
      const pwCheck = validatePassword(password);
      if (!pwCheck.valid) {
        return NextResponse.json({ error: pwCheck.message }, { status: 400 });
      }

      const hashed = await hash(password, 10);
      const created = await prisma.user.create({
        data: {
          email: invitation.email,
          name: name || invitation.email.split("@")[0],
          password: hashed,
          // The invitation itself proves the address is real.
          emailVerified: new Date(),
          position: invitation.position,
          customTitle: invitation.customTitle,
          department: invitation.department,
        },
      });
      acceptingUserId = created.id;
    }

    if (!acceptingUserId) {
      return NextResponse.json(
        { error: "Could not resolve accepting user" },
        { status: 500 }
      );
    }

    // Create the workspace member. Idempotent against the
    // (userId, workspaceId) unique constraint.
    await prisma.workspaceMember.upsert({
      where: {
        userId_workspaceId: {
          userId: acceptingUserId,
          workspaceId: invitation.workspaceId,
        },
      },
      update: {},
      create: {
        userId: acceptingUserId,
        workspaceId: invitation.workspaceId,
        role: invitation.role,
      },
    });

    // For signed-in users on Path A, apply the pre-assigned profile
    // fields if their User row doesn't already have them set.
    if (currentUserId) {
      const me = await prisma.user.findUnique({
        where: { id: acceptingUserId },
        select: {
          position: true,
          customTitle: true,
          department: true,
        },
      });
      const updates: {
        position?: typeof invitation.position;
        customTitle?: string | null;
        department?: string | null;
      } = {};
      if (!me?.position && invitation.position) {
        updates.position = invitation.position;
      }
      if (!me?.customTitle && invitation.customTitle) {
        updates.customTitle = invitation.customTitle;
      }
      if (!me?.department && invitation.department) {
        updates.department = invitation.department;
      }
      if (Object.keys(updates).length > 0) {
        await prisma.user.update({
          where: { id: acceptingUserId },
          data: updates,
        });
      }
    }

    // Optional auto-bind to a project + company.
    let redirect = "/home";
    if (invitation.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: invitation.projectId },
        select: { id: true, workspaceId: true },
      });
      if (
        project &&
        project.workspaceId === invitation.workspaceId
      ) {
        // Validate the company still exists if specified.
        let companyId: string | null = invitation.companyId;
        if (companyId) {
          const company = await prisma.projectCompany.findFirst({
            where: { id: companyId, projectId: project.id },
            select: { id: true },
          });
          if (!company) companyId = null;
        }
        await prisma.projectMember.upsert({
          where: {
            userId_projectId: {
              userId: acceptingUserId,
              projectId: project.id,
            },
          },
          update: {
            ...(companyId !== null && { companyId }),
            ...(invitation.projectRole !== null && {
              role: invitation.projectRole,
            }),
          },
          create: {
            userId: acceptingUserId,
            projectId: project.id,
            role: invitation.projectRole || "EDITOR",
            companyId,
          },
        });
        redirect = `/projects/${project.id}`;
      }
    }

    // Notify the inviter that the invitation was accepted.
    try {
      await prisma.notification.create({
        data: {
          userId: invitation.inviterId,
          type: "PROJECT_INVITATION",
          title: `${invitation.email} accepted your invitation`,
          message: invitation.projectId
            ? `They've been added to the project too.`
            : null,
          data: {
            workspaceId: invitation.workspaceId,
            invitationId: invitation.id,
            acceptedUserId: acceptingUserId,
          },
        },
      });
    } catch (err) {
      console.error("[invite accept] notify failed:", err);
    }

    // Finalize the invitation row.
    await prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        acceptedUserId: acceptingUserId,
      },
    });

    return NextResponse.json({
      ok: true,
      redirect,
      // For Path C2 (brand new user), the client signs them in next
      // using NextAuth credentials. Hand back the email so the page
      // can pre-fill the sign-in form.
      email: invitation.email,
      isNewUser: !currentUserId,
    });
  } catch (err) {
    console.error("[invite accept] error:", err);
    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}
