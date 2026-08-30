"use client";

/**
 * ProjectStatusModal — Asana-parity "Status of <project>" surfaces for the
 * portfolio List view (replaces the old thin PortfolioStatusView).
 *
 * ONE component, same {project, variant, onClose} contract the portfolio page
 * mounts (keyed per project id), two presentations that share the status-card
 * body + the "Update status" composer:
 *
 *  - variant "modal" → row STATUS cell. Centered dialog: header
 *      ("Status of X" + Update status + close), a left sidebar of every past
 *      update (click to switch), and a main pane with a status-colored accent
 *      bar + the shared status body (headline, author, Status/Project rows,
 *      the structured `sections` blocks, and a "What's next?" upcoming-tasks
 *      table).
 *  - variant "panel" → row PROGRESS cell. Right slide-over project summary
 *      (matches Asana's progress fly-out): View-project header, name + date
 *      range, "Latest status" + Update status, the SAME status card, "See all
 *      updates", Description, and Members.
 *
 * Read-only, already-served data: GET status-updates (keeps the `sections`
 * the old viewer discarded), GET /api/tasks for What's-next, and GET
 * /api/projects/[id] for the panel's description + members AND, in both
 * variants, the project's own `statusSetAt` — the portfolio row handed in
 * here does not carry it, and without it an untouched project would show a
 * green "On track" nobody ever chose. Posting reuses the existing POST
 * /status-updates. Comments / reactions / followers need backend and are
 * intentionally not shipped as dead stub controls.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Link2,
  Maximize2,
  X,
  CalendarDays,
  ArrowUpRight,
  AlignLeft,
  Users,
  Target,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useToday } from "@/lib/use-today";
import {
  NO_STATUS_LABEL,
  countOverdue,
  isStatusEarned,
  statusNudge,
} from "@/lib/project-status";

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

/** A project whose status nobody ever chose: grey, and saying so. Kept out
 *  of STATUS_VISUAL because it is not one of the five a human can pick — it
 *  is the absence of all of them, and it must never be mistakable for a
 *  colour somebody selected. */
const NO_STATUS_VISUAL = {
  label: NO_STATUS_LABEL,
  dot: "bg-gray-300",
  chip: "bg-gray-100 text-gray-500",
  accent: "bg-gray-300",
};

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

interface ProjectMember {
  id: string;
  user: { id: string; name: string | null; image: string | null } | null;
}

interface ProjectDetail {
  description: string | null;
  members: ProjectMember[];
  /** The project's LIVE claim, read from the project itself. The portfolio
   *  row this modal is handed does not carry `statusSetAt` (the portfolio API
   *  never selected it), and an absent stamp is indistinguishable from "nobody
   *  ever set one" — which would show "No status" on a project a human really
   *  had judged. GET /api/projects/:id returns the whole row, so the answer
   *  comes from there. */
  status: ProjectStatusKey | null;
  statusSetAt: string | null;
  /** Powers the "long wait" half of the nudge; same reason as above. */
  stageEnteredAt: string | null;
}

/** Structural subset of the portfolio page's `Project` — passing the full
 *  object type-checks by structural typing. */
export interface StatusModalProject {
  id: string;
  name: string;
  color: string;
  status: ProjectStatusKey;
  /** When a human last CHOSE that status; null/absent means nobody ever did.
   *  Optional because most callers' queries predate the column — the modal
   *  re-reads it from the project itself rather than trusting the absence. */
  statusSetAt?: string | Date | null;
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

// ── Container styles (shared by content + composer screens) ──

const MODAL_CONTAINER =
  "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-[900px] h-[85vh] max-h-[720px] bg-white rounded-2xl border flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200";
const PANEL_CONTAINER =
  "fixed inset-y-0 right-0 z-50 w-full max-w-[460px] bg-white border-l flex flex-col shadow-2xl animate-in slide-in-from-right duration-200";

// ── Date helpers ────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Whole calendar days from `today` to an instant, or null while today is
 *  still unknown (the first client frame).
 *
 *  Every "Today"/"Yesterday" word below goes through it. They read the clock
 *  during render, and the server's clock is UTC — from 20:00 Miami an update
 *  posted this evening was captioned "Yesterday". */
function dayOffsetFrom(today: Date | null, iso: string): number | null {
  if (!today) return null;
  const then = startOfDay(new Date(iso));
  return Math.round((then.getTime() - today.getTime()) / 86400000);
}

/** "Just now" / "5 minutes ago" / "2 hours ago" / "Yesterday" / "Aug 3". */
function formatRelativeTime(iso: string, today: Date | null): string {
  const then = new Date(iso);
  const diffMs = Date.now() - then.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  const offset = dayOffsetFrom(today, iso);
  if (hr < 24 && offset === 0) {
    return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  }
  if (offset === -1) return "Yesterday";
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Sidebar / short label: "Today" / "Yesterday" / "Aug 3". */
function formatDayLabel(iso: string, today: Date | null): string {
  const offset = dayOffsetFrom(today, iso);
  if (offset === 0) return "Today";
  if (offset === -1) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
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

/** Project date range pill: "Today – Aug 31" / "Aug 3 – Aug 31". */
function dateRangeLabel(
  start: string | null | undefined,
  end: string | null | undefined,
  today: Date | null
): string | null {
  const s = start
    ? dayOffsetFrom(today, start) === 0
      ? "Today"
      : monthDay(start)
    : null;
  const e = end ? monthDay(end) : null;
  if (s && e) return `${s} – ${e}`;
  if (s) return s;
  if (e) return `Due ${e}`;
  return null;
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
  // Local midnight, null until mounted — the "Today"/"Yesterday" captions,
  // the date-range pill and the two-week upcoming window all measure from it.
  const today = useToday();
  const [updates, setUpdates] = useState<ProjectStatusUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<UpcomingTask[]>([]);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);

  // Composer state (Asana "Update status" / "New status update").
  const [composing, setComposing] = useState(false);
  // Null = nothing pre-selected. See startComposing(): a status has to be
  // earned, so the composer refuses to answer on the poster's behalf when
  // nobody ever has.
  const [postStatus, setPostStatus] = useState<ProjectStatusKey | null>(
    isStatusEarned(project.statusSetAt) ? project.status : null
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

  // Upcoming tasks for "What's next?". Non-completed project tasks,
  // client-filtered to the next 14 days — matches the app convention.
  useEffect(() => {
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
  }, [project.id]);

  // Project detail. The description + members are panel-only, but BOTH
  // variants need `statusSetAt` — "has a human ever said how this job is
  // going?" — and the portfolio row that gets passed in does not carry it.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${project.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setDetail({
          description: d.description ?? null,
          members: Array.isArray(d.members) ? d.members : [],
          status: (d.status as ProjectStatusKey) ?? null,
          statusSetAt: d.statusSetAt ?? null,
          stageEnteredAt: d.stageEnteredAt ?? null,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const selected = useMemo(
    () => updates.find((u) => u.id === selectedId) || updates[0] || null,
    [updates, selectedId]
  );

  const upcoming = useMemo(() => {
    // No window before today is known: on the server the next two weeks
    // start TOMORROW, which silently drops everything due today.
    if (!today) return [];
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
  }, [tasks, today]);

  // ── The project's LIVE claim (not the selected update's) ────
  // Prefer the project row once it lands; fall back to the portfolio row that
  // opened this so the header is never blank on the first frame.
  const liveStatus = (detail?.status ?? project.status) as ProjectStatusKey;
  const liveStatusSetAt = detail
    ? detail.statusSetAt
    : project.statusSetAt ?? null;
  // A status nobody chose is not a status: `Project.status` defaults to
  // ON_TRACK, so an untouched project used to read as a confident "On track"
  // that no human had vouched for.
  const statusEarned = isStatusEarned(liveStatusSetAt);
  const liveVisual = statusEarned ? statusVisual(liveStatus) : NO_STATUS_VISUAL;

  // Open work already past its due date, from the task list this modal
  // already fetches for "What's next?" — no extra round-trip.
  const overdueCount = useMemo(() => countOverdue(tasks, today), [tasks, today]);

  // One line of FACT beside the claim when the two disagree. States a number,
  // changes nothing, blocks nothing.
  const nudge = statusNudge({
    status: liveStatus,
    statusSetAt: liveStatusSetAt,
    overdueCount,
    stageEnteredAt: detail?.stageEnteredAt ?? null,
    today,
  });

  /** The live claim as a chip, with the nudge under it. Rendered in both
   *  variants' headers so the portfolio's two status surfaces answer "how is
   *  this job going?" the same way. */
  const liveClaim = (
    <div className="flex flex-col items-start gap-0.5">
      <Badge className={cn(liveVisual.chip, "text-xs")}>
        {liveVisual.label}
      </Badge>
      {nudge && (
        <span className="text-[11px] text-amber-700">{nudge}</span>
      )}
    </div>
  );

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
    // Nothing pre-selected on a project whose status nobody ever set: seeding
    // the pills from `project.status` there hands the poster the ON_TRACK
    // default, and one unread click turns an unearned green into an earned
    // one. When a human did set it, the pills open on that answer as before.
    setPostStatus(statusEarned ? liveStatus : null);
    setPostSections(DEFAULT_COMPOSER_SECTIONS.map((s) => ({ ...s })));
    setComposing(true);
  };

  const composerHasContent = postSections.some((s) => s.content.trim());

  const submitUpdate = async () => {
    if (!composerHasContent || posting) return;
    // Only reachable on a project whose status nobody ever set — the pills
    // open blank there. The update carries a status; one has to be chosen.
    if (!postStatus) {
      toast.error("Pick a status for this update");
      return;
    }
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
      // Posting with `syncProjectStatus` IS a human choosing the status, and
      // POST /status-updates stamps `statusSetAt` in the same transaction it
      // writes `Project.status` — so the claim in this header is earned the
      // moment the post returns. Mirrored into local state rather than
      // refetched: `detail` is what the header reads, and leaving it stale
      // would keep the chip on "No status" above the update just posted.
      // Null `detail` needs nothing — the mount fetch has not landed yet and
      // will read the stamped row when it does.
      const stampedAt = new Date().toISOString();
      setDetail((prev) =>
        prev ? { ...prev, status: postStatus, statusSetAt: stampedAt } : prev
      );
      onPosted?.();
    } catch {
      toast.error("Couldn't post the update");
    } finally {
      setPosting(false);
    }
  };

  // ── Shared: the selected update's body (headline → what's next) ──
  const statusBody = selected ? (
    <>
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
            {formatRelativeTime(selected.createdAt, today)}
          </span>
        </div>
      </div>

      {/* Field rows */}
      <div className="grid grid-cols-[92px_1fr] gap-y-2.5 items-center text-sm mb-5">
        <div className="text-gray-500">Status</div>
        <div>
          <Badge className={cn(statusVisual(selected.status).chip, "text-xs")}>
            {statusVisual(selected.status).label}
          </Badge>
        </div>
        <div className="text-gray-500">Project</div>
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded flex-shrink-0"
            style={{ backgroundColor: project.color }}
          />
          <span className="text-gray-800 truncate">{project.name}</span>
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
            <h4 className="text-sm font-semibold text-gray-900 mb-1">Summary</h4>
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
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
            Upcoming tasks in 2 weeks
          </span>
          {today && (
            <>
              <span className="text-gray-300">·</span>
              <span>Starting: {longDate(today.toISOString())}</span>
            </>
          )}
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
    </>
  ) : null;

  const emptyState = (
    <div className="flex flex-col items-center justify-center text-center px-6 py-12">
      <p className="text-sm text-gray-500 mb-3">No status updates yet.</p>
      {canEdit ? (
        <button
          onClick={startComposing}
          className="text-sm text-[#a8893a] hover:underline"
        >
          Post a status update
        </button>
      ) : (
        <button
          onClick={openProject}
          className="text-sm text-[#a8893a] hover:underline"
        >
          View project
        </button>
      )}
    </div>
  );

  // ── Composer screen (shared by both variants) ─────────────
  if (composing) {
    const composerScreen = (
      <div className={variant === "modal" ? MODAL_CONTAINER : PANEL_CONTAINER}>
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0">
          <h2 className="font-semibold text-[15px] text-gray-900 truncate">
            New status update
          </h2>
          <button
            onClick={() => setComposing(false)}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 font-medium mb-2">
              Status
            </label>
            {/* Says what the disabled Post button is waiting for on a project
                whose status was never set — the pills open with nothing on. */}
            {!postStatus && (
              <p className="text-xs text-gray-500 mb-2">
                Pick a status for this update
              </p>
            )}
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
            disabled={!composerHasContent || posting || !postStatus}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-black rounded-md px-3 py-1.5 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {posting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Post update
          </button>
        </div>
      </div>
    );
    return variant === "modal" ? (
      <>
        <div className="fixed inset-0 z-40 bg-black/50 animate-in fade-in" />
        {composerScreen}
      </>
    ) : (
      composerScreen
    );
  }

  // ── MODAL variant ─────────────────────────────────────────
  if (variant === "modal") {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/50 animate-in fade-in"
          onClick={onClose}
        />
        <div className={MODAL_CONTAINER}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <h2 className="font-semibold text-[15px] text-gray-900 truncate">
                Status of {project.name}
              </h2>
              {/* The project's live claim, next to the history of updates —
                  grey "No status" until a human has actually chosen one. */}
              {liveClaim}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {canEdit && (
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

          {/* Body: sidebar + main pane */}
          <div className="flex-1 flex min-h-0">
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
                          {formatDayLabel(u.createdAt, today)}
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

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : !selected ? (
                <div className="flex-1 flex items-center justify-center">
                  {emptyState}
                </div>
              ) : (
                <>
                  <div
                    className={cn(
                      "h-1 flex-shrink-0",
                      statusVisual(selected.status).accent
                    )}
                  />
                  <div className="flex-1 overflow-y-auto px-6 py-5">
                    {statusBody}
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
        </div>
      </>
    );
  }

  // ── PANEL variant: Asana progress fly-out (project summary) ──
  return (
    <div className={PANEL_CONTAINER}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0">
        <button
          onClick={openProject}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-700 border rounded-md px-2.5 py-1 hover:bg-gray-50"
        >
          View project
        </button>
        <div className="flex items-center gap-1 text-gray-400">
          <button
            onClick={copyLink}
            title="Copy link"
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 hover:text-gray-700"
          >
            <Link2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Project name + date range */}
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-4 h-4 rounded flex-shrink-0"
            style={{ backgroundColor: project.color }}
          />
          <h2 className="font-semibold text-[17px] text-gray-900 truncate">
            {project.name}
          </h2>
        </div>
        {dateRangeLabel(project.startDate, project.endDate, today) && (
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-5">
            <CalendarDays className="h-3.5 w-3.5" />
            {dateRangeLabel(project.startDate, project.endDate, today)}
          </div>
        )}

        {/* Latest status */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <h3 className="text-[15px] font-semibold text-gray-900">
              Latest status
            </h3>
            {/* The project's live claim — grey "No status" until a human has
                actually chosen one, so this panel and the portfolio row it
                opened from cannot answer differently. */}
            {liveClaim}
          </div>
          {canEdit && (
            <button
              onClick={startComposing}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-700 border rounded-md px-2.5 py-1 hover:bg-gray-50"
            >
              Update status
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : !selected ? (
          <div className="border rounded-xl">{emptyState}</div>
        ) : (
          <div
            className={cn(
              "border rounded-xl border-t-4 p-4",
              statusVisual(selected.status).accent.replace("bg-", "border-t-")
            )}
          >
            {statusBody}
          </div>
        )}

        {/* See all updates */}
        {updates.length > 0 && (
          <button
            onClick={openProject}
            className="mt-3 inline-flex items-center gap-1 text-sm text-[#335FB5] hover:underline"
          >
            See all updates
          </button>
        )}

        {/* Description */}
        <div className="mt-6">
          <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-gray-900 mb-1.5">
            <AlignLeft className="h-4 w-4 text-gray-400" />
            Description
          </h3>
          {detail === null ? (
            <div className="h-3 w-40 rounded bg-gray-100 animate-pulse" />
          ) : detail.description ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {detail.description}
            </p>
          ) : (
            <p className="text-sm text-gray-400">No description.</p>
          )}
        </div>

        {/* Members */}
        <div className="mt-6">
          <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-gray-900 mb-2">
            <Users className="h-4 w-4 text-gray-400" />
            Members
          </h3>
          {detail === null ? (
            <div className="h-7 w-7 rounded-full bg-gray-100 animate-pulse" />
          ) : (
            <div className="flex items-center flex-wrap gap-1.5">
              {detail.members.length > 0 ? (
                detail.members.map((m) => (
                  <Avatar
                    key={m.id}
                    className="h-7 w-7"
                    title={m.user?.name || ""}
                  >
                    <AvatarImage src={m.user?.image || ""} />
                    <AvatarFallback className="text-xs bg-gray-200">
                      {m.user?.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                ))
              ) : project.owner ? (
                <Avatar className="h-7 w-7" title={project.owner.name || ""}>
                  <AvatarImage src={project.owner.image || ""} />
                  <AvatarFallback className="text-xs bg-gray-200">
                    {project.owner.name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <span className="text-sm text-gray-400">No members.</span>
              )}
            </div>
          )}
        </div>

        {/* Connected goals — links to the project overview's goal connector */}
        <div className="mt-6">
          <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-gray-900 mb-1.5">
            <Target className="h-4 w-4 text-gray-400" />
            Connected goals
          </h3>
          <div className="rounded-xl border bg-gray-50/60 px-4 py-4">
            <p className="text-sm text-gray-500 mb-2.5">
              Connect a goal to link this project to a bigger purpose.
            </p>
            <button
              onClick={openProject}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-700 border bg-white rounded-md px-2.5 py-1.5 hover:bg-gray-50"
            >
              <Target className="h-3.5 w-3.5" />
              Add goal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
