"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ArrowLeft,
  Plus,
  Target,
  Loader2,
  MoreHorizontal,
  Trash2,
  Calendar,
  Edit2,
  ThumbsUp,
  Star,
  
  Users,
  Settings,
  Zap,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KeyResult {
  id: string;
  name: string;
  description: string | null;
  targetValue: number;
  currentValue: number;
  startValue: number;
  unit: string | null;
  format: string;
  updates: {
    id: string;
    previousValue: number;
    newValue: number;
    note: string | null;
    createdAt: string;
  }[];
}

interface Objective {
  id: string;
  name: string;
  description: string | null;
  status: string;
  progress: number;
  progressSource: string;
  period: string | null;
  startDate: string | null;
  endDate: string | null;
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
  projects: {
    id: string;
    project: {
      id: string;
      name: string;
      color: string;
    };
  }[];
  _count: {
    keyResults: number;
    children: number;
    projects: number;
  };
}

const STATUS_OPTIONS = [
  { value: "ON_TRACK", label: "On track", color: "bg-green-500", badgeColor: "bg-green-100 text-green-700" },
  { value: "AT_RISK", label: "At risk", color: "bg-yellow-500", badgeColor: "bg-yellow-100 text-yellow-700" },
  { value: "OFF_TRACK", label: "Off track", color: "bg-red-500", badgeColor: "bg-red-100 text-red-700" },
  { value: "ACHIEVED", label: "Achieved", color: "bg-blue-500", badgeColor: "bg-blue-100 text-blue-700" },
  { value: "PARTIAL", label: "Partial", color: "bg-slate-400", badgeColor: "bg-slate-100 text-slate-700" },
  { value: "MISSED", label: "Missed", color: "bg-red-500", badgeColor: "bg-red-100 text-red-700" },
  { value: "DROPPED", label: "Dropped", color: "bg-slate-400", badgeColor: "bg-slate-100 text-slate-700" },
];

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const objectiveId = params.objectiveId as string;

  const [objective, setObjective] = useState<Objective | null>(null);
  const [loading, setLoading] = useState(true);
  const [addKROpen, setAddKROpen] = useState(false);
  const [updateKROpen, setUpdateKROpen] = useState(false);
  const [selectedKR, setSelectedKR] = useState<KeyResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState("");

  const [newKR, setNewKR] = useState({
    name: "",
    targetValue: 100,
    startValue: 0,
    unit: "",
  });

  const [updateValue, setUpdateValue] = useState({
    currentValue: 0,
    note: "",
  });

  useEffect(() => {
    fetchObjective();
  }, [objectiveId]);

  async function fetchObjective() {
    try {
      const res = await fetch(`/api/objectives/${objectiveId}`);
      if (res.ok) {
        const data = await res.json();
        setObjective(data);
        setDescription(data.description || "");
      }
    } catch (error) {
      console.error("Error fetching objective:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(status: string) {
    try {
      const res = await fetch(`/api/objectives/${objectiveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setObjective((prev) => prev ? { ...prev, status } : null);
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  }

  async function handleDescriptionBlur() {
    if (objective && description !== objective.description) {
      try {
        await fetch(`/api/objectives/${objectiveId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description }),
        });
      } catch (error) {
        console.error("Error updating description:", error);
      }
    }
  }

  async function handleAddKeyResult() {
    if (!newKR.name.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/objectives/${objectiveId}/key-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newKR),
      });

      if (res.ok) {
        await fetchObjective();
        setAddKROpen(false);
        setNewKR({ name: "", targetValue: 100, startValue: 0, unit: "" });
      }
    } catch (error) {
      console.error("Error adding key result:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateKeyResult() {
    if (!selectedKR) return;

    setSaving(true);
    try {
      const res = await fetch(
        `/api/objectives/${objectiveId}/key-results?keyResultId=${selectedKR.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentValue: updateValue.currentValue,
            note: updateValue.note || undefined,
          }),
        }
      );

      if (res.ok) {
        await fetchObjective();
        setUpdateKROpen(false);
        setSelectedKR(null);
      }
    } catch (error) {
      console.error("Error updating key result:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteKeyResult(krId: string) {
    if (!confirm("Delete this key result?")) return;

    try {
      const res = await fetch(
        `/api/objectives/${objectiveId}/key-results?keyResultId=${krId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        await fetchObjective();
      }
    } catch (error) {
      console.error("Error deleting key result:", error);
    }
  }

  async function handleDeleteObjective() {
    if (!confirm("Delete this goal? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/objectives/${objectiveId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/goals");
      }
    } catch (error) {
      console.error("Error deleting objective:", error);
    }
  }

  const openUpdateDialog = (kr: KeyResult) => {
    setSelectedKR(kr);
    setUpdateValue({ currentValue: kr.currentValue, note: "" });
    setUpdateKROpen(true);
  };

  const getStatusOption = (status: string) => STATUS_OPTIONS.find((o) => o.value === status) || STATUS_OPTIONS[0];

  const calculateKRProgress = (kr: KeyResult) => {
    const range = kr.targetValue - kr.startValue;
    if (range === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
    return Math.min(100, Math.max(0, ((kr.currentValue - kr.startValue) / range) * 100));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!objective) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-slate-500">Goal not found</p>
        <Button variant="link" onClick={() => router.push("/goals")}>
          Go back to goals
        </Button>
      </div>
    );
  }

  const currentStatus = getStatusOption(objective.status);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top Bar - Breadcrumb */}
      <div className="border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => router.push("/goals")} className="text-gray-500 hover:text-gray-700">
            Goals
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900 font-medium">{objective.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={objective.owner.image || ""} />
            <AvatarFallback className="text-xs">{getInitials(objective.owner.name)}</AvatarFallback>
          </Avatar>
          <Button size="sm">Share</Button>
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <Target className="h-5 w-5 text-blue-600" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 text-lg font-semibold hover:bg-gray-100 px-2 py-1 rounded">
              {objective.name}
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Edit goal</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuItem className="text-red-600" onClick={handleDeleteObjective}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="ghost" size="icon" className="text-gray-400">
            <ThumbsUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-gray-400">
            <Star className="h-4 w-4" />
          </Button>

          <Select value={objective.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[140px]">
              <div className="flex items-center gap-2">
                <div className={cn("h-3 w-3 rounded-full", currentStatus.color)} />
                <span>{currentStatus.label}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <div className={cn("h-3 w-3 rounded-full", option.color)} />
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Goal Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-8">{objective.name}</h1>

          {/* Meta Fields */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center">
              <span className="w-40 text-sm text-gray-500">Goal owner</span>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={objective.owner.image || ""} />
                  <AvatarFallback className="text-xs">{getInitials(objective.owner.name)}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{objective.owner.name}</span>
              </div>
            </div>

            <div className="flex items-center">
              <span className="w-40 text-sm text-gray-500">Time period</span>
              <span className="text-sm">{objective.period || "Not set"}</span>
            </div>

            <div className="flex items-center">
              <span className="w-40 text-sm text-gray-500">Due date</span>
              <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {objective.endDate ? new Date(objective.endDate).toLocaleDateString() : "Set due date"}
              </button>
            </div>

            <div className="flex items-center">
              <span className="w-40 text-sm text-gray-500">Team</span>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Users className="h-4 w-4" />
                <span>{objective.team?.name || "No team"}</span>
              </div>
            </div>
          </div>

          {/* Progress Cards */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="border rounded-lg p-6 text-center">
              <p className="text-sm text-gray-500 mb-2">Goal completion</p>
              <p className="text-4xl font-bold text-gray-900 mb-1">{objective.progress}%</p>
              <p className="text-xs text-gray-400">
                {objective.period ? `Based on ${objective.keyResults.length} key results` : "Update key results to track progress"}
              </p>
            </div>

            <div className="border rounded-lg p-6 text-center">
              <p className="text-sm text-gray-500 mb-2">Latest status</p>
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className={cn("h-4 w-4 rounded-full", currentStatus.color)} />
                <span className="text-lg font-medium">{currentStatus.label}</span>
              </div>
              <button className="text-xs text-blue-600 hover:underline">
                Update status
              </button>
            </div>
          </div>

          {/* Key Results Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Key Results</h3>
                <Zap className="h-4 w-4 text-yellow-500" />
                {objective.keyResults.length === 0 && (
                  <span className="text-sm text-yellow-600 flex items-center gap-1">
                    No key results connected
                  </span>
                )}
              </div>
              <Button variant="ghost" size="sm" className="text-gray-500" onClick={() => setAddKROpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add key result
              </Button>
            </div>

            {objective.keyResults.length === 0 ? (
              <div className="border rounded-lg p-6 text-center bg-gray-50">
                <p className="text-sm text-gray-500 mb-4">
                  Add key results to track measurable outcomes for this goal.
                </p>
                <Button variant="outline" onClick={() => setAddKROpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add key result
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {objective.keyResults.map((kr) => {
                  const progress = calculateKRProgress(kr);
                  return (
                    <div key={kr.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">{kr.name}</h4>
                          {kr.description && (
                            <p className="text-sm text-gray-500 mt-1">{kr.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => openUpdateDialog(kr)}>
                            <Edit2 className="h-3 w-3 mr-1" />
                            Update
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDeleteKeyResult(kr.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={progress} className="flex-1 h-2" />
                        <span className="text-sm font-medium text-gray-700 min-w-[100px] text-right">
                          {kr.currentValue} / {kr.targetValue}
                          {kr.unit ? ` ${kr.unit}` : ""}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        {Math.round(progress)}% complete
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Banner */}
          <div className="border rounded-lg p-4 mb-8 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              <span className="text-sm">Improve your goal with AI Intelligence</span>
            </div>
            <Button variant="outline" size="sm">
              See improvements
            </Button>
          </div>

          {/* Description */}
          <div className="mb-8">
            <h3 className="font-semibold mb-2">Description</h3>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Click to add context. Why is this important? How will you define success?"
              className="min-h-[100px] border-gray-200"
            />
          </div>

          {/* Parent Goals */}
          <div className="mb-8">
            <h3 className="font-semibold mb-2">Parent goals</h3>
            <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
              <Plus className="h-4 w-4" />
              Connect a parent goal
            </button>
          </div>

          {/* Related Work */}
          <div className="mb-8">
            <h3 className="font-semibold mb-2">Related work</h3>
            {objective.projects.length > 0 ? (
              <div className="space-y-2">
                {objective.projects.map((op) => (
                  <div
                    key={op.id}
                    className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/projects/${op.project.id}`)}
                  >
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: op.project.color }}
                    />
                    <span className="font-medium text-gray-900">{op.project.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
                <Plus className="h-4 w-4" />
                Link tasks, projects, or portfolios
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Add Key Result Dialog */}
      <Dialog open={addKROpen} onOpenChange={setAddKROpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Key Result</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>What do you want to measure?</Label>
              <Input
                placeholder="e.g., Acquire 1000 new users"
                value={newKR.name}
                onChange={(e) => setNewKR({ ...newKR, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Start value</Label>
                <Input
                  type="number"
                  value={newKR.startValue}
                  onChange={(e) => setNewKR({ ...newKR, startValue: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Target value</Label>
                <Input
                  type="number"
                  value={newKR.targetValue}
                  onChange={(e) => setNewKR({ ...newKR, targetValue: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit (optional)</Label>
                <Input
                  placeholder="users, %, $"
                  value={newKR.unit}
                  onChange={(e) => setNewKR({ ...newKR, unit: e.target.value })}
                />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleAddKeyResult}
              disabled={saving || !newKR.name.trim()}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add key result"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Key Result Dialog */}
      <Dialog open={updateKROpen} onOpenChange={setUpdateKROpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Progress</DialogTitle>
          </DialogHeader>
          {selectedKR && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-gray-600">{selectedKR.name}</p>
              <div className="space-y-2">
                <Label>Current value</Label>
                <Input
                  type="number"
                  value={updateValue.currentValue}
                  onChange={(e) =>
                    setUpdateValue({
                      ...updateValue,
                      currentValue: parseFloat(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-gray-500">
                  Previous: {selectedKR.currentValue} → New: {updateValue.currentValue}
                  {selectedKR.unit ? ` ${selectedKR.unit}` : ""}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Note (optional)</Label>
                <Textarea
                  placeholder="What changed?"
                  value={updateValue.note}
                  onChange={(e) =>
                    setUpdateValue({ ...updateValue, note: e.target.value })
                  }
                />
              </div>
              <Button
                className="w-full"
                onClick={handleUpdateKeyResult}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update progress"
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
