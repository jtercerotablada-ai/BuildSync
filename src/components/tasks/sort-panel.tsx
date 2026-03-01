"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Calendar,
  CalendarDays,
  User,
  Clock,
  Pencil,
  CalendarCheck,
  Heart,
  ArrowDownAZ,
  ClipboardList,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

export type SortField =
  | "none"
  | "start_date"
  | "due_date"
  | "creator"
  | "created_at"
  | "updated_at"
  | "completed_at"
  | "likes"
  | "alphabetical"
  | "project";

export type SortDirection = "asc" | "desc";

export interface SortState {
  field: SortField;
  direction: SortDirection;
}

interface SortPanelProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
}

// ─── Sort options ────────────────────────────────────────

const SORT_OPTIONS: { field: SortField; label: string; icon: typeof Calendar; defaultDirection: SortDirection }[] = [
  { field: "start_date", label: "Fecha de inicio", icon: Calendar, defaultDirection: "asc" },
  { field: "due_date", label: "Fecha de entrega", icon: CalendarDays, defaultDirection: "asc" },
  { field: "creator", label: "Creador", icon: User, defaultDirection: "asc" },
  { field: "created_at", label: "Fecha de creación", icon: Clock, defaultDirection: "desc" },
  { field: "updated_at", label: "Última modificación", icon: Pencil, defaultDirection: "desc" },
  { field: "completed_at", label: "Fecha de finalización", icon: CalendarCheck, defaultDirection: "desc" },
  { field: "likes", label: "Me gusta", icon: Heart, defaultDirection: "desc" },
  { field: "alphabetical", label: "Orden alfabético", icon: ArrowDownAZ, defaultDirection: "asc" },
  { field: "project", label: "Proyecto", icon: ClipboardList, defaultDirection: "asc" },
];

// ─── SortPanel ───────────────────────────────────────────

export function SortPanel({ open, onClose, anchorRef, sort, onSortChange }: SortPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  // Position panel under anchor, right-aligned
  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    setPosition({
      top: rect.bottom + 6,
      right: Math.max(8, viewportWidth - rect.right),
    });
  }, [anchorRef]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open, onClose, anchorRef]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleSelect(field: SortField, defaultDirection: SortDirection) {
    if (sort.field === field) {
      // Toggle direction
      onSortChange({ field, direction: sort.direction === "asc" ? "desc" : "asc" });
    } else {
      onSortChange({ field, direction: defaultDirection });
    }
    onClose();
  }

  function handleClear() {
    onSortChange({ field: "none", direction: "asc" });
    onClose();
  }

  return (
    <div
      ref={panelRef}
      className="fixed z-50 animate-in fade-in slide-in-from-top-1 duration-150"
      style={{ top: position.top, right: position.right }}
    >
      <div className="w-[240px] bg-white rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100/60 py-2">
        {/* Header with Clear */}
        {sort.field !== "none" && (
          <div className="flex items-center justify-between px-3 pb-1.5 mb-1 border-b border-gray-100">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Ordenado por</span>
            <button
              onClick={handleClear}
              className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Borrar
            </button>
          </div>
        )}

        {/* Sort options */}
        {SORT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = sort.field === opt.field;
          return (
            <button
              key={opt.field}
              onClick={() => handleSelect(opt.field, opt.defaultDirection)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 h-9 text-[13px] transition-colors text-left",
                isSelected
                  ? "text-gray-900 font-medium bg-black/[0.03]"
                  : "text-gray-700 hover:bg-black/[0.04]"
              )}
            >
              <Icon className={cn("w-4 h-4 flex-shrink-0", isSelected ? "text-gray-700" : "text-gray-400")} />
              <span className="flex-1">{opt.label}</span>
              {isSelected && (
                <span className="flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-[11px] text-gray-400">
                    {sort.direction === "asc" ? "\u2191" : "\u2193"}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
