import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getErrorStatus } from "@/lib/auth-guards";
import { requireTeamStanding } from "@/lib/team-access";
import { taskPrivacyClause } from "@/lib/project-visibility";

// GET /api/teams/:teamId/tasks - Get tasks from team's projects (for calendar)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Team membership AND a live contributor seat in the team's workspace —
    // a TeamMember row survives offboarding and used to be the whole gate.
    await requireTeamStanding(userId, teamId);

    // All tasks from the team's projects. Dateless tasks are included on
    // purpose — the shared CalendarView surfaces them via its "No date (N)"
    // drawer (Asana parity) instead of hiding them. startDate/priority/
    // taskType/description are what the multi-day bars + detail need.
    //
    // PRIVACY. This query used to name no caller at all, so every team member
    // got the identical result set: a task flagged `isPrivate` — which 404s
    // by URL for a colleague via decideTaskAccess (@/lib/auth-guards) —
    // rendered on the team calendar with its name, description, due date and
    // assignee. Team membership grants PROJECT access (project-access.ts);
    // it has never granted an exemption from task privacy. taskPrivacyClause
    // is the list-query half of that same decision, shared with search,
    // reports and /api/ai/assist so the four cannot drift.
    const tasks = await prisma.task.findMany({
      where: {
        // Archived projects are off the team calendar, the same way the
        // team's Work and Projects lists already leave them out.
        project: {
          teamId,
          isArchived: false,
        },
        ...taskPrivacyClause(userId),
      },
      select: {
        id: true,
        name: true,
        description: true,
        dueDate: true,
        startDate: true,
        completed: true,
        priority: true,
        taskType: true,
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: {
        dueDate: "asc",
      },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching team tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

// No POST here on purpose. The team calendar creates tasks through POST
// /api/tasks (allowInlineCreate is off on that page), which places the task in
// a section with a position and an activity row. The old handler here did
// none of that — its tasks had no section, so no project view ever rendered
// them — and its "first project of the team" fallback could pick an archived
// project. It had no caller, so it went rather than being kept in sync.
