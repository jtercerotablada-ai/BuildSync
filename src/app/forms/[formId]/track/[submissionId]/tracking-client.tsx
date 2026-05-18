"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  AlertCircle,
  Paperclip,
  Send,
  CheckCircle2,
  Clock,
  Inbox,
  X,
  ExternalLink,
} from "lucide-react";

/**
 * Public tracking page for a single form submission.
 *
 * UX goals (per Juan's priorities):
 *   - The external submitter (architect/owner/PM) gets a clean,
 *     no-login page that answers "did they see it?", "what did they
 *     say?", "can I add more info?".
 *   - Polling every 30s while focused so engineer comments appear
 *     without manual refresh.
 *   - Attachments downloadable inline (no thumbnail magic — just
 *     name + size + click to open).
 *   - Reply form supports multi-file like the original submit form.
 */

interface Attachment {
  id?: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

interface AnswerRow {
  fieldId: string;
  label: string;
  text: string;
  attachments: Attachment[];
}

interface CommentRow {
  id: string;
  content: string;
  createdAt: string;
  source: "INTERNAL" | "TRACKING_REPLY";
  authorName: string;
  authorImage: string | null;
  attachments: Attachment[];
}

interface TrackData {
  submission: {
    id: string;
    createdAt: string;
    submitterName: string | null;
  };
  form: { id: string; name: string };
  project: { id: string; name: string; color: string };
  answers: AnswerRow[];
  task: {
    id: string;
    name: string;
    statusLabel: string;
    completed: boolean;
    completedAt: string | null;
    assignee: { name: string | null; image: string | null } | null;
    comments: CommentRow[];
    attachments: Attachment[];
  } | null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function statusVisual(label: string): {
  bg: string;
  text: string;
  icon: React.ReactNode;
} {
  if (label === "Answered") {
    return {
      bg: "bg-emerald-50 border-emerald-200",
      text: "text-emerald-800",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    };
  }
  if (label === "In review") {
    return {
      bg: "bg-[#fdf7e8] border-[#e0c87a]",
      text: "text-[#8a7028]",
      icon: <Clock className="w-3.5 h-3.5" />,
    };
  }
  return {
    bg: "bg-slate-100 border-slate-200",
    text: "text-slate-700",
    icon: <Inbox className="w-3.5 h-3.5" />,
  };
}

export function TrackingPageClient({
  formId,
  submissionId,
  token,
}: {
  formId: string;
  submissionId: string;
  token: string;
}) {
  const [data, setData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [replyText, setReplyText] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchData = useCallback(
    async (showSpinner: boolean) => {
      if (!token) {
        setError("Missing tracking token in the URL.");
        setLoading(false);
        return;
      }
      if (showSpinner) setLoading(true);
      try {
        const res = await fetch(
          `/api/forms/${formId}/track/${submissionId}?token=${encodeURIComponent(token)}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            (body && typeof body === "object" && "error" in body
              ? String(body.error)
              : null) || `HTTP ${res.status}`
          );
        }
        const json = (await res.json()) as TrackData;
        setData(json);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Couldn't load the page."
        );
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [formId, submissionId, token]
  );

  // Initial fetch + polling. 30s while visible — matches /inbox.
  useEffect(() => {
    void fetchData(true);
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      if (document.hidden) return;
      void fetchData(false);
    };
    timer = setInterval(tick, 30000);
    const onVisibility = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchData]);

  const handleAddFiles = (files: FileList | null) => {
    if (!files) return;
    setReplyFiles((prev) => [...prev, ...Array.from(files)]);
  };
  const removeFile = (i: number) => {
    setReplyFiles((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handlePostReply = async () => {
    const content = replyText.trim();
    if (!content) return;
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append("token", token);
      fd.append("content", content);
      for (const f of replyFiles) fd.append("file", f);
      const res = await fetch(
        `/api/forms/${formId}/track/${submissionId}/reply`,
        { method: "POST", body: fd }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body && typeof body === "object" && "error" in body
            ? String(body.error)
            : null) || `HTTP ${res.status}`
        );
      }
      setReplyText("");
      setReplyFiles([]);
      // Re-fetch immediately so the new comment shows up.
      await fetchData(false);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to post reply."
      );
    } finally {
      setPosting(false);
    }
  };

  const status = useMemo(
    () => (data?.task ? statusVisual(data.task.statusLabel) : null),
    [data?.task]
  );

  // ── States ──────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-amber-600" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            Can&apos;t open this tracking link
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">{error}</p>
          <p className="text-xs text-slate-400 mt-4">
            Check that you copied the full URL from your receipt email,
            or contact the project team directly.
          </p>
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header band ─────────────────────────────────── */}
      <header className="bg-black text-white px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-wide">
              BuildSync
            </span>
            <span className="text-slate-400 text-xs">·</span>
            <span className="text-xs text-slate-300">Tracking page</span>
          </div>
          <span className="text-[11px] text-slate-400 hidden md:inline">
            Private link — don&apos;t share publicly
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-6">
        {/* ── Title card ──────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div
            className="h-1.5"
            style={{ backgroundColor: data.project.color }}
          />
          <div className="px-5 py-5">
            <p className="text-[11px] uppercase tracking-[1.5px] text-slate-500 font-semibold mb-1">
              {data.project.name}
            </p>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">
              {data.form.name}
            </h1>
            <p className="text-xs text-slate-500">
              Submitted {formatDateTime(data.submission.createdAt)}
              {data.submission.submitterName &&
                ` · ${data.submission.submitterName}`}
            </p>

            {data.task ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${status?.bg} ${status?.text}`}
                >
                  {status?.icon}
                  {data.task.statusLabel}
                </span>
                {data.task.assignee && (
                  <span className="text-xs text-slate-500">
                    Assigned to{" "}
                    <span className="font-medium text-slate-700">
                      {data.task.assignee.name}
                    </span>
                  </span>
                )}
                {data.task.completedAt && (
                  <span className="text-xs text-slate-500">
                    · Answered {formatDateTime(data.task.completedAt)}
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 inline-block">
                The team has removed the linked task. Your submission is
                still on record but no live status is available.
              </p>
            )}
          </div>
        </section>

        {/* ── Your submission ─────────────────────────────── */}
        <section className="bg-white rounded-xl border border-slate-200 px-5 py-5">
          <p className="text-[11px] uppercase tracking-[1.5px] text-slate-500 font-semibold mb-3">
            Your submission
          </p>
          <div className="space-y-3">
            {data.answers.map((a) => (
              <div key={a.fieldId}>
                <p className="text-[11px] text-slate-500 font-medium mb-0.5">
                  {a.label}
                </p>
                {a.attachments.length > 0 ? (
                  <ul className="space-y-1">
                    {a.attachments.map((att, i) => (
                      <li key={i}>
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-[#a8893a] hover:underline"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          {att.name}
                          <span className="text-[11px] text-slate-400">
                            ({formatBytes(att.size)})
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">
                    {a.text || "—"}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Conversation ────────────────────────────────── */}
        {data.task && (
          <section className="bg-white rounded-xl border border-slate-200 px-5 py-5">
            <p className="text-[11px] uppercase tracking-[1.5px] text-slate-500 font-semibold mb-3">
              Conversation
            </p>
            {data.task.comments.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                No replies yet. The engineering team will respond here.
              </p>
            ) : (
              <ul className="space-y-4">
                {data.task.comments.map((c) => {
                  const isGuest = c.source === "TRACKING_REPLY";
                  return (
                    <li key={c.id} className="flex items-start gap-3">
                      {/* Avatar */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${
                          isGuest
                            ? "bg-slate-100 text-slate-600 border border-slate-200"
                            : "bg-[#c9a84c] text-white"
                        }`}
                      >
                        {c.authorImage && !isGuest ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.authorImage}
                            alt=""
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          c.authorName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <p className="text-sm font-medium text-slate-900">
                            {c.authorName}
                          </p>
                          <span className="text-[11px] text-slate-400">
                            {formatDateTime(c.createdAt)}
                          </span>
                          {isGuest && (
                            <span className="text-[10px] uppercase tracking-wide text-slate-400">
                              · You
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap mt-0.5">
                          {c.content}
                        </p>
                        {c.attachments.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {c.attachments.map((att, i) => (
                              <li key={i}>
                                <a
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs text-[#a8893a] hover:underline"
                                >
                                  <Paperclip className="w-3 h-3" />
                                  {att.name}
                                  <span className="text-[10px] text-slate-400">
                                    ({formatBytes(att.size)})
                                  </span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Reply composer */}
            {!data.task.completed && (
              <div className="mt-5 pt-5 border-t border-slate-200">
                <p className="text-[11px] uppercase tracking-[1.5px] text-slate-500 font-semibold mb-2">
                  Add a follow-up
                </p>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value.slice(0, 4000))}
                  placeholder="Ask a question, add context, or share an updated drawing…"
                  rows={4}
                  disabled={posting}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-transparent disabled:bg-slate-50"
                />
                {replyFiles.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {replyFiles.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1"
                      >
                        <span className="flex items-center gap-1.5 truncate text-slate-700">
                          <Paperclip className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{f.name}</span>
                          <span className="text-slate-400 flex-shrink-0">
                            ({formatBytes(f.size)})
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="text-slate-400 hover:text-slate-700 flex-shrink-0 ml-2"
                          aria-label={`Remove ${f.name}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center justify-between gap-2 mt-2">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      hidden
                      onChange={(e) => {
                        handleAddFiles(e.target.files);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={posting}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-600"
                    >
                      <Paperclip className="w-3 h-3" />
                      Attach file
                    </button>
                    <span className="tabular-nums">
                      {replyText.length}/4000
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handlePostReply}
                    disabled={posting || !replyText.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-black hover:bg-gray-900 text-white text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {posting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Posting…
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Send reply
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
            {data.task.completed && (
              <div className="mt-5 pt-5 border-t border-slate-200 text-xs text-slate-500 bg-slate-50 -mx-5 -mb-5 px-5 py-3">
                This request is closed. To reopen the conversation,
                contact the project team directly.
              </div>
            )}
          </section>
        )}

        {/* Footer */}
        <footer className="text-center text-[11px] text-slate-400 pt-2">
          Powered by{" "}
          <span className="font-semibold text-slate-600">BuildSync</span>
          {" · "}
          <a
            href="/"
            className="hover:text-slate-700 inline-flex items-center gap-0.5"
          >
            Visit site
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </footer>
      </main>
    </div>
  );
}
