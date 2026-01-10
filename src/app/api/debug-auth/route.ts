import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import prisma from "@/lib/prisma";

// TEMPORARY DEBUG ENDPOINT - DELETE AFTER FIXING AUTH
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    console.log("[Debug] Testing auth for:", email);

    // Find all users to see what's in the database
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
      },
    });

    console.log("[Debug] All users in database:", allUsers.map(u => ({ email: u.email, hasPassword: !!u.password })));

    // Try to find the specific user
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email.trim().toLowerCase(),
          mode: 'insensitive'
        }
      },
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        step: "user_lookup",
        message: "User not found",
        allUsersEmails: allUsers.map(u => u.email),
        searchedFor: email.trim().toLowerCase(),
      });
    }

    if (!user.password) {
      return NextResponse.json({
        success: false,
        step: "password_check",
        message: "User has no password (OAuth account)",
        userEmail: user.email,
      });
    }

    // Test password comparison
    console.log("[Debug] Testing password comparison...");
    console.log("[Debug] Password provided:", password);
    console.log("[Debug] Hash in DB:", user.password.substring(0, 20) + "...");

    const isValid = await compare(password, user.password);
    console.log("[Debug] Password valid:", isValid);

    return NextResponse.json({
      success: isValid,
      step: "password_compare",
      message: isValid ? "Password is correct!" : "Password is incorrect",
      userEmail: user.email,
      userName: user.name,
      hashPreview: user.password.substring(0, 20) + "...",
      passwordLength: password.length,
    });

  } catch (error) {
    console.error("[Debug] Error:", error);
    return NextResponse.json({
      success: false,
      step: "error",
      message: String(error),
    }, { status: 500 });
  }
}
