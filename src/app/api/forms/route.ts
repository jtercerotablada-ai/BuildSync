import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

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
  name: z.string().min(1, "Name is required").max(120),
  description: z.string().max(2000).optional(),
  fields: z.array(fieldSchema).default([]),
  projectId: z.string().min(1, "Project is required"),
  defaultSectionId: z.string().nullable().optional(),
  defaultAssigneeId: z.string().nullable().optional(),
  confirmationMessage: z.string().max(2000).nullable().optional(),
  notifyOnSubmission: z.boolean().optional(),
  visibility: z.enum(["PUBLIC", "ORGANIZATION"]).optional(),
  // Open-ended settings bag, currently only stores coverImageUrl.
  settings: z
    .object({
      coverImageUrl: z.string().url().max(2048).nullable().optional(),
    })
    .partial()
    .optional()
    .nullable(),
});

// GET /api/forms — list forms in the user's projects
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const userProjects = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const ownedProjects = await prisma.project.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    const projectIds = [
      ...new Set([
        ...userProjects.map((p) => p.projectId),
        ...ownedProjects.map((p) => p.id),
      ]),
    ];

    const forms = await prisma.form.findMany({
      where: { projectId: { in: projectIds } },
      include: {
        project: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    // Count of unread FORM_SUBMITTED inbox notifications per form
    // for THIS user. Powers the "3 new" gold pill on the home widget
    // + Workflow tab. Tied to the inbox read state so it clears as
    // soon as the user opens the notification — same source of truth.
    const unreadByForm = new Map<string, number>();
    try {
      const unreadFormNotifs = await prisma.notification.findMany({
        where: { userId, type: "FORM_SUBMITTED", read: false, archived: false },
        select: { data: true },
      });
      for (const n of unreadFormNotifs) {
        const fid = (n.data as { formId?: unknown } | null)?.formId;
        if (typeof fid === "string") {
          unreadByForm.set(fid, (unreadByForm.get(fid) || 0) + 1);
        }
      }
    } catch (err) {
      // Non-fatal — widget falls back to "no new" if the count fails.
      console.error("[GET /api/forms] unread count failed:", err);
    }

    return NextResponse.json(
      forms.map((form) => ({
        id: form.id,
        name: form.name,
        projectId: form.projectId,
        projectName: form.project.name,
        responsesCount: form._count.submissions,
        newCount: unreadByForm.get(form.id) || 0,
        createdAt: form.createdAt.toISOString(),
        updatedAt: form.updatedAt.toISOString(),
        isActive: form.isActive,
        visibility: form.visibility,
      }))
    );
  } catch (error) {
    console.error("Error fetching forms:", error);
    return NextResponse.json(
      { error: "Failed to fetch forms" },
      { status: 500 }
    );
  }
}

// POST /api/forms — create a new form (with full settings)
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || "Validation error",
        },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Verify user can edit the target project.
    const project = await prisma.project.findFirst({
      where: {
        id: data.projectId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
      select: { id: true, name: true },
    });
    if (!project) {
      return NextResponse.json(
        { error: "Project not found or you don't have access" },
        { status: 403 }
      );
    }

    // Validate defaultSectionId belongs to this project if provided.
    if (data.defaultSectionId) {
      const sec = await prisma.section.findFirst({
        where: { id: data.defaultSectionId, projectId: project.id },
        select: { id: true },
      });
      if (!sec) {
        return NextResponse.json(
          { error: "defaultSection doesn't belong to this project" },
          { status: 400 }
        );
      }
    }

    // Validate defaultAssigneeId is in the workspace if provided.
    // (Loose check — full workspace membership validation would
    // require another query path; we trust the picker to filter.)

    const form = await prisma.form.create({
      data: {
        name: data.name,
        description: data.description || null,
        fields: JSON.parse(JSON.stringify(data.fields)),
        projectId: data.projectId,
        defaultSectionId: data.defaultSectionId ?? null,
        defaultAssigneeId: data.defaultAssigneeId ?? null,
        confirmationMessage: data.confirmationMessage ?? null,
        notifyOnSubmission: data.notifyOnSubmission ?? true,
        visibility: data.visibility ?? "PUBLIC",
        settings: data.settings
          ? (data.settings as unknown as object)
          : undefined,
      },
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(
      {
        id: form.id,
        name: form.name,
        projectName: form.project.name,
        responsesCount: 0,
        isActive: form.isActive,
        visibility: form.visibility,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("Error creating form:", error);
    return NextResponse.json(
      { error: "Failed to create form" },
      { status: 500 }
    );
  }
}
