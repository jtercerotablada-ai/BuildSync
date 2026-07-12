"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  ArrowDown,
  ArrowRight,
  CheckCircle,
  Users,
  MessageSquare,
  MoreHorizontal,
  User,
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
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  MOVE_TO_SECTION: <ArrowRight className="w-4 h-4" />,
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
    case "MOVE_TO_SECTION":
      return { type: "MOVE_TO_SECTION", sectionId: "" };
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export function WorkflowView({ sections, projectId }: WorkflowViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [workflow, setWorkflow] = useState<WorkflowRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Asana's builder is a wizard: one card is "active" at a time (blue
  // border, expanded suggestions, Previous/Next footer). Index 0 is the
  // intake card, 1..n the sections, n+1 the completion card. null =
  // nothing selected.
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [addingSection, setAddingSection] = useState(false);

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

  // ── Deep-link support: ?form=new or ?form=<formId> ─────────
  // Lets the Home FormsWidget (and anywhere else) jump into the
  // form builder for a specific project / form directly. Runs after
  // the initial forms fetch resolves so `forms` is populated when
  // we try to look up an existing form by id.
  useEffect(() => {
    const formParam = searchParams?.get("form");
    if (!formParam) return;
    if (formParam === "new") {
      setEditingForm(null);
      setFormDialogOpen(true);
    } else if (forms.length > 0) {
      const match = forms.find((f) => f.id === formParam);
      if (match) {
        setEditingForm(match);
        setFormDialogOpen(true);
      }
    }
    // Strip ?form so a subsequent close doesn't re-open the dialog.
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      if (u.searchParams.has("form")) {
        u.searchParams.delete("form");
        window.history.replaceState({}, "", u.toString());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, forms.length]);

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
      // Soft-delete (close) the form so its submissions are preserved, as the
      // confirm promises — a hard DELETE cascades-deletes every submission.
      const res = await fetch(`/api/forms/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
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

  // ── Section management from the builder (Asana's "…" menu + drag) ──
  const renameSection = async (sectionId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`/api/sections/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error();
      toast.success("Section renamed");
      router.refresh();
    } catch {
      toast.error("Failed to rename section");
    }
  };

  const deleteSection = async (sectionId: string, taskCount: number) => {
    if (
      !confirm(
        taskCount > 0
          ? `Delete this section and its ${taskCount} task${taskCount === 1 ? "" : "s"}?`
          : "Delete this section?"
      )
    )
      return;
    try {
      const res = await fetch(`/api/sections/${sectionId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Section deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete section");
    }
  };

  // Drag-to-reorder stages (Asana's builder allows dragging cards).
  const dragSecId = useRef<string | null>(null);
  const reorderSection = async (sectionId: string, position: number) => {
    try {
      const res = await fetch(`/api/sections/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position }),
      });
      if (!res.ok) throw new Error();
      toast.success("Section moved");
      router.refresh();
    } catch {
      toast.error("Failed to move section");
    }
  };

  // "+ Add section" pill and the "+" circles on the connectors —
  // appends a real section (same API the List view uses).
  const addSection = async () => {
    if (addingSection) return;
    setAddingSection(true);
    try {
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New section", projectId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Section added");
      router.refresh();
    } catch {
      toast.error("Failed to add section");
    } finally {
      setAddingSection(false);
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

  // Remove a SINGLE action chip. Each chip is one action of a rule that may
  // bundle several (templates ship 2-4), so deleting the whole rule would
  // silently drop the sibling actions. PATCH the rule with the remaining
  // actions; only DELETE it when its last action is removed.
  const removeAction = async (ruleId: string, actionIdx: number) => {
    const rule = workflow?.rules.find((r) => r.id === ruleId);
    if (!rule) return;
    const remaining = (rule.actions as WorkflowAction[]).filter(
      (_, i) => i !== actionIdx
    );
    const snapshot = workflow;

    if (remaining.length === 0) {
      setWorkflow((prev) =>
        prev
          ? { ...prev, rules: prev.rules.filter((r) => r.id !== ruleId) }
          : prev
      );
    } else {
      setWorkflow((prev) =>
        prev
          ? {
              ...prev,
              rules: prev.rules.map((r) =>
                r.id === ruleId ? { ...r, actions: remaining } : r
              ),
            }
          : prev
      );
    }

    try {
      const res =
        remaining.length === 0
          ? await fetch(
              `/api/projects/${projectId}/workflow/rules/${ruleId}`,
              { method: "DELETE" }
            )
          : await fetch(
              `/api/projects/${projectId}/workflow/rules/${ruleId}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ actions: remaining }),
              }
            );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to remove action");
      }
      toast.success("Action removed");
    } catch (err) {
      setWorkflow(snapshot); // rollback
      toast.error(
        err instanceof Error ? err.message : "Failed to remove action"
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

  // Wizard indices: 0 = intake card, 1..sections.length = section cards,
  // sections.length + 1 = the completion card.
  const completionIdx = sections.length + 1;

  // "Move tasks to this section" trigger rules (completion-triggered
  // MOVE_TO_SECTION actions) shown in the slot above each stage.
  const moveTriggersFor = (sectionId: string) =>
    completionRules
      .flatMap((r) =>
        (r.actions as WorkflowAction[]).map((a, idx) => ({ rule: r, a, idx }))
      )
      .filter(
        (x) => x.a.type === "MOVE_TO_SECTION" && x.a.sectionId === sectionId
      )
      .map((x) => ({ ruleId: x.rule.id, actionIdx: x.idx }));

  return (
    <div
      className="h-full overflow-x-auto overflow-y-auto"
      style={{
        // Asana's builder canvas: dotted grid measured in the real app.
        backgroundImage: "radial-gradient(#C4C6C8 10%, #F2F3F4 10%)",
        backgroundSize: "20px 20px",
        backgroundColor: "#F2F3F4",
      }}
      onClick={() => setActiveIdx(null)}
    >
      <div className="min-h-full min-w-max px-8 pt-28 pb-10">
        {/* Main Layout — horizontal pipeline like Asana's builder */}
        <div className="flex items-start">
          {/* Intro heading on the canvas */}
          <div className="w-64 flex-shrink-0 pt-8 pr-8">
            <h1 className="text-[26px] leading-8 font-bold text-slate-900 mb-2">
              Create your workflow in minutes
            </h1>
            <p className="text-sm text-slate-600">
              Automate your team&apos;s processes and let the work flow.
            </p>
          </div>

          {/* Intake card */}
          <IntakeCard
            forms={forms}
            hasRules={(workflow?.rules.length ?? 0) > 0}
            active={activeIdx === 0}
            onSelect={() => setActiveIdx(0)}
            onNext={() => setActiveIdx(sections.length > 0 ? 1 : completionIdx)}
            onNewForm={() => {
              setEditingForm(null);
              setFormDialogOpen(true);
            }}
            onTemplates={() => setTemplatesOpen(true)}
            onPreviewForm={(f) => window.open(`/forms/${f.id}`, "_blank")}
            onCopyLink={(f) => copyFormLink(f.id)}
            onInbox={(f) => setSubmissionsForm(f)}
            onEditForm={(f) => {
              setEditingForm(f);
              setFormDialogOpen(true);
            }}
            onDeleteForm={(f) => handleFormDelete(f.id)}
          />

          <Connector onAdd={addSection} />

          {/* Section cards with connectors */}
          {sections.map((section, index) => (
            <div key={section.id} className="flex items-start">
              <SectionCard
                section={section}
                rules={rulesBySection[section.id] || []}
                position={
                  index === 0
                    ? "first"
                    : index === sections.length - 1
                      ? "last"
                      : "middle"
                }
                active={activeIdx === index + 1}
                onSelect={() => setActiveIdx(index + 1)}
                onPrev={() => setActiveIdx(index)}
                onNext={() => setActiveIdx(index + 2)}
                onAddAction={(type) => startAddAction(section.id, type)}
                onRemoveAction={removeAction}
                moveTriggers={moveTriggersFor(section.id)}
                onAddMoveTrigger={() =>
                  commitAction(
                    { kind: "completion" },
                    { type: "MOVE_TO_SECTION", sectionId: section.id }
                  )
                }
                onRename={(name) => renameSection(section.id, name)}
                onDelete={() =>
                  deleteSection(section.id, section.tasks.length)
                }
                onDragStart={() => {
                  dragSecId.current = section.id;
                }}
                onDropOn={() => {
                  const dragged = dragSecId.current;
                  dragSecId.current = null;
                  if (dragged && dragged !== section.id) {
                    reorderSection(dragged, index);
                  }
                }}
              />
              <Connector onAdd={addSection} />
            </div>
          ))}

          {/* Project-wide completion card — fires when ANY task in the
              project flips to completed. Real automation, presented in
              the same card language as the section stages. */}
          <CompletionCard
            rules={completionRules}
            active={activeIdx === completionIdx}
            onSelect={() => setActiveIdx(completionIdx)}
            onPrev={() => setActiveIdx(sections.length)}
            onDone={() => setActiveIdx(null)}
            onAddAction={startAddCompletionAction}
            onRemoveAction={removeAction}
          />

          {/* "+ Add section" pill at the end of the pipeline */}
          <div className="flex-shrink-0 pt-8 pl-6 pr-10">
            <button
              type="button"
              disabled={addingSection}
              onClick={(e) => {
                e.stopPropagation();
                addSection();
              }}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-white border border-[#C4C6C8] text-sm text-slate-900 hover:bg-slate-50 shadow-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add section
            </button>
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
        onDeleted={(formId) =>
          setForms((prev) => prev.filter((f) => f.id !== formId))
        }
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
// SHARED CARD PRIMITIVES — Asana's builder card language (measured in
// the real app): 360px white cards, 8px radius, #E0E1E3 ring (blue
// #335FB5 when active), 48px rows — solid #F2F3F4 fill for configured
// items, dashed #C4C6C8 for suggestions.
// ============================================

const CARD_BASE =
  "w-[360px] flex-shrink-0 bg-white rounded-lg p-4 cursor-pointer shadow-sm";

function cardBorder(active: boolean) {
  return active ? "border border-[#335FB5]" : "border border-[#E0E1E3]";
}

const DASHED_ROW =
  "w-full h-12 rounded-lg border border-dashed border-[#C4C6C8] flex items-center gap-2.5 px-3 text-sm text-[#626364] hover:border-[#626364] hover:text-slate-800 text-left";

function FilledRow({
  icon,
  label,
  onRemove,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <div className="h-12 rounded-lg border border-[#E0E1E3] bg-[#F2F3F4] flex items-center gap-2.5 px-3 text-sm text-slate-800 group/row">
      <span className="text-[#626364] flex-shrink-0">{icon}</span>
      <span className="flex-1 truncate text-left">{label}</span>
      {onRemove && (
        <button
          type="button"
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 group-hover/row:opacity-100 p-1 rounded hover:bg-slate-200 text-slate-500"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function DashedRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={DASHED_ROW}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function WizardFooter({
  onPrev,
  onNext,
  nextLabel = "Next",
}: {
  onPrev?: () => void;
  onNext: () => void;
  nextLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mt-4 pt-3">
      {onPrev ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="text-sm text-slate-700 hover:underline"
        >
          Previous
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        className="h-8 px-3 rounded-[6px] bg-[#4273D1] hover:bg-[#335FB5] text-white text-sm"
      >
        {nextLabel}
      </button>
    </div>
  );
}

// Connector between pipeline cards: 1px #C4C6C8 line with a 28px "+"
// circle that inserts a section (Asana's builder affordance).
function Connector({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex items-center flex-shrink-0 pt-[38px]">
      <div className="w-4 h-px bg-[#C4C6C8]" />
      <button
        type="button"
        title="Add section"
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className="w-7 h-7 rounded-full border border-[#626364] bg-transparent hover:bg-white flex items-center justify-center text-[#626364] flex-shrink-0"
      >
        <Plus className="w-4 h-4" />
      </button>
      <div className="w-4 h-px bg-[#C4C6C8]" />
    </div>
  );
}

// ============================================
// INTAKE CARD — "How will tasks be added to this project?"
// Manual + forms (real intake) + templates + apps. Forms keep their
// full management surface via the row menu (preview / copy link /
// submissions inbox / edit / delete).
// ============================================

interface IntakeCardProps {
  forms: FormRow[];
  hasRules: boolean;
  active: boolean;
  onSelect: () => void;
  onNext: () => void;
  onNewForm: () => void;
  onTemplates: () => void;
  onPreviewForm: (f: FormRow) => void;
  onCopyLink: (f: FormRow) => void;
  onInbox: (f: FormRow) => void;
  onEditForm: (f: FormRow) => void;
  onDeleteForm: (f: FormRow) => void;
}

function FormRowItem({
  form,
  onPreview,
  onCopyLink,
  onInbox,
  onEdit,
  onDelete,
}: {
  form: FormRow;
  onPreview: () => void;
  onCopyLink: () => void;
  onInbox: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="w-full h-12 rounded-lg border border-[#E0E1E3] bg-[#F2F3F4] hover:bg-[#E8E9EA] flex items-center gap-2.5 px-3 text-sm text-slate-800 text-left"
        >
          <FileText className="w-4 h-4 text-[#626364] flex-shrink-0" />
          <span className="flex-1 truncate">{form.name}</span>
          <span className="text-xs text-slate-500 flex-shrink-0">
            {form.submissionCount ?? 0}{" "}
            {form.submissionCount === 1 ? "response" : "responses"}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuItem onClick={onPreview} className="gap-2">
          <Eye className="w-4 h-4" />
          Preview
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCopyLink} className="gap-2">
          <LinkIcon className="w-4 h-4" />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onInbox} className="gap-2">
          <Inbox className="w-4 h-4" />
          Submissions
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit} className="gap-2">
          <Pencil className="w-4 h-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="gap-2 text-black">
          <Trash2 className="w-4 h-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IntakeOption({
  icon,
  name,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  name: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="w-full rounded-lg border border-[#E0E1E3] p-3 flex items-start gap-3 hover:border-[#626364] text-left"
    >
      <span className="flex-shrink-0 mt-0.5">{icon}</span>
      <span>
        <span className="block text-sm font-medium text-slate-900">
          {name}
        </span>
        <span className="block text-xs text-slate-500 leading-snug mt-0.5">
          {desc}
        </span>
      </span>
    </button>
  );
}

function IntakeCard({
  forms,
  hasRules,
  active,
  onSelect,
  onNext,
  onNewForm,
  onTemplates,
  onPreviewForm,
  onCopyLink,
  onInbox,
  onEditForm,
  onDeleteForm,
}: IntakeCardProps) {
  // First-run (nothing configured anywhere) or explicitly selected →
  // show the expanded "Más opciones" gallery like Asana.
  const expanded = active || (forms.length === 0 && !hasRules);

  return (
    <div
      className={cn(CARD_BASE, cardBorder(active))}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <h3 className="text-[20px] leading-6 font-medium text-slate-900 text-center px-3 mb-4">
        How will tasks be added to this project?
      </h3>

      {expanded ? (
        <>
          <div className="rounded-lg bg-[#F2F3F4] p-3 flex items-start gap-2 text-xs text-slate-600 mb-4">
            <Info className="w-4 h-4 flex-shrink-0 text-slate-500" />
            <span>
              Anyone with access to this project can add tasks manually.
            </span>
          </div>

          {forms.length > 0 && (
            <div className="space-y-2 mb-4">
              {forms.map((f) => (
                <FormRowItem
                  key={f.id}
                  form={f}
                  onPreview={() => onPreviewForm(f)}
                  onCopyLink={() => onCopyLink(f)}
                  onInbox={() => onInbox(f)}
                  onEdit={() => onEditForm(f)}
                  onDelete={() => onDeleteForm(f)}
                />
              ))}
            </div>
          )}

          <p className="text-xs text-[#626364] mb-2">More options</p>
          <div className="space-y-2">
            <IntakeOption
              icon={<FileText className="w-6 h-6 text-[#4573D2]" />}
              name="Form submissions"
              desc="Create a form that turns submissions into tasks"
              onClick={onNewForm}
            />
            <IntakeOption
              icon={<Zap className="w-6 h-6 text-[#4573D2]" />}
              name="Task templates"
              desc="Standardize tasks with ready-made rule bundles"
              onClick={onTemplates}
            />
            <IntakeOption
              icon={<LinkIcon className="w-6 h-6 text-[#4573D2]" />}
              name="From other apps"
              desc="Choose the apps your team uses to create tasks"
              onClick={() => toast.info("App integrations coming soon")}
            />
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <FilledRow
            icon={<Pencil className="w-4 h-4" />}
            label="Manually"
          />
          {forms.map((f) => (
            <FormRowItem
              key={f.id}
              form={f}
              onPreview={() => onPreviewForm(f)}
              onCopyLink={() => onCopyLink(f)}
              onInbox={() => onInbox(f)}
              onEdit={() => onEditForm(f)}
              onDelete={() => onDeleteForm(f)}
            />
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className={DASHED_ROW}
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span>Intake source</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={onNewForm} className="gap-2">
                <FileText className="w-4 h-4" />
                Form
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onTemplates} className="gap-2">
                <Zap className="w-4 h-4" />
                Task template
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast.info("App integrations coming soon")}
                className="gap-2"
              >
                <LinkIcon className="w-4 h-4" />
                App
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {active && <WizardFooter onNext={onNext} />}
    </div>
  );
}

// ============================================
// SECTION CARD — one workflow stage. Suggestions are position-aware
// like Asana (first: assignee; middle: collaborators/comment; last:
// complete/add-to-project); the active card expands the full list.
// ============================================

const SUGGESTIONS_BY_POSITION: Record<
  "first" | "middle" | "last",
  WorkflowActionType[]
> = {
  first: ["SET_ASSIGNEE", "ADD_COLLABORATORS"],
  middle: ["ADD_COLLABORATORS", "ADD_COMMENT"],
  last: ["MARK_COMPLETE", "ADD_TO_PROJECT"],
};

const ACTIVE_SUGGESTIONS: WorkflowActionType[] = [
  "SET_ASSIGNEE",
  "ADD_COLLABORATORS",
  "ADD_COMMENT",
  "SET_PRIORITY",
  "ADD_SUBTASK",
];

interface SectionCardProps {
  section: Section;
  rules: WorkflowRuleRow[];
  position: "first" | "middle" | "last";
  active: boolean;
  onSelect: () => void;
  onPrev: () => void;
  onNext: () => void;
  onAddAction: (type: WorkflowActionType) => void;
  onRemoveAction: (ruleId: string, actionIdx: number) => void;
  /** Completion-triggered MOVE_TO_SECTION rules targeting this stage. */
  moveTriggers: { ruleId: string; actionIdx: number }[];
  onAddMoveTrigger: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDropOn: () => void;
}

function SectionCard({
  section,
  rules,
  position,
  active,
  onSelect,
  onPrev,
  onNext,
  onAddAction,
  onRemoveAction,
  moveTriggers,
  onAddMoveTrigger,
  onRename,
  onDelete,
  onDragStart,
  onDropOn,
}: SectionCardProps) {
  const [renamingName, setRenamingName] = useState<string | null>(null);
  const incompleteCount = section.tasks.filter((t) => !t.completed).length;

  const ruleChips = rules.flatMap((r) =>
    (r.actions as WorkflowAction[]).map((a, idx) => ({
      ruleId: r.id,
      actionIdx: idx,
      type: a.type,
    }))
  );
  const configured = new Set(ruleChips.map((c) => c.type));
  // Active card expands the list but keeps the position-specific
  // suggestions on top (Asana shows "Finalizar tarea" on the last
  // stage even when expanded).
  const suggestions = (
    active
      ? [
          ...SUGGESTIONS_BY_POSITION[position],
          ...ACTIVE_SUGGESTIONS.filter(
            (t) => !SUGGESTIONS_BY_POSITION[position].includes(t)
          ),
        ]
      : SUGGESTIONS_BY_POSITION[position]
  ).filter((t) => !configured.has(t));
  const menuActions = PICKABLE_ACTIONS.filter((t) => !configured.has(t));

  return (
    <div className="relative">
      {/* "Add a trigger to move tasks to this section" slot — floats
          above the ACTIVE card exactly like Asana's builder. */}
      {active && (
        <div
          className="absolute bottom-full left-0 w-[360px] pb-1"
          onClick={(e) => e.stopPropagation()}
        >
          {moveTriggers.length > 0 ? (
            <FilledRow
              icon={<ArrowRight className="w-4 h-4" />}
              label="Task completed → moved here"
              onRemove={() =>
                onRemoveAction(
                  moveTriggers[0].ruleId,
                  moveTriggers[0].actionIdx
                )
              }
            />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded-lg border border-dashed border-[#C4C6C8] bg-white/60 px-3 py-2.5 text-xs text-[#626364] hover:border-[#626364] hover:text-slate-800 text-left"
                >
                  Add a trigger to move tasks to this section
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuItem onClick={onAddMoveTrigger} className="gap-2">
                  <CheckCircle className="w-4 h-4" />
                  When a task is completed
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <div className="flex justify-center text-[#626364]">
            <ArrowDown className="w-4 h-4" />
          </div>
        </div>
      )}

      <div
        className={cn(CARD_BASE, cardBorder(active))}
        draggable
        onDragStart={onDragStart}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onDropOn();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
      {/* Header — eyebrow + name + Asana's "…" menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[#626364] mb-0.5">Section</p>
          {renamingName !== null ? (
            <input
              autoFocus
              value={renamingName}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setRenamingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onRename(renamingName);
                  setRenamingName(null);
                }
                if (e.key === "Escape") setRenamingName(null);
              }}
              onBlur={() => {
                if (renamingName.trim() && renamingName !== section.name) {
                  onRename(renamingName);
                }
                setRenamingName(null);
              }}
              className="w-full text-base font-medium text-slate-900 bg-transparent outline-none border-b-2 border-[#335FB5]"
            />
          ) : (
            <h3
              className="text-base font-medium text-slate-900 truncate"
              title={section.name}
            >
              {section.name}
            </h3>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex-shrink-0"
              title="Section options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => setRenamingName(section.name)}
              className="gap-2"
            >
              <Pencil className="w-4 h-4" />
              Rename section
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="gap-2 text-black">
              <Trash2 className="w-4 h-4" />
              Delete section
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Incomplete-tasks chip */}
      <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded bg-[#E8E9EA] text-xs text-slate-600 mt-2">
        <CheckCircle className="w-3 h-3" />
        {incompleteCount} incomplete {incompleteCount === 1 ? "task" : "tasks"}
      </span>

      {/* Trigger prompt */}
      <p className="text-xs text-[#626364] mt-4 mb-3">
        What actions should trigger automatically when tasks move to this
        section?
      </p>

      {/* Configured rules (solid) + suggestions (dashed) */}
      <div className="space-y-2">
        {ruleChips.map((chip) => (
          <FilledRow
            key={`${chip.ruleId}-${chip.actionIdx}`}
            icon={ACTION_ICONS[chip.type]}
            label={ACTION_LABELS[chip.type]}
            onRemove={() => onRemoveAction(chip.ruleId, chip.actionIdx)}
          />
        ))}
        {suggestions.map((t) => (
          <DashedRow
            key={t}
            icon={ACTION_ICONS[t]}
            label={ACTION_LABELS[t]}
            onClick={() => onAddAction(t)}
          />
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className={DASHED_ROW}
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>More actions</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {menuActions.map((type) => (
              <DropdownMenuItem
                key={type}
                onClick={() => onAddAction(type)}
                className="gap-2"
              >
                <span className="text-[#626364]">{ACTION_ICONS[type]}</span>
                {ACTION_LABELS[type]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {active && <WizardFooter onPrev={onPrev} onNext={onNext} />}
      </div>
    </div>
  );
}

// ============================================
// COMPLETION CARD — project-wide rules that fire when any task is
// marked complete, regardless of which section it's in. Presented in
// the same Asana card language as the section stages.
// ============================================

interface CompletionCardProps {
  rules: WorkflowRuleRow[];
  active: boolean;
  onSelect: () => void;
  onPrev: () => void;
  onDone: () => void;
  onAddAction: (type: WorkflowActionType) => void;
  onRemoveAction: (ruleId: string, actionIdx: number) => void;
}

function CompletionCard({
  rules,
  active,
  onSelect,
  onPrev,
  onDone,
  onAddAction,
  onRemoveAction,
}: CompletionCardProps) {
  const ruleChips = rules
    .flatMap((r) =>
      (r.actions as WorkflowAction[]).map((a, idx) => ({
        ruleId: r.id,
        actionIdx: idx,
        type: a.type,
      }))
    )
    // MOVE_TO_SECTION completion rules render on their target
    // section's trigger slot, not here.
    .filter((c) => c.type !== "MOVE_TO_SECTION");
  const configured = new Set(ruleChips.map((c) => c.type));
  // MARK_COMPLETE is meaningless on an already-completed trigger.
  const suggestions = (["ADD_COMMENT", "ADD_TO_PROJECT"] as WorkflowActionType[]).filter(
    (t) => !configured.has(t)
  );
  const menuActions = PICKABLE_ACTIONS.filter(
    (t) => t !== "MARK_COMPLETE" && !configured.has(t)
  );

  return (
    <div
      className={cn(CARD_BASE, cardBorder(active))}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <p className="text-xs text-[#626364] mb-0.5">Trigger</p>
      <h3 className="text-base font-medium text-slate-900">On completion</h3>

      <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded bg-[#E8E9EA] text-xs text-slate-600 mt-2">
        <Zap className="w-3 h-3" />
        Any section
      </span>

      <p className="text-xs text-[#626364] mt-4 mb-3">
        What actions should trigger automatically when any task in this
        project is completed?
      </p>

      <div className="space-y-2">
        {ruleChips.map((chip) => (
          <FilledRow
            key={`${chip.ruleId}-${chip.actionIdx}`}
            icon={ACTION_ICONS[chip.type]}
            label={ACTION_LABELS[chip.type]}
            onRemove={() => onRemoveAction(chip.ruleId, chip.actionIdx)}
          />
        ))}
        {suggestions.map((t) => (
          <DashedRow
            key={t}
            icon={ACTION_ICONS[t]}
            label={ACTION_LABELS[t]}
            onClick={() => onAddAction(t)}
          />
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className={DASHED_ROW}
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>More actions</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {menuActions.map((type) => (
              <DropdownMenuItem
                key={type}
                onClick={() => onAddAction(type)}
                className="gap-2"
              >
                <span className="text-[#626364]">{ACTION_ICONS[type]}</span>
                {ACTION_LABELS[type]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {active && <WizardFooter onPrev={onPrev} onNext={onDone} nextLabel="Done" />}
    </div>
  );
}
