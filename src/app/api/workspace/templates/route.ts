import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
  getPrimaryWorkspaceMembership,
  requireWorkspaceContributor,
} from "@/lib/auth-guards";
import { readJson, jsonErrorResponse } from "@/lib/http";

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

/**
 * Who may edit or delete a template: its creator, or a workspace OWNER/ADMIN,
 * who curates the firm's library and must be able to retire a template whose
 * author left or captured it wrong.
 */
function canManageTemplate(
  role: string,
  creatorId: string,
  userId: string
): boolean {
  return creatorId === userId || role === "OWNER" || role === "ADMIN";
}

/** The first validation message, ready for a 400. */
function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message || "Invalid request";
}

const nameSchema = z
  .string({ error: "Name is required" })
  .trim()
  .min(1, "Name is required")
  .max(120, "Name is too long");

const createSchema = z.object({
  name: nameSchema,
  description: z.string().nullish(),
  icon: z.string().max(64).nullish(),
  color: z.string().max(32).nullish(),
  isPublic: z.boolean().optional(),
  structure: z.unknown(),
});

const updateSchema = z.object({
  id: z.string({ error: "Template ID required" }).min(1, "Template ID required"),
  name: nameSchema.optional(),
  description: z.string().nullish(),
  icon: z.string().max(64).nullish(),
  color: z.string().max(32).nullish(),
  isPublic: z.boolean().optional(),
  structure: z.unknown().optional(),
});

// GET /api/workspace/templates - Get project templates
export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve the workspace with the SAME audited heuristic POST/PUT/DELETE
    // use (prefers the shared firm workspace over a personal singleton —
    // audit SEC-06). Reads and writes must agree, or a template created here
    // is scoped to one workspace and deleted against another. The role comes
    // with it so the galleries can offer edit/delete to a manager too.
    const membership = await getPrimaryWorkspaceMembership(userId);
    if (!membership) throw new AuthorizationError("No workspace found");

    // Scope strictly to the caller's workspace — do NOT OR-in a global
    // `isPublic: true` branch, which would leak templates across tenants.
    const rows = await prisma.projectTemplate.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        creator: { select: { id: true, name: true, image: true } },
      },
    });

    // `canManage` mirrors the PUT/DELETE gate, so the galleries never show an
    // edit or delete control that would 403.
    const shaped = rows.map((r) => ({
      ...r,
      mine: r.creatorId === userId,
      canManage: canManageTemplate(membership.role, r.creatorId, userId),
    }));

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

    const parsed = createSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
    }
    const { name, description, icon, color, isPublic, structure } = parsed.data;

    const cleanStructure = sanitizeStructure(structure);
    if (cleanStructure.sections.length === 0) {
      return NextResponse.json(
        { error: "A template needs at least one section" },
        { status: 400 }
      );
    }

    const template = await prisma.projectTemplate.create({
      data: {
        name,
        description:
          typeof description === "string" ? description.trim().slice(0, 500) : null,
        icon: icon ?? null,
        color: color ?? null,
        isPublic: isPublic ?? false,
        structure: cleanStructure as unknown as Prisma.InputJsonValue,
        workspaceId,
        creatorId: userId,
      },
      include: {
        creator: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json(
      { ...template, mine: true, canManage: true },
      { status: 201 }
    );
  } catch (error) {
    const badJson = jsonErrorResponse(error);
    if (badJson) return badJson;
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

    const { workspaceId, role } = await requireWorkspaceContributor(userId);

    const parsed = updateSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
    }
    const { id, name, description, icon, color, isPublic, structure } = parsed.data;

    // The template must live in the caller's workspace (404 otherwise: another
    // tenant's template is not something the caller can see), and the caller
    // must be its creator or a workspace OWNER/ADMIN — the same gate as
    // DELETE, so one contributor can't edit (or publish, or overwrite the
    // structure of) a teammate's template.
    const existing = await prisma.projectTemplate.findUnique({
      where: { id },
      select: { workspaceId: true, creatorId: true },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new NotFoundError("Template not found");
    }
    if (!canManageTemplate(role, existing.creatorId, userId)) {
      throw new AuthorizationError(
        "Only the creator or a workspace admin can edit this template"
      );
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
        ...(name !== undefined && { name }),
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
    const badJson = jsonErrorResponse(error);
    if (badJson) return badJson;
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

    const { workspaceId, role } = await requireWorkspaceContributor(userId);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Template ID required" }, { status: 400 });
    }

    // Same gate as PUT: in the caller's workspace (404 otherwise), and the
    // caller is its creator or a workspace OWNER/ADMIN.
    const template = await prisma.projectTemplate.findUnique({
      where: { id },
      select: { workspaceId: true, creatorId: true },
    });

    if (!template || template.workspaceId !== workspaceId) {
      throw new NotFoundError("Template not found");
    }
    if (!canManageTemplate(role, template.creatorId, userId)) {
      throw new AuthorizationError(
        "Only the creator or a workspace admin can delete this template"
      );
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
