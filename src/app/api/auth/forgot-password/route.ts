import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  try {
    // Throttle so this can't be used to email-bomb a victim address or to
    // fish for valid accounts at volume — audit AUTH-02.
    const ip = clientIp(req.headers);
    const limited = rateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { message: "If an account with that email exists, a reset link has been sent" },
        { headers: { "Retry-After": String(limited.retryAfter) } }
      );
    }

    const body = await req.json();
    const { email } = schema.parse(body);
    const normalizedEmail = email.trim().toLowerCase();

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({
      message: "If an account with that email exists, a reset link has been sent",
    });

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, password: true },
    });

    // No user or OAuth-only user (no password) → return success silently
    if (!user || !user.password) {
      return successResponse;
    }

    // 30-minute lifetime for reset links (shorter than the 60-min default)
    // to narrow the window an intercepted/guessed token stays valid — AUTH low.
    const token = await createToken(`password-reset:${normalizedEmail}`, 30);
    await sendPasswordResetEmail(normalizedEmail, token);

    return successResponse;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    console.error("Error in forgot password:", error);
    return NextResponse.json(
      { message: "If an account with that email exists, a reset link has been sent" }
    );
  }
}
