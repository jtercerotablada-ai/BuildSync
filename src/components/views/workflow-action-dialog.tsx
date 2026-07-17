"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  type WorkflowAction,
  type WorkflowActionType,
  ACTION_LABELS,
} from "@/lib/workflow-types";

/**
 * Workflow action config dialog.
 *
 * After the user picks an action type from the "+ Add action"
 * dropdown, this dialog collects the targets the action needs
 * (assignee, collaborators list, comment template, project).
 *
 * MARK_COMPLETE has no target so the dialog skips itself — the
 * caller checks `actionNeedsConfig(type)` and POSTs directly.
 */

interface WorkflowUser {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
}

interface WorkflowProject {
  id: string;
  name: string;
  color: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: WorkflowActionType | null;
  onConfirm: (action: WorkflowAction) => void;
  // The project the workflow lives in — used to fetch its members
  // for the assignee/collaborator pickers and to exclude it from
  // the "Add to project" picker.
  projectId: string;
}

export function actionNeedsConfig(type: WorkflowActionType): boolean {
  return type !== "MARK_COMPLETE";
}

export function WorkflowActionDialog({
  open,
  onOpenChange,
  actionType,
  onConfirm,
  projectId,
}: Props) {
  // Shared state for each action subtype
  const [users, setUsers] = useState<WorkflowUser[]>([]);
  const [projects, setProjects] = useState<WorkflowProject[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  // Server-side search: the list used to be capped at whatever the
  // endpoint returned first, so people further down were unreachable.
  const [userQuery, setUserQuery] = useState("");

  // Per-action picked values
  const [pickedAssigneeId, setPickedAssigneeId] = useState<string | null>(null);
  const [pickedCollaboratorIds, setPickedCollaboratorIds] = useState<
    string[]
  >([]);
  const [commentContent, setCommentContent] = useState("");
  const [pickedProjectId, setPickedProjectId] = useState<string | null>(null);
  const [pickedPriority, setPickedPriority] = useState<
    "NONE" | "LOW" | "MEDIUM" | "HIGH"
  >("MEDIUM");
  const [subtaskName, setSubtaskName] = useState("");

  // Reset state when the dialog opens with a new action type
  useEffect(() => {
    if (!open) return;
    setPickedAssigneeId(null);
    setPickedCollaboratorIds([]);
    setCommentContent("");
    setPickedProjectId(null);
    setPickedPriority("MEDIUM");
    setSubtaskName("");
  }, [open, actionType]);

  // Load the right targets list for the action
  useEffect(() => {
    if (!open || !actionType) return;

    let canceled = false;
    async function load() {
      setLoadingTargets(true);
      setLoadError(false);
      try {
        if (
          actionType === "SET_ASSIGNEE" ||
          actionType === "ADD_COLLABORATORS"
        ) {
          // Workspace user search — same endpoint AssigneeSelector
          // uses. Empty query returns recent members.
          const res = await fetch(
            `/api/users/search?q=${encodeURIComponent(userQuery)}`
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as WorkflowUser[];
          if (!canceled) setUsers(Array.isArray(data) ? data : []);
        } else if (actionType === "ADD_TO_PROJECT") {
          // List of projects in the workspace, excluding the current
          // project (you can't "Add to another project" with itself).
          const res = await fetch(`/api/projects`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as Array<{
            id: string;
            name: string;
            color: string | null;
          }>;
          if (!canceled) {
            setProjects(
              Array.isArray(data) ? data.filter((p) => p.id !== projectId) : []
            );
          }
        }
      } catch {
        // A swallowed failure left an empty picker that looked like
        // "no people exist" — surface it and offer a retry instead.
        if (!canceled) setLoadError(true);
      } finally {
        if (!canceled) setLoadingTargets(false);
      }
    }
    load();
    return () => {
      canceled = true;
    };
  }, [open, actionType, projectId, userQuery, retryKey]);

  // ─── Confirm button ──────────────────────────────────────────
  function handleConfirm() {
    if (!actionType) return;
    let payload: WorkflowAction | null = null;
    switch (actionType) {
      case "SET_ASSIGNEE":
        // Picking nobody used to save `userId: null`, i.e. a silent
        // "unassign everyone who enters this section" rule — never what
        // someone clicking "Set assignee" means.
        if (!pickedAssigneeId) {
          toast.error("Pick a person to assign");
          return;
        }
        payload = { type: "SET_ASSIGNEE", userId: pickedAssigneeId };
        break;
      case "ADD_COLLABORATORS":
        if (pickedCollaboratorIds.length === 0) {
          toast.error("Pick at least one collaborator");
          return;
        }
        payload = {
          type: "ADD_COLLABORATORS",
          userIds: pickedCollaboratorIds,
        };
        break;
      case "ADD_COMMENT":
        if (!commentContent.trim()) {
          toast.error("Write a comment");
          return;
        }
        payload = { type: "ADD_COMMENT", content: commentContent.trim() };
        break;
      case "ADD_TO_PROJECT":
        if (!pickedProjectId) {
          toast.error("Pick a project");
          return;
        }
        payload = { type: "ADD_TO_PROJECT", projectId: pickedProjectId };
        break;
      case "SET_PRIORITY":
        payload = { type: "SET_PRIORITY", priority: pickedPriority };
        break;
      case "ADD_SUBTASK":
        if (!subtaskName.trim()) {
          toast.error("Name the subtask");
          return;
        }
        payload = { type: "ADD_SUBTASK", name: subtaskName.trim() };
        break;
      case "MARK_COMPLETE":
        payload = { type: "MARK_COMPLETE" };
        break;
    }
    if (payload) {
      onConfirm(payload);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {actionType ? ACTION_LABELS[actionType] : "Configure action"}
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-3">
          {/* SET_ASSIGNEE — single user pick */}
          {actionType === "SET_ASSIGNEE" && (
            <>
              <p className="text-sm text-slate-500">
                When a task enters this section, set the assignee to:
              </p>
              <UserSearchBox value={userQuery} onChange={setUserQuery} />
              {loadingTargets ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              ) : loadError ? (
                <LoadFailed onRetry={() => setRetryKey((k) => k + 1)} />
              ) : (
                <div className="space-y-1 max-h-72 overflow-auto border rounded-md">
                  {users.length === 0 && (
                    <p className="px-3 py-2 text-sm text-slate-400">
                      No people found
                    </p>
                  )}
                  {users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setPickedAssigneeId(u.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 text-left ${
                        pickedAssigneeId === u.id && "bg-[#c9a84c]/10"
                      }`}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={u.image || ""} />
                        <AvatarFallback className="text-[10px]">
                          {(u.name || u.email || "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{u.name || u.email || "Unknown"}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ADD_COLLABORATORS — multi user pick */}
          {actionType === "ADD_COLLABORATORS" && (
            <>
              <p className="text-sm text-slate-500">
                When a task enters this section, add these collaborators:
              </p>
              <UserSearchBox value={userQuery} onChange={setUserQuery} />
              {loadingTargets ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              ) : loadError ? (
                <LoadFailed onRetry={() => setRetryKey((k) => k + 1)} />
              ) : (
                <div className="space-y-1 max-h-72 overflow-auto border rounded-md">
                  {users.length === 0 && (
                    <p className="px-3 py-2 text-sm text-slate-400">
                      No people found
                    </p>
                  )}
                  {users.map((u) => {
                    const checked = pickedCollaboratorIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() =>
                          setPickedCollaboratorIds((prev) =>
                            checked
                              ? prev.filter((id) => id !== u.id)
                              : [...prev, u.id]
                          )
                        }
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 text-left ${
                          checked && "bg-[#c9a84c]/10"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          readOnly
                          className="rounded"
                        />
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={u.image || ""} />
                          <AvatarFallback className="text-[10px]">
                            {(u.name || u.email || "?")
                              .charAt(0)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{u.name || u.email || "Unknown"}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {pickedCollaboratorIds.length > 0 && (
                <p className="text-[11px] text-slate-500">
                  {pickedCollaboratorIds.length} selected
                </p>
              )}
            </>
          )}

          {/* ADD_COMMENT — text template */}
          {actionType === "ADD_COMMENT" && (
            <>
              <p className="text-sm text-slate-500">
                Comment to post on the task when it enters this section:
              </p>
              <Textarea
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder="e.g. @lead please review — this is ready for sign-off"
                rows={4}
                maxLength={4000}
                className="resize-none"
                autoFocus
              />
              <p className="text-[11px] text-slate-400 tabular-nums">
                {commentContent.length}/4000
              </p>
            </>
          )}

          {/* ADD_TO_PROJECT — pick another project */}
          {actionType === "ADD_TO_PROJECT" && (
            <>
              <p className="text-sm text-slate-500">
                When a task enters this section, also add it to:
              </p>
              {loadingTargets ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              ) : projects.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  No other projects available
                </p>
              ) : (
                <div className="space-y-1 max-h-72 overflow-auto border rounded-md">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPickedProjectId(p.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 text-left ${
                        pickedProjectId === p.id && "bg-[#c9a84c]/10"
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: p.color || "#c9a84c" }}
                      />
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* SET_PRIORITY — pick HIGH/MEDIUM/LOW/NONE */}
          {actionType === "SET_PRIORITY" && (
            <>
              <p className="text-sm text-slate-500">
                Set the task priority to:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["HIGH", "MEDIUM", "LOW", "NONE"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPickedPriority(p)}
                    className={`px-3 py-2 rounded-md border text-sm text-left transition-colors ${
                      pickedPriority === p
                        ? "border-[#c9a84c] bg-[#c9a84c]/10 text-[#a8893a] font-medium"
                        : "border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {p === "NONE"
                      ? "No priority"
                      : p.charAt(0) + p.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ADD_SUBTASK — name a subtask to create */}
          {actionType === "ADD_SUBTASK" && (
            <>
              <p className="text-sm text-slate-500">
                A subtask will be created on the task with this name:
              </p>
              <input
                type="text"
                value={subtaskName}
                onChange={(e) => setSubtaskName(e.target.value)}
                maxLength={200}
                placeholder="e.g. Confirm PE seal on file"
                className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-[#c9a84c]"
                autoFocus
              />
              <p className="text-[11px] text-slate-400">
                Idempotent: if a subtask with this exact name already
                exists on the task, the rule skips it instead of
                creating duplicates.
              </p>
            </>
          )}

          {/* MARK_COMPLETE — should never reach this dialog, but
              render a confirmation just in case. */}
          {actionType === "MARK_COMPLETE" && (
            <p className="text-sm text-slate-600">
              When a task enters this section, mark it complete.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="bg-black hover:bg-gray-900 text-white">
            Save action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Server-side people search — the picker previously showed only the first
 *  handful of workspace users with no way to reach anyone else. */
function UserSearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search people…"
        className="h-8 w-full rounded-md border border-slate-200 pl-7 pr-2 text-sm outline-none focus:border-slate-300"
      />
    </div>
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-slate-200 py-6">
      <p className="text-sm text-slate-500">Couldn&apos;t load options.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
