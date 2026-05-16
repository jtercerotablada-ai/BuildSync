"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  FileText,
  Link2 as LinkIcon,
  Pencil,
  Trash2,
  Flag,
  Zap,
  Inbox,
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
import {
  WorkflowActionDialog,
  actionNeedsConfig,
} from "@/components/views/workflow-action-dialog";
import { FormBuilderDialog } from "@/components/views/form-builder-dialog";
import { FormSubmissionsDialog } from "@/components/views/form-submissions-dialog";
import { WorkflowTemplatesDialog } from "@/components/views/workflow-templates-dialog";
import type { FormRow } from "@/lib/form-types";

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
  SET_PRIORITY: <Flag className="w-4 h-4" />,
  ADD_SUBTASK: <CheckCircle className="w-4 h-4" />,
};

const PICKABLE_ACTIONS: WorkflowActionType[] = [
  "SET_ASSIGNEE",
  "ADD_COLLABORATORS",
  "ADD_COMMENT",
  "MARK_COMPLETE",
  "ADD_TO_PROJECT",
  "SET_PRIORITY",
  "ADD_SUBTASK",
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
    case "SET_PRIORITY":
      return { type: "SET_PRIORITY", priority: "MEDIUM" };
    case "ADD_SUBTASK":
      return { type: "ADD_SUBTASK", name: "Follow up" };
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export function WorkflowView({ sections, projectId }: WorkflowViewProps) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState<WorkflowRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Action-configuration dialog state. When the user picks an action
  // type that needs config (assignee, comment template, project, etc.)
  // we open this dialog instead of POSTing a placeholder rule. Only
  // MARK_COMPLETE bypasses the dialog because it has no targets to
  // pick.
  // `target` is "section:<id>" for per-section rules or "completion"
  // for the project-wide "When task is completed" rules. Both flows
  // share the same dialog; only the trigger written on the rule
  // changes.
  const [pendingAction, setPendingAction] = useState<{
    target: { kind: "section"; sectionId: string } | { kind: "completion" };
    actionType: WorkflowActionType;
  } | null>(null);

  // Forms (Phase 3 source). Loaded once on mount alongside the
  // workflow so the Sources panel can render counts + public links
  // without a second round trip.
  const [forms, setForms] = useState<FormRow[]>([]);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<FormRow | null>(null);
  const [submissionsForm, setSubmissionsForm] = useState<FormRow | null>(null);

  // Engineering rule templates — one-click bundles that create rules
  // and any missing sections. Modal is reachable from the heading
  // and the empty-state CTA.
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // ── Refetch helpers ─────────────────────────────────────────
  // Pulled out so the templates dialog can refresh after applying.
  const reloadWorkflow = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/workflow`);
      if (!res.ok) throw new Error("Failed to load workflow");
      const data: WorkflowRow = await res.json();
      setWorkflow(data);
      setShowOnboarding(data.rules.length === 0);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load workflow"
      );
    }
  }, [projectId]);

  // ── Initial fetch ───────────────────────────────────────────
  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      try {
        const [wfRes, formsRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/workflow`),
          fetch(`/api/projects/${projectId}/forms`),
        ]);
        if (!wfRes.ok) throw new Error("Failed to load workflow");
        const wfData: WorkflowRow = await wfRes.json();
        if (!canceled) {
          setWorkflow(wfData);
          setShowOnboarding(wfData.rules.length === 0);
        }
        if (formsRes.ok) {
          const formsData: FormRow[] = await formsRes.json();
          if (!canceled && Array.isArray(formsData)) setForms(formsData);
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

  // ── Group rules by section (for per-section cards) AND collect
  //    project-wide TASK_COMPLETED rules into their own bucket so
  //    the "On completion" card can show them separately.
  const rulesBySection: Record<string, WorkflowRuleRow[]> = {};
  const completionRules: WorkflowRuleRow[] = [];
  for (const rule of workflow?.rules || []) {
    const t = rule.trigger;
    if (t?.type === "TASK_MOVED_TO_SECTION") {
      if (!rulesBySection[t.sectionId]) rulesBySection[t.sectionId] = [];
      rulesBySection[t.sectionId].push(rule);
    } else if (t?.type === "TASK_COMPLETED") {
      completionRules.push(rule);
    }
  }

  // ── Mutations ──────────────────────────────────────────────

  // Entry point from the per-section "+ Add action" menu. If the
  // action needs config (assignee, comment template, project), we
  // open the dialog; if not (MARK_COMPLETE), we POST directly.
  const startAddAction = (
    sectionId: string,
    actionType: WorkflowActionType
  ) => {
    if (!actionNeedsConfig(actionType)) {
      commitAction(
        { kind: "section", sectionId },
        makeDefaultAction(actionType)
      );
      return;
    }
    setPendingAction({
      target: { kind: "section", sectionId },
      actionType,
    });
  };

  // Same entry point but for the project-wide "When task completed"
  // rules card.
  const startAddCompletionAction = (actionType: WorkflowActionType) => {
    if (!actionNeedsConfig(actionType)) {
      commitAction(
        { kind: "completion" },
        makeDefaultAction(actionType)
      );
      return;
    }
    setPendingAction({
      target: { kind: "completion" },
      actionType,
    });
  };

  // Actually POST a configured action. The trigger written on the
  // rule is derived from the target kind.
  const commitAction = async (
    target:
      | { kind: "section"; sectionId: string }
      | { kind: "completion" },
    action: WorkflowAction
  ) => {
    const trigger =
      target.kind === "section"
        ? { type: "TASK_MOVED_TO_SECTION" as const, sectionId: target.sectionId }
        : { type: "TASK_COMPLETED" as const };

    try {
      const res = await fetch(
        `/api/projects/${projectId}/workflow/rules`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger, actions: [action] }),
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
      toast.success(`${ACTION_LABELS[action.type]} configured`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add rule"
      );
    }
  };

  // ── Form mutations ──────────────────────────────────────────
  const handleFormSaved = (saved: FormRow) => {
    setForms((prev) => {
      const idx = prev.findIndex((f) => f.id === saved.id);
      if (idx === -1) return [saved, ...prev];
      const next = [...prev];
      next[idx] = saved;
      return next;
    });
    setEditingForm(null);
  };

  const handleFormDelete = async (formId: string) => {
    if (!confirm("Delete this form? Past submissions are kept but new ones will be rejected.")) {
      return;
    }
    const snapshot = forms;
    setForms((prev) => prev.filter((f) => f.id !== formId));
    try {
      const res = await fetch(`/api/forms/${formId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to delete form");
      }
      toast.success("Form deleted");
    } catch (err) {
      setForms(snapshot);
      toast.error(err instanceof Error ? err.message : "Failed to delete form");
    }
  };

  const copyFormLink = (formId: string) => {
    const url = `${window.location.origin}/forms/${formId}`;
    navigator.clipboard.writeText(url);
    toast.success("Public form link copied");
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
            {/* Active: rules run automatically the moment a task
                lands in this section (via List drag, Board drop,
                Timeline edit, or PATCH on any other view). */}
            <p className="text-[11px] text-[#a8893a] mt-3 leading-snug">
              ⓘ Rules fire automatically when a task is moved into
              the matching section, from any view.
            </p>
            {/* Engineering templates — one-click bundles for common
                AEC handoffs (calc review, permitting, RFI cycle…). */}
            <button
              type="button"
              onClick={() => setTemplatesOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium text-[#1e1f21] bg-[#fbeed3] hover:bg-[#f4dfa8] border border-[#e9d287] transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-[#7a5b1b]" />
              {workflow?.rules.length === 0
                ? "Start with a template"
                : "Add from template"}
            </button>
          </div>

          {/* Sources panel — Forms section (Phase 3). Always visible
              since forms are an ongoing config, not just onboarding.
              Empty state matches the old "How will tasks be added"
              card when there are no forms yet. */}
          <div className="flex-shrink-0">
            <div className="w-72 bg-white rounded-lg border shadow-sm">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Sources
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingForm(null);
                      setFormDialogOpen(true);
                    }}
                    className="text-[11px] text-[#a8893a] hover:text-[#8a7028] font-medium"
                  >
                    + New form
                  </button>
                </div>

                <div className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg text-xs mb-3">
                  <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-600">
                    Anyone with the form's link can submit a task.
                    Submissions land in the first section, then your
                    workflow rules take over.
                  </p>
                </div>

                {forms.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-3">
                    No forms yet. Create one and share its public link.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {forms.map((f) => (
                      <li
                        key={f.id}
                        className="border rounded-md p-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-1.5 min-w-0">
                            <FileText className="w-3.5 h-3.5 text-[#a8893a] flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">
                                {f.name}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {f.submissionCount ?? 0} submission
                                {f.submissionCount === 1 ? "" : "s"}
                                {!f.isActive && " · inactive"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setSubmissionsForm(f)}
                              title="View submissions"
                              className="p-1 text-slate-400 hover:text-black hover:bg-slate-100 rounded"
                            >
                              <Inbox className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => copyFormLink(f.id)}
                              title="Copy public link"
                              className="p-1 text-slate-400 hover:text-black hover:bg-slate-100 rounded"
                            >
                              <LinkIcon className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingForm(f);
                                setFormDialogOpen(true);
                              }}
                              title="Edit form"
                              className="p-1 text-slate-400 hover:text-black hover:bg-slate-100 rounded"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFormDelete(f.id)}
                              title="Delete form"
                              className="p-1 text-slate-400 hover:text-black hover:bg-slate-100 rounded"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {showOnboarding && forms.length === 0 && (
                  <div className="mt-3 flex justify-center">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setShowOnboarding(false)}
                    >
                      Got it
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Connector from Sources to Sections */}
          <div className="flex items-center self-start mt-[88px]">
            <div className="w-4 h-px bg-slate-300" />
            <div className="w-7 h-7 rounded-full border-2 border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 flex-shrink-0">
              <Plus className="w-4 h-4" />
            </div>
            <div className="w-4 h-px bg-slate-300" />
          </div>

          {/* Section cards with connectors */}
          <div className="flex items-start flex-1">
            {sections.map((section, index) => (
              <div key={section.id} className="flex items-start">
                <SectionCard
                  section={section}
                  rules={rulesBySection[section.id] || []}
                  onAddAction={(type) => startAddAction(section.id, type)}
                  onRemoveRule={removeRule}
                />
                {index < sections.length - 1 && (
                  <div className="flex items-center self-center h-full py-16">
                    <div className="w-4 h-px bg-slate-300" />
                  </div>
                )}
              </div>
            ))}

            {/* Connector + project-wide completion card. Fires
                whenever ANY task on this project flips to
                completed (regardless of section). */}
            {sections.length > 0 && (
              <div className="flex items-center self-center h-full py-16">
                <div className="w-4 h-px bg-slate-300" />
              </div>
            )}
            <CompletionCard
              rules={completionRules}
              onAddAction={startAddCompletionAction}
              onRemoveRule={removeRule}
            />
          </div>
        </div>
      </div>

      {/* Action configuration dialog — opens when the picked action
          needs targets (assignee, collaborators, comment template,
          project). MARK_COMPLETE skips this dialog and commits
          straight from startAddAction. */}
      <WorkflowActionDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        actionType={pendingAction?.actionType ?? null}
        projectId={projectId}
        onConfirm={(action) => {
          if (pendingAction) {
            commitAction(pendingAction.target, action);
            setPendingAction(null);
          }
        }}
      />

      {/* Form builder — create / edit a form (Phase 3 source). */}
      <FormBuilderDialog
        open={formDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setFormDialogOpen(false);
            setEditingForm(null);
          }
        }}
        projectId={projectId}
        initial={editingForm}
        onSaved={handleFormSaved}
      />

      {/* Submissions inbox per form (Phase 4.B). Opens the list of
          past submissions with a deep-link to the task each one
          generated. */}
      <FormSubmissionsDialog
        open={submissionsForm !== null}
        onOpenChange={(open) => {
          if (!open) setSubmissionsForm(null);
        }}
        form={submissionsForm}
        onOpenTask={(taskId) => {
          // Navigate to the project's task — opens via /tasks/[id]
          // which redirects to the right project view + slide-over.
          window.open(`/tasks/${taskId}`, "_blank");
        }}
      />

      {/* Engineering workflow templates — one-click rule bundles.
          After apply we reload the local workflow (rules show
          immediately) and call router.refresh() so the parent
          re-fetches `project.sections` and the new section cards
          render in the rail without a full page reload. */}
      <WorkflowTemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        projectId={projectId}
        onApplied={() => {
          reloadWorkflow();
          router.refresh();
        }}
      />
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

// ============================================
// COMPLETION CARD — project-wide rules that fire when any task
// is marked complete, regardless of which section it's in.
// ============================================

interface CompletionCardProps {
  rules: WorkflowRuleRow[];
  onAddAction: (type: WorkflowActionType) => void;
  onRemoveRule: (ruleId: string) => void;
}

function CompletionCard({
  rules,
  onAddAction,
  onRemoveRule,
}: CompletionCardProps) {
  const ruleChips = rules.flatMap((r) =>
    (r.actions as WorkflowAction[]).map((a, idx) => ({
      ruleId: r.id,
      actionIdx: idx,
      type: a.type,
    }))
  );

  return (
    <div className="w-52 flex-shrink-0 bg-white rounded-lg border border-[#c9a84c]/40 shadow-sm">
      <div className="p-3 border-b bg-[#c9a84c]/[0.04]">
        <div className="flex items-center gap-1.5 mb-1">
          <Zap className="w-3.5 h-3.5 text-[#a8893a]" />
          <span className="text-xs text-[#a8893a] font-semibold uppercase tracking-wider">
            Trigger
          </span>
        </div>
        <h3 className="font-semibold text-slate-900 text-sm">
          On completion
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Fires when any task in this project is marked complete.
        </p>
      </div>

      <div className="p-3">
        <div className="space-y-1">
          {ruleChips.length === 0 && (
            <div className="text-center py-3 text-xs text-slate-400">
              No completion rules configured
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
