"use client";

/**
 * Workflow side panel surfaced from /my-tasks topbar.
 *
 * Rules and custom fields live on individual projects — they can't be
 * configured at the cross-project /my-tasks level. So this panel is a
 * project picker that jumps the user straight into the per-project
 * Workflow view (or List view, where Custom Fields show up as columns
 * and in the task detail panel).
 *
 * Previously every item here was a "coming soon" toast; the per-project
 * workflow + custom-fields features now exist for real, so we route
 * users to them instead of stalling them.
 */

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Search,
  Loader2,
  Zap,
  CircleDot,
  FolderKanban,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowPanelProps {
  open: boolean;
  onClose: () => void;
}

interface ProjectListItem {
  id: string;
  name: string;
  color: string | null;
  _count?: {
    tasks?: number;
    sections?: number;
  };
}

export function WorkflowPanel({ open, onClose }: WorkflowPanelProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // ESC to close
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Lazy-load the project list when the panel first opens.
  useEffect(() => {
    if (!open || projects !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: ProjectListItem[] = await res.json();
        if (!cancelled) setProjects(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Couldn't load projects"
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projects]);

  const filtered = useMemo(() => {
    if (!projects) return null;
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  function goToProject(projectId: string, view: "workflow" | "list") {
    onClose();
    router.push(`/projects/${projectId}?view=${view}`);
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        "absolute top-0 right-0 bottom-0 w-[380px] bg-white border-l border-gray-200 flex flex-col overflow-hidden z-30 shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.08)]",
        "transition-transform duration-200 ease-out",
        open ? "translate-x-0" : "translate-x-full pointer-events-none"
      )}
      aria-hidden={!open}
    >
      {open && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <h2 className="text-[18px] font-semibold text-gray-900">
              Workflow
            </h2>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <ChevronRight className="w-[18px] h-[18px]" />
            </button>
          </div>

          <div className="px-5 pb-3">
            <p className="text-[12px] text-gray-500 leading-relaxed">
              Rules and custom fields are configured per project. Pick a
              project to manage its workflow, or jump into its list to add
              fields and apply a template.
            </p>
          </div>

          {/* Feature shortcuts — read-only legend so the user knows
              what each per-project tool actually does. */}
          <div className="px-5 pb-3 grid grid-cols-2 gap-2">
            <div className="rounded-md border border-gray-200 p-2.5">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-700">
                <Zap className="w-3.5 h-3.5 text-[#a8893a]" />
                Rules
              </div>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                Auto-actions when a task moves into a section or
                completes.
              </p>
            </div>
            <div className="rounded-md border border-gray-200 p-2.5">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-700">
                <CircleDot className="w-3.5 h-3.5 text-[#a8893a]" />
                Fields
              </div>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                Custom data on tasks — text, number, date, dropdown,
                checkbox, more.
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="px-5 pb-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a project"
                className="w-full h-9 pl-8 pr-3 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-black/10 placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Projects list */}
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {!projects && !loadError && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            )}
            {loadError && (
              <p className="text-[12px] text-red-600 px-3 py-4 text-center">
                {loadError}
              </p>
            )}
            {filtered && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <FolderKanban className="w-6 h-6 text-gray-300 mb-2" />
                <p className="text-[13px] text-gray-500">
                  {search.trim()
                    ? "No matching projects"
                    : "You don't have any projects yet"}
                </p>
              </div>
            )}
            {filtered &&
              filtered.map((p) => (
                <div
                  key={p.id}
                  className="group flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#f3f4f6] transition-colors"
                >
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: p.color ?? "#c9a84c" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-900 truncate">
                      {p.name}
                    </p>
                    <p className="text-[11px] text-gray-500 tabular-nums">
                      {p._count?.tasks ?? 0} task
                      {(p._count?.tasks ?? 0) === 1 ? "" : "s"}
                      {" · "}
                      {p._count?.sections ?? 0} section
                      {(p._count?.sections ?? 0) === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => goToProject(p.id, "workflow")}
                      className="text-[11px] font-medium text-[#a8893a] hover:underline px-1.5 py-0.5 rounded"
                      title="Open workflow rules"
                    >
                      Rules
                    </button>
                    <span className="text-gray-300">·</span>
                    <button
                      type="button"
                      onClick={() => goToProject(p.id, "list")}
                      className="text-[11px] font-medium text-[#a8893a] hover:underline px-1.5 py-0.5 rounded"
                      title="Open list (fields & data)"
                    >
                      Fields
                    </button>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-400" />
                </div>
              ))}
          </div>

          <div className="border-t border-gray-200 px-5 py-3">
            <p className="text-[11px] text-gray-400 leading-snug">
              Tip: 10 engineering templates (calc review, RFI cycle,
              permit submittal, QC gate…) live inside each project's
              Workflow view. One click sets up the whole handoff.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
