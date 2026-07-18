import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyProjectAccess,
  getErrorStatus,
  AuthorizationError,
  NotFoundError,
} from "@/lib/auth-guards";
import { isBuiltinViewKey, baseLabelFor } from "@/lib/project-views";

// Per-project view-tab customization (Asana's tab context menu). GET lists the
// project's prefs; POST creates a copy of a built-in view as a new tab.

const prefSelect = {
  id: true,
  viewKey: true,
  baseView: true,
  label: true,
  hidden: true,
  isDefault: true,
  position: true,
} as const;

// GET /api/projects/:projectId/views
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { projectId } = await params;
    await verifyProjectAccess(userId, projectId);

    const prefs = await prisma.projectViewPref.findMany({
      where: { projectId },
      select: prefSelect,
      orderBy: { position: "asc" },
    });
    return NextResponse.json(prefs);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[project views GET] error:", error);
    return NextResponse.json({ error: "Failed to fetch views" }, { status: 500 });
  }
}

const postSchema = z.object({
  // The built-in view to copy (must be a real view key).
  baseView: z.string().refine(isBuiltinViewKey, "Unknown view"),
  label: z.string().trim().min(1).max(120).optional(),
});

// POST /api/projects/:projectId/views — "Make a copy": clone a built-in view
// into a new tab with a generated key.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { projectId } = await params;
    await verifyProjectAccess(userId, projectId, { requireWrite: true });

    const body = await req.json();
    const { baseView, label } = postSchema.parse(body);

    // Order copies after everything else that already exists.
    const last = await prisma.projectViewPref.findFirst({
      where: { projectId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (last?.position ?? 0) + 1;

    // Generate a unique tab key. The @@unique([projectId, viewKey]) guard
    // makes a collision a hard error rather than a silent overwrite; retry a
    // couple of times on the (astronomically rare) clash.
    type CreatedPref = {
      id: string;
      viewKey: string;
      baseView: string;
      label: string | null;
      hidden: boolean;
      isDefault: boolean;
      position: number;
    };
    let created: CreatedPref | null = null;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      const viewKey = `${baseView}-${crypto.randomUUID().slice(0, 8)}`;
      try {
        created = await prisma.projectViewPref.create({
          data: {
            projectId,
            viewKey,
            baseView,
            label: label ?? `${baseLabelFor(baseView)} copy`,
            position,
          },
          select: prefSelect,
        });
      } catch (e) {
        // Unique-constraint clash on viewKey → try a fresh key.
        if (
          e &&
          typeof e === "object" &&
          "code" in e &&
          (e as { code?: string }).code === "P2002"
        ) {
          continue;
        }
        throw e;
      }
    }
    if (!created) {
      return NextResponse.json(
        { error: "Could not create view" },
        { status: 500 }
      );
    }
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[project views POST] error:", error);
    return NextResponse.json({ error: "Failed to create view" }, { status: 500 });
  }
}
