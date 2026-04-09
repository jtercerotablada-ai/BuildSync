"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Calendar,
  CalendarDays,
  User,
  Clock,
  Pencil,
  CalendarCheck,
  ClipboardList,
  ChevronDown,
  X,
  GripVertical,
  MoreHorizontal,
  Check,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

export type GroupField =
  | "sections"
  | "due_date"
  | "start_date"
  | "creator"
  | "created_at"
  | "updated_at"
  | "completed_at"
  | "project"
  | "priority"
  | "none";

export type GroupOrder = "custom" | "asc" | "desc";

export interface GroupConfig {
  id: string;
  field: GroupField;
  order: GroupOrder;
  hideEmpty: boolean;
}

interface GroupPanelProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  groups: GroupConfig[];
  onGroupsChange: (groups: GroupConfig[]) => void;
  onOpenCustomField?: () => void;
}

// ─── Field options ───────────────────────────────────────

const GROUP_FIELD_OPTIONS: { field: GroupField; label: string; icon: typeof Calendar }[] = [
  { field: "sections", label: "Sections", icon: ClipboardList },
  { field: "due_date", label: "Due date", icon: CalendarDays },
  { field: "start_date", label: "Start date", icon: Calendar },
  { field: "creator", label: "Creator", icon: User },
  { field: "created_at", label: "Creation date", icon: Clock },
  { field: "updated_at", label: "Last modified", icon: Pencil },
  { field: "completed_at", label: "Completion date", icon: CalendarCheck },
  { field: "project", label: "Project", icon: ClipboardList },
  { field: "priority", label: "Priority", icon: GripVertical },
];

const ORDER_OPTIONS: { value: GroupOrder; label: string }[] = [
  { value: "custom", label: "Custom order" },
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
];

function fieldLabel(field: GroupField): string {
  return GROUP_FIELD_OPTIONS.find((o) => o.field === field)?.label || field;
}

// ─── Inline dropdown ─────────────────────────────────────

function InlineSelect({
  value,
  options,
  onSelect,
  width,
  footerAction,
}: {
  value: string;
  options: { value: string; label: string; icon?: typeof Calendar; disabled?: boolean }[];
  onSelect: (value: string) => void;
  width?: string;
  footerAction?: { label: string; onClick: () => void };
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
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

  const selectedLabel = options.find((o) => o.value === value)?.label || value;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 h-8 px-2.5 text-[13px] bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-gray-700",
          width
        )}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute left-0 top-[calc(100%+4px)] bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100/60 py-1.5 z-50 min-w-[200px] animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  if (!opt.disabled) {
                    onSelect(opt.value);
                    setOpen(false);
                  }
                }}
                disabled={opt.disabled}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 h-9 text-[13px] transition-colors text-left",
                  opt.disabled
                    ? "text-gray-300 cursor-not-allowed"
                    : isSelected
                    ? "text-gray-900 font-medium bg-black/[0.03]"
                    : "text-gray-700 hover:bg-black/[0.04] cursor-pointer"
                )}
              >
                {Icon && <Icon className={cn("w-4 h-4 flex-shrink-0", isSelected ? "text-gray-700" : "text-gray-400")} />}
                {!Icon && isSelected && <Check className="w-4 h-4 text-gray-700 flex-shrink-0" />}
                {!Icon && !isSelected && <div className="w-4" />}
                <span className="flex-1">{opt.label}</span>
                {isSelected && !Icon && <Check className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
              </button>
            );
          })}
          {footerAction && (
            <>
              <div className="my-1.5 mx-3 border-t border-gray-200" />
              <button
                onClick={() => {
                  footerAction.onClick();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 h-9 text-[13px] text-blue-600 hover:bg-black/[0.04] cursor-pointer transition-colors text-left"
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{footerAction.label}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── GroupRow ─────────────────────────────────────────────

function GroupRow({
  group,
  onUpdate,
  onRemove,
  usedFields,
  onOpenCustomField,
}: {
  group: GroupConfig;
  onUpdate: (updated: GroupConfig) => void;
  onRemove: () => void;
  usedFields: GroupField[];
  onOpenCustomField?: () => void;
}) {
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showOptionsMenu) return;
    function handleClick(e: MouseEvent) {
      if (
        optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node) &&
        optionsBtnRef.current && !optionsBtnRef.current.contains(e.target as Node)
      ) {
        setShowOptionsMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showOptionsMenu]);

  const fieldOptions = GROUP_FIELD_OPTIONS.map((opt) => ({
    value: opt.field,
    label: opt.label,
    icon: opt.icon,
    disabled: usedFields.includes(opt.field) && opt.field !== group.field,
  }));

  const orderOptions = ORDER_OPTIONS.map((opt) => ({
    value: opt.value,
    label: opt.label,
  }));

  return (
    <div className="flex items-center gap-2 py-1.5">
      {/* Drag handle */}
      <div className="flex items-center justify-center w-5 flex-shrink-0 cursor-grab text-gray-300 hover:text-gray-400">
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* Field dropdown */}
      <InlineSelect
        value={group.field}
        options={fieldOptions}
        onSelect={(v) => onUpdate({ ...group, field: v as GroupField })}
        width="min-w-[150px]"
        footerAction={onOpenCustomField ? { label: "Add custom field...", onClick: onOpenCustomField } : undefined}
      />

      {/* Order dropdown */}
      <InlineSelect
        value={group.order}
        options={orderOptions}
        onSelect={(v) => onUpdate({ ...group, order: v as GroupOrder })}
        width="min-w-[140px]"
      />

      {/* Three-dot options */}
      <div className="relative">
        <button
          ref={optionsBtnRef}
          onClick={() => setShowOptionsMenu((v) => !v)}
          className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {showOptionsMenu && (
          <div
            ref={optionsMenuRef}
            className="absolute right-0 top-[calc(100%+4px)] bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100/60 py-1.5 z-50 min-w-[200px] animate-in fade-in slide-in-from-top-1 duration-150"
          >
            <button
              onClick={() => {
                onUpdate({ ...group, hideEmpty: true });
                setShowOptionsMenu(false);
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 h-9 text-[13px] transition-colors text-left",
                group.hideEmpty
                  ? "text-gray-900 font-medium bg-black/[0.03]"
                  : "text-gray-700 hover:bg-black/[0.04] cursor-pointer"
              )}
            >
              {group.hideEmpty && <Check className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
              {!group.hideEmpty && <div className="w-3.5" />}
              Hide empty groups
            </button>
            <button
              onClick={() => {
                onUpdate({ ...group, hideEmpty: false });
                setShowOptionsMenu(false);
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 h-9 text-[13px] transition-colors text-left",
                !group.hideEmpty
                  ? "text-gray-900 font-medium bg-black/[0.03]"
                  : "text-gray-700 hover:bg-black/[0.04] cursor-pointer"
              )}
            >
              {!group.hideEmpty && <Check className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
              {group.hideEmpty && <div className="w-3.5" />}
              Show empty groups
            </button>
          </div>
        )}
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="flex items-center justify-center w-7 h-7 rounded-md text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── GroupPanel ───────────────────────────────────────────

export function GroupPanel({ open, onClose, anchorRef, groups, onGroupsChange, onOpenCustomField }: GroupPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

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
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
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

  const usedFields = groups.map((g) => g.field);

  function handleClearAll() {
    onGroupsChange([{
      id: "group-default",
      field: "none",
      order: "custom",
      hideEmpty: false,
    }]);
    onClose();
  }

  function handleAddSubgroup() {
    // Find first unused field
    const available = GROUP_FIELD_OPTIONS.find((opt) => !usedFields.includes(opt.field));
    if (!available) return;
    onGroupsChange([
      ...groups,
      {
        id: `group-${Date.now()}`,
        field: available.field,
        order: "custom",
        hideEmpty: false,
      },
    ]);
  }

  function handleUpdateGroup(updated: GroupConfig) {
    onGroupsChange(groups.map((g) => (g.id === updated.id ? updated : g)));
  }

  function handleRemoveGroup(id: string) {
    const remaining = groups.filter((g) => g.id !== id);
    if (remaining.length === 0) {
      // Keep at least one "none" group
      onGroupsChange([{
        id: "group-default",
        field: "none",
        order: "custom",
        hideEmpty: false,
      }]);
    } else {
      onGroupsChange(remaining);
    }
  }

  const hasActiveGroups = groups.some((g) => g.field !== "none");

  return (
    <div
      ref={panelRef}
      className="fixed z-50 animate-in fade-in slide-in-from-top-1 duration-150"
      style={{ top: position.top, right: position.right }}
    >
      <div className="w-[540px] bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-[18px] pb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-[16px] font-semibold text-gray-900">Groups</h3>
            <button
              onClick={() => {}}
              className="text-[12px] text-gray-400 hover:text-gray-500 transition-colors"
            >
              Send feedback
            </button>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveGroups && (
              <button
                onClick={handleClearAll}
                className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Group rows */}
        <div className="px-5 pb-3">
          {groups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              onUpdate={handleUpdateGroup}
              onRemove={() => handleRemoveGroup(group.id)}
              usedFields={usedFields}
              onOpenCustomField={onOpenCustomField}
            />
          ))}
        </div>

        {/* Add subgroup */}
        {groups.length < GROUP_FIELD_OPTIONS.length && (
          <div className="px-5 pb-4">
            <button
              onClick={handleAddSubgroup}
              className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-700 transition-colors py-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add subgroup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
