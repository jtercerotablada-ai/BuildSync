import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId, AuthorizationError, NotFoundError, getErrorStatus, requireWorkspaceContributor } from "@/lib/auth-guards";

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

    // The same resolver PUT/DELETE use. A bare findFirst returned an
    // arbitrary membership, so the list and the create could land in the
    // personal singleton workspace while the update checked the firm one.
    const workspaceId = await getUserWorkspaceId(userId);

    const entries = await prisma.knowledgeEntry.findMany({
      where: {
        workspaceId,
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
        workspaceId,
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
    // getUserWorkspaceId THROWS for a caller with no membership; without this
    // branch that answered 500 where the old code answered 404.
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
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

    await requireWorkspaceContributor(userId);

    const { term, definition, category, tags } = await req.json();

    if (!term?.trim() || !definition?.trim()) {
      return NextResponse.json(
        { error: "Term and definition are required" },
        { status: 400 }
      );
    }

    // The same resolver PUT/DELETE use. A bare findFirst returned an
    // arbitrary membership, so the list and the create could land in the
    // personal singleton workspace while the update checked the firm one.
    const workspaceId = await getUserWorkspaceId(userId);

    const entry = await prisma.knowledgeEntry.create({
      data: {
        term,
        definition,
        category,
        tags: tags || [],
        workspaceId,
        authorId: userId,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
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

    await requireWorkspaceContributor(userId);

    const { id, term, definition, category, tags, incrementView } = await req.json();

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Entry ID required" }, { status: 400 });
    }

    // Verify entry belongs to user's workspace
    const workspaceId = await getUserWorkspaceId(userId);
    const existing = await prisma.knowledgeEntry.findUnique({
      where: { id },
      select: { workspaceId: true },
    });
    if (!existing) {
      throw new NotFoundError("Knowledge entry not found");
    }
    if (existing.workspaceId !== workspaceId) {
      throw new AuthorizationError("You don't have access to this knowledge entry");
    }

    // Just counting a view. A raw UPDATE on purpose: Prisma's update() rewrites the @updatedAt
    // column, so every view would make the entry look freshly edited, and the
    // "updated" date is how staff judge whether a code note may be stale.
    if (incrementView) {
      const rows = await prisma.$queryRaw<{ viewCount: number }[]>`
        UPDATE "KnowledgeEntry"
        SET "viewCount" = "viewCount" + 1
        WHERE "id" = ${id}
        RETURNING "viewCount"`;
      if (!rows.length) {
        throw new NotFoundError("Knowledge entry not found");
      }
      return NextResponse.json({ id, viewCount: rows[0].viewCount });
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
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
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

    await requireWorkspaceContributor(userId);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Entry ID required" }, { status: 400 });
    }

    // Verify entry belongs to user's workspace
    const workspaceId = await getUserWorkspaceId(userId);
    const existing = await prisma.knowledgeEntry.findUnique({
      where: { id },
      select: { workspaceId: true },
    });
    if (!existing) {
      throw new NotFoundError("Knowledge entry not found");
    }
    if (existing.workspaceId !== workspaceId) {
      throw new AuthorizationError("You don't have access to this knowledge entry");
    }

    await prisma.knowledgeEntry.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error deleting knowledge entry:", error);
    return NextResponse.json(
      { error: "Failed to delete knowledge entry" },
      { status: 500 }
    );
  }
}
