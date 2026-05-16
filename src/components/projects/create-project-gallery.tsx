"use client";

/**
 * Project template gallery — Asana-style full-screen overlay shown when
 * the user clicks "+" next to Projects in the sidebar. Lists all the
 * pre-baked engineering / construction / operations templates so the
 * user can start with sensible sections instead of an empty kanban.
 *
 * Flow:
 *   1. User picks a template card → small confirm form asks for the
 *      project name (everything else uses the template defaults).
 *   2. POST /api/projects with the template's sections + type + gate.
 *   3. If the template ships with a workflowTemplateId, follow up with
 *      POST /api/projects/:id/workflow/templates to apply the rules.
 *   4. Navigate to the new project.
 *
 * The "Blank project" CTA at the top-right escapes to the legacy
 * full-form CreateProjectDialog for users who want to set every field
 * up front.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  X,
  Plus,
  Loader2,
  Building2,
  FileBadge,
  BadgeCheck,
  Map,
  ShieldCheck,
  Hammer,
  Wrench,
  HelpCircle,
  Inbox,
  FilePenLine,
  Briefcase,
  PackageCheck,
  Target,
  Users,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  PROJECT_TEMPLATES,
  CATEGORY_LABELS,
  FOR_YOU_TEMPLATE_IDS,
  findProjectTemplate,
  type ProjectTemplate,
  type ProjectTemplateCategory,
} from "@/lib/project-templates";

interface CreateProjectGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called by the "Blank project" CTA in the gallery header so the
   *  parent can swap to the legacy full-form dialog. */
  onOpenBlankForm: () => void;
  /** Optional callback fired after a template-driven create succeeds. */
  onProjectCreated?: () => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Building2,
  FileBadge,
  BadgeCheck,
  Map,
  ShieldCheck,
  Hammer,
  Wrench,
  HelpCircle,
  Inbox,
  FilePenLine,
  Briefcase,
  PackageCheck,
  Target,
  Users,
};

const ACCENT_BG: Record<ProjectTemplate["accent"], string> = {
  amber: "bg-[#fbeed3] text-[#7a5b1b]",
  blue: "bg-[#e1eefc] text-[#274a73]",
  violet: "bg-[#ece4f7] text-[#4f3a7a]",
  rose: "bg-[#fce4e4] text-[#a8323a]",
  emerald: "bg-[#dff1e6] text-[#1d6b3e]",
  slate: "bg-[#f1f3f5] text-[#3a3f47]",
};

type TabKey = "for_you" | ProjectTemplateCategory;

const TABS: { key: TabKey; label: string }[] = [
  { key: "for_you", label: CATEGORY_LABELS.for_you },
  { key: "engineering", label: CATEGORY_LABELS.engineering },
  { key: "construction", label: CATEGORY_LABELS.construction },
  { key: "operations", label: CATEGORY_LABELS.operations },
  { key: "productivity", label: CATEGORY_LABELS.productivity },
];

export function CreateProjectGallery({
  open,
  onOpenChange,
  onOpenBlankForm,
  onProjectCreated,
}: CreateProjectGalleryProps) {
  const [tab, setTab] = useState<TabKey>("for_you");
  const [pickedId, setPickedId] = useState<string | null>(null);

  // Reset to default tab on every fresh open
  useEffect(() => {
    if (open) {
      setTab("for_you");
      setPickedId(null);
    }
  }, [open]);

  const visibleTemplates = useMemo<ProjectTemplate[]>(() => {
    if (tab === "for_you") {
      return FOR_YOU_TEMPLATE_IDS.map(findProjectTemplate).filter(
        (t): t is ProjectTemplate => !!t
      );
    }
    return PROJECT_TEMPLATES.filter((t) => t.category === tab);
  }, [tab]);

  const picked: ProjectTemplate | null =
    (pickedId && findProjectTemplate(pickedId)) || null;

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
              onClick={() => toast.info("Import projects coming soon")}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-md"
            >
              <Sparkles className="w-3.5 h-3.5" />
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
        <div className="flex items-center gap-1.5 px-6 pt-3 pb-2 border-b flex-shrink-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "h-8 px-3 text-[13px] font-medium rounded-full border transition-colors",
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
            <p className="text-center text-[13px] text-gray-400 py-10">
              No templates in this category yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleTemplates.map((tpl) => {
                const Icon = ICON_MAP[tpl.icon] ?? Sparkles;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setPickedId(tpl.id)}
                    className="text-left rounded-xl border border-gray-200 bg-white hover:border-[#c9a84c] hover:shadow-md transition-all overflow-hidden flex flex-col"
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
                                const subCount = tpl.tasks.reduce(
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
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>

      {/* Confirm modal after picking a template */}
      <ConfirmTemplateDialog
        template={picked}
        onClose={() => setPickedId(null)}
        onCreated={() => {
          onProjectCreated?.();
          onOpenChange(false);
          setPickedId(null);
        }}
      />
    </Dialog>
  );
}

// ─── Confirm modal ────────────────────────────────────────────

function ConfirmTemplateDialog({
  template,
  onClose,
  onCreated,
}: {
  template: ProjectTemplate | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset name + state on every template change
  useEffect(() => {
    setName("");
    setSubmitting(false);
  }, [template?.id]);

  if (!template) return null;
  const Icon = ICON_MAP[template.icon] ?? Sparkles;

  async function handleCreate() {
    if (!template) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Project name is required");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          color: template.defaults.color ?? "#c9a84c",
          type: template.defaults.type,
          gate: template.defaults.gate,
          sections: template.sections,
          customFields: template.customFields,
          tasks: template.tasks,
          description: template.description,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const project = await res.json();

      // Apply the workflow template if the project template ships
      // with one. Failures here are non-fatal — the project still
      // exists, we just couldn't seed its rules.
      if (template.workflowTemplateId) {
        try {
          await fetch(
            `/api/projects/${project.id}/workflow/templates`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                templateId: template.workflowTemplateId,
              }),
            }
          );
        } catch {
          toast.warning(
            "Project created, but couldn't seed workflow rules. You can apply the template manually from the Workflow tab."
          );
        }
      }

      toast.success(`Project "${trimmed}" created`);
      onCreated();
      router.push(`/projects/${project.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create project"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!template} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[460px] p-0 overflow-hidden">
        <DialogTitle className="sr-only">Use template — {template.name}</DialogTitle>
        <div
          className={cn(
            "px-5 py-4 flex items-start gap-3 border-b",
            ACCENT_BG[template.accent]
          )}
        >
          <div className="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-semibold">{template.name}</h2>
            <p className="text-[12px] mt-0.5 opacity-80 line-clamp-2">
              {template.description}
            </p>
          </div>
        </div>

        <div className="px-5 py-4">
          <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
            Project name
          </label>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !submitting) handleCreate();
            }}
            placeholder="e.g., Brickell Mixed-Use Complex"
            className="w-full h-9 px-3 text-[13px] border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-black/10 placeholder:text-gray-400"
          />

          {/* Preview of the sections that will be created */}
          <div className="mt-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-1.5">
              Sections included
            </p>
            <div className="flex flex-wrap gap-1.5">
              {template.sections.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-[12px] text-gray-700"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {template.workflowTemplateId && (
            <p className="mt-3 text-[11px] text-[#a8893a]">
              Workflow rules from "{template.workflowTemplateId.replace(/-/g, " ")}"
              will be applied automatically.
            </p>
          )}
        </div>

        <div className="px-5 py-3 border-t flex items-center justify-end gap-2 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 text-[13px] font-medium text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={submitting || !name.trim()}
            className="h-8 px-4 text-[13px] font-medium text-white bg-black hover:bg-gray-800 rounded-md disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Creating…
              </>
            ) : (
              "Create project"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
