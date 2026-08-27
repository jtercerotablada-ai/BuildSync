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
import { getUserWorkspaceId, verifyTaskAccess } from "@/lib/auth-guards";

const createSchema = z.object({
  name: z.string().min(1).max(60),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be #RRGGBB")
    .optional(),
  /** Optional context — see resolveTagWorkspace. */
  taskId: z.string().optional(),
});

/**
 * WHICH workspace's tag library is this?
 *
 * Tags are workspace-scoped, and PUT /api/tasks/:id/tags validates the ids
 * against the TASK's workspace. A caller who belongs to several workspaces
 * has a primary one that need not be the task's, so listing and creating
 * against the primary while validating against the task's meant the picker
 * offered tags the save then rejected. Pass the task and both ends agree.
 *
 * The caller must be able to read the task; otherwise this falls back to
 * their own workspace, which is what the tag library means with no context.
 */
async function resolveTagWorkspace(
  userId: string,
  taskId: string | null
): Promise<string> {
  if (taskId) {
    const task = await verifyTaskAccess(userId, taskId);
    if (task.project?.workspaceId) return task.project.workspaceId;
  }
  return getUserWorkspaceId(userId);
}

export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const taskId = new URL(req.url).searchParams.get("taskId");
    const workspaceId = await resolveTagWorkspace(userId, taskId);
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
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name, color } = parsed.data;
    const workspaceId = await resolveTagWorkspace(
      userId,
      parsed.data.taskId ?? null
    );
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
