"use client";

/**
 * New-template dialog — creates a reusable custom project template that
 * then appears in BOTH galleries (the create-project modal and /templates)
 * under "Created by your team", exactly like Asana's custom templates.
 *
 * It persists to the ProjectTemplate DB model via POST /api/workspace/templates,
 * storing a `structure` JSON in the same shape the built-in templates use
 * (see lib/custom-templates.ts) so picking it later creates a project through
 * the shared inline path.
 *
 * This starts a template from scratch (name + sections). To capture a rich
 * template from real work, use "Save as template" on an existing project.
 */

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import {
  ACCENT_BG,
  ACCENT_CHOICES,
  ACCENT_HEX,
  ICON_CHOICES,
  resolveTemplateIcon,
} from "./template-visuals";
import type { CustomTemplateRow } from "@/lib/custom-templates";
import type { ProjectTemplate } from "@/lib/project-templates";

interface NewTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired with the created row so the opener can refresh its gallery. */
  onCreated?: (row: CustomTemplateRow) => void;
}

const DEFAULT_SECTIONS = ["To do", "In progress", "Done"];

export function NewTemplateDialog({
  open,
  onOpenChange,
  onCreated,
}: NewTemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<string[]>(DEFAULT_SECTIONS);
  const [sectionDraft, setSectionDraft] = useState("");
  const [icon, setIcon] = useState<string>(ICON_CHOICES[0]);
  const [accent, setAccent] = useState<ProjectTemplate["accent"]>("amber");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setSections(DEFAULT_SECTIONS);
      setSectionDraft("");
      setIcon(ICON_CHOICES[0]);
      setAccent("amber");
      setSubmitting(false);
    }
  }, [open]);

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

  async function handleCreate() {
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim() || null,
          icon,
          color: ACCENT_HEX[accent],
          isPublic: false,
          structure: { sections, accent },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const row = (await res.json()) as CustomTemplateRow;
      toast.success(`Template "${trimmed}" created`);
      onCreated?.(row);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create template"
      );
    } finally {
      setSubmitting(false);
    }
  }

  const Icon = resolveTemplateIcon(icon);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] p-0 overflow-hidden">
        <DialogTitle className="sr-only">New template</DialogTitle>

        {/* Header preview */}
        <div className={cn("px-5 py-4 flex items-center gap-3 border-b", ACCENT_BG[accent])}>
          <div className="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold truncate">
              {name.trim() || "New template"}
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
              placeholder="e.g., Structural peer review"
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
            onClick={handleCreate}
            disabled={submitting || !name.trim() || sections.length === 0}
            className="h-8 px-4 text-[13px] font-medium text-white bg-black hover:bg-gray-800 rounded-md disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Creating…
              </>
            ) : (
              "Create template"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
