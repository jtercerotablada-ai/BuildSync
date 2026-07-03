import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  type FormField,
  type FormSubmissionPayload,
  formatAnswerForText,
} from "@/lib/form-types";

/**
 * GET /api/forms/:formId/submissions/export
 *
 * Streams a CSV download of every submission for this form. Auth-gated
 * the same way as the JSON submissions endpoint (project membership
 * or workspace visibility check).
 *
 * Columns: submission id · submitted at · submitter email (if known) ·
 * task id · then one column per form field in declared order.
 *
 * Values are quoted + escaped per RFC 4180 so spreadsheet apps open
 * them without ambiguity. ATTACHMENT cells become "filename (URL)".
 * MULTI_SELECT becomes "a, b, c".
 */

function csvEscape(value: string): string {
  // Always quote. Double-up any inner quote.
  return `"${value.replace(/"/g, '""')}"`;
}

function buildCsvRow(values: string[]): string {
  return values.map(csvEscape).join(",");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { formId } = await params;

    const form = await prisma.form.findUnique({
      where: { id: formId },
      include: {
        project: {
          select: {
            id: true,
            ownerId: true,
            visibility: true,
            workspaceId: true,
            members: { select: { userId: true } },
          },
        },
      },
    });
    if (!form) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Access check. Exported submissions contain external-submitter PII, so a
    // PUBLIC project visibility must NOT grant the CSV. Only project owner/
    // members or a member of the project's workspace may export — audit SEC-08.
    const member = form.project.members.find((m) => m.userId === userId);
    const isOwner = form.project.ownerId === userId;
    const isMember = !!member;
    let allowed = isOwner || isMember;
    if (!allowed) {
      const wsMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: form.project.workspaceId,
          },
        },
      });
      if (wsMember) allowed = true;
    }
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const submissions = await prisma.formSubmission.findMany({
      where: { formId },
      orderBy: { createdAt: "asc" },
      include: {
        submitterUser: { select: { email: true, name: true } },
      },
    });

    const fields = (form.fields as unknown as FormField[]) || [];
    // Field order drives CSV columns. Skip headings — they collect
    // no answer.
    const dataFields = fields.filter((f) => f.type !== "HEADING");

    // ── Header row ────────────────────────────────────────────
    const header = [
      "Submission ID",
      "Submitted at",
      "Submitter email",
      "Task ID",
      ...dataFields.map((f) => f.label),
    ];

    // ── Data rows ─────────────────────────────────────────────
    const rows: string[] = [];
    rows.push(buildCsvRow(header));
    for (const s of submissions) {
      const data = (s.data as FormSubmissionPayload) || {};
      const submitterEmail = s.submitterUser?.email ?? "";
      const cells = [
        s.id,
        s.createdAt.toISOString(),
        submitterEmail,
        s.taskId ?? "",
        ...dataFields.map((f) => formatAnswerForText(data[f.id] ?? null)),
      ];
      rows.push(buildCsvRow(cells));
    }

    const body = rows.join("\r\n") + "\r\n";
    // BOM so Excel opens UTF-8 correctly without prompting.
    const csv = "﻿" + body;

    const safeName = form.name.replace(/[^a-z0-9-]+/gi, "_").slice(0, 60);
    const filename = `${safeName || "form"}-submissions.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[submissions export] error:", err);
    return NextResponse.json(
      { error: "Failed to export submissions" },
      { status: 500 }
    );
  }
}
