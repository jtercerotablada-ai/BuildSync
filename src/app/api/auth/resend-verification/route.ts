import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { createToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const GENERIC_MESSAGE = "If that email exists, a verification link has been sent";

export async function POST(req: Request) {
  // Hoisted so the catch below can tell an authenticated caller (who is
  // owed a real failure) from an anonymous one (who only ever gets the
  // enumeration-safe message).
  let userId: string | undefined;
  try {
    /* Per-IP throttle, like forgot-password. The per-address 2-minute check
       below was the only brake, so an anonymous caller could loop over many
       addresses and have the firm's sending domain mail each of them every
       two minutes — a mail-bomb that burns the domain's reputation. */
    const ip = clientIp(req.headers);
    const limited = rateLimit(`resend-verify:${ip}`, 5, 15 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { message: GENERIC_MESSAGE },
        { headers: { "Retry-After": String(limited.retryAfter) } }
      );
    }

    let email: string | null = null;

    // Try to get email from session first
    userId = await getCurrentUserId();
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
      return NextResponse.json({ message: GENERIC_MESSAGE });
    }

    // Check user exists and is not verified
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, emailVerified: true },
    });

    if (!user || user.emailVerified) {
      return NextResponse.json({ message: GENERIC_MESSAGE });
    }

    // Daily cap per address, whoever asks: nobody needs more than a handful
    // of verification emails in a day.
    if (!rateLimit(`resend-verify-addr:${email}`, 5, 24 * 60 * 60 * 1000).ok) {
      return NextResponse.json({
        message: userId
          ? "Too many verification emails today. Please try again tomorrow."
          : GENERIC_MESSAGE,
      });
    }

    // Basic rate limit: check if there's a recent token (expires > 58 min from now means created < 2 min ago)
    const recentToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: `email-verify:${email}`,
        expires: { gt: new Date(Date.now() + 58 * 60 * 1000) },
      },
    });

    // For the unauthenticated path (email supplied in the body) always return
    // the same generic message so the response can't be used to probe whether
    // an address is registered/unverified. Authenticated users (who already
    // know their own state) get the specific message.
    const genericMsg = GENERIC_MESSAGE;

    if (recentToken) {
      return NextResponse.json({
        message: userId
          ? "Verification email already sent. Please wait a moment before requesting again."
          : genericMsg,
      });
    }

    const token = await createToken(`email-verify:${email}`);
    try {
      await sendVerificationEmail(email, token);
    } catch (error) {
      console.error("Error sending verification email:", error);
      // The mail never left. Telling an authenticated user "sent" would
      // leave them waiting for a message that isn't coming, so surface the
      // failure — anonymous callers still get the generic message, since a
      // distinct status here would reveal that the address is registered.
      if (userId) {
        return NextResponse.json(
          {
            error:
              "Could not send the verification email. Try again in a minute.",
          },
          { status: 502 }
        );
      }
      return NextResponse.json({ message: genericMsg });
    }

    return NextResponse.json({
      message: userId ? "Verification email sent" : genericMsg,
    });
  } catch (error) {
    console.error("Error resending verification:", error);
    if (userId) {
      return NextResponse.json(
        { error: "Could not send the verification email. Please try again." },
        { status: 500 }
      );
    }
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }
}
