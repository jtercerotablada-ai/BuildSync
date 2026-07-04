import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyProjectAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";

/**
 * POST /api/projects/:projectId/duplicate
 *
 * Deep-copies a project the caller can access into a NEW project they own,
 * in the same workspace: metadata + sections + tasks (root tasks and their
 * subtasks). The previous "Duplicate" action just POSTed to /api/projects,
 * which created an empty shell (and 400'd outright when the source had no
 * description, because the create schema rejects `description: null`).
 *
 * Copied tasks are reset to incomplete so the duplicate is a fresh plan.
 * Comments, attachments, custom-field values and messages are intentionally
 * NOT copied.
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

    // Any user who can read the project may duplicate it into their own.
    await verifyProjectAccess(userId, projectId);

    const source = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        sections: { orderBy: { position: "asc" } },
        views: true,
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
            gate: source.gate,
            location: source.location,
            latitude: source.latitude,
            longitude: source.longitude,
            budget: source.budget,
            currency: source.currency,
            clientName: source.clientName,
            // projectNumber intentionally not copied — it identifies a
            // specific job and shouldn't be duplicated.
            members: { create: { userId, role: "ADMIN" } },
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

        // Recreate sections, remembering old→new id so tasks land in the
        // matching section.
        const sectionIdMap = new Map<string, string>();
        for (const s of source.sections) {
          const newSection = await tx.section.create({
            data: {
              name: s.name,
              position: s.position,
              projectId: created.id,
            },
            select: { id: true },
          });
          sectionIdMap.set(s.id, newSection.id);
        }

        // Recreate root tasks + their subtasks.
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
              completed: false,
            },
            select: { id: true },
          });
          if (t.subtasks.length > 0) {
            await tx.task.createMany({
              data: t.subtasks.map((sub) => ({
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
                completed: false,
              })),
            });
          }
        }

        return created;
      },
      { timeout: 20000 }
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
