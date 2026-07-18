"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  List,
  LayoutGrid,
  Calendar,
  ChartGantt,
  ChartNoAxesGantt,
  BarChart3,
  Plus,
  MoreHorizontal,
  Star,
  Settings,
  Trash2,
  Share2,
  Filter,
  SortAsc,
  SortDesc,
  FileText,
  GitBranch,
  MessageSquare,
  FolderOpen,
  ChevronDown,
  Rows3,
  Search,
  Edit2,
  Copy,
  Archive,
  Check,
  X,
  MapPin,
  NotebookPen,
  Gauge,
  Link2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BUILTIN_VIEWS,
  BUILTIN_VIEW_KEYS,
  baseLabelFor,
  RENDERABLE_VIEWS,
} from "@/lib/project-views";
import { isThisWeek } from "date-fns";
import { dueDateToLocalMidnight, daysFromToday } from "@/lib/date-only";
import { ListView } from "@/components/views/list-view";
import { BoardView } from "@/components/views/board-view";
import { TimelineView } from "@/components/views/timeline-view";
import { GanttView } from "@/components/views/gantt-view";
import { DashboardView } from "@/components/views/dashboard-view";
import { CalendarView } from "@/components/views/calendar-view";
import { WorkflowView } from "@/components/views/workflow-view";
import { MessagesView } from "@/components/views/messages-view";
import { FilesView } from "@/components/views/files-view";
import { NotesView } from "@/components/views/notes-view";
import { WorkloadView } from "@/components/views/workload-view";
import { ProjectTeamView } from "@/components/views/project-team-view";
import { ProjectOverview } from "@/components/projects/project-overview";
import { ProjectMembersDialog } from "@/components/projects/project-members-dialog";
import { ProjectShareDialog } from "@/components/projects/project-share-dialog";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";

interface Task {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  dueDate: string | null;
  // Serialized from the server — backs the "Created on" sort.
  createdAt?: string;
  priority: string;
  // Engineering-firm task taxonomy: regular task, milestone (Diamond
  // icon), or approval gate (ThumbsUp). Optional so legacy rows that
  // never had the column populated keep deserializing.
  taskType?: "TASK" | "MILESTONE" | "APPROVAL" | null;
  assignee: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  subtasks: { id: string; completed: boolean }[];
  _count: {
    subtasks: number;
    comments: number;
    attachments: number;
    // Backs the "Likes" built-in column.
    likes?: number;
  };
}

interface Section {
  id: string;
  name: string;
  position: number;
  tasks: Task[];
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  status: string;
  // Workspace-access level exposed in the Share dialog. Full project rows
  // always carry it (schema default WORKSPACE); optional here for callers
  // that construct partial project shapes.
  visibility?: "PRIVATE" | "WORKSPACE" | "PUBLIC";
  sections: Section[];
  views: { id: string; name: string; type: string; isDefault: boolean }[];
  // Per-project view-tab customization (Asana's tab context menu). Empty for
  // projects whose tabs were never renamed / reordered / copied / hidden.
  viewPrefs?: ViewPref[];
  // Team sharing (Asana model): the team this project is shared with and its
  // members, who get access and show in "Project roles".
  teamId?: string | null;
  teamName?: string | null;
  teamMembers?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string;
  }[];
  owner: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  members: {
    userId: string;
    role: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  }[];
  portfolio?: {
    id: string;
    name: string;
  } | null;
  // Engineering metadata (any of these may be null on legacy rows)
  projectNumber?: string | null;
  type?: "CONSTRUCTION" | "DESIGN" | "RECERTIFICATION" | "PERMIT" | null;
  gate?: "PRE_DESIGN" | "DESIGN" | "PERMITTING" | "CONSTRUCTION" | "CLOSEOUT" | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  budget?: number | string | null;
  currency?: string | null;
  clientName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

// ─── Group-by (project List) ─────────────────────────────────────
type GroupByField = "none" | "assignee" | "priority" | "due_date" | "created_at";

const GROUP_BY_LABELS: Record<GroupByField, string> = {
  none: "None",
  assignee: "Assignee",
  priority: "Priority",
  due_date: "Due date",
  created_at: "Created on",
};

const GROUP_BY_ORDER: GroupByField[] = [
  "none",
  "assignee",
  "priority",
  "due_date",
  "created_at",
];

// Bucket a task into a group (stable key + display label + sort weight)
// for the chosen field. Lower `order` sorts first.
function groupOf(
  task: Task,
  field: GroupByField
): { key: string; label: string; order: number } {
  switch (field) {
    case "assignee":
      return task.assignee
        ? {
            key: `a:${task.assignee.id}`,
            label: task.assignee.name || task.assignee.email || "Unknown",
            order: 0,
          }
        : { key: "a:none", label: "Unassigned", order: 1 };
    case "priority": {
      const map: Record<string, { label: string; order: number }> = {
        HIGH: { label: "High", order: 0 },
        MEDIUM: { label: "Medium", order: 1 },
        LOW: { label: "Low", order: 2 },
        NONE: { label: "No priority", order: 3 },
      };
      const m = map[task.priority] ?? { label: "No priority", order: 3 };
      return { key: `p:${task.priority}`, label: m.label, order: m.order };
    }
    case "due_date": {
      if (!task.dueDate)
        return { key: "d:none", label: "No due date", order: 99 };
      const diff = daysFromToday(task.dueDate);
      if (diff < 0) return { key: "d:overdue", label: "Overdue", order: 0 };
      if (diff === 0) return { key: "d:today", label: "Today", order: 1 };
      if (diff === 1) return { key: "d:tomorrow", label: "Tomorrow", order: 2 };
      if (diff <= 7) return { key: "d:week", label: "This week", order: 3 };
      if (diff <= 31) return { key: "d:month", label: "This month", order: 4 };
      return { key: "d:later", label: "Later", order: 5 };
    }
    case "created_at": {
      if (!task.createdAt)
        return { key: "c:none", label: "Unknown", order: 99 };
      const daysSince = -daysFromToday(task.createdAt);
      if (daysSince <= 0) return { key: "c:today", label: "Today", order: 0 };
      if (daysSince === 1)
        return { key: "c:yesterday", label: "Yesterday", order: 1 };
      if (daysSince <= 7)
        return { key: "c:week", label: "Past 7 days", order: 2 };
      if (daysSince <= 31)
        return { key: "c:month", label: "Past 30 days", order: 3 };
      return { key: "c:earlier", label: "Earlier", order: 4 };
    }
    default:
      return { key: "all", label: "All", order: 0 };
  }
}

const PROJECT_TYPE_LABEL: Record<string, string> = {
  CONSTRUCTION: "Construction",
  DESIGN: "Design",
  RECERTIFICATION: "Recertification",
  PERMIT: "Permit",
};
// Monochrome + gold palette — matches cockpit/types.ts TYPE_COLOR.
const PROJECT_TYPE_COLOR: Record<string, string> = {
  CONSTRUCTION: "#c9a84c", // gold
  DESIGN: "#d4b65a",       // bright gold
  RECERTIFICATION: "#a8893a", // deep gold / bronze
  PERMIT: "#1a1a1a",       // black (outlined badge treatment)
};

interface ProjectContentProps {
  project: Project;
  currentView: string;
}

// Monochrome + gold palette for status badges. Gold = active/positive,
// black = severe, gray = neutral. No greens/reds/yellows/blues.
const STATUS_COLORS = {
  ON_TRACK: "bg-[#c9a84c]/15 text-[#a8893a]",
  AT_RISK: "bg-[#a8893a]/15 text-[#a8893a]",
  OFF_TRACK: "bg-black/90 text-white",
  ON_HOLD: "bg-gray-100 text-gray-700",
  COMPLETE: "bg-[#d4b65a]/15 text-[#a8893a]",
};

const STATUS_LABELS = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  OFF_TRACK: "Off track",
  ON_HOLD: "On hold",
  COMPLETE: "Complete",
};

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };

// Asana-style "+" (add view) catalog — Popular / Others, each with an icon
// + one-line description. Clicking navigates to that view. Mirrors the
// project view-picker in Asana so every view we support is discoverable.
const ADD_VIEW_GROUPS: {
  label: string;
  items: { view: string; label: string; desc: string; Icon: LucideIcon }[];
}[] = [
  {
    label: "Popular",
    items: [
      { view: "list", label: "List", desc: "Organize tasks in a table", Icon: List },
      { view: "notes", label: "Notes", desc: "Write meeting notes and more", Icon: NotebookPen },
      { view: "gantt", label: "Gantt", desc: "Track dependencies and references", Icon: ChartGantt },
      { view: "board", label: "Board", desc: "Track work on a Kanban board", Icon: LayoutGrid },
      { view: "calendar", label: "Calendar", desc: "Plan work weekly or monthly", Icon: Calendar },
      { view: "timeline", label: "Timeline", desc: "Schedule work over time", Icon: ChartNoAxesGantt },
    ],
  },
  {
    label: "Others",
    items: [
      { view: "workload", label: "Resource management", desc: "See how busy the team is by tasks", Icon: Gauge },
      { view: "dashboard", label: "Dashboard", desc: "Monitor metrics and analysis", Icon: BarChart3 },
      { view: "files", label: "Files", desc: "See all attachments", Icon: FolderOpen },
      { view: "messages", label: "Messages", desc: "Communicate with others", Icon: MessageSquare },
      { view: "workflow", label: "Workflow", desc: "Automate work with rules", Icon: GitBranch },
    ],
  },
];

// Per-project view-tab customization row (serialized from ProjectViewPref).
interface ViewPref {
  id: string;
  viewKey: string;
  baseView: string;
  label: string | null;
  hidden: boolean;
  isDefault: boolean;
  position: number;
}

// A resolved tab in the strip: a built-in view (with any rename applied) or a
// "Make a copy" of one. `mobile` mirrors the built-in's responsive visibility.
interface TabDef {
  viewKey: string;
  baseView: string;
  label: string;
  mobile: boolean;
  isCopy: boolean;
  isDefault: boolean;
}

// Tab icons, keyed by the underlying built-in view. Copies reuse their base
// view's icon.
const VIEW_ICONS: Record<string, LucideIcon> = {
  overview: FileText,
  list: List,
  board: LayoutGrid,
  timeline: ChartNoAxesGantt,
  dashboard: BarChart3,
  calendar: Calendar,
  gantt: ChartGantt,
  workflow: GitBranch,
  messages: MessageSquare,
  files: FolderOpen,
  notes: NotebookPen,
  workload: Gauge,
};

export function ProjectContent({ project, currentView }: ProjectContentProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [createTaskType, setCreateTaskType] = useState<"TASK" | "MILESTONE">(
    "TASK"
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [isStarred, setIsStarred] = useState(false);

  // Persist the star locally so it survives reloads/navigation (the button
  // was previously a pure no-op that reset on every mount). Keyed per project.
  const starKey = `buildsync:starred:${project.id}`;
  useEffect(() => {
    try {
      setIsStarred(localStorage.getItem(starKey) === "1");
    } catch {
      /* localStorage unavailable — leave unstarred */
    }
  }, [starKey]);

  const toggleStar = () => {
    setIsStarred((prev) => {
      const next = !prev;
      try {
        if (next) localStorage.setItem(starKey, "1");
        else localStorage.removeItem(starKey);
      } catch {
        /* ignore persistence failure */
      }
      toast.success(next ? "Added to favorites" : "Removed from favorites");
      return next;
    });
  };

  const currentEmail = session?.user?.email;
  // Distinct people on the project — the owner is normally also a
  // ProjectMember row (POST /api/projects adds them as ADMIN), so a plain
  // `members.length + 1` double-counts them.
  const memberCount = useMemo(
    () =>
      new Set(
        [project.owner?.id, ...project.members.map((m) => m.userId)].filter(
          Boolean
        )
      ).size,
    [project.owner, project.members]
  );
  // Whether the current user may add/remove members / change roles. The
  // member-management API gates every mutation to the project owner or an
  // ADMIN member, so non-admins get a read-only dialog instead of buttons
  // that always 403.
  const canManageMembers = useMemo(() => {
    if (!currentEmail) return false;
    if (project.owner?.email && project.owner.email === currentEmail) return true;
    return project.members.some(
      (m) => m.user.email === currentEmail && m.role === "ADMIN"
    );
  }, [currentEmail, project.owner, project.members]);
  // Whether the current user may edit project content (visibility / settings).
  // Owner or an ADMIN/EDITOR member — mirrors the project PATCH gate, which
  // is broader than canManageMembers (that's owner/ADMIN only).
  const canEditProject = useMemo(() => {
    if (!currentEmail) return false;
    if (project.owner?.email && project.owner.email === currentEmail) return true;
    return project.members.some(
      (m) =>
        m.user.email === currentEmail &&
        (m.role === "ADMIN" || m.role === "EDITOR")
    );
  }, [currentEmail, project.owner, project.members]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Filter/Sort/Group state
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [showCompleted, setShowCompleted] = useState(true);
  // Group-by for the project List — regroups tasks into synthetic
  // sections by a field. "none" keeps the project's own sections.
  const [groupBy, setGroupBy] = useState<GroupByField>("none");

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        if (filter === "incomplete") next.delete("completed");
        if (filter === "completed") next.delete("incomplete");
        next.add(filter);
      }
      return next;
    });
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortBy(null);
        setSortDirection("asc");
      }
    } else {
      setSortBy(field);
      setSortDirection("asc");
    }
  };

  const clearAllFilters = () => {
    setActiveFilters(new Set());
    setSortBy(null);
    setSortDirection("asc");
    setSearchQuery("");
    setShowCompleted(true);
    setGroupBy("none");
  };

  const hasActiveFilters =
    activeFilters.size > 0 ||
    !!sortBy ||
    !!searchQuery.trim() ||
    !showCompleted ||
    groupBy !== "none";

  // Compute filtered & sorted sections
  const filteredSections = useMemo(() => {
    let sections = project.sections.map(section => ({
      ...section,
      tasks: [...section.tasks],
    }));

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      sections = sections.map(section => ({
        ...section,
        tasks: section.tasks.filter(task =>
          task.name.toLowerCase().includes(q)
        ),
      }));
    }

    // Active filters
    if (activeFilters.size > 0) {
      sections = sections.map(section => ({
        ...section,
        tasks: section.tasks.filter(task => {
          if (activeFilters.has("incomplete") && task.completed) return false;
          if (activeFilters.has("completed") && !task.completed) return false;
          if (activeFilters.has("due_this_week")) {
            if (!task.dueDate) return false;
            try {
              // Compare the UTC calendar day (dueDates are stored at UTC
              // midnight); parsing with local time would bucket a task into
              // the previous week for evening US users.
              if (!isThisWeek(dueDateToLocalMidnight(task.dueDate), { weekStartsOn: 1 })) return false;
            } catch {
              return false;
            }
          }
          if (activeFilters.has("assigned_to_me")) {
            if (!task.assignee || task.assignee.email !== session?.user?.email) return false;
          }
          return true;
        }),
      }));
    }

    // Show/hide completed
    if (!showCompleted) {
      sections = sections.map(section => ({
        ...section,
        tasks: section.tasks.filter(task => !task.completed),
      }));
    }

    // Sorting
    if (sortBy) {
      sections = sections.map(section => ({
        ...section,
        tasks: [...section.tasks].sort((a, b) => {
          let cmp = 0;
          switch (sortBy) {
            case "due_date": {
              const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
              const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
              cmp = da - db;
              break;
            }
            case "alphabetical":
              cmp = a.name.localeCompare(b.name);
              break;
            case "priority":
              cmp = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
              break;
            case "created": {
              // Sort by the real creation timestamp, not the task id.
              // (cuid v1 is roughly time-ordered but diverges for
              // seeded/imported rows, so id-sort disagreed with the
              // visible Creation date column.)
              const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              cmp = ca - cb;
              break;
            }
          }
          return sortDirection === "desc" ? -cmp : cmp;
        }),
      }));
    }

    // Group-by: flatten the (filtered + sorted) tasks and rebucket them
    // into synthetic sections by the chosen field. Preserves the current
    // sort order within each group.
    if (groupBy !== "none") {
      const all = sections.flatMap((s) => s.tasks);
      const groups = new Map<
        string,
        { label: string; order: number; tasks: typeof all }
      >();
      for (const t of all) {
        const g = groupOf(t, groupBy);
        const existing = groups.get(g.key);
        if (existing) existing.tasks.push(t);
        else groups.set(g.key, { label: g.label, order: g.order, tasks: [t] });
      }
      sections = Array.from(groups.entries())
        .sort(
          (a, b) =>
            a[1].order - b[1].order || a[1].label.localeCompare(b[1].label)
        )
        .map(([key, g], i) => ({
          id: `group:${key}`,
          name: g.label,
          position: i,
          tasks: g.tasks,
        }));
    }

    return sections;
  }, [project.sections, searchQuery, activeFilters, sortBy, sortDirection, showCompleted, groupBy, session?.user?.email]);

  const handleViewChange = (view: string) => {
    router.push(`/projects/${project.id}?view=${view}`);
  };

  // ── View tabs + per-tab context menu (Asana parity) ─────────────────
  // The strip is data-driven: the built-in catalog merged with this project's
  // ProjectViewPref rows (renames, hidden "deleted" tabs, and "Make a copy"
  // tabs). Clicking the already-active tab opens the Rename / Set as default /
  // Make a copy / Copy link / Delete menu.
  const viewPrefs = useMemo<ViewPref[]>(
    () => project.viewPrefs ?? [],
    [project.viewPrefs]
  );

  const tabs = useMemo<TabDef[]>(() => {
    const prefByKey = new Map(viewPrefs.map((p) => [p.viewKey, p]));
    const result: TabDef[] = [];
    // Built-in tabs, in catalog order, minus any "deleted" (hidden) ones, with
    // rename overrides applied.
    for (const b of BUILTIN_VIEWS) {
      const pref = prefByKey.get(b.key);
      if (pref?.hidden) continue;
      result.push({
        viewKey: b.key,
        baseView: b.key,
        label: pref?.label?.trim() || b.label,
        mobile: b.mobile,
        isCopy: false,
        isDefault: !!pref?.isDefault,
      });
    }
    // "Make a copy" tabs, appended after the built-ins (Asana order).
    const copies = viewPrefs
      .filter((p) => !BUILTIN_VIEW_KEYS.has(p.viewKey) && !p.hidden)
      .sort(
        (a, b) => a.position - b.position || a.viewKey.localeCompare(b.viewKey)
      );
    for (const c of copies) {
      result.push({
        viewKey: c.viewKey,
        baseView: c.baseView,
        label: c.label?.trim() || `${baseLabelFor(c.baseView)} copy`,
        mobile: true,
        isCopy: true,
        isDefault: c.isDefault,
      });
    }
    return result;
  }, [viewPrefs]);

  // The active tab may be a copy, whose underlying built-in drives rendering.
  const activeTab = tabs.find((t) => t.viewKey === currentView);
  const baseView = activeTab
    ? activeTab.baseView
    : RENDERABLE_VIEWS.has(currentView)
      ? currentView
      : "list";

  // Hidden built-in views — the "+" catalog re-adds (unhides) these.
  const hiddenBuiltins = useMemo(
    () =>
      new Set(
        viewPrefs
          .filter((p) => p.hidden && BUILTIN_VIEW_KEYS.has(p.viewKey))
          .map((p) => p.viewKey)
      ),
    [viewPrefs]
  );

  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [tabBusy, setTabBusy] = useState(false);

  const viewsApi = (suffix = "") =>
    `/api/projects/${project.id}/views${suffix}`;

  const startRename = (tab: TabDef) => {
    setRenameValue(tab.label);
    setRenamingKey(tab.viewKey);
  };

  const commitRename = async (tab: TabDef) => {
    const next = renameValue.trim();
    setRenamingKey(null);
    if (!next || next === tab.label) return;
    try {
      const res = await fetch(viewsApi(`/${encodeURIComponent(tab.viewKey)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: next }),
      });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => ({}))).error);
      }
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error && e.message ? e.message : "Could not rename view"
      );
    }
  };

  const setDefaultView = async (tab: TabDef) => {
    if (tabBusy) return;
    setTabBusy(true);
    try {
      const res = await fetch(viewsApi(`/${encodeURIComponent(tab.viewKey)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => ({}))).error);
      }
      toast.success(`"${tab.label}" is now the default view`);
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error && e.message ? e.message : "Could not set default"
      );
    } finally {
      setTabBusy(false);
    }
  };

  const makeViewCopy = async (tab: TabDef) => {
    if (tabBusy) return;
    setTabBusy(true);
    try {
      const res = await fetch(viewsApi(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseView: tab.baseView,
          label: `${tab.label} copy`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      // Land on the new tab so it renders and is second-click-ready.
      router.push(`/projects/${project.id}?view=${data.viewKey}`);
    } catch (e) {
      toast.error(
        e instanceof Error && e.message ? e.message : "Could not copy view"
      );
    } finally {
      setTabBusy(false);
    }
  };

  const copyViewLink = async (tab: TabDef) => {
    const url = `${window.location.origin}/projects/${project.id}?view=${tab.viewKey}`;
    // Prefer the async Clipboard API; fall back to a hidden-textarea execCommand
    // when it's unavailable or blocked (e.g. document not focused).
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
      return;
    } catch {
      /* fall through to the legacy path */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) toast.success("Link copied to clipboard");
      else toast.error("Could not copy link");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const deleteView = async (tab: TabDef) => {
    if (tabBusy) return;
    if (tabs.length <= 1) {
      toast.error("A project must keep at least one view");
      return;
    }
    setTabBusy(true);
    try {
      const res = await fetch(viewsApi(`/${encodeURIComponent(tab.viewKey)}`), {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => ({}))).error);
      }
      // If we're deleting the tab we're viewing, fall back to another tab.
      if (currentView === tab.viewKey) {
        const fallback =
          tabs.find((t) => t.viewKey !== tab.viewKey)?.viewKey ?? "list";
        router.push(`/projects/${project.id}?view=${fallback}`);
      } else {
        router.refresh();
      }
      toast.success(tab.isCopy ? "View deleted" : `"${tab.label}" removed`);
    } catch (e) {
      toast.error(
        e instanceof Error && e.message ? e.message : "Could not delete view"
      );
    } finally {
      setTabBusy(false);
    }
  };

  // "+" catalog: re-add (unhide) a hidden built-in before navigating to it.
  const addOrOpenView = async (viewKey: string) => {
    if (hiddenBuiltins.has(viewKey)) {
      try {
        await fetch(viewsApi(`/${encodeURIComponent(viewKey)}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hidden: false }),
        });
      } catch {
        /* navigate regardless; a failed unhide just re-renders the tab */
      }
    }
    handleViewChange(viewKey);
  };

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleAddTask = (sectionId?: string) => {
    // Synthetic group headers ("group:…") aren't real sections — adding
    // a task under one should fall back to the project default section.
    const realSectionId =
      sectionId && !sectionId.startsWith("group:") ? sectionId : null;
    setSelectedSectionId(realSectionId);
    setShowCreateTask(true);
  };

  // Monochrome + gold. Gold = positive/active, black = severe, gray = neutral.
  const statusConfig = {
    ON_TRACK: { bg: "bg-[#c9a84c]/10", text: "text-[#a8893a]", dot: "bg-[#c9a84c]" },
    AT_RISK: { bg: "bg-[#a8893a]/15", text: "text-[#a8893a]", dot: "bg-[#a8893a]" },
    OFF_TRACK: { bg: "bg-black", text: "text-white", dot: "bg-white" },
    ON_HOLD: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" },
    COMPLETE: { bg: "bg-[#d4b65a]/15", text: "text-[#a8893a]", dot: "bg-[#d4b65a]" },
  };

  const status = statusConfig[project.status as keyof typeof statusConfig] || statusConfig.ON_TRACK;

  // Show toolbar only for task views (not calendar - it has its own)
  const showToolbar = ["list", "board", "timeline", "gantt"].includes(baseView);

  return (
    <div className="h-full flex flex-col">
      {/* Portfolio Breadcrumb */}
      {project.portfolio && (
        <div className="px-4 md:px-6 py-1.5 text-xs text-slate-500 border-b bg-slate-50">
          <Link
            href={`/portfolios/${project.portfolio.id}`}
            className="hover:text-slate-700 hover:underline"
          >
            {project.portfolio.name}
          </Link>
        </div>
      )}

      {/* Project Header */}
      <div className="border-b bg-white px-4 md:px-6 py-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 mb-1">
          <div className="flex items-center gap-2 md:gap-3">
            {/* Project Icon */}
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-medium"
              style={{ backgroundColor: project.color }}
            >
              {project.name[0]}
            </div>

            {/* Project Name with Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-base font-semibold text-slate-900 hover:text-slate-700 max-w-[180px] md:max-w-none">
                  <span className="truncate">{project.name}</span>
                  <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={async () => {
                  const newName = prompt('Project name:', project.name);
                  if (newName && newName !== project.name) {
                    try {
                      const res = await fetch(`/api/projects/${project.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: newName }),
                      });
                      if (res.ok) {
                        toast.success('Project renamed');
                        router.refresh();
                      } else {
                        const err = await res.json().catch(() => ({}));
                        toast.error(err.error || 'Failed to rename project');
                      }
                    } catch {
                      toast.error('Failed to rename project');
                    }
                  }
                }}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  try {
                    // Dedicated endpoint deep-copies sections + tasks (the old
                    // POST /api/projects created an empty shell and 400'd when
                    // the source had no description).
                    const res = await fetch(`/api/projects/${project.id}/duplicate`, {
                      method: 'POST',
                    });
                    if (res.ok) {
                      const data = await res.json();
                      toast.success('Project duplicated');
                      router.push(`/projects/${data.id}`);
                    } else {
                      const err = await res.json().catch(() => ({}));
                      toast.error(err.error || 'Failed to duplicate project');
                    }
                  } catch {
                    toast.error('Failed to duplicate project');
                  }
                }}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => {
                  try {
                    const res = await fetch(`/api/projects/${project.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ isArchived: true }),
                    });
                    if (res.ok) {
                      toast.success('Project archived');
                      router.push('/projects/all');
                    } else {
                      const err = await res.json().catch(() => ({}));
                      toast.error(err.error || 'Failed to archive project');
                    }
                  } catch {
                    toast.error('Failed to archive project');
                  }
                }}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem className="text-black" onClick={async () => {
                  if (confirm('Delete this project? This cannot be undone.')) {
                    try {
                      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
                      if (res.ok) {
                        toast.success('Project deleted');
                        router.push('/projects/all');
                      } else {
                        const err = await res.json().catch(() => ({}));
                        toast.error(err.error || 'Failed to delete project');
                      }
                    } catch {
                      toast.error('Failed to delete project');
                    }
                  }
                }}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Favorite */}
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", isStarred && "text-[#a8893a]")}
              onClick={toggleStar}
            >
              <Star className={cn("h-4 w-4", isStarred && "fill-current")} />
            </Button>

            {/* Status Badge - shown inline on desktop, below on mobile */}
            <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm ${status.bg} ${status.text}`}>
              <div className={`w-2 h-2 rounded-full ${status.dot}`} />
              {STATUS_LABELS[project.status as keyof typeof STATUS_LABELS]}
            </div>
          </div>

          {/* Mobile-only status badge row */}
          <div className={`md:hidden flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs w-fit ${status.bg} ${status.text}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {STATUS_LABELS[project.status as keyof typeof STATUS_LABELS]}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Members (clickable — opens manage dialog) */}
            <button
              type="button"
              onClick={() => setMembersDialogOpen(true)}
              className="hidden md:flex items-center -space-x-2 mr-2 hover:opacity-80 transition-opacity"
              title="Manage members"
            >
              {project.members.slice(0, 3).map((member) => (
                <div
                  key={member.userId}
                  className="w-8 h-8 rounded-full bg-[#d4b65a] border-2 border-white flex items-center justify-center text-sm font-medium text-white"
                  title={member.user.name || member.user.email || ""}
                >
                  {member.user.name?.[0] || member.user.email?.[0] || "?"}
                </div>
              ))}
              {project.members.length === 0 && (
                <div className="w-8 h-8 rounded-full bg-[#d4b65a] border-2 border-white flex items-center justify-center text-sm font-medium text-white">
                  {project.owner?.name?.[0] || "?"}
                </div>
              )}
              <div className="w-8 h-8 rounded-full bg-white border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-500 hover:text-gray-600">
                <Plus className="h-4 w-4" />
              </div>
            </button>

            {/* Share Button — hidden on mobile, lives in overflow menu */}
            <Button className="hidden md:inline-flex bg-black hover:bg-black text-white" size="sm" onClick={() => setShareDialogOpen(true)}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>

            {/* Mobile overflow menu for Share/Customize/Members */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShareDialogOpen(true)}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info('Fields customization coming soon')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Customize
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setMembersDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Manage members ({memberCount})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Edit Details */}
            <Button
              variant="outline"
              size="sm"
              className="hidden md:inline-flex"
              onClick={() => setEditDialogOpen(true)}
            >
              <Edit2 className="h-3.5 w-3.5 mr-1.5" />
              Edit details
            </Button>

            {/* Customize Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden md:inline-flex">
                  Customize
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => toast.info('Fields customization coming soon')}>
                  Fields
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info('Rules customization coming soon')}>
                  Rules
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info('Color & icon customization coming soon')}>
                  Color & Icon
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Engineering metadata strip — shows what was captured at create time.
            Renders only if any of the fields are populated so legacy projects
            stay clean. */}
        {(project.projectNumber || project.type || project.clientName || project.location || project.budget) && (
          <div className="hidden md:flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-slate-600 mt-1 mb-1.5">
            {project.projectNumber && (
              <span className="font-mono text-slate-500 tracking-[0.5px]">
                {project.projectNumber}
              </span>
            )}
            {project.type && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-[1.5px] uppercase"
                style={{
                  color: PROJECT_TYPE_COLOR[project.type] ?? "#666",
                  background: `${PROJECT_TYPE_COLOR[project.type] ?? "#666"}15`,
                }}
              >
                {PROJECT_TYPE_LABEL[project.type] ?? project.type}
              </span>
            )}
            {project.clientName && (
              <span>
                <span className="text-slate-400">Client</span>{" "}
                <span className="text-slate-700">{project.clientName}</span>
              </span>
            )}
            {project.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-slate-400" />
                <span className="text-slate-700">{project.location}</span>
              </span>
            )}
            {project.budget != null && project.currency && (
              <span>
                <span className="text-slate-400">Budget</span>{" "}
                <span className="text-slate-700 font-medium">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: project.currency,
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(Number(project.budget))}
                </span>
              </span>
            )}
          </div>
        )}


        {/* View Tabs — Asana layout: tabs on their own top row,
            Filter/Sort/Options on a separate row below. Keeps the
            view picker visually distinct from the toolbar so the
            primary navigation never feels crowded by toggles. */}
        <div className="flex flex-col gap-0">
          <div className="flex items-center gap-0 md:gap-1 overflow-x-auto flex-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* No "Team" tab — Asana assigns the team at the team level;
                projects don't carry a Team view. The route still resolves
                for old deep links, and members live in Manage members. */}
            {tabs.map((tab) => {
              const Icon = VIEW_ICONS[tab.baseView] ?? List;
              const active = currentView === tab.viewKey;
              const display = tab.mobile ? "flex" : "hidden md:flex";
              const cls = `${display} items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-1.5 text-xs md:text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? "border-[#c9a84c] text-[#a8893a]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`;
              // Copies keep their label on mobile so two same-icon tabs stay
              // distinguishable; built-ins collapse to icon-only like before.
              const labelCls = tab.isCopy ? "" : "hidden md:inline";

              // Inline rename — the active tab becomes a text field.
              if (active && renamingKey === tab.viewKey) {
                return (
                  <div
                    key={tab.viewKey}
                    className={`${display} items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-1.5 border-b-2 border-[#c9a84c]`}
                  >
                    <Icon className="h-4 w-4 text-[#a8893a]" />
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitRename(tab);
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setRenamingKey(null);
                        }
                      }}
                      onBlur={() => commitRename(tab)}
                      className="w-24 md:w-32 bg-transparent text-xs md:text-[13px] font-medium text-[#a8893a] outline-none"
                    />
                  </div>
                );
              }

              // Inactive tab — a plain button that navigates.
              if (!active) {
                return (
                  <button
                    key={tab.viewKey}
                    onClick={() => handleViewChange(tab.viewKey)}
                    className={cls}
                  >
                    <Icon className="h-4 w-4" />
                    <span className={labelCls}>{tab.label}</span>
                  </button>
                );
              }

              // Active tab — clicking it again opens the Asana context menu.
              return (
                <DropdownMenu key={tab.viewKey}>
                  <DropdownMenuTrigger asChild>
                    <button className={cls} aria-label={`${tab.label} view options`}>
                      <Icon className="h-4 w-4" />
                      <span className={labelCls}>{tab.label}</span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {canEditProject && (
                      <DropdownMenuItem onClick={() => startRename(tab)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                    )}
                    {canEditProject && (
                      <DropdownMenuItem onClick={() => setDefaultView(tab)}>
                        <Star
                          className={cn(
                            "h-4 w-4 mr-2",
                            tab.isDefault && "fill-[#c9a84c] text-[#c9a84c]"
                          )}
                        />
                        {tab.isDefault ? "Default view" : "Set as default"}
                        {tab.isDefault && (
                          <Check className="h-4 w-4 ml-auto text-[#a8893a]" />
                        )}
                      </DropdownMenuItem>
                    )}
                    {canEditProject && (
                      <DropdownMenuItem onClick={() => makeViewCopy(tab)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Make a copy
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => copyViewLink(tab)}>
                      <Link2 className="h-4 w-4 mr-2" />
                      Copy link
                    </DropdownMenuItem>
                    {/* Overview is the fixed landing tab and isn't in the "+"
                        catalog to re-add, so it can't be deleted (only copied,
                        renamed, or set as default) — matches Asana. */}
                    {canEditProject && tab.viewKey !== "overview" && (
                      <DropdownMenuSeparator />
                    )}
                    {canEditProject && tab.viewKey !== "overview" && (
                      <DropdownMenuItem
                        className="text-black"
                        disabled={tabs.length <= 1}
                        onClick={() => deleteView(tab)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
            {/* "+" add-view catalog — Asana-style Popular / Others menu. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-center p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md"
                  aria-label="Add view"
                  title="Add view"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[300px] p-2">
                {ADD_VIEW_GROUPS.map((group) => (
                  <div key={group.label} className="mb-1 last:mb-0">
                    <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {group.label}
                    </div>
                    {group.items.map((it) => {
                      const Icon = it.Icon;
                      return (
                        <DropdownMenuItem
                          key={it.view}
                          onClick={() => addOrOpenView(it.view)}
                          className="flex items-start gap-2.5 py-1.5 cursor-pointer"
                        >
                          <Icon className="h-4 w-4 mt-0.5 text-slate-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[13px] font-medium text-slate-800">
                              {it.label}
                            </div>
                            <div className="text-[11px] text-slate-500 leading-snug">
                              {it.desc}
                            </div>
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Toolbar - only show for task views. Sits on its own
              row below the view tabs (Asana parity). border-t adds
              the thin separator Asana uses between the two strips. */}
          {showToolbar && (
            <div className="flex items-center justify-between gap-1 overflow-x-auto flex-nowrap border-t border-slate-100 py-1.5">
              {/* Left — Asana's "Agregar tarea ▾" split button (List view;
                  Timeline/Gantt carry their own toolbar copy). */}
              <div className="flex items-center">
                {(baseView === "list" || baseView === "board") && (
                  <div className="flex items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-r-none"
                      onClick={() => {
                        setCreateTaskType("TASK");
                        handleAddTask();
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add task
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-l-none border-l-0 px-1.5"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem
                          onClick={() => {
                            setCreateTaskType("TASK");
                            handleAddTask();
                          }}
                        >
                          Task
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setCreateTaskType("MILESTONE");
                            handleAddTask();
                          }}
                        >
                          Milestone
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
              {/* Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className={cn(activeFilters.size > 0 && "text-[#a8893a] bg-[#c9a84c]/10")}>
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                    {activeFilters.size > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1 text-xs bg-[#c9a84c]/15 text-[#a8893a]">
                        {activeFilters.size}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => toggleFilter("incomplete")}>
                    {activeFilters.has("incomplete") && <Check className="mr-2 h-4 w-4" />}
                    <span className={cn(!activeFilters.has("incomplete") && "ml-6")}>Incomplete tasks</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleFilter("completed")}>
                    {activeFilters.has("completed") && <Check className="mr-2 h-4 w-4" />}
                    <span className={cn(!activeFilters.has("completed") && "ml-6")}>Completed tasks</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleFilter("due_this_week")}>
                    {activeFilters.has("due_this_week") && <Check className="mr-2 h-4 w-4" />}
                    <span className={cn(!activeFilters.has("due_this_week") && "ml-6")}>Due this week</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleFilter("assigned_to_me")}>
                    {activeFilters.has("assigned_to_me") && <Check className="mr-2 h-4 w-4" />}
                    <span className={cn(!activeFilters.has("assigned_to_me") && "ml-6")}>Assigned to me</span>
                  </DropdownMenuItem>
                  {activeFilters.size > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setActiveFilters(new Set())} className="text-black">
                        <X className="mr-2 h-4 w-4" />
                        Clear filters
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Sort */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className={cn(sortBy && "text-[#a8893a] bg-[#c9a84c]/10")}>
                    {sortDirection === "desc" ? <SortDesc className="mr-2 h-4 w-4" /> : <SortAsc className="mr-2 h-4 w-4" />}
                    Sort
                    {sortBy && <span className="ml-1 text-xs text-[#a8893a]">({sortBy === "due_date" ? "date" : sortBy === "alphabetical" ? "A-Z" : sortBy})</span>}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleSort("due_date")}>
                    {sortBy === "due_date" && <Check className="mr-2 h-4 w-4" />}
                    <span className={cn(sortBy !== "due_date" && "ml-6")}>Due date</span>
                    {sortBy === "due_date" && <span className="ml-auto text-xs text-slate-400">{sortDirection === "asc" ? "earliest" : "latest"}</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort("created")}>
                    {sortBy === "created" && <Check className="mr-2 h-4 w-4" />}
                    <span className={cn(sortBy !== "created" && "ml-6")}>Created on</span>
                    {sortBy === "created" && <span className="ml-auto text-xs text-slate-400">{sortDirection === "asc" ? "oldest" : "newest"}</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort("alphabetical")}>
                    {sortBy === "alphabetical" && <Check className="mr-2 h-4 w-4" />}
                    <span className={cn(sortBy !== "alphabetical" && "ml-6")}>Alphabetical</span>
                    {sortBy === "alphabetical" && <span className="ml-auto text-xs text-slate-400">{sortDirection === "asc" ? "A-Z" : "Z-A"}</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort("priority")}>
                    {sortBy === "priority" && <Check className="mr-2 h-4 w-4" />}
                    <span className={cn(sortBy !== "priority" && "ml-6")}>Priority</span>
                    {sortBy === "priority" && <span className="ml-auto text-xs text-slate-400">{sortDirection === "asc" ? "high first" : "low first"}</span>}
                  </DropdownMenuItem>
                  {sortBy && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { setSortBy(null); setSortDirection("asc"); }} className="text-black">
                        <X className="mr-2 h-4 w-4" />
                        Clear sort
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Group by — list view only. Regroups tasks into synthetic
                  sections; "None" keeps the project's own sections. */}
              {baseView === "list" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(groupBy !== "none" && "text-[#a8893a] bg-[#c9a84c]/10")}
                    >
                      <Rows3 className="mr-2 h-4 w-4" />
                      Group
                      {groupBy !== "none" && (
                        <span className="ml-1 text-xs text-[#a8893a]">
                          ({GROUP_BY_LABELS[groupBy]})
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {GROUP_BY_ORDER.map((field) => (
                      <DropdownMenuItem
                        key={field}
                        onClick={() => setGroupBy(field)}
                      >
                        {groupBy === field && <Check className="mr-2 h-4 w-4" />}
                        <span className={cn(groupBy !== field && "ml-6")}>
                          {GROUP_BY_LABELS[field]}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className={cn(!showCompleted && "text-[#a8893a] bg-[#c9a84c]/10")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Options
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setShowCompleted(!showCompleted)}>
                    {showCompleted && <Check className="mr-2 h-4 w-4" />}
                    <span className={cn(!showCompleted && "ml-6")}>Show completed</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Search */}
              {showSearch ? (
                <div className="relative">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tasks..."
                    className="w-44 h-8 pr-7"
                    autoFocus
                    onBlur={() => { if (!searchQuery) setShowSearch(false); }}
                  />
                  {searchQuery && (
                    <button
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onMouseDown={(e) => { e.preventDefault(); setSearchQuery(""); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSearch(true)}>
                  <Search className="h-4 w-4" />
                </Button>
              )}

              {/* Clear all indicator */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="text-black hover:text-black hover:bg-gray-100" onClick={clearAllFilters}>
                  <X className="mr-1 h-3.5 w-3.5" />
                  Clear all
                </Button>
              )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* min-w-0 is critical: without it the flex-1 grows to the
            intrinsic width of its content (e.g. all the board columns),
            blowing past the parent's `overflow-hidden` and killing the
            board's own overflow-auto. Classic flex gotcha. */}
        <div className={cn("flex-1 min-w-0 flex flex-col", baseView !== "calendar" && baseView !== "board" && "overflow-auto")}>
          {baseView === "overview" && (
            <ProjectOverview
              project={project}
              onManageMembers={() => setMembersDialogOpen(true)}
              onTaskClick={handleTaskClick}
            />
          )}
          {baseView === "list" && (
            <ListView
              sections={filteredSections}
              onTaskClick={handleTaskClick}
              onAddTask={handleAddTask}
              projectId={project.id}
              reorderDisabled={hasActiveFilters}
            />
          )}
          {baseView === "board" && (
            <BoardView
              sections={filteredSections}
              onTaskClick={handleTaskClick}
              onAddTask={handleAddTask}
              projectId={project.id}
              reorderDisabled={hasActiveFilters}
              rawSectionCounts={Object.fromEntries(
                project.sections.map((s) => [s.id, s.tasks.length])
              )}
            />
          )}
          {baseView === "timeline" && (
            <TimelineView
              sections={filteredSections}
              onTaskClick={handleTaskClick}
              projectId={project.id}
            />
          )}
          {baseView === "gantt" && (
            <GanttView
              sections={filteredSections}
              onTaskClick={handleTaskClick}
              projectId={project.id}
              members={(() => {
                // Owner + members, deduped — feeds the inline assignee
                // picker in the Gantt's editable left table.
                const seen = new Set<string>();
                const list: {
                  id: string;
                  name: string | null;
                  email: string | null;
                  image: string | null;
                }[] = [];
                if (project.owner && !seen.has(project.owner.id)) {
                  seen.add(project.owner.id);
                  list.push(project.owner);
                }
                for (const m of project.members) {
                  if (!seen.has(m.user.id)) {
                    seen.add(m.user.id);
                    list.push(m.user);
                  }
                }
                return list;
              })()}
            />
          )}
          {baseView === "calendar" && (
            <CalendarView
              sections={filteredSections}
              onTaskClick={handleTaskClick}
              projectId={project.id}
              onTaskMutated={() => router.refresh()}
            />
          )}
          {baseView === "dashboard" && (
            <DashboardView
              sections={project.sections}
              projectId={project.id}
            />
          )}
          {baseView === "workflow" && (
            <WorkflowView
              sections={project.sections}
              projectId={project.id}
            />
          )}
          {baseView === "messages" && (
            <MessagesView
              sections={project.sections}
              projectId={project.id}
              projectName={project.name}
              projectColor={project.color}
              projectStatus={project.status}
              currentUser={
                session?.user
                  ? {
                      id: session.user.email || "",
                      name: session.user.name || null,
                      image: session.user.image || null,
                    }
                  : undefined
              }
            />
          )}
          {baseView === "files" && (
            <FilesView
              sections={project.sections}
              projectId={project.id}
            />
          )}
          {baseView === "team" && (
            <ProjectTeamView
              projectId={project.id}
              projectName={project.name}
              projectOwner={project.owner}
            />
          )}
          {baseView === "notes" && (
            <NotesView projectId={project.id} canEdit={canEditProject} />
          )}
          {baseView === "workload" && (
            <WorkloadView projectId={project.id} canEdit={canEditProject} />
          )}
        </div>

        {/* Task Detail Panel */}
        {selectedTaskId && (
          <TaskDetailPanel
            taskId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
            // Re-run the server component after any panel edit so the
            // List/Board columns (incl. custom fields like Est/Act time)
            // pick up the change live instead of only after a manual reload.
            onUpdate={() => router.refresh()}
          />
        )}
      </div>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        projectId={project.id}
        sectionId={selectedSectionId || undefined}
        defaultTaskType={createTaskType}
      />

      {/* Project Members Dialog — mounted regardless of owner. Project.ownerId
          is nullable (onDelete: SetNull), and gating the whole dialog on a
          truthy owner made "Add member"/"Manage all" silent no-ops on any
          project whose owner was removed. */}
      <ProjectMembersDialog
        open={membersDialogOpen}
        onOpenChange={setMembersDialogOpen}
        projectId={project.id}
        owner={
          project.owner
            ? {
                id: project.owner.id,
                name: project.owner.name,
                email: project.owner.email || "",
                image: project.owner.image,
              }
            : null
        }
        canManage={canManageMembers}
        sharedTeamId={project.teamId ?? null}
        sharedTeamName={project.teamName ?? null}
        onMembersChange={() => router.refresh()}
      />

      {/* Project Share Dialog — Asana-parity "Share {project}" modal. The
          header Share buttons open this (they used to just copy the link;
          that action now lives in the dialog's "Copy project link" button). */}
      <ProjectShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        projectId={project.id}
        projectName={project.name}
        visibility={project.visibility ?? "WORKSPACE"}
        ownerId={project.owner?.id ?? null}
        canEdit={canEditProject}
        canManageMembers={canManageMembers}
        onVisibilityChange={() => router.refresh()}
      />

      {/* Edit Project Dialog — reuses CreateProjectDialog in edit mode */}
      <CreateProjectDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        initialProject={{
          id: project.id,
          projectNumber: project.projectNumber ?? null,
          name: project.name,
          type: project.type ?? null,
          color: project.color,
          clientName: project.clientName ?? null,
          location: project.location ?? null,
          latitude: project.latitude ?? null,
          longitude: project.longitude ?? null,
          startDate: project.startDate ?? null,
          endDate: project.endDate ?? null,
          budget: project.budget ?? null,
          currency: project.currency ?? null,
          description: project.description ?? null,
        }}
        onProjectUpdated={() => router.refresh()}
      />
    </div>
  );
}

