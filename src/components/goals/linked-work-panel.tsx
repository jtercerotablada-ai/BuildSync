"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Trash2,
  Folder,
  CheckSquare,
  Loader2,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RelatedWorkPicker } from "./related-work-picker";

interface ProjectConnection {
  id: string;
  type: "project";
  project: {
    id: string;
    name: string;
    color: string;
    status: string;
    progress: number;
    totalTasks: number;
    completedTasks: number;
  };
}

interface TaskConnection {
  id: string;
  type: "task";
  task: {
    id: string;
    name: string;
    completed: boolean;
    dueDate: string | null;
    project: {
      id: string;
      name: string;
      color: string;
    } | null;
  };
}

/**
 * Linked work panel — shows both PROJECTS and TASKS that are connected
 * to this objective, with link / unlink actions.
 *
 * Supersedes the previous LinkedProjectsPanel (which only handled
 * projects). The detail page had a separate "Related work" section
 * that listed projects in a different way — that's also folded in
 * here so there is exactly one place to see and edit linked work.
 *
 * Backend: /api/objectives/[id]/connections (GET / POST / DELETE).
 * The same endpoint already triggers GoalProgressService.recalculate
 * on mutation, so the displayed objective progress updates after a
 * link or unlink without manual intervention.
 */
export function LinkedWorkPanel({
  objectiveId,
  progressSource,
  onChanged,
}: {
  objectiveId: string;
  progressSource: string;
  onChanged?: () => void;
}) {
  const [projects, setProjects] = useState<ProjectConnection[]>([]);
  const [tasks, setTasks] = useState<TaskConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/objectives/${objectiveId}/connections`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        setTasks(data.tasks || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [objectiveId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function unlink(type: "project" | "task", connectionId: string) {
    setUnlinkingId(connectionId);
    try {
      const res = await fetch(
        `/api/objectives/${objectiveId}/connections?type=${type}&connectionId=${connectionId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(type === "project" ? "Project unlinked" : "Task unlinked");
      await refetch();
      onChanged?.();
    } catch {
      toast.error(`Couldn't unlink ${type}`);
    } finally {
      setUnlinkingId(null);
    }
  }

  const isEmpty = projects.length === 0 && tasks.length === 0;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">
          Related work
          {progressSource === "PROJECTS" && (
            <span className="ml-2 text-[10px] font-normal text-gray-500 uppercase tracking-wider">
              · auto-progress
            </span>
          )}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setLinkOpen(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Link project or task
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading linked work…
        </div>
      ) : isEmpty ? (
        <div className="border border-dashed rounded-lg p-6 text-center">
          <Folder className="h-6 w-6 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            No linked projects or tasks yet.
          </p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            Link projects to wire automatic progress tracking based on task
            completion, or link individual tasks to surface critical work.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setLinkOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Link work
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Projects block */}
          {projects.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Projects ({projects.length})
              </p>
              <div className="space-y-2">
                {projects.map((c) => (
                  <div
                    key={c.id}
                    className="group flex items-center gap-3 border rounded-lg px-3 py-2 bg-white hover:border-gray-400 transition-colors"
                  >
                    <div
                      className="w-2 h-8 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: c.project.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/projects/${c.project.id}`}
                        className="text-sm font-medium text-black hover:underline truncate block"
                      >
                        {c.project.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[200px]">
                          <div
                            className="h-full bg-[#c9a84c] transition-all"
                            style={{ width: `${c.project.progress}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-gray-500 tabular-nums">
                          {c.project.completedTasks}/{c.project.totalTasks} ·{" "}
                          {c.project.progress}%
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => unlink("project", c.id)}
                      disabled={unlinkingId === c.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-black disabled:opacity-50"
                      aria-label="Unlink project"
                    >
                      {unlinkingId === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tasks block */}
          {tasks.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Tasks ({tasks.length})
              </p>
              <div className="space-y-1.5">
                {tasks.map((c) => (
                  <div
                    key={c.id}
                    className="group flex items-center gap-3 border rounded-lg px-3 py-2 bg-white hover:border-gray-400 transition-colors"
                  >
                    <CheckSquare
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        c.task.completed
                          ? "text-[#c9a84c]"
                          : "text-gray-300"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium truncate",
                          c.task.completed
                            ? "text-gray-400 line-through"
                            : "text-black"
                        )}
                      >
                        {c.task.name}
                      </p>
                      {c.task.project && (
                        <Link
                          href={`/projects/${c.task.project.id}`}
                          className="text-[11px] text-gray-500 inline-flex items-center gap-1 hover:underline"
                        >
                          <Building2 className="h-3 w-3" />
                          {c.task.project.name}
                        </Link>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => unlink("task", c.id)}
                      disabled={unlinkingId === c.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-black disabled:opacity-50"
                      aria-label="Unlink task"
                    >
                      {unlinkingId === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <RelatedWorkPicker
        open={linkOpen}
        onOpenChange={setLinkOpen}
        objectiveId={objectiveId}
        excludeProjectIds={projects.map((p) => p.project.id)}
        excludeTaskIds={tasks.map((t) => t.task.id)}
        onLinked={async () => {
          await refetch();
          onChanged?.();
        }}
      />
    </div>
  );
}
