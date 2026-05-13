"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  X,
  GripVertical,
  Type,
  AlignLeft,
  Mail,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  FormField,
  FormFieldMapTo,
  FormFieldType,
  FormRow,
} from "@/lib/form-types";

/**
 * Form Builder dialog — used in the project's Workflow tab to create
 * or edit a Form (the public-submission source for tasks).
 *
 * The user defines a list of fields (label, type, required, mapTo)
 * and saves. Saving POSTs to the API and the parent shows the new
 * form in its list with a "Copy public link" affordance.
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Existing form (edit mode). When null, the dialog is in create mode. */
  initial?: FormRow | null;
  onSaved: (form: FormRow) => void;
}

const FIELD_TYPE_OPTIONS: { value: FormFieldType; label: string; icon: React.ReactNode }[] =
  [
    { value: "TEXT", label: "Short text", icon: <Type className="w-3.5 h-3.5" /> },
    { value: "TEXTAREA", label: "Long text", icon: <AlignLeft className="w-3.5 h-3.5" /> },
    { value: "EMAIL", label: "Email", icon: <Mail className="w-3.5 h-3.5" /> },
    { value: "DATE", label: "Date", icon: <Calendar className="w-3.5 h-3.5" /> },
    { value: "SELECT", label: "Dropdown", icon: <ChevronDown className="w-3.5 h-3.5" /> },
  ];

const MAP_TO_OPTIONS: { value: FormFieldMapTo | ""; label: string }[] = [
  { value: "", label: "(none — append to description)" },
  { value: "name", label: "Task name" },
  { value: "description", label: "Task description" },
  { value: "dueDate", label: "Task due date (DATE field only)" },
];

let _idCounter = 0;
function nextFieldId() {
  _idCounter += 1;
  return `f${Date.now()}_${_idCounter}`;
}

function defaultField(): FormField {
  return {
    id: nextFieldId(),
    label: "Untitled field",
    type: "TEXT",
    required: false,
  };
}

export function FormBuilderDialog({
  open,
  onOpenChange,
  projectId,
  initial,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setDescription(initial.description || "");
      setFields(initial.fields);
      setIsActive(initial.isActive);
    } else {
      // Sensible default: 1 short-text field mapped to task name.
      setName("New form");
      setDescription("");
      setFields([
        {
          id: nextFieldId(),
          label: "What's the request?",
          type: "TEXT",
          required: true,
          mapTo: "name",
        },
      ]);
      setIsActive(true);
    }
  }, [open, initial]);

  function updateField(idx: number, patch: Partial<FormField>) {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  function moveField(idx: number, dir: -1 | 1) {
    setFields((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function removeField(idx: number) {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Give the form a name");
      return;
    }
    if (fields.length === 0) {
      toast.error("Add at least one field");
      return;
    }
    // Validate SELECT fields have options.
    for (const f of fields) {
      if (f.type === "SELECT" && (!f.options || f.options.length === 0)) {
        toast.error(`Field "${f.label}" needs at least one option`);
        return;
      }
    }
    // Ensure at most one field maps to "name" — pick the first if many.
    const seenName = new Set<string>();
    for (const f of fields) {
      if (f.mapTo === "name") seenName.add(f.id);
    }
    if (seenName.size > 1) {
      toast.error("Only one field can map to Task name. The first wins; clear the others.");
      return;
    }

    setSaving(true);
    try {
      const url = initial
        ? `/api/forms/${initial.id}`
        : `/api/projects/${projectId}/forms`;
      const method = initial ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          fields,
          isActive,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to save form");
      }
      const saved: FormRow = await res.json();
      onSaved(saved);
      toast.success(initial ? "Form updated" : "Form created");
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save form"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit form" : "Create form"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-2">
          {/* Top: form metadata */}
          <div className="space-y-2">
            <Label>Form name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Submit an RFI"
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell submitters what this form is for"
              rows={2}
              maxLength={2000}
              className="resize-none"
            />
          </div>

          {/* Fields list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Fields</Label>
              <span className="text-[11px] text-slate-400">
                {fields.length} / 50
              </span>
            </div>

            <div className="space-y-2">
              {fields.map((f, idx) => (
                <FieldRow
                  key={f.id}
                  field={f}
                  index={idx}
                  count={fields.length}
                  onChange={(patch) => updateField(idx, patch)}
                  onMoveUp={() => moveField(idx, -1)}
                  onMoveDown={() => moveField(idx, 1)}
                  onRemove={() => removeField(idx)}
                />
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setFields((prev) =>
                  prev.length < 50 ? [...prev, defaultField()] : prev
                )
              }
              disabled={fields.length >= 50}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add field
            </Button>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <Label>Accept submissions</Label>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Inactive forms reject new submissions but keep their
                history.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive((v) => !v)}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                isActive ? "bg-[#c9a84c]" : "bg-slate-300"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  isActive ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-black hover:bg-gray-900 text-white"
          >
            {saving ? "Saving…" : initial ? "Save changes" : "Create form"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────
// Single field row in the builder
// ─────────────────────────────────────────────────────────────────

interface FieldRowProps {
  field: FormField;
  index: number;
  count: number;
  onChange: (patch: Partial<FormField>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function FieldRow({
  field,
  index,
  count,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: FieldRowProps) {
  return (
    <div className="border rounded-lg p-3 bg-white space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex flex-col items-center pt-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="text-slate-300 hover:text-slate-600 disabled:opacity-30"
            title="Move up"
          >
            <GripVertical className="w-4 h-4 rotate-90" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === count - 1}
            className="text-slate-300 hover:text-slate-600 disabled:opacity-30 -mt-1"
            title="Move down"
          >
            <GripVertical className="w-4 h-4 -rotate-90" />
          </button>
        </div>

        <div className="flex-1 space-y-2">
          <Input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Field label"
            maxLength={200}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-slate-500">Type</Label>
              <Select
                value={field.type}
                onValueChange={(v) => onChange({ type: v as FormFieldType })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="flex items-center gap-2">
                        {o.icon}
                        {o.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-slate-500">Maps to</Label>
              <Select
                value={field.mapTo ?? ""}
                onValueChange={(v) =>
                  onChange({
                    mapTo: (v || undefined) as FormFieldMapTo | undefined,
                  })
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAP_TO_OPTIONS.map((o) => (
                    <SelectItem
                      key={o.value || "none"}
                      value={o.value || "none"}
                      disabled={
                        o.value === "dueDate" && field.type !== "DATE"
                      }
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {field.type === "SELECT" && (
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-500">
                Options (one per line)
              </Label>
              <Textarea
                value={(field.options || []).join("\n")}
                onChange={(e) =>
                  onChange({
                    options: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                rows={3}
                placeholder="Option 1&#10;Option 2&#10;Option 3"
                className="resize-none text-sm"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onChange({ required: e.target.checked })}
              id={`req-${field.id}`}
              className="rounded"
            />
            <Label
              htmlFor={`req-${field.id}`}
              className="text-[12px] cursor-pointer"
            >
              Required
            </Label>
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-slate-400 hover:text-black hover:bg-slate-100 rounded"
          title="Remove field"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
