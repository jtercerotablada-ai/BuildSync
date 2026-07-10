/**
 * Custom field definitions per project.
 *
 *   GET  /api/projects/:projectId/custom-fields
 *        → returns the list of CustomFieldDefinitions linked to this
 *          project via ProjectCustomField, ordered by position.
 *
 *   POST /api/projects/:projectId/custom-fields
 *        → creates a CustomFieldDefinition in the project's workspace,
 *          links it to the project, returns the link + definition.
 *          Body: { name, type, options?, isRequired? }
 *
 * The schema separates definitions (workspace-scoped, reusable) from
 * links (project-scoped) — this route always creates a NEW definition
 * + a link. A separate "library" picker (future) can link an existing
 * definition to additional projects without duplicating it.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { resolveProjectAccess } from "@/lib/project-access";

const FIELD_TYPES = [
  "TEXT",
  "NUMBER",
  "DATE",
  "DROPDOWN",
  "MULTI_SELECT",
  "PEOPLE",
  "CHECKBOX",
  "CURRENCY",
  "PERCENTAGE",
  // Asana-parity (Fase 3): now persistable.
  "REFERENCE",
  "FORMULA",
  "TIMER",
  "TIME_TRACKING",
  "ROLLUP",
] as const;

const createSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(FIELD_TYPES),
  // For DROPDOWN / MULTI_SELECT this is an array of { id, label, color? }.
  // For FORMULA / ROLLUP it's the spec object ({leftFieldId,op,rightFieldId}
  // or {sourceFieldId,fn}). Validated per-type below.
  options: z
    .union([
      z.array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1).max(80),
          color: z.string().optional(),
        })
      ),
      z.record(z.string(), z.any()),
    ])
    .optional(),
  isRequired: z.boolean().optional().default(false),
});

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
  return { ok: true as const, project, canWrite: access.canWrite };
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

    const links = await prisma.projectCustomField.findMany({
      where: { projectId },
      orderBy: { position: "asc" },
      include: {
        field: {
          select: {
            id: true,
            name: true,
            type: true,
            options: true,
            isRequired: true,
          },
        },
      },
    });

    return NextResponse.json(
      links.map((l) => ({
        linkId: l.id,
        position: l.position,
        ...l.field,
      }))
    );
  } catch (err) {
    console.error("[custom-fields GET] error:", err);
    return NextResponse.json(
      { error: "Failed to load custom fields" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
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
    if (!access.canWrite) {
      return NextResponse.json(
        { error: "You don't have permission to edit fields on this project." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, type, options, isRequired } = parsed.data;

    // Validate options vs type
    const needsOptions = type === "DROPDOWN" || type === "MULTI_SELECT";
    if (needsOptions && (!Array.isArray(options) || options.length === 0)) {
      return NextResponse.json(
        { error: "Dropdown fields need at least one option" },
        { status: 400 }
      );
    }
    // FORMULA / ROLLUP carry a spec OBJECT in options (not an array).
    const isComputed = type === "FORMULA" || type === "ROLLUP";
    const storeOptions =
      (needsOptions && Array.isArray(options)) ||
      (isComputed &&
        options &&
        typeof options === "object" &&
        !Array.isArray(options))
        ? JSON.parse(JSON.stringify(options))
        : null;

    const result = await prisma.$transaction(async (tx) => {
      const def = await tx.customFieldDefinition.create({
        data: {
          name,
          type,
          options: storeOptions,
          isRequired,
          workspaceId: access.project.workspaceId,
        },
      });

      // Place at the end of the existing field order on this project.
      const last = await tx.projectCustomField.findFirst({
        where: { projectId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const position = last ? last.position + 1 : 0;

      const link = await tx.projectCustomField.create({
        data: { projectId, fieldId: def.id, position },
      });

      return { def, link };
    });

    return NextResponse.json(
      {
        linkId: result.link.id,
        position: result.link.position,
        id: result.def.id,
        name: result.def.name,
        type: result.def.type,
        options: result.def.options,
        isRequired: result.def.isRequired,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[custom-fields POST] error:", err);
    return NextResponse.json(
      { error: "Failed to create custom field" },
      { status: 500 }
    );
  }
}
