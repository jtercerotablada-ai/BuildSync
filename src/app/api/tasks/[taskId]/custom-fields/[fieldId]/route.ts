/**
 * PATCH /api/tasks/:taskId/custom-fields/:fieldId
 *
 * Upserts the CustomFieldValue for a task + field pair. Body:
 *   { value: <any JSON> }
 *
 * Passing `value: null` deletes the value row (treat as "cleared").
 *
 * The endpoint validates that:
 *   - the task belongs to a project the user can access
 *   - the field is actually linked to the task's project (no smuggling
 *     arbitrary field ids in to write values)
 *   - basic type coercion: NUMBER coerces strings → number, DATE
 *     accepts ISO strings, DROPDOWN accepts an option id, MULTI_SELECT
 *     accepts an array of option ids
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyTaskAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";
import { recomputeFormulasForTask } from "@/lib/formula-eval";

const bodySchema = z.object({
  // `unknown` because the shape depends on the field type — we
  // coerce/validate downstream once we know the type.
  value: z.unknown(),
});

export async function PATCH(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ taskId: string; fieldId: string }>;
  }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { taskId, fieldId } = await params;

    await verifyTaskAccess(userId, taskId, { requireWrite: true });

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        projectId: true,
        parentTaskId: true,
        project: { select: { workspaceId: true } },
      },
    });

    const field = await prisma.customFieldDefinition.findUnique({
      where: { id: fieldId },
      select: { id: true, type: true, options: true, workspaceId: true },
    });
    if (!field) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }

    // A PERSONAL field has ZERO ProjectCustomField links. Such fields hold
    // private per-task values and work even on projectless tasks. PROJECT
    // fields (>=1 link) keep the original security rule below.
    const linkCount = await prisma.projectCustomField.count({
      where: { fieldId },
    });
    const isPersonal = linkCount === 0;

    if (isPersonal) {
      // Personal (unlinked) field: there's no per-user owner column, so the
      // minimum defense against cross-tenant IDOR is same-workspace
      // enforcement. The caller must be a member of the FIELD's workspace,
      // and — when the task lives in a project — the task must be in that
      // same workspace. This blocks writing values to another workspace's
      // personal field even if the attacker knows its id.
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId, workspaceId: field.workspaceId },
        },
        select: { userId: true },
      });
      if (!membership) {
        return NextResponse.json(
          { error: "Field is not in your workspace" },
          { status: 404 }
        );
      }
      if (task?.projectId && task.project?.workspaceId !== field.workspaceId) {
        return NextResponse.json(
          { error: "Field is not in this task's workspace" },
          { status: 404 }
        );
      }
    } else {
      // Project field: it must be linked to THIS task's project — we can't
      // let a user write values for arbitrary shared fields they don't own.
      if (!task?.projectId) {
        return NextResponse.json(
          { error: "Task has no project, can't have custom fields" },
          { status: 400 }
        );
      }
      const link = await prisma.projectCustomField.findUnique({
        where: {
          projectId_fieldId: { projectId: task.projectId, fieldId },
        },
      });
      if (!link) {
        return NextResponse.json(
          { error: "Field is not on this task's project" },
          { status: 404 }
        );
      }
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }
    const raw = parsed.data.value;

    // Treat null / "" / undefined / [] as "clear".
    const isCleared =
      raw === null ||
      raw === undefined ||
      raw === "" ||
      (Array.isArray(raw) && raw.length === 0);

    if (isCleared) {
      await prisma.customFieldValue
        .delete({
          where: { taskId_fieldId: { taskId, fieldId } },
        })
        .catch(() => {
          /* already absent — fine */
        });
      // Touch the task so the "Last modified" field reflects the change.
      await prisma.task.update({
        where: { id: taskId },
        data: { updatedAt: new Date() },
      });
      return NextResponse.json({ taskId, fieldId, value: null });
    }

    // Per-type coercion + light validation.
    let coerced: unknown = raw;
    switch (field.type) {
      case "NUMBER":
      case "CURRENCY":
      case "PERCENTAGE": {
        const n = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(n)) {
          return NextResponse.json(
            { error: "Value must be a number" },
            { status: 400 }
          );
        }
        coerced = n;
        break;
      }
      case "DATE": {
        if (typeof raw !== "string") {
          return NextResponse.json(
            { error: "Date value must be a string (ISO)" },
            { status: 400 }
          );
        }
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json(
            { error: "Invalid date" },
            { status: 400 }
          );
        }
        coerced = d.toISOString();
        break;
      }
      case "CHECKBOX": {
        coerced = Boolean(raw);
        break;
      }
      case "DROPDOWN": {
        if (typeof raw !== "string") {
          return NextResponse.json(
            { error: "Dropdown value must be an option id" },
            { status: 400 }
          );
        }
        const options = (field.options as unknown as { id: string }[]) || [];
        if (!options.some((o) => o.id === raw)) {
          return NextResponse.json(
            { error: "Option not in this field's list" },
            { status: 400 }
          );
        }
        coerced = raw;
        break;
      }
      case "MULTI_SELECT": {
        if (!Array.isArray(raw) || raw.some((v) => typeof v !== "string")) {
          return NextResponse.json(
            { error: "Multi-select value must be an array of option ids" },
            { status: 400 }
          );
        }
        const options = (field.options as unknown as { id: string }[]) || [];
        const validIds = new Set(options.map((o) => o.id));
        const filtered = (raw as string[]).filter((id) => validIds.has(id));
        coerced = filtered;
        break;
      }
      case "PEOPLE": {
        if (!Array.isArray(raw)) {
          return NextResponse.json(
            { error: "People value must be an array" },
            { status: 400 }
          );
        }
        // Accept legacy string ids OR { id, name, image } objects and
        // normalize to the denormalized shape the cell renders.
        coerced = raw
          .map((v) =>
            typeof v === "string" ? { id: v, name: null, image: null } : v
          )
          .filter(
            (v): v is { id: string; name?: unknown; image?: unknown } =>
              !!v &&
              typeof v === "object" &&
              typeof (v as { id?: unknown }).id === "string"
          )
          .map((o) => ({
            id: o.id,
            name: typeof o.name === "string" ? o.name : null,
            image: typeof o.image === "string" ? o.image : null,
          }));
        break;
      }
      case "TEXT": {
        coerced = String(raw).slice(0, 4000);
        break;
      }
      // Fase 3 — Asana-parity types. Accept the JSON shape verbatim
      // after a structural sanity check; full domain validation can
      // tighten as edit UIs ship in follow-up passes.
      case "REFERENCE": {
        // Array of { kind, id, name } refs — keep only well-formed ones.
        if (!Array.isArray(raw)) {
          return NextResponse.json(
            { error: "Reference value must be an array of refs" },
            { status: 400 }
          );
        }
        coerced = raw
          .filter(
            (v): v is { kind?: unknown; id: string; name: string } =>
              !!v &&
              typeof v === "object" &&
              typeof (v as { id?: unknown }).id === "string" &&
              typeof (v as { name?: unknown }).name === "string"
          )
          .map((v) => ({
            kind:
              v.kind === "project" || v.kind === "task" ? v.kind : "task",
            id: v.id,
            name: v.name,
          }));
        break;
      }
      case "FORMULA":
      case "ROLLUP": {
        // Server-precomputed { result, error? } payload. The expression
        // itself lives on the field definition's `options.formula`; the
        // value row carries the cached result for display.
        if (typeof raw !== "object" || raw === null) {
          return NextResponse.json(
            { error: "Formula value must be { result, error? }" },
            { status: 400 }
          );
        }
        coerced = raw;
        break;
      }
      case "TIMER": {
        // { targetIso: ISO string, format? }
        if (typeof raw !== "object" || raw === null) {
          return NextResponse.json(
            { error: "Timer value must be { targetIso }" },
            { status: 400 }
          );
        }
        coerced = raw;
        break;
      }
      case "TIME_TRACKING": {
        // Estimates are in working DAYS (MS-Project style): value is
        // { estimatedDays, actualDays } — both optional non-negative
        // numbers. Legacy { estimatedMin, actualMin } is still accepted
        // and converted (8h/day) for any pre-switch clients.
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
          return NextResponse.json(
            { error: "Time tracking value must be { estimatedDays, actualDays }" },
            { status: 400 }
          );
        }
        const tt = raw as Record<string, unknown>;
        const num = (v: unknown): number | null | undefined =>
          v === undefined || v === null ? (v as null | undefined) : (v as number);
        const readOne = (
          daysKey: string,
          minKey: string
        ): number | null | undefined => {
          if (tt[daysKey] !== undefined) return num(tt[daysKey]);
          if (typeof tt[minKey] === "number")
            return (tt[minKey] as number) / (8 * 60); // legacy min → days
          return undefined;
        };
        const est = readOne("estimatedDays", "estimatedMin");
        const act = readOne("actualDays", "actualMin");
        for (const [label, val] of [
          ["estimatedDays", est],
          ["actualDays", act],
        ] as const) {
          if (
            val !== undefined &&
            val !== null &&
            (typeof val !== "number" || !Number.isFinite(val) || val < 0)
          ) {
            return NextResponse.json(
              { error: `${label} must be a non-negative number of days` },
              { status: 400 }
            );
          }
        }
        coerced = {
          estimatedDays: (est as number | null | undefined) ?? null,
          actualDays: (act as number | null | undefined) ?? null,
        };
        break;
      }
    }

    const row = await prisma.customFieldValue.upsert({
      where: { taskId_fieldId: { taskId, fieldId } },
      create: {
        taskId,
        fieldId,
        value: JSON.parse(JSON.stringify(coerced)),
      },
      update: { value: JSON.parse(JSON.stringify(coerced)) },
    });

    // Touch the task so the "Last modified" field reflects the change.
    await prisma.task.update({
      where: { id: taskId },
      data: { updatedAt: new Date() },
    });

    // After saving, recompute every FORMULA / ROLLUP on this task —
    // edits to source values propagate to dependent formulas in the
    // same round trip, matching Asana's "type a number and watch
    // Doble esfuerzo update" behavior. Skip when the edited field
    // itself is a formula (its result is what we just wrote).
    if (
      task?.projectId &&
      field.type !== "FORMULA" &&
      field.type !== "ROLLUP"
    ) {
      try {
        await recomputeFormulasForTask(taskId, task.projectId);
      } catch (e) {
        // Non-fatal — the source write succeeded; formulas can be
        // recomputed on the next edit if this one threw.
        console.error("[formula recompute] error:", e);
      }
      // If this task is a subtask, its parent's ROLL-UP fields aggregate
      // this value — recompute the parent too so the roll-up updates.
      if (task.parentTaskId) {
        try {
          await recomputeFormulasForTask(task.parentTaskId, task.projectId);
        } catch (e) {
          console.error("[rollup parent recompute] error:", e);
        }
      }
    }

    return NextResponse.json({
      taskId: row.taskId,
      fieldId: row.fieldId,
      value: row.value,
    });
  } catch (err) {
    if (err instanceof AuthorizationError || err instanceof NotFoundError) {
      const { status, message } = getErrorStatus(err);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[task custom-field PATCH] error:", err);
    return NextResponse.json(
      { error: "Failed to set custom field value" },
      { status: 500 }
    );
  }
}
