import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { resolveProjectAccess } from "@/lib/project-access";
import { isVercelBlobUrl } from "@/lib/storage";
import {
  type FormField,
  type FormSubmissionPayload,
  csvCell,
  formatAnswerForText,
  neutralizeStoredAnswers,
} from "@/lib/form-types";

/**
 * GET /api/forms/:formId/submissions/export
 *
 * Streams a CSV download of every submission for this form. Auth-gated
 * the same way as the JSON submissions endpoint (the project read rule,
 * plus a contributor seat).
 *
 * Columns: submission id · submitted at · submitter email (if known) ·
 * task id · then one column per form field in declared order.
 *
 * Values are quoted + escaped per RFC 4180 (and formula-neutralized, see
 * csvCell) so spreadsheet apps open them without ambiguity. ATTACHMENT cells
 * become "filename (URL)".
 * MULTI_SELECT becomes "a, b, c".
 */

function buildCsvRow(values: string[]): string {
  return values.map(csvCell).join(",");
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
            teamId: true,
            members: { select: { userId: true, role: true } },
          },
        },
      },
    });
    if (!form) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Exported submissions carry external-submitter PII: the caller must be
    // able to read the project AND still hold a contributor seat in its
    // workspace (a GUEST, or someone offboarded, gets nothing). Same rule as
    // the inbox and the print view. 404, never 403, so the id can't be probed.
    const access = await resolveProjectAccess(form.project, userId);
    if (!access.ok || !access.hasContributorSeat) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    // A NUMBER field's unit goes in the column heading, not in the cells:
    // dropping it entirely leaves a bare "500" nobody can read, but writing
    // "500 psf" in the cell turns the column into text and breaks SUM/AVG
    // in the spreadsheet this file exists to be opened in.
    const header = [
      "Submission ID",
      "Submitted at",
      "Submitter email",
      "Task ID",
      ...dataFields.map((f) =>
        f.type === "NUMBER" && f.unit ? `${f.label} (${f.unit})` : f.label
      ),
    ];

    // ── Data rows ─────────────────────────────────────────────
    const rows: string[] = [];
    rows.push(buildCsvRow(header));
    for (const s of submissions) {
      const data = neutralizeStoredAnswers(
        fields,
        (s.data as FormSubmissionPayload) || {},
        isVercelBlobUrl
      );
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
