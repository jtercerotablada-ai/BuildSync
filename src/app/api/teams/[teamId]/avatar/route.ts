import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { put } from "@vercel/blob";
import { assertFileAllowed, deleteFile, isVercelBlobUrl } from "@/lib/storage";
import { getErrorStatus } from "@/lib/auth-guards";
import { requireTeamStanding } from "@/lib/team-access";

/**
 * Team covers stay PUBLIC on purpose — the one upload in the app that does.
 *
 * Every other upload is written at SAAS_BLOB_ACCESS (storage.ts) and is only
 * ever handed back through /api/files/... or a message's own read door. A cover is different in both directions: it
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
const COVER_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Delete a replaced/removed cover — but only a cover THIS route wrote for THIS
 * team. `Team.avatar` is a plain string, so the stored value is not proof of
 * anything: pointed at another team's cover or a project file in the same
 * store, a blind del() here would destroy that file for good.
 */
async function deleteOwnCover(teamId: string, url: string) {
  if (!isVercelBlobUrl(url)) return;
  const path = new URL(url).pathname.replace(/^\/+/, "");
  if (!path.startsWith(`teams/${teamId}/`) || path.includes("..")) return;
  try {
    await deleteFile(url);
  } catch {
    // orphaned blob is harmless; ignore
  }
}

/**
 * The settings gate of PATCH /api/teams/:teamId: team LEAD or workspace
 * OWNER/ADMIN, both with a contributor seat in the team's workspace. A bare
 * TeamMember lookup here left a team whose only lead had left with a cover
 * nobody could change, and let a stale row outlive its seat.
 */
async function coverEditDenied(
  userId: string,
  teamId: string
): Promise<NextResponse | null> {
  try {
    const standing = await requireTeamStanding(userId, teamId);
    if (!standing.isLead && !standing.isWorkspaceManager) {
      return NextResponse.json(
        { error: "Only team leads or workspace admins can change the team cover" },
        { status: 403 }
      );
    }
    return null;
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status === 500) throw error;
    return NextResponse.json({ error: message }, { status });
  }
}

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

    // Only team leads (or a workspace OWNER/ADMIN) can change the team cover
    // (same gate as team settings).
    const denied = await coverEditDenied(userId, teamId);
    if (denied) return denied;

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
    // and Revit models. A header image is a header image — and this one
    // arrives as a function request body, which the platform refuses above
    // ~4.5MB with a non-JSON 413, so the stated limit has to sit below that.
    if (file.size > COVER_MAX_BYTES) {
      return NextResponse.json(
        { error: "Image exceeds the 4MB limit" },
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
      await deleteOwnCover(teamId, existing.avatar);
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

    const denied = await coverEditDenied(userId, teamId);
    if (denied) return denied;

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
      await deleteOwnCover(teamId, existing.avatar);
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
