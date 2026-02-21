import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// GET /api/users/profile
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        jobTitle: true,
        bio: true,
        emailVerified: true,
        createdAt: true,
        accounts: {
          select: { provider: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const hasOAuth = user.accounts.some((a) => a.provider === "google");
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });
    const hasPassword = !!dbUser?.password;

    return NextResponse.json({
      ...user,
      accounts: undefined,
      hasOAuth,
      hasPassword,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PATCH /api/users/profile
export async function PATCH(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, image, jobTitle, bio } = body;

    const updateData: Record<string, string | null> = {};
    if (name !== undefined) updateData.name = name?.trim() || null;
    if (image !== undefined) updateData.image = image;
    if (jobTitle !== undefined) updateData.jobTitle = jobTitle?.trim() || null;
    if (bio !== undefined) updateData.bio = bio?.trim() || null;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        jobTitle: true,
        bio: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
