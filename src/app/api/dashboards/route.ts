import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId } from "@/lib/auth-guards";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  iconColor: z.string().optional(),
});

// GET /api/dashboards - list the CURRENT USER's custom dashboards
//
// Privacy model (mirrors Asana): dashboards are personal — each user
// sees only the ones THEY created. Other workspace members don't see
// your custom dashboards, you don't see theirs. There's no sharing
// surface yet; if we want one later, this is where it plugs in.
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = await getUserWorkspaceId(userId);

    const dashboards = await prisma.report.findMany({
      where: {
        workspaceId,
        type: "CUSTOM",
        ownerId: userId, // ← privacy gate: scope to caller
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true },
        },
        _count: {
          select: { widgets: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(dashboards);
  } catch (error) {
    console.error("Error fetching dashboards:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboards" },
      { status: 500 }
    );
  }
}

// POST /api/dashboards - create a new dashboard
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = await getUserWorkspaceId(userId);
    const body = await req.json();
    const data = createSchema.parse(body);

    const dashboard = await prisma.report.create({
      data: {
        name: data.name,
        description: data.description,
        iconColor: data.iconColor || "#000000",
        type: "CUSTOM",
        workspaceId,
        ownerId: userId,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true },
        },
        _count: {
          select: { widgets: true },
        },
      },
    });

    return NextResponse.json(dashboard, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error creating dashboard:", error);
    return NextResponse.json(
      { error: "Failed to create dashboard" },
      { status: 500 }
    );
  }
}
