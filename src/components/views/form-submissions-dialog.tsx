"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import {
  type FormField,
  type FormRow,
  type FormAnswerValue,
  formatAnswerForText,
} from "@/lib/form-types";

/**
 * Submissions inbox — lists every entry for a form, newest first, a page
 * at a time. Click a row to jump to its auto-created task. "Export CSV"
 * downloads the full submissions table for offline analysis.
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

interface SubmissionsPage {
  total: number;
  nextCursor: string | null;
  submissions: Submission[];
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

async function fetchPage(formId: string, cursor: string | null) {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const res = await fetch(`/api/forms/${formId}/submissions${qs}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Couldn't load submissions");
  }
  const data: SubmissionsPage = await res.json();
  return {
    total: typeof data.total === "number" ? data.total : 0,
    nextCursor: data.nextCursor ?? null,
    submissions: Array.isArray(data.submissions) ? data.submissions : [],
  };
}

export function FormSubmissionsDialog({
  open,
  onOpenChange,
  form,
  onOpenTask,
}: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // A failed load must not fall through to "No submissions yet" — that
  // reads as "nobody has submitted", which is exactly the wrong conclusion.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const formId = form?.id ?? null;
  // The dialog stays mounted while it switches forms, so a "Load older"
  // page that lands after the form changed (or the dialog reloaded) must be
  // dropped, not appended under the wrong form's heading.
  const loadGenRef = useRef(0);

  useEffect(() => {
    if (!open || !formId) return;
    let canceled = false;
    loadGenRef.current += 1;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const page = await fetchPage(formId, null);
        if (canceled) return;
        setSubmissions(page.submissions);
        setTotal(page.total);
        setNextCursor(page.nextCursor);
      } catch (err) {
        if (!canceled) {
          setSubmissions([]);
          setNextCursor(null);
          setLoadError(
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
  }, [open, formId, reloadKey]);

  const loadMore = useCallback(async () => {
    if (!formId || !nextCursor || loadingMore) return;
    const gen = loadGenRef.current;
    setLoadingMore(true);
    try {
      const page = await fetchPage(formId, nextCursor);
      if (gen !== loadGenRef.current) return;
      setSubmissions((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        return [...prev, ...page.submissions.filter((s) => !seen.has(s.id))];
      });
      setTotal(page.total);
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (gen !== loadGenRef.current) return;
      toast.error(
        err instanceof Error ? err.message : "Couldn't load more submissions"
      );
    } finally {
      setLoadingMore(false);
    }
  }, [formId, nextCursor, loadingMore]);

  // A submitter who lost the receipt email has no other way back to their
  // tracking page; the server signs a fresh link for staff on demand.
  async function copyTrackingLink(submissionId: string) {
    if (!formId || copyingId) return;
    setCopyingId(submissionId);
    try {
      const res = await fetch(
        `/api/forms/${formId}/submissions?tracking=${encodeURIComponent(submissionId)}`
      );
      const body = await res.json().catch(() => null);
      if (!res.ok || typeof body?.trackingUrl !== "string") {
        throw new Error(body?.error || "Couldn't create the tracking link");
      }
      try {
        await navigator.clipboard.writeText(body.trackingUrl);
        toast.success("Tracking link copied");
      } catch {
        // Clipboard blocked (the await dropped the user gesture, or the
        // browser refuses): hand the link over for a manual copy instead.
        window.prompt("Copy the tracking link:", body.trackingUrl);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't create the tracking link"
      );
    } finally {
      setCopyingId(null);
    }
  }

  const fields: FormField[] = ((form?.fields as FormField[]) || []).filter(
    (f) => f.type !== "HEADING"
  );
  const fieldIds = new Set(fields.map((f) => f.id));

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
              {!loading && !loadError && total > 0 && (
                <span className="text-sm font-normal text-slate-500">
                  ({total})
                </span>
              )}
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
          ) : loadError ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm text-red-600">{loadError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReloadKey((k) => k + 1)}
              >
                Retry
              </Button>
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
                      <button
                        type="button"
                        onClick={() => copyTrackingLink(s.id)}
                        disabled={copyingId !== null}
                        className="text-[11px] text-slate-500 hover:text-slate-800 font-medium flex items-center gap-0.5 disabled:opacity-50"
                        title="Copy a private link the submitter can use to follow this request"
                      >
                        {copyingId === s.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Link2 className="w-3 h-3" />
                        )}
                        Copy tracking link
                      </button>
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
                    {/* Form order, not the stored key order (jsonb reorders
                        keys); answers to fields since removed from the
                        form follow, under their raw id. */}
                    {[
                      ...fields.map((f) => [f.id, f] as const),
                      ...Object.keys(s.data)
                        .filter((id) => !fieldIds.has(id))
                        .map((id) => [id, undefined] as const),
                    ].map(([fieldId, field]) => {
                      const value = s.data[fieldId];
                      if (value === undefined) return null;
                      const label = field?.label || fieldId;
                      // ATTACHMENT — could be a single attachment
                      // (legacy submissions) or an array of them
                      // (current multi-file shape). Only a real file
                      // field renders as files; the server already
                      // stripped links that don't point at our store.
                      const attachmentList: AttachmentValue[] =
                        field?.type === "ATTACHMENT"
                          ? Array.isArray(value)
                            ? value.filter(isAttachment)
                            : isAttachment(value)
                              ? [value]
                              : []
                          : [];
                      if (attachmentList.length > 0) {
                        return (
                          <div key={fieldId} className="text-sm">
                            <span className="text-slate-500 font-medium">
                              {label}:
                            </span>
                            <ul className="mt-1 ml-2 space-y-0.5">
                              {attachmentList.map((att, i) => (
                                <li key={i}>
                                  {att.url ? (
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
                                  ) : (
                                    <span
                                      className="text-slate-500 inline-flex items-center gap-1"
                                      title="This file link could not be verified, so it is not shown"
                                    >
                                      <Paperclip className="w-3 h-3" />
                                      {att.name}
                                      <span className="text-[10px] text-slate-400 ml-1">
                                        (unavailable)
                                      </span>
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      }
                      return (
                        <div key={fieldId} className="text-sm">
                          <span className="text-slate-500 font-medium">
                            {label}:
                          </span>{" "}
                          <span className="text-slate-700 whitespace-pre-wrap break-words">
                            {formatAnswerForText(value, field) || "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
              {nextCursor && (
                <li className="flex flex-col items-center gap-1 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore && (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    )}
                    Load older submissions
                  </Button>
                  <span className="text-[11px] text-slate-400">
                    Showing {submissions.length} of {total}
                  </span>
                </li>
              )}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
