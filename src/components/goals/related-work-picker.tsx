"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Folder,
  CheckSquare,
  Search,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AvailableProject {
  id: string;
  name: string;
  color: string;
  type?: string | null;
  gate?: string | null;
}

interface AvailableTask {
  id: string;
  name: string;
  completed: boolean;
  dueDate?: string | null;
  project?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

type Tab = "project" | "task";

/**
 * Unified "Link related work" dialog. Replaces the previous dead
 * dropdown that just navigated to /projects or /portfolios. Lets the
 * user link a Project or a Task to the current Objective, with
 * autocomplete search and a clear "linked" / "not linked" state.
 *
 * Connections go through POST /api/objectives/:id/connections which
 * already handles both project + task and triggers progress recalc.
 */
export function RelatedWorkPicker({
  open,
  onOpenChange,
  objectiveId,
  excludeProjectIds,
  excludeTaskIds,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectiveId: string;
  excludeProjectIds: string[];
  excludeTaskIds: string[];
  onLinked: () => void;
}) {
  const [tab, setTab] = useState<Tab>("project");
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<AvailableProject[]>([]);
  const [tasks, setTasks] = useState<AvailableTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setLoading(true);
    Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/tasks").then((r) => r.json()),
    ])
      .then(([projData, taskData]) => {
        setProjects(
          Array.isArray(projData) ? projData : projData?.projects || []
        );
        setTasks(Array.isArray(taskData) ? taskData : taskData?.tasks || []);
      })
      .catch(() => {
        setProjects([]);
        setTasks([]);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const filteredProjects = projects
    .filter((p) => !excludeProjectIds.includes(p.id))
    .filter((p) =>
      search.trim()
        ? p.name.toLowerCase().includes(search.trim().toLowerCase())
        : true
    );

  const filteredTasks = tasks
    .filter((t) => !excludeTaskIds.includes(t.id))
    .filter((t) =>
      search.trim()
        ? t.name.toLowerCase().includes(search.trim().toLowerCase())
        : true
    );

  async function link(type: "project" | "task", id: string) {
    setLinkingId(id);
    try {
      const body =
        type === "project" ? { type, projectId: id } : { type, taskId: id };
      const res = await fetch(`/api/objectives/${objectiveId}/connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.success(type === "project" ? "Project linked" : "Task linked");
      onLinked();
      onOpenChange(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't link " + type
      );
    } finally {
      setLinkingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Link related work</DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 border-b -mx-6 px-6">
          {(
            [
              { id: "project" as Tab, icon: Folder, label: "Project" },
              { id: "task" as Tab, icon: CheckSquare, label: "Task" },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
                  tab === t.id
                    ? "border-black text-black font-medium"
                    : "border-transparent text-gray-500 hover:text-black"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder={
              tab === "project" ? "Search projects…" : "Search tasks…"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="pl-8"
          />
        </div>

        <div className="max-h-[320px] overflow-y-auto -mx-6 px-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </div>
          ) : tab === "project" ? (
            filteredProjects.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                {search
                  ? "No projects match this search."
                  : "No projects available to link."}
              </p>
            ) : (
              <ul className="divide-y">
                {filteredProjects.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={linkingId === p.id}
                      onClick={() => link("project", p.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-2 py-2 text-left hover:bg-gray-50 transition-colors rounded",
                        linkingId === p.id && "opacity-50"
                      )}
                    >
                      <div
                        className="w-2 h-6 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-black truncate">
                          {p.name}
                        </p>
                        {(p.type || p.gate) && (
                          <p className="text-[11px] text-gray-500 uppercase tracking-wider">
                            {[p.type, p.gate].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      {linkingId === p.id && (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : filteredTasks.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">
              {search
                ? "No tasks match this search."
                : "No tasks available to link."}
            </p>
          ) : (
            <ul className="divide-y">
              {filteredTasks.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={linkingId === t.id}
                    onClick={() => link("task", t.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-2 py-2 text-left hover:bg-gray-50 transition-colors rounded",
                      linkingId === t.id && "opacity-50"
                    )}
                  >
                    <CheckSquare
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        t.completed ? "text-[#c9a84c]" : "text-gray-300"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium truncate",
                          t.completed
                            ? "text-gray-400 line-through"
                            : "text-black"
                        )}
                      >
                        {t.name}
                      </p>
                      {t.project && (
                        <p className="text-[11px] text-gray-500 truncate inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {t.project.name}
                        </p>
                      )}
                    </div>
                    {linkingId === t.id && (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
