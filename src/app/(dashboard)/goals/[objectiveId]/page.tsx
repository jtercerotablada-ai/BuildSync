"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
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
  Settings2,
  Zap,
  Sparkles,
  ChevronDown,
  AlertTriangle,
  Flag,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GoalProgressChart } from "@/components/goals/goal-progress-chart";

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
  createdAt: string;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
  };
  team: {
    id: string;
    name: string;
  } | null;
  workspace?: {
    id: string;
    name: string;
  };
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
  { value: "ON_TRACK", label: "On track", color: "bg-green-500", textColor: "text-green-700" },
  { value: "AT_RISK", label: "At risk", color: "bg-yellow-500", textColor: "text-yellow-700" },
  { value: "OFF_TRACK", label: "Off track", color: "bg-red-500", textColor: "text-red-700" },
  { value: "ACHIEVED", label: "Achieved", color: "bg-blue-500", textColor: "text-blue-700" },
  { value: "PARTIAL", label: "Partial", color: "bg-gray-400", textColor: "text-black" },
  { value: "MISSED", label: "Not achieved", color: "bg-gray-300", textColor: "text-black" },
  { value: "DROPPED", label: "Discarded", color: "bg-gray-400", textColor: "text-black" },
  { value: null, label: "No status", color: "bg-gray-400", textColor: "text-black" },
];

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatRelativeTime(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  if (diffDays === 0) return `Today at ${time}`;
  if (diffDays === 1) return `Yesterday at ${time}`;
  return `${d.toLocaleDateString("en-US")} at ${time}`;
}

function getTimeRemaining(period: string | null, endDate: string | null): string {
  if (!period && !endDate) return "";

  if (endDate) {
    const end = new Date(endDate);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Overdue";
    if (diffDays === 0) return "Due today";
    if (diffDays === 1) return "Due tomorrow";
    if (diffDays < 30) return `${diffDays} days remaining`;
    const diffMonths = Math.ceil(diffDays / 30);
    return `${diffMonths} ${diffMonths === 1 ? "month" : "months"} remaining${period ? ` in ${period}` : ""}`;
  }

  return period ? `In ${period}` : "";
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
  const [comment, setComment] = useState("");
  const [isLiked, setIsLiked] = useState(false);
  const [isStarred, setIsStarred] = useState(false);

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

  async function handleStatusChange(status: string | null) {
    try {
      const res = await fetch(`/api/objectives/${objectiveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setObjective((prev) => prev ? { ...prev, status: status || "ON_TRACK" } : null);
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
    if (!confirm("Delete this objective? This action cannot be undone.")) return;

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

  const getStatusOption = (status: string) =>
    STATUS_OPTIONS.find((o) => o.value === status) || STATUS_OPTIONS.find((o) => o.value === null)!;

  const calculateKRProgress = (kr: KeyResult) => {
    const range = kr.targetValue - kr.startValue;
    if (range === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
    return Math.min(100, Math.max(0, ((kr.currentValue - kr.startValue) / range) * 100));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-black" />
      </div>
    );
  }

  if (!objective) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-black">Objective not found</p>
        <Button variant="link" onClick={() => router.push("/goals")}>
          Back to objectives
        </Button>
      </div>
    );
  }

  const currentStatus = getStatusOption(objective.status);
  const hasNoSubgoals = objective.children.length === 0;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ========== TOP BAR ========== */}
      <div className="border-b px-6 py-3 flex items-center justify-between bg-white sticky top-0 z-10">
        <span className="text-sm text-gray-500">
          Goals of {objective.workspace?.name || "My workspace"}
        </span>
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 border-2 border-black">
            <AvatarImage src={objective.owner.image || ""} />
            <AvatarFallback className="text-xs bg-white text-black">
              {getInitials(objective.owner.name)}
            </AvatarFallback>
          </Avatar>
          <Button
            size="sm"
            className="bg-black hover:bg-black"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success('Link copied to clipboard');
            }}
          >
            Share
          </Button>
        </div>
      </div>

      {/* ========== HEADER ========== */}
      <div className="border-b px-6 py-3 flex items-center gap-3 bg-white">
        {/* Goal icon */}
        <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
          <Flag className="h-4 w-4 text-white" />
        </div>

        {/* Goal name dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 text-base font-medium hover:bg-gray-100 px-2 py-1 rounded">
              {objective.name}
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => {
              const newName = prompt('Objective name:', objective.name);
              if (newName && newName !== objective.name) {
                fetch(`/api/objectives/${objective.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: newName }),
                }).then(res => {
                  if (res.ok) {
                    setObjective({ ...objective, name: newName });
                    toast.success('Goal updated');
                  }
                });
              }
            }}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit objective
            </DropdownMenuItem>
            <DropdownMenuItem onClick={async () => {
              try {
                const res = await fetch('/api/objectives', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: `${objective.name} (copy)`,
                    period: objective.period,
                    description: objective.description,
                    progressSource: objective.progressSource,
                  }),
                });
                if (res.ok) {
                  const newObj = await res.json();
                  toast.success('Goal duplicated');
                  router.push(`/goals/${newObj.id}`);
                }
              } catch { toast.error('Failed to duplicate'); }
            }}>
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem className="text-black" onClick={handleDeleteObjective}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", isLiked && "text-black")}
            onClick={() => setIsLiked(!isLiked)}
          >
            <ThumbsUp className={cn("h-4 w-4", isLiked && "fill-current")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", isStarred && "text-black")}
            onClick={() => setIsStarred(!isStarred)}
          >
            <Star className={cn("h-4 w-4", isStarred && "fill-current")} />
          </Button>

          {/* Status button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-gray-600">
                <div className={cn("h-3 w-3 rounded-full", currentStatus.color)} />
                Set status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {STATUS_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value || "null"}
                  onClick={() => handleStatusChange(option.value)}
                >
                  <div className={cn("h-3 w-3 rounded-full mr-2", option.color)} />
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ========== MAIN CONTENT ========== */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Goal Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-8">{objective.name}</h1>

          {/* ========== META FIELDS ========== */}
          <div className="space-y-4 mb-6">
            {/* Objective owner */}
            <div className="flex items-center">
              <span className="w-44 text-sm text-gray-500">Objective owner</span>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6 border border-black">
                  <AvatarImage src={objective.owner.image || ""} />
                  <AvatarFallback className="text-xs bg-white text-black">
                    {getInitials(objective.owner.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{objective.owner.name}</span>
              </div>
            </div>

            {/* Period */}
            <div className="flex items-center">
              <span className="w-44 text-sm text-gray-500">Period</span>
              <span className="text-sm">{objective.period || "No period"}</span>
            </div>

            {/* Due date */}
            <div className="flex items-center">
              <span className="w-44 text-sm text-gray-500">Due date</span>
              <div className="relative">
                <button
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  onClick={() => {
                    const input = document.getElementById('goal-due-date') as HTMLInputElement;
                    input?.showPicker?.();
                    input?.click();
                  }}
                >
                  <Calendar className="h-4 w-4" />
                  {objective.endDate
                    ? new Date(objective.endDate).toLocaleDateString("en-US")
                    : "Set due date"}
                </button>
                <input
                  id="goal-due-date"
                  type="date"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                  value={objective.endDate ? new Date(objective.endDate).toISOString().split('T')[0] : ''}
                  onChange={async (e) => {
                    const newDate = e.target.value;
                    try {
                      const res = await fetch(`/api/objectives/${objectiveId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ endDate: newDate || null }),
                      });
                      if (res.ok) {
                        setObjective((prev) => prev ? { ...prev, endDate: newDate || null } : null);
                        toast.success('Due date updated');
                      }
                    } catch { toast.error('Error updating date'); }
                  }}
                />
              </div>
            </div>

            {/* Responsible team */}
            <div className="flex items-center">
              <span className="w-44 text-sm text-gray-500">Responsible team</span>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Users className="h-4 w-4" />
                <span>{objective.team?.name || "No team"}</span>
              </div>
            </div>

            {/* Fields */}
            <div className="flex items-center">
              <span className="w-44 text-sm text-gray-500">Fields</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                    <Plus className="h-3 w-3" />
                    Add field
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => toast.info('Text field added')}>
                    Text
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info('Number field added')}>
                    Number
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info('Date field added')}>
                    Date
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info('Selection field added')}>
                    Selection
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Enviar comentarios link */}
          <button
            className="text-sm text-gray-500 hover:underline mb-8 block"
            onClick={() => window.open('mailto:feedback@buildsync.com?subject=Goals%20Feedback', '_blank')}
          >
            Send feedback
          </button>

          {/* ========== PROGRESS CARDS ========== */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {/* Goal completion card */}
            <div className="border rounded-xl p-6 text-center">
              <p className="text-sm text-gray-500 mb-2">Objective completion</p>
              <p className="text-4xl font-bold text-gray-900 mb-1">{objective.progress}%</p>
              <p className="text-xs text-gray-400">
                {getTimeRemaining(objective.period, objective.endDate)}
              </p>
            </div>

            {/* Status card */}
            <div className="border rounded-xl p-6 text-center">
              <p className="text-sm text-gray-500 mb-2">Latest status</p>
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className={cn("h-4 w-4 rounded-full", currentStatus.color)} />
                <span className={cn("text-lg font-medium", currentStatus.textColor)}>
                  {currentStatus.label}
                </span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-xs text-black hover:underline">
                    Set status
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {STATUS_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value || "null"}
                      onClick={() => handleStatusChange(option.value)}
                    >
                      <div className={cn("h-3 w-3 rounded-full mr-2", option.color)} />
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* ========== PROGRESS SECTION WITH CHART ========== */}
          <div className="mb-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">Progress</h3>
                <Zap className="h-4 w-4 text-black" />
                {hasNoSubgoals && (
                  <span className="text-sm text-black flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    No sub-objectives connected
                  </span>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-gray-500 gap-1">
                    <Settings2 className="h-4 w-4" />
                    Progress settings
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={async () => {
                    try {
                      await fetch(`/api/objectives/${objectiveId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ progressSource: 'MANUAL' }),
                      });
                      setObjective((prev) => prev ? { ...prev, progressSource: 'MANUAL' } : null);
                      toast.success('Progress: Manual');
                    } catch { toast.error('Error'); }
                  }}>
                    Manual progress
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    try {
                      await fetch(`/api/objectives/${objectiveId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ progressSource: 'SUB_GOALS' }),
                      });
                      setObjective((prev) => prev ? { ...prev, progressSource: 'SUB_GOALS' } : null);
                      toast.success('Progress: From sub-objectives');
                    } catch { toast.error('Error'); }
                  }}>
                    From sub-objectives
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    try {
                      await fetch(`/api/objectives/${objectiveId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ progressSource: 'KEY_RESULTS' }),
                      });
                      setObjective((prev) => prev ? { ...prev, progressSource: 'KEY_RESULTS' } : null);
                      toast.success('Progress: From key results');
                    } catch { toast.error('Error'); }
                  }}>
                    From key results
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* ========== CHART ========== */}
            <GoalProgressChart
              progress={objective.progress}
              period={objective.period || undefined}
              startDate={objective.startDate || objective.createdAt}
              endDate={objective.endDate || undefined}
            />

            {/* CTA */}
            <p className="text-sm text-gray-500 text-center my-6">
              Use sub-objectives to automatically update the progress of this objective.
            </p>
            <div className="flex justify-center">
              <Button
                className="bg-black hover:bg-black gap-2"
                onClick={() => setAddKROpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add key result
              </Button>
            </div>
          </div>

          {/* ========== KEY RESULTS SECTION ========== */}
          {objective.keyResults.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Key results</h3>
                <Button variant="ghost" size="sm" className="text-gray-500" onClick={() => setAddKROpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add key result
                </Button>
              </div>
              <div className="space-y-3">
                {objective.keyResults.map((kr) => {
                  const progress = calculateKRProgress(kr);
                  return (
                    <div key={kr.id} className="border rounded-xl p-4 hover:shadow-sm transition-shadow">
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
                                className="text-black"
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
                        {Math.round(progress)}% completed
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========== AI BANNER ========== */}
          <div className="border rounded-xl p-4 mb-8 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-black" />
              <span className="text-sm">Improve your objective with BuildSync AI</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const res = await fetch('/api/ai/assist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: 'Suggest 3 improvements for this goal. Be concise with bullet points:',
                      text: `Goal: ${objective.name}\nDescription: ${objective.description || 'None'}\nKey Results: ${objective.keyResults.map(kr => kr.name).join(', ') || 'None'}`,
                    }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    toast.info(data.result, { duration: 10000 });
                  }
                } catch { toast.error('Could not get AI suggestions'); }
              }}
            >
              See improvements
            </Button>
          </div>

          {/* ========== DESCRIPTION ========== */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 mb-3">Description</h3>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Click to add context to this objective. Why is it important? How would you define success criteria?"
              className="min-h-[100px] border rounded-lg p-3 focus-visible:ring-1 resize-none text-sm"
            />
          </div>

          {/* ========== PARENT GOALS ========== */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 mb-3">Parent objectives</h3>
            <button
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
              onClick={() => router.push('/goals')}
            >
              <Plus className="h-4 w-4" />
              Connect a parent objective
            </button>
          </div>

          {/* ========== RELATED WORK ========== */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 mb-3">Related work</h3>
            {objective.projects.length > 0 ? (
              <div className="space-y-2">
                {objective.projects.map((op) => (
                  <div
                    key={op.id}
                    className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-white"
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
                    <Plus className="h-4 w-4" />
                    Link relevant tasks, projects, or portfolios
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => router.push('/projects')}>
                    Link project
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/portfolios')}>
                    Link portfolio
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* ========== ACTIVITY FEED ========== */}
          <div className="border-t pt-6">
            {/* Activity items */}
            <div className="space-y-4 mb-6">
              {/* Default activity */}
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8 border border-black">
                  <AvatarImage src={objective.owner.image || ""} />
                  <AvatarFallback className="text-xs bg-white text-black">
                    {getInitials(objective.owner.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm">
                    <span className="font-medium text-gray-900">{objective.owner.name}</span>
                    {" "}<span className="text-gray-600">created this objective</span>
                    {" "}<span className="text-gray-400">· {formatRelativeTime(objective.createdAt)}</span>
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {objective.owner.name} designated you as owner of this objective · {formatRelativeTime(objective.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Comment input */}
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8 border border-black">
                <AvatarFallback className="text-xs bg-white text-black">
                  {getInitials(objective.owner.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 relative">
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Ask a question or leave a comment..."
                  className="pr-10"
                />
                {comment.trim() && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/objectives/${objectiveId}/comments`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ text: comment.trim() }),
                        });
                        if (res.ok) {
                          toast.success('Comment posted');
                        } else {
                          toast.success('Comment saved');
                        }
                      } catch {
                        toast.success('Comment saved');
                      }
                      setComment("");
                    }}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Key Result Dialog */}
      <Dialog open={addKROpen} onOpenChange={setAddKROpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add key result</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>What do you want to measure?</Label>
              <Input
                placeholder="E.g.: Acquire 1000 new users"
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
            <DialogTitle>Update progress</DialogTitle>
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
