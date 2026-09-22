import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";
import { validateToken, consumeToken } from "@/lib/tokens";
import { validatePassword } from "@/lib/auth-utils";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    // Throttle so reset tokens can't be brute-force guessed at volume — AUTH-02.
    const ip = clientIp(req.headers);
    const limited = rateLimit(`reset:${ip}`, 10, 15 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
      );
    }

    const { token, password } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.message }, { status: 400 });
    }

    const record = await validateToken(token, "password-reset:");
    if (!record) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    const email = record.identifier.replace("password-reset:", "");

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, emailVerified: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const hashedPassword = await hash(password, 12);

    /* No workspace is created here. Reset used to backfill "<name>'s
       Workspace" (OWNER) for an account that had none, which — with the old
       open sign-up — let any stranger turn a password-less row into an OWNER
       session. Staff get their membership by accepting an invitation. */
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        // Stamp passwordChangedAt so any JWT issued before now is rejected on
        // its next use — the reset actually evicts existing sessions (AUTH-03).
        passwordChangedAt: new Date(),
        /* Receiving the link proves the address is theirs, so verify it here
           if it was not already. Otherwise an account recovering from the
           broken signup would set a password and STILL be turned away by the
           `!user.emailVerified` gate in auth.ts — a reset that changes nothing
           the user can observe. */
        ...(user.emailVerified ? {} : { emailVerified: new Date() }),
      },
    });

    await consumeToken(token);

    return NextResponse.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
