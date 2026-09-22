import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getProjectAccess } from "@/lib/project-access";

/**
 * GET /api/projects/:projectId/forms[?includeClosed=1] — list the
 *   project's forms. Returns the full FormRow shape (incl. settings)
 *   because the Workflow tab needs it to populate the editor. Closed
 *   forms (isActive:false — "Delete form" is a soft close that keeps the
 *   submissions) are left out unless includeClosed=1 asks for them.
 *
 * Forms are created through POST /api/forms, the one create path the
 * builder uses; this route used to carry a second, drifting copy of the
 * field schema that nothing called.
 */

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    // Canonical read rule (matches the page). 404 for a project the caller
    // can't read, so its id can't be probed.
    const access = await getProjectAccess(projectId, userId);
    if (!access.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const includeClosed =
      new URL(req.url).searchParams.get("includeClosed") === "1";
    const forms = await prisma.form.findMany({
      where: { projectId, ...(includeClosed ? {} : { isActive: true }) },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { submissions: true } },
      },
    });

    return NextResponse.json(
      forms.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        fields: f.fields,
        isActive: f.isActive,
        projectId: f.projectId,
        defaultSectionId: f.defaultSectionId,
        defaultAssigneeId: f.defaultAssigneeId,
        confirmationMessage: f.confirmationMessage,
        notifyOnSubmission: f.notifyOnSubmission,
        visibility: f.visibility,
        settings: f.settings ?? null,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
        submissionCount: f._count.submissions,
      }))
    );
  } catch (err) {
    console.error("[forms GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch forms" },
      { status: 500 }
    );
  }
}
