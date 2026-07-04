import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyProjectAccess,
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";

/**
 * GET /api/projects/:projectId/constraints
 *
 * Project-wide constraint log (the Make-Ready board data): every constraint
 * on every task in the project, with the task + responsible + a small summary
 * (open/resolved counts, overdue open constraints). Powers the lookahead's
 * "ready vs not-ready" state and the make-ready panel.
 *
 * ?status=OPEN | RESOLVED  → filter (default: all)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { projectId } = await params;
    await verifyProjectAccess(userId, projectId);

    const statusParam = new URL(req.url).searchParams.get("status");
    const statusFilter =
      statusParam === "OPEN" || statusParam === "RESOLVED"
        ? statusParam
        : undefined;

    const constraints = await prisma.taskConstraint.findMany({
      where: {
        task: { projectId },
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: [{ status: "asc" }, { needBy: "asc" }, { createdAt: "asc" }],
      include: {
        responsible: {
          select: { id: true, name: true, email: true, image: true },
        },
        task: {
          select: { id: true, name: true, completed: true, dueDate: true },
        },
      },
    });

    const now = Date.now();
    let open = 0;
    let resolved = 0;
    let overdue = 0;
    for (const c of constraints) {
      if (c.status === "OPEN") {
        open++;
        if (c.needBy && c.needBy.getTime() < now) overdue++;
      } else {
        resolved++;
      }
    }

    return NextResponse.json({
      constraints,
      summary: { open, resolved, overdue, total: constraints.length },
    });
  } catch (err) {
    if (err instanceof AuthorizationError || err instanceof NotFoundError) {
      const { status, message } = getErrorStatus(err);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[project constraints GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch constraints" },
      { status: 500 }
    );
  }
}
