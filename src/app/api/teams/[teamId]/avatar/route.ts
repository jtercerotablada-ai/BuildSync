import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { put } from "@vercel/blob";
import { assertFileAllowed, deleteFile } from "@/lib/storage";

/**
 * Team covers stay PUBLIC on purpose — the one upload in the app that does.
 *
 * Every other upload goes through uploadFile, which writes a private blob only
 * /api/files/... will hand back. A cover is different in both directions: it
 * carries nothing confidential (a decorative header image the team chose), and
 * it renders as a bare <img src> in team lists, the sidebar and pickers —
 * surfaces where the viewer is a workspace member who may not belong to the
 * team, so a membership-gated read route would blank the image for exactly the
 * people browsing teams to join. There is also no record type for Team on the
 * file read route. A permanent public URL to a cover image is the cheaper
 * trade, so this route calls put() directly instead of uploadFile.
 *
 * The gates uploadFile would have applied are kept below: the extension
 * blocklist via assertFileAllowed, plus this route's own image + size checks.
 */
async function putPublicCover(teamId: string, file: File) {
  assertFileAllowed(file.name, file.type);
  // The uploader's filename is never part of the path: a cover is addressed by
  // nothing but this url, so there is no reason to carry a name we would then
  // have to sanitize.
  return put(`teams/${teamId}/${crypto.randomUUID()}`, file, {
    access: "public",
    contentType: file.type,
  });
}

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
    // Deliberately NOT maxUploadBytes(): that ceiling is sized for permit sets
    // and Revit models. A header image is a header image.
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

    let url: string;
    try {
      ({ url } = await putPublicCover(teamId, file));
    } catch (uploadErr) {
      return NextResponse.json(
        { error: uploadErr instanceof Error ? uploadErr.message : "Upload failed" },
        { status: 400 }
      );
    }

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
