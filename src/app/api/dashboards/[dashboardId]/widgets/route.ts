import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId } from "@/lib/auth-guards";
import {
  chartConfigSchema,
  chartTypeToWidgetType,
} from "@/lib/report-config";

/**
 * Widgets API for a CUSTOM dashboard (a real Report row). Widgets persist
 * as ReportWidget rows so a custom dashboard's charts are durable and
 * shared (owner-gated), and GET /api/dashboards/[id] already returns them
 * ordered by position.
 *
 * config.kind discriminates how a widget renders:
 *   • 'catalog' — a predefined /api/reports bundle chart (legacy path).
 *       config = { kind:'catalog', catalogId }
 *   • 'custom'  — a builder-configured chart.
 *       config = { kind:'custom', chartType, chartConfig, showDataLabels?, benchmark? }
 *   • 'text'    — a free-text widget (stored on the coarse enum TASK_LIST).
 *       config = { kind:'text', text }
 *
 * The coarse Prisma WidgetType enum is set by mapping the precise chartType
 * (custom) / DONUT_CHART-etc; catalog widgets keep BAR_CHART-family; text
 * uses TASK_LIST as a sentinel.
 */

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

// POST accepts EITHER the legacy catalog shape (catalogId + type) OR the
// new config-object shape. `config` takes precedence when present.
const createSchema = z
  .object({
    // Legacy catalog path — kept for back-compat with any existing caller.
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
    // New path — a full widget config object.
    config: widgetConfigSchema.optional(),
    title: z.string().min(1),
    width: z.number().int().min(1).max(2).optional(),
  })
  .refine((d) => d.config != null || d.catalogId != null, {
    message: "Either config or catalogId is required",
  });

// PATCH: update one widget, or bulk-reorder.
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

// ─── Owner gate (shared) ──────────────────────────────────────────

async function assertOwnedDashboard(userId: string, dashboardId: string) {
  const workspaceId = await getUserWorkspaceId(userId);
  const dashboard = await prisma.report.findUnique({
    where: { id: dashboardId },
    select: { workspaceId: true, ownerId: true },
  });
  // Owner-only gate. Foreign dashboards return 404 to mask existence —
  // same pattern as the parent dashboard endpoint.
  if (
    !dashboard ||
    dashboard.workspaceId !== workspaceId ||
    dashboard.ownerId !== userId
  ) {
    return null;
  }
  return dashboard;
}

/** Derive the coarse WidgetType enum from a validated widget config. */
function enumForConfig(
  config: z.infer<typeof widgetConfigSchema>,
  legacyType?: string
): "KPI_CARD" | "BAR_CHART" | "DONUT_CHART" | "LINE_CHART" | "STACKED_BAR" | "TASK_LIST" {
  if (config.kind === "custom") return chartTypeToWidgetType(config.chartType);
  if (config.kind === "text") return "TASK_LIST"; // sentinel
  // catalog — fall back to any provided legacy type, else BAR_CHART.
  return (legacyType as ReturnType<typeof enumForConfig>) || "BAR_CHART";
}

// ─── GET — list widgets for a dashboard (ordered by position) ─────

export async function GET(
  req: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { dashboardId } = await params;
    const dashboard = await assertOwnedDashboard(userId, dashboardId);
    if (!dashboard) {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }

    const widgets = await prisma.reportWidget.findMany({
      where: { reportId: dashboardId },
      orderBy: { position: "asc" },
    });

    return NextResponse.json(widgets);
  } catch (error) {
    console.error("Error listing widgets:", error);
    return NextResponse.json(
      { error: "Failed to list widgets" },
      { status: 500 }
    );
  }
}

// ─── POST — add a widget (catalog OR full config) ─────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dashboardId } = await params;
    const dashboard = await assertOwnedDashboard(userId, dashboardId);
    if (!dashboard) {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }

    const body = await req.json();
    const data = createSchema.parse(body);

    // Normalize to a stored config object.
    const config =
      data.config ??
      ({ kind: "catalog", catalogId: data.catalogId! } as const);

    const maxPos = await prisma.reportWidget.aggregate({
      where: { reportId: dashboardId },
      _max: { position: true },
    });

    const widget = await prisma.reportWidget.create({
      data: {
        reportId: dashboardId,
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
    console.error("Error adding widget:", error);
    return NextResponse.json({ error: "Failed to add widget" }, { status: 500 });
  }
}

// ─── PATCH — update one widget OR bulk-reorder ────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dashboardId } = await params;
    const dashboard = await assertOwnedDashboard(userId, dashboardId);
    if (!dashboard) {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }

    const body = await req.json();
    const data = patchSchema.parse(body);

    // Bulk reorder.
    if ("order" in data) {
      // Bind every id to THIS dashboard so a foreign id can't be moved.
      const ids = data.order.map((o) => o.id);
      const owned = await prisma.reportWidget.findMany({
        where: { id: { in: ids }, reportId: dashboardId },
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

    // Update one widget's title/width/position/config.
    // Bind to THIS dashboard so a widgetId from another dashboard 404s.
    const existing = await prisma.reportWidget.findFirst({
      where: { id: data.widgetId, reportId: dashboardId },
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
      // Keep the coarse enum in sync with the new config.
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
    console.error("Error updating widget:", error);
    return NextResponse.json(
      { error: "Failed to update widget" },
      { status: 500 }
    );
  }
}

// ─── DELETE — remove a widget (unchanged behavior) ────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dashboardId } = await params;
    const dashboard = await assertOwnedDashboard(userId, dashboardId);
    if (!dashboard) {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const widgetId = searchParams.get("widgetId");
    if (!widgetId) {
      return NextResponse.json({ error: "widgetId required" }, { status: 400 });
    }

    // Bind the widget to THIS dashboard so a widgetId from another
    // dashboard deletes nothing (count 0 → 404) instead of removing an
    // arbitrary widget by id — audit.
    const deleted = await prisma.reportWidget.deleteMany({
      where: { id: widgetId, reportId: dashboardId },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Widget not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting widget:", error);
    return NextResponse.json({ error: "Failed to delete widget" }, { status: 500 });
  }
}
