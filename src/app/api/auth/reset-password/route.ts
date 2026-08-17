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
      select: { id: true, emailVerified: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const hashedPassword = await hash(password, 12);

    /* Everywhere else, setting a FIRST password and attaching a workspace
       happen together — onboarding does both in one transaction, and so does
       the invite accept path. Reset never had to, because forgot-password used
       to refuse rows with no password. Opening that gate (so accounts stranded
       by the broken signup can recover) made this the one door that sets a
       first password WITHOUT a workspace, and the result signs in to a
       dashboard that 403s: getUserWorkspaceId throws "No workspace found".
       Onboarding cannot repair it either — it now refuses any account that
       already has a password. So backfill here, in the same transaction. */
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
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

      const membership = await tx.workspaceMember.findFirst({
        where: { userId: user.id },
      });

      if (!membership) {
        await tx.workspace.create({
          data: {
            name: `${user.name?.trim() || email.split("@")[0]}'s Workspace`,
            ownerId: user.id,
            members: { create: { userId: user.id, role: "OWNER" } },
          },
        });
      }
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
