"use client";

/**
 * Read-only display of a custom field value inside a list-view row.
 * Editing happens inside the task detail panel (CustomFieldsSection)
 * which has the proper per-type editor; this cell is just a glance.
 *
 * Compact rendering rules:
 *   TEXT             → plain text, truncated
 *   NUMBER           → tabular-nums
 *   CURRENCY         → "$1,234.56" via Intl
 *   PERCENTAGE       → "12.5%"
 *   DATE             → "May 14"
 *   CHECKBOX         → ✓ when true, blank when false
 *   DROPDOWN         → option label as a small pill
 *   MULTI_SELECT     → up to 2 pills + "+N" overflow
 *   PEOPLE           → "N people"
 */

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

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

export function CustomFieldCell({
  type,
  options,
  value,
}: {
  type: FieldType;
  options: FieldOption[] | null;
  value: unknown;
}) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  switch (type) {
    case "TEXT":
      return (
        <span className="text-[13px] text-[#1e1f21] truncate">
          {String(value)}
        </span>
      );
    case "NUMBER":
      return (
        <span className="text-[13px] text-[#1e1f21] tabular-nums">
          {typeof value === "number" ? value : Number(value)}
        </span>
      );
    case "CURRENCY":
      return (
        <span className="text-[13px] text-[#1e1f21] tabular-nums">
          {new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 2,
          }).format(typeof value === "number" ? value : Number(value))}
        </span>
      );
    case "PERCENTAGE":
      return (
        <span className="text-[13px] text-[#1e1f21] tabular-nums">
          {typeof value === "number" ? value : Number(value)}%
        </span>
      );
    case "DATE": {
      const d = new Date(String(value));
      if (Number.isNaN(d.getTime())) return null;
      return (
        <span className="text-[13px] text-[#1e1f21]">
          {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      );
    }
    case "CHECKBOX":
      return value ? (
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded bg-[#c9a84c]"
          aria-label="Yes"
        >
          <Check className="w-3 h-3 text-white" />
        </span>
      ) : null;
    case "DROPDOWN": {
      const opt = options?.find((o) => o.id === value);
      if (!opt) return null;
      return (
        <span
          className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded text-[12px] font-medium bg-[#f3f4f6] text-[#1e1f21]"
          )}
          style={opt.color ? { backgroundColor: `${opt.color}20`, color: opt.color } : undefined}
        >
          {opt.label}
        </span>
      );
    }
    case "MULTI_SELECT": {
      if (!Array.isArray(value)) return null;
      const selected = (value as string[])
        .map((id) => options?.find((o) => o.id === id))
        .filter((o): o is FieldOption => !!o);
      if (selected.length === 0) return null;
      const visible = selected.slice(0, 2);
      const overflow = selected.length - visible.length;
      return (
        <div className="flex items-center gap-1 min-w-0">
          {visible.map((opt) => (
            <span
              key={opt.id}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[12px] bg-[#f3f4f6] text-[#1e1f21] truncate max-w-[80px]"
              style={
                opt.color
                  ? { backgroundColor: `${opt.color}20`, color: opt.color }
                  : undefined
              }
            >
              {opt.label}
            </span>
          ))}
          {overflow > 0 && (
            <span className="text-[11px] text-[#6f7782] tabular-nums">
              +{overflow}
            </span>
          )}
        </div>
      );
    }
    case "PEOPLE":
      if (!Array.isArray(value) || value.length === 0) return null;
      return (
        <span className="text-[12px] text-[#6f7782]">
          {value.length} {value.length === 1 ? "person" : "people"}
        </span>
      );
    default:
      return null;
  }
}
