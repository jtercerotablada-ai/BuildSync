"use client";

/**
 * Project List View — Asana-parity replica of /my-tasks' list.
 *
 * Architecture mirrors my-tasks: CSS Grid container per row, combined
 * first cell (Grip + Checkbox + Task name + indicators), shared
 * tt-grid-* CSS classes from globals.css, --table-min-width pinned
 * inline on the scroll container so every row physically spans the
 * full table width (so horizontal dividers extend across columns
 * scrolled beyond the viewport).
 *
 * Built-in columns rendered (Phase 1):
 *   Task name · Due date · Collaborators · Projects · Visibility
 *
 * Custom fields + pinned built-in extras (Tags, Blocked by, etc.) are
 * Phase 2 — render path is wired but defaults to empty arrays.
 */

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { format, isPast, isToday, isTomorrow, parseISO } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  GripVertical,
  Check,
  Diamond,
  ThumbsUp,
  Calendar as CalendarIcon,
  MessageSquare,
  Paperclip,
  Layers,
  Globe,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
}

interface Task {
  id: string;
  name: string;
  completed: boolean;
  dueDate: string | null;
  startDate?: string | null;
  taskType?: "TASK" | "MILESTONE" | "APPROVAL" | null;
  assignee?: User | null;
  _count?: {
    subtasks?: number;
    comments?: number;
    attachments?: number;
  };
}

interface Section {
  id: string;
  name: string;
  tasks: Task[];
}

interface ProjectListViewProps {
  sections: Section[];
  onTaskClick: (taskId: string) => void;
  onAddTask: (
    name: string,
    sectionId: string,
    taskType?: "TASK" | "MILESTONE" | "APPROVAL"
  ) => Promise<void> | void;
  projectId: string;
  projectName?: string;
  projectColor?: string | null;
}

// ── Component ─────────────────────────────────────────────────

export function ProjectListView({
  sections,
  onTaskClick,
  onAddTask,
  projectId: _projectId,
  projectName,
  projectColor,
}: ProjectListViewProps) {
  // Column widths — Phase 1 fixes them; Phase 2 will read from
  // useUiState keyed by project so they survive reload + device.
  const [columnWidths] = useState({
    dueDate: 130,
    collaborators: 120,
    projects: 180,
    visibility: 130,
  });

  // CSS grid template: combined first cell + 4 built-in + + spacer.
  // Custom columns + pinned built-ins are added by Phase 2.
  const gridTemplate = useMemo(
    () =>
      [
        "minmax(308px, 1fr)",
        "var(--col-dueDate)",
        "var(--col-collaborators)",
        "var(--col-projects)",
        "var(--col-visibility)",
        "32px",
      ].join(" "),
    []
  );

  // Total table width — sums all column tracks so every row gets a
  // pinned min-width. Without this, rows take width:100% of the
  // viewport and horizontal dividers die mid-grid on scroll.
  const tableMinWidth = useMemo(
    () =>
      308 +
      columnWidths.dueDate +
      columnWidths.collaborators +
      columnWidths.projects +
      columnWidths.visibility +
      32,
    [columnWidths]
  );

  // Collapsible sections — collapsed state lives locally for Phase 1.
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );
  const toggleSection = (id: string) =>
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Inline add task: which section is in "Add task" input mode.
  const [addingInSection, setAddingInSection] = useState<string | null>(null);
  const [activeTaskType, setActiveTaskType] = useState<
    "TASK" | "MILESTONE" | "APPROVAL"
  >("TASK");
  const [newTaskName, setNewTaskName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Synchronous double-fire guard. Enter on the input AND onBlur
  // both can trigger handleSubmitAddTask before isCreating's
  // setState propagates — that produces a duplicate task. Ref
  // flips immediately and rejects the second call in the same tick.
  const isCreatingRef = useRef(false);

  useEffect(() => {
    if (addingInSection && !isCreating) inputRef.current?.focus();
  }, [addingInSection, isCreating]);

  // Listen for buildsync:add-task events from the parent toolbar's
  // black "Add task" split button so toolbar + inline trigger share
  // the same UX as my-tasks. detail.sectionId tells us which section
  // to open (the toolbar fires with the first section); detail.taskType
  // selects the icon (Task / Approval / Milestone).
  useEffect(() => {
    function handleAddTaskEvent(e: Event) {
      const detail = (e as CustomEvent).detail as {
        sectionId?: string;
        taskType?: "TASK" | "MILESTONE" | "APPROVAL";
      };
      if (!detail?.sectionId) return;
      setActiveTaskType(detail.taskType ?? "TASK");
      setAddingInSection(detail.sectionId);
      setNewTaskName("");
    }
    window.addEventListener("buildsync:add-task", handleAddTaskEvent);
    return () =>
      window.removeEventListener("buildsync:add-task", handleAddTaskEvent);
  }, []);

  async function handleSubmitAddTask(sectionId: string) {
    const name = newTaskName.trim();
    if (!name || isCreating || isCreatingRef.current) return;
    isCreatingRef.current = true;
    setIsCreating(true);
    try {
      await onAddTask(name, sectionId, activeTaskType);
      setNewTaskName("");
    } finally {
      setIsCreating(false);
      isCreatingRef.current = false;
    }
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-1 overflow-auto bg-white"
        style={
          {
            "--col-dueDate": `${columnWidths.dueDate}px`,
            "--col-collaborators": `${columnWidths.collaborators}px`,
            "--col-projects": `${columnWidths.projects}px`,
            "--col-visibility": `${columnWidths.visibility}px`,
            "--row-h": "40px",
            "--col-header-h": "32px",
            "--table-min-width": `${tableMinWidth}px`,
          } as React.CSSProperties
        }
      >
        {/* Inner wrapper pinned to the table's true width so every
            row + DnD wrapper inherits the same horizontal extent. */}
        <div style={{ minWidth: "var(--table-min-width)" }}>
          {/* COLUMN HEADER */}
          <div
            className="tt-grid-divider-row tt-grid-header hidden md:grid items-center px-6 text-[11px] font-medium text-gray-500 flex-shrink-0 sticky top-0 z-20"
            style={{
              height: "var(--col-header-h, 32px)",
              gridTemplateColumns: gridTemplate,
            }}
          >
            <div className="flex items-center min-w-0">
              <div
                className="w-4 -ml-1 mr-1 flex-shrink-0"
                aria-hidden="true"
              />
              <div className="w-8 flex-shrink-0" />
              <span className="flex items-center gap-1 cursor-pointer hover:text-gray-700">
                Task name
                <ChevronDown className="w-3 h-3" />
              </span>
            </div>
            <div className="relative flex items-center pl-2.5 pr-1">
              <span className="flex items-center gap-1 cursor-pointer hover:text-gray-700">
                Due date <ChevronDown className="w-3 h-3" />
              </span>
            </div>
            <div className="relative flex items-center pl-2.5 pr-1">
              <span className="flex items-center gap-1 cursor-pointer hover:text-gray-700">
                Collaborators <ChevronDown className="w-3 h-3" />
              </span>
            </div>
            <div className="relative flex items-center pl-2.5 pr-1">
              <span className="flex items-center gap-1 cursor-pointer hover:text-gray-700">
                Projects <ChevronDown className="w-3 h-3" />
              </span>
            </div>
            <div className="relative flex items-center pl-2.5 pr-1">
              <span className="flex items-center gap-1 cursor-pointer hover:text-gray-700">
                Visibility <ChevronDown className="w-3 h-3" />
              </span>
            </div>
            <div className="flex items-center justify-center">
              <button
                type="button"
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                title="Add column (coming soon)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* SECTIONS */}
          {sections.map((section) => (
            <div key={section.id}>
              <SectionHeaderRow
                section={section}
                isCollapsed={collapsedSections.has(section.id)}
                onToggle={() => toggleSection(section.id)}
                gridTemplate={gridTemplate}
              />

              {!collapsedSections.has(section.id) && (
                <>
                  {/* Inline add task input */}
                  {addingInSection === section.id && (
                    <div
                      className="tt-grid-divider-row hidden md:grid items-center px-4 md:px-6 bg-[#c9a84c]/5"
                      style={{
                        height: "var(--row-h, 40px)",
                        gridTemplateColumns: gridTemplate,
                      }}
                    >
                      <div className="flex items-center min-w-0">
                        <div
                          className="w-4 -ml-1 mr-1 flex-shrink-0"
                          aria-hidden="true"
                        />
                        <div className="w-8 flex-shrink-0 flex items-center">
                          {activeTaskType === "MILESTONE" ? (
                            <Diamond className="w-4 h-4 text-[#a8893a] flex-shrink-0" />
                          ) : activeTaskType === "APPROVAL" ? (
                            <ThumbsUp className="w-4 h-4 text-[#a8893a] flex-shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0" />
                          )}
                        </div>
                        <input
                          ref={inputRef}
                          type="text"
                          value={newTaskName}
                          onChange={(e) => setNewTaskName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSubmitAddTask(section.id);
                            } else if (e.key === "Escape") {
                              setAddingInSection(null);
                              setNewTaskName("");
                            }
                          }}
                          onBlur={() => {
                            if (!newTaskName.trim()) {
                              setAddingInSection(null);
                            } else {
                              handleSubmitAddTask(section.id);
                            }
                          }}
                          placeholder="Type the task name"
                          className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-gray-900 placeholder:text-gray-400"
                          autoFocus
                        />
                      </div>
                      <div />
                      <div />
                      <div />
                      <div />
                      <div />
                    </div>
                  )}

                  {/* Data rows */}
                  {section.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task.id)}
                      projectName={projectName}
                      projectColor={projectColor}
                      gridTemplate={gridTemplate}
                    />
                  ))}

                  {/* + Add task trigger */}
                  {addingInSection !== section.id && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setAddingInSection(section.id);
                        setNewTaskName("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setAddingInSection(section.id);
                          setNewTaskName("");
                        }
                      }}
                      className="tt-grid-row-clean hidden md:grid items-center px-4 md:px-6 w-full text-left hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                      style={{
                        height: "var(--row-h, 40px)",
                        gridTemplateColumns: gridTemplate,
                      }}
                    >
                      <div className="flex items-center min-w-0">
                        <div
                          className="w-4 -ml-1 mr-1 flex-shrink-0"
                          aria-hidden="true"
                        />
                        <div className="w-8 flex-shrink-0 flex items-center">
                          <Plus className="w-3.5 h-3.5 text-gray-300" />
                        </div>
                        <span className="text-[13px] text-gray-400 truncate">
                          Add task
                        </span>
                      </div>
                      <div />
                      <div />
                      <div />
                      <div />
                      <div />
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Section header row ────────────────────────────────────────

function SectionHeaderRow({
  section,
  isCollapsed,
  onToggle,
  gridTemplate,
}: {
  section: Section;
  isCollapsed: boolean;
  onToggle: () => void;
  gridTemplate: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className="tt-grid-row-clean hidden md:grid items-center px-4 md:px-6 w-full text-left hover:bg-[var(--surface-hover)] cursor-pointer"
      style={{
        height: "var(--row-h, 40px)",
        gridTemplateColumns: gridTemplate,
      }}
    >
      <div className="flex items-center min-w-0">
        <div className="w-4 -ml-1 mr-1 flex-shrink-0" aria-hidden="true" />
        <div className="w-8 flex-shrink-0 flex items-center">
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-600" />
          )}
        </div>
        <span className="text-[14px] font-semibold text-gray-900 truncate">
          {section.name}
        </span>
        {section.tasks.length > 0 && (
          <span className="text-gray-400 text-[12px] ml-2 flex-shrink-0">
            {section.tasks.length}
          </span>
        )}
      </div>
      <div />
      <div />
      <div />
      <div />
      <div />
    </div>
  );
}

// ── TaskRow — combined first cell + 4 built-in cells + spacer ─

function TaskRow({
  task,
  onClick,
  projectName,
  projectColor,
  gridTemplate,
}: {
  task: Task;
  onClick: () => void;
  projectName?: string;
  projectColor?: string | null;
  gridTemplate: string;
}) {
  const router = useRouter();
  void router;
  const dueDateInfo = formatDueDate(task.dueDate);

  const checkboxEl =
    task.taskType === "MILESTONE" ? (
      <button
        onClick={(e) => {
          e.stopPropagation();
        }}
        className={cn(
          "flex items-center justify-center flex-shrink-0 text-[#a8893a]"
        )}
      >
        <Diamond className="w-4 h-4" />
      </button>
    ) : task.taskType === "APPROVAL" ? (
      <button
        onClick={(e) => {
          e.stopPropagation();
        }}
        className={cn(
          "flex items-center justify-center flex-shrink-0 text-[#a8893a]"
        )}
      >
        <ThumbsUp className="w-4 h-4" />
      </button>
    ) : (
      <button
        onClick={(e) => {
          e.stopPropagation();
        }}
        className={cn(
          "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0",
          task.completed
            ? "bg-[#c9a84c] border-[#c9a84c]"
            : "border-gray-300 hover:border-gray-400"
        )}
      >
        {task.completed && <Check className="w-3 h-3 text-white" />}
      </button>
    );

  return (
    <div
      className="tt-grid-divider-row hidden md:grid items-center px-4 md:px-6 bg-white hover:bg-[var(--surface-hover)] cursor-pointer group transition-colors select-none"
      style={{
        height: "var(--row-h, 40px)",
        gridTemplateColumns: gridTemplate,
      }}
      onClick={onClick}
    >
      {/* Combined first cell — Grip + Checkbox + Task name + indicators */}
      <div className="flex items-center min-w-0">
        <div
          className="w-4 -ml-1 mr-1 flex items-center justify-center flex-shrink-0 text-gray-300 opacity-0 group-hover:opacity-100"
          aria-hidden="true"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <div className="w-8 flex-shrink-0 flex items-center">{checkboxEl}</div>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "text-[13px] truncate",
              task.completed ? "line-through text-gray-400" : "text-gray-900"
            )}
          >
            {task.name}
          </span>
          {(task._count?.subtasks ?? 0) > 0 && (
            <span className="text-[11px] text-gray-400 flex items-center flex-shrink-0">
              <Layers className="w-3 h-3 mr-0.5" />
              {task._count?.subtasks}
            </span>
          )}
          {(task._count?.attachments ?? 0) > 0 && (
            <Paperclip className="w-3 h-3 text-gray-400 flex-shrink-0" />
          )}
          {(task._count?.comments ?? 0) > 0 && (
            <span className="text-[11px] text-gray-400 flex items-center flex-shrink-0">
              <MessageSquare className="w-3 h-3 mr-0.5" />
              {task._count?.comments}
            </span>
          )}
        </div>
      </div>

      {/* Due date */}
      <div className="hidden md:flex pl-2.5 pr-1 overflow-hidden items-center">
        <span
          className={cn(
            "text-[13px] truncate whitespace-nowrap",
            dueDateInfo.className
          )}
          title={dueDateInfo.text}
        >
          {dueDateInfo.text}
        </span>
      </div>

      {/* Collaborators (= assignee avatar) */}
      <div className="hidden md:flex pl-2.5 pr-1 overflow-hidden items-center">
        {task.assignee && (
          <Avatar className="w-5 h-5">
            <AvatarImage src={task.assignee.image || undefined} />
            <AvatarFallback className="text-[10px] bg-gray-100 text-gray-600">
              {task.assignee.name?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Projects — shows the current project this row belongs to */}
      <div className="hidden md:flex pl-2.5 pr-1 overflow-hidden items-center">
        {projectName && (
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="w-2 h-2 rounded-sm flex-shrink-0"
              style={{ backgroundColor: projectColor || "#c9a84c" }}
            />
            <span className="text-[13px] text-gray-600 truncate">
              {projectName}
            </span>
          </div>
        )}
      </div>

      {/* Visibility */}
      <div className="hidden md:flex pl-2.5 pr-1 overflow-hidden items-center">
        <span className="text-[13px] text-gray-400 flex items-center gap-1 whitespace-nowrap">
          <Globe className="w-3 h-3 flex-shrink-0" />
          My workspace
        </span>
      </div>

      {/* + spacer */}
      <div className="hidden md:block" />
    </div>
  );
}

// ── Due-date formatter (mirrors my-tasks' formatDueDate) ──────

function formatDueDate(dateStr: string | null): {
  text: string;
  className: string;
} {
  if (!dateStr) return { text: "", className: "" };
  const date = parseISO(dateStr);
  const today = isToday(date);
  const tomorrow = isTomorrow(date);
  const past = isPast(date) && !today;

  if (today) return { text: "Today", className: "text-[#a8893a]" };
  if (tomorrow) return { text: "Tomorrow", className: "text-gray-700" };
  if (past) {
    const days = Math.floor(
      (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
    );
    return { text: `Overdue · ${days} days`, className: "text-black font-medium" };
  }
  return { text: format(date, "MMM d"), className: "text-gray-700" };
}

// Suppress unused import warning for CalendarIcon (reserved for
// future "add date" empty-cell hover state).
void CalendarIcon;
