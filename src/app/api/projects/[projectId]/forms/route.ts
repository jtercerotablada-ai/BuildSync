import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

/**
 * GET  /api/projects/:projectId/forms — list every form in the
 *   project. Returns the full FormRow shape (incl. settings)
 *   because the Workflow tab needs it to populate the editor.
 *
 * POST /api/projects/:projectId/forms — create a new form scoped
 *   to this project (project edit role required).
 */

const fieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  type: z.enum([
    "TEXT",
    "TEXTAREA",
    "EMAIL",
    "DATE",
    "NUMBER",
    "SELECT",
    "MULTI_SELECT",
    "PEOPLE",
    "ATTACHMENT",
    "HEADING",
  ]),
  required: z.boolean().default(false),
  placeholder: z.string().max(200).optional(),
  helpText: z.string().max(500).optional(),
  options: z.array(z.string().min(1)).optional(),
  unit: z.string().max(40).optional(),
  accept: z.array(z.string()).optional(),
  mapTo: z.enum(["name", "description", "dueDate"]).optional(),
  showWhen: z
    .object({
      fieldId: z.string().min(1),
      equals: z.union([z.string(), z.array(z.string())]),
    })
    .optional(),
});

const createFormSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  fields: z.array(fieldSchema).min(1).max(50),
  isActive: z.boolean().default(true),
  defaultSectionId: z.string().nullable().optional(),
  defaultAssigneeId: z.string().nullable().optional(),
  confirmationMessage: z.string().max(2000).nullable().optional(),
  notifyOnSubmission: z.boolean().optional(),
  visibility: z.enum(["PUBLIC", "ORGANIZATION"]).optional(),
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

function canEditForms(
  project: { ownerId: string | null },
  member: { role: string } | null,
  userId: string
): boolean {
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

    const forms = await prisma.form.findMany({
      where: { projectId },
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
    if (!canEditForms(access.project, access.member ?? null, userId)) {
      return NextResponse.json(
        {
          error:
            "You don't have permission to create forms. Ask an editor or admin.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const p = parsed.data;

    // Validate defaultSectionId belongs to this project.
    if (p.defaultSectionId) {
      const sec = await prisma.section.findFirst({
        where: { id: p.defaultSectionId, projectId },
        select: { id: true },
      });
      if (!sec) {
        return NextResponse.json(
          { error: "defaultSection doesn't belong to this project" },
          { status: 400 }
        );
      }
    }

    const form = await prisma.form.create({
      data: {
        name: p.name,
        description: p.description ?? null,
        fields: JSON.parse(JSON.stringify(p.fields)),
        isActive: p.isActive,
        projectId,
        defaultSectionId: p.defaultSectionId ?? null,
        defaultAssigneeId: p.defaultAssigneeId ?? null,
        confirmationMessage: p.confirmationMessage ?? null,
        notifyOnSubmission: p.notifyOnSubmission ?? true,
        visibility: p.visibility ?? "PUBLIC",
      },
    });

    return NextResponse.json(
      {
        id: form.id,
        name: form.name,
        description: form.description,
        fields: form.fields,
        isActive: form.isActive,
        projectId: form.projectId,
        defaultSectionId: form.defaultSectionId,
        defaultAssigneeId: form.defaultAssigneeId,
        confirmationMessage: form.confirmationMessage,
        notifyOnSubmission: form.notifyOnSubmission,
        visibility: form.visibility,
        createdAt: form.createdAt.toISOString(),
        updatedAt: form.updatedAt.toISOString(),
        submissionCount: 0,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[forms POST] error:", err);
    return NextResponse.json(
      { error: "Failed to create form" },
      { status: 500 }
    );
  }
}
