'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, X, Link, ArrowRight, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DependencyTask {
  id: string;
  name: string;
  completed: boolean;
}

interface Dependency {
  id: string;
  type: string;
  blockingTask: DependencyTask;
}

interface Dependent {
  id: string;
  type: string;
  dependentTask: DependencyTask;
}

interface DependencySelectorProps {
  taskId: string;
  dependencies: Dependency[];
  dependents: Dependent[];
  onAdd: (blockingTaskId: string) => Promise<void>;
  onRemove: (dependencyId: string) => Promise<void>;
}

interface SearchResult {
  id: string;
  name: string;
  project?: { id: string; name: string };
}

export function DependencySelector({
  taskId,
  dependencies,
  dependents,
  onAdd,
  onRemove,
}: DependencySelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const existingIds = useMemo(() => new Set([
    taskId,
    ...dependencies.map((d) => d.blockingTask.id),
    ...dependents.map((d) => d.dependentTask.id),
  ]), [taskId, dependencies, dependents]);

  const searchTasks = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setResults(
          (data.tasks || [])
            .filter((t: SearchResult) => !existingIds.has(t.id))
            .slice(0, 8)
        );
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [existingIds]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      searchTasks(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchTasks]);

  const handleAdd = async (blockingTaskId: string) => {
    try {
      await onAdd(blockingTaskId);
      setQuery('');
      setResults([]);
      setOpen(false);
    } catch {
      toast.error('Failed to add dependency');
    }
  };

  const totalDeps = dependencies.length + dependents.length;

  return (
    <div className="flex-1">
      {/* Existing dependencies display */}
      {(dependencies.length > 0 || dependents.length > 0) && (
        <div className="space-y-1 mb-1">
          {dependencies.map((dep) => (
            <div
              key={dep.id}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 group/dep text-sm"
            >
              <span className="text-gray-400 text-xs whitespace-nowrap">blocked by</span>
              <span
                className={cn(
                  'flex-1 truncate',
                  dep.blockingTask.completed
                    ? 'text-gray-400 line-through'
                    : 'text-gray-700'
                )}
              >
                {dep.blockingTask.name}
              </span>
              {dep.blockingTask.completed && (
                <Check className="h-3 w-3 text-[#a8893a] flex-shrink-0" />
              )}
              <button
                onClick={() => onRemove(dep.id)}
                className="p-0.5 hover:bg-gray-200 rounded opacity-0 group-hover/dep:opacity-100 transition-opacity flex-shrink-0"
              >
                <X className="h-3 w-3 text-gray-400" />
              </button>
            </div>
          ))}
          {dependents.map((dep) => (
            <div
              key={dep.id}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 group/dep text-sm"
            >
              <span className="text-gray-400 text-xs whitespace-nowrap">blocking</span>
              <span
                className={cn(
                  'flex-1 truncate',
                  dep.dependentTask.completed
                    ? 'text-gray-400 line-through'
                    : 'text-gray-700'
                )}
              >
                {dep.dependentTask.name}
              </span>
              <button
                onClick={() => onRemove(dep.id)}
                className="p-0.5 hover:bg-gray-200 rounded opacity-0 group-hover/dep:opacity-100 transition-opacity flex-shrink-0"
              >
                <X className="h-3 w-3 text-gray-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add dependency button with popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-2 py-1">
            <Link className="h-3.5 w-3.5" />
            {totalDeps === 0 ? 'Add dependency' : 'Add another'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks..."
                className="pl-9 h-9"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {loading ? (
              <div className="py-6 text-center text-sm text-gray-400">
                Searching...
              </div>
            ) : query.length < 2 ? (
              <div className="py-6 text-center text-sm text-gray-400">
                Type to search for tasks
              </div>
            ) : results.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">
                No tasks found
              </div>
            ) : (
              results.map((task) => (
                <button
                  key={task.id}
                  onClick={() => handleAdd(task.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded hover:bg-gray-100 transition-colors"
                >
                  <ArrowRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 truncate">
                    <span className="text-gray-900">{task.name}</span>
                    {task.project?.name && (
                      <span className="text-gray-400 ml-2 text-xs">
                        {task.project.name}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
