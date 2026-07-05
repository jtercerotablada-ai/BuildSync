"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Loader2,
  Folder,
  Calendar,
  Trash2,
  GripVertical,
  List as ListIcon,
  CalendarRange,
  LayoutDashboard,
  Activity,
  Users,
  MessageSquare,
  Star,
  UserPlus,
  SlidersHorizontal,
  Filter,
  ArrowUpDown,
  Layers,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PortfolioTimelineView } from "@/components/portfolios/portfolio-timeline-view";
import { PortfolioPanelView } from "@/components/portfolios/portfolio-panel-view";
import { PortfolioProgressView } from "@/components/portfolios/portfolio-progress-view";
import { PortfolioWorkloadView } from "@/components/portfolios/portfolio-workload-view";
import { PortfolioShareDialog } from "@/components/portfolios/portfolio-share-dialog";
import { PortfolioCustomizeDrawer } from "@/components/portfolios/portfolio-customize-drawer";
import { MessagesView } from "@/components/views/messages-view";
import { useUiState } from "@/hooks/use-ui-state";
import {
  COLUMN_DEFS,
  DEFAULT_COLUMNS,
  type ColumnKey,
  type PortfolioPrivacy as PortfolioPrivacyType,
} from "./customize-shared";

// ── Types ───────────────────────────────────────────────────

type PortfolioStatus =
  | "ON_TRACK"
  | "AT_RISK"
  | "OFF_TRACK"
  | "ON_HOLD"
  | "COMPLETE";

type ProjectType = "CONSTRUCTION" | "DESIGN" | "RECERTIFICATION" | "PERMIT";

type ProjectGate =
  | "PRE_DESIGN"
  | "DESIGN"
  | "PERMITTING"
  | "CONSTRUCTION"
  | "CLOSEOUT";

interface Project {
  id: string;
  name: string;
  color: string;
  status: PortfolioStatus;
  type: ProjectType | null;
  gate: ProjectGate | null;
  budget: number | null;
  currency: string | null;
  startDate: string | null;
  endDate: string | null;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
  stats: {
    total: number;
    completed: number;
    overdue: number;
    progress: number;
  };
}

interface PortfolioProject {
  id: string;
  position: number;
  project: Project;
}

interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  status: PortfolioStatus;
  privacy: PortfolioPrivacyType;
  startDate: string | null;
  endDate: string | null;
  ownerId: string | null;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
  // Raw membership rows (from the GET include) so the client can resolve
  // the caller's edit capability for the Share / Customize gates.
  members: { userId: string; role: PortfolioRole }[];
  projects: PortfolioProject[];
  _count: {
    projects: number;
  };
}

type PortfolioRole = "OWNER" | "EDITOR" | "VIEWER";

interface AvailableProject {
  id: string;
  name: string;
  color: string;
}

interface StatusUpdate {
  id: string;
  status: PortfolioStatus;
  summary: string;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

// ── Constants ───────────────────────────────────────────────

const STATUS_OPTIONS: {
  value: PortfolioStatus;
  label: string;
  dot: string;
  chip: string;
}[] = [
  {
    value: "ON_TRACK",
    label: "On track",
    dot: "bg-[#c9a84c]",
    chip: "bg-[#c9a84c]/15 text-[#a8893a]",
  },
  {
    value: "AT_RISK",
    label: "At risk",
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-800",
  },
  {
    value: "OFF_TRACK",
    label: "Off track",
    dot: "bg-black",
    chip: "bg-gray-100 text-black",
  },
  {
    value: "ON_HOLD",
    label: "On hold",
    dot: "bg-gray-400",
    chip: "bg-gray-100 text-gray-700",
  },
  {
    value: "COMPLETE",
    label: "Complete",
    dot: "bg-[#a8893a]",
    chip: "bg-[#a8893a]/15 text-[#a8893a]",
  },
];

const TYPE_META: Record<ProjectType, { label: string; short: string }> = {
  CONSTRUCTION: { label: "Construction", short: "CON" },
  DESIGN: { label: "Design", short: "DES" },
  RECERTIFICATION: { label: "Recertification", short: "REC" },
  PERMIT: { label: "Permit", short: "PRM" },
};

const GATE_META: Record<ProjectGate, { label: string }> = {
  PRE_DESIGN: { label: "Pre-design" },
  DESIGN: { label: "Design" },
  PERMITTING: { label: "Permitting" },
  CONSTRUCTION: { label: "Construction" },
  CLOSEOUT: { label: "Closeout" },
};

function statusMeta(s: PortfolioStatus) {
  return STATUS_OPTIONS.find((o) => o.value === s) || STATUS_OPTIONS[0];
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatBudget(value: number | null, currency: string | null): string {
  if (!value || value <= 0) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${currency || "USD"} ${value.toLocaleString("en-US")}`;
  }
}

// ── List view: columns, filter, sort, group ─────────────────

// Favorites live in localStorage under the same key the Portfolios
// landing page uses so the detail-header star and the list cards stay
// in sync (see src/app/(dashboard)/portfolios/page.tsx).
const FAVORITES_KEY = "buildsync.portfolios.favorites";

function loadFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr)
      ? new Set(arr.filter((v): v is string => typeof v === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

function saveFavorites(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage full / blocked — ignore.
  }
}

type SortKey =
  | "manual"
  | "name"
  | "status"
  | "progress"
  | "due"
  | "budget";
type SortDir = "asc" | "desc";
type GroupKey = "none" | "status" | "owner" | "type" | "gate";

interface ListViewState {
  columns: ColumnKey[];
  filter: {
    status: PortfolioStatus[];
    type: ProjectType[];
    gate: ProjectGate[];
    ownerId: string[];
  };
  sort: { key: SortKey; dir: SortDir };
  group: GroupKey;
}

const DEFAULT_LIST_VIEW: ListViewState = {
  columns: DEFAULT_COLUMNS,
  filter: { status: [], type: [], gate: [], ownerId: [] },
  sort: { key: "manual", dir: "asc" },
  group: "none",
};

// Order used when sorting/grouping by status so "worse" health floats
// to the top (Asana-like: off track before at risk before on track).
const STATUS_SORT_ORDER: Record<PortfolioStatus, number> = {
  OFF_TRACK: 0,
  AT_RISK: 1,
  ON_TRACK: 2,
  ON_HOLD: 3,
  COMPLETE: 4,
};

const SORT_LABELS: Record<Exclude<SortKey, "manual">, string> = {
  name: "name",
  status: "status",
  progress: "progress",
  due: "due date",
  budget: "budget",
};

const GROUP_LABELS: Record<Exclude<GroupKey, "none">, string> = {
  status: "status",
  owner: "owner",
  type: "type",
  gate: "gate",
};

// Build the md+ grid template for the active column set. Name always
// takes 4 fractional columns; the trailing actions cell takes 1; the
// active data columns share the remaining tracks per COLUMN_DEFS.span.
function gridTemplateFor(columns: ColumnKey[]): string {
  const parts = ["4fr"]; // Name
  for (const key of columns) {
    const def = COLUMN_DEFS.find((c) => c.key === key);
    parts.push(`${def ? def.span : 1}fr`);
  }
  parts.push("1fr"); // actions
  return parts.join(" ");
}

function normalizeListView(raw: unknown): ListViewState {
  if (!raw || typeof raw !== "object") return DEFAULT_LIST_VIEW;
  const r = raw as Partial<ListViewState>;
  const validCols = new Set<ColumnKey>(COLUMN_DEFS.map((c) => c.key));
  const columns = Array.isArray(r.columns)
    ? r.columns.filter((c): c is ColumnKey => validCols.has(c as ColumnKey))
    : DEFAULT_COLUMNS;
  return {
    columns: columns.length ? columns : DEFAULT_COLUMNS,
    filter: {
      status: Array.isArray(r.filter?.status) ? r.filter!.status : [],
      type: Array.isArray(r.filter?.type) ? r.filter!.type : [],
      gate: Array.isArray(r.filter?.gate) ? r.filter!.gate : [],
      ownerId: Array.isArray(r.filter?.ownerId) ? r.filter!.ownerId : [],
    },
    sort: {
      key: (r.sort?.key as SortKey) || "manual",
      dir: r.sort?.dir === "desc" ? "desc" : "asc",
    },
    group: (r.group as GroupKey) || "none",
  };
}

// ── Page ────────────────────────────────────────────────────

export default function PortfolioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const portfolioId = params.portfolioId as string;

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<AvailableProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [updates, setUpdates] = useState<StatusUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // Current user + the caller's edit capability (owner or member
  // OWNER/EDITOR), used to gate the Share / Customize controls.
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
  const isPortfolioOwner =
    !!currentUserId && portfolio?.ownerId === currentUserId;
  const callerMemberRole = portfolio?.members?.find(
    (m) => m.userId === currentUserId
  )?.role;
  const canEditPortfolio =
    isPortfolioOwner ||
    callerMemberRole === "OWNER" ||
    callerMemberRole === "EDITOR";
  // Member management (invite / change role / remove) is admin-only:
  // the portfolio owner or a member whose role is OWNER — EDITORs are
  // excluded. Mirrors the members API's `canManageMembers` gate so the
  // Share dialog doesn't offer controls the API will 403.
  const canManagePortfolioMembers =
    isPortfolioOwner || callerMemberRole === "OWNER";

  // Favorite star (shared localStorage key with the Portfolios landing).
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const isFavorite = favorites.has(portfolioId);

  // List-view preferences (columns / filter / sort / group) persisted
  // per-portfolio, per-user in uiState so they survive reloads & devices.
  const { value: rawListView, setValue: setRawListView } = useUiState<
    Record<string, ListViewState>
  >("portfolioListView", {});
  const listView = normalizeListView(rawListView[portfolioId]);
  const setListView = (next: ListViewState) =>
    setRawListView((prev) => ({ ...prev, [portfolioId]: next }));

  // Shared column show/hide used by BOTH the List "Options" popover and
  // the Customize drawer's Fields section — a single source of truth so
  // toggling in one place reflects in the other and in the List columns.
  const toggleColumn = (key: ColumnKey) => {
    const isVisible = listView.columns.includes(key);
    const next = isVisible
      ? listView.columns.filter((c) => c !== key)
      : // Preserve the canonical COLUMN_DEFS order when re-adding.
        COLUMN_DEFS.filter(
          (c) => listView.columns.includes(c.key) || c.key === key
        ).map((c) => c.key);
    setListView({ ...listView, columns: next });
  };

  // Client-side text search over project names (ephemeral, not persisted).
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    fetchPortfolio();
    fetchUpdates();
  }, [portfolioId]);

  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  function toggleFavorite() {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(portfolioId)) next.delete(portfolioId);
      else next.add(portfolioId);
      saveFavorites(next);
      return next;
    });
  }

  async function fetchPortfolio() {
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}`);
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data);
        setNameDraft(data.name || "");
        setDescriptionDraft(data.description || "");
      } else if (res.status !== 404) {
        toast.error("Failed to load portfolio");
      }
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      toast.error("Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  }

  async function fetchUpdates() {
    setUpdatesLoading(true);
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/status-updates`);
      if (res.ok) {
        const data = await res.json();
        setUpdates(data);
      }
    } catch (error) {
      console.error("Error fetching updates:", error);
    } finally {
      setUpdatesLoading(false);
    }
  }

  async function savePortfolio(patch: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Save failed");
      }
      const updated = await res.json();
      setPortfolio((prev) => (prev ? { ...prev, ...updated } : prev));
      return true;
    } catch (error) {
      console.error("Error saving portfolio:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save");
      return false;
    }
  }

  async function handleNameSave() {
    if (!nameDraft.trim() || nameDraft === portfolio?.name) {
      setEditingName(false);
      setNameDraft(portfolio?.name || "");
      return;
    }
    const ok = await savePortfolio({ name: nameDraft.trim() });
    if (ok) {
      toast.success("Name updated");
      setEditingName(false);
    }
  }

  async function handleDescriptionSave() {
    if (descriptionDraft === (portfolio?.description || "")) return;
    const ok = await savePortfolio({
      description: descriptionDraft.trim() || null,
    });
    if (ok) toast.success("Description updated");
  }

  async function handleStatusChange(status: PortfolioStatus) {
    const ok = await savePortfolio({ status });
    if (ok) toast.success("Status updated");
  }

  async function handleDateChange(
    field: "startDate" | "endDate",
    value: string
  ) {
    const ok = await savePortfolio({ [field]: value || null });
    if (ok) toast.success("Date updated");
  }

  async function fetchAvailableProjects() {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        const existingIds = new Set(
          portfolio?.projects.map((p) => p.project.id) || []
        );
        setAvailableProjects(
          data.filter((p: AvailableProject) => !existingIds.has(p.id))
        );
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  }

  async function handleAddProject() {
    if (!selectedProjectId) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      if (res.ok) {
        await fetchPortfolio();
        setAddProjectOpen(false);
        setSelectedProjectId("");
        toast.success("Project added");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to add project");
      }
    } catch (error) {
      console.error("Error adding project:", error);
      toast.error("Failed to add project");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveProject(projectId: string) {
    if (!confirm("Remove this project from the portfolio?")) return;
    try {
      const res = await fetch(
        `/api/portfolios/${portfolioId}/projects?projectId=${projectId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        await fetchPortfolio();
        toast.success("Project removed");
      } else {
        toast.error("Failed to remove project");
      }
    } catch (error) {
      console.error("Error removing project:", error);
      toast.error("Failed to remove project");
    }
  }

  async function handleDeletePortfolio() {
    if (
      !confirm(
        "Are you sure you want to delete this portfolio? This action cannot be undone."
      )
    )
      return;
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Portfolio deleted");
        router.push("/portfolios");
      } else {
        toast.error("Failed to delete portfolio");
      }
    } catch (error) {
      console.error("Error deleting portfolio:", error);
      toast.error("Failed to delete portfolio");
    }
  }

  async function handlePostUpdate(
    status: PortfolioStatus,
    summary: string
  ): Promise<boolean> {
    try {
      const res = await fetch(
        `/api/portfolios/${portfolioId}/status-updates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            summary,
            syncPortfolioStatus: true,
          }),
        }
      );
      if (res.ok) {
        const created = await res.json();
        setUpdates((prev) => [created, ...prev]);
        setPortfolio((prev) => (prev ? { ...prev, status } : prev));
        toast.success("Update posted");
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to post update");
        return false;
      }
    } catch (error) {
      console.error("Error posting update:", error);
      toast.error("Failed to post update");
      return false;
    }
  }

  // ── Drag & drop ────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !portfolio || active.id === over.id) return;

    const oldIndex = portfolio.projects.findIndex((p) => p.id === active.id);
    const newIndex = portfolio.projects.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = portfolio.projects;
    const reordered = arrayMove(portfolio.projects, oldIndex, newIndex);
    setPortfolio({ ...portfolio, projects: reordered });

    try {
      const res = await fetch(
        `/api/portfolios/${portfolioId}/projects/reorder`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectIds: reordered.map((p) => p.project.id),
          }),
        }
      );
      if (!res.ok) {
        setPortfolio({ ...portfolio, projects: previous });
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to reorder");
      }
    } catch (error) {
      console.error("Error reordering:", error);
      setPortfolio({ ...portfolio, projects: previous });
      toast.error("Failed to reorder");
    }
  }

  // ── Aggregate stats ───────────────────────────────────────
  const aggregates = useMemo(() => {
    if (!portfolio) return null;
    let totalBudget = 0;
    let totalTasks = 0;
    let completedTasks = 0;
    let overdueTasks = 0;
    let activeProjects = 0;
    let atRiskCount = 0;
    let offTrackCount = 0;
    let currency = "USD";

    const byType: Record<ProjectType, number> = {
      CONSTRUCTION: 0,
      DESIGN: 0,
      RECERTIFICATION: 0,
      PERMIT: 0,
    };
    const byGate: Record<ProjectGate, number> = {
      PRE_DESIGN: 0,
      DESIGN: 0,
      PERMITTING: 0,
      CONSTRUCTION: 0,
      CLOSEOUT: 0,
    };

    for (const pp of portfolio.projects) {
      const p = pp.project;
      if (p.budget) {
        totalBudget += p.budget;
        if (p.currency) currency = p.currency;
      }
      totalTasks += p.stats.total;
      completedTasks += p.stats.completed;
      overdueTasks += p.stats.overdue;
      if (p.status !== "COMPLETE" && p.status !== "ON_HOLD")
        activeProjects += 1;
      if (p.status === "AT_RISK") atRiskCount += 1;
      if (p.status === "OFF_TRACK") offTrackCount += 1;
      if (p.type) byType[p.type] += 1;
      if (p.gate) byGate[p.gate] += 1;
    }

    return {
      totalBudget,
      currency,
      totalTasks,
      completedTasks,
      overdueTasks,
      activeProjects,
      atRiskCount,
      offTrackCount,
      avgProgress:
        totalTasks > 0
          ? Math.round((completedTasks / totalTasks) * 100)
          : 0,
      byType,
      byGate,
    };
  }, [portfolio]);

  // ── List view: derived rows ───────────────────────────────
  // Unique owners across the portfolio's projects, for the Filter popover.
  const ownerOptions = useMemo(() => {
    if (!portfolio) return [] as { id: string; name: string }[];
    const map = new Map<string, string>();
    for (const pp of portfolio.projects) {
      const o = pp.project.owner;
      if (o) map.set(o.id, o.name || "Unknown");
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [portfolio]);

  const activeFilterCount =
    listView.filter.status.length +
    listView.filter.type.length +
    listView.filter.gate.length +
    listView.filter.ownerId.length;

  // A manual drag reorder only makes sense on the unmodified list:
  // when a filter/sort/group/search is active, rows no longer map 1:1
  // to stored positions, so dnd is disabled (Asana does the same).
  const listModified =
    activeFilterCount > 0 ||
    listView.sort.key !== "manual" ||
    listView.group !== "none" ||
    search.trim().length > 0;

  const visibleRows = useMemo(() => {
    if (!portfolio) return [] as PortfolioProject[];
    const q = search.trim().toLowerCase();
    let rows = portfolio.projects.slice();

    // Filter
    const f = listView.filter;
    rows = rows.filter((pp) => {
      const p = pp.project;
      if (f.status.length && !f.status.includes(p.status)) return false;
      if (f.type.length && (!p.type || !f.type.includes(p.type))) return false;
      if (f.gate.length && (!p.gate || !f.gate.includes(p.gate))) return false;
      if (
        f.ownerId.length &&
        (!p.owner || !f.ownerId.includes(p.owner.id))
      )
        return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });

    // Sort (manual keeps the stored position order)
    if (listView.sort.key !== "manual") {
      const dir = listView.sort.dir === "desc" ? -1 : 1;
      rows.sort((a, b) => {
        const pa = a.project;
        const pb = b.project;
        let cmp = 0;
        switch (listView.sort.key) {
          case "name":
            cmp = pa.name.localeCompare(pb.name);
            break;
          case "status":
            cmp =
              STATUS_SORT_ORDER[pa.status] - STATUS_SORT_ORDER[pb.status];
            break;
          case "progress":
            cmp = pa.stats.progress - pb.stats.progress;
            break;
          case "budget":
            cmp = (pa.budget || 0) - (pb.budget || 0);
            break;
          case "due": {
            const da = pa.endDate ? new Date(pa.endDate).getTime() : Infinity;
            const db = pb.endDate ? new Date(pb.endDate).getTime() : Infinity;
            cmp = da - db;
            break;
          }
        }
        return cmp * dir;
      });
    }

    return rows;
  }, [portfolio, listView.filter, listView.sort, search]);

  // Group the visible rows into ordered sections. "none" yields a single
  // untitled section so the render path stays uniform.
  const groupedRows = useMemo(() => {
    if (listView.group === "none") {
      return [{ key: "all", label: "", rows: visibleRows }];
    }
    const buckets = new Map<string, { label: string; rows: PortfolioProject[] }>();
    const order: string[] = [];
    const ensure = (key: string, label: string) => {
      if (!buckets.has(key)) {
        buckets.set(key, { label, rows: [] });
        order.push(key);
      }
      return buckets.get(key)!;
    };
    for (const pp of visibleRows) {
      const p = pp.project;
      let key = "—";
      let label = "None";
      if (listView.group === "status") {
        key = p.status;
        label = statusMeta(p.status).label;
      } else if (listView.group === "owner") {
        key = p.owner?.id || "_none";
        label = p.owner?.name || "No owner";
      } else if (listView.group === "type") {
        key = p.type || "_none";
        label = p.type ? TYPE_META[p.type].label : "No type";
      } else if (listView.group === "gate") {
        key = p.gate || "_none";
        label = p.gate ? GATE_META[p.gate].label : "No gate";
      }
      ensure(key, label).rows.push(pp);
    }
    // Sort status groups by health order for a stable, meaningful order.
    if (listView.group === "status") {
      order.sort(
        (a, b) =>
          (STATUS_SORT_ORDER[a as PortfolioStatus] ?? 99) -
          (STATUS_SORT_ORDER[b as PortfolioStatus] ?? 99)
      );
    }
    return order.map((key) => ({
      key,
      label: buckets.get(key)!.label,
      rows: buckets.get(key)!.rows,
    }));
  }, [visibleRows, listView.group]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!portfolio || !aggregates) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-gray-500">Portfolio not found</p>
        <Button variant="link" onClick={() => router.push("/portfolios")}>
          Go back to portfolios
        </Button>
      </div>
    );
  }

  const meta = statusMeta(portfolio.status);

  const dateInputValue = (date: string | null) =>
    date ? new Date(date).toISOString().split("T")[0] : "";

  return (
    <div className="flex flex-col h-full">
      {/* ── Compact header (Asana parity) ──────────────────── */}
      <div className="border-b bg-white">
        <div className="flex items-center gap-2 px-4 md:px-6 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            onClick={() => router.push("/portfolios")}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: (portfolio.color || "#a8893a") + "20" }}
          >
            <Folder
              className="h-4 w-4"
              style={{ color: portfolio.color || "#a8893a" }}
            />
          </div>
          {editingName && canEditPortfolio ? (
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSave();
                if (e.key === "Escape") {
                  setEditingName(false);
                  setNameDraft(portfolio.name);
                }
              }}
              autoFocus
              className="h-8 text-lg md:text-xl font-semibold min-w-0 max-w-md"
            />
          ) : (
            <h1
              className={cn(
                "text-lg md:text-xl font-semibold text-black truncate rounded px-1 min-w-0",
                canEditPortfolio && "cursor-text hover:bg-gray-50"
              )}
              onClick={
                canEditPortfolio ? () => setEditingName(true) : undefined
              }
              title={canEditPortfolio ? "Click to edit" : undefined}
            >
              {portfolio.name}
            </h1>
          )}
          <button
            onClick={() => setDetailsOpen((v) => !v)}
            className="p-1 hover:bg-gray-100 rounded flex-shrink-0"
            aria-label={detailsOpen ? "Hide details" : "Show details"}
          >
            {detailsOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </button>
          <button
            onClick={toggleFavorite}
            className="p-1.5 hover:bg-gray-100 rounded flex-shrink-0"
            aria-label={isFavorite ? "Unfavorite" : "Favorite"}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star
              className={cn(
                "h-4 w-4",
                isFavorite
                  ? "fill-[#c9a84c] text-[#c9a84c]"
                  : "text-gray-400"
              )}
            />
          </button>
          {canEditPortfolio ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex flex-shrink-0">
                  <Badge className={cn(meta.chip, "cursor-pointer")}>
                    <span
                      className={cn("w-2 h-2 rounded-full mr-1.5", meta.dot)}
                    />
                    {meta.label}
                  </Badge>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {STATUS_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => handleStatusChange(opt.value)}
                  >
                    <div className={cn("h-3 w-3 rounded-full mr-2", opt.dot)} />
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Badge className={cn(meta.chip, "flex-shrink-0")}>
              <span className={cn("w-2 h-2 rounded-full mr-1.5", meta.dot)} />
              {meta.label}
            </Badge>
          )}
          <span className="text-xs text-gray-500 hidden md:inline-block flex-shrink-0">
            {portfolio._count.projects}{" "}
            {portfolio._count.projects === 1 ? "project" : "projects"}
          </span>
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="hidden md:inline-flex"
              onClick={() => setShareOpen(true)}
            >
              <UserPlus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Share</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="hidden md:inline-flex"
              onClick={() => setCustomizeOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Customize</span>
            </Button>
            {canEditPortfolio && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditingName(true)}>
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-black"
                    onClick={handleDeletePortfolio}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete portfolio
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Collapsible details (description + dates) — editable only for
            callers with edit capability; viewers get a read-only view. */}
        {detailsOpen && (
          <div className="px-4 md:px-6 pb-3 space-y-3 border-t bg-gray-50/40 pt-3">
            {canEditPortfolio ? (
              <Textarea
                value={descriptionDraft}
                onChange={(e) => setDescriptionDraft(e.target.value)}
                onBlur={handleDescriptionSave}
                placeholder="Add a description..."
                rows={2}
                className="text-sm resize-none border-dashed bg-white"
              />
            ) : portfolio.description ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {portfolio.description}
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">No description</p>
            )}
            <div className="flex flex-wrap items-center gap-3 md:gap-5 text-xs md:text-sm text-gray-600">
              <label className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">Start:</span>
                {canEditPortfolio ? (
                  <input
                    type="date"
                    value={dateInputValue(portfolio.startDate)}
                    onChange={(e) =>
                      handleDateChange("startDate", e.target.value)
                    }
                    className="bg-transparent border-b border-dashed border-gray-300 focus:border-gray-600 outline-none px-1"
                  />
                ) : (
                  <span className="text-gray-700">
                    {formatDate(portfolio.startDate)}
                  </span>
                )}
              </label>
              <label className="flex items-center gap-2">
                <span className="text-gray-500">End:</span>
                {canEditPortfolio ? (
                  <input
                    type="date"
                    value={dateInputValue(portfolio.endDate)}
                    onChange={(e) =>
                      handleDateChange("endDate", e.target.value)
                    }
                    className="bg-transparent border-b border-dashed border-gray-300 focus:border-gray-600 outline-none px-1"
                  />
                ) : (
                  <span className="text-gray-700">
                    {formatDate(portfolio.endDate)}
                  </span>
                )}
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-gray-50/50">
        <div className="px-4 md:px-6 pt-3 pb-4 md:pb-6 w-full">
          {/* Tabs directly under header (Asana style) */}
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="flex-wrap h-auto bg-transparent border-b rounded-none w-full justify-start p-0 gap-0">
              <TabsTrigger value="list">
                <ListIcon className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">List</span>
              </TabsTrigger>
              <TabsTrigger value="timeline">
                <CalendarRange className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Timeline</span>
              </TabsTrigger>
              <TabsTrigger value="panel">
                <LayoutDashboard className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Panel</span>
              </TabsTrigger>
              <TabsTrigger value="progress">
                <Activity className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Progress</span>
              </TabsTrigger>
              <TabsTrigger value="workload">
                <Users className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Workload</span>
              </TabsTrigger>
              <TabsTrigger value="messages">
                <MessageSquare className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Messages</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-4">
              <div className="bg-white rounded-lg border">
                {/* Toolbar (Asana-style: Add work + Filter/Sort/Group + Search) */}
                <div className="flex flex-wrap items-center gap-2 px-3 md:px-4 py-2.5 border-b">
                  {canEditPortfolio && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => {
                          setAddProjectOpen(true);
                          fetchAvailableProjects();
                        }}
                        className="bg-black hover:bg-gray-800"
                      >
                        <Plus className="h-4 w-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">Add project</span>
                      </Button>
                      <div className="hidden lg:block w-px h-5 bg-gray-200 mx-1" />
                    </>
                  )}
                  <ListFilterPopover
                    listView={listView}
                    setListView={setListView}
                    ownerOptions={ownerOptions}
                    activeCount={activeFilterCount}
                  />
                  <ListSortPopover
                    listView={listView}
                    setListView={setListView}
                  />
                  <ListGroupPopover
                    listView={listView}
                    setListView={setListView}
                  />
                  <ListOptionsPopover
                    listView={listView}
                    setListView={setListView}
                    toggleColumn={toggleColumn}
                  />
                  <div className="ml-auto flex items-center gap-1">
                    {searchOpen ? (
                      <div className="relative">
                        <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <Input
                          value={search}
                          autoFocus
                          onChange={(e) => setSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setSearch("");
                              setSearchOpen(false);
                            }
                          }}
                          onBlur={() => {
                            if (!search) setSearchOpen(false);
                          }}
                          placeholder="Search projects..."
                          className="h-8 w-40 md:w-56 pl-8 text-sm"
                        />
                        {search && (
                          <button
                            onClick={() => {
                              setSearch("");
                              setSearchOpen(false);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                            aria-label="Clear search"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        className="p-1.5 hover:bg-gray-100 rounded-md"
                        onClick={() => setSearchOpen(true)}
                        aria-label="Search"
                      >
                        <Search className="h-4 w-4 text-gray-500" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Active-filter summary bar */}
                {(activeFilterCount > 0 ||
                  listView.sort.key !== "manual" ||
                  listView.group !== "none") && (
                  <div className="flex flex-wrap items-center gap-2 px-3 md:px-4 py-2 border-b bg-gray-50/60 text-xs text-gray-600">
                    {activeFilterCount > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Filter className="h-3 w-3" />
                        {activeFilterCount}{" "}
                        {activeFilterCount === 1 ? "filter" : "filters"}
                      </span>
                    )}
                    {listView.sort.key !== "manual" && (
                      <span className="inline-flex items-center gap-1">
                        <ArrowUpDown className="h-3 w-3" />
                        Sorted by {SORT_LABELS[listView.sort.key]}
                      </span>
                    )}
                    {listView.group !== "none" && (
                      <span className="inline-flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        Grouped by {GROUP_LABELS[listView.group]}
                      </span>
                    )}
                    <span className="text-gray-400">·</span>
                    <span className="tabular-nums">
                      {visibleRows.length} of {portfolio.projects.length}
                    </span>
                    <button
                      onClick={() =>
                        setListView({
                          ...listView,
                          filter: {
                            status: [],
                            type: [],
                            gate: [],
                            ownerId: [],
                          },
                          sort: { key: "manual", dir: "asc" },
                          group: "none",
                        })
                      }
                      className="text-[#a8893a] hover:underline ml-1"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {portfolio.projects.length === 0 ? (
                  <EmptyProjects
                    canAdd={canEditPortfolio}
                    onAdd={() => {
                      setAddProjectOpen(true);
                      fetchAvailableProjects();
                    }}
                  />
                ) : visibleRows.length === 0 ? (
                  <div className="py-16 text-center text-sm text-gray-500">
                    No projects match your filters or search.
                  </div>
                ) : (
                  <div>
                    {/* Column header */}
                    <ListColumnHeader columns={listView.columns} />

                    {/* Grouped, non-draggable render when list is modified */}
                    {listModified
                      ? groupedRows.map((g) => (
                          <div key={g.key}>
                            {g.label && (
                              <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-gray-50/80 border-b text-xs font-medium text-gray-600">
                                {g.label}
                                <span className="text-gray-400 tabular-nums">
                                  {g.rows.length}
                                </span>
                              </div>
                            )}
                            {g.rows.map((pp) => (
                              <ProjectRow
                                key={pp.id}
                                pp={pp}
                                columns={listView.columns}
                                canEdit={canEditPortfolio}
                                onClick={() =>
                                  router.push(`/projects/${pp.project.id}`)
                                }
                                onRemove={() =>
                                  handleRemoveProject(pp.project.id)
                                }
                              />
                            ))}
                          </div>
                        ))
                      : (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext
                            items={portfolio.projects.map((p) => p.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div>
                              {portfolio.projects.map((pp) => (
                                <SortableProjectRow
                                  key={pp.id}
                                  pp={pp}
                                  columns={listView.columns}
                                  canEdit={canEditPortfolio}
                                  onClick={() =>
                                    router.push(`/projects/${pp.project.id}`)
                                  }
                                  onRemove={() =>
                                    handleRemoveProject(pp.project.id)
                                  }
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="mt-4">
              {portfolio.projects.length === 0 ? (
                <EmptyState
                  title="No projects to plot"
                  message="Add projects with start and end dates to see them on the timeline."
                  canAdd={canEditPortfolio}
                  onAdd={() => {
                    setAddProjectOpen(true);
                    fetchAvailableProjects();
                  }}
                />
              ) : (
                <PortfolioTimelineView projects={portfolio.projects} />
              )}
            </TabsContent>

            <TabsContent value="panel" className="mt-4">
              <PortfolioPanelView
                projects={portfolio.projects}
                totalBudget={aggregates.totalBudget}
                currency={aggregates.currency}
                totalTasks={aggregates.totalTasks}
                completedTasks={aggregates.completedTasks}
                overdueTasks={aggregates.overdueTasks}
                atRiskCount={aggregates.atRiskCount}
                avgProgress={aggregates.avgProgress}
                activeProjects={aggregates.activeProjects}
                projectCount={portfolio._count.projects}
                byType={aggregates.byType}
                byGate={aggregates.byGate}
              />
            </TabsContent>

            <TabsContent value="progress" className="mt-4">
              <PortfolioProgressView
                portfolioId={portfolioId}
                status={portfolio.status}
                portfolioName={portfolio.name}
                description={portfolio.description}
                owner={portfolio.owner}
                endDate={portfolio.endDate}
                inProgress={aggregates.activeProjects}
                atRisk={aggregates.atRiskCount}
                offTrack={aggregates.offTrackCount}
                total={portfolio._count.projects}
                updates={updates}
                updatesLoading={updatesLoading}
                onPost={handlePostUpdate}
              />
            </TabsContent>

            <TabsContent value="workload" className="mt-4">
              {portfolio.projects.length === 0 ? (
                <EmptyState
                  title="No workload to show"
                  message="Add projects to see assignee workload across this portfolio."
                  canAdd={canEditPortfolio}
                  onAdd={() => {
                    setAddProjectOpen(true);
                    fetchAvailableProjects();
                  }}
                />
              ) : (
                <PortfolioWorkloadView
                  portfolioId={portfolioId}
                  projectCount={portfolio._count.projects}
                />
              )}
            </TabsContent>

            <TabsContent value="messages" className="mt-4">
              {/* Bounded, full-height flex box so MessagesView's flex-1
                  layout fills the viewport and its composer pins to the
                  bottom (without a bounded parent, flex-1 collapses to
                  content height and the composer floats mid-screen). */}
              <div className="h-[calc(100vh-13rem)] min-h-[440px] flex flex-col overflow-hidden rounded-lg border bg-white">
                <MessagesView
                  scope={{ type: "portfolio", portfolioId }}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Add Project Dialog */}
      <Dialog open={addProjectOpen} onOpenChange={setAddProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add project to portfolio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {availableProjects.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 text-center">
                    No available projects
                  </div>
                ) : (
                  availableProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: project.color }}
                        />
                        {project.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              className="w-full bg-black hover:bg-gray-800"
              onClick={handleAddProject}
              disabled={adding || !selectedProjectId}
            >
              {adding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add project"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share modal */}
      <PortfolioShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        portfolioId={portfolioId}
        portfolioName={portfolio.name}
        privacy={portfolio.privacy}
        ownerId={portfolio.ownerId}
        canEdit={canEditPortfolio}
        canManageMembers={canManagePortfolioMembers}
        isOwner={isPortfolioOwner}
        onPrivacyChange={(privacy) =>
          setPortfolio((prev) => (prev ? { ...prev, privacy } : prev))
        }
      />

      {/* Customize drawer */}
      <PortfolioCustomizeDrawer
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        canEdit={canEditPortfolio}
        columns={listView.columns}
        columnDefs={COLUMN_DEFS}
        onToggleColumn={toggleColumn}
        name={portfolio.name}
        description={portfolio.description}
        color={portfolio.color}
        icon={portfolio.icon}
        privacy={portfolio.privacy}
        onSave={savePortfolio}
      />
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────

// Small trigger button for the list toolbar popovers. Mirrors the
// old ToolbarChip look but exposes an active state + optional count.
// Forwards ref + props so it can be a Radix PopoverTrigger `asChild`
// target directly (no wrapper div → no nested-button).
const ToolbarChipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    count?: number;
  }
>(function ToolbarChipTrigger(
  { icon, label, active, count, className, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
        active
          ? "bg-gray-900 text-white hover:bg-gray-800"
          : "text-gray-700 hover:bg-gray-100",
        className
      )}
      {...props}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {count ? (
        <span
          className={cn(
            "ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] tabular-nums",
            active ? "bg-white/25 text-white" : "bg-gray-200 text-gray-700"
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
});

function EmptyProjects({
  onAdd,
  canAdd = true,
}: {
  onAdd: () => void;
  canAdd?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Folder className="h-8 w-8 text-gray-400" />
      </div>
      <h2 className="text-base font-medium text-black mb-2">
        No projects in this portfolio
      </h2>
      <p className="text-sm text-gray-500 max-w-md mb-4">
        Add projects to track their progress, budget, and health together.
      </p>
      {canAdd && (
        <Button onClick={onAdd} className="bg-black hover:bg-gray-800">
          <Plus className="h-4 w-4 mr-2" />
          Add project
        </Button>
      )}
    </div>
  );
}

function EmptyState({
  title,
  message,
  onAdd,
  canAdd = true,
}: {
  title: string;
  message: string;
  onAdd: () => void;
  canAdd?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border p-12 text-center">
      <h3 className="text-base font-medium text-black mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">{message}</p>
      {canAdd && (
        <Button onClick={onAdd} className="bg-black hover:bg-gray-800" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add project
        </Button>
      )}
    </div>
  );
}

// ── List column header ──────────────────────────────────────

function ListColumnHeader({ columns }: { columns: ColumnKey[] }) {
  return (
    <div
      className="hidden md:grid gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50"
      style={{ gridTemplateColumns: gridTemplateFor(columns) }}
    >
      <div>Name</div>
      {columns.map((key) => {
        const def = COLUMN_DEFS.find((c) => c.key === key)!;
        return <div key={key}>{def.label}</div>;
      })}
      <div />
    </div>
  );
}

// Render a single data cell for the given column key.
function ProjectDataCell({
  columnKey,
  p,
}: {
  columnKey: ColumnKey;
  p: Project;
}) {
  switch (columnKey) {
    case "type":
      return p.type ? (
        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-medium">
          {TYPE_META[p.type].short}
        </span>
      ) : (
        <span className="text-gray-300 text-xs">—</span>
      );
    case "gate":
      return (
        <div className="text-xs text-gray-700 truncate">
          {p.gate ? GATE_META[p.gate].label : "—"}
        </div>
      );
    case "status": {
      const m = statusMeta(p.status);
      return <Badge className={cn(m.chip, "text-xs")}>{m.label}</Badge>;
    }
    case "progress":
      return (
        <div className="flex items-center gap-2">
          <Progress value={p.stats.progress} className="h-1.5 flex-1" />
          <span className="text-xs text-gray-600 w-9 tabular-nums">
            {p.stats.progress}%
          </span>
        </div>
      );
    case "due":
      return (
        <div className="text-xs text-gray-700 truncate flex items-center gap-1.5">
          {p.startDate || p.endDate ? (
            <>
              <Calendar className="h-3 w-3 text-gray-400 flex-shrink-0" />
              <span>
                {formatDate(p.startDate)} – {formatDate(p.endDate)}
              </span>
            </>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </div>
      );
    case "budget":
      return (
        <div className="text-xs text-gray-700 tabular-nums truncate">
          {formatBudget(p.budget, p.currency)}
        </div>
      );
    case "owner":
      return (
        <Avatar className="h-6 w-6">
          <AvatarImage src={p.owner?.image || ""} />
          <AvatarFallback className="text-xs bg-gray-200">
            {p.owner?.name?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
      );
  }
}

// Shared row body used by both the draggable and the static (grouped /
// sorted) rows. `dragHandle` is injected only in the sortable variant.
function ProjectRowBody({
  pp,
  columns,
  onRemove,
  dragHandle,
  canEdit = true,
}: {
  pp: PortfolioProject;
  columns: ColumnKey[];
  onRemove: () => void;
  dragHandle?: React.ReactNode;
  canEdit?: boolean;
}) {
  const p = pp.project;
  const m = statusMeta(p.status);
  return (
    <>
      {/* Desktop grid */}
      <div
        className="hidden md:grid gap-4 px-4 py-3 items-center"
        style={{ gridTemplateColumns: gridTemplateFor(columns) }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {dragHandle}
          <div
            className="w-3 h-3 rounded flex-shrink-0"
            style={{ backgroundColor: p.color }}
          />
          <span className="font-medium text-black truncate">{p.name}</span>
        </div>
        {columns.map((key) => (
          <div key={key} className="min-w-0">
            <ProjectDataCell columnKey={key} p={p} />
          </div>
        ))}
        <div className="flex justify-end">
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-black"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove from portfolio
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Mobile compact row */}
      <div className="md:hidden px-3 py-3 flex items-center gap-3">
        {dragHandle}
        <div
          className="w-3 h-3 rounded flex-shrink-0"
          style={{ backgroundColor: p.color }}
        />
        <div className="flex-1 min-w-0">
          <span className="font-medium text-black truncate text-sm block">
            {p.name}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <Progress
              value={p.stats.progress}
              className="h-1.5 flex-1 max-w-[100px]"
            />
            <span className="text-[11px] text-gray-500 tabular-nums">
              {p.stats.progress}%
            </span>
            <Badge className={cn("text-[10px] px-1.5 py-0", m.chip)}>
              {m.label}
            </Badge>
          </div>
        </div>
        <Avatar className="h-6 w-6 flex-shrink-0">
          <AvatarImage src={p.owner?.image || ""} />
          <AvatarFallback className="text-xs bg-gray-200">
            {p.owner?.name?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-black"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove from portfolio
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </>
  );
}

// Static (non-draggable) row — used when the list is filtered / sorted
// / grouped / searched, where manual reorder is disabled.
function ProjectRow({
  pp,
  columns,
  onClick,
  onRemove,
  canEdit = true,
}: {
  pp: PortfolioProject;
  columns: ColumnKey[];
  onClick: () => void;
  onRemove: () => void;
  canEdit?: boolean;
}) {
  return (
    <div
      className="border-b last:border-0 hover:bg-gray-50 cursor-pointer group bg-white"
      onClick={onClick}
    >
      <ProjectRowBody
        pp={pp}
        columns={columns}
        onRemove={onRemove}
        canEdit={canEdit}
      />
    </div>
  );
}

function SortableProjectRow({
  pp,
  columns,
  onClick,
  onRemove,
  canEdit = true,
}: {
  pp: PortfolioProject;
  columns: ColumnKey[];
  onClick: () => void;
  onRemove: () => void;
  canEdit?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pp.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b last:border-0 hover:bg-gray-50 cursor-pointer group bg-white",
        isDragging && "shadow-lg"
      )}
      onClick={onClick}
    >
      <ProjectRowBody
        pp={pp}
        columns={columns}
        onRemove={onRemove}
        canEdit={canEdit}
        dragHandle={
          canEdit ? (
            <button
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              className="touch-none cursor-grab active:cursor-grabbing md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1 -ml-1 text-gray-400 hover:text-gray-700"
              aria-label="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : undefined
        }
      />
    </div>
  );
}

// ── List toolbar popovers ───────────────────────────────────

function CheckRow({
  checked,
  label,
  onToggle,
  dot,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  dot?: string;
}) {
  // Presentational checkbox (not a Radix control) so the row's own
  // button owns the click and there's no controlled-input warning.
  return (
    <button
      type="button"
      onClick={onToggle}
      role="checkbox"
      aria-checked={checked}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 text-left"
    >
      <span
        className={cn(
          "flex items-center justify-center size-4 shrink-0 rounded-[4px] border transition-colors",
          checked
            ? "bg-gray-900 border-gray-900 text-white"
            : "border-gray-300 bg-white"
        )}
      >
        {checked && <Check className="size-3" />}
      </span>
      {dot && <span className={cn("w-2 h-2 rounded-full", dot)} />}
      <span className="text-sm text-gray-800 flex-1">{label}</span>
    </button>
  );
}

function ListFilterPopover({
  listView,
  setListView,
  ownerOptions,
  activeCount,
}: {
  listView: ListViewState;
  setListView: (v: ListViewState) => void;
  ownerOptions: { id: string; name: string }[];
  activeCount: number;
}) {
  const f = listView.filter;
  const toggle = <K extends keyof ListViewState["filter"]>(
    key: K,
    value: ListViewState["filter"][K][number]
  ) => {
    const arr = f[key] as string[];
    const next = arr.includes(value as string)
      ? arr.filter((v) => v !== value)
      : [...arr, value as string];
    setListView({ ...listView, filter: { ...f, [key]: next } });
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ToolbarChipTrigger
          icon={<Filter className="h-3.5 w-3.5" />}
          label="Filter"
          active={activeCount > 0}
          count={activeCount || undefined}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3 max-h-[70vh] overflow-y-auto">
        <div className="space-y-3">
          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Status
            </div>
            {STATUS_OPTIONS.map((o) => (
              <CheckRow
                key={o.value}
                checked={f.status.includes(o.value)}
                label={o.label}
                dot={o.dot}
                onToggle={() => toggle("status", o.value)}
              />
            ))}
          </div>
          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Type
            </div>
            {(Object.keys(TYPE_META) as ProjectType[]).map((t) => (
              <CheckRow
                key={t}
                checked={f.type.includes(t)}
                label={TYPE_META[t].label}
                onToggle={() => toggle("type", t)}
              />
            ))}
          </div>
          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Gate
            </div>
            {(Object.keys(GATE_META) as ProjectGate[]).map((g) => (
              <CheckRow
                key={g}
                checked={f.gate.includes(g)}
                label={GATE_META[g].label}
                onToggle={() => toggle("gate", g)}
              />
            ))}
          </div>
          {ownerOptions.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Owner
              </div>
              {ownerOptions.map((o) => (
                <CheckRow
                  key={o.id}
                  checked={f.ownerId.includes(o.id)}
                  label={o.name}
                  onToggle={() => toggle("ownerId", o.id)}
                />
              ))}
            </div>
          )}
          {activeCount > 0 && (
            <button
              onClick={() =>
                setListView({
                  ...listView,
                  filter: { status: [], type: [], gate: [], ownerId: [] },
                })
              }
              className="w-full text-center text-xs text-[#a8893a] hover:underline pt-1"
            >
              Clear all filters
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ListSortPopover({
  listView,
  setListView,
}: {
  listView: ListViewState;
  setListView: (v: ListViewState) => void;
}) {
  const options: { key: SortKey; label: string }[] = [
    { key: "manual", label: "Manual (drag order)" },
    { key: "name", label: "Name" },
    { key: "status", label: "Status" },
    { key: "progress", label: "Progress" },
    { key: "due", label: "Due date" },
    { key: "budget", label: "Budget" },
  ];
  const active = listView.sort.key !== "manual";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ToolbarChipTrigger
          icon={<ArrowUpDown className="h-3.5 w-3.5" />}
          label="Sort"
          active={active}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="space-y-0.5">
          {options.map((o) => {
            const isActive = listView.sort.key === o.key;
            return (
              <button
                key={o.key}
                onClick={() =>
                  setListView({
                    ...listView,
                    sort: {
                      key: o.key,
                      dir: isActive ? listView.sort.dir : "asc",
                    },
                  })
                }
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm hover:bg-gray-100",
                  isActive && "bg-gray-50 font-medium"
                )}
              >
                {isActive ? (
                  <Check className="h-3.5 w-3.5 text-[#a8893a]" />
                ) : (
                  <span className="w-3.5" />
                )}
                {o.label}
              </button>
            );
          })}
          {active && (
            <div className="border-t mt-1 pt-1 flex gap-1">
              <button
                onClick={() =>
                  setListView({
                    ...listView,
                    sort: { ...listView.sort, dir: "asc" },
                  })
                }
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs hover:bg-gray-100",
                  listView.sort.dir === "asc" && "bg-gray-100 font-medium"
                )}
              >
                <ArrowUp className="h-3.5 w-3.5" /> Ascending
              </button>
              <button
                onClick={() =>
                  setListView({
                    ...listView,
                    sort: { ...listView.sort, dir: "desc" },
                  })
                }
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs hover:bg-gray-100",
                  listView.sort.dir === "desc" && "bg-gray-100 font-medium"
                )}
              >
                <ArrowDown className="h-3.5 w-3.5" /> Descending
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ListGroupPopover({
  listView,
  setListView,
}: {
  listView: ListViewState;
  setListView: (v: ListViewState) => void;
}) {
  const options: { key: GroupKey; label: string }[] = [
    { key: "none", label: "None" },
    { key: "status", label: "Status" },
    { key: "owner", label: "Owner" },
    { key: "type", label: "Type" },
    { key: "gate", label: "Gate" },
  ];
  const active = listView.group !== "none";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ToolbarChipTrigger
          icon={<Layers className="h-3.5 w-3.5" />}
          label="Group"
          active={active}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-2">
        <div className="space-y-0.5">
          {options.map((o) => {
            const isActive = listView.group === o.key;
            return (
              <button
                key={o.key}
                onClick={() => setListView({ ...listView, group: o.key })}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm hover:bg-gray-100",
                  isActive && "bg-gray-50 font-medium"
                )}
              >
                {isActive ? (
                  <Check className="h-3.5 w-3.5 text-[#a8893a]" />
                ) : (
                  <span className="w-3.5" />
                )}
                {o.label}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ListOptionsPopover({
  listView,
  setListView,
  toggleColumn,
}: {
  listView: ListViewState;
  setListView: (v: ListViewState) => void;
  toggleColumn: (key: ColumnKey) => void;
}) {
  const isVisible = (key: ColumnKey) => listView.columns.includes(key);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ToolbarChipTrigger
          icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
          label="Options"
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-3">
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Columns
        </div>
        <div className="space-y-0.5">
          {COLUMN_DEFS.map((def) => (
            <CheckRow
              key={def.key}
              checked={isVisible(def.key)}
              label={def.label}
              onToggle={() => toggleColumn(def.key)}
            />
          ))}
        </div>
        <button
          onClick={() =>
            setListView({ ...listView, columns: DEFAULT_COLUMNS })
          }
          className="w-full text-center text-xs text-[#a8893a] hover:underline pt-2"
        >
          Reset columns
        </button>
      </PopoverContent>
    </Popover>
  );
}
