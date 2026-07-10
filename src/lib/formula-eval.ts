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

/** Coerce any stored CustomFieldValue.value into a number for compute. */
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
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
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
      let result: { result: number } | { error: string } | null = null;
      let clear = false;

      if (f.type === "ROLLUP" && isRollupSpec(spec)) {
        // Aggregate the source field across this task's subtasks.
        let nums: number[] = [];
        if (subtaskIds.length > 0) {
          const subVals = await prisma.customFieldValue.findMany({
            where: { taskId: { in: subtaskIds }, fieldId: spec.sourceFieldId },
            select: { value: true },
          });
          nums = subVals
            .map((v) => toNumber(v.value))
            .filter((n): n is number => n != null);
        }
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
      } else if (f.type === "FORMULA" && isFormulaSpec(spec)) {
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
              result =
                right === 0 ? { error: "Div/0" } : { result: left / right };
              break;
          }
        }
      } else {
        // No valid spec (unconfigured field) — nothing to compute.
        continue;
      }

      if (clear || !result) {
        await prisma.customFieldValue
          .delete({ where: { taskId_fieldId: { taskId, fieldId: f.id } } })
          .catch(() => {
            /* already absent */
          });
        continue;
      }
      await prisma.customFieldValue.upsert({
        where: { taskId_fieldId: { taskId, fieldId: f.id } },
        create: { taskId, fieldId: f.id, value: result },
        update: { value: result },
      });
    }
  }
}
