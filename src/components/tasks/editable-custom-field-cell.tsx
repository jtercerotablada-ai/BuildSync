"use client";

/**
 * EditableCustomFieldCell — click-to-edit wrapper around CustomFieldCell.
 *
 * Matches Asana's inline-edit behavior on the list view: clicking the
 * cell opens a per-type editor (popover for select/date/people, input
 * for text/number, toggle for checkbox) and saves on commit via
 * PATCH /api/tasks/:taskId/custom-fields/:fieldId.
 *
 * Editor matrix:
 *   TEXT / NUMBER / CURRENCY / PERCENTAGE → inline input, blur saves
 *   DATE                                  → calendar popover
 *   DROPDOWN                              → option dropdown
 *   MULTI_SELECT                          → checkbox popover (toggles)
 *   PEOPLE                                → not implemented yet (read-only)
 *   CHECKBOX                              → toggles on click
 *   REFERENCE / FORMULA / ROLLUP /
 *     TIMER / TIME_TRACKING               → read-only (Phase 5)
 *
 * Optimistic update: the cell shows the new value the moment the user
 * picks; we roll back to the prop on API error.
 */

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Check } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { CustomFieldCell } from "@/components/tasks/custom-field-cell";

type FieldType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "DROPDOWN"
  | "MULTI_SELECT"
  | "PEOPLE"
  | "CHECKBOX"
  | "CURRENCY"
  | "PERCENTAGE"
  | "REFERENCE"
  | "FORMULA"
  | "TIMER"
  | "TIME_TRACKING"
  | "ROLLUP";

interface FieldOption {
  id: string;
  label: string;
  color?: string;
}

const READ_ONLY_TYPES: FieldType[] = [
  "PEOPLE",
  "REFERENCE",
  "FORMULA",
  "TIMER",
  "TIME_TRACKING",
  "ROLLUP",
];

export function EditableCustomFieldCell({
  taskId,
  fieldId,
  type,
  options,
  value,
  onChange,
}: {
  taskId: string;
  fieldId: string;
  type: FieldType;
  options: FieldOption[] | null;
  value: unknown;
  onChange?: (next: unknown) => void;
}) {
  const [optimistic, setOptimistic] = useState<unknown>(value);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset local optimistic when parent prop changes (parent refetch).
  useEffect(() => {
    setOptimistic(value);
  }, [value]);

  async function commit(next: unknown) {
    setOptimistic(next);
    onChange?.(next);
    setSaving(true);
    try {
      const res = await fetch(
        `/api/tasks/${taskId}/custom-fields/${fieldId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: next }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setOptimistic(value); // roll back
      onChange?.(value);
      toast.error("Couldn't update field");
    } finally {
      setSaving(false);
    }
  }

  // Read-only path (PEOPLE / REFERENCE / FORMULA / TIMER / TIME_TRACKING
  // / ROLLUP) — render the underlying CustomFieldCell, no click handler.
  if (READ_ONLY_TYPES.includes(type)) {
    return (
      <CustomFieldCell type={type} options={options} value={optimistic} />
    );
  }

  // CHECKBOX — single-click toggle.
  if (type === "CHECKBOX") {
    const isOn = Boolean(optimistic);
    return (
      <button
        type="button"
        disabled={saving}
        onClick={(e) => {
          e.stopPropagation();
          void commit(!isOn);
        }}
        className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-slate-100 disabled:opacity-50"
        aria-label={isOn ? "Uncheck" : "Check"}
      >
        {isOn ? (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-[#c9a84c]">
            <Check className="w-3 h-3 text-white" />
          </span>
        ) : (
          <span className="inline-block w-4 h-4 rounded border border-slate-300" />
        )}
      </button>
    );
  }

  // TEXT / NUMBER / CURRENCY / PERCENTAGE — contenteditable input
  // overlay. Click to enter edit mode, blur or Enter commits.
  if (
    type === "TEXT" ||
    type === "NUMBER" ||
    type === "CURRENCY" ||
    type === "PERCENTAGE"
  ) {
    if (editing) {
      return (
        <Input
          autoFocus
          value={draftText}
          disabled={saving}
          onChange={(e) => setDraftText(e.target.value)}
          onBlur={() => {
            setEditing(false);
            const raw = draftText.trim();
            if (raw === "" && (optimistic == null || optimistic === "")) {
              return; // nothing changed
            }
            if (type !== "TEXT") {
              const n = Number(raw);
              if (raw === "") {
                void commit(null);
              } else if (Number.isFinite(n)) {
                void commit(n);
              }
            } else {
              void commit(raw);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              setEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-7 px-1.5 text-[13px] py-0"
          type={type === "TEXT" ? "text" : "number"}
        />
      );
    }
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setDraftText(optimistic == null ? "" : String(optimistic));
          setEditing(true);
        }}
        className="w-full text-left hover:bg-slate-100 -mx-1 px-1 py-0.5 rounded transition-colors"
      >
        {optimistic == null || optimistic === "" ? (
          <span className="text-[12px] text-slate-300">—</span>
        ) : (
          <CustomFieldCell type={type} options={options} value={optimistic} />
        )}
      </button>
    );
  }

  // DATE — popover with native date input. Light UX (full calendar
  // would mean wiring DueDatePicker; this keeps the cell self-contained).
  if (type === "DATE") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDraftDate(
                optimistic && typeof optimistic === "string"
                  ? optimistic.slice(0, 10)
                  : ""
              );
            }}
            className="w-full text-left hover:bg-slate-100 -mx-1 px-1 py-0.5 rounded transition-colors"
          >
            {optimistic ? (
              <CustomFieldCell type={type} options={options} value={optimistic} />
            ) : (
              <span className="text-[12px] text-slate-300">—</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Input
            type="date"
            value={draftDate}
            disabled={saving}
            onChange={(e) => setDraftDate(e.target.value)}
            className="h-8 text-[13px]"
            autoFocus
          />
          <div className="flex items-center gap-1 mt-2">
            <button
              type="button"
              onClick={() => {
                void commit(null);
                setOpen(false);
              }}
              className="text-[11px] text-slate-500 hover:text-slate-700 px-2 h-6"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                if (draftDate) void commit(draftDate);
                setOpen(false);
              }}
              className="ml-auto text-[11px] font-medium text-white bg-slate-900 hover:bg-slate-800 rounded px-2 h-6"
            >
              Save
            </button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // DROPDOWN — popover with option list. Click to pick.
  if (type === "DROPDOWN") {
    const opts = options || [];
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="w-full text-left hover:bg-slate-100 -mx-1 px-1 py-0.5 rounded transition-colors"
          >
            {optimistic ? (
              <CustomFieldCell type={type} options={options} value={optimistic} />
            ) : (
              <span className="text-[12px] text-slate-300">—</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-48 p-1"
          onClick={(e) => e.stopPropagation()}
        >
          {opts.length === 0 ? (
            <div className="px-2 py-3 text-[12px] text-slate-400 text-center">
              No options yet.
            </div>
          ) : (
            <ul>
              {opts.map((o) => {
                const isSelected = o.id === optimistic;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        void commit(o.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 disabled:opacity-50 text-left",
                        isSelected && "bg-slate-100"
                      )}
                    >
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[12px] font-medium truncate flex-1"
                        style={
                          o.color
                            ? {
                                backgroundColor: `${o.color}20`,
                                color: o.color,
                              }
                            : { backgroundColor: "#f3f4f6", color: "#1e1f21" }
                        }
                      >
                        {o.label}
                      </span>
                      {isSelected && (
                        <Check className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
              <li className="border-t border-slate-100 mt-1 pt-1">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    void commit(null);
                    setOpen(false);
                  }}
                  className="w-full px-2 py-1.5 text-[11px] text-slate-400 hover:bg-slate-50 rounded text-left"
                >
                  Clear
                </button>
              </li>
            </ul>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  // MULTI_SELECT — popover with checkbox list. Toggles add/remove.
  if (type === "MULTI_SELECT") {
    const opts = options || [];
    const selected = Array.isArray(optimistic)
      ? (optimistic as string[])
      : [];
    const selectedSet = new Set(selected);
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="w-full text-left hover:bg-slate-100 -mx-1 px-1 py-0.5 rounded transition-colors min-w-0"
          >
            {selected.length > 0 ? (
              <CustomFieldCell type={type} options={options} value={optimistic} />
            ) : (
              <span className="text-[12px] text-slate-300">—</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-56 p-1"
          onClick={(e) => e.stopPropagation()}
        >
          {opts.length === 0 ? (
            <div className="px-2 py-3 text-[12px] text-slate-400 text-center">
              No options yet.
            </div>
          ) : (
            <ul>
              {opts.map((o) => {
                const checked = selectedSet.has(o.id);
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        const next = checked
                          ? selected.filter((id) => id !== o.id)
                          : [...selected, o.id];
                        void commit(next);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 disabled:opacity-50 text-left"
                    >
                      <span
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                          checked
                            ? "bg-slate-900 border-slate-900"
                            : "border-slate-300"
                        )}
                      >
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[12px] font-medium truncate"
                        style={
                          o.color
                            ? {
                                backgroundColor: `${o.color}20`,
                                color: o.color,
                              }
                            : { backgroundColor: "#f3f4f6", color: "#1e1f21" }
                        }
                      >
                        {o.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  // Fallback: any unhandled type renders read-only.
  return <CustomFieldCell type={type} options={options} value={optimistic} />;
}
