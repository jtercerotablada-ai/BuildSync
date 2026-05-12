import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

/**
 * GET /api/my-tasks/files
 *
 * Every attachment that belongs to a task assigned to the current
 * user OR created by the current user. Powers the "Files" tab on
 * /my-tasks (until now a placeholder empty state).
 *
 * Returns: { files: TaskAttachment[] }
 *   TaskAttachment includes the parent task (id, name, project) so
 *   the UI can render the file card with its source task and
 *   navigate back to it on click.
 *
 * Sorted newest-first.
 */
export async function GET(_req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const attachments = await prisma.attachment.findMany({
      where: {
        taskId: { not: null },
        task: {
          OR: [{ assigneeId: userId }, { creatorId: userId }],
        },
      },
      include: {
        task: {
          select: {
            id: true,
            name: true,
            completed: true,
            project: {
              select: { id: true, name: true, color: true },
            },
          },
        },
        uploader: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200, // sensible cap; pagination later if needed
    });

    return NextResponse.json({ files: attachments });
  } catch (error) {
    console.error("Error fetching my-tasks files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}
