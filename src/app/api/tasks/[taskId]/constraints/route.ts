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

/**
 * Lean Construction "make-ready" constraints on a task.
 *
 * GET  /api/tasks/:taskId/constraints — list the task's constraints.
 * POST /api/tasks/:taskId/constraints — add one (write access).
 *
 * A task is "ready" (executable) when it has zero OPEN constraints.
 */

const CONSTRAINT_TYPES = [
  "MATERIAL",
  "PERMIT",
  "LABOR",
  "DESIGN",
  "RFI",
  "EQUIPMENT",
  "INFORMATION",
  "SUBMITTAL",
  "SAFETY",
  "OTHER",
] as const;

const createSchema = z.object({
  type: z.enum(CONSTRAINT_TYPES).default("OTHER"),
  description: z.string().min(1).max(1000),
  responsibleId: z.string().nullable().optional(),
  needBy: z.string().nullable().optional(),
});

const responsibleSelect = {
  select: { id: true, name: true, email: true, image: true },
} as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { taskId } = await params;
    await verifyTaskAccess(userId, taskId);

    const constraints = await prisma.taskConstraint.findMany({
      where: { taskId },
      orderBy: [{ status: "asc" }, { needBy: "asc" }, { createdAt: "asc" }],
      include: { responsible: responsibleSelect },
    });

    return NextResponse.json(constraints);
  } catch (err) {
    if (err instanceof AuthorizationError || err instanceof NotFoundError) {
      const { status, message } = getErrorStatus(err);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[task constraints GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch constraints" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { taskId } = await params;
    await verifyTaskAccess(userId, taskId, { requireWrite: true });

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const created = await prisma.taskConstraint.create({
      data: {
        taskId,
        type: parsed.data.type,
        description: parsed.data.description.trim(),
        responsibleId: parsed.data.responsibleId ?? null,
        needBy: parsed.data.needBy ? new Date(parsed.data.needBy) : null,
        createdById: userId,
      },
      include: { responsible: responsibleSelect },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof AuthorizationError || err instanceof NotFoundError) {
      const { status, message } = getErrorStatus(err);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[task constraints POST] error:", err);
    return NextResponse.json(
      { error: "Failed to create constraint" },
      { status: 500 }
    );
  }
}
