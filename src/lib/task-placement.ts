import prisma from "@/lib/prisma";

/**
 * Where a task actually lives when it is dropped into a section.
 *
 * ── THE TWO HOMES A TASK CAN HAVE ────────────────────────────────────────
 * `Task.projectId` / `Task.sectionId` are the task's HOME placement — the one
 * project that owns it. `TaskProject { taskId, projectId, sectionId }` is a
 * GUEST placement: the same task shown inside a second project, with its own
 * per-project section. The project page reads both (see the multiHomedBySection
 * block in (dashboard)/projects/[projectId]/page.tsx) and merges them into one
 * column, so on screen a guest task is indistinguishable from a home task.
 *
 * ── THE BUG THIS EXISTS TO PREVENT ───────────────────────────────────────
 * /api/tasks/reorder and /api/tasks/bulk used to write `Task.sectionId` for
 * every id the client sent. Dragging a card in project B's board therefore
 * rewrote the HOME section of a task homed in project A, pointing it at one of
 * B's sections. A's board renders its columns through `sections.include.tasks`,
 * so the task instantly vanished from A — silently, with no error and no undo,
 * while still looking correct in B. The corruption was invisible at the moment
 * it happened.
 *
 * Resolving the placement first means a drag in B updates B's TaskProject row
 * and leaves the home placement untouched.
 *
 * ── KNOWN LIMITATION ─────────────────────────────────────────────────────
 * TaskProject has no `position` column, so a guest task's order WITHIN a guest
 * column cannot be persisted. The project page already appends guest tasks
 * after the section's own tasks (ordered by their home `position`), which is
 * the behaviour this preserves. Persisting guest order needs an additive
 * migration and is deliberately out of scope here.
 */
export type TaskPlacement =
  | { taskId: string; kind: "home" }
  | { taskId: string; kind: "guest"; linkId: string };

export interface ResolvedPlacements {
  placements: TaskPlacement[];
  /** Ids that are neither homed in nor multi-homed into the destination
   *  project. The shipped UI cannot produce these — a column only ever renders
   *  tasks of one of the two kinds — so callers should reject rather than
   *  guess, which is exactly what the old code did wrong. */
  unrelated: string[];
}

/**
 * Classify each id in `taskIds` against `destProjectId` — the project that owns
 * the destination section.
 */
export async function resolveTaskPlacements(
  taskIds: string[],
  destProjectId: string,
): Promise<ResolvedPlacements> {
  if (taskIds.length === 0) return { placements: [], unrelated: [] };

  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds } },
    select: { id: true, projectId: true },
  });
  const homeById = new Map(tasks.map((t) => [t.id, t.projectId]));

  const guestCandidates = taskIds.filter(
    (id) => homeById.has(id) && homeById.get(id) !== destProjectId,
  );
  const links = guestCandidates.length
    ? await prisma.taskProject.findMany({
        where: { taskId: { in: guestCandidates }, projectId: destProjectId },
        select: { id: true, taskId: true },
      })
    : [];
  const linkByTask = new Map(links.map((l) => [l.taskId, l.id]));

  const placements: TaskPlacement[] = [];
  const unrelated: string[] = [];
  for (const taskId of taskIds) {
    if (!homeById.has(taskId)) {
      unrelated.push(taskId);
      continue;
    }
    if (homeById.get(taskId) === destProjectId) {
      placements.push({ taskId, kind: "home" });
      continue;
    }
    const linkId = linkByTask.get(taskId);
    if (linkId) {
      placements.push({ taskId, kind: "guest", linkId });
    } else {
      unrelated.push(taskId);
    }
  }
  return { placements, unrelated };
}
