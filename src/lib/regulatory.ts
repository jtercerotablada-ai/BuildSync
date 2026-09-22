import type { ProjectStatus, ProjectType } from "@prisma/client";
import { PIPELINES, type PipelineId } from "@/lib/pipelines";

/**
 * regulatory.ts — the one answer to "what date can the city hold this job
 * to, and is that date still OUR problem?".
 *
 * Client-safe on purpose: the only runtime import is the pipeline registry,
 * which itself imports types only. Imported by the project API, the daily
 * due-dates cron, the Overview's Job info card, /projects/all and the Home
 * cockpit's DeadlinesPanel. Keep the exported names stable — the cockpit
 * imports them.
 *
 * THE RULE (D9). A regulatory deadline is LIVE only while the job is still
 * on our side of the counter: not archived, not COMPLETE, not at a terminal
 * stage and not sitting at the city ("Submitted to City"). City Comments puts
 * it back on our desk, so it re-arms. Permit and construction jobs only go
 * dormant at their terminal stage — their "submitted" stages do not stop the
 * clock (an application still expires while the city reviews it).
 */

// ───────────────────────────────────────────────────────────────────────────
// Thresholds & buckets
// ───────────────────────────────────────────────────────────────────────────

/** In-app warnings fire at these many days out (plus the day itself and
 *  once after it passes). */
export const DEADLINE_THRESHOLDS = [60, 30, 7] as const;

/** How far ahead the Home cockpit's deadline panel looks. One constant. */
export const DEADLINE_HORIZON_DAYS = 90;

export type DeadlineBucket = "overdue" | "today" | "7d" | "30d" | "60d" | "later";

export function deadlineBucket(daysOut: number): DeadlineBucket {
  if (daysOut < 0) return "overdue";
  if (daysOut === 0) return "today";
  if (daysOut <= 7) return "7d";
  if (daysOut <= 30) return "30d";
  if (daysOut <= 60) return "60d";
  return "later";
}

// ───────────────────────────────────────────────────────────────────────────
// Liveness
// ───────────────────────────────────────────────────────────────────────────

/** Every pipeline's terminal stage, derived from the registry so a renamed
 *  terminal stage cannot silently keep pinging. */
export const TERMINAL_STAGE_KEYS: readonly string[] = (
  Object.keys(PIPELINES) as PipelineId[]
).flatMap((id) =>
  PIPELINES[id].stages.filter((s) => s.terminal).map((s) => s.key)
);

/** Stages where the report is at the city: the delay is theirs, not ours.
 *  The matching `*.city_comments` stages are deliberately NOT here — the
 *  comments are back on our desk, so the deadline re-arms. */
export const SUBMITTED_STAGE_KEYS: readonly string[] = [
  "recert.submitted_to_city",
  "design.submitted_to_city",
];

/** Used by the cron's `stage: { notIn }`. */
export const DEADLINE_DORMANT_STAGE_KEYS: readonly string[] = [
  ...TERMINAL_STAGE_KEYS,
  ...SUBMITTED_STAGE_KEYS,
];

export type DeadlineState = "archived" | "complete" | "closed" | "submitted" | "live";

export interface DeadlineLivenessInput {
  isArchived?: boolean | null;
  status?: ProjectStatus | string | null;
  stage?: string | null;
}

/** Checked in this order: archived, complete, closed, submitted, live. */
export function deadlineState(p: DeadlineLivenessInput): DeadlineState {
  if (p.isArchived) return "archived";
  if (p.status === "COMPLETE") return "complete";
  if (p.stage && TERMINAL_STAGE_KEYS.includes(p.stage)) return "closed";
  if (p.stage && SUBMITTED_STAGE_KEYS.includes(p.stage)) return "submitted";
  return "live";
}

export function isDeadlineLive(p: DeadlineLivenessInput): boolean {
  return deadlineState(p) === "live";
}

/** Shown in slate instead of a days pill. Never "Met": the data cannot
 *  prove the date was met. */
export const DEADLINE_STATE_LABEL: Readonly<
  Record<Exclude<DeadlineState, "live">, string>
> = {
  archived: "Archived",
  complete: "Complete",
  closed: "Closed",
  submitted: "Submitted",
};

// ───────────────────────────────────────────────────────────────────────────
// Copy
// ───────────────────────────────────────────────────────────────────────────

export interface DeadlineCopy {
  /** Form label and Overview label. */
  label: string;
  /** Compact form for pills, rails and notification titles. */
  short: string;
  /** One-line hint under the date input. */
  help: string;
}

const DEADLINE_COPY: Readonly<Record<ProjectType, DeadlineCopy>> = {
  RECERTIFICATION: {
    label: "Recertification report due",
    short: "Recert report due",
    help: "Date the signed report is due to the building official, from the Notice of Required Inspection.",
  },
  BSIP: {
    label: "BSIP report due",
    short: "BSIP report due",
    help: "Date the inspection report is due under the BSIP notice.",
  },
  PERMIT: {
    label: "Permit deadline",
    short: "Permit deadline",
    help: "Application expiry, or the date city comments must be answered by.",
  },
  CONSTRUCTION: {
    label: "Permit expires",
    short: "Permit expires",
    help: "Building permit expiration, usually 180 days after issuance or the last passed inspection.",
  },
  DESIGN: {
    label: "Submittal deadline",
    short: "Submittal due",
    help: "Date drawings must be submitted to hold the schedule.",
  },
};

const DEADLINE_COPY_UNTYPED: DeadlineCopy = {
  label: "Regulatory deadline",
  short: "Deadline",
  help: "The date an authority or contract holds this job to.",
};

export function deadlineCopyFor(
  type: ProjectType | string | null | undefined
): DeadlineCopy {
  if (!type) return DEADLINE_COPY_UNTYPED;
  return DEADLINE_COPY[type as ProjectType] ?? DEADLINE_COPY_UNTYPED;
}

export function formatDaysOut(n: number): string {
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n > 1) return `in ${n} days`;
  if (n === -1) return "1 day ago";
  return `${Math.abs(n)} days ago`;
}

/** Tailwind classes for a days pill (bg + text + border). */
export function deadlineToneClass(bucket: DeadlineBucket): string {
  switch (bucket) {
    case "overdue":
      return "bg-red-50 text-red-700 border-red-200";
    case "today":
    case "7d":
      return "bg-[#FBF6E9] text-[#8F6C1F] border-[#E9D9A8]";
    case "30d":
      return "bg-[#c9a84c]/10 text-[#a8893a] border-[#c9a84c]/30";
    case "60d":
    case "later":
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

/** UTC-safe display of a date-only value: "Dec 15, 2026" (or "Dec 15"). */
export function formatDeadlineDate(
  value: string | Date,
  opts: { year?: boolean } = {}
): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(opts.year === false ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Reference numbers
// ───────────────────────────────────────────────────────────────────────────

export type ReferenceField = "folioNumber" | "permitNumber" | "caseNumber";

export function referenceFieldsFor(
  type: ProjectType | string | null | undefined
): ReferenceField[] {
  if (type === "RECERTIFICATION" || type === "BSIP") {
    return ["folioNumber", "caseNumber", "permitNumber"];
  }
  return ["folioNumber", "permitNumber"];
}

export const REFERENCE_LABEL: Readonly<Record<ReferenceField, string>> = {
  folioNumber: "Folio no.",
  permitNumber: "Permit no.",
  caseNumber: "Recert / BSIP case no.",
};

// ───────────────────────────────────────────────────────────────────────────
// Duplicate
// ───────────────────────────────────────────────────────────────────────────

export interface RegulatoryDuplicateSource {
  jurisdiction?: string | null;
  clientContactName?: string | null;
  clientContactEmail?: string | null;
  clientContactPhone?: string | null;
}

/**
 * What a duplicated project inherits (D6): who has jurisdiction and who to
 * call. NOT the folio / permit / case numbers or the deadline — they
 * identify one building's filing (same reason projectNumber is not copied),
 * and a copied deadline would fire false warnings from day one.
 */
export function regulatoryFieldsForDuplicate(src: RegulatoryDuplicateSource): {
  jurisdiction: string | null;
  clientContactName: string | null;
  clientContactEmail: string | null;
  clientContactPhone: string | null;
} {
  return {
    jurisdiction: src.jurisdiction ?? null,
    clientContactName: src.clientContactName ?? null,
    clientContactEmail: src.clientContactEmail ?? null,
    clientContactPhone: src.clientContactPhone ?? null,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Jurisdiction text
// ───────────────────────────────────────────────────────────────────────────

export function normalizeJurisdiction(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/** Grouping key for the jurisdiction filter chip (case-insensitive). */
export function jurisdictionKey(s: string): string {
  return normalizeJurisdiction(s).toLowerCase();
}

// ───────────────────────────────────────────────────────────────────────────
// Contact validation
// ───────────────────────────────────────────────────────────────────────────

export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export function isValidPhone(s: string): boolean {
  const v = s.trim();
  if (!/^[0-9+().\-\s#xXext]+$/.test(v)) return false;
  return (v.match(/[0-9]/g) ?? []).length >= 7;
}

// ───────────────────────────────────────────────────────────────────────────
// South Florida authorities having jurisdiction (datalist suggestions only;
// the field is free text, so any authority saves).
// ───────────────────────────────────────────────────────────────────────────

export const SOUTH_FLORIDA_AHJS: readonly string[] = [
  "Miami-Dade County",
  "City of Aventura",
  "Town of Bay Harbor Islands",
  "City of Coral Gables",
  "Town of Cutler Bay",
  "City of Doral",
  "City of Hialeah",
  "City of Homestead",
  "Village of Key Biscayne",
  "City of Miami",
  "City of Miami Beach",
  "City of Miami Gardens",
  "Town of Miami Lakes",
  "City of North Miami",
  "City of North Miami Beach",
  "Village of Palmetto Bay",
  "Village of Pinecrest",
  "City of South Miami",
  "City of Sunny Isles Beach",
  "Town of Surfside",
  "City of Sweetwater",
  "Broward County",
  "City of Coral Springs",
  "Town of Davie",
  "City of Deerfield Beach",
  "City of Fort Lauderdale",
  "City of Hallandale Beach",
  "City of Hollywood",
  "Town of Lauderdale-By-The-Sea",
  "City of Lauderhill",
  "City of Miramar",
  "City of Pembroke Pines",
  "City of Plantation",
  "City of Pompano Beach",
  "City of Sunrise",
  "Palm Beach County",
  "City of Boca Raton",
  "City of West Palm Beach",
];
