import { NextRequest, NextResponse } from "next/server";
import { AVATAR_MAX_STORED_CHARS } from "@/lib/avatar-image";
import { getServerSession } from "next-auth";
import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { validatePassword } from "@/lib/auth-utils";
import { validateToken, consumeToken } from "@/lib/tokens";

/**
 * Finish account setup: set the name and the FIRST password.
 *
 * Two ways in, and they authenticate differently:
 *
 *  · With a session — an already-signed-in user completing their profile. They
 *    may only set a password if they do not have one; this endpoint is not a
 *    password-change route and must not be usable as one.
 *
 *  · With an `email-verify` token — the normal signup. The token arrives by
 *    email, so redeeming it proves the person controls the address. That is
 *    what lets us set the password AND stamp `emailVerified` in one step.
 *
 * This route was unreachable until 2026-08-16 and every one of these guards was
 * either missing or broken; see the notes at each fix.
 */
export async function POST(request: NextRequest) {
  try {
    /* The token used to be read via `await request.clone().json()` AFTER the
       body had already been consumed by the destructure below. A Request cannot
       be cloned once its body is disturbed, so that line threw on every
       token-based call and the whole route 500'd — nobody could ever complete
       signup. One read, all fields. */
    const {
      name,
      password,
      image,
      email: bodyEmail,
      token: bodyToken,
    } = await request.json();

    // Same boundary as PATCH /api/users/profile: the avatar is stored inline
    // in User.image, so an oversized or non-image string must never land in
    // the column (it would then ride along in every user payload).
    if (image != null && image !== "") {
      const validImage =
        typeof image === "string" &&
        (/^https?:\/\//i.test(image)
          ? image.length <= 2048
          : /^data:image\/(png|jpeg|webp|gif);base64,/i.test(image) &&
            image.length <= AVATAR_MAX_STORED_CHARS);
      if (!validImage) {
        return NextResponse.json(
          { error: "That profile photo couldn't be used. Try a smaller one." },
          { status: 400 }
        );
      }
    }

    const session = await getServerSession(authOptions);

    let email: string | undefined;
    let verifiedByToken = false;

    /* The TOKEN wins over the session when both are present.
       The session branch used to come first, so opening a new hire's emailed
       link on a machine where someone was already signed in silently ignored
       the token, resolved to the signed-in person's account and answered "this
       account is already set up" — naming the wrong account, with the hire's
       own account untouched. A token is a deliberate, single-purpose
       credential for one specific address; a stray session cookie is not. */
    if (bodyToken) {
      const tokenResult = await validateToken(bodyToken, "email-verify:");
      if (!tokenResult) {
        return NextResponse.json(
          { error: "This link is invalid or has expired. Use \"Forgot password?\" on the sign-in page to get a new one." },
          { status: 401 }
        );
      }
      email = tokenResult.identifier.slice("email-verify:".length);
      verifiedByToken = true;

      // Signed in as somebody else? Say so instead of acting on the wrong row.
      if (
        session?.user?.email &&
        session.user.email.trim().toLowerCase() !== email.trim().toLowerCase()
      ) {
        return NextResponse.json(
          {
            error: `You are signed in as ${session.user.email}. Sign out, or open this link in a private window, to finish setting up ${email}.`,
          },
          { status: 409 }
        );
      }
    } else if (session?.user?.email) {
      email = session.user.email;
    } else {
      return NextResponse.json(
        { error: "Authentication required. Open the link from your verification email." },
        { status: 401 }
      );
    }

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();

    /* `bodyEmail` is never authoritative and is only read to catch an
       inconsistent client. On the token path the address comes from the token
       identifier; on the session path it comes from the session. */
    if (bodyEmail && bodyEmail.trim().toLowerCase() !== normalizedEmail && !verifiedByToken) {
      return NextResponse.json({ error: "Email mismatch" }, { status: 403 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.message }, { status: 400 });
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, password: true },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    /* Setting a password is only ever a FIRST setup here. Previously the
       session branch skipped this check entirely, so any logged-in user could
       POST a new password to this route and have it applied with no
       current-password prompt — a session-riding password takeover. Changing an
       existing password belongs to /api/users/password, which asks for the
       current one. */
    if (existingUser.password) {
      return NextResponse.json(
        { error: "This account is already set up. Please log in instead." },
        { status: 403 }
      );
    }

    const hashedPassword = await hash(password, 12);

    /* No workspace is created here any more. This used to give anyone who
       reached this point "<name>'s Workspace" with themselves as OWNER — with
       open sign-up, that handed any stranger an authenticated OWNER session on
       the production app. Self-service sign-up is closed; staff join the firm
       workspace by accepting an invitation, which creates the membership. */
    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: name.trim(),
        password: hashedPassword,
        ...(image ? { image } : {}),
        /* Redeeming the emailed token IS the proof of address ownership, so
           verify here. Without this the user set a password and was then
           refused at login by the `!user.emailVerified` gate in auth.ts —
           the second half of the same dead end. */
        ...(verifiedByToken ? { emailVerified: new Date() } : {}),
      },
      select: { id: true, name: true, email: true, image: true },
    });

    // Single-use. An unconsumed token stayed replayable for its whole hour.
    if (verifiedByToken && bodyToken) {
      await consumeToken(bodyToken);
    }

    /* Without a membership the app has nothing to show, so point the page at
       a pending invitation for this address when there is one: accepting it
       while signed in is what joins the workspace. */
    const pendingInvitation = await prisma.workspaceInvitation.findFirst({
      where: {
        email: normalizedEmail,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: { token: true },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      next: pendingInvitation ? `/invite/${pendingInvitation.token}` : "/home",
    });
  } catch (error) {
    console.error("Error in onboarding:", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
