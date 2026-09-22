import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId, getEffectiveAccess } from "@/lib/auth-utils";
import { canAccessSection } from "@/lib/access-control";
import { getProjectAccess } from "@/lib/project-access";
import { isNonContributorRole } from "@/lib/workspace-roles";
import {
  chartConfigSchema,
  invalidFilterReason,
  type ChartConfig,
} from "@/lib/report-config";
import {
  runChartQuery,
  buildMeta,
  buildReportAccessScopes,
  portfolioProjectIds,
  type EngineContext,
} from "@/lib/report-query";

/**
 * POST /api/reports/query — the custom-chart aggregation engine.
 *
 * Auth + access gate mirrors GET /api/reports:
 *   • getCurrentUserId + getEffectiveAccess resolve the caller's workspace.
 *   • Organization-wide scopes (workspace / project) require L3+ reporting
 *     access (canAccessSection(access, "reporting")).
 *   • The personal "my" scope (tasks assigned to / entities owned by the
 *     caller) is ALWAYS allowed — same as the my-impact view.
 *
 * Row visibility is NOT decided by the gate above: whatever the scope, the
 * engine only counts projects, tasks and goals the caller may open
 * (buildReportAccessScopes — the same rule GET /api/reports applies).
 *
 * Body = ChartConfig (validated by chartConfigSchema).
 * Returns { data, seriesKeys, total, meta } per the query contract.
 */
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await getEffectiveAccess(userId);
    if (!access) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = chartConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid chart config" },
        { status: 400 }
      );
    }
    const config = parsed.data as ChartConfig;
    // An operator the engine does not implement for a field used to be
    // reinterpreted silently; refuse it so the chart says so instead.
    const filterProblem = invalidFilterReason(config.entity, config.filters);
    if (filterProblem) {
      return NextResponse.json({ error: filterProblem }, { status: 400 });
    }

    // ── Portfolio scope: its OWN view-gate replaces the reporting gate. ──
    // A portfolio's Panel is a shared dashboard: any viewer of the portfolio
    // (owner | member | workspace OWNER/ADMIN | PUBLIC | WORKSPACE for a
    // contributor) must be able to see its charts, even without L3
    // reporting access. We resolve the portfolio's project ids ONCE here,
    // after the view-check passes, and thread them onto EngineContext so the
    // sub-queries stay pure.
    let portfolioIds: string[] | undefined;
    if (config.scope.kind === "portfolio") {
      const portfolio = await prisma.portfolio.findUnique({
        where: { id: config.scope.portfolioId },
        select: {
          workspaceId: true,
          ownerId: true,
          privacy: true,
          members: { select: { userId: true } },
        },
      });
      // Mask a missing / cross-workspace portfolio as 404.
      if (!portfolio || portfolio.workspaceId !== access.workspaceId) {
        return NextResponse.json(
          { error: "Portfolio not found" },
          { status: 404 }
        );
      }
      // SAME view gate as GET /api/portfolios/[portfolioId]: owner, explicit
      // member, workspace OWNER/ADMIN, PUBLIC, or WORKSPACE for any
      // contributor (GUEST/CLIENT excluded).
      const isOwner = portfolio.ownerId === userId;
      const isMember = portfolio.members.some((m) => m.userId === userId);
      const isWorkspaceManager =
        access.workspaceRole === "OWNER" || access.workspaceRole === "ADMIN";
      const isPublic = portfolio.privacy === "PUBLIC";
      const isWorkspaceShared =
        portfolio.privacy === "WORKSPACE" &&
        !isNonContributorRole(access.workspaceRole);
      if (
        !isOwner &&
        !isMember &&
        !isWorkspaceManager &&
        !isPublic &&
        !isWorkspaceShared
      ) {
        return NextResponse.json(
          { error: "Portfolio not found" },
          { status: 404 }
        );
      }
      // View-gate passed → resolve the project ids. Only now do we SKIP the
      // canAccessSection('reporting') check for this scope. Seeing a
      // portfolio does not open its PRIVATE projects: the engine still
      // counts only the projects in it the caller may read.
      portfolioIds = await portfolioProjectIds(config.scope.portfolioId);
    } else {
      // Access gate: personal scope is always allowed; workspace/project
      // (organization-wide) reporting requires L3+.
      const isPersonal = config.scope.kind === "my";
      if (!isPersonal && !canAccessSection(access, "reporting")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // For project scope, the caller must be able to OPEN the project — the
      // same answer the project page gives — and it must live in the
      // reporting workspace. Both failures are the same 404.
      if (config.scope.kind === "project") {
        const projectAccess = await getProjectAccess(
          config.scope.projectId,
          userId
        );
        if (
          !projectAccess.ok ||
          projectAccess.workspaceId !== access.workspaceId
        ) {
          return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }
      }
    }

    const ctx: EngineContext = {
      userId,
      workspaceId: access.workspaceId,
      access: await buildReportAccessScopes(userId, access),
      portfolioProjectIds: portfolioIds,
    };

    const result = await runChartQuery(config, ctx);
    const meta = buildMeta(config);

    return NextResponse.json({
      ...result,
      meta: {
        entity: config.entity,
        chartType: config.chartType,
        filterSummary: meta.filterSummary,
        drilldownBase: meta.drilldownBase,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error running report query:", error);
    return NextResponse.json(
      { error: "Failed to run report query" },
      { status: 500 }
    );
  }
}
