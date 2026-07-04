import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  type FormField,
  type FormSubmissionPayload,
  type FormAnswerValue,
  type FormAttachment,
  formatAnswerForText,
} from "@/lib/form-types";
import { PrintSubmissionClient } from "./print-client";

/**
 * Printable view of a single form submission.
 *
 * Server-rendered + auth-gated (same access check as the
 * submissions inbox / CSV export). Renders a clean, single-column
 * page with a header (form name + submission timestamp), every
 * answered field as a labeled row, and attachments as links so
 * the printed page references the source file.
 *
 * The accompanying client component auto-triggers the browser's
 * print dialog on mount so the user can immediately save as PDF.
 */

function isAttachment(v: unknown): v is FormAttachment {
  return (
    typeof v === "object" &&
    v !== null &&
    "url" in v &&
    "name" in v &&
    "size" in v
  );
}

interface PageProps {
  params: Promise<{ formId: string; submissionId: string }>;
}

export default async function PrintSubmissionPage({ params }: PageProps) {
  const { formId, submissionId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect(`/login?callbackUrl=/forms/${formId}/submissions/${submissionId}/print`);
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) notFound();

  const form = await prisma.form.findUnique({
    where: { id: formId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          visibility: true,
          workspaceId: true,
          members: { select: { userId: true } },
        },
      },
    },
  });
  if (!form) notFound();

  // Access check — same as /api/forms/:id/submissions. Submissions carry PII,
  // so (unlike plain project read) a PUBLIC project does NOT expose them: only
  // the owner, a project member, or a workspace member may view a submission.
  const member = form.project.members.find((m) => m.userId === user.id);
  const isOwner = form.project.ownerId === user.id;
  let allowed = isOwner || !!member;
  if (!allowed && form.project.visibility === "WORKSPACE") {
    const wsMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: form.project.workspaceId,
        },
      },
    });
    if (wsMember) allowed = true;
  }
  if (!allowed) notFound();

  const submission = await prisma.formSubmission.findFirst({
    where: { id: submissionId, formId },
    include: {
      submitterUser: { select: { name: true, email: true } },
    },
  });
  if (!submission) notFound();

  const fields = (form.fields as unknown as FormField[]) || [];
  const data = (submission.data as FormSubmissionPayload) || {};

  // Build a stable rendered list of answers in field order.
  const rows = fields
    .filter((f) => f.type !== "HEADING")
    .map((f) => {
      const v = data[f.id];
      const attachments: FormAttachment[] = Array.isArray(v)
        ? (v as FormAnswerValue[]).filter(isAttachment)
        : isAttachment(v)
          ? [v]
          : [];
      return {
        label: f.label,
        text: attachments.length === 0 ? formatAnswerForText(v) : "",
        attachments,
      };
    });

  const submittedAt = new Date(submission.createdAt);
  const submittedAtLabel = submittedAt.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <PrintSubmissionClient>
      <div className="print-root">
        <header className="print-header">
          <div>
            <h1 className="print-title">{form.name}</h1>
            <p className="print-meta">
              Project · <strong>{form.project.name}</strong>
            </p>
          </div>
          <div className="print-meta-right">
            <p className="print-meta">
              Submitted · {submittedAtLabel}
            </p>
            {submission.submitterUser?.email && (
              <p className="print-meta">
                Submitter ·{" "}
                {submission.submitterUser.name ||
                  submission.submitterUser.email}
              </p>
            )}
            <p className="print-meta print-mono">ID · {submission.id}</p>
          </div>
        </header>

        <section className="print-body">
          {rows.map((row, i) => (
            <div key={i} className="print-row">
              <p className="print-label">{row.label}</p>
              {row.attachments.length > 0 ? (
                <ul className="print-attachments">
                  {row.attachments.map((att, j) => (
                    <li key={j}>
                      <a href={att.url} target="_blank" rel="noopener noreferrer">
                        {att.name}
                      </a>{" "}
                      <span className="print-size">
                        ({Math.round(att.size / 1024)} KB)
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="print-value">
                  {row.text || <em className="print-empty">— (no answer)</em>}
                </p>
              )}
            </div>
          ))}
        </section>

        <footer className="print-footer">
          <p>BuildSync · Tercero Tablada Civil &amp; Structural Eng Inc.</p>
          <p>Printed {new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}</p>
        </footer>
      </div>
    </PrintSubmissionClient>
  );
}
