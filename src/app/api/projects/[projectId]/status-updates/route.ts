import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

const STATUS_VALUES = [
  "ON_TRACK",
  "AT_RISK",
  "OFF_TRACK",
  "ON_HOLD",
  "COMPLETE",
] as const;

const createSchema = z.object({
  status: z.enum(STATUS_VALUES),
  summary: z.string().min(1).max(4000),
  // When true we also patch the project itself so the cockpit-wide
  // status badge stays in sync. Front-end posts this every time —
  // PMs expect the "Update status" action to drive the badge.
  syncProjectStatus: z.boolean().optional().default(true),
});

async function assertProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      visibility: true,
      workspaceId: true,
      members: { select: { userId: true, role: true } },
    },
  });

  if (!project) return { ok: false as const, status: 404 };

  const member = project.members.find((m) => m.userId === userId) ?? null;
  const isOwner = project.ownerId === userId;
  const isMember = !!member;
  if (isOwner || isMember || project.visibility === "PUBLIC") {
    return { ok: true as const, project, member };
  }

  if (project.visibility === "WORKSPACE") {
    const wsMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: project.workspaceId },
      },
    });
    if (wsMember) return { ok: true as const, project, member: null };
  }

  return { ok: false as const, status: 403 };
}

// Mirrors the role gate in /api/projects/[id] PATCH: only the owner,
// an ADMIN, or an EDITOR can change the live project.status. Anyone
// with read access can still post a status-update record — they just
// can't drive the cockpit-wide badge.
function canEditProject(
  project: { ownerId: string | null },
  member: { role: string } | null,
  userId: string
): boolean {
  if (project.ownerId === userId) return true;
  if (!member) return false;
  return member.role === "ADMIN" || member.role === "EDITOR";
}

// GET /api/projects/:projectId/status-updates
// Returns history of status updates for this project, newest first.
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

    const updates = await prisma.statusUpdate.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const authorIds = [
      ...new Set(updates.map((u) => u.authorId).filter(Boolean)),
    ] as string[];
    const authors = authorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, name: true, email: true, image: true },
        })
      : [];
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    const mapped = updates.map((u) => {
      const a = u.authorId ? authorMap.get(u.authorId) : null;
      return {
        id: u.id,
        status: u.status,
        summary: u.summary,
        createdAt: u.createdAt.toISOString(),
        author: a
          ? { id: a.id, name: a.name, email: a.email, image: a.image }
          : null,
      };
    });

    return NextResponse.json(mapped);
  } catch (err) {
    console.error("[project status-updates GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch status updates" },
      { status: 500 }
    );
  }
}

// POST /api/projects/:projectId/status-updates
// Posts a new status update + optionally syncs Project.status.
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
    const access = await assertProjectAccess(projectId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 404 ? "Not found" : "Forbidden" },
        { status: access.status }
      );
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Posting a status-update record is open to any viewer/commenter
    // (they're posting a comment, effectively). But driving the live
    // project.status badge is a write action and gated to editors+.
    const wantsSync = parsed.data.syncProjectStatus;
    const canSync = canEditProject(access.project, access.member, userId);
    if (wantsSync && !canSync) {
      return NextResponse.json(
        {
          error:
            "You don't have permission to change this project's status. Ask an editor or admin.",
        },
        { status: 403 }
      );
    }

    const created = await prisma.statusUpdate.create({
      data: {
        projectId,
        authorId: userId,
        status: parsed.data.status,
        summary: parsed.data.summary.trim(),
      },
    });

    if (wantsSync) {
      await prisma.project.update({
        where: { id: projectId },
        data: { status: parsed.data.status },
      });
    }

    const author = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true },
    });

    return NextResponse.json(
      {
        id: created.id,
        status: created.status,
        summary: created.summary,
        createdAt: created.createdAt.toISOString(),
        author: author ?? null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[project status-updates POST] error:", err);
    return NextResponse.json(
      { error: "Failed to create status update" },
      { status: 500 }
    );
  }
}
