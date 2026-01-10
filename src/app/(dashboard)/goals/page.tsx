"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    children: number;
  };
  parentId?: string | null;
}

type TabType = "strategy-map" | "team-goals" | "my-goals";

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
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabType>("my-goals");
  const [selectedPeriod, setSelectedPeriod] = useState("All");
  const [newObjective, setNewObjective] = useState({
    name: "",
    period: "Q1 FY26",
  });

  // Strategy map onboarding state
  const [showStrategyOnboarding, setShowStrategyOnboarding] = useState(true);

  const tabs = [
    { id: "strategy-map" as TabType, label: "Strategy map" },
    { id: "team-goals" as TabType, label: "Team goals" },
    { id: "my-goals" as TabType, label: "My goals" },
  ];

  useEffect(() => {
    fetchObjectives();
  }, [activeTab]);

  async function fetchObjectives() {
    try {
      const params = new URLSearchParams();
      params.set("parentId", "null");
      if (activeTab === "my-goals") params.set("ownerId", "me");

      const res = await fetch(`/api/objectives?${params}`);
      if (res.ok) {
        const data = await res.json();
        setObjectives(data);
      }
    } catch (error) {
      console.error("Error fetching objectives:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newObjective.name.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newObjective.name,
          period: newObjective.period,
          progressSource: "KEY_RESULTS",
        }),
      });

      if (res.ok) {
        const objective = await res.json();
        setObjectives([objective, ...objectives]);
        setCreateOpen(false);
        setNewObjective({ name: "", period: "Q1 FY26" });
        router.push(`/goals/${objective.id}`);
      }
    } catch (error) {
      console.error("Error creating objective:", error);
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
        return "bg-green-500";
      case "AT_RISK":
        return "bg-yellow-500";
      case "OFF_TRACK":
        return "bg-red-500";
      case "ACHIEVED":
        return "bg-blue-500";
      default:
        return "bg-slate-300";
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
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-xl font-semibold text-slate-900">Goals</h1>
        <button className="text-sm text-blue-600 hover:text-blue-700">
          Send feedback
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
          </button>
        ))}
        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md ml-1">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-slate-50">
        <div className="flex items-center gap-3">
          {/* Create Goal Button */}
          <Button
            size="sm"
            className="bg-slate-900 hover:bg-slate-800"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create goal
          </Button>

          {/* Period Selector */}
          <div className="flex items-center bg-white border rounded-md">
            <button
              onClick={() => cyclePeriod("prev")}
              className="p-1.5 hover:bg-slate-100 rounded-l-md border-r"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-1.5 text-sm bg-transparent border-none outline-none cursor-pointer"
            >
              {PERIODS.map((period) => (
                <option key={period} value={period}>
                  Periods: {period}
                </option>
              ))}
            </select>
            <button
              onClick={() => cyclePeriod("next")}
              className="p-1.5 hover:bg-slate-100 rounded-r-md border-l"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Owner/Team Filter Badge */}
          {activeTab === "my-goals" && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-sm">
              <User className="w-4 h-4 text-red-600" />
              <span className="text-red-700">Owner: Juan Tercero</span>
            </div>
          )}
          {activeTab === "team-goals" && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-sm">
              <Users className="w-4 h-4 text-red-600" />
              <span className="text-red-700">Team: My workspace</span>
            </div>
          )}

          {/* Filter & Options */}
          <Button variant="ghost" size="sm" className="text-slate-600">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="ghost" size="sm" className="text-slate-600">
            <Settings className="w-4 h-4 mr-2" />
            Options
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "strategy-map" ? (
          <StrategyMapView
            objectives={objectives}
            showOnboarding={showStrategyOnboarding && objectives.length === 0}
            onCreateGoal={() => setCreateOpen(true)}
            onSkipOnboarding={() => setShowStrategyOnboarding(false)}
          />
        ) : (
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
                Goal name <span className="text-red-500">*</span>
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
              className="w-full bg-slate-900 hover:bg-slate-800"
              onClick={handleCreate}
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
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <Target className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">No goals yet</h3>
        <p className="text-sm text-slate-500 text-center max-w-sm mb-4">
          Create goals to track your objectives and key results.
        </p>
        <Button
          onClick={onCreateGoal}
          className="bg-slate-900 hover:bg-slate-800"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create your first goal
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Column Headers */}
      <div className="flex items-center border-b pb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
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
          <Plus className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* Goals List */}
      <div className="divide-y">
        {objectives.map((objective) => (
          <div key={objective.id}>
            <div
              className="flex items-center py-3 hover:bg-slate-50 cursor-pointer group"
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
                    className="p-1 hover:bg-slate-200 rounded"
                  >
                    {expandedIds.has(objective.id) ? (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    )}
                  </button>
                )}
                <span className="text-sm text-slate-700">{objective.name}</span>
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
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all"
                      style={{ width: `${objective.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 w-8">
                    {objective.progress}%
                  </span>
                </div>
              </div>

              {/* Period */}
              <div className="w-[100px] px-3">
                <span className="text-sm text-slate-500">
                  {objective.period || "-"}
                </span>
              </div>

              {/* Team */}
              <div className="w-[140px] px-3">
                <span className="text-sm text-slate-500">
                  {objective.team?.name || "-"}
                </span>
              </div>

              {/* Owner */}
              <div className="w-[80px] px-3">
                {objective.owner ? (
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={objective.owner.image || ""} />
                    <AvatarFallback className="text-xs bg-slate-200">
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

            {/* Expanded Key Results */}
            {expandedIds.has(objective.id) &&
              objective.keyResults.length > 0 && (
                <div className="bg-slate-50 border-t">
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
                        <div className="flex-1 px-3 flex items-center gap-2 text-slate-600">
                          <div className="w-2 h-2 rounded-full bg-slate-400" />
                          {kr.name}
                        </div>
                        <div className="w-[80px] px-3" />
                        <div className="w-[140px] px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-400 rounded-full"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500">
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
  onCreateGoal: () => void;
  onSkipOnboarding: () => void;
}) {
  const [newGoalName, setNewGoalName] = useState("");

  if (showOnboarding) {
    return (
      <div className="flex h-full">
        {/* Left: Onboarding Form */}
        <div className="w-1/2 p-8 border-r">
          <p className="text-sm text-slate-500 mb-4">Step 1 of 2</p>

          <h2 className="text-2xl font-semibold text-slate-900 mb-4">
            Welcome to the goals
            <br />
            strategy map
          </h2>

          <p className="text-slate-600 mb-6">
            Try the strategy map by creating a goal that only you can see. You
            can invite members and add details to the goal later.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Goal name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={newGoalName}
                onChange={(e) => setNewGoalName(e.target.value)}
                placeholder="e.g., Increase customer satisfaction"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Period
              </label>
              <p className="text-slate-600">Q1 FY26</p>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t flex items-center justify-between">
            <p className="text-sm text-slate-500">0 people will be notified</p>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={onSkipOnboarding}>
                Go to map
              </Button>
              <Button
                disabled={!newGoalName.trim()}
                onClick={onCreateGoal}
                className="bg-slate-900 hover:bg-slate-800"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Strategy Map Preview */}
        <div className="w-1/2 p-8 bg-slate-50 overflow-auto">
          <StrategyMapPreview />
        </div>
      </div>
    );
  }

  if (objectives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <Target className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">
          No goals in strategy map
        </h3>
        <p className="text-sm text-slate-500 text-center max-w-sm mb-4">
          Create goals to visualize your strategy hierarchy.
        </p>
        <Button onClick={onCreateGoal} className="bg-slate-900 hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-2" />
          Create your first goal
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 overflow-auto">
      <StrategyMapTree objectives={objectives} />
    </div>
  );
}

// Strategy Map Preview (Onboarding)
function StrategyMapPreview() {
  return (
    <div className="relative flex flex-col items-center">
      {/* Workspace Node */}
      <div className="bg-white border rounded-lg p-4 shadow-sm w-56 mb-8">
        <p className="font-medium text-center text-slate-900">My workspace</p>
        <div className="mt-3 space-y-1">
          <div className="h-2 bg-slate-200 rounded w-full" />
          <div className="h-2 bg-slate-200 rounded w-3/4" />
        </div>
      </div>

      {/* Connection Line */}
      <div className="w-px h-8 bg-slate-300" />

      {/* Horizontal Line */}
      <div className="w-72 h-px bg-slate-300" />

      {/* Child Goals */}
      <div className="flex justify-center gap-4 mt-0">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="w-px h-8 bg-slate-300" />
            <GoalCard highlight={i === 2} />
          </div>
        ))}
      </div>

      {/* Sub-goals */}
      <div className="flex gap-32 mt-0">
        <div className="flex flex-col items-center">
          <div className="w-px h-8 bg-slate-300" />
          <GoalCard />
        </div>
        <div className="flex flex-col items-center">
          <div className="w-px h-8 bg-slate-300" />
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
        highlight && "ring-2 ring-blue-500"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-4 h-4 bg-slate-200 rounded" />
        <div className="h-2 bg-slate-200 rounded flex-1" />
      </div>
      <div className="h-2 bg-green-400 rounded w-full mb-1" />
      <div className="h-2 bg-slate-200 rounded w-2/3" />
      {highlight && (
        <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center text-xs text-white font-medium">
          JT
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
        return "bg-green-500";
      case "AT_RISK":
        return "bg-yellow-500";
      case "OFF_TRACK":
        return "bg-red-500";
      case "ACHIEVED":
        return "bg-blue-500";
      default:
        return "bg-slate-300";
    }
  };

  return (
    <div className="flex flex-col items-center gap-8">
      {rootGoals.map((goal) => (
        <div key={goal.id} className="flex flex-col items-center">
          <div className="bg-white border rounded-lg p-4 shadow-sm w-64 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("w-3 h-3 rounded-full", getStatusColor(goal.status))} />
              <span className="font-medium text-sm text-slate-900">{goal.name}</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full"
                style={{ width: `${goal.progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">{goal.period}</p>
          </div>

          {goal.children && goal.children.length > 0 && (
            <>
              <div className="w-px h-8 bg-slate-300" />
              <div className="flex gap-8">
                {goal.children.map((child) => (
                  <div key={child.id} className="flex flex-col items-center">
                    <div className="bg-white border rounded-lg p-3 w-48 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn("w-2 h-2 rounded-full", getStatusColor(child.status))} />
                        <span className="text-sm text-slate-700">{child.name}</span>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
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
