import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

/**
 * PATCH /api/projects/:projectId/workflow/rules/:ruleId
 * DELETE /api/projects/:projectId/workflow/rules/:ruleId
 *
 * Update or delete a single workflow rule. The rule must belong to
 * a workflow whose project the user can edit (owner / ADMIN / EDITOR).
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

const patchRuleSchema = z.object({
  trigger: triggerSchema.optional(),
  actions: z.array(actionSchema).min(1).optional(),
});

async function assertRuleAccess(
  projectId: string,
  ruleId: string,
  userId: string
) {
  const rule = await prisma.workflowRule.findUnique({
    where: { id: ruleId },
    include: {
      workflow: {
        select: {
          projectId: true,
          project: {
            select: {
              ownerId: true,
              members: { select: { userId: true, role: true } },
            },
          },
        },
      },
    },
  });

  if (!rule) return { ok: false as const, status: 404 };
  if (rule.workflow.projectId !== projectId) {
    return { ok: false as const, status: 404 };
  }

  const project = rule.workflow.project;
  const member = project.members.find((m) => m.userId === userId);
  const isOwner = project.ownerId === userId;
  const canEdit =
    isOwner ||
    (member && (member.role === "ADMIN" || member.role === "EDITOR"));

  if (!canEdit) return { ok: false as const, status: 403 };
  return { ok: true as const, rule };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string; ruleId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, ruleId } = await params;
    const access = await assertRuleAccess(projectId, ruleId, userId);
    if (!access.ok) {
      const msg =
        access.status === 404
          ? "Rule not found"
          : "You don't have permission to edit this workflow.";
      return NextResponse.json({ error: msg }, { status: access.status });
    }

    const body = await req.json();
    const parsed = patchRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data: Prisma.WorkflowRuleUpdateInput = {};
    if (parsed.data.trigger) {
      data.trigger = JSON.parse(
        JSON.stringify(parsed.data.trigger)
      ) as Prisma.InputJsonValue;
    }
    if (parsed.data.actions) {
      data.actions = JSON.parse(
        JSON.stringify(parsed.data.actions)
      ) as Prisma.InputJsonValue;
    }

    const updated = await prisma.workflowRule.update({
      where: { id: ruleId },
      data,
    });

    return NextResponse.json({
      id: updated.id,
      trigger: updated.trigger,
      actions: updated.actions,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("[workflow rule PATCH] error:", err);
    return NextResponse.json(
      { error: "Failed to update rule" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; ruleId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, ruleId } = await params;
    const access = await assertRuleAccess(projectId, ruleId, userId);
    if (!access.ok) {
      const msg =
        access.status === 404
          ? "Rule not found"
          : "You don't have permission to edit this workflow.";
      return NextResponse.json({ error: msg }, { status: access.status });
    }

    await prisma.workflowRule.delete({ where: { id: ruleId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[workflow rule DELETE] error:", err);
    return NextResponse.json(
      { error: "Failed to delete rule" },
      { status: 500 }
    );
  }
}
