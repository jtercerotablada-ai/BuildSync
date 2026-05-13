import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

/**
 * GET /api/forms/:formId/submissions
 *
 * Lists submissions for a form — auth-gated to anyone who can read
 * the parent project. Returns the answer payload + the auto-created
 * task id so the UI can link to the task in the project.
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { formId } = await params;

    const form = await prisma.form.findUnique({
      where: { id: formId },
      include: {
        project: {
          select: {
            id: true,
            ownerId: true,
            visibility: true,
            workspaceId: true,
            members: { select: { userId: true } },
          },
        },
      },
    });
    if (!form) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Access check — same shape as the rest of the workflow endpoints.
    const member = form.project.members.find((m) => m.userId === userId);
    const isOwner = form.project.ownerId === userId;
    const isMember = !!member;
    let allowed = isOwner || isMember || form.project.visibility === "PUBLIC";
    if (!allowed && form.project.visibility === "WORKSPACE") {
      const wsMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: form.project.workspaceId,
          },
        },
      });
      if (wsMember) allowed = true;
    }
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const submissions = await prisma.formSubmission.findMany({
      where: { formId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(
      submissions.map((s) => ({
        id: s.id,
        data: s.data,
        taskId: s.taskId,
        createdAt: s.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error("[submissions GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }
}
