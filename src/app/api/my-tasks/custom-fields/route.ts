/**
 * Personal ("My Tasks") custom field definitions.
 *
 *   POST /api/my-tasks/custom-fields
 *        → creates a CustomFieldDefinition in the caller's workspace with
 *          NO ProjectCustomField link. The absence of any link is what makes
 *          the field "personal" (Asana-parity: private to the user, holds
 *          editable per-task values). Body: { name, type, options? }
 *
 * Unlike the project route, this endpoint never creates a ProjectCustomField
 * link and always marks the definition as non-required.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId } from "@/lib/auth-guards";

const FIELD_TYPES = [
  "TEXT",
  "NUMBER",
  "DATE",
  "DROPDOWN",
  "MULTI_SELECT",
  "PEOPLE",
  "CHECKBOX",
  "CURRENCY",
  "PERCENTAGE",
  // Asana-parity (Fase 3): now persistable.
  "REFERENCE",
  "FORMULA",
  "TIMER",
  "TIME_TRACKING",
  "ROLLUP",
] as const;

const createSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(FIELD_TYPES),
  // For DROPDOWN / MULTI_SELECT, options is an array of { id, label, color? }
  options: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1).max(80),
        color: z.string().optional(),
      })
    )
    .optional(),
});

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let workspaceId: string;
    try {
      workspaceId = await getUserWorkspaceId(userId);
    } catch {
      // No workspace membership → the caller has nowhere to file the field.
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, type } = parsed.data;
    let { options } = parsed.data;

    // Seed placeholder options for choice fields when none were provided,
    // mirroring the project route's behavior.
    const needsOptions = type === "DROPDOWN" || type === "MULTI_SELECT";
    if (needsOptions && (!options || options.length === 0)) {
      options = [
        { id: "opt-1", label: "Option 1" },
        { id: "opt-2", label: "Option 2" },
        { id: "opt-3", label: "Option 3" },
      ];
    }

    const def = await prisma.customFieldDefinition.create({
      data: {
        name,
        type,
        options:
          needsOptions && options
            ? JSON.parse(JSON.stringify(options))
            : null,
        isRequired: false,
        workspaceId,
      },
    });

    return NextResponse.json(
      {
        id: def.id,
        name: def.name,
        type: def.type,
        options: def.options,
        isRequired: def.isRequired,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[my-tasks custom-fields POST] error:", err);
    return NextResponse.json(
      { error: "Failed to create custom field" },
      { status: 500 }
    );
  }
}
