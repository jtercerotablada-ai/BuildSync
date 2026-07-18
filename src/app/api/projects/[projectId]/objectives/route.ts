import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { resolveProjectAccess } from "@/lib/project-access";
import {
  verifyProjectAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";
import { GoalProgressService } from "@/lib/goal-progress";

// GET /api/projects/:projectId/objectives
//
// Returns the Objectives (goals/OKRs) that have been linked to this
// project via the ObjectiveProject join table. Used by the Overview
// "Connected goals" panel to show progress + status of every linked
// goal at a glance.

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

  // Canonical read rule (matches the page): the old inline check leaked
  // WORKSPACE-visibility projects to any member and 403'd workspace admins.
  const access = await resolveProjectAccess(project, userId);
  if (!access.ok) return { ok: false as const, status: 403 };
  return { ok: true as const, project };
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

    const joins = await prisma.objectiveProject.findMany({
      where: { projectId },
      include: {
        objective: {
          select: {
            id: true,
            name: true,
            progress: true,
            status: true,
            endDate: true,
            period: true,
            owner: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    const goals = joins
      .map((j) => j.objective)
      .filter((o): o is NonNullable<typeof o> => o != null)
      .map((o) => ({
        id: o.id,
        name: o.name,
        progress: Math.max(0, Math.min(100, o.progress)),
        status: o.status,
        endDate: o.endDate ? o.endDate.toISOString() : null,
        period: o.period,
        owner: o.owner,
      }));

    return NextResponse.json(goals);
  } catch (err) {
    console.error("[project objectives GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch connected goals" },
      { status: 500 }
    );
  }
}

// Shape returned to the Overview's Connected-goals panel.
async function connectedGoalShape(objectiveId: string) {
  const o = await prisma.objective.findUnique({
    where: { id: objectiveId },
    select: {
      id: true,
      name: true,
      progress: true,
      status: true,
      endDate: true,
      period: true,
      owner: { select: { id: true, name: true, email: true, image: true } },
    },
  });
  if (!o) return null;
  return {
    id: o.id,
    name: o.name,
    progress: Math.max(0, Math.min(100, o.progress)),
    status: o.status,
    endDate: o.endDate ? o.endDate.toISOString() : null,
    period: o.period,
    owner: o.owner,
  };
}

// Connect an existing goal by id, OR create-and-connect a brand-new one by
// name (the create path stays in the project's workspace — see below).
const connectSchema = z.union([
  z.object({ objectiveId: z.string().min(1) }),
  z.object({ name: z.string().trim().min(1).max(255) }),
]);

/** Can this user SEE this objective? Mirrors the /api/objectives privacy
 *  gate (owner OR explicit member OR team member). Without it, a project
 *  editor could link a private goal they can't see and expose its name /
 *  progress / owner email to every project reader. */
async function canSeeObjective(
  userId: string,
  objective: {
    ownerId: string | null;
    teamId: string | null;
    id: string;
  }
): Promise<boolean> {
  if (objective.ownerId === userId) return true;
  const member = await prisma.objectiveMember.findUnique({
    where: { objectiveId_userId: { objectiveId: objective.id, userId } },
    select: { id: true },
  });
  if (member) return true;
  if (objective.teamId) {
    const tm = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId: objective.teamId } },
      select: { id: true },
    });
    if (tm) return true;
  }
  return false;
}

// POST /api/projects/:projectId/objectives — connect a goal to this project.
// Body is either { objectiveId } (connect existing) or { name } (create +
// connect). Project-write-scoped so a viewer can't wire up goals.
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
    const { project } = await verifyProjectAccess(userId, projectId, {
      requireWrite: true,
    });

    const body = await req.json().catch(() => ({}));
    const data = connectSchema.parse(body);

    let objectiveId: string;
    if ("name" in data) {
      // Create the goal IN THE PROJECT'S WORKSPACE (not the caller's default
      // workspace, which for a multi-workspace user could be a different one
      // — that used to create an orphan goal and then 404 on connect).
      const created = await prisma.objective.create({
        data: {
          name: data.name,
          workspaceId: project.workspaceId,
          ownerId: userId,
          progressSource: "MANUAL",
        },
        select: { id: true },
      });
      objectiveId = created.id;
    } else {
      objectiveId = data.objectiveId;
      // The objective must be in the project's workspace AND visible to the
      // caller — same-workspace alone would let an editor link (and thereby
      // expose) another team's private goal.
      const objective = await prisma.objective.findUnique({
        where: { id: objectiveId },
        select: { id: true, workspaceId: true, ownerId: true, teamId: true },
      });
      if (!objective || objective.workspaceId !== project.workspaceId) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
      if (!(await canSeeObjective(userId, objective))) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
    }

    // Idempotent on the (objectiveId, projectId) unique index.
    await prisma.objectiveProject.createMany({
      data: [{ objectiveId, projectId }],
      skipDuplicates: true,
    });
    await GoalProgressService.recalculateProgress(objectiveId).catch((e) =>
      console.error("[project objectives POST] recalc failed:", e)
    );

    const shape = await connectedGoalShape(objectiveId);
    return NextResponse.json(shape, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[project objectives POST] error:", error);
    return NextResponse.json(
      { error: "Failed to connect goal" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/:projectId/objectives?objectiveId=… — disconnect a goal.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { projectId } = await params;
    await verifyProjectAccess(userId, projectId, { requireWrite: true });

    const objectiveId = new URL(req.url).searchParams.get("objectiveId");
    if (!objectiveId) {
      return NextResponse.json(
        { error: "objectiveId is required" },
        { status: 400 }
      );
    }

    const res = await prisma.objectiveProject.deleteMany({
      where: { objectiveId, projectId },
    });
    if (res.count === 0) {
      return NextResponse.json(
        { error: "Goal not connected" },
        { status: 404 }
      );
    }
    await GoalProgressService.recalculateProgress(objectiveId).catch((e) =>
      console.error("[project objectives DELETE] recalc failed:", e)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[project objectives DELETE] error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect goal" },
      { status: 500 }
    );
  }
}
