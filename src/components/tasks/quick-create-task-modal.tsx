"use client";

/**
 * QuickCreateTaskModal — Gmail-compose-style floating task composer.
 *
 * Pinned to the bottom-right of the viewport; can be minimized (Gmail
 * pattern: collapses to a 320px-wide stub still anchored bottom-right).
 * Opens from any "Assign task" / "Create task" CTA across the app.
 *
 * The layout matches Asana's quick-create:
 *   ┌──────────────────────────────────────┐
 *   │  New task                       −  × │  ← light header
 *   ├──────────────────────────────────────┤
 *   │  Task name…                          │  ← big borderless input
 *   │                                      │
 *   │  To [ Assignee ] in [ Project ]      │  ← inline pill pickers
 *   │                                      │
 *   │  Description                         │  ← borderless textarea
 *   │  …                                   │
 *   ├──────────────────────────────────────┤
 *   │ + ▲ ☺ @ 📎 ✨ Tomorrow   JT + Create │  ← toolbar
 *   └──────────────────────────────────────┘
 *
 * Self-fetches the workspace project + user lists so it works as a
 * standalone modal — callers don't need to pass anything except
 * open / onOpenChange.
 */

import { useState, useEffect } from "react";
import {
  X,
  Minus,
  Plus,
  Smile,
  AtSign,
  Paperclip,
  Sparkles,
  Calendar,
  Loader2,
  ChevronDown,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DueDatePicker } from "@/components/tasks/due-date-picker";
import { formatRangeLabel } from "@/lib/task-helpers";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  color: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface QuickCreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional pre-fetched project list. When omitted the modal fetches
   *  the workspace projects itself, so this prop is rarely needed. */
  projects?: Project[];
}

/** Format a single due Date as the Asana-style relative label. */
function formatSingleDueLabel(date: Date | null): string {
  if (!date) return "Set due date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Asana-style header label for the date pill:
 *   - Range present (start + due): "May 18 – 30"
 *   - Only due: "Tomorrow" / "Today" / "May 18"
 *   - Only start: "From May 18"
 *   - Neither: "Set due date"
 */
function formatComposerDateLabel(
  start: Date | null,
  due: Date | null
): string {
  if (!start && !due) return "Set due date";
  if (!start && due) return formatSingleDueLabel(due);
  // formatRangeLabel handles both "start only" and "start + due" cases
  // with the correct phrasing.
  return formatRangeLabel(start, due, formatSingleDueLabel(due));
}

export function QuickCreateTaskModal({
  open,
  onOpenChange,
  projects: projectsProp,
}: QuickCreateTaskModalProps) {
  const { data: session } = useSession();
  const [minimized, setMinimized] = useState(false);
  const [creating, setCreating] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>(projectsProp ?? []);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState<User | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  // Asana-style range: start AND due date. Both optional. Default
  // due to Tomorrow as the gentle nudge ("most quick-assigns are
  // short-turnaround"); user can extend left (set a start) via the
  // popover. Set both to null to clear.
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(9, 0, 0, 0);
    return t;
  });

  // ── Load workspace users + (optionally) projects when opening ────
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users");
        if (res.ok && !cancelled) {
          const data: User[] = await res.json();
          setUsers(data);
        }
      } catch {
        // ignore — picker just shows empty
      }
    })();
    if (!projectsProp || projectsProp.length === 0) {
      (async () => {
        try {
          const res = await fetch("/api/projects");
          if (res.ok && !cancelled) {
            const data: Project[] = await res.json();
            setProjects(data);
          }
        } catch {
          // ignore
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [open, projectsProp]);

  // Keep external `projects` prop in sync if the caller decides to pass
  // a list after mount.
  useEffect(() => {
    if (projectsProp && projectsProp.length > 0) setProjects(projectsProp);
  }, [projectsProp]);

  const handleClose = () => {
    onOpenChange(false);
    setMinimized(false);
    setTitle("");
    setDescription("");
    setSelectedAssignee(null);
    setSelectedProject(null);
    setStartDate(null);
    // Reset due date to Tomorrow for the next time the composer opens.
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(9, 0, 0, 0);
    setDueDate(t);
  };

  /** Pure helper: format a Date as YYYY-MM-DD without timezone drift. */
  const fmtIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const handleCreateTask = async () => {
    if (!title.trim() || !selectedProject) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: title.trim(),
          description: description.trim() || null,
          assigneeId: selectedAssignee?.id ?? null,
          projectId: selectedProject.id,
          startDate: startDate ? fmtIso(startDate) : null,
          dueDate: dueDate ? fmtIso(dueDate) : null,
        }),
      });
      if (res.ok) {
        toast.success(
          selectedAssignee
            ? `Task assigned to ${selectedAssignee.name ?? selectedAssignee.email}`
            : "Task created"
        );
        handleClose();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to create task");
      }
    } catch {
      toast.error("Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  const userInitials =
    session?.user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  // Minimized rail — Gmail behavior. Single line, click to expand.
  if (minimized) {
    return (
      <div className="fixed bottom-0 right-6 bg-white rounded-t-lg shadow-2xl border border-b-0 border-slate-200 z-50 w-72">
        <button
          onClick={() => setMinimized(false)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          <span className="truncate">{title.trim() || "New task"}</span>
          <div className="flex items-center gap-1 text-slate-500">
            <span className="text-[10px] uppercase tracking-wider">Open</span>
            <ChevronDown className="h-3.5 w-3.5 rotate-180" />
          </div>
        </button>
      </div>
    );
  }

  return (
    <div
      // Bumped to 480px to match Asana's quick-create composer width
      // — the previous 420px felt cramped once the assignee + project
      // pills had real content in them.
      className="fixed bottom-0 right-6 bg-white rounded-t-lg shadow-2xl border border-b-0 border-slate-200 z-50 w-[480px] flex flex-col"
      style={{ maxHeight: "calc(100vh - 80px)" }}
    >
      {/* ── Header (light, Asana style) ──────────────────────────── */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-slate-200 flex-shrink-0">
        <span className="text-[13px] font-medium text-slate-900">
          New task
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setMinimized(true)}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            title="Minimize"
          >
            <Minus className="h-4 w-4 text-slate-500" />
          </button>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            title="Close"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Task title — bumped to 22px / semibold (Asana parity).
            Borderless, autofocus on open. */}
        <input
          autoFocus
          type="text"
          placeholder="Task name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-[22px] font-semibold text-slate-900 placeholder:text-slate-400 border-0 outline-none bg-transparent leading-tight"
        />

        {/* "To [Assignee] in [Project]" inline row */}
        <div className="flex items-center gap-2 text-sm text-slate-600 flex-wrap">
          <span>To</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] border border-dashed border-slate-300 rounded-md hover:border-slate-500 hover:bg-slate-50 transition-colors text-slate-700">
                {selectedAssignee ? (
                  <>
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={selectedAssignee.image || ""} />
                      <AvatarFallback className="text-[8px] bg-[#c9a84c] text-white">
                        {selectedAssignee.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-[120px]">
                      {selectedAssignee.name || selectedAssignee.email}
                    </span>
                  </>
                ) : (
                  <span>Assignee</span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto">
              {users.length === 0 ? (
                <div className="px-2 py-3 text-xs text-slate-400 text-center">
                  No teammates available
                </div>
              ) : (
                users.map((user) => (
                  <DropdownMenuItem
                    key={user.id}
                    onClick={() => setSelectedAssignee(user)}
                    className="cursor-pointer"
                  >
                    <Avatar className="h-5 w-5 mr-2">
                      <AvatarImage src={user.image || ""} />
                      <AvatarFallback className="text-[10px] bg-[#c9a84c] text-white">
                        {user.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">
                      {user.name || user.email}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <span>in</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] border border-dashed border-slate-300 rounded-md hover:border-slate-500 hover:bg-slate-50 transition-colors text-slate-700">
                {selectedProject ? (
                  <>
                    <span
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: selectedProject.color }}
                    />
                    <span className="truncate max-w-[140px]">
                      {selectedProject.name}
                    </span>
                  </>
                ) : (
                  <span>Project</span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 max-h-64 overflow-y-auto">
              {projects.length === 0 ? (
                <div className="px-2 py-3 text-xs text-slate-400 text-center">
                  No projects available
                </div>
              ) : (
                projects.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => setSelectedProject(project)}
                    className="cursor-pointer"
                  >
                    <span
                      className="h-3 w-3 rounded-full mr-2 flex-shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate">{project.name}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description (borderless, growable) */}
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full text-sm text-slate-700 placeholder:text-slate-400 border-0 outline-none bg-transparent resize-none min-h-[120px]"
        />
      </div>

      {/* ── Footer toolbar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 h-12 border-t border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-0.5 text-slate-500">
          <button
            onClick={() => toast.info("Add field coming soon")}
            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
            title="Add custom field"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => toast.info("Text formatting coming soon")}
            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
            title="Format text"
          >
            <Type className="h-4 w-4" />
          </button>
          <button
            onClick={() => toast.info("Emoji coming soon")}
            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
            title="Emoji"
          >
            <Smile className="h-4 w-4" />
          </button>
          <button
            onClick={() => toast.info("Mention coming soon")}
            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
            title="Mention someone"
          >
            <AtSign className="h-4 w-4" />
          </button>
          <button
            onClick={() => toast.info("Attachments coming soon")}
            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            onClick={() => toast.info("AI assist coming soon")}
            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
            title="AI assist"
          >
            <Sparkles className="h-4 w-4" />
          </button>

          {/* Due date pill — Asana-style range picker (start + due).
              When both are set the label collapses to "May 18 – 30";
              just due → "Tomorrow" / "Today" / "May 18"; just start
              → "From May 18". Text turns green once any date is set
              (matches Asana's quick-create + the project list cell). */}
          <DueDatePicker
            startDate={startDate}
            dueDate={dueDate}
            onChange={(s, d) => {
              setStartDate(s);
              setDueDate(d);
            }}
            trigger={
              <button
                className={`inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 text-[12px] font-medium ${
                  startDate || dueDate ? "text-[#1d6b3e]" : "text-slate-500"
                }`}
                title="Start / due date"
              >
                <Calendar className="h-3.5 w-3.5" />
                {formatComposerDateLabel(startDate, dueDate)}
              </button>
            }
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Creator avatar (current user) */}
          <Avatar className="h-7 w-7">
            <AvatarImage src={session?.user?.image || ""} />
            <AvatarFallback className="bg-slate-900 text-white text-[11px]">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          {/* + collaborator (stub — opens full task panel later) */}
          <button
            onClick={() =>
              toast.info("Add collaborators from the task detail panel")
            }
            className="h-7 w-7 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-slate-500 hover:text-slate-600 transition-colors"
            title="Add collaborator"
          >
            <Plus className="h-3 w-3" />
          </button>
          <Button
            size="sm"
            className="bg-black text-white hover:bg-slate-800 h-7 text-[12px] px-3"
            onClick={handleCreateTask}
            disabled={creating || !title.trim() || !selectedProject}
          >
            {creating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Creating…
              </>
            ) : (
              "Create task"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
