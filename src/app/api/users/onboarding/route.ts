import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { validatePassword } from "@/lib/auth-utils";
import { validateToken } from "@/lib/tokens";

export async function POST(request: NextRequest) {
  try {
    const { name, password, image, email: bodyEmail } = await request.json();

    // Get email from session or from body (ONLY for users who just registered and don't have a session yet)
    const session = await getServerSession(authOptions);
    const email = session?.user?.email || bodyEmail;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Security: If using bodyEmail (no session), require a valid email verification token
    if (!session) {
      const { token: bodyToken } = await request.clone().json();
      if (!bodyToken) {
        return NextResponse.json({ error: "Authentication required. Please verify your email first." }, { status: 401 });
      }
      const tokenResult = await validateToken(bodyToken, "email-verify");
      if (!tokenResult) {
        return NextResponse.json({ error: "Invalid or expired verification token" }, { status: 401 });
      }
      const targetUser = await prisma.user.findFirst({
        where: { email: { equals: email.trim().toLowerCase(), mode: 'insensitive' } },
        select: { password: true },
      });
      if (targetUser?.password) {
        return NextResponse.json(
          { error: "This account has already been set up. Please log in instead." },
          { status: 403 }
        );
      }
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.message }, { status: 400 });
    }

    // Find user by email
    const existingUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: email.trim().toLowerCase(),
          mode: 'insensitive'
        }
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Prepare update data
    const updateData: {
      name: string;
      password: string;
      image?: string;
    } = {
      name: name.trim(),
      password: hashedPassword,
    };

    // Update image if provided
    if (image) {
      updateData.image = image;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    // Check if user already has a workspace
    const existingWorkspace = await prisma.workspaceMember.findFirst({
      where: { userId: updatedUser.id },
    });

    // Create default workspace if user doesn't have one
    if (!existingWorkspace) {
      await prisma.workspace.create({
        data: {
          name: `${name.trim()}'s Workspace`,
          ownerId: updatedUser.id,
          members: {
            create: {
              userId: updatedUser.id,
              role: "OWNER",
            },
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error in onboarding:", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
