import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(req: Request) {
  try {
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
      // If user exists but has no password, they can continue to onboarding
      if (!existingUser.password) {
        return NextResponse.json(
          { message: "Continue to complete your profile", userId: existingUser.id },
          { status: 200 }
        );
      }
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 400 }
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
        message: "Account created. Complete your profile.",
        userId: user.id,
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
