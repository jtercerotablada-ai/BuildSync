"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ExternalLink,
  Inbox,
  Download,
  Paperclip,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import {
  type FormField,
  type FormRow,
  type FormAnswerValue,
  formatAnswerForText,
} from "@/lib/form-types";

/**
 * Submissions inbox — lists every entry for a form. Click a row to
 * jump to its auto-created task. "Export CSV" downloads the full
 * submissions table for offline analysis.
 *
 * Renders all 10 field types correctly: ATTACHMENT cells show the
 * file name + a link to the blob URL; MULTI_SELECT becomes
 * comma-joined; HEADING fields are skipped (no answer to display).
 */

interface AttachmentValue {
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

interface Submission {
  id: string;
  data: Record<string, FormAnswerValue>;
  taskId: string | null;
  createdAt: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: FormRow | null;
  onOpenTask: (taskId: string) => void;
}

function isAttachment(v: unknown): v is AttachmentValue {
  return (
    typeof v === "object" &&
    v !== null &&
    "url" in v &&
    "name" in v &&
    "size" in v
  );
}

export function FormSubmissionsDialog({
  open,
  onOpenChange,
  form,
  onOpenTask,
}: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !form) return;
    let canceled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/forms/${form.id}/submissions`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "Couldn't load submissions");
        }
        const data: Submission[] = await res.json();
        if (!canceled) setSubmissions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!canceled) {
          toast.error(
            err instanceof Error ? err.message : "Couldn't load submissions"
          );
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [open, form]);

  // Map fieldId → label so answers render with their human label.
  const fieldLabelById: Record<string, string> = {};
  for (const f of (form?.fields as FormField[]) || []) {
    fieldLabelById[f.id] = f.label;
  }

  function handleExportCsv() {
    if (!form) return;
    // Browser handles the download via the endpoint's
    // Content-Disposition header; we just navigate.
    window.location.href = `/api/forms/${form.id}/submissions/export`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2">
              <Inbox className="w-5 h-5 text-[#a8893a]" />
              Submissions: {form?.name || "—"}
            </DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={!form || submissions.length === 0}
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Export CSV
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-2">
          {loading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : submissions.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-12">
              No submissions yet. Share the public form URL to start
              collecting tasks.
            </p>
          ) : (
            <ul className="space-y-3">
              {submissions.map((s) => (
                <li
                  key={s.id}
                  className="border rounded-lg p-3 bg-white space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                      {new Date(s.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    <div className="flex items-center gap-3">
                      {form && (
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              `/forms/${form.id}/submissions/${s.id}/print`,
                              "_blank"
                            )
                          }
                          className="text-[11px] text-slate-500 hover:text-slate-800 font-medium flex items-center gap-0.5"
                          title="Open a printable view — Save as PDF in the print dialog"
                        >
                          <Printer className="w-3 h-3" />
                          Print / PDF
                        </button>
                      )}
                      {s.taskId && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenTask(s.taskId!);
                            onOpenChange(false);
                          }}
                          className="text-[11px] text-[#a8893a] hover:text-[#8a7028] font-medium flex items-center gap-0.5"
                        >
                          Open task
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(s.data).map(([fieldId, value]) => {
                      // ATTACHMENT — could be a single attachment
                      // (legacy submissions) or an array of them
                      // (current multi-file shape). Normalize to
                      // array and render each as a paperclip link.
                      const attachmentList: AttachmentValue[] =
                        Array.isArray(value)
                          ? value.filter(isAttachment)
                          : isAttachment(value)
                            ? [value]
                            : [];
                      if (attachmentList.length > 0) {
                        return (
                          <div key={fieldId} className="text-sm">
                            <span className="text-slate-500 font-medium">
                              {fieldLabelById[fieldId] || fieldId}:
                            </span>
                            <ul className="mt-1 ml-2 space-y-0.5">
                              {attachmentList.map((att, i) => (
                                <li key={i}>
                                  <a
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#a8893a] hover:underline inline-flex items-center gap-1"
                                  >
                                    <Paperclip className="w-3 h-3" />
                                    {att.name}
                                    <span className="text-[10px] text-slate-400 ml-1">
                                      ({Math.round(att.size / 1024)} KB)
                                    </span>
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      }
                      return (
                        <div key={fieldId} className="text-sm">
                          <span className="text-slate-500 font-medium">
                            {fieldLabelById[fieldId] || fieldId}:
                          </span>{" "}
                          <span className="text-slate-700 whitespace-pre-wrap break-words">
                            {formatAnswerForText(value) || "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
