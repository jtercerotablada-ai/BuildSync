"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
import {
  Plus,
  Target,
  Loader2,
  Trash2,
  Calendar,
  Edit2,
  ThumbsUp,
  Star,
  Users,
  Settings2,
  Zap,
  ChevronDown,
  AlertTriangle,
  Flag,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GoalProgressChart } from "@/components/goals/goal-progress-chart";
import { ConfidenceRing } from "@/components/goals/confidence-ring";
import { CheckInDialog } from "@/components/goals/check-in-dialog";
import { LinkedWorkPanel } from "@/components/goals/linked-work-panel";
import { AICoachPanel } from "@/components/goals/ai-coach-panel";
import { ParentObjectivePicker } from "@/components/goals/parent-objective-picker";
import { KeyResultRow } from "@/components/goals/key-result-row";
import {
  STATUS_OPTIONS as SHARED_STATUS_OPTIONS,
  getStatusOption as sharedGetStatusOption,
  getInitials as sharedGetInitials,
} from "@/lib/goal-utils";
import {
  formatRelativeTime as sharedFormatRelativeTime,
  getTimeRemaining as sharedGetTimeRemaining,
} from "@/lib/date-utils";

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
  workspace?: {
    id: string;
    name: string;
  };
  parent?: { id: string; name: string } | null;
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
  statusUpdates?: {
    id: string;
    status: string;
    summary: string;
    createdAt: string;
    author?: {
      id: string;
      name: string | null;
      image: string | null;
    } | null;
  }[];
  likedByMe?: boolean;
  _count: {
    keyResults: number;
    children: number;
    projects: number;
    likes?: number;
  };
}

// Re-export the shared options under the local names so the rest of
// the file (which already references `STATUS_OPTIONS`, `getInitials`,
// `formatRelativeTime`, `getTimeRemaining`) keeps working without
// having to rename every callsite.
const STATUS_OPTIONS = SHARED_STATUS_OPTIONS;
const getInitials = sharedGetInitials;
const formatRelativeTime = sharedFormatRelativeTime;

function getTimeRemaining(period: string | null, endDate: string | null): string {
  return sharedGetTimeRemaining(period, endDate);
}

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
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
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [parentPickerOpen, setParentPickerOpen] = useState(false);

  async function handleConfidenceChange(next: number) {
    try {
      const res = await fetch(`/api/objectives/${objectiveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confidenceScore: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setObjective((prev) =>
        prev ? { ...prev, confidenceScore: next } : null
      );
      toast.success("Confidence updated");
    } catch {
      toast.error("Couldn't update confidence");
    }
  }

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

  // "Star" is a local follow indicator — surfaces this goal in the
  // user's bookmark list. We keep it in localStorage until a real
  // GoalFollow model is added. Likes (ObjectiveLike) are a separate
  // social signal and stay backed by the database.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("goals.starred");
      const list: string[] = raw ? JSON.parse(raw) : [];
      setIsStarred(list.includes(objectiveId));
    } catch {
      // ignore
    }
  }, [objectiveId]);

  function toggleStar() {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("goals.starred");
      const list: string[] = raw ? JSON.parse(raw) : [];
      const next = list.includes(objectiveId)
        ? list.filter((id) => id !== objectiveId)
        : [...list, objectiveId];
      localStorage.setItem("goals.starred", JSON.stringify(next));
      setIsStarred(next.includes(objectiveId));
      toast.success(
        next.includes(objectiveId)
          ? "Added to starred goals"
          : "Removed from starred"
      );
    } catch {
      toast.error("Couldn't update star");
    }
  }

  async function fetchObjective() {
    try {
      const res = await fetch(`/api/objectives/${objectiveId}`);
      if (res.ok) {
        const data = await res.json();
        setObjective(data);
        setDescription(data.description || "");
        setIsLiked(!!data.likedByMe);
      }
    } catch (error) {
      console.error("Error fetching objective:", error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleLike() {
    // Optimistic update
    setIsLiked((prev) => !prev);
    try {
      const res = await fetch(`/api/objectives/${objectiveId}/likes`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setIsLiked(!!data.liked);
    } catch {
      // Revert on failure
      setIsLiked((prev) => !prev);
      toast.error("Could not update like");
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
        setObjective((prev) => prev ? { ...prev, status: status ?? "ON_TRACK" } : null);
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
      <div className="border-b px-4 md:px-6 py-3 flex items-center justify-between bg-white sticky top-0 z-10">
        <span className="text-xs md:text-sm text-gray-500 truncate pr-2">
          Goals of {objective.workspace?.name || "My workspace"}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
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
      <div className="border-b px-4 md:px-6 py-3 flex items-center gap-2 md:gap-3 bg-white">
        {/* Goal icon */}
        <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
          <Flag className="h-4 w-4 text-white" />
        </div>

        {/* Goal name dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 text-base font-medium hover:bg-gray-100 px-2 py-1 rounded min-w-0 max-w-[140px] md:max-w-none">
              <span className="truncate">{objective.name}</span>
              <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
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
                // Copy the KR scaffold (names, units, targets, start
                // values) but reset currentValue so the new goal
                // starts at 0% — duplicating a goal at 80% progress
                // and inheriting that 80% wouldn't be useful.
                const res = await fetch('/api/objectives', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: `${objective.name} (copy)`,
                    period: objective.period,
                    description: objective.description,
                    progressSource: objective.progressSource,
                    keyResults: objective.keyResults.map((kr) => ({
                      name: kr.name,
                      description: kr.description ?? undefined,
                      targetValue: kr.targetValue,
                      startValue: kr.startValue,
                      currentValue: kr.startValue,
                      unit: kr.unit ?? undefined,
                      format: kr.format === "NUMBER" ||
                              kr.format === "PERCENTAGE" ||
                              kr.format === "CURRENCY" ||
                              kr.format === "BOOLEAN"
                        ? kr.format
                        : "NUMBER",
                    })),
                  }),
                });
                if (res.ok) {
                  const newObj = await res.json();
                  toast.success(`Goal duplicated with ${objective.keyResults.length} key results`);
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
            className={cn("h-8 w-8 hidden sm:inline-flex", isLiked && "text-black")}
            onClick={toggleLike}
          >
            <ThumbsUp className={cn("h-4 w-4", isLiked && "fill-current")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 hidden sm:inline-flex",
              isStarred && "text-[#c9a84c]"
            )}
            onClick={toggleStar}
            aria-label={isStarred ? "Unstar goal" : "Star goal"}
          >
            <Star className={cn("h-4 w-4", isStarred && "fill-current")} />
          </Button>

          {/* Status button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-gray-600 px-2 md:px-3">
                <div className={cn("h-3 w-3 rounded-full flex-shrink-0", currentStatus.color)} />
                <span className="hidden sm:inline">Set status</span>
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
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Goal Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8 break-words">{objective.name}</h1>

          {/* ========== META FIELDS ========== */}
          <div className="space-y-3 md:space-y-4 mb-6">
            {/* Objective owner */}
            <div className="flex items-center">
              <span className="w-32 md:w-44 text-xs md:text-sm text-gray-500 flex-shrink-0">Objective owner</span>
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-6 w-6 border border-black flex-shrink-0">
                  <AvatarImage src={objective.owner.image || ""} />
                  <AvatarFallback className="text-xs bg-white text-black">
                    {getInitials(objective.owner.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm truncate">{objective.owner.name}</span>
              </div>
            </div>

            {/* Period */}
            <div className="flex items-center">
              <span className="w-32 md:w-44 text-xs md:text-sm text-gray-500 flex-shrink-0">Period</span>
              <span className="text-sm">{objective.period || "No period"}</span>
            </div>

            {/* Due date */}
            <div className="flex items-center">
              <span className="w-32 md:w-44 text-xs md:text-sm text-gray-500 flex-shrink-0">Due date</span>
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
              <span className="w-32 md:w-44 text-xs md:text-sm text-gray-500 flex-shrink-0">Responsible team</span>
              <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
                <Users className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{objective.team?.name || "No team"}</span>
              </div>
            </div>

          </div>

          {/* Send feedback link */}
          <button
            className="text-sm text-gray-500 hover:underline mb-8 block"
            onClick={() => window.open('mailto:feedback@ttcivilstructural.com?subject=Goals%20Feedback', '_blank')}
          >
            Send feedback
          </button>

          {/* ========== PROGRESS CARDS ========== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
            {/* Goal completion card */}
            <div className="border rounded-xl p-4 md:p-6 text-center">
              <p className="text-xs md:text-sm text-gray-500 mb-2">Objective completion</p>
              <p className="text-3xl md:text-4xl font-bold text-gray-900 mb-1">{objective.progress}%</p>
              <p className="text-xs text-gray-400">
                {getTimeRemaining(objective.period, objective.endDate)}
              </p>
            </div>

            {/* Status card */}
            <div className="border rounded-xl p-4 md:p-6 text-center">
              <p className="text-xs md:text-sm text-gray-500 mb-2">Latest status</p>
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className={cn("h-4 w-4 rounded-full flex-shrink-0", currentStatus.color)} />
                <span className={cn("text-base md:text-lg font-medium", currentStatus.textColor)}>
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
          <div className="mb-6 md:mb-8">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h3 className="font-semibold text-gray-900">Progress</h3>
                <Zap className="h-4 w-4 text-black flex-shrink-0" />
                {hasNoSubgoals && (
                  <span className="text-xs md:text-sm text-black flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0" />
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
                      const res = await fetch(`/api/objectives/${objectiveId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ progressSource: 'MANUAL' }),
                      });
                      if (!res.ok) throw new Error();
                      setObjective((prev) => prev ? { ...prev, progressSource: 'MANUAL' } : null);
                      toast.success('Progress: Manual');
                    } catch { toast.error('Error'); }
                  }}>
                    Manual progress
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    try {
                      const res = await fetch(`/api/objectives/${objectiveId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ progressSource: 'SUB_OBJECTIVES' }),
                      });
                      if (!res.ok) throw new Error();
                      setObjective((prev) => prev ? { ...prev, progressSource: 'SUB_OBJECTIVES' } : null);
                      toast.success('Progress: From sub-objectives');
                    } catch { toast.error('Error'); }
                  }}>
                    From sub-objectives
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    try {
                      const res = await fetch(`/api/objectives/${objectiveId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ progressSource: 'KEY_RESULTS' }),
                      });
                      if (!res.ok) throw new Error();
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
            <div className="mb-6 md:mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Key results</h3>
                <Button variant="ghost" size="sm" className="text-gray-500" onClick={() => setAddKROpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Add key result</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </div>
              {/* Inline-editing rows: click the name to rename, click
                  the value to update progress. The "Update with note"
                  button still opens the dialog when the user wants
                  to attach a note to the progress change. */}
              <div className="space-y-3">
                {objective.keyResults.map((kr) => (
                  <KeyResultRow
                    key={kr.id}
                    kr={kr}
                    objectiveId={objectiveId}
                    onChanged={fetchObjective}
                    onDelete={handleDeleteKeyResult}
                    // Lookup by id so KeyResultRow's local KR type (no
                    // `updates` field) doesn't have to match the
                    // page's richer interface — keeps the row reusable.
                    onOpenNoteDialog={(rowKr) => {
                      const full = objective.keyResults.find((k) => k.id === rowKr.id);
                      if (full) openUpdateDialog(full);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ========== CHECK-IN BAR + AI COACH ========== */}
          <div className="border rounded-xl bg-white p-4 mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ConfidenceRing
                score={objective.confidenceScore ?? null}
                onChange={handleConfidenceChange}
                size={56}
              />
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Confidence
                </p>
                <p className="text-xs text-gray-600 max-w-[260px]">
                  {objective.lastCheckInAt
                    ? `Last check-in ${formatRelativeTime(objective.lastCheckInAt)}`
                    : "No check-in yet — share where you stand"}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setCheckInOpen(true)}
              className="bg-black hover:bg-gray-900 text-white"
            >
              <Send className="w-3.5 h-3.5 mr-2" />
              Check in this week
            </Button>
          </div>

          <AICoachPanel objectiveId={objective.id} />

          <CheckInDialog
            open={checkInOpen}
            onOpenChange={setCheckInOpen}
            objectiveId={objective.id}
            currentStatus={objective.status}
            currentConfidence={objective.confidenceScore ?? null}
            onSuccess={fetchObjective}
          />

          <ParentObjectivePicker
            open={parentPickerOpen}
            onOpenChange={setParentPickerOpen}
            objectiveId={objective.id}
            currentParent={objective.parent ?? null}
            onChanged={fetchObjective}
          />

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

          {/* ========== PARENT OBJECTIVE ========== */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 mb-3">Parent objective</h3>
            {objective.parent ? (
              <div className="group flex items-center gap-3 border rounded-lg px-3 py-2 bg-white hover:border-gray-400 transition-colors">
                <Flag className="h-4 w-4 text-[#c9a84c] flex-shrink-0" />
                <Link
                  href={`/goals/${objective.parent.id}`}
                  className="flex-1 text-sm font-medium text-black hover:underline truncate"
                >
                  {objective.parent.name}
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-gray-500"
                  onClick={() => setParentPickerOpen(true)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setParentPickerOpen(true)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors"
              >
                <Plus className="h-4 w-4" />
                Connect a parent objective
              </button>
            )}
          </div>

          {/* ========== LINKED WORK (projects + tasks) ========== */}
          <LinkedWorkPanel
            objectiveId={objective.id}
            progressSource={objective.progressSource}
            onChanged={fetchObjective}
          />

          {/* ========== ACTIVITY FEED ========== */}
          <div className="border-t pt-6">
            <h3 className="font-semibold text-gray-900 mb-4">Activity</h3>
            {/* Build a single chronological timeline from heterogeneous
                events: check-ins (ObjectiveStatusUpdate), KR progress
                updates (KeyResultUpdate), and the creation event. Sort
                newest-first so the user sees what changed most recently. */}
            {(() => {
              type FeedItem =
                | {
                    kind: "checkin";
                    id: string;
                    createdAt: string;
                    status: string;
                    summary: string;
                    author: { name: string | null; image: string | null } | null;
                  }
                | {
                    kind: "kr";
                    id: string;
                    createdAt: string;
                    krName: string;
                    krUnit: string | null;
                    previousValue: number;
                    newValue: number;
                    note: string | null;
                  }
                | {
                    kind: "created";
                    id: string;
                    createdAt: string;
                    author: { name: string | null; image: string | null };
                  };

              const items: FeedItem[] = [];

              for (const update of objective.statusUpdates || []) {
                items.push({
                  kind: "checkin",
                  id: `c-${update.id}`,
                  createdAt: update.createdAt,
                  status: update.status,
                  summary: update.summary,
                  author: update.author || {
                    name: objective.owner.name,
                    image: objective.owner.image,
                  },
                });
              }

              for (const kr of objective.keyResults) {
                for (const u of kr.updates) {
                  items.push({
                    kind: "kr",
                    id: `kr-${u.id}`,
                    createdAt: u.createdAt,
                    krName: kr.name,
                    krUnit: kr.unit,
                    previousValue: u.previousValue,
                    newValue: u.newValue,
                    note: u.note,
                  });
                }
              }

              items.push({
                kind: "created",
                id: `created-${objective.id}`,
                createdAt: objective.createdAt,
                author: objective.owner,
              });

              items.sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
              );

              return (
                <div className="space-y-4 mb-6">
                  {items.map((item) => {
                    if (item.kind === "checkin") {
                      const author = item.author;
                      const statusOption = getStatusOption(item.status);
                      return (
                        <div key={item.id} className="flex items-start gap-3">
                          <Avatar className="h-8 w-8 border border-black flex-shrink-0">
                            <AvatarImage src={author?.image || ""} />
                            <AvatarFallback className="text-xs bg-white text-black">
                              {getInitials(author?.name || null)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-medium text-gray-900">
                                {author?.name || "Someone"}
                              </span>{" "}
                              <span className="text-gray-600">
                                posted a check-in
                              </span>{" "}
                              <span className="text-gray-400">
                                · {formatRelativeTime(item.createdAt)}
                              </span>
                            </p>
                            <div className="mt-1 inline-flex items-start gap-2 px-3 py-2 bg-gray-50 rounded-lg max-w-full">
                              <div
                                className={cn(
                                  "h-3 w-3 rounded-full flex-shrink-0 mt-1",
                                  statusOption.color
                                )}
                              />
                              <p className="text-sm text-gray-700 break-words whitespace-pre-wrap">
                                {item.summary}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    if (item.kind === "kr") {
                      const delta = item.newValue - item.previousValue;
                      const deltaStr =
                        delta > 0
                          ? `+${delta.toLocaleString()}`
                          : delta.toLocaleString();
                      return (
                        <div key={item.id} className="flex items-start gap-3">
                          <Avatar className="h-8 w-8 border border-black flex-shrink-0">
                            <AvatarFallback className="text-xs bg-white text-black">
                              KR
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="text-gray-600">
                                <span className="font-medium text-gray-900">
                                  {item.krName}
                                </span>{" "}
                                updated from{" "}
                                {item.previousValue.toLocaleString()} →{" "}
                                {item.newValue.toLocaleString()}
                                {item.krUnit ? ` ${item.krUnit}` : ""}{" "}
                                <span className="font-medium text-[#c9a84c]">
                                  ({deltaStr})
                                </span>
                              </span>{" "}
                              <span className="text-gray-400">
                                · {formatRelativeTime(item.createdAt)}
                              </span>
                            </p>
                            {item.note && (
                              <p className="text-xs text-gray-500 mt-1 italic">
                                "{item.note}"
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }
                    // created
                    return (
                      <div key={item.id} className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 border border-black flex-shrink-0">
                          <AvatarImage src={item.author.image || ""} />
                          <AvatarFallback className="text-xs bg-white text-black">
                            {getInitials(item.author.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm">
                            <span className="font-medium text-gray-900">
                              {item.author.name || "Someone"}
                            </span>{" "}
                            <span className="text-gray-600">
                              created this objective
                            </span>{" "}
                            <span className="text-gray-400">
                              · {formatRelativeTime(item.createdAt)}
                            </span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Comment input */}
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8 border border-black flex-shrink-0">
                <AvatarImage src={session?.user?.image || ""} />
                <AvatarFallback className="text-xs bg-white text-black">
                  {getInitials(session?.user?.name || null)}
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
                          setComment("");
                          await fetchObjective();
                        } else {
                          toast.error('Failed to post comment');
                        }
                      } catch {
                        toast.error('Failed to post comment');
                      }
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
