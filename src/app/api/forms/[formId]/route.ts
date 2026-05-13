import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

/**
 * GET /api/forms/:formId — fetch a single form (public, used by the
 *   public form page; only returns fields, no submissions).
 * PATCH /api/forms/:formId — update form (auth, project edit role).
 * DELETE /api/forms/:formId — delete (auth, project edit role).
 */

const fieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  type: z.enum(["TEXT", "TEXTAREA", "EMAIL", "DATE", "SELECT"]),
  required: z.boolean().default(false),
  placeholder: z.string().max(200).optional(),
  helpText: z.string().max(500).optional(),
  options: z.array(z.string().min(1)).optional(),
  mapTo: z.enum(["name", "description", "dueDate"]).optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  fields: z.array(fieldSchema).min(1).max(50).optional(),
  isActive: z.boolean().optional(),
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
  _req: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  // Intentionally PUBLIC — the form is meant to be linked to people
  // outside the workspace. We only expose the schema, never the
  // submissions or the project's private metadata.
  try {
    const { formId } = await params;
    const form = await prisma.form.findUnique({
      where: { id: formId },
      select: {
        id: true,
        name: true,
        description: true,
        fields: true,
        isActive: true,
        projectId: true,
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
    return NextResponse.json(form);
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

    const data: Prisma.FormUpdateInput = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.description !== undefined)
      data.description = parsed.data.description;
    if (parsed.data.isActive !== undefined)
      data.isActive = parsed.data.isActive;
    if (parsed.data.fields !== undefined) {
      data.fields = JSON.parse(
        JSON.stringify(parsed.data.fields)
      ) as Prisma.InputJsonValue;
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
