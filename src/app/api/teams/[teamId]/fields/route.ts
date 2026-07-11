import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyTeamAccess, getErrorStatus } from "@/lib/auth-guards";

const FIELD_TYPES = [
  "single_select",
  "multi_select",
  "date",
  "people",
  "reference",
  "text",
  "number",
];

// GET /api/teams/:teamId/fields — team custom fields + all member values
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

    const fields = await prisma.teamCustomField.findMany({
      where: { teamId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        options: true,
        config: true,
        position: true,
      },
    });

    const values = await prisma.teamMemberFieldValue.findMany({
      where: { field: { teamId } },
      select: { fieldId: true, teamMemberId: true, value: true },
    });

    return NextResponse.json({ fields, values });
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) return NextResponse.json({ error: message }, { status });
    console.error("Error fetching team fields:", error);
    return NextResponse.json(
      { error: "Failed to fetch fields" },
      { status: 500 }
    );
  }
}

// POST /api/teams/:teamId/fields — create a custom field (lead-only)
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

    const member = await verifyTeamAccess(userId, teamId);
    if (member.role !== "LEAD") {
      return NextResponse.json(
        { error: "Only team leads can add fields" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      title,
      type,
      description,
      options,
      referenceSource,
      numberFormat,
      decimals,
    } = body ?? {};

    const name = typeof title === "string" ? title.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Field title is required" }, { status: 400 });
    }
    if (!FIELD_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid field type" }, { status: 400 });
    }

    const isSelect = type === "single_select" || type === "multi_select";
    // Normalize select options: keep only named ones, ensure id + color.
    const normalizedOptions =
      isSelect && Array.isArray(options)
        ? options
            .filter(
              (o: { name?: string }) =>
                o && typeof o.name === "string" && o.name.trim()
            )
            .map((o: { id?: string; name: string; color?: string }) => ({
              id: o.id || crypto.randomUUID(),
              name: o.name.trim(),
              color: o.color || "#6b7280",
            }))
        : null;
    if (isSelect && (!normalizedOptions || normalizedOptions.length === 0)) {
      return NextResponse.json(
        { error: "Select fields need at least one option" },
        { status: 400 }
      );
    }

    const config: Record<string, string | number> = {};
    if (typeof description === "string" && description.trim())
      config.description = description.trim();
    if (type === "number") {
      config.format = numberFormat || "number";
      config.decimals =
        typeof decimals === "number" && decimals >= 0 ? decimals : 1;
    }
    if (type === "reference" && referenceSource)
      config.source = referenceSource;

    const count = await prisma.teamCustomField.count({ where: { teamId } });

    const field = await prisma.teamCustomField.create({
      data: {
        teamId,
        name,
        type,
        options: normalizedOptions ?? undefined,
        config: Object.keys(config).length ? config : undefined,
        position: count,
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

    return NextResponse.json(field, { status: 201 });
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) return NextResponse.json({ error: message }, { status });
    console.error("Error creating team field:", error);
    return NextResponse.json(
      { error: "Failed to create field" },
      { status: 500 }
    );
  }
}
