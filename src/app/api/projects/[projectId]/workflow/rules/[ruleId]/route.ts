import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { resolveProjectAccess } from "@/lib/project-access";
import { validateRuleTargets } from "../route";

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
  z.object({
    type: z.literal("MOVE_TO_SECTION"),
    sectionId: z.string().min(1),
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
              id: true,
              workspaceId: true,
              ownerId: true,
              visibility: true,
              teamId: true,
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

  // Use the canonical resolver so team-shared members (Editor-level) can edit
  // rules they're allowed to create — the POST handler already gates on
  // resolveProjectAccess.canWrite, and this must agree.
  const project = rule.workflow.project;
  const access = await resolveProjectAccess(project, userId);
  if (!access.canWrite) return { ok: false as const, status: 403 };
  return { ok: true as const, rule, project };
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

    // Validate the RESULTING rule's targets (merging the patched fields with
    // the stored ones) so a PATCH can't smuggle a foreign section/project/user.
    const mergedTrigger = parsed.data.trigger ?? access.rule.trigger;
    const mergedActions = (parsed.data.actions ??
      access.rule.actions) as unknown[];
    const targetError = await validateRuleTargets(
      { trigger: mergedTrigger, actions: mergedActions },
      access.project,
      userId
    );
    if (targetError) {
      return NextResponse.json({ error: targetError }, { status: 400 });
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
