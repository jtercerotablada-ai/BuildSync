/**
 * POST /api/projects/:projectId/workflow/templates
 *
 * Bulk-applies an engineering workflow template to a project:
 *   1. Looks up the template by id from the static library.
 *   2. Ensures every section the template references exists on the
 *      project (creates the missing ones at the end of the board,
 *      preserving the template's declared order).
 *   3. Find-or-creates the default workflow, then creates one
 *      WorkflowRule per template rule with the trigger pointed at
 *      the resolved sectionId.
 *
 * Returns a summary so the UI can show "Created 9 rules and 4 new
 * sections." Skips rules whose trigger needs a section that we
 * couldn't resolve (defensive; shouldn't happen post-ensure).
 *
 * Body:  { templateId: string }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { resolveProjectAccess } from "@/lib/project-access";
import {
  WORKFLOW_TEMPLATES,
  findTemplateById,
  type TemplateTriggerSpec,
} from "@/lib/workflow-templates";
import type { WorkflowTrigger } from "@/lib/workflow-types";

const bodySchema = z.object({
  templateId: z.string().min(1),
});

// Applying a template mutates the project's workflow — a write action. Gate
// it through the canonical resolver so it agrees with the rest of the app
// (owner / project ADMIN·EDITOR / team-shared member) instead of a hand-rolled
// check that both over-granted WORKSPACE-visibility read and ignored team
// sharing.
async function assertCanEditWorkflow(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      visibility: true,
      workspaceId: true,
      teamId: true,
      members: { select: { userId: true, role: true } },
    },
  });
  if (!project) return { ok: false as const, status: 404 };
  const access = await resolveProjectAccess(project, userId);
  if (!access.ok) return { ok: false as const, status: access.status };
  if (!access.canWrite) return { ok: false as const, status: 403 };
  return { ok: true as const, project };
}

/**
 * GET /api/projects/:projectId/workflow/templates
 *
 * Returns the static template catalog so the UI can render the
 * "Apply a template" gallery without hardcoding the list client-side.
 */
export async function GET() {
  return NextResponse.json(
    WORKFLOW_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      icon: t.icon,
      sections: t.sections,
      ruleCount: t.rules.length,
    }))
  );
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
    const access = await assertCanEditWorkflow(projectId, userId);
    if (!access.ok) {
      return NextResponse.json(
        {
          error:
            access.status === 404
              ? "Not found"
              : "You don't have permission to edit this project's workflow. Ask an editor or admin.",
        },
        { status: access.status }
      );
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    const template = findTemplateById(parsed.data.templateId);
    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Run section creation + workflow upsert + rule inserts inside a
    // transaction so a partial apply can't leave the project in a
    // weird state (sections created, rules half-written).
    const result = await prisma.$transaction(async (tx) => {
      // ── Ensure every section the template needs exists ────────
      const existingSections = await tx.section.findMany({
        where: { projectId },
        select: { id: true, name: true, position: true },
        orderBy: { position: "asc" },
      });
      const byName = new Map(
        existingSections.map((s) => [s.name.toLowerCase(), s])
      );
      const sectionIds = new Map<string, string>(); // template name → real section id

      let nextPosition =
        existingSections.length > 0
          ? Math.max(...existingSections.map((s) => s.position)) + 1
          : 0;
      let createdSections = 0;

      for (const name of template.sections) {
        const found = byName.get(name.toLowerCase());
        if (found) {
          sectionIds.set(name, found.id);
          continue;
        }
        const created = await tx.section.create({
          data: { projectId, name, position: nextPosition++ },
        });
        sectionIds.set(name, created.id);
        createdSections++;
      }

      // ── Find-or-create the project's default workflow ─────────
      let workflow = await tx.workflow.findFirst({
        where: { projectId },
        orderBy: { createdAt: "asc" },
      });
      if (!workflow) {
        workflow = await tx.workflow.create({
          data: {
            name: "Default workflow",
            projectId,
            isActive: true,
          },
        });
      }

      // ── Translate each TemplateTriggerSpec → WorkflowTrigger ──
      function resolveTrigger(
        spec: TemplateTriggerSpec
      ): WorkflowTrigger | null {
        if (spec.type === "TASK_COMPLETED") return { type: "TASK_COMPLETED" };
        const id = sectionIds.get(spec.sectionName);
        if (!id) return null;
        return { type: "TASK_MOVED_TO_SECTION", sectionId: id };
      }

      // ── Create one WorkflowRule per template rule ─────────────
      let createdRules = 0;
      const skipped: string[] = [];
      for (const ruleSpec of template.rules) {
        const trigger = resolveTrigger(ruleSpec.trigger);
        if (!trigger) {
          skipped.push(
            ruleSpec.trigger.type === "TASK_MOVED_TO_SECTION"
              ? ruleSpec.trigger.sectionName
              : ruleSpec.trigger.type
          );
          continue;
        }
        await tx.workflowRule.create({
          data: {
            workflowId: workflow.id,
            trigger: JSON.parse(JSON.stringify(trigger)),
            actions: JSON.parse(JSON.stringify(ruleSpec.actions)),
          },
        });
        createdRules++;
      }

      return { createdSections, createdRules, skipped, workflowId: workflow.id };
    });

    return NextResponse.json(
      {
        templateId: template.id,
        templateName: template.name,
        ...result,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[workflow templates POST] error:", err);
    return NextResponse.json(
      { error: "Failed to apply template" },
      { status: 500 }
    );
  }
}
