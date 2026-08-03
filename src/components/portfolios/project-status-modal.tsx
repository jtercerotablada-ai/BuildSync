"use client";

/**
 * ProjectStatusModal — Asana-parity "Status of <project>" surface for the
 * portfolio List view. Replaces the old thin PortfolioStatusView.
 *
 * Two presentations behind ONE component (same {project, variant, onClose}
 * contract the portfolio page already mounts, keyed per project id):
 *  - variant "modal"  → clicking a row's STATUS cell. Full Asana layout:
 *      header ("Status of X" + "Update status" + copy-link/expand + close),
 *      a left sidebar listing every past update (click to switch), and a
 *      main pane with a status-colored accent bar, headline, author, the
 *      Status/Project field rows, the structured `sections` blocks (or a
 *      plaintext summary fallback), and a "What's next?" table of the
 *      project's upcoming tasks (next 2 weeks).
 *  - variant "panel"  → clicking a row's PROGRESS cell. A right slide-over
 *      progress view: % complete, task counts, date range, and the latest
 *      status card.
 *
 * Data is all read-only + already-served: GET /api/projects/[id]/status-updates
 * (returns the structured `sections` the old viewer discarded) and
 * GET /api/tasks?projectId=…&completed=false (client-filtered to the window).
 * Posting a new update / commenting / reactions / followers are follow-up
 * phases that need backend — this component deliberately ships no dead
 * stub controls for them.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Link2,
  Maximize2,
  X,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  ArrowUpRight,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────

type ProjectStatusKey =
  | "ON_TRACK"
  | "AT_RISK"
  | "OFF_TRACK"
  | "ON_HOLD"
  | "COMPLETE";

/** Status → label + colours. Mirrors STATUS_OPTIONS in the portfolio page
 *  (kept local so this component is standalone). `dot` doubles as the
 *  accent-bar / sidebar-dot colour; `chip` styles the badge. */
const STATUS_VISUAL: Record<
  ProjectStatusKey,
  { label: string; dot: string; chip: string; accent: string }
> = {
  ON_TRACK: {
    label: "On track",
    dot: "bg-[#c9a84c]",
    chip: "bg-[#c9a84c]/15 text-[#a8893a]",
    accent: "bg-[#c9a84c]",
  },
  AT_RISK: {
    label: "At risk",
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-800",
    accent: "bg-amber-500",
  },
  OFF_TRACK: {
    label: "Off track",
    dot: "bg-black",
    chip: "bg-gray-100 text-black",
    accent: "bg-black",
  },
  ON_HOLD: {
    label: "On hold",
    dot: "bg-gray-400",
    chip: "bg-gray-100 text-gray-700",
    accent: "bg-gray-400",
  },
  COMPLETE: {
    label: "Complete",
    dot: "bg-[#a8893a]",
    chip: "bg-[#a8893a]/15 text-[#a8893a]",
    accent: "bg-[#a8893a]",
  },
};

function statusVisual(s: ProjectStatusKey) {
  return STATUS_VISUAL[s] || STATUS_VISUAL.ON_TRACK;
}

const STATUS_ORDER: ProjectStatusKey[] = [
  "ON_TRACK",
  "AT_RISK",
  "OFF_TRACK",
  "ON_HOLD",
  "COMPLETE",
];

/** Default block-builder template shown when composing a new update.
 *  Mirrors the project Overview composer + the API's section types. */
const DEFAULT_COMPOSER_SECTIONS: StatusSection[] = [
  { id: "summary", type: "SUMMARY", label: "Summary", content: "" },
  {
    id: "accomplished",
    type: "ACCOMPLISHED",
    label: "What we've accomplished",
    content: "",
  },
  { id: "blocked", type: "BLOCKED", label: "What's blocked", content: "" },
  { id: "next_steps", type: "NEXT_STEPS", label: "Next steps", content: "" },
];

interface StatusSection {
  id: string;
  type: string;
  label: string;
  content: string;
}

interface ProjectStatusUpdate {
  id: string;
  status: ProjectStatusKey;
  summary: string;
  sections: StatusSection[] | null;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    email?: string | null;
    image: string | null;
  } | null;
}

interface UpcomingTask {
  id: string;
  name: string;
  startDate: string | null;
  dueDate: string | null;
  completed?: boolean;
  assignee: { id: string; name: string | null; image: string | null } | null;
}

/** Structural subset of the portfolio page's `Project` — passing the full
 *  object type-checks by structural typing. */
export interface StatusModalProject {
  id: string;
  name: string;
  color: string;
  status: ProjectStatusKey;
  startDate?: string | null;
  endDate?: string | null;
  owner?: { id: string; name: string | null; image: string | null } | null;
  stats?: {
    total?: number;
    completed?: number;
    overdue?: number;
    progress: number;
  };
}

// ── Date helpers ────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** "Just now" / "5 minutes ago" / "2 hours ago" / "Yesterday" / "Aug 3". */
function formatRelativeTime(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24 && then.getDate() === now.getDate()) {
    return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  }
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (then.toDateString() === y.toDateString()) return "Yesterday";
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Sidebar / short label: "Today" / "Yesterday" / "Aug 3". */
function formatDayLabel(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  if (then.toDateString() === now.toDateString()) return "Today";
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (then.toDateString() === y.toDateString()) return "Yesterday";
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function monthDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Task date pill: "Aug 3 – 7" (same month), "Aug 30 – Sep 4" (cross), or a
 *  single "Aug 7" when only a due date exists. */
function taskRange(start: string | null, due: string | null): string {
  if (start && due) {
    const s = new Date(start);
    const e = new Date(due);
    if (s.toDateString() === e.toDateString()) return monthDay(due);
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
      return `${monthDay(start)} – ${e.getDate()}`;
    }
    return `${monthDay(start)} – ${monthDay(due)}`;
  }
  if (due) return monthDay(due);
  if (start) return monthDay(start);
  return "—";
}

/** Derive a one-line headline from an update. Prefers the SUMMARY block's
 *  first line, else the first non-empty line of the plaintext summary. */
function headlineOf(u: ProjectStatusUpdate): string {
  const fromSection = u.sections?.find(
    (s) => s.type === "SUMMARY" && s.content.trim()
  )?.content;
  const raw = (fromSection || u.summary || "").trim();
  if (!raw) return "Status update";
  const firstLine = raw.split("\n").find((l) => l.trim())?.trim() || raw;
  return firstLine.length > 90 ? firstLine.slice(0, 88) + "…" : firstLine;
}

// ── Component ───────────────────────────────────────────────

export function ProjectStatusModal({
  project,
  variant,
  onClose,
  canEdit = false,
  onPosted,
}: {
  project: StatusModalProject;
  variant: "modal" | "panel";
  onClose: () => void;
  /** When true, the "Update status" composer is available. */
  canEdit?: boolean;
  /** Called after a new update posts, so the page can refetch the row. */
  onPosted?: () => void;
}) {
  const router = useRouter();
  const [updates, setUpdates] = useState<ProjectStatusUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<UpcomingTask[]>([]);

  // Composer state (Asana "Update status" / "New status update").
  const [composing, setComposing] = useState(false);
  const [postStatus, setPostStatus] = useState<ProjectStatusKey>(
    project.status
  );
  const [postSections, setPostSections] = useState<StatusSection[]>(() =>
    DEFAULT_COMPOSER_SECTIONS.map((s) => ({ ...s }))
  );
  const [posting, setPosting] = useState(false);

  // Status-update history. Keyed per project at the callsite so a fresh
  // mount always starts in `loading` from useState — no setState-in-effect.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${project.id}/status-updates`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: ProjectStatusUpdate[]) => {
        if (cancelled) return;
        const arr = Array.isArray(d) ? d : [];
        setUpdates(arr);
        setSelectedId(arr[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setUpdates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  // Upcoming tasks for "What's next?" (modal only). Non-completed project
  // tasks, client-filtered to the next 14 days — matches the app convention.
  useEffect(() => {
    if (variant !== "modal") return;
    let cancelled = false;
    fetch(`/api/tasks?projectId=${project.id}&completed=false`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: UpcomingTask[]) => {
        if (!cancelled) setTasks(Array.isArray(d) ? d : []);
      })
      .catch(() => {
        if (!cancelled) setTasks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [project.id, variant]);

  const selected = useMemo(
    () => updates.find((u) => u.id === selectedId) || updates[0] || null,
    [updates, selectedId]
  );

  const upcoming = useMemo(() => {
    const today = startOfDay(new Date());
    const end = new Date(today);
    end.setDate(end.getDate() + 14);
    end.setHours(23, 59, 59, 999);
    return tasks
      .filter((t) => !t.completed && t.dueDate)
      .filter((t) => {
        const due = new Date(t.dueDate as string);
        const s = new Date(t.startDate || (t.dueDate as string));
        return due >= today && s <= end;
      })
      .sort(
        (a, b) =>
          new Date(a.startDate || (a.dueDate as string)).getTime() -
          new Date(b.startDate || (b.dueDate as string)).getTime()
      )
      .slice(0, 12);
  }, [tasks]);

  const copyLink = () => {
    try {
      const url = `${window.location.origin}/projects/${project.id}?view=overview`;
      navigator.clipboard?.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  };
  const openProject = () =>
    router.push(`/projects/${project.id}?view=overview`);

  const startComposing = () => {
    setPostStatus(project.status);
    setPostSections(DEFAULT_COMPOSER_SECTIONS.map((s) => ({ ...s })));
    setComposing(true);
  };

  const composerHasContent = postSections.some((s) => s.content.trim());

  const submitUpdate = async () => {
    if (!composerHasContent || posting) return;
    setPosting(true);
    try {
      const res = await fetch(
        `/api/projects/${project.id}/status-updates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: postStatus,
            sections: postSections.map((s) => ({
              id: s.id,
              type: s.type,
              label: s.label,
              content: s.content,
            })),
            syncProjectStatus: true,
          }),
        }
      );
      if (!res.ok) {
        toast.error(
          res.status === 403
            ? "You don't have permission to post here"
            : "Couldn't post the update"
        );
        return;
      }
      const created: ProjectStatusUpdate = await res.json();
      setUpdates((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setComposing(false);
      toast.success("Status updated");
      onPosted?.();
    } catch {
      toast.error("Couldn't post the update");
    } finally {
      setPosting(false);
    }
  };

  // ── PANEL variant: progress view ──────────────────────────
  if (variant === "panel") {
    const st = project.stats;
    const pct = Math.max(0, Math.min(100, Math.round(st?.progress ?? 0)));
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[440px] bg-white border-l flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-3.5 h-3.5 rounded flex-shrink-0"
              style={{ backgroundColor: project.color }}
            />
            <h2 className="font-semibold text-[15px] text-gray-900 truncate">
              {project.name}
            </h2>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={openProject}
              className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
            >
              View project
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
          {/* Progress */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs uppercase tracking-wider text-gray-400 font-medium">
                Progress
              </span>
              <span className="text-2xl font-semibold text-gray-900 tabular-nums">
                {pct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#c9a84c] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Task counts */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border p-3">
              <div className="text-lg font-semibold text-gray-900 tabular-nums">
                {st?.total ?? 0}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">Total tasks</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1 text-lg font-semibold text-gray-900 tabular-nums">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {st?.completed ?? 0}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">Completed</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1 text-lg font-semibold text-gray-900 tabular-nums">
                <AlertTriangle
                  className={cn(
                    "h-4 w-4",
                    (st?.overdue ?? 0) > 0 ? "text-red-500" : "text-gray-300"
                  )}
                />
                {st?.overdue ?? 0}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">Overdue</div>
            </div>
          </div>

          {/* Date range */}
          {(project.startDate || project.endDate) && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              <span>
                {project.startDate ? monthDay(project.startDate) : "—"}
                {" – "}
                {project.endDate ? monthDay(project.endDate) : "—"}
              </span>
            </div>
          )}

          {/* Latest status */}
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-2">
              Latest status
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : !selected ? (
              <p className="text-sm text-gray-500">No status updates yet.</p>
            ) : (
              <div
                className={cn(
                  "rounded-lg border border-t-4 p-3 bg-white",
                  statusVisual(selected.status).accent.replace("bg-", "border-t-")
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge className={cn(statusVisual(selected.status).chip, "text-xs")}>
                    {statusVisual(selected.status).label}
                  </Badge>
                  <span className="text-[11px] text-gray-400">
                    {formatRelativeTime(selected.createdAt)}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  {headlineOf(selected)}
                </p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-4">
                  {selected.summary || "—"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── MODAL variant: full Asana status layout ───────────────
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 animate-in fade-in"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-[900px] h-[85vh] max-h-[720px] bg-white rounded-2xl border flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0">
          <h2 className="font-semibold text-[15px] text-gray-900 truncate">
            {composing ? "New status update" : `Status of ${project.name}`}
          </h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!composing && canEdit && (
              <button
                onClick={startComposing}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-black hover:bg-gray-800 rounded-md px-2.5 py-1.5"
              >
                Update status
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body: composer, or sidebar + main pane */}
        {composing ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-400 font-medium mb-2">
                  Status
                </label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_ORDER.map((s) => {
                    const v = statusVisual(s);
                    const on = postStatus === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setPostStatus(s)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
                          on
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full",
                            on ? "bg-white" : v.dot
                          )}
                        />
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {postSections.map((s, i) => (
                <div key={s.id}>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    {s.label}
                  </label>
                  <textarea
                    value={s.content}
                    onChange={(e) =>
                      setPostSections((prev) =>
                        prev.map((p, j) =>
                          j === i ? { ...p, content: e.target.value } : p
                        )
                      )
                    }
                    rows={s.type === "SUMMARY" ? 3 : 2}
                    placeholder={`Add ${s.label.toLowerCase()}…`}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c]/40 outline-none resize-y"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-3 border-t flex-shrink-0">
              <button
                type="button"
                onClick={() => setComposing(false)}
                className="text-sm text-gray-600 px-3 py-1.5 rounded-md hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitUpdate}
                disabled={!composerHasContent || posting}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-black rounded-md px-3 py-1.5 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {posting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Post update
              </button>
            </div>
          </div>
        ) : (
        <div className="flex-1 flex min-h-0">
          {/* Left sidebar — update history */}
          <aside className="hidden md:flex w-[236px] flex-col border-r bg-gray-50/60 overflow-y-auto flex-shrink-0">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : updates.length === 0 ? (
              <p className="text-xs text-gray-400 px-4 py-6">No updates yet.</p>
            ) : (
              updates.map((u) => {
                const v = statusVisual(u.status);
                const active = u.id === (selected?.id ?? null);
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelectedId(u.id)}
                    className={cn(
                      "text-left px-4 py-3 border-b border-gray-100 hover:bg-white transition-colors",
                      active && "bg-white border-l-2 border-l-[#c9a84c]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-gray-900 truncate">
                        {headlineOf(u)}
                      </span>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">
                        {formatDayLabel(u.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={cn("w-1.5 h-1.5 rounded-full", v.dot)} />
                      <span className="text-[11px] text-gray-500">
                        {v.label}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </aside>

          {/* Main pane */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : !selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <p className="text-sm text-gray-500 mb-3">
                  No status updates yet.
                </p>
                <button
                  onClick={openProject}
                  className="text-sm text-[#a8893a] hover:underline"
                >
                  Post a status update
                </button>
              </div>
            ) : (
              <>
                {/* Status-colored accent bar */}
                <div
                  className={cn(
                    "h-1 flex-shrink-0",
                    statusVisual(selected.status).accent
                  )}
                />
                <div className="flex-1 overflow-y-auto px-6 py-5">
                  {/* Headline + actions */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 leading-snug">
                      {headlineOf(selected)}
                    </h3>
                    <div className="flex items-center gap-0.5 flex-shrink-0 text-gray-400">
                      <button
                        onClick={copyLink}
                        title="Copy link"
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Link2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={openProject}
                        title="Open in project"
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Author */}
                  <div className="flex items-center gap-2 mb-4">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={selected.author?.image || ""} />
                      <AvatarFallback className="text-xs bg-gray-200">
                        {selected.author?.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">
                        {selected.author?.name || "Someone"}
                      </span>
                      <span className="text-gray-400">
                        {" · "}
                        {formatRelativeTime(selected.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Field rows */}
                  <div className="grid grid-cols-[92px_1fr] gap-y-2.5 items-center text-sm mb-5">
                    <div className="text-gray-500">Status</div>
                    <div>
                      <Badge
                        className={cn(statusVisual(selected.status).chip, "text-xs")}
                      >
                        {statusVisual(selected.status).label}
                      </Badge>
                    </div>
                    <div className="text-gray-500">Project</div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded flex-shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="text-gray-800 truncate">
                        {project.name}
                      </span>
                    </div>
                  </div>

                  {/* Summary / structured sections */}
                  <div className="space-y-4">
                    {selected.sections &&
                    selected.sections.some((s) => s.content.trim()) ? (
                      selected.sections
                        .filter((s) => s.content.trim())
                        .map((s) => (
                          <div key={s.id}>
                            <h4 className="text-sm font-semibold text-gray-900 mb-1">
                              {s.label}
                            </h4>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                              {s.content}
                            </p>
                          </div>
                        ))
                    ) : (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">
                          Summary
                        </h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {selected.summary || "—"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* What's next? — upcoming tasks */}
                  <div className="mt-6">
                    <h4 className="text-base font-semibold text-gray-900 mb-2">
                      What&apos;s next?
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                        Upcoming tasks in 2 weeks
                      </span>
                      <span className="text-gray-300">·</span>
                      <span>Starting: {longDate(new Date().toISOString())}</span>
                    </div>
                    {upcoming.length === 0 ? (
                      <p className="text-sm text-gray-400 border rounded-lg px-3 py-4">
                        No tasks scheduled in the next two weeks.
                      </p>
                    ) : (
                      <div className="border rounded-lg divide-y overflow-hidden">
                        {upcoming.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => router.push(`/tasks/${t.id}`)}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
                          >
                            <span className="flex-1 text-sm text-gray-800 truncate">
                              {t.name}
                            </span>
                            <span className="text-xs text-gray-500 tabular-nums flex-shrink-0">
                              {taskRange(t.startDate, t.dueDate)}
                            </span>
                            <Avatar className="h-5 w-5 flex-shrink-0">
                              <AvatarImage src={t.assignee?.image || ""} />
                              <AvatarFallback className="text-[9px] bg-gray-200">
                                {t.assignee?.name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Open full status view in project */}
                  <button
                    onClick={openProject}
                    className="mt-5 inline-flex items-center gap-1 text-sm text-[#a8893a] hover:underline"
                  >
                    Open in project
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        )}
      </div>
    </>
  );
}
