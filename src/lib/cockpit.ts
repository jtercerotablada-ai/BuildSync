import type { Prisma, ProjectStatus, ProjectType } from "@prisma/client";
import {
  PIPELINES,
  PIPELINE_FOR_TYPE,
  holderLabel,
  isStageValidForType,
  resolveStage,
  type PipelineId,
  type StageDirection,
  type StageHolder,
} from "@/lib/pipelines";
import {
  TERMINAL_STAGE_KEYS,
  deadlineBucket,
  isDeadlineLive,
  type DeadlineBucket,
} from "@/lib/regulatory";
import { daysFromToday, startOfTodayUtc } from "@/lib/date-only";
import { type Position } from "@/lib/people-types";
import { isNonContributorRole } from "@/lib/workspace-roles";
import { decideSealAuthority } from "@/lib/deliverables";

/**
 * cockpit.ts — the rules behind the Firm view on /home.
 *
 * "Is the delay ours or someone else's?" is answered from three stored facts
 * only: Project.stage (which names a holder in pipelines.ts), when the job
 * entered it (stageEnteredAt) and the job's tasks. Everything here is derived;
 * the cockpit never writes a stage, a gate or a deadline.
 *
 * Pure and client-safe: the runtime imports are the pipeline registry, the
 * regulatory helpers, the date-only helpers and two role/position helpers, all
 * dependency-free. The Prisma import is type-only. The server-side scope
 * builder (which needs taskPrivacyClause, and therefore Prisma) lives in
 * cockpit-scopes.ts so this file can ship to the browser.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ───────────────────────────────────────────────────────────────────────────
// Dwell & stale
// ───────────────────────────────────────────────────────────────────────────

/**
 * How long a job may sit on one desk before the cockpit flags it.
 * UNCONFIRMED — these values need Juan's sign-off. One constant on purpose:
 * changing a limit is a one-line edit, never a per-screen one.
 */
export const STALE_AFTER_DAYS: Readonly<Record<StageHolder, number | null>> = {
  FIRM: 10,
  PE: 3,
  CLIENT: 21,
  ARCHITECT: 21,
  CONTRACTOR: 30,
  CITY: 30,
  NONE: null,
};

/** The holders that mean "the delay is ours". */
export const OUR_HOLDERS: ReadonlySet<StageHolder> = new Set<StageHolder>([
  "FIRM",
  "PE",
]);

/** Display order of the outside holders (sub-lines, legend, bar). */
export const OTHER_HOLDER_ORDER: readonly StageHolder[] = [
  "CLIENT",
  "ARCHITECT",
  "CONTRACTOR",
  "CITY",
];

/** Every holder a job can actually be waiting on, ours first. */
export const HOLDER_ORDER: readonly StageHolder[] = [
  "FIRM",
  "PE",
  ...OTHER_HOLDER_ORDER,
];

/** Whole days since the job entered its stage. Floor, never negative (a
 *  clock skew must not print "-1 days"). Null when the arrival was never
 *  recorded or does not parse. */
export function daysInStage(
  enteredAt: string | Date | null | undefined,
  now: Date
): number | null {
  if (!enteredAt) return null;
  const t = (typeof enteredAt === "string" ? new Date(enteredAt) : enteredAt).getTime();
  if (Number.isNaN(t) || Number.isNaN(now.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / MS_PER_DAY));
}

export function isStale(
  holder: StageHolder | null | undefined,
  days: number | null | undefined
): boolean {
  if (!holder || days === null || days === undefined) return false;
  const limit = STALE_AFTER_DAYS[holder];
  return limit !== null && limit !== undefined && days >= limit;
}

export function formatDwell(days: number | null | undefined): string | null {
  if (days === null || days === undefined) return null;
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

// ───────────────────────────────────────────────────────────────────────────
// Stage resolution
// ───────────────────────────────────────────────────────────────────────────

export interface ResolvedJobStage {
  pipelineId: PipelineId | null;
  stageKey: string | null;
  stageLabel: string | null;
  stageIndex: number | null;
  stageCount: number;
  holder: StageHolder | null;
  terminal: boolean;
}

/**
 * Where a job sits. A type with no stage — or a stored stage that belongs to
 * another pipeline (left behind by a type change) — resolves to the type's
 * pipeline with the stage fields null, so it lands in that pipeline's
 * "No stage set" bucket instead of on a desk nobody chose.
 */
export function resolveJobStage(
  type: ProjectType | null | undefined,
  stage: string | null | undefined
): ResolvedJobStage {
  if (!type || !PIPELINE_FOR_TYPE[type]) {
    return {
      pipelineId: null,
      stageKey: null,
      stageLabel: null,
      stageIndex: null,
      stageCount: 0,
      holder: null,
      terminal: false,
    };
  }
  const pipelineId = PIPELINE_FOR_TYPE[type];
  const stageCount = PIPELINES[pipelineId].stages.length;
  if (!isStageValidForType(type, stage)) {
    return {
      pipelineId,
      stageKey: null,
      stageLabel: null,
      stageIndex: null,
      stageCount,
      holder: null,
      terminal: false,
    };
  }
  const resolved = resolveStage(stage)!;
  return {
    pipelineId,
    stageKey: resolved.stage.key,
    stageLabel: resolved.stage.label,
    stageIndex: resolved.index,
    stageCount,
    holder: resolved.stage.holder,
    terminal: resolved.stage.terminal === true,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// People
// ───────────────────────────────────────────────────────────────────────────

export interface CockpitMemberInput {
  role: string;
  /** WorkspaceMember.sealAuthorizedAt — the seat's grant to seal. */
  sealAuthorizedAt?: Date | string | null;
  user: {
    id: string;
    name?: string | null;
    image?: string | null;
    position?: Position | string | null;
  };
}

/** A seat that does the firm's work (OWNER / ADMIN / MEMBER / WORKER). */
export function isCockpitPerson(role: string | null | undefined): boolean {
  return !isNonContributorRole(role);
}

/**
 * Who "the PE" is: the same rule the Deliverables tab seals by —
 * decideSealAuthority(): a contributor seat that is the workspace OWNER or
 * holds WorkspaceMember.sealAuthorizedAt. User.position is deliberately NOT
 * consulted (anyone can set their own job title). Never a GUEST or CLIENT
 * seat. Unique ids.
 */
export function pickPeUserIds(members: readonly CockpitMemberInput[]): string[] {
  const pool = members.filter((m) =>
    decideSealAuthority({
      role: m.role,
      isContributor: isCockpitPerson(m.role),
      sealAuthorizedAt: m.sealAuthorizedAt ?? null,
    })
  );
  return [...new Set(pool.map((m) => m.user.id))];
}

// ───────────────────────────────────────────────────────────────────────────
// Scope (the active-job rule)
// ───────────────────────────────────────────────────────────────────────────

export const PIPELINE_ORDER: readonly PipelineId[] = [
  "recert",
  "design",
  "permit",
  "construction",
];

/**
 * THE one definition of an active job, for the board AND the deadline panel:
 * not archived, not COMPLETE, and a stage that is either unset or not
 * terminal. It agrees with regulatory.ts's isDeadlineLive on archived,
 * complete and closed, so the board and the panel can never disagree about
 * whether a job is still running. Each entry is ANDed; none is spread.
 */
export const ACTIVE_JOB_WHERE: readonly Prisma.ProjectWhereInput[] = [
  { isArchived: false },
  { status: { not: "COMPLETE" } },
  {
    OR: [
      { stage: null },
      { stage: { notIn: [...TERMINAL_STAGE_KEYS] } },
    ],
  },
];

/**
 * The caller's calendar day, as the UTC-midnight instant due dates are stored
 * at. Trusts "YYYY-MM-DD" only within ±1 day of the server's UTC day (every
 * real time zone fits); anything else falls back to the UTC day. Without it,
 * from 20:00 in Miami the server's day is already tomorrow and every task due
 * today would count as overdue.
 */
export function resolveCallerToday(value: unknown, now: Date): Date {
  const utcToday = startOfTodayUtc(now);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (
      !Number.isNaN(parsed.getTime()) &&
      Math.abs(parsed.getTime() - utcToday.getTime()) <= MS_PER_DAY
    ) {
      return parsed;
    }
  }
  return utcToday;
}

// ───────────────────────────────────────────────────────────────────────────
// Payload
// ───────────────────────────────────────────────────────────────────────────

export interface CockpitUser {
  id: string;
  name: string | null;
  image: string | null;
}

export interface CockpitJob {
  id: string;
  name: string;
  projectNumber: string | null;
  color: string;
  type: ProjectType | null;
  status: ProjectStatus;
  clientName: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  owner: CockpitUser | null;

  /** Only when valid for the type. */
  stage: string | null;
  pipelineId: PipelineId | null;
  stageLabel: string | null;
  stageIndex: number | null;
  stageCount: number;
  holder: StageHolder | null;

  stageEnteredAt: string | null;
  daysInStage: number | null;
  staleAfterDays: number | null;
  stale: boolean;
  blocker: string | null;

  /** "YYYY-MM-DD". */
  regulatoryDeadline: string | null;
  jurisdiction: string | null;
  permitNumber: string | null;
  caseNumber: string | null;
  folioNumber: string | null;

  openTasks: number;
  overdueTasks: number;
  updatedAt: string;
}

export interface CockpitApprovalTask {
  id: string;
  name: string;
  dueDate: string | null;
  createdAt: string;
  project: { id: string; name: string; color: string };
  assignee: CockpitUser;
}

export interface CockpitOverduePerson {
  user: CockpitUser;
  count: number;
  oldestDueDate: string | null;
}

export interface CockpitOverdueTask {
  id: string;
  name: string;
  dueDate: string;
  assigneeId: string | null;
  project: { id: string; name: string; color: string };
}

export interface CockpitStageMove {
  id: string;
  createdAt: string;
  direction: StageDirection;
  fromLabel: string | null;
  toLabel: string | null;
  toHolder: StageHolder | null;
  reason: string | null;
  project: { id: string; name: string };
  user: CockpitUser | null;
}

export interface CockpitPayload {
  version: 2;
  generatedAt: string;
  viewer: {
    userId: string;
    isManager: boolean;
    isPe: boolean;
    isContributor: boolean;
  };
  jobs: CockpitJob[];
  finishedLast30Days: number;
  truncated: boolean;
  peQueue: {
    peUsers: CockpitUser[];
    tasks: CockpitApprovalTask[];
    taskCount: number;
  };
  overdue: {
    asOf: string;
    totalCount: number;
    people: CockpitOverduePerson[];
    unassigned: number;
    others: number;
    tasks: CockpitOverdueTask[];
  };
  moves: CockpitStageMove[];
}

export function emptyCockpitPayload(
  userId: string,
  now: Date = new Date(),
  asOf: Date = startOfTodayUtc(now)
): CockpitPayload {
  return {
    version: 2,
    generatedAt: now.toISOString(),
    viewer: { userId, isManager: false, isPe: false, isContributor: false },
    jobs: [],
    finishedLast30Days: 0,
    truncated: false,
    peQueue: { peUsers: [], tasks: [], taskCount: 0 },
    overdue: {
      asOf: asOf.toISOString().slice(0, 10),
      totalCount: 0,
      people: [],
      unassigned: 0,
      others: 0,
      tasks: [],
    },
    moves: [],
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Overdue assembly
// ───────────────────────────────────────────────────────────────────────────

export interface OverdueGroupInput {
  assigneeId: string | null;
  count: number;
  oldestDueDate: Date | string | null;
}

const toIso = (d: Date | string | null | undefined): string | null =>
  d ? (typeof d === "string" ? d : d.toISOString()) : null;

/**
 * Splits the overdue population so it always adds up:
 *   totalCount = Σ people.count + unassigned + others
 * `people` is one row per contributor member (zero included), biggest first;
 * `others` holds assignees who are not contributor members (former members,
 * GUEST / CLIENT seats).
 */
export function assembleOverdue(
  groups: readonly OverdueGroupInput[],
  members: readonly CockpitMemberInput[]
): {
  totalCount: number;
  people: CockpitOverduePerson[];
  unassigned: number;
  others: number;
} {
  const byAssignee = new Map<string, OverdueGroupInput>();
  let unassigned = 0;
  let totalCount = 0;
  for (const g of groups) {
    totalCount += g.count;
    if (g.assigneeId === null) unassigned += g.count;
    else byAssignee.set(g.assigneeId, g);
  }

  const seen = new Set<string>();
  const people: CockpitOverduePerson[] = [];
  for (const m of members) {
    if (!isCockpitPerson(m.role) || seen.has(m.user.id)) continue;
    seen.add(m.user.id);
    const g = byAssignee.get(m.user.id);
    people.push({
      user: {
        id: m.user.id,
        name: m.user.name ?? null,
        image: m.user.image ?? null,
      },
      count: g?.count ?? 0,
      oldestDueDate: toIso(g?.oldestDueDate ?? null),
    });
  }
  people.sort(
    (a, b) =>
      b.count - a.count ||
      (a.user.name ?? "").localeCompare(b.user.name ?? "")
  );

  let others = 0;
  for (const [id, g] of byAssignee) if (!seen.has(id)) others += g.count;

  return { totalCount, people, unassigned, others };
}

// ───────────────────────────────────────────────────────────────────────────
// Board grouping (client-side, from `jobs`)
// ───────────────────────────────────────────────────────────────────────────

type GroupableJob = Pick<
  CockpitJob,
  "pipelineId" | "stageIndex" | "daysInStage" | "stale" | "holder"
>;

export interface PipelineGroup<T extends GroupableJob = CockpitJob> {
  pipelineId: PipelineId;
  label: string;
  jobs: T[];
  count: number;
  staleCount: number;
  /** Jobs of this pipeline with no (valid) stage — listed first. */
  noStageCount: number;
}

/** Stage order, then longest wait first (unknown arrival last). Jobs with no
 *  stage come before the first stage. */
export function compareJobs(a: GroupableJob, b: GroupableJob): number {
  const ai = a.stageIndex ?? -1;
  const bi = b.stageIndex ?? -1;
  if (ai !== bi) return ai - bi;
  return compareDwellDesc(a, b);
}

export function compareDwellDesc(a: GroupableJob, b: GroupableJob): number {
  const ad = a.daysInStage;
  const bd = b.daysInStage;
  if (ad === bd) return 0;
  if (ad === null) return 1;
  if (bd === null) return -1;
  return bd - ad;
}

/** Always four groups, in PIPELINE_ORDER (BSIP rides in recert). Typeless
 *  jobs are left out — see unstagedJobs. */
export function groupJobsByPipeline<T extends GroupableJob>(
  jobs: readonly T[]
): PipelineGroup<T>[] {
  return PIPELINE_ORDER.map((pipelineId) => {
    const inGroup = jobs
      .filter((j) => j.pipelineId === pipelineId)
      .sort(compareJobs);
    return {
      pipelineId,
      label: PIPELINES[pipelineId].label,
      jobs: inGroup,
      count: inGroup.length,
      staleCount: inGroup.filter((j) => j.stale).length,
      noStageCount: inGroup.filter((j) => j.stageIndex === null).length,
    };
  });
}

/** Jobs with no type yet — no pipeline to put them in. */
export function unstagedJobs<T extends Pick<CockpitJob, "pipelineId">>(
  jobs: readonly T[]
): T[] {
  return jobs.filter((j) => j.pipelineId === null);
}

export interface HolderTotals {
  byHolder: Partial<Record<StageHolder, number>>;
  ours: number;
  others: number;
  /** Jobs with no holder: typeless, or typed with no stage set. */
  unstaged: number;
  /** The typeless part of `unstaged` (pipelineId null — "No type yet"). */
  untyped: number;
  /** The typed part of `unstaged`, per pipeline ("No stage set"). */
  noStageByPipeline: Partial<Record<PipelineId, number>>;
}

/**
 * ours + others = staged jobs whose holder is not NONE.
 * unstaged = untyped + Σ noStageByPipeline (a job without `pipelineId` counts
 * as untyped).
 */
export function holderTotals(
  jobs: readonly (Pick<CockpitJob, "holder"> &
    Partial<Pick<CockpitJob, "pipelineId">>)[]
): HolderTotals {
  const byHolder: Partial<Record<StageHolder, number>> = {};
  const noStageByPipeline: Partial<Record<PipelineId, number>> = {};
  let ours = 0;
  let others = 0;
  let unstaged = 0;
  let untyped = 0;
  for (const j of jobs) {
    if (!j.holder) {
      unstaged += 1;
      if (j.pipelineId) {
        noStageByPipeline[j.pipelineId] =
          (noStageByPipeline[j.pipelineId] ?? 0) + 1;
      } else {
        untyped += 1;
      }
      continue;
    }
    if (j.holder === "NONE") continue;
    byHolder[j.holder] = (byHolder[j.holder] ?? 0) + 1;
    if (OUR_HOLDERS.has(j.holder)) ours += 1;
    else others += 1;
  }
  return { byHolder, ours, others, unstaged, untyped, noStageByPipeline };
}

/** holderLabel() without the article, for tight sub-lines: "Client", "City". */
export function shortHolderLabel(holder: StageHolder): string {
  const label = holderLabel(holder).replace(/^The\s+/i, "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "Client 3 · City 2" — only the outside holders with a non-zero count. */
export function waitingSubline(
  byHolder: Partial<Record<StageHolder, number>>
): string {
  return OTHER_HOLDER_ORDER.filter((h) => (byHolder[h] ?? 0) > 0)
    .map((h) => `${shortHolderLabel(h)} ${byHolder[h]}`)
    .join(" · ");
}

// ───────────────────────────────────────────────────────────────────────────
// Deadlines
// ───────────────────────────────────────────────────────────────────────────

type DeadlineJob = Pick<
  CockpitJob,
  "type" | "status" | "stage" | "regulatoryDeadline"
>;

export interface UpcomingDeadline<T extends DeadlineJob = CockpitJob> {
  job: T;
  daysOut: number;
  bucket: DeadlineBucket;
}

/**
 * Live regulatory deadlines up to `horizon` days out, past ones included,
 * soonest first. Every project type counts — a construction job's permit
 * expiry is as real as a recert report. Never falls back to endDate.
 * `today` is local midnight of the viewer's day (useToday()).
 */
export function upcomingDeadlines<T extends DeadlineJob>(
  jobs: readonly T[],
  today: Date,
  horizon = 90
): UpcomingDeadline<T>[] {
  const rows: UpcomingDeadline<T>[] = [];
  for (const job of jobs) {
    if (!job.regulatoryDeadline) continue;
    if (!isDeadlineLive({ isArchived: false, status: job.status, stage: job.stage }))
      continue;
    const daysOut = daysFromToday(job.regulatoryDeadline, today);
    if (Number.isNaN(daysOut) || daysOut > horizon) continue;
    rows.push({ job, daysOut, bucket: deadlineBucket(daysOut) });
  }
  return rows.sort((a, b) => a.daysOut - b.daysOut);
}

/** The types a regulator actually dates. Only a nudge — it never filters
 *  what the panel shows. */
const DEADLINE_EXPECTED_TYPES: ReadonlySet<string> = new Set([
  "RECERTIFICATION",
  "BSIP",
  "PERMIT",
]);

/** Live recert / BSIP / permit jobs with no deadline set. */
export function jobsMissingDeadline<T extends DeadlineJob>(
  jobs: readonly T[]
): T[] {
  return jobs.filter(
    (j) =>
      !j.regulatoryDeadline &&
      !!j.type &&
      DEADLINE_EXPECTED_TYPES.has(j.type) &&
      isDeadlineLive({ isArchived: false, status: j.status, stage: j.stage })
  );
}

export function missingDeadlineCount(jobs: readonly DeadlineJob[]): number {
  return jobsMissingDeadline(jobs).length;
}
