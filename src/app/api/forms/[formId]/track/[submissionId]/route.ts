import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyTrackingToken } from "@/lib/tracking-token";
import {
  type FormField,
  type FormSubmissionPayload,
  formatAnswerForText,
} from "@/lib/form-types";

/**
 * GET /api/forms/:formId/track/:submissionId?token=...
 *
 * Public, no-auth endpoint that powers the external tracking page.
 * Token-gated — anyone with the signed URL can view, anyone without
 * it gets 401 even if they guess the submissionId.
 *
 * Returns:
 *   - submission metadata (form name, project name, submitter info)
 *   - the submitter's original answers
 *   - the underlying task's current status (Open / In progress / Done)
 *   - the assignee's name (so the architect knows who to expect from)
 *   - the comment thread, filtered to EXTERNAL visibility only
 *     (INTERNAL_NOTE rows are hidden — that's the whole point of the
 *     visibility flag)
 *   - attachments on the task (so the engineer's response file shows up)
 *
 * Never exposes:
 *   - internal team comments marked INTERNAL_NOTE
 *   - other tasks in the project
 *   - other submissions
 *   - workspace data, members not assigned to this task
 */
export async function GET(
  req: Request,
  {
    params,
  }: { params: Promise<{ formId: string; submissionId: string }> }
) {
  try {
    const { formId, submissionId } = await params;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Missing tracking token." },
        { status: 401 }
      );
    }
    const verification = verifyTrackingToken(token, submissionId);
    if (!verification.ok) {
      return NextResponse.json(
        { error: verification.reason }, // surface the reason so the page can show a useful message
        { status: 401 }
      );
    }

    const submission = await prisma.formSubmission.findUnique({
      where: { id: submissionId },
      include: {
        form: {
          select: {
            id: true,
            name: true,
            fields: true,
            projectId: true,
            project: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
        submitterUser: {
          select: { name: true, email: true },
        },
      },
    });

    if (!submission || submission.formId !== formId) {
      return NextResponse.json(
        { error: "Submission not found." },
        { status: 404 }
      );
    }

    // Resolve the linked task (the source of truth for status +
    // comments). If the task was deleted (manual cleanup, etc.) we
    // still show the submission frozen-in-time + a "Task removed"
    // notice in the UI.
    const task = submission.taskId
      ? await prisma.task.findUnique({
          where: { id: submission.taskId },
          include: {
            assignee: { select: { id: true, name: true, email: true, image: true } },
            comments: {
              where: { visibility: "EXTERNAL" },
              orderBy: { createdAt: "asc" },
              include: {
                author: {
                  select: { id: true, name: true, email: true, image: true },
                },
                attachments: {
                  select: { id: true, name: true, url: true, size: true, mimeType: true },
                },
              },
            },
            attachments: {
              orderBy: { createdAt: "asc" },
              select: { id: true, name: true, url: true, size: true, mimeType: true, createdAt: true },
            },
          },
        })
      : null;

    // Render the submitter's answers as a clean Q/A list so the
    // tracking page doesn't need to re-implement the field-rendering
    // logic.
    const fields = (submission.form.fields as unknown as FormField[]) || [];
    const data = (submission.data as FormSubmissionPayload) || {};
    const renderedAnswers = fields
      .filter((f) => f.type !== "HEADING")
      .map((f) => {
        const v = data[f.id];
        // Attachments returned as a structured list so the page can
        // render proper download links instead of "name (url)" text.
        const attachments: { name: string; url: string; size: number; mimeType: string }[] = [];
        if (Array.isArray(v)) {
          for (const item of v) {
            if (
              typeof item === "object" &&
              item !== null &&
              "url" in item &&
              "name" in item &&
              "size" in item
            ) {
              attachments.push(item as {
                name: string;
                url: string;
                size: number;
                mimeType: string;
              });
            }
          }
        }
        return {
          fieldId: f.id,
          label: f.label,
          // Plain text for everything except attachments.
          text: attachments.length === 0 ? formatAnswerForText(v) : "",
          attachments,
        };
      });

    return NextResponse.json({
      submission: {
        id: submission.id,
        createdAt: submission.createdAt.toISOString(),
        submitterName:
          submission.submitterUser?.name ||
          submission.submitterUser?.email ||
          null,
      },
      form: {
        id: submission.form.id,
        name: submission.form.name,
      },
      project: {
        id: submission.form.project.id,
        name: submission.form.project.name,
        color: submission.form.project.color,
      },
      answers: renderedAnswers,
      task: task
        ? {
            id: task.id,
            name: task.name,
            // Derived status pill — closed/in-progress/open. Keeps the
            // public surface simple (don't expose internal taskStatus
            // enum values that may change).
            statusLabel: task.completed
              ? "Answered"
              : task.assigneeId
                ? "In review"
                : "Received",
            completed: task.completed,
            completedAt: task.completedAt?.toISOString() ?? null,
            assignee: task.assignee
              ? {
                  name: task.assignee.name || task.assignee.email,
                  image: task.assignee.image,
                }
              : null,
            comments: task.comments.map((c) => ({
              id: c.id,
              content: c.content,
              createdAt: c.createdAt.toISOString(),
              source: c.source, // INTERNAL = from team panel, TRACKING_REPLY = from this page
              // For TRACKING_REPLY rows we use the captured guest
              // name. For INTERNAL rows we use the User's display name.
              authorName:
                c.source === "TRACKING_REPLY"
                  ? c.guestName || "External submitter"
                  : c.author?.name || c.author?.email || "Engineering team",
              authorImage:
                c.source === "INTERNAL" ? c.author?.image || null : null,
              attachments: c.attachments,
            })),
            attachments: task.attachments.map((a) => ({
              id: a.id,
              name: a.name,
              url: a.url,
              size: a.size,
              mimeType: a.mimeType,
              createdAt: a.createdAt.toISOString(),
            })),
          }
        : null,
    });
  } catch (err) {
    console.error("[tracking GET] error:", err);
    return NextResponse.json(
      { error: "Failed to load tracking page." },
      { status: 500 }
    );
  }
}
