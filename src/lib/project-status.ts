/**
 * One rule for "did a human ever say how this job is going?", and the one
 * line that sits next to the answer when the facts disagree with it.
 *
 * WHY THIS EXISTS. `Project.status` defaults to ON_TRACK, so every project
 * has claimed to be fine from the moment it was created, whether or not
 * anybody looked. That is worse than saying nothing, because it reads as
 * information — and it is half of why the owner does not trust these
 * controls ("no me genera confianza esto"). `Project.statusSetAt` records
 * that a human actually chose the value; null means nobody did, and every
 * surface that renders the status must then read "No status" instead of an
 * unearned green "On track".
 *
 * WHY IT IS A MODULE and not two copies inline. The status is drawn in the
 * project header, the Overview sidebar, the portfolio row and modal, the
 * home widget and the list views. A status that reads "No status" in one
 * place and green in another is worse than either, which is exactly what
 * three private copies of the rule produce. Import from here.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: derive the status. A job can be
 * genuinely on track with an overdue task that does not matter, and only
 * the engineer knows which. `statusNudge` states a fact next to the claim
 * and changes nothing.
 */

import { daysFromToday } from "@/lib/date-only";

export type ProjectStatusKey =
  | "ON_TRACK"
  | "AT_RISK"
  | "OFF_TRACK"
  | "ON_HOLD"
  | "COMPLETE";

/** What a project with no human-set status is called, everywhere. */
export const NO_STATUS_LABEL = "No status";

/**
 * True once a human has chosen the status. Accepts an ISO string (an API
 * payload) or a Date (a server component spreading the Prisma row straight
 * through), the same pair `stageEnteredAt` travels as.
 *
 * An unparseable value counts as NOT earned: the whole point is that the
 * green has to be backed by something real, so anything we cannot read is
 * treated as nobody having said so.
 */
export function isStatusEarned(
  statusSetAt: string | Date | null | undefined
): boolean {
  if (!statusSetAt) return false;
  const t =
    statusSetAt instanceof Date ? statusSetAt.getTime() : Date.parse(statusSetAt);
  return !Number.isNaN(t);
}

/**
 * Whole calendar days from an instant to `today` (local midnight, from
 * `useToday()`), or null when either end is missing or unreadable.
 *
 * Null — not 0 — for a missing timestamp: a job whose stageEnteredAt was
 * never recorded has an unknown wait, and claiming it landed today is the
 * one thing these lines must never do.
 */
export function daysSince(
  since: string | Date | null | undefined,
  today: Date | null
): number | null {
  if (!since || !today) return null;
  const d = since instanceof Date ? since : new Date(since);
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  // Both ends reduced to LOCAL midnight before subtracting, so a stage
  // entered at 18:00 yesterday reads "1 day" rather than "0", and a DST
  // change cannot shave an hour into a whole day.
  const entered = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((today.getTime() - entered.getTime()) / 86_400_000);
}

/**
 * How long a job may sit in one stage before the wait is itself the news.
 * A month: shorter than the real dwell on the stages that genuinely wait on
 * the city, long enough that no ordinary week of work trips it.
 */
export const STAGE_STALE_DAYS = 30;

/** Non-completed tasks whose due date has already passed. */
export function countOverdue(
  tasks: { completed?: boolean | null; dueDate?: string | Date | null }[],
  today: Date | null
): number {
  // No today, no count: due dates are stored at UTC midnight, so measuring
  // them against a server render (which runs in UTC) marks a task due today
  // as overdue for every viewer west of UTC.
  if (!today) return 0;
  return tasks.filter(
    (t) => !t.completed && t.dueDate && daysFromToday(t.dueDate, today) < 0
  ).length;
}

export interface StatusNudgeInput {
  status: string | null | undefined;
  statusSetAt: string | Date | null | undefined;
  /** Open tasks already past their due date. */
  overdueCount: number;
  /** When the job entered its current pipeline stage, if it has one. */
  stageEnteredAt?: string | Date | null;
  /** Local midnight from `useToday()`; null on the first frame. */
  today: Date | null;
}

/**
 * One short line of FACT to sit beside a status that claims the job is fine,
 * or null when there is nothing to say.
 *
 * Only ON_TRACK and COMPLETE can be contradicted: AT_RISK and OFF_TRACK
 * already say something is wrong, and ON_HOLD is a deliberate pause, so a
 * count of overdue tasks under any of them is noise rather than news.
 *
 * Silent until a status is earned — with no claim there is nothing to
 * disagree with, and "No status" has already said the honest thing.
 *
 * Overdue work wins over a long stage: it names something the firm can act
 * on today, where a long wait usually names somebody else's desk.
 */
export function statusNudge(input: StatusNudgeInput): string | null {
  const { status, statusSetAt, overdueCount, stageEnteredAt, today } = input;
  // Never render a clock-derived line during hydration — the server has no
  // "today", and React does not repair a text mismatch.
  if (!today) return null;
  if (!isStatusEarned(statusSetAt)) return null;
  if (status !== "ON_TRACK" && status !== "COMPLETE") return null;

  if (overdueCount > 0) {
    return `${overdueCount} task${overdueCount === 1 ? "" : "s"} past due`;
  }

  const days = daysSince(stageEnteredAt, today);
  if (days !== null && days >= STAGE_STALE_DAYS) {
    return `${days} days in this stage`;
  }

  return null;
}
