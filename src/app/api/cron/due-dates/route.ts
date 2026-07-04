import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/cron/due-dates
// Creates DUE_DATE_APPROACHING notifications for tasks due within the next ~24-48h.
// Authorized via Vercel Cron (x-vercel-cron header) or a Bearer CRON_SECRET.
export async function GET(request: NextRequest) {
  // (a) Authorize
  const isVercelCron = request.headers.get("x-vercel-cron") !== null;
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret) {
    // When a secret is configured it is the sole authority — the
    // x-vercel-cron header is client-spoofable, so don't accept it alone.
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    // No secret configured — fall back to the Vercel Cron header, but flag
    // that this endpoint is effectively unauthenticated.
    if (!isVercelCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.warn(
      "[cron/due-dates] CRON_SECRET is unset — endpoint authorized by x-vercel-cron header only (unauthenticated)."
    );
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const dedupeSince = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // (b) Tasks not completed, due within the next ~24-48h, with an assignee
  const tasks = await prisma.task.findMany({
    where: {
      completed: false,
      assigneeId: { not: null },
      dueDate: { gte: now, lte: windowEnd },
    },
    select: {
      id: true,
      name: true,
      dueDate: true,
      assigneeId: true,
      projectId: true,
      project: { select: { name: true } },
    },
  });

  let created = 0;

  for (const task of tasks) {
    // Best-effort per task
    try {
      if (!task.assigneeId) continue;

      // (c) Dedupe: skip if a recent DUE_DATE_APPROACHING notification for this
      // task already exists for the assignee. `data` is Json, so filter in JS.
      const recent = await prisma.notification.findMany({
        where: {
          userId: task.assigneeId,
          type: "DUE_DATE_APPROACHING",
          createdAt: { gte: dedupeSince },
        },
        select: { data: true },
      });

      const alreadyNotified = recent.some((n) => {
        const data = n.data as { taskId?: string } | null;
        return data?.taskId === task.id;
      });
      if (alreadyNotified) continue;

      const dueLabel = task.dueDate
        ? task.dueDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "soon";

      await prisma.notification.create({
        data: {
          type: "DUE_DATE_APPROACHING",
          title: `Task due soon: ${task.name}`,
          message: `This task is due on ${dueLabel}.`,
          userId: task.assigneeId,
          data: {
            taskId: task.id,
            projectId: task.projectId,
            projectName: task.project?.name ?? null,
          },
        },
      });

      created++;
    } catch (err) {
      console.error(`[cron/due-dates] Failed for task ${task.id}:`, err);
    }
  }

  return NextResponse.json({ created });
}
