"use client";

import { AlertTriangle, Copy, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToday } from "@/lib/use-today";
import { daysFromToday } from "@/lib/date-only";
import {
  DEADLINE_STATE_LABEL,
  REFERENCE_LABEL,
  deadlineBucket,
  deadlineCopyFor,
  deadlineState,
  deadlineToneClass,
  formatDaysOut,
  formatDeadlineDate,
  referenceFieldsFor,
  type ReferenceField,
} from "@/lib/regulatory";

/**
 * The Overview's "Job info" card: who has jurisdiction (the AHJ), the numbers
 * the city asks for, the one regulatory date that can hurt us, and who to
 * call at the client. Read-only here; editing goes through the project's
 * Edit details dialog (onEdit), which is also the only edit entry on phones
 * (the header's "Edit details" is hidden below md).
 *
 * Server-rendered data, so there is no loading or error state. Every day
 * count waits for useToday(): the server renders in UTC and React would not
 * repair a wrong "in N days" after 20:00 Miami.
 */

export interface JobInfoProject {
  type?: string | null;
  stage?: string | null;
  status?: string | null;
  isArchived?: boolean | null;
  clientName?: string | null;
  jurisdiction?: string | null;
  folioNumber?: string | null;
  permitNumber?: string | null;
  caseNumber?: string | null;
  regulatoryDeadline?: string | Date | null;
  clientContactName?: string | null;
  clientContactEmail?: string | null;
  clientContactPhone?: string | null;
}

const COPY_ARIA: Record<ReferenceField, string> = {
  folioNumber: "Copy folio number",
  permitNumber: "Copy permit number",
  caseNumber: "Copy case number",
};

function hasText(v: string | null | undefined): v is string {
  return !!v && v.trim().length > 0;
}

/** Days pill for a LIVE deadline, or the slate state word when it is not.
 *  Renders nothing for the pill until the viewer's day is known. */
export function DeadlineStatus({
  project,
  className,
}: {
  project: JobInfoProject;
  className?: string;
}) {
  const today = useToday();
  if (!project.regulatoryDeadline) return null;
  const state = deadlineState({
    isArchived: project.isArchived ?? false,
    status: project.status ?? null,
    stage: project.stage ?? null,
  });
  if (state !== "live") {
    return (
      <span className={cn("text-[11px] font-medium text-slate-500", className)}>
        {DEADLINE_STATE_LABEL[state]}
      </span>
    );
  }
  if (!today) return null;
  const n = daysFromToday(project.regulatoryDeadline, today);
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium tabular-nums whitespace-nowrap",
        deadlineToneClass(deadlineBucket(n)),
        className
      )}
    >
      {formatDaysOut(n)}
    </span>
  );
}

/** The one-line rail readout under the Stage block:
 *  "<short> · Dec 15 · <pill or state word>". Nothing when no deadline. */
export function DeadlineRailLine({ project }: { project: JobInfoProject }) {
  const today = useToday();
  if (!project.regulatoryDeadline) return null;
  const copy = deadlineCopyFor(project.type ?? null);
  const live =
    deadlineState({
      isArchived: project.isArchived ?? false,
      status: project.status ?? null,
      stage: project.stage ?? null,
    }) === "live";
  const overdue =
    live && !!today && daysFromToday(project.regulatoryDeadline, today) < 0;
  return (
    <div
      className="mt-2 flex items-center gap-1.5 text-xs text-slate-600 min-w-0"
      title={`${copy.label}: ${formatDeadlineDate(project.regulatoryDeadline)}`}
    >
      {overdue && (
        <AlertTriangle
          className="w-3.5 h-3.5 text-red-600 flex-shrink-0"
          aria-label="Deadline passed"
        />
      )}
      <span className="truncate">{copy.short}</span>
      <span className="text-slate-300">·</span>
      <span className="tabular-nums whitespace-nowrap">
        {formatDeadlineDate(project.regulatoryDeadline, { year: false })}
      </span>
      <span className="text-slate-300">·</span>
      <DeadlineStatus project={project} />
    </div>
  );
}

/** tel: link — digits and a leading + only, with any extension dropped
 *  (dialling "…0142 ext 12" as one number would reach nobody). */
function telHref(phone: string): string {
  const main = phone.split(/\s*(?:ext\.?|x|#)\s*/i)[0] ?? phone;
  return `tel:${main.replace(/[^0-9+]/g, "")}`;
}

function Empty() {
  return <span className="text-slate-300">—</span>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-0.5">
        {label}
      </dt>
      <dd className="text-sm text-slate-800 min-w-0 break-words">{children}</dd>
    </div>
  );
}

function ReferenceValue({
  field,
  value,
}: {
  field: ReferenceField;
  value: string | null | undefined;
}) {
  if (!hasText(value)) return <Empty />;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  };
  return (
    <span className="group/ref inline-flex items-center gap-1.5 max-w-full">
      <span className="font-mono text-[13px] break-all">{value}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={COPY_ARIA[field]}
        title="Copy"
        className={cn(
          "flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-opacity",
          // Always visible on touch; hover-reveal from md up.
          "md:opacity-0 md:group-hover/ref:opacity-100 md:focus-visible:opacity-100"
        )}
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

export function JobInfoCard({
  project,
  canEdit,
  onEdit,
}: {
  project: JobInfoProject;
  canEdit: boolean;
  onEdit?: () => void;
}) {
  const type = project.type ?? null;
  const copy = deadlineCopyFor(type);
  const references = referenceFieldsFor(type);
  if (!references.includes("caseNumber") && hasText(project.caseNumber)) {
    references.push("caseNumber");
  }

  const allEmpty =
    !hasText(project.jurisdiction) &&
    !hasText(project.folioNumber) &&
    !hasText(project.permitNumber) &&
    !hasText(project.caseNumber) &&
    !project.regulatoryDeadline &&
    !hasText(project.clientName) &&
    !hasText(project.clientContactName) &&
    !hasText(project.clientContactEmail) &&
    !hasText(project.clientContactPhone);

  const editable = canEdit && !!onEdit;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-medium text-slate-900">Job info</h2>
        {editable && !allEmpty && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            Edit
          </Button>
        )}
      </div>

      {allEmpty ? (
        editable ? (
          <div className="border border-dashed border-slate-300 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-slate-500 flex-1">
              Add the authority, permit or folio numbers, the regulatory
              deadline and the client contact.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add job info
            </Button>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No job info yet.</p>
        )
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 border border-slate-200 rounded-lg p-4 bg-white">
          <Field label="Jurisdiction">
            {hasText(project.jurisdiction) ? project.jurisdiction : <Empty />}
          </Field>
          <Field label={copy.label}>
            {project.regulatoryDeadline ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="tabular-nums">
                  {formatDeadlineDate(project.regulatoryDeadline)}
                </span>
                <DeadlineStatus project={project} />
              </span>
            ) : (
              <Empty />
            )}
          </Field>
          {references.map((field) => (
            <Field key={field} label={REFERENCE_LABEL[field]}>
              <ReferenceValue field={field} value={project[field]} />
            </Field>
          ))}
          <Field label="Client">
            {hasText(project.clientName) || hasText(project.clientContactName) ? (
              <span className="block">
                {hasText(project.clientName) ? project.clientName : <Empty />}
                {hasText(project.clientContactName) && (
                  <span className="block text-[13px] text-slate-500">
                    {project.clientContactName}
                  </span>
                )}
              </span>
            ) : (
              <Empty />
            )}
          </Field>
          <Field label="Contact">
            {hasText(project.clientContactEmail) ||
            hasText(project.clientContactPhone) ? (
              <span className="flex flex-col gap-0.5">
                {hasText(project.clientContactEmail) && (
                  <a
                    href={`mailto:${project.clientContactEmail}`}
                    className="text-slate-800 hover:text-[#a8893a] hover:underline decoration-[#c9a84c] underline-offset-2 break-all"
                  >
                    {project.clientContactEmail}
                  </a>
                )}
                {hasText(project.clientContactPhone) && (
                  <a
                    href={telHref(project.clientContactPhone)}
                    className="text-slate-800 hover:text-[#a8893a] hover:underline decoration-[#c9a84c] underline-offset-2"
                  >
                    {project.clientContactPhone}
                  </a>
                )}
              </span>
            ) : (
              <Empty />
            )}
          </Field>
        </dl>
      )}
    </div>
  );
}
