"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Target,
  Loader2,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Filter,
  Settings,
  User,
  Users,
  List,
  LayoutGrid,
  Kanban,
  Network,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GoalsCardsView } from "@/components/goals/views/goals-cards-view";
import { GoalsKanbanView } from "@/components/goals/views/goals-kanban-view";
import { GoalsTreeView } from "@/components/goals/views/goals-tree-view";
import {
  GOAL_TEMPLATES,
  GOAL_TEMPLATE_CATEGORY_LABEL,
  type GoalTemplate,
} from "@/lib/goal-templates-data";

interface KeyResult {
  id: string;
  name: string;
  targetValue: number;
  currentValue: number;
  startValue: number;
  unit: string | null;
}

interface Objective {
  id: string;
  name: string;
  description: string | null;
  status: string;
  progress: number;
  period: string | null;
  confidenceScore?: number | null;
  lastCheckInAt?: string | null;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
  };
  team: {
    id: string;
    name: string;
  } | null;
  keyResults: KeyResult[];
  children: {
    id: string;
    name: string;
    status: string;
    progress: number;
  }[];
  _count: {
    keyResults: number;
    projects?: number;
    children: number;
  };
  parentId?: string | null;
}

/**
 * Two-axis navigation for the Goals listing:
 *   - FilterMode: scope of which goals to show
 *   - ViewType: how to render the same dataset (list / kanban / cards / tree)
 *
 * The strategy-map onboarding flow is kept as a special pre-empty state
 * when ViewType="tree" AND there are zero goals; once at least one goal
 * exists, the tree view renders the real hierarchy.
 */
type FilterMode = "all" | "my" | "team";
type ViewType = "list" | "kanban" | "cards" | "tree";

const VIEW_STORAGE_KEY = "goals.view";
const FILTER_STORAGE_KEY = "goals.filter";

const PERIODS = [
  "All",
  "Q1 FY26",
  "Q2 FY26",
  "Q3 FY26",
  "Q4 FY26",
  "H1 FY26",
  "H2 FY26",
  "FY26",
];

export default function GoalsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [selectedView, setSelectedView] = useState<ViewType>("list");
  const [selectedPeriod, setSelectedPeriod] = useState("All");
  // Template-aware create state. When `pendingTemplate` is set, the
  // dialog pre-fills name + creates KRs from the template payload.
  const [pendingTemplate, setPendingTemplate] = useState<GoalTemplate | null>(
    null
  );
  const [newObjective, setNewObjective] = useState({
    name: "",
    period: "Q1 FY26",
  });

  // Strategy map onboarding state — only used when tree view + empty list.
  const [showStrategyOnboarding, setShowStrategyOnboarding] = useState(true);

  // Restore the user's last view + filter choice on mount. Stored in
  // localStorage so the view sticks across navigation, not just tab
  // switches inside this page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedView = localStorage.getItem(VIEW_STORAGE_KEY) as ViewType | null;
    if (storedView && ["list", "kanban", "cards", "tree"].includes(storedView)) {
      setSelectedView(storedView);
    }
    const storedFilter = localStorage.getItem(FILTER_STORAGE_KEY) as FilterMode | null;
    if (storedFilter && ["all", "my", "team"].includes(storedFilter)) {
      setFilterMode(storedFilter);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(VIEW_STORAGE_KEY, selectedView);
  }, [selectedView]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(FILTER_STORAGE_KEY, filterMode);
  }, [filterMode]);

  useEffect(() => {
    const controller = new AbortController();
    fetchObjectives(controller.signal);
    return () => controller.abort();
    // Re-fetch whenever filter OR period changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMode, selectedPeriod]);

  async function fetchObjectives(signal?: AbortSignal) {
    try {
      const params = new URLSearchParams();
      params.set("parentId", "null");
      // "team" mode = list goals tied to a team (not just my own). The
      // listing endpoint already scopes by workspace; "all" leaves the
      // query unscoped beyond that.
      if (filterMode === "my") params.set("ownerId", "me");
      if (selectedPeriod && selectedPeriod !== "All") {
        params.set("period", selectedPeriod);
      }

      const res = await fetch(`/api/objectives?${params}`, { signal });
      if (res.ok) {
        const data = await res.json();
        // Team-only filter is client-side because the API doesn't
        // accept "any team" as a query param.
        const filtered =
          filterMode === "team"
            ? (data as Objective[]).filter((o) => o.team)
            : (data as Objective[]);
        setObjectives(filtered);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Error fetching objectives:", error);
      toast.error("Failed to load objectives");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Single create flow used by both Blank goal and Template paths.
   * When `template` is provided, the API receives the KRs in the same
   * POST and creates them transactionally.
   */
  async function handleCreate(template?: GoalTemplate | null) {
    const tpl = template ?? pendingTemplate;
    const name = tpl ? tpl.objective.name : newObjective.name;
    if (!name.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: tpl?.objective.description,
          period: newObjective.period,
          progressSource: tpl?.objective.progressSource ?? "KEY_RESULTS",
          keyResults: tpl?.keyResults,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const objective = await res.json();
      setObjectives([objective, ...objectives]);
      setCreateOpen(false);
      setNewObjective({ name: "", period: "Q1 FY26" });
      // Close dialog first, then navigate — the redirect was happening while
      // the dialog was still mounted, which caused an awkward double-layer.
      router.push(`/goals/${objective.id}`);
    } catch (error) {
      console.error("Error creating objective:", error);
      toast.error("Couldn't create goal — check your connection and try again");
    } finally {
      setCreating(false);
    }
  }

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ON_TRACK":
        return "bg-[#c9a84c]";
      case "AT_RISK":
        return "bg-[#a8893a]";
      case "OFF_TRACK":
        return "bg-black";
      case "ACHIEVED":
        return "bg-[#c9a84c]";
      default:
        return "bg-gray-400";
    }
  };

  const cyclePeriod = (direction: "prev" | "next") => {
    const currentIndex = PERIODS.indexOf(selectedPeriod);
    if (direction === "prev" && currentIndex > 0) {
      setSelectedPeriod(PERIODS[currentIndex - 1]);
    } else if (direction === "next" && currentIndex < PERIODS.length - 1) {
      setSelectedPeriod(PERIODS[currentIndex + 1]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-black" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b">
        <h1 className="text-lg md:text-xl font-semibold text-black">Goals</h1>
        <Button
          variant="ghost"
          size="sm"
          className="text-black text-xs md:text-sm"
          onClick={() => window.open('mailto:feedback@ttcivilstructural.com?subject=Goals%20Feedback', '_blank')}
        >
          Send feedback
        </Button>
      </div>

      {/* Filter pills (replace old tabs) */}
      <div className="flex items-center gap-1 px-4 md:px-6 border-b overflow-x-auto">
        {(
          [
            { id: "all" as FilterMode, label: "All goals", icon: Target },
            { id: "my" as FilterMode, label: "My goals", icon: User },
            { id: "team" as FilterMode, label: "Team goals", icon: Users },
          ] as const
        ).map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              onClick={() => setFilterMode(opt.id)}
              className={cn(
                "px-3 md:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5",
                filterMode === opt.id
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:text-black"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-6 py-3 border-b bg-white">
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          {/* Create Goal — split button with Templates dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="bg-black hover:bg-gray-900 text-white"
              >
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">New goal</span>
                <ChevronDown className="w-3 h-3 ml-1 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem
                onClick={() => {
                  setPendingTemplate(null);
                  setCreateOpen(true);
                }}
              >
                <Target className="w-4 h-4 mr-2 text-gray-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Blank goal</p>
                  <p className="text-[11px] text-gray-500">
                    Start from scratch
                  </p>
                </div>
              </DropdownMenuItem>
              <div className="border-t my-1" />
              <div className="px-2 py-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Engineering templates
                </p>
              </div>
              {GOAL_TEMPLATES.map((tpl) => (
                <DropdownMenuItem
                  key={tpl.id}
                  onClick={() => {
                    setPendingTemplate(tpl);
                    handleCreate(tpl);
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {tpl.name}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {GOAL_TEMPLATE_CATEGORY_LABEL[tpl.category]} ·{" "}
                      {tpl.keyResults.length} KRs
                    </p>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Period Selector */}
          <div className="flex items-center bg-white border rounded-md">
            <button
              onClick={() => cyclePeriod("prev")}
              className="p-1.5 hover:bg-white rounded-l-md border-r"
              aria-label="Previous period"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-2 md:px-3 py-1.5 text-xs md:text-sm bg-transparent border-none outline-none cursor-pointer max-w-[120px] md:max-w-none"
            >
              {PERIODS.map((period) => (
                <option key={period} value={period}>
                  {period}
                </option>
              ))}
            </select>
            <button
              onClick={() => cyclePeriod("next")}
              className="p-1.5 hover:bg-white rounded-r-md border-l"
              aria-label="Next period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2 flex-wrap">
          {/* View switcher — 4 buttons. Same data, opinionated layouts. */}
          <div className="hidden sm:flex items-center bg-white border rounded-md overflow-hidden">
            {(
              [
                { id: "list" as ViewType, icon: List, label: "List" },
                { id: "kanban" as ViewType, icon: Kanban, label: "Kanban" },
                { id: "cards" as ViewType, icon: LayoutGrid, label: "Cards" },
                { id: "tree" as ViewType, icon: Network, label: "Tree" },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => setSelectedView(opt.id)}
                  aria-label={opt.label}
                  title={opt.label}
                  className={cn(
                    "p-1.5 transition-colors",
                    selectedView === opt.id
                      ? "bg-black text-white"
                      : "text-gray-500 hover:text-black hover:bg-gray-50"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>

          {/* Filter & Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-black px-2 md:px-3">
                <Filter className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Filter</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setSelectedPeriod("All")}>
                All periods
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterMode("my")}>
                My goals only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterMode("team")}>
                Team goals only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterMode("all")}>
                Reset (all goals)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-black px-2 md:px-3">
                <Settings className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => {
                setExpandedIds(new Set(objectives.map(o => o.id)));
              }}>
                Expand all
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setExpandedIds(new Set())}>
                Collapse all
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content — dispatch on selectedView. Strategy-map onboarding
          flow only shows for the tree view when the list is empty. */}
      <div className="flex-1 overflow-auto">
        {selectedView === "tree" &&
        showStrategyOnboarding &&
        objectives.length === 0 ? (
          <StrategyMapView
            objectives={objectives}
            showOnboarding={true}
            onCreateGoal={async (name?: string) => {
              if (name) {
                try {
                  const res = await fetch("/api/objectives", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name,
                      period: "Q1 FY26",
                      progressSource: "KEY_RESULTS",
                    }),
                  });
                  if (res.ok) {
                    const objective = await res.json();
                    setObjectives([objective, ...objectives]);
                    setShowStrategyOnboarding(false);
                    router.push(`/goals/${objective.id}`);
                  }
                } catch (error) {
                  console.error("Error creating goal:", error);
                }
              } else {
                setCreateOpen(true);
              }
            }}
            onSkipOnboarding={() => setShowStrategyOnboarding(false)}
          />
        ) : selectedView === "kanban" ? (
          <GoalsKanbanView
            objectives={objectives}
            onStatusChange={() => fetchObjectives()}
          />
        ) : selectedView === "cards" ? (
          <GoalsCardsView objectives={objectives} />
        ) : selectedView === "tree" ? (
          <GoalsTreeView objectives={objectives} />
        ) : (
          /* default: list */
          <GoalsListView
            objectives={objectives}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
            onRowClick={(id) => router.push(`/goals/${id}`)}
            onCreateGoal={() => setCreateOpen(true)}
            getStatusColor={getStatusColor}
          />
        )}
      </div>

      {/* Create Goal Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Goal name <span className="text-black">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Launch new product initiative"
                value={newObjective.name}
                onChange={(e) =>
                  setNewObjective({ ...newObjective, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period">Time period</Label>
              <Select
                value={newObjective.period}
                onValueChange={(value) =>
                  setNewObjective({ ...newObjective, period: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.filter((p) => p !== "All").map((period) => (
                    <SelectItem key={period} value={period}>
                      {period}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full bg-black hover:bg-black"
              onClick={() => handleCreate()}
              disabled={creating || !newObjective.name.trim()}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create goal"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Goals List View Component
function GoalsListView({
  objectives,
  expandedIds,
  onToggleExpand,
  onRowClick,
  onCreateGoal,
  getStatusColor,
}: {
  objectives: Objective[];
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onRowClick: (id: string) => void;
  onCreateGoal: () => void;
  getStatusColor: (status: string) => string;
}) {
  const columns = [
    { id: "name", label: "Name", className: "flex-1" },
    { id: "status", label: "Status", className: "w-[80px]" },
    { id: "progress", label: "Progress", className: "w-[140px]" },
    { id: "period", label: "Period", className: "w-[100px]" },
    { id: "team", label: "Responsible team", className: "w-[140px]" },
    { id: "owner", label: "Owner", className: "w-[80px]" },
  ];

  if (objectives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16">
        <div className="w-16 h-16 bg-white border border-black rounded-full flex items-center justify-center mb-4">
          <Target className="h-8 w-8 text-black" />
        </div>
        <h3 className="text-lg font-medium text-black mb-2">No goals yet</h3>
        <p className="text-sm text-black text-center max-w-sm mb-4">
          Create goals to track your objectives and key results.
        </p>
        <Button
          onClick={onCreateGoal}
          className="bg-black hover:bg-black"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create your first goal
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Column Headers */}
      <div className="hidden md:flex items-center border-b pb-2 text-xs font-medium text-black uppercase tracking-wide">
        {columns.map((col) => (
          <div
            key={col.id}
            className={cn("px-3 flex items-center gap-1", col.className)}
          >
            {col.label}
            <ChevronDown className="w-3 h-3" />
          </div>
        ))}
        <div className="w-10">
          <Plus className="w-4 h-4 text-black" />
        </div>
      </div>

      {/* Goals List */}
      <div className="divide-y">
        {objectives.map((objective) => (
          <div key={objective.id}>
            {/* Desktop row */}
            <div
              className="hidden md:flex items-center py-3 hover:bg-white cursor-pointer group"
              onClick={() => onRowClick(objective.id)}
            >
              {/* Name */}
              <div className="flex-1 px-3 flex items-center gap-2">
                {(objective._count.keyResults > 0 ||
                  objective._count.children > 0) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleExpand(objective.id);
                    }}
                    className="p-1 hover:bg-white rounded"
                  >
                    {expandedIds.has(objective.id) ? (
                      <ChevronDown className="h-4 w-4 text-black" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-black" />
                    )}
                  </button>
                )}
                <span className="text-sm text-black">{objective.name}</span>
              </div>

              {/* Status */}
              <div className="w-[80px] px-3">
                <div
                  className={cn(
                    "w-3 h-3 rounded-full",
                    getStatusColor(objective.status)
                  )}
                />
              </div>

              {/* Progress */}
              <div className="w-[140px] px-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-white border border-black rounded-full overflow-hidden">
                    <div
                      className="h-full bg-black rounded-full transition-all"
                      style={{ width: `${objective.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-black w-8">
                    {objective.progress}%
                  </span>
                </div>
              </div>

              {/* Period */}
              <div className="w-[100px] px-3">
                <span className="text-sm text-black">
                  {objective.period || "-"}
                </span>
              </div>

              {/* Team */}
              <div className="w-[140px] px-3">
                <span className="text-sm text-black">
                  {objective.team?.name || "-"}
                </span>
              </div>

              {/* Owner */}
              <div className="w-[80px] px-3">
                {objective.owner ? (
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={objective.owner.image || ""} />
                    <AvatarFallback className="text-xs bg-white border border-black">
                      {objective.owner.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-dashed border-slate-300" />
                )}
              </div>

              {/* Add Column */}
              <div className="w-10" />
            </div>

            {/* Mobile card */}
            <div
              className="flex md:hidden items-center gap-3 py-3 px-3 hover:bg-gray-50 cursor-pointer"
              onClick={() => onRowClick(objective.id)}
            >
              {(objective._count.keyResults > 0 ||
                objective._count.children > 0) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(objective.id);
                  }}
                  className="p-1 hover:bg-white rounded flex-shrink-0"
                >
                  {expandedIds.has(objective.id) ? (
                    <ChevronDown className="h-4 w-4 text-black" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-black" />
                  )}
                </button>
              )}
              <div
                className={cn(
                  "w-2.5 h-2.5 rounded-full flex-shrink-0",
                  getStatusColor(objective.status)
                )}
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-black truncate block">{objective.name}</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 max-w-[100px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-black rounded-full"
                      style={{ width: `${objective.progress}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-500">{objective.progress}%</span>
                  {objective.period && (
                    <span className="text-[11px] text-gray-400">{objective.period}</span>
                  )}
                </div>
              </div>
              {objective.owner && (
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarImage src={objective.owner.image || ""} />
                  <AvatarFallback className="text-xs bg-white border border-black">
                    {objective.owner.name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>

            {/* Expanded Key Results */}
            {expandedIds.has(objective.id) &&
              objective.keyResults.length > 0 && (
                <div className="bg-white border-t">
                  {objective.keyResults.map((kr) => {
                    const progress =
                      kr.targetValue - kr.startValue === 0
                        ? 0
                        : Math.min(
                            100,
                            Math.max(
                              0,
                              ((kr.currentValue - kr.startValue) /
                                (kr.targetValue - kr.startValue)) *
                                100
                            )
                          );
                    return (
                      <div
                        key={kr.id}
                        className="flex items-center py-2 pl-12 text-sm"
                      >
                        <div className="flex-1 px-3 flex items-center gap-2 text-black">
                          <div className="w-2 h-2 rounded-full bg-black" />
                          {kr.name}
                        </div>
                        <div className="w-[80px] px-3" />
                        <div className="w-[140px] px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-white border border-black rounded-full overflow-hidden">
                              <div
                                className="h-full bg-black rounded-full"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-black">
                              {kr.currentValue}/{kr.targetValue}
                            </span>
                          </div>
                        </div>
                        <div className="w-[100px] px-3" />
                        <div className="w-[140px] px-3" />
                        <div className="w-[80px] px-3" />
                        <div className="w-10" />
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Strategy Map View Component
function StrategyMapView({
  objectives,
  showOnboarding,
  onCreateGoal,
  onSkipOnboarding,
}: {
  objectives: Objective[];
  showOnboarding: boolean;
  onCreateGoal: (name?: string) => void;
  onSkipOnboarding: () => void;
}) {
  const [newGoalName, setNewGoalName] = useState("");

  if (showOnboarding) {
    return (
      <div className="flex flex-col md:flex-row h-full">
        {/* Left: Onboarding Form */}
        <div className="w-full md:w-1/2 p-4 md:p-8 md:border-r">
          <p className="text-sm text-black mb-4">Step 1 of 2</p>

          <h2 className="text-2xl font-semibold text-black mb-4">
            Welcome to the goals
            <br />
            strategy map
          </h2>

          <p className="text-black mb-6">
            Try the strategy map by creating a goal that only you can see. You
            can invite members and add details to the goal later.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Goal name <span className="text-black">*</span>
              </label>
              <Input
                type="text"
                value={newGoalName}
                onChange={(e) => setNewGoalName(e.target.value)}
                placeholder="e.g., Increase customer satisfaction"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Period
              </label>
              <p className="text-black">Q1 FY26</p>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-black">0 people will be notified</p>
            <div className="flex items-center gap-2 md:gap-3">
              <Button variant="ghost" onClick={onSkipOnboarding}>
                Go to map
              </Button>
              <Button
                disabled={!newGoalName.trim()}
                onClick={() => onCreateGoal(newGoalName)}
                className="bg-black hover:bg-black"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Strategy Map Preview */}
        <div className="hidden md:block w-1/2 p-8 bg-white overflow-auto">
          <StrategyMapPreview />
        </div>
      </div>
    );
  }

  if (objectives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16">
        <div className="w-16 h-16 bg-white border border-black rounded-full flex items-center justify-center mb-4">
          <Target className="h-8 w-8 text-black" />
        </div>
        <h3 className="text-lg font-medium text-black mb-2">
          No goals in strategy map
        </h3>
        <p className="text-sm text-black text-center max-w-sm mb-4">
          Create goals to visualize your strategy hierarchy.
        </p>
        <Button onClick={() => onCreateGoal()} className="bg-black hover:bg-black">
          <Plus className="w-4 h-4 mr-2" />
          Create your first goal
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 overflow-auto">
      <div className="min-w-max">
        <StrategyMapTree objectives={objectives} />
      </div>
    </div>
  );
}

// Strategy Map Preview (Onboarding)
function StrategyMapPreview() {
  return (
    <div className="relative flex flex-col items-center">
      {/* Workspace Node */}
      <div className="bg-white border rounded-lg p-4 shadow-sm w-56 mb-8">
        <p className="font-medium text-center text-black">My workspace</p>
        <div className="mt-3 space-y-1">
          <div className="h-2 bg-white border border-black rounded w-full" />
          <div className="h-2 bg-white border border-black rounded w-3/4" />
        </div>
      </div>

      {/* Connection Line */}
      <div className="w-px h-8 bg-black" />

      {/* Horizontal Line */}
      <div className="w-72 h-px bg-black" />

      {/* Child Goals */}
      <div className="flex justify-center gap-4 mt-0">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="w-px h-8 bg-black" />
            <GoalCard highlight={i === 2} />
          </div>
        ))}
      </div>

      {/* Sub-goals */}
      <div className="flex gap-32 mt-0">
        <div className="flex flex-col items-center">
          <div className="w-px h-8 bg-black" />
          <GoalCard />
        </div>
        <div className="flex flex-col items-center">
          <div className="w-px h-8 bg-black" />
          <GoalCard />
        </div>
      </div>
    </div>
  );
}

// Goal Card for Strategy Map
function GoalCard({ highlight = false }: { highlight?: boolean }) {
  return (
    <div
      className={cn(
        "bg-white border rounded-lg p-3 w-40 shadow-sm relative",
        highlight && "ring-2 ring-black"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-4 h-4 bg-white border border-black rounded" />
        <div className="h-2 bg-white border border-black rounded flex-1" />
      </div>
      <div className="h-2 bg-black rounded w-full mb-1" />
      <div className="h-2 bg-white border border-black rounded w-2/3" />
      {highlight && (
        <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-black rounded-full flex items-center justify-center text-xs text-white font-medium">
          You
        </div>
      )}
    </div>
  );
}

// Strategy Map Tree (Real)
function StrategyMapTree({ objectives }: { objectives: Objective[] }) {
  const rootGoals = objectives.filter((g) => !g.parentId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ON_TRACK":
        return "bg-[#c9a84c]";
      case "AT_RISK":
        return "bg-[#a8893a]";
      case "OFF_TRACK":
        return "bg-black";
      case "ACHIEVED":
        return "bg-[#c9a84c]";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div className="flex flex-col items-center gap-8">
      {rootGoals.map((goal) => (
        <div key={goal.id} className="flex flex-col items-center">
          <div className="bg-white border rounded-lg p-4 shadow-sm w-64 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("w-3 h-3 rounded-full", getStatusColor(goal.status))} />
              <span className="font-medium text-sm text-black">{goal.name}</span>
            </div>
            <div className="h-2 bg-white border border-black rounded-full overflow-hidden">
              <div
                className="h-full bg-black rounded-full"
                style={{ width: `${goal.progress}%` }}
              />
            </div>
            <p className="text-xs text-black mt-2">{goal.period}</p>
          </div>

          {goal.children && goal.children.length > 0 && (
            <>
              <div className="w-px h-8 bg-black" />
              <div className="flex gap-8">
                {goal.children.map((child) => (
                  <div key={child.id} className="flex flex-col items-center">
                    <div className="bg-white border rounded-lg p-3 w-48 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn("w-2 h-2 rounded-full", getStatusColor(child.status))} />
                        <span className="text-sm text-black">{child.name}</span>
                      </div>
                      <div className="h-1.5 bg-white border border-black rounded-full overflow-hidden">
                        <div
                          className="h-full bg-black rounded-full"
                          style={{ width: `${child.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
