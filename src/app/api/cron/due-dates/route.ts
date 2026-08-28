import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { startOfTodayUtc, startOfTomorrowUtc } from "@/lib/date-only";

const DAY_MS = 24 * 60 * 60 * 1000;

// How far back a missed deadline still earns a ping. A date that slipped
// months ago is history, not news, and back-filling every one of them would
// bury the ones that just slipped under a wall of noise.
const OVERDUE_LOOKBACK_DAYS = 14;

// How many overdue pings one person may collect from a SINGLE run. The first
// run after the window widened back-fills every deadline that slipped in the
// last two weeks, and most of this firm's tasks carry no assignee, so those
// all collapse onto one creator in one batch — dozens of rows arriving
// together read as a broken inbox, not as news. Nothing is lost: a task
// skipped by the cap is never marked seen, so the next run announces it.
const MAX_OVERDUE_PER_RECIPIENT_PER_RUN = 5;

type DueStage = "overdue" | "due-today" | "due-tomorrow";

/** One key per (task, deadline, stage). Rescheduling a task re-arms all three
 *  pings because the deadline is part of the key, while a task left sitting is
 *  announced once per stage instead of once per run. */
function dueKeyFor(taskId: string, dueDay: Date, stage: DueStage): string {
  return `${taskId}|${dueDay.toISOString().slice(0, 10)}|${stage}`;
}

/** Label a due date by its UTC calendar day — they are stored at UTC midnight,
 *  so a locale formatter left on server time renames the day. */
function formatDueDate(value: Date): string {
  return value.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// GET /api/cron/due-dates
// Creates DUE_DATE_APPROACHING notifications for tasks due tomorrow, due today,
// and tasks whose date has already passed.
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
  // Due dates are stored at UTC MIDNIGHT of the due day, so the window has to
  // be built from UTC day boundaries. `now` sits hours INTO the due day, and a
  // `gte: now` filter drops a task on the very day it comes due.
  const todayUtc = startOfTodayUtc(now);
  // Warn on the day before and on the due day itself: [today, +2 days).
  const dueSoonEnd = new Date(startOfTomorrowUtc(now).getTime() + DAY_MS);
  const overdueFloor = new Date(
    todayUtc.getTime() - OVERDUE_LOOKBACK_DAYS * DAY_MS
  );
  // A previous ping for anything inside this window can be no older than the
  // window's own floor; pad a day so a run that fired late still counts.
  const dedupeSince = new Date(overdueFloor.getTime() - DAY_MS);

  // (b) Open tasks whose date has passed recently or lands in the next two days
  const tasks = await prisma.task.findMany({
    where: {
      completed: false,
      dueDate: { gte: overdueFloor, lt: dueSoonEnd },
      // Archived projects are closed files — their dates aren't live any more.
      OR: [{ projectId: null }, { project: { isArchived: false } }],
    },
    select: {
      id: true,
      name: true,
      dueDate: true,
      isPrivate: true,
      assigneeId: true,
      creatorId: true,
      projectId: true,
      project: { select: { name: true, ownerId: true } },
    },
  });

  // (c) Resolve one recipient per task. Most of the firm's tasks carry no
  // assignee, and a deadline nobody is told about is the whole bug — fall back
  // to the person who wrote the date down, then to whoever owns the project.
  const planned = tasks.flatMap((task) => {
    if (!task.dueDate) return [];
    // A private task is visible to its assignee, creator and collaborators
    // only — the owner fallback must not carry its name outside that set.
    const ownerFallback = task.isPrivate ? null : task.project?.ownerId;
    const userId = task.assigneeId ?? task.creatorId ?? ownerFallback;
    if (!userId) return [];

    // Normalize: a legacy row stored with a time component still buckets by
    // its UTC calendar day.
    const dueDay = startOfTodayUtc(task.dueDate);
    const daysOut = Math.round((dueDay.getTime() - todayUtc.getTime()) / DAY_MS);
    const stage: DueStage =
      daysOut < 0 ? "overdue" : daysOut === 0 ? "due-today" : "due-tomorrow";

    return [{ task, userId, dueDay, stage }];
  });

  // Newest deadline first, so when the cap below bites it keeps what just
  // slipped and defers what slipped a fortnight ago.
  planned.sort((a, b) => b.dueDay.getTime() - a.dueDay.getTime());

  const skippedNoRecipient = tasks.length - planned.length;

  // (d) Dedupe: one lookup for every recipient at once, then match in JS —
  // `data` is Json and can't be filtered in the query.
  const seen = new Set<string>();
  const recipientIds = [...new Set(planned.map((p) => p.userId))];
  if (recipientIds.length > 0) {
    const recent = await prisma.notification.findMany({
      where: {
        userId: { in: recipientIds },
        type: "DUE_DATE_APPROACHING",
        createdAt: { gte: dedupeSince },
      },
      select: { userId: true, data: true },
    });
    for (const n of recent) {
      const data = n.data as { dueKey?: string } | null;
      if (data?.dueKey) seen.add(`${n.userId}::${data.dueKey}`);
    }
  }

  let created = 0;
  let deferredOverdue = 0;
  const overdueSent = new Map<string, number>();
  const byStage: Record<DueStage, number> = {
    overdue: 0,
    "due-today": 0,
    "due-tomorrow": 0,
  };

  for (const { task, userId, dueDay, stage } of planned) {
    // Best-effort per task
    try {
      const dueKey = dueKeyFor(task.id, dueDay, stage);
      if (seen.has(`${userId}::${dueKey}`)) continue;

      if (stage === "overdue") {
        const already = overdueSent.get(userId) ?? 0;
        if (already >= MAX_OVERDUE_PER_RECIPIENT_PER_RUN) {
          deferredOverdue++;
          continue;
        }
        overdueSent.set(userId, already + 1);
      }

      const dueLabel = formatDueDate(dueDay);
      const title =
        stage === "overdue"
          ? `Overdue: ${task.name}`
          : stage === "due-today"
            ? `Due today: ${task.name}`
            : `Due tomorrow: ${task.name}`;
      const message =
        stage === "overdue"
          ? `This task was due on ${dueLabel} and is still open.`
          : `This task is due on ${dueLabel}.`;

      await prisma.notification.create({
        data: {
          type: "DUE_DATE_APPROACHING",
          title,
          message,
          userId,
          data: {
            taskId: task.id,
            projectId: task.projectId,
            taskName: task.name,
            projectName: task.project?.name ?? null,
            dueDate: dueDay.toISOString(),
            dueKey,
          },
        },
      });

      // Guard against the same recipient being planned twice for one key
      // inside a single run (duplicate task rows, retries).
      seen.add(`${userId}::${dueKey}`);
      byStage[stage]++;
      created++;
    } catch (err) {
      console.error(`[cron/due-dates] Failed for task ${task.id}:`, err);
    }
  }

  return NextResponse.json({
    created,
    ...byStage,
    skippedNoRecipient,
    deferredOverdue,
  });
}
