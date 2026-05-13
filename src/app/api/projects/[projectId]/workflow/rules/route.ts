import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

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

  const member = project.members.find((m) => m.userId === userId);
  const isOwner = project.ownerId === userId;
  const isMember = !!member;
  if (isOwner || isMember || project.visibility === "PUBLIC") {
    return { ok: true as const, project, member };
  }

  if (project.visibility === "WORKSPACE") {
    const wsMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: project.workspaceId },
      },
    });
    if (wsMember) return { ok: true as const, project, member: null };
  }

  return { ok: false as const, status: 403 };
}

function canEditWorkflow(
  project: { ownerId: string | null },
  member: { role: string } | null,
  userId: string
): boolean {
  if (project.ownerId === userId) return true;
  if (!member) return false;
  return member.role === "ADMIN" || member.role === "EDITOR";
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

    if (!canEditWorkflow(access.project, access.member ?? null, userId)) {
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
