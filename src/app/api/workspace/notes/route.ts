import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { requireWorkspaceContributor, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";

const HOME_NOTEPAD_TITLE = "__home_private_notepad__";

// GET /api/workspace/notes - Get workspace notes
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const title = searchParams.get("title");
    const showArchived = searchParams.get("archived") === "true";

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (!workspaceMember) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    // Opt-in slim mode: ?title= returns only exact-title matches as
    // { id, title, content, updatedAt } — the home notepad widget needs one
    // note, not every accessible note with author + collaborator objects.
    if (title !== null) {
      const slimNotes = await prisma.workspaceNote.findMany({
        where: {
          workspaceId: workspaceMember.workspaceId,
          isArchived: showArchived,
          title,
          OR: [
            { authorId: userId },
            { visibility: "WORKSPACE" },
            {
              visibility: "SHARED",
              collaborators: {
                some: { userId },
              },
            },
          ],
        },
        select: { id: true, title: true, content: true, updatedAt: true },
        orderBy: [
          { isPinned: "desc" },
          { updatedAt: "desc" },
        ],
      });
      return NextResponse.json(slimNotes);
    }

    const notes = await prisma.workspaceNote.findMany({
      where: {
        workspaceId: workspaceMember.workspaceId,
        isArchived: showArchived,
        AND: [
          {
            OR: [
              { authorId: userId },
              { visibility: "WORKSPACE" },
              {
                visibility: "SHARED",
                collaborators: {
                  some: { userId },
                },
              },
            ],
          },
          ...(search ? [{
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { content: { contains: search, mode: "insensitive" as const } },
            ],
          }] : []),
        ],
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: [
        { isPinned: "desc" },
        { updatedAt: "desc" },
      ],
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

// POST /api/workspace/notes - Create a new note
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireWorkspaceContributor(userId);

    const { title, content, icon, color, visibility } = await req.json();

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (!workspaceMember) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    if (title === HOME_NOTEPAD_TITLE) {
      const existing = await prisma.workspaceNote.findFirst({
        where: {
          workspaceId: workspaceMember.workspaceId,
          authorId: userId,
          title: HOME_NOTEPAD_TITLE,
        },
        orderBy: { updatedAt: "desc" },
      });

      if (existing) {
        const updated = await prisma.workspaceNote.update({
          where: { id: existing.id },
          data: { content: content || "" },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            collaborators: true,
          },
        });

        return NextResponse.json(updated);
      }
    }

    const note = await prisma.workspaceNote.create({
      data: {
        title,
        content: content || "",
        icon,
        color,
        visibility: visibility || "PRIVATE",
        workspaceId: workspaceMember.workspaceId,
        authorId: userId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        collaborators: true,
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}

// PUT /api/workspace/notes - Update a note
export async function PUT(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireWorkspaceContributor(userId);

    const { id, title, content, icon, color, visibility, isPinned, isArchived } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Note ID required" }, { status: 400 });
    }

    // Check access
    const note = await prisma.workspaceNote.findUnique({
      where: { id },
      include: {
        collaborators: true,
      },
    });

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const isAuthor = note.authorId === userId;
    const collaborator = note.collaborators.find((c) => c.userId === userId);
    const canEdit = isAuthor || collaborator?.permission === "EDIT" || collaborator?.permission === "ADMIN";

    if (!canEdit) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const updatedNote = await prisma.workspaceNote.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
        ...(visibility !== undefined && isAuthor && { visibility }),
        ...(isPinned !== undefined && { isPinned }),
        ...(isArchived !== undefined && { isArchived }),
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedNote);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error updating note:", error);
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspace/notes - Delete a note
export async function DELETE(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireWorkspaceContributor(userId);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Note ID required" }, { status: 400 });
    }

    // Only author can delete
    const note = await prisma.workspaceNote.findUnique({
      where: { id },
    });

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (note.authorId !== userId) {
      return NextResponse.json({ error: "Only the author can delete this note" }, { status: 403 });
    }

    await prisma.workspaceNote.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
