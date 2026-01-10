import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// GET /api/workspace/knowledge - Get knowledge entries
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const category = searchParams.get("category");

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (!workspaceMember) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const entries = await prisma.knowledgeEntry.findMany({
      where: {
        workspaceId: workspaceMember.workspaceId,
        ...(search && {
          OR: [
            { term: { contains: search, mode: "insensitive" } },
            { definition: { contains: search, mode: "insensitive" } },
          ],
        }),
        ...(category && { category }),
      },
      orderBy: [
        { viewCount: "desc" },
        { updatedAt: "desc" },
      ],
    });

    // Get unique categories for filtering
    const categories = await prisma.knowledgeEntry.findMany({
      where: {
        workspaceId: workspaceMember.workspaceId,
        category: { not: null },
      },
      select: { category: true },
      distinct: ["category"],
    });

    return NextResponse.json({
      entries,
      categories: categories.map((c) => c.category).filter(Boolean),
    });
  } catch (error) {
    console.error("Error fetching knowledge entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch knowledge entries" },
      { status: 500 }
    );
  }
}

// POST /api/workspace/knowledge - Create a new knowledge entry
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { term, definition, category, tags } = await req.json();

    if (!term?.trim() || !definition?.trim()) {
      return NextResponse.json(
        { error: "Term and definition are required" },
        { status: 400 }
      );
    }

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (!workspaceMember) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const entry = await prisma.knowledgeEntry.create({
      data: {
        term,
        definition,
        category,
        tags: tags || [],
        workspaceId: workspaceMember.workspaceId,
        authorId: userId,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Error creating knowledge entry:", error);
    return NextResponse.json(
      { error: "Failed to create knowledge entry" },
      { status: 500 }
    );
  }
}

// PUT /api/workspace/knowledge - Update a knowledge entry
export async function PUT(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, term, definition, category, tags, incrementView } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Entry ID required" }, { status: 400 });
    }

    // If just incrementing view count
    if (incrementView) {
      const entry = await prisma.knowledgeEntry.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });
      return NextResponse.json(entry);
    }

    if (!term?.trim() || !definition?.trim()) {
      return NextResponse.json(
        { error: "Term and definition are required" },
        { status: 400 }
      );
    }

    const entry = await prisma.knowledgeEntry.update({
      where: { id },
      data: {
        term,
        definition,
        category,
        tags: tags || [],
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Error updating knowledge entry:", error);
    return NextResponse.json(
      { error: "Failed to update knowledge entry" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspace/knowledge - Delete a knowledge entry
export async function DELETE(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Entry ID required" }, { status: 400 });
    }

    await prisma.knowledgeEntry.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting knowledge entry:", error);
    return NextResponse.json(
      { error: "Failed to delete knowledge entry" },
      { status: 500 }
    );
  }
}
