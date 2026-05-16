"use client";

/**
 * Asana-style view-settings drawer. Slides over the list (overlay,
 * doesn't push the table) and uses internal navigation:
 *
 *   main ── Show/hide columns ──┐
 *        ── Filters ────────────┤
 *        ── Sort ───────────────┤
 *        ── Groups ─────────────┘
 *
 * Sub-views render in-place with a ← back arrow returning to main.
 * Each sub-view consumes the same state setters the toolbar's floating
 * panels use, so the two surfaces stay in sync.
 */

import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  Columns3,
  Calendar,
  CalendarDays,
  Clock,
  User,
  Pencil,
  CalendarCheck,
  Diamond,
  Heart,
  ArrowDownAZ,
  ClipboardList,
  CheckCircle2,
  Globe,
  Users,
  GripVertical,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ActiveFilter,
  FilterField,
} from "@/components/tasks/filter-panel";
import type { SortState, SortField } from "@/components/tasks/sort-panel";
import type {
  GroupConfig,
  GroupField,
} from "@/components/tasks/group-panel";

type DrawerView = "main" | "columns" | "filters" | "sort" | "groups";

// ─── Sub-view metadata ───────────────────────────────────

const OPTIONAL_COLUMNS: {
  id: string;
  label: string;
  icon: typeof Calendar;
}[] = [
  { id: "dueDate", label: "Due date", icon: CalendarDays },
  { id: "collaborators", label: "Collaborators", icon: Users },
  { id: "projects", label: "Projects", icon: ClipboardList },
  { id: "visibility", label: "Task visibility", icon: Globe },
];

const FILTER_FIELDS: {
  field: FilterField;
  label: string;
  icon: typeof Calendar;
}[] = [
  { field: "completion", label: "Completion status", icon: CheckCircle2 },
  { field: "start_date", label: "Start date", icon: Calendar },
  { field: "due_date", label: "Due date", icon: CalendarDays },
  { field: "creator", label: "Creator", icon: User },
  { field: "creation_date", label: "Creation date", icon: Clock },
  { field: "last_modified", label: "Last modified", icon: Pencil },
  { field: "completion_date", label: "Completion date", icon: CalendarCheck },
  { field: "task_type", label: "Task type", icon: Diamond },
];

const FILTER_OPERATOR_DEFAULTS: Record<FilterField, ActiveFilter["operator"]> = {
  completion: "is",
  start_date: "is_within",
  due_date: "is_within",
  creator: "is",
  creation_date: "is_within",
  last_modified: "is_within",
  completion_date: "is_within",
  task_type: "is",
};

const SORT_FIELDS: {
  field: Exclude<SortField, "none">;
  label: string;
  icon: typeof Calendar;
  defaultDirection: "asc" | "desc";
}[] = [
  { field: "start_date", label: "Start date", icon: Calendar, defaultDirection: "asc" },
  { field: "due_date", label: "Due date", icon: CalendarDays, defaultDirection: "asc" },
  { field: "creator", label: "Creator", icon: User, defaultDirection: "asc" },
  { field: "created_at", label: "Creation date", icon: Clock, defaultDirection: "desc" },
  { field: "updated_at", label: "Last modified", icon: Pencil, defaultDirection: "desc" },
  { field: "completed_at", label: "Completion date", icon: CalendarCheck, defaultDirection: "desc" },
  { field: "likes", label: "Likes", icon: Heart, defaultDirection: "desc" },
  { field: "alphabetical", label: "Alphabetical", icon: ArrowDownAZ, defaultDirection: "asc" },
  { field: "project", label: "Project", icon: ClipboardList, defaultDirection: "asc" },
];

const GROUP_FIELDS: {
  field: GroupField;
  label: string;
  icon: typeof Calendar;
}[] = [
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

// ─── Props ────────────────────────────────────────────────

interface OptionsDrawerProps {
  open: boolean;
  onClose: () => void;
  // Columns
  hiddenColumns: Set<string>;
  onToggleColumn: (colId: string) => void;
  // Filters
  activeFilters: ActiveFilter[];
  onActiveFiltersChange: (filters: ActiveFilter[]) => void;
  // Sort
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  // Groups
  groups: GroupConfig[];
  onGroupsChange: (groups: GroupConfig[]) => void;
}

// ─── Component ────────────────────────────────────────────

export function OptionsDrawer({
  open,
  onClose,
  hiddenColumns,
  onToggleColumn,
  activeFilters,
  onActiveFiltersChange,
  sort,
  onSortChange,
  groups,
  onGroupsChange,
}: OptionsDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<DrawerView>("main");

  // Reset to main when drawer is opened fresh
  useEffect(() => {
    if (open) setView("main");
  }, [open]);

  // ESC closes the drawer (or returns to main if in a sub-view)
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setView((cur) => {
        if (cur !== "main") return "main";
        onClose();
        return cur;
      });
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <div
      ref={panelRef}
      className={cn(
        "absolute top-0 right-0 bottom-0 w-[380px] bg-white border-l border-gray-200 flex flex-col overflow-hidden z-30 shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.08)]",
        "transition-transform duration-200 ease-out",
        open ? "translate-x-0" : "translate-x-full pointer-events-none"
      )}
      aria-hidden={!open}
    >
      {open && view === "main" && (
        <MainView
          onClose={onClose}
          onNavigate={setView}
          hiddenColumnsCount={hiddenColumns.size}
          activeFilterCount={activeFilters.length}
          hasSort={sort.field !== "none"}
          activeGroupsCount={groups.filter((g) => g.field !== "none").length}
        />
      )}
      {open && view === "columns" && (
        <ColumnsView
          onBack={() => setView("main")}
          hiddenColumns={hiddenColumns}
          onToggleColumn={onToggleColumn}
        />
      )}
      {open && view === "filters" && (
        <FiltersView
          onBack={() => setView("main")}
          activeFilters={activeFilters}
          onActiveFiltersChange={onActiveFiltersChange}
        />
      )}
      {open && view === "sort" && (
        <SortView
          onBack={() => setView("main")}
          sort={sort}
          onSortChange={onSortChange}
        />
      )}
      {open && view === "groups" && (
        <GroupsView
          onBack={() => setView("main")}
          groups={groups}
          onGroupsChange={onGroupsChange}
        />
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────

function MainView({
  onClose,
  onNavigate,
  hiddenColumnsCount,
  activeFilterCount,
  hasSort,
  activeGroupsCount,
}: {
  onClose: () => void;
  onNavigate: (view: DrawerView) => void;
  hiddenColumnsCount: number;
  activeFilterCount: number;
  hasSort: boolean;
  activeGroupsCount: number;
}) {
  return (
    <>
      <DrawerHeader title="List" onCloseAction={onClose} closeKind="close" />

      {/* Icon + View Name section */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[12px] font-medium text-gray-500 mb-1.5">Icon</p>
            <button className="flex items-center justify-center h-9 w-9 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-[18px]">
              📋
            </button>
          </div>
          <div className="flex-1">
            <p className="text-[12px] font-medium text-gray-500 mb-1.5">
              View name
            </p>
            <input
              type="text"
              defaultValue="List"
              className="w-full h-9 px-3 text-[14px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-black/10"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200" />

      <div className="px-2 py-2 space-y-0.5">
        <MainRow
          icon={Columns3}
          label="Show/hide columns"
          badge={hiddenColumnsCount > 0 ? `${hiddenColumnsCount} hidden` : undefined}
          onClick={() => onNavigate("columns")}
        />
        <MainRow
          icon={Filter}
          label="Filters"
          badge={activeFilterCount > 0 ? activeFilterCount.toString() : undefined}
          onClick={() => onNavigate("filters")}
        />
        <MainRow
          icon={ArrowUpDown}
          label="Sort"
          badge={hasSort ? "1" : undefined}
          onClick={() => onNavigate("sort")}
        />
        <MainRow
          icon={LayoutGrid}
          label="Groups"
          badge={activeGroupsCount > 0 ? activeGroupsCount.toString() : undefined}
          onClick={() => onNavigate("groups")}
        />
      </div>

      <div className="mt-auto border-t border-gray-200 px-5 py-4">
        <span className="text-[12px] text-gray-400">Tip: press Esc to close</span>
      </div>
    </>
  );
}

function MainRow({
  icon: Icon,
  label,
  badge,
  onClick,
}: {
  icon: typeof Filter;
  label: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f3f4f6] transition-colors group text-left"
    >
      <div className="flex items-center justify-center w-6 flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <span className="flex-1 text-[14px] font-medium text-gray-800">
        {label}
      </span>
      {badge && (
        <span className="text-[11px] font-medium text-[#a8893a] bg-[#c9a84c]/10 px-1.5 py-0.5 rounded">
          {badge}
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
    </button>
  );
}

// ─── Sub-view chrome ──────────────────────────────────────

function DrawerHeader({
  title,
  onCloseAction,
  closeKind,
}: {
  title: string;
  onCloseAction: () => void;
  closeKind: "back" | "close";
}) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
      <div className="flex items-center gap-2">
        {closeKind === "back" && (
          <button
            onClick={onCloseAction}
            className="flex items-center justify-center w-7 h-7 -ml-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-[18px] h-[18px]" />
          </button>
        )}
        <h2 className="text-[16px] font-semibold text-gray-900">{title}</h2>
      </div>
      {closeKind === "close" && (
        <button
          onClick={onCloseAction}
          className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <ChevronRight className="w-[18px] h-[18px]" />
        </button>
      )}
    </div>
  );
}

// ─── Columns sub-view ─────────────────────────────────────

function ColumnsView({
  onBack,
  hiddenColumns,
  onToggleColumn,
}: {
  onBack: () => void;
  hiddenColumns: Set<string>;
  onToggleColumn: (colId: string) => void;
}) {
  return (
    <>
      <DrawerHeader title="Show/hide columns" onCloseAction={onBack} closeKind="back" />
      <div className="px-5 pb-3">
        <p className="text-[12px] text-gray-500">
          Show, hide and reorder the columns in this view.
        </p>
      </div>
      <div className="px-2 pb-4 overflow-y-auto">
        {OPTIONAL_COLUMNS.map((col) => {
          const Icon = col.icon;
          const isVisible = !hiddenColumns.has(col.id);
          return (
            <button
              key={col.id}
              onClick={() => onToggleColumn(col.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f3f4f6] transition-colors text-left"
            >
              <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="flex-1 text-[14px] text-gray-800">
                {col.label}
              </span>
              <ToggleSwitch checked={isVisible} />
            </button>
          );
        })}
      </div>
    </>
  );
}

function ToggleSwitch({ checked }: { checked: boolean }) {
  return (
    <div
      className={cn(
        "relative w-9 h-5 rounded-full transition-colors flex-shrink-0",
        checked ? "bg-[#c9a84c]" : "bg-gray-300"
      )}
    >
      <div
        className={cn(
          "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        )}
      />
    </div>
  );
}

// ─── Filters sub-view (Asana "Add filter" picker) ─────────

function FiltersView({
  onBack,
  activeFilters,
  onActiveFiltersChange,
}: {
  onBack: () => void;
  activeFilters: ActiveFilter[];
  onActiveFiltersChange: (filters: ActiveFilter[]) => void;
}) {
  const [search, setSearch] = useState("");
  const existingFields = new Set(activeFilters.map((f) => f.field));
  const filtered = FILTER_FIELDS.filter((f) =>
    f.label.toLowerCase().includes(search.toLowerCase())
  );

  function handleAddFilter(field: FilterField) {
    const newFilter: ActiveFilter = {
      id: `filter-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      field,
      operator: FILTER_OPERATOR_DEFAULTS[field],
      value: "",
    };
    onActiveFiltersChange([...activeFilters, newFilter]);
    onBack();
  }

  function handleRemoveFilter(filterId: string) {
    onActiveFiltersChange(activeFilters.filter((f) => f.id !== filterId));
  }

  return (
    <>
      <DrawerHeader title="Add filter" onCloseAction={onBack} closeKind="back" />

      <div className="px-5 pb-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Filter by"
        />
      </div>

      <div className="overflow-y-auto flex-1">
        {activeFilters.length > 0 && (
          <div className="px-5 pb-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-2">
              Active
            </p>
            <div className="space-y-1">
              {activeFilters.map((f) => {
                const meta = FILTER_FIELDS.find((opt) => opt.field === f.field);
                const Icon = meta?.icon || Filter;
                return (
                  <div
                    key={f.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md bg-[#c9a84c]/10"
                  >
                    <Icon className="w-3.5 h-3.5 text-[#a8893a]" />
                    <span className="flex-1 text-[13px] text-gray-800 truncate">
                      {meta?.label || f.field}
                    </span>
                    <button
                      onClick={() => handleRemoveFilter(f.id)}
                      className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-gray-900 hover:bg-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-2">
          {activeFilters.length > 0 && (
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 px-3 pt-1 pb-1.5">
              Add more
            </p>
          )}
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-gray-400">
              No matching fields
            </p>
          )}
          {filtered.map((opt) => {
            const Icon = opt.icon;
            const alreadyAdded = existingFields.has(opt.field);
            return (
              <button
                key={opt.field}
                disabled={alreadyAdded}
                onClick={() => handleAddFilter(opt.field)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                  alreadyAdded
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-800 hover:bg-[#f3f4f6] cursor-pointer"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0 text-gray-500" />
                <span className="flex-1 text-[14px]">{opt.label}</span>
                {alreadyAdded && (
                  <span className="text-[11px] text-gray-300">Added</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Sort sub-view ────────────────────────────────────────

function SortView({
  onBack,
  sort,
  onSortChange,
}: {
  onBack: () => void;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = SORT_FIELDS.filter((f) =>
    f.label.toLowerCase().includes(search.toLowerCase())
  );

  function handlePick(field: Exclude<SortField, "none">) {
    const meta = SORT_FIELDS.find((f) => f.field === field);
    onSortChange({
      field,
      direction: meta?.defaultDirection || "asc",
    });
    onBack();
  }

  return (
    <>
      <DrawerHeader title="Sort by" onCloseAction={onBack} closeKind="back" />

      <div className="px-5 pb-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Sort by" />
      </div>

      <div className="overflow-y-auto flex-1">
        {sort.field !== "none" && (
          <div className="px-5 pb-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-2">
              Active
            </p>
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md bg-[#c9a84c]/10">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#a8893a]" />
              <span className="flex-1 text-[13px] text-gray-800">
                {SORT_FIELDS.find((f) => f.field === sort.field)?.label || sort.field}
              </span>
              <span className="text-[11px] text-gray-500 uppercase">
                {sort.direction}
              </span>
              <button
                onClick={() => onSortChange({ field: "none", direction: "asc" })}
                className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-gray-900 hover:bg-white"
                aria-label="Clear sort"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        <div className="px-2">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-gray-400">
              No matching fields
            </p>
          )}
          {filtered.map((opt) => {
            const Icon = opt.icon;
            const isActive = sort.field === opt.field;
            return (
              <button
                key={opt.field}
                onClick={() => handlePick(opt.field)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                  isActive
                    ? "bg-[#f3f4f6] text-gray-900"
                    : "text-gray-800 hover:bg-[#f3f4f6]"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0 text-gray-500" />
                <span className="flex-1 text-[14px]">{opt.label}</span>
                {isActive && (
                  <CheckCircle2 className="w-4 h-4 text-[#a8893a]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Groups sub-view ──────────────────────────────────────

function GroupsView({
  onBack,
  groups,
  onGroupsChange,
}: {
  onBack: () => void;
  groups: GroupConfig[];
  onGroupsChange: (groups: GroupConfig[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");

  const usedFields = new Set(groups.map((g) => g.field));
  const available = GROUP_FIELDS.filter(
    (f) =>
      !usedFields.has(f.field) &&
      f.label.toLowerCase().includes(search.toLowerCase())
  );

  function handleAdd(field: GroupField) {
    onGroupsChange([
      ...groups,
      {
        id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        field,
        order: "custom",
        hideEmpty: false,
      },
    ]);
    setAdding(false);
    setSearch("");
  }

  function handleRemove(groupId: string) {
    onGroupsChange(groups.filter((g) => g.id !== groupId));
  }

  function handleClearAll() {
    onGroupsChange([]);
    setAdding(false);
  }

  if (adding) {
    return (
      <>
        <DrawerHeader
          title="Add subgroup"
          onCloseAction={() => {
            setAdding(false);
            setSearch("");
          }}
          closeKind="back"
        />
        <div className="px-5 pb-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Group by"
          />
        </div>
        <div className="overflow-y-auto flex-1 px-2">
          {available.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-gray-400">
              No more fields to group by
            </p>
          )}
          {available.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.field}
                onClick={() => handleAdd(opt.field)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f3f4f6] transition-colors text-left"
              >
                <Icon className="w-4 h-4 flex-shrink-0 text-gray-500" />
                <span className="flex-1 text-[14px] text-gray-800">
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <>
      <DrawerHeader title="Groups" onCloseAction={onBack} closeKind="back" />

      <div className="px-5 pb-3 flex items-center justify-between">
        <p className="text-[12px] text-gray-500">
          Manage groups in this view.
        </p>
        {groups.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-[12px] text-gray-500 hover:text-gray-900"
          >
            Clear
          </button>
        )}
      </div>

      <div className="px-5 pb-3 space-y-1.5 overflow-y-auto flex-1">
        {groups.length === 0 && (
          <p className="text-[13px] text-gray-400 py-3">
            No groups applied. Add one below to bucket your tasks.
          </p>
        )}
        {groups.map((g) => {
          const meta = GROUP_FIELDS.find((opt) => opt.field === g.field);
          const Icon = meta?.icon || LayoutGrid;
          return (
            <div
              key={g.id}
              className="flex items-center gap-2 px-2 py-2 rounded-md border border-gray-200"
            >
              <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab" />
              <Icon className="w-3.5 h-3.5 text-gray-500" />
              <span className="flex-1 text-[13px] text-gray-800 truncate">
                {meta?.label || g.field}
              </span>
              <span className="text-[11px] text-gray-400 capitalize">
                {g.order}
              </span>
              <button
                onClick={() => handleRemove(g.id)}
                className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-900 hover:bg-gray-100"
                aria-label="Remove group"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 mt-1 text-[13px] text-[#a8893a] hover:bg-[#c9a84c]/10 rounded-md transition-colors"
          disabled={groups.length >= GROUP_FIELDS.length}
        >
          + {groups.length === 0 ? "Add group" : "Add subgroup"}
        </button>
      </div>
    </>
  );
}

// ─── Shared search input ──────────────────────────────────

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 pl-8 pr-3 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-black/10 placeholder:text-gray-400"
        autoFocus
      />
    </div>
  );
}

