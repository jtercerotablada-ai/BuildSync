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
 *     → upsert WorkspaceMember (idempotent), optionally bind to
 *       project + company, mark invitation accepted.
 *
 *  B) Already signed in with a DIFFERENT email
 *     → 409 — we don't move the invitation to another user silently.
 *
 *  C1) Not signed in + email already has a User
 *     → 401 with code "needs-login". Page redirects to /login.
 *
 *  C2) Not signed in + email is brand new
 *     → require password in body, create User + WorkspaceMember +
 *       (optional) ProjectMember + flip status — all in a single
 *       Prisma transaction so a partial failure leaves no orphans.
 *       The page then signs them in via NextAuth Credentials and
 *       hard-reloads to the redirect target so the session is
 *       guaranteed to be picked up.
 *
 * Returns { ok: true, redirect, email, isNewUser } on success.
 */

const bodySchema = z.object({
  password: z.string().optional(),
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

    // ── Resolve the user ────────────────────────────────────────
    const currentUserId = await getCurrentUserId();
    let isNewUser = false;
    let acceptingUserId: string | null = null;
    let hashedPassword: string | null = null;

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
      // Path A — already authenticated as the right person.
      acceptingUserId = me.id;
    } else {
      const existing = await prisma.user.findUnique({
        where: { email: invitation.email },
        select: { id: true },
      });
      if (existing) {
        // Path C1 — log in first.
        return NextResponse.json(
          {
            error: "Please sign in to accept this invitation",
            code: "needs-login",
          },
          { status: 401 }
        );
      }
      // Path C2 — brand new user. Validate password BEFORE the
      // transaction starts.
      if (!password) {
        return NextResponse.json(
          {
            error: "Password required to create your account",
            code: "needs-password",
          },
          { status: 400 }
        );
      }
      const pwCheck = validatePassword(password);
      if (!pwCheck.valid) {
        return NextResponse.json({ error: pwCheck.message }, { status: 400 });
      }
      hashedPassword = await hash(password, 10);
      isNewUser = true;
    }

    // ── Pre-validate the optional project + company ─────────────
    // These checks live OUTSIDE the transaction so we don't keep a
    // long-running tx open while doing lookups.
    let projectIdToBind: string | null = null;
    let companyIdToBind: string | null = null;
    if (invitation.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: invitation.projectId },
        select: { id: true, workspaceId: true },
      });
      if (project && project.workspaceId === invitation.workspaceId) {
        projectIdToBind = project.id;
        if (invitation.companyId) {
          const company = await prisma.projectCompany.findFirst({
            where: { id: invitation.companyId, projectId: project.id },
            select: { id: true },
          });
          if (company) companyIdToBind = company.id;
        }
      }
    }

    // ── Atomic acceptance transaction ───────────────────────────
    // Wraps:  user creation (Path C2 only)  +  workspace member  +
    // optional project member  +  invitation status flip.
    // If anything throws, Prisma rolls back the whole thing so we
    // never end up with an orphan user / half-applied invite.
    const txResult = await prisma.$transaction(async (tx) => {
      // 1. Create the user (Path C2) or reuse the current one.
      let userId = acceptingUserId;
      if (!userId) {
        if (!hashedPassword) {
          throw new Error("Missing hashed password for new user");
        }
        const created = await tx.user.create({
          data: {
            email: invitation.email,
            name: name || invitation.email.split("@")[0],
            password: hashedPassword,
            // The invitation itself proves ownership of the email,
            // so we mark it verified immediately. Skips the extra
            // verify-email roundtrip for invited users.
            emailVerified: new Date(),
            position: invitation.position,
            customTitle: invitation.customTitle,
            department: invitation.department,
          },
        });
        userId = created.id;
      } else {
        // Path A — sync the pre-assigned profile fields only when
        // the user hasn't set them yet (don't clobber existing data).
        const me = await tx.user.findUnique({
          where: { id: userId },
          select: { position: true, customTitle: true, department: true },
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
          await tx.user.update({
            where: { id: userId },
            data: updates,
          });
        }
      }

      // 2. Workspace member — idempotent.
      await tx.workspaceMember.upsert({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: invitation.workspaceId,
          },
        },
        update: {},
        create: {
          userId,
          workspaceId: invitation.workspaceId,
          role: invitation.role,
        },
      });

      // 3. Optional project membership — bound to the chosen
      //    company with the chosen role.
      let redirect = "/home";
      if (projectIdToBind) {
        await tx.projectMember.upsert({
          where: {
            userId_projectId: { userId, projectId: projectIdToBind },
          },
          update: {
            ...(companyIdToBind !== null && { companyId: companyIdToBind }),
            ...(invitation.projectRole !== null && {
              role: invitation.projectRole,
            }),
          },
          create: {
            userId,
            projectId: projectIdToBind,
            role: invitation.projectRole || "EDITOR",
            companyId: companyIdToBind,
          },
        });
        redirect = `/projects/${projectIdToBind}`;
      }

      // 4. Flip invitation status. Done inside the tx so a partial
      //    failure also rolls the status back — Resend can retry
      //    the same row later.
      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          acceptedUserId: userId,
        },
      });

      // 5. Final sanity check — re-read the membership to confirm
      //    it exists. If the tx commits with no member row, the
      //    user wouldn't be "inside"; this throws to roll back.
      const member = await tx.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: invitation.workspaceId,
          },
        },
        select: { id: true },
      });
      if (!member) {
        throw new Error("Workspace member row missing after upsert");
      }

      return { userId, redirect };
    });

    // ── Side effects (best-effort, outside the transaction) ─────
    // Notification to the inviter. Failures here don't undo the
    // acceptance because at this point the user is already in.
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
            acceptedUserId: txResult.userId,
          },
        },
      });
    } catch (err) {
      console.error("[invite accept] notify failed:", err);
    }

    return NextResponse.json({
      ok: true,
      redirect: txResult.redirect,
      // For Path C2 the page will sign in via NextAuth Credentials
      // and hard-reload to the redirect target. Hand back the email
      // so it can populate the credentials body.
      email: invitation.email,
      isNewUser,
    });
  } catch (err) {
    console.error("[invite accept] error:", err);
    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}
