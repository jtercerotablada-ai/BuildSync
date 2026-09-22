import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { GoalProgressService, objectiveReadClause } from "@/lib/goal-progress";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
  contributorSeatSatisfied,
} from "@/lib/auth-guards";
import { buildProjectVisibilityClauses } from "@/lib/project-visibility";
import {
  resolveObjectiveAccess,
  verifyObjectiveAccess,
} from "@/lib/objective-access";

/** A date field as the detail page sends it (an ISO string), or null to
 *  clear. Checked here because `new Date("31/12/2026")` is an Invalid Date
 *  that Prisma rejects deep in the update, which surfaced as a bare 500. */
const optionalDateString = z
  .string()
  .refine((s) => !Number.isNaN(new Date(s).getTime()), {
    message: "Invalid date",
  })
  .optional()
  .nullable();

const updateObjectiveSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK", "ACHIEVED", "PARTIAL", "MISSED", "DROPPED"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  progressSource: z.enum(["MANUAL", "KEY_RESULTS", "SUB_OBJECTIVES", "PROJECTS"]).optional(),
  period: z.string().optional().nullable(),
  startDate: optionalDateString,
  endDate: optionalDateString,
  teamId: z.string().optional().nullable(),
  // Hand-over and privacy. Both are restricted below to the goal's owner and
  // the workspace OWNER/ADMIN; without them a goal could never be reassigned
  // or opened up, and an ownerless goal (owner deleted → SetNull) could not
  // be given a new owner at all.
  ownerId: z.string().min(1).optional(),
  isPrivate: z.boolean().optional(),
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

    // Linked projects are shown by name and status, so only the ones this
    // reader may open are included; the goal's roll-up still counts them all.
    const projectClauses = (await buildProjectVisibilityClauses(userId)) ?? [];

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
        // A private sub-goal stays hidden from readers of its parent who may
        // not open it; its name, owner and key results used to ride along.
        children: {
          where: objectiveReadClause(userId, access.objective.workspaceId, {
            isWorkspaceManager: access.isWorkspaceManager,
          }),
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
          where: { project: { OR: projectClauses } },
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

    // No second, narrower gate here. The page used to demand owner, member or
    // team membership on top of the shared gate, while every sub-route
    // (check-in, key results, comments, Coach) admitted the wider set — so the
    // firm owner could write to a colleague's goal through the API but not
    // open its page, and a goal created for a colleague 404'd for its creator
    // right after the redirect. One rule now: decideObjectiveAccess.

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

    // Same read rule as the children above: a public sub-goal of a PRIVATE
    // parent must not reveal that parent's name to a reader who cannot open it.
    const parent =
      objective.parent &&
      (await prisma.objective.findFirst({
        where: {
          id: objective.parent.id,
          ...objectiveReadClause(userId, access.objective.workspaceId, {
            isWorkspaceManager: access.isWorkspaceManager,
          }),
        },
        select: { id: true },
      }))
        ? objective.parent
        : null;

    // Live, from every child and linked project — not only the ones included
    // above for display — so each reader sees the goal's one true number.
    const live = await GoalProgressService.liveProgress([objective]);

    return NextResponse.json({
      ...objective,
      parent,
      statusUpdates,
      progress: live.get(objective.id) ?? objective.progress,
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
    const isOwner = access.isOwner;

    // ── Edit gate ────────────────────────────────────────────
    // Whoever may write the goal's key results, check-ins and links (the
    // shared gate above) may also edit its fields. The Read-only (VIEWER)
    // narrowing on a private goal is applied by verifyObjectiveAccess itself;
    // on a public goal a VIEWER row narrows nothing (see objective-access.ts).

    const body = await req.json();
    const data = updateObjectiveSchema.parse(body);

    // Hand-over and privacy decide who else can see the goal, so they belong
    // to the owner and to the workspace OWNER/ADMIN (the only way to recover a
    // goal whose owner left), not to every editor.
    if (
      (data.ownerId !== undefined || data.isPrivate !== undefined) &&
      !isOwner &&
      !access.isWorkspaceManager
    ) {
      return NextResponse.json(
        { error: "Only the goal owner or a workspace admin can change its owner or privacy" },
        { status: 403 }
      );
    }
    if (data.ownerId !== undefined && data.ownerId !== existingObj.ownerId) {
      const ownerMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: data.ownerId,
            workspaceId: existingObj.workspaceId,
          },
        },
        select: { role: true },
      });
      if (!ownerMember || !contributorSeatSatisfied(ownerMember.role)) {
        return NextResponse.json(
          { error: "Owner not found in workspace" },
          { status: 404 }
        );
      }
    }
    // Same check POST makes. An unchecked id was a foreign-key 500 when it did
    // not exist, and was stored as-is when it named another workspace's team.
    if (data.teamId) {
      const team = await prisma.team.findUnique({
        where: { id: data.teamId },
        select: { workspaceId: true },
      });
      if (!team || team.workspaceId !== existingObj.workspaceId) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }
    }

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
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;
    if (data.isPrivate !== undefined) updateData.isPrivate = data.isPrivate;
    // An owner handing the goal to someone else keeps working on it as an
    // editor; otherwise handing over a private goal locks them out of it.
    const keepPreviousOwner =
      data.ownerId !== undefined && data.ownerId !== userId && isOwner;
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

    const [objective] = await prisma.$transaction([
      prisma.objective.update({
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
      }),
      ...(keepPreviousOwner
        ? [
            prisma.objectiveMember.upsert({
              where: { objectiveId_userId: { objectiveId, userId } },
              create: { objectiveId, userId, role: "EDITOR" },
              update: { role: "EDITOR" },
            }),
          ]
        : []),
    ]);

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
    const access = await verifyObjectiveAccess(userId, objectiveId, {
      requireWrite: true,
    });

    // Only the objective owner can delete it — or the workspace OWNER/ADMIN,
    // without whom a goal whose owner left the firm could never be removed.
    // Editors can edit but not destroy.
    if (!access.isOwner && !access.isWorkspaceManager) {
      return NextResponse.json(
        { error: "Only the goal owner or a workspace admin can delete it" },
        { status: 403 }
      );
    }

    const current = await prisma.objective.findUnique({
      where: { id: objectiveId },
      select: { parentId: true },
    });

    // Sub-goals cascade with their parent (schema: onDelete Cascade), and a
    // colleague may have parented their own goal here — possibly a private
    // one this caller cannot even see. Walk the subtree: goals the caller owns
    // go with the deletion, anyone else's is detached first and survives as a
    // top-level goal, with its key results and history intact. The hop cap
    // keeps a cycle already in the data from spinning here.
    const detach: string[] = [];
    const seen = new Set<string>([objectiveId]);
    let frontier = [objectiveId];
    for (let depth = 0; frontier.length > 0 && depth < 20; depth++) {
      const kids = await prisma.objective.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true, ownerId: true },
      });
      frontier = [];
      for (const kid of kids) {
        if (seen.has(kid.id)) continue;
        seen.add(kid.id);
        if (kid.ownerId === userId) frontier.push(kid.id);
        else detach.push(kid.id);
      }
    }

    await prisma.$transaction([
      prisma.objective.updateMany({
        where: { id: { in: detach } },
        data: { parentId: null },
      }),
      prisma.objective.delete({
        where: { id: objectiveId },
      }),
    ]);

    // The parent loses a child, so its sub-goal average changes.
    if (current?.parentId) {
      try {
        await GoalProgressService.recalculateProgress(current.parentId);
      } catch (err) {
        console.error("[objective DELETE] parent roll-up failed:", err);
      }
    }

    return NextResponse.json({ success: true, detachedSubGoals: detach.length });
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
