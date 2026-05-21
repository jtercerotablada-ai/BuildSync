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
import { getUserWorkspaceId } from "@/lib/auth-guards";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be #RRGGBB")
    .optional(),
});

async function assertOwnedByCallerWorkspace(
  tagId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; status: 404 | 403 }> {
  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
    select: { workspaceId: true },
  });
  if (!tag) return { ok: false, status: 404 };
  const callerWs = await getUserWorkspaceId(userId);
  if (tag.workspaceId !== callerWs) return { ok: false, status: 403 };
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
    const body = await req.json();
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
    console.error("[tag DELETE] error:", err);
    return NextResponse.json(
      { error: "Failed to delete tag" },
      { status: 500 }
    );
  }
}
