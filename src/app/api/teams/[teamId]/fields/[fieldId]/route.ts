import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTeamAccess, getErrorStatus } from "@/lib/auth-guards";

async function assertLead(userId: string, teamId: string) {
  const member = await verifyTeamAccess(userId, teamId);
  if (member.role !== "LEAD") {
    return false;
  }
  return true;
}

// PATCH /api/teams/:teamId/fields/:fieldId — rename a field (lead-only)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ teamId: string; fieldId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId, fieldId } = await params;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await assertLead(userId, teamId))) {
      return NextResponse.json(
        { error: "Only team leads can edit fields" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Scope the update to THIS team so a leader of team A can't rename a
    // field owned by team B by guessing its id.
    const result = await prisma.teamCustomField.updateMany({
      where: { id: fieldId, teamId },
      data: { name },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) return NextResponse.json({ error: message }, { status });
    console.error("Error updating team field:", error);
    return NextResponse.json(
      { error: "Failed to update field" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/:teamId/fields/:fieldId — delete a field (lead-only)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ teamId: string; fieldId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId, fieldId } = await params;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await assertLead(userId, teamId))) {
      return NextResponse.json(
        { error: "Only team leads can delete fields" },
        { status: 403 }
      );
    }

    // Scoped delete (id + teamId) so cross-team ids can't be dropped.
    // Cascade removes the field's values.
    const result = await prisma.teamCustomField.deleteMany({
      where: { id: fieldId, teamId },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) return NextResponse.json({ error: message }, { status });
    console.error("Error deleting team field:", error);
    return NextResponse.json(
      { error: "Failed to delete field" },
      { status: 500 }
    );
  }
}
