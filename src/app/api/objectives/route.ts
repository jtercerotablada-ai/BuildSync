import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  getUserWorkspaceId,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";

const keyResultSeedSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  targetValue: z.number(),
  startValue: z.number().optional(),
  currentValue: z.number().optional(),
  unit: z.string().optional(),
  format: z.enum(["NUMBER", "PERCENTAGE", "CURRENCY", "BOOLEAN"]).optional(),
});

const createObjectiveSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  period: z.string().optional(),
  parentId: z.string().optional(),
  teamId: z.string().optional(),
  ownerId: z.string().optional(),
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
    const workspaceId = await getUserWorkspaceId(userId);

    // ── Privacy gate (Asana parity) ──────────────────────────
    // A user sees an objective when:
    //   - they own it (created it), OR
    //   - they're an explicit member (ObjectiveMember row), OR
    //   - they're a member of the team assigned to it
    //
    // Workspace membership alone doesn't auto-grant access.
    const where: Record<string, unknown> = {
      workspaceId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
        { team: { members: { some: { userId } } } },
      ],
    };

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
      orderBy: { createdAt: "desc" },
      ...(take ? { take } : {}),
    });

    // Calculate progress for each objective
    const objectivesWithProgress = objectives.map((obj) => {
      let calculatedProgress = obj.progress;

      if (obj.progressSource === "KEY_RESULTS" && obj.keyResults.length > 0) {
        const krProgress = obj.keyResults.map((kr) => {
          const range = kr.targetValue - kr.startValue;
          if (range === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
          return Math.min(100, Math.max(0, ((kr.currentValue - kr.startValue) / range) * 100));
        });
        calculatedProgress = Math.round(krProgress.reduce((a, b) => a + b, 0) / krProgress.length);
      } else if (obj.progressSource === "SUB_OBJECTIVES" && obj.children.length > 0) {
        calculatedProgress = Math.round(
          obj.children.reduce((sum, c) => sum + c.progress, 0) / obj.children.length
        );
      }

      return {
        ...obj,
        progress: calculatedProgress,
      };
    });

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

    const workspaceId = await getUserWorkspaceId(userId);

    // Verify parentId belongs to user's workspace
    if (data.parentId) {
      const parent = await prisma.objective.findUnique({
        where: { id: data.parentId },
        select: { workspaceId: true },
      });
      if (!parent || parent.workspaceId !== workspaceId) {
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

    // Verify ownerId belongs to user's workspace
    let resolvedOwnerId = userId;
    if (data.ownerId && data.ownerId !== userId) {
      const ownerMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: data.ownerId,
          workspaceId,
        },
        select: { userId: true },
      });
      if (!ownerMember) {
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
        progressSource: data.progressSource || "MANUAL",
        workspaceId,
        ownerId: resolvedOwnerId,
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
