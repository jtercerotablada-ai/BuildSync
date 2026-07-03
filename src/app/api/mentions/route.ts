import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";
import { getLevel } from "@/lib/people-types";

// GET /api/mentions - Get comments mentioning the current user
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10") || 10, 1), 100);

    // Resolve per-workspace project visibility, mirroring GET /api/projects:
    // OWNER/ADMIN or Position level >= 4 see every project in the workspace;
    // everyone else only sees projects they own, are a member of, or PUBLIC.
    // Scoping mentions by workspace alone leaked comment text (and a 404 link)
    // for @-mentions in PRIVATE projects the user isn't a member of.
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        user: { select: { position: true } },
      },
    });

    if (memberships.length === 0) {
      throw new AuthorizationError("No workspace found");
    }

    const projectVisibilityClauses = memberships.map((m) => {
      const role = m.role;
      const level = getLevel(m.user.position);
      const isWorkspaceLeadership = role === "OWNER" || role === "ADMIN";
      const seesAllInWorkspace = isWorkspaceLeadership || level >= 4;

      if (seesAllInWorkspace) {
        return { workspaceId: m.workspaceId };
      }

      return {
        workspaceId: m.workspaceId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
          { visibility: "PUBLIC" as const },
        ],
      };
    });

    // Search for comments that contain the user's ID in a data-user-id attribute
    // The mention format is: <span data-user-id="userId">@Name</span>
    const comments = await prisma.comment.findMany({
      where: {
        content: {
          contains: `data-user-id="${userId}"`,
        },
        // Don't show user's own comments
        authorId: {
          not: userId,
        },
        // Scope to projects the user is actually allowed to see, plus
        // personal (project-less) tasks the user created or is assigned to
        // (verifyTaskAccess grants creator OR assignee).
        task: {
          OR: [
            { project: { OR: projectVisibilityClauses } },
            { projectId: null, OR: [{ creatorId: userId }, { assigneeId: userId }] },
          ],
        },
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
        task: {
          select: {
            id: true,
            name: true,
            projectId: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    // Transform to the expected format
    const mentions = comments.map((comment) => ({
      id: comment.id,
      content: stripHtmlTags(comment.content),
      taskId: comment.task.id,
      taskName: comment.task.name,
      projectId: comment.task.projectId,
      createdAt: comment.createdAt.toISOString(),
      author: {
        name: comment.author?.name || "Unknown",
        image: comment.author?.image || null,
      },
    }));

    return NextResponse.json(mentions);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching mentions:", error);
    return NextResponse.json(
      { error: "Failed to fetch mentions" },
      { status: 500 }
    );
  }
}

// Helper function to strip HTML tags but preserve text content
function stripHtmlTags(html: string): string {
  // Replace mention spans with @Name format
  let text = html.replace(/<span[^>]*data-user-id="[^"]*"[^>]*>([^<]*)<\/span>/gi, "$1");
  // Remove remaining HTML tags
  text = text.replace(/<[^>]*>/g, "");
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  // Trim and normalize whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}
