"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  LayoutGrid,
  Plus,
  ArrowLeftRight,
  EyeOff,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Calendar,
  CalendarDays,
  User,
  Clock,
  Pencil,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

export interface ColumnConfig {
  id: string;
  label: string;
  sortable: boolean;
  filterable: boolean;
  groupable: boolean;
  /** flex-1 columns (like "Nombre") */
  flex?: boolean;
  width?: string;
  minWidth?: string;
  /** first column has no left border */
  isFirst?: boolean;
}

export interface ColumnHeaderCallbacks {
  onSortAsc?: () => void;
  onSortDesc?: () => void;
  onFilter?: () => void;
  onGroupBy?: (field: string) => void;
  onAddColumn?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onHideColumn?: () => void;
  onOpenCustomField?: () => void;
}

// ─── Predefined configs ──────────────────────────────────

export const COLUMN_CONFIGS: Record<string, Omit<ColumnConfig, "id">> = {
  name: {
    label: "Task name",
    sortable: true,
    filterable: true,
    groupable: true,
    flex: true,
    isFirst: true,
  },
  dueDate: {
    label: "Due date",
    sortable: true,
    filterable: true,
    groupable: true,
    width: "110px",
    minWidth: "110px",
  },
  collaborators: {
    label: "Collaborators",
    sortable: false,
    filterable: false,
    groupable: false,
    width: "110px",
    minWidth: "110px",
  },
  projects: {
    label: "Projects",
    sortable: true,
    filterable: false,
    groupable: true,
    width: "160px",
    minWidth: "160px",
  },
  visibility: {
    label: "Visibility",
    sortable: false,
    filterable: false,
    groupable: false,
    width: "110px",
    minWidth: "110px",
  },
};

// ─── Group field options for Agrupar submenu ─────────────

const GROUP_SUBMENU_OPTIONS = [
  { value: "sections", label: "Sections", icon: ClipboardList },
  { value: "start_date", label: "Start date", icon: Calendar },
  { value: "due_date", label: "Due date", icon: CalendarDays },
  { value: "creator", label: "Creator", icon: User },
  { value: "created_at", label: "Creation date", icon: Clock },
  { value: "updated_at", label: "Last modified", icon: Pencil },
  { value: "completed_at", label: "Completion date", icon: CalendarCheck },
  { value: "project", label: "Project", icon: ClipboardList },
];

// ─── ColumnHeader ────────────────────────────────────────

export function ColumnHeader({
  config,
  callbacks,
  isDropdownOpen,
  onDropdownToggle,
}: {
  config: ColumnConfig;
  callbacks: ColumnHeaderCallbacks;
  isDropdownOpen: boolean;
  onDropdownToggle: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasContextItems = config.sortable || config.filterable || config.groupable;

  // Close on outside click
  useEffect(() => {
    if (!isDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onDropdownToggle();
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [isDropdownOpen, onDropdownToggle]);

  // Close on ESC
  useEffect(() => {
    if (!isDropdownOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDropdownToggle();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isDropdownOpen, onDropdownToggle]);

  const containerStyle: React.CSSProperties = {};
  if (config.flex) {
    // flex-1 handled by className
  } else if (config.width) {
    containerStyle.width = config.width;
    containerStyle.minWidth = config.minWidth || config.width;
    containerStyle.flexShrink = 0;
  }

  return (
    <div
      className={cn(
        "relative flex items-center gap-1",
        config.flex ? "flex-1 min-w-0" : "",
        !config.isFirst && "border-l border-gray-200 pl-2.5 pr-1"
      )}
      style={containerStyle}
    >
      <button
        ref={triggerRef}
        onClick={onDropdownToggle}
        className={cn(
          "flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 transition-colors group cursor-pointer",
          isDropdownOpen && "text-gray-700"
        )}
      >
        <span className="truncate">{config.label}</span>
        <ChevronDown
          className={cn(
            "w-2.5 h-2.5 text-gray-400 group-hover:text-gray-500 transition-transform flex-shrink-0",
            isDropdownOpen && "rotate-180 text-gray-500"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <ColumnDropdown
          ref={menuRef}
          config={config}
          callbacks={callbacks}
          hasContextItems={hasContextItems}
          onClose={onDropdownToggle}
        />
      )}
    </div>
  );
}

// ─── ColumnDropdown ──────────────────────────────────────

import { forwardRef } from "react";

const ColumnDropdown = forwardRef<
  HTMLDivElement,
  {
    config: ColumnConfig;
    callbacks: ColumnHeaderCallbacks;
    hasContextItems: boolean;
    onClose: () => void;
  }
>(function ColumnDropdown({ config, callbacks, hasContextItems, onClose }, ref) {
  const [openSub, setOpenSub] = useState<string | null>(null);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-[calc(100%+4px)] bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100/60 py-1.5 z-50 min-w-[220px] animate-in fade-in slide-in-from-top-1 duration-150"
    >
      {/* Sortable: Ordenar > submenu */}
      {config.sortable && (
        <DropdownSubmenu
          label="Sort"
          icon={<ArrowUpDown className="w-4 h-4" />}
          isOpen={openSub === "sort"}
          onToggle={() => setOpenSub(openSub === "sort" ? null : "sort")}
        >
          <DropdownItem
            icon={<ArrowUp className="w-4 h-4" />}
            label="Sort ascending"
            onClick={() => { callbacks.onSortAsc?.(); onClose(); }}
          />
          <DropdownItem
            icon={<ArrowDown className="w-4 h-4" />}
            label="Sort descending"
            onClick={() => { callbacks.onSortDesc?.(); onClose(); }}
          />
        </DropdownSubmenu>
      )}

      {/* Filterable: Filtrar */}
      {config.filterable && (
        <DropdownItem
          icon={<Filter className="w-4 h-4" />}
          label="Filter"
          onClick={() => { callbacks.onFilter?.(); onClose(); }}
        />
      )}

      {/* Groupable: Agrupar > submenu */}
      {config.groupable && (
        <DropdownSubmenu
          label="Group by"
          icon={<LayoutGrid className="w-4 h-4" />}
          isOpen={openSub === "group"}
          onToggle={() => setOpenSub(openSub === "group" ? null : "group")}
        >
          {GROUP_SUBMENU_OPTIONS.map((opt) => (
            <DropdownItem
              key={opt.value}
              icon={<opt.icon className="w-4 h-4" />}
              label={opt.label}
              onClick={() => { callbacks.onGroupBy?.(opt.value); onClose(); }}
            />
          ))}
          {/* Separator + custom field */}
          <div className="my-1.5 mx-3 border-t border-gray-200" />
          <DropdownItem
            icon={<Plus className="w-4 h-4" />}
            label="Add custom field..."
            accent
            onClick={() => { callbacks.onOpenCustomField?.(); onClose(); }}
          />
        </DropdownSubmenu>
      )}

      {/* Separator between context items and structural items */}
      {hasContextItems && (
        <div className="my-1.5 mx-3 border-t border-gray-200" />
      )}

      {/* Agregar columna */}
      <DropdownItem
        icon={<Plus className="w-4 h-4" />}
        label="Add column"
        onClick={() => { callbacks.onAddColumn?.(); onClose(); }}
      />

      {/* Mover columna > submenu */}
      <DropdownSubmenu
        label="Move column"
        icon={<ArrowLeftRight className="w-4 h-4" />}
        isOpen={openSub === "move"}
        onToggle={() => setOpenSub(openSub === "move" ? null : "move")}
      >
        <DropdownItem
          label="Move left"
          onClick={() => { callbacks.onMoveLeft?.(); onClose(); }}
        />
        <DropdownItem
          label="Move right"
          onClick={() => { callbacks.onMoveRight?.(); onClose(); }}
        />
      </DropdownSubmenu>

      {/* Ocultar columna */}
      <DropdownItem
        icon={<EyeOff className="w-4 h-4" />}
        label="Hide column"
        onClick={() => { callbacks.onHideColumn?.(); onClose(); }}
      />
    </div>
  );
});

// ─── DropdownItem ────────────────────────────────────────

function DropdownItem({
  icon,
  label,
  onClick,
  accent,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 h-9 text-[13px] transition-colors text-left cursor-pointer",
        accent
          ? "text-[#a8893a] hover:bg-black/[0.04]"
          : "text-gray-700 hover:bg-black/[0.04]"
      )}
    >
      {icon && (
        <span className={cn("flex-shrink-0", accent ? "text-[#a8893a]" : "text-gray-400")}>
          {icon}
        </span>
      )}
      {!icon && <div className="w-4" />}
      <span className="flex-1">{label}</span>
    </button>
  );
}

// ─── DropdownSubmenu ─────────────────────────────────────

function DropdownSubmenu({
  label,
  icon,
  children,
  isOpen,
  onToggle,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const itemRef = useRef<HTMLButtonElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const [subPosition, setSubPosition] = useState<"right" | "left">("right");
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine if submenu should flip to left
  useEffect(() => {
    if (!isOpen || !itemRef.current) return;
    const rect = itemRef.current.getBoundingClientRect();
    const spaceRight = window.innerWidth - rect.right;
    if (spaceRight < 240) {
      setSubPosition("left");
    } else {
      setSubPosition("right");
    }
  }, [isOpen]);

  function handleMouseEnter() {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      if (!isOpen) onToggle();
    }, 100);
  }

  function handleMouseLeave() {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      if (isOpen) onToggle();
    }, 200);
  }

  function handleSubMouseEnter() {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  }

  function handleSubMouseLeave() {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      if (isOpen) onToggle();
    }, 200);
  }

  return (
    <div className="relative">
      <button
        ref={itemRef}
        onClick={onToggle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 h-9 text-[13px] text-gray-700 transition-colors text-left cursor-pointer",
          isOpen ? "bg-black/[0.04]" : "hover:bg-black/[0.04]"
        )}
      >
        <span className="text-gray-400 flex-shrink-0">{icon}</span>
        <span className="flex-1">{label}</span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      </button>

      {isOpen && (
        <div
          ref={subRef}
          onMouseEnter={handleSubMouseEnter}
          onMouseLeave={handleSubMouseLeave}
          className={cn(
            "absolute top-0 bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100/60 py-1.5 z-[60] min-w-[220px] animate-in fade-in slide-in-from-left-1 duration-150",
            subPosition === "right" ? "left-full ml-1" : "right-full mr-1"
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
