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
 *
 * Two things the create endpoint cannot do on its own and this dialog
 * finishes here:
 *   - the STARTING STAGE. POST /api/projects has no `stage` field; it seeds a
 *     typed project at its pipeline's first stage, so a template that names a
 *     later one lands via the stage endpoint below. Capturing a project does
 *     NOT name a stage (a plan does not start where the last job ended), so
 *     this only fires for a template whose structure carries one.
 *   - the ANCHOR for relative due dates. A captured plan's offsets are days
 *     from its own project's kickoff and may be negative, so the engineer can
 *     say when THIS job starts instead of everything anchoring on today.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ACCENT_BG, resolveTemplateIcon } from "./template-visuals";
import type {
  ProjectTemplate,
  ProjectTemplateTask,
} from "@/lib/project-templates";
import type { CustomProjectTemplate } from "@/lib/custom-templates";
import { resolveStage } from "@/lib/pipelines";
import { notifySidebarRefresh } from "@/lib/open-create-project";

interface ConfirmTemplateDialogProps {
  template: ProjectTemplate | null;
  onClose: () => void;
  onCreated: () => void;
}

/** The parts of a template that decide what a new project actually gets. */
type TemplateContent = Pick<
  ProjectTemplate,
  "sections" | "tasks" | "customFields"
>;

/**
 * The tasks the provisioner will really create: it matches a task to its
 * section BY NAME and silently skips the ones that match nothing (a section
 * renamed or removed after the template was captured). Counting the rest
 * would promise work the project never gets.
 */
export function materializableTasks(
  template: TemplateContent
): ProjectTemplateTask[] {
  const sectionNames = new Set(template.sections);
  return (template.tasks ?? []).filter((t) => sectionNames.has(t.section));
}

export interface TemplateContentCounts {
  sections: number;
  tasks: number;
  subtasks: number;
  customFields: number;
}

/**
 * What a template will create, not what its structure claims — the cards and
 * this dialog both read it from here, beside the request that creates it, so
 * the number on the card and the number of rows written cannot drift.
 * A DROPDOWN / MULTI_SELECT field with no options is skipped server-side too.
 */
export function templateContentCounts(
  template: TemplateContent
): TemplateContentCounts {
  const tasks = materializableTasks(template);
  return {
    sections: template.sections.length,
    tasks: tasks.length,
    subtasks: tasks.reduce((n, t) => n + (t.subtasks?.length ?? 0), 0),
    customFields: (template.customFields ?? []).filter(
      (f) =>
        (f.type !== "DROPDOWN" && f.type !== "MULTI_SELECT") ||
        (f.options?.length ?? 0) > 0
    ).length,
  };
}

/** Only a captured (custom) template names a starting stage. */
function startingStage(template: ProjectTemplate): string | undefined {
  return "custom" in template
    ? (template as CustomProjectTemplate).defaults.stage
    : undefined;
}

/**
 * A date input hands back "2026-09-01", which `new Date()` reads as UTC
 * midnight — the previous day in Miami. Build it in local time at noon, where
 * no DST shift can move it off the day the engineer picked.
 */
function localNoon(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function ConfirmTemplateDialog({
  template,
  onClose,
  onCreated,
}: ConfirmTemplateDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const counts = useMemo(
    () =>
      template
        ? templateContentCounts(template)
        : { sections: 0, tasks: 0, subtasks: 0, customFields: 0 },
    [template]
  );
  // Only a template that ships offsets has anything to anchor. A start
  // offset counts on its own: a captured "the survey starts the 14th, we do
  // not know yet when it closes" carries no due date, and asking only about
  // relativeDueDate hid the anchor field on exactly that plan.
  const hasSchedule = useMemo(
    () =>
      !!template &&
      materializableTasks(template).some(
        (t) =>
          typeof t.relativeDueDate === "number" ||
          typeof t.relativeStartDate === "number"
      ),
    [template]
  );

  // Reset name + state on every template change
  useEffect(() => {
    setName("");
    setStartDate("");
    setSubmitting(false);
  }, [template?.id]);

  if (!template) return null;
  const Icon = resolveTemplateIcon(template.icon);
  const stageLabel = resolveStage(startingStage(template))?.stage.label;

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
      const start = startDate ? localNoon(startDate) : null;
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
          // A custom template's blurb answers "when should the team reach for
          // this?", and when its author left it empty the gallery invents one
          // for the card. Neither describes the JOB, so a project started from
          // a captured template opens with its description empty rather than
          // with "Custom template created by your team." in it.
          description: "custom" in template ? undefined : template.description,
          ...(start ? { startDate: start.toISOString() } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const project = await res.json();

      // The create endpoint seeds a typed project at the FIRST stage of its
      // pipeline and has no `stage` field. The stage endpoint is the only
      // writer that touches the stage, its clock and its history together, so
      // a captured starting stage is applied through it rather than by
      // widening the create payload. Non-fatal: the project already exists.
      const stage = startingStage(template);
      if (stage && project?.stage && project.stage !== stage) {
        const stageWarning =
          "Project created, but couldn't set its starting stage. You can move it from the project header.";
        try {
          const stageRes = await fetch(`/api/projects/${project.id}/stage`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              stage,
              reason: `Started from the "${template.name}" template.`,
            }),
          });
          if (!stageRes.ok) toast.warning(stageWarning);
        } catch {
          toast.warning(stageWarning);
        }
      }

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
      notifySidebarRefresh();
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

  const willAdd = [
    counts.tasks > 0 && `${counts.tasks} task${counts.tasks === 1 ? "" : "s"}`,
    counts.subtasks > 0 &&
      `${counts.subtasks} subtask${counts.subtasks === 1 ? "" : "s"}`,
    counts.customFields > 0 &&
      `${counts.customFields} custom field${
        counts.customFields === 1 ? "" : "s"
      }`,
  ].filter((s): s is string => !!s);

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

          {hasSchedule && (
            <div className="mt-4">
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                Start date{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-9 px-3 text-[13px] border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-black/10"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Due dates are offset from this day. Leave it empty to start
                today.
              </p>
            </div>
          )}

          {willAdd.length > 0 && (
            <p className="mt-3 text-[11px] text-gray-500">
              {willAdd.join(" · ")} will be added.
            </p>
          )}

          {stageLabel && (
            <p className="mt-2 text-[11px] text-gray-500">
              {`The project starts at "${stageLabel}".`}
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
