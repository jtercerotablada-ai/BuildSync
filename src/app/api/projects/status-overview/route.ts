import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId } from "@/lib/auth-guards";
import { getLevel } from "@/lib/people-types";

/**
 * GET /api/projects/status-overview
 *
 * Powers the home dashboard's "Project Status" widget. Returns one
 * row per ACTIVE project the user can see, with each project's
 * current status pill + its most recent status update + days since
 * that update was posted (so the widget can flag "stale" projects
 * that haven't been updated in 14+ days).
 *
 * This is intentionally different from /api/status-updates which
 * returns a chronological FEED of posts. The feed model hides
 * projects that haven't posted recently — exactly the projects a
 * PM most needs to be reminded about. The per-project model never
 * loses sight of a project just because its owner went silent.
 *
 * Access scope: same as the projects list — workspace leadership
 * (OWNER/ADMIN role or L4+ position) sees all workspace projects;
 * everyone else only sees projects they own, are a member of, or
 * that are PUBLIC. Completed and archived projects are filtered OUT
 * because the widget is for "current work" only.
 *
 * Params: ?limit= (1–30, default 8) · ?workspaceId= (optional; must
 * be a workspace the caller belongs to, else the default heuristic).
 */
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "8", 10), 1),
      30
    );

    // Optional ?workspaceId= override (additive) — only honored when
    // the caller is actually a member of that workspace, so the param
    // can never probe another workspace's PUBLIC projects. Absent or
    // non-member → the same default-workspace heuristic as before.
    const requestedWorkspaceId = searchParams.get("workspaceId");
    const workspaceId =
      requestedWorkspaceId &&
      (await prisma.workspaceMember.findFirst({
        where: { userId, workspaceId: requestedWorkspaceId },
        select: { userId: true },
      }))
        ? requestedWorkspaceId
        : await getUserWorkspaceId(userId);

    // Mirror /api/projects GET's visibility rules: workspace
    // leadership (OWNER/ADMIN role) and L4+ positions see every
    // workspace project; L1–L3 only see projects they own, are a
    // member of, or that are PUBLIC. visibility=WORKSPACE does NOT
    // auto-grant — that leaked projects to invited users who were
    // only meant to see one specific project.
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId, workspaceId },
      select: { role: true, user: { select: { position: true } } },
    });
    const seesAllInWorkspace =
      membership != null &&
      (membership.role === "OWNER" ||
        membership.role === "ADMIN" ||
        getLevel(membership.user.position) >= 4);

    const projects = await prisma.project.findMany({
      where: {
        workspaceId,
        // Exclude COMPLETE — they don't need ongoing status updates.
        // ON_HOLD intentionally stays IN: a paused project still
        // deserves a "why are we paused?" check-in.
        status: { not: "COMPLETE" },
        // Archived projects are done being tracked — hide them just
        // like GET /api/projects does by default.
        isArchived: false,
        OR: seesAllInWorkspace
          ? undefined
          : [
              { ownerId: userId },
              { members: { some: { userId } } },
              { visibility: "PUBLIC" },
            ],
      },
      select: {
        id: true,
        name: true,
        color: true,
        status: true,
        gate: true,
        workspaceId: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 50, // pull a wider pool so the staleness sort has data to work with
    });

    if (projects.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch the latest status update per project in ONE query, then
    // group in JS. Prisma's `distinct` + `orderBy` combination on
    // postgres returns the first row per distinct value when sorted
    // correctly — equivalent to a SELECT DISTINCT ON in SQL.
    const projectIds = projects.map((p) => p.id);
    const latestUpdates = await prisma.statusUpdate.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: [{ projectId: "asc" }, { createdAt: "desc" }],
      distinct: ["projectId"],
      select: {
        id: true,
        projectId: true,
        status: true,
        summary: true,
        createdAt: true,
        authorId: true,
      },
    });

    // Resolve author names in one batch — cheap because there are
    // at most `projects.length` unique authors.
    const authorIds = [
      ...new Set(
        latestUpdates
          .map((u) => u.authorId)
          .filter((id): id is string => typeof id === "string")
      ),
    ];
    const authors =
      authorIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: authorIds } },
            select: { id: true, name: true, email: true, image: true },
          })
        : [];
    const authorById = new Map(authors.map((a) => [a.id, a] as const));
    const updateByProject = new Map(latestUpdates.map((u) => [u.projectId, u] as const));

    const now = Date.now();
    const rows = projects.map((p) => {
      const u = updateByProject.get(p.id) || null;
      const author = u?.authorId ? authorById.get(u.authorId) : null;
      const daysSinceUpdate = u
        ? Math.floor((now - u.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        id: p.id,
        name: p.name,
        color: p.color,
        // Which workspace this rollup was scoped to — lets the widget
        // scope its "Post update" picker to the same workspace instead
        // of the picker spanning every membership (additive field).
        workspaceId: p.workspaceId,
        // Current project-level status (the pill the user sees on
        // the project header). Independent from the last update's
        // status — they can diverge if status was changed via the
        // header dropdown without posting an update.
        status: p.status,
        gate: p.gate,
        lastUpdate: u
          ? {
              id: u.id,
              status: u.status,
              summary: u.summary,
              createdAt: u.createdAt.toISOString(),
              author: author
                ? {
                    name: author.name || author.email || "Someone",
                    image: author.image,
                  }
                : null,
            }
          : null,
        // null = never updated; widget shows "Post first update".
        // >= 14 = stale; widget paints a warning row.
        daysSinceUpdate,
      };
    });

    // Sort order — what surfaces at the top:
    //   1. Never-updated projects (most critical to address)
    //   2. Stale (>= 14 days since last update)
    //   3. Off-track (current project status)
    //   4. At-risk
    //   5. On-hold
    //   6. On-track (healthy, least urgent to surface)
    // Within each bucket, by oldest update first (most overdue).
    const STATUS_RANK: Record<string, number> = {
      OFF_TRACK: 0,
      AT_RISK: 1,
      ON_HOLD: 2,
      ON_TRACK: 3,
      COMPLETE: 4, // shouldn't appear (filtered above) but defensive
    };
    rows.sort((a, b) => {
      const aNever = a.daysSinceUpdate == null ? 1 : 0;
      const bNever = b.daysSinceUpdate == null ? 1 : 0;
      if (aNever !== bNever) return bNever - aNever; // never-updated first

      const aStale = (a.daysSinceUpdate ?? 0) >= 14 ? 1 : 0;
      const bStale = (b.daysSinceUpdate ?? 0) >= 14 ? 1 : 0;
      if (aStale !== bStale) return bStale - aStale; // stale next

      const sr =
        (STATUS_RANK[a.status] ?? 5) - (STATUS_RANK[b.status] ?? 5);
      if (sr !== 0) return sr;

      // Tie-break: oldest update floats up.
      return (b.daysSinceUpdate ?? 0) - (a.daysSinceUpdate ?? 0);
    });

    return NextResponse.json(rows.slice(0, limit));
  } catch (error) {
    console.error("Error fetching project status overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch project status overview" },
      { status: 500 }
    );
  }
}
