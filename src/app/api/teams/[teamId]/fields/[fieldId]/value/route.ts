import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTeamAccess, getErrorStatus } from "@/lib/auth-guards";

// PUT /api/teams/:teamId/fields/:fieldId/value — set one member's value.
// Any team member can edit values (collaboration); only the field's
// definition (create/delete) is lead-gated.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ teamId: string; fieldId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId, fieldId } = await params;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await verifyTeamAccess(userId, teamId);

    const body = await req.json();
    const teamMemberId =
      typeof body?.teamMemberId === "string" ? body.teamMemberId : null;
    const value = body?.value ?? null;
    if (!teamMemberId) {
      return NextResponse.json(
        { error: "teamMemberId is required" },
        { status: 400 }
      );
    }

    // The field must belong to THIS team, and the member must belong to
    // this team — otherwise a caller could write values onto another
    // team's field or member by guessing ids.
    const field = await prisma.teamCustomField.findFirst({
      where: { id: fieldId, teamId },
      select: { id: true },
    });
    if (!field) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }
    const member = await prisma.teamMember.findFirst({
      where: { id: teamMemberId, teamId },
      select: { id: true },
    });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Empty value clears the cell (delete the row); otherwise upsert.
    const isEmpty =
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (isEmpty) {
      await prisma.teamMemberFieldValue.deleteMany({
        where: { fieldId, teamMemberId },
      });
      return NextResponse.json({ success: true, value: null });
    }

    const saved = await prisma.teamMemberFieldValue.upsert({
      where: { fieldId_teamMemberId: { fieldId, teamMemberId } },
      update: { value },
      create: { fieldId, teamMemberId, value },
      select: { fieldId: true, teamMemberId: true, value: true },
    });

    return NextResponse.json({ success: true, ...saved });
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) return NextResponse.json({ error: message }, { status });
    console.error("Error saving team field value:", error);
    return NextResponse.json(
      { error: "Failed to save value" },
      { status: 500 }
    );
  }
}
