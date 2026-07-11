import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTeamAccess, getErrorStatus } from "@/lib/auth-guards";

// GET /api/teams/:teamId/knowledge — glossary entries + resolved authors
export async function GET(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId } = await params;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await verifyTeamAccess(userId, teamId);

    const entries = await prisma.teamKnowledgeEntry.findMany({
      where: { teamId },
      orderBy: { term: "asc" },
      select: {
        id: true,
        term: true,
        definition: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Resolve author names/images in one query (createdById is a scalar).
    const authorIds = [
      ...new Set(entries.map((e) => e.createdById).filter(Boolean)),
    ] as string[];
    const authors = authorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, name: true, email: true, image: true },
        })
      : [];
    const authorById = new Map(authors.map((a) => [a.id, a]));

    const shaped = entries.map((e) => ({
      id: e.id,
      term: e.term,
      definition: e.definition,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      author: e.createdById ? authorById.get(e.createdById) ?? null : null,
      mine: e.createdById === userId,
    }));

    return NextResponse.json(shaped);
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) return NextResponse.json({ error: message }, { status });
    console.error("Error fetching team knowledge:", error);
    return NextResponse.json(
      { error: "Failed to fetch knowledge" },
      { status: 500 }
    );
  }
}

// POST /api/teams/:teamId/knowledge — create an entry (any team member)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId } = await params;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await verifyTeamAccess(userId, teamId);

    const body = await req.json();
    const term = typeof body?.term === "string" ? body.term.trim() : "";
    const definition =
      typeof body?.definition === "string" ? body.definition.trim() : "";
    if (!term) {
      return NextResponse.json({ error: "Term is required" }, { status: 400 });
    }
    if (term.length > 200) {
      return NextResponse.json({ error: "Term is too long" }, { status: 400 });
    }
    if (definition.length > 10000) {
      return NextResponse.json(
        { error: "Definition is too long (max 10,000 characters)" },
        { status: 400 }
      );
    }

    const entry = await prisma.teamKnowledgeEntry.create({
      data: { teamId, term, definition, createdById: userId },
      select: {
        id: true,
        term: true,
        definition: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) return NextResponse.json({ error: message }, { status });
    console.error("Error creating knowledge entry:", error);
    return NextResponse.json(
      { error: "Failed to create entry" },
      { status: 500 }
    );
  }
}
