import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyProjectAccess, getErrorStatus } from "@/lib/auth-guards";
import { requireTeamStanding } from "@/lib/team-access";
import { taskPrivacyClause } from "@/lib/project-visibility";

const createTaskSchema = z.object({
  name: z.string().min(1),
  dueDate: z.string(), // YYYY-MM-DD
  projectId: z.string().optional(),
});

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
        project: {
          teamId,
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

// POST /api/teams/:teamId/tasks - Create a task for the team calendar
export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { teamId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, dueDate, projectId } = createTaskSchema.parse(body);

    // Same standing the GET requires — one rule, not a second hand-rolled
    // membership lookup that only checked for a TeamMember row.
    await requireTeamStanding(userId, teamId);

    // When a projectId is supplied it MUST belong to this team. Without this
    // check a team member could inject tasks into an arbitrary project in
    // another team/workspace by guessing its id — audit (cross-tenant write).
    if (projectId) {
      const belongs = await prisma.project.findFirst({
        where: { id: projectId, teamId },
        select: { id: true },
      });
      if (!belongs) {
        return NextResponse.json(
          { error: "Project not found in this team" },
          { status: 404 }
        );
      }
    }

    // Resolve project: use provided or pick first team project
    let resolvedProjectId = projectId;
    if (!resolvedProjectId) {
      const firstProject = await prisma.project.findFirst({
        where: { teamId },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      if (!firstProject) {
        return NextResponse.json(
          { error: "Team has no projects. Create a project first." },
          { status: 400 }
        );
      }
      resolvedProjectId = firstProject.id;
    }

    // Team membership is not the same as write access to THIS project. An
    // explicit ProjectMember row always overrides the team grant —
    // resolveProjectAccess only computes isTeamMember when the caller is
    // neither owner nor member — so someone deliberately pinned to
    // VIEWER/COMMENTER on a team project has canWrite=false everywhere else
    // (POST /api/tasks correctly 403s them) and was creating tasks here
    // anyway. Runs after resolution so it covers BOTH the supplied projectId
    // and the "first project in the team" fallback. Ordinary team members are
    // unaffected: the team grant flows through resolveProjectAccess as
    // isTeamMember ⇒ canWrite.
    await verifyProjectAccess(userId, resolvedProjectId, {
      requireWrite: true,
    });

    const task = await prisma.task.create({
      data: {
        name,
        dueDate: new Date(dueDate),
        projectId: resolvedProjectId,
        creatorId: userId,
      },
      select: {
        id: true,
        name: true,
        dueDate: true,
        completed: true,
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
            image: true,
          },
        },
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    // Map the guards' AuthorizationError/NotFoundError to 403/404 the way GET
    // already does — without this the new verifyProjectAccess denial would
    // surface as a generic 500.
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }

    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
