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
import { getUserWorkspaceId } from "@/lib/auth-guards";

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

    // Verify the task is reachable by the caller — for My Tasks the
    // simplest valid path is: the task is in a project the caller is
    // a member/owner of, OR the task has no project and the caller is
    // the creator/assignee. We mirror the read pattern in /api/tasks.
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        creatorId: true,
        assigneeId: true,
        project: {
          select: {
            ownerId: true,
            workspaceId: true,
            members: { select: { userId: true } },
          },
        },
      },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    const callerWs = await getUserWorkspaceId(userId);
    const isCallerInProject =
      task.project &&
      (task.project.ownerId === userId ||
        task.project.members.some((m) => m.userId === userId));
    const isPersonal =
      task.projectId === null &&
      (task.creatorId === userId || task.assigneeId === userId);
    if (!isCallerInProject && !isPersonal) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate that every tag id belongs to the caller's workspace.
    // Prevents cross-workspace tagging — Tag is workspace-scoped.
    const tagIds = Array.from(new Set(parsed.data.tagIds));
    if (tagIds.length > 0) {
      const validCount = await prisma.tag.count({
        where: { id: { in: tagIds }, workspaceId: callerWs },
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
    ]);

    // Return the updated tag list so the caller can replace its
    // in-memory state without a follow-up GET.
    const rows = await prisma.taskTag.findMany({
      where: { taskId },
      include: { tag: true },
    });
    return NextResponse.json(rows.map((r) => r.tag));
  } catch (err) {
    console.error("[task tags PUT] error:", err);
    return NextResponse.json(
      { error: "Failed to update task tags" },
      { status: 500 }
    );
  }
}
