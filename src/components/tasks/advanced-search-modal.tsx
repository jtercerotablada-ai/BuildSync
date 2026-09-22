"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

// Only criteria the My Tasks list can actually apply. "Include subtasks"
// and "Located in" used to be offered too, but My Tasks never lists
// subtasks and has no other location, so they could not narrow anything
// while looking like they did.
export interface AdvancedSearchCriteria {
  words: string;
  /** "task" = any type; the Include boxes then narrow it. */
  type: "task" | "milestone" | "approval";
  includeMilestones: boolean;
  includeApprovals: boolean;
  status: "any" | "incomplete" | "complete";
  assignees: string[];
  dueDate: "any" | "today" | "this_week" | "next_week" | "overdue" | "no_date";
  collaborators: string;
}

interface AdvancedSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (criteria: AdvancedSearchCriteria) => void;
}

// ─── Defaults ────────────────────────────────────────────

function getDefaults(): AdvancedSearchCriteria {
  return {
    words: "",
    type: "task",
    includeMilestones: true,
    includeApprovals: true,
    status: "any",
    assignees: [],
    dueDate: "any",
    collaborators: "",
  };
}

// ─── Component ───────────────────────────────────────────

export function AdvancedSearchModal({
  open,
  onOpenChange,
  onSearch,
}: AdvancedSearchModalProps) {
  const [criteria, setCriteria] = useState<AdvancedSearchCriteria>(getDefaults);
  // Name typed in "Assigned to" but not yet confirmed with Enter.
  const [assigneeDraft, setAssigneeDraft] = useState("");

  function handleReset() {
    setCriteria(getDefaults());
    setAssigneeDraft("");
  }

  function handleSearch() {
    // A name still in the box counts: dropping it silently searched for
    // everyone while the user could see the name they had typed.
    const draft = assigneeDraft.trim();
    const assignees =
      draft && !criteria.assignees.includes(draft)
        ? [...criteria.assignees, draft]
        : criteria.assignees;
    onSearch({
      ...criteria,
      words: criteria.words.trim(),
      collaborators: criteria.collaborators.trim(),
      assignees,
    });
    setCriteria((prev) => ({ ...prev, assignees }));
    setAssigneeDraft("");
    onOpenChange(false);
  }

  function update(partial: Partial<AdvancedSearchCriteria>) {
    setCriteria((prev) => ({ ...prev, ...partial }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[560px] p-0 gap-0 rounded-xl"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <DialogHeader className="p-0">
            <DialogTitle className="text-[16px] font-semibold text-gray-900">
              Advanced search
            </DialogTitle>
          </DialogHeader>
          <button
            onClick={() => onOpenChange(false)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Contains the words */}
          <FieldRow label="Contains the words">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={criteria.words}
                onChange={(e) => update({ words: e.target.value })}
                placeholder="Type keywords..."
                className="flex-1 h-9 px-3 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-black/10 placeholder:text-gray-400"
              />
              {criteria.words && (
                <button
                  onClick={() => update({ words: "" })}
                  className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>
          </FieldRow>

          {/* Type */}
          <FieldRow label="Type">
            <Select
              value={criteria.type}
              onValueChange={(v) =>
                update({ type: v as AdvancedSearchCriteria["type"] })
              }
            >
              <SelectTrigger className="h-9 text-[13px] w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">Any</SelectItem>
                <SelectItem value="milestone">Milestone</SelectItem>
                <SelectItem value="approval">Approval</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          {/* Include — only meaningful while Type is Any */}
          {criteria.type === "task" && (
            <FieldRow label="Include">
              <div className="flex items-center gap-5">
                <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                  <Checkbox
                    checked={criteria.includeMilestones}
                    onCheckedChange={(v) =>
                      update({ includeMilestones: v === true })
                    }
                  />
                  Milestones
                </label>
                <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                  <Checkbox
                    checked={criteria.includeApprovals}
                    onCheckedChange={(v) =>
                      update({ includeApprovals: v === true })
                    }
                  />
                  Approvals
                </label>
              </div>
            </FieldRow>
          )}

          {/* Status */}
          <FieldRow label="Status">
            <Select
              value={criteria.status}
              onValueChange={(v) =>
                update({ status: v as AdvancedSearchCriteria["status"] })
              }
            >
              <SelectTrigger className="h-9 text-[13px] w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="incomplete">Incomplete</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          {/* Assigned to */}
          <FieldRow label="Assigned to">
            <div className="flex flex-wrap items-center gap-1.5 min-h-[36px] px-3 py-1.5 border border-gray-200 rounded-lg bg-white">
              {criteria.assignees.map((name, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-[12px] text-gray-700 rounded-md"
                >
                  {name}
                  <button
                    onClick={() =>
                      update({
                        assignees: criteria.assignees.filter(
                          (_, i) => i !== idx
                        ),
                      })
                    }
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={assigneeDraft}
                onChange={(e) => setAssigneeDraft(e.target.value)}
                placeholder={
                  criteria.assignees.length === 0 ? "Type a name, press Enter" : ""
                }
                className="flex-1 min-w-[80px] text-[13px] outline-none bg-transparent placeholder:text-gray-400"
                onKeyDown={(e) => {
                  const name = assigneeDraft.trim();
                  if (e.key === "Enter" && name) {
                    e.preventDefault();
                    if (!criteria.assignees.includes(name)) {
                      update({ assignees: [...criteria.assignees, name] });
                    }
                    setAssigneeDraft("");
                  }
                }}
              />
            </div>
          </FieldRow>

          {/* Due date */}
          <FieldRow label="Due date">
            <Select
              value={criteria.dueDate}
              onValueChange={(v) =>
                update({ dueDate: v as AdvancedSearchCriteria["dueDate"] })
              }
            >
              <SelectTrigger className="h-9 text-[13px] w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this_week">This week</SelectItem>
                <SelectItem value="next_week">Next week</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="no_date">No date</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          {/* Collaborators */}
          <FieldRow label="Collaborators">
            <input
              type="text"
              value={criteria.collaborators}
              onChange={(e) => update({ collaborators: e.target.value })}
              placeholder="Search collaborators..."
              className="w-full h-9 px-3 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-black/10 placeholder:text-gray-400"
            />
          </FieldRow>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <div className="flex items-center gap-4">
            <button
              onClick={handleReset}
              className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Reset filters
            </button>
          </div>
          <button
            onClick={handleSearch}
            className="flex items-center gap-1.5 px-4 h-9 bg-gray-900 text-white text-[13px] font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            Search
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ─────────────────────────────────────────────

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 items-start">
      <label className="text-[13px] text-gray-500 font-medium pt-2">
        {label}
      </label>
      <div>{children}</div>
    </div>
  );
}
