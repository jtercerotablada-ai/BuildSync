import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

/**
 * GET /api/projects/[projectId]/brief
 *
 * Returns the brief if one exists, or `null` so the client can show
 * an empty "Add a brief" CTA without treating it as an error. Brief
 * is a 1:1 with Project — fetched separately from the rest of the
 * project payload so the project detail page doesn't pay for the
 * HTML blob on every navigation.
 *
 * Added during QC Fase 2 P2 (May 23 2026) — Asana parity.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { projectId } = await params;

  // Lightweight access check — the user must be the project owner,
  // a member, or own the parent workspace. Same shape used elsewhere
  // in the project API. We don't need the full ProjectMember lookup
  // because we never expose data scoped to other users from this
  // endpoint, just the brief content.
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
        { workspace: { ownerId: userId } },
        { workspace: { members: { some: { userId } } } },
      ],
    },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const brief = await prisma.projectBrief.findUnique({
    where: { projectId },
    include: {
      lastEditedBy: {
        select: { id: true, name: true, image: true },
      },
    },
  });

  return NextResponse.json(brief);
}

const briefSchema = z.object({
  content: z.string().max(200_000), // 200KB hard cap
});

/**
 * PUT /api/projects/[projectId]/brief
 *
 * Upserts the project brief. Same access rules as GET — must be a
 * member or owner of the project / workspace. Records who edited.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
        { workspace: { ownerId: userId } },
        { workspace: { members: { some: { userId } } } },
      ],
    },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = briefSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const brief = await prisma.projectBrief.upsert({
    where: { projectId },
    create: {
      projectId,
      content: parsed.data.content,
      lastEditedById: userId,
    },
    update: {
      content: parsed.data.content,
      lastEditedById: userId,
    },
    include: {
      lastEditedBy: {
        select: { id: true, name: true, image: true },
      },
    },
  });

  return NextResponse.json(brief);
}
