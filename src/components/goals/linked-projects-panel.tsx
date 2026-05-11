"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Folder, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

interface AvailableProject {
  id: string;
  name: string;
  color: string;
  type?: string | null;
  gate?: string | null;
}

/**
 * Linked projects panel for the Goal detail page.
 *
 * Lists the projects currently driving auto-progress on this goal, with
 * a mini progress bar per project. Lets the owner link a new project
 * (autocomplete against /api/projects) or unlink an existing one.
 *
 * Both mutations call /api/objectives/[id]/connections which already
 * triggers GoalProgressService.recalculateProgress() on the backend —
 * so the UI just refetches on success.
 */
export function LinkedProjectsPanel({
  objectiveId,
  progressSource,
  onChanged,
}: {
  objectiveId: string;
  progressSource: string;
  onChanged?: () => void;
}) {
  const [connections, setConnections] = useState<ProjectConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);

  async function refetch() {
    setLoading(true);
    try {
      const res = await fetch(`/api/objectives/${objectiveId}/connections`);
      if (res.ok) {
        const data = await res.json();
        setConnections(data.projects || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectiveId]);

  async function unlink(connectionId: string) {
    try {
      const res = await fetch(
        `/api/objectives/${objectiveId}/connections?type=project&connectionId=${connectionId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Project unlinked");
      await refetch();
      onChanged?.();
    } catch {
      toast.error("Couldn't unlink project");
    }
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">
          Projects driving this goal
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
          Link project
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading projects…
        </div>
      ) : connections.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center">
          <Folder className="h-6 w-6 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            No projects linked yet.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Link projects to wire automatic progress tracking based on task
            completion.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((c) => (
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
                onClick={() => unlink(c.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-black"
                aria-label="Unlink project"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <LinkProjectDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        objectiveId={objectiveId}
        excludeIds={connections.map((c) => c.project.id)}
        onLinked={async () => {
          await refetch();
          onChanged?.();
        }}
      />
    </div>
  );
}

function LinkProjectDialog({
  open,
  onOpenChange,
  objectiveId,
  excludeIds,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectiveId: string;
  excludeIds: string[];
  onLinked: () => void;
}) {
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<AvailableProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.projects || [];
        setProjects(list);
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = projects
    .filter((p) => !excludeIds.includes(p.id))
    .filter((p) =>
      search.trim()
        ? p.name.toLowerCase().includes(search.trim().toLowerCase())
        : true
    );

  async function link(projectId: string) {
    setLinkingId(projectId);
    try {
      const res = await fetch(`/api/objectives/${objectiveId}/connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "project", projectId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.success("Project linked");
      onLinked();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't link project");
    } finally {
      setLinkingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Link a project</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search projects…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 p-4">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 p-4 text-center">
              {search ? "No projects match" : "No projects available"}
            </p>
          ) : (
            <ul className="divide-y">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={linkingId === p.id}
                    onClick={() => link(p.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-2 py-2 text-left hover:bg-gray-50 transition-colors",
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
