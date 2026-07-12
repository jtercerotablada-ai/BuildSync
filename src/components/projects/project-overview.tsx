"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Plus,
  Target,
  ChevronDown,
  Calendar,
  Users,
  CheckCircle2,
  CircleDot,
  Diamond,
  FileText,
  Folder,
  MessageCircle,
  TrendingUp,
  Activity as ActivityIcon,
  Send,
  Paperclip,
  Sparkles,
  Loader2,
} from "lucide-react";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
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
  // Open the task detail panel (milestone rows use it).
  onTaskClick?: (taskId: string) => void;
}

interface MilestoneRow {
  id: string;
  name: string;
  completed: boolean;
  dueDate: string | null;
}

interface PortfolioLite {
  id: string;
  name: string;
  status?: string | null;
  owner?: {
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

// Status Update block-builder section types. Matches the API enum.
type SectionType =
  | "SUMMARY"
  | "ACCOMPLISHED"
  | "BLOCKED"
  | "NEXT_STEPS"
  | "CUSTOM";

interface StatusSection {
  id: string;
  type: SectionType;
  label: string;
  content: string;
}

interface StatusUpdate {
  id: string;
  status: ProjectStatusKey;
  summary: string;
  sections?: StatusSection[] | null;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

interface StatusHighlights {
  windowStart: string;
  windowDays: number;
  hadPriorUpdate: boolean;
  counts: {
    milestonesCompleted: number;
    tasksCompleted: number;
    tasksOverdue: number;
    newFormSubmissions: number;
    commentsCount: number;
  };
  milestonesRecent: { id: string; name: string; completedAt: string | null }[];
  milestonesUpcoming: { id: string; name: string; dueDate: string | null }[];
}

/**
 * Default Status Builder blocks shown when the composer opens.
 * Matches Asana's default template — Summary / What we've accomplished
 * / What's blocked / Next steps. Each one's `content` starts empty;
 * the composer pre-fills "Accomplished" from highlights when available.
 *
 * IDs are stable strings (not nanoid) so re-renders don't churn the
 * key list, and each block's label is editable in the UI but defaults
 * to the friendly name.
 */
const DEFAULT_SECTIONS: StatusSection[] = [
  { id: "summary", type: "SUMMARY", label: "Summary", content: "" },
  {
    id: "accomplished",
    type: "ACCOMPLISHED",
    label: "What we've accomplished",
    content: "",
  },
  { id: "blocked", type: "BLOCKED", label: "What's blocked", content: "" },
  {
    id: "next_steps",
    type: "NEXT_STEPS",
    label: "Next steps",
    content: "",
  },
];

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

// Asana's semantic status palette (measured in the real app: the
// "En curso" heading/top-bar green is #5DA182, its text #14865E).
// `border` is the accent color used by status update cards.
const STATUS_VISUAL: Record<
  ProjectStatusKey,
  {
    dot: string;
    bg: string;
    text: string;
    border: string;
    borderT: string;
    label: string;
  }
> = {
  ON_TRACK: {
    dot: "bg-[#5DA182]",
    bg: "bg-[#E9F5F0]",
    text: "text-[#14865E]",
    border: "border-[#5DA182]",
    borderT: "border-t-[#5DA182]",
    label: "On track",
  },
  AT_RISK: {
    dot: "bg-[#F1BD6C]",
    bg: "bg-[#FBF3E4]",
    text: "text-[#8F6C1F]",
    border: "border-[#F1BD6C]",
    borderT: "border-t-[#F1BD6C]",
    label: "At risk",
  },
  OFF_TRACK: {
    dot: "bg-[#DE5F73]",
    bg: "bg-[#FBE9EC]",
    text: "text-[#B4304C]",
    border: "border-[#DE5F73]",
    borderT: "border-t-[#DE5F73]",
    label: "Off track",
  },
  ON_HOLD: {
    dot: "bg-[#79ABFF]",
    bg: "bg-[#EDF3FE]",
    text: "text-[#335FB5]",
    border: "border-[#79ABFF]",
    borderT: "border-t-[#79ABFF]",
    label: "On hold",
  },
  COMPLETE: {
    dot: "bg-[#5DA182]",
    bg: "bg-[#E9F5F0]",
    text: "text-[#14865E]",
    border: "border-[#5DA182]",
    borderT: "border-t-[#5DA182]",
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
  onTaskClick,
}: ProjectOverviewProps) {
  const router = useRouter();
  const { data: session } = useSession();
  // Whether the current user may edit the project (description, live status,
  // status-badge sync). Owner or a project ADMIN/EDITOR — matches the PATCH
  // gate on /api/projects/[id] and the status-sync gate on status-updates.
  const canEdit = useMemo(() => {
    const email = session?.user?.email;
    if (!email) return false;
    if (project.owner?.email && project.owner.email === email) return true;
    return project.members.some(
      (m) =>
        m.user.email === email &&
        (m.role === "ADMIN" || m.role === "EDITOR")
    );
  }, [session?.user?.email, project.owner, project.members]);
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
  // Block-builder state — array of sections the user is editing.
  // Each block has its own `content` textarea; posting concatenates
  // them into the rendered summary the API persists alongside.
  const [composerSections, setComposerSections] = useState<StatusSection[]>(
    () => DEFAULT_SECTIONS.map((s) => ({ ...s }))
  );
  const [highlights, setHighlights] = useState<StatusHighlights | null>(null);
  const [highlightsLoading, setHighlightsLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  // History pagination — start collapsed at 3, expand to full on demand.
  const [historyExpanded, setHistoryExpanded] = useState(false);
  // Asana Overview parity — Milestones + Connected portfolios sections.
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioLite[]>([]);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);

  useEffect(() => {
    let canceled = false;
    fetch(`/api/tasks?projectId=${project.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (canceled) return;
        const list: MilestoneRow[] = (
          Array.isArray(data) ? data : data?.tasks || []
        )
          .filter(
            (t: { taskType?: string | null }) => t.taskType === "MILESTONE"
          )
          .map(
            (t: {
              id: string;
              name: string;
              completed: boolean;
              dueDate: string | null;
            }) => ({
              id: t.id,
              name: t.name,
              completed: t.completed,
              dueDate: t.dueDate,
            })
          )
          .sort(
            (a: MilestoneRow, b: MilestoneRow) =>
              (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) -
              (b.dueDate ? new Date(b.dueDate).getTime() : Infinity)
          );
        setMilestones(list);
      })
      .catch(() => {});
    fetch("/api/portfolios")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (canceled) return;
        const arr = Array.isArray(data) ? data : [];
        setPortfolios(
          arr
            .filter(
              (p: {
                projects?: { project?: { id: string } }[];
              }) =>
                (p.projects || []).some(
                  (pp) => pp.project?.id === project.id
                )
            )
            .map(
              (p: {
                id: string;
                name: string;
                status?: string | null;
                owner?: PortfolioLite["owner"];
              }) => ({
                id: p.id,
                name: p.name,
                status: p.status,
                owner: p.owner,
              })
            )
        );
      })
      .catch(() => {});
    return () => {
      canceled = true;
    };
  }, [project.id, project.sections]);

  const toggleMilestone = useCallback(
    async (m: MilestoneRow) => {
      setMilestones((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, completed: !m.completed } : x))
      );
      try {
        const res = await fetch(`/api/tasks/${m.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: !m.completed }),
        });
        if (!res.ok) throw new Error();
        router.refresh();
      } catch {
        setMilestones((prev) =>
          prev.map((x) =>
            x.id === m.id ? { ...x, completed: m.completed } : x
          )
        );
        toast.error("Failed to update milestone");
      }
    },
    [router]
  );
  // Per-card expand — independent of pagination, so the structured blocks of
  // an update are viewable even when there are 3 or fewer updates (the
  // pagination toggle only appears at >3, previously stranding their content).
  const [expandedUpdateIds, setExpandedUpdateIds] = useState<Set<string>>(
    new Set()
  );
  const toggleUpdateExpanded = useCallback((id: string) => {
    setExpandedUpdateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Build a pre-filled "Accomplished" block from the highlights data
  // so the composer feels alive when it opens — the user can edit /
  // delete / add more before posting. Returns "" when there's nothing
  // notable to surface (a brand-new project with no activity).
  const buildAccomplishedFromHighlights = useCallback(
    (h: StatusHighlights): string => {
      const lines: string[] = [];
      if (h.milestonesRecent.length > 0) {
        for (const m of h.milestonesRecent) {
          lines.push(`✓ Milestone hit: ${m.name}`);
        }
      } else if (h.counts.milestonesCompleted > 0) {
        lines.push(
          `✓ ${h.counts.milestonesCompleted} milestone${
            h.counts.milestonesCompleted === 1 ? "" : "s"
          } completed`
        );
      }
      if (h.counts.tasksCompleted > 0) {
        lines.push(
          `✓ ${h.counts.tasksCompleted} task${
            h.counts.tasksCompleted === 1 ? "" : "s"
          } closed in the last ${h.windowDays} day${
            h.windowDays === 1 ? "" : "s"
          }`
        );
      }
      if (h.counts.newFormSubmissions > 0) {
        lines.push(
          `✓ ${h.counts.newFormSubmissions} new intake submission${
            h.counts.newFormSubmissions === 1 ? "" : "s"
          } received (RFI / change order / inspection)`
        );
      }
      return lines.join("\n");
    },
    []
  );

  // Same idea but for the "Next steps" block — surfaces upcoming
  // milestones so PMs don't start the section blank.
  const buildNextStepsFromHighlights = useCallback(
    (h: StatusHighlights): string => {
      if (h.milestonesUpcoming.length === 0) return "";
      return h.milestonesUpcoming
        .map((m) => {
          const due = m.dueDate
            ? new Date(m.dueDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                // dueDate is UTC midnight — format in UTC so the label doesn't
                // slip to the previous day for US timezones.
                timeZone: "UTC",
              })
            : "TBD";
          return `→ ${m.name} (due ${due})`;
        })
        .join("\n");
    },
    []
  );

  // Same idea but for the "What's blocked" block — surface overdue
  // tasks as a starting point.
  const buildBlockedFromHighlights = useCallback(
    (h: StatusHighlights): string => {
      if (h.counts.tasksOverdue === 0) return "";
      return `⚠ ${h.counts.tasksOverdue} task${
        h.counts.tasksOverdue === 1 ? " is" : "s are"
      } currently overdue — review and rebaseline before this update goes out.`;
    },
    []
  );

  // Opens the composer pre-seeded with the current project status so
  // the pill selector reflects reality every time, not the value from
  // first mount. Also resets the block content + kicks off the
  // highlights fetch so the auto-pulled chips render fresh.
  const openComposer = useCallback(() => {
    setComposerStatus((project.status as ProjectStatusKey) || "ON_TRACK");
    setComposerSections(DEFAULT_SECTIONS.map((s) => ({ ...s })));
    setHighlights(null);
    setHighlightsLoading(true);
    setComposerOpen(true);
    // Fire-and-forget — the composer can render before the data
    // arrives; we splice the pre-fills in once it lands.
    void (async () => {
      try {
        const res = await fetch(
          `/api/projects/${project.id}/status-highlights`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as StatusHighlights;
        setHighlights(data);
        // Pre-fill the three derived blocks IF the user hasn't typed
        // into them yet. Check content === "" guards against a
        // late-arriving fetch overwriting in-progress edits.
        setComposerSections((prev) =>
          prev.map((s) => {
            if (s.content.trim() !== "") return s;
            if (s.type === "ACCOMPLISHED") {
              const pre = buildAccomplishedFromHighlights(data);
              return pre ? { ...s, content: pre } : s;
            }
            if (s.type === "BLOCKED") {
              const pre = buildBlockedFromHighlights(data);
              return pre ? { ...s, content: pre } : s;
            }
            if (s.type === "NEXT_STEPS") {
              const pre = buildNextStepsFromHighlights(data);
              return pre ? { ...s, content: pre } : s;
            }
            return s;
          })
        );
      } catch (err) {
        // Highlights are a nice-to-have — if the fetch fails the
        // composer still works with blank blocks. No toast (would
        // be noisy on every open).
        console.error("[ProjectOverview] highlights fetch failed:", err);
      } finally {
        setHighlightsLoading(false);
      }
    })();
  }, [
    project.id,
    project.status,
    buildAccomplishedFromHighlights,
    buildBlockedFromHighlights,
    buildNextStepsFromHighlights,
  ]);

  // Auto-open the composer when arriving from the home "Project Status"
  // widget with `?compose=status`. Strip the query after handling so
  // a manual refresh doesn't re-trigger the open. Runs once on mount.
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("compose") !== "status") return;
    openComposer();
    // Best-effort URL cleanup — replaceState avoids a navigation /
    // re-render. If the host page is reading other params we leave
    // them intact.
    if (typeof window !== "undefined" && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.delete("compose");
      window.history.replaceState(null, "", url.toString());
    }
    // We intentionally depend only on the searchParams snapshot at
    // mount — re-running on every router change would re-open the
    // composer after the user manually closed it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // True when at least one section has typed content. Drives the
  // Post button's enabled state + the cancel "discard?" prompt.
  const hasComposerContent = useMemo(
    () => composerSections.some((s) => s.content.trim().length > 0),
    [composerSections]
  );

  // Sum of all block contents — drives the per-update length cap.
  const composerTotalLength = useMemo(
    () => composerSections.reduce((n, s) => n + s.content.length, 0),
    [composerSections]
  );

  const updateSectionContent = useCallback(
    (id: string, content: string) => {
      setComposerSections((prev) =>
        prev.map((s) =>
          s.id === id
            ? // Hard cap per block so a single section can't blow
              // past the update-level limit on its own.
              { ...s, content: content.slice(0, COMPOSER_MAX_LEN) }
            : s
        )
      );
    },
    []
  );

  const handlePostUpdate = useCallback(async () => {
    if (!hasComposerContent) {
      toast.error("Fill in at least one section before posting.");
      return;
    }
    if (composerTotalLength > COMPOSER_MAX_LEN) {
      toast.error(
        `Total content must be ${COMPOSER_MAX_LEN} characters or fewer.`
      );
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
            // Send the structured blocks; the API renders these into
            // `summary` for back-compat list views.
            sections: composerSections.map((s) => ({
              id: s.id,
              type: s.type,
              label: s.label,
              content: s.content.trim(),
            })),
            // Only editors/owner may drive the live project badge. Non-editors
            // can still POST the update record; requesting the sync would make
            // the whole POST 403. (See canEdit above.)
            syncProjectStatus: canEdit,
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
      setComposerSections(DEFAULT_SECTIONS.map((s) => ({ ...s })));
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
  }, [
    project.id,
    composerStatus,
    composerSections,
    composerTotalLength,
    hasComposerContent,
    router,
  ]);

  // Cmd/Ctrl + Enter posts the update from any block textarea —
  // matches Slack/Linear/Notion conventions for inline composers.
  // Escape prompts to discard if the user has typed anything.
  const handleComposerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!posting && hasComposerContent) {
          handlePostUpdate();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (hasComposerContent) {
          const confirmed = window.confirm(
            "Discard your status update? Your text will be lost."
          );
          if (!confirmed) return;
        }
        setComposerSections(DEFAULT_SECTIONS.map((s) => ({ ...s })));
        setComposerOpen(false);
      }
    },
    [posting, hasComposerContent, handlePostUpdate]
  );

  const handleCancelComposer = useCallback(() => {
    if (hasComposerContent) {
      const confirmed = window.confirm(
        "Discard your status update? Your text will be lost."
      );
      if (!confirmed) return;
    }
    setComposerSections(DEFAULT_SECTIONS.map((s) => ({ ...s })));
    setComposerOpen(false);
  }, [hasComposerContent]);

  const handleQuickStatusChange = useCallback(
    async (newStatus: ProjectStatusKey) => {
      try {
        const res = await fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const msg =
            (body && typeof body === "object" && "error" in body
              ? String(body.error)
              : null) || "Failed to update status";
          throw new Error(msg);
        }
        toast.success(`Status set to ${STATUS_VISUAL[newStatus].label}`);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update status"
        );
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
            <h2 className="text-xl font-medium text-slate-900">
              Project description
            </h2>
            {canEdit && description !== seededDescription && (
              <span className="text-xs text-slate-400 italic">
                Saves on blur
              </span>
            )}
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 10000))}
            onBlur={(e) => canEdit && saveDescription(e.target.value)}
            readOnly={!canEdit}
            placeholder={
              canEdit
                ? "What is this project about? Capture scope, deliverables, key stakeholders, and constraints."
                : "No description."
            }
            className={cn(
              "w-full p-3 border border-slate-200 rounded-lg text-sm resize-none h-28 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-transparent bg-white",
              !canEdit && "cursor-default bg-slate-50 focus:ring-0"
            )}
            maxLength={10000}
          />
        </div>

        {/* Project roles */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-medium text-slate-900">
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
            <h2 className="text-xl font-medium text-slate-900">
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

        {/* Connected portfolios — Asana Overview section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xl font-medium text-slate-900">
              Connected portfolios
            </h2>
            <button
              type="button"
              onClick={() => router.push("/portfolios")}
              className="text-slate-400 hover:text-slate-600"
              title="Manage portfolios"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {portfolios.length === 0 ? (
            <p className="text-sm text-slate-500">
              This project isn&apos;t in a portfolio yet.
            </p>
          ) : (
            <div>
              {portfolios.map((p) => {
                const v =
                  STATUS_VISUAL[p.status as ProjectStatusKey] ||
                  STATUS_VISUAL.ON_TRACK;
                return (
                  <button
                    key={p.id}
                    onClick={() => router.push(`/portfolios/${p.id}`)}
                    className="w-full flex items-center gap-3 py-2 border-b border-slate-100 hover:bg-slate-50 text-left"
                  >
                    <Folder className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-900 flex-1 truncate">
                      {p.name}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs",
                        v.text
                      )}
                    >
                      <span
                        className={cn("w-2 h-2 rounded-full", v.dot)}
                      />
                      {v.label}
                    </span>
                    {p.owner && (
                      <span className="w-6 h-6 rounded-full bg-[#d4b65a] flex items-center justify-center text-[10px] font-medium text-white flex-shrink-0 overflow-hidden">
                        {p.owner.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.owner.image}
                            alt={p.owner.name || ""}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (p.owner.name || p.owner.email || "?")[0]
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Key resources — Asana Overview section */}
        <div className="mb-6">
          <h2 className="text-xl font-medium text-slate-900 mb-3">
            Key resources
          </h2>
          <div className="border border-slate-200 rounded-lg p-6 bg-white text-center">
            <p className="text-sm text-slate-500 max-w-[340px] mx-auto mb-4">
              Align your team around a shared vision with a project brief and
              supporting resources.
            </p>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  router.push(`/projects/${project.id}?view=notes`)
                }
                className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900 hover:underline"
              >
                <FileText className="w-4 h-4 text-slate-400" />
                Create project brief
              </button>
              <button
                type="button"
                onClick={() =>
                  router.push(`/projects/${project.id}?view=files`)
                }
                className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900 hover:underline"
              >
                <Paperclip className="w-4 h-4 text-slate-400" />
                Add links &amp; files
              </button>
            </div>
          </div>
        </div>

        {/* Milestones — Asana Overview section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-medium text-slate-900">Milestones</h2>
            <button
              type="button"
              onClick={() => setMilestoneDialogOpen(true)}
              className="text-slate-400 hover:text-slate-600"
              title="Add milestone"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div>
            {milestones.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 py-2 border-b border-slate-100 hover:bg-slate-50 group"
              >
                <button
                  type="button"
                  onClick={() => toggleMilestone(m)}
                  title={
                    m.completed ? "Mark incomplete" : "Mark milestone complete"
                  }
                >
                  <Diamond
                    className={cn(
                      "w-4 h-4",
                      m.completed
                        ? "text-[#5DA182] fill-[#5DA182]"
                        : "text-slate-400 hover:text-[#5DA182]"
                    )}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => onTaskClick?.(m.id)}
                  className={cn(
                    "text-sm text-left flex-1 truncate text-slate-900 hover:underline",
                    m.completed && "line-through text-slate-400"
                  )}
                >
                  {m.name}
                </button>
                {m.dueDate && (
                  <span className="text-xs text-slate-500 flex-shrink-0">
                    {new Date(m.dueDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </span>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setMilestoneDialogOpen(true)}
              className="flex items-center gap-3 py-2 w-full text-left text-sm text-slate-400 hover:text-slate-600"
            >
              <Diamond className="w-4 h-4" />
              Add milestone…
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar — Status + Activity */}
      <div className="w-full lg:w-[330px] lg:border-l border-t lg:border-t-0 bg-white overflow-auto flex-shrink-0">
        <div className="p-4">
          {/* Current status */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              {/* Asana: big soft-colored status heading, no dot */}
              <h3
                className={cn("text-xl font-medium", currentStatus.text)}
              >
                {currentStatus.label}
              </h3>
              {/* Only editors/owner can change the live status — the API
                  403s everyone else, so hide the control for read-only users. */}
              {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    Update status
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
              )}
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
              <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
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

                {/* Highlights strip — auto-pulled chips that summarize
                    what's happened since the last update. Pure-data —
                    user can't edit, just glance. Pre-fills the body
                    blocks below. */}
                {highlightsLoading ? (
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading highlights for the last{" "}
                    {highlights?.windowDays ?? 7} days…
                  </div>
                ) : highlights ? (
                  <div className="rounded-md border border-[#e6e9ef] bg-[#fafaf7] px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[1.5px] text-slate-500 font-semibold mb-1.5 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-[#a8893a]" />
                      Highlights
                      <span className="text-slate-400 normal-case tracking-normal font-normal text-[10px]">
                        ·{" "}
                        {highlights.hadPriorUpdate
                          ? `since last update (${highlights.windowDays}d)`
                          : `last ${highlights.windowDays}d`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <HighlightChip
                        icon="✓"
                        label={`${highlights.counts.milestonesCompleted} milestones`}
                        active={highlights.counts.milestonesCompleted > 0}
                      />
                      <HighlightChip
                        icon="✓"
                        label={`${highlights.counts.tasksCompleted} tasks closed`}
                        active={highlights.counts.tasksCompleted > 0}
                      />
                      <HighlightChip
                        icon="📨"
                        label={`${highlights.counts.newFormSubmissions} new submissions`}
                        active={highlights.counts.newFormSubmissions > 0}
                      />
                      <HighlightChip
                        icon="💬"
                        label={`${highlights.counts.commentsCount} comments`}
                        active={highlights.counts.commentsCount > 0}
                      />
                      <HighlightChip
                        icon="⚠"
                        label={`${highlights.counts.tasksOverdue} overdue`}
                        active={highlights.counts.tasksOverdue > 0}
                        warning
                      />
                    </div>
                  </div>
                ) : null}

                {/* Block-builder — one textarea per section. Asana
                    parity: always-visible blocks the user fills in.
                    Pre-filled blocks (Accomplished / Blocked / Next
                    steps) get a faint "auto" hint chip until edited. */}
                <div className="space-y-3">
                  {composerSections.map((section, idx) => (
                    <ComposerBlock
                      key={section.id}
                      section={section}
                      autoFocus={idx === 0}
                      disabled={posting}
                      onChange={(c) => updateSectionContent(section.id, c)}
                      onKeyDown={handleComposerKeyDown}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 min-w-0">
                    <span className="truncate">
                      ⌘/Ctrl+Enter to post · Esc to cancel
                    </span>
                    <span
                      className={cn(
                        "tabular-nums whitespace-nowrap",
                        composerTotalLength >= COMPOSER_MAX_LEN * 0.9
                          ? "text-[#a8893a] font-medium"
                          : "text-slate-400"
                      )}
                    >
                      {composerTotalLength}/{COMPOSER_MAX_LEN}
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
                      disabled={posting || !hasComposerContent}
                    >
                      {posting ? "Posting…" : "Post update"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Project date range + message-members shortcut (Asana rows) */}
          <div className="mb-5 space-y-3">
            {(project.startDate || project.endDate) && (
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Calendar className="w-4 h-4 text-slate-400" />
                {[
                  project.startDate
                    ? new Date(project.startDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      })
                    : null,
                  project.endDate
                    ? new Date(project.endDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" – ")}
              </div>
            )}
            <button
              type="button"
              onClick={() =>
                router.push(`/projects/${project.id}?view=messages`)
              }
              className="flex items-center gap-2 text-sm font-medium text-[#335FB5] hover:underline"
            >
              <MessageCircle className="w-4 h-4" />
              Send message to members
            </button>
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
                  const cardExpanded = expandedUpdateIds.has(u.id);
                  const filledSections =
                    u.sections?.filter((s) => s.content.trim()) ?? [];
                  // There's more to show if the update has structured blocks
                  // beyond a single summary, or a long legacy summary.
                  const hasMore =
                    filledSections.length > 1 ||
                    (filledSections.length === 0 && (u.summary?.length ?? 0) > 140);
                  return (
                    <div
                      key={u.id}
                      className={cn(
                        // Asana: thick colored TOP accent on status cards
                        "bg-white rounded-lg border border-slate-200 border-t-4 p-3 shadow-sm",
                        v.borderT
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
                      {/* Render structured blocks when present
                          (block-builder updates), fall back to the
                          plain `summary` paragraph for legacy rows
                          posted before the builder existed. The
                          collapsed view shows just the SUMMARY block
                          (or the first 3 lines of legacy summary)
                          so the history list reads scannable; the
                          expanded view shows every filled section. */}
                      {u.sections && u.sections.length > 0 ? (
                        cardExpanded ? (
                          <div className="space-y-2 mb-2">
                            {u.sections
                              .filter((s) => s.content.trim())
                              .map((s) => (
                                <div key={s.id}>
                                  <p className="text-[10px] uppercase tracking-[1.5px] text-slate-500 font-semibold mb-0.5">
                                    {s.label}
                                  </p>
                                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                    {s.content}
                                  </p>
                                </div>
                              ))}
                          </div>
                        ) : (
                          (() => {
                            // Collapsed view — prefer the SUMMARY
                            // block as the teaser; fall back to the
                            // first non-empty block if SUMMARY is
                            // blank. Three-line clamp keeps history
                            // cards uniform.
                            const teaser =
                              u.sections.find(
                                (s) => s.type === "SUMMARY" && s.content.trim()
                              ) ||
                              u.sections.find((s) => s.content.trim());
                            return (
                              <p className="text-sm text-slate-700 mb-2 line-clamp-3">
                                {teaser?.content || u.summary}
                              </p>
                            );
                          })()
                        )
                      ) : (
                        <p
                          className={cn(
                            "text-sm text-slate-700 mb-2",
                            cardExpanded
                              ? "whitespace-pre-wrap"
                              : "line-clamp-3"
                          )}
                        >
                          {u.summary}
                        </p>
                      )}
                      {hasMore && (
                        <button
                          type="button"
                          onClick={() => toggleUpdateExpanded(u.id)}
                          className="text-[11px] text-[#a8893a] hover:text-[#8a7028] font-medium hover:underline mb-2"
                        >
                          {cardExpanded ? "Show less" : "Show more"}
                        </button>
                      )}
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
                            : "Someone"}
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
                            : "Someone"}
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

      {/* Add-milestone dialog (Asana's "Agregar hito") */}
      <CreateTaskDialog
        open={milestoneDialogOpen}
        onOpenChange={setMilestoneDialogOpen}
        projectId={project.id}
        sectionId={project.sections?.[0]?.id}
        defaultTaskType="MILESTONE"
      />
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

/**
 * Highlight chip — auto-pulled metric inside the composer's
 * "Highlights" strip. Active=true paints with the brand gold (it's
 * a real signal); active=false stays muted gray (zero, nothing to
 * surface). warning=true overrides to the amber tint so overdue
 * tasks read as "needs attention" not "achievement".
 */
function HighlightChip({
  icon,
  label,
  active,
  warning = false,
}: {
  icon: string;
  label: string;
  active: boolean;
  warning?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] border",
        !active
          ? "bg-white text-slate-400 border-slate-200"
          : warning
            ? "bg-[#fdf3e0] text-[#8a5a1a] border-[#e5c89a]"
            : "bg-[#fdf7e8] text-[#8a7028] border-[#e0c87a]"
      )}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}

/**
 * One block in the Status Builder composer. Renders a small label
 * header + a textarea bound to the section's content. Tracks per-
 * section character count so the user knows when they're getting
 * close to the cap.
 */
function ComposerBlock({
  section,
  autoFocus,
  disabled,
  onChange,
  onKeyDown,
}: {
  section: StatusSection;
  autoFocus: boolean;
  disabled: boolean;
  onChange: (content: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const placeholder = PLACEHOLDER_BY_TYPE[section.type] || "";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-[1.5px] text-slate-500 font-semibold">
          {section.label}
        </p>
        {section.content.length > 0 && (
          <span className="text-[10px] text-slate-400 tabular-nums">
            {section.content.length}
          </span>
        )}
      </div>
      <textarea
        value={section.content}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={section.type === "SUMMARY" ? 2 : 3}
        autoFocus={autoFocus}
        disabled={disabled}
        className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400"
      />
    </div>
  );
}

// Placeholder text per block type — written in plain PM language so
// even a first-time user knows what belongs where. Engineering-firm
// flavored (RFI / milestone / approval) to match the cockpit.
const PLACEHOLDER_BY_TYPE: Record<SectionType, string> = {
  SUMMARY:
    'One sentence on overall status. Example: "Foundation 80% complete, waiting on RFI #14 from the architect."',
  ACCOMPLISHED:
    "Bullet what shipped since the last update. Milestones hit, tasks closed, RFIs answered, approvals received.",
  BLOCKED:
    "What's holding us up? Open RFIs, pending approvals, overdue dependencies, missing information.",
  NEXT_STEPS:
    "What's coming up this week. Milestones due, decisions needed, key meetings, inspections scheduled.",
  CUSTOM: "",
};

