import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyBulkTaskAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";
import { executeRulesOnSectionChange } from "@/lib/workflow-engine";

const reorderSchema = z.object({
  sectionId: z.string().min(1),
  // The new authoritative order. Index in the array becomes the task's
  // `position` field. All tasks in the section should be included so
  // there are no gaps or duplicates.
  orderedTaskIds: z.array(z.string().min(1)).min(1),
});

// POST /api/tasks/reorder
//
// Atomically renumber the `position` field of every task in a section
// to match a client-provided order. Used by Board and List views after
// a drag finishes — both within the same section (sortable reorder)
// and across sections (cross-column drops where the destination column
// needs its full ordering rewritten so the dropped card lands exactly
// where the user released it).
//
// Why this exists vs. PATCH-per-task:
// - prisma.updateMany can't apply different values per row, so a
//   N-task reorder needed N separate PATCH round-trips. With many
//   tasks, that's both slow and non-atomic (a partial failure mid-
//   way leaves a half-reordered column).
// - A single $transaction here wraps all updates so the column is
//   either fully reordered or untouched. One HTTP request total.
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sectionId, orderedTaskIds } = reorderSchema.parse(body);

    // Workspace-scoped task access check — same gate the rest of the
    // task endpoints use. Throws if any task is outside the user's
    // workspace or if the user lacks edit access.
    await verifyBulkTaskAccess(userId, orderedTaskIds);

    // Confirm the section actually belongs to a workspace the user
    // has access to. Reuse the first task's project as the pivot —
    // verifyBulkTaskAccess already proved the user can edit it.
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      select: { id: true, projectId: true },
    });
    if (!section) {
      return NextResponse.json(
        { error: "Section not found" },
        { status: 404 }
      );
    }

    // Snapshot which tasks are entering this section for the first
    // time (their old sectionId differs from the destination) so we
    // can fire workflow rules AFTER the transaction commits. Tasks
    // that were already in this section and just reordered don't
    // re-fire rules — that would compound side effects on every
    // drag inside the same column.
    const preMove = await prisma.task.findMany({
      where: { id: { in: orderedTaskIds } },
      select: { id: true, sectionId: true, projectId: true },
    });
    const incomingTasks = preMove.filter((t) => t.sectionId !== sectionId);

    // Atomic renumber. Index in orderedTaskIds becomes the position,
    // and we also nail the sectionId in case any task is being moved
    // into this section from elsewhere as part of the same gesture.
    await prisma.$transaction(
      orderedTaskIds.map((taskId, position) =>
        prisma.task.update({
          where: { id: taskId },
          data: { sectionId, position },
        })
      )
    );

    // Fire workflow rules for each task that just crossed sections.
    // Engine is fire-and-forget — failures get logged inside and
    // never break the reorder response.
    for (const t of incomingTasks) {
      if (!t.projectId) continue;
      await executeRulesOnSectionChange(
        { taskId: t.id, actorUserId: userId },
        sectionId,
        t.projectId
      );
    }

    return NextResponse.json({
      success: true,
      sectionId,
      count: orderedTaskIds.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[tasks reorder POST] error:", error);
    return NextResponse.json(
      { error: "Failed to reorder tasks" },
      { status: 500 }
    );
  }
}
