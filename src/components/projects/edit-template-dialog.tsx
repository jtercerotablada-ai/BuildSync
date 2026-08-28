"use client";

/**
 * Edit-template dialog — renames a custom template, changes its blurb, icon,
 * colour and section list via PUT /api/workspace/templates.
 *
 * Only what the user typed is editable. The TASKS, subtasks, custom fields
 * and defaults inside a captured template came out of a real project and are
 * carried through this save untouched — the dialog says so instead of
 * pretending they can be edited here.
 *
 * Two contract details of the PUT this mirrors exactly:
 *   - It is CREATOR-ONLY (same gate as DELETE), so the gallery offers this
 *     dialog only on a template the caller created.
 *   - A `structure` in the body REPLACES the stored one. Editing the sections
 *     therefore has to re-send the captured tasks and fields with them, or
 *     saving a renamed column would silently throw the plan away.
 */

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Plus, X } from "lucide-react";
import {
  ACCENT_BG,
  ACCENT_CHOICES,
  ACCENT_HEX,
  ICON_CHOICES,
  ICON_MAP,
  resolveTemplateIcon,
} from "./template-visuals";
import { templateContentCounts } from "./confirm-template-dialog";
import { normalizeStructure, type CustomTemplateRow } from "@/lib/custom-templates";
import type { ProjectTemplate } from "@/lib/project-templates";

interface EditTemplateDialogProps {
  /** The row being edited, or null when the dialog is closed. */
  row: CustomTemplateRow | null;
  onClose: () => void;
  /** Fired with the saved row so the gallery can refresh in place. */
  onSaved: (row: CustomTemplateRow) => void;
}

export function EditTemplateDialog({
  row,
  onClose,
  onSaved,
}: EditTemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<string[]>([]);
  const [sectionDraft, setSectionDraft] = useState("");
  const [icon, setIcon] = useState<string>(ICON_CHOICES[0]);
  const [accent, setAccent] = useState<ProjectTemplate["accent"]>("slate");
  const [submitting, setSubmitting] = useState(false);

  const stored = useMemo(
    () => (row ? normalizeStructure(row.structure) : null),
    [row]
  );

  useEffect(() => {
    if (!row) return;
    const st = normalizeStructure(row.structure);
    setName(row.name);
    setDescription(row.description ?? "");
    setSections(st.sections);
    setSectionDraft("");
    setIcon(row.icon && ICON_MAP[row.icon] ? row.icon : ICON_CHOICES[0]);
    setAccent(st.accent ?? "slate");
    setSubmitting(false);
  }, [row]);

  // What a project made from the template AS EDITED would get — the same
  // rule the card and the confirm dialog use, so removing a section shows
  // its cost here before the user saves.
  const counts = useMemo(
    () =>
      templateContentCounts({
        sections,
        tasks: stored?.tasks,
        customFields: stored?.customFields,
      }),
    [sections, stored]
  );

  /** Captured tasks whose section no longer exists — they would stop being
   *  created, so the user is told which column carries how many. */
  const orphaned = useMemo(() => {
    const names = new Set(sections);
    const bySection = new Map<string, number>();
    for (const t of stored?.tasks ?? []) {
      if (names.has(t.section)) continue;
      bySection.set(t.section, (bySection.get(t.section) ?? 0) + 1);
    }
    return [...bySection.entries()];
  }, [sections, stored]);

  function addSection() {
    const v = sectionDraft.trim();
    if (!v) return;
    if (sections.some((s) => s.toLowerCase() === v.toLowerCase())) {
      toast.error("That section already exists");
      return;
    }
    if (v.length > 80) {
      toast.error("Section name is too long");
      return;
    }
    if (sections.length >= 20) {
      toast.error("A template can have at most 20 sections");
      return;
    }
    setSections((prev) => [...prev, v]);
    setSectionDraft("");
  }

  function removeSection(idx: number) {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!row || !stored) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Template name is required");
      return;
    }
    if (sections.length === 0) {
      toast.error("Add at least one section");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/workspace/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          name: trimmed,
          description: description.trim() || null,
          icon,
          // Mirrors the New-template dialog: the row colour is the accent's
          // representative hex, so the two never disagree.
          color: ACCENT_HEX[accent],
          // The captured half rides along untouched — see the header note —
          // except the colour: customRowToProjectTemplate reads
          // `defaults.color` in preference to the row's, and a captured
          // template always has one (the source project's), so writing only
          // `color` above would repaint the card and leave every project made
          // from it the old colour.
          structure: {
            ...stored,
            sections,
            accent,
            defaults: { ...stored.defaults, color: ACCENT_HEX[accent] },
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const updated = (await res.json()) as CustomTemplateRow;
      toast.success(`Template "${trimmed}" updated`);
      // The PUT responds without the creator relation; keep the row's own so
      // the card does not lose its byline until the next load.
      onSaved({ ...row, ...updated });
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update template"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!row) return null;
  const Icon = resolveTemplateIcon(icon);
  const captured = [
    counts.tasks > 0 && `${counts.tasks} task${counts.tasks === 1 ? "" : "s"}`,
    counts.subtasks > 0 &&
      `${counts.subtasks} subtask${counts.subtasks === 1 ? "" : "s"}`,
    counts.customFields > 0 &&
      `${counts.customFields} custom field${
        counts.customFields === 1 ? "" : "s"
      }`,
  ].filter((s): s is string => !!s);

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[520px] p-0 overflow-hidden">
        <DialogTitle className="sr-only">Edit template — {row.name}</DialogTitle>

        {/* Header preview */}
        <div
          className={cn(
            "px-5 py-4 flex items-center gap-3 border-b",
            ACCENT_BG[accent]
          )}
        >
          <div className="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold truncate">
              {name.trim() || "Edit template"}
            </h2>
            <p className="text-[12px] opacity-80">Custom template · your team</p>
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
              placeholder="e.g., 40-year recertification"
              className="w-full h-9 px-3 text-[13px] border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-black/10 placeholder:text-gray-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
              Description{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this template for?"
              rows={2}
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-black/10 placeholder:text-gray-400 resize-none"
            />
          </div>

          {/* Sections */}
          <div>
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
              Sections
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {sections.map((s, i) => (
                <span
                  key={`${s}-${i}`}
                  className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-md bg-gray-100 text-[12px] text-gray-700"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSection(i)}
                    className="rounded hover:bg-gray-200 p-0.5"
                    aria-label={`Remove ${s}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {sections.length === 0 && (
                <span className="text-[12px] text-gray-400">No sections yet</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={sectionDraft}
                onChange={(e) => setSectionDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSection();
                  }
                }}
                placeholder="Add a section…"
                className="flex-1 h-8 px-3 text-[13px] border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-black/10 placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={addSection}
                className="inline-flex items-center gap-1 h-8 px-3 text-[13px] font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {orphaned.length > 0 && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-[1px]" />
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {orphaned
                    .map(
                      ([section, n]) =>
                        `${n} captured task${n === 1 ? "" : "s"} filed under "${section}"`
                    )
                    .join(", ")}{" "}
                  {orphaned.length === 1 ? "has" : "have"} no section any more.
                  Add that section back to keep {orphaned.length === 1 ? "it" : "them"}{" "}
                  in new projects.
                </p>
              </div>
            )}
          </div>

          {/* Icon + accent */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                Icon
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_CHOICES.map((ic) => {
                  const IcComp = resolveTemplateIcon(ic);
                  return (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setIcon(ic)}
                      className={cn(
                        "w-8 h-8 rounded-md flex items-center justify-center border",
                        icon === ic
                          ? "border-black bg-gray-900 text-white"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      )}
                      aria-label={ic}
                    >
                      <IcComp className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                Color
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ACCENT_CHOICES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAccent(a)}
                    className={cn(
                      "w-8 h-8 rounded-md border-2",
                      accent === a ? "border-black" : "border-transparent"
                    )}
                    style={{ backgroundColor: ACCENT_HEX[a] }}
                    aria-label={a}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* What came from the project and stays as it is */}
          {captured.length > 0 && (
            <div className="rounded-md border border-gray-200 bg-gray-50/70 px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-1">
                Captured content
              </p>
              <p className="text-[12px] text-gray-700">{captured.join(" · ")}</p>
              <p className="mt-1 text-[11px] text-gray-500">
                Tasks were captured from the project and cannot be edited here.
              </p>
            </div>
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
            onClick={handleSave}
            disabled={submitting || !name.trim() || sections.length === 0}
            className="h-8 px-4 text-[13px] font-medium text-white bg-black hover:bg-gray-800 rounded-md disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
