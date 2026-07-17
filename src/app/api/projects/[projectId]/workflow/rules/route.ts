import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { resolveProjectAccess } from "@/lib/project-access";

/**
 * Validate that a rule's targets (trigger section, action user ids, and any
 * ADD_TO_PROJECT target) actually belong to this project / its workspace and
 * the caller can reach them. Without this the engine would later write into
 * foreign projects and assign arbitrary users. Returns an error message or
 * null when everything is valid.
 */
export async function validateRuleTargets(
  rule: { trigger: unknown; actions: unknown[] },
  project: { id: string; workspaceId: string },
  userId: string
): Promise<string | null> {
  const trigger = rule.trigger as { type?: string; sectionId?: string };
  if (trigger?.type === "TASK_MOVED_TO_SECTION" && trigger.sectionId) {
    const section = await prisma.section.findFirst({
      where: { id: trigger.sectionId, projectId: project.id },
      select: { id: true },
    });
    if (!section) return "Trigger section doesn't belong to this project";
  }

  const userIdsToCheck = new Set<string>();
  for (const raw of rule.actions) {
    const a = raw as {
      type?: string;
      userId?: string | null;
      userIds?: string[];
      projectId?: string;
      sectionId?: string;
    };
    // MOVE_TO_SECTION was never validated: a crafted rule could push this
    // project's tasks into a section of a project the author can't even
    // open (the engine re-checks too, but reject it at save time).
    if (a.type === "MOVE_TO_SECTION" && a.sectionId) {
      const section = await prisma.section.findFirst({
        where: { id: a.sectionId, projectId: project.id },
        select: { id: true },
      });
      if (!section) return "Target section doesn't belong to this project";
    }
    if (a.type === "SET_ASSIGNEE" && a.userId) userIdsToCheck.add(a.userId);
    if (a.type === "ADD_COLLABORATORS" && Array.isArray(a.userIds)) {
      a.userIds.forEach((u) => userIdsToCheck.add(u));
    }
    if (a.type === "ADD_TO_PROJECT" && a.projectId) {
      const targetProject = await prisma.project.findUnique({
        where: { id: a.projectId },
        select: {
          id: true,
          ownerId: true,
          visibility: true,
          workspaceId: true,
          members: { select: { userId: true, role: true } },
        },
      });
      if (!targetProject || targetProject.workspaceId !== project.workspaceId) {
        return "Target project is not in this workspace";
      }
      const targetAccess = await resolveProjectAccess(targetProject, userId);
      if (!targetAccess.ok) {
        return "You don't have access to the target project";
      }
    }
  }

  if (userIdsToCheck.size > 0) {
    const members = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: project.workspaceId,
        userId: { in: [...userIdsToCheck] },
      },
      select: { userId: true },
    });
    const found = new Set(members.map((m) => m.userId));
    for (const uid of userIdsToCheck) {
      if (!found.has(uid)) return "An assignee/collaborator is not in this workspace";
    }
  }

  return null;
}

/**
 * POST /api/projects/:projectId/workflow/rules
 *
 * Creates a new rule on the project's workflow. The workflow is
 * lazily created if it doesn't exist yet (mirrors GET behaviour).
 *
 * Body:
 *   {
 *     trigger: { type: "TASK_MOVED_TO_SECTION", sectionId: "..." },
 *     actions: [{ type: "SET_ASSIGNEE", userId: "..." }, ...]
 *   }
 *
 * Returns the created rule with its generated id.
 */

const triggerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("TASK_MOVED_TO_SECTION"),
    sectionId: z.string().min(1),
  }),
  z.object({ type: z.literal("TASK_COMPLETED") }),
]);

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SET_ASSIGNEE"), userId: z.string().nullable() }),
  z.object({
    type: z.literal("ADD_COLLABORATORS"),
    userIds: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal("ADD_COMMENT"),
    content: z.string().min(1).max(4000),
  }),
  z.object({ type: z.literal("MARK_COMPLETE") }),
  z.object({ type: z.literal("ADD_TO_PROJECT"), projectId: z.string().min(1) }),
  z.object({
    type: z.literal("SET_PRIORITY"),
    priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]),
  }),
  z.object({
    type: z.literal("ADD_SUBTASK"),
    name: z.string().min(1).max(200),
  }),
  z.object({
    type: z.literal("MOVE_TO_SECTION"),
    sectionId: z.string().min(1),
  }),
]);

const createRuleSchema = z.object({
  trigger: triggerSchema,
  actions: z.array(actionSchema).min(1),
});

async function assertProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      visibility: true,
      workspaceId: true,
      members: { select: { userId: true, role: true } },
    },
  });

  if (!project) return { ok: false as const, status: 404 };

  // Canonical read rule (matches the page); the old inline check leaked
  // WORKSPACE-visibility projects to any member.
  const access = await resolveProjectAccess(project, userId);
  if (!access.ok) return { ok: false as const, status: 403 };
  return {
    ok: true as const,
    project,
    canWrite: access.canWrite,
  };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const access = await assertProjectAccess(projectId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 404 ? "Not found" : "Forbidden" },
        { status: access.status }
      );
    }

    if (!access.canWrite) {
      return NextResponse.json(
        {
          error:
            "You don't have permission to edit this project's workflow. Ask an editor or admin.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Validate that the rule's targets belong to this project / workspace and
    // the caller can reach them (foreign section / project / user injection).
    const targetError = await validateRuleTargets(
      parsed.data,
      access.project,
      userId
    );
    if (targetError) {
      return NextResponse.json({ error: targetError }, { status: 400 });
    }

    // Find-or-create the workflow first.
    let workflow = await prisma.workflow.findFirst({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
    if (!workflow) {
      workflow = await prisma.workflow.create({
        data: {
          name: "Default workflow",
          projectId,
          isActive: true,
        },
      });
    }

    const rule = await prisma.workflowRule.create({
      data: {
        workflowId: workflow.id,
        // Prisma JSON requires a plain value; we cast via JSON
        // serialization roundtrip to strip any class instances.
        trigger: JSON.parse(JSON.stringify(parsed.data.trigger)),
        actions: JSON.parse(JSON.stringify(parsed.data.actions)),
      },
    });

    return NextResponse.json(
      {
        id: rule.id,
        trigger: rule.trigger,
        actions: rule.actions,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[workflow rules POST] error:", err);
    return NextResponse.json(
      { error: "Failed to create rule" },
      { status: 500 }
    );
  }
}
