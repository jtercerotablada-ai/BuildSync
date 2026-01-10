'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';

interface AssignedTask {
  id: string;
  name: string;
  completed: boolean;
  dueDate: string | null;
  assignee: {
    name: string;
    image: string | null;
  } | null;
}

type TabType = 'upcoming' | 'overdue' | 'completed';

export function AssignedTasksWidget() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAssignedTasks() {
      try {
        const res = await fetch(`/api/tasks?assigned_by_me=true&filter=${activeTab}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setTasks(data);
        }
      } catch (error) {
        console.error('Failed to fetch assigned tasks:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchAssignedTasks();
  }, [activeTab]);

  const formatDate = (date: string | null) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-3 flex-shrink-0 mb-3">
          <TabsTrigger value="upcoming" className="text-xs">Upcoming</TabsTrigger>
          <TabsTrigger value="overdue" className="text-xs">Overdue</TabsTrigger>
          <TabsTrigger value="completed" className="text-xs">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="flex-1 overflow-hidden mt-0">
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full border-2 border-gray-200 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-gray-300" />
              </div>
              <p className="text-gray-500 text-sm mb-3">
                Assign tasks to your teammates and track them here.
              </p>
              <Button variant="outline" size="sm">
                Assign task
              </Button>
            </div>
          ) : (
            <div className="space-y-1 overflow-y-auto h-full">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  onClick={() => router.push(`/tasks/${task.id}`)}
                >
                  <Checkbox checked={task.completed} className="rounded-full" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{task.name}</p>
                    {task.assignee && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={task.assignee.image || undefined} />
                          <AvatarFallback className="text-[8px]">
                            {task.assignee.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {task.assignee.name}
                      </p>
                    )}
                  </div>
                  {task.dueDate && (
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {formatDate(task.dueDate)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
