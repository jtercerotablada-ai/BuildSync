"use client";

/**
 * Save-as-template dialog — turns a job the firm has already run into the
 * template for the next twenty.
 *
 * It posts to /api/projects/[projectId]/save-as-template, which captures the
 * sections, tasks (with their day offsets, dependencies, sub-tasks and custom
 * field values) and custom fields into the same `structure` shape a built-in
 * template declares, so the new row appears in both galleries and creates a
 * project through the shared inline path.
 *
 * To start a template from nothing instead, use new-template-dialog.tsx.
 */

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, LayoutTemplate } from "lucide-react";

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  sectionCount: number;
  /** Every task the capture will read — sub-tasks included, multi-homed guests
   *  excluded — or null when the caller has no honest number, in which case
   *  the summary says sections only rather than a count that isn't true. */
  taskCount: number | null;
}

/** Only the parts of the 201 body this dialog reads. `truncated` is present
 *  ONLY when the capture left something out, and its `message` already names
 *  what and why — tasks are not the only thing it can report. */
interface SaveAsTemplateResponse {
  truncated?: { message?: string };
}

export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  sectionCount,
  taskCount,
}: SaveAsTemplateDialogProps) {
  const [name, setName] = useState(projectName);
  const [description, setDescription] = useState("");
  const [includeTasks, setIncludeTasks] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      // A project name is never the template name ("22461239 - 6891 Bay Drive"
      // is not "Building recertification"), but it is the one thing we know —
      // pre-fill it and let them rewrite it.
      setName(projectName);
      setDescription("");
      setIncludeTasks(true);
      setSubmitting(false);
    }
  }, [open, projectName]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Template name is required");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/save-as-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim() || null,
          includeTasks,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as SaveAsTemplateResponse;
      toast.success(`Template "${trimmed}" saved`);
      // A capture that quietly drops half a plan is worse than one that
      // refuses, so what was left out is said out loud, not swallowed.
      if (data.truncated) {
        toast.warning(
          data.truncated.message ||
            "Some of this project could not be captured, so the template holds less than the project does.",
          { duration: 10000 }
        );
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save template"
      );
    } finally {
      setSubmitting(false);
    }
  }

  // "up to", because the count is the project's own — it does not know which
  // tasks the capture will leave out (a private one, or one whose section was
  // deleted), and a promise made here that the template then breaks is worse
  // than a number with a ceiling on it.
  const summary = [
    `${sectionCount} section${sectionCount === 1 ? "" : "s"}`,
    includeTasks
      ? taskCount === null
        ? "every task and sub-task"
        : `up to ${taskCount} task${taskCount === 1 ? "" : "s"} and sub-tasks`
      : "no tasks",
  ].join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] p-0 overflow-hidden">
        <DialogTitle className="sr-only">Save as template</DialogTitle>

        {/* Header preview */}
        <div className="px-5 py-4 flex items-center gap-3 border-b bg-gray-50">
          <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
            <LayoutTemplate className="w-5 h-5 text-gray-700" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold truncate">
              {name.trim() || "Save as template"}
            </h2>
            <p className="text-[12px] text-gray-500 truncate">
              From “{projectName}”
            </p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
              Template name
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Building recertification"
              className="w-full h-9 px-3 text-[13px] border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-black/10 placeholder:text-gray-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When should the team reach for this template?"
              rows={2}
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-black/10 placeholder:text-gray-400 resize-none"
            />
          </div>

          {/* Include tasks */}
          <div className="flex items-start justify-between gap-4 rounded-md border border-gray-200 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-gray-900">Include tasks</p>
              <p className="text-[12px] text-gray-500 mt-0.5">
                Task names, due dates as day offsets, dependencies, sub-tasks and
                custom field values. Turn this off to capture the sections only.
              </p>
            </div>
            <Switch
              checked={includeTasks}
              onCheckedChange={setIncludeTasks}
              aria-label="Include tasks"
            />
          </div>

          {/* What gets captured */}
          <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2.5 space-y-1">
            <p className="text-[12px] font-medium text-gray-700">
              This template will capture {summary}.
            </p>
            <p className="text-[12px] text-gray-500">
              A template carries the plan, not the people — assignees and
              completion are not copied, so every task starts unassigned and
              unchecked. Private tasks are left out entirely.
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t flex items-center justify-end gap-2 bg-gray-50/50">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-8 px-4 text-[13px] font-medium text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting || !name.trim()}
            className="h-8 px-4 text-[13px] font-medium text-white bg-black hover:bg-gray-800 rounded-md disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              "Save template"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
