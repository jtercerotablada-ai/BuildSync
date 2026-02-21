import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateToken, consumeToken } from "@/lib/tokens";

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const record = await validateToken(token, "email-verify:");
    if (!record) {
      return NextResponse.json(
        { error: "Invalid or expired verification link" },
        { status: 400 }
      );
    }

    const email = record.identifier.replace("email-verify:", "");

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, emailVerified: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.emailVerified) {
      await consumeToken(token);
      return NextResponse.json({ message: "Email already verified" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });

    await consumeToken(token);

    return NextResponse.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Error verifying email:", error);
    return NextResponse.json(
      { error: "Failed to verify email" },
      { status: 500 }
    );
  }
}
