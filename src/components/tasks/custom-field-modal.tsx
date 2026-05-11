"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  X,
  Search,
  ChevronDown,
  Check,
  Type,
  Hash,
  Calendar,
  List,
  ToggleLeft,
  Users,
  Sparkles,
  FileText,
  Flag,
  AlertTriangle,
  Zap,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────

type TabId = "create" | "library" | "ai_studio";

interface FieldType {
  id: string;
  label: string;
  icon: typeof Type;
  description: string;
}

interface AIFieldCard {
  id: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
  badge?: string;
}

export interface CreatedFieldInfo {
  name: string;
  type: string;
  color: string;
}

interface CustomFieldModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFieldType?: string;
  initialFieldName?: string;
  initialTab?: TabId;
  onFieldCreated?: (field: CreatedFieldInfo) => void;
}

// ─── Field type options ──────────────────────────────────

const FIELD_TYPES: FieldType[] = [
  { id: "text", label: "Text", icon: Type, description: "Free text field" },
  { id: "number", label: "Number", icon: Hash, description: "Numeric value" },
  { id: "date", label: "Date", icon: Calendar, description: "Date picker" },
  { id: "single_select", label: "Dropdown", icon: List, description: "Select an option" },
  { id: "multi_select", label: "Multi-select", icon: List, description: "Select multiple options" },
  { id: "checkbox", label: "Checkbox", icon: ToggleLeft, description: "Yes or no" },
  { id: "people", label: "People", icon: Users, description: "Select people" },
];

// ─── Color options ───────────────────────────────────────

const FIELD_COLORS = [
  { id: "none", color: "transparent", label: "No color" },
  { id: "red", color: "#E5484D", label: "Red" },
  { id: "orange", color: "#F76B15", label: "Orange" },
  { id: "yellow", color: "#F5D90A", label: "Yellow" },
  { id: "green", color: "#46A758", label: "Green" },
  { id: "blue", color: "#0090FF", label: "Blue" },
  { id: "purple", color: "#8E4EC6", label: "Purple" },
  { id: "pink", color: "#E93D82", label: "Pink" },
];

// ─── AI Studio cards ─────────────────────────────────────

const AI_FIELD_CARDS: AIFieldCard[] = [
  {
    id: "task_summary",
    title: "Task summary",
    description: "Automatically summarizes the task description and comments.",
    icon: FileText,
    badge: "AI",
  },
  {
    id: "priority",
    title: "Smart priority",
    description: "Suggests priority based on due date and description.",
    icon: Flag,
    badge: "AI",
  },
  {
    id: "risk",
    title: "Risk assessment",
    description: "Identifies potential risks or blockers in the task.",
    icon: AlertTriangle,
    badge: "AI",
  },
  {
    id: "next_steps",
    title: "Next steps",
    description: "Generates suggested next steps from task context.",
    icon: Zap,
    badge: "AI",
  },
  {
    id: "effort",
    title: "Effort estimation",
    description: "Estimates the effort needed to complete the task.",
    icon: Star,
    badge: "AI",
  },
  {
    id: "category",
    title: "Auto-categorization",
    description: "Automatically classifies the task into the appropriate category.",
    icon: Sparkles,
    badge: "AI",
  },
];

// ─── Tabs ────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: "create", label: "Create" },
  { id: "library", label: "From library" },
  { id: "ai_studio", label: "AI Studio fields" },
];

// ─── CustomFieldModal ────────────────────────────────────

export function CustomFieldModal({
  open,
  onOpenChange,
  initialFieldType,
  initialFieldName,
  initialTab,
  onFieldCreated,
}: CustomFieldModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("create");
  const [fieldTitle, setFieldTitle] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [fieldColor, setFieldColor] = useState("none");
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [onlyForThisProject, setOnlyForThisProject] = useState(false);
  const [addToAllNewTasks, setAddToAllNewTasks] = useState(true);
  const [librarySearch, setLibrarySearch] = useState("");

  // Pre-fill from props when the modal opens
  useEffect(() => {
    if (!open) return;
    if (initialTab) setActiveTab(initialTab);
    if (initialFieldType) {
      // Map the field-types.ts id to the local FIELD_TYPES id (they may differ)
      const match = FIELD_TYPES.find((ft) => ft.id === initialFieldType);
      if (match) setFieldType(match.id);
    }
    if (initialFieldName) setFieldTitle(initialFieldName);
  }, [open, initialTab, initialFieldType, initialFieldName]);

  function handleCreate() {
    if (!fieldTitle.trim()) {
      toast.error("Field name is required");
      return;
    }
    onFieldCreated?.({ name: fieldTitle.trim(), type: fieldType, color: fieldColor });
    toast.success(`Field "${fieldTitle}" created`);
    resetAndClose();
  }

  function handleAddFromLibrary(fieldName: string) {
    onFieldCreated?.({ name: fieldName, type: "text", color: "none" });
    toast.success(`Field "${fieldName}" added from library`);
    resetAndClose();
  }

  function handleAddAIField(card: AIFieldCard) {
    toast.success(`AI field "${card.title}" added`);
    resetAndClose();
  }

  function resetAndClose() {
    setFieldTitle("");
    setFieldType("text");
    setFieldColor("none");
    setShowTypeDropdown(false);
    setOnlyForThisProject(false);
    setAddToAllNewTasks(true);
    setLibrarySearch("");
    setActiveTab("create");
    onOpenChange(false);
  }

  const selectedType = FIELD_TYPES.find((t) => t.id === fieldType)!;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[520px] p-0 gap-0 rounded-xl border-0 shadow-[0_16px_48px_rgba(0,0,0,0.16)] overflow-hidden">
        <DialogTitle className="sr-only">Add custom field</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-[16px] font-semibold text-gray-900">Add custom field</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center px-6 border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-3 py-2.5 text-[13px] border-b-2 -mb-px transition-colors",
                activeTab === tab.id
                  ? "text-gray-900 border-gray-900 font-medium"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-6 py-4">
          {activeTab === "create" && (
            <CreateTab
              fieldTitle={fieldTitle}
              onFieldTitleChange={setFieldTitle}
              fieldType={fieldType}
              onFieldTypeChange={setFieldType}
              fieldColor={fieldColor}
              onFieldColorChange={setFieldColor}
              showTypeDropdown={showTypeDropdown}
              onShowTypeDropdownChange={setShowTypeDropdown}
              onlyForThisProject={onlyForThisProject}
              onOnlyForThisProjectChange={setOnlyForThisProject}
              addToAllNewTasks={addToAllNewTasks}
              onAddToAllNewTasksChange={setAddToAllNewTasks}
              selectedType={selectedType}
            />
          )}
          {activeTab === "library" && (
            <LibraryTab
              search={librarySearch}
              onSearchChange={setLibrarySearch}
              onAddField={handleAddFromLibrary}
            />
          )}
          {activeTab === "ai_studio" && (
            <AIStudioTab onAddField={handleAddAIField} />
          )}
        </div>

        {/* Footer — only for Create tab */}
        {activeTab === "create" && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 h-8 text-[13px] font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="px-4 h-8 text-[13px] font-medium text-white bg-black hover:bg-gray-800 rounded-md transition-colors"
            >
              Create field
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Tab ──────────────────────────────────────────

function CreateTab({
  fieldTitle,
  onFieldTitleChange,
  fieldType,
  onFieldTypeChange,
  fieldColor,
  onFieldColorChange,
  showTypeDropdown,
  onShowTypeDropdownChange,
  onlyForThisProject,
  onOnlyForThisProjectChange,
  addToAllNewTasks,
  onAddToAllNewTasksChange,
  selectedType,
}: {
  fieldTitle: string;
  onFieldTitleChange: (v: string) => void;
  fieldType: string;
  onFieldTypeChange: (v: string) => void;
  fieldColor: string;
  onFieldColorChange: (v: string) => void;
  showTypeDropdown: boolean;
  onShowTypeDropdownChange: (v: boolean) => void;
  onlyForThisProject: boolean;
  onOnlyForThisProjectChange: (v: boolean) => void;
  addToAllNewTasks: boolean;
  onAddToAllNewTasksChange: (v: boolean) => void;
  selectedType: FieldType;
}) {
  const SelectedIcon = selectedType.icon;

  return (
    <div className="space-y-4">
      {/* Field title */}
      <div>
        <label className="block text-[12px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Field title
        </label>
        <input
          type="text"
          value={fieldTitle}
          onChange={(e) => onFieldTitleChange(e.target.value)}
          placeholder="e.g., Status, Priority, Sprint..."
          className="w-full h-9 px-3 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black/10 placeholder:text-gray-400 transition-shadow"
          autoFocus
        />
      </div>

      {/* Field type */}
      <div>
        <label className="block text-[12px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Field type
        </label>
        <div className="relative">
          <button
            onClick={() => onShowTypeDropdownChange(!showTypeDropdown)}
            className="w-full flex items-center justify-between h-9 px-3 text-[13px] border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <SelectedIcon className="w-4 h-4 text-gray-500" />
              {selectedType.label}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {showTypeDropdown && (
            <div className="absolute left-0 top-[calc(100%+4px)] w-full bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100/60 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              {FIELD_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = type.id === fieldType;
                return (
                  <button
                    key={type.id}
                    onClick={() => {
                      onFieldTypeChange(type.id);
                      onShowTypeDropdownChange(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 h-9 text-[13px] transition-colors text-left",
                      isSelected
                        ? "text-gray-900 font-medium bg-black/[0.03]"
                        : "text-gray-700 hover:bg-black/[0.04]"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 flex-shrink-0", isSelected ? "text-gray-700" : "text-gray-400")} />
                    <div className="flex-1">
                      <span>{type.label}</span>
                      <span className="text-[11px] text-gray-400 ml-2">{type.description}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Color */}
      <div>
        <label className="block text-[12px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Color
        </label>
        <div className="flex items-center gap-1.5">
          {FIELD_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => onFieldColorChange(c.id)}
              className={cn(
                "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all",
                fieldColor === c.id
                  ? "border-gray-900 scale-110"
                  : "border-gray-200 hover:border-gray-400"
              )}
              title={c.label}
            >
              {c.id === "none" ? (
                <div className="w-4 h-4 rounded-full border border-dashed border-gray-300" />
              ) : (
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Checkboxes */}
      <div className="space-y-2.5 pt-1">
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <button
            onClick={() => onOnlyForThisProjectChange(!onlyForThisProject)}
            className={cn(
              "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
              onlyForThisProject
                ? "bg-black border-black"
                : "border-gray-300 group-hover:border-gray-400"
            )}
          >
            {onlyForThisProject && <Check className="w-3 h-3 text-white" />}
          </button>
          <span className="text-[13px] text-gray-700">Only for this project</span>
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer group">
          <button
            onClick={() => onAddToAllNewTasksChange(!addToAllNewTasks)}
            className={cn(
              "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
              addToAllNewTasks
                ? "bg-black border-black"
                : "border-gray-300 group-hover:border-gray-400"
            )}
          >
            {addToAllNewTasks && <Check className="w-3 h-3 text-white" />}
          </button>
          <span className="text-[13px] text-gray-700">Add to all new tasks</span>
        </label>
      </div>
    </div>
  );
}

// ─── Library Tab ─────────────────────────────────────────

const LIBRARY_FIELDS = [
  { id: "status", name: "Status", type: "Dropdown", usedBy: 12 },
  { id: "priority", name: "Priority", type: "Dropdown", usedBy: 8 },
  { id: "sprint", name: "Sprint", type: "Dropdown", usedBy: 5 },
  { id: "effort", name: "Effort", type: "Number", usedBy: 3 },
  { id: "department", name: "Department", type: "Dropdown", usedBy: 6 },
  { id: "cost", name: "Cost", type: "Number", usedBy: 2 },
  { id: "stage", name: "Stage", type: "Dropdown", usedBy: 4 },
  { id: "tags", name: "Tags", type: "Multi-select", usedBy: 7 },
];

function LibraryTab({
  search,
  onSearchChange,
  onAddField,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  onAddField: (fieldName: string) => void;
}) {
  const filtered = LIBRARY_FIELDS.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search fields..."
          className="w-full h-9 pl-9 pr-3 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black/10 placeholder:text-gray-400"
        />
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Filter:</span>
        <button className="px-2 h-6 text-[11px] font-medium text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
          All
        </button>
        <button className="px-2 h-6 text-[11px] text-gray-500 rounded-full hover:bg-gray-100 transition-colors">
          Text
        </button>
        <button className="px-2 h-6 text-[11px] text-gray-500 rounded-full hover:bg-gray-100 transition-colors">
          Number
        </button>
        <button className="px-2 h-6 text-[11px] text-gray-500 rounded-full hover:bg-gray-100 transition-colors">
          List
        </button>
      </div>

      {/* Field list */}
      <div className="max-h-[280px] overflow-auto -mx-1">
        {filtered.length > 0 ? (
          filtered.map((field) => (
            <button
              key={field.id}
              onClick={() => onAddField(field.name)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-black/[0.03] transition-colors text-left group"
            >
              <div>
                <div className="text-[13px] font-medium text-gray-900">{field.name}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {field.type} &middot; Used in {field.usedBy} {field.usedBy === 1 ? "project" : "projects"}
                </div>
              </div>
              <span className="text-[12px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                + Add
              </span>
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-[13px] text-gray-500">No fields found</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Try a different search term</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AI Studio Tab ───────────────────────────────────────

function AIStudioTab({
  onAddField,
}: {
  onAddField: (card: AIFieldCard) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-gray-500">
        AI fields are automatically filled with intelligent information based on task content.
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        {AI_FIELD_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => onAddField(card)}
              className="flex flex-col items-start p-3.5 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all text-left group"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-100 border border-gray-200 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-black" />
                </div>
                {card.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold text-black bg-gray-100 rounded-md">
                    {card.badge}
                  </span>
                )}
              </div>
              <span className="text-[13px] font-medium text-gray-900 mb-0.5">{card.title}</span>
              <span className="text-[11px] text-gray-400 leading-tight">{card.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
