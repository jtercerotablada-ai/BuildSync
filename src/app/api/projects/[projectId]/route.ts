import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getProjectAccess, resolveProjectAccess } from "@/lib/project-access";

// Schedule dates arrive as ISO strings. Validate them at the edge so a
// malformed one comes back as a 400 naming the field, instead of reaching
// Prisma as an `Invalid Date` and falling through to the generic 500. An
// empty string is still accepted: the handler below reads it as "no date".
const dateString = z
  .string()
  .refine((s) => s === "" || !Number.isNaN(Date.parse(s)), "Invalid date");

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  notes: z.string().max(100000).optional().nullable(),
  color: z.string().optional(),
  status: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK", "ON_HOLD", "COMPLETE"]).optional(),
  visibility: z.enum(["PRIVATE", "WORKSPACE", "PUBLIC"]).optional(),
  isArchived: z.boolean().optional(),
  startDate: dateString.optional().nullable(),
  endDate: dateString.optional().nullable(),
  // Engineering firm extensions — mirrors the create schema in route.ts
  type: z.enum(["CONSTRUCTION", "DESIGN", "RECERTIFICATION", "PERMIT"]).optional().nullable(),
  gate: z.enum(["PRE_DESIGN", "DESIGN", "PERMITTING", "CONSTRUCTION", "CLOSEOUT"]).optional().nullable(),
  location: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  budget: z.number().optional().nullable(),
  currency: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
});

// GET /api/projects/:projectId - Get project details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { projectId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        sections: {
          orderBy: { position: "asc" },
        },
        views: true,
        // Portfolios this project is connected to — powers the Share
        // dialog's "This project is connected to N portfolio(s)" line.
        // Cheap select on the already-loaded payload; no extra round-trip.
        portfolios: {
          select: {
            portfolio: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // ── Per-workspace access control ─────────────────────────
    // Delegated to resolveProjectAccess so this endpoint cannot drift from the
    // project page and the sub-routes. It used to keep its own copy of the
    // rule, and that copy let `visibility === "PUBLIC"` short-circuit the
    // workspace check entirely — any signed-in user of ANY workspace could
    // read the full project payload by id. resolveProjectAccess scopes PUBLIC
    // to the owning workspace.
    const access = await resolveProjectAccess(project, userId);

    if (!access.ok) {
      // Forward the resolver's own status and message (404 "Project not
      // found"), the way PATCH does below. A 403 "Access denied" confirmed the
      // id exists, which is exactly the probing the 404 is there to prevent.
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Flatten the portfolio join into a plain [{ id, name }] list the
    // Share dialog can render directly ("connected to N portfolio(s)")
    // without walking the nested `portfolios[].portfolio` relation. The
    // raw `portfolios` relation is left on the payload for backward
    // compatibility.
    const connectedPortfolios = project.portfolios.map((p) => p.portfolio);

    return NextResponse.json({ ...project, connectedPortfolios });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/:projectId - Update project
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { projectId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = updateProjectSchema.parse(body);

    // Canonical access resolution (scopes PUBLIC to the owning workspace, so a
    // cross-tenant caller gets 404 here rather than a read they can act on).
    const access = await getProjectAccess(projectId, userId);

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Edit rule unchanged: project owner, or a member with ADMIN/EDITOR.
    const canEdit =
      access.isOwner ||
      access.memberRole === "ADMIN" ||
      access.memberRole === "EDITOR";

    if (!canEdit) {
      return NextResponse.json(
        { error: "You don't have permission to edit this project" },
        { status: 403 }
      );
    }

    // Visibility is an ACCESS-CONTROL field, not project content. An EDITOR
    // could previously flip a project to PUBLIC and widen who can read it —
    // privilege escalation dressed up as an ordinary edit. Restrict it to the
    // people who already manage the project's membership: owner, project
    // ADMIN, or a workspace OWNER/ADMIN (access.canManage).
    if (data.visibility !== undefined && !access.canManage) {
      return NextResponse.json(
        { error: "Only a project admin can change visibility" },
        { status: 403 }
      );
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : data.startDate === null ? null : undefined,
        endDate: data.endDate ? new Date(data.endDate) : data.endDate === null ? null : undefined,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        sections: {
          orderBy: { position: "asc" },
        },
      },
    });

    return NextResponse.json(updatedProject);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return NextResponse.json(
        { error: zodError.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/:projectId - Delete project
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { projectId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Same canonical resolution as PATCH. The inline "owner or project ADMIN"
    // rule this replaced left out workspace managers, so the firm's workspace
    // owner could edit and share a colleague's project but never delete it.
    const access = await getProjectAccess(projectId, userId);

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    if (!access.canManage) {
      return NextResponse.json(
        { error: "You don't have permission to delete this project" },
        { status: 403 }
      );
    }

    await prisma.project.delete({
      where: { id: projectId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
