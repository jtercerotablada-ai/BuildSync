"use client";

/**
 * Custom-fields block inside the task detail panel.
 *
 * On mount + whenever projectId changes we fetch the list of custom
 * field definitions linked to the task's project. For each definition
 * we render a PropertyRow-style row with an editor that matches the
 * field type. Every edit PATCHes
 * /api/tasks/:taskId/custom-fields/:fieldId and bubbles up via
 * onChanged so the parent panel can refetch.
 *
 * Field type → editor mapping
 *   TEXT, CURRENCY, PERCENTAGE  → free-text / number input
 *   NUMBER                       → number input
 *   DATE                         → native date input
 *   CHECKBOX                     → simple on/off toggle
 *   DROPDOWN                     → <select> over field.options
 *   MULTI_SELECT                 → chip list with add/remove
 *   PEOPLE                       → placeholder badge (no user picker
 *                                  yet — surface ids until we wire
 *                                  AssigneeSelector here)
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Calendar,
  ChevronDown,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type FieldType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "DROPDOWN"
  | "MULTI_SELECT"
  | "PEOPLE"
  | "CHECKBOX"
  | "CURRENCY"
  | "PERCENTAGE";

interface FieldOption {
  id: string;
  label: string;
  color?: string;
}

interface FieldDef {
  id: string;
  linkId: string;
  position: number;
  name: string;
  type: FieldType;
  options: FieldOption[] | null;
  isRequired: boolean;
}

interface CustomFieldsSectionProps {
  taskId: string;
  projectId: string | null;
  /** From the task detail payload — array of { fieldId, value }. */
  values: { fieldId: string; value: unknown }[];
  onChanged: () => void;
}

export function CustomFieldsSection({
  taskId,
  projectId,
  values,
  onChanged,
}: CustomFieldsSectionProps) {
  const [defs, setDefs] = useState<FieldDef[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setDefs([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/custom-fields`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: FieldDef[] = await res.json();
        if (!cancelled) setDefs(data);
      } catch (err) {
        console.error("[custom-fields] load failed:", err);
        if (!cancelled) setDefs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const valueMap = useMemo(() => {
    const m = new Map<string, unknown>();
    for (const v of values) m.set(v.fieldId, v.value);
    return m;
  }, [values]);

  const saveValue = useCallback(
    async (fieldId: string, value: unknown) => {
      setSaving(fieldId);
      try {
        const res = await fetch(
          `/api/tasks/${taskId}/custom-fields/${fieldId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value }),
          }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        onChanged();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't save field"
        );
      } finally {
        setSaving(null);
      }
    },
    [taskId, onChanged]
  );

  if (!projectId || loading) {
    return null;
  }
  if (!defs || defs.length === 0) {
    return null;
  }

  return (
    <>
      {defs.map((def) => (
        <CustomFieldRow
          key={def.id}
          def={def}
          value={valueMap.get(def.id)}
          saving={saving === def.id}
          onChange={(value) => saveValue(def.id, value)}
        />
      ))}
    </>
  );
}

// ─── PropertyRow-equivalent (copied locally to avoid coupling) ────

function FieldRow({
  label,
  required,
  saving,
  children,
}: {
  label: string;
  required?: boolean;
  saving?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 min-h-9 py-1.5 border-b border-[#eeeeee] last:border-b-0">
      <div className="w-[120px] flex-shrink-0 flex items-center gap-1.5 pt-1">
        <span className="text-[12px] text-[#6f7782] truncate" title={label}>
          {label}
        </span>
        {required && <span className="text-[#a8323a] text-[11px]">*</span>}
        {saving && (
          <Loader2 className="w-3 h-3 animate-spin text-[#9aa0a6]" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex items-center min-h-[28px]">
        {children}
      </div>
    </div>
  );
}

// ─── Per-row editor ──────────────────────────────────────────────

function CustomFieldRow({
  def,
  value,
  saving,
  onChange,
}: {
  def: FieldDef;
  value: unknown;
  saving: boolean;
  onChange: (value: unknown) => void;
}) {
  switch (def.type) {
    case "TEXT":
      return (
        <FieldRow label={def.name} required={def.isRequired} saving={saving}>
          <TextEditor
            value={typeof value === "string" ? value : ""}
            placeholder="Empty"
            onCommit={onChange}
          />
        </FieldRow>
      );
    case "NUMBER":
    case "CURRENCY":
    case "PERCENTAGE":
      return (
        <FieldRow label={def.name} required={def.isRequired} saving={saving}>
          <NumberEditor
            value={
              typeof value === "number"
                ? value
                : typeof value === "string"
                ? Number(value)
                : null
            }
            suffix={
              def.type === "CURRENCY" ? "$" : def.type === "PERCENTAGE" ? "%" : ""
            }
            onCommit={onChange}
          />
        </FieldRow>
      );
    case "DATE":
      return (
        <FieldRow label={def.name} required={def.isRequired} saving={saving}>
          <DateEditor
            value={typeof value === "string" ? value : null}
            onCommit={onChange}
          />
        </FieldRow>
      );
    case "CHECKBOX":
      return (
        <FieldRow label={def.name} required={def.isRequired} saving={saving}>
          <CheckboxEditor
            value={Boolean(value)}
            onCommit={onChange}
          />
        </FieldRow>
      );
    case "DROPDOWN":
      return (
        <FieldRow label={def.name} required={def.isRequired} saving={saving}>
          <DropdownEditor
            value={typeof value === "string" ? value : null}
            options={def.options ?? []}
            onCommit={onChange}
          />
        </FieldRow>
      );
    case "MULTI_SELECT":
      return (
        <FieldRow label={def.name} required={def.isRequired} saving={saving}>
          <MultiSelectEditor
            value={Array.isArray(value) ? (value as string[]) : []}
            options={def.options ?? []}
            onCommit={onChange}
          />
        </FieldRow>
      );
    case "PEOPLE":
      return (
        <FieldRow label={def.name} required={def.isRequired} saving={saving}>
          <span className="text-[13px] text-[#9aa0a6]">
            {Array.isArray(value) && value.length > 0
              ? `${value.length} assigned`
              : "Empty"}
          </span>
        </FieldRow>
      );
    default:
      return null;
  }
}

// ─── Editors ─────────────────────────────────────────────────────

function TextEditor({
  value,
  placeholder,
  onCommit,
}: {
  value: string;
  placeholder?: string;
  onCommit: (next: string | null) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <input
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const trimmed = local.trim();
        if (trimmed !== value.trim()) {
          onCommit(trimmed ? trimmed : null);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") {
          setLocal(value);
          e.currentTarget.blur();
        }
      }}
      placeholder={placeholder ?? "Empty"}
      className="w-full text-[13px] bg-transparent outline-none placeholder:text-[#9aa0a6] text-[#1e1f21] -ml-1.5 px-1.5 py-0.5 rounded hover:bg-[#f3f4f6] focus:bg-[#f3f4f6]"
    />
  );
}

function NumberEditor({
  value,
  suffix,
  onCommit,
}: {
  value: number | null;
  suffix?: string;
  onCommit: (next: number | null) => void;
}) {
  const [local, setLocal] = useState<string>(
    value === null || Number.isNaN(value) ? "" : String(value)
  );
  useEffect(() => {
    setLocal(value === null || Number.isNaN(value) ? "" : String(value));
  }, [value]);
  return (
    <div className="flex items-center -ml-1.5 px-1.5 py-0.5 rounded hover:bg-[#f3f4f6] focus-within:bg-[#f3f4f6] gap-1 w-full">
      <input
        type="text"
        inputMode="decimal"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local.trim() === "") {
            if (value !== null) onCommit(null);
            return;
          }
          const n = Number(local);
          if (Number.isFinite(n) && n !== value) onCommit(n);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape") {
            setLocal(value === null ? "" : String(value));
            e.currentTarget.blur();
          }
        }}
        placeholder="Empty"
        className="flex-1 min-w-0 text-[13px] bg-transparent outline-none placeholder:text-[#9aa0a6] text-[#1e1f21] tabular-nums"
      />
      {suffix && local && (
        <span className="text-[12px] text-[#6f7782]">{suffix}</span>
      )}
    </div>
  );
}

function DateEditor({
  value,
  onCommit,
}: {
  value: string | null;
  onCommit: (next: string | null) => void;
}) {
  const iso = value ? new Date(value).toISOString().slice(0, 10) : "";
  return (
    <div className="flex items-center -ml-1.5 px-1.5 py-0.5 rounded hover:bg-[#f3f4f6] focus-within:bg-[#f3f4f6] gap-1.5 w-full">
      {!iso && <Calendar className="w-3.5 h-3.5 text-[#9aa0a6]" />}
      <input
        type="date"
        value={iso}
        onChange={(e) => {
          const v = e.target.value;
          onCommit(v ? new Date(v).toISOString() : null);
        }}
        className={cn(
          "flex-1 text-[13px] bg-transparent outline-none",
          iso ? "text-[#1e1f21]" : "text-[#9aa0a6]"
        )}
      />
    </div>
  );
}

function CheckboxEditor({
  value,
  onCommit,
}: {
  value: boolean;
  onCommit: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCommit(!value)}
      className="flex items-center gap-2 -ml-1.5 px-1.5 py-0.5 rounded hover:bg-[#f3f4f6]"
    >
      <span
        className={cn(
          "w-4 h-4 rounded border flex items-center justify-center transition-colors",
          value
            ? "bg-[#c9a84c] border-[#c9a84c]"
            : "bg-white border-[#c4c7cf]"
        )}
      >
        {value && <Check className="w-3 h-3 text-white" />}
      </span>
      <span className="text-[13px] text-[#1e1f21]">
        {value ? "Yes" : "No"}
      </span>
    </button>
  );
}

function DropdownEditor({
  value,
  options,
  onCommit,
}: {
  value: string | null;
  options: FieldOption[];
  onCommit: (next: string | null) => void;
}) {
  const selected = options.find((o) => o.id === value);
  return (
    <div className="relative w-full -ml-1.5">
      <select
        value={value ?? ""}
        onChange={(e) => onCommit(e.target.value || null)}
        className={cn(
          "appearance-none w-full pl-1.5 pr-6 py-0.5 rounded text-[13px] bg-transparent outline-none cursor-pointer hover:bg-[#f3f4f6] focus:bg-[#f3f4f6]",
          selected ? "text-[#1e1f21]" : "text-[#9aa0a6]"
        )}
      >
        <option value="">Empty</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3 h-3 text-[#9aa0a6] absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

function MultiSelectEditor({
  value,
  options,
  onCommit,
}: {
  value: string[];
  options: FieldOption[];
  onCommit: (next: string[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const available = options.filter((o) => !value.includes(o.id));
  const selected = value
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is FieldOption => !!o);

  function toggle(id: string) {
    if (value.includes(id)) {
      onCommit(value.filter((v) => v !== id));
    } else {
      onCommit([...value, id]);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 -ml-1.5 px-1.5 py-0.5 rounded hover:bg-[#f3f4f6] w-full">
      {selected.length === 0 && (
        <span className="text-[13px] text-[#9aa0a6]">Empty</span>
      )}
      {selected.map((opt) => (
        <span
          key={opt.id}
          className="group inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#f3f4f6] text-[12px] text-[#1e1f21]"
        >
          {opt.label}
          <button
            type="button"
            onClick={() => toggle(opt.id)}
            className="opacity-0 group-hover:opacity-100 text-[#9aa0a6] hover:text-[#1e1f21] transition-opacity"
            aria-label={`Remove ${opt.label}`}
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      {available.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="text-[12px] text-[#6f7782] hover:text-[#1e1f21] px-1.5 py-0.5 rounded hover:bg-white"
          >
            + Add
          </button>
          {pickerOpen && (
            <div className="absolute z-10 mt-1 left-0 min-w-[160px] bg-white border border-gray-200 rounded-lg shadow-lg py-1">
              {available.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    toggle(opt.id);
                    setPickerOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-[#f3f4f6]"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
