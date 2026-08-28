import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { GoalProgressService } from "@/lib/goal-progress";
import { getCurrentUserId } from "@/lib/auth-utils";
import { AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";
import {
  resolveObjectiveAccess,
  verifyObjectiveAccess,
} from "@/lib/objective-access";

const updateObjectiveSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK", "ACHIEVED", "PARTIAL", "MISSED", "DROPPED"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  progressSource: z.enum(["MANUAL", "KEY_RESULTS", "SUB_OBJECTIVES", "PROJECTS"]).optional(),
  period: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  teamId: z.string().optional().nullable(),
  // Editable parent so the user can re-parent an objective from the
  // detail page ("Connect a parent objective"). Passing null detaches.
  parentId: z.string().optional().nullable(),
  // Owner-rated 1-10 confidence the goal will land. Editable from the
  // confidence ring on the detail page; the check-in endpoint also
  // updates this, but allowing direct PATCH lets the ring save without
  // forcing a full check-in.
  confidenceScore: z.number().int().min(1).max(10).optional().nullable(),
});

// GET /api/objectives/:objectiveId - Get objective details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { objectiveId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read gate first, so the page-sized include below is only ever paid for
    // by a caller who is allowed to see the goal.
    const access = await verifyObjectiveAccess(userId, objectiveId);

    const objective = await prisma.objective.findUnique({
      where: { id: objectiveId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        children: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            keyResults: true,
          },
        },
        keyResults: {
          include: {
            updates: {
              orderBy: { createdAt: "desc" },
              take: 5,
            },
          },
        },
        projects: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                color: true,
                status: true,
              },
            },
          },
        },
        statusUpdates: {
          orderBy: { createdAt: "desc" },
          take: 10,
          // Without the author the activity feed has nothing to attribute a
          // row to and falls back to the goal owner, so every comment reads as
          // if the owner wrote it.
          include: {
            author: { select: { id: true, name: true, image: true } },
          },
        },
        _count: {
          select: {
            keyResults: true,
            children: true,
            projects: true,
            likes: true,
            // The feed above is capped for rendering; the delete confirmation
            // needs the real total the cascade will take.
            statusUpdates: true,
          },
        },
      },
    });

    if (!objective) {
      return NextResponse.json({ error: "Objective not found" }, { status: 404 });
    }

    // ── Privacy gate (Asana parity) ──────────────────────────
    // Visible to: owner, explicit ObjectiveMember, or team member of
    // the objective's team. Workspace membership alone doesn't
    // auto-grant access. 404 masks existence from id-pokers. This stays ON TOP
    // of the shared gate above, which admits any workspace contributor to an
    // ordinary goal — a wider rule than this page has ever used.
    let isTeamMember = false;
    if (objective.teamId) {
      const teamMembership = await prisma.teamMember.findUnique({
        where: { userId_teamId: { userId, teamId: objective.teamId } },
        select: { id: true },
      });
      isTeamMember = !!teamMembership;
    }
    if (!access.isOwner && !access.isMember && !isTeamMember) {
      return NextResponse.json({ error: "Objective not found" }, { status: 404 });
    }

    // Determine if current user liked this objective
    const myLike = await prisma.objectiveLike.findUnique({
      where: { objectiveId_userId: { objectiveId, userId } },
      select: { id: true },
    });

    // Comments and check-ins share one table, so the include's cap above is
    // spent on whichever rows are newest — a busy review week of comments
    // would push the goal's whole status history out of the feed. Give the
    // check-ins their own cap and merge, so both are always represented.
    const recentCheckIns = await prisma.objectiveStatusUpdate.findMany({
      where: { objectiveId, status: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });
    const feedById = new Map(
      [...objective.statusUpdates, ...recentCheckIns].map((u) => [u.id, u])
    );
    const statusUpdates = [...feedById.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    // Calculate progress based on source
    let calculatedProgress = objective.progress;

    if (objective.progressSource === "KEY_RESULTS" && objective.keyResults.length > 0) {
      const krProgress = objective.keyResults.map((kr) => {
        const range = kr.targetValue - kr.startValue;
        if (range === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
        return Math.min(100, Math.max(0, ((kr.currentValue - kr.startValue) / range) * 100));
      });
      calculatedProgress = Math.round(krProgress.reduce((a, b) => a + b, 0) / krProgress.length);
    } else if (objective.progressSource === "SUB_OBJECTIVES" && objective.children.length > 0) {
      calculatedProgress = Math.round(
        objective.children.reduce((sum, c) => sum + c.progress, 0) / objective.children.length
      );
    }

    return NextResponse.json({
      ...objective,
      statusUpdates,
      progress: calculatedProgress,
      likedByMe: !!myLike,
    });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching objective:", error);
    return NextResponse.json(
      { error: "Failed to fetch objective" },
      { status: 500 }
    );
  }
}

// PATCH /api/objectives/:objectiveId - Update objective
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { objectiveId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Write gate: 404 while the goal is unknown or hidden from this caller,
    // 403 once they can open it but may not change it.
    const access = await verifyObjectiveAccess(userId, objectiveId, {
      requireWrite: true,
    });
    const existingObj = access.objective;

    // ── Edit gate ────────────────────────────────────────────
    // Edit allowed for: owner, ObjectiveMember with role EDITOR,
    // or team member of the objective's team. VIEWER role members
    // and non-members get 403. Narrower than the gate above, which grants
    // write on an ordinary goal to any workspace contributor and does not
    // read ObjectiveMemberRole at all — so it stays.
    const isOwner = existingObj.ownerId === userId;
    const editorMembership = await prisma.objectiveMember.findUnique({
      where: { objectiveId_userId: { objectiveId, userId } },
      select: { role: true },
    });
    const isEditorMember = editorMembership?.role === "EDITOR";
    let isTeamMember = false;
    if (existingObj.teamId) {
      const teamMembership = await prisma.teamMember.findUnique({
        where: { userId_teamId: { userId, teamId: existingObj.teamId } },
        select: { id: true },
      });
      isTeamMember = !!teamMembership;
    }
    if (!isOwner && !isEditorMember && !isTeamMember) {
      return NextResponse.json(
        { error: "Only the objective owner or an editor can edit" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const data = updateObjectiveSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    // The parent the goal is LEAVING. Read below, and only when this request
    // re-parents: the update response can report the new parent but never the
    // old one, and the old one still has to be recomputed without this child.
    let previousParentId: string | null = null;

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.progress !== undefined) updateData.progress = data.progress;
    if (data.progressSource !== undefined) updateData.progressSource = data.progressSource;
    if (data.period !== undefined) updateData.period = data.period;
    if (data.teamId !== undefined) updateData.teamId = data.teamId;
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    }
    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    }
    if (data.confidenceScore !== undefined) {
      updateData.confidenceScore = data.confidenceScore;
    }
    if (data.parentId !== undefined) {
      // Guard against self-parenting (would create an immediate cycle)
      // and reject cross-workspace parents.
      if (data.parentId === objectiveId) {
        return NextResponse.json(
          { error: "An objective cannot be its own parent" },
          { status: 400 }
        );
      }
      if (data.parentId) {
        // The parent has to be a goal this caller can open, not merely one in
        // the same workspace: parenting under a PRIVATE goal surfaces its name
        // and roll-up in every tree walked up from this one.
        const parentAccess = await resolveObjectiveAccess(data.parentId, userId);
        if (
          !parentAccess.ok ||
          parentAccess.objective.workspaceId !== existingObj.workspaceId
        ) {
          return NextResponse.json(
            { error: "Parent objective not found in this workspace" },
            { status: 404 }
          );
        }
        // Self-parenting was the only cycle blocked, so A→B plus B→A was
        // accepted: both goals then had a parent, so the tree (which lists
        // roots as parentId: null) showed NEITHER, and every walk of the
        // chain looped. Climb the proposed parent's ancestors and refuse if
        // this objective is among them. The hop cap keeps a cycle that
        // already exists in the data from spinning here.
        let cursor: string | null = data.parentId;
        for (let hops = 0; cursor && hops < 50; hops++) {
          if (cursor === objectiveId) {
            return NextResponse.json(
              {
                error:
                  "That would make the two goals each other's parent. Pick a goal that isn't below this one.",
              },
              { status: 400 }
            );
          }
          const next: { parentId: string | null } | null =
            await prisma.objective.findUnique({
              where: { id: cursor },
              select: { parentId: true },
            });
          cursor = next?.parentId ?? null;
        }
      }
      const current = await prisma.objective.findUnique({
        where: { id: objectiveId },
        select: { parentId: true },
      });
      previousParentId = current?.parentId ?? null;
      updateData.parentId = data.parentId;
    }

    const objective = await prisma.objective.update({
      where: { id: objectiveId },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        keyResults: true,
        _count: {
          select: {
            keyResults: true,
            children: true,
          },
        },
      },
    });

    // Roll the change up the ancestor chain. The library knew how to do this
    // all along; the route simply never called it, so moving a child's number
    // left every parent showing a stale roll-up until something else happened
    // to recompute it. Re-parenting also has to refresh the workspace the goal
    // LEFT, or the old parent keeps counting a child it no longer has.
    if (
      data.progress !== undefined ||
      data.progressSource !== undefined ||
      data.parentId !== undefined
    ) {
      try {
        await GoalProgressService.recalculateProgress(objectiveId);
        if (
          data.parentId !== undefined &&
          previousParentId &&
          previousParentId !== data.parentId
        ) {
          await GoalProgressService.recalculateProgress(previousParentId);
        }
      } catch (err) {
        // A roll-up failure must not fail the edit the user just made.
        console.error("[objective PATCH] progress roll-up failed:", err);
      }
    }

    return NextResponse.json(objective);
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
    console.error("Error updating objective:", error);
    return NextResponse.json(
      { error: "Failed to update objective" },
      { status: 500 }
    );
  }
}

// DELETE /api/objectives/:objectiveId - Delete objective
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { objectiveId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Write gate: 404 while the goal is unknown or hidden from this caller,
    // 403 once they can open it but may not change it.
    const { objective: obj } = await verifyObjectiveAccess(userId, objectiveId, {
      requireWrite: true,
    });

    // Only the objective owner can delete it. Team members can
    // edit but not destroy.
    if (obj.ownerId !== userId) {
      return NextResponse.json(
        { error: "Only the objective owner can delete it" },
        { status: 403 }
      );
    }

    await prisma.objective.delete({
      where: { id: objectiveId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error deleting objective:", error);
    return NextResponse.json(
      { error: "Failed to delete objective" },
      { status: 500 }
    );
  }
}
