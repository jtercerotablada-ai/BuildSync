/**
 * Tiny formula evaluator for the FORMULA custom-field type.
 *
 * The field definition stores its expression in `options.formula` as
 * a structured object:
 *
 *   { leftFieldId: string, op: "+" | "-" | "*" | "/", rightFieldId: string }
 *
 * (Asana's visual builder is exactly two operands + one operator —
 * the "Editor avanzado" toggle exposes arbitrary expressions but we
 * keep MVP scoped to the binary form. Multi-step expressions can be
 * layered in by referencing a previously-computed FORMULA field as
 * an operand, since the recompute walks all formulas after each
 * upstream change.)
 *
 * Both operand field ids must point to NUMBER / CURRENCY /
 * PERCENTAGE / FORMULA / ROLLUP fields. Anything else evaluates to
 * `{ result: null }`. Division by zero returns `{ error: "Div/0" }`.
 *
 * The result is stored on the FORMULA field's CustomFieldValue row
 * as `{ result: number }` so the read-side CustomFieldCell renders
 * it without any client-side compute.
 */

import prisma from "@/lib/prisma";

export interface FormulaSpec {
  leftFieldId: string;
  op: "+" | "-" | "*" | "/";
  rightFieldId: string;
}

/** True if a value object is the structured formula spec. */
export function isFormulaSpec(v: unknown): v is FormulaSpec {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { leftFieldId?: unknown }).leftFieldId === "string" &&
    typeof (v as { rightFieldId?: unknown }).rightFieldId === "string" &&
    ["+", "-", "*", "/"].includes(String((v as { op?: unknown }).op))
  );
}

export type RollupFn = "sum" | "avg" | "min" | "max" | "count";

export interface RollupSpec {
  /** The custom field on the SUBTASKS whose values are aggregated. */
  sourceFieldId: string;
  fn: RollupFn;
}

/** True if a value object is a roll-up spec (aggregate a subtask field). */
export function isRollupSpec(v: unknown): v is RollupSpec {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { sourceFieldId?: unknown }).sourceFieldId === "string" &&
    ["sum", "avg", "min", "max", "count"].includes(
      String((v as { fn?: unknown }).fn)
    )
  );
}

/** Coerce any stored CustomFieldValue.value into a number for compute.
 *  DATE values (ISO strings) convert to a whole-day number so dates can
 *  be subtracted (date − date = days), matching Asana. */
function toNumber(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return raw;
  // FORMULA / ROLLUP store { result, error? } — pull result.
  if (
    typeof raw === "object" &&
    raw !== null &&
    "result" in raw &&
    typeof (raw as { result?: unknown }).result === "number"
  ) {
    return (raw as { result: number }).result;
  }
  if (typeof raw === "string") {
    // A date-like string → whole days since epoch (enables date math).
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const t = Date.parse(raw);
      if (!Number.isNaN(t)) return Math.floor(t / 86400000);
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ─── Multi-term expression (Asana "advanced" formula) ────────────
export type ExprToken =
  | { t: "field"; id: string }
  | { t: "num"; n: number }
  | { t: "op"; op: "+" | "-" | "*" | "/" };

/** New expression spec: { expr: ExprToken[] } — operand, op, operand, … */
export function isExprSpec(v: unknown): v is { expr: ExprToken[] } {
  return (
    typeof v === "object" &&
    v !== null &&
    Array.isArray((v as { expr?: unknown }).expr) &&
    (v as { expr: unknown[] }).expr.length > 0
  );
}

/**
 * Evaluate a token expression with standard precedence (× ÷ before + −),
 * left-to-right within a precedence level. Any missing operand → null
 * (clears the field). Division by zero → { error: "Div/0" }.
 */
export function evalExpr(
  tokens: ExprToken[],
  valueByField: Map<string, unknown>
): { result: number } | { error: string } | null {
  // Split into operand values + operators (tokens must alternate).
  const values: number[] = [];
  const ops: ("+" | "-" | "*" | "/")[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (i % 2 === 0) {
      // operand
      let v: number | null;
      if (tk.t === "num") v = Number.isFinite(tk.n) ? tk.n : null;
      else if (tk.t === "field") v = toNumber(valueByField.get(tk.id));
      else return null; // malformed
      if (v == null) return null; // missing operand → clear
      values.push(v);
    } else {
      if (tk.t !== "op") return null; // malformed
      ops.push(tk.op);
    }
  }
  if (values.length === 0) return null;
  // Pass 1 — × and ÷.
  const v1: number[] = [values[0]];
  const o1: ("+" | "-")[] = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const rhs = values[i + 1];
    if (op === "*") v1[v1.length - 1] = v1[v1.length - 1] * rhs;
    else if (op === "/") {
      if (rhs === 0) return { error: "Div/0" };
      v1[v1.length - 1] = v1[v1.length - 1] / rhs;
    } else {
      o1.push(op);
      v1.push(rhs);
    }
  }
  // Pass 2 — + and −.
  let acc = v1[0];
  for (let i = 0; i < o1.length; i++) {
    acc = o1[i] === "+" ? acc + v1[i + 1] : acc - v1[i + 1];
  }
  return { result: acc };
}

type ComputedFieldDef = { id: string; type: string; options: unknown };
type ComputedValue = { result: number } | { error: string };
type ComputedOutcome =
  | { kind: "skip" }
  | { kind: "clear" }
  | { kind: "set"; value: ComputedValue };

/**
 * Evaluate one FORMULA / ROLLUP field for one task. Pure, so the per-task
 * and the project-wide recompute share one definition of every operator.
 * `subtaskValues` is the roll-up source field's raw value on each subtask.
 */
function computeField(
  f: ComputedFieldDef,
  valueByField: Map<string, unknown>,
  subtaskValues: unknown[]
): ComputedOutcome {
  const spec = f.options;
  let result: ComputedValue | null = null;
  let clear = false;

  if (f.type === "ROLLUP" && isRollupSpec(spec)) {
    // Aggregate the source field across this task's subtasks.
    const nums = subtaskValues
      .map((v) => toNumber(v))
      .filter((n): n is number => n != null);
    switch (spec.fn) {
      case "sum":
        result = { result: nums.reduce((a, b) => a + b, 0) };
        break;
      case "count":
        result = { result: nums.length };
        break;
      case "avg":
        if (nums.length)
          result = { result: nums.reduce((a, b) => a + b, 0) / nums.length };
        else clear = true;
        break;
      case "min":
        if (nums.length) result = { result: Math.min(...nums) };
        else clear = true;
        break;
      case "max":
        if (nums.length) result = { result: Math.max(...nums) };
        else clear = true;
        break;
    }
  } else if (f.type === "FORMULA" && isExprSpec(spec)) {
    // Multi-term expression (fields + numbers + operators, precedence).
    const r = evalExpr(spec.expr, valueByField);
    if (r == null) clear = true;
    else result = r;
  } else if (f.type === "FORMULA" && isFormulaSpec(spec)) {
    // Legacy binary spec { leftFieldId, op, rightFieldId }.
    const left = toNumber(valueByField.get(spec.leftFieldId));
    const right = toNumber(valueByField.get(spec.rightFieldId));
    if (left == null || right == null) {
      clear = true;
    } else {
      switch (spec.op) {
        case "+":
          result = { result: left + right };
          break;
        case "-":
          result = { result: left - right };
          break;
        case "*":
          result = { result: left * right };
          break;
        case "/":
          result = right === 0 ? { error: "Div/0" } : { result: left / right };
          break;
      }
    }
  } else {
    // No valid spec (unconfigured field) — nothing to compute.
    return { kind: "skip" };
  }

  if (clear || !result) return { kind: "clear" };
  return { kind: "set", value: result };
}

/**
 * Recompute every FORMULA / ROLLUP field on a project after a source
 * value changed. Idempotent — safe to run on every PATCH.
 *
 * Strategy: load all FORMULA / ROLLUP definitions linked to the
 * project, evaluate each from the task's current value map, upsert
 * the resulting CustomFieldValue. Two passes so a formula that
 * references another formula picks up the latest result.
 *
 * Scoped to a single task — formulas are per-task, so recomputing
 * for the whole project on every edit would be O(tasks × formulas)
 * and unnecessary.
 */
export async function recomputeFormulasForTask(
  taskId: string,
  projectId: string
): Promise<void> {
  // Load the project's formula fields.
  const formulas = await prisma.customFieldDefinition.findMany({
    where: {
      type: { in: ["FORMULA", "ROLLUP"] },
      projectFields: { some: { projectId } },
    },
    select: { id: true, type: true, options: true },
  });
  if (formulas.length === 0) return;

  // ROLLUP fields aggregate the SUBTASKS' values, so load subtask ids
  // once up front (only if there's at least one roll-up to compute).
  const hasRollup = formulas.some((f) => f.type === "ROLLUP");
  let subtaskIds: string[] = [];
  if (hasRollup) {
    const subs = await prisma.task.findMany({
      where: { parentTaskId: taskId },
      select: { id: true },
    });
    subtaskIds = subs.map((s) => s.id);
  }

  // Two passes — formulas that reference other formulas/roll-ups pick up
  // the updated upstream result on the second pass.
  for (let pass = 0; pass < 2; pass++) {
    // Load every value on this task (refreshes between passes so the
    // first pass's writes are visible to the second).
    const values = await prisma.customFieldValue.findMany({
      where: { taskId },
      select: { fieldId: true, value: true },
    });
    const valueByField = new Map<string, unknown>();
    for (const v of values) valueByField.set(v.fieldId, v.value);

    for (const f of formulas) {
      const spec = f.options as unknown;
      let subtaskValues: unknown[] = [];
      if (f.type === "ROLLUP" && isRollupSpec(spec) && subtaskIds.length > 0) {
        const subVals = await prisma.customFieldValue.findMany({
          where: { taskId: { in: subtaskIds }, fieldId: spec.sourceFieldId },
          select: { value: true },
        });
        subtaskValues = subVals.map((v) => v.value);
      }
      const outcome = computeField(f, valueByField, subtaskValues);
      if (outcome.kind === "skip") continue;

      if (outcome.kind === "clear") {
        await prisma.customFieldValue
          .delete({ where: { taskId_fieldId: { taskId, fieldId: f.id } } })
          .catch(() => {
            /* already absent */
          });
        continue;
      }
      await prisma.customFieldValue.upsert({
        where: { taskId_fieldId: { taskId, fieldId: f.id } },
        create: { taskId, fieldId: f.id, value: outcome.value },
        update: { value: outcome.value },
      });
    }
  }
}

/**
 * Recompute every FORMULA / ROLLUP field for every task of a project.
 *
 * `recomputeFormulasForTask` only runs after a value edit on one task, so a
 * formula created on a project that already has data would read "—" on
 * every existing task until someone re-typed a source value. Call this
 * after a FORMULA / ROLLUP definition is created or its spec changes.
 *
 * It runs inside the request that created the field, so it must not cost
 * round trips per task (a large project would time the request out after
 * the field already exists, and a retry would duplicate it). Everything is
 * read in a few queries, computed in memory with the same two-pass rule as
 * the per-task recompute, and only the values that changed are written, in
 * bulk. Subtasks are processed before their parents so a roll-up
 * aggregates the subtasks' freshly computed values (a roll-up of a
 * formula field).
 */
export async function recomputeFormulasForProject(
  projectId: string
): Promise<void> {
  const formulas = await prisma.customFieldDefinition.findMany({
    where: {
      type: { in: ["FORMULA", "ROLLUP"] },
      projectFields: { some: { projectId } },
    },
    select: { id: true, type: true, options: true },
  });
  if (formulas.length === 0) return;

  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: { id: true, parentTaskId: true },
  });
  if (tasks.length === 0) return;
  const taskIds = tasks.map((t) => t.id);

  // Roll-ups read every subtask, including ones filed outside this project,
  // exactly as the per-task recompute does (it looks subtasks up by parent).
  const childrenOf = new Map<string, string[]>();
  let outsideIds: string[] = [];
  if (formulas.some((f) => f.type === "ROLLUP")) {
    const subs = await prisma.task.findMany({
      where: { parentTaskId: { in: taskIds } },
      select: { id: true, parentTaskId: true },
    });
    const inProject = new Set(taskIds);
    for (const s of subs) {
      if (!s.parentTaskId) continue;
      const list = childrenOf.get(s.parentTaskId) ?? [];
      list.push(s.id);
      childrenOf.set(s.parentTaskId, list);
    }
    outsideIds = subs.map((s) => s.id).filter((id) => !inProject.has(id));
  }

  const stored = await prisma.customFieldValue.findMany({
    where: { taskId: { in: [...taskIds, ...outsideIds] } },
    select: { taskId: true, fieldId: true, value: true },
  });
  // `live` is mutated as results are computed; `original` is what the
  // database holds, so only real changes are written back.
  const live = new Map<string, Map<string, unknown>>();
  const original = new Map<string, Map<string, unknown>>();
  for (const v of stored) {
    if (!live.has(v.taskId)) live.set(v.taskId, new Map());
    if (!original.has(v.taskId)) original.set(v.taskId, new Map());
    live.get(v.taskId)!.set(v.fieldId, v.value);
    original.get(v.taskId)!.set(v.fieldId, v.value);
  }

  // Fields the computation owns per task: a skipped (unconfigured) field is
  // never touched, a cleared one is deleted.
  const touched = new Map<string, Set<string>>();
  for (const level of orderChildrenFirst(tasks)) {
    for (const taskId of level) {
      if (!live.has(taskId)) live.set(taskId, new Map());
      const values = live.get(taskId)!;
      const own = new Set<string>();
      touched.set(taskId, own);
      const children = childrenOf.get(taskId) ?? [];
      for (let pass = 0; pass < 2; pass++) {
        // Each pass reads the values as they stood when it began, matching
        // the per-task recompute's reload between passes.
        const snapshot = new Map(values);
        for (const f of formulas) {
          const spec = f.options as unknown;
          const subtaskValues =
            f.type === "ROLLUP" && isRollupSpec(spec)
              ? children
                  .map((c) => live.get(c)?.get(spec.sourceFieldId))
                  .filter((v) => v !== undefined)
              : [];
          const outcome = computeField(f, snapshot, subtaskValues);
          if (outcome.kind === "skip") continue;
          own.add(f.id);
          if (outcome.kind === "clear") values.delete(f.id);
          else values.set(f.id, outcome.value);
        }
      }
    }
  }

  type Write = { taskId: string; fieldId: string; value: ComputedValue };
  const creates: Write[] = [];
  const updates: Write[] = [];
  const deletesByField = new Map<string, string[]>();
  for (const taskId of taskIds) {
    const values = live.get(taskId)!;
    const before = original.get(taskId);
    for (const fieldId of touched.get(taskId) ?? []) {
      const had = before?.has(fieldId) ?? false;
      const next = values.get(fieldId) as ComputedValue | undefined;
      if (next === undefined) {
        if (had) {
          const list = deletesByField.get(fieldId) ?? [];
          list.push(taskId);
          deletesByField.set(fieldId, list);
        }
      } else if (!had) {
        creates.push({ taskId, fieldId, value: next });
      } else if (JSON.stringify(before!.get(fieldId)) !== JSON.stringify(next)) {
        updates.push({ taskId, fieldId, value: next });
      }
    }
  }

  if (creates.length > 0) {
    // A concurrent single-task recompute may have written the row first;
    // its value came from the same rule, so keeping it is correct.
    await prisma.customFieldValue.createMany({
      data: creates,
      skipDuplicates: true,
    });
  }
  for (const [fieldId, ids] of deletesByField) {
    await prisma.customFieldValue.deleteMany({
      where: { fieldId, taskId: { in: ids } },
    });
  }
  const CHUNK = 100;
  for (let i = 0; i < updates.length; i += CHUNK) {
    await prisma.$transaction(
      updates.slice(i, i + CHUNK).map((u) =>
        prisma.customFieldValue.update({
          where: { taskId_fieldId: { taskId: u.taskId, fieldId: u.fieldId } },
          data: { value: u.value },
        })
      )
    );
  }
}

/**
 * Recompute a task's parent chain — call after a subtask is created,
 * deleted or moved so the parents' roll-ups reflect the new set of
 * subtasks. Each ancestor is recomputed against its own home project.
 */
export async function recomputeRollupsForAncestors(
  parentTaskId: string | null | undefined
): Promise<void> {
  const seen = new Set<string>();
  let current = parentTaskId ?? null;
  while (current && !seen.has(current)) {
    seen.add(current);
    const parent = await prisma.task.findUnique({
      where: { id: current },
      select: { id: true, projectId: true, parentTaskId: true },
    });
    if (!parent) return;
    if (parent.projectId) {
      await recomputeFormulasForTask(parent.id, parent.projectId);
    }
    current = parent.parentTaskId;
  }
}

/** Group task ids by depth, deepest level first. Exported for tests. */
export function orderChildrenFirst(
  tasks: { id: string; parentTaskId: string | null }[]
): string[][] {
  const parentOf = new Map(tasks.map((t) => [t.id, t.parentTaskId]));
  const depthCache = new Map<string, number>();
  const depth = (id: string): number => {
    const cached = depthCache.get(id);
    if (cached !== undefined) return cached;
    // Walk up inside this project only; a cycle (corrupt data) stops the walk.
    let d = 0;
    let p = parentOf.get(id) ?? null;
    const seen = new Set<string>([id]);
    while (p && parentOf.has(p) && !seen.has(p)) {
      seen.add(p);
      d++;
      p = parentOf.get(p) ?? null;
    }
    depthCache.set(id, d);
    return d;
  };
  const levels: string[][] = [];
  for (const t of tasks) {
    const d = depth(t.id);
    (levels[d] ??= []).push(t.id);
  }
  return levels.filter(Boolean).reverse();
}
