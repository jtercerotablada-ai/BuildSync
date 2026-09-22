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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { uploadDirect, responseError } from "@/lib/direct-upload";
import {
  UPLOAD_ACCEPT,
  assertFileAllowed,
  uploadMaxBytesFor,
} from "@/lib/storage";
import { NON_CONTRIBUTOR_ROLES } from "@/lib/workspace-roles";
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
  Layers,
  ShieldAlert,
  UserPlus2,
  ListPlus,
  Copy,
  Printer,
  CornerUpRight,
  CheckSquare,
  ArrowUpRight,
  CornerLeftUp,
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
import { TASK_MUTATED_EVENT } from "@/lib/task-events";
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
import { activityText } from "@/lib/activity-text";
import { useToday } from "@/lib/use-today";

interface TaskDetailPanelProps {
  taskId: string;
  onClose: () => void;
  onUpdate?: () => void;
  onAttachmentsChange?: () => void;
  /** How the panel is presented. "slideover" (default) is the right-side
   *  drawer used by project / task-detail views; "centered" is a centered
   *  modal with a click-to-close backdrop, used by the Home My-Tasks widget;
   *  "page" is static and fills its container, for the full-page /tasks/[id]
   *  route (a fixed drawer there sat beside an empty column). */
  presentation?: "slideover" | "centered" | "page";
  /** Personal My-Tasks sections. When supplied (by /my-tasks), the panel
   *  shows a "Section" row that moves the task between the user's personal
   *  buckets via onMoveToSection. Absent everywhere else. */
  personalSections?: { id: string; name: string }[];
  currentSectionId?: string | null;
  onMoveToSection?: (sectionId: string) => void | Promise<void>;
}

interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: string;
  /** Who uploaded it — everyone may remove their OWN file, only writers may
   *  remove someone else's. */
  uploaderId?: string | null;
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
  /** EXTERNAL comments are published on the submitter's public tracking
   *  page; INTERNAL_NOTE ones never leave the team. */
  visibility?: "EXTERNAL" | "INTERNAL_NOTE";
  attachments?: TaskAttachment[];
}

interface TaskActivity {
  id: string;
  type: string;
  createdAt: string;
  /** The row's Json payload. Carried because the feed used to print the bare
   *  enum name, so a cascade-written row read "due date changed" without the
   *  date it moved to or the blocker that moved it. */
  data?: Record<string, unknown> | null;
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
  parentTaskId?: string | null;
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
    type?: "CONSTRUCTION" | "DESIGN" | "RECERTIFICATION" | "PERMIT" | "BSIP" | null;
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
  /** True when a form submission created this task, so it has a public
   *  tracking page a comment can be shared to. */
  hasExternalTracking?: boolean;
  /** What the CALLER may do, resolved server-side by the same rule the API
   *  enforces. Undefined only while the detail is still loading — treat that
   *  as "allowed" so nothing flickers disabled for the common case. */
  canWrite?: boolean;
  canComment?: boolean;
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

/**
 * Above this, an attachment goes browser → blob storage instead of through
 * the attachments route.
 *
 * 4MB, deliberately well under the ~4.5MB body a Vercel function will accept:
 * the multipart envelope, the filename and the boundary all ride along with
 * the bytes, so a file measured at exactly the platform limit still arrives
 * over it. Anything below keeps the simpler single-request path — it is one
 * round trip.
 */
const DIRECT_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024;

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
  presentation = "slideover",
  personalSections = [],
  currentSectionId = null,
  onMoveToSection,
}: TaskDetailPanelProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const sessionUser = session?.user as
    | { id?: string; name?: string | null; image?: string | null }
    | undefined;

  // ── Data state ────────────────────────────────────────────────
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  // Why the CURRENT task could not be shown. Keyed by task id so a failure
  // for task A can never render over task B.
  const [loadError, setLoadError] = useState<{
    taskId: string;
    status: number;
  } | null>(null);

  // The viewer's own calendar day — the only day the due-date label and the
  // overdue strip may be measured against. Reading the clock while rendering
  // would take the SERVER's day, which runs in UTC and is already tomorrow
  // from 20:00 in Miami. It is also `null` until mount, and it re-arms at
  // local midnight, so a panel left open overnight rolls its "2 days past
  // due" forward instead of freezing on yesterday's count.
  const today = useToday();

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
  // Enter pressed twice while the first POST is in flight must not create
  // the subtask twice. The ref is the guard; the state only drives the UI.
  const addingSubtaskRef = useRef(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  // ── Subtask inline rename (click the name to edit) ─────────────
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskName, setEditingSubtaskName] = useState("");
  // Escape reverts without saving; every other blur commits — the flag
  // lets the shared onBlur handler tell the two apart.
  const cancelSubtaskEditRef = useRef(false);

  // Panel root — the Escape handler below uses it to tell "focus is inside
  // this panel" from "focus is in a portalled menu on top of it".
  const panelRef = useRef<HTMLDivElement>(null);

  // ── File attachment upload ────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // A 200MB model takes minutes. Without a number on screen the panel just
  // looks frozen, so the direct-to-storage path reports where it is.
  const [uploadProgress, setUploadProgress] = useState<{
    name: string;
    percentage: number;
  } | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // ── Comment composer (+ inline attachments) ───────────────────
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const [newComment, setNewComment] = useState("");
  const [pendingCommentFiles, setPendingCommentFiles] = useState<File[]>([]);
  const [postingComment, setPostingComment] = useState(false);
  // Comments are internal unless the author opts in — see the visibility
  // note in POST /api/tasks/[taskId]/comments. It MUST return to false after
  // every post and on every task switch: a sticky checkbox turns one
  // deliberate "send this to the client" into a standing publish of every
  // note typed afterwards, which is the exact leak the flag exists to stop.
  const [shareWithSubmitter, setShareWithSubmitter] = useState(false);
  // Server-resolved capabilities. The panel stays mounted across taskId
  // changes and its header renders outside the loading gate, so an ungated
  // read of taskDetail would hand task B the capabilities of task A for the
  // length of the fetch. Fail closed until the answer for THIS task is in.
  const capsKnown = taskDetail?.id === taskId;
  const canWrite = capsKnown && taskDetail?.canWrite !== false;
  const canComment = capsKnown && taskDetail?.canComment !== false;
  const currentLoadError = loadError?.taskId === taskId ? loadError : null;
  const [commentViewer, setCommentViewer] = useState<{
    files: TaskAttachment[];
    index: number;
  } | null>(null);
  // Inline edit of an existing (own) comment.
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  // Enter saves and the blur that follows would save again; one PATCH at a
  // time, and the editor stays open until the server has the text.
  const savingCommentEditRef = useRef(false);
  const [savingCommentEdit, setSavingCommentEdit] = useState(false);
  // @-mention typeahead: who can be mentioned (everyone the server will let
  // the mention reach) and which mentions the user confirmed in the draft.
  const [projectAudience, setProjectAudience] = useState<MentionCandidate[]>(
    []
  );
  const [workspaceManagerIds, setWorkspaceManagerIds] = useState<string[]>([]);
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

  // Only the newest request may write the panel. The panel stays mounted
  // across taskId changes, so without this a slow response for task A that
  // lands after task B's would put A's title on screen while every edit
  // PATCHes B.
  const latestFetchRef = useRef(0);

  // The task shown NOW. A handler from task A's render (a save that resolves
  // after the user clicked task B) calls its own copy of fetchTaskDetail; if
  // that stale call took a newer sequence number it would discard B's load
  // and leave B's panel on a spinner with nothing pending.
  const taskIdRef = useRef(taskId);
  taskIdRef.current = taskId;

  const fetchTaskDetail = async () => {
    const requestedId = taskId;
    if (requestedId !== taskIdRef.current) return;
    const seq = ++latestFetchRef.current;
    const isSwitch = loadedTaskIdRef.current !== requestedId;
    if (isSwitch) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const [detailRes, likeRes] = await Promise.all([
        fetch(`/api/tasks/${requestedId}`),
        fetch(`/api/tasks/${requestedId}/like`),
      ]);
      if (seq !== latestFetchRef.current) return;
      if (!detailRes.ok) {
        // 403/404: deleted, made private, or never visible. Anything else on
        // a task already on screen is a hiccup — keep the content and say so.
        // On a switch there is nothing of THIS task to keep, so the previous
        // task's content must go rather than sit under the new id.
        const gone = detailRes.status === 404 || detailRes.status === 403;
        if (gone || isSwitch) {
          loadedTaskIdRef.current = null;
          setTaskDetail(null);
          setName("");
          setDescription("");
          setLoadError({ taskId: requestedId, status: detailRes.status });
        } else {
          toast.error("Couldn't refresh this task");
        }
        return;
      }
      const data: TaskDetail = await detailRes.json();
      const likeData = likeRes.ok ? await likeRes.json().catch(() => null) : null;
      if (seq !== latestFetchRef.current) return;
      setTaskDetail(data);
      setName(data.name);
      setDescription(data.description || "");
      setLikeCount(data._count?.likes ?? 0);
      if (likeData) setLiked(Boolean(likeData.liked));
      setLoadError(null);
      loadedTaskIdRef.current = requestedId;
    } catch {
      if (seq !== latestFetchRef.current) return;
      if (isSwitch) {
        loadedTaskIdRef.current = null;
        setTaskDetail(null);
        setLoadError({ taskId: requestedId, status: 0 });
      } else {
        toast.error("Couldn't refresh this task");
      }
    } finally {
      if (seq === latestFetchRef.current) setLoading(false);
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
    // Same for a half-typed subtask or subtask rename: Enter on task B would
    // otherwise create or rename under B what was typed against A.
    setIsAddingSubtask(false);
    setNewSubtaskName("");
    setEditingSubtaskId(null);
    // Never carry a "send this to the client" opt-in into another task.
    setShareWithSubmitter(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Live-sync with the view behind the panel: when ANY surface mutates a
  // task (a list-row / board-card / gantt checkbox completing a blocker),
  // silently refetch so derived state here — chiefly the "Blocked" chip,
  // which clears when the last incomplete blocker completes — updates
  // without closing and reopening the panel. Same-task refetches don't
  // blank the panel (loadedTaskIdRef gate above).
  useEffect(() => {
    const handler = () => fetchTaskDetail();
    window.addEventListener(TASK_MUTATED_EVENT, handler);
    return () => window.removeEventListener(TASK_MUTATED_EVENT, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Every other overlay in the app closes on Escape; this one — the most
  // used of them — only had the small ✕. Close on Escape, but stand back
  // whenever something inside owns the key: an inline editor (Escape there
  // reverts the field), a dropdown / popover / dialog (Radix closes its own
  // layer, and its focus lives in a portal outside the panel), or one of the
  // file viewers stacked on top. The viewers listen on `window`, which fires
  // AFTER this document listener, so checking defaultPrevented is not enough.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (viewerIndex !== null || commentViewer) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body) {
        const tag = active.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          active.isContentEditable
        ) {
          return;
        }
        if (panelRef.current && !panelRef.current.contains(active)) return;
      }
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, viewerIndex, commentViewer]);

  // Load the home project once: its sections feed the Section row, and its
  // audience feeds the @-mention typeahead. The audience is everyone who can
  // READ the project, the rule the server applies to mentions
  // (resolveAllowedMentionUserIds): the owner, explicit members, the
  // workspace OWNER/ADMINs, and, unless the project is PRIVATE, every
  // contributor of its workspace. Offering only the ProjectMember rows left
  // most of the firm unmentionable on the default WORKSPACE projects.
  // Team-granted readers of a PRIVATE project are not listed here; the
  // server still accepts them. Tasks without a project get no typeahead —
  // the server ignores mentions there.
  useEffect(() => {
    const pid = taskDetail?.project?.id;
    if (!pid) {
      setProjectSections([]);
      setProjectAudience([]);
      setWorkspaceManagerIds([]);
      return;
    }
    let cancelled = false;
    type UserLite = {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
    Promise.all([
      fetch(`/api/projects/${pid}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/workspace/members`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(
        ([project, wsRows]: [
          {
            sections?: { id: string; name: string }[];
            owner?: UserLite | null;
            members?: { user?: UserLite | null }[];
            visibility?: string;
            workspaceId?: string;
          } | null,
          unknown,
        ]) => {
          if (cancelled || !project) return;
          if (project.sections) {
            setProjectSections(
              project.sections.map((s) => ({ id: s.id, name: s.name }))
            );
          }
          const byId = new Map<string, MentionCandidate>();
          const add = (u?: UserLite | null) => {
            if (!u?.id || byId.has(u.id)) return;
            byId.set(u.id, {
              id: u.id,
              name: u.name ?? null,
              email: u.email ?? null,
              image: u.image ?? null,
            });
          };
          add(project.owner);
          for (const m of project.members ?? []) add(m?.user);
          const managers: string[] = [];
          const rows = Array.isArray(wsRows)
            ? (wsRows as {
                workspaceId?: string;
                role?: string;
                user?: UserLite | null;
              }[])
            : [];
          for (const row of rows) {
            // /api/workspace/members lists the caller's primary workspace,
            // which need not be the project's.
            if (!row?.user || row.workspaceId !== project.workspaceId) continue;
            const role = row.role ?? "";
            const isManager = role === "OWNER" || role === "ADMIN";
            if (isManager) managers.push(row.user.id);
            if (
              isManager ||
              (project.visibility !== "PRIVATE" &&
                !NON_CONTRIBUTOR_ROLES.has(role))
            ) {
              add(row.user);
            }
          }
          setProjectAudience(Array.from(byId.values()));
          setWorkspaceManagerIds(managers);
        }
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [taskDetail?.project?.id]);

  // A private task narrows that audience to the people who can open it —
  // its creator, assignee, collaborators and the workspace leadership. The
  // server drops anyone else, so offering them would be a silent no-op.
  const mentionCandidates: MentionCandidate[] = taskDetail?.isPrivate
    ? (() => {
        const allowed = new Set<string>(workspaceManagerIds);
        if (taskDetail.creator?.id) allowed.add(taskDetail.creator.id);
        if (taskDetail.assignee?.id) allowed.add(taskDetail.assignee.id);
        for (const c of taskDetail.collaborators ?? []) allowed.add(c.id);
        return projectAudience.filter((u) => allowed.has(u.id));
      })()
    : projectAudience;

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

  /** Resolves true only when the server saved the change, so callers can
   *  tell the user it worked (or not) truthfully. */
  async function handleUpdate(field: string, value: unknown): Promise<boolean> {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        // Surface the server's reason. Every field edit in the panel goes
        // through here, so swallowing the body turned a permissions refusal
        // into a blank "Failed to update task".
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to update task");
      }
      await fetchTaskDetail();
      onUpdate?.();
      router.refresh();
      return true;
    } catch (err) {
      // The inline editors hold their own draft; put the saved value back so
      // a refused edit does not stay on screen looking saved.
      if (field === "name") setName(taskDetail?.name ?? "");
      if (field === "description") setDescription(taskDetail?.description ?? "");
      toast.error(
        err instanceof Error ? err.message : "Failed to update task"
      );
      return false;
    }
  }

  async function handleToggleComplete() {
    await handleUpdate("completed", !taskDetail?.completed);
  }

  // ─────────────────────────────────────────────────────────────
  // ATTACHMENT UPLOAD / DELETE
  // ─────────────────────────────────────────────────────────────

  async function postAttachment(body: FormData | string) {
    const res = await fetch(`/api/tasks/${taskId}/attachments`, {
      method: "POST",
      ...(typeof body === "string"
        ? { headers: { "Content-Type": "application/json" }, body }
        : { body }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
  }

  /**
   * One attachment, by whichever route its size allows.
   *
   * A big file cannot go through the attachments handler at all — Vercel caps
   * a function's request body far below what the store accepts — so above the
   * threshold the bytes go from here straight to blob storage and only a
   * description of the finished blob is posted to the API.
   */
  async function uploadAttachment(file: File, commentId?: string) {
    if (file.size <= DIRECT_UPLOAD_THRESHOLD_BYTES) {
      const fd = new FormData();
      fd.append("file", file);
      if (commentId) fd.append("commentId", commentId);
      await postAttachment(fd);
      return;
    }

    // The helper every upload surface uses: it pins the path to this task's
    // folder under an unguessable uuid, and takes the access level from
    // storage.ts (SAAS_BLOB_ACCESS) — the store refuses any other value, and
    // the attachments route refuses a blob at any other level.
    const blob = await uploadDirect(
      file,
      { kind: "task-attachment", taskId, ...(commentId ? { commentId } : {}) },
      (percentage) => setUploadProgress({ name: file.name, percentage })
    );

    // Url and display name only. Size and type are read off the stored blob
    // by the server — sending them would just be a number it has to ignore.
    await postAttachment(
      JSON.stringify({
        // The store's url, never the pathname we asked for: addRandomSuffix
        // means the two differ, and only this one addresses the bytes.
        blobUrl: blob.url,
        name: file.name,
        commentId,
      })
    );
  }

  async function handleAttachmentUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    let okCount = 0;
    for (const file of Array.from(files)) {
      try {
        await uploadAttachment(file);
        okCount++;
      } catch (err) {
        // Say what actually went wrong. There is no retry through the
        // multipart route here on purpose: a file that took this path is too
        // big for it, so a silent fallback would only fail again, slower.
        toast.error(
          err instanceof Error
            ? `${file.name}: ${err.message}`
            : `${file.name}: upload failed`
        );
      } finally {
        setUploadProgress(null);
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
      if (!res.ok) {
        // Surface the server's reason. Throwing `HTTP 403` showed the user a
        // toast that read literally "HTTP 403".
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Couldn't remove the attachment`);
      }
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

  // Subtasks are child tasks, so rename/delete go through the standard
  // task endpoints — same as the completion toggle in the row below.
  async function handleRenameSubtask(subtaskId: string, currentName: string) {
    const name = editingSubtaskName.trim();
    setEditingSubtaskId(null);
    if (!name || name === currentName) return;
    try {
      const res = await fetch(`/api/tasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        fetchTaskDetail();
        onUpdate?.();
      } else {
        toast.error(await responseError(res, "Failed to rename subtask"));
      }
    } catch {
      toast.error("Failed to rename subtask");
    }
  }

  async function handleDeleteSubtask(subtaskId: string) {
    if (!confirm("Delete this subtask?")) return;
    try {
      const res = await fetch(`/api/tasks/${subtaskId}`, { method: "DELETE" });
      if (res.ok) {
        fetchTaskDetail();
        onUpdate?.();
        toast.success("Subtask deleted");
      } else {
        toast.error(await responseError(res, "Failed to delete subtask"));
      }
    } catch {
      toast.error("Failed to delete subtask");
    }
  }

  async function handleToggleSubtask(subtask: TaskSubtask) {
    try {
      const res = await fetch(`/api/tasks/${subtask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !subtask.completed }),
      });
      if (!res.ok) {
        toast.error(await responseError(res, "Failed to update subtask"));
        return;
      }
      fetchTaskDetail();
      onUpdate?.();
    } catch {
      toast.error("Failed to update subtask");
    }
  }

  async function handleAddSubtask() {
    const subtaskName = newSubtaskName.trim();
    if (!subtaskName || addingSubtaskRef.current) return;
    addingSubtaskRef.current = true;
    setAddingSubtask(true);
    try {
      // POST /api/tasks places a subtask in its parent's project and section
      // and leaves it unassigned.
      const res = await fetch(`/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: subtaskName, parentTaskId: taskId }),
      });
      if (!res.ok) {
        toast.error(await responseError(res, "Failed to add subtask"));
        return;
      }
      setNewSubtaskName("");
      fetchTaskDetail();
      onUpdate?.();
      toast.success("Subtask added");
    } catch {
      toast.error("Failed to add subtask");
    } finally {
      addingSubtaskRef.current = false;
      setAddingSubtask(false);
      // The input was disabled for the request, which drops focus; put it
      // back so the next subtask can be typed straight away.
      setTimeout(() => subtaskInputRef.current?.focus(), 0);
    }
  }

  /**
   * Swap to another task (a subtask, or back to the parent). Inside the
   * project page that task's own panel opens in place through ?task=, and
   * Back returns here; anywhere else it opens on the full task page.
   */
  function openRelatedTask(id: string) {
    const pid = taskDetail?.project?.id;
    if (pid && window.location.pathname.endsWith(`/projects/${pid}`)) {
      const url = new URL(window.location.href);
      url.searchParams.set("task", id);
      router.push(`${url.pathname}${url.search}`);
    } else {
      router.push(`/tasks/${id}`);
    }
  }

  async function handleConvertTo(
    newType: "TASK" | "MILESTONE" | "APPROVAL"
  ) {
    if (!(await handleUpdate("taskType", newType))) return;
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
      if (!res.ok) {
        throw new Error(await responseError(res, "Failed to duplicate task"));
      }
      toast.success("Task duplicated");
      onUpdate?.();
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to duplicate task"
      );
    }
  }

  async function handleCopyTaskLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/tasks/${taskId}`
      );
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  /**
   * Print the task alone. The dashboard has no print stylesheet, so
   * window.print() put the sidebar and the page behind the drawer on paper
   * and cut the panel at its scroll height. Instead, a copy of the panel —
   * unclipped, without the composer and the header buttons — goes into a
   * hidden frame that carries the app's own stylesheets, and that frame is
   * printed.
   */
  function handlePrintTask() {
    const panel = panelRef.current;
    if (!panel) return;
    const clone = panel.cloneNode(true) as HTMLElement;
    // A textarea's typed value is not part of its markup; print what is on
    // screen (the title and the description are textareas).
    const liveFields = panel.querySelectorAll("textarea");
    clone.querySelectorAll("textarea").forEach((ta, i) => {
      const div = document.createElement("div");
      div.className = ta.className;
      div.style.whiteSpace = "pre-wrap";
      div.textContent = liveFields[i]?.value ?? "";
      ta.replaceWith(div);
    });
    clone.querySelectorAll("[data-print-hide]").forEach((el) => el.remove());

    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) {
      frame.remove();
      toast.error("Couldn't prepare the task for printing");
      return;
    }
    const styles = Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style')
    )
      .map((el) => el.outerHTML)
      .join("");
    doc.open();
    doc.write(
      `<!doctype html><html><head><base href="${document.baseURI}"><title>${escapeHtml(
        taskDetail?.name || "Task"
      )}</title>${styles}<style>
        html,body{background:#fff!important;height:auto!important;overflow:visible!important}
        [data-print-root]{position:static!important;inset:auto!important;width:100%!important;height:auto!important;max-height:none!important;overflow:visible!important;transform:none!important;box-shadow:none!important;border:0!important;border-radius:0!important;animation:none!important}
        [data-print-root] [data-print-scroll]{overflow:visible!important;flex:none!important;height:auto!important}
      </style></head><body></body></html>`
    );
    doc.close();
    clone.setAttribute("data-print-root", "");
    doc.body.appendChild(doc.importNode(clone, true));

    const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
    let printed = false;
    const print = () => {
      if (printed) return;
      printed = true;
      win.focus();
      win.print();
      // Removing the frame while the dialog is up cancels it in some
      // browsers; the dialog blocks, so this runs after it closes.
      setTimeout(() => frame.remove(), 1000);
    };
    Promise.all(
      links.map(
        (l) =>
          new Promise<void>((resolve) => {
            l.addEventListener("load", () => resolve(), { once: true });
            l.addEventListener("error", () => resolve(), { once: true });
          })
      )
    ).then(print);
    // Stylesheets that were already cached may never fire load.
    setTimeout(print, 1500);
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
      if (!res.ok) {
        throw new Error(await responseError(res, "Failed to delete task"));
      }
      toast.success("Task deleted");
      onUpdate?.();
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
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
      if (!res.ok) {
        throw new Error(await responseError(res, "Couldn't remove dependency"));
      }
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
      if (!res.ok) throw new Error(await responseError(res, "Couldn't remove"));
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
        throw new Error(await responseError(res, "Couldn't add to project"));
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
      if (!res.ok) {
        throw new Error(
          await responseError(res, "Couldn't remove from project")
        );
      }
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
    const files = pendingCommentFiles;
    const hasFiles = files.length > 0;
    if (!hasText && !hasFiles) return;
    setPostingComment(true);
    try {
      // Wrap confirmed @-mentions in the data-user-id spans the server
      // parses for MENTIONED notifications; plain comments go unchanged.
      // A files-only comment is a single space: the route requires content,
      // and the thread hides a blank body.
      const content = hasText
        ? buildCommentContent(newComment, stagedMentions)
        : " ";
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, shareWithSubmitter }),
      });
      if (!res.ok) {
        throw new Error(await responseError(res, "Couldn't post comment"));
      }
      const created = await res.json();

      const failed: File[] = [];
      for (const file of files) {
        try {
          // Same helper as the Attachments panel. Left on the multipart path,
          // this control would keep dying on the platform body cap for a file
          // the panel right above it accepts — with the comment already
          // published and referencing a file that never arrived.
          await uploadAttachment(file, created.id);
        } catch (err) {
          failed.push(file);
          toast.error(
            err instanceof Error
              ? `${file.name}: ${err.message}`
              : `${file.name}: upload failed`
          );
        } finally {
          setUploadProgress(null);
        }
      }
      const uploaded = files.length - failed.length;

      // A files-only comment whose every file failed is an empty row in the
      // thread; take it back (best effort) instead of leaving it there.
      if (!hasText && uploaded === 0) {
        await fetch(`/api/tasks/${taskId}/comments/${created.id}`, {
          method: "DELETE",
        }).catch(() => {});
      } else {
        setNewComment("");
        setStagedMentions([]);
        // One opt-in publishes ONE comment.
        setShareWithSubmitter(false);
      }
      // Files that did not make it stay in the composer, so posting again
      // retries them instead of making the user pick them a second time.
      setPendingCommentFiles(failed);
      if (commentFileInputRef.current) commentFileInputRef.current.value = "";
      await fetchTaskDetail();
      // The comment count changed either way — let the parent refresh its
      // counters (not only when files were attached).
      onUpdate?.();
      if (uploaded > 0) {
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

  async function handleSaveCommentEdit(comment: TaskComment) {
    if (savingCommentEditRef.current) return;
    const text = editingCommentText.trim();
    // Nothing to send: an emptied box or an untouched one. Skipping the
    // untouched save also keeps the comment's mention chips, which a
    // text-only edit drops.
    if (!text || text === commentToPlainText(comment.content).trim()) {
      setEditingCommentId(null);
      return;
    }
    savingCommentEditRef.current = true;
    setSavingCommentEdit(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        throw new Error(await responseError(res, "Failed to edit comment"));
      }
      // Close only once the server has the text: closing first threw the
      // rewrite away whenever the save failed.
      setEditingCommentId(null);
      await fetchTaskDetail();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to edit comment"
      );
    } finally {
      savingCommentEditRef.current = false;
      setSavingCommentEdit(false);
    }
  }

  async function handleDeleteComment(comment: TaskComment) {
    const fileCount = comment.attachments?.length ?? 0;
    if (
      !confirm(
        fileCount > 0
          ? `Delete this comment? Its ${fileCount} attached file${
              fileCount === 1 ? "" : "s"
            } will stay in the task's attachments.`
          : "Delete this comment? This cannot be undone."
      )
    )
      return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${comment.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(await responseError(res, "Failed to delete comment"));
      }
      await fetchTaskDetail();
      onUpdate?.();
      if (fileCount > 0) onAttachmentsChange?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete comment"
      );
    }
  }

  function handleCommentFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    // The same ceiling and type rules the upload itself enforces, checked
    // before anything is posted — a file refused only after the comment
    // exists leaves an empty comment behind and has already notified people.
    const maxBytes = uploadMaxBytesFor({ kind: "task-attachment", taskId });
    const ok: File[] = [];
    for (const f of Array.from(files)) {
      if (f.size > maxBytes) {
        toast.error(
          `${f.name}: exceeds the ${Math.floor(maxBytes / (1024 * 1024))} MB limit`
        );
        continue;
      }
      try {
        assertFileAllowed(f.name, f.type);
      } catch (err) {
        toast.error(
          `${f.name}: ${err instanceof Error ? err.message : "file type not allowed"}`
        );
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

  const dueDateInfo = formatDueDateLabel(taskDetail?.dueDate || null, today);

  // How many days the task is past due, 0 when it is not. Measured against
  // `today` — the browser's day — so the strip cannot appear on a task that
  // is due today just because the server's UTC clock has already rolled over.
  // No day yet (`today === null`) means no strip: a late strip is recoverable,
  // a wrong one is not, because React keeps what it hydrated.
  const overdueDays =
    today && taskDetail?.dueDate && !taskDetail.completed
      ? -daysFromToday(taskDetail.dueDate, today)
      : 0;

  return (
    <>
      {presentation === "centered" && (
        <div
          className="fixed inset-0 z-40 bg-black/50 animate-in fade-in"
          onClick={onClose}
        />
      )}
      <div
        ref={panelRef}
        className={cn(
          presentation === "page"
            ? "h-full min-h-full w-full bg-white flex flex-col text-[#1e1f21]"
            : presentation === "centered"
            ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-[560px] max-h-[88vh] border border-[#e8e8e8] bg-white rounded-2xl flex flex-col overflow-hidden shadow-2xl text-[#1e1f21] animate-in fade-in zoom-in-95 duration-200"
            : "fixed inset-0 md:inset-auto md:right-0 md:top-0 md:bottom-0 w-full md:w-[500px] z-50 border-l border-[#e8e8e8] bg-white rounded-t-2xl md:rounded-none flex flex-col shadow-[-12px_0_32px_-12px_rgba(0,0,0,0.06)] md:shadow-2xl transition-transform duration-200 animate-in slide-in-from-bottom md:slide-in-from-right text-[#1e1f21]"
        )}
      >
      {/* ── Mobile drag handle ──────────────────────────────── */}
      {presentation !== "page" && (
        <div className="md:hidden flex justify-center py-2" data-print-hide>
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
      )}

      {/* ── Top action row ─────────────────────────────────────
          Left: Mark-complete pill (Asana style — turns green when
          complete). Right: heart / paperclip / link / expand /
          more / close. Title intentionally NOT in this row. */}
      <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0">
        <button
          data-print-hide
          onClick={handleToggleComplete}
          disabled={!canWrite}
          title={
            !capsKnown || canWrite
              ? undefined
              : "You have view-only access to this task"
          }
          className={cn(
            "flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[13px] font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
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
        <div className="flex items-center gap-0.5 text-[#6f7782]" data-print-hide>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleAttachmentUpload}
            accept={UPLOAD_ACCEPT}
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
            disabled={uploading || !canWrite}
            title={canWrite ? "Attach file" : "You can't add files to this task"}
          >
            {uploading ? (
              <Loader2 className="h-[15px] w-[15px] animate-spin" />
            ) : (
              <Paperclip className="h-[15px] w-[15px]" />
            )}
          </ActionIconButton>
          <ActionIconButton
            onClick={handleCopyTaskLink}
            title="Copy link"
          >
            <Link2 className="h-[15px] w-[15px]" />
          </ActionIconButton>
          {presentation !== "page" && (
            <ActionIconButton
              onClick={() => window.open(`/tasks/${taskId}`, "_blank")}
              title="Open full task"
            >
              <Maximize2 className="h-[15px] w-[15px]" />
            </ActionIconButton>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ActionIconButton title="More options">
                <MoreHorizontal className="h-[15px] w-[15px]" />
              </ActionIconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[240px]">
              <DropdownMenuItem
                onClick={handleAddSubtaskFromMenu}
                disabled={!canWrite}
              >
                <ListPlus className="mr-2 h-4 w-4 text-[#6f7782]" />
                <span className="flex-1">Add subtask</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => fileInputRef.current?.click()}
                disabled={!canWrite}
              >
                <Paperclip className="mr-2 h-4 w-4 text-[#6f7782]" />
                <span className="flex-1">Attach files</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleCopyTaskLink}
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
                      !canWrite ||
                      !taskDetail?.taskType ||
                      taskDetail.taskType === "TASK"
                    }
                  >
                    <CheckSquare className="mr-2 h-4 w-4 text-[#6f7782]" />
                    Task
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleConvertTo("MILESTONE")}
                    disabled={!canWrite || taskDetail?.taskType === "MILESTONE"}
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
                    disabled={!canWrite || taskDetail?.taskType === "APPROVAL"}
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
              <DropdownMenuItem
                onClick={handleDuplicateTask}
                disabled={!canWrite}
              >
                <Copy className="mr-2 h-4 w-4 text-[#6f7782]" />
                <span>Duplicate task</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrintTask} disabled={!capsKnown}>
                <Printer className="mr-2 h-4 w-4 text-[#6f7782]" />
                <span>Print</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDeleteTask}
                disabled={!canWrite}
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

      {currentLoadError ? (
        // Nothing of this task may be shown or edited: a deleted or hidden
        // task used to render as an empty, editable form.
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="text-[14px] font-medium text-[#1e1f21]">
            {currentLoadError.status === 404 || currentLoadError.status === 403
              ? "This task was deleted or you no longer have access to it."
              : "Couldn't load this task."}
          </p>
          <div className="flex items-center gap-2">
            {currentLoadError.status !== 404 &&
              currentLoadError.status !== 403 && (
                <button
                  type="button"
                  onClick={() => fetchTaskDetail()}
                  className="h-8 px-3 rounded-md border border-[#e8e8e8] text-[13px] text-[#1e1f21] hover:bg-[#f3f4f6]"
                >
                  Try again
                </button>
              )}
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 rounded-md bg-[#1e1f21] text-white text-[13px] hover:bg-black"
            >
              Close
            </button>
          </div>
        </div>
      ) : loading || !capsKnown ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-black" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto" data-print-scroll>
          {/* Overdue strip — compares by UTC calendar day (date-only.ts)
              so a task due today is never falsely flagged overdue for
              viewers west of UTC. */}
          {overdueDays > 0 && (
            <div className="px-4 py-2 bg-black text-white text-[12px] font-medium flex items-center gap-2 border-b border-black">
              <Flag className="h-3.5 w-3.5 text-[#c9a84c] flex-shrink-0" />
              {`Overdue · ${overdueDays} day${overdueDays === 1 ? "" : "s"} past due`}
            </div>
          )}

          {/* Visibility bar — reads Task.isPrivate and lets the user
              switch between project-visible and private-to-collaborators. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={!canWrite}>
              <button className="w-full px-5 h-9 bg-[#f6f7f8] text-[12px] text-[#6f7782] flex items-center gap-1.5 hover:bg-[#eef0f2] disabled:hover:bg-[#f6f7f8] disabled:cursor-default transition-colors">
                {taskDetail?.isPrivate ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  <Globe className="h-3 w-3" />
                )}
                {taskDetail?.isPrivate
                  ? "This task is private — only its collaborators can see it"
                  : taskDetail?.project
                    ? "This task is visible to everyone with access to the project"
                    : "This task is visible only to its creator, assignee and collaborators"}
                {canWrite && <ChevronDown className="h-3 w-3 ml-auto" />}
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

          {/* Parent task — a subtask's way back up. */}
          {taskDetail?.parentTaskId && (
            <div className="px-5 pt-3 -mb-2" data-print-hide>
              <button
                type="button"
                onClick={() => openRelatedTask(taskDetail.parentTaskId!)}
                className="inline-flex items-center gap-1 text-[12px] text-[#6f7782] hover:text-[#1e1f21] hover:underline"
              >
                <CornerLeftUp className="h-3 w-3" />
                Open parent task
              </button>
            </div>
          )}

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
              readOnly={!canWrite}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (!canWrite) return;
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
                taskId={taskId}
                value={taskDetail?.assignee || null}
                onChange={(user) =>
                  handleUpdate("assigneeId", user?.id || null)
                }
                trigger={
                  taskDetail?.assignee ? (
                    <button
                      disabled={!canWrite}
                      className="flex items-center gap-1.5 -ml-1.5 px-1.5 py-0.5 rounded hover:bg-[#f3f4f6] cursor-pointer disabled:cursor-default disabled:hover:bg-transparent"
                    >
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
                    <button
                      disabled={!canWrite}
                      className="flex items-center gap-1.5 -ml-1.5 px-1.5 py-0.5 rounded text-[13px] text-[#6f7782] hover:bg-[#f3f4f6] hover:text-[#1e1f21] cursor-pointer disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-[#6f7782]"
                    >
                      <UserPlus2 className="h-3.5 w-3.5" />
                      No assignee
                    </button>
                  )
                }
              />
            </PropertyRow>

            {/* Personal My-Tasks section — only when the parent (the
                /my-tasks page) supplies its personal sections. Moves the
                task between the user's My Tasks buckets via onMoveToSection. */}
            {personalSections.length > 0 && onMoveToSection && (
              <PropertyRow label="Section">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 -ml-1.5 px-1.5 py-0.5 rounded text-[13px] text-[#1e1f21] hover:bg-[#f3f4f6] cursor-pointer"
                    >
                      <Layers className="h-3.5 w-3.5 text-[#6f7782]" />
                      {personalSections.find((s) => s.id === currentSectionId)
                        ?.name ?? "Recently assigned"}
                      <ChevronDown className="h-3 w-3 text-[#9aa0a6]" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[200px]">
                    {personalSections.map((s) => (
                      <DropdownMenuItem
                        key={s.id}
                        onClick={() => {
                          if (s.id !== currentSectionId) onMoveToSection(s.id);
                        }}
                        className="text-[13px]"
                      >
                        {s.id === currentSectionId && (
                          <Check className="h-3.5 w-3.5 text-[#6f7782]" />
                        )}
                        <span
                          className={
                            s.id === currentSectionId ? "font-medium" : ""
                          }
                        >
                          {s.name}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </PropertyRow>
            )}

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
                  if (!canWrite) return;
                  try {
                    const res = await fetch(`/api/tasks/${taskId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        startDate: start ? toDateOnlyISO(start) : null,
                        dueDate: due ? toDateOnlyISO(due) : null,
                      }),
                    });
                    if (!res.ok) {
                      throw new Error(
                        await responseError(res, "Couldn't save the date range")
                      );
                    }
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
                  } catch (err) {
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : "Couldn't save the date range"
                    );
                  }
                }}
                trigger={
                  <button
                    type="button"
                    disabled={!canWrite}
                    className={cn(
                      "flex items-center gap-1.5 -ml-1.5 px-1.5 py-0.5 rounded text-[13px] hover:bg-[#f3f4f6] cursor-pointer disabled:cursor-default disabled:hover:bg-transparent",
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
                        readOnly={!canWrite}
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
                          readOnly={!canWrite}
                          onChanged={() => {
                            fetchTaskDetail();
                            onUpdate?.();
                          }}
                          onRemove={() => handleDependencyRemove(dep.id)}
                        />
                      ))}
                    {canWrite ? (
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
                    ) : (
                      allDeps.length === 0 && (
                        <span className="text-[13px] text-[#9aa0a6]">None</span>
                      )
                    )}
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
                        {canWrite && (
                          <button
                            onClick={() =>
                              handleDependentRemove(dep.id, dep.dependentTask.id)
                            }
                            className="ml-auto opacity-0 group-hover:opacity-100 text-[#9aa0a6] hover:text-[#1e1f21] transition-opacity"
                            aria-label={`Stop blocking ${dep.dependentTask.name}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {canWrite ? (
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
                    ) : (
                      deps.length === 0 && (
                        <span className="text-[13px] text-[#9aa0a6]">None</span>
                      )
                    )}
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
              {/* A disabled fieldset disables every control the selectors
                  render, which have no read-only mode of their own. */}
              <fieldset disabled={!canWrite} className="flex-1 min-w-0">
                {/* Home project (Task.projectId). Read-only viewers get a
                    plain link: the selector keeps "Open project" in the same
                    menu as "Remove from project", and the fieldset disables
                    that menu's trigger along with the write actions. */}
                {capsKnown && !canWrite && taskDetail?.project ? (
                  <Link
                    href={`/projects/${taskDetail.project.id}`}
                    className="flex items-center gap-2 py-1.5 rounded hover:bg-gray-50"
                    title="Open project"
                  >
                    <span
                      className="w-2 h-2 rounded-sm flex-shrink-0"
                      style={{
                        backgroundColor: taskDetail.project.color || "#22C55E",
                      }}
                    />
                    <span className="text-sm font-medium hover:underline">
                      {taskDetail.project.name}
                    </span>
                  </Link>
                ) : (
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
                )}
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
                            hidden={!canWrite}
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
                {taskDetail?.project && canWrite && (
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
              </fieldset>
            </PropertyRow>

            {/* Section — the task's column/group inside its home project.
                Was fetched + PATCH-able but had no UI. */}
            {taskDetail?.project && (
              <PropertyRow label="Section">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={!canWrite}>
                    <button
                      type="button"
                      className="-ml-1.5 px-1.5 py-0.5 rounded hover:bg-[#f3f4f6] cursor-pointer disabled:cursor-default disabled:hover:bg-transparent text-left"
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
                <DropdownMenuTrigger asChild disabled={!canWrite}>
                  <button
                    type="button"
                    className="-ml-1.5 px-1.5 py-0.5 rounded hover:bg-[#f3f4f6] cursor-pointer disabled:cursor-default disabled:hover:bg-transparent"
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
                <DropdownMenuTrigger asChild disabled={!canWrite}>
                  <button
                    type="button"
                    className="-ml-1.5 px-1.5 py-0.5 rounded hover:bg-[#f3f4f6] cursor-pointer disabled:cursor-default disabled:hover:bg-transparent"
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
              <fieldset disabled={!canWrite} className="min-w-0 flex-1">
              <EditableTagsCell
                taskId={taskId}
                value={taskDetail?.taskTags ?? []}
                onChange={() => {
                  fetchTaskDetail();
                  onUpdate?.();
                }}
              />
              </fieldset>
            </PropertyRow>

            {/* Project's custom fields */}
            <fieldset disabled={!canWrite} className="contents">
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
            </fieldset>
          </div>

          {/* Description */}
          <div className="px-5 pt-3 pb-4">
            <h4 className="text-[12px] font-medium text-[#6f7782] mb-1.5">
              Description
            </h4>
            <textarea
              value={description}
              readOnly={!canWrite}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                // A task with no description stores null; an untouched empty
                // box is not an edit.
                if (canWrite && description !== (taskDetail?.description ?? "")) {
                  handleUpdate("description", description);
                }
              }}
              placeholder={canWrite ? "What is this task about?" : "No description"}
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
                disabled={uploading || !canWrite}
                className="flex items-center justify-center h-4 w-4 rounded text-[#6f7782] hover:bg-[#f3f4f6] hover:text-[#1e1f21] disabled:opacity-50"
                title={
                  canWrite ? "Add attachment" : "You can't add files to this task"
                }
              >
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            {uploadProgress && (
              <div className="mb-2" aria-live="polite">
                <div className="flex items-center justify-between gap-2 text-[11px] text-[#6f7782]">
                  <span className="truncate">{uploadProgress.name}</span>
                  <span className="tabular-nums">
                    {Math.round(uploadProgress.percentage)}%
                  </span>
                </div>
                <div className="mt-1 h-1 w-full rounded-full bg-[#eceff1]">
                  <div
                    className="h-1 rounded-full bg-[#4573d2] transition-[width]"
                    style={{ width: `${uploadProgress.percentage}%` }}
                  />
                </div>
              </div>
            )}
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
                        {(canWrite ||
                          (!!a.uploaderId && a.uploaderId === sessionUser?.id)) && (
                          <button
                            onClick={() => handleAttachmentDelete(a.id)}
                            className="p-1 text-[#9aa0a6] hover:text-[#1e1f21]"
                            aria-label="Remove attachment"
                            title="Remove"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
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
              {canWrite && (
                <button
                  onClick={() => {
                    setIsAddingSubtask(true);
                    setTimeout(() => subtaskInputRef.current?.focus(), 0);
                  }}
                  className="flex items-center justify-center h-4 w-4 rounded text-[#6f7782] hover:bg-[#f3f4f6] hover:text-[#1e1f21]"
                  title="Add subtask"
                  data-print-hide
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-0">
              {taskDetail?.subtasks?.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-2 group py-1.5 border-b border-[#eeeeee] last:border-b-0"
                >
                  <button
                    onClick={() => handleToggleSubtask(subtask)}
                    disabled={!canWrite}
                    className="flex-shrink-0 disabled:cursor-default"
                    aria-label={
                      subtask.completed
                        ? `Mark ${subtask.name} incomplete`
                        : `Mark ${subtask.name} complete`
                    }
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
                  {editingSubtaskId === subtask.id ? (
                    <input
                      type="text"
                      value={editingSubtaskName}
                      onChange={(e) => setEditingSubtaskName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        } else if (e.key === "Escape") {
                          cancelSubtaskEditRef.current = true;
                          e.currentTarget.blur();
                        }
                      }}
                      onBlur={() => {
                        if (cancelSubtaskEditRef.current) {
                          cancelSubtaskEditRef.current = false;
                          setEditingSubtaskId(null);
                          return;
                        }
                        handleRenameSubtask(subtask.id, subtask.name);
                      }}
                      className="flex-1 text-[13px] bg-transparent outline-none text-[#1e1f21]"
                      autoFocus
                    />
                  ) : (
                    <span
                      onClick={() => {
                        if (!canWrite) return;
                        setEditingSubtaskId(subtask.id);
                        setEditingSubtaskName(subtask.name);
                      }}
                      className={cn(
                        "text-[13px] flex-1",
                        canWrite && "cursor-text",
                        subtask.completed
                          ? "line-through text-[#9aa0a6]"
                          : "text-[#1e1f21]"
                      )}
                    >
                      {subtask.name}
                    </span>
                  )}
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
                  {/* Open the subtask itself — assignee, dates, description and
                      its own thread live in its panel, not on this row. */}
                  <button
                    type="button"
                    onClick={() => openRelatedTask(subtask.id)}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 text-[#9aa0a6] hover:text-[#1e1f21] transition-opacity"
                    title="Open subtask"
                    aria-label={`Open ${subtask.name}`}
                    data-print-hide
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSubtask(subtask.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 text-[#9aa0a6] hover:text-[#e2564f] transition-opacity"
                      title="Delete subtask"
                      data-print-hide
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {isAddingSubtask && canWrite ? (
                <div className="flex items-center gap-2 py-1.5 border-b border-[#eeeeee]">
                  {addingSubtask ? (
                    <Loader2 className="w-[15px] h-[15px] animate-spin text-[#9aa0a6] flex-shrink-0" />
                  ) : (
                    <div className="w-[15px] h-[15px] rounded-full border border-[#c4c7cf] flex-shrink-0" />
                  )}
                  <input
                    ref={subtaskInputRef}
                    type="text"
                    value={newSubtaskName}
                    disabled={addingSubtask}
                    onChange={(e) => setNewSubtaskName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSubtask();
                      }
                      if (e.key === "Escape") {
                        setIsAddingSubtask(false);
                        setNewSubtaskName("");
                      }
                    }}
                    onBlur={() => {
                      if (!newSubtaskName.trim() && !addingSubtaskRef.current) {
                        setIsAddingSubtask(false);
                        setNewSubtaskName("");
                      }
                    }}
                    placeholder="Type a subtask name"
                    className="flex-1 text-[13px] bg-transparent outline-none placeholder:text-[#9aa0a6] disabled:opacity-60"
                    autoFocus
                  />
                </div>
              ) : canWrite ? (
                <button
                  className="flex items-center gap-2 py-1.5 w-full text-left text-[13px] text-[#6f7782] hover:text-[#1e1f21]"
                  data-print-hide
                  onClick={() => {
                    setIsAddingSubtask(true);
                    setTimeout(() => subtaskInputRef.current?.focus(), 0);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add subtask
                </button>
              ) : null}
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
                          {!isGuest && comment.visibility === "EXTERNAL" && (
                            <span
                              className="text-[10px] uppercase tracking-wider text-[#6f7782] bg-[#f3f4f6] border border-[#e0e2e6] px-1.5 py-[1px] rounded font-semibold"
                              title="Published on the submitter's tracking page"
                            >
                              shared with submitter
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
                                  onClick={() => handleDeleteComment(comment)}
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
                            readOnly={savingCommentEdit}
                            onChange={(e) =>
                              setEditingCommentText(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveCommentEdit(comment);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                if (!savingCommentEdit) setEditingCommentId(null);
                              }
                            }}
                            onBlur={() => handleSaveCommentEdit(comment)}
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
                        {activityText(activity.type, activity.data)}
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
      {!currentLoadError && (
      <div className="px-5 py-3 border-t border-[#e8e8e8] bg-white flex-shrink-0" data-print-hide>
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
                  !capsKnown
                    ? "Loading…"
                    : !canComment
                    ? "You have view-only access to this task"
                    : pendingCommentFiles.length > 0
                    ? "Caption (optional)…"
                    : "Add a comment… @ to mention"
                }
                disabled={postingComment || !canComment}
                className="w-full text-[13px] bg-transparent outline-none placeholder:text-[#9aa0a6] text-[#1e1f21] leading-5 max-h-24 overflow-y-auto"
              />
              <input
                ref={commentFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleCommentFilesPicked}
                accept={UPLOAD_ACCEPT}
              />
              <button
                type="button"
                onClick={() => commentFileInputRef.current?.click()}
                disabled={postingComment || !canComment}
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
                  !canComment ||
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
            {taskDetail?.hasExternalTracking && (
              <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#6f7782] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={shareWithSubmitter}
                  onChange={(e) => setShareWithSubmitter(e.target.checked)}
                  className="h-3 w-3 accent-[#1e1f21]"
                />
                Also send to the submitter (shown on their tracking link)
              </label>
            )}
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

      )}

      {/* Collaborators footer — only once THIS task is loaded: its buttons
          act on taskId, and nothing else of the task is on screen before. */}
      {capsKnown && (
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
                {/* Removing someone else needs write access; anyone may
                    remove themselves. */}
                {(canWrite || collab.id === sessionUser?.id) && (
                  <button
                    type="button"
                    aria-label={`Remove ${collab.name || "collaborator"}`}
                    data-print-hide
                    onClick={async () => {
                      try {
                        const res = await fetch(
                          `/api/tasks/${taskId}/collaborators?userId=${collab.id}`,
                          { method: "DELETE" }
                        );
                        if (res.ok) {
                          fetchTaskDetail();
                        } else {
                          toast.error(
                            await responseError(
                              res,
                              "Failed to remove collaborator"
                            )
                          );
                        }
                      } catch {
                        toast.error("Failed to remove collaborator");
                      }
                    }}
                    className="absolute -top-1 -right-1 hidden group-hover:flex h-3 w-3 items-center justify-center rounded-full bg-[#1e1f21] text-white"
                  >
                    <X className="h-2 w-2" />
                  </button>
                )}
              </div>
            ))}
            {(!taskDetail?.collaborators ||
              taskDetail.collaborators.length === 0) && (
              <span className="text-[12px] text-[#9aa0a6]">None yet</span>
            )}
            {canWrite && (
            <AssigneeSelector
              taskId={taskId}
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
                    toast.error(
                      await responseError(res, "Failed to add collaborator")
                    );
                  }
                } catch {
                  toast.error("Failed to add collaborator");
                }
              }}
              trigger={
                <button
                  className="h-5 w-5 rounded-full border border-dashed border-[#c4c7cf] flex items-center justify-center hover:border-[#1e1f21] hover:bg-[#f3f4f6] cursor-pointer"
                  data-print-hide
                  aria-label="Add collaborator"
                >
                  <Plus className="h-2.5 w-2.5 text-[#9aa0a6]" />
                </button>
              }
            />
            )}
          </div>
        </div>
        {/* Only a follower can leave: the creator and the assignee are not
            collaborator rows, and the server answers them "Not a
            collaborator". */}
        {!!sessionUser?.id &&
          taskDetail?.collaborators?.some((c) => c.id === sessionUser.id) && (
        <button
          className="text-[12px] text-[#6f7782] hover:text-[#1e1f21]"
          data-print-hide
          onClick={async () => {
            try {
              const res = await fetch(`/api/tasks/${taskId}/collaborators`, {
                method: "DELETE",
              });
              if (res.ok) {
                toast.success("You left this task");
                fetchTaskDetail();
              } else {
                toast.error(await responseError(res, "Failed to leave task"));
              }
            } catch {
              toast.error("Failed to leave task");
            }
          }}
        >
          Leave task
        </button>
        )}
      </div>
      )}

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
    </>
  );
}

// ─── Helpers (same look as /my-tasks panel) ──────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
  readOnly = false,
  onChanged,
  onRemove,
}: {
  dependency: TaskDependency;
  taskId: string;
  /** No write access: show the link, offer neither retype nor remove. */
  readOnly?: boolean;
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
      if (!res.ok) {
        throw new Error(await responseError(res, "Couldn't update dependency"));
      }
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
        <DropdownMenuTrigger asChild disabled={readOnly}>
          <button className="inline-flex items-center gap-1 text-[#6f7782] hover:text-[#1e1f21] cursor-pointer disabled:cursor-default disabled:hover:text-[#6f7782]">
            <ArrowLeftRight className="h-3 w-3 -rotate-90" />
            <span>Blocked by</span>
            <span className="text-[#9aa0a6]">·</span>
            <span className="font-medium tabular-nums">{meta.short}</span>
            {!readOnly && <ChevronDown className="h-3 w-3" />}
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

      {!readOnly && (
        <button
          onClick={onRemove}
          className="ml-auto opacity-0 group-hover:opacity-100 text-[#9aa0a6] hover:text-[#1e1f21] transition-opacity"
          aria-label={`Remove dependency on ${bt.name}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
