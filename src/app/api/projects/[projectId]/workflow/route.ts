import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

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

export async function GET(
  _req: Request,
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
