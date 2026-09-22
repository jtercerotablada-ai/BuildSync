import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getErrorStatus } from "@/lib/auth-guards";
import { requireTeamStanding } from "@/lib/team-access";

// A field's definition belongs to whoever manages the team: its LEAD, or a
// workspace OWNER/ADMIN (so a team whose only lead left can still be set up).
async function assertLead(userId: string, teamId: string) {
  const standing = await requireTeamStanding(userId, teamId);
  return standing.canManageMembers;
}

type SelectOption = { id: string; name: string; color: string };

/**
 * Normalize an edited option list the way POST /fields does on create, but
 * keep every id the caller sends back: member values store option ids, so a
 * renamed option must keep its id or every cell holding it goes blank.
 */
function normalizeOptions(options: unknown): SelectOption[] | null {
  if (!Array.isArray(options)) return null;
  return options
    .filter(
      (o): o is { id?: unknown; name: string; color?: unknown } =>
        !!o &&
        typeof o === "object" &&
        typeof (o as { name?: unknown }).name === "string" &&
        !!(o as { name: string }).name.trim()
    )
    .map((o) => ({
      id: typeof o.id === "string" && o.id ? o.id : crypto.randomUUID(),
      name: o.name.trim(),
      color: typeof o.color === "string" && o.color ? o.color : "#6b7280",
    }));
}

// PATCH /api/teams/:teamId/fields/:fieldId — rename a field and/or edit a
// select field's options (lead-only). Body: { name?, options? }.
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
        { error: "Only team leads or workspace admins can edit fields" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const hasName = body?.name !== undefined;
    const hasOptions = body?.options !== undefined;
    if (!hasName && !hasOptions) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (hasName && !name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Scope the lookup to THIS team so a leader of team A can't edit a field
    // owned by team B by guessing its id.
    const field = await prisma.teamCustomField.findFirst({
      where: { id: fieldId, teamId },
      select: { id: true, type: true },
    });
    if (!field) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }

    let options: SelectOption[] | undefined;
    if (hasOptions) {
      if (field.type !== "single_select" && field.type !== "multi_select") {
        return NextResponse.json(
          { error: "Only select fields have options" },
          { status: 400 }
        );
      }
      const normalized = normalizeOptions(body.options);
      if (!normalized || normalized.length === 0) {
        return NextResponse.json(
          { error: "Select fields need at least one option" },
          { status: 400 }
        );
      }
      if (new Set(normalized.map((o) => o.id)).size !== normalized.length) {
        return NextResponse.json(
          { error: "Option ids must be unique" },
          { status: 400 }
        );
      }
      options = normalized;
    }

    const updated = await prisma.teamCustomField.update({
      where: { id: field.id },
      data: {
        ...(hasName ? { name } : {}),
        ...(options ? { options } : {}),
      },
      select: {
        id: true,
        name: true,
        type: true,
        options: true,
        config: true,
        position: true,
      },
    });

    return NextResponse.json({ success: true, field: updated });
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
        { error: "Only team leads or workspace admins can delete fields" },
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
