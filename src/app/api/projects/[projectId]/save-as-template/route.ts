/**
 * POST /api/projects/:projectId/save-as-template
 *
 * Turns a job the firm has already run into a template for the next twenty.
 * Body: { name, description?, includeTasks? }
 *
 * The reads live here; every decision about WHAT carries over lives in
 * buildTemplateStructure() (src/lib/custom-templates.ts), which is pure and
 * tested. The structure it produces is the same shape a built-in template
 * declares, so POST /api/projects materializes it with no new code.
 */

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getProjectAccess } from "@/lib/project-access";
import {
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
  requireWorkspaceContributor,
} from "@/lib/auth-guards";
import { readJson, jsonErrorResponse } from "@/lib/http";
import {
  buildTemplateStructure,
  MAX_CAPTURED_PARENT_TASKS,
  MAX_CAPTURED_SUBTASKS,
} from "@/lib/custom-templates";
import { WORKFLOW_TEMPLATES } from "@/lib/workflow-templates";

/** One row past everything the capture could possibly keep, so the read is
 *  bounded by the caps the template declares instead of by the size of the
 *  largest project in the workspace — and hitting it tells the capture that
 *  more tasks exist than it was shown. */
const TASK_READ_LIMIT = MAX_CAPTURED_PARENT_TASKS + MAX_CAPTURED_SUBTASKS + 1;

interface Body {
  name?: unknown;
  description?: unknown;
  includeTasks?: unknown;
}

/** Key order is not preserved by jsonb, so rule actions read back from the
 *  database can never be compared with a plain JSON.stringify. */
function stableKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableKey).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableKey(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Which workflow template this project is running, if any.
 *
 * Applying a workflow template writes WorkflowRule rows and records nothing
 * about where they came from — there is no column to read. So the id is
 * recovered by matching the rules back to the library: a template counts as
 * applied only when EVERY one of its rules is present on the project, which
 * is what "the user applied this template" actually produced. A project with
 * hand-written rules matches nothing and carries no workflow id.
 */
async function detectWorkflowTemplateId(projectId: string): Promise<string | null> {
  const rules = await prisma.workflowRule.findMany({
    where: { workflow: { projectId } },
    select: { actions: true },
  });
  if (rules.length === 0) return null;
  const applied = new Set(rules.map((r) => stableKey(r.actions)));
  const match = WORKFLOW_TEMPLATES.find(
    (t) =>
      t.rules.length > 0 &&
      t.rules.every((rule) => applied.has(stableKey(rule.actions)))
  );
  return match?.id ?? null;
}

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

    const access = await getProjectAccess(projectId, userId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // The same rule PATCH /api/projects/:projectId uses: someone who may not
    // edit the project may not turn it into the template the firm runs its
    // next twenty jobs from.
    const canEdit =
      access.isOwner ||
      access.memberRole === "ADMIN" ||
      access.memberRole === "EDITOR";

    if (!canEdit) {
      return NextResponse.json(
        { error: "You don't have permission to edit this project" },
        { status: 403 }
      );
    }

    const body = await readJson<Body>(req);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (name.length > 120) {
      return NextResponse.json({ error: "Name is too long" }, { status: 400 });
    }
    const description =
      typeof body.description === "string" ? body.description.trim().slice(0, 500) : null;
    const includeTasks = body.includeTasks !== false;

    // The gallery lists templates by the caller's effective workspace, so the
    // row has to be created there — not in the project's workspace, which for
    // a user with more than one membership is not necessarily the same place.
    const { workspaceId } = await requireWorkspaceContributor(userId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        type: true,
        color: true,
        icon: true,
        startDate: true,
      },
    });
    if (!project) {
      throw new NotFoundError("Project not found");
    }

    const [sections, taskRows, dependencies, projectFields] = await Promise.all([
      prisma.section.findMany({
        where: { projectId },
        orderBy: { position: "asc" },
        select: { id: true, name: true },
      }),
      includeTasks
        ? prisma.task.findMany({
            where: { projectId },
            orderBy: [{ position: "asc" }, { createdAt: "asc" }],
            take: TASK_READ_LIMIT,
            select: {
              id: true,
              name: true,
              taskType: true,
              // The instructions are the reusable part. A template of bare
              // titles makes the next engineer rediscover how the step is run.
              description: true,
              priority: true,
              dueDate: true,
              // The START date is half of the DURATION the engineer dragged
              // onto the chart. Leaving it out of the select is how a
              // template captured from a finished recert came back as a wall
              // of one-day bars even though the capture code reads it.
              startDate: true,
              sectionId: true,
              parentTaskId: true,
              isPrivate: true,
              customFieldValues: { select: { fieldId: true, value: true } },
            },
          })
        : Promise.resolve([]),
      includeTasks
        ? prisma.taskDependency.findMany({
            where: { dependentTask: { projectId } },
            select: { dependentTaskId: true, blockingTaskId: true },
          })
        : Promise.resolve([]),
      prisma.projectCustomField.findMany({
        where: { projectId },
        orderBy: { position: "asc" },
        select: {
          field: { select: { id: true, name: true, type: true, options: true } },
        },
      }),
    ]);

    const { structure, truncated } = buildTemplateStructure({
      project: {
        type: project.type,
        color: project.color,
        startDate: project.startDate,
      },
      sections,
      tasks: taskRows,
      dependencies,
      customFields: projectFields.map((pf) => pf.field),
      workflowTemplateId: await detectWorkflowTemplateId(projectId),
      includeTasks,
      moreTasksExist: taskRows.length >= TASK_READ_LIMIT,
    });

    if (structure.sections.length === 0) {
      return NextResponse.json(
        { error: "A template needs at least one section" },
        { status: 400 }
      );
    }

    const template = await prisma.projectTemplate.create({
      data: {
        name,
        description,
        icon: project.icon,
        color: project.color,
        isPublic: false,
        structure: structure as unknown as Prisma.InputJsonValue,
        workspaceId,
        creatorId: userId,
      },
      include: {
        creator: { select: { id: true, name: true, image: true } },
      },
    });

    // `truncated` is only present when something was left out, and the UI is
    // expected to say so — a capture that silently drops half a plan is worse
    // than one that refuses.
    return NextResponse.json(
      { ...template, mine: true, ...(truncated ? { truncated } : {}) },
      { status: 201 }
    );
  } catch (error) {
    const badJson = jsonErrorResponse(error);
    if (badJson) return badJson;
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error saving project as template:", error);
    return NextResponse.json(
      { error: "Failed to save project as template" },
      { status: 500 }
    );
  }
}
