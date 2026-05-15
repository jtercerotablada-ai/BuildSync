import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const createPortfolioSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  privacy: z.enum(["PRIVATE", "WORKSPACE", "PUBLIC"]).optional(),
});

// GET /api/portfolios - List all portfolios
export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's workspace
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (!workspaceMember) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    // ── Privacy gate (Asana parity) ──────────────────────────
    // A user sees a portfolio only when they own it, are an
    // explicit member, or it's marked PUBLIC. PRIVATE and the
    // default WORKSPACE visibility no longer auto-grant access —
    // sharing requires explicit membership.
    const portfolios = await prisma.portfolio.findMany({
      where: {
        workspaceId: workspaceMember.workspaceId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
          { privacy: "PUBLIC" },
        ],
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
        projects: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                color: true,
                status: true,
                type: true,
                gate: true,
                budget: true,
                currency: true,
                tasks: {
                  select: { id: true, completed: true, dueDate: true },
                },
              },
            },
          },
        },
        _count: {
          select: {
            projects: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Compute aggregate stats per portfolio so the list page can render
    // budget totals, health distribution, and overall progress without
    // making N follow-up requests.
    const withStats = portfolios.map((p) => {
      let totalBudget = 0;
      let totalTasks = 0;
      let completedTasks = 0;
      let overdueTasks = 0;
      let atRiskCount = 0;
      let offTrackCount = 0;
      let onTrackCount = 0;
      let onHoldCount = 0;
      let completeCount = 0;
      const now = Date.now();
      let currency: string | null = null;

      for (const pp of p.projects) {
        const proj = pp.project;
        if (proj.budget) {
          totalBudget += Number(proj.budget);
          if (!currency && proj.currency) currency = proj.currency;
        }
        for (const t of proj.tasks) {
          totalTasks += 1;
          if (t.completed) completedTasks += 1;
          else if (t.dueDate && new Date(t.dueDate).getTime() < now) {
            overdueTasks += 1;
          }
        }
        switch (proj.status) {
          case "AT_RISK":
            atRiskCount += 1;
            break;
          case "OFF_TRACK":
            offTrackCount += 1;
            break;
          case "ON_HOLD":
            onHoldCount += 1;
            break;
          case "COMPLETE":
            completeCount += 1;
            break;
          default:
            onTrackCount += 1;
        }
      }

      const avgProgress =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Strip raw tasks from response — the list page only needs the rollup.
      const projectsLight = p.projects.map((pp) => ({
        id: pp.id,
        position: pp.position,
        project: {
          id: pp.project.id,
          name: pp.project.name,
          color: pp.project.color,
          status: pp.project.status,
          type: pp.project.type,
          gate: pp.project.gate,
        },
      }));

      return {
        ...p,
        projects: projectsLight,
        stats: {
          totalBudget,
          currency: currency || "USD",
          totalTasks,
          completedTasks,
          overdueTasks,
          avgProgress,
          health: {
            onTrack: onTrackCount,
            atRisk: atRiskCount,
            offTrack: offTrackCount,
            onHold: onHoldCount,
            complete: completeCount,
          },
        },
      };
    });

    return NextResponse.json(withStats);
  } catch (error) {
    console.error("Error fetching portfolios:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolios" },
      { status: 500 }
    );
  }
}

// POST /api/portfolios - Create a portfolio
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createPortfolioSchema.parse(body);

    // Get user's workspace
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (!workspaceMember) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const portfolio = await prisma.portfolio.create({
      data: {
        name: data.name,
        description: data.description,
        color: data.color || "#a8893a",
        privacy: data.privacy || "WORKSPACE",
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
        _count: {
          select: {
            projects: true,
          },
        },
      },
    });

    return NextResponse.json(portfolio, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error creating portfolio:", error);
    return NextResponse.json(
      { error: "Failed to create portfolio" },
      { status: 500 }
    );
  }
}
