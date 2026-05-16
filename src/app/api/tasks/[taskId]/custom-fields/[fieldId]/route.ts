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
import { verifyTaskAccess } from "@/lib/auth-guards";

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

    await verifyTaskAccess(userId, taskId);

    // Confirm the field is linked to this task's project — we can't
    // let a user write values for arbitrary fields they don't own.
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
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

    const field = await prisma.customFieldDefinition.findUnique({
      where: { id: fieldId },
      select: { id: true, type: true, options: true },
    });
    if (!field) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
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
        if (
          !Array.isArray(raw) ||
          raw.some((v) => typeof v !== "string")
        ) {
          return NextResponse.json(
            { error: "People value must be an array of user ids" },
            { status: 400 }
          );
        }
        coerced = raw;
        break;
      }
      case "TEXT": {
        coerced = String(raw).slice(0, 4000);
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

    return NextResponse.json({
      taskId: row.taskId,
      fieldId: row.fieldId,
      value: row.value,
    });
  } catch (err) {
    console.error("[task custom-field PATCH] error:", err);
    return NextResponse.json(
      { error: "Failed to set custom field value" },
      { status: 500 }
    );
  }
}
