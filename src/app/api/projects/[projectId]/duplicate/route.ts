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
import { allocateProjectNumber } from "@/lib/project-number";
import { regulatoryFieldsForDuplicate } from "@/lib/regulatory";

/**
 * POST /api/projects/:projectId/duplicate
 *
 * Deep-copies a project the caller can access into a NEW project they own,
 * in the same workspace: metadata + sections + the whole task tree (subtasks
 * at any depth). The previous "Duplicate" action just POSTed to /api/projects,
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
 *
 * PRIVATE TASKS. Only tasks the caller can already see are copied - the same
 * audience rule as the task gate (decideTaskAccess): not private, or the
 * caller is its creator, assignee or follower, or a workspace OWNER/ADMIN.
 * A copied private task keeps its original creator and assignee, so the copy
 * has the same audience as the original. Copying everything with the caller as
 * creator handed any editor a readable copy of a colleague's private task.
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
    const { access } = await verifyProjectAccess(userId, projectId, {
      requireWrite: true,
    });

    const visibleTaskWhere: Prisma.TaskWhereInput = access.isWorkspaceManager
      ? {}
      : {
          OR: [
            { isPrivate: false },
            { creatorId: userId },
            { assigneeId: userId },
            { collaborators: { some: { userId } } },
          ],
        };
    const taskOrder: Prisma.TaskOrderByWithRelationInput[] = [
      { position: "asc" },
      { createdAt: "asc" },
    ];

    const source = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        sections: { orderBy: { position: "asc" } },
        views: true,
        customFields: true,
        // Flat, every depth: nesting the include one level deep silently
        // dropped sub-subtasks. The tree is rebuilt from parentTaskId below.
        tasks: { where: visibleTaskWhere, orderBy: taskOrder },
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Sub-tasks added from the task panel used to be stored with no project,
    // so the project relation above never returns them. Walk down from the
    // project's own tasks by parent to pick those rows up at any depth, with
    // the same privacy rule; otherwise the copy silently loses its checklists.
    const loadedIds = new Set(source.tasks.map((t) => t.id));
    let frontier = [...loadedIds];
    while (frontier.length > 0) {
      const orphans = await prisma.task.findMany({
        where: {
          AND: [
            { parentTaskId: { in: frontier }, projectId: null },
            visibleTaskWhere,
          ],
        },
        orderBy: taskOrder,
      });
      frontier = [];
      for (const t of orphans) {
        if (loadedIds.has(t.id)) continue;
        loadedIds.add(t.id);
        source.tasks.push(t);
        frontier.push(t.id);
      }
    }

    // Parents before children. A task whose parent is not being copied (the
    // parent is private to someone else) is left out with its whole branch:
    // it belongs to that hidden task, and promoting it to a root would put a
    // piece of a private plan into the copy.
    const childrenByParent = new Map<string | null, typeof source.tasks>();
    for (const t of source.tasks) {
      const list = childrenByParent.get(t.parentTaskId) ?? [];
      list.push(t);
      childrenByParent.set(t.parentTaskId, list);
    }
    const orderedTasks: typeof source.tasks = [];
    const queue = [...(childrenByParent.get(null) ?? [])];
    while (queue.length > 0) {
      const t = queue.shift()!;
      orderedTasks.push(t);
      queue.push(...(childrenByParent.get(t.id) ?? []));
    }

    // Every task id being copied - the key for remapping dependencies, field
    // values and tags onto the copies.
    const sourceTaskIds = orderedTasks.map((t) => t.id);

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
        // A duplicate is a new job, so it gets its own number - the same
        // allocator POST /api/projects uses. The source's number identifies
        // the source job and is never copied.
        const projectNumber = await allocateProjectNumber(
          tx,
          source.workspaceId
        );

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
            // Who has jurisdiction and who to call carry over; the folio,
            // permit and case numbers and the regulatory deadline do NOT —
            // they identify one building's filing (same reason projectNumber
            // is re-allocated), and a copied deadline would fire false
            // warnings from day one. See regulatoryFieldsForDuplicate.
            ...regulatoryFieldsForDuplicate(source),
            projectNumber,
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

        // The stage history starts over for the copy, as it does for a
        // created project: SEED, not a move.
        if (source.stage) {
          await tx.projectStageEvent.create({
            data: {
              projectId: created.id,
              fromStage: null,
              toStage: source.stage,
              direction: "SEED",
              userId,
            },
          });
        }

        // Recreate the task tree parents-first, remembering old -> new task
        // id. One at a time (not createMany) precisely so we get the new ids
        // back - subtasks need their parent's, and dependencies can and do
        // point at subtasks.
        const taskIdMap = new Map<string, string>();
        for (const t of orderedTasks) {
          const newTask = await tx.task.create({
            data: {
              name: t.name,
              description: t.description,
              projectId: created.id,
              sectionId: t.sectionId ? sectionIdMap.get(t.sectionId) ?? null : null,
              // A private task keeps its creator: the creator is part of its
              // audience, and the caller must not become one by copying.
              creatorId: t.isPrivate ? t.creatorId : userId,
              assigneeId: t.assigneeId,
              parentTaskId: t.parentTaskId
                ? taskIdMap.get(t.parentTaskId) ?? null
                : null,
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
          taskIdMap.set(t.id, newTask.id);
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
