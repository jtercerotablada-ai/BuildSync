import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { uploadFile, deleteFile } from "@/lib/storage";

// POST /api/teams/:teamId/avatar - Upload/replace the team cover image.
// Lead-only, mirroring the PATCH /api/teams/:teamId settings gate.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only team leads can change the team cover (same gate as team settings).
    const teamMember = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });
    if (!teamMember) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    if (teamMember.role !== "LEAD") {
      return NextResponse.json(
        { error: "Only team leads can change the team cover" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Cover must be an image file" },
        { status: 400 }
      );
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image exceeds the 10MB limit" },
        { status: 400 }
      );
    }

    // Grab the previous avatar so we can clean it up after a successful swap.
    const existing = await prisma.team.findUnique({
      where: { id: teamId },
      select: { avatar: true },
    });

    const { url } = await uploadFile(file, `teams/${teamId}`);

    const team = await prisma.team.update({
      where: { id: teamId },
      data: { avatar: url },
      select: { id: true, avatar: true },
    });

    // Best-effort cleanup of the replaced blob (don't fail the request on it).
    if (existing?.avatar && existing.avatar !== url) {
      try {
        await deleteFile(existing.avatar);
      } catch {
        // orphaned blob is harmless; ignore
      }
    }

    return NextResponse.json(team);
  } catch (error) {
    console.error("Error uploading team cover:", error);
    return NextResponse.json(
      { error: "Failed to upload team cover" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/:teamId/avatar - Remove the team cover image (lead-only).
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teamMember = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });
    if (!teamMember) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    if (teamMember.role !== "LEAD") {
      return NextResponse.json(
        { error: "Only team leads can change the team cover" },
        { status: 403 }
      );
    }

    const existing = await prisma.team.findUnique({
      where: { id: teamId },
      select: { avatar: true },
    });

    const team = await prisma.team.update({
      where: { id: teamId },
      data: { avatar: null },
      select: { id: true, avatar: true },
    });

    if (existing?.avatar) {
      try {
        await deleteFile(existing.avatar);
      } catch {
        // orphaned blob is harmless; ignore
      }
    }

    return NextResponse.json(team);
  } catch (error) {
    console.error("Error removing team cover:", error);
    return NextResponse.json(
      { error: "Failed to remove team cover" },
      { status: 500 }
    );
  }
}
