import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// GET /api/projects/:projectId/activity
//
// Aggregates a project-scoped activity feed by pulling from already-
// existing tables (StatusUpdate, ProjectMember.joinedAt, Task.completedAt
// and Task.createdAt + File.createdAt). Returns the 30 most recent
// events normalized into a single shape the UI can render directly.
//
// This is intentionally read-only and derived — no separate "Activity"
// table is needed today. If we later add audit-log style tracking we
// can swap the source without touching the front-end shape.

type ActivityType =
  | "status_update"
  | "member_joined"
  | "task_completed"
  | "task_created"
  | "file_uploaded";

interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  detail?: string | null;
  status?: string | null; // For status_update
  createdAt: string;
  actor: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

async function assertProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      visibility: true,
      workspaceId: true,
      members: { select: { userId: true } },
    },
  });

  if (!project) return { ok: false as const, status: 404 };

  const isOwner = project.ownerId === userId;
  const isMember = project.members.some((m) => m.userId === userId);
  if (isOwner || isMember || project.visibility === "PUBLIC") {
    return { ok: true as const, project };
  }

  if (project.visibility === "WORKSPACE") {
    const wsMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: project.workspaceId },
      },
    });
    if (wsMember) return { ok: true as const, project };
  }

  return { ok: false as const, status: 403 };
}

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
    const access = await assertProjectAccess(projectId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 404 ? "Not found" : "Forbidden" },
        { status: access.status }
      );
    }

    // Pull the source rows in parallel. Each query is capped low so we
    // can merge + sort + slice down to 30 without scanning huge tables.
    const [statusUpdates, members, completedTasks, recentTasks, recentFiles] =
      await Promise.all([
        prisma.statusUpdate.findMany({
          where: { projectId },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.projectMember.findMany({
          where: { projectId },
          orderBy: { joinedAt: "desc" },
          take: 20,
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        }),
        prisma.task.findMany({
          where: {
            projectId,
            completed: true,
            completedAt: { not: null },
          },
          orderBy: { completedAt: "desc" },
          take: 20,
          select: {
            id: true,
            name: true,
            completedAt: true,
            assigneeId: true,
            assignee: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        }),
        prisma.task.findMany({
          where: { projectId },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            name: true,
            createdAt: true,
            creatorId: true,
            creator: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        }),
        prisma.file.findMany({
          where: { projectId },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            name: true,
            createdAt: true,
            uploaderId: true,
            uploader: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        }),
      ]);

    const authorIds = [
      ...new Set(statusUpdates.map((u) => u.authorId).filter(Boolean)),
    ] as string[];
    const authors = authorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, name: true, email: true, image: true },
        })
      : [];
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    const events: ActivityEvent[] = [];

    for (const u of statusUpdates) {
      const a = u.authorId ? authorMap.get(u.authorId) : null;
      events.push({
        id: `status:${u.id}`,
        type: "status_update",
        title: "Posted a status update",
        detail: u.summary.slice(0, 240),
        status: u.status,
        createdAt: u.createdAt.toISOString(),
        actor: a
          ? { id: a.id, name: a.name, email: a.email, image: a.image }
          : null,
      });
    }

    for (const m of members) {
      events.push({
        id: `member:${m.id}`,
        type: "member_joined",
        title: `Joined as ${m.role.charAt(0)}${m.role.slice(1).toLowerCase()}`,
        detail: null,
        createdAt: m.joinedAt.toISOString(),
        actor: m.user
          ? {
              id: m.user.id,
              name: m.user.name,
              email: m.user.email,
              image: m.user.image,
            }
          : null,
      });
    }

    for (const t of completedTasks) {
      if (!t.completedAt) continue;
      events.push({
        id: `done:${t.id}`,
        type: "task_completed",
        title: "Completed a task",
        detail: t.name,
        createdAt: t.completedAt.toISOString(),
        actor: t.assignee ?? null,
      });
    }

    for (const t of recentTasks) {
      events.push({
        id: `new:${t.id}`,
        type: "task_created",
        title: "Created a task",
        detail: t.name,
        createdAt: t.createdAt.toISOString(),
        actor: t.creator ?? null,
      });
    }

    for (const f of recentFiles) {
      events.push({
        id: `file:${f.id}`,
        type: "file_uploaded",
        title: "Uploaded a file",
        detail: f.name,
        createdAt: f.createdAt.toISOString(),
        actor: f.uploader ?? null,
      });
    }

    events.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json(events.slice(0, 30));
  } catch (err) {
    console.error("[project activity GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch project activity" },
      { status: 500 }
    );
  }
}
