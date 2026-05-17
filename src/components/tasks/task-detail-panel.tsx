"use client";

/**
 * Task detail slide-over panel — the right-side panel that opens
 * when the user clicks a task anywhere in the app. This is the
 * cockpit-wide single source of truth for editing a task; project
 * list/board/calendar/timeline all open this same component.
 *
 * Visual language: Asana-style ("compact rows + inline edits + bottom-
 * anchored composer"). Keeps parity with the /my-tasks panel so users
 * never re-learn the layout when they jump between contexts.
 *
 * The panel fetches its own detail by taskId so callers only need
 * to pass the id and an onClose handler.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  Calendar,
  ArrowLeftRight,
  ChevronDown,
  UserPlus2,
  ListPlus,
  Copy,
  Printer,
  CornerUpRight,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AssigneeSelector } from "@/components/tasks/assignee-selector";
import { DueDatePicker } from "@/components/tasks/due-date-picker";
import { ProjectSelector } from "@/components/tasks/project-selector";
import { DependenciesPicker } from "@/components/tasks/dependencies-picker";
import { CustomFieldsSection } from "@/components/tasks/custom-fields-section";
import { FileViewerModal } from "@/components/files/file-viewer-modal";
import { downloadFile } from "@/lib/download";
import {
  formatFileSize,
  formatRangeLabel,
  formatDueDateLabel,
  projectTypeShort,
  formatGateShort,
} from "@/lib/task-helpers";

interface TaskDetailPanelProps {
  taskId: string;
  onClose: () => void;
  onUpdate?: () => void;
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

type DependencyTypeStr =
  | "FINISH_TO_START"
  | "START_TO_START"
  | "FINISH_TO_FINISH"
  | "START_TO_FINISH";

interface TaskDependency {
  id: string;
  type: DependencyTypeStr;
  blockingTask: {
    id: string;
    name: string;
    completed: boolean;
    startDate: string | null;
    dueDate: string | null;
  };
}

interface TaskCustomFieldValue {
  fieldId: string;
  value: unknown;
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
  dependencies?: TaskDependency[];
  customFieldValues?: TaskCustomFieldValue[];
}

const DEPENDENCY_TYPE_META: Record<
  DependencyTypeStr,
  { short: string; label: string }
> = {
  FINISH_TO_START: { short: "FS", label: "Finish-to-Start" },
  START_TO_START: { short: "SS", label: "Start-to-Start" },
  FINISH_TO_FINISH: { short: "FF", label: "Finish-to-Finish" },
  START_TO_FINISH: { short: "SF", label: "Start-to-Finish" },
};

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
  // Asana "Mostrar las dependencias finalizadas" — completed
  // blockers hide by default; clicking the link reveals them inline.
  const [showCompletedDeps, setShowCompletedDeps] = useState(false);

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
        err instanceof Error ? err.message : "Failed to remove attachment"
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MORE OPTIONS — actions wired from the "..." dropdown in the
  // panel header. Same surface as Asana's task menu:
  //   Add subtask · Attach files · Copy link · Convert to ▸
  //   Duplicate · Print · Delete
  // ─────────────────────────────────────────────────────────────

  function handleAddSubtaskFromMenu() {
    setIsAddingSubtask(true);
    // Wait one tick so the input is in the DOM, then focus + scroll.
    setTimeout(() => {
      subtaskInputRef.current?.focus();
      subtaskInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
  }

  async function handleConvertTo(
    newType: "TASK" | "MILESTONE" | "APPROVAL"
  ) {
    await handleUpdate("taskType", newType);
    toast.success(
      newType === "MILESTONE"
        ? "Converted to milestone"
        : newType === "APPROVAL"
          ? "Converted to approval gate"
          : "Converted to task"
    );
  }

  async function handleDuplicateTask() {
    try {
      const res = await fetch(`/api/tasks/${taskId}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Task duplicated");
      onUpdate?.();
      router.refresh();
    } catch {
      toast.error("Failed to duplicate task");
    }
  }

  function handlePrintTask() {
    // Browser's native print dialog — uses the print stylesheet
    // applied at the app shell so headers/sidebars hide cleanly.
    window.print();
  }

  async function handleDeleteTask() {
    if (
      !confirm(
        "Delete this task? This will permanently remove the task, its subtasks, comments, and attachments. This cannot be undone."
      )
    )
      return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Task deleted");
      onUpdate?.();
      onClose();
      router.refresh();
    } catch {
      toast.error("Failed to delete task");
    }
  }

  // ─────────────────────────────────────────────────────────────
  // DEPENDENCY REMOVE
  // ─────────────────────────────────────────────────────────────

  async function handleDependencyRemove(dependencyId: string) {
    try {
      const res = await fetch(
        `/api/tasks/${taskId}/dependencies?id=${dependencyId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Dependency removed");
      await fetchTaskDetail();
      onUpdate?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't remove dependency"
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // COMMENT POST
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
      if (commentFileInputRef.current) commentFileInputRef.current.value = "";
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
    if (commentFileInputRef.current) commentFileInputRef.current.value = "";
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  const dueDateInfo = formatDueDateLabel(taskDetail?.dueDate || null);

  return (
    <div className="fixed inset-0 md:inset-auto md:right-0 md:top-0 md:bottom-0 w-full md:w-[500px] z-50 border-l border-[#e8e8e8] bg-white rounded-t-2xl md:rounded-none flex flex-col shadow-[-12px_0_32px_-12px_rgba(0,0,0,0.06)] md:shadow-2xl transition-transform duration-200 animate-in slide-in-from-bottom md:slide-in-from-right text-[#1e1f21]">
      {/* ── Mobile drag handle ──────────────────────────────── */}
      <div className="md:hidden flex justify-center py-2">
        <div className="w-10 h-1 rounded-full bg-gray-300" />
      </div>

      {/* ── Top action row ─────────────────────────────────────
          Left: Mark-complete pill (Asana style — turns green when
          complete). Right: heart / paperclip / link / expand /
          more / close. Title intentionally NOT in this row. */}
      <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0">
        <button
          onClick={handleToggleComplete}
          className={cn(
            "flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[13px] font-medium border transition-colors",
            taskDetail?.completed
              ? "bg-[#e6f4ea] text-[#207544] border-transparent hover:bg-[#d6ecde]"
              : "text-[#6f7782] border-[#e8e8e8] hover:bg-[#f3f4f6] hover:text-[#1e1f21]"
          )}
        >
          <Check
            className={cn(
              "h-3.5 w-3.5",
              taskDetail?.completed ? "text-[#207544]" : "text-[#9aa0a6]"
            )}
          />
          {taskDetail?.completed ? "Completed" : "Mark complete"}
        </button>
        <div className="flex items-center gap-0.5 text-[#6f7782]">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleAttachmentUpload}
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
          />
          <ActionIconButton
            onClick={() => toast.success("Task liked")}
            title="Like"
          >
            <Heart className="h-[15px] w-[15px]" />
          </ActionIconButton>
          <ActionIconButton
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Attach file"
          >
            {uploading ? (
              <Loader2 className="h-[15px] w-[15px] animate-spin" />
            ) : (
              <Paperclip className="h-[15px] w-[15px]" />
            )}
          </ActionIconButton>
          <ActionIconButton
            onClick={() => {
              navigator.clipboard.writeText(
                `${window.location.origin}/tasks/${taskId}`
              );
              toast.success("Link copied to clipboard");
            }}
            title="Copy link"
          >
            <Link2 className="h-[15px] w-[15px]" />
          </ActionIconButton>
          <ActionIconButton
            onClick={() => window.open(`/tasks/${taskId}`, "_blank")}
            title="Open full task"
          >
            <Maximize2 className="h-[15px] w-[15px]" />
          </ActionIconButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ActionIconButton title="More options">
                <MoreHorizontal className="h-[15px] w-[15px]" />
              </ActionIconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[240px]">
              <DropdownMenuItem onClick={handleAddSubtaskFromMenu}>
                <ListPlus className="mr-2 h-4 w-4 text-[#6f7782]" />
                <span className="flex-1">Add subtask</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="mr-2 h-4 w-4 text-[#6f7782]" />
                <span className="flex-1">Attach files</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/tasks/${taskId}`
                  );
                  toast.success("Link copied to clipboard");
                }}
              >
                <Link2 className="mr-2 h-4 w-4 text-[#6f7782]" />
                <span className="flex-1">Copy task link</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <CornerUpRight className="mr-2 h-4 w-4 text-[#6f7782]" />
                  <span>Convert to</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={() => handleConvertTo("TASK")}
                    disabled={
                      !taskDetail?.taskType ||
                      taskDetail.taskType === "TASK"
                    }
                  >
                    <CheckSquare className="mr-2 h-4 w-4 text-[#6f7782]" />
                    Task
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleConvertTo("MILESTONE")}
                    disabled={taskDetail?.taskType === "MILESTONE"}
                  >
                    <Diamond
                      className="mr-2 h-4 w-4"
                      fill="#c9a84c"
                      color="#c9a84c"
                    />
                    Milestone
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleConvertTo("APPROVAL")}
                    disabled={taskDetail?.taskType === "APPROVAL"}
                  >
                    <ThumbsUp
                      className="mr-2 h-4 w-4"
                      fill="#c9a84c"
                      color="#c9a84c"
                    />
                    Approval gate
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={handleDuplicateTask}>
                <Copy className="mr-2 h-4 w-4 text-[#6f7782]" />
                <span>Duplicate task</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrintTask}>
                <Printer className="mr-2 h-4 w-4 text-[#6f7782]" />
                <span>Print</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDeleteTask}
                className="text-[#c91111] focus:text-[#c91111] focus:bg-[#fbe9e9]"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete task</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ActionIconButton onClick={onClose} title="Close">
            <X className="h-[15px] w-[15px]" />
          </ActionIconButton>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-black" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Overdue strip */}
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

          {/* Visibility bar */}
          <div className="px-5 h-9 bg-[#f6f7f8] text-[12px] text-[#6f7782] flex items-center gap-1.5">
            <Globe className="h-3 w-3" />
            This task is visible to everyone in the workspace
          </div>

          {/* Task title */}
          <div className="px-5 pt-4 pb-3 flex items-start gap-2">
            {taskDetail?.taskType === "MILESTONE" && (
              <Diamond
                className="h-5 w-5 text-[#c9a84c] flex-shrink-0 mt-1"
                fill="#c9a84c"
                aria-label="Milestone"
              />
            )}
            {taskDetail?.taskType === "APPROVAL" && (
              <ThumbsUp
                className="h-5 w-5 text-[#c9a84c] flex-shrink-0 mt-1"
                aria-label="Approval"
              />
            )}
            <textarea
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() =>
                name !== taskDetail?.name &&
                name.trim() &&
                handleUpdate("name", name)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              rows={1}
              className={cn(
                "flex-1 min-w-0 text-[22px] font-semibold leading-snug bg-transparent outline-none resize-none placeholder:text-[#9aa0a6] text-[#1e1f21]",
                taskDetail?.completed && "line-through text-[#9aa0a6]"
              )}
              placeholder="Task name"
            />
          </div>

          {/* Blocked badge */}
          {(() => {
            const blockerCount =
              taskDetail?.dependencies?.filter(
                (d) => !d.blockingTask.completed
              ).length ?? 0;
            if (blockerCount === 0 || taskDetail?.completed) return null;
            return (
              <div className="px-5 pb-1 -mt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#fbeed3] text-[#7a5b1b]">
                  <Flag className="w-3 h-3" />
                  Blocked
                  {blockerCount > 1 ? ` · ${blockerCount}` : ""}
                </span>
              </div>
            );
          })()}

          {/* Property rows */}
          <div className="px-5 pb-2">
            <PropertyRow label="Assignee">
              <AssigneeSelector
                value={taskDetail?.assignee || null}
                onChange={(user) =>
                  handleUpdate("assigneeId", user?.id || null)
                }
                trigger={
                  taskDetail?.assignee ? (
                    <button className="flex items-center gap-1.5 -ml-1.5 px-1.5 py-0.5 rounded hover:bg-[#f3f4f6] cursor-pointer">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[10px] bg-[#1e1f21] text-white">
                          {taskDetail.assignee.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[13px] text-[#1e1f21]">
                        {taskDetail.assignee.name}
                      </span>
                    </button>
                  ) : (
                    <button className="flex items-center gap-1.5 -ml-1.5 px-1.5 py-0.5 rounded text-[13px] text-[#6f7782] hover:bg-[#f3f4f6] hover:text-[#1e1f21] cursor-pointer">
                      <UserPlus2 className="h-3.5 w-3.5" />
                      No assignee
                    </button>
                  )
                }
              />
            </PropertyRow>

            <PropertyRow label="Due date">
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
                    // Surface cascade so the user knows we shifted
                    // downstream tasks.
                    const payload = (await res.json()) as {
                      cascadeShifts?: { taskName: string }[];
                    };
                    const shifts = payload?.cascadeShifts ?? [];
                    if (shifts.length === 1) {
                      toast.success(
                        `Shifted dependent "${shifts[0].taskName}"`
                      );
                    } else if (shifts.length > 1) {
                      toast.success(`Shifted ${shifts.length} dependent tasks`);
                    }
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
                      "flex items-center gap-1.5 -ml-1.5 px-1.5 py-0.5 rounded text-[13px] hover:bg-[#f3f4f6] cursor-pointer",
                      taskDetail?.dueDate || taskDetail?.startDate
                        ? "text-[#1e1f21]"
                        : "text-[#6f7782] hover:text-[#1e1f21]"
                    )}
                  >
                    {!(taskDetail?.dueDate || taskDetail?.startDate) && (
                      <Calendar className="h-3.5 w-3.5" />
                    )}
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
            </PropertyRow>

            {(() => {
              const allDeps: TaskDependency[] = taskDetail?.dependencies ?? [];
              const activeDeps = allDeps.filter(
                (d) => !d.blockingTask.completed
              );
              const completedDeps = allDeps.filter(
                (d) => d.blockingTask.completed
              );
              return (
                <PropertyRow
                  label="Dependencies"
                  accessory={
                    activeDeps.length > 0 && (
                      <span className="text-[11px] text-[#6f7782] tabular-nums">
                        {activeDeps.length}
                      </span>
                    )
                  }
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-1 py-0.5">
                    {activeDeps.map((dep) => (
                      <DependencyChip
                        key={dep.id}
                        dependency={dep}
                        taskId={taskId}
                        onChanged={() => {
                          fetchTaskDetail();
                          onUpdate?.();
                        }}
                        onRemove={() => handleDependencyRemove(dep.id)}
                      />
                    ))}
                    {showCompletedDeps &&
                      completedDeps.map((dep) => (
                        <DependencyChip
                          key={dep.id}
                          dependency={dep}
                          taskId={taskId}
                          onChanged={() => {
                            fetchTaskDetail();
                            onUpdate?.();
                          }}
                          onRemove={() => handleDependencyRemove(dep.id)}
                        />
                      ))}
                    <DependenciesPicker
                      taskId={taskId}
                      existingBlockingTaskIds={allDeps.map(
                        (d) => d.blockingTask.id
                      )}
                      onAdded={() => {
                        fetchTaskDetail();
                        onUpdate?.();
                      }}
                      trigger={
                        <button className="-ml-1.5 px-1.5 py-0.5 rounded text-[13px] text-[#3b82f6] hover:bg-[#f3f4f6] hover:underline cursor-pointer text-left w-fit">
                          Add dependencies
                        </button>
                      }
                    />
                    {completedDeps.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowCompletedDeps((v) => !v)}
                        className="-ml-1.5 px-1.5 py-0.5 rounded text-[13px] text-[#3b82f6] hover:bg-[#f3f4f6] hover:underline cursor-pointer text-left w-fit"
                      >
                        {showCompletedDeps
                          ? `Hide completed dependencies (${completedDeps.length})`
                          : `Show completed dependencies (${completedDeps.length})`}
                      </button>
                    )}
                  </div>
                </PropertyRow>
              );
            })()}

            <PropertyRow
              label="Projects"
              accessory={
                taskDetail?.project && (
                  <span className="text-[11px] text-[#6f7782] tabular-nums">
                    1
                  </span>
                )
              }
            >
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
                    <div className="mt-1 flex items-center gap-1.5">
                      {taskDetail.project.type && (
                        <span
                          className="text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#f3f4f6] text-[#6f7782]"
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
            </PropertyRow>

            <PropertyRow label="Priority">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="-ml-1.5 px-1.5 py-0.5 rounded hover:bg-[#f3f4f6] cursor-pointer"
                  >
                    {taskDetail?.priority && taskDetail.priority !== "NONE" ? (
                      <PriorityTag value={taskDetail.priority} />
                    ) : (
                      <span className="text-[13px] text-[#6f7782]">
                        No priority
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => handleUpdate("priority", "HIGH")}
                  >
                    <PriorityTag value="HIGH" />
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleUpdate("priority", "MEDIUM")}
                  >
                    <PriorityTag value="MEDIUM" />
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleUpdate("priority", "LOW")}
                  >
                    <PriorityTag value="LOW" />
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleUpdate("priority", "NONE")}
                  >
                    <span className="text-[13px] text-[#6f7782]">
                      No priority
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </PropertyRow>

            {/* Project's custom fields */}
            <CustomFieldsSection
              taskId={taskId}
              projectId={taskDetail?.project?.id ?? null}
              values={taskDetail?.customFieldValues ?? []}
              onChanged={() => {
                fetchTaskDetail();
                onUpdate?.();
              }}
            />
          </div>

          {/* Description */}
          <div className="px-5 pt-3 pb-4">
            <h4 className="text-[12px] font-medium text-[#6f7782] mb-1.5">
              Description
            </h4>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() =>
                description !== taskDetail?.description &&
                handleUpdate("description", description)
              }
              placeholder="What is this task about?"
              rows={2}
              className="w-full text-[13px] leading-relaxed bg-transparent outline-none resize-none placeholder:text-[#9aa0a6] text-[#1e1f21] focus:bg-[#f9fafb] focus:rounded-md focus:px-2 focus:py-1 transition-[background-color] -mx-0"
            />
          </div>

          {/* Attachments */}
          <div className="px-5 pt-3 pb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <h4 className="text-[12px] font-medium text-[#6f7782]">
                Attachments{" "}
                {taskDetail?.attachments && taskDetail.attachments.length > 0 &&
                  `(${taskDetail.attachments.length})`}
              </h4>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center justify-center h-4 w-4 rounded text-[#6f7782] hover:bg-[#f3f4f6] hover:text-[#1e1f21] disabled:opacity-50"
                title="Add attachment"
              >
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            {!taskDetail?.attachments ||
            taskDetail.attachments.length === 0 ? null : (
              <ul className="space-y-0.5 -mx-2">
                {taskDetail.attachments.map((a, i) => {
                  const isImage = a.mimeType.startsWith("image/");
                  return (
                    <li
                      key={a.id}
                      className="group flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-[#f3f4f6]"
                    >
                      <button
                        type="button"
                        onClick={() => setViewerIndex(i)}
                        className="h-6 w-6 flex-shrink-0 rounded overflow-hidden bg-[#f3f4f6] flex items-center justify-center cursor-zoom-in"
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
                          <Paperclip className="h-3 w-3 text-[#6f7782]" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewerIndex(i)}
                        className="flex-1 min-w-0 text-left cursor-zoom-in flex items-baseline gap-1.5"
                      >
                        <span className="text-[13px] text-[#1e1f21] truncate group-hover:underline">
                          {a.name}
                        </span>
                        <span className="text-[11px] text-[#9aa0a6] tabular-nums whitespace-nowrap">
                          {formatFileSize(a.size)} ·{" "}
                          {new Date(a.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
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
                          className="p-1 text-[#9aa0a6] hover:text-[#1e1f21]"
                          aria-label={`Download ${a.name}`}
                          title="Download"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleAttachmentDelete(a.id)}
                          className="p-1 text-[#9aa0a6] hover:text-[#1e1f21]"
                          aria-label="Remove attachment"
                          title="Remove"
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

          {/* Subtasks */}
          <div className="px-5 pt-3 pb-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <h4 className="text-[12px] font-medium text-[#6f7782]">
                Subtasks{" "}
                {taskDetail?.subtasks && taskDetail.subtasks.length > 0 &&
                  `(${taskDetail.subtasks.length})`}
              </h4>
              <button
                onClick={() => {
                  setIsAddingSubtask(true);
                  setTimeout(() => subtaskInputRef.current?.focus(), 0);
                }}
                className="flex items-center justify-center h-4 w-4 rounded text-[#6f7782] hover:bg-[#f3f4f6] hover:text-[#1e1f21]"
                title="Add subtask"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-0">
              {taskDetail?.subtasks?.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-2 group py-1.5 border-b border-[#eeeeee] last:border-b-0"
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
                  >
                    <div
                      className={cn(
                        "w-[15px] h-[15px] rounded-full border flex items-center justify-center transition-colors",
                        subtask.completed
                          ? "bg-[#c9a84c] border-[#c9a84c]"
                          : "border-[#c4c7cf] hover:border-[#1e1f21]"
                      )}
                    >
                      {subtask.completed && (
                        <Check className="w-2.5 h-2.5 text-white" />
                      )}
                    </div>
                  </button>
                  <span
                    className={cn(
                      "text-[13px] flex-1",
                      subtask.completed
                        ? "line-through text-[#9aa0a6]"
                        : "text-[#1e1f21]"
                    )}
                  >
                    {subtask.name}
                  </span>
                </div>
              ))}
              {isAddingSubtask ? (
                <div className="flex items-center gap-2 py-1.5 border-b border-[#eeeeee]">
                  <div className="w-[15px] h-[15px] rounded-full border border-[#c4c7cf] flex-shrink-0" />
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
                    placeholder="Type a subtask name"
                    className="flex-1 text-[13px] bg-transparent outline-none placeholder:text-[#9aa0a6]"
                    autoFocus
                  />
                </div>
              ) : (
                <button
                  className="flex items-center gap-2 py-1.5 w-full text-left text-[13px] text-[#6f7782] hover:text-[#1e1f21]"
                  onClick={() => {
                    setIsAddingSubtask(true);
                    setTimeout(() => subtaskInputRef.current?.focus(), 0);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add subtask
                </button>
              )}
            </div>
          </div>

          {/* Activity tabs */}
          <div className="border-t border-[#e8e8e8] mt-2">
            <div className="flex gap-5 px-5">
              <button
                onClick={() => setActiveTab("comments")}
                className={cn(
                  "py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors",
                  activeTab === "comments"
                    ? "text-[#1e1f21] border-[#1e1f21]"
                    : "text-[#6f7782] border-transparent hover:text-[#1e1f21]"
                )}
              >
                Comments
              </button>
              <button
                onClick={() => setActiveTab("activity")}
                className={cn(
                  "py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors",
                  activeTab === "activity"
                    ? "text-[#1e1f21] border-[#1e1f21]"
                    : "text-[#6f7782] border-transparent hover:text-[#1e1f21]"
                )}
              >
                All activity
              </button>
            </div>
          </div>

          {/* Activity Content */}
          <div className="p-4 space-y-4">
            {activeTab === "comments" ? (
              <>
                {taskDetail?.comments?.map((comment) => {
                  const atts = (comment.attachments ?? []) as TaskAttachment[];
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
                            {comment.author?.name}
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
                                    "group flex items-center gap-2 border rounded-md p-1.5 bg-white hover:border-gray-400 hover:bg-gray-50 text-left transition-colors",
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
                {(!taskDetail?.comments ||
                  taskDetail.comments.length === 0) && (
                  <p className="text-[13px] text-[#9aa0a6] text-center py-6">
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
                      <span className="font-medium">{activity.user?.name}</span>
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Comment Input (anchored bottom) */}
      <div className="px-5 py-3 border-t border-[#e8e8e8] bg-white flex-shrink-0">
        <div className="flex gap-2.5 items-start">
          <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
            <AvatarFallback className="text-[11px] bg-[#1e1f21] text-white">
              U
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 rounded-md border border-[#e8e8e8] bg-white focus-within:border-[#c4c7cf] transition-colors px-2.5 py-1.5">
              <input
                type="text"
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
                className="flex-1 text-[13px] bg-transparent outline-none placeholder:text-[#9aa0a6] text-[#1e1f21]"
              />
              <input
                ref={commentFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleCommentFilesPicked}
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
              />
              <button
                type="button"
                onClick={() => commentFileInputRef.current?.click()}
                disabled={postingComment}
                className="flex items-center justify-center h-6 w-6 rounded text-[#6f7782] hover:bg-[#f3f4f6] hover:text-[#1e1f21] disabled:opacity-50"
                title="Attach file"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleAddComment}
                disabled={
                  postingComment ||
                  (!newComment.trim() && pendingCommentFiles.length === 0)
                }
                className="h-6 px-2.5 text-[12px] font-medium rounded bg-[#1e1f21] text-white hover:bg-[#000] disabled:opacity-40 disabled:cursor-not-allowed flex items-center"
              >
                {postingComment ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Post"
                )}
              </button>
            </div>
            {pendingCommentFiles.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {pendingCommentFiles.map((f, i) => (
                  <span
                    key={`${f.name}-${i}`}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-[#e8e8e8] bg-[#f9fafb] text-[11px] text-[#1e1f21]"
                  >
                    <Paperclip className="h-3 w-3 text-[#6f7782]" />
                    <span className="max-w-[140px] truncate">{f.name}</span>
                    <span className="text-[#9aa0a6] tabular-nums">
                      {formatFileSize(f.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingCommentFiles((prev) =>
                          prev.filter((_, idx) => idx !== i)
                        )
                      }
                      className="text-[#9aa0a6] hover:text-[#1e1f21] ml-0.5"
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

      {/* Collaborators footer */}
      <div className="px-5 py-2.5 border-t border-[#e8e8e8] flex items-center justify-between text-[12px] bg-white flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[#6f7782]">Collaborators</span>
          <div className="flex items-center gap-1">
            {taskDetail?.collaborators?.map((collab) => (
              <Avatar
                key={collab.id}
                className="h-5 w-5"
                title={collab.name || "User"}
              >
                <AvatarFallback className="text-[9px] bg-[#1e1f21] text-white">
                  {(collab.name || "U").charAt(0)}
                </AvatarFallback>
              </Avatar>
            ))}
            {(!taskDetail?.collaborators ||
              taskDetail.collaborators.length === 0) && (
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[9px] bg-[#1e1f21] text-white">
                  U
                </AvatarFallback>
              </Avatar>
            )}
            <AssigneeSelector
              value={null}
              onChange={async (user) => {
                if (!user) return;
                try {
                  const res = await fetch(
                    `/api/tasks/${taskId}/collaborators`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ userId: user.id }),
                    }
                  );
                  if (res.ok) {
                    toast.success(`${user.name} added as collaborator`);
                    fetchTaskDetail();
                  } else if (res.status === 409) {
                    toast.info("Already a collaborator");
                  } else {
                    toast.error("Failed to add collaborator");
                  }
                } catch {
                  toast.error("Failed to add collaborator");
                }
              }}
              trigger={
                <button className="h-5 w-5 rounded-full border border-dashed border-[#c4c7cf] flex items-center justify-center hover:border-[#1e1f21] hover:bg-[#f3f4f6] cursor-pointer">
                  <Plus className="h-2.5 w-2.5 text-[#9aa0a6]" />
                </button>
              }
            />
          </div>
        </div>
        <button
          className="text-[12px] text-[#6f7782] hover:text-[#1e1f21]"
          onClick={async () => {
            try {
              const res = await fetch(`/api/tasks/${taskId}/collaborators`, {
                method: "DELETE",
              });
              if (res.ok) {
                toast.success("You left this task");
                fetchTaskDetail();
              } else {
                toast.error("Failed to leave task");
              }
            } catch {
              toast.error("Failed to leave task");
            }
          }}
        >
          Leave task
        </button>
      </div>

      {viewerIndex !== null && taskDetail?.attachments?.[viewerIndex] && (
        <FileViewerModal
          files={taskDetail.attachments}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

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

// ─── Helpers (same look as /my-tasks panel) ──────────────────────

function ActionIconButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center justify-center h-7 w-7 rounded-md text-[#6f7782] hover:bg-[#f3f4f6] hover:text-[#1e1f21] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function PropertyRow({
  label,
  accessory,
  children,
}: {
  label: string;
  accessory?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 min-h-9 py-1.5 border-b border-[#eeeeee] last:border-b-0">
      <div className="w-[120px] flex-shrink-0 flex items-center gap-1.5 pt-1">
        <span className="text-[12px] text-[#6f7782]">{label}</span>
        {accessory}
      </div>
      <div className="flex-1 min-w-0 flex items-center min-h-[28px]">
        {children}
      </div>
    </div>
  );
}

function PriorityTag({ value }: { value: string }) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    HIGH: { label: "High", bg: "bg-[#fce4e4]", text: "text-[#a8323a]" },
    MEDIUM: { label: "Medium", bg: "bg-[#fbeed3]", text: "text-[#7a5b1b]" },
    LOW: { label: "Low", bg: "bg-[#e1eefc]", text: "text-[#274a73]" },
  };
  const conf = config[value] || {
    label: value,
    bg: "bg-[#f3f4f6]",
    text: "text-[#1e1f21]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[12px] font-medium",
        conf.bg,
        conf.text
      )}
    >
      {conf.label}
    </span>
  );
}

function DependencyChip({
  dependency,
  taskId,
  onChanged,
  onRemove,
}: {
  dependency: TaskDependency;
  taskId: string;
  onChanged: () => void;
  onRemove: () => void;
}) {
  const { id, type, blockingTask: bt } = dependency;
  const meta =
    DEPENDENCY_TYPE_META[type] ?? DEPENDENCY_TYPE_META.FINISH_TO_START;
  const start = bt.startDate ? new Date(bt.startDate) : null;
  const due = bt.dueDate ? new Date(bt.dueDate) : null;
  const dateLabel = formatRangeLabel(
    start,
    due,
    due
      ? due.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : ""
  );

  async function changeType(next: DependencyTypeStr) {
    if (next === type) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/dependencies?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Dependency type updated");
      onChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't update dependency"
      );
    }
  }

  return (
    <div className="group flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] -ml-1.5 px-1.5 py-1 rounded hover:bg-[#f9fafb]">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-1 text-[#6f7782] hover:text-[#1e1f21] cursor-pointer">
            <ArrowLeftRight className="h-3 w-3 -rotate-90" />
            <span>Blocked by</span>
            <span className="text-[#9aa0a6]">·</span>
            <span className="font-medium tabular-nums">{meta.short}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          {(Object.keys(DEPENDENCY_TYPE_META) as DependencyTypeStr[]).map(
            (k) => (
              <DropdownMenuItem
                key={k}
                onClick={() => changeType(k)}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-[13px]">
                  {DEPENDENCY_TYPE_META[k].label}
                </span>
                <span className="text-[11px] text-[#6f7782] font-medium tabular-nums">
                  {DEPENDENCY_TYPE_META[k].short}
                </span>
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="inline-flex items-center gap-1.5 min-w-0">
        <div
          className={cn(
            "w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0",
            bt.completed
              ? "bg-[#c9a84c] border-[#c9a84c]"
              : "border-[#c4c7cf]"
          )}
        >
          {bt.completed && <Check className="w-2.5 h-2.5 text-white" />}
        </div>
        <span
          className={cn(
            "truncate max-w-[180px]",
            bt.completed ? "text-[#9aa0a6] line-through" : "text-[#1e1f21]"
          )}
          title={bt.name}
        >
          {bt.name}
        </span>
      </div>

      {dateLabel && (
        <>
          <span className="text-[#9aa0a6]">·</span>
          <span className="text-[#6f7782] whitespace-nowrap">{dateLabel}</span>
        </>
      )}

      <button
        onClick={onRemove}
        className="ml-auto opacity-0 group-hover:opacity-100 text-[#9aa0a6] hover:text-[#1e1f21] transition-opacity"
        aria-label={`Remove dependency on ${bt.name}`}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
