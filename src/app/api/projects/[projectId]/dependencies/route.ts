import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getProjectAccess } from "@/lib/project-access";

// GET /api/projects/:projectId/dependencies
//
// Returns every TaskDependency row whose dependent task lives inside
// this project. Used by the Timeline / Gantt view to draw the
// FINISH-TO-START (and friends) arrows between task bars.
//
// The shape is intentionally narrow — front-end only needs the two
// task ids, the dependency type, and the row id (to enable future
// delete / patch flows).

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
    // Use the canonical project-access rule (same as the page): the old
    // inline check granted read to ANY workspace member on WORKSPACE
    // visibility (a leak) yet 403'd workspace admins on PRIVATE projects.
    const access = await getProjectAccess(projectId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 404 ? "Not found" : "Forbidden" },
        { status: access.status }
      );
    }

    // Only deps where both endpoints live in this project. A task
    // can technically depend on a task in another project; for the
    // current Gantt view we only render same-project deps.
    const deps = await prisma.taskDependency.findMany({
      where: {
        dependentTask: { projectId },
        blockingTask: { projectId },
      },
      select: {
        id: true,
        type: true,
        dependentTaskId: true,
        blockingTaskId: true,
      },
    });

    return NextResponse.json(deps);
  } catch (err) {
    console.error("[project dependencies GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch dependencies" },
      { status: 500 }
    );
  }
}
