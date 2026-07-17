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

const MAX_CONTENT = 100000;
const MAX_TITLE = 255;

const updateNoteSchema = z
  .object({
    title: z.string().max(MAX_TITLE).optional(),
    content: z.string().max(MAX_CONTENT).optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

const noteSelect = {
  id: true,
  title: true,
  content: true,
  position: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, email: true, image: true } },
} as const;

/** Load the note and prove it belongs to the project in the URL, so a
 *  caller can't reach another project's note by id. */
async function loadNote(projectId: string, noteId: string) {
  const note = await prisma.projectNote.findUnique({
    where: { id: noteId },
    select: { id: true, projectId: true },
  });
  if (!note || note.projectId !== projectId) {
    throw new NotFoundError("Note not found");
  }
  return note;
}

// PATCH /api/projects/:projectId/notes/:noteId
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string; noteId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { projectId, noteId } = await params;
    await verifyProjectAccess(userId, projectId, { requireWrite: true });
    await loadNote(projectId, noteId);

    const body = await req.json();
    const data = updateNoteSchema.parse(body);

    const note = await prisma.projectNote.update({
      where: { id: noteId },
      data,
      select: noteSelect,
    });

    return NextResponse.json(note);
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
    console.error("[project note PATCH] error:", error);
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/:projectId/notes/:noteId
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; noteId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { projectId, noteId } = await params;
    await verifyProjectAccess(userId, projectId, { requireWrite: true });
    await loadNote(projectId, noteId);

    await prisma.projectNote.delete({ where: { id: noteId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[project note DELETE] error:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
