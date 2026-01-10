"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
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
  ArrowLeft,
  Plus,
  Target,
  Loader2,
  MoreHorizontal,
  Trash2,
  Calendar,
  Edit2,
} from "lucide-react";

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
  { value: "ON_TRACK", label: "On track", color: "bg-green-100 text-green-700" },
  { value: "AT_RISK", label: "At risk", color: "bg-yellow-100 text-yellow-700" },
  { value: "OFF_TRACK", label: "Off track", color: "bg-red-100 text-red-700" },
  { value: "ACHIEVED", label: "Achieved", color: "bg-blue-100 text-blue-700" },
  { value: "PARTIAL", label: "Partial", color: "bg-slate-100 text-slate-700" },
  { value: "MISSED", label: "Missed", color: "bg-red-100 text-red-700" },
  { value: "DROPPED", label: "Dropped", color: "bg-slate-100 text-slate-700" },
];

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

  const getStatusColor = (status: string) => {
    const option = STATUS_OPTIONS.find((o) => o.value === status);
    return option?.color || "bg-slate-100 text-slate-700";
  };

  const getStatusLabel = (status: string) => {
    const option = STATUS_OPTIONS.find((o) => o.value === status);
    return option?.label || status;
  };

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center gap-4 mb-2">
          <Button variant="ghost" size="icon" onClick={() => router.push("/goals")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <Target className="h-6 w-6 text-green-600" />
            <h1 className="text-xl font-semibold text-slate-900">
              {objective.name}
            </h1>
          </div>
          <Select value={objective.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue>
                <Badge className={getStatusColor(objective.status)}>
                  {getStatusLabel(objective.status)}
                </Badge>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <Badge className={option.color}>{option.label}</Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-red-600"
                onClick={handleDeleteObjective}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete goal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-6 text-sm text-slate-500 ml-12">
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={objective.owner.image || ""} />
              <AvatarFallback className="text-[10px]">
                {objective.owner.name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span>{objective.owner.name}</span>
          </div>
          {objective.period && (
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {objective.period}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Progress value={objective.progress} className="w-24 h-2" />
            <span>{objective.progress}%</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl">
          {/* Description */}
          {objective.description && (
            <div className="mb-8">
              <h2 className="text-sm font-medium text-slate-500 mb-2">Description</h2>
              <p className="text-slate-700">{objective.description}</p>
            </div>
          )}

          {/* Key Results */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                Key Results ({objective.keyResults.length})
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddKROpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add key result
              </Button>
            </div>

            {objective.keyResults.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed">
                <p className="text-slate-500 mb-3">
                  No key results yet. Add measurable outcomes to track progress.
                </p>
                <Button variant="outline" size="sm" onClick={() => setAddKROpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add key result
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {objective.keyResults.map((kr) => {
                  const progress = calculateKRProgress(kr);
                  return (
                    <div
                      key={kr.id}
                      className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-slate-900">{kr.name}</h3>
                          {kr.description && (
                            <p className="text-sm text-slate-500 mt-1">
                              {kr.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openUpdateDialog(kr)}
                          >
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
                        <span className="text-sm font-medium text-slate-700 min-w-[100px] text-right">
                          {kr.currentValue} / {kr.targetValue}
                          {kr.unit ? ` ${kr.unit}` : ""}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-2">
                        {Math.round(progress)}% complete
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Connected Projects */}
          {objective.projects.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">
                Connected Projects ({objective.projects.length})
              </h2>
              <div className="space-y-2">
                {objective.projects.map((op) => (
                  <div
                    key={op.id}
                    className="flex items-center gap-3 p-3 bg-white border rounded-lg cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/projects/${op.project.id}`)}
                  >
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: op.project.color }}
                    />
                    <span className="font-medium text-slate-900">
                      {op.project.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                  onChange={(e) =>
                    setNewKR({ ...newKR, startValue: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Target value</Label>
                <Input
                  type="number"
                  value={newKR.targetValue}
                  onChange={(e) =>
                    setNewKR({ ...newKR, targetValue: parseFloat(e.target.value) || 0 })
                  }
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
              className="w-full bg-slate-900 hover:bg-slate-800"
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
              <p className="text-sm text-slate-600">{selectedKR.name}</p>
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
                <p className="text-xs text-slate-500">
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
                className="w-full bg-slate-900 hover:bg-slate-800"
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
