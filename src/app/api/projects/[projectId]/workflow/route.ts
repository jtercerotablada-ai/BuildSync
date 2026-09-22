import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getProjectAccess, resolveProjectAccess } from "@/lib/project-access";

/**
 * GET /api/projects/:projectId/workflow
 *
 * Returns the project's workflow with all its rules. There's at most
 * one Workflow per project — if none exists yet, this endpoint
 * lazily creates the default one so the front-end never has to deal
 * with "workflow not found" as a state.
 *
 * The rules' `trigger` and `actions` fields are stored as JSON in
 * Prisma; we surface them verbatim so the front-end can decode them
 * against the WorkflowTrigger / WorkflowAction unions in
 * lib/workflow-types.ts.
 */

// Access uses the canonical project rule (getProjectAccess) — the same one
// the page and the sibling dependencies endpoint use. The old inline check
// here handed every workspace member the project's rules on WORKSPACE
// visibility while 403'ing workspace admins on PRIVATE projects.
async function assertProjectAccess(projectId: string, userId: string) {
  const access = await getProjectAccess(projectId, userId);
  if (!access.ok) {
    return { ok: false as const, status: access.status };
  }
  return {
    ok: true as const,
    canWrite: access.canWrite,
    workspaceId: access.workspaceId,
  };
}

/**
 * Projects an "Add to another project" action may target: same workspace, not
 * archived, and WRITABLE by the caller. The rules endpoint refuses a target
 * the author can only read, so a picker fed by the read-only project list
 * offered choices that could only end in a 400. Decided per project with the
 * same resolveProjectAccess rule the save uses, so the two cannot disagree.
 */
const TARGET_CHECK_BATCH = 10;

async function writableTargetProjects(
  projectId: string,
  workspaceId: string,
  userId: string
) {
  const candidates = await prisma.project.findMany({
    where: { workspaceId, isArchived: false, id: { not: projectId } },
    select: {
      id: true,
      name: true,
      color: true,
      ownerId: true,
      visibility: true,
      workspaceId: true,
      teamId: true,
      // Only the caller's own row matters to the decision.
      members: { where: { userId }, select: { userId: true, role: true } },
    },
    orderBy: { name: "asc" },
  });
  // Each decision costs one or two queries. Firing one per project all at
  // once queued hundreds of them on the small serverless pool, so they run a
  // few at a time instead.
  const writable: { id: string; name: string; color: string }[] = [];
  for (let i = 0; i < candidates.length; i += TARGET_CHECK_BATCH) {
    const batch = candidates.slice(i, i + TARGET_CHECK_BATCH);
    const decided = await Promise.all(
      batch.map(async (p) => ({
        p,
        access: await resolveProjectAccess(p, userId),
      }))
    );
    for (const { p, access } of decided) {
      if (access.ok && access.canWrite) {
        writable.push({ id: p.id, name: p.name, color: p.color });
      }
    }
  }
  return writable;
}

export async function GET(
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

    if (new URL(req.url).searchParams.get("targets") === "projects") {
      return NextResponse.json(
        access.workspaceId
          ? await writableTargetProjects(projectId, access.workspaceId, userId)
          : []
      );
    }

    // Find-or-create the workflow. We use findFirst (not unique)
    // because the schema doesn't constrain to one Workflow per
    // project; if multiple ever existed we take the first deterministic
    // result and let the user collapse them in the UI.
    let workflow = await prisma.workflow.findFirst({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: {
        rules: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!workflow) {
      workflow = await prisma.workflow.create({
        data: {
          name: "Default workflow",
          projectId,
          isActive: true,
        },
        include: {
          rules: { orderBy: { createdAt: "asc" } },
        },
      });
    }

    return NextResponse.json({
      id: workflow.id,
      name: workflow.name,
      isActive: workflow.isActive,
      // The builder hides its edit controls for read-only members instead of
      // letting every click end in a 403, and scopes its pickers to this
      // project's workspace.
      canEdit: access.canWrite,
      workspaceId: access.workspaceId,
      rules: workflow.rules.map((r) => ({
        id: r.id,
        trigger: r.trigger,
        actions: r.actions,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[workflow GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch workflow" },
      { status: 500 }
    );
  }
}

const patchWorkflowSchema = z.object({ isActive: z.boolean() });

/**
 * PATCH /api/projects/:projectId/workflow  { isActive: boolean }
 *
 * Pauses or resumes every rule on the project at once. The engine already
 * skips inactive workflows; this is the switch for it. Applied to every
 * workflow row of the project so a stray second row can't keep firing.
 */
export async function PATCH(
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

    const parsed = patchWorkflowSchema.safeParse(
      await req.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { count } = await prisma.workflow.updateMany({
      where: { projectId },
      data: { isActive: parsed.data.isActive },
    });
    if (count === 0) {
      await prisma.workflow.create({
        data: {
          name: "Default workflow",
          projectId,
          isActive: parsed.data.isActive,
        },
      });
    }

    return NextResponse.json({ isActive: parsed.data.isActive });
  } catch (err) {
    console.error("[workflow PATCH] error:", err);
    return NextResponse.json(
      { error: "Failed to update workflow" },
      { status: 500 }
    );
  }
}
