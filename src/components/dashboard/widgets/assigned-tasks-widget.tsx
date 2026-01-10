'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Circle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AssignedTask {
  id: string;
  name: string;
  completed: boolean;
  dueDate: string | null;
  assignee: {
    id: string;
    name: string;
    image: string | null;
  } | null;
  project?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

type TabType = 'upcoming' | 'overdue' | 'completed';

interface AssignedTasksWidgetProps {
  onAssignTask?: () => void;
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDueDate(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dateOnly.getTime() === today.getTime()) return 'Today';
  if (dateOnly.getTime() === tomorrow.getTime()) return 'Tomorrow';
  if (dateOnly.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
}

export function AssignedTasksWidget({ onAssignTask }: AssignedTasksWidgetProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [allTasks, setAllTasks] = useState<AssignedTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks/assigned');
      if (res.ok) {
        const data = await res.json();
        setAllTasks(data);
      }
    } catch (error) {
      console.error('Failed to fetch assigned tasks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleToggleComplete = async (taskId: string, currentCompleted: boolean) => {
    try {
      const res = await fetch('/api/tasks/' + taskId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentCompleted }),
      });
      if (res.ok) {
        toast.success(currentCompleted ? 'Task marked as incomplete' : 'Task completed!');
        fetchTasks();
      } else {
        toast.error('Failed to update task');
      }
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const filteredTasks = allTasks.filter((task) => {
    if (activeTab === 'completed') return task.completed;
    if (activeTab === 'overdue') return !task.completed && isOverdue(task.dueDate);
    return !task.completed && !isOverdue(task.dueDate);
  });

  const tabs: { id: TabType; label: string }[] = [
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'completed', label: 'Completed' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (<div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-16 h-16 rounded-full border-2 border-gray-300 flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 mb-4 max-w-[250px]">Assign tasks to your teammates and track them here.</p>
            <Button variant="outline" size="sm" onClick={onAssignTask}>Assign task</Button>
          </div>
        ) : (
          <div className="space-y-1 overflow-y-auto h-full max-h-[280px]">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 group cursor-pointer"
                onClick={() => {
                  if (task.project?.id) {
                    router.push('/projects/' + task.project.id + '?task=' + task.id);
                  } else {
                    router.push('/my-tasks?task=' + task.id);
                  }
                }}
              >
                <button onClick={(e) => { e.stopPropagation(); handleToggleComplete(task.id, task.completed); }} className="mt-0.5 flex-shrink-0">
                  {task.completed ? (<CheckCircle2 className="h-5 w-5 text-gray-900 fill-gray-900" />) : (<Circle className="h-5 w-5 text-gray-400 hover:text-gray-600" />)}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium truncate', task.completed ? 'text-gray-400 line-through' : 'text-gray-900')}>{task.name}</p>
                  {task.assignee && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={task.assignee.image || undefined} />
                        <AvatarFallback className="text-[8px] bg-blue-100 text-blue-700">{getInitials(task.assignee.name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-gray-500">{task.assignee.name}</span>
                    </div>
                  )}
                </div>
                {task.dueDate && (<span className={cn('text-xs flex-shrink-0 mt-0.5', isOverdue(task.dueDate) && !task.completed ? 'text-red-600' : 'text-gray-400')}>{formatDueDate(task.dueDate)}</span>)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
