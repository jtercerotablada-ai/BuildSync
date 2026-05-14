import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId } from "@/lib/auth-guards";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  iconColor: z.string().optional(),
});

// GET /api/dashboards/:dashboardId - get one dashboard with widgets
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
    const workspaceId = await getUserWorkspaceId(userId);

    const dashboard = await prisma.report.findUnique({
      where: { id: dashboardId },
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true },
        },
        widgets: {
          orderBy: { position: "asc" },
        },
      },
    });

    // Privacy gate: workspace match AND user owns it. We treat
    // foreign dashboards as 404 (not 403) so we don't leak that a
    // dashboard with this id exists at all.
    if (
      !dashboard ||
      dashboard.workspaceId !== workspaceId ||
      dashboard.ownerId !== userId
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(dashboard);
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard" }, { status: 500 });
  }
}

// PATCH /api/dashboards/:dashboardId
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
    const workspaceId = await getUserWorkspaceId(userId);

    const existing = await prisma.report.findUnique({
      where: { id: dashboardId },
      select: { workspaceId: true, ownerId: true },
    });
    // Owner-only gate. Foreign dashboards return 404 to avoid
    // leaking the id-exists fact.
    if (
      !existing ||
      existing.workspaceId !== workspaceId ||
      existing.ownerId !== userId
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const data = updateSchema.parse(body);

    const dashboard = await prisma.report.update({
      where: { id: dashboardId },
      data,
    });

    return NextResponse.json(dashboard);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error updating dashboard:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// DELETE /api/dashboards/:dashboardId
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

    const existing = await prisma.report.findUnique({
      where: { id: dashboardId },
      select: { workspaceId: true, ownerId: true },
    });
    // Owner-only gate, same shape as PATCH.
    if (
      !existing ||
      existing.workspaceId !== workspaceId ||
      existing.ownerId !== userId
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.report.delete({ where: { id: dashboardId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting dashboard:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
