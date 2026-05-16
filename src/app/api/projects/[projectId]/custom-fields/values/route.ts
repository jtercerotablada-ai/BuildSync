/**
 * GET /api/projects/:projectId/custom-fields/values
 *
 * Returns every CustomFieldValue for every task in this project as a
 * compact map keyed by taskId → fieldId → value. Used by the list view
 * to render value cells in custom-field columns without making N round
 * trips to the per-task GET.
 *
 * Response shape:
 *   { [taskId: string]: { [fieldId: string]: unknown } }
 *
 * We intentionally don't include the definitions here — the caller
 * fetches `/api/projects/:id/custom-fields` separately to get the
 * column metadata (name, type, options). This route returns only the
 * values so it stays cheap to refetch on every task edit.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

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
    return { ok: true as const };
  }
  if (project.visibility === "WORKSPACE") {
    const wsMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: project.workspaceId },
      },
    });
    if (wsMember) return { ok: true as const };
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

    // One round-trip: pull every value whose task belongs to this
    // project. The (taskId, fieldId) unique index means at most one
    // row per pair so we can group in JS without de-duping.
    const rows = await prisma.customFieldValue.findMany({
      where: { task: { projectId } },
      select: { taskId: true, fieldId: true, value: true },
    });

    const map: Record<string, Record<string, unknown>> = {};
    for (const r of rows) {
      if (!map[r.taskId]) map[r.taskId] = {};
      map[r.taskId][r.fieldId] = r.value;
    }

    return NextResponse.json(map);
  } catch (err) {
    console.error("[custom-fields values GET] error:", err);
    return NextResponse.json(
      { error: "Failed to load values" },
      { status: 500 }
    );
  }
}
