"use client";

/**
 * Project template gallery — Asana-style full-screen overlay shown when
 * the user clicks "+" next to Projects in the sidebar. Lists the pre-baked
 * engineering / construction / operations templates PLUS the workspace's
 * own custom templates ("Created by your team") so the user can start with
 * sensible sections instead of an empty kanban.
 *
 * Flow:
 *   1. User picks a template card (built-in OR custom) → the shared
 *      ConfirmTemplateDialog asks for the project name.
 *   2. It creates the project inline via POST /api/projects and applies
 *      the workflow template when present, then navigates to it.
 *
 * "New template" opens NewTemplateDialog, which persists a reusable custom
 * template that then shows up here and in the /templates page — the same
 * connection Asana has between creating a template and starting a project.
 *
 * The "Blank project" CTA escapes to the legacy full-form CreateProjectDialog.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { X, Plus, Download, Trash2, FilePlus2 } from "lucide-react";
import {
  PROJECT_TEMPLATES,
  CATEGORY_LABELS,
  FOR_YOU_TEMPLATE_IDS,
  findProjectTemplate,
  type ProjectTemplate,
  type ProjectTemplateCategory,
} from "@/lib/project-templates";
import {
  customRowToProjectTemplate,
  customIdToDbId,
  isCustomTemplateId,
  type CustomProjectTemplate,
  type CustomTemplateRow,
} from "@/lib/custom-templates";
import { ACCENT_BG, resolveTemplateIcon } from "./template-visuals";
import { ConfirmTemplateDialog } from "./confirm-template-dialog";
import { NewTemplateDialog } from "./new-template-dialog";

interface CreateProjectGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called by the "Blank project" CTA so the parent can swap to the
   *  legacy full-form dialog. */
  onOpenBlankForm: () => void;
  /** Optional callback fired after a template-driven create succeeds. */
  onProjectCreated?: () => void;
}

type TabKey = "for_you" | ProjectTemplateCategory | "custom";

const TABS: { key: TabKey; label: string }[] = [
  { key: "for_you", label: CATEGORY_LABELS.for_you },
  { key: "engineering", label: CATEGORY_LABELS.engineering },
  { key: "construction", label: CATEGORY_LABELS.construction },
  { key: "operations", label: CATEGORY_LABELS.operations },
  { key: "productivity", label: CATEGORY_LABELS.productivity },
  { key: "custom", label: "Created by your team" },
];

export function CreateProjectGallery({
  open,
  onOpenChange,
  onOpenBlankForm,
  onProjectCreated,
}: CreateProjectGalleryProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("for_you");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [custom, setCustom] = useState<CustomProjectTemplate[]>([]);
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCustom = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace/templates");
      if (!res.ok) return;
      const rows = (await res.json()) as CustomTemplateRow[];
      setCustom(rows.map(customRowToProjectTemplate));
    } catch {
      /* non-fatal — built-ins still render */
    }
  }, []);

  // Reset to default tab + refresh custom templates on every fresh open
  useEffect(() => {
    if (open) {
      setTab("for_you");
      setPickedId(null);
      loadCustom();
    }
  }, [open, loadCustom]);

  const visibleTemplates = useMemo<ProjectTemplate[]>(() => {
    if (tab === "custom") return custom;
    if (tab === "for_you") {
      return FOR_YOU_TEMPLATE_IDS.map(findProjectTemplate).filter(
        (t): t is ProjectTemplate => !!t
      );
    }
    return PROJECT_TEMPLATES.filter((t) => t.category === tab);
  }, [tab, custom]);

  const picked: ProjectTemplate | null =
    (pickedId &&
      (isCustomTemplateId(pickedId)
        ? custom.find((c) => c.id === pickedId) ?? null
        : findProjectTemplate(pickedId) ?? null)) ||
    null;

  async function handleDeleteCustom(id: string) {
    const dbId = customIdToDbId(id);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/workspace/templates?id=${dbId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete template");
      }
      toast.success("Template deleted");
      setCustom((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-[1100px] w-[96vw] !p-0 overflow-hidden h-[90vh] flex flex-col"
      >
        <DialogTitle className="sr-only">Workflow gallery</DialogTitle>

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0">
          <h2 className="text-[18px] font-semibold text-gray-900">
            Workflow gallery
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setNewTemplateOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-md"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              New template
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                router.push("/projects/new");
              }}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-md"
            >
              <Download className="w-3.5 h-3.5" />
              Import
            </button>
            <button
              type="button"
              onClick={onOpenBlankForm}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium text-white bg-black hover:bg-gray-800 rounded-md"
            >
              <Plus className="w-3.5 h-3.5" />
              Blank project
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="ml-1 flex items-center justify-center w-8 h-8 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 px-6 pt-3 pb-2 border-b flex-shrink-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "h-8 px-3 text-[13px] font-medium rounded-full border transition-colors whitespace-nowrap flex-shrink-0",
                tab === t.key
                  ? "bg-gray-100 text-gray-900 border-gray-200"
                  : "bg-white text-gray-600 border-transparent hover:bg-gray-50"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Cards grid ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {visibleTemplates.length === 0 ? (
            tab === "custom" ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                  <FilePlus2 className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-[14px] font-medium text-gray-900">
                  No custom templates yet
                </p>
                <p className="text-[13px] text-gray-500 mt-1">
                  {"Create one to reuse your team's setup across projects."}
                </p>
                <button
                  type="button"
                  onClick={() => setNewTemplateOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium text-white bg-black hover:bg-gray-800 rounded-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New template
                </button>
              </div>
            ) : (
              <p className="text-center text-[13px] text-gray-400 py-10">
                No templates in this category yet.
              </p>
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleTemplates.map((tpl) => {
                const Icon = resolveTemplateIcon(tpl.icon);
                const isCustom = "custom" in tpl;
                const c = tpl as CustomProjectTemplate;
                return (
                  <div
                    key={tpl.id}
                    className="group relative text-left rounded-xl border border-gray-200 bg-white hover:border-[#c9a84c] hover:shadow-md transition-all overflow-hidden flex flex-col"
                  >
                    {isCustom && c.mine && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              `Delete the "${tpl.name}" template? This can't be undone.`
                            )
                          )
                            handleDeleteCustom(tpl.id);
                        }}
                        disabled={deletingId === tpl.id}
                        className="absolute top-2 right-2 z-10 w-7 h-7 rounded-md bg-white/90 border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
                        aria-label="Delete template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPickedId(tpl.id)}
                      className="text-left flex flex-col flex-1"
                    >
                      {/* Thumbnail-like header with the accent background */}
                      <div
                        className={cn(
                          "px-4 py-5 flex items-center gap-2",
                          ACCENT_BG[tpl.accent]
                        )}
                      >
                        <div className="w-9 h-9 rounded-lg bg-white/60 flex items-center justify-center">
                          <Icon className="w-[18px] h-[18px]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="space-y-1.5">
                            <div className="h-1.5 w-3/4 rounded-full bg-white/60" />
                            <div className="h-1.5 w-1/2 rounded-full bg-white/40" />
                          </div>
                        </div>
                      </div>
                      {/* Body */}
                      <div className="p-4 flex-1 flex flex-col">
                        <h3 className="text-[14px] font-semibold text-gray-900 mb-1">
                          {tpl.name}
                        </h3>
                        <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-3">
                          {tpl.description}
                        </p>
                        <div className="mt-3 flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
                          <span>
                            <span className="font-medium tabular-nums text-gray-700">
                              {tpl.sections.length}
                            </span>{" "}
                            section{tpl.sections.length === 1 ? "" : "s"}
                          </span>
                          {tpl.tasks && tpl.tasks.length > 0 && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span>
                                <span className="font-medium tabular-nums text-gray-700">
                                  {tpl.tasks.length}
                                </span>{" "}
                                task{tpl.tasks.length === 1 ? "" : "s"}
                                {(() => {
                                  const subCount = tpl.tasks!.reduce(
                                    (acc, t) => acc + (t.subtasks?.length ?? 0),
                                    0
                                  );
                                  if (subCount === 0) return null;
                                  return ` + ${subCount} subtasks`;
                                })()}
                              </span>
                            </>
                          )}
                          {tpl.workflowTemplateId && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="text-[#a8893a] font-medium">
                                + workflow
                              </span>
                            </>
                          )}
                        </div>
                        {isCustom && (
                          <p className="mt-2 text-[11px] text-gray-400">
                            Created by {c.creator?.name || "your team"}
                          </p>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>

      {/* Confirm modal after picking a template (built-in OR custom) */}
      <ConfirmTemplateDialog
        template={picked}
        onClose={() => setPickedId(null)}
        onCreated={() => {
          onProjectCreated?.();
          onOpenChange(false);
          setPickedId(null);
        }}
      />

      {/* New custom template */}
      <NewTemplateDialog
        open={newTemplateOpen}
        onOpenChange={setNewTemplateOpen}
        onCreated={() => {
          loadCustom();
          setTab("custom");
        }}
      />
    </Dialog>
  );
}
