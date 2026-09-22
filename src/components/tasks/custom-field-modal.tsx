"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  X,
  Search,
  ChevronDown,
  Check,
  Type,
  Hash,
  Calendar,
  List,
  ToggleLeft,
  Users,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  FormulaBuilder,
  isExprComplete,
  type Token,
} from "@/components/tasks/formula-builder";

// ─── Types ───────────────────────────────────────────────

type TabId = "create" | "library";

interface FieldType {
  id: string;
  label: string;
  icon: typeof Type;
  description: string;
}

export interface CreatedFieldInfo {
  /** Persisted definition id when projectId was provided. */
  id?: string;
  /** Persisted ProjectCustomField link id when projectId was provided. */
  linkId?: string;
  name: string;
  type: string;
  color: string;
  /** Choice options / formula / rollup config exactly as the project path
   *  posts them. Carried so the personal (My Tasks) path can persist them
   *  too — it used to receive name+type only, so a personal dropdown was
   *  created with none of the options the user had just typed. */
  options?: unknown;
}

interface CustomFieldModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFieldType?: string;
  initialFieldName?: string;
  initialTab?: TabId;
  /** When provided, the modal POSTs the new field to the project's
   *  custom-fields endpoint and onFieldCreated receives the persisted
   *  ids. When absent (e.g. /my-tasks which spans projects) the CALLER
   *  persists the field: the modal awaits the callback and stays open
   *  (no success toast) when it returns or resolves to `false`. */
  projectId?: string;
  onFieldCreated?: (
    field: CreatedFieldInfo
  ) => void | boolean | Promise<void | boolean>;
}

// Map the UI's field-type ids to the Prisma CustomFieldType enum the
// API expects. Fase 3 added the Asana-parity types (REFERENCE,
// FORMULA, TIMER, TIME_TRACKING, ROLLUP) so every UI choice now
// persists — no more cosmetic-only fields.
const UI_TO_PRISMA_TYPE: Record<string, string> = {
  text: "TEXT",
  number: "NUMBER",
  date: "DATE",
  single_select: "DROPDOWN",
  multi_select: "MULTI_SELECT",
  checkbox: "CHECKBOX",
  people: "PEOPLE",
  currency: "CURRENCY",
  percentage: "PERCENTAGE",
  reference: "REFERENCE",
  formula: "FORMULA",
  timer: "TIMER",
  time_tracking: "TIME_TRACKING",
  rollup: "ROLLUP",
};

// ─── Field type options ──────────────────────────────────

const FIELD_TYPES: FieldType[] = [
  { id: "text", label: "Text", icon: Type, description: "Free text field" },
  { id: "number", label: "Number", icon: Hash, description: "Numeric value" },
  { id: "date", label: "Date", icon: Calendar, description: "Date picker" },
  { id: "single_select", label: "Dropdown", icon: List, description: "Select an option" },
  { id: "multi_select", label: "Multi-select", icon: List, description: "Select multiple options" },
  { id: "checkbox", label: "Checkbox", icon: ToggleLeft, description: "Yes or no" },
  { id: "people", label: "People", icon: Users, description: "Select people" },
  { id: "reference", label: "Reference", icon: List, description: "Link to a task / project / portfolio / objective" },
  { id: "formula", label: "Formula", icon: Hash, description: "Computed value from other fields" },
  { id: "timer", label: "Timer", icon: Calendar, description: "Countdown to a target time" },
  { id: "time_tracking", label: "Time tracking", icon: Clock, description: "Estimated + actual, in days (e.g. 3, 0.5)" },
  { id: "rollup", label: "Roll-up", icon: Hash, description: "Aggregate subtask values" },
];

/** Formula and Roll-up read the project's numeric fields; with no project
 *  in context (My Tasks) there is nothing to build them from. */
const PROJECT_ONLY_TYPES = new Set(["formula", "rollup"]);

/** Same cap as the custom-field routes' `name` schema. */
const MAX_FIELD_NAME = 80;

// ─── Option colors ───────────────────────────────────────

const FIELD_COLORS = [
  { id: "none", color: "transparent", label: "No color" },
  { id: "red", color: "#E5484D", label: "Red" },
  { id: "orange", color: "#F76B15", label: "Orange" },
  { id: "yellow", color: "#F5D90A", label: "Yellow" },
  { id: "green", color: "#46A758", label: "Green" },
  { id: "blue", color: "#0090FF", label: "Blue" },
  { id: "purple", color: "#8E4EC6", label: "Purple" },
  { id: "pink", color: "#E93D82", label: "Pink" },
];

// ─── Tabs ────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: "create", label: "Create" },
  { id: "library", label: "From library" },
];

// ─── CustomFieldModal ────────────────────────────────────

export function CustomFieldModal({
  open,
  onOpenChange,
  initialFieldType,
  initialFieldName,
  initialTab,
  projectId,
  onFieldCreated,
}: CustomFieldModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("create");
  const [fieldTitle, setFieldTitle] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // User-defined options for Single/Multi select fields (Asana lets you
  // name + color them at creation instead of generic "Option 1/2/3").
  const [optionDrafts, setOptionDrafts] = useState<
    { label: string; colorId: string }[]
  >([
    { label: "", colorId: "blue" },
    { label: "", colorId: "green" },
  ]);
  // FORMULA / ROLLUP config. Operands come from the project's numeric fields.
  const [projectFields, setProjectFields] = useState<
    { id: string; name: string; type: string }[]
  >([]);
  const [formulaTokens, setFormulaTokens] = useState<Token[]>([
    { t: "field", id: "" },
  ]);
  const [rollup, setRollup] = useState<{ source: string; fn: string }>({
    source: "",
    fn: "sum",
  });

  // Load the project's numeric fields when building a Formula/Roll-up.
  useEffect(() => {
    if (!open || !projectId) return;
    if (fieldType !== "formula" && fieldType !== "rollup") return;
    let cancelled = false;
    fetch(`/api/projects/${projectId}/custom-fields`)
      .then((r) => (r.ok ? r.json() : []))
      .then((defs) => {
        if (cancelled) return;
        const numeric = (Array.isArray(defs) ? defs : []).filter(
          (d: { type: string }) =>
            [
              "NUMBER",
              "CURRENCY",
              "PERCENTAGE",
              "FORMULA",
              "ROLLUP",
              "DATE",
            ].includes(d.type)
        );
        setProjectFields(
          numeric.map((d: { id: string; name: string; type: string }) => ({
            id: d.id,
            name: d.name,
            type: d.type,
          }))
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, projectId, fieldType]);

  // Pre-fill from props when the modal opens
  useEffect(() => {
    if (!open) return;
    if (initialTab) setActiveTab(initialTab);
    if (initialFieldType) {
      // Map the field-types.ts id to the local FIELD_TYPES id (they may differ)
      const match = FIELD_TYPES.find(
        (ft) =>
          ft.id === initialFieldType &&
          (!!projectId || !PROJECT_ONLY_TYPES.has(ft.id))
      );
      if (match) setFieldType(match.id);
    }
    if (initialFieldName) setFieldTitle(initialFieldName);
  }, [open, initialTab, initialFieldType, initialFieldName, projectId]);

  async function handleCreate() {
    const name = fieldTitle.trim();
    if (!name) {
      toast.error("Field name is required");
      return;
    }
    if (submitting) return;

    const prismaType = UI_TO_PRISMA_TYPE[fieldType];
    if (!prismaType) {
      toast.error("This field type isn't supported yet");
      return;
    }

    // Build the `options` payload per type:
    //  - DROPDOWN/MULTI_SELECT → user-named option array (hex colors)
    //  - FORMULA → { expr: tokens }
    //  - ROLLUP  → { sourceFieldId, fn }
    let options: unknown;
    if (prismaType === "DROPDOWN" || prismaType === "MULTI_SELECT") {
      const valid = optionDrafts.filter((o) => o.label.trim());
      if (valid.length === 0) {
        toast.error("Add at least one option");
        return;
      }
      options = valid.map((o, i) => {
        const hex = FIELD_COLORS.find(
          (c) => c.id === o.colorId && c.id !== "none"
        )?.color;
        return {
          id: `opt-${i + 1}`,
          label: o.label.trim(),
          ...(hex ? { color: hex } : {}),
        };
      });
    } else if (prismaType === "FORMULA") {
      if (!isExprComplete(formulaTokens)) {
        toast.error("Complete the formula (fill every field or number)");
        return;
      }
      options = { expr: formulaTokens };
    } else if (prismaType === "ROLLUP") {
      if (!rollup.source) {
        toast.error("Pick a field to roll up");
        return;
      }
      options = { sourceFieldId: rollup.source, fn: rollup.fn };
    }

    await persistField(name, fieldType, options);
  }

  /**
   * Save a field and only then report success. Shared by the Create tab and
   * the library, so a library pick is persisted exactly like a typed field
   * (it used to only fire the callback, which on a project list saved
   * nothing while the toast said it was added).
   */
  async function persistField(
    name: string,
    uiType: string,
    options: unknown
  ): Promise<void> {
    if (submitting) return;
    const prismaType = UI_TO_PRISMA_TYPE[uiType];
    if (!prismaType) {
      toast.error("This field type isn't supported yet");
      return;
    }

    setSubmitting(true);
    try {
      // No projectId in context (e.g. the /my-tasks toolbar, which spans
      // projects): the caller persists the definition itself. Hand it the
      // options too — dropping them left the field unusable.
      if (!projectId) {
        const result = await onFieldCreated?.({
          name,
          type: uiType,
          color: "none",
          options,
        });
        // The caller reports its own failure; keep the modal (and what was
        // typed) open instead of claiming success.
        if (result === false) return;
        toast.success(`Field "${name}" created`);
        resetAndClose();
        return;
      }

      const res = await fetch(
        `/api/projects/${projectId}/custom-fields`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            type: prismaType,
            options,
            isRequired: false,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const created = await res.json();
      await onFieldCreated?.({
        id: created.id,
        linkId: created.linkId,
        name: created.name,
        type: uiType,
        color: "none",
      });
      toast.success(`Field "${name}" created`);
      resetAndClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create field"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddFromLibrary(field: LibraryField) {
    // The prefab's own type plus starter options, so a library dropdown is
    // created with choices to pick (not an empty or "Option 1/2/3" list).
    const palette = FIELD_COLORS.filter((c) => c.id !== "none");
    const options = field.options
      ? field.options.map((label, i) => ({
          id: `opt-${i + 1}`,
          label,
          color: palette[i % palette.length].color,
        }))
      : undefined;
    await persistField(field.name, field.uiTypeId, options);
  }

  function resetAndClose() {
    setFieldTitle("");
    setFieldType("text");
    setShowTypeDropdown(false);
    setLibrarySearch("");
    setOptionDrafts([
      { label: "", colorId: "blue" },
      { label: "", colorId: "green" },
    ]);
    setFormulaTokens([{ t: "field", id: "" }]);
    setRollup({ source: "", fn: "sum" });
    setProjectFields([]);
    setActiveTab("create");
    onOpenChange(false);
  }

  const availableTypes = projectId
    ? FIELD_TYPES
    : FIELD_TYPES.filter((t) => !PROJECT_ONLY_TYPES.has(t.id));
  const selectedType =
    availableTypes.find((t) => t.id === fieldType) ?? availableTypes[0];

  // Gate the Create button: Formula/Roll-up can't be created until they're
  // properly configured (so we don't loop on a "pick both fields" toast).
  const canSubmit = (() => {
    if (!fieldTitle.trim() || submitting) return false;
    if (fieldType === "formula")
      return projectFields.length >= 1 && isExprComplete(formulaTokens);
    if (fieldType === "rollup")
      return projectFields.length >= 1 && !!rollup.source;
    return true;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[520px] p-0 gap-0 rounded-xl border-0 shadow-[0_16px_48px_rgba(0,0,0,0.16)] overflow-hidden">
        <DialogTitle className="sr-only">Add custom field</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-[16px] font-semibold text-gray-900">Add custom field</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center px-6 border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-3 py-2.5 text-[13px] border-b-2 -mb-px transition-colors",
                activeTab === tab.id
                  ? "text-gray-900 border-gray-900 font-medium"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-6 py-4">
          {activeTab === "create" && (
            <CreateTab
              fieldTitle={fieldTitle}
              onFieldTitleChange={setFieldTitle}
              fieldType={fieldType}
              onFieldTypeChange={setFieldType}
              fieldTypes={availableTypes}
              showTypeDropdown={showTypeDropdown}
              onShowTypeDropdownChange={setShowTypeDropdown}
              selectedType={selectedType}
              optionDrafts={optionDrafts}
              onOptionDraftsChange={setOptionDrafts}
              projectFields={projectFields}
              formulaTokens={formulaTokens}
              onFormulaTokensChange={setFormulaTokens}
              rollup={rollup}
              onRollupChange={setRollup}
            />
          )}
          {activeTab === "library" && (
            <LibraryTab
              search={librarySearch}
              onSearchChange={setLibrarySearch}
              onAddField={handleAddFromLibrary}
              disabled={submitting}
            />
          )}
        </div>

        {/* Footer — only for Create tab */}
        {activeTab === "create" && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 h-8 text-[13px] font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!canSubmit}
              className="px-4 h-8 text-[13px] font-medium text-white bg-black hover:bg-gray-800 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              {submitting ? "Creating…" : "Create field"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Tab ──────────────────────────────────────────

function CreateTab({
  fieldTitle,
  onFieldTitleChange,
  fieldType,
  onFieldTypeChange,
  fieldTypes,
  showTypeDropdown,
  onShowTypeDropdownChange,
  selectedType,
  optionDrafts,
  onOptionDraftsChange,
  projectFields,
  formulaTokens,
  onFormulaTokensChange,
  rollup,
  onRollupChange,
}: {
  fieldTitle: string;
  onFieldTitleChange: (v: string) => void;
  fieldType: string;
  onFieldTypeChange: (v: string) => void;
  fieldTypes: FieldType[];
  showTypeDropdown: boolean;
  onShowTypeDropdownChange: (v: boolean) => void;
  selectedType: FieldType;
  optionDrafts: { label: string; colorId: string }[];
  onOptionDraftsChange: (v: { label: string; colorId: string }[]) => void;
  projectFields: { id: string; name: string; type: string }[];
  formulaTokens: Token[];
  onFormulaTokensChange: (v: Token[]) => void;
  rollup: { source: string; fn: string };
  onRollupChange: (v: { source: string; fn: string }) => void;
}) {
  const SelectedIcon = selectedType.icon;
  const isSelectType =
    fieldType === "single_select" || fieldType === "multi_select";
  const selectClass =
    "h-9 px-2 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black/10";

  return (
    <div className="space-y-4">
      {/* Field title */}
      <div>
        <label className="block text-[12px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Field title
        </label>
        <input
          type="text"
          value={fieldTitle}
          onChange={(e) => onFieldTitleChange(e.target.value)}
          placeholder="e.g., Status, Priority, Permit #..."
          maxLength={MAX_FIELD_NAME}
          className="w-full h-9 px-3 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black/10 placeholder:text-gray-400 transition-shadow"
          autoFocus
        />
      </div>

      {/* Field type */}
      <div>
        <label className="block text-[12px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Field type
        </label>
        <Popover open={showTypeDropdown} onOpenChange={onShowTypeDropdownChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between h-9 px-3 text-[13px] border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <SelectedIcon className="w-4 h-4 text-gray-500" />
                {selectedType.label}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </PopoverTrigger>
          {/* Portaled + collision-aware so the list is never clipped by the
              modal's overflow-hidden and flips up near the viewport bottom;
              scrolls internally when the type list is taller than the popover. */}
          <PopoverContent
            align="start"
            sideOffset={4}
            className="w-[var(--radix-popover-trigger-width)] p-1.5 rounded-xl border border-gray-100/60 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] max-h-[min(260px,var(--radix-popover-content-available-height))] overflow-y-auto"
          >
            {fieldTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = type.id === fieldType;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    onFieldTypeChange(type.id);
                    onShowTypeDropdownChange(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[13px] transition-colors text-left",
                    isSelected
                      ? "text-gray-900 font-medium bg-black/[0.03]"
                      : "text-gray-700 hover:bg-black/[0.04]"
                  )}
                >
                  <Icon className={cn("w-4 h-4 flex-shrink-0", isSelected ? "text-gray-700" : "text-gray-400")} />
                  <div className="flex-1">
                    <span>{type.label}</span>
                    <span className="text-[11px] text-gray-400 ml-2">{type.description}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      </div>

      {/* Options — only for Single/Multi select. Name + color each one. */}
      {isSelectType && (
        <div>
          <label className="block text-[12px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">
            Options
          </label>
          <div className="space-y-1.5">
            {optionDrafts.map((opt, i) => {
              const swatch =
                FIELD_COLORS.find((c) => c.id === opt.colorId)?.color ||
                "#e5e7eb";
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    title="Change color"
                    onClick={() => {
                      const palette = FIELD_COLORS.filter(
                        (c) => c.id !== "none"
                      );
                      const idx = palette.findIndex(
                        (c) => c.id === opt.colorId
                      );
                      const next = palette[(idx + 1) % palette.length];
                      const copy = [...optionDrafts];
                      copy[i] = { ...opt, colorId: next.id };
                      onOptionDraftsChange(copy);
                    }}
                    className="w-6 h-6 rounded-full border border-gray-200 flex-shrink-0"
                    style={{ backgroundColor: swatch }}
                  />
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => {
                      const copy = [...optionDrafts];
                      copy[i] = { ...opt, label: e.target.value };
                      onOptionDraftsChange(copy);
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 h-8 px-2.5 text-[13px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-black/10 placeholder:text-gray-400"
                  />
                  {optionDrafts.length > 1 && (
                    <button
                      type="button"
                      title="Remove option"
                      onClick={() =>
                        onOptionDraftsChange(
                          optionDrafts.filter((_, j) => j !== i)
                        )
                      }
                      className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() =>
              onOptionDraftsChange([
                ...optionDrafts,
                { label: "", colorId: "blue" },
              ])
            }
            className="mt-1.5 text-[12px] text-gray-500 hover:text-gray-700"
          >
            + Add option
          </button>
        </div>
      )}

      {/* Formula — [field A] [op] [field B], operands = project numbers. */}
      {fieldType === "formula" && (
        <div>
          <label className="block text-[12px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">
            Formula
          </label>
          {projectFields.length < 1 ? (
            <p className="text-[12px] text-gray-400">
              Add at least one Number field to this project first, then build
              the formula.
            </p>
          ) : (
            <>
              <FormulaBuilder
                fields={projectFields}
                tokens={formulaTokens}
                onChange={onFormulaTokensChange}
              />
              <p className="mt-1.5 text-[11px] text-gray-400">
                Combine fields and numbers, e.g. Hours × Rate + 50. × ÷ run
                before + −. Two date fields subtract to a number of days.
              </p>
            </>
          )}
        </div>
      )}

      {/* Roll-up — aggregate a field across the task's subtasks. */}
      {fieldType === "rollup" && (
        <div>
          <label className="block text-[12px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">
            Roll-up (from subtasks)
          </label>
          {projectFields.length === 0 ? (
            <p className="text-[12px] text-gray-400">
              Add a Number field to this project first, then create the
              roll-up.
            </p>
          ) : (
            <div className="flex items-center gap-1.5">
              <select
                className={selectClass}
                value={rollup.fn}
                onChange={(e) =>
                  onRollupChange({ ...rollup, fn: e.target.value })
                }
              >
                {["sum", "avg", "min", "max", "count"].map((fn) => (
                  <option key={fn} value={fn}>
                    {fn}
                  </option>
                ))}
              </select>
              <span className="text-[12px] text-gray-500">of</span>
              <select
                className={cn(selectClass, "flex-1 min-w-0")}
                value={rollup.source}
                onChange={(e) =>
                  onRollupChange({ ...rollup, source: e.target.value })
                }
              >
                <option value="">Field…</option>
                {projectFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Library Tab ─────────────────────────────────────────

// Prefab field templates. Each carries the matching UI-type id so the field
// is created with the right Prisma type, and each dropdown carries starter
// options so it is usable the moment it is added.
interface LibraryField {
  id: string;
  name: string;
  type: string;
  uiTypeId: string;
  options?: string[];
}

const LIBRARY_FIELDS: LibraryField[] = [
  { id: "status", name: "Status", type: "Dropdown", uiTypeId: "single_select", options: ["Not started", "In progress", "Waiting", "Done"] },
  { id: "priority", name: "Priority", type: "Dropdown", uiTypeId: "single_select", options: ["Low", "Medium", "High"] },
  { id: "sprint", name: "Sprint", type: "Dropdown", uiTypeId: "single_select", options: ["Sprint 1", "Sprint 2", "Sprint 3"] },
  { id: "effort", name: "Effort", type: "Number", uiTypeId: "number" },
  { id: "department", name: "Department", type: "Dropdown", uiTypeId: "single_select", options: ["Structural", "Civil", "Drafting", "Admin"] },
  { id: "cost", name: "Cost", type: "Currency", uiTypeId: "currency" },
  { id: "stage", name: "Stage", type: "Dropdown", uiTypeId: "single_select", options: ["Design", "Permit", "Construction", "Closeout"] },
  { id: "tshirt", name: "T-shirt size", type: "Dropdown", uiTypeId: "single_select", options: ["XS", "S", "M", "L", "XL"] },
  { id: "allocation", name: "Allocation %", type: "Percentage", uiTypeId: "percentage" },
];

const LIBRARY_FILTERS: { id: string; label: string; types: string[] | null }[] = [
  { id: "all", label: "All", types: null },
  { id: "number", label: "Number", types: ["Number", "Currency", "Percentage"] },
  { id: "dropdown", label: "Dropdown", types: ["Dropdown"] },
];

function LibraryTab({
  search,
  onSearchChange,
  onAddField,
  disabled,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  onAddField: (field: LibraryField) => void;
  disabled: boolean;
}) {
  const [filterId, setFilterId] = useState("all");
  const activeFilter =
    LIBRARY_FILTERS.find((f) => f.id === filterId) ?? LIBRARY_FILTERS[0];
  const q = search.toLowerCase();
  const filtered = LIBRARY_FIELDS.filter(
    (f) =>
      (!activeFilter.types || activeFilter.types.includes(f.type)) &&
      (f.name.toLowerCase().includes(q) || f.type.toLowerCase().includes(q))
  );

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search fields..."
          className="w-full h-9 pl-9 pr-3 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black/10 placeholder:text-gray-400"
        />
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Filter:</span>
        {LIBRARY_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilterId(f.id)}
            aria-pressed={filterId === f.id}
            className={cn(
              "px-2 h-6 text-[11px] rounded-full transition-colors",
              filterId === f.id
                ? "font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
                : "text-gray-500 hover:bg-gray-100"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Field list */}
      <div className="max-h-[280px] overflow-auto -mx-1">
        {filtered.length > 0 ? (
          filtered.map((field) => (
            <button
              key={field.id}
              type="button"
              disabled={disabled}
              onClick={() => onAddField(field)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-black/[0.03] transition-colors text-left group disabled:opacity-50 disabled:cursor-wait"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-gray-900">{field.name}</div>
                <div className="text-[11px] text-gray-400 mt-0.5 truncate">
                  {field.type}
                  {field.options ? ` · ${field.options.join(", ")}` : ""}
                </div>
              </div>
              <span className="text-[12px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                + Add
              </span>
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-[13px] text-gray-500">No fields found</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Try a different search term</p>
          </div>
        )}
      </div>
    </div>
  );
}
