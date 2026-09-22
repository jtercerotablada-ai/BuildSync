import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  getPrimaryWorkspaceMembership,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
  contributorSeatSatisfied,
} from "@/lib/auth-guards";
import { resolveObjectiveAccess } from "@/lib/objective-access";
import { GoalProgressService, objectiveReadClause } from "@/lib/goal-progress";

const keyResultSeedSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    targetValue: z.number(),
    startValue: z.number().optional(),
    currentValue: z.number().optional(),
    unit: z.string().optional(),
    format: z.enum(["NUMBER", "PERCENTAGE", "CURRENCY", "BOOLEAN"]).optional(),
  })
  // Same zero-range guard as POST /key-results: a seed whose target equals its
  // start has nothing to measure and reads as 100% the moment it is created.
  // The message names the key result because Duplicate posts a whole list,
  // and a goal saved before this guard can carry one such row.
  .superRefine((d, ctx) => {
    if (d.targetValue === (d.startValue ?? 0)) {
      ctx.addIssue({
        code: "custom",
        message: `Key result "${d.name}": target must differ from the start value`,
        path: ["targetValue"],
      });
    }
  });

const createObjectiveSchema = z.object({
  name: z.string().min(1),
  // Nullable because Duplicate re-posts a goal as it was loaded, and a goal
  // created without a description or period stores null for both.
  description: z.string().nullable().optional(),
  period: z.string().nullable().optional(),
  parentId: z.string().optional(),
  teamId: z.string().optional(),
  ownerId: z.string().optional(),
  // The New goal dialog's privacy picker. Without a key here Zod strips it
  // and every goal is stored public, which is how the flag stayed unreadable
  // for as long as it has: the column the gate reads was never written.
  isPrivate: z.boolean().optional(),
  progressSource: z.enum(["MANUAL", "KEY_RESULTS", "SUB_OBJECTIVES", "PROJECTS"]).optional(),
  // Optional. When present, the objective is created together with these
  // KRs in a single transaction — used by the engineering goal templates.
  keyResults: z.array(keyResultSeedSchema).optional(),
});

// GET /api/objectives - List all objectives
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period");
    const teamId = searchParams.get("teamId");
    const ownerId = searchParams.get("ownerId");
    const parentId = searchParams.get("parentId");
    // Optional cap for widget consumers (Home goals widget sends ?limit=4).
    // Absent = unchanged (no take).
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : null;
    const take = limit && limit > 0 ? Math.min(limit, 100) : undefined;
    // Optional: openOnly=1 excludes closed goals server-side so `take`
    // counts against open goals only. Absent = unchanged.
    const openOnly = searchParams.get("openOnly") === "1";

    // The user's real workspace. A bare findFirst can return the personal
    // singleton workspace instead of the firm they were invited to (SEC-06),
    // making goals list from / land in the wrong workspace.
    const membership = await getPrimaryWorkspaceMembership(userId);
    if (!membership) {
      throw new AuthorizationError("No workspace found");
    }
    const workspaceId = membership.workspaceId;
    // GUEST/CLIENT seats have no goals surface; the detail gate refuses them
    // every goal, so the list must not name any either.
    if (!contributorSeatSatisfied(membership.role)) {
      return NextResponse.json([]);
    }
    const isWorkspaceManager =
      membership.role === "OWNER" || membership.role === "ADMIN";

    // The same rule the goal page and every goal sub-route apply
    // (decideObjectiveAccess): a non-private goal is visible to every
    // contributor of the workspace, a private one to its owner, its members
    // and the workspace OWNER/ADMIN. The list used to be narrower (owner,
    // member or team only), so a goal created for a colleague vanished from
    // its creator's list, and the firm owner could not find goals he could
    // still check in on. The rule lives in the WHERE, never in a filter over
    // the result, because `take` (the Home widget sends ?limit=4) is applied
    // by the database.
    const readClause = objectiveReadClause(userId, workspaceId, {
      isWorkspaceManager,
    });
    const where: Record<string, unknown> = { ...readClause };

    if (period) where.period = period;
    if (teamId) where.teamId = teamId;
    if (ownerId) where.ownerId = ownerId === "me" ? userId : ownerId;
    if (parentId === "null") {
      where.parentId = null;
    } else if (parentId) {
      where.parentId = parentId;
    }
    if (openOnly) {
      where.status = { notIn: ["ACHIEVED", "MISSED", "DROPPED"] };
    }

    const objectives = await prisma.objective.findMany({
      where,
      include: {
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
        keyResults: true,
        // Only the sub-goals this reader may see: a private child must not be
        // disclosed through its parent. The roll-up below still averages
        // every child, server-side.
        children: {
          where: readClause,
          select: {
            id: true,
            name: true,
            status: true,
            progress: true,
          },
        },
        _count: {
          select: {
            keyResults: true,
            children: true,
            projects: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      ...(take ? { take } : {}),
    });

    const live = await GoalProgressService.liveProgress(objectives);
    const objectivesWithProgress = objectives.map((obj) => ({
      ...obj,
      progress: live.get(obj.id) ?? obj.progress,
    }));

    return NextResponse.json(objectivesWithProgress);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching objectives:", error);
    return NextResponse.json(
      { error: "Failed to fetch objectives" },
      { status: 500 }
    );
  }
}

// POST /api/objectives - Create an objective
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createObjectiveSchema.parse(body);

    const membership = await getPrimaryWorkspaceMembership(userId);
    if (!membership) {
      throw new AuthorizationError("No workspace found");
    }
    // Every goal route refuses GUEST/CLIENT seats; creating one must too.
    if (!contributorSeatSatisfied(membership.role)) {
      throw new AuthorizationError("Your role is view-only and can't create goals");
    }
    const workspaceId = membership.workspaceId;

    // Verify parentId is a goal this caller may actually open, and that it
    // belongs to the workspace the new goal is being created in. Checking the
    // workspace alone let anyone parent a new goal under a PRIVATE one, which
    // surfaces that goal's name and roll-up in every tree walked from the
    // child.
    if (data.parentId) {
      const parentAccess = await resolveObjectiveAccess(data.parentId, userId);
      if (!parentAccess.ok || parentAccess.objective.workspaceId !== workspaceId) {
        return NextResponse.json({ error: "Parent objective not found" }, { status: 404 });
      }
    }

    // Verify teamId belongs to user's workspace
    if (data.teamId) {
      const team = await prisma.team.findUnique({
        where: { id: data.teamId },
        select: { workspaceId: true },
      });
      if (!team || team.workspaceId !== workspaceId) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }
    }

    // Verify ownerId is a contributor of the user's workspace (a GUEST owner
    // would be refused their own goal by the shared gate).
    let resolvedOwnerId = userId;
    if (data.ownerId && data.ownerId !== userId) {
      const ownerMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId: data.ownerId, workspaceId },
        },
        select: { role: true },
      });
      if (!ownerMember || !contributorSeatSatisfied(ownerMember.role)) {
        return NextResponse.json({ error: "Owner not found in workspace" }, { status: 404 });
      }
      resolvedOwnerId = data.ownerId;
    }

    const objective = await prisma.objective.create({
      data: {
        name: data.name,
        description: data.description,
        period: data.period,
        parentId: data.parentId,
        teamId: data.teamId,
        isPrivate: data.isPrivate ?? false,
        progressSource: data.progressSource || "MANUAL",
        workspaceId,
        ownerId: resolvedOwnerId,
        // Creating a goal FOR someone else must not lock its creator out: a
        // private goal is readable only by its owner and members, and the
        // dialog redirects the creator straight to the new goal's page.
        ...(resolvedOwnerId !== userId
          ? { members: { create: { userId, role: "EDITOR" as const } } }
          : {}),
        // Template path: seed all KRs in the same transaction so the
        // created objective is immediately useful (progress = 0% across
        // the predefined KRs rather than an empty shell).
        ...(data.keyResults && data.keyResults.length > 0
          ? {
              keyResults: {
                create: data.keyResults.map((kr) => ({
                  name: kr.name,
                  description: kr.description,
                  targetValue: kr.targetValue,
                  startValue: kr.startValue ?? 0,
                  currentValue: kr.currentValue ?? kr.startValue ?? 0,
                  unit: kr.unit,
                  format: kr.format ?? "NUMBER",
                  ownerId: resolvedOwnerId,
                })),
              },
            }
          : {}),
      },
      include: {
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
        keyResults: true,
        // Same shape as the list GET, so a new goal can be dropped straight
        // into the list. Empty for a new goal.
        children: {
          select: {
            id: true,
            name: true,
            status: true,
            progress: true,
          },
        },
        _count: {
          select: {
            keyResults: true,
            children: true,
            projects: true,
          },
        },
      },
    });

    // A new child changes its parent's sub-goal average. Without this the
    // parent's stored roll-up (read by portfolios, the grandparent and the
    // Coach) kept the old number until some unrelated edit.
    if (data.parentId) {
      try {
        await GoalProgressService.recalculateProgress(data.parentId);
      } catch (err) {
        console.error("[objective POST] parent roll-up failed:", err);
      }
    }

    return NextResponse.json(objective, { status: 201 });
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

    console.error("Error creating objective:", error);
    return NextResponse.json(
      { error: "Failed to create objective" },
      { status: 500 }
    );
  }
}
