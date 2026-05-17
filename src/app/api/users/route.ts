import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

/**
 * GET /api/users
 *
 * Query params:
 *   ?limit=20                 max users returned (default 20)
 *   ?filter=all|frequent      "frequent" ranks by shared-project count
 *   ?includeStats=true        also attach per-user overdueCount + completedCount
 *   ?period=week|month        time window for completedCount (default week)
 *
 * Stats semantics (when includeStats=true):
 *   overdueCount   incomplete tasks assigned to this user with dueDate < today
 *   completedCount tasks this user completed since the start of the period
 *                  (start of week = Monday 00:00 local, start of month = day 1)
 *
 * Both counts are scoped to the caller's workspace so a user can't
 * leak counts from projects they don't share.
 */
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const filter = (searchParams.get("filter") || "all") as "all" | "frequent";
    const includeStats = searchParams.get("includeStats") === "true";
    const period = (searchParams.get("period") || "week") as "week" | "month";

    // Find the caller's primary workspace.
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
      orderBy: { joinedAt: "asc" },
    });
    if (!workspaceMember) return NextResponse.json([]);
    const { workspaceId } = workspaceMember;

    // ── 1. Resolve the candidate user list (filtered + ordered) ────
    const userSelect = {
      id: true,
      name: true,
      email: true,
      image: true,
      jobTitle: true,
    } as const;

    let members: Array<{
      id: string;
      name: string | null;
      // Prisma User.email is nullable in this schema, so the type
      // must match. The widget gracefully falls back to the name on
      // missing emails.
      email: string | null;
      image: string | null;
      jobTitle: string | null;
    }> = [];

    if (filter === "frequent") {
      // Frequent = shares the most projects with the caller. Falls
      // back to workspace-wide member list when the caller is in zero
      // projects or no shared members exist.
      const callerProjects = await prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });
      const projectIds = callerProjects.map((pm) => pm.projectId);

      if (projectIds.length > 0) {
        const sharedMembers = await prisma.projectMember.groupBy({
          by: ["userId"],
          where: {
            projectId: { in: projectIds },
            userId: { not: userId },
          },
          _count: { projectId: true },
          orderBy: { _count: { projectId: "desc" } },
          take: limit,
        });

        const frequentUserIds = sharedMembers.map((m) => m.userId);
        if (frequentUserIds.length > 0) {
          const users = await prisma.user.findMany({
            where: { id: { in: frequentUserIds } },
            select: userSelect,
          });
          // Preserve frequency ordering.
          const userMap = new Map(users.map((u) => [u.id, u]));
          members = frequentUserIds
            .map((id) => userMap.get(id))
            .filter((u): u is NonNullable<typeof u> => Boolean(u));
        }
      }
    }

    if (members.length === 0) {
      // Either filter=all, OR filter=frequent fell back to workspace.
      members = await prisma.user.findMany({
        where: {
          workspaceMembers: { some: { workspaceId } },
          id: { not: userId },
        },
        select: userSelect,
        orderBy: { name: "asc" },
        take: limit,
      });
    }

    // ── 2. Stats enrichment (opt-in) ───────────────────────────────
    if (!includeStats || members.length === 0) {
      return NextResponse.json(members);
    }

    const memberIds = members.map((m) => m.id);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Start of the period:
    //   week  → most recent Monday at 00:00 (Mon=1 ... Sun=0 → 7)
    //   month → first of this month at 00:00
    let periodStart: Date;
    if (period === "month") {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      const day = now.getDay() === 0 ? 7 : now.getDay();
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day - 1));
    }

    const [overdueRows, completedRows] = await Promise.all([
      prisma.task.groupBy({
        by: ["assigneeId"],
        where: {
          assigneeId: { in: memberIds },
          completedAt: null,
          dueDate: { lt: today },
          project: { workspaceId },
        },
        _count: { _all: true },
      }),
      prisma.task.groupBy({
        by: ["assigneeId"],
        where: {
          assigneeId: { in: memberIds },
          completedAt: { gte: periodStart },
          project: { workspaceId },
        },
        _count: { _all: true },
      }),
    ]);

    // Map results onto member ids — groupBy types `assigneeId` as
    // nullable so we filter out nulls before building the lookup.
    const overdueByUser = new Map<string, number>(
      overdueRows
        .filter((r): r is typeof r & { assigneeId: string } => r.assigneeId !== null)
        .map((r) => [r.assigneeId, r._count._all])
    );
    const completedByUser = new Map<string, number>(
      completedRows
        .filter((r): r is typeof r & { assigneeId: string } => r.assigneeId !== null)
        .map((r) => [r.assigneeId, r._count._all])
    );

    const enriched = members.map((m) => ({
      ...m,
      overdueCount: overdueByUser.get(m.id) ?? 0,
      completedCount: completedByUser.get(m.id) ?? 0,
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
