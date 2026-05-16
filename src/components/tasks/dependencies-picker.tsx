"use client";

/**
 * Picker for "Blocked by" task dependencies (Asana parity).
 *
 * Renders a popover with a search input + a list of selectable tasks.
 * Clicking a task POSTs to /api/tasks/:id/dependencies which:
 *   - validates auth/access
 *   - blocks self-deps
 *   - detects circular chains
 *   - dedupes existing pairs
 *
 * The trigger element is passed in, so the panel can render either an
 * "Add dependencies" link (empty state) or a "+ add more" button next
 * to existing dependency chips.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Check, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PickableTask {
  id: string;
  name: string;
  completed: boolean;
  startDate?: string | null;
  dueDate?: string | null;
  project?: { id: string; name: string; color: string } | null;
}

interface DependenciesPickerProps {
  /** The task we are adding a "blocked by" dependency to. */
  taskId: string;
  /** Task ids already in the dependency list — excluded from picker. */
  existingBlockingTaskIds: string[];
  /** Called after the dependency is successfully created on the server. */
  onAdded: () => void;
  /** Element that opens the popover. */
  trigger: React.ReactNode;
}

export function DependenciesPicker({
  taskId,
  existingBlockingTaskIds,
  onAdded,
  trigger,
}: DependenciesPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tasks, setTasks] = useState<PickableTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch once when opened — workspace task list is small enough that
  // client-side filtering on the search input feels instant.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/tasks")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PickableTask[]) => {
        setTasks(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        toast.error("Couldn't load tasks");
      })
      .finally(() => setLoading(false));
    // Focus the search input on open
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const excluded = useMemo(
    () => new Set([...existingBlockingTaskIds, taskId]),
    [existingBlockingTaskIds, taskId]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks
      .filter((t) => !excluded.has(t.id))
      .filter((t) => !q || t.name.toLowerCase().includes(q))
      .slice(0, 50);
  }, [tasks, search, excluded]);

  async function handlePick(blocking: PickableTask) {
    if (submitting) return;
    setSubmitting(blocking.id);
    try {
      const res = await fetch(`/api/tasks/${taskId}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockingTaskId: blocking.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.success(`Now blocked by "${blocking.name}"`);
      onAdded();
      setOpen(false);
      setSearch("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't add dependency"
      );
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[360px] p-0 rounded-xl border border-gray-200 shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden"
      >
        <div className="relative border-b border-gray-100">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a task"
            className="w-full h-10 pl-9 pr-3 text-[13px] outline-none placeholder:text-gray-400 bg-white"
          />
        </div>

        <div className="max-h-[280px] overflow-y-auto py-1">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-[12px] text-gray-400">
              {tasks.length === 0
                ? "No tasks in this workspace yet"
                : "No matching tasks"}
            </p>
          )}
          {!loading &&
            filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => handlePick(t)}
                disabled={submitting !== null}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors",
                  submitting === t.id
                    ? "bg-[#f3f4f6]"
                    : "hover:bg-[#f3f4f6]"
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0",
                    t.completed
                      ? "bg-[#c9a84c] border-[#c9a84c]"
                      : "border-[#c4c7cf]"
                  )}
                >
                  {t.completed && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span
                  className={cn(
                    "flex-1 min-w-0 truncate",
                    t.completed ? "text-[#9aa0a6] line-through" : "text-[#1e1f21]"
                  )}
                >
                  {t.name}
                </span>
                {t.project && (
                  <span className="text-[11px] text-[#6f7782] truncate max-w-[140px] flex-shrink-0">
                    {t.project.name}
                  </span>
                )}
                {submitting === t.id && (
                  <Loader2 className="w-3 h-3 animate-spin text-gray-400 flex-shrink-0" />
                )}
              </button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
