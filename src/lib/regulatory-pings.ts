import type { ProjectStatus, ProjectType } from "@prisma/client";
import { holderDeskLabel, resolveStage } from "@/lib/pipelines";
import {
  deadlineBucket,
  deadlineCopyFor,
  formatDeadlineDate,
  isDeadlineLive,
  type DeadlineBucket,
} from "@/lib/regulatory";

/**
 * regulatory-pings.ts — the pure half of the due-dates cron's project pass:
 * given the projects with a deadline in the window, who is eligible, and which
 * pings already went out, decide which in-app notifications to create.
 *
 * No Prisma, no clock: the route passes `todayUtc` and the rows. That is what
 * makes the dedupe and the liveness rules testable without a database.
 */

/** Overdue projects keep pinging (once, in the `overdue` bucket) only while
 *  the deadline is at most this many days in the past. */
export const DEADLINE_OVERDUE_LOOKBACK_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type PingBucket = Exclude<DeadlineBucket, "later">;

/** One key per project × deadline day × bucket. The DAY is the deadline's
 *  own day, so moving the deadline produces new keys and re-arms every
 *  warning. */
export function projectDueKey(
  projectId: string,
  day: Date,
  bucket: DeadlineBucket
): string {
  return `project:${projectId}|${day.toISOString().slice(0, 10)}|${bucket}`;
}

/** User-scoped dedupe key — the same `${userId}::${dueKey}` shape the task
 *  pass of the cron uses, so one recipient already pinged does not suppress
 *  the ping for another. */
export function seenKey(userId: string, dueKey: string): string {
  return `${userId}::${dueKey}`;
}

export interface DeadlinePingProject {
  id: string;
  name: string;
  type: ProjectType | string | null;
  stage: string | null;
  status: ProjectStatus | string | null;
  isArchived: boolean;
  jurisdiction: string | null;
  regulatoryDeadline: Date | null;
}

export interface DeadlinePing {
  userId: string;
  projectId: string;
  dueKey: string;
  bucket: PingBucket;
  title: string;
  message: string;
  data: {
    projectId: string;
    projectName: string;
    regulatoryDeadline: string;
    bucket: PingBucket;
    dueKey: string;
    kind: "regulatory-deadline";
  };
}

export interface PlanDeadlinePingsInput {
  projects: readonly DeadlinePingProject[];
  /** UTC midnight of the cron's day. */
  todayUtc: Date;
  eligibleUserIdsByProject: ReadonlyMap<string, readonly string[]>;
  /** seenKey(userId, dueKey) for every ping already created. */
  seen: ReadonlySet<string>;
}

export interface PlanDeadlinePingsResult {
  pings: DeadlinePing[];
  /** Live projects inside the window that nobody eligible could be told about. */
  noRecipientProjectIds: string[];
}

/** " — on the client's desk"; empty when the stage is unset or unknown. */
function holderSuffix(stage: string | null): string {
  const resolved = resolveStage(stage);
  if (!resolved) return "";
  const desk = holderDeskLabel(resolved.stage.holder);
  return ` — ${desk.charAt(0).toLowerCase()}${desk.slice(1)}`;
}

export function deadlinePingCopy(
  project: Pick<DeadlinePingProject, "name" | "type" | "stage" | "jurisdiction">,
  deadline: Date,
  daysOut: number,
  bucket: PingBucket
): { title: string; message: string } {
  const S = deadlineCopyFor(project.type).short;
  const D = formatDeadlineDate(deadline);
  const J = project.jurisdiction ? ` (${project.jurisdiction})` : "";
  const H = holderSuffix(project.stage);

  if (bucket === "today") {
    return {
      title: `${S} today: ${project.name}`,
      message: `${S} today, ${D}${J}${H}.`,
    };
  }
  if (bucket === "overdue") {
    return {
      title: `Deadline passed: ${project.name}`,
      message: `${S} was ${D}${J} and the job is still open${H}.`,
    };
  }
  const days = daysOut === 1 ? "1 day" : `${daysOut} days`;
  return {
    title: `${S} in ${days}: ${project.name}`,
    message: `${S} on ${D}${J}${H}.`,
  };
}

export function planDeadlinePings({
  projects,
  todayUtc,
  eligibleUserIdsByProject,
  seen,
}: PlanDeadlinePingsInput): PlanDeadlinePingsResult {
  const pings: DeadlinePing[] = [];
  const noRecipientProjectIds: string[] = [];
  // Local copy so one run never plans the same user × key twice (a user
  // listed twice for one project, e.g. owner who is also a member).
  const planned = new Set(seen);

  for (const project of projects) {
    if (!project.regulatoryDeadline) continue;
    if (!isDeadlineLive(project)) continue;

    const deadline = new Date(
      Date.UTC(
        project.regulatoryDeadline.getUTCFullYear(),
        project.regulatoryDeadline.getUTCMonth(),
        project.regulatoryDeadline.getUTCDate()
      )
    );
    const daysOut = Math.round(
      (deadline.getTime() - todayUtc.getTime()) / MS_PER_DAY
    );
    const bucket = deadlineBucket(daysOut);
    if (bucket === "later") continue;
    if (daysOut < -DEADLINE_OVERDUE_LOOKBACK_DAYS) continue;

    const recipients = [
      ...new Set(eligibleUserIdsByProject.get(project.id) ?? []),
    ];
    if (recipients.length === 0) {
      noRecipientProjectIds.push(project.id);
      continue;
    }

    const dueKey = projectDueKey(project.id, deadline, bucket);
    const { title, message } = deadlinePingCopy(
      project,
      deadline,
      daysOut,
      bucket
    );

    for (const userId of recipients) {
      const key = seenKey(userId, dueKey);
      if (planned.has(key)) continue;
      planned.add(key);
      pings.push({
        userId,
        projectId: project.id,
        dueKey,
        bucket,
        title,
        message,
        data: {
          projectId: project.id,
          projectName: project.name,
          regulatoryDeadline: deadline.toISOString(),
          bucket,
          dueKey,
          kind: "regulatory-deadline",
        },
      });
    }
  }

  return { pings, noRecipientProjectIds };
}
