import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId, AuthorizationError } from "@/lib/auth-guards";

/**
 * GET /api/users
 *
 * Query params:
 *   ?limit=20                 max users returned (default 20)
 *   ?filter=all|frequent      "frequent" ranks by shared-project count
 *   ?includeStats=true        also attach per-user overdueCount + completedCount + upcomingCount
 *   ?period=week|month        time window for completedCount (default week)
 *   ?tzOffset=300             caller's timezone offset in minutes, as returned by
 *                             JS Date.getTimezoneOffset() (positive = west of UTC,
 *                             e.g. UTC-5 → 300). Used to compute "today" and the
 *                             period bounds in the caller's zone.
 *   ?tz=America/New_York      alternative to tzOffset: an IANA zone name. Ignored
 *                             when tzOffset is present. When neither is supplied
 *                             the bounds fall back to the server's local time.
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
    const tzOffsetParam = searchParams.get("tzOffset");
    const tzParam = searchParams.get("tz");

    // Resolve the caller's effective workspace with the shared
    // multi-member heuristic (prefers the firm workspace over the
    // auto-created personal singleton) so the member list and stats
    // scope to the same workspace as the rest of the app.
    let workspaceId: string;
    try {
      workspaceId = await getUserWorkspaceId(userId);
    } catch (err) {
      if (err instanceof AuthorizationError) return NextResponse.json([]);
      throw err;
    }

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

    // Resolve the caller's calendar "now" (year/month/day/weekday) in their
    // own timezone so the buckets don't skew for users outside the server's
    // zone (this firm is UTC-5/-6). Due dates are stored at UTC midnight of
    // their calendar day (api/tasks/route.ts stores `new Date("YYYY-MM-DD")`),
    // so we build every boundary below with Date.UTC(...) to compare on the
    // same calendar frame.
    //
    //   tzOffset  minutes from Date.getTimezoneOffset(): UTC = local + offset,
    //             so positive means west of UTC (UTC-5 → 300). We subtract it
    //             from `now` and read the shifted instant with UTC getters to
    //             recover the caller's wall-clock date.
    //   tz        an IANA zone; Intl.DateTimeFormat yields the wall-clock parts
    //             directly. Ignored when tzOffset is present.
    // With neither param we keep the original server-local behavior.
    let y: number;
    let mo: number;
    let d: number;
    let weekday: number; // 0 = Sunday ... 6 = Saturday
    let toBoundary: (year: number, month: number, day: number) => Date;

    const tzOffset = tzOffsetParam !== null ? parseInt(tzOffsetParam, 10) : NaN;
    if (!Number.isNaN(tzOffset)) {
      const local = new Date(now.getTime() - tzOffset * 60000);
      y = local.getUTCFullYear();
      mo = local.getUTCMonth();
      d = local.getUTCDate();
      weekday = local.getUTCDay();
      toBoundary = (year, month, day) => new Date(Date.UTC(year, month, day));
    } else if (tzParam) {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tzParam,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        weekday: "short",
      }).formatToParts(now);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
      y = parseInt(get("year"), 10);
      mo = parseInt(get("month"), 10) - 1;
      d = parseInt(get("day"), 10);
      weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
        get("weekday")
      );
      toBoundary = (year, month, day) => new Date(Date.UTC(year, month, day));
    } else {
      y = now.getFullYear();
      mo = now.getMonth();
      d = now.getDate();
      weekday = now.getDay();
      toBoundary = (year, month, day) => new Date(year, month, day);
    }

    const today = toBoundary(y, mo, d);

    // Bounds of the period:
    //   week  → most recent Monday at 00:00 (Mon=1 ... Sun=0 → 7)
    //           through next Monday (exclusive)
    //   month → first of this month through first of next (exclusive)
    let periodStart: Date;
    let periodEnd: Date;
    if (period === "month") {
      periodStart = toBoundary(y, mo, 1);
      periodEnd = toBoundary(y, mo + 1, 1);
    } else {
      const day = weekday === 0 ? 7 : weekday;
      periodStart = toBoundary(y, mo, d - (day - 1));
      periodEnd = toBoundary(y, mo, d - (day - 1) + 7);
    }

    const [overdueRows, completedRows, upcomingRows] = await Promise.all([
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
      // Upcoming = incomplete, due today or later, due within the
      // selected period window. Mirrors Asana's "X próximas" stat
      // on the Personas widget — gives a fast read on each
      // collaborator's near-term load.
      prisma.task.groupBy({
        by: ["assigneeId"],
        where: {
          assigneeId: { in: memberIds },
          completedAt: null,
          dueDate: { gte: today, lt: periodEnd },
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
    const upcomingByUser = new Map<string, number>(
      upcomingRows
        .filter((r): r is typeof r & { assigneeId: string } => r.assigneeId !== null)
        .map((r) => [r.assigneeId, r._count._all])
    );

    const enriched = members.map((m) => ({
      ...m,
      overdueCount: overdueByUser.get(m.id) ?? 0,
      completedCount: completedByUser.get(m.id) ?? 0,
      upcomingCount: upcomingByUser.get(m.id) ?? 0,
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
