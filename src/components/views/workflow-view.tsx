"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  CheckCircle,
  Users,
  MessageSquare,
  User,
  MoreHorizontal,
  X,
  Info,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  type WorkflowAction,
  type WorkflowActionType,
  type WorkflowRow,
  type WorkflowRuleRow,
  ACTION_LABELS,
} from "@/lib/workflow-types";

// ============================================
// TYPES
// ============================================

interface Task {
  id: string;
  name: string;
  completed: boolean;
}

interface Section {
  id: string;
  name: string;
  position: number;
  tasks: Task[];
}

interface WorkflowViewProps {
  sections: Section[];
  projectId: string;
}

// ============================================
// ACTION PICKER METADATA
// ============================================

const ACTION_ICONS: Record<WorkflowActionType, React.ReactNode> = {
  SET_ASSIGNEE: <User className="w-4 h-4" />,
  ADD_COLLABORATORS: <Users className="w-4 h-4" />,
  ADD_COMMENT: <MessageSquare className="w-4 h-4" />,
  MARK_COMPLETE: <CheckCircle className="w-4 h-4" />,
  ADD_TO_PROJECT: <Plus className="w-4 h-4" />,
};

const PICKABLE_ACTIONS: WorkflowActionType[] = [
  "SET_ASSIGNEE",
  "ADD_COLLABORATORS",
  "ADD_COMMENT",
  "MARK_COMPLETE",
  "ADD_TO_PROJECT",
];

/**
 * Stub-out action defaults for Phase 1 — we persist a placeholder so
 * the rule is real in the DB. Phase 2 will add a per-action config
 * sheet (pick assignee, write the comment template, choose project,
 * etc.). Until then the rule exists structurally but action targets
 * still need a follow-up edit before they can fire.
 */
function makeDefaultAction(type: WorkflowActionType): WorkflowAction {
  switch (type) {
    case "SET_ASSIGNEE":
      return { type: "SET_ASSIGNEE", userId: null };
    case "ADD_COLLABORATORS":
      return { type: "ADD_COLLABORATORS", userIds: [] };
    case "ADD_COMMENT":
      return {
        type: "ADD_COMMENT",
        content: "Task moved into this section",
      };
    case "MARK_COMPLETE":
      return { type: "MARK_COMPLETE" };
    case "ADD_TO_PROJECT":
      return { type: "ADD_TO_PROJECT", projectId: "" };
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export function WorkflowView({ sections, projectId }: WorkflowViewProps) {
  const [workflow, setWorkflow] = useState<WorkflowRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // ── Initial fetch ───────────────────────────────────────────
  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/workflow`);
        if (!res.ok) throw new Error("Failed to load workflow");
        const data: WorkflowRow = await res.json();
        if (!canceled) {
          setWorkflow(data);
          // Show onboarding only when the project has no rules yet —
          // matches "first time" UX without forcing a dismissable
          // toggle that breaks on refresh.
          setShowOnboarding(data.rules.length === 0);
        }
      } catch (err) {
        if (!canceled) {
          toast.error(
            err instanceof Error ? err.message : "Failed to load workflow"
          );
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [projectId]);

  // ── Group rules by section for the per-card render ─────────
  const rulesBySection = (workflow?.rules || []).reduce<
    Record<string, WorkflowRuleRow[]>
  >((acc, rule) => {
    if (rule.trigger?.type !== "TASK_MOVED_TO_SECTION") return acc;
    const sid = rule.trigger.sectionId;
    if (!acc[sid]) acc[sid] = [];
    acc[sid].push(rule);
    return acc;
  }, {});

  // ── Mutations ──────────────────────────────────────────────
  const addAction = async (
    sectionId: string,
    actionType: WorkflowActionType
  ) => {
    try {
      const action = makeDefaultAction(actionType);
      const res = await fetch(
        `/api/projects/${projectId}/workflow/rules`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trigger: { type: "TASK_MOVED_TO_SECTION", sectionId },
            actions: [action],
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to add rule");
      }
      const created: WorkflowRuleRow = await res.json();
      setWorkflow((prev) =>
        prev ? { ...prev, rules: [...prev.rules, created] } : prev
      );
      toast.success(`${ACTION_LABELS[actionType]} added`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add rule"
      );
    }
  };

  const removeRule = async (ruleId: string) => {
    // Optimistic: remove from UI immediately, roll back on failure.
    const snapshot = workflow;
    setWorkflow((prev) =>
      prev
        ? { ...prev, rules: prev.rules.filter((r) => r.id !== ruleId) }
        : prev
    );
    try {
      const res = await fetch(
        `/api/projects/${projectId}/workflow/rules/${ruleId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to delete rule");
      }
      toast.success("Rule removed");
    } catch (err) {
      setWorkflow(snapshot); // rollback
      toast.error(
        err instanceof Error ? err.message : "Failed to delete rule"
      );
    }
  };

  // ── Render states ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-x-auto overflow-y-auto bg-white">
      <div className="min-h-full min-w-max p-6">
        {/* Main Layout */}
        <div className="flex items-start gap-4">
          {/* Left: heading + status */}
          <div className="w-56 flex-shrink-0 pt-8">
            <h1 className="text-xl font-bold text-slate-900 mb-2">
              {workflow?.rules.length === 0
                ? "Create your workflow in minutes"
                : "Workflow"}
            </h1>
            <p className="text-sm text-slate-500">
              {workflow?.rules.length === 0
                ? "Automate your team's process. Pick an action for any section — it persists and runs when tasks move there."
                : `${workflow?.rules.length} rule${
                    workflow?.rules.length === 1 ? "" : "s"
                  } configured.`}
            </p>
            {/* Phase-2 disclosure: actions persist now, but the
                trigger engine ships in the next phase. We say it
                out loud so the user knows what to expect. */}
            <p className="text-[11px] text-[#a8893a] mt-3 leading-snug">
              ⓘ Rules persist but only fire automatically once Phase 2
              (the trigger engine) ships. For now they're configuration
              you can audit before turning on.
            </p>
          </div>

          {/* Onboarding panel (only when no rules) */}
          {showOnboarding && (
            <>
              <div className="flex-shrink-0">
                <div className="w-72 bg-white rounded-lg border shadow-sm">
                  <div className="p-4">
                    <h2 className="text-sm font-semibold text-slate-900 text-center mb-3">
                      How will tasks be added to this project?
                    </h2>

                    <div className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg text-xs mb-3">
                      <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      <p className="text-slate-600">
                        Anyone with access to this project can add tasks
                        manually. Form-based sources land in a later
                        phase.
                      </p>
                    </div>

                    <div className="mt-4 flex justify-center">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setShowOnboarding(false)}
                      >
                        Got it
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Connector */}
              <div className="flex items-center self-start mt-[88px]">
                <div className="w-4 h-px bg-slate-300" />
                <div className="w-7 h-7 rounded-full border-2 border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                <div className="w-4 h-px bg-slate-300" />
              </div>
            </>
          )}

          {/* Section cards with connectors */}
          <div className="flex items-start flex-1">
            {sections.map((section, index) => (
              <div key={section.id} className="flex items-start">
                <SectionCard
                  section={section}
                  rules={rulesBySection[section.id] || []}
                  onAddAction={(type) => addAction(section.id, type)}
                  onRemoveRule={removeRule}
                />
                {index < sections.length - 1 && (
                  <div className="flex items-center self-center h-full py-16">
                    <div className="w-4 h-px bg-slate-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SECTION CARD
// ============================================

interface SectionCardProps {
  section: Section;
  rules: WorkflowRuleRow[];
  onAddAction: (type: WorkflowActionType) => void;
  onRemoveRule: (ruleId: string) => void;
}

function SectionCard({
  section,
  rules,
  onAddAction,
  onRemoveRule,
}: SectionCardProps) {
  const incompleteCount = section.tasks.filter((t) => !t.completed).length;

  // Each rule's first action drives the display chip. Phase 2 will
  // surface configurable per-action targets (the userId, comment
  // template, etc.).
  const ruleChips = rules.flatMap((r) =>
    (r.actions as WorkflowAction[]).map((a, idx) => ({
      ruleId: r.id,
      actionIdx: idx,
      type: a.type,
    }))
  );

  return (
    <div className="w-52 flex-shrink-0 bg-white rounded-lg border">
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">Section</span>
          <button className="p-1 hover:bg-slate-100 rounded text-slate-300 cursor-default">
            <MoreHorizontal className="w-3 h-3" />
          </button>
        </div>
        <h3 className="font-semibold text-slate-900 text-sm truncate" title={section.name}>
          {section.name}
        </h3>
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-black" />
          {incompleteCount} incomplete {incompleteCount === 1 ? "task" : "tasks"}
        </p>
      </div>

      {/* Trigger prompt */}
      <div className="p-3 border-b">
        <p className="text-xs text-slate-500">
          What actions should trigger automatically when tasks move to
          this section?
        </p>
      </div>

      {/* Configured rules */}
      <div className="p-3">
        <div className="space-y-1">
          {ruleChips.length === 0 && (
            <div className="text-center py-3 text-xs text-slate-400">
              No automations configured
            </div>
          )}
          {ruleChips.map((chip) => (
            <div
              key={`${chip.ruleId}-${chip.actionIdx}`}
              className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded text-xs group"
            >
              <span className="text-[#a8893a]">{ACTION_ICONS[chip.type]}</span>
              <span className="text-slate-700 flex-1">
                {ACTION_LABELS[chip.type]}
              </span>
              <button
                onClick={() => onRemoveRule(chip.ruleId)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 rounded transition-all"
                aria-label="Remove rule"
              >
                <X className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          ))}
        </div>

        {/* Add-action dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
              <Plus className="w-3 h-3" />
              Add action
              <ChevronDown className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {PICKABLE_ACTIONS.map((type) => (
              <DropdownMenuItem
                key={type}
                onClick={() => onAddAction(type)}
                className="gap-2"
              >
                <span className="text-[#a8893a]">{ACTION_ICONS[type]}</span>
                {ACTION_LABELS[type]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
