/**
 * GET  /api/tags        — list every Tag in the caller's workspace.
 * POST /api/tags        — create a Tag (name + color) in the caller's
 *                          workspace. Name is unique per workspace so
 *                          duplicates 409 cleanly.
 *
 * Tags power the "Tags" built-in column Asana surfaces on the My Tasks
 * list. They're workspace-scoped (not project-scoped) so any task in
 * the workspace can wear any tag — matching Asana's behavior of a
 * single tag library shared across projects.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId } from "@/lib/auth-guards";

const createSchema = z.object({
  name: z.string().min(1).max(60),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be #RRGGBB")
    .optional(),
});

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const workspaceId = await getUserWorkspaceId(userId);
    const tags = await prisma.tag.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(tags);
  } catch (err) {
    console.error("[tags GET] error:", err);
    return NextResponse.json(
      { error: "Failed to list tags" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const workspaceId = await getUserWorkspaceId(userId);
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name, color } = parsed.data;
    try {
      const tag = await prisma.tag.create({
        data: {
          name: name.trim(),
          color: color || "#94a3b8",
          workspaceId,
        },
      });
      return NextResponse.json(tag, { status: 201 });
    } catch (e) {
      // Prisma P2002 = unique constraint (workspaceId + name).
      if ((e as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "A tag with that name already exists" },
          { status: 409 }
        );
      }
      throw e;
    }
  } catch (err) {
    console.error("[tags POST] error:", err);
    return NextResponse.json(
      { error: "Failed to create tag" },
      { status: 500 }
    );
  }
}
