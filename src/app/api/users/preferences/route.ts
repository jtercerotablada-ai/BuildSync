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

    let preferences = await prisma.userPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: { userId },
      });
    }

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
    if (body.uiState !== undefined) {
      // Deep-merge with existing uiState (one level deep) so nested partial
      // updates like { dashboardWidgets: { [id]: [...] } } don't wipe other ids
      const existing = await prisma.userPreferences.findUnique({
        where: { userId },
        select: { uiState: true },
      });
      const currentUiState = (existing?.uiState as Record<string, unknown> | null) || {};
      const merged: Record<string, unknown> = { ...currentUiState };
      for (const [key, value] of Object.entries(body.uiState as Record<string, unknown>)) {
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
