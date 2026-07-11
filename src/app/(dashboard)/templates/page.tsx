"use client";

/**
 * Full-page "Workflow gallery" (/templates).
 *
 * This is the full-screen mirror of the create-project modal
 * (create-project-gallery.tsx): it renders the SAME built-in engineering
 * template library PLUS the workspace's custom templates ("Created by your
 * team"), and every pick funnels through the SAME shared ConfirmTemplateDialog
 * → POST /api/projects. Reached from "Explore all templates" and (with
 * ?new=1) "New template" across the app.
 *
 * There is intentionally no separate marketing template set anymore — one
 * library, two entry points, exactly like Asana.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Sparkles,
  Download,
  Plus,
  Trash2,
  FilePlus2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  type CustomProjectTemplate,
  type CustomTemplateRow,
} from "@/lib/custom-templates";
import { ACCENT_BG, resolveTemplateIcon } from "@/components/projects/template-visuals";
import { ConfirmTemplateDialog } from "@/components/projects/confirm-template-dialog";
import { NewTemplateDialog } from "@/components/projects/new-template-dialog";

type TabKey = "for_you" | ProjectTemplateCategory | "custom";

const TABS: { key: TabKey; label: string }[] = [
  { key: "for_you", label: CATEGORY_LABELS.for_you },
  { key: "engineering", label: CATEGORY_LABELS.engineering },
  { key: "construction", label: CATEGORY_LABELS.construction },
  { key: "operations", label: CATEGORY_LABELS.operations },
  { key: "productivity", label: CATEGORY_LABELS.productivity },
  { key: "custom", label: "Created by your team" },
];

const TAB_BLURB: Record<TabKey, string> = {
  for_you: "your team",
  engineering: "engineering teams",
  construction: "construction teams",
  operations: "operations teams",
  productivity: "everyday work",
  custom: "your organization",
};

export default function TemplatesGalleryPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>("for_you");
  const [custom, setCustom] = useState<CustomProjectTemplate[]>([]);
  const [picked, setPicked] = useState<ProjectTemplate | null>(null);
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCustom = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace/templates");
      if (!res.ok) return;
      const rows = (await res.json()) as CustomTemplateRow[];
      setCustom(rows.map(customRowToProjectTemplate));
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    loadCustom();
  }, [loadCustom]);

  // "New template" links route here with ?new=1 to auto-open the dialog.
  // Read from window (client-only) instead of useSearchParams so the whole
  // full-screen overlay doesn't need a Suspense boundary — wrapping it in
  // one made React's streaming render the overlay twice.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("new") === "1") {
        setNewTemplateOpen(true);
        // Strip the param so a refresh / browser Back doesn't reopen it
        // (mirrors team/page.tsx's ?invite=true handling).
        router.replace("/templates", { scroll: false });
      }
    }
  }, [router]);

  const currentTemplates = useMemo<ProjectTemplate[]>(() => {
    if (activeTab === "custom") return custom;
    if (activeTab === "for_you") {
      return FOR_YOU_TEMPLATE_IDS.map(findProjectTemplate).filter(
        (t): t is ProjectTemplate => !!t
      );
    }
    return PROJECT_TEMPLATES.filter((t) => t.category === activeTab);
  }, [activeTab, custom]);

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
    <div className="fixed inset-0 bg-white z-50 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b z-40">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Workflow gallery</h1>
            <Badge variant="secondary" className="bg-gray-200 text-black">
              New
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setNewTemplateOpen(true)}
            >
              <FilePlus2 className="h-4 w-4" />
              New template
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => router.push("/projects/new?ai=true")}
            >
              <Sparkles className="h-4 w-4" />
              Create with AI
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => router.push("/projects/new")}
            >
              <Download className="h-4 w-4" />
              Import
            </Button>
            <Button
              size="sm"
              className="gap-2 bg-black hover:bg-black"
              onClick={() => router.push("/projects/new")}
            >
              <Plus className="h-4 w-4" />
              Blank project
            </Button>
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 px-6 pb-4 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0",
                activeTab === tab.key
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8 max-w-7xl mx-auto">
        {/* Category Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold">
            {activeTab === "custom"
              ? "Templates created by your organization"
              : `Discover workflows designed for ${TAB_BLURB[activeTab]}`}
          </h2>
          <p className="text-gray-600 mt-1">
            {activeTab === "custom"
              ? "Reusable setups your team saved — pick one to start a new project."
              : "Help your team track, plan, and deliver high-impact work."}
          </p>
        </div>

        {/* Templates Grid */}
        {currentTemplates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentTemplates.map((template) => {
              const Icon = resolveTemplateIcon(template.icon);
              const isCustom = "custom" in template;
              const c = template as CustomProjectTemplate;
              const subCount =
                template.tasks?.reduce(
                  (acc, t) => acc + (t.subtasks?.length ?? 0),
                  0
                ) ?? 0;
              return (
                <div
                  key={template.id}
                  className="group relative rounded-2xl border border-gray-200 bg-white hover:border-[#c9a84c] hover:shadow-lg transition-all overflow-hidden flex flex-col"
                >
                  {isCustom && c.mine && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          window.confirm(
                            `Delete the "${template.name}" template? This can't be undone.`
                          )
                        )
                          handleDeleteCustom(template.id);
                      }}
                      disabled={deletingId === template.id}
                      className="absolute top-3 right-3 z-10 w-8 h-8 rounded-md bg-white/90 border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
                      aria-label="Delete template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPicked(template)}
                    className="text-left flex flex-col flex-1"
                  >
                    <div
                      className={cn(
                        "px-6 py-8 flex items-center gap-3",
                        ACCENT_BG[template.accent]
                      )}
                    >
                      <div className="w-12 h-12 rounded-xl bg-white/60 flex items-center justify-center">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="h-2 w-3/4 rounded-full bg-white/60" />
                        <div className="h-2 w-1/2 rounded-full bg-white/40" />
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-semibold text-lg text-gray-900 leading-tight">
                        {template.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-2 line-clamp-3 leading-relaxed">
                        {template.description}
                      </p>
                      <div className="mt-4 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                        <span>
                          <span className="font-medium tabular-nums text-gray-700">
                            {template.sections.length}
                          </span>{" "}
                          section{template.sections.length === 1 ? "" : "s"}
                        </span>
                        {template.tasks && template.tasks.length > 0 && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>
                              <span className="font-medium tabular-nums text-gray-700">
                                {template.tasks.length}
                              </span>{" "}
                              task{template.tasks.length === 1 ? "" : "s"}
                              {subCount > 0 ? ` + ${subCount} subtasks` : ""}
                            </span>
                          </>
                        )}
                        {template.workflowTemplateId && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="text-[#a8893a] font-medium">
                              + workflow
                            </span>
                          </>
                        )}
                      </div>
                      {isCustom && (
                        <p className="mt-3 text-xs text-gray-400">
                          Created by {c.creator?.name || "your team"}
                        </p>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <FilePlus2 className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              {activeTab === "custom"
                ? "No custom templates yet"
                : "No templates in this category yet"}
            </h3>
            <p className="text-gray-500 mt-1">
              {activeTab === "custom"
                ? "Create one to reuse your team's setup across projects."
                : "Try another category, or create your own template."}
            </p>
            <Button
              className="mt-5 gap-2 bg-black hover:bg-gray-900"
              onClick={() => setNewTemplateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              New template
            </Button>
          </div>
        )}
      </div>

      {/* Pick → name → create (shared with the modal gallery) */}
      <ConfirmTemplateDialog
        template={picked}
        onClose={() => setPicked(null)}
        onCreated={() => setPicked(null)}
      />

      {/* New custom template */}
      <NewTemplateDialog
        open={newTemplateOpen}
        onOpenChange={setNewTemplateOpen}
        onCreated={() => {
          loadCustom();
          setActiveTab("custom");
        }}
      />
    </div>
  );
}
