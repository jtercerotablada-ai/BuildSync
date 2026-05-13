"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ExternalLink, Inbox } from "lucide-react";
import { toast } from "sonner";
import type { FormField, FormRow } from "@/lib/form-types";

/**
 * Submissions inbox — lists every entry for a form. Click a row to
 * jump to its auto-created task in the project. Re-uses the form's
 * fields list to render labels alongside the raw answers.
 */

interface Submission {
  id: string;
  data: Record<string, string>;
  taskId: string | null;
  createdAt: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: FormRow | null;
  onOpenTask: (taskId: string) => void;
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

  // Map fieldId → label for rendering answers with their original
  // labels instead of opaque ids.
  const fieldLabelById: Record<string, string> = {};
  for (const f of (form?.fields as FormField[]) || []) {
    fieldLabelById[f.id] = f.label;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-[#a8893a]" />
            Submissions: {form?.name || "—"}
          </DialogTitle>
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
                  <div className="space-y-1">
                    {Object.entries(s.data).map(([fieldId, value]) => (
                      <div key={fieldId} className="text-sm">
                        <span className="text-slate-500 font-medium">
                          {fieldLabelById[fieldId] || fieldId}:
                        </span>{" "}
                        <span className="text-slate-700 whitespace-pre-wrap break-words">
                          {value || "—"}
                        </span>
                      </div>
                    ))}
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
