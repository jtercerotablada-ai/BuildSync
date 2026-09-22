/**
 * PATCH  /api/tags/:tagId — rename or recolor a tag (workspace-scoped
 *                            access check).
 * DELETE /api/tags/:tagId — remove a tag and its TaskTag joins
 *                            (cascade).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { isNonContributorRole } from "@/lib/workspace-roles";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be #RRGGBB")
    .optional(),
});

/**
 * Authorize against the TAG's own workspace. POST /api/tags creates a tag in
 * the workspace of the task it was created from, which for a multi-workspace
 * user need not be their primary one; comparing with the primary workspace
 * made such tags impossible to rename or delete. A tag in a workspace the
 * caller does not belong to is reported as missing, not forbidden.
 */
async function assertOwnedByCallerWorkspace(
  tagId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; status: 404 | 403 }> {
  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
    select: { workspaceId: true },
  });
  if (!tag) return { ok: false, status: 404 };
  const member = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: tag.workspaceId } },
    select: { role: true },
  });
  if (!member) return { ok: false, status: 404 };
  // The tag library is shared by the whole workspace; view-only roles must
  // not rename or delete what everyone else sees on their tasks.
  if (isNonContributorRole(member.role)) return { ok: false, status: 403 };
  return { ok: true };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tagId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { tagId } = await params;
    const access = await assertOwnedByCallerWorkspace(tagId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 404 ? "Not found" : "Forbidden" },
        { status: access.status }
      );
    }
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    try {
      const tag = await prisma.tag.update({
        where: { id: tagId },
        data: {
          ...(parsed.data.name !== undefined
            ? { name: parsed.data.name.trim() }
            : {}),
          ...(parsed.data.color !== undefined
            ? { color: parsed.data.color }
            : {}),
        },
      });
      return NextResponse.json(tag);
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "A tag with that name already exists" },
          { status: 409 }
        );
      }
      throw e;
    }
  } catch (err) {
    console.error("[tag PATCH] error:", err);
    return NextResponse.json(
      { error: "Failed to update tag" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ tagId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { tagId } = await params;
    const access = await assertOwnedByCallerWorkspace(tagId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 404 ? "Not found" : "Forbidden" },
        { status: access.status }
      );
    }
    await prisma.tag.delete({ where: { id: tagId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    // Deleted concurrently between the check and the delete.
    if ((err as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[tag DELETE] error:", err);
    return NextResponse.json(
      { error: "Failed to delete tag" },
      { status: 500 }
    );
  }
}
