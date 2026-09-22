import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getProjectAccess } from "@/lib/project-access";
import { resolveObjectiveAccess } from "@/lib/objective-access";
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
    // Canonical read rule (matches the page). An unreadable project answers
    // 404 like a missing one, so ids cannot be probed.
    const access = await getProjectAccess(projectId, userId);
    if (!access.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Access to the PROJECT does not imply access to every goal pointed at it.
    // A private objective linked here would otherwise show its name, owner and
    // progress to anyone who can open the project — the objective-access rule
    // (owner, member, or a manager of the goal's own workspace), kept in the
    // WHERE so it cannot be undone by a later slice.
    const privacyArms: Prisma.ObjectiveWhereInput[] = [
      { isPrivate: false },
      { ownerId: userId },
      { members: { some: { userId } } },
    ];
    if (access.isWorkspaceManager && access.workspaceId) {
      privacyArms.push({ workspaceId: access.workspaceId });
    }
    const joins = await prisma.objectiveProject.findMany({
      where: {
        projectId,
        objective: { OR: privacyArms },
      },
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
      // The objective must be in the project's workspace AND readable by the
      // caller under the canonical goal rule — same-workspace alone would let
      // an editor link (and thereby expose) a private goal they cannot see.
      // (The previous inline check also refused every non-private goal the
      // caller did not own.)
      const goalAccess = await resolveObjectiveAccess(objectiveId, userId);
      if (
        !goalAccess.ok ||
        goalAccess.objective.workspaceId !== project.workspaceId
      ) {
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
