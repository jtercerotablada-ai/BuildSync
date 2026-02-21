import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { createToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    let email: string | null = null;

    // Try to get email from session first
    const userId = await getCurrentUserId();
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, emailVerified: true },
      });
      if (user?.emailVerified) {
        return NextResponse.json({ message: "Email already verified" });
      }
      email = user?.email || null;
    }

    // Fall back to email from body
    if (!email) {
      const body = await req.json().catch(() => ({}));
      email = body.email?.trim().toLowerCase() || null;
    }

    if (!email) {
      // Always return success to prevent enumeration
      return NextResponse.json({ message: "If that email exists, a verification link has been sent" });
    }

    // Check user exists and is not verified
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, emailVerified: true },
    });

    if (!user || user.emailVerified) {
      return NextResponse.json({ message: "If that email exists, a verification link has been sent" });
    }

    // Basic rate limit: check if there's a recent token (expires > 58 min from now means created < 2 min ago)
    const recentToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: `email-verify:${email}`,
        expires: { gt: new Date(Date.now() + 58 * 60 * 1000) },
      },
    });

    if (recentToken) {
      return NextResponse.json({ message: "Verification email already sent. Please wait a moment before requesting again." });
    }

    const token = await createToken(`email-verify:${email}`);
    await sendVerificationEmail(email, token);

    return NextResponse.json({ message: "Verification email sent" });
  } catch (error) {
    console.error("Error resending verification:", error);
    return NextResponse.json(
      { message: "If that email exists, a verification link has been sent" }
    );
  }
}
