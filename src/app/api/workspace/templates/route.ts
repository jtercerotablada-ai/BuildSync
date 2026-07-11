import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId, AuthorizationError, NotFoundError, getErrorStatus, requireWorkspaceContributor } from "@/lib/auth-guards";

/**
 * Normalize an incoming template `structure` into a safe, well-formed
 * object before persisting. Sections are the only required part; tasks /
 * customFields / defaults / workflowTemplateId pass through when present
 * (used by "Save as template"). Anything malformed is dropped rather than
 * stored, so the galleries never choke on a bad row.
 */
function sanitizeStructure(raw: unknown): {
  sections: string[];
  accent?: string;
  customFields?: unknown[];
  tasks?: unknown[];
  defaults?: Record<string, unknown>;
  workflowTemplateId?: string;
} {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sections = Array.isArray(s.sections)
    ? (s.sections as unknown[])
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim().slice(0, 80))
        .slice(0, 20)
    : [];
  const ACCENTS = ["amber", "blue", "violet", "rose", "emerald", "slate"];
  return {
    sections,
    accent:
      typeof s.accent === "string" && ACCENTS.includes(s.accent)
        ? s.accent
        : undefined,
    customFields: Array.isArray(s.customFields)
      ? (s.customFields as unknown[]).slice(0, 30)
      : undefined,
    tasks: Array.isArray(s.tasks) ? (s.tasks as unknown[]).slice(0, 500) : undefined,
    defaults:
      s.defaults && typeof s.defaults === "object"
        ? (s.defaults as Record<string, unknown>)
        : undefined,
    workflowTemplateId:
      typeof s.workflowTemplateId === "string" ? s.workflowTemplateId : undefined,
  };
}

// GET /api/workspace/templates - Get project templates
export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve the workspace with the SAME audited heuristic PUT/DELETE use
    // (getUserWorkspaceId prefers the shared firm workspace over a personal
    // singleton — audit SEC-06). Reads and writes must agree, or a template
    // created here is scoped to one workspace and deleted against another.
    const workspaceId = await getUserWorkspaceId(userId);

    // Scope strictly to the caller's workspace — do NOT OR-in a global
    // `isPublic: true` branch, which would leak templates across tenants.
    const rows = await prisma.projectTemplate.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        creator: { select: { id: true, name: true, image: true } },
      },
    });

    // Surface `mine` so the gallery can offer delete only to the creator.
    const shaped = rows.map((r) => ({ ...r, mine: r.creatorId === userId }));

    return NextResponse.json(shaped);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST /api/workspace/templates - Create a new template
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // requireWorkspaceContributor returns the caller's effective workspace
    // (same heuristic as GET/PUT/DELETE) — use it directly instead of a
    // separate findFirst, so create scopes to the same workspace as the rest.
    const { workspaceId } = await requireWorkspaceContributor(userId);

    const { name, description, icon, color, isPublic, structure } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (name.trim().length > 120) {
      return NextResponse.json({ error: "Name is too long" }, { status: 400 });
    }

    const cleanStructure = sanitizeStructure(structure);
    if (cleanStructure.sections.length === 0) {
      return NextResponse.json(
        { error: "A template needs at least one section" },
        { status: 400 }
      );
    }

    const template = await prisma.projectTemplate.create({
      data: {
        name: name.trim(),
        description:
          typeof description === "string" ? description.trim().slice(0, 500) : null,
        icon: typeof icon === "string" ? icon : null,
        color: typeof color === "string" ? color : null,
        isPublic: isPublic || false,
        structure: cleanStructure as unknown as Prisma.InputJsonValue,
        workspaceId,
        creatorId: userId,
      },
      include: {
        creator: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json({ ...template, mine: true }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}

// PUT /api/workspace/templates - Update a template
export async function PUT(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireWorkspaceContributor(userId);

    const { id, name, description, icon, color, isPublic, structure } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Template ID required" }, { status: 400 });
    }

    // Verify template belongs to user's workspace AND that the caller is its
    // creator — mirror DELETE's creator gate so one contributor can't edit
    // (or publish, or overwrite the structure of) a teammate's template.
    const workspaceId = await getUserWorkspaceId(userId);
    const existing = await prisma.projectTemplate.findUnique({
      where: { id },
      select: { workspaceId: true, creatorId: true },
    });
    if (!existing) {
      throw new NotFoundError("Template not found");
    }
    if (existing.workspaceId !== workspaceId) {
      throw new AuthorizationError("You don't have access to this template");
    }
    if (existing.creatorId !== userId) {
      throw new AuthorizationError("Only the creator can edit this template");
    }

    // Sanitize an incoming structure the same way POST does, so PUT can't
    // bypass the sections/tasks/customFields caps.
    let cleanStructure: Prisma.InputJsonValue | undefined;
    if (structure !== undefined) {
      const s = sanitizeStructure(structure);
      if (s.sections.length === 0) {
        return NextResponse.json(
          { error: "A template needs at least one section" },
          { status: 400 }
        );
      }
      cleanStructure = s as unknown as Prisma.InputJsonValue;
    }

    const template = await prisma.projectTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim().slice(0, 120) }),
        ...(description !== undefined && {
          description:
            typeof description === "string"
              ? description.trim().slice(0, 500)
              : null,
        }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
        ...(isPublic !== undefined && { isPublic }),
        ...(cleanStructure !== undefined && { structure: cleanStructure }),
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

// DELETE /api/workspace/templates - Delete a template
export async function DELETE(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireWorkspaceContributor(userId);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Template ID required" }, { status: 400 });
    }

    // Verify template belongs to user's workspace
    const workspaceId = await getUserWorkspaceId(userId);
    const template = await prisma.projectTemplate.findUnique({
      where: { id },
      select: { workspaceId: true, creatorId: true },
    });

    if (!template) {
      throw new NotFoundError("Template not found");
    }
    if (template.workspaceId !== workspaceId) {
      throw new AuthorizationError("You don't have access to this template");
    }
    if (template.creatorId !== userId) {
      throw new AuthorizationError("Only the creator can delete this template");
    }

    await prisma.projectTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
