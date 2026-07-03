import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// GET /api/users/preferences
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // upsert is race-safe on the unique userId key: concurrent first-load
    // GETs can't double-create and 500
    const preferences = await prisma.userPreferences.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    return NextResponse.json(preferences);
  } catch (error) {
    console.error("Error fetching preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

// PATCH /api/users/preferences
export async function PATCH(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Cap persisted JSON so a runaway client payload can't bloat the row
    const MAX_JSON_BYTES = 32 * 1024;
    for (const field of ["widgetPreferences", "uiState"] as const) {
      if (
        body[field] !== undefined &&
        JSON.stringify(body[field]).length > MAX_JSON_BYTES
      ) {
        return NextResponse.json(
          { error: `${field} exceeds maximum size` },
          { status: 400 }
        );
      }
    }

    if (body.theme !== undefined && !["light", "dark", "system"].includes(body.theme)) {
      return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
    }

    const allowedScalarFields = [
      "notifyTaskAssigned",
      "notifyTaskCompleted",
      "notifyCommentAdded",
      "notifyMentioned",
      "notifyProjectUpdates",
      "notifyWeeklyDigest",
      "theme",
    ];

    const updateData: Record<string, unknown> = {};
    for (const key of allowedScalarFields) {
      if (body[key] !== undefined) {
        updateData[key] = body[key];
      }
    }

    // JSON fields — accept arbitrary structure but validated by app code
    if (body.widgetPreferences !== undefined) {
      updateData.widgetPreferences = body.widgetPreferences;
    }
    // uiState needs a read-merge-write; run it inside an interactive
    // transaction so concurrent per-key writes for the same user serialize
    // instead of clobbering each other's merge base
    if (body.uiState !== undefined) {
      const incomingUiState = body.uiState as Record<string, unknown>;
      const preferences = await prisma.$transaction(async (tx) => {
        // Deep-merge with existing uiState (one level deep) so nested partial
        // updates like { dashboardWidgets: { [id]: [...] } } don't wipe other ids
        const existing = await tx.userPreferences.findUnique({
          where: { userId },
          select: { uiState: true },
        });
        const currentUiState = (existing?.uiState as Record<string, unknown> | null) || {};
        const merged: Record<string, unknown> = { ...currentUiState };
        for (const [key, value] of Object.entries(incomingUiState)) {
          const cur = currentUiState[key];
          if (
            cur &&
            typeof cur === "object" &&
            !Array.isArray(cur) &&
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
          ) {
            merged[key] = { ...cur, ...value };
          } else {
            merged[key] = value;
          }
        }
        updateData.uiState = merged;
        return tx.userPreferences.upsert({
          where: { userId },
          update: updateData,
          create: { userId, ...updateData },
        });
      });
      return NextResponse.json(preferences);
    }

    const preferences = await prisma.userPreferences.upsert({
      where: { userId },
      update: updateData,
      create: { userId, ...updateData },
    });

    return NextResponse.json(preferences);
  } catch (error) {
    console.error("Error updating preferences:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
