import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  type FormField,
  buildTaskFromSubmission,
} from "@/lib/form-types";

/**
 * POST /api/forms/:formId/submit
 *
 * Public endpoint — anyone with the form's URL can submit. Validates
 * required fields, creates the FormSubmission row, and ALSO creates
 * a Task in the form's project (mapped via each field's `mapTo`).
 *
 * The created task lands in the project's first section so the team
 * sees it in their default views immediately. A workflow rule on
 * that first section can then auto-assign / comment / etc.
 *
 * Returns the new submission id; the task is intentionally internal
 * (we don't expose its id to the public submitter).
 */

const submitSchema = z.object({
  // Free-form answers keyed by field id. Validation against the
  // field schema happens after we load the form so we know the
  // shape we expect.
  answers: z.record(z.string(), z.string()),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params;

    const form = await prisma.form.findUnique({
      where: { id: formId },
      select: {
        id: true,
        name: true,
        fields: true,
        isActive: true,
        projectId: true,
      },
    });
    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }
    if (!form.isActive) {
      return NextResponse.json(
        { error: "This form is no longer accepting submissions." },
        { status: 410 }
      );
    }

    const body = await req.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }
    const answers = parsed.data.answers;

    // Validate required fields are present.
    const fields = (form.fields as unknown as FormField[]) || [];
    for (const f of fields) {
      if (f.required) {
        const v = answers[f.id];
        if (v == null || String(v).trim() === "") {
          return NextResponse.json(
            { error: `Field "${f.label}" is required` },
            { status: 400 }
          );
        }
      }
    }

    // Find the first section of the project so the auto-created
    // task has somewhere to land. Without a section it would be
    // invisible in all the standard views.
    const firstSection = await prisma.section.findFirst({
      where: { projectId: form.projectId },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    if (!firstSection) {
      return NextResponse.json(
        {
          error:
            "This form's project has no sections yet — task can't be created.",
        },
        { status: 500 }
      );
    }

    const task = buildTaskFromSubmission(
      { fields, name: form.name },
      answers
    );

    // Create the FormSubmission first, then the Task with its id
    // back-pointer, in a transaction so a failure leaves nothing
    // half-persisted.
    const result = await prisma.$transaction(async (tx) => {
      const submission = await tx.formSubmission.create({
        data: {
          formId: form.id,
          data: JSON.parse(JSON.stringify(answers)),
        },
      });

      const createdTask = await tx.task.create({
        data: {
          name: task.name,
          description: task.description || null,
          dueDate: task.dueDate ? new Date(task.dueDate) : null,
          projectId: form.projectId,
          sectionId: firstSection.id,
        },
      });

      // Back-fill the submission's taskId so the team can trace
      // submissions to the tasks they created.
      await tx.formSubmission.update({
        where: { id: submission.id },
        data: { taskId: createdTask.id },
      });

      return { submissionId: submission.id, taskId: createdTask.id };
    });

    return NextResponse.json(
      {
        success: true,
        submissionId: result.submissionId,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[form submit] error:", err);
    return NextResponse.json(
      { error: "Failed to submit form" },
      { status: 500 }
    );
  }
}
