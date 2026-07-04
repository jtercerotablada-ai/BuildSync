import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { resolveProjectAccess } from "@/lib/project-access";

// GET /api/projects/:projectId/objectives
//
// Returns the Objectives (goals/OKRs) that have been linked to this
// project via the ObjectiveProject join table. Used by the Overview
// "Connected goals" panel to show progress + status of every linked
// goal at a glance.

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

  // Canonical read rule (matches the page): the old inline check leaked
  // WORKSPACE-visibility projects to any member and 403'd workspace admins.
  const access = await resolveProjectAccess(project, userId);
  if (!access.ok) return { ok: false as const, status: 403 };
  return { ok: true as const, project };
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

    const joins = await prisma.objectiveProject.findMany({
      where: { projectId },
      include: {
        objective: {
          select: {
            id: true,
            name: true,
            progress: true,
            status: true,
            endDate: true,
            period: true,
            owner: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    const goals = joins
      .map((j) => j.objective)
      .filter((o): o is NonNullable<typeof o> => o != null)
      .map((o) => ({
        id: o.id,
        name: o.name,
        progress: Math.max(0, Math.min(100, o.progress)),
        status: o.status,
        endDate: o.endDate ? o.endDate.toISOString() : null,
        period: o.period,
        owner: o.owner,
      }));

    return NextResponse.json(goals);
  } catch (err) {
    console.error("[project objectives GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch connected goals" },
      { status: 500 }
    );
  }
}
