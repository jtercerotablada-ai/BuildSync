"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Target,
  ChevronDown,
  Calendar,
  Users,
  CheckCircle2,
  CircleDot,
  FileText,
  TrendingUp,
  Activity as ActivityIcon,
  Send,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ProjectStatusKey =
  | "ON_TRACK"
  | "AT_RISK"
  | "OFF_TRACK"
  | "ON_HOLD"
  | "COMPLETE";

interface ProjectMemberRow {
  userId: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface SectionRow {
  id: string;
  name: string;
  tasks: { id: string; completed: boolean }[];
}

interface ProjectShape {
  id: string;
  name: string;
  description: string | null;
  color: string;
  status: string;
  owner: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  members: ProjectMemberRow[];
  sections?: SectionRow[];
  startDate?: string | null;
  endDate?: string | null;
}

interface ProjectOverviewProps {
  project: ProjectShape;
  // Open the project members dialog. Wired by the parent
  // (ProjectContent) so the Overview can reuse the same modal as the
  // header avatars instead of navigating to a non-existent route.
  onManageMembers?: () => void;
}

interface StatusUpdate {
  id: string;
  status: ProjectStatusKey;
  summary: string;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

interface ActivityEvent {
  id: string;
  type:
    | "status_update"
    | "member_joined"
    | "task_completed"
    | "task_created"
    | "file_uploaded";
  title: string;
  detail?: string | null;
  status?: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

interface ConnectedGoal {
  id: string;
  name: string;
  progress: number;
  status: string;
}

// Monochrome + gold palette — matches the rest of the cockpit.
// `border` is the left-accent color used by status update history cards.
const STATUS_VISUAL: Record<
  ProjectStatusKey,
  { dot: string; bg: string; text: string; border: string; label: string }
> = {
  ON_TRACK: {
    dot: "bg-[#c9a84c]",
    bg: "bg-[#fdf7e8]",
    text: "text-[#8a7028]",
    border: "border-[#c9a84c]",
    label: "On track",
  },
  AT_RISK: {
    dot: "bg-[#a8893a]",
    bg: "bg-[#f8eed4]",
    text: "text-[#6e5a26]",
    border: "border-[#a8893a]",
    label: "At risk",
  },
  OFF_TRACK: {
    dot: "bg-black",
    bg: "bg-slate-100",
    text: "text-black",
    border: "border-black",
    label: "Off track",
  },
  ON_HOLD: {
    dot: "bg-slate-500",
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-400",
    label: "On hold",
  },
  COMPLETE: {
    dot: "bg-[#c9a84c]",
    bg: "bg-[#fdf7e8]",
    text: "text-[#8a7028]",
    border: "border-[#c9a84c]",
    label: "Complete",
  },
};

const COMPOSER_MAX_LEN = 4000;

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diffMs = now - t;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  const diffW = Math.floor(diffD / 7);
  if (diffW < 5) return `${diffW}w ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function initial(person: { name: string | null; email: string | null }) {
  return (person.name?.[0] || person.email?.[0] || "?").toUpperCase();
}

export function ProjectOverview({
  project,
  onManageMembers,
}: ProjectOverviewProps) {
  const router = useRouter();
  const [description, setDescription] = useState(project.description || "");
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [goals, setGoals] = useState<ConnectedGoal[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  // Track which description value the local state was last seeded
  // from, so we only pull updates from the server when the user is
  // NOT actively editing. Without this, a router.refresh() triggered
  // by another action (e.g. posting a status update) would clobber
  // typed-but-not-yet-blurred text.
  const [seededDescription, setSeededDescription] = useState(
    project.description || ""
  );
  useEffect(() => {
    const incoming = project.description || "";
    // Only adopt the server value if the user hasn't diverged from
    // the previously-seeded value — i.e. they're not mid-edit.
    if (description === seededDescription && incoming !== seededDescription) {
      setDescription(incoming);
      setSeededDescription(incoming);
    } else if (incoming !== seededDescription) {
      // User has unsaved edits AND the server changed. Keep the
      // user's edits but update the baseline so blur-save still works.
      setSeededDescription(incoming);
    }
  }, [project.description, description, seededDescription]);

  // Composer state
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerStatus, setComposerStatus] = useState<ProjectStatusKey>(
    (project.status as ProjectStatusKey) || "ON_TRACK"
  );
  const [composerText, setComposerText] = useState("");
  const [posting, setPosting] = useState(false);

  // History pagination — start collapsed at 3, expand to full on demand.
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // Opens the composer pre-seeded with the current project status so
  // the pill selector reflects reality every time, not the value from
  // first mount. Fixes the stale-pill bug after using "Change".
  const openComposer = useCallback(() => {
    setComposerStatus((project.status as ProjectStatusKey) || "ON_TRACK");
    setComposerOpen(true);
  }, [project.status]);

  const saveDescription = useCallback(
    async (value: string) => {
      if (value === seededDescription) return;
      try {
        const res = await fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: value || null }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const msg =
            (body && typeof body === "object" && "error" in body
              ? String(body.error)
              : null) || "Failed to save description";
          throw new Error(msg);
        }
        // Promote the just-saved value to the new baseline so the
        // "Saves on blur" indicator disappears and re-edits don't
        // re-POST the same value.
        setSeededDescription(value);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save description"
        );
      }
    },
    [project.id, seededDescription]
  );

  // Fetch the feed on mount. All three endpoints are project-scoped
  // and run in parallel — they finish in whatever order they finish
  // and we only commit results if the component is still mounted.
  useEffect(() => {
    let canceled = false;

    async function load() {
      setLoadingFeed(true);
      try {
        const [updRes, actRes, objRes] = await Promise.all([
          fetch(`/api/projects/${project.id}/status-updates`),
          fetch(`/api/projects/${project.id}/activity`),
          fetch(`/api/projects/${project.id}/objectives`),
        ]);

        if (!canceled && updRes.ok) {
          const data = (await updRes.json()) as StatusUpdate[];
          setStatusUpdates(Array.isArray(data) ? data : []);
        }
        if (!canceled && actRes.ok) {
          const data = (await actRes.json()) as ActivityEvent[];
          setActivities(Array.isArray(data) ? data : []);
        }
        if (!canceled && objRes.ok) {
          const data = (await objRes.json()) as ConnectedGoal[];
          setGoals(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("[ProjectOverview] feed load failed:", err);
      } finally {
        if (!canceled) setLoadingFeed(false);
      }
    }

    load();
    return () => {
      canceled = true;
    };
  }, [project.id]);

  const currentStatus =
    STATUS_VISUAL[project.status as ProjectStatusKey] ||
    STATUS_VISUAL.ON_TRACK;

  // Merge owner + members into a single deduped roster.
  const allMembers = useMemo(() => {
    const seen = new Set<string>();
    const roster: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
      role: string;
    }[] = [];

    if (project.owner) {
      roster.push({
        id: project.owner.id,
        name: project.owner.name,
        email: project.owner.email,
        image: project.owner.image,
        role: "Project owner",
      });
      seen.add(project.owner.id);
    }
    project.members.forEach((m) => {
      if (!seen.has(m.user.id)) {
        roster.push({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
          role: m.role === "ADMIN" ? "Admin" : "Member",
        });
        seen.add(m.user.id);
      }
    });
    return roster;
  }, [project.owner, project.members]);

  // Project pulse — derive from data we already have on the client.
  const pulse = useMemo(() => {
    const allTasks =
      project.sections?.flatMap((s) => s.tasks) ?? ([] as { completed: boolean }[]);
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t) => t.completed).length;
    const percentComplete = totalTasks
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

    let percentTimeElapsed: number | null = null;
    let daysRemaining: number | null = null;
    if (project.startDate && project.endDate) {
      const start = new Date(project.startDate).getTime();
      const end = new Date(project.endDate).getTime();
      const now = Date.now();
      if (end > start) {
        percentTimeElapsed = Math.max(
          0,
          Math.min(100, Math.round(((now - start) / (end - start)) * 100))
        );
        // Future: floor so "you have 2.5 days left" → "2d" (full days).
        // Past: ceil(|ms|/day) so any fraction over deadline reads as
        // "1d over" not "0d", matching how PMs say "we missed it".
        const ms = end - now;
        const dayMs = 1000 * 60 * 60 * 24;
        if (ms >= 0) {
          daysRemaining = Math.floor(ms / dayMs);
        } else {
          daysRemaining = -Math.ceil(Math.abs(ms) / dayMs);
        }
      }
    }

    return {
      totalTasks,
      completedTasks,
      percentComplete,
      percentTimeElapsed,
      daysRemaining,
      membersCount: allMembers.length,
    };
  }, [project.sections, project.startDate, project.endDate, allMembers.length]);

  const handlePostUpdate = useCallback(async () => {
    const summary = composerText.trim();
    if (!summary) {
      toast.error("Write a short summary first");
      return;
    }
    if (summary.length > COMPOSER_MAX_LEN) {
      toast.error(`Summary must be ${COMPOSER_MAX_LEN} characters or fewer`);
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
            status: composerStatus,
            summary,
            syncProjectStatus: true,
          }),
        }
      );
      if (!res.ok) {
        // Surface the backend's permission/validation message verbatim
        // so the user knows WHY it failed (e.g. "Ask an editor or
        // admin" for viewers), not just a generic "Failed".
        const body = await res.json().catch(() => null);
        const msg =
          (body && typeof body === "object" && "error" in body
            ? String(body.error)
            : null) || "Failed to post status update";
        throw new Error(msg);
      }
      const created = (await res.json()) as StatusUpdate;
      setStatusUpdates((prev) => [created, ...prev]);
      setActivities((prev) => [
        {
          id: `status:${created.id}`,
          type: "status_update",
          title: "posted a status update",
          detail: created.summary.slice(0, 240),
          status: created.status,
          createdAt: created.createdAt,
          actor: created.author,
        },
        ...prev,
      ]);
      setComposerText("");
      setComposerOpen(false);
      toast.success("Status update posted");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to post status update"
      );
    } finally {
      setPosting(false);
    }
  }, [project.id, composerStatus, composerText, router]);

  // Cmd/Ctrl + Enter posts the update without leaving the textarea —
  // matches Slack/Linear/Notion conventions for inline composers.
  const handleComposerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!posting && composerText.trim()) {
          handlePostUpdate();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (composerText.trim()) {
          const confirmed = window.confirm(
            "Discard your status update? Your text will be lost."
          );
          if (!confirmed) return;
        }
        setComposerText("");
        setComposerOpen(false);
      }
    },
    [posting, composerText, handlePostUpdate]
  );

  const handleCancelComposer = useCallback(() => {
    if (composerText.trim()) {
      const confirmed = window.confirm(
        "Discard your status update? Your text will be lost."
      );
      if (!confirmed) return;
    }
    setComposerText("");
    setComposerOpen(false);
  }, [composerText]);

  const handleQuickStatusChange = useCallback(
    async (newStatus: ProjectStatusKey) => {
      try {
        const res = await fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) throw new Error("Failed");
        toast.success(`Status set to ${STATUS_VISUAL[newStatus].label}`);
        router.refresh();
      } catch {
        toast.error("Failed to update status");
      }
    },
    [project.id, router]
  );

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Main Content — no max-width so the pulse grid + roster + goals
          stretch across wide monitors instead of crowding into a
          1024px ribbon. Padding scales with breakpoint so 2K/4K
          screens get breathing room without losing data density on
          smaller laptops. */}
      <div className="flex-1 overflow-auto p-4 md:p-6 xl:p-8 2xl:p-10">
        {/* Project pulse — replaces the old AI summary stubs with real
            numbers derived from project data. Six compact cells in a
            monochrome+gold grid; mobile collapses to 2 columns. */}
        <div className="border border-slate-200 rounded-lg bg-white mb-6 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#a8893a]" />
              <span className="text-sm font-semibold text-slate-900">
                Project pulse
              </span>
            </div>
            <span className="text-[11px] uppercase tracking-[1.5px] text-slate-400 font-medium">
              Live
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 divide-x divide-y md:divide-y-0 divide-slate-100">
            <PulseCell
              label="% Complete"
              value={`${pulse.percentComplete}%`}
              sub={`${pulse.completedTasks}/${pulse.totalTasks} tasks`}
            />
            <PulseCell
              label="% Time elapsed"
              value={
                pulse.percentTimeElapsed === null
                  ? "—"
                  : `${pulse.percentTimeElapsed}%`
              }
              sub={
                pulse.percentTimeElapsed === null
                  ? "No dates set"
                  : "of schedule"
              }
            />
            <PulseCell
              label="Days remaining"
              value={
                pulse.daysRemaining === null
                  ? "—"
                  : pulse.daysRemaining < 0
                    ? `${Math.abs(pulse.daysRemaining)}d over`
                    : `${pulse.daysRemaining}d`
              }
              sub={
                pulse.daysRemaining === null
                  ? "No end date"
                  : pulse.daysRemaining < 0
                    ? "past deadline"
                    : "to end date"
              }
              emphasize={
                pulse.daysRemaining !== null && pulse.daysRemaining < 0
              }
            />
            <PulseCell
              label="Tasks done"
              value={`${pulse.completedTasks}`}
              sub={`of ${pulse.totalTasks}`}
            />
            <PulseCell
              label="Members"
              value={`${pulse.membersCount}`}
              sub={pulse.membersCount === 1 ? "person" : "people"}
            />
            <PulseCell
              label="Status updates"
              value={`${statusUpdates.length}`}
              sub={statusUpdates.length === 1 ? "posted" : "in history"}
            />
          </div>
        </div>

        {/* Project description */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold text-slate-900">
              Project description
            </h2>
            {description !== seededDescription && (
              <span className="text-xs text-slate-400 italic">
                Saves on blur
              </span>
            )}
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 10000))}
            onBlur={(e) => saveDescription(e.target.value)}
            placeholder="What is this project about? Capture scope, deliverables, key stakeholders, and constraints."
            className="w-full p-3 border border-slate-200 rounded-lg text-sm resize-none h-28 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-transparent bg-white"
            maxLength={10000}
          />
        </div>

        {/* Project roles */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-900">
              Project roles
            </h2>
            {onManageMembers && (
              <button
                type="button"
                onClick={onManageMembers}
                className="text-xs text-[#a8893a] hover:text-[#8a7028] font-medium"
              >
                Manage all →
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:border-slate-400"
              onClick={onManageMembers}
              disabled={!onManageMembers}
            >
              <Plus className="w-4 h-4" />
              Add member
            </button>

            {allMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-50"
              >
                <div className="w-8 h-8 rounded-full bg-[#d4b65a] flex items-center justify-center text-sm font-medium text-white">
                  {initial(member)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 leading-tight">
                    {member.name || member.email}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    {member.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Connected goals — real fetch with graceful empty state */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-900">
              Connected goals
            </h2>
            {goals.length > 0 && (
              <button
                type="button"
                onClick={() => router.push("/goals")}
                className="text-xs text-[#a8893a] hover:text-[#8a7028] font-medium"
              >
                Open in Goals →
              </button>
            )}
          </div>
          {goals.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center bg-white">
              <Target className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500 mb-3">
                Link this project to a goal so leadership can trace impact
                back to a strategic outcome.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/goals")}
              >
                <Plus className="w-4 h-4 mr-2" />
                Connect a goal
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {goals.map((g) => (
                <button
                  key={g.id}
                  onClick={() => router.push(`/goals/${g.id}`)}
                  className="w-full flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-white hover:border-[#c9a84c] text-left transition-colors"
                >
                  <Target className="w-4 h-4 text-[#a8893a] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {g.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[160px]">
                        <div
                          className="h-full bg-[#c9a84c]"
                          style={{ width: `${Math.min(100, g.progress)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        {g.progress}%
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar — Status + Activity */}
      <div className="w-full lg:w-96 lg:border-l border-t lg:border-t-0 bg-slate-50 overflow-auto flex-shrink-0">
        <div className="p-4">
          {/* Current status */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={cn("w-2.5 h-2.5 rounded-full", currentStatus.dot)} />
                <h3
                  className={cn(
                    "text-base font-semibold",
                    currentStatus.text
                  )}
                >
                  {currentStatus.label}
                </h3>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    Change
                    <ChevronDown className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(Object.keys(STATUS_VISUAL) as ProjectStatusKey[]).map(
                    (key) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => handleQuickStatusChange(key)}
                      >
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full mr-2",
                            STATUS_VISUAL[key].dot
                          )}
                        />
                        {STATUS_VISUAL[key].label}
                      </DropdownMenuItem>
                    )
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Composer */}
            {!composerOpen ? (
              <button
                onClick={openComposer}
                className="w-full text-left flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-lg hover:border-[#c9a84c] transition-colors group"
              >
                <Send className="w-4 h-4 text-slate-400 group-hover:text-[#a8893a]" />
                <span className="text-sm text-slate-500 group-hover:text-slate-700">
                  Post a status update…
                </span>
              </button>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                {/* Status pill selector */}
                <div className="flex items-center gap-1 flex-wrap">
                  {(Object.keys(STATUS_VISUAL) as ProjectStatusKey[]).map(
                    (key) => {
                      const isActive = composerStatus === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setComposerStatus(key)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                            isActive
                              ? `${STATUS_VISUAL[key].bg} ${STATUS_VISUAL[key].text} border-transparent`
                              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                          )}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              STATUS_VISUAL[key].dot
                            )}
                          />
                          {STATUS_VISUAL[key].label}
                        </button>
                      );
                    }
                  )}
                </div>
                <textarea
                  value={composerText}
                  onChange={(e) =>
                    setComposerText(e.target.value.slice(0, COMPOSER_MAX_LEN))
                  }
                  onKeyDown={handleComposerKeyDown}
                  placeholder="What's happening? Highlights, blockers, decisions, or next steps."
                  className="w-full p-2 text-sm border border-slate-200 rounded-md resize-none h-20 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-transparent"
                  autoFocus
                  maxLength={COMPOSER_MAX_LEN}
                  disabled={posting}
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 min-w-0">
                    <span className="truncate">
                      ⌘/Ctrl+Enter to post · Esc to cancel
                    </span>
                    <span
                      className={cn(
                        "tabular-nums whitespace-nowrap",
                        composerText.length >= COMPOSER_MAX_LEN * 0.9
                          ? "text-[#a8893a] font-medium"
                          : "text-slate-400"
                      )}
                    >
                      {composerText.length}/{COMPOSER_MAX_LEN}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={handleCancelComposer}
                      disabled={posting}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-black hover:bg-gray-900 text-white"
                      onClick={handlePostUpdate}
                      disabled={posting || !composerText.trim()}
                    >
                      {posting ? "Posting…" : "Post update"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Status updates history */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[1.5px] text-slate-500 font-medium mb-3">
              <FileText className="w-3.5 h-3.5" />
              Latest updates
            </div>
            {loadingFeed ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : statusUpdates.length === 0 ? (
              <p className="text-sm text-slate-400">
                No status updates yet. Post the first one above.
              </p>
            ) : (
              <div className="space-y-2">
                {(historyExpanded
                  ? statusUpdates
                  : statusUpdates.slice(0, 3)
                ).map((u) => {
                  const v =
                    STATUS_VISUAL[u.status] || STATUS_VISUAL.ON_TRACK;
                  return (
                    <div
                      key={u.id}
                      className={cn(
                        "bg-white rounded-lg border-l-4 p-3 shadow-sm",
                        v.border
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-[1px] uppercase",
                            v.bg,
                            v.text
                          )}
                        >
                          {v.label}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {formatRelativeTime(u.createdAt)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "text-sm text-slate-700 mb-2",
                          historyExpanded ? "whitespace-pre-wrap" : "line-clamp-3"
                        )}
                      >
                        {u.summary}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <div
                          className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium text-white",
                            u.author ? "bg-[#d4b65a]" : "bg-slate-300"
                          )}
                        >
                          {u.author ? initial(u.author) : "?"}
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {u.author
                            ? u.author.name || u.author.email
                            : "Deleted user"}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {statusUpdates.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setHistoryExpanded((v) => !v)}
                    className="w-full text-[11px] text-[#a8893a] hover:text-[#8a7028] font-medium text-center pt-1 hover:underline"
                  >
                    {historyExpanded
                      ? "Collapse history"
                      : `Show all ${statusUpdates.length} updates`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[1.5px] text-slate-500 font-medium mb-3">
              <ActivityIcon className="w-3.5 h-3.5" />
              Activity
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-3">
              <Calendar className="w-3 h-3" />
              {formatDayLabel(new Date())}
            </div>

            {loadingFeed ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : activities.length === 0 ? (
              <p className="text-sm text-slate-400">
                No activity yet. Tasks, members, and status updates will show
                up here.
              </p>
            ) : (
              <div className="space-y-3">
                {activities.slice(0, 15).map((a) => (
                  <div key={a.id} className="flex items-start gap-2.5">
                    <ActivityIconCell type={a.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-slate-900 leading-tight">
                        <span className="font-medium">
                          {a.actor
                            ? a.actor.name || a.actor.email || "Someone"
                            : "Deleted user"}
                        </span>{" "}
                        <span className="text-slate-500">{a.title}</span>
                      </p>
                      {a.detail && (
                        <p className="text-[12px] text-slate-500 truncate mt-0.5">
                          {a.detail}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {formatRelativeTime(a.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PulseCell({
  label,
  value,
  sub,
  emphasize,
}: {
  label: string;
  value: string;
  sub: string;
  emphasize?: boolean;
}) {
  return (
    <div className="px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[1.5px] text-slate-400 font-medium mb-1">
        {label}
      </p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums leading-none",
          emphasize ? "text-black" : "text-slate-900"
        )}
      >
        {value}
      </p>
      <p className="text-[11px] text-slate-500 mt-1 leading-tight">{sub}</p>
    </div>
  );
}

function ActivityIconCell({
  type,
}: {
  type: ActivityEvent["type"];
}) {
  const map: Record<
    ActivityEvent["type"],
    { icon: React.ReactNode; bg: string }
  > = {
    status_update: {
      icon: <CircleDot className="w-3 h-3 text-white" />,
      bg: "bg-[#c9a84c]",
    },
    task_completed: {
      icon: <CheckCircle2 className="w-3 h-3 text-white" />,
      bg: "bg-[#a8893a]",
    },
    task_created: {
      icon: <Plus className="w-3 h-3 text-slate-600" />,
      bg: "bg-slate-200",
    },
    member_joined: {
      icon: <Users className="w-3 h-3 text-slate-600" />,
      bg: "bg-slate-200",
    },
    file_uploaded: {
      icon: <Paperclip className="w-3 h-3 text-slate-600" />,
      bg: "bg-slate-200",
    },
  };
  const v = map[type];
  return (
    <div
      className={cn(
        "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
        v.bg
      )}
    >
      {v.icon}
    </div>
  );
}

