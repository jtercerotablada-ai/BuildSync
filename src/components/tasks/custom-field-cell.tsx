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
import { Check, Link2, FunctionSquare, Timer as TimerIcon, Clock } from "lucide-react";

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
  // Fase 3 — Asana parity additions.
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
    case "REFERENCE": {
      // Reference value shape: { kind: 'task'|'project'|'portfolio'|'objective', id, name }
      // Multiple refs come as an array. Render the first as a chip with
      // an icon, +N overflow for the rest.
      const refs = Array.isArray(value) ? value : value ? [value] : [];
      if (refs.length === 0) return null;
      const first = refs[0] as { name?: string; kind?: string } | null;
      if (!first || !first.name) return null;
      const more = refs.length - 1;
      return (
        <span className="inline-flex items-center gap-1 text-[12px] text-[#1e1f21] truncate">
          <Link2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <span className="truncate">{first.name}</span>
          {more > 0 && (
            <span className="text-slate-400 tabular-nums">+{more}</span>
          )}
        </span>
      );
    }
    case "FORMULA":
    case "ROLLUP": {
      // Formula values are precomputed on the server (or client) and
      // stored as { result: number|string, error?: string }. Show the
      // result; show "—" on missing.
      const v = value as { result?: unknown; error?: string } | null;
      if (!v) return null;
      if (v.error) {
        return (
          <span className="inline-flex items-center gap-1 text-[12px] text-rose-500" title={v.error}>
            <FunctionSquare className="w-3 h-3" />
            #ERR
          </span>
        );
      }
      const r = v.result;
      if (r === null || r === undefined || r === "") return null;
      return (
        <span className="inline-flex items-center gap-1 text-[13px] text-[#1e1f21] tabular-nums">
          <FunctionSquare className="w-3 h-3 text-slate-400 flex-shrink-0" />
          {String(r)}
        </span>
      );
    }
    case "TIMER": {
      // Timer value: { targetIso: string, format: '00 h 00 m' } —
      // render remaining time. When passed, prefix with "−".
      const v = value as { targetIso?: string } | null;
      if (!v?.targetIso) return null;
      const target = new Date(v.targetIso).getTime();
      const now = Date.now();
      const diff = Math.abs(target - now);
      const past = now > target;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[12px] font-medium tabular-nums",
            past ? "text-rose-600" : "text-slate-700"
          )}
        >
          <TimerIcon className="w-3 h-3" />
          {past ? "−" : ""}
          {h}h {m}m
        </span>
      );
    }
    case "TIME_TRACKING": {
      // Compound value: { estimatedMin: number, actualMin: number }
      // Render "estimated / actual" so the list view shows both at a glance.
      const v = value as { estimatedMin?: number; actualMin?: number } | null;
      if (!v) return null;
      const est = v.estimatedMin ?? 0;
      const act = v.actualMin ?? 0;
      if (est === 0 && act === 0) return null;
      const fmt = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
      };
      const over = act > est && est > 0;
      return (
        <span className="inline-flex items-center gap-1 text-[12px] tabular-nums">
          <Clock className="w-3 h-3 text-slate-400" />
          <span className={cn(over && "text-rose-600 font-medium")}>{fmt(act)}</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-500">{fmt(est)}</span>
        </span>
      );
    }
    default:
      return null;
  }
}
