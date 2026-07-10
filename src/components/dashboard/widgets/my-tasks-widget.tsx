'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Calendar as CalendarIcon, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { dueDateToLocalMidnight, startOfLocalDay, daysFromToday, toDateOnlyISO } from '@/lib/date-only';
import { TaskDetailModal } from '@/components/tasks/task-detail-modal';
import { DueDatePicker } from '@/components/tasks/due-date-picker';

interface Task {
  id: string;
  name: string;
  completed: boolean;
  completedAt?: string | null;
  dueDate: string | null;
  projectId?: string | null;
  project?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

type TabType = 'upcoming' | 'overdue' | 'completed';

// getInitials was used by the original avatar header; the avatar
// row was removed so the helper is no longer needed.

// Format due date
function formatDueDate(date: string): { text: string; isSpecial: boolean } {
  const diff = daysFromToday(date);

  if (diff === 0) {
    return { text: 'Today', isSpecial: true };
  }
  if (diff === 1) {
    return { text: 'Tomorrow', isSpecial: true };
  }
  if (diff === -1) {
    return { text: 'Yesterday', isSpecial: true };
  }

  // Format: "jan 20", "feb 1"
  return {
    text: dueDateToLocalMidnight(date)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      .toLowerCase(),
    isSpecial: false
  };
}

// Size / Remove handled by WidgetContainer — no props needed.
export function MyTasksWidget() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  // Asana's inline composer lets you pick a due date and open the
  // detail modal *before* the task is saved. We capture the draft
  // due date here and pass it through on POST.
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | null>(null);
  // Per-tab so expanding "Completed" doesn't silently expand the
  // other two tabs as well.
  const [showAll, setShowAll] = useState<Record<TabType, boolean>>({
    upcoming: false,
    overdue: false,
    completed: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // macOS Safari never focuses <button> on mousedown, so the composer
  // blur's relatedTarget is null when clicking the action buttons and
  // the [data-composer-action] check alone can't catch it. Flag the
  // press in onPointerDown (fires before the focus change / blur) and
  // honor it in the blur guard.
  const composerActionPressRef = useRef(false);
  const markComposerActionPress = () => {
    composerActionPressRef.current = true;
    // Blur (if any) fires synchronously with the focus change, so a
    // 0-tick reset is enough and a stale flag can't swallow a later
    // legitimate blur-create.
    setTimeout(() => {
      composerActionPressRef.current = false;
    }, 0);
  };
  // Concurrent fetchTasks calls (mount + task-created event + modal
  // update) can resolve out of order; tag each with an incrementing id
  // and ignore any response that isn't the latest request.
  const fetchIdRef = useRef(0);

  const fetchTasks = useCallback(async () => {
    const requestId = ++fetchIdRef.current;
    setError(null);
    try {
      const res = await fetch('/api/tasks?myTasks=true&fields=summary&limit=500');
      if (fetchIdRef.current !== requestId) return;
      if (res.ok) {
        const data = await res.json();
        if (fetchIdRef.current !== requestId) return;
        setAllTasks(data);
      } else {
        setError('Failed to load data');
      }
    } catch (error) {
      if (fetchIdRef.current !== requestId) return;
      console.error('Failed to fetch tasks:', error);
      setError('Failed to load data');
    } finally {
      if (fetchIdRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Stay in sync when a task is created elsewhere (quick-add modal,
  // other widgets' composers).
  useEffect(() => {
    const onTaskCreated = () => fetchTasks();
    window.addEventListener('buildsync:task-created', onTaskCreated);
    return () => window.removeEventListener('buildsync:task-created', onTaskCreated);
  }, [fetchTasks]);

  // Focus input when create mode is activated
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  const today = startOfLocalDay();

  // Asana shows ~5 tasks per tab by default and exposes a "Mostrar
  // más" affordance to reveal the rest. We mirror that with showAll
  // (cap stays at 5 unless the user expands).
  const VISIBLE_LIMIT = 5;
  const upcomingTasksAll = allTasks.filter(task => {
    if (task.completed) return false;
    if (!task.dueDate) return true;
    return dueDateToLocalMidnight(task.dueDate) >= today;
  });
  const overdueTasksAll = allTasks.filter(task => {
    if (task.completed) return false;
    if (!task.dueDate) return false;
    return dueDateToLocalMidnight(task.dueDate) < today;
  });
  // Most-recently-completed first (Asana's order); tasks completed
  // before completedAt existed sink to the bottom.
  const completedTasksAll = allTasks
    .filter(task => task.completed)
    .sort(
      (a, b) =>
        (b.completedAt ? Date.parse(b.completedAt) : 0) -
        (a.completedAt ? Date.parse(a.completedAt) : 0)
    );

  const upcomingTasks = showAll.upcoming ? upcomingTasksAll : upcomingTasksAll.slice(0, VISIBLE_LIMIT);
  const overdueTasks = showAll.overdue ? overdueTasksAll : overdueTasksAll.slice(0, VISIBLE_LIMIT);
  const completedTasks = showAll.completed ? completedTasksAll : completedTasksAll.slice(0, VISIBLE_LIMIT);

  // PATCH the completed flag for one task, with an optimistic local
  // flip and an Undo action on the toast (mirrors Asana's "Deshacer" —
  // toast stays visible for ~5s and the revert is one click). The
  // action re-PATCHes back to the previous state without any extra
  // prompt.
  const toggleCompleted = useCallback(
    async (taskId: string, nextCompleted: boolean) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: nextCompleted }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    },
    []
  );

  const setTaskCompleted = useCallback((taskId: string, completed: boolean) => {
    setAllTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, completed } : t))
    );
  }, []);

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    const next = !completed;
    setTaskCompleted(taskId, next);
    try {
      await toggleCompleted(taskId, next);
      const message = completed
        ? 'Task marked as incomplete'
        : 'Task completed';
      toast.success(message, {
        action: {
          label: 'Undo',
          onClick: async () => {
            setTaskCompleted(taskId, completed);
            try {
              await toggleCompleted(taskId, completed);
            } catch {
              setTaskCompleted(taskId, next);
              toast.error('Failed to undo');
            }
          },
        },
      });
    } catch {
      setTaskCompleted(taskId, completed);
      toast.error('Failed to update task');
    }
  };

  const handleCreateTask = async (): Promise<Task | null> => {
    if (newTaskName.trim()) {
      try {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newTaskName.trim(),
            dueDate: newTaskDueDate ? toDateOnlyISO(newTaskDueDate) : null,
          }),
        });

        if (response.ok) {
          const created: Task = await response.json();
          toast.success('Task created!');
          // Our own listener refetches, and sibling widgets stay in sync.
          window.dispatchEvent(new CustomEvent('buildsync:task-created'));
          setNewTaskName('');
          setNewTaskDueDate(null);
          setIsCreating(false);
          return created;
        } else {
          toast.error('Failed to create task');
        }
      } catch {
        toast.error('Failed to create task');
      }
    } else {
      setIsCreating(false);
    }
    return null;
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTaskId(task.id);
  };

  const currentTasks = activeTab === 'upcoming' ? upcomingTasks :
                       activeTab === 'overdue' ? overdueTasks : completedTasks;
  const currentTasksAll = activeTab === 'upcoming' ? upcomingTasksAll :
                          activeTab === 'overdue' ? overdueTasksAll : completedTasksAll;
  const hiddenCount = currentTasksAll.length - currentTasks.length;

  // Count badges mirror Asana's pattern: only show a count on
  // "Overdue" when there's something to flag (signal urgency).
  // "Upcoming" and "Completed" stay countless to keep the header
  // calm when nothing demands attention.
  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'overdue', label: 'Overdue', count: overdueTasksAll.length },
    { id: 'completed', label: 'Completed' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Title is provided by WidgetContainer above. The original
          avatar + "Create task" + "View all my tasks" actions used
          to live in a custom ⋯ menu here — Create is reachable via
          the inline + input below and View all jumps to /my-tasks
          via the tabs/links inside the body, so no functionality
          was lost. */}

      {/* ========== TABS WITH UNDERLINE ========== */}
      <div role="tablist" className="flex border-b border-gray-200 mb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 text-gray-400 tabular-nums">
                ({tab.count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ========== INLINE TASK CREATION ========== */}
      {isCreating ? (
        <div className="flex items-center gap-2 mb-2 py-1 group/composer">
          <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
          <Input
            ref={inputRef}
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            placeholder="Task name"
            className="flex-1 h-7 text-sm border-0 p-0 focus-visible:ring-0 placeholder:text-gray-400"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              } else if (e.key === 'Escape') {
                setIsCreating(false);
                setNewTaskName('');
                setNewTaskDueDate(null);
              }
            }}
            onBlur={(e) => {
              // Don't fire create if the blur came from clicking
              // the inline date / details buttons — they live inside
              // the composer row and would otherwise eat the click.
              // relatedTarget covers keyboard focus moves; the press
              // ref covers Safari, where relatedTarget is null.
              const next = e.relatedTarget as HTMLElement | null;
              if (composerActionPressRef.current || next?.closest('[data-composer-action]')) return;
              handleCreateTask();
            }}
          />
          {/* Inline due-date picker — mirrors Asana's "Fecha de
              entrega" button. Today/Tomorrow/date label shown when
              set, otherwise just the calendar icon. */}
          <DueDatePicker
            dueDate={newTaskDueDate}
            onChange={(_start, due) => setNewTaskDueDate(due)}
            trigger={
              <button
                type="button"
                data-composer-action
                title="Set due date"
                onPointerDown={markComposerActionPress}
                className={cn(
                  'flex items-center gap-1 h-6 px-1.5 text-xs rounded hover:bg-gray-100 flex-shrink-0',
                  newTaskDueDate ? 'text-gray-700' : 'text-gray-400'
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {newTaskDueDate && (
                  <span className="tabular-nums">
                    {formatDueDate(toDateOnlyISO(newTaskDueDate)).text}
                  </span>
                )}
              </button>
            }
          />
          {/* "Detalles" — Asana opens the task detail with the
              draft pre-filled. We persist first (if there's a
              name) and open the detail modal on the saved task;
              on failure the draft stays put, and with nothing to
              save we fall back to /my-tasks. */}
          <button
            type="button"
            data-composer-action
            title="Open task details"
            onPointerDown={markComposerActionPress}
            onClick={async () => {
              if (newTaskName.trim()) {
                const created = await handleCreateTask();
                if (created) {
                  setSelectedTaskId(created.id);
                }
                return;
              }
              router.push('/my-tasks');
            }}
            className="flex items-center justify-center h-6 w-6 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex-shrink-0"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-2 py-1"
        >
          <Plus className="h-4 w-4" />
          <span>Create task</span>
        </button>
      )}

      {/* ========== TASK LIST ========== */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />
            ))}
          </div>
        ) : error && allTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-4 gap-2">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => fetchTasks()}
              className="text-xs text-gray-500 hover:text-gray-900 hover:underline underline-offset-4 px-1 py-1"
            >
              Retry
            </button>
          </div>
        ) : currentTasks.length === 0 ? (
          /* Minimalist empty state — copy adapts to the tab so an
             empty Overdue tab reads as a good thing ("You're on
             track!") instead of neutral, matching Asana's pattern. */
          <div className="flex flex-col items-center justify-center h-full text-center py-4">
            <div className="w-12 h-12 mb-3 text-gray-200">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 12l2 2 4-4" />
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">
              {activeTab === 'overdue'
                ? "No overdue tasks. You're on track!"
                : activeTab === 'upcoming'
                  ? 'No upcoming tasks'
                  : 'Nothing completed yet'}
            </p>
          </div>
        ) : (
          /* Task list */
          <div className="space-y-0.5">
            {/* A silent refetch (task-created event / modal update)
                failed but tasks are still loaded — keep the stale list
                and surface the failure as a subtle inline banner
                instead of blanking the widget. */}
            {error && (
              <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-red-50 text-xs text-red-600">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => fetchTasks()}
                  className="font-medium hover:underline underline-offset-4 flex-shrink-0"
                >
                  Retry
                </button>
              </div>
            )}
            {currentTasks.map((task) => {
              const dueInfo = task.dueDate ? formatDueDate(task.dueDate) : null;

              return (
                <div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  className="flex items-center gap-3 py-2 hover:bg-gray-50 rounded cursor-pointer group"
                  onClick={() => handleTaskClick(task)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleTaskClick(task);
                    }
                  }}
                >
                  {/* Circular checkbox with checkmark on hover */}
                  <button
                    aria-label={task.completed ? `Mark "${task.name}" incomplete` : `Complete "${task.name}"`}
                    aria-pressed={task.completed}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleTask(task.id, task.completed);
                    }}
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                      task.completed
                        ? 'bg-black border-black'
                        : 'border-gray-300 hover:border-black hover:bg-white'
                    )}
                  >
                    {/* Show checkmark if completed or on hover */}
                    <Check className={cn(
                      'h-3 w-3 transition-opacity',
                      task.completed
                        ? 'text-white opacity-100'
                        : 'text-black opacity-0 group-hover:opacity-50'
                    )} />
                  </button>

                  {/* Task content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm truncate',
                      task.completed && 'line-through text-gray-400'
                    )}>
                      {task.name}
                    </p>

                    {/* Project with color badge */}
                    {task.project && (
                      <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs min-w-0 max-w-full"
                          style={{
                            backgroundColor: `${task.project.color || '#c9a84c'}20`,
                            color: task.project.color || '#c9a84c'
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: task.project.color || '#c9a84c' }}
                          />
                          <span className="truncate">{task.project.name}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Due date with special colors */}
                  {dueInfo && (
                    <span className={cn(
                      'text-xs flex-shrink-0',
                      activeTab === 'overdue'
                        ? 'text-black'
                        : dueInfo.isSpecial
                          ? 'text-black font-medium'
                          : 'text-gray-500'
                    )}>
                      {dueInfo.text}
                    </span>
                  )}
                </div>
              );
            })}
            {/* Asana's "Mostrar más" — surfaces hidden tasks past the
                default 5. Once expanded, the toggle reads "Show less". */}
            {(hiddenCount > 0 || showAll[activeTab]) && (
              <button
                type="button"
                onClick={() =>
                  setShowAll((prev) => ({ ...prev, [activeTab]: !prev[activeTab] }))
                }
                className="text-xs text-gray-500 hover:text-gray-900 hover:underline underline-offset-4 mt-1 px-1 py-1"
              >
                {showAll[activeTab] ? 'Show less' : `Show more (${hiddenCount})`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========== TASK DETAIL MODAL ========== */}
      <TaskDetailModal
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
        onTaskUpdate={fetchTasks}
      />
    </div>
  );
}
