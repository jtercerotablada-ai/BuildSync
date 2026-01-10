import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const createObjectiveSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  period: z.string().optional(),
  parentId: z.string().optional(),
  teamId: z.string().optional(),
  progressSource: z.enum(["MANUAL", "KEY_RESULTS", "SUB_OBJECTIVES", "PROJECTS"]).optional(),
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

    // Get user's workspace
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (!workspaceMember) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const where: Record<string, unknown> = {
      workspaceId: workspaceMember.workspaceId,
    };

    if (period) where.period = period;
    if (teamId) where.teamId = teamId;
    if (ownerId) where.ownerId = ownerId === "me" ? userId : ownerId;
    if (parentId === "null") {
      where.parentId = null;
    } else if (parentId) {
      where.parentId = parentId;
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

    // Get user's workspace
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (!workspaceMember) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const objective = await prisma.objective.create({
      data: {
        name: data.name,
        description: data.description,
        period: data.period,
        parentId: data.parentId,
        teamId: data.teamId,
        progressSource: data.progressSource || "MANUAL",
        workspaceId: workspaceMember.workspaceId,
        ownerId: userId,
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

    console.error("Error creating objective:", error);
    return NextResponse.json(
      { error: "Failed to create objective" },
      { status: 500 }
    );
  }
}
