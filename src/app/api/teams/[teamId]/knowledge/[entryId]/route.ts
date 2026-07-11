import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTeamAccess, getErrorStatus } from "@/lib/auth-guards";

// PATCH /api/teams/:teamId/knowledge/:entryId — edit an entry.
// Any team member may edit (collaborative shared context, Asana parity).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ teamId: string; entryId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId, entryId } = await params;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await verifyTeamAccess(userId, teamId);

    const body = await req.json();
    const data: { term?: string; definition?: string } = {};
    if (typeof body?.term === "string") {
      const term = body.term.trim();
      if (!term) {
        return NextResponse.json({ error: "Term is required" }, { status: 400 });
      }
      // Reject over-length (consistent with POST) instead of silently
      // truncating — a slice would drop the tail with a success toast.
      if (term.length > 200) {
        return NextResponse.json({ error: "Term is too long" }, { status: 400 });
      }
      data.term = term;
    }
    if (typeof body?.definition === "string") {
      const def = body.definition.trim();
      if (def.length > 10000) {
        return NextResponse.json(
          { error: "Definition is too long (max 10,000 characters)" },
          { status: 400 }
        );
      }
      data.definition = def;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    // Scoped by {id, teamId} so a member of team A can't edit team B's entry.
    const result = await prisma.teamKnowledgeEntry.updateMany({
      where: { id: entryId, teamId },
      data,
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) return NextResponse.json({ error: message }, { status });
    console.error("Error updating knowledge entry:", error);
    return NextResponse.json(
      { error: "Failed to update entry" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/:teamId/knowledge/:entryId — delete an entry.
// The author OR a team lead may delete.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ teamId: string; entryId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId, entryId } = await params;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const member = await verifyTeamAccess(userId, teamId);

    const entry = await prisma.teamKnowledgeEntry.findFirst({
      where: { id: entryId, teamId },
      select: { id: true, createdById: true },
    });
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (entry.createdById !== userId && member.role !== "LEAD") {
      return NextResponse.json(
        { error: "Only the author or a team lead can delete this entry" },
        { status: 403 }
      );
    }

    await prisma.teamKnowledgeEntry.delete({ where: { id: entry.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) return NextResponse.json({ error: message }, { status });
    console.error("Error deleting knowledge entry:", error);
    return NextResponse.json(
      { error: "Failed to delete entry" },
      { status: 500 }
    );
  }
}
