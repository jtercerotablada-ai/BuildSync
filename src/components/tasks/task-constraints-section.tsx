"use client";

/**
 * TaskConstraintsSection — Lean Construction / Last Planner "make-ready"
 * constraints on a task. A task is READY when it has zero OPEN constraints.
 * Lets the user log each thing that must be cleared before the task can run
 * (material, permit, labor, design/RFI answer, …), with a responsible party
 * and a need-by date, then resolve them as they're removed.
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Check, Plus, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { dueDateToLocalMidnight } from "@/lib/date-only";

type ConstraintType =
  | "MATERIAL"
  | "PERMIT"
  | "LABOR"
  | "DESIGN"
  | "RFI"
  | "EQUIPMENT"
  | "INFORMATION"
  | "SUBMITTAL"
  | "SAFETY"
  | "OTHER";

const TYPE_LABELS: Record<ConstraintType, string> = {
  MATERIAL: "Material",
  PERMIT: "Permit",
  LABOR: "Labor",
  DESIGN: "Design",
  RFI: "RFI",
  EQUIPMENT: "Equipment",
  INFORMATION: "Information",
  SUBMITTAL: "Submittal",
  SAFETY: "Safety",
  OTHER: "Other",
};

const TYPE_ORDER: ConstraintType[] = [
  "MATERIAL",
  "PERMIT",
  "LABOR",
  "DESIGN",
  "RFI",
  "SUBMITTAL",
  "EQUIPMENT",
  "INFORMATION",
  "SAFETY",
  "OTHER",
];

interface MemberLite {
  id: string;
  name: string | null;
  email: string | null;
}

interface Constraint {
  id: string;
  type: ConstraintType;
  description: string;
  status: "OPEN" | "RESOLVED";
  needBy: string | null;
  resolvedAt: string | null;
  responsible: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

function fmtNeedBy(iso: string): { label: string; overdue: boolean } {
  const d = dueDateToLocalMidnight(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = d.getTime() < today.getTime();
  return {
    label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    overdue,
  };
}

export function TaskConstraintsSection({
  taskId,
  projectId,
  onChanged,
}: {
  taskId: string;
  projectId: string | null;
  onChanged?: () => void;
}) {
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberLite[]>([]);

  // Add-form state
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<ConstraintType>("MATERIAL");
  const [newDesc, setNewDesc] = useState("");
  const [newNeedBy, setNewNeedBy] = useState("");
  const [newResponsible, setNewResponsible] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/constraints`);
      if (res.ok) setConstraints(await res.json());
    } catch {
      /* silent — section just shows empty */
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  // Project members for the "responsible" picker.
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/members`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { user: MemberLite }[]) => {
        if (Array.isArray(rows)) setMembers(rows.map((r) => r.user));
      })
      .catch(() => {});
  }, [projectId]);

  const openCount = constraints.filter((c) => c.status === "OPEN").length;
  const isReady = openCount === 0;

  async function addConstraint() {
    if (!newDesc.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/constraints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newType,
          description: newDesc.trim(),
          needBy: newNeedBy || null,
          responsibleId: newResponsible || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add constraint");
      }
      const created: Constraint = await res.json();
      setConstraints((prev) => [...prev, created]);
      setNewDesc("");
      setNewNeedBy("");
      setNewResponsible("");
      setAdding(false);
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add constraint");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(c: Constraint) {
    const next = c.status === "OPEN" ? "RESOLVED" : "OPEN";
    const snapshot = constraints;
    setConstraints((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, status: next } : x))
    );
    try {
      const res = await fetch(
        `/api/tasks/${taskId}/constraints/${c.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        }
      );
      if (!res.ok) throw new Error();
      onChanged?.();
    } catch {
      setConstraints(snapshot);
      toast.error("Couldn't update constraint");
    }
  }

  async function remove(c: Constraint) {
    const snapshot = constraints;
    setConstraints((prev) => prev.filter((x) => x.id !== c.id));
    try {
      const res = await fetch(
        `/api/tasks/${taskId}/constraints/${c.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      onChanged?.();
    } catch {
      setConstraints(snapshot);
      toast.error("Couldn't delete constraint");
    }
  }

  return (
    <div className="px-5 py-3 border-t">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h4 className="text-[12px] font-medium text-[#6f7782]">Make-ready</h4>
          {!loading && (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-[0.5px]",
                isReady
                  ? "bg-[#c9a84c]/15 text-[#a8893a]"
                  : "bg-black/85 text-white"
              )}
              title={
                isReady
                  ? "No open constraints — task is ready to execute"
                  : `${openCount} open constraint${openCount > 1 ? "s" : ""} blocking this task`
              }
            >
              {isReady ? "Ready" : `Not ready · ${openCount}`}
            </span>
          )}
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-[12px] text-[#a8893a] hover:text-[#8a7028] font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Add constraint
          </button>
        )}
      </div>

      {/* List */}
      {constraints.length > 0 && (
        <ul className="space-y-1 mb-2">
          {constraints.map((c) => {
            const nb = c.needBy ? fmtNeedBy(c.needBy) : null;
            const resolved = c.status === "RESOLVED";
            return (
              <li
                key={c.id}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2 py-1.5 group",
                  resolved ? "bg-slate-50" : "bg-white border border-slate-100"
                )}
              >
                <button
                  onClick={() => toggleStatus(c)}
                  title={resolved ? "Reopen" : "Mark resolved"}
                  className={cn(
                    "mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border",
                    resolved
                      ? "bg-[#c9a84c] border-[#c9a84c] text-white"
                      : "border-slate-300 hover:border-[#a8893a]"
                  )}
                >
                  {resolved && <Check className="w-3 h-3" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.5px] text-[#a8893a] bg-[#c9a84c]/12 px-1.5 py-0.5 rounded">
                      {TYPE_LABELS[c.type]}
                    </span>
                    <span
                      className={cn(
                        "text-[13px] text-[#151b26]",
                        resolved && "line-through text-slate-400"
                      )}
                    >
                      {c.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                    {c.responsible && (
                      <span>
                        {c.responsible.name || c.responsible.email}
                      </span>
                    )}
                    {nb && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5",
                          !resolved && nb.overdue && "text-black font-medium"
                        )}
                      >
                        {!resolved && nb.overdue && (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        Need by {nb.label}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {resolved && (
                    <button
                      onClick={() => toggleStatus(c)}
                      title="Reopen"
                      className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => remove(c)}
                    title="Delete"
                    className="p-1 text-slate-400 hover:text-black rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {constraints.length === 0 && !adding && !loading && (
        <p className="text-[12px] text-slate-400 mb-1">
          No constraints — this task reads as ready.
        </p>
      )}

      {/* Add form */}
      {adding && (
        <div className="rounded-md border border-slate-200 p-2 space-y-2">
          <div className="flex gap-2">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as ConstraintType)}
              className="text-[13px] border border-slate-200 rounded px-2 py-1 bg-white"
            >
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <input
              autoFocus
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addConstraint();
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="What must be cleared? (e.g. rebar delivery, foundation permit)"
              className="flex-1 text-[13px] border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#c9a84c]"
            />
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <label className="text-[11px] text-slate-500">Need by</label>
            <input
              type="date"
              value={newNeedBy}
              onChange={(e) => setNewNeedBy(e.target.value)}
              className="text-[12px] border border-slate-200 rounded px-2 py-1"
            />
            <select
              value={newResponsible}
              onChange={(e) => setNewResponsible(e.target.value)}
              className="text-[12px] border border-slate-200 rounded px-2 py-1 bg-white"
            >
              <option value="">Responsible…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.email}
                </option>
              ))}
            </select>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setAdding(false)}
                className="text-[12px] text-slate-500 px-2 py-1"
              >
                Cancel
              </button>
              <button
                onClick={addConstraint}
                disabled={!newDesc.trim() || submitting}
                className="text-[12px] font-medium bg-[#a8893a] text-white px-3 py-1 rounded disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
