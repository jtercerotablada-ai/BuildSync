"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { notifySidebarRefresh } from "@/lib/open-create-project";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  LayoutTemplate,
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
  BUILTIN_VIEW_KEYS,
  PROJECT_TAB_ORDER_KEY,
  RENDERABLE_VIEWS,
  nextProjectTabOrderMap,
  nextTabOrder,
  resolveProjectTabs,
  savedTabOrderFor,
  type ProjectTabOrderMap,
  type ProjectViewTab,
} from "@/lib/project-views";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableViewTab } from "@/components/projects/sortable-view-tab";
import { useUiState } from "@/hooks/use-ui-state";
// isSameWeek, not isThisWeek: isThisWeek is isSameWeek against Date.now(),
// i.e. a clock read in the middle of a render. The week is measured against
// the day useToday() hands us instead.
import { isSameWeek } from "date-fns";
import {
  dueDateToLocalMidnight,
  daysFromToday,
  startOfLocalDay,
} from "@/lib/date-only";
import { useToday } from "@/lib/use-today";
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
import { SaveAsTemplateDialog } from "@/components/projects/save-as-template-dialog";
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
  isArchived: boolean;
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
  type?: "CONSTRUCTION" | "DESIGN" | "RECERTIFICATION" | "PERMIT" | "BSIP" | null;
  gate?: "PRE_DESIGN" | "DESIGN" | "PERMITTING" | "CONSTRUCTION" | "CLOSEOUT" | null;
  // Passed straight through to the Overview's stage strip. Declared here so
  // the fields survive a future narrowing of this shape: the row is spread in
  // whole today, and the strip would silently fall back to "No stage set yet"
  // if they ever stopped arriving.
  stage?: string | null;
  stageEnteredAt?: string | Date | null;
  stageBlocker?: string | null;
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
//
// `today` is local midnight of the viewer's day (useToday()), passed in
// rather than read here. A clock read inside this function is a clock read
// during the render of a client component, and the server render runs in
// UTC: from 20:00 in Miami it would file work due today under "Overdue",
// and React does not repair the group headings it hydrates.
function groupOf(
  task: Task,
  field: GroupByField,
  today: Date
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
      const diff = daysFromToday(task.dueDate, today);
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
      // createdAt is a real timestamp, not a UTC-midnight date-only value, so
      // it must be bucketed by its LOCAL calendar day — daysFromToday reads
      // the UTC day and would file last night's task under "Today" while the
      // Creation-date column (formatted locally) prints yesterday. `today` is
      // already local midnight; only the task's own timestamp needs folding.
      const daysSince = Math.round(
        (today.getTime() -
          startOfLocalDay(new Date(task.createdAt)).getTime()) /
          86400000
      );
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
  BSIP: "BSIP",
};
// Monochrome + gold palette — matches cockpit/types.ts TYPE_COLOR.
const PROJECT_TYPE_COLOR: Record<string, string> = {
  CONSTRUCTION: "#c9a84c", // gold
  DESIGN: "#d4b65a",       // bright gold
  RECERTIFICATION: "#a8893a", // deep gold / bronze
  PERMIT: "#1a1a1a",       // black (outlined badge treatment)
  BSIP: "#8a7028",         // dark bronze — same work, other county
};

interface ProjectContentProps {
  project: Project;
  currentView: string;
  /** Real per-section task counts from the server (sub-tasks included,
   *  multi-homed guests excluded) — what deleting a section destroys. */
  sectionTaskCounts?: Record<string, number>;
  /** May edit the project (rename, archive/unarchive, settings) — mirrors
   *  PATCH /api/projects/[projectId]. AUTHORITATIVE when supplied: only the
   *  server sees the viewer's WORKSPACE role. Optional so callers that don't
   *  pass it fall back to the legacy email memo below; never the other way
   *  round. */
  canEdit?: boolean;
  /** May delete the project — mirrors DELETE /api/projects/[projectId], which
   *  also admits a workspace OWNER/ADMIN. Same authority note as canEdit. */
  canManage?: boolean;
  /** This viewer's saved tab order for THIS project, resolved on the
   *  server. `useUiState` only reads its localStorage cache and the DB
   *  from an effect, so without this the first paint renders catalog
   *  order and the strip visibly re-shuffles once — the same flicker the
   *  "+" fix removed, moved to page load. Seeding the hook's default with
   *  the server's answer makes the SSR HTML, the hydration render and the
   *  hydrated value all agree, so there is nothing to settle. */
  initialTabOrder?: string[] | null;
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

// A resolved tab in the strip is `ProjectViewTab` from @/lib/project-views —
// the same shape this file used to declare inline, now shared with the pure
// rule that builds and orders the strip.

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

export function ProjectContent({
  project,
  currentView,
  sectionTaskCounts,
  canEdit,
  canManage,
  initialTabOrder,
}: ProjectContentProps) {
  const router = useRouter();
  // Both project pages are re-exported into the portal shell, so any
  // destination that exists in both has to be prefixed with the one the user
  // is actually in.
  const pathname = usePathname();
  const shellPrefix = pathname?.startsWith("/portal") ? "/portal" : "";
  const browseProjectsHref = `${shellPrefix}/projects/all`;
  // Browse projects opens on Active, which is the one list that cannot
  // contain an archived project — so the banner's link has to name the scope
  // or it lands the user somewhere the thing they clicked from isn't.
  const archivedProjectsHref = `${browseProjectsHref}?scope=archived`;
  const { data: session } = useSession();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [createTaskType, setCreateTaskType] = useState<"TASK" | "MILESTONE">(
    "TASK"
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  // The star rides on the user's account rather than the browser. It used
  // to be a raw localStorage key, so a project starred at the office was
  // unstarred on the laptop and the toast fired twice in development
  // (the state updater it lived in is double-invoked by StrictMode).
  // One map holds every project's star, so a write here replaces the whole
  // key: toggling against the pre-hydration `{}` default would persist a map
  // containing only this project and drop the user's other favorites.
  const {
    value: starredProjects,
    setValue: setStarredProjects,
    isHydrated: starsHydrated,
  } = useUiState<Record<string, boolean>>("project.starred", {});
  const isStarred = starredProjects[project.id] === true;

  const toggleStar = () => {
    if (!starsHydrated) return;
    const next = !isStarred;
    // Functional form so the merge is against the freshest map rather than
    // whatever this render closed over. Removing the star has to be written
    // as `false` instead of dropping the key: PATCH /api/users/preferences
    // merges object-valued uiState keys one level deep, so an absent key is
    // restored from the stored map and the un-star would never persist.
    setStarredProjects((prev) => ({ ...prev, [project.id]: next }));
    toast.success(next ? "Added to favorites" : "Removed from favorites");
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
  const canEditProjectFallback = useMemo(() => {
    if (!currentEmail) return false;
    if (project.owner?.email && project.owner.email === currentEmail) return true;
    return project.members.some(
      (m) =>
        m.user.email === currentEmail &&
        (m.role === "ADMIN" || m.role === "EDITOR")
    );
  }, [currentEmail, project.owner, project.members]);
  // The props are AUTHORITATIVE; the memos above are the legacy fallback for
  // callers that don't pass them. Only the server sees the viewer's WORKSPACE
  // role, and matching the session email against owner/members is blind to it
  // — which is why the delete rule below could never be stated here at all.
  const canEditProject = canEdit ?? canEditProjectFallback;
  // Deletion is its own gate, not canEditProject: DELETE enforces
  // `access.canManage` (owner | project ADMIN | workspace manager) while PATCH
  // enforces owner | project ADMIN/EDITOR, so an EDITOR may archive a project
  // he may not delete. The members memo is the closest legacy approximation.
  const canDeleteProject = canManage ?? canManageMembers;
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);

  // Filter/Sort/Group state
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [showCompleted, setShowCompleted] = useState(true);
  // Group-by for the project List — regroups tasks into synthetic
  // sections by a field. "none" keeps the project's own sections.
  const [groupBy, setGroupBy] = useState<GroupByField>("none");
  // The viewer's own calendar day, for the date-driven filter and group-by
  // buckets below. Never computed while rendering: the server render runs in
  // UTC and is already tomorrow from 20:00 in Miami. It also re-arms at local
  // midnight, which re-runs the memo below — so a project page left open
  // overnight moves a task out of "Today" instead of holding yesterday's
  // groups until something else happens to change.
  const today = useToday();

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
            // Which week is "this" one is the viewer's question, so it is
            // answered with the viewer's day; no day yet, no answer.
            if (!today) return false;
            try {
              // Compare the UTC calendar day (dueDates are stored at UTC
              // midnight); parsing with local time would bucket a task into
              // the previous week for evening US users.
              if (!isSameWeek(dueDateToLocalMidnight(task.dueDate), today, { weekStartsOn: 1 })) return false;
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
    // Grouping by due date or creation date needs the viewer's day, so it
    // waits for `today`. Until then the project's own sections stand — one
    // frame ungrouped, rather than a whole evening of headings computed from
    // the server's UTC day. (In practice grouping is only ever switched on
    // after mount, so this is a guard, not a visible state.)
    if (groupBy !== "none" && today) {
      const all = sections.flatMap((s) => s.tasks);
      const groups = new Map<
        string,
        { label: string; order: number; tasks: typeof all }
      >();
      for (const t of all) {
        const g = groupOf(t, groupBy, today);
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
  }, [project.sections, searchQuery, activeFilters, sortBy, sortDirection, showCompleted, groupBy, today, session?.user?.email]);

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

  // WHAT the strip contains is a project-wide decision — the shared `hidden`
  // flag "+", Delete and Make-a-copy write to ProjectViewPref. The ORDER is
  // personal ("por persona, cada quien acomoda sus taps"), so it lives in this
  // user's own uiState: ProjectViewPref has no userId, so an order stored
  // there would rearrange all three colleagues' strips at once.
  // Seeded from the server so the first frame is already this viewer's
  // arrangement. Memoised on the id + the resolved order because
  // useUiState holds its default in useState's initialiser: a fresh
  // object per render would be harmless there but is a lie to read.
  const tabOrderSeed = useMemo<ProjectTabOrderMap>(
    () =>
      initialTabOrder && initialTabOrder.length > 0
        ? { [project.id]: initialTabOrder }
        : {},
    [project.id, initialTabOrder]
  );
  const {
    value: tabOrderMap,
    setValue: setTabOrderMap,
    isHydrated: tabOrderHydrated,
  } = useUiState<ProjectTabOrderMap>(PROJECT_TAB_ORDER_KEY, tabOrderSeed);

  // Built-ins "+" has just un-hidden, held locally until the server row says
  // the same thing. Without this the new tab cannot exist until the PATCH
  // round-trips and the server component re-renders — that gap is the flicker:
  // click Gantt, land on Gantt, and watch its tab pop in a beat later.
  const [pendingUnhide, setPendingUnhide] = useState<string[]>([]);

  // Hand the tab back to the server copy only once the two AGREE, so the
  // hand-off is invisible. Clearing the whole overlay on any viewPrefs change
  // would make the tab disappear and return on an unrelated refresh — the
  // second shuffle this is meant to prevent.
  useEffect(() => {
    setPendingUnhide((prev) => {
      const next = prev.filter((key) =>
        viewPrefs.some((p) => p.viewKey === key && p.hidden)
      );
      return next.length === prev.length ? prev : next;
    });
  }, [viewPrefs]);

  const effectivePrefs = useMemo<ViewPref[]>(() => {
    if (pendingUnhide.length === 0) return viewPrefs;
    const pending = new Set(pendingUnhide);
    return viewPrefs.map((p) =>
      pending.has(p.viewKey) && p.hidden ? { ...p, hidden: false } : p
    );
  }, [viewPrefs, pendingUnhide]);

  // savedTabOrderFor returns the stored array by reference (or undefined), so
  // this stays referentially stable between renders and the memo below holds.
  const savedTabOrder = savedTabOrderFor(tabOrderMap, project.id);

  const tabs = useMemo<ProjectViewTab[]>(
    () =>
      resolveProjectTabs({ prefs: effectivePrefs, savedOrder: savedTabOrder }),
    [effectivePrefs, savedTabOrder]
  );

  // The active tab may be a copy, whose underlying built-in drives rendering.
  const activeTab = tabs.find((t) => t.viewKey === currentView);
  const baseView = activeTab
    ? activeTab.baseView
    : RENDERABLE_VIEWS.has(currentView)
      ? currentView
      : "list";

  // Hidden built-in views — the "+" catalog re-adds (unhides) these. Read from
  // effectivePrefs, not viewPrefs: a tab already un-hidden optimistically must
  // not be PATCHed a second time when the user clicks it again in "+".
  const hiddenBuiltins = useMemo(
    () =>
      new Set(
        effectivePrefs
          .filter((p) => p.hidden && BUILTIN_VIEW_KEYS.has(p.viewKey))
          .map((p) => p.viewKey)
      ),
    [effectivePrefs]
  );

  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [tabBusy, setTabBusy] = useState(false);

  // ── Arranging the strip (per user) ──────────────────────────────────
  //
  // Write this user's arrangement. `setTabOrderMap` PATCHes on a debounce and
  // swallows its own network errors, so the same payload is sent here too:
  // that is the only way to notice a REJECTED write — the merged uiState is
  // size-capped server-side and the PATCH fails past the cap — and roll the
  // strip back instead of leaving the user with an order that silently never
  // saved. The rollback's setTabOrderMap replaces the hook's still-pending
  // debounced write with the old value, so the server ends up repaired too.
  // The most recent map this component wrote, so a stale in-flight request
  // can tell whether it is still the current one before rolling anything back.
  const lastTabOrderWriteRef = useRef<ProjectTabOrderMap | null>(null);

  const persistTabOrder = (order: string[]) => {
    // Pre-hydration the map is still the `{}` default, so a write here would
    // be computed against an empty map. Unreachable rather than merely
    // unlikely: dnd-kit attaches no pointer listeners until it has mounted,
    // so there is no drag to persist before this flips.
    if (!tabOrderHydrated) return;
    const previous = tabOrderMap;
    const nextMap = nextProjectTabOrderMap(previous, project.id, order);
    lastTabOrderWriteRef.current = nextMap;
    setTabOrderMap(nextMap);
    fetch("/api/users/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uiState: { [PROJECT_TAB_ORDER_KEY]: nextMap } }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      })
      .catch(() => {
        // Only the LATEST write may roll back. Two drags inside one round trip
        // hit the same row in SERIALIZABLE transactions; if the first loses
        // that race and 500s after the second has already committed, rolling
        // back to ITS snapshot would rewind both drags on screen and then push
        // the stale order back to the server.
        if (lastTabOrderWriteRef.current !== nextMap) return;
        setTabOrderMap(previous);
        toast.error("Could not save your tab order");
      });
  };

  const [draggingTabKey, setDraggingTabKey] = useState<string | null>(null);
  const [tabOrderAnnouncement, setTabOrderAnnouncement] = useState("");
  // Mouse: a few pixels of travel is what separates a drag from the click that
  // opens a view — or, on the active tab, its context menu. Touch: a long
  // press, so a swipe still SCROLLS the overflowing strip on the iPad instead
  // of grabbing whichever tab happened to be under the finger.
  const tabSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    })
  );

  // Tabs the breakpoint hides ("hidden md:flex") are still registered as drop
  // targets, and `display: none` measures as a 0x0 rect at the viewport
  // origin — which sits close enough to this strip that closestCenter would
  // hand it the drop and move the dragged tab somewhere invisible. Compare
  // only against targets that actually occupy space.
  const tabCollisionDetection: CollisionDetection = (args) =>
    closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((container) => {
        const rect = args.droppableRects.get(container.id);
        return !!rect && rect.width > 0 && rect.height > 0;
      }),
    });

  // Below md the strip renders only the `mobile` tabs — the rest carry
  // "hidden md:flex". They stay in `tabs` (and therefore in the saved order),
  // so anything that reports or steps through POSITIONS has to ignore them.
  const isTabOnScreen = (tab: ProjectViewTab) =>
    tab.mobile ||
    typeof window === "undefined" ||
    window.matchMedia("(min-width: 768px)").matches;

  const moveTab = (from: number, to: number) => {
    if (from < 0 || from >= tabs.length) return;
    if (to < 0 || to >= tabs.length || to === from) return;
    const moved = tabs[from];
    const nextKeys = nextTabOrder(tabs, { type: "move", from, to });
    persistTabOrder(nextKeys);
    // Announce the position the user can actually see. Counting the whole
    // array would say "position 4 of 5" on a phone where only three tabs are
    // on screen and nothing appeared to move.
    const onScreen = nextKeys.filter((key) => {
      const tab = tabs.find((t) => t.viewKey === key);
      return !!tab && isTabOnScreen(tab);
    });
    setTabOrderAnnouncement(
      `${moved.label} moved to position ${
        onScreen.indexOf(moved.viewKey) + 1
      } of ${onScreen.length}`
    );
  };

  const handleTabDragEnd = (event: DragEndEvent) => {
    setDraggingTabKey(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    moveTab(
      tabs.findIndex((t) => t.viewKey === active.id),
      tabs.findIndex((t) => t.viewKey === over.id)
    );
  };

  // Alt+Arrow reorders from the keyboard. dnd-kit's KeyboardSensor is not an
  // option on this strip: it activates on Space/Enter, which on a tab button
  // already means "open this view", so arming a drag there would break plain
  // keyboard navigation.
  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (!e.altKey) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    // Step OVER the tabs this breakpoint hides. Swapping with one of those
    // rewrites the saved order while the visible strip does not move at all.
    const step = e.key === "ArrowLeft" ? -1 : 1;
    let target = index + step;
    while (target >= 0 && target < tabs.length && !isTabOnScreen(tabs[target])) {
      target += step;
    }
    if (target < 0 || target >= tabs.length) return;
    moveTab(index, target);
  };

  // The active tab's context menu is opened by US, on click. Radix's
  // DropdownMenuTrigger opens on POINTERDOWN — the same press that arms the
  // drag sensor — so grabbing the active tab would pop the menu open under the
  // pointer and cancel the drag. The trigger below is therefore an inert
  // anchor (pointer-events: none) that only positions the menu, and dnd-kit
  // swallows the click that ends a real drag exactly as it does for list rows,
  // so a drag never ends in an open menu.
  const [openTabMenuKey, setOpenTabMenuKey] = useState<string | null>(null);
  // Only one tab is active at a time, so one ref is enough to hand focus back
  // when the menu closes; the inert anchor cannot take it.
  const activeTabButtonRef = useRef<HTMLButtonElement | null>(null);

  // ...that holds for a drag that COMPLETES. A drag CANCELLED with Escape (or
  // by a window resize / tab switch) detaches dnd-kit's click swallower 50ms
  // later while the button is still held down, so the click that fires when
  // the user finally lets go reaches the tab: Escape — the universal "undo
  // this gesture" — would navigate to the very tab being dragged, or pop open
  // the active tab's menu. Swallow exactly that one click.
  const cancelledTabDragRef = useRef(false);
  useEffect(() => {
    // A fresh press means the cancelled gesture ended without ever producing
    // the click we were holding this for; drop it so a later, genuine click is
    // never eaten.
    const clear = () => {
      cancelledTabDragRef.current = false;
    };
    document.addEventListener("pointerdown", clear, true);
    return () => document.removeEventListener("pointerdown", clear, true);
  }, []);
  const swallowCancelledTabDragClick = () => {
    if (!cancelledTabDragRef.current) return false;
    cancelledTabDragRef.current = false;
    return true;
  };

  const viewsApi = (suffix = "") =>
    `/api/projects/${project.id}/views${suffix}`;

  const startRename = (tab: ProjectViewTab) => {
    setRenameValue(tab.label);
    setRenamingKey(tab.viewKey);
  };

  const commitRename = async (tab: ProjectViewTab) => {
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

  const setDefaultView = async (tab: ProjectViewTab) => {
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

  const makeViewCopy = async (tab: ProjectViewTab) => {
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

  const copyViewLink = async (tab: ProjectViewTab) => {
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

  const deleteView = async (tab: ProjectViewTab) => {
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

  // "+" catalog: re-add (unhide) a hidden built-in, then navigate to it.
  //
  // Nothing here awaits the network. The old version awaited the PATCH before
  // navigating and let the tab appear only when the server prop came back, so
  // adding a view flickered. Now the tab is shown optimistically and the order
  // is materialised first, which is also what makes the new tab land LAST
  // instead of dropping back into its catalog slot (Gantt between Timeline and
  // Dashboard) — and it lands last for THIS user only, because the order is
  // written to his uiState, not to the project.
  const addOrOpenView = (viewKey: string) => {
    if (!hiddenBuiltins.has(viewKey)) {
      // Already in the strip — nothing to un-hide, just go there.
      handleViewChange(viewKey);
      return;
    }
    // Un-hiding edits the PROJECT, which a read-only colleague may not do —
    // but he may still OPEN the view, and below md this menu is his only way
    // to reach the five "hidden md:flex" ones. Navigate without the PATCH that
    // would only 403 (this is what the pre-drag version did, minus the 403).
    if (!canEditProject) {
      handleViewChange(viewKey);
      return;
    }

    // Where he was, so a rejected un-hide can put him back. Navigating first
    // is what kills the flicker, but it means a 403 would otherwise strand him
    // on a view whose tab has just been pulled back out of the strip.
    const previousView = currentView;

    setPendingUnhide((prev) =>
      prev.includes(viewKey) ? prev : [...prev, viewKey]
    );
    persistTabOrder(nextTabOrder(tabs, { type: "append", viewKey }));
    handleViewChange(viewKey);

    void (async () => {
      try {
        const res = await fetch(viewsApi(`/${encodeURIComponent(viewKey)}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hidden: false }),
        });
        if (!res.ok) {
          throw new Error((await res.json().catch(() => ({}))).error);
        }
        // Pull the real ProjectViewPref rows in; the optimistic overlay drops
        // itself once they agree, so the strip never moves twice.
        router.refresh();
      } catch (e) {
        // Roll the tab back out of the strip — the project never got it —
        // and off the view it would have opened, so he is not left on a body
        // with no tab highlighted and no tab to click back from.
        setPendingUnhide((prev) => prev.filter((k) => k !== viewKey));
        handleViewChange(previousView);
        toast.error(
          e instanceof Error && e.message ? e.message : "Could not add view"
        );
      }
    })();
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

  // Archiving is driven from two places (the name menu and the archived
  // banner), so the PATCH lives in one. Only the archive direction navigates
  // away — bringing a project back should leave the user where they are, on
  // the page that is now un-archived.
  const setArchived = async (next: boolean) => {
    const verb = next ? "archive" : "unarchive";
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: next }),
      });
      if (res.ok) {
        toast.success(next ? "Project archived" : "Project unarchived");
        notifySidebarRefresh();
        if (next) router.push(browseProjectsHref);
        else router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Failed to ${verb} project`);
      }
    } catch {
      toast.error(`Failed to ${verb} project`);
    }
  };

  // Thrown rather than toasted: ConfirmDialog renders a rejection inline and
  // holds itself open, so swallowing the failure here would close the dialog
  // as though the project had been deleted.
  const deleteProject = async () => {
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to delete project");
    }
    toast.success("Project deleted");
    notifySidebarRefresh();
    router.push(browseProjectsHref);
  };

  // What a delete destroys and what a template capture reads — the same
  // population. sectionTaskCounts is the honest task number (sub-tasks
  // included, multi-homed guests excluded); the rendered section.tasks lists
  // are neither, so a caller that didn't pass it gets the line without a count
  // rather than a wrong one.
  const totalTaskCount = sectionTaskCounts
    ? Object.values(sectionTaskCounts).reduce((n, c) => n + c, 0)
    : null;
  const deleteConsequences = [
    totalTaskCount === null
      ? "Every task in this project, with its sub-tasks, comments and attachments"
      : `${totalTaskCount} task${totalTaskCount === 1 ? "" : "s"} and sub-tasks, with their comments and attachments`,
    `${project.sections.length} section${project.sections.length === 1 ? "" : "s"} and this project's saved views`,
    `${memberCount} member${memberCount === 1 ? " loses" : "s lose"} access`,
  ];

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

      {/* Archived banner — an archived project is dropped from the sidebar and
          from the default projects list, so the banner has to name the one
          place it still shows up or the user keeps a saved URL as their only
          way back. Naming the scope is not enough — it is a link straight to it,
          because a label the reader has to go hunting for is half an answer. The
          button is gated the way the PATCH is: offering it to a reader who
          can't edit would dead-end in a 403 toast. */}
      {project.isArchived && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 md:px-6 py-2 text-sm text-amber-900">
          <Archive className="h-4 w-4 flex-shrink-0 text-amber-700" />
          <span>
            This project is archived and hidden from the projects list. Find it
            under{" "}
            <Link
              href={archivedProjectsHref}
              className="font-medium underline underline-offset-2 hover:text-amber-950"
            >
              Archived
            </Link>
            .
          </span>
          {canEditProject && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-7 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
              onClick={() => setArchived(false)}
            >
              Unarchive
            </Button>
          )}
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
                        notifySidebarRefresh();
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
                      notifySidebarRefresh();
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
                {/* Same family as Duplicate — this project becomes the seed
                    for another — so it sits next to it. onSelect is prevented
                    for the same reason Delete prevents it: the menu closing
                    must not steal focus from the dialog it opens. */}
                {canEditProject && (
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setSaveAsTemplateOpen(true);
                    }}
                  >
                    <LayoutTemplate className="h-4 w-4 mr-2" />
                    Save as template
                  </DropdownMenuItem>
                )}
                {/* The separator earns its place only if something follows
                    it; a reader who gets neither destructive item would
                    otherwise see the menu end on a rule. */}
                {(canEditProject || canDeleteProject) && <DropdownMenuSeparator />}
                {canEditProject && (
                  <DropdownMenuItem onClick={() => setArchived(!project.isArchived)}>
                    <Archive className="h-4 w-4 mr-2" />
                    {project.isArchived ? 'Unarchive' : 'Archive'}
                  </DropdownMenuItem>
                )}
                {canDeleteProject && (
                  <DropdownMenuItem
                    className="text-black"
                    onSelect={(e) => {
                      e.preventDefault();
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Favorite */}
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", isStarred && "text-[#a8893a]")}
              onClick={toggleStar}
              disabled={!starsHydrated}
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
          {/* Drag-to-reorder. The arrangement is PERSONAL, so this needs no
              project write access — a read-only colleague may still arrange
              his own strip. autoScroll keeps a drag alive past the visible
              edge once there are more tabs than fit; y:0 stops it from
              scrolling the page while the drag is purely horizontal. */}
          <DndContext
            sensors={tabSensors}
            collisionDetection={tabCollisionDetection}
            autoScroll={{ threshold: { x: 0.2, y: 0 } }}
            onDragStart={(e: DragStartEvent) => {
              setDraggingTabKey(String(e.active.id));
              // Belt and braces: a drag must never leave the active tab's
              // context menu hanging open over the strip.
              setOpenTabMenuKey(null);
            }}
            onDragCancel={() => {
              setDraggingTabKey(null);
              cancelledTabDragRef.current = true;
            }}
            onDragEnd={handleTabDragEnd}
          >
          <div
            className={cn(
              "flex items-center gap-0 md:gap-1 overflow-x-auto flex-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
              // Deliberately NOT hidden until the saved order arrives. This
              // component is server-rendered, and `useUiState` reports
              // hydrated only from an effect, so any such guard ships inside
              // the streamed HTML: the tab strip would be a blank row on every
              // cold load, for all three colleagues, until the JS bundle
              // hydrates. That costs everyone a visible gap in order to hide
              // one settle frame that only a user who has arranged his tabs
              // would ever see — and it does not even hide it on a device with
              // no localStorage cache, where the order arrives from the
              // network. Paint the strip; let the arrangement land.
              draggingTabKey && "cursor-grabbing"
            )}
          >
            {/* No "Team" tab — Asana assigns the team at the team level;
                projects don't carry a Team view. The route still resolves
                for old deep links, and members live in Manage members. */}
            <SortableContext
              items={tabs.map((t) => t.viewKey)}
              strategy={horizontalListSortingStrategy}
            >
            {tabs.map((tab, tabIndex) => {
              const Icon = VIEW_ICONS[tab.baseView] ?? List;
              const active = currentView === tab.viewKey;
              // The responsive display now lives on the sortable slot, so the
              // controls inside it are plain flex children.
              const display = tab.mobile ? "flex" : "hidden md:flex";
              const cls = `flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-1.5 text-xs md:text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? "border-[#c9a84c] text-[#a8893a]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`;
              // Copies keep their label on mobile so two same-icon tabs stay
              // distinguishable; built-ins collapse to icon-only like before.
              const labelCls = tab.isCopy ? "" : "hidden md:inline";
              const renaming = active && renamingKey === tab.viewKey;

              return (
                <SortableViewTab
                  key={tab.viewKey}
                  viewKey={tab.viewKey}
                  className={display}
                  // Dragging a tab whose label is an open text field would
                  // swallow the click that positions the caret.
                  disabled={renaming}
                >
                  {/* Inline rename — the active tab becomes a text field. */}
                  {renaming ? (
                      <div
                        className="flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-1.5 border-b-2 border-[#c9a84c]"
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
                  ) : !active ? (
                    /* Inactive tab — a plain button that navigates. */
                      <button
                        onClick={() => {
                          if (swallowCancelledTabDragClick()) return;
                          handleViewChange(tab.viewKey);
                        }}
                        onKeyDown={(e) => handleTabKeyDown(e, tabIndex)}
                        className={cls}
                      >
                        <Icon className="h-4 w-4" />
                        <span className={labelCls}>{tab.label}</span>
                      </button>
                  ) : (
                    /* Active tab — clicking it again opens the Asana context
                       menu. See openTabMenuKey: the menu is opened on CLICK by
                       this button, and the Trigger below is an inert anchor that
                       only tells Radix where to place the panel, so a press that
                       turns into a drag never opens it. */
                    <DropdownMenu
                      open={openTabMenuKey === tab.viewKey}
                      onOpenChange={(open) =>
                        setOpenTabMenuKey(open ? tab.viewKey : null)
                      }
                    >
                        <button
                          ref={activeTabButtonRef}
                          className={cls}
                          aria-label={`${tab.label} view options`}
                          aria-haspopup="menu"
                          aria-expanded={openTabMenuKey === tab.viewKey}
                          onClick={() => {
                            if (swallowCancelledTabDragClick()) return;
                            setOpenTabMenuKey(tab.viewKey);
                          }}
                          onKeyDown={(e) => handleTabKeyDown(e, tabIndex)}
                        >
                          <Icon className="h-4 w-4" />
                          <span className={labelCls}>{tab.label}</span>
                          <ChevronDown className="h-3 w-3 opacity-60" />
                        </button>
                      <DropdownMenuTrigger asChild>
                        {/* Anchor only — it covers the tab so Radix positions the
                            panel exactly where it used to, and is disabled +
                            aria-hidden so it is neither focusable nor announced
                            alongside the real tab button above. */}
                        <button
                          type="button"
                          disabled
                          tabIndex={-1}
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0"
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="w-56"
                        // Radix would hand focus back to the anchor above, which
                        // is inert and unfocusable — send it to the real tab.
                        onCloseAutoFocus={(e) => {
                          e.preventDefault();
                          activeTabButtonRef.current?.focus();
                        }}
                      >
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
                  )}
                </SortableViewTab>
              );
            })}
            </SortableContext>
            {/* "+" add-view catalog — Asana-style Popular / Others menu. It is
                NOT a tab: it stays pinned after the sortable ones and cannot
                be dragged. It stays visible without write access: below md
                five views render "hidden md:flex", so this menu is the ONLY
                route a read-only colleague has to Workflow, Messages, Files,
                Notes and Workload on a phone. addOrOpenView drops the un-hide
                PATCH for him and just navigates. */}
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
          </DndContext>

          {/* Keyboard reorder feedback — the drag has visual motion, Alt+Arrow
              has none, so screen readers get the new position spoken. */}
          <span role="status" aria-live="polite" className="sr-only">
            {tabOrderAnnouncement}
          </span>

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
              rawSectionCounts={sectionTaskCounts}
            />
          )}
          {baseView === "board" && (
            <BoardView
              sections={filteredSections}
              onTaskClick={handleTaskClick}
              onAddTask={handleAddTask}
              projectId={project.id}
              reorderDisabled={hasActiveFilters}
              rawSectionCounts={sectionTaskCounts}
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
          that action now lives in the dialog's "Copy project link" button).
          Its `canEdit` gates exactly one control, the visibility picker, and
          PATCH treats visibility as access control rather than content: it
          refuses anyone short of `access.canManage`. Passing the edit flag
          handed an EDITOR a picker that answered "Only a project admin can
          change visibility" on every choice. */}
      <ProjectShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        projectId={project.id}
        projectName={project.name}
        visibility={project.visibility ?? "WORKSPACE"}
        ownerId={project.owner?.id ?? null}
        canEdit={canDeleteProject}
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

      {/* Save as template — a sibling of the other dialogs for the same
          reason the delete confirm is: inside DropdownMenuContent it would
          unmount with the menu and never render. */}
      <SaveAsTemplateDialog
        open={saveAsTemplateOpen}
        onOpenChange={setSaveAsTemplateOpen}
        projectId={project.id}
        projectName={project.name}
        sectionCount={project.sections.length}
        taskCount={totalTaskCount}
      />

      {/* Delete confirmation — a sibling of the other dialogs, deliberately
          outside the name DropdownMenu: rendered inside DropdownMenuContent it
          would unmount the moment the menu closed and never appear. Deleting a
          project is a hard row delete that cascades; there is no trash, hence
          the typed name. */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete project"
        description={`"${project.name}" and everything in it will be permanently deleted. This cannot be undone.`}
        consequences={deleteConsequences}
        confirmLabel="Delete project"
        requireText={project.name}
        onConfirm={deleteProject}
      />
    </div>
  );
}

