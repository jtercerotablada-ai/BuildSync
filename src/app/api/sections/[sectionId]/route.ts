import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { taskPrivacyClause } from "@/lib/project-visibility";
import { verifyProjectAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";
import { resolveSectionStage } from "@/lib/pipelines";
import { deleteFile } from "@/lib/storage";
import { GoalProgressService } from "@/lib/goal-progress";

const updateSectionSchema = z.object({
  name: z.string().min(1, "Section name is required").optional(),
  // Target index among the project's sections (0-based). Used by the
  // workflow builder's drag-to-reorder.
  position: z.number().int().min(0).optional(),
  // Re-point (or clear, with null) the pipeline stage whose work this column
  // carries. OMITTING it leaves the stage untouched — including across a
  // rename: the join is a decision somebody made, not something a new name
  // silently re-derives underneath them. Validated against THIS project's own
  // pipeline, so a column cannot be moved onto another pipeline's stage.
  stage: z.string().min(1).max(80).nullable().optional(),
});

/**
 * A blob uploaded through a public form or a tracking reply. The FormSubmission
 * keeps its own copy of the url in its JSON answers and outlives the column
 * (Form.defaultSection is SetNull), so the Submissions inbox and the tracking
 * page still link to it. Same rule as the task delete routes.
 */
function isSubmissionBlob(url: string): boolean {
  try {
    const path = new URL(url).pathname.replace(/^\/+/, "");
    return path.startsWith("forms/") || path.startsWith("tracking/");
  } catch {
    return false;
  }
}

// PATCH /api/sections/:sectionId - Rename and/or reorder a section
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { sectionId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify section exists and user has access to its project
    const existingSection = await prisma.section.findUnique({
      where: { id: sectionId },
      // `project.type` decides which pipeline's stages this column may claim.
      select: { projectId: true, project: { select: { type: true } } },
    });
    if (!existingSection) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    // Renaming and reordering a column are WRITES. Without requireWrite this
    // only proved the caller could READ the project.
    await verifyProjectAccess(userId, existingSection.projectId, {
      requireWrite: true,
    });

    const body = await req.json();
    const data = updateSectionSchema.parse(body);

    // Only a stage the caller actually sent is resolved — `undefined` here
    // means "leave it alone", not "re-derive it from the name".
    let nextStage: string | null | undefined;
    if (data.stage !== undefined) {
      const resolved = resolveSectionStage(
        existingSection.project?.type ?? null,
        // The name is deliberately not passed: resolveSectionStage reads it
        // ONLY on its derive-from-name branch, which `stage !== undefined`
        // above has already ruled out. Handing it `data.name` read as though
        // a rename re-derived the stage, which is the opposite of the rule —
        // renaming a column must never move the job to another desk.
        "",
        data.stage
      );
      if (!resolved.ok) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      nextStage = resolved.stage;
    }

    // Reorder: pull the project's sections in order, move this one to
    // the requested index, and rewrite positions 0..n atomically.
    if (data.position !== undefined) {
      const siblings = await prisma.section.findMany({
        where: { projectId: existingSection.projectId },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      const ids = siblings.map((s) => s.id).filter((id) => id !== sectionId);
      const target = Math.min(data.position, ids.length);
      ids.splice(target, 0, sectionId);
      await prisma.$transaction(
        ids.map((id, idx) =>
          prisma.section.update({ where: { id }, data: { position: idx } })
        )
      );
    }

    const section = await prisma.section.update({
      where: { id: sectionId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(nextStage !== undefined && { stage: nextStage }),
      },
      include: {
        // Renaming a column echoed back every task in it, unfiltered, so
        // the response carried other people's private tasks across the
        // wire even though no list would render them.
        tasks: { where: taskPrivacyClause(userId) },
      },
    });

    return NextResponse.json(section);
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
    console.error("Error updating section:", error);
    return NextResponse.json(
      { error: "Failed to update section" },
      { status: 500 }
    );
  }
}

// DELETE /api/sections/:sectionId - Delete a section
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { sectionId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if section exists
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      select: { id: true, name: true, projectId: true },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Deleting a column HARD-DELETES every task in it (below) — the most
    // destructive verb in the project surface. Without requireWrite this only
    // proved the caller could READ the project, so any VIEWER/COMMENTER could
    // permanently destroy a whole column of work.
    await verifyProjectAccess(userId, section.projectId, { requireWrite: true });

    // What goes: the column's top-level cards and their whole sub-task tree
    // (Task.parentTask cascades). NOT "every row carrying this sectionId":
    // a sub-task copies its parent's section when created, and older moves
    // only re-homed the parent, so a card dragged to another column could
    // leave its checklist behind here — invisible on the board, yet deleted
    // with the column. Those strays are re-pointed at their parent's column.
    const topLevel = await prisma.task.findMany({
      where: { sectionId, parentTaskId: null },
      select: { id: true },
    });
    const doomedIds = topLevel.map((t) => t.id);
    {
      const seen = new Set(doomedIds);
      let frontier = doomedIds;
      while (frontier.length > 0) {
        const children = await prisma.task.findMany({
          where: { parentTaskId: { in: frontier } },
          select: { id: true },
        });
        frontier = [];
        for (const c of children) {
          if (seen.has(c.id)) continue;
          seen.add(c.id);
          doomedIds.push(c.id);
          frontier.push(c.id);
        }
      }
    }

    // The cascade removes Attachment rows but not the blobs behind them, and
    // uploads are public-unguessable: a deleted column's drawings would stay
    // downloadable by anyone holding a link. Collected before the rows go.
    const attachments = doomedIds.length
      ? await prisma.attachment.findMany({
          where: {
            OR: [
              { taskId: { in: doomedIds } },
              { comment: { taskId: { in: doomedIds } } },
            ],
          },
          select: { url: true },
        })
      : [];
    const blobUrls = [...new Set(attachments.map((a) => a.url))];

    // Goals fed by these tasks (directly, through a key result, or through
    // this project) keep a stored progress; collect them before the link rows
    // cascade away so they can be recomputed once the tasks are gone. Same
    // set tasks/bulk delete recomputes.
    const affectedObjectiveIds = new Set<string>();
    if (doomedIds.length > 0) {
      const [objectiveTasks, keyResultTasks, objectiveProjects] =
        await Promise.all([
          prisma.objectiveTask.findMany({
            where: { taskId: { in: doomedIds } },
            select: { objectiveId: true },
          }),
          prisma.keyResultTask.findMany({
            where: { taskId: { in: doomedIds } },
            select: { keyResult: { select: { objectiveId: true } } },
          }),
          prisma.objectiveProject.findMany({
            where: { projectId: section.projectId },
            select: { objectiveId: true },
          }),
        ]);
      for (const o of objectiveTasks) affectedObjectiveIds.add(o.objectiveId);
      for (const k of keyResultTasks) {
        affectedObjectiveIds.add(k.keyResult.objectiveId);
      }
      for (const o of objectiveProjects) affectedObjectiveIds.add(o.objectiveId);
    }

    await prisma.$transaction(async (tx) => {
      if (topLevel.length > 0) {
        await tx.task.deleteMany({
          where: { id: { in: topLevel.map((t) => t.id) } },
        });
      }

      // Stray sub-tasks whose parent lives in another column follow that
      // parent. A chain of strays resolves one level per pass; anything still
      // pointing here after that is left for the FK's SetNull.
      for (let pass = 0; pass < 10; pass++) {
        const strays = await tx.task.findMany({
          where: { sectionId, parentTaskId: { not: null } },
          select: { id: true, parentTask: { select: { sectionId: true } } },
        });
        const byTarget = new Map<string | null, string[]>();
        for (const s of strays) {
          const target = s.parentTask?.sectionId ?? null;
          if (target === sectionId) continue;
          byTarget.set(target, [...(byTarget.get(target) ?? []), s.id]);
        }
        if (byTarget.size === 0) break;
        for (const [target, ids] of byTarget) {
          await tx.task.updateMany({
            where: { id: { in: ids } },
            data: { sectionId: target },
          });
        }
      }

      // WorkflowRule trigger/actions are JSON with no FK to Section, so the
      // rules bound to this column would outlive it: invisible in the
      // builder (it groups by sections that exist), impossible to remove,
      // and a silent no-op on every run. Drop the rules it triggers, strip
      // moves that target it, and drop a rule left with nothing to do.
      const rules = await tx.workflowRule.findMany({
        where: { workflow: { projectId: section.projectId } },
        select: { id: true, trigger: true, actions: true },
      });
      for (const rule of rules) {
        const trigger = rule.trigger as { sectionId?: unknown } | null;
        const actions = Array.isArray(rule.actions)
          ? (rule.actions as { type?: unknown; sectionId?: unknown }[])
          : [];
        const kept = actions.filter(
          (a) => !(a?.type === "MOVE_TO_SECTION" && a.sectionId === sectionId)
        );
        if (
          trigger?.sectionId === sectionId ||
          (kept.length === 0 && actions.length > 0)
        ) {
          await tx.workflowRule.delete({ where: { id: rule.id } });
        } else if (kept.length !== actions.length) {
          await tx.workflowRule.update({
            where: { id: rule.id },
            data: { actions: kept as Prisma.InputJsonValue },
          });
        }
      }

      await tx.section.delete({ where: { id: sectionId } });
    });

    // There is no project-level activity type to hold this, so the server
    // log is the record of who removed which column and how much work.
    console.info(
      `[section delete] user ${userId} deleted section "${section.name}" (${sectionId}) of project ${section.projectId}: ${topLevel.length} task(s), ${doomedIds.length - topLevel.length} sub-task(s)`
    );

    // The delete committed: a failed recalc is logged, not answered as 500.
    for (const objectiveId of affectedObjectiveIds) {
      try {
        await GoalProgressService.recalculateProgress(objectiveId);
      } catch (e) {
        console.error("[section delete] goal recalc failed:", e);
      }
    }

    // Best-effort, after the rows are gone: a blob failure must not turn a
    // completed delete into an error. A URL still referenced elsewhere (a
    // duplicated task copies its attachment rows) is left alone.
    if (blobUrls.length > 0) {
      const results = await Promise.allSettled(
        blobUrls.map(async (url) => {
          if (isSubmissionBlob(url)) return;
          const stillUsed =
            (await prisma.attachment.count({ where: { url } })) +
            (await prisma.file.count({ where: { url } })) +
            (await prisma.projectResource.count({ where: { url } })) +
            (await prisma.messageAttachment.count({ where: { url } }));
          if (stillUsed === 0) await deleteFile(url);
        })
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        console.error(
          `[section delete] ${failed} of ${blobUrls.length} blob deletions failed for section ${sectionId}`
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error deleting section:", error);
    return NextResponse.json(
      { error: "Failed to delete section" },
      { status: 500 }
    );
  }
}
