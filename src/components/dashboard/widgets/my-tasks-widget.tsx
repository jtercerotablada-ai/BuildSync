'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Check, Plus, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TaskDetailModal } from '@/components/tasks/task-detail-modal';

interface Task {
  id: string;
  name: string;
  completed: boolean;
  dueDate: string | null;
  projectId?: string | null;
  project?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

type TabType = 'upcoming' | 'overdue' | 'completed';

// Obtener iniciales del nombre (2 letras)
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Formatear fecha como Asana
function formatDueDate(date: string): { text: string; isSpecial: boolean } {
  const d = new Date(date);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === today.toDateString()) {
    return { text: 'Today', isSpecial: true };
  }
  if (d.toDateString() === tomorrow.toDateString()) {
    return { text: 'Tomorrow', isSpecial: true };
  }

  // Formato: "jan 20", "feb 1"
  return {
    text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase(),
    isSpecial: false
  };
}

export function MyTasksWidget() {
  const router = useRouter();
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const user = {
    name: session?.user?.name || 'User',
    image: session?.user?.image || null,
  };

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks?myTasks=true');
      if (res.ok) {
        const data = await res.json();
        setAllTasks(data);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Focus en input cuando se activa crear
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const upcomingTasks = allTasks.filter(task => {
    if (task.completed) return false;
    if (!task.dueDate) return true;
    const dueDate = new Date(task.dueDate);
    return dueDate >= today;
  }).slice(0, 5);

  const overdueTasks = allTasks.filter(task => {
    if (task.completed) return false;
    if (!task.dueDate) return false;
    const dueDate = new Date(task.dueDate);
    return dueDate < today;
  }).slice(0, 5);

  const completedTasks = allTasks.filter(task => task.completed).slice(0, 5);

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !completed }),
      });

      if (response.ok) {
        toast.success(completed ? 'Task marked as incomplete' : 'Task completed!');
        fetchTasks();
      }
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleCreateTask = async () => {
    if (newTaskName.trim()) {
      try {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newTaskName.trim() }),
        });

        if (response.ok) {
          toast.success('Task created!');
          fetchTasks();
          setNewTaskName('');
          setIsCreating(false);
        }
      } catch (error) {
        toast.error('Failed to create task');
      }
    } else {
      setIsCreating(false);
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTaskId(task.id);
  };

  const currentTasks = activeTab === 'upcoming' ? upcomingTasks :
                       activeTab === 'overdue' ? overdueTasks : completedTasks;

  const tabs: { id: TabType; label: string }[] = [
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'completed', label: 'Completed' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* ========== HEADER CON AVATAR ========== */}
      <div className="flex items-center gap-3 mb-3">
        {/* Avatar con BORDE amarillo (no fondo) - Estilo Asana */}
        <Avatar className="h-10 w-10">
          <AvatarImage src={user.image || undefined} />
          <AvatarFallback className="bg-gray-900 text-white font-bold text-sm">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>

        {/* Título con candado */}
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-900">My tasks</span>
            <Lock className="h-3.5 w-3.5 text-gray-400" />
          </div>
        </div>

        {/* View all link */}
        <Button
          variant="link"
          size="sm"
          className="text-blue-600 hover:text-blue-700 p-0 h-auto font-normal"
          onClick={() => router.push('/my-tasks')}
        >
          View all →
        </Button>
      </div>

      {/* ========== TABS CON UNDERLINE ========== */}
      <div className="flex border-b border-gray-200 mb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========== CREAR TAREA INLINE ========== */}
      {isCreating ? (
        <div className="flex items-center gap-2 mb-2 py-1">
          <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
          <Input
            ref={inputRef}
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            placeholder="Task name"
            className="flex-1 h-7 text-sm border-0 p-0 focus-visible:ring-0 placeholder:text-gray-400"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateTask();
              } else if (e.key === 'Escape') {
                setIsCreating(false);
                setNewTaskName('');
              }
            }}
            onBlur={handleCreateTask}
          />
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

      {/* ========== LISTA DE TAREAS ========== */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />
            ))}
          </div>
        ) : currentTasks.length === 0 ? (
          /* Empty state minimalista */
          <div className="flex flex-col items-center justify-center h-full text-center py-4">
            <div className="w-12 h-12 mb-3 text-gray-200">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 12l2 2 4-4" />
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">No {activeTab} tasks</p>
          </div>
        ) : (
          /* Lista de tareas */
          <div className="space-y-0.5">
            {currentTasks.map((task) => {
              const dueInfo = task.dueDate ? formatDueDate(task.dueDate) : null;

              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 py-2 hover:bg-gray-50 rounded cursor-pointer group"
                  onClick={() => handleTaskClick(task)}
                >
                  {/* Checkbox CIRCULAR con checkmark en hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleTask(task.id, task.completed);
                    }}
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                      task.completed
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-300 hover:border-green-500 hover:bg-green-50'
                    )}
                  >
                    {/* Mostrar checkmark si completado O en hover */}
                    <Check className={cn(
                      'h-3 w-3 transition-opacity',
                      task.completed
                        ? 'text-white opacity-100'
                        : 'text-green-500 opacity-0 group-hover:opacity-50'
                    )} />
                  </button>

                  {/* Contenido de la tarea */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm truncate',
                      task.completed && 'line-through text-gray-400'
                    )}>
                      {task.name}
                    </p>

                    {/* Proyecto con BADGE de color */}
                    {task.project && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
                          style={{
                            backgroundColor: `${task.project.color || '#3B82F6'}20`,
                            color: task.project.color || '#3B82F6'
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: task.project.color || '#3B82F6' }}
                          />
                          {task.project.name}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Fecha con colores especiales */}
                  {dueInfo && (
                    <span className={cn(
                      'text-xs flex-shrink-0',
                      activeTab === 'overdue'
                        ? 'text-red-500'
                        : dueInfo.isSpecial
                          ? 'text-green-600 font-medium'
                          : 'text-gray-500'
                    )}>
                      {dueInfo.text}
                    </span>
                  )}
                </div>
              );
            })}
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
