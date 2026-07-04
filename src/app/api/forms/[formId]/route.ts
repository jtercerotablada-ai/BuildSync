import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

/**
 * GET /api/forms/:formId
 *   PUBLIC — only the public-safe view (fields, name, description,
 *   visibility, confirmationMessage). Used by the form-render page.
 *   The settings panel uses ?settings=1 + auth to get the full row.
 *
 * PATCH /api/forms/:formId — full update (auth, project edit role).
 *
 * DELETE /api/forms/:formId — auth, project edit role.
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

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  fields: z.array(fieldSchema).min(1).max(50).optional(),
  isActive: z.boolean().optional(),
  defaultSectionId: z.string().nullable().optional(),
  defaultAssigneeId: z.string().nullable().optional(),
  confirmationMessage: z.string().max(2000).nullable().optional(),
  notifyOnSubmission: z.boolean().optional(),
  visibility: z.enum(["PUBLIC", "ORGANIZATION"]).optional(),
  // Open-ended settings bag — currently holds coverImageUrl. The
  // bag is a Prisma Json column so we just accept any shape and
  // pass through, but bound the URL length to keep payloads sane.
  settings: z
    .object({
      coverImageUrl: z
        .string()
        .url()
        .max(2048)
        .nullable()
        .optional(),
    })
    .partial()
    .optional()
    .nullable(),
});

async function assertFormEditAccess(formId: string, userId: string) {
  const form = await prisma.form.findUnique({
    where: { id: formId },
    include: {
      project: {
        select: {
          id: true,
          ownerId: true,
          members: { select: { userId: true, role: true } },
        },
      },
    },
  });
  if (!form) return { ok: false as const, status: 404 };

  const member = form.project.members.find((m) => m.userId === userId);
  const isOwner = form.project.ownerId === userId;
  const canEdit =
    isOwner ||
    (member && (member.role === "ADMIN" || member.role === "EDITOR"));
  if (!canEdit) return { ok: false as const, status: 403 };
  return { ok: true as const, form };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  // ?settings=1 → auth-gated full settings view (for the editor)
  // otherwise   → public-safe view (for the submitter render page)
  try {
    const { formId } = await params;
    const url = new URL(req.url);
    const wantsSettings = url.searchParams.get("settings") === "1";

    if (wantsSettings) {
      const userId = await getCurrentUserId();
      if (!userId) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
      const access = await assertFormEditAccess(formId, userId);
      if (!access.ok) {
        return NextResponse.json(
          { error: access.status === 404 ? "Not found" : "Forbidden" },
          { status: access.status }
        );
      }
      const f = access.form;
      return NextResponse.json({
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
      });
    }

    const form = await prisma.form.findUnique({
      where: { id: formId },
      select: {
        id: true,
        name: true,
        description: true,
        fields: true,
        isActive: true,
        projectId: true,
        confirmationMessage: true,
        visibility: true,
        // Included so the public render page can show the cover image
        // (previously write-only: stored but never returned anywhere).
        settings: true,
        project: { select: { workspaceId: true } },
      },
    });
    if (!form) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!form.isActive) {
      return NextResponse.json(
        { error: "This form is no longer accepting submissions." },
        { status: 410 }
      );
    }
    // ORGANIZATION forms are NOT public — the builder promises "only members
    // of your organization can access this form". Require an authenticated
    // workspace member before returning the definition.
    if (form.visibility === "ORGANIZATION") {
      const userId = await getCurrentUserId();
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const wsMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: form.project.workspaceId,
          },
        },
        select: { userId: true },
      });
      if (!wsMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    const { project: _project, ...publicForm } = form;
    return NextResponse.json(publicForm);
  } catch (err) {
    console.error("[form GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch form" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { formId } = await params;
    const access = await assertFormEditAccess(formId, userId);
    if (!access.ok) {
      const msg =
        access.status === 404
          ? "Form not found"
          : "You don't have permission to edit this form.";
      return NextResponse.json({ error: msg }, { status: access.status });
    }

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const p = parsed.data;

    // Validate defaultSectionId belongs to this form's project.
    if (p.defaultSectionId !== undefined && p.defaultSectionId !== null) {
      const sec = await prisma.section.findFirst({
        where: { id: p.defaultSectionId, projectId: access.form.projectId },
        select: { id: true },
      });
      if (!sec) {
        return NextResponse.json(
          { error: "defaultSection doesn't belong to this project" },
          { status: 400 }
        );
      }
    }

    const data: Prisma.FormUpdateInput = {};
    if (p.name !== undefined) data.name = p.name;
    if (p.description !== undefined) data.description = p.description;
    if (p.isActive !== undefined) data.isActive = p.isActive;
    if (p.fields !== undefined) {
      data.fields = JSON.parse(
        JSON.stringify(p.fields)
      ) as Prisma.InputJsonValue;
    }
    if (p.defaultSectionId !== undefined) {
      data.defaultSection = p.defaultSectionId
        ? { connect: { id: p.defaultSectionId } }
        : { disconnect: true };
    }
    if (p.defaultAssigneeId !== undefined) {
      data.defaultAssignee = p.defaultAssigneeId
        ? { connect: { id: p.defaultAssigneeId } }
        : { disconnect: true };
    }
    if (p.confirmationMessage !== undefined) {
      data.confirmationMessage = p.confirmationMessage;
    }
    if (p.notifyOnSubmission !== undefined) {
      data.notifyOnSubmission = p.notifyOnSubmission;
    }
    if (p.visibility !== undefined) data.visibility = p.visibility;
    if (p.settings !== undefined) {
      // Json column — Prisma accepts InputJsonValue. Null clears it.
      data.settings = (p.settings ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    }

    const form = await prisma.form.update({
      where: { id: formId },
      data,
      include: { _count: { select: { submissions: true } } },
    });

    return NextResponse.json({
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
      submissionCount: form._count.submissions,
    });
  } catch (err) {
    console.error("[form PATCH] error:", err);
    return NextResponse.json(
      { error: "Failed to update form" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { formId } = await params;
    const access = await assertFormEditAccess(formId, userId);
    if (!access.ok) {
      const msg =
        access.status === 404
          ? "Form not found"
          : "You don't have permission to delete this form.";
      return NextResponse.json({ error: msg }, { status: access.status });
    }

    await prisma.form.delete({ where: { id: formId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[form DELETE] error:", err);
    return NextResponse.json(
      { error: "Failed to delete form" },
      { status: 500 }
    );
  }
}
