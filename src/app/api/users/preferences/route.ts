import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { AVAILABLE_WIDGETS } from "@/types/dashboard";

// Thrown inside the uiState merge transaction when the MERGED payload exceeds
// the size cap. Caught below to return a 400 instead of a generic 500.
class UiStateTooLargeError extends Error {}

const VALID_WIDGET_IDS = new Set<string>(AVAILABLE_WIDGETS.map((w) => w.id));
const VALID_WIDGET_SIZES = new Set(["half", "full"]);

/**
 * Validate + clean a widgetPreferences payload before persisting it.
 * Returns null when the payload isn't structurally the client shape
 * (arrays of ids + optional sizes map). Unknown/removed widget ids and
 * invalid sizes are FILTERED rather than rejected so a stale client
 * that still references a sunset widget keeps saving successfully —
 * mirroring the client-side migratePreferences behavior.
 */
function sanitizeWidgetPreferences(input: unknown): {
  visibleWidgets: string[];
  widgetOrder: string[];
  widgetSizes: Record<string, string>;
} | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const { visibleWidgets, widgetOrder, widgetSizes } = input as Record<
    string,
    unknown
  >;
  if (!Array.isArray(visibleWidgets) || !Array.isArray(widgetOrder)) return null;
  if (
    widgetSizes !== undefined &&
    (widgetSizes === null ||
      typeof widgetSizes !== "object" ||
      Array.isArray(widgetSizes))
  ) {
    return null;
  }
  const clean = (ids: unknown[]) => [
    ...new Set(
      ids.filter(
        (id): id is string => typeof id === "string" && VALID_WIDGET_IDS.has(id)
      )
    ),
  ];
  const sizes: Record<string, string> = {};
  for (const [id, size] of Object.entries(
    (widgetSizes as Record<string, unknown> | undefined) ?? {}
  )) {
    if (
      VALID_WIDGET_IDS.has(id) &&
      typeof size === "string" &&
      VALID_WIDGET_SIZES.has(size)
    ) {
      sizes[id] = size;
    }
  }
  return {
    visibleWidgets: clean(visibleWidgets),
    widgetOrder: clean(widgetOrder),
    widgetSizes: sizes,
  };
}

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

    const notifyFields = [
      "notifyTaskAssigned",
      "notifyTaskCompleted",
      "notifyCommentAdded",
      "notifyMentioned",
      "notifyProjectUpdates",
      "notifyWeeklyDigest",
    ];
    const allowedScalarFields = [...notifyFields, "theme"];

    // Coerce notify* toggles to a strict boolean so a non-boolean payload
    // (e.g. "yes") can't reach Prisma and 500. Accepts real booleans and
    // common truthy/falsy scalars; rejects anything else with a 400.
    const truthy = new Set([true, "true", "1", 1, "on", "yes"]);
    const falsy = new Set([false, "false", "0", 0, "off", "no", ""]);
    function coerceBoolean(value: unknown): boolean | undefined {
      if (typeof value === "boolean") return value;
      if (truthy.has(value as never)) return true;
      if (falsy.has(value as never)) return false;
      return undefined;
    }

    const updateData: Record<string, unknown> = {};
    for (const key of allowedScalarFields) {
      if (body[key] === undefined) continue;
      if (notifyFields.includes(key)) {
        const coerced = coerceBoolean(body[key]);
        if (coerced === undefined) {
          return NextResponse.json(
            { error: `${key} must be a boolean` },
            { status: 400 }
          );
        }
        updateData[key] = coerced;
      } else {
        updateData[key] = body[key];
      }
    }

    if (body.widgetPreferences !== undefined) {
      const sanitized = sanitizeWidgetPreferences(body.widgetPreferences);
      if (!sanitized) {
        return NextResponse.json(
          { error: "Invalid widgetPreferences" },
          { status: 400 }
        );
      }
      updateData.widgetPreferences = sanitized;
    }
    // uiState needs a read-merge-write; run it inside a SERIALIZABLE
    // transaction so concurrent per-key writes for the same user can't
    // read the same base and silently drop each other's merge — under
    // read committed the second writer would win. Serialization
    // conflicts (P2034) are retried a couple of times.
    if (body.uiState !== undefined) {
      const incomingUiState = body.uiState as Record<string, unknown>;
      const runMerge = () => prisma.$transaction(async (tx) => {
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
        // The incoming-body cap above only bounds a single request; the merge
        // accumulates distinct keys across requests, so re-check the MERGED
        // size to keep the stored row bounded.
        if (JSON.stringify(merged).length > MAX_JSON_BYTES) {
          throw new UiStateTooLargeError();
        }
        updateData.uiState = merged;
        return tx.userPreferences.upsert({
          where: { userId },
          update: updateData,
          create: { userId, ...updateData },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      let preferences: Awaited<ReturnType<typeof runMerge>> | null = null;
      for (let attempt = 1; preferences === null; attempt++) {
        try {
          preferences = await runMerge();
        } catch (error) {
          const retriable =
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2034" &&
            attempt < 3;
          if (!retriable) throw error;
        }
      }
      return NextResponse.json(preferences);
    }

    const preferences = await prisma.userPreferences.upsert({
      where: { userId },
      update: updateData,
      create: { userId, ...updateData },
    });

    return NextResponse.json(preferences);
  } catch (error) {
    if (error instanceof UiStateTooLargeError) {
      return NextResponse.json(
        { error: "uiState exceeds maximum size" },
        { status: 400 }
      );
    }
    console.error("Error updating preferences:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
