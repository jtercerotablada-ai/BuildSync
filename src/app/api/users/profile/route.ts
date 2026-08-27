import { NextResponse } from "next/server";
import { AVATAR_MAX_STORED_CHARS } from "@/lib/avatar-image";
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
        // Selected only to derive `hasPassword` below. It is destructured off
        // before the response is built and never leaves the server.
        password: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    /* Was two round-trips to the same row — one selecting `accounts` to compute
       a Google `hasOAuth` flag, a second selecting `password`. Google sign-in is
       gone, so `hasOAuth` was permanently false and the accounts join bought
       nothing; folding `password` into the first select drops the second query.
       Destructuring also replaces the old `accounts: undefined` trick, which
       relied on JSON.stringify dropping undefined keys rather than on the field
       actually being absent. */
    const { password, ...safeUser } = user;

    return NextResponse.json({
      ...safeUser,
      hasPassword: !!password,
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
    if (image !== undefined) {
      // User.image is stored INLINE and echoed in every payload that carries
      // a user. The client downscales, but the API is the actual boundary:
      // accept only an http(s) URL or a small image data URL.
      if (image === null || image === "") {
        updateData.image = null;
      } else if (typeof image !== "string") {
        return NextResponse.json({ error: "Invalid image" }, { status: 400 });
      } else if (/^https?:\/\//i.test(image)) {
        if (image.length > 2048) {
          return NextResponse.json(
            { error: "Image URL is too long" },
            { status: 400 }
          );
        }
        updateData.image = image;
      } else if (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(image)) {
        if (image.length > AVATAR_MAX_STORED_CHARS) {
          return NextResponse.json(
            { error: "That image is too large. Try a smaller one." },
            { status: 413 }
          );
        }
        updateData.image = image;
      } else {
        return NextResponse.json(
          { error: "Unsupported image format" },
          { status: 400 }
        );
      }
    }
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
