"use client";

/**
 * Workflow templates gallery — engineering-specific rule bundles the
 * user can apply in one click to a project's workflow. The dialog
 * fetches the static catalog from `/api/projects/:id/workflow/templates`
 * (GET) and applies a pick via POST to the same endpoint.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  ClipboardCheck,
  FileBadge,
  Inbox,
  HelpCircle,
  FilePenLine,
  Search,
  Briefcase,
  PackageCheck,
  BadgeCheck,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  sections: string[];
  ruleCount: number;
}

interface WorkflowTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Fired after a template is successfully applied so the parent
   *  can refetch the workflow. Receives summary metadata. */
  onApplied: (summary: {
    templateId: string;
    templateName: string;
    createdRules: number;
    createdSections: number;
    skipped: string[];
  }) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  ClipboardCheck,
  FileBadge,
  Inbox,
  HelpCircle,
  FilePenLine,
  Search,
  Briefcase,
  PackageCheck,
  BadgeCheck,
  ShieldCheck,
};

function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Sparkles;
}

export function WorkflowTemplatesDialog({
  open,
  onOpenChange,
  projectId,
  onApplied,
}: WorkflowTemplatesDialogProps) {
  const [templates, setTemplates] = useState<TemplateInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // Lazy-load the catalog the first time the dialog opens. Cached for
  // the component lifetime; if the dialog closes/reopens we keep the
  // existing list.
  useEffect(() => {
    if (!open || templates !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/workflow/templates`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: TemplateInfo[] = await res.json();
        if (!cancelled) setTemplates(data);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Couldn't load templates"
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, templates, projectId]);

  async function handleApply(template: TemplateInfo) {
    setApplyingId(template.id);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/workflow/templates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId: template.id }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const summary = await res.json();
      onApplied({
        templateId: summary.templateId,
        templateName: summary.templateName,
        createdRules: summary.createdRules,
        createdSections: summary.createdSections,
        skipped: summary.skipped ?? [],
      });

      const sectionMsg =
        summary.createdSections > 0
          ? ` and ${summary.createdSections} new section${
              summary.createdSections === 1 ? "" : "s"
            }`
          : "";
      toast.success(
        `Applied "${summary.templateName}" — ${summary.createdRules} rule${
          summary.createdRules === 1 ? "" : "s"
        }${sectionMsg}.`
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't apply template"
      );
    } finally {
      setApplyingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[860px] p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-[18px] font-semibold text-gray-900">
            Engineering workflow templates
          </DialogTitle>
          <p className="text-[13px] text-gray-500 mt-1 max-w-[640px]">
            Each template bundles sections and rules tailored to a real
            engineering handoff. Applying one creates any missing sections
            on this project and adds the rules — your existing setup is
            untouched, so you can layer multiple templates.
          </p>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          {!templates && !loadError && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          )}
          {loadError && (
            <p className="text-[13px] text-red-600 py-6 text-center">
              {loadError}
            </p>
          )}
          {templates && templates.length === 0 && (
            <p className="text-[13px] text-gray-400 py-6 text-center">
              No templates available yet.
            </p>
          )}
          {templates && templates.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {templates.map((t) => {
                const Icon = resolveIcon(t.icon);
                const isApplying = applyingId === t.id;
                const isDisabled = applyingId !== null && !isApplying;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleApply(t)}
                    disabled={isDisabled || isApplying}
                    className={cn(
                      "text-left rounded-xl border border-gray-200 px-4 py-3.5 transition-colors flex gap-3 items-start",
                      isApplying
                        ? "bg-[#fff8e6] border-[#c9a84c]"
                        : "bg-white hover:border-[#c9a84c] hover:bg-[#fffbef]",
                      isDisabled && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#fbeed3] text-[#7a5b1b] flex-shrink-0">
                      <Icon className="w-[18px] h-[18px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[14px] font-semibold text-gray-900 truncate">
                          {t.name}
                        </h3>
                        {isApplying && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7a5b1b]" />
                        )}
                      </div>
                      <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-2">
                        {t.description}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500">
                        <span>
                          <span className="font-medium tabular-nums text-gray-700">
                            {t.sections.length}
                          </span>{" "}
                          section{t.sections.length === 1 ? "" : "s"}
                        </span>
                        <span className="text-gray-300">·</span>
                        <span>
                          <span className="font-medium tabular-nums text-gray-700">
                            {t.ruleCount}
                          </span>{" "}
                          rule{t.ruleCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
