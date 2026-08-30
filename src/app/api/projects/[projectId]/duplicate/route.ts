import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyProjectAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";
import { legacyGateFor } from "@/lib/pipelines";
import { INITIALLY_HIDDEN_VIEWS } from "@/lib/project-views";

/**
 * POST /api/projects/:projectId/duplicate
 *
 * Deep-copies a project the caller can access into a NEW project they own,
 * in the same workspace: metadata + sections + tasks (root tasks and their
 * subtasks). The previous "Duplicate" action just POSTed to /api/projects,
 * which created an empty shell (and 400'd outright when the source had no
 * description, because the create schema rejects `description: null`).
 *
 * Copied tasks are reset to incomplete so the duplicate is a fresh plan, and
 * they keep what makes the plan a plan: the DEPENDENCY graph between them, the
 * project's custom-field columns AND their per-task values, and task tags.
 * Dropping those made "Duplicate" useless as a template - the whole point of
 * copying a scheduled project is the sequencing, and it came back as a flat
 * list of unlinked tasks with empty columns.
 *
 * Still NOT copied (history, not plan): comments, attachments, activity,
 * messages, collaborators, likes, and dependencies pointing OUT of the project
 * (they would tie a fresh copy to another project's live schedule).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { projectId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Duplicating forks the ENTIRE project — every section and task — into a
    // new project the caller OWNS. Read access is not enough for that: a
    // VIEWER/COMMENTER (or anyone who could merely open a PUBLIC project)
    // could otherwise take a full copy of the plan and own it outright.
    // Require the same write capability the source project's editors have.
    await verifyProjectAccess(userId, projectId, { requireWrite: true });

    const source = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        sections: { orderBy: { position: "asc" } },
        views: true,
        customFields: true,
        tasks: {
          where: { parentTaskId: null },
          orderBy: { position: "asc" },
          include: {
            subtasks: { orderBy: { position: "asc" } },
          },
        },
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Every task id in the source, roots and subtasks - the key for remapping
    // dependencies, field values and tags onto the copies.
    const sourceTaskIds = source.tasks.flatMap((t) => [
      t.id,
      ...t.subtasks.map((sub) => sub.id),
    ]);

    // Only edges whose BOTH ends live in this project can be remapped; an edge
    // to a task outside it is dropped rather than pointed at the original.
    const [dependencies, fieldValues, taskTags] = await Promise.all([
      sourceTaskIds.length
        ? prisma.taskDependency.findMany({
            where: {
              dependentTaskId: { in: sourceTaskIds },
              blockingTaskId: { in: sourceTaskIds },
            },
          })
        : Promise.resolve([]),
      sourceTaskIds.length
        ? prisma.customFieldValue.findMany({
            where: { taskId: { in: sourceTaskIds } },
          })
        : Promise.resolve([]),
      sourceTaskIds.length
        ? prisma.taskTag.findMany({ where: { taskId: { in: sourceTaskIds } } })
        : Promise.resolve([]),
    ]);

    const duplicate = await prisma.$transaction(
      async (tx) => {
        const created = await tx.project.create({
          data: {
            name: `${source.name} (copy)`,
            description: source.description,
            color: source.color,
            icon: source.icon,
            status: source.status,
            visibility: source.visibility,
            workspaceId: source.workspaceId,
            teamId: source.teamId,
            ownerId: userId,
            startDate: source.startDate,
            endDate: source.endDate,
            type: source.type,
            // The copy stands where the original stands, but on its own clock:
            // the source's dwell belongs to the source. The blocker is not
            // copied either — it names a wait somebody is actually in.
            stage: source.stage,
            stageEnteredAt: source.stage ? new Date() : null,
            // Derived, never copied — see legacyGateFor().
            gate: legacyGateFor(source.stage),
            location: source.location,
            latitude: source.latitude,
            longitude: source.longitude,
            budget: source.budget,
            currency: source.currency,
            clientName: source.clientName,
            // projectNumber intentionally not copied — it identifies a
            // specific job and shouldn't be duplicated.
            members: { create: { userId, role: "ADMIN" } },
            // The project's custom-field COLUMNS. Definitions are
            // workspace-level and shared, so the copy just re-links them.
            customFields: {
              createMany: {
                data: source.customFields.map((f) => ({
                  fieldId: f.fieldId,
                  position: f.position,
                })),
              },
            },
            views: {
              createMany: {
                data: source.views.map((v) => ({
                  name: v.name,
                  type: v.type,
                  isDefault: v.isDefault,
                })),
              },
            },
          },
          select: { id: true },
        });

        // A duplicate is a new project, so it opens on the same lean tab strip
        // a fresh one does rather than the full catalog. The source's own tab
        // choices are not copied: they belong to how that job was run, and the
        // "+" restores any of these in one click.
        if (INITIALLY_HIDDEN_VIEWS.length > 0) {
          await tx.projectViewPref.createMany({
            data: INITIALLY_HIDDEN_VIEWS.map((viewKey) => ({
              projectId: created.id,
              viewKey,
              baseView: viewKey,
              hidden: true,
            })),
            skipDuplicates: true,
          });
        }

        // Recreate sections, remembering old→new id so tasks land in the
        // matching section.
        const sectionIdMap = new Map<string, string>();
        for (const s of source.sections) {
          const newSection = await tx.section.create({
            data: {
              name: s.name,
              position: s.position,
              projectId: created.id,
              // The board column ↔ stage join travels with the column. The
              // copy stands at the source's stage (above), so dropping this
              // gave it a strip that knows where the job is and a board that
              // does not — the two vocabularies this whole change exists to
              // merge, re-created by the standard way the firm starts the
              // next building's recertification.
              stage: s.stage,
            },
            select: { id: true },
          });
          sectionIdMap.set(s.id, newSection.id);
        }

        // Recreate root tasks + their subtasks, remembering old -> new task id.
        // Subtasks are created one at a time (not createMany) precisely so we
        // get their new ids back - dependencies can and do point at subtasks.
        const taskIdMap = new Map<string, string>();
        for (const t of source.tasks) {
          const newParent = await tx.task.create({
            data: {
              name: t.name,
              description: t.description,
              projectId: created.id,
              sectionId: t.sectionId ? sectionIdMap.get(t.sectionId) ?? null : null,
              creatorId: userId,
              assigneeId: t.assigneeId,
              position: t.position,
              priority: t.priority,
              taskType: t.taskType,
              dueDate: t.dueDate,
              startDate: t.startDate,
              isPrivate: t.isPrivate,
              completed: false,
            },
            select: { id: true },
          });
          taskIdMap.set(t.id, newParent.id);

          for (const sub of t.subtasks) {
            const newSub = await tx.task.create({
              data: {
                name: sub.name,
                description: sub.description,
                projectId: created.id,
                sectionId: sub.sectionId
                  ? sectionIdMap.get(sub.sectionId) ?? null
                  : null,
                creatorId: userId,
                assigneeId: sub.assigneeId,
                parentTaskId: newParent.id,
                position: sub.position,
                priority: sub.priority,
                taskType: sub.taskType,
                dueDate: sub.dueDate,
                startDate: sub.startDate,
                isPrivate: sub.isPrivate,
                completed: false,
              },
              select: { id: true },
            });
            taskIdMap.set(sub.id, newSub.id);
          }
        }

        // Dependency graph - the reason to duplicate a scheduled project.
        const remappedDependencies = dependencies
          .map((d) => {
            const dependentTaskId = taskIdMap.get(d.dependentTaskId);
            const blockingTaskId = taskIdMap.get(d.blockingTaskId);
            if (!dependentTaskId || !blockingTaskId) return null;
            return { dependentTaskId, blockingTaskId, type: d.type };
          })
          .filter((d): d is NonNullable<typeof d> => d !== null);
        if (remappedDependencies.length > 0) {
          await tx.taskDependency.createMany({ data: remappedDependencies });
        }

        // Per-task custom-field values, so the copied columns aren't empty.
        const remappedValues = fieldValues
          .map((v) => {
            const taskId = taskIdMap.get(v.taskId);
            if (!taskId) return null;
            return {
              taskId,
              fieldId: v.fieldId,
              value: v.value as Prisma.InputJsonValue,
            };
          })
          .filter((v): v is NonNullable<typeof v> => v !== null);
        if (remappedValues.length > 0) {
          await tx.customFieldValue.createMany({ data: remappedValues });
        }

        const remappedTags = taskTags
          .map((tt) => {
            const taskId = taskIdMap.get(tt.taskId);
            if (!taskId) return null;
            return { taskId, tagId: tt.tagId };
          })
          .filter((t): t is NonNullable<typeof t> => t !== null);
        if (remappedTags.length > 0) {
          await tx.taskTag.createMany({ data: remappedTags });
        }

        return created;
      },
      { timeout: 30000 }
    );

    return NextResponse.json({ id: duplicate.id }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error duplicating project:", error);
    return NextResponse.json(
      { error: "Failed to duplicate project" },
      { status: 500 }
    );
  }
}
