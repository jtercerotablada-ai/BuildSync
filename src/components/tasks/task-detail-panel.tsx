"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  X,
  Check,
  Heart,
  Link2,
  Paperclip,
  MoreHorizontal,
  Maximize2,
  Diamond,
  ThumbsUp,
  Plus,
  Loader2,
  Flag,
  Globe,
  Download,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AssigneeSelector } from "@/components/tasks/assignee-selector";
import { DueDatePicker } from "@/components/tasks/due-date-picker";
import { ProjectSelector } from "@/components/tasks/project-selector";
import { FileViewerModal } from "@/components/files/file-viewer-modal";
import { downloadFile } from "@/lib/download";
import {
  formatFileSize,
  formatRangeLabel,
  formatDueDateLabel,
  projectTypeShort,
  formatGateShort,
} from "@/lib/task-helpers";

/**
 * Task detail slide-over panel — the right-side panel that opens
 * when the user clicks a task anywhere in the app. This is the
 * cockpit-wide single source of truth for editing a task; my-tasks,
 * project list/board/calendar/timeline all open this same component.
 *
 * The panel fetches its own detail by taskId so callers only need
 * to pass the id and an onClose handler.
 */

interface TaskDetailPanelProps {
  taskId: string;
  onClose: () => void;
  /**
   * Optional — fires after any successful mutation (PATCH, attachment
   * upload, subtask add, comment add). Parent uses it to refresh the
   * list/board/calendar render so the change is visible immediately
   * without waiting for the next router refresh.
   */
  onUpdate?: () => void;
  /** Fires specifically when attachments change, in case the parent
   *  is showing an attachment-count badge that needs to recalc. */
  onAttachmentsChange?: () => void;
}

interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

interface TaskComment {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
  attachments?: TaskAttachment[];
}

interface TaskActivity {
  id: string;
  type: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

interface TaskSubtask {
  id: string;
  name: string;
  completed: boolean;
}

interface TaskCollaborator {
  id: string;
  name: string | null;
  image?: string | null;
}

interface TaskDetail {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  dueDate: string | null;
  startDate: string | null;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH" | string;
  taskType?: "TASK" | "MILESTONE" | "APPROVAL" | null;
  assignee: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  project: {
    id: string;
    name: string;
    color: string;
    type?: "CONSTRUCTION" | "DESIGN" | "RECERTIFICATION" | "PERMIT" | null;
    gate?:
      | "PRE_DESIGN"
      | "DESIGN"
      | "PERMITTING"
      | "CONSTRUCTION"
      | "CLOSEOUT"
      | null;
  } | null;
  section?: { id: string; name: string } | null;
  subtasks?: TaskSubtask[];
  comments?: TaskComment[];
  activities?: TaskActivity[];
  attachments?: TaskAttachment[];
  collaborators?: TaskCollaborator[];
}

export function TaskDetailPanel({
  taskId,
  onClose,
  onUpdate,
  onAttachmentsChange,
}: TaskDetailPanelProps) {
  const router = useRouter();

  // ── Data state ────────────────────────────────────────────────
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Inline-edit state for name / description ──────────────────
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // ── UI state ───────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"comments" | "activity">(
    "comments"
  );

  // ── Subtask inline-add ─────────────────────────────────────────
  const [newSubtaskName, setNewSubtaskName] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  // ── File attachment upload ────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // ── Comment composer (+ inline attachments) ───────────────────
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const [newComment, setNewComment] = useState("");
  const [pendingCommentFiles, setPendingCommentFiles] = useState<File[]>([]);
  const [postingComment, setPostingComment] = useState(false);
  // Open a viewer just for the files attached to a single comment
  // (so clicking a thumbnail inside a comment shows that comment's
  // attachments, not the whole task's).
  const [commentViewer, setCommentViewer] = useState<{
    files: TaskAttachment[];
    index: number;
  } | null>(null);

  // ─────────────────────────────────────────────────────────────
  // FETCH TASK DETAIL
  // ─────────────────────────────────────────────────────────────

  const fetchTaskDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error("Failed to fetch task");
      const data: TaskDetail = await res.json();
      setTaskDetail(data);
      setName(data.name);
      setDescription(data.description || "");
    } catch {
      toast.error("Failed to load task");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // ─────────────────────────────────────────────────────────────
  // FIELD UPDATES (generic PATCH)
  // ─────────────────────────────────────────────────────────────

  async function handleUpdate(field: string, value: unknown) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("Failed");
      await fetchTaskDetail();
      onUpdate?.();
      router.refresh();
    } catch {
      toast.error("Failed to update task");
    }
  }

  async function handleToggleComplete() {
    await handleUpdate("completed", !taskDetail?.completed);
  }

  // ─────────────────────────────────────────────────────────────
  // ATTACHMENT UPLOAD / DELETE
  // ─────────────────────────────────────────────────────────────

  async function handleAttachmentUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    let okCount = 0;
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/tasks/${taskId}/attachments`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        okCount++;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? `${file.name}: ${err.message}`
            : `${file.name}: upload failed`
        );
      }
    }
    if (okCount > 0) {
      toast.success(`Uploaded ${okCount} file${okCount === 1 ? "" : "s"}`);
      await fetchTaskDetail();
      onUpdate?.();
      onAttachmentsChange?.();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAttachmentDelete(attachmentId: string) {
    if (!confirm("Remove this attachment?")) return;
    try {
      const res = await fetch(
        `/api/tasks/${taskId}/attachments/${attachmentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Attachment removed");
      await fetchTaskDetail();
      onUpdate?.();
      onAttachmentsChange?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't remove attachment"
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // COMMENTS (with optional file attachments)
  // ─────────────────────────────────────────────────────────────

  async function handleAddComment() {
    const hasText = newComment.trim().length > 0;
    const hasFiles = pendingCommentFiles.length > 0;
    if (!hasText && !hasFiles) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: hasText ? newComment : " " }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const created = await res.json();

      // Upload each pending file with the new comment's id so the
      // attachments render inline under the message.
      let attachmentsUploaded = 0;
      for (const file of pendingCommentFiles) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("commentId", created.id);
        try {
          const upRes = await fetch(`/api/tasks/${taskId}/attachments`, {
            method: "POST",
            body: fd,
          });
          if (!upRes.ok) {
            const upErr = await upRes.json().catch(() => ({}));
            throw new Error(upErr.error || `HTTP ${upRes.status}`);
          }
          attachmentsUploaded++;
        } catch (err) {
          toast.error(
            err instanceof Error
              ? `${file.name}: ${err.message}`
              : `${file.name}: upload failed`
          );
        }
      }

      setNewComment("");
      setPendingCommentFiles([]);
      if (commentFileInputRef.current)
        commentFileInputRef.current.value = "";
      await fetchTaskDetail();
      if (attachmentsUploaded > 0) {
        onUpdate?.();
        onAttachmentsChange?.();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't post comment"
      );
    } finally {
      setPostingComment(false);
    }
  }

  function handleCommentFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const ok: File[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name}: exceeds 10 MB limit`);
        continue;
      }
      ok.push(f);
    }
    setPendingCommentFiles((prev) => [...prev, ...ok]);
    if (commentFileInputRef.current)
      commentFileInputRef.current.value = "";
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  const dueDateInfo = formatDueDateLabel(taskDetail?.dueDate || null);

  return (
    <div className="fixed inset-0 md:inset-auto md:right-0 md:top-0 md:bottom-0 w-full md:w-[500px] z-50 border-l bg-white rounded-t-2xl md:rounded-none flex flex-col shadow-2xl transition-transform duration-200 animate-in slide-in-from-bottom md:slide-in-from-right">
      {/* ── Mobile drag handle ──────────────────────────────── */}
      <div className="md:hidden flex justify-center py-2">
        <div className="w-10 h-1 rounded-full bg-gray-300" />
      </div>

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button onClick={handleToggleComplete} aria-label="Toggle complete">
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                taskDetail?.completed
                  ? "bg-[#c9a84c] border-[#c9a84c]"
                  : "border-slate-300"
              )}
            >
              {taskDetail?.completed && (
                <Check className="w-3 h-3 text-white" />
              )}
            </div>
          </button>
          {taskDetail?.taskType === "MILESTONE" && (
            <Diamond
              className="h-4 w-4 text-[#c9a84c] flex-shrink-0"
              fill="#c9a84c"
              aria-label="Milestone"
            />
          )}
          {taskDetail?.taskType === "APPROVAL" && (
            <ThumbsUp
              className="h-4 w-4 text-[#c9a84c] flex-shrink-0"
              aria-label="Approval"
            />
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() =>
              name !== taskDetail?.name && name.trim() && handleUpdate("name", name)
            }
            className={cn(
              "text-lg font-medium flex-1 outline-none min-w-0",
              taskDetail?.completed && "line-through text-slate-400"
            )}
          />
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toast.success("Task liked")}
            aria-label="Like task"
          >
            <Heart className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleAttachmentUpload}
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Attach file"
            aria-label="Attach file"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(
                `${window.location.origin}/tasks/${taskId}`
              );
              toast.success("Link copied to clipboard");
            }}
            aria-label="Copy task link"
          >
            <Link2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(`/tasks/${taskId}`, "_blank")}
            aria-label="Open in new tab"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={async () => {
                  if (!confirm("Delete this task? This cannot be undone."))
                    return;
                  try {
                    const res = await fetch(`/api/tasks/${taskId}`, {
                      method: "DELETE",
                    });
                    if (!res.ok) throw new Error();
                    toast.success("Task deleted");
                    onClose();
                    onUpdate?.();
                    router.refresh();
                  } catch {
                    toast.error("Failed to delete task");
                  }
                }}
                className="text-black"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-black" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* ── Overdue strip ───────────────────────────────── */}
          {taskDetail?.dueDate &&
            !taskDetail.completed &&
            new Date(taskDetail.dueDate).getTime() <
              new Date(new Date().toDateString()).getTime() && (
              <div className="px-4 py-2 bg-black text-white text-[12px] font-medium flex items-center gap-2 border-b border-black">
                <Flag className="h-3.5 w-3.5 text-[#c9a84c] flex-shrink-0" />
                {(() => {
                  const dayMs = 86400000;
                  const today = new Date(new Date().toDateString());
                  const due = new Date(taskDetail.dueDate);
                  const days = Math.round(
                    (today.getTime() - due.getTime()) / dayMs
                  );
                  return `Overdue · ${days} day${days === 1 ? "" : "s"} past due`;
                })()}
              </div>
            )}

          {/* ── Visibility hint ─────────────────────────────── */}
          <div className="px-4 py-2 bg-white text-xs text-black flex items-center gap-1">
            <Globe className="h-3 w-3" />
            This task is visible to everyone in the workspace
          </div>

          {/* ── Metadata ────────────────────────────────────── */}
          <div className="p-4 space-y-4 border-b">
            <div className="flex items-center gap-4">
              <span className="w-24 text-sm text-black">Assignee</span>
              <div className="flex items-center gap-2">
                <AssigneeSelector
                  value={taskDetail?.assignee || null}
                  onChange={(user) =>
                    handleUpdate("assigneeId", user?.id || null)
                  }
                  trigger={
                    taskDetail?.assignee ? (
                      <button className="flex items-center gap-2 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-white border border-black">
                            {taskDetail.assignee.name?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {taskDetail.assignee.name}
                        </span>
                      </button>
                    ) : (
                      <button className="text-sm text-slate-500 hover:text-slate-700 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer">
                        No assignee
                      </button>
                    )
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="w-24 text-sm text-black">Due date</span>
              <DueDatePicker
                startDate={
                  taskDetail?.startDate
                    ? new Date(taskDetail.startDate)
                    : null
                }
                dueDate={
                  taskDetail?.dueDate ? new Date(taskDetail.dueDate) : null
                }
                onChange={async (start, due) => {
                  // ONE PATCH with both fields — two parallel PATCHes
                  // would each trigger their own fetch and the GETs
                  // race; whichever resolves last wins.
                  try {
                    const res = await fetch(`/api/tasks/${taskId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        startDate: start?.toISOString() || null,
                        dueDate: due?.toISOString() || null,
                      }),
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    await fetchTaskDetail();
                    onUpdate?.();
                  } catch {
                    toast.error("Couldn't save the date range");
                  }
                }}
                trigger={
                  <button
                    type="button"
                    className={cn(
                      "text-sm hover:bg-gray-100 px-2 py-1 rounded cursor-pointer",
                      taskDetail?.dueDate || taskDetail?.startDate
                        ? dueDateInfo.className
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {taskDetail?.dueDate || taskDetail?.startDate
                      ? formatRangeLabel(
                          taskDetail?.startDate
                            ? new Date(taskDetail.startDate)
                            : null,
                          taskDetail?.dueDate
                            ? new Date(taskDetail.dueDate)
                            : null,
                          dueDateInfo.text
                        )
                      : "No due date"}
                  </button>
                }
              />
            </div>

            {/* Project — engineering meta shown inline when set */}
            <div className="flex items-start gap-4">
              <span className="w-24 text-sm text-black pt-1">Project</span>
              <div className="flex-1 min-w-0">
                <ProjectSelector
                  value={
                    taskDetail?.project
                      ? {
                          id: taskDetail.project.id,
                          name: taskDetail.project.name,
                          color: taskDetail.project.color,
                        }
                      : null
                  }
                  onChange={(project) =>
                    handleUpdate("projectId", project?.id || null)
                  }
                />
                {taskDetail?.project &&
                  (taskDetail.project.type || taskDetail.project.gate) && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {taskDetail.project.type && (
                        <span
                          className="text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-600"
                          title={`Project type: ${taskDetail.project.type}`}
                        >
                          {projectTypeShort(taskDetail.project.type)}
                        </span>
                      )}
                      {taskDetail.project.gate && (
                        <span
                          className="text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#c9a84c]/15 text-[#a8893a]"
                          title={`Lifecycle gate: ${taskDetail.project.gate}`}
                        >
                          {formatGateShort(taskDetail.project.gate)}
                        </span>
                      )}
                    </div>
                  )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="w-24 text-sm text-black">Priority</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-auto p-0">
                    <span
                      className={cn(
                        "text-sm",
                        taskDetail?.priority === "HIGH"
                          ? "text-black"
                          : taskDetail?.priority === "MEDIUM"
                            ? "text-[#a8893a]"
                            : "text-black"
                      )}
                    >
                      {taskDetail?.priority || "None"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={() => handleUpdate("priority", "HIGH")}
                  >
                    <span className="text-black">High</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleUpdate("priority", "MEDIUM")}
                  >
                    <span className="text-[#a8893a]">Medium</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleUpdate("priority", "LOW")}
                  >
                    <span className="text-black">Low</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleUpdate("priority", "NONE")}
                  >
                    <span className="text-black">None</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* ── Description ─────────────────────────────────── */}
          <div className="p-4 border-b">
            <h4 className="text-sm font-medium text-slate-700 mb-2">
              Description
            </h4>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() =>
                description !== (taskDetail?.description || "") &&
                handleUpdate("description", description || null)
              }
              placeholder="What is this task about?"
              className="w-full p-2 text-sm border rounded-md resize-none min-h-[80px] outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          {/* ── Attachments ─────────────────────────────────── */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-slate-700">
                Attachments ({taskDetail?.attachments?.length || 0})
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Paperclip className="h-3.5 w-3.5 mr-1" />
                )}
                {uploading ? "Uploading…" : "Upload"}
              </Button>
            </div>
            {!taskDetail?.attachments ||
            taskDetail.attachments.length === 0 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full border border-dashed rounded-lg py-4 text-xs text-gray-500 hover:text-black hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                Click to upload — images, PDFs, Office docs, up to 10 MB each
              </button>
            ) : (
              <ul className="space-y-1.5">
                {taskDetail.attachments.map((a, i) => {
                  const isImage = a.mimeType.startsWith("image/");
                  return (
                    <li
                      key={a.id}
                      className="group flex items-center gap-2 px-2 py-1.5 border rounded-md hover:bg-gray-50"
                    >
                      <button
                        type="button"
                        onClick={() => setViewerIndex(i)}
                        className="h-8 w-8 flex-shrink-0 rounded overflow-hidden border bg-gray-100 flex items-center justify-center cursor-zoom-in"
                        aria-label={`Open ${a.name}`}
                      >
                        {isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.url}
                            alt={a.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewerIndex(i)}
                        className="flex-1 min-w-0 text-left cursor-zoom-in"
                      >
                        <p className="text-[12px] font-medium text-black truncate hover:underline">
                          {a.name}
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono tabular-nums">
                          {formatFileSize(a.size)} ·{" "}
                          {new Date(a.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </button>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={async () => {
                            try {
                              await downloadFile(a.url, a.name);
                            } catch (err) {
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : "Couldn't download file"
                              );
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-black"
                          title="Download"
                          aria-label={`Download ${a.name}`}
                        >
                          <Download className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleAttachmentDelete(a.id)}
                          className="p-1 text-gray-400 hover:text-black"
                          title="Remove"
                          aria-label={`Remove ${a.name}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Subtasks ────────────────────────────────────── */}
          <div className="p-4 border-b">
            <h4 className="text-sm font-medium text-slate-700 mb-2">
              Subtasks ({taskDetail?.subtasks?.length || 0})
            </h4>
            <div className="space-y-1">
              {taskDetail?.subtasks?.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-2 group hover:bg-gray-50 rounded px-1 py-0.5"
                >
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/tasks/${subtask.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            completed: !subtask.completed,
                          }),
                        });
                        if (res.ok) {
                          fetchTaskDetail();
                          onUpdate?.();
                        }
                      } catch {
                        toast.error("Failed to update subtask");
                      }
                    }}
                    className="flex-shrink-0"
                    aria-label="Toggle subtask"
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                        subtask.completed
                          ? "bg-[#c9a84c] border-[#c9a84c]"
                          : "border-slate-300 hover:border-slate-400"
                      )}
                    >
                      {subtask.completed && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </button>
                  <span
                    className={cn(
                      "text-sm flex-1",
                      subtask.completed && "line-through text-slate-400"
                    )}
                  >
                    {subtask.name}
                  </span>
                </div>
              ))}
              {isAddingSubtask ? (
                <div className="flex items-center gap-2 px-1">
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                  <input
                    ref={subtaskInputRef}
                    type="text"
                    value={newSubtaskName}
                    onChange={(e) => setNewSubtaskName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && newSubtaskName.trim()) {
                        try {
                          const res = await fetch(`/api/tasks`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              name: newSubtaskName.trim(),
                              parentTaskId: taskId,
                            }),
                          });
                          if (res.ok) {
                            setNewSubtaskName("");
                            fetchTaskDetail();
                            onUpdate?.();
                            toast.success("Subtask added");
                          } else {
                            toast.error("Failed to add subtask");
                          }
                        } catch {
                          toast.error("Failed to add subtask");
                        }
                      }
                      if (e.key === "Escape") {
                        setIsAddingSubtask(false);
                        setNewSubtaskName("");
                      }
                    }}
                    onBlur={() => {
                      if (!newSubtaskName.trim()) {
                        setIsAddingSubtask(false);
                        setNewSubtaskName("");
                      }
                    }}
                    placeholder="Subtask name..."
                    className="flex-1 text-sm outline-none border-b border-slate-200 focus:border-slate-400 py-1"
                    autoFocus
                  />
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-black w-full justify-start"
                  onClick={() => {
                    setIsAddingSubtask(true);
                    setTimeout(() => subtaskInputRef.current?.focus(), 0);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add subtask
                </Button>
              )}
            </div>
          </div>

          {/* ── Tabs (Comments / Activity) ──────────────────── */}
          <div className="border-b">
            <div className="flex gap-4 px-4">
              <button
                onClick={() => setActiveTab("comments")}
                className={cn(
                  "py-2 text-sm font-medium border-b-2 -mb-px",
                  activeTab === "comments"
                    ? "text-black border-black"
                    : "text-black border-transparent"
                )}
              >
                Comments
              </button>
              <button
                onClick={() => setActiveTab("activity")}
                className={cn(
                  "py-2 text-sm font-medium border-b-2 -mb-px",
                  activeTab === "activity"
                    ? "text-black border-black"
                    : "text-black border-transparent"
                )}
              >
                All activity
              </button>
            </div>
          </div>

          {/* ── Tab content ─────────────────────────────────── */}
          <div className="p-4 space-y-4">
            {activeTab === "comments" ? (
              <>
                {taskDetail?.comments?.map((comment) => {
                  const atts = comment.attachments || [];
                  return (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-white border border-black">
                          {comment.author?.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {comment.author?.name || "Unknown"}
                          </span>
                          <span className="text-xs text-black">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {comment.content && comment.content.trim() && (
                          <p className="text-sm text-black mt-1 whitespace-pre-wrap break-words">
                            {comment.content}
                          </p>
                        )}
                        {atts.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 gap-1.5 max-w-md">
                            {atts.map((a, i) => {
                              const isImg = a.mimeType.startsWith("image/");
                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() =>
                                    setCommentViewer({ files: atts, index: i })
                                  }
                                  className={cn(
                                    "flex items-center gap-2 px-2 py-1 border rounded hover:bg-gray-50",
                                    isImg &&
                                      "flex-col items-stretch p-0 overflow-hidden"
                                  )}
                                  title={a.name}
                                >
                                  {isImg ? (
                                    <>
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={a.url}
                                        alt={a.name}
                                        className="w-full h-24 object-cover"
                                      />
                                      <div className="px-2 py-1">
                                        <p className="text-[10px] font-medium text-black truncate">
                                          {a.name}
                                        </p>
                                        <p className="text-[9px] text-gray-500 font-mono tabular-nums">
                                          {formatFileSize(a.size)}
                                        </p>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="h-8 w-8 rounded bg-gray-100 border flex items-center justify-center flex-shrink-0">
                                        <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-medium text-black truncate">
                                          {a.name}
                                        </p>
                                        <p className="text-[9px] text-gray-500 font-mono tabular-nums">
                                          {formatFileSize(a.size)}
                                        </p>
                                      </div>
                                    </>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!taskDetail?.comments || taskDetail.comments.length === 0) && (
                  <p className="text-sm text-black text-center py-4">
                    No comments yet
                  </p>
                )}
              </>
            ) : (
              <>
                {taskDetail?.activities?.map((activity) => (
                  <div key={activity.id} className="flex gap-3 text-sm">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-white border border-black">
                        {activity.user?.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="font-medium">
                        {activity.user?.name || "Someone"}
                      </span>
                      <span className="text-black">
                        {" "}
                        {activity.type.replace(/_/g, " ").toLowerCase()}
                      </span>
                      <span className="text-black text-xs ml-2">
                        {new Date(activity.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
                {(!taskDetail?.activities ||
                  taskDetail.activities.length === 0) && (
                  <p className="text-sm text-black text-center py-4">
                    No activity yet
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Comment composer ──────────────────────────────────── */}
      <div className="p-4 border-t">
        <div className="flex gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-black text-white">
              U
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Input
                placeholder={
                  pendingCommentFiles.length > 0
                    ? "Caption (optional)…"
                    : "Add a comment…"
                }
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !postingComment) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                disabled={postingComment}
                className="flex-1"
              />
              <input
                ref={commentFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleCommentFilesPicked}
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => commentFileInputRef.current?.click()}
                disabled={postingComment}
                title="Attach file to this comment"
                className="h-9 w-9 p-0 flex-shrink-0"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAddComment}
                disabled={
                  postingComment ||
                  (!newComment.trim() && pendingCommentFiles.length === 0)
                }
                className="h-9 px-3 bg-black hover:bg-gray-800 text-white flex-shrink-0"
              >
                {postingComment ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Post"
                )}
              </Button>
            </div>
            {pendingCommentFiles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pendingCommentFiles.map((f, i) => (
                  <span
                    key={`${f.name}-${i}`}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border bg-gray-50 text-[11px] text-black"
                  >
                    <Paperclip className="h-3 w-3 text-gray-500" />
                    <span className="max-w-[140px] truncate">{f.name}</span>
                    <span className="text-gray-400 font-mono tabular-nums">
                      {formatFileSize(f.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingCommentFiles((prev) =>
                          prev.filter((_, idx) => idx !== i)
                        )
                      }
                      className="text-gray-400 hover:text-black ml-0.5"
                      aria-label={`Remove ${f.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Inline file viewer (task-level attachments) ───────── */}
      {viewerIndex !== null && taskDetail?.attachments?.[viewerIndex] && (
        <FileViewerModal
          files={taskDetail.attachments}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

      {/* ── Inline file viewer (comment-level attachments) ────── */}
      {commentViewer && commentViewer.files[commentViewer.index] && (
        <FileViewerModal
          files={commentViewer.files}
          initialIndex={commentViewer.index}
          onClose={() => setCommentViewer(null)}
        />
      )}
    </div>
  );
}
