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
] as const;

const createSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(FIELD_TYPES),
  // For DROPDOWN / MULTI_SELECT, options is an array of { id, label, color? }
  options: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1).max(80),
        color: z.string().optional(),
      })
    )
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

  const member = project.members.find((m) => m.userId === userId);
  const isOwner = project.ownerId === userId;
  const isMember = !!member;
  if (isOwner || isMember || project.visibility === "PUBLIC") {
    return { ok: true as const, project, member };
  }
  if (project.visibility === "WORKSPACE") {
    const wsMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: project.workspaceId },
      },
    });
    if (wsMember) return { ok: true as const, project, member: null };
  }
  return { ok: false as const, status: 403 };
}

function canEdit(
  project: { ownerId: string | null },
  member: { role: string } | null,
  userId: string
) {
  if (project.ownerId === userId) return true;
  if (!member) return false;
  return member.role === "ADMIN" || member.role === "EDITOR";
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
    if (!canEdit(access.project, access.member ?? null, userId)) {
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
    if (needsOptions && (!options || options.length === 0)) {
      return NextResponse.json(
        { error: "Dropdown fields need at least one option" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const def = await tx.customFieldDefinition.create({
        data: {
          name,
          type,
          options:
            needsOptions && options
              ? JSON.parse(JSON.stringify(options))
              : null,
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
