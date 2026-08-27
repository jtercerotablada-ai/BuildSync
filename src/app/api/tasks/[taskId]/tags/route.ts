/**
 * PUT /api/tasks/:taskId/tags — replace the full tag list on a task.
 *
 * Body: { tagIds: string[] }
 *
 * The server diff is straightforward: delete TaskTag rows for tag ids
 * not in the new set, create rows for ids that weren't there. The
 * client always sends the whole desired set so race conditions
 * collapse to "last writer wins" rather than partial state.
 *
 * Access: caller must be able to see the task — same path the other
 * /api/tasks/:id routes use (project membership / ownership).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  getUserWorkspaceId,
  verifyTaskAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";

const putSchema = z.object({
  tagIds: z.array(z.string().min(1)).max(50),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { taskId } = await params;
    const body = await req.json();
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Replacing a task's tag set is a WRITE. This route used to roll its own
    // check — "is the caller ANY member of the project" — which let a VIEWER
    // wipe every tag on any task in a project they can only read, and at the
    // same time refused a creator/assignee who is not a project member. The
    // canonical guard decides both correctly.
    const task = await verifyTaskAccess(userId, taskId, { requireWrite: true });

    // Validate that every tag id belongs to the caller's workspace.
    // Prevents cross-workspace tagging — Tag is workspace-scoped.
    // The TASK's workspace, not the caller's primary one: a multi-workspace
    // caller must not be able to cross-tag.
    const taskWs = task.project?.workspaceId ?? (await getUserWorkspaceId(userId));
    const tagIds = Array.from(new Set(parsed.data.tagIds));
    if (tagIds.length > 0) {
      const validCount = await prisma.tag.count({
        where: { id: { in: tagIds }, workspaceId: taskWs },
      });
      if (validCount !== tagIds.length) {
        return NextResponse.json(
          { error: "One or more tags don't belong to this workspace" },
          { status: 400 }
        );
      }
    }

    // Replace the set: delete current rows, insert new ones, all in
    // one transaction so the row never goes through a partial state.
    await prisma.$transaction([
      prisma.taskTag.deleteMany({ where: { taskId } }),
      ...(tagIds.length > 0
        ? [
            prisma.taskTag.createMany({
              data: tagIds.map((tagId) => ({ taskId, tagId })),
              skipDuplicates: true,
            }),
          ]
        : []),
      // Touch the task so the "Last modified" field reflects the change.
      prisma.task.update({
        where: { id: taskId },
        data: { updatedAt: new Date() },
      }),
    ]);

    // Return the updated tag list so the caller can replace its
    // in-memory state without a follow-up GET.
    const rows = await prisma.taskTag.findMany({
      where: { taskId },
      include: { tag: true },
    });
    return NextResponse.json(rows.map((r) => r.tag));
  } catch (err) {
    if (err instanceof AuthorizationError || err instanceof NotFoundError) {
      const { status, message } = getErrorStatus(err);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[task tags PUT] error:", err);
    return NextResponse.json(
      { error: "Failed to update task tags" },
      { status: 500 }
    );
  }
}
