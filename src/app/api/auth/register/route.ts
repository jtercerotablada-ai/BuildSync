import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(req: Request) {
  try {
    // Throttle signups per IP to curb automated registration / email
    // dispatch abuse — audit AUTH-02.
    const ip = clientIp(req.headers);
    const limited = rateLimit(`register:${ip}`, 10, 15 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { message: "If this email is not already registered, a verification email has been sent." },
        { status: 200, headers: { "Retry-After": String(limited.retryAfter) } }
      );
    }

    const body = await req.json();
    const { email } = registerSchema.parse(body);

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive'
        }
      },
    });

    if (existingUser) {
      /* A row with no password is a signup that never finished. Registering
         again is the ONLY move such a person has — the link expires in an hour
         (tokens.ts) and /api/auth/resend-verification sits behind a login — so
         this branch has to actually re-send. It used to return the reassuring
         message and mint nothing, which made an expired link a permanent dead
         end and turned the "we've sent it a link" screen into a lie. */
      if (!existingUser.password) {
        // Same 2-minute throttle as resend-verification: a token minted less
        // than 2 minutes ago still expires more than 58 minutes from now.
        const recentToken = await prisma.verificationToken.findFirst({
          where: {
            identifier: `email-verify:${normalizedEmail}`,
            expires: { gt: new Date(Date.now() + 58 * 60 * 1000) },
          },
        });

        if (!recentToken) {
          try {
            const token = await createToken(`email-verify:${normalizedEmail}`);
            await sendVerificationEmail(normalizedEmail, token);
          } catch (emailError) {
            console.error("Failed to resend verification email:", emailError);
          }
        }
      }

      /* Identical body and status for "resent", "throttled" and "already a
         full account", so the response still cannot be used to probe which
         addresses exist. The 201-vs-200 split below is the remaining tell and
         is tracked separately. */
      return NextResponse.json(
        { message: "If this email is not already registered, a verification email has been sent." },
        { status: 200 }
      );
    }

    // Create user with just email (no password yet)
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
      },
    });

    // Send verification email (non-blocking)
    try {
      const token = await createToken(`email-verify:${normalizedEmail}`);
      await sendVerificationEmail(normalizedEmail, token);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
    }

    return NextResponse.json(
      {
        message: "If this email is not already registered, a verification email has been sent.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return NextResponse.json(
        { error: zodError.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
