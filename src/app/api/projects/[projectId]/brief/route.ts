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

// The project's single "Brief del proyecto" (Asana). GET returns it (or null
// when none exists yet); PUT upserts the content; DELETE removes it.

const BRIEF_MAX = 200000;

const briefSelect = {
  id: true,
  content: true,
  updatedAt: true,
  lastEditedBy: { select: { id: true, name: true, email: true, image: true } },
} as const;

// GET /api/projects/:projectId/brief
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

    const brief = await prisma.projectBrief.findUnique({
      where: { projectId },
      select: briefSelect,
    });
    return NextResponse.json(brief ?? null);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[project brief GET] error:", error);
    return NextResponse.json({ error: "Failed to fetch brief" }, { status: 500 });
  }
}

const putSchema = z.object({ content: z.string().max(BRIEF_MAX) });

// PUT /api/projects/:projectId/brief — create or update the brief.
export async function PUT(
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
    const { content } = putSchema.parse(body);

    const brief = await prisma.projectBrief.upsert({
      where: { projectId },
      create: { projectId, content, lastEditedById: userId },
      update: { content, lastEditedById: userId },
      select: briefSelect,
    });
    return NextResponse.json(brief);
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
    console.error("[project brief PUT] error:", error);
    return NextResponse.json({ error: "Failed to save brief" }, { status: 500 });
  }
}

// DELETE /api/projects/:projectId/brief
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { projectId } = await params;
    await verifyProjectAccess(userId, projectId, { requireWrite: true });

    // deleteMany, not delete: no-op (no throw) when there's no brief yet.
    await prisma.projectBrief.deleteMany({ where: { projectId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[project brief DELETE] error:", error);
    return NextResponse.json({ error: "Failed to delete brief" }, { status: 500 });
  }
}
