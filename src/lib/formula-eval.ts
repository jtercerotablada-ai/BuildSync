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

  // Two passes — formulas that reference other formulas pick up the
  // updated upstream result on the second pass.
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
      if (!isFormulaSpec(spec)) continue;
      const left = toNumber(valueByField.get(spec.leftFieldId));
      const right = toNumber(valueByField.get(spec.rightFieldId));
      let result: { result: number } | { error: string } | null = null;
      if (left == null || right == null) {
        // One or both operands missing — clear the formula's value
        // so the cell renders empty rather than stale.
        await prisma.customFieldValue
          .delete({ where: { taskId_fieldId: { taskId, fieldId: f.id } } })
          .catch(() => {
            /* already absent */
          });
        continue;
      }
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
      if (!result) continue;
      await prisma.customFieldValue.upsert({
        where: { taskId_fieldId: { taskId, fieldId: f.id } },
        create: { taskId, fieldId: f.id, value: result },
        update: { value: result },
      });
    }
  }
}
