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

// Notes tab: many notes per project (Asana parity). The legacy single
// Project.notes column was backfilled into ProjectNote and is no longer
// read or written.

// Matches the client's editor limit; the HTML is sanitized client-side on
// load, paste and save.
const MAX_CONTENT = 100000;
const MAX_TITLE = 255;

const createNoteSchema = z.object({
  title: z.string().max(MAX_TITLE).optional().default(""),
  content: z.string().max(MAX_CONTENT).optional().default(""),
});

const noteSelect = {
  id: true,
  title: true,
  content: true,
  position: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, email: true, image: true } },
} as const;

// GET /api/projects/:projectId/notes — every note, list order.
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

    const notes = await prisma.projectNote.findMany({
      where: { projectId },
      select: noteSelect,
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(notes);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[project notes GET] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

// POST /api/projects/:projectId/notes — create a note (appended last).
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

    const body = await req.json().catch(() => ({}));
    const data = createNoteSchema.parse(body ?? {});

    const last = await prisma.projectNote.findFirst({
      where: { projectId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const note = await prisma.projectNote.create({
      data: {
        projectId,
        authorId: userId,
        title: data.title,
        content: data.content,
        position: (last?.position ?? -1) + 1,
      },
      select: noteSelect,
    });

    return NextResponse.json(note, { status: 201 });
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
    console.error("[project notes POST] error:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}
