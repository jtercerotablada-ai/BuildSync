"use client";

/**
 * TeamFieldCell — renders + edits one team-member custom field value in
 * the Members grid, one branch per Asana field type (single/multi
 * select · date · people · reference · text · number). People and
 * reference reuse the task field editors (same {value,onChange} shape).
 */

import { useEffect, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, X } from "lucide-react";
import { PeopleFieldEditor } from "@/components/tasks/people-field-editor";
import { ReferenceFieldEditor } from "@/components/tasks/reference-field-editor";

export interface TeamFieldOption {
  id: string;
  name: string;
  color: string;
}

export interface TeamFieldDef {
  id: string;
  name: string;
  type: string;
  options?: TeamFieldOption[] | null;
  config?: {
    format?: string;
    decimals?: number;
    source?: string;
    description?: string;
  } | null;
}

interface Props {
  field: TeamFieldDef;
  value: unknown;
  canEdit: boolean;
  onSave: (value: unknown) => void;
}

function formatNumber(
  raw: unknown,
  config: TeamFieldDef["config"]
): string {
  // Guard nullish/empty BEFORE Number() — Number(null) is 0, which would
  // otherwise fabricate a "0" for unset cells instead of the "—" blank.
  if (raw === null || raw === undefined || raw === "") return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  const decimals = config?.decimals ?? 0;
  const fixed = n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (config?.format === "currency") return `$${fixed}`;
  if (config?.format === "percentage") return `${fixed}%`;
  return fixed;
}

function formatDate(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TeamFieldCell({ field, value, canEdit, onSave }: Props) {
  switch (field.type) {
    case "people":
      return (
        <div className="min-w-0">
          {canEdit ? (
            <PeopleFieldEditor value={value} onChange={onSave} />
          ) : (
            <ReadonlyPeople value={value} />
          )}
        </div>
      );
    case "reference":
      return (
        <div className="min-w-0">
          {canEdit ? (
            <ReferenceFieldEditor value={value} onChange={onSave} />
          ) : (
            <span className="text-sm text-gray-400">—</span>
          )}
        </div>
      );
    case "single_select":
      return (
        <SelectCell field={field} value={value} canEdit={canEdit} onSave={onSave} multi={false} />
      );
    case "multi_select":
      return (
        <SelectCell field={field} value={value} canEdit={canEdit} onSave={onSave} multi />
      );
    case "date":
      return <DateCell value={value} canEdit={canEdit} onSave={onSave} />;
    case "number":
      return <TextNumberCell field={field} value={value} canEdit={canEdit} onSave={onSave} numeric />;
    case "text":
    default:
      return <TextNumberCell field={field} value={value} canEdit={canEdit} onSave={onSave} numeric={false} />;
  }
}

// ── Text / Number ──────────────────────────────────────────────────
function TextNumberCell({
  field,
  value,
  canEdit,
  onSave,
  numeric,
}: Props & { numeric: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 0);
  }, [editing]);

  const display = numeric
    ? formatNumber(value, field.config)
    : typeof value === "string"
      ? value
      : "";

  function commit() {
    setEditing(false);
    if (numeric) {
      const trimmed = draft.trim();
      if (trimmed === "") return onSave(null);
      const n = Number(trimmed);
      if (Number.isFinite(n)) onSave(n);
    } else {
      onSave(draft.trim() || null);
    }
  }

  if (!canEdit) {
    return <span className="text-sm text-gray-700">{display}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={numeric ? "number" : "text"}
        defaultValue={
          numeric
            ? typeof value === "number"
              ? String(value)
              : ""
            : typeof value === "string"
              ? value
              : ""
        }
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-full bg-transparent text-sm outline-none border border-black rounded px-1.5 py-0.5"
      />
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(display);
        setEditing(true);
      }}
      className="w-full text-left text-sm text-gray-700 hover:bg-gray-100 rounded px-1.5 py-0.5 min-h-[24px] truncate"
    >
      {display || <span className="text-gray-300">—</span>}
    </button>
  );
}

// ── Date ───────────────────────────────────────────────────────────
function DateCell({
  value,
  canEdit,
  onSave,
}: {
  value: unknown;
  canEdit: boolean;
  onSave: (v: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const iso = typeof value === "string" ? value.slice(0, 10) : "";

  if (!canEdit) {
    return <span className="text-sm text-gray-700">{formatDate(value)}</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full text-left text-sm text-gray-700 hover:bg-gray-100 rounded px-1.5 py-0.5 min-h-[24px] truncate">
          {formatDate(value) || <span className="text-gray-300">—</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <input
          type="date"
          defaultValue={iso}
          onChange={(e) => {
            onSave(e.target.value || null);
            setOpen(false);
          }}
          className="text-sm outline-none border rounded px-2 py-1"
        />
        {iso && (
          <button
            onClick={() => {
              onSave(null);
              setOpen(false);
            }}
            className="mt-2 block text-xs text-gray-500 hover:text-black"
          >
            Clear
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Single / Multi select ──────────────────────────────────────────
function SelectCell({
  field,
  value,
  canEdit,
  onSave,
  multi,
}: Props & { multi: boolean }) {
  const [open, setOpen] = useState(false);
  const options = field.options || [];
  const selectedIds: string[] = multi
    ? Array.isArray(value)
      ? (value as string[])
      : []
    : typeof value === "string" && value
      ? [value]
      : [];
  const selectedOpts = options.filter((o) => selectedIds.includes(o.id));

  function toggle(id: string) {
    if (multi) {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id];
      onSave(next.length ? next : null);
    } else {
      onSave(selectedIds.includes(id) ? null : id);
      setOpen(false);
    }
  }

  const chips = (
    <div className="flex flex-wrap items-center gap-1">
      {selectedOpts.length === 0 && <span className="text-gray-300">—</span>}
      {selectedOpts.map((o) => (
        <span
          key={o.id}
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
          style={{ backgroundColor: o.color }}
        >
          {o.name}
        </span>
      ))}
    </div>
  );

  if (!canEdit) return <div className="text-sm px-1.5">{chips}</div>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full text-left text-sm hover:bg-gray-100 rounded px-1.5 py-0.5 min-h-[24px]">
          {chips}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {options.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-gray-400">No options</p>
        )}
        {options.map((o) => {
          const active = selectedIds.includes(o.id);
          return (
            <button
              key={o.id}
              onClick={() => toggle(o.id)}
              className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-gray-100 text-left"
            >
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                style={{ backgroundColor: o.color }}
              >
                {o.name}
              </span>
              {active && <Check className="h-4 w-4 text-gray-600" />}
            </button>
          );
        })}
        {selectedIds.length > 0 && (
          <button
            onClick={() => {
              onSave(null);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 mt-1 border-t rounded text-left text-xs text-gray-500 hover:text-black"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Read-only people (for non-members) ─────────────────────────────
function ReadonlyPeople({ value }: { value: unknown }) {
  const people = Array.isArray(value) ? value : [];
  if (people.length === 0)
    return <span className="text-sm text-gray-400">—</span>;
  return (
    <span className="text-sm text-gray-700 truncate">
      {people
        .map((p: { name?: string | null }) =>
          typeof p === "object" && p ? p.name || "Someone" : "Someone"
        )
        .join(", ")}
    </span>
  );
}
