import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId } from "@/lib/auth-guards";

// The chart catalog id (e.g. "incomplete-by-project") is stored in `config.catalogId`
// The chart type is stored as the prisma WidgetType enum
const createSchema = z.object({
  catalogId: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(["KPI_CARD", "BAR_CHART", "DONUT_CHART", "LINE_CHART", "STACKED_BAR", "TASK_LIST"]),
});

// POST /api/dashboards/:dashboardId/widgets
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
    const workspaceId = await getUserWorkspaceId(userId);

    const dashboard = await prisma.report.findUnique({
      where: { id: dashboardId },
      select: { workspaceId: true },
    });
    if (!dashboard || dashboard.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }

    const body = await req.json();
    const data = createSchema.parse(body);

    // Get max position
    const maxPos = await prisma.reportWidget.aggregate({
      where: { reportId: dashboardId },
      _max: { position: true },
    });

    const widget = await prisma.reportWidget.create({
      data: {
        reportId: dashboardId,
        type: data.type,
        title: data.title,
        position: (maxPos._max.position ?? -1) + 1,
        config: { catalogId: data.catalogId },
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

// DELETE /api/dashboards/:dashboardId/widgets?widgetId=...
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
    const workspaceId = await getUserWorkspaceId(userId);

    const dashboard = await prisma.report.findUnique({
      where: { id: dashboardId },
      select: { workspaceId: true },
    });
    if (!dashboard || dashboard.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const widgetId = searchParams.get("widgetId");
    if (!widgetId) {
      return NextResponse.json({ error: "widgetId required" }, { status: 400 });
    }

    await prisma.reportWidget.delete({
      where: { id: widgetId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting widget:", error);
    return NextResponse.json({ error: "Failed to delete widget" }, { status: 500 });
  }
}
