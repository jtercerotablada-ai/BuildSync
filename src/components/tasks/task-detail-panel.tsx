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

import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  type ButtonHTMLAttributes,
} from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Lock,
  Download,
  Trash2,
  Calendar,
  ArrowLeftRight,
  ChevronDown,
  ShieldAlert,
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
import { EditableTagsCell } from "@/components/tasks/editable-tags-cell";
import {
  MentionInput,
  buildCommentContent,
  commentToPlainText,
  renderCommentContent,
  type MentionCandidate,
} from "@/components/tasks/comment-content";
import { FileViewerModal } from "@/components/files/file-viewer-modal";
import { downloadFile } from "@/lib/download";
import {
  formatFileSize,
  formatRangeLabel,
  formatDueDateLabel,
  projectTypeShort,
} from "@/lib/task-helpers";
import {
  daysFromToday,
  dueDateToLocalMidnight,
  toDateOnlyISO,
} from "@/lib/date-only";

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
  // Guest-comment fields — populated when an external submitter
  // posts via the tracking URL. authorId is null in that case so
  // we fall back to guestName for display.
  guestName?: string | null;
  source?: "INTERNAL" | "TRACKING_REPLY";
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
  assignee?: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
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

interface TaskDependent {
  id: string;
  type: DependencyTypeStr;
  dependentTask: {
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
  isPrivate?: boolean;
  dueDate: string | null;
  startDate: string | null;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH" | string;
  taskStatus?: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | null;
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
  creator?: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  createdAt?: string;
  subtasks?: TaskSubtask[];
  comments?: TaskComment[];
  activities?: TaskActivity[];
  attachments?: TaskAttachment[];
  collaborators?: TaskCollaborator[];
  dependencies?: TaskDependency[];
  dependents?: TaskDependent[];
  customFieldValues?: TaskCustomFieldValue[];
  taskTags?: { tag: { id: string; name: string; color: string } }[];
  taskProjects?: {
    id: string;
    projectId: string;
    project: { id: string; name: string; color: string };
  }[];
  _count?: { likes?: number };
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
  const { data: session } = useSession();
  const sessionUser = session?.user as
    | { id?: string; name?: string | null; image?: string | null }
    | undefined;

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
  // Inline edit of an existing (own) comment.
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  // @-mention typeahead: who can be mentioned (the home project's members)
  // and which mentions the user confirmed in the current draft.
  const [mentionCandidates, setMentionCandidates] = useState<
    MentionCandidate[]
  >([]);
  const [stagedMentions, setStagedMentions] = useState<MentionCandidate[]>([]);

  // ── Like state ─────────────────────────────────────────────────
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);

  // ── Sections of the task's home project (for the Section row) ──
  const [projectSections, setProjectSections] = useState<
    { id: string; name: string }[]
  >([]);

  // ─────────────────────────────────────────────────────────────
  // FETCH TASK DETAIL
  // ─────────────────────────────────────────────────────────────

  // Which task the panel currently displays — refetches for the SAME task
  // (after an inline edit) keep the content on screen instead of swapping
  // the whole panel for a spinner on every save.
  const loadedTaskIdRef = useRef<string | null>(null);

  const fetchTaskDetail = async () => {
    if (loadedTaskIdRef.current !== taskId) setLoading(true);
    try {
      const [detailRes, likeRes] = await Promise.all([
        fetch(`/api/tasks/${taskId}`),
        fetch(`/api/tasks/${taskId}/like`),
      ]);
      if (!detailRes.ok) throw new Error("Failed to fetch task");
      const data: TaskDetail = await detailRes.json();
      setTaskDetail(data);
      setName(data.name);
      setDescription(data.description || "");
      setLikeCount(data._count?.likes ?? 0);
      if (likeRes.ok) {
        const likeData = await likeRes.json();
        setLiked(Boolean(likeData.liked));
      }
      loadedTaskIdRef.current = taskId;
    } catch {
      toast.error("Failed to load task");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskDetail();
    // Reset the comment draft when the panel swaps to a different task —
    // the panel stays mounted across taskId changes, so a mention staged
    // (or text typed) on task A must not leak into task B's comment.
    setNewComment("");
    setStagedMentions([]);
    setPendingCommentFiles([]);
    setEditingCommentId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Load the home project's sections so the Section row can move the task.
  useEffect(() => {
    const pid = taskDetail?.project?.id;
    if (!pid) {
      setProjectSections([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/projects/${pid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { sections?: { id: string; name: string }[] } | null) => {
        if (!cancelled && d?.sections) {
          setProjectSections(d.sections.map((s) => ({ id: s.id, name: s.name })));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [taskDetail?.project?.id]);

  // Load the project's members for the @-mention typeahead. The server
  // gates mention fan-out to project membership, so this is the same
  // audience it will accept. Tasks without a project keep an empty list
  // (typeahead simply never opens).
  useEffect(() => {
    const pid = taskDetail?.project?.id;
    if (!pid) {
      setMentionCandidates([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/projects/${pid}/members`)
      .then((r) => (r.ok ? r.json() : []))
      .then(
        (
          rows:
            | {
                userId: string;
                user: {
                  id: string;
                  name: string | null;
                  email: string | null;
                  image: string | null;
                };
              }[]
            | unknown
        ) => {
          if (cancelled || !Array.isArray(rows)) return;
          const seen = new Set<string>();
          const list: MentionCandidate[] = [];
          for (const row of rows) {
            const u = row?.user;
            if (!u?.id || seen.has(u.id)) continue;
            seen.add(u.id);
            list.push({
              id: u.id,
              name: u.name ?? null,
              email: u.email ?? null,
              image: u.image ?? null,
            });
          }
          setMentionCandidates(list);
        }
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [taskDetail?.project?.id]);

  async function handleToggleLike() {
    if (likeBusy) return;
    setLikeBusy(true);
    const prev = liked;
    const prevCount = likeCount;
    setLiked(!prev);
    setLikeCount((c) => c + (prev ? -1 : 1));
    try {
      const res = await fetch(`/api/tasks/${taskId}/like`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setLiked(Boolean(data.liked));
      if (typeof data.count === "number") setLikeCount(data.count);
    } catch {
      setLiked(prev);
      setLikeCount(prevCount);
      toast.error("Failed to update like");
    } finally {
      setLikeBusy(false);
    }
  }

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

  // Removing a "Blocks" relationship: the dependency row lives on the
  // OTHER (dependent) task, so we DELETE against that task's endpoint.
  async function handleDependentRemove(
    dependencyId: string,
    dependentTaskId: string
  ) {
    try {
      const res = await fetch(
        `/api/tasks/${dependentTaskId}/dependencies?id=${dependencyId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Removed");
      await fetchTaskDetail();
      onUpdate?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't remove"
      );
    }
  }

  // ─── Multi-homing: add / remove ADDITIONAL projects ───────────

  async function handleAddToProject(projectId: string) {
    try {
      const res = await fetch(`/api/tasks/${taskId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      toast.success("Added to project");
      await fetchTaskDetail();
      onUpdate?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't add to project"
      );
    }
  }

  async function handleRemoveFromProject(projectId: string) {
    try {
      const res = await fetch(
        `/api/tasks/${taskId}/projects?projectId=${projectId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Removed from project");
      await fetchTaskDetail();
      onUpdate?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't remove from project"
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
      // Wrap confirmed @-mentions in the data-user-id spans the server
      // parses for MENTIONED notifications; plain comments go unchanged.
      const content = hasText
        ? buildCommentContent(newComment, stagedMentions)
        : " ";
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
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
      setStagedMentions([]);
      setPendingCommentFiles([]);
      if (commentFileInputRef.current) commentFileInputRef.current.value = "";
      await fetchTaskDetail();
      // The comment count changed either way — let the parent refresh its
      // counters (not only when files were attached).
      onUpdate?.();
      if (attachmentsUploaded > 0) {
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

  async function handleSaveCommentEdit(commentId: string) {
    const text = editingCommentText.trim();
    setEditingCommentId(null);
    if (!text) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to edit comment");
      }
      await fetchTaskDetail();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to edit comment"
      );
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete comment");
      }
      await fetchTaskDetail();
      onUpdate?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete comment"
      );
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
          <div className="flex items-center">
            <ActionIconButton
              onClick={handleToggleLike}
              disabled={likeBusy}
              title={liked ? "Unlike" : "Like"}
              className={cn(liked && "text-[#c9a84c]")}
            >
              <Heart
                className={cn(
                  "h-[15px] w-[15px]",
                  liked && "fill-current"
                )}
              />
            </ActionIconButton>
            {likeCount > 0 && (
              <span className="text-[12px] tabular-nums text-[#6f7782] -ml-1 mr-0.5">
                {likeCount}
              </span>
            )}
          </div>
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
          {/* Overdue strip — compares by UTC calendar day (date-only.ts)
              so a task due today is never falsely flagged overdue for
              viewers west of UTC. */}
          {taskDetail?.dueDate &&
            !taskDetail.completed &&
            daysFromToday(taskDetail.dueDate) < 0 && (
              <div className="px-4 py-2 bg-black text-white text-[12px] font-medium flex items-center gap-2 border-b border-black">
                <Flag className="h-3.5 w-3.5 text-[#c9a84c] flex-shrink-0" />
                {(() => {
                  const days = -daysFromToday(taskDetail.dueDate);
                  return `Overdue · ${days} day${days === 1 ? "" : "s"} past due`;
                })()}
              </div>
            )}

          {/* Visibility bar — reads Task.isPrivate and lets the user
              switch between project-visible and private-to-collaborators. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full px-5 h-9 bg-[#f6f7f8] text-[12px] text-[#6f7782] flex items-center gap-1.5 hover:bg-[#eef0f2] transition-colors">
                {taskDetail?.isPrivate ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  <Globe className="h-3 w-3" />
                )}
                {taskDetail?.isPrivate
                  ? "This task is private — only its collaborators can see it"
                  : "This task is visible to everyone in the workspace"}
                <ChevronDown className="h-3 w-3 ml-auto" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[320px]">
              <DropdownMenuItem
                onClick={() => handleUpdate("isPrivate", false)}
              >
                <Globe className="mr-2 h-4 w-4 text-[#6f7782]" />
                <div className="flex-1">
                  <div className="text-[13px]">Visible to the project</div>
                  <div className="text-[11px] text-[#6f7782]">
                    Everyone with project access can see this task
                  </div>
                </div>
                {!taskDetail?.isPrivate && (
                  <Check className="h-4 w-4 text-[#1e1f21]" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleUpdate("isPrivate", true)}
              >
                <Lock className="mr-2 h-4 w-4 text-[#6f7782]" />
                <div className="flex-1">
                  <div className="text-[13px]">Private to collaborators</div>
                  <div className="text-[11px] text-[#6f7782]">
                    Only the assignee, creator and collaborators can see it
                  </div>
                </div>
                {taskDetail?.isPrivate && (
                  <Check className="h-4 w-4 text-[#1e1f21]" />
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
              onBlur={() => {
                if (name.trim() && name !== taskDetail?.name) {
                  handleUpdate("name", name);
                } else if (!name.trim()) {
                  // Blanked title → revert to the stored name (Asana does
                  // the same) instead of leaving the box empty.
                  setName(taskDetail?.name || "");
                }
              }}
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
                    ? dueDateToLocalMidnight(taskDetail.startDate)
                    : null
                }
                dueDate={
                  taskDetail?.dueDate
                    ? dueDateToLocalMidnight(taskDetail.dueDate)
                    : null
                }
                onChange={async (start, due) => {
                  try {
                    const res = await fetch(`/api/tasks/${taskId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        startDate: start ? toDateOnlyISO(start) : null,
                        dueDate: due ? toDateOnlyISO(due) : null,
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
                            ? dueDateToLocalMidnight(taskDetail.startDate)
                            : null,
                          taskDetail?.dueDate
                            ? dueDateToLocalMidnight(taskDetail.dueDate)
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

            {(() => {
              const deps: TaskDependent[] = taskDetail?.dependents ?? [];
              return (
                <PropertyRow
                  label="Blocks"
                  accessory={
                    deps.length > 0 && (
                      <span className="text-[11px] text-[#6f7782] tabular-nums">
                        {deps.length}
                      </span>
                    )
                  }
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-1 py-0.5">
                    {deps.map((dep) => (
                      <div
                        key={dep.id}
                        className="group flex items-center gap-1.5 text-[12px] -ml-1.5 px-1.5 py-1 rounded hover:bg-[#f9fafb]"
                      >
                        <ShieldAlert className="h-3 w-3 text-[#c9a84c] flex-shrink-0" />
                        <div
                          className={cn(
                            "w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0",
                            dep.dependentTask.completed
                              ? "bg-[#c9a84c] border-[#c9a84c]"
                              : "border-[#c4c7cf]"
                          )}
                        >
                          {dep.dependentTask.completed && (
                            <Check className="w-2.5 h-2.5 text-white" />
                          )}
                        </div>
                        <span
                          className={cn(
                            "truncate max-w-[220px]",
                            dep.dependentTask.completed
                              ? "text-[#9aa0a6] line-through"
                              : "text-[#1e1f21]"
                          )}
                          title={dep.dependentTask.name}
                        >
                          {dep.dependentTask.name}
                        </span>
                        <button
                          onClick={() =>
                            handleDependentRemove(dep.id, dep.dependentTask.id)
                          }
                          className="ml-auto opacity-0 group-hover:opacity-100 text-[#9aa0a6] hover:text-[#1e1f21] transition-opacity"
                          aria-label={`Stop blocking ${dep.dependentTask.name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <DependenciesPicker
                      taskId={taskId}
                      mode="blocks"
                      existingBlockingTaskIds={deps.map(
                        (d) => d.dependentTask.id
                      )}
                      onAdded={() => {
                        fetchTaskDetail();
                        onUpdate?.();
                      }}
                      trigger={
                        <button className="-ml-1.5 px-1.5 py-0.5 rounded text-[13px] text-[#3b82f6] hover:bg-[#f3f4f6] hover:underline cursor-pointer text-left w-fit">
                          Add tasks this blocks
                        </button>
                      }
                    />
                  </div>
                </PropertyRow>
              );
            })()}

            <PropertyRow
              label="Projects"
              accessory={(() => {
                const count =
                  (taskDetail?.project ? 1 : 0) +
                  (taskDetail?.taskProjects?.length ?? 0);
                return count > 0 ? (
                  <span className="text-[11px] text-[#6f7782] tabular-nums">
                    {count}
                  </span>
                ) : undefined;
              })()}
            >
              <div className="flex-1 min-w-0">
                {/* Home project (Task.projectId) */}
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
                  excludeIds={
                    taskDetail?.taskProjects?.map((tp) => tp.projectId) ?? []
                  }
                />
                {taskDetail?.project && taskDetail.project.type && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className="text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#f3f4f6] text-[#6f7782]"
                      title={`Project type: ${taskDetail.project.type}`}
                    >
                      {projectTypeShort(taskDetail.project.type)}
                    </span>
                  </div>
                )}

                {/* Additional projects (multi-homing) */}
                {taskDetail?.taskProjects &&
                  taskDetail.taskProjects.length > 0 && (
                    <div className="mt-1.5 flex flex-col gap-1">
                      {taskDetail.taskProjects.map((tp) => (
                        <div
                          key={tp.id}
                          className="group flex items-center gap-1.5 -ml-1.5 px-1.5 py-0.5 rounded hover:bg-[#f3f4f6]"
                        >
                          <span
                            className="w-2 h-2 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: tp.project.color || "#22C55E" }}
                          />
                          <span className="text-[13px] text-[#1e1f21] truncate">
                            {tp.project.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromProject(tp.projectId)}
                            aria-label={`Remove from ${tp.project.name}`}
                            className="ml-auto opacity-0 group-hover:opacity-100 text-[#9aa0a6] hover:text-[#1e1f21] transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                {/* Add to another project (only once it has a home) */}
                {taskDetail?.project && (
                  <div className="mt-1">
                    <ProjectSelector
                      value={null}
                      onChange={(project) =>
                        project && handleAddToProject(project.id)
                      }
                      excludeIds={[
                        taskDetail.project.id,
                        ...(taskDetail.taskProjects?.map((tp) => tp.projectId) ??
                          []),
                      ]}
                    />
                  </div>
                )}
              </div>
            </PropertyRow>

            {/* Section — the task's column/group inside its home project.
                Was fetched + PATCH-able but had no UI. */}
            {taskDetail?.project && (
              <PropertyRow label="Section">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="-ml-1.5 px-1.5 py-0.5 rounded hover:bg-[#f3f4f6] cursor-pointer text-left"
                    >
                      {taskDetail?.section?.name ? (
                        <span className="text-[13px] text-[#1e1f21]">
                          {taskDetail.section.name}
                        </span>
                      ) : (
                        <span className="text-[13px] text-[#6f7782]">
                          No section
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                    {projectSections.length === 0 ? (
                      <DropdownMenuItem disabled>No sections</DropdownMenuItem>
                    ) : (
                      projectSections.map((s) => (
                        <DropdownMenuItem
                          key={s.id}
                          onClick={() => handleUpdate("sectionId", s.id)}
                        >
                          <span className="flex-1 truncate">{s.name}</span>
                          {taskDetail?.section?.id === s.id && (
                            <Check className="h-3.5 w-3.5 ml-2 text-[#1e1f21]" />
                          )}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </PropertyRow>
            )}

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

            {/* Status — same enum chips as the List view's Status column
                (the field was editable there but absent here). */}
            <PropertyRow label="Status">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="-ml-1.5 px-1.5 py-0.5 rounded hover:bg-[#f3f4f6] cursor-pointer"
                  >
                    {taskDetail?.taskStatus === "ON_TRACK" ? (
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-[#85D7A2] text-[#06321B]">
                        On track
                      </span>
                    ) : taskDetail?.taskStatus === "AT_RISK" ? (
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-[#F6D861] text-[#352B00]">
                        At risk
                      </span>
                    ) : taskDetail?.taskStatus === "OFF_TRACK" ? (
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-[#FF878A] text-[#4F1A1D]">
                        Off track
                      </span>
                    ) : (
                      <span className="text-[13px] text-[#6f7782]">
                        No status
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => handleUpdate("taskStatus", "ON_TRACK")}
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-[#1d6b3e] mr-2" />
                    On track
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleUpdate("taskStatus", "AT_RISK")}
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-[#a8893a] mr-2" />
                    At risk
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleUpdate("taskStatus", "OFF_TRACK")}
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-black mr-2" />
                    Off track
                  </DropdownMenuItem>
                  {taskDetail?.taskStatus && (
                    <DropdownMenuItem
                      onClick={() => handleUpdate("taskStatus", null)}
                    >
                      <span className="inline-block w-2 h-2 rounded-full bg-slate-300 mr-2" />
                      Clear status
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </PropertyRow>

            <PropertyRow
              label="Tags"
              accessory={
                taskDetail?.taskTags && taskDetail.taskTags.length > 0 ? (
                  <span className="text-[11px] text-[#6f7782] tabular-nums">
                    {taskDetail.taskTags.length}
                  </span>
                ) : undefined
              }
            >
              <EditableTagsCell
                taskId={taskId}
                value={taskDetail?.taskTags ?? []}
                onChange={() => {
                  fetchTaskDetail();
                  onUpdate?.();
                }}
              />
            </PropertyRow>

            {/* Project's custom fields */}
            <CustomFieldsSection
              taskId={taskId}
              projectId={taskDetail?.project?.id ?? null}
              extraProjectIds={
                taskDetail?.taskProjects?.map((tp) => tp.projectId) ?? []
              }
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
                  {subtask.assignee && (
                    <Avatar
                      className="h-5 w-5 flex-shrink-0"
                      title={subtask.assignee.name || undefined}
                    >
                      <AvatarImage src={subtask.assignee.image || undefined} />
                      <AvatarFallback className="text-[9px] bg-[#c9a84c] text-white">
                        {(subtask.assignee.name || "?").charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  )}
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
                {/* Creation entry — Asana shows who created the task at the
                    top of the feed. */}
                {taskDetail?.creator && taskDetail?.createdAt && (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-6 w-6">
                      <AvatarImage
                        src={taskDetail.creator.image || undefined}
                      />
                      <AvatarFallback className="text-[10px] bg-white border border-black">
                        {(taskDetail.creator.name || "?").charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-xs text-[#6f7782]">
                      <span className="font-medium text-[#1e1f21]">
                        {taskDetail.creator.name || "Someone"}
                      </span>{" "}
                      created this task ·{" "}
                      {new Date(taskDetail.createdAt).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" }
                      )}
                    </p>
                  </div>
                )}
                {taskDetail?.comments?.map((comment) => {
                  const atts = (comment.attachments ?? []) as TaskAttachment[];
                  // Resolve display name + "via tracking link" badge
                  // when the comment came from an external submitter.
                  // No author → fall back to guestName; mark the row
                  // visually so the engineer knows it's from outside.
                  const isGuest = comment.source === "TRACKING_REPLY";
                  const displayName =
                    comment.author?.name ||
                    comment.guestName ||
                    "Deleted user";
                  const isOwn =
                    !!comment.author?.id &&
                    comment.author.id === sessionUser?.id;
                  return (
                    <div key={comment.id} className="flex gap-3 group/comment">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={comment.author?.image || undefined} />
                        <AvatarFallback
                          className={
                            isGuest
                              ? "text-xs bg-slate-100 text-slate-700 border border-slate-300"
                              : "text-xs bg-white border border-black"
                          }
                        >
                          {displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {displayName}
                          </span>
                          {isGuest && (
                            <span className="text-[10px] uppercase tracking-wider text-[#a8893a] bg-[#fdf7e8] border border-[#e0c87a] px-1.5 py-[1px] rounded font-semibold">
                              via tracking link
                            </span>
                          )}
                          <span className="text-xs text-black">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                          {isOwn && editingCommentId !== comment.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="ml-auto opacity-0 group-hover/comment:opacity-100 data-[state=open]:opacity-100 text-[#9aa0a6] hover:text-[#1e1f21] transition-opacity"
                                  aria-label="Comment options"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingCommentId(comment.id);
                                    // Mention spans → plain @Name text for
                                    // the edit box (saving keeps the text;
                                    // the chip linkage is dropped).
                                    setEditingCommentText(
                                      commentToPlainText(comment.content)
                                    );
                                  }}
                                >
                                  Edit comment
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-black"
                                  onClick={() => handleDeleteComment(comment.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete comment
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        {editingCommentId === comment.id ? (
                          <textarea
                            autoFocus
                            value={editingCommentText}
                            onChange={(e) =>
                              setEditingCommentText(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveCommentEdit(comment.id);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                setEditingCommentId(null);
                              }
                            }}
                            onBlur={() => handleSaveCommentEdit(comment.id)}
                            rows={2}
                            className="mt-1 w-full text-sm border border-[#c4c7cf] rounded-md px-2 py-1.5 outline-none focus:border-[#1e1f21] resize-none"
                          />
                        ) : comment.content && comment.content.trim() ? (
                          <p className="text-sm text-black mt-1 whitespace-pre-wrap break-words">
                            {renderCommentContent(comment.content)}
                          </p>
                        ) : null}
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
            <AvatarImage src={sessionUser?.image || undefined} />
            <AvatarFallback className="text-[11px] bg-[#1e1f21] text-white">
              {(sessionUser?.name || "U").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 rounded-md border border-[#e8e8e8] bg-white focus-within:border-[#c4c7cf] transition-colors px-2.5 py-1.5">
              <MentionInput
                value={newComment}
                onChange={setNewComment}
                candidates={mentionCandidates}
                onMentionAdd={(member) =>
                  setStagedMentions((prev) =>
                    prev.some((m) => m.id === member.id)
                      ? prev
                      : [...prev, member]
                  )
                }
                onSubmit={() => {
                  if (!postingComment) handleAddComment();
                }}
                placeholder={
                  pendingCommentFiles.length > 0
                    ? "Caption (optional)…"
                    : "Add a comment… @ to mention"
                }
                disabled={postingComment}
                className="w-full text-[13px] bg-transparent outline-none placeholder:text-[#9aa0a6] text-[#1e1f21] leading-5 max-h-24 overflow-y-auto"
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
              <div key={collab.id} className="group relative">
                <Avatar className="h-5 w-5" title={collab.name || "User"}>
                  <AvatarImage src={collab.image || undefined} />
                  <AvatarFallback className="text-[9px] bg-[#1e1f21] text-white">
                    {(collab.name || "U").charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  aria-label={`Remove ${collab.name || "collaborator"}`}
                  onClick={async () => {
                    try {
                      const res = await fetch(
                        `/api/tasks/${taskId}/collaborators?userId=${collab.id}`,
                        { method: "DELETE" }
                      );
                      if (res.ok) {
                        fetchTaskDetail();
                      } else {
                        toast.error("Failed to remove collaborator");
                      }
                    } catch {
                      toast.error("Failed to remove collaborator");
                    }
                  }}
                  className="absolute -top-1 -right-1 hidden group-hover:flex h-3 w-3 items-center justify-center rounded-full bg-[#1e1f21] text-white"
                >
                  <X className="h-2 w-2" />
                </button>
              </div>
            ))}
            {(!taskDetail?.collaborators ||
              taskDetail.collaborators.length === 0) && (
              <span className="text-[12px] text-[#9aa0a6]">None yet</span>
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

// forwardRef + props-spread is REQUIRED so this button works as a
// `DropdownMenuTrigger asChild` child. Radix injects onClick + ref +
// aria-* attrs onto the child element; without forwardRef the menu
// silently never opens. Same reason any Popover/Tooltip trigger
// reaches for forwardRef.
const ActionIconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(function ActionIconButton({ children, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      className={cn(
        "flex items-center justify-center h-7 w-7 rounded-md text-[#6f7782] hover:bg-[#f3f4f6] hover:text-[#1e1f21] disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      {children}
    </button>
  );
});

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
  const start = bt.startDate ? dueDateToLocalMidnight(bt.startDate) : null;
  const due = bt.dueDate ? dueDateToLocalMidnight(bt.dueDate) : null;
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
