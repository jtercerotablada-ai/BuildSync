import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyBulkTaskAccess,
  verifySectionWritable,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";
import { executeRulesOnSectionChange } from "@/lib/workflow-engine";
import { resolveTaskPlacements } from "@/lib/task-placement";

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
    const workspaceId = await verifyBulkTaskAccess(userId, orderedTaskIds);

    // Require WRITE on the project that owns the destination section.
    // Same-workspace (the previous check) is not authorization: a caller who
    // merely CREATED the tasks — which is all verifyBulkTaskAccess needs —
    // could drop them into a column of a project they cannot write to, or
    // even read, where they then render for every real member and fire that
    // project's workflow rules.
    const destSection = await verifySectionWritable(userId, sectionId, {
      expectWorkspaceId: workspaceId,
    });

    // A column mixes tasks HOMED in this project with tasks merely multi-homed
    // into it, and they render identically — so the destination must be
    // written to a different column per task. Writing Task.sectionId for a
    // guest re-homed it and made it vanish from its own project's board.
    const { placements, unrelated } = await resolveTaskPlacements(
      orderedTaskIds,
      destSection.projectId,
    );
    // An id that is neither homed here nor linked here is SKIPPED, not
    // rejected. The client sends the whole column, so failing the batch would
    // let one bad row make a column permanently un-draggable — and a row like
    // that is exactly what the bug being fixed here used to produce. Skipping
    // writes nothing for it (so it is also the safe answer for a hand-crafted
    // request) while the rest of the column still renumbers.
    if (unrelated.length > 0) {
      console.warn(
        `[tasks reorder] skipping ${unrelated.length} task(s) not in project ${destSection.projectId}: ${unrelated.join(", ")}`,
      );
    }
    const placementByTask = new Map(placements.map((p) => [p.taskId, p]));
    const homeIds = new Set(
      placements.filter((p) => p.kind === "home").map((p) => p.taskId),
    );

    // Snapshot which tasks are entering this section for the first
    // time (their old sectionId differs from the destination) so we
    // can fire workflow rules AFTER the transaction commits. Tasks
    // that were already in this section and just reordered don't
    // re-fire rules — that would compound side effects on every
    // drag inside the same column. Guests are excluded: their home
    // sectionId is not what changed.
    const preMove = await prisma.task.findMany({
      where: { id: { in: [...homeIds] } },
      select: { id: true, sectionId: true, projectId: true },
    });
    const incomingTasks = preMove.filter((t) => t.sectionId !== sectionId);

    // Atomic renumber. Index in orderedTaskIds becomes the position for HOME
    // tasks; guests only get their per-project link repointed, because
    // Task.position belongs to their own project's ordering and TaskProject
    // has no position column (see lib/task-placement.ts).
    await prisma.$transaction(
      orderedTaskIds.flatMap((taskId, position) => {
        const placement = placementByTask.get(taskId);
        if (!placement) return []; // skipped: not in this project
        return [
          placement.kind === "home"
            ? prisma.task.update({
                where: { id: taskId },
                data: { sectionId, position },
              })
            : prisma.taskProject.update({
                where: { id: placement.linkId },
                data: { sectionId },
              }),
        ];
      })
    );

    // Fire workflow rules for each task that just crossed sections.
    // Engine is fire-and-forget — failures get logged inside and
    // never break the reorder response.
    //
    // Guests are deliberately absent. This loop passed the task's HOME
    // projectId with the destination sectionId, and a rule's trigger section
    // is pinned to its own project, so for a guest it could never match — it
    // was already inert. Firing the DESTINATION project's rules on a guest
    // would be a new behaviour with real side effects (auto-assign,
    // auto-complete) reaching into another project, so it stays out of a
    // corruption fix.
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
