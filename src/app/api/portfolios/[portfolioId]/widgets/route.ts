import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyWorkspaceAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";
import {
  chartConfigSchema,
  chartTypeToWidgetType,
} from "@/lib/report-config";

/**
 * Widgets API for a PORTFOLIO's Panel (dashboard) view. Portfolios are SHARED
 * and multi-member (PortfolioMember OWNER/EDITOR/VIEWER, plus PUBLIC), so the
 * Panel is a SHARED dashboard — its widgets must be visible to every viewer of
 * the portfolio, not just the person who added them. That rules out per-user
 * uiState; widgets persist as durable, shared ReportWidget rows instead.
 *
 * ReportWidget.reportId must point at a Report. With no schema change allowed,
 * we lazily upsert a single HIDDEN backing Report per portfolio, keyed by the
 * sentinel name `__portfolio:{portfolioId}` (owner = portfolio owner, type =
 * CUSTOM). The Reporting dashboards list (GET /api/dashboards) filters by
 * ownerId AND excludes this sentinel-name prefix, so the backing report never
 * shows up in the Reporting UI.
 *
 * This route mirrors /api/dashboards/[dashboardId]/widgets verbatim except the
 * gate: GET is open to any portfolio VIEWER (owner | member | PUBLIC);
 * POST/PATCH/DELETE require EDIT capability (owner or member role OWNER/EDITOR)
 * — the exact predicate used by PATCH /api/portfolios/[portfolioId].
 *
 * config.kind discriminates how a widget renders (same union as the dashboards
 * route):
 *   • 'catalog' — a predefined /api/reports bundle chart.
 *   • 'custom'  — a builder-configured chart; chartConfig.scope is LOCKED to
 *                 { kind:'portfolio', portfolioId } by the client + re-checked
 *                 here so a widget can never aggregate a foreign scope.
 *   • 'text'    — a free-text widget (coarse enum TASK_LIST sentinel).
 */

/** Sentinel name of a portfolio's hidden backing Report. */
export function portfolioReportName(portfolioId: string): string {
  return `__portfolio:${portfolioId}`;
}

// ─── Widget config discriminated union ────────────────────────────

const catalogConfigSchema = z.object({
  kind: z.literal("catalog"),
  catalogId: z.string().min(1),
});

const customConfigSchema = z.object({
  kind: z.literal("custom"),
  chartType: chartConfigSchema.shape.chartType,
  chartConfig: chartConfigSchema,
  showDataLabels: z.boolean().optional(),
  benchmark: z.number().optional(),
});

const textConfigSchema = z.object({
  kind: z.literal("text"),
  text: z.string().max(4000),
});

const widgetConfigSchema = z.discriminatedUnion("kind", [
  catalogConfigSchema,
  customConfigSchema,
  textConfigSchema,
]);

const createSchema = z
  .object({
    catalogId: z.string().min(1).optional(),
    type: z
      .enum([
        "KPI_CARD",
        "BAR_CHART",
        "DONUT_CHART",
        "LINE_CHART",
        "STACKED_BAR",
        "TASK_LIST",
      ])
      .optional(),
    config: widgetConfigSchema.optional(),
    title: z.string().min(1),
    width: z.number().int().min(1).max(2).optional(),
  })
  .refine((d) => d.config != null || d.catalogId != null, {
    message: "Either config or catalogId is required",
  });

const reorderSchema = z.object({
  order: z.array(
    z.object({ id: z.string().min(1), position: z.number().int().min(0) })
  ),
});

const updateOneSchema = z.object({
  widgetId: z.string().min(1),
  title: z.string().min(1).optional(),
  width: z.number().int().min(1).max(2).optional(),
  position: z.number().int().min(0).optional(),
  config: widgetConfigSchema.optional(),
});

const patchSchema = z.union([reorderSchema, updateOneSchema]);

// ─── Portfolio view / edit gates ──────────────────────────────────

interface PortfolioGate {
  workspaceId: string;
  ownerId: string | null;
  canEdit: boolean;
}

/**
 * Load a portfolio and resolve the caller's view + edit capability. Returns
 * null when the portfolio is missing, cross-workspace, or the caller cannot
 * VIEW it (owner | member | PUBLIC) — the caller maps null to 404 to mask
 * existence, matching GET /api/portfolios/[portfolioId].
 */
async function resolvePortfolioGate(
  userId: string,
  portfolioId: string
): Promise<PortfolioGate | null> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    select: {
      workspaceId: true,
      ownerId: true,
      privacy: true,
      members: {
        select: { userId: true, role: true },
      },
    },
  });
  if (!portfolio) return null;

  // Must be a member of the portfolio's workspace at all.
  await verifyWorkspaceAccess(userId, portfolio.workspaceId);

  const isOwner = portfolio.ownerId === userId;
  const membership = portfolio.members.find((m) => m.userId === userId);
  const isMember = membership != null;
  const isPublic = portfolio.privacy === "PUBLIC";
  if (!isOwner && !isMember && !isPublic) return null;

  // Edit gate: owner or member role OWNER/EDITOR (VIEWER/PUBLIC = read-only).
  const memberRole = membership?.role;
  const canEdit =
    isOwner || memberRole === "OWNER" || memberRole === "EDITOR";

  return { workspaceId: portfolio.workspaceId, ownerId: portfolio.ownerId, canEdit };
}

/**
 * Find the portfolio's hidden backing Report, creating it lazily on first
 * write. Keyed by the sentinel name so repeated writes reuse the same row.
 * ownerId = portfolio owner (falls back to the acting user when the portfolio
 * has no owner, since Report.ownerId is required and non-null).
 */
async function ensureBackingReport(
  portfolioId: string,
  gate: PortfolioGate,
  actingUserId: string
): Promise<string> {
  const name = portfolioReportName(portfolioId);
  const existing = await prisma.report.findFirst({
    where: { workspaceId: gate.workspaceId, name },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.report.create({
    data: {
      name,
      type: "CUSTOM",
      workspaceId: gate.workspaceId,
      ownerId: gate.ownerId ?? actingUserId,
    },
    select: { id: true },
  });
  return created.id;
}

/** Find the backing report id WITHOUT creating it (read paths). */
async function findBackingReportId(
  portfolioId: string,
  workspaceId: string
): Promise<string | null> {
  const report = await prisma.report.findFirst({
    where: { workspaceId, name: portfolioReportName(portfolioId) },
    select: { id: true },
  });
  return report?.id ?? null;
}

/** Derive the coarse WidgetType enum from a validated widget config. */
function enumForConfig(
  config: z.infer<typeof widgetConfigSchema>,
  legacyType?: string
): "KPI_CARD" | "BAR_CHART" | "DONUT_CHART" | "LINE_CHART" | "STACKED_BAR" | "TASK_LIST" {
  if (config.kind === "custom") return chartTypeToWidgetType(config.chartType);
  if (config.kind === "text") return "TASK_LIST"; // sentinel
  return (legacyType as ReturnType<typeof enumForConfig>) || "BAR_CHART";
}

/**
 * Guard that a 'custom' widget's chartConfig scope is LOCKED to this
 * portfolio. The Panel presets + locks the scope client-side; we re-check
 * server-side so a crafted request can never persist a widget that aggregates
 * a foreign portfolio / workspace / project scope under this portfolio.
 */
function assertScopeLocked(
  config: z.infer<typeof widgetConfigSchema>,
  portfolioId: string
): string | null {
  if (config.kind !== "custom") return null;
  const scope = config.chartConfig.scope;
  if (scope.kind !== "portfolio" || scope.portfolioId !== portfolioId) {
    return "Chart scope must be locked to this portfolio";
  }
  return null;
}

// ─── GET — list widgets (open to any portfolio viewer) ────────────

export async function GET(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { portfolioId } = await params;
    const gate = await resolvePortfolioGate(userId, portfolioId);
    if (!gate) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }

    // No backing report yet → no widgets (never lazily create on a read).
    const reportId = await findBackingReportId(portfolioId, gate.workspaceId);
    if (!reportId) return NextResponse.json([]);

    const widgets = await prisma.reportWidget.findMany({
      where: { reportId },
      orderBy: { position: "asc" },
    });
    return NextResponse.json(widgets);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error listing portfolio widgets:", error);
    return NextResponse.json(
      { error: "Failed to list widgets" },
      { status: 500 }
    );
  }
}

// ─── POST — add a widget (requires edit capability) ───────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { portfolioId } = await params;
    const gate = await resolvePortfolioGate(userId, portfolioId);
    if (!gate) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }
    if (!gate.canEdit) {
      return NextResponse.json(
        { error: "Only the portfolio owner or an Editor can add widgets" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const data = createSchema.parse(body);

    const config =
      data.config ??
      ({ kind: "catalog", catalogId: data.catalogId! } as const);

    const scopeError = assertScopeLocked(config, portfolioId);
    if (scopeError) {
      return NextResponse.json({ error: scopeError }, { status: 400 });
    }

    // Lazily create the hidden backing Report on the first widget add.
    const reportId = await ensureBackingReport(portfolioId, gate, userId);

    const maxPos = await prisma.reportWidget.aggregate({
      where: { reportId },
      _max: { position: true },
    });

    const widget = await prisma.reportWidget.create({
      data: {
        reportId,
        type: enumForConfig(config, data.type),
        title: data.title,
        position: (maxPos._max.position ?? -1) + 1,
        width: data.width ?? (config.kind === "text" ? 2 : 1),
        config,
      },
    });

    return NextResponse.json(widget, { status: 201 });
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
    console.error("Error adding portfolio widget:", error);
    return NextResponse.json({ error: "Failed to add widget" }, { status: 500 });
  }
}

// ─── PATCH — update one widget OR bulk-reorder (edit capability) ──

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { portfolioId } = await params;
    const gate = await resolvePortfolioGate(userId, portfolioId);
    if (!gate) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }
    if (!gate.canEdit) {
      return NextResponse.json(
        { error: "Only the portfolio owner or an Editor can update widgets" },
        { status: 403 }
      );
    }

    // A backing report must already exist to have any widgets to update.
    const reportId = await findBackingReportId(portfolioId, gate.workspaceId);
    if (!reportId) {
      return NextResponse.json({ error: "Widget not found" }, { status: 404 });
    }

    const body = await req.json();
    const data = patchSchema.parse(body);

    // Bulk reorder.
    if ("order" in data) {
      // Bind every id to THIS portfolio's report so a foreign id can't move.
      const ids = data.order.map((o) => o.id);
      const owned = await prisma.reportWidget.findMany({
        where: { id: { in: ids }, reportId },
        select: { id: true },
      });
      const ownedSet = new Set(owned.map((w) => w.id));
      const updates = data.order.filter((o) => ownedSet.has(o.id));
      await prisma.$transaction(
        updates.map((o) =>
          prisma.reportWidget.update({
            where: { id: o.id },
            data: { position: o.position },
          })
        )
      );
      return NextResponse.json({ success: true, updated: updates.length });
    }

    // Guard scope on a config swap before touching the DB.
    if (data.config !== undefined) {
      const scopeError = assertScopeLocked(data.config, portfolioId);
      if (scopeError) {
        return NextResponse.json({ error: scopeError }, { status: 400 });
      }
    }

    // Bind to THIS portfolio's report so a foreign widgetId 404s.
    const existing = await prisma.reportWidget.findFirst({
      where: { id: data.widgetId, reportId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Widget not found" }, { status: 404 });
    }

    const updateData: {
      title?: string;
      width?: number;
      position?: number;
      config?: z.infer<typeof widgetConfigSchema>;
      type?: ReturnType<typeof enumForConfig>;
    } = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.width !== undefined) updateData.width = data.width;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.config !== undefined) {
      updateData.config = data.config;
      updateData.type = enumForConfig(data.config);
    }

    const widget = await prisma.reportWidget.update({
      where: { id: data.widgetId },
      data: updateData,
    });

    return NextResponse.json(widget);
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
    console.error("Error updating portfolio widget:", error);
    return NextResponse.json(
      { error: "Failed to update widget" },
      { status: 500 }
    );
  }
}

// ─── DELETE — remove a widget (edit capability) ───────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { portfolioId } = await params;
    const gate = await resolvePortfolioGate(userId, portfolioId);
    if (!gate) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }
    if (!gate.canEdit) {
      return NextResponse.json(
        { error: "Only the portfolio owner or an Editor can delete widgets" },
        { status: 403 }
      );
    }

    const reportId = await findBackingReportId(portfolioId, gate.workspaceId);
    if (!reportId) {
      return NextResponse.json({ error: "Widget not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const widgetId = searchParams.get("widgetId");
    if (!widgetId) {
      return NextResponse.json({ error: "widgetId required" }, { status: 400 });
    }

    // Bind the widget to THIS portfolio's report so a foreign widgetId
    // deletes nothing (count 0 → 404).
    const deleted = await prisma.reportWidget.deleteMany({
      where: { id: widgetId, reportId },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Widget not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error deleting portfolio widget:", error);
    return NextResponse.json({ error: "Failed to delete widget" }, { status: 500 });
  }
}
