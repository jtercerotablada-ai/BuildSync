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
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  UserPlus,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GoalProgressChart } from "@/components/goals/goal-progress-chart";
import { ConfidenceRing } from "@/components/goals/confidence-ring";
import { CheckInDialog } from "@/components/goals/check-in-dialog";
import { LinkedWorkPanel } from "@/components/goals/linked-work-panel";
import { AICoachPanel } from "@/components/goals/ai-coach-panel";
import { ParentObjectivePicker } from "@/components/goals/parent-objective-picker";
import { KeyResultRow } from "@/components/goals/key-result-row";
import { AddKeyResultInline } from "@/components/goals/add-key-result-inline";
import {
  STATUS_OPTIONS as SHARED_STATUS_OPTIONS,
  getStatusOption as sharedGetStatusOption,
  getInitials as sharedGetInitials,
} from "@/lib/goal-utils";
import {
  formatRelativeTime as sharedFormatRelativeTime,
  getTimeRemaining as sharedGetTimeRemaining,
} from "@/lib/date-utils";
import { useUiState } from "@/hooks/use-ui-state";

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
    /** Null for a plain comment; a real status for a check-in. */
    status: string | null;
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

interface ObjectiveMember {
  id: string;
  userId: string;
  role: "EDITOR" | "VIEWER";
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface WorkspaceMemberLite {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
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
  // "Manual progress" set progressSource and then offered nothing to set the
  // number with — the CTA still said "use sub-objectives" and the only editor
  // on the page belonged to key results. This is that missing editor.
  const [manualProgress, setManualProgress] = useState<string>("");
  const [savingManual, setSavingManual] = useState(false);
  const [description, setDescription] = useState("");
  const [comment, setComment] = useState("");
  const [isLiked, setIsLiked] = useState(false);
  const { value: starredGoals, setValue: setStarredGoals } = useUiState<
    Record<string, boolean>
  >("starredGoals", {});
  // An un-star is stored as an explicit `false`, never as a missing key —
  // see toggleStar — so only `=== true` counts as starred.
  const isStarred = starredGoals[objectiveId] === true;
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [parentPickerOpen, setParentPickerOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);

  // ── Members state ──────────────────────────────────────────
  // Loaded after the objective itself so the UI can render a stack
  // of avatars + an "Add member" button right under the owner field.
  // The dialog is only shown when the caller is the creator (the
  // POST endpoint enforces this server-side too).
  const [members, setMembers] = useState<ObjectiveMember[]>([]);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [workspaceMembers, setWorkspaceMembers] = useState<
    WorkspaceMemberLite[]
  >([]);
  const [pendingRole, setPendingRole] = useState<"EDITOR" | "VIEWER">(
    "EDITOR"
  );
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);

  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
  const isCreator =
    !!currentUserId && objective?.owner?.id === currentUserId;

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

  async function handleRename() {
    if (!objective) return;
    // Trim before comparing and sending: a name of only spaces passes the
    // server's min(1) check and would leave the goal titled with blanks in
    // the list, the widget and every breadcrumb.
    const name = renameDraft.trim();
    if (!name || name === objective.name) {
      setRenameOpen(false);
      return;
    }
    setRenaming(true);
    try {
      const res = await fetch(`/api/objectives/${objective.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setObjective({ ...objective, name });
      setRenameOpen(false);
      toast.success("Goal updated");
    } catch {
      toast.error("Couldn't rename the goal");
    } finally {
      setRenaming(false);
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
    fetchMembers();
  }, [objectiveId]);

  // Workspace directory feeds the "Add member" search. Load once on
  // mount; ignore failures (the dialog falls back to empty list).
  useEffect(() => {
    fetch("/api/team/directory")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.members)) return;
        setWorkspaceMembers(
          (data.members as { id: string; name: string | null; email: string | null; image: string | null }[]).map(
            (m) => ({
              id: m.id,
              name: m.name,
              email: m.email,
              image: m.image,
            })
          )
        );
      })
      .catch(() => {});
  }, []);

  async function fetchMembers() {
    try {
      const res = await fetch(
        `/api/objectives/${objectiveId}/members`
      );
      if (res.ok) {
        const data = (await res.json()) as ObjectiveMember[];
        setMembers(data);
      }
    } catch {
      // Silent — members section just renders empty.
    }
  }

  async function handleAddMember(targetUserId: string) {
    if (addingMemberId) return;
    setAddingMemberId(targetUserId);
    try {
      const res = await fetch(
        `/api/objectives/${objectiveId}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: targetUserId, role: pendingRole }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed");
      }
      toast.success("Member added");
      await fetchMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add");
    } finally {
      setAddingMemberId(null);
    }
  }

  async function handleRemoveMember(targetUserId: string) {
    if (!confirm("Remove this member from the objective?")) return;
    const snapshot = members;
    setMembers((m) => m.filter((x) => x.userId !== targetUserId));
    try {
      const res = await fetch(
        `/api/objectives/${objectiveId}/members?userId=${targetUserId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
    } catch {
      setMembers(snapshot);
      toast.error("Couldn't remove member");
    }
  }

  // "Star" is a follow indicator — surfaces this goal in the user's
  // bookmark list. Kept in per-user uiState (not localStorage) until a real
  // GoalFollow model is added, so it follows the user across devices and
  // never shows up for whoever logs in next on a shared workstation. Likes
  // (ObjectiveLike) are a separate social signal and stay backed by the DB.
  //
  // One-time fold of the old browser-local array so nobody's existing stars
  // disappear; dropping the key makes this a no-op on every later mount.
  //
  // The preferences GET is read directly rather than folding into the hook's
  // value: `isHydrated` flips as soon as the localStorage cache is applied,
  // while the server request is still in flight, so folding then would run
  // against an empty map — hiding the stars saved on another device for the
  // rest of the session and re-starring goals that were un-starred there.
  // The legacy key is only dropped once we have something to fold it into,
  // so an offline visit can still migrate on the next mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let legacy: unknown;
    try {
      const raw = localStorage.getItem("goals.starred");
      if (!raw) return;
      legacy = JSON.parse(raw);
    } catch {
      try {
        localStorage.removeItem("goals.starred");
      } catch {
        // Storage disabled — nothing to clean up.
      }
      return;
    }
    const legacyIds = Array.isArray(legacy)
      ? (legacy as unknown[]).filter((id): id is string => typeof id === "string")
      : [];
    const dropLegacy = () => {
      try {
        localStorage.removeItem("goals.starred");
      } catch {
        // Storage disabled — the fold above is idempotent anyway.
      }
    };
    if (legacyIds.length === 0) {
      dropLegacy();
      return;
    }
    let canceled = false;
    fetch("/api/users/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (canceled || !data) return;
        const server = (data.uiState?.starredGoals ?? {}) as Record<
          string,
          boolean
        >;
        const merged = { ...server };
        let changed = false;
        for (const id of legacyIds) {
          // `undefined` only — a stored `false` is a deliberate un-star.
          if (merged[id] === undefined) {
            merged[id] = true;
            changed = true;
          }
        }
        if (changed) setStarredGoals(merged);
        dropLegacy();
      })
      .catch(() => {
        // Offline — keep the legacy key and try again on the next mount.
      });
    return () => {
      canceled = true;
    };
  }, [setStarredGoals]);

  function toggleStar() {
    const nowStarred = !isStarred;
    setStarredGoals((prev) => ({
      // A removal has to be written as `false`: PATCH /api/users/preferences
      // merges object-valued uiState keys one level deep, so an absent key is
      // restored from the stored map and the un-star would never persist.
      ...prev,
      [objectiveId]: nowStarred,
    }));
    toast.success(
      nowStarred ? "Added to starred goals" : "Removed from starred"
    );
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

      if (!res.ok) throw new Error();
      setObjective((prev) => prev ? { ...prev, status: status ?? "ON_TRACK" } : null);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Couldn't update status");
    }
  }

  async function handleDescriptionBlur() {
    if (objective && description !== objective.description) {
      // Keep the saved description on the objective too, otherwise every
      // subsequent blur still sees a mismatch and re-PATCHes the same text.
      const next = description;
      try {
        const res = await fetch(`/api/objectives/${objectiveId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: next }),
        });
        if (!res.ok) throw new Error();
        setObjective((prev) => prev ? { ...prev, description: next } : null);
      } catch (error) {
        console.error("Error updating description:", error);
        toast.error("Couldn't save the description");
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

      if (!res.ok) {
        // Surface the API's reason (e.g. start and target being equal)
        // — a bare "Couldn't add the key result" left the user retrying
        // the exact same payload with nothing to correct.
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      await fetchObjective();
      setAddKROpen(false);
      setNewKR({ name: "", targetValue: 100, startValue: 0, unit: "" });
    } catch (error) {
      console.error("Error adding key result:", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't add the key result"
      );
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

      if (!res.ok) throw new Error();
      await fetchObjective();
      setUpdateKROpen(false);
      setSelectedKR(null);
    } catch (error) {
      console.error("Error updating key result:", error);
      toast.error("Couldn't update the key result");
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

      if (!res.ok) throw new Error();
      await fetchObjective();
    } catch (error) {
      console.error("Error deleting key result:", error);
      toast.error("Couldn't delete the key result");
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
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-gray-500 hidden md:inline-flex"
            onClick={() =>
              window.open(
                "mailto:feedback@ttcivilstructural.com?subject=Goals%20Feedback",
                "_blank"
              )
            }
          >
            Send feedback
          </Button>
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
              setRenameDraft(objective.name);
              setRenameOpen(true);
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

          {/* Status pill — colored chip with current label, dropdown
              to change. Replaces the previous "Set status" ghost
              button that just showed a dot. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full text-xs md:text-sm font-medium transition-opacity hover:opacity-90",
                  currentStatus.color,
                  currentStatus.color.includes("gray-3")
                    ? "text-gray-800"
                    : "text-white"
                )}
              >
                <span className="hidden sm:inline">{currentStatus.label}</span>
                <span className="sm:hidden">·</span>
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* STATUS_OPTIONS ends with a null "No status" entry that only
                  exists so getStatusOption has a fallback. The PATCH schema
                  doesn't accept null, so offering it here was a menu item that
                  could never succeed. */}
              {STATUS_OPTIONS.filter((option) => option.value !== null).map((option) => (
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

            {/* Members — stack of avatars + add button. Mirrors the
                Asana "Miembros" row in the objective dialog. Only
                the creator sees the "Add member" affordance + remove
                X's (server enforces this too, but UI matches). */}
            <div className="flex items-start">
              <span className="w-32 md:w-44 text-xs md:text-sm text-gray-500 flex-shrink-0 pt-1">
                Members
              </span>
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {members.length === 0 && !isCreator && (
                  <span className="text-sm text-gray-400">No members</span>
                )}
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="group relative inline-flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-full border border-gray-200 bg-white"
                    title={`${m.user.name ?? m.user.email ?? "Member"} · ${m.role}`}
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={m.user.image || ""} />
                      <AvatarFallback className="text-[9px] bg-[#d4b65a] text-white">
                        {getInitials(m.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-gray-700 max-w-[100px] truncate">
                      {m.user.name?.split(" ")[0] ??
                        m.user.email?.split("@")[0] ??
                        "—"}
                    </span>
                    {isCreator && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.userId)}
                        className="ml-0.5 p-0.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-gray-100 text-gray-400 hover:text-rose-600 transition-opacity"
                        title="Remove member"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                ))}
                {isCreator && (
                  <button
                    type="button"
                    onClick={() => setAddMemberOpen(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-xs text-gray-500 hover:border-[#c9a84c] hover:text-[#a8893a] transition-colors"
                  >
                    <UserPlus className="w-3 h-3" />
                    Add member
                  </button>
                )}
              </div>
            </div>

            {/* Period */}
            <div className="flex items-center">
              <span className="w-32 md:w-44 text-xs md:text-sm text-gray-500 flex-shrink-0">Period</span>
              <span className="text-sm">{objective.period || "No period"}</span>
            </div>

            {/* Due date — popover-based picker. The previous implementation
                stacked an invisible <input type="date"> on top of the button
                via `absolute inset-0`, which made every click hit the input
                first and never trigger the picker — Juan reported needing
                "muchos clicks" before it opened. A Popover + Calendar
                component takes one click reliably. */}
            <div className="flex items-center">
              <span className="w-32 md:w-44 text-xs md:text-sm text-gray-500 flex-shrink-0">
                Due date
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1.5 rounded px-2 py-1 -mx-2 hover:bg-gray-50 transition-colors"
                  >
                    <Calendar className="h-4 w-4" />
                    {objective.endDate
                      ? new Date(objective.endDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Set due date"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={
                      objective.endDate ? new Date(objective.endDate) : undefined
                    }
                    onSelect={async (date) => {
                      const iso = date ? date.toISOString() : null;
                      try {
                        const res = await fetch(
                          `/api/objectives/${objectiveId}`,
                          {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ endDate: iso }),
                          }
                        );
                        if (res.ok) {
                          setObjective((prev) =>
                            prev ? { ...prev, endDate: iso } : null
                          );
                          toast.success(
                            iso ? "Due date updated" : "Due date cleared"
                          );
                        } else {
                          toast.error("Error updating date");
                        }
                      } catch {
                        toast.error("Error updating date");
                      }
                    }}
                    initialFocus
                  />
                  {objective.endDate && (
                    <div className="border-t p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-gray-600 hover:text-black"
                        onClick={async () => {
                          try {
                            const res = await fetch(
                              `/api/objectives/${objectiveId}`,
                              {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ endDate: null }),
                              }
                            );
                            if (res.ok) {
                              setObjective((prev) =>
                                prev ? { ...prev, endDate: null } : null
                              );
                              toast.success("Due date cleared");
                            }
                          } catch {
                            toast.error("Error clearing date");
                          }
                        }}
                      >
                        Clear due date
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
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

          {/* ========== PROGRESS + CONFIDENCE SUMMARY ========== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
            {/* Goal completion card */}
            <div className="border rounded-xl p-4 md:p-6 text-center">
              <p className="text-xs md:text-sm text-gray-500 mb-2">
                Objective completion
              </p>
              <p className="text-3xl md:text-4xl font-bold text-gray-900 mb-1">
                {objective.progress}%
              </p>
              <p className="text-xs text-gray-400">
                {getTimeRemaining(objective.period, objective.endDate) || "—"}
              </p>
            </div>

            {/* Confidence + check-in card — replaces the old
                duplicated "Latest status" card (status now lives in
                the colored pill in the header). */}
            <div className="border rounded-xl p-4 md:p-6 flex items-center gap-4">
              <ConfidenceRing
                score={objective.confidenceScore ?? null}
                onChange={handleConfidenceChange}
                size={72}
              />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs md:text-sm text-gray-500 mb-1">
                  Owner confidence
                </p>
                <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                  {objective.lastCheckInAt
                    ? `Last check-in ${formatRelativeTime(objective.lastCheckInAt)}`
                    : "No check-in yet"}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCheckInOpen(true)}
                  className="h-7 text-xs"
                >
                  <Send className="w-3 h-3 mr-1.5" />
                  Check in
                </Button>
              </div>
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

            {/* Manual progress editor — only meaningful when the goal's
                progress is not derived from key results / sub-objectives. */}
            {objective.progressSource === "MANUAL" && (
              <div className="flex flex-wrap items-end gap-2 justify-center mb-4">
                <div className="space-y-1">
                  <Label htmlFor="manual-progress" className="text-xs">
                    Completion
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="manual-progress"
                      type="number"
                      min={0}
                      max={100}
                      className="w-24"
                      value={manualProgress}
                      placeholder={String(objective.progress)}
                      onChange={(e) => setManualProgress(e.target.value)}
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  disabled={savingManual || manualProgress.trim() === ""}
                  onClick={async () => {
                    const next = Math.round(Number(manualProgress));
                    if (!Number.isFinite(next) || next < 0 || next > 100) {
                      toast.error("Enter a number between 0 and 100");
                      return;
                    }
                    setSavingManual(true);
                    try {
                      const res = await fetch(`/api/objectives/${objectiveId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ progress: next }),
                      });
                      if (!res.ok) throw new Error();
                      setObjective((prev) =>
                        prev ? { ...prev, progress: next } : null
                      );
                      setManualProgress("");
                      toast.success("Progress updated");
                    } catch {
                      toast.error("Couldn't update progress");
                    } finally {
                      setSavingManual(false);
                    }
                  }}
                >
                  {savingManual ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            )}

            {/* ========== CHART ========== */}
            <GoalProgressChart
              progress={objective.progress}
              period={objective.period || undefined}
              startDate={objective.startDate || objective.createdAt}
              endDate={objective.endDate || undefined}
            />

            {/* CTA — only when progress is actually derived from something
                else. In MANUAL mode the editor above IS the control. */}
            {objective.progressSource !== "MANUAL" && (
              <>
                <p className="text-sm text-gray-500 text-center my-6">
                  {objective.progressSource === "SUB_OBJECTIVES"
                    ? "Sub-objectives keep this objective's progress up to date."
                    : "Key results keep this objective's progress up to date."}
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
              </>
            )}
          </div>

          {/* ========== KEY RESULTS SECTION ========== */}
          <div className="mb-6 md:mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                Key results
                <span className="ml-2 text-xs font-normal text-gray-400 tabular-nums">
                  {objective.keyResults.length}
                </span>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500"
                onClick={() => setAddKROpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Advanced add</span>
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
                    const full = objective.keyResults.find(
                      (k) => k.id === rowKr.id
                    );
                    if (full) openUpdateDialog(full);
                  }}
                />
              ))}
              {/* Always-visible inline creator at the bottom — no
                  modal required for the common case (name + target). */}
              <AddKeyResultInline
                objectiveId={objectiveId}
                onAdded={fetchObjective}
              />
            </div>
          </div>

          {/* AI Coach lives alone now — the check-in/confidence
              widget moved up into the 2-up summary card above. */}
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
                    status: string | null;
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
                      // A row with no status is a comment someone left, not a
                      // check-in — say so, and leave off the status dot.
                      const isCheckIn = item.status != null;
                      const statusOption = isCheckIn
                        ? getStatusOption(item.status as string)
                        : null;
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
                                {isCheckIn ? "posted a check-in" : "commented"}
                              </span>{" "}
                              <span className="text-gray-400">
                                · {formatRelativeTime(item.createdAt)}
                              </span>
                            </p>
                            <div className="mt-1 inline-flex items-start gap-2 px-3 py-2 bg-gray-50 rounded-lg max-w-full">
                              {statusOption && (
                                <div
                                  className={cn(
                                    "h-3 w-3 rounded-full flex-shrink-0 mt-1",
                                    statusOption.color
                                  )}
                                />
                              )}
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

      {/* Rename Objective Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit objective</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Objective name</Label>
              <Input
                autoFocus
                maxLength={200}
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleRename();
                  }
                }}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleRename}
              disabled={renaming || !renameDraft.trim()}
            >
              {renaming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
            {newKR.targetValue === newKR.startValue && (
              <p className="text-sm text-gray-500">
                Target must differ from the start value — there is no range to
                measure progress against.
              </p>
            )}
            <Button
              className="w-full"
              onClick={handleAddKeyResult}
              disabled={
                saving ||
                !newKR.name.trim() ||
                newKR.targetValue === newKR.startValue
              }
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

      {/* ========== ADD MEMBER DIALOG ========== */}
      {/* Matches the Asana "Miembros" picker: workspace member search
          on top, role selector, click a row to add. Already-members
          and the creator are filtered out of the picker so you can't
          double-add or invite yourself. */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Search</Label>
              <Input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Name or email…"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select
                value={pendingRole}
                onValueChange={(v) =>
                  setPendingRole(v as "EDITOR" | "VIEWER")
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EDITOR">
                    <span className="font-medium">Editor</span>
                    <span className="text-[11px] text-gray-500 ml-2">
                      Can edit + comment
                    </span>
                  </SelectItem>
                  <SelectItem value="VIEWER">
                    <span className="font-medium">Viewer</span>
                    <span className="text-[11px] text-gray-500 ml-2">
                      Read-only
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-[280px] overflow-y-auto -mx-1">
              {(() => {
                const onAlready = new Set([
                  ...members.map((m) => m.userId),
                  objective.owner.id,
                ]);
                const q = memberSearch.trim().toLowerCase();
                const candidates = workspaceMembers
                  .filter((u) => !onAlready.has(u.id))
                  .filter((u) => {
                    if (!q) return true;
                    const n = (u.name || "").toLowerCase();
                    const e = (u.email || "").toLowerCase();
                    return n.includes(q) || e.includes(q);
                  })
                  .slice(0, 8);

                if (candidates.length === 0) {
                  return (
                    <p className="px-3 py-4 text-center text-xs text-gray-400">
                      {workspaceMembers.length === 0
                        ? "No workspace members loaded."
                        : "No matches. Everyone may already be a member."}
                    </p>
                  );
                }

                return candidates.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleAddMember(u.id)}
                    disabled={addingMemberId !== null}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-50 text-left disabled:opacity-50"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={u.image || ""} />
                      <AvatarFallback className="text-[10px] bg-[#d4b65a] text-white">
                        {getInitials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {u.name || "—"}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {u.email}
                      </p>
                    </div>
                    {addingMemberId === u.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#c9a84c]" />
                    ) : (
                      <UserPlus className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                ));
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
