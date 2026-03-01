"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Check,
  Calendar,
  Plus,
  ChevronDown,
  X,
  User,
  Clock,
  CheckCircle2,
  CalendarDays,
  CalendarRange,
  Pencil,
  Diamond,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────
export type FilterField =
  | "completion"
  | "start_date"
  | "due_date"
  | "creator"
  | "creation_date"
  | "last_modified"
  | "completion_date"
  | "task_type";

export type FilterOperator =
  | "is"
  | "is_not"
  | "is_within"
  | "is_before"
  | "is_after"
  | "is_set"
  | "is_not_set";

export interface ActiveFilter {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string;
}

export type QuickFilterKey =
  | "incomplete"
  | "completed"
  | "due_this_week"
  | "due_next_week";

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  quickFilters: QuickFilterKey[];
  onQuickFiltersChange: (filters: QuickFilterKey[]) => void;
  activeFilters: ActiveFilter[];
  onActiveFiltersChange: (filters: ActiveFilter[]) => void;
}

// ─── Constants ───────────────────────────────────────────

const QUICK_FILTER_OPTIONS: { key: QuickFilterKey; label: string; icon: typeof Check }[] = [
  { key: "incomplete", label: "Tareas sin finalizar", icon: CheckCircle2 },
  { key: "completed", label: "Tareas finalizadas", icon: Check },
  { key: "due_this_week", label: "Para entregar esta semana", icon: CalendarDays },
  { key: "due_next_week", label: "Para entregar la próxima semana", icon: CalendarRange },
];

const ADD_FILTER_OPTIONS: { field: FilterField; label: string; icon: typeof Check }[] = [
  { field: "completion", label: "Estado de finalización", icon: CheckCircle2 },
  { field: "start_date", label: "Fecha de inicio", icon: Calendar },
  { field: "due_date", label: "Fecha de entrega", icon: CalendarDays },
  { field: "creator", label: "Creador", icon: User },
  { field: "creation_date", label: "Fecha de creación", icon: Clock },
  { field: "last_modified", label: "Última modificación", icon: Pencil },
  { field: "completion_date", label: "Fecha de finalización", icon: CalendarRange },
  { field: "task_type", label: "Tipo de tarea", icon: Diamond },
];

const OPERATORS_BY_FIELD: Record<FilterField, { value: FilterOperator; label: string }[]> = {
  completion: [
    { value: "is", label: "es" },
    { value: "is_not", label: "no es" },
  ],
  start_date: [
    { value: "is_within", label: "está en" },
    { value: "is_before", label: "es anterior a" },
    { value: "is_after", label: "es posterior a" },
    { value: "is_set", label: "está definida" },
    { value: "is_not_set", label: "no está definida" },
  ],
  due_date: [
    { value: "is_within", label: "está en" },
    { value: "is_before", label: "es anterior a" },
    { value: "is_after", label: "es posterior a" },
    { value: "is_set", label: "está definida" },
    { value: "is_not_set", label: "no está definida" },
  ],
  creator: [
    { value: "is", label: "es" },
    { value: "is_not", label: "no es" },
  ],
  creation_date: [
    { value: "is_within", label: "está en" },
    { value: "is_before", label: "es anterior a" },
    { value: "is_after", label: "es posterior a" },
  ],
  last_modified: [
    { value: "is_within", label: "está en" },
    { value: "is_before", label: "es anterior a" },
    { value: "is_after", label: "es posterior a" },
  ],
  completion_date: [
    { value: "is_within", label: "está en" },
    { value: "is_before", label: "es anterior a" },
    { value: "is_after", label: "es posterior a" },
    { value: "is_set", label: "está definida" },
    { value: "is_not_set", label: "no está definida" },
  ],
  task_type: [
    { value: "is", label: "es" },
    { value: "is_not", label: "no es" },
  ],
};

const VALUES_BY_FIELD: Record<FilterField, { value: string; label: string }[]> = {
  completion: [
    { value: "incomplete", label: "Sin finalizar" },
    { value: "complete", label: "Finalizada" },
  ],
  start_date: [
    { value: "today", label: "Hoy" },
    { value: "yesterday", label: "Ayer" },
    { value: "this_week", label: "Esta semana" },
    { value: "last_week", label: "La semana pasada" },
    { value: "this_month", label: "Este mes" },
    { value: "last_month", label: "El mes pasado" },
  ],
  due_date: [
    { value: "today", label: "Hoy" },
    { value: "tomorrow", label: "Mañana" },
    { value: "this_week", label: "Esta semana" },
    { value: "next_week", label: "La próxima semana" },
    { value: "this_month", label: "Este mes" },
    { value: "next_month", label: "El próximo mes" },
  ],
  creator: [
    { value: "me", label: "Yo" },
  ],
  creation_date: [
    { value: "today", label: "Hoy" },
    { value: "yesterday", label: "Ayer" },
    { value: "this_week", label: "Esta semana" },
    { value: "last_week", label: "La semana pasada" },
    { value: "this_month", label: "Este mes" },
  ],
  last_modified: [
    { value: "today", label: "Hoy" },
    { value: "yesterday", label: "Ayer" },
    { value: "this_week", label: "Esta semana" },
    { value: "last_week", label: "La semana pasada" },
    { value: "this_month", label: "Este mes" },
  ],
  completion_date: [
    { value: "today", label: "Hoy" },
    { value: "yesterday", label: "Ayer" },
    { value: "this_week", label: "Esta semana" },
    { value: "last_week", label: "La semana pasada" },
    { value: "this_month", label: "Este mes" },
  ],
  task_type: [
    { value: "TASK", label: "Tarea" },
    { value: "MILESTONE", label: "Hito" },
    { value: "APPROVAL", label: "Aprobación" },
  ],
};

function fieldLabel(field: FilterField): string {
  return ADD_FILTER_OPTIONS.find((o) => o.field === field)?.label || field;
}

// ─── FilterBuilderRow ────────────────────────────────────

function FilterBuilderRow({
  filter,
  onUpdate,
  onRemove,
}: {
  filter: ActiveFilter;
  onUpdate: (updated: ActiveFilter) => void;
  onRemove: () => void;
}) {
  const [showOperatorMenu, setShowOperatorMenu] = useState(false);
  const [showValueMenu, setShowValueMenu] = useState(false);
  const operatorRef = useRef<HTMLButtonElement>(null);
  const valueRef = useRef<HTMLButtonElement>(null);
  const operatorMenuRef = useRef<HTMLDivElement>(null);
  const valueMenuRef = useRef<HTMLDivElement>(null);

  const operators = OPERATORS_BY_FIELD[filter.field] || [];
  const values = VALUES_BY_FIELD[filter.field] || [];
  const needsValue = !["is_set", "is_not_set"].includes(filter.operator);

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        showOperatorMenu &&
        operatorMenuRef.current &&
        !operatorMenuRef.current.contains(e.target as Node) &&
        operatorRef.current &&
        !operatorRef.current.contains(e.target as Node)
      ) {
        setShowOperatorMenu(false);
      }
      if (
        showValueMenu &&
        valueMenuRef.current &&
        !valueMenuRef.current.contains(e.target as Node) &&
        valueRef.current &&
        !valueRef.current.contains(e.target as Node)
      ) {
        setShowValueMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showOperatorMenu, showValueMenu]);

  const currentOperatorLabel = operators.find((o) => o.value === filter.operator)?.label || filter.operator;
  const currentValueLabel = values.find((v) => v.value === filter.value)?.label || filter.value || "Seleccionar...";

  return (
    <div className="flex items-center gap-2 py-1.5">
      {/* Field label */}
      <span className="text-[13px] font-medium text-gray-700 min-w-[110px]">{fieldLabel(filter.field)}</span>

      {/* Operator selector */}
      <div className="relative">
        <button
          ref={operatorRef}
          onClick={() => { setShowOperatorMenu((v) => !v); setShowValueMenu(false); }}
          className="flex items-center gap-1 h-7 px-2.5 text-[13px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
        >
          {currentOperatorLabel}
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>
        {showOperatorMenu && (
          <div
            ref={operatorMenuRef}
            className="absolute left-0 top-[calc(100%+4px)] bg-white rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100 py-1 z-50 min-w-[140px]"
          >
            {operators.map((op) => (
              <button
                key={op.value}
                onClick={() => {
                  onUpdate({ ...filter, operator: op.value, value: ["is_set", "is_not_set"].includes(op.value) ? "" : filter.value });
                  setShowOperatorMenu(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-[13px] hover:bg-black/[0.04] transition-colors",
                  filter.operator === op.value && "text-black font-medium"
                )}
              >
                {op.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Value selector */}
      {needsValue && (
        <div className="relative">
          <button
            ref={valueRef}
            onClick={() => { setShowValueMenu((v) => !v); setShowOperatorMenu(false); }}
            className={cn(
              "flex items-center gap-1 h-7 px-2.5 text-[13px] border border-gray-200 rounded-md hover:bg-gray-100 transition-colors",
              filter.value ? "text-gray-700 bg-gray-50" : "text-gray-400 bg-white"
            )}
          >
            {currentValueLabel}
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>
          {showValueMenu && (
            <div
              ref={valueMenuRef}
              className="absolute left-0 top-[calc(100%+4px)] bg-white rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100 py-1 z-50 min-w-[140px]"
            >
              {values.map((v) => (
                <button
                  key={v.value}
                  onClick={() => {
                    onUpdate({ ...filter, value: v.value });
                    setShowValueMenu(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-[13px] hover:bg-black/[0.04] transition-colors",
                    filter.value === v.value && "text-black font-medium"
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Remove */}
      <button
        onClick={onRemove}
        className="flex items-center justify-center w-6 h-6 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors ml-auto"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── AddFilterDropdown ───────────────────────────────────

function AddFilterDropdown({
  onAddFilter,
  existingFields,
}: {
  onAddFilter: (field: FilterField) => void;
  existingFields: FilterField[];
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        open &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[13px] text-gray-500 hover:text-gray-700 transition-colors py-1"
      >
        <Plus className="w-3.5 h-3.5" />
        Agregar filtro
        <ChevronDown className="w-3 h-3 text-gray-400" />
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute left-0 top-[calc(100%+4px)] bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100 py-1.5 z-50 min-w-[220px] animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {ADD_FILTER_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const alreadyAdded = existingFields.includes(opt.field);
            return (
              <button
                key={opt.field}
                onClick={() => {
                  if (!alreadyAdded) {
                    onAddFilter(opt.field);
                    setOpen(false);
                  }
                }}
                disabled={alreadyAdded}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors text-left",
                  alreadyAdded
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-700 hover:bg-black/[0.04] cursor-pointer"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── FilterPanel ─────────────────────────────────────────

export function FilterPanel({
  open,
  onClose,
  anchorRef,
  quickFilters,
  onQuickFiltersChange,
  activeFilters,
  onActiveFiltersChange,
}: FilterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Position panel under anchor
  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 6,
      left: Math.max(8, rect.right - 560),
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
    // Delay to avoid closing immediately from the trigger click
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

  const hasAnyFilter = quickFilters.length > 0 || activeFilters.length > 0;

  function toggleQuickFilter(key: QuickFilterKey) {
    if (quickFilters.includes(key)) {
      onQuickFiltersChange(quickFilters.filter((k) => k !== key));
    } else {
      onQuickFiltersChange([...quickFilters, key]);
    }
  }

  function clearAll() {
    onQuickFiltersChange([]);
    onActiveFiltersChange([]);
  }

  function handleAddFilter(field: FilterField) {
    const defaultOperator = OPERATORS_BY_FIELD[field]?.[0]?.value || "is";
    const newFilter: ActiveFilter = {
      id: `filter-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      field,
      operator: defaultOperator,
      value: "",
    };
    onActiveFiltersChange([...activeFilters, newFilter]);
  }

  function handleUpdateFilter(updated: ActiveFilter) {
    onActiveFiltersChange(activeFilters.map((f) => (f.id === updated.id ? updated : f)));
  }

  function handleRemoveFilter(id: string) {
    onActiveFiltersChange(activeFilters.filter((f) => f.id !== id));
  }

  return (
    <div
      ref={panelRef}
      className="fixed z-50 animate-in fade-in slide-in-from-top-1 duration-150"
      style={{ top: position.top, left: position.left }}
    >
      <div className="w-[560px] bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-[18px] pb-3">
          <h3 className="text-[16px] font-semibold text-gray-900">Filtros</h3>
          {hasAnyFilter && (
            <button
              onClick={clearAll}
              className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Borrar
            </button>
          )}
        </div>

        {/* Quick filters */}
        <div className="px-5 pb-4">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2.5">Filtros rápidos</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_FILTER_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = quickFilters.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  onClick={() => toggleQuickFilter(opt.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[13px] border transition-colors",
                    active
                      ? "bg-black/[0.06] border-gray-300 text-gray-900 font-medium"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active filter builder rows */}
        {activeFilters.length > 0 && (
          <div className="px-5 pb-2 border-t border-gray-100 pt-3">
            {activeFilters.map((filter) => (
              <FilterBuilderRow
                key={filter.id}
                filter={filter}
                onUpdate={handleUpdateFilter}
                onRemove={() => handleRemoveFilter(filter.id)}
              />
            ))}
          </div>
        )}

        {/* Add filter dropdown */}
        <div className="px-5 pb-4 pt-1">
          <AddFilterDropdown
            onAddFilter={handleAddFilter}
            existingFields={activeFilters.map((f) => f.field)}
          />
        </div>
      </div>
    </div>
  );
}
