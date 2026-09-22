import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { fileReadUrl } from "@/lib/storage";
import { contributorSeatSatisfied } from "@/lib/auth-guards";

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

    // Being the assignee or creator of a task only counts while the caller
    // still holds a contributor seat in the task's workspace — the same rule
    // the task gate applies. Someone offboarded from the firm (or demoted to
    // a guest seat) must not keep listing the firm's attachments here.
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true, role: true },
    });
    const seatWorkspaceIds = memberships
      .filter((m) => contributorSeatSatisfied(m.role))
      .map((m) => m.workspaceId);
    if (seatWorkspaceIds.length === 0) {
      return NextResponse.json({ files: [] });
    }

    const attachments = await prisma.attachment.findMany({
      where: {
        taskId: { not: null },
        task: {
          AND: [
            { OR: [{ assigneeId: userId }, { creatorId: userId }] },
            {
              OR: [
                { project: { workspaceId: { in: seatWorkspaceIds } } },
                // Personal to-dos have no project, hence no workspace; they
                // are the caller's own.
                { projectId: null },
              ],
            },
          ],
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

    // Never ship the stored blob url: a private one is unfetchable from the
    // browser, and a public one (legacy, or any upload while SAAS_BLOB_ACCESS
    // is public) is a login-less permanent link.
    return NextResponse.json({
      files: attachments.map((a) => ({ ...a, url: fileReadUrl("attachment", a.id) })),
    });
  } catch (error) {
    console.error("Error fetching my-tasks files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}
