import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const addProjectSchema = z.object({
  projectId: z.string().min(1),
});

// POST /api/portfolios/:portfolioId/projects - Add project to portfolio
export async function POST(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { portfolioId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = addProjectSchema.parse(body);

    // Check if already exists
    const existing = await prisma.portfolioProject.findUnique({
      where: {
        portfolioId_projectId: {
          portfolioId,
          projectId: data.projectId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Project already in portfolio" },
        { status: 400 }
      );
    }

    // Get max position
    const maxPosition = await prisma.portfolioProject.aggregate({
      where: { portfolioId },
      _max: { position: true },
    });

    const portfolioProject = await prisma.portfolioProject.create({
      data: {
        portfolioId,
        projectId: data.projectId,
        position: (maxPosition._max.position || 0) + 1,
      },
      include: {
        project: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(portfolioProject, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error adding project to portfolio:", error);
    return NextResponse.json(
      { error: "Failed to add project to portfolio" },
      { status: 500 }
    );
  }
}

// DELETE /api/portfolios/:portfolioId/projects - Remove project from portfolio
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ portfolioId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { portfolioId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID required" },
        { status: 400 }
      );
    }

    await prisma.portfolioProject.delete({
      where: {
        portfolioId_projectId: {
          portfolioId,
          projectId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing project from portfolio:", error);
    return NextResponse.json(
      { error: "Failed to remove project from portfolio" },
      { status: 500 }
    );
  }
}
