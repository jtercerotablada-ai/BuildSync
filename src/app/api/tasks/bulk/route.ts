import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyBulkTaskAccess, AuthorizationError, NotFoundError, getErrorStatus } from "@/lib/auth-guards";

const bulkSchema = z.object({
  taskIds: z.array(z.string()).min(1),
  action: z.enum(["complete", "incomplete", "delete", "assign", "set_priority", "move_section"]),
  value: z.string().optional(),
});

// POST /api/tasks/bulk - Bulk operations on tasks
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { taskIds, action, value } = bulkSchema.parse(body);

    // Verify all tasks belong to user's workspace
    await verifyBulkTaskAccess(userId, taskIds);

    switch (action) {
      case "complete":
        await prisma.task.updateMany({
          where: { id: { in: taskIds } },
          data: { completed: true, completedAt: new Date() },
        });
        return NextResponse.json({ success: true, count: taskIds.length });

      case "incomplete":
        await prisma.task.updateMany({
          where: { id: { in: taskIds } },
          data: { completed: false, completedAt: null },
        });
        return NextResponse.json({ success: true, count: taskIds.length });

      case "delete":
        await prisma.task.deleteMany({
          where: { id: { in: taskIds } },
        });
        return NextResponse.json({ success: true, count: taskIds.length });

      case "assign":
        if (!value) {
          return NextResponse.json({ error: "User ID required" }, { status: 400 });
        }
        await prisma.task.updateMany({
          where: { id: { in: taskIds } },
          data: { assigneeId: value === "unassign" ? null : value },
        });
        return NextResponse.json({ success: true, count: taskIds.length });

      case "set_priority":
        if (!value) {
          return NextResponse.json({ error: "Priority required" }, { status: 400 });
        }
        const validPriorities = ["NONE", "LOW", "MEDIUM", "HIGH"];
        if (!validPriorities.includes(value)) {
          return NextResponse.json({ error: "Invalid priority value" }, { status: 400 });
        }
        await prisma.task.updateMany({
          where: { id: { in: taskIds } },
          data: { priority: value as "NONE" | "LOW" | "MEDIUM" | "HIGH" },
        });
        return NextResponse.json({ success: true, count: taskIds.length });

      case "move_section":
        if (!value) {
          return NextResponse.json({ error: "Section ID required" }, { status: 400 });
        }
        await prisma.task.updateMany({
          where: { id: { in: taskIds } },
          data: { sectionId: value },
        });
        return NextResponse.json({ success: true, count: taskIds.length });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Error in bulk operation:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk operation" },
      { status: 500 }
    );
  }
}
