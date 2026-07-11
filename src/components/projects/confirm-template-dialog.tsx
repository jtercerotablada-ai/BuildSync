"use client";

/**
 * Shared "use this template" confirm dialog.
 *
 * Both the create-project modal (create-project-gallery.tsx) and the
 * full-page gallery (/templates) funnel every template pick — built-in OR
 * custom — through here. It asks for a project name, then creates the
 * project inline via POST /api/projects with the template's sections +
 * custom fields + tasks (the capable path that supports custom fields and
 * workflow rules), and finally applies the workflow template when present.
 *
 * Because custom templates are mapped to the same ProjectTemplate shape
 * (see lib/custom-templates.ts), there is ONE creation code path here for
 * both kinds of template.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ACCENT_BG, resolveTemplateIcon } from "./template-visuals";
import type { ProjectTemplate } from "@/lib/project-templates";

interface ConfirmTemplateDialogProps {
  template: ProjectTemplate | null;
  onClose: () => void;
  onCreated: () => void;
}

export function ConfirmTemplateDialog({
  template,
  onClose,
  onCreated,
}: ConfirmTemplateDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset name + state on every template change
  useEffect(() => {
    setName("");
    setSubmitting(false);
  }, [template?.id]);

  if (!template) return null;
  const Icon = resolveTemplateIcon(template.icon);

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

      // Apply the workflow template if the template ships with one.
      // Failures here are non-fatal — the project still exists.
      if (template.workflowTemplateId) {
        try {
          const wfRes = await fetch(
            `/api/projects/${project.id}/workflow/templates`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ templateId: template.workflowTemplateId }),
            }
          );
          if (!wfRes.ok) {
            toast.warning(
              "Project created, but couldn't seed workflow rules. You can apply the template manually from the Workflow tab."
            );
          }
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

  const taskCount = template.tasks?.length ?? 0;

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

          {taskCount > 0 && (
            <p className="mt-3 text-[11px] text-gray-500">
              {taskCount} pre-built task{taskCount === 1 ? "" : "s"} will be added.
            </p>
          )}

          {template.workflowTemplateId && (
            <p className="mt-2 text-[11px] text-[#a8893a]">
              {`Workflow rules from "${template.workflowTemplateId.replace(
                /-/g,
                " "
              )}" will be applied automatically.`}
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
