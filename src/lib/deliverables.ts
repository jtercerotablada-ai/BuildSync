/**
 * deliverables.ts — the registry for the Deliverables tab: document control
 * (drawing sets, calc packages, reports, letters), RFIs and submittals.
 *
 * WHY THIS EXISTS
 * `Deliverable.kind`, `docType`, `status`, `party`, revision `disposition` and
 * `DeliverableEvent.type` are TEXT columns (prisma/sql/2026-09-21-
 * deliverables.sql), for the reason Project.stage is: a Postgres enum value can
 * never be renamed or dropped without a destructive rebuild, and this database
 * forbids those. So THIS FILE is the schema for those columns — every route
 * validates against it, the tab renders from it, and a key that does not
 * resolve here is not a status.
 *
 * WHY EVERY STATUS NAMES A HOLDER
 * Same product question as the stage strip: "whose desk is it on, and for how
 * long?". A deliverable's holder is per item and is NOT rolled up into the
 * project's (stage) holder.
 *
 * WHY STATE MOVES ARE DECIDED HERE
 * Sealing, issuing, reviewing and answering each write a status, one or more
 * revision columns and an append-only event, and the rules for when each is
 * allowed are the product. `decideDeliverableAction` holds all of them as a
 * pure function, so the whole transition table is tested without a database;
 * the actions route only loads state, calls it and applies the patch.
 *
 * PURE. No Prisma, no clock (callers pass `now` / `today`), no DOM. The only
 * import is the stage registry, for the holder vocabulary. Safe to import from
 * client components.
 */

import type { PipelineId, StageHolder } from "@/lib/pipelines";

// ───────────────────────────────────────────────────────────────────────────
// Vocabulary
// ───────────────────────────────────────────────────────────────────────────

export type DeliverableKind = "DOCUMENT" | "RFI" | "SUBMITTAL";
export const DELIVERABLE_KINDS: readonly DeliverableKind[] = [
  "DOCUMENT",
  "RFI",
  "SUBMITTAL",
];
export const KIND_LABELS: Readonly<Record<DeliverableKind, string>> = {
  DOCUMENT: "Document",
  RFI: "RFI",
  SUBMITTAL: "Submittal",
};
export function isDeliverableKind(v: unknown): v is DeliverableKind {
  return typeof v === "string" && (DELIVERABLE_KINDS as readonly string[]).includes(v);
}

export type DocType =
  | "DRAWINGS"
  | "CALCULATIONS"
  | "REPORT"
  | "LETTER"
  | "SPECIFICATIONS"
  | "OTHER";
export const DOC_TYPES: readonly { key: DocType; label: string }[] = [
  { key: "DRAWINGS", label: "Drawings" },
  { key: "CALCULATIONS", label: "Calculations" },
  { key: "REPORT", label: "Report" },
  { key: "LETTER", label: "Letter" },
  { key: "SPECIFICATIONS", label: "Specifications" },
  { key: "OTHER", label: "Other" },
];
export function isDocType(v: unknown): v is DocType {
  return typeof v === "string" && DOC_TYPES.some((d) => d.key === v);
}
export function docTypeLabel(v: string | null | undefined): string | null {
  return DOC_TYPES.find((d) => d.key === v)?.label ?? null;
}
/** Seal required by default for every docType, LETTER included (Florida
 *  recert, closeout and structural letters are routinely sealed). */
export function defaultSealRequired(_docType: DocType): boolean {
  return true;
}

/** Who a revision was issued to. Also the holder of an ISSUED document. */
export type IssueParty = "CLIENT" | "CITY" | "CONTRACTOR" | "ARCHITECT" | "OTHER";
export const ISSUE_PARTIES: readonly { key: IssueParty; label: string }[] = [
  { key: "CLIENT", label: "Client" },
  { key: "CITY", label: "City" },
  { key: "CONTRACTOR", label: "Contractor" },
  { key: "ARCHITECT", label: "Architect" },
  { key: "OTHER", label: "Other" },
];
export function isIssueParty(v: unknown): v is IssueParty {
  return typeof v === "string" && ISSUE_PARTIES.some((p) => p.key === v);
}
export function issuePartyLabel(v: string | null | undefined): string | null {
  return ISSUE_PARTIES.find((p) => p.key === v)?.label ?? null;
}

export type Disposition =
  | "APPROVED"
  | "APPROVED_AS_NOTED"
  | "REVISE_RESUBMIT"
  | "REJECTED";
export const DISPOSITIONS: readonly { key: Disposition; label: string }[] = [
  { key: "APPROVED", label: "Approved" },
  { key: "APPROVED_AS_NOTED", label: "Approved as noted" },
  { key: "REVISE_RESUBMIT", label: "Revise & resubmit" },
  { key: "REJECTED", label: "Rejected" },
];
export function isDisposition(v: unknown): v is Disposition {
  return typeof v === "string" && DISPOSITIONS.some((d) => d.key === v);
}
export function dispositionLabel(v: string | null | undefined): string | null {
  return DISPOSITIONS.find((d) => d.key === v)?.label ?? null;
}

export type DeliverableEventType =
  | "CREATED"
  | "STATUS"
  | "REOPENED"
  | "SEAL_REQUESTED"
  | "SEALED"
  | "SEAL_REVOKED"
  | "ISSUED"
  | "ISSUE_UNDONE"
  | "REVIEWED"
  | "REVIEW_UNDONE"
  | "ANSWERED"
  | "ANSWER_EDITED"
  | "REVISION_ADDED"
  | "REVISION_DELETED";

/** Past-tense verb for the History list ("Juan Tercero · Sealed Rev 0"). */
export const EVENT_LABELS: Readonly<Record<DeliverableEventType, string>> = {
  CREATED: "Created",
  STATUS: "Changed status",
  REOPENED: "Reopened",
  SEAL_REQUESTED: "Requested seal",
  SEALED: "Sealed",
  SEAL_REVOKED: "Seal revoked",
  ISSUED: "Issued",
  ISSUE_UNDONE: "Undid issue",
  REVIEWED: "Returned",
  REVIEW_UNDONE: "Undid review",
  ANSWERED: "Answered",
  ANSWER_EDITED: "Edited answer",
  REVISION_ADDED: "Started revision",
  REVISION_DELETED: "Deleted revision",
};

/** Events whose existence blocks deleting the record forever (a seal that was
 *  later revoked, an issue later undone, a review later undone). */
export const DELETE_BLOCKING_EVENTS: readonly DeliverableEventType[] = [
  "SEALED",
  "ISSUED",
  "REVIEWED",
];

// ───────────────────────────────────────────────────────────────────────────
// Statuses
// ───────────────────────────────────────────────────────────────────────────

export interface DeliverableStatusDef {
  key: string;
  label: string;
  /** Whose desk. `null` only for DOCUMENT ISSUED, whose holder is the party
   *  the current revision was issued to — see holderFor(). */
  holder: StageHolder | null;
  open: boolean;
  /** The status a new item of this kind starts in. Exactly one per kind. */
  initial?: true;
}

export const DELIVERABLE_STATUSES: Readonly<
  Record<DeliverableKind, readonly DeliverableStatusDef[]>
> = {
  DOCUMENT: [
    { key: "IN_PROGRESS", label: "In progress", holder: "FIRM", open: true, initial: true },
    { key: "AWAITING_SEAL", label: "Awaiting seal", holder: "PE", open: true },
    { key: "SEALED", label: "Sealed, ready to issue", holder: "FIRM", open: true },
    { key: "ISSUED", label: "Issued", holder: null, open: true },
    { key: "COMMENTS", label: "Comments received", holder: "FIRM", open: true },
    { key: "FINAL", label: "Final", holder: "NONE", open: false },
    { key: "VOID", label: "Void", holder: "NONE", open: false },
  ],
  RFI: [
    { key: "OPEN", label: "Open", holder: "FIRM", open: true, initial: true },
    { key: "AWAITING_INFO", label: "Awaiting info", holder: "CONTRACTOR", open: true },
    { key: "ANSWERED", label: "Answered", holder: "NONE", open: false },
    { key: "VOID", label: "Void", holder: "NONE", open: false },
  ],
  SUBMITTAL: [
    { key: "UNDER_REVIEW", label: "Under review", holder: "FIRM", open: true, initial: true },
    { key: "RESUBMIT_REQUIRED", label: "Awaiting resubmittal", holder: "CONTRACTOR", open: true },
    { key: "CLOSED", label: "Closed", holder: "NONE", open: false },
    { key: "VOID", label: "Void", holder: "NONE", open: false },
  ],
};

export function statusDef(
  kind: DeliverableKind,
  status: string | null | undefined
): DeliverableStatusDef | null {
  return DELIVERABLE_STATUSES[kind]?.find((s) => s.key === status) ?? null;
}
export function isValidStatus(kind: DeliverableKind, status: string): boolean {
  return statusDef(kind, status) !== null;
}
export function isOpen(kind: DeliverableKind, status: string): boolean {
  return statusDef(kind, status)?.open ?? false;
}
export function statusLabel(kind: DeliverableKind, status: string): string {
  return statusDef(kind, status)?.label ?? status;
}
export function initialStatus(kind: DeliverableKind): string {
  return DELIVERABLE_STATUSES[kind].find((s) => s.initial)!.key;
}

/** Whose desk the item is on. ISSUED documents sit with whoever they were
 *  issued to; "Other" (or an unknown party) is nobody the strip can name. */
export function holderFor(
  kind: DeliverableKind,
  status: string,
  issuedToParty?: string | null
): StageHolder {
  const def = statusDef(kind, status);
  if (!def) return "NONE";
  if (def.holder !== null) return def.holder;
  switch (issuedToParty) {
    case "CLIENT":
    case "CITY":
    case "CONTRACTOR":
    case "ARCHITECT":
      return issuedToParty;
    default:
      return "NONE";
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Codes, numbering, dates
// ───────────────────────────────────────────────────────────────────────────

/** trim + UPPERCASE. Every number and revision label passes through this
 *  before any write or lookup, so the case-sensitive unique indexes behave
 *  case-insensitively. */
export function normalizeCode(s: string): string {
  return s.trim().toUpperCase();
}

export const REVISION_LABEL_PATTERN = /^[A-Za-z0-9.-]{1,12}$/;
export const NUMBER_MAX_LENGTH = 40;

/**
 * The label after `prev`, or null when there is no obvious next one (the
 * user types it). null → "0"; digits count up keeping their width ("09" →
 * "10", "01" → "02"); one or two letters count like spreadsheet columns
 * (A → B, Z → AA, AZ → BA); letters + digits bump the digits (P1 → P2).
 * Anything else — "IFC", "1.1" — has no defined successor.
 */
export function nextRevisionLabel(prev: string | null | undefined): string | null {
  if (prev == null || prev.trim() === "") return "0";
  const p = normalizeCode(prev);
  if (/^\d+$/.test(p)) {
    const n = String(parseInt(p, 10) + 1);
    return n.padStart(p.length, "0");
  }
  if (/^[A-Z]{1,2}$/.test(p)) {
    const chars = p.split("");
    let i = chars.length - 1;
    while (i >= 0) {
      if (chars[i] === "Z") {
        chars[i] = "A";
        i -= 1;
      } else {
        chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
        return chars.join("");
      }
    }
    return "A" + chars.join("");
  }
  const m = /^([A-Z]+)(\d+)$/.exec(p);
  if (m) {
    const n = String(parseInt(m[2], 10) + 1).padStart(m[2].length, "0");
    return m[1] + n;
  }
  return null;
}

export const NUMBER_PREFIX: Readonly<Record<DeliverableKind, string>> = {
  DOCUMENT: "D-",
  RFI: "RFI-",
  SUBMITTAL: "SUB-",
};

/** The next free auto-number for `kind` among a project's existing numbers:
 *  PREFIX + at least 3 digits, one past the highest of that prefix
 *  (compared normalized, so "rfi-007" counts). Hand-typed numbers of another
 *  shape ("S-101") are ignored. */
export function nextDeliverableNumber(
  kind: DeliverableKind,
  existing: readonly string[]
): string {
  const prefix = NUMBER_PREFIX[kind];
  const re = new RegExp(`^${prefix.replace(/[-]/g, "\\-")}(\\d+)$`);
  let max = 0;
  for (const raw of existing) {
    const m = re.exec(normalizeCode(raw));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return prefix + String(max + 1).padStart(3, "0");
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const DEFAULT_DUE_DAYS: Readonly<Record<DeliverableKind, number | null>> = {
  DOCUMENT: null,
  RFI: 7,
  SUBMITTAL: 14,
};

/** UTC midnight of `from`'s UTC calendar day. */
export function utcMidnight(from: Date): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
}

/** RFI +7 days, SUBMITTAL +14 from when it was received; documents have no
 *  default. Always UTC midnight (the date-only convention). */
export function defaultDueDate(kind: DeliverableKind, receivedAt: Date): Date | null {
  const days = DEFAULT_DUE_DAYS[kind];
  if (days == null) return null;
  return new Date(utcMidnight(receivedAt).getTime() + days * MS_PER_DAY);
}

/** "YYYY-MM-DD" (a real calendar day) → that day at UTC midnight; anything
 *  else → null. */
export function parseDateOnly(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

/** "YYYY-MM-DD" of a UTC-midnight date, for event notes. */
export function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ───────────────────────────────────────────────────────────────────────────
// Revisions, derivation
// ───────────────────────────────────────────────────────────────────────────

export interface RevisionStateLite {
  sealedAt?: Date | string | null;
  issuedAt?: Date | string | null;
  reviewedAt?: Date | string | null;
  disposition?: string | null;
}

/** Sealed, issued or reviewed: its files and label are frozen. */
export function isRevisionLocked(r: RevisionStateLite | null | undefined): boolean {
  return !!r && (!!r.sealedAt || !!r.issuedAt || !!r.reviewedAt);
}

export function hasPdf(files: readonly { name: string; mimeType?: string | null }[]): boolean {
  return files.some(
    (f) =>
      (f.mimeType ?? "").toLowerCase() === "application/pdf" ||
      /\.pdf$/i.test(f.name.trim())
  );
}

export function statusAfterReview(disposition: Disposition): string {
  return disposition === "APPROVED" || disposition === "APPROVED_AS_NOTED"
    ? "CLOSED"
    : "RESUBMIT_REQUIRED";
}

/**
 * The status the item's revisions imply by themselves — used when restoring
 * from VOID, after deleting the latest revision, and after an undo.
 *   DOCUMENT  issued → ISSUED; sealed → SEALED; else IN_PROGRESS
 *   SUBMITTAL disposition → statusAfterReview; else UNDER_REVIEW
 *   RFI       OPEN
 */
export function derivedStatus(
  kind: DeliverableKind,
  latestRevision: RevisionStateLite | null | undefined
): string {
  if (kind === "RFI") return "OPEN";
  if (kind === "SUBMITTAL") {
    return isDisposition(latestRevision?.disposition)
      ? statusAfterReview(latestRevision!.disposition as Disposition)
      : "UNDER_REVIEW";
  }
  if (latestRevision?.issuedAt) return "ISSUED";
  if (latestRevision?.sealedAt) return "SEALED";
  return "IN_PROGRESS";
}
export const statusAfterRevisionDelete = derivedStatus;

/** Turning "seal required" off withdraws a pending seal request; every other
 *  change leaves the status alone (turning it ON after a sealed/issued
 *  revision is not a reason to un-issue anything). */
export function statusAfterSealRequiredChange(
  status: string,
  from: boolean,
  to: boolean
): string {
  if (from && !to && status === "AWAITING_SEAL") return "IN_PROGRESS";
  return status;
}

/**
 * The only transitions PATCH accepts by hand. Everything else (seal, issue,
 * review, answer, new revision) is written by its action.
 */
export function manualStatuses(
  kind: DeliverableKind,
  current: string,
  ctx: { latestRevision?: RevisionStateLite | null } = {}
): string[] {
  const restore = derivedStatus(kind, ctx.latestRevision ?? null);
  if (kind === "DOCUMENT") {
    switch (current) {
      case "IN_PROGRESS":
        return ["VOID"];
      case "AWAITING_SEAL":
        return ["IN_PROGRESS", "VOID"];
      case "SEALED":
        return ["VOID"];
      case "ISSUED":
        return ["COMMENTS", "FINAL", "VOID"];
      case "COMMENTS":
        return ["ISSUED", "FINAL", "VOID"];
      case "FINAL":
        return ["ISSUED"];
      case "VOID":
        return [restore];
      default:
        return [];
    }
  }
  if (kind === "RFI") {
    switch (current) {
      case "OPEN":
        return ["AWAITING_INFO", "VOID"];
      case "AWAITING_INFO":
        return ["OPEN", "VOID"];
      case "ANSWERED":
        return ["OPEN"];
      case "VOID":
        return ["OPEN"];
      default:
        return [];
    }
  }
  switch (current) {
    case "UNDER_REVIEW":
    case "RESUBMIT_REQUIRED":
    case "CLOSED":
      return ["VOID"];
    case "VOID":
      return [restore];
    default:
      return [];
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Seal authority
// ───────────────────────────────────────────────────────────────────────────

/**
 * May this workspace member record a PE seal?
 *
 * The workspace OWNER always may; any other CONTRIBUTOR only once the OWNER
 * has authorized them (WorkspaceMember.sealAuthorizedAt). A non-contributor
 * (GUEST/CLIENT) never may, authorized or not.
 *
 * Deliberately takes NO Position input: an OWNER/ADMIN can set their own
 * User.position, so a job title cannot stand behind a legal attestation.
 */
export function decideSealAuthority(input: {
  role: string | null | undefined;
  isContributor: boolean;
  sealAuthorizedAt: Date | string | null | undefined;
}): boolean {
  if (!input.isContributor) return false;
  return input.role === "OWNER" || input.sealAuthorizedAt != null;
}

// ───────────────────────────────────────────────────────────────────────────
// Actions
// ───────────────────────────────────────────────────────────────────────────

export type DeliverableAction =
  | "REQUEST_SEAL"
  | "SEAL"
  | "REVOKE_SEAL"
  | "ISSUE"
  | "UNDO_ISSUE"
  | "REVIEW"
  | "UNDO_REVIEW"
  | "ANSWER";

export const DELIVERABLE_ACTIONS: readonly DeliverableAction[] = [
  "REQUEST_SEAL",
  "SEAL",
  "REVOKE_SEAL",
  "ISSUE",
  "UNDO_ISSUE",
  "REVIEW",
  "UNDO_REVIEW",
  "ANSWER",
];

const ACTION_KIND: Readonly<Record<DeliverableAction, DeliverableKind>> = {
  REQUEST_SEAL: "DOCUMENT",
  SEAL: "DOCUMENT",
  REVOKE_SEAL: "DOCUMENT",
  ISSUE: "DOCUMENT",
  UNDO_ISSUE: "DOCUMENT",
  REVIEW: "SUBMITTAL",
  UNDO_REVIEW: "SUBMITTAL",
  ANSWER: "RFI",
};

const KIND_PLURAL: Readonly<Record<DeliverableKind, string>> = {
  DOCUMENT: "documents",
  RFI: "RFIs",
  SUBMITTAL: "submittals",
};

const ACTION_LABEL: Readonly<Record<DeliverableAction, string>> = {
  REQUEST_SEAL: "Requesting a seal",
  SEAL: "Sealing",
  REVOKE_SEAL: "Revoking a seal",
  ISSUE: "Issuing",
  UNDO_ISSUE: "Undoing an issue",
  REVIEW: "Recording a review",
  UNDO_REVIEW: "Undoing a review",
  ANSWER: "Answering",
};

export type DeliverableActionInput =
  | { action: "REQUEST_SEAL"; revisionId?: string | null }
  | { action: "SEAL"; revisionId?: string | null }
  | { action: "REVOKE_SEAL"; revisionId?: string | null; reason?: string | null }
  | {
      action: "ISSUE";
      revisionId?: string | null;
      issuedToParty?: string | null;
      issuedTo?: string | null;
      /** UTC midnight of the issue day; defaults to ctx.today. */
      issuedAt?: Date | null;
      transmittalNote?: string | null;
      confirmUnsealed?: boolean;
    }
  | { action: "UNDO_ISSUE"; revisionId?: string | null }
  | {
      action: "REVIEW";
      revisionId?: string | null;
      disposition?: string | null;
      notes?: string | null;
      /** UTC midnight of the day it was returned; defaults to ctx.today. */
      returnedAt?: Date | null;
    }
  | { action: "UNDO_REVIEW"; revisionId?: string | null }
  | {
      action: "ANSWER";
      response?: string | null;
      /** UTC midnight of the answer day; defaults to the previous answer's
       *  day, then ctx.today. */
      respondedAt?: Date | null;
    };

export interface ActionRevisionState {
  id: string;
  label: string;
  fileCount: number;
  hasPdf: boolean;
  sealedAt: Date | null;
  sealedById: string | null;
  sealedByName: string | null;
  issuedAt: Date | null;
  issuedById: string | null;
  issuedToParty: string | null;
  issuedTo: string | null;
  transmittalNote: string | null;
  disposition: string | null;
  reviewedAt: Date | null;
  reviewedById: string | null;
}

export interface ActionState {
  kind: DeliverableKind;
  status: string;
  sealRequired: boolean;
  party: string | null;
  response: string | null;
  respondedAt: Date | null;
  /** The highest-sequence revision; null for an RFI. */
  currentRevision: ActionRevisionState | null;
}

export interface ActionPerms {
  userId: string;
  /** name || email — snapshotted onto the event and the seal. */
  actorName: string;
  canWrite: boolean;
  canSeal: boolean;
  /** WorkspaceMember.role === OWNER in the project's workspace. */
  isWorkspaceOwner: boolean;
  /** OWNER or ADMIN in the project's workspace. */
  isWorkspaceManager: boolean;
  /** WorkspaceMember.peLicenseNo, snapshotted onto a seal. */
  peLicenseNo: string | null;
}

export interface ActionClock {
  now: Date;
  /** UTC midnight of the day the action is recorded against. */
  today: Date;
}

export type ActionDecision =
  | {
      ok: true;
      fromStatus: string;
      toStatus: string;
      statusChanged: boolean;
      /** Columns to write on Deliverable (besides status/statusChangedAt). */
      itemPatch: Record<string, unknown>;
      /** Columns to write on the current revision, or null for none. */
      revisionPatch: Record<string, unknown> | null;
      /** Extra where-conditions on the revision update (guarded write). */
      revisionGuard: Record<string, unknown> | null;
      event: {
        type: DeliverableEventType;
        note: string | null;
        revisionId: string | null;
      };
      /** Offer a stage move for this event (REQUEST_SEAL / ISSUE only). */
      stageEvent?: { event: "SEAL_REQUESTED" | "ISSUED"; issuedToParty?: IssueParty };
    }
  | { ok: false; status: number; error: string; code?: string };

function fail(status: number, error: string, code?: string): ActionDecision {
  return code ? { ok: false, status, error, code } : { ok: false, status, error };
}

function trimOrNull(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t : null;
}

/**
 * THE state machine for seal / issue / review / answer, as a pure function.
 *
 * Returns the patch to apply (status, item columns, revision columns + the
 * guard the revision update must also match) and the event to insert, or the
 * HTTP status + message to refuse with. The caller wraps the writes in one
 * transaction with a `status: fromStatus` guard on the item.
 */
export function decideDeliverableAction(
  state: ActionState,
  input: DeliverableActionInput,
  perms: ActionPerms,
  clock: ActionClock
): ActionDecision {
  const action = input.action;
  if (!(DELIVERABLE_ACTIONS as readonly string[]).includes(action)) {
    return fail(400, "Unknown action.");
  }
  if (!perms.canWrite) {
    return fail(403, "You don't have permission to edit this project");
  }
  const wantKind = ACTION_KIND[action];
  if (state.kind !== wantKind) {
    return fail(400, `${ACTION_LABEL[action]} applies to ${KIND_PLURAL[wantKind]} only.`);
  }

  const from = state.status;
  const ok = (
    toStatus: string,
    rest: Omit<
      Extract<ActionDecision, { ok: true }>,
      "ok" | "fromStatus" | "toStatus" | "statusChanged"
    >
  ): ActionDecision => ({
    ok: true,
    fromStatus: from,
    toStatus,
    statusChanged: toStatus !== from,
    ...rest,
  });

  // ── RFI answer (item-level, no revision) ────────────────────────────────
  if (input.action === "ANSWER") {
    const response = trimOrNull(input.response);
    if (!response) return fail(400, "Enter the answer.");
    if (response.length > 10000) return fail(400, "The answer is too long.");
    const respondedAt =
      input.respondedAt ?? state.respondedAt ?? clock.today;
    const itemPatch = {
      response,
      respondedAt,
      respondedById: perms.userId,
    };
    if (from === "OPEN" || from === "AWAITING_INFO") {
      return ok("ANSWERED", {
        itemPatch,
        revisionPatch: null,
        revisionGuard: null,
        event: { type: "ANSWERED", note: null, revisionId: null },
      });
    }
    if (from === "ANSWERED") {
      return ok("ANSWERED", {
        itemPatch,
        revisionPatch: null,
        revisionGuard: null,
        event: {
          type: "ANSWER_EDITED",
          note: state.response ?? null,
          revisionId: null,
        },
      });
    }
    return fail(409, `A ${statusLabel(state.kind, from).toLowerCase()} RFI can't be answered.`);
  }

  // ── Revision-scoped actions ─────────────────────────────────────────────
  const rev = state.currentRevision;
  if (!input.revisionId) return fail(400, "Choose the revision.");
  if (!rev || input.revisionId !== rev.id) {
    return fail(409, "Only the current revision can be changed.");
  }
  const revName = `Rev ${rev.label}`;

  switch (input.action) {
    case "REQUEST_SEAL": {
      if (!state.sealRequired) {
        return fail(400, "This deliverable doesn't require a seal.");
      }
      if (from !== "IN_PROGRESS" && from !== "COMMENTS") {
        return fail(409, `A seal can't be requested while it is ${statusLabel(state.kind, from).toLowerCase()}.`);
      }
      if (rev.sealedAt || rev.issuedAt) {
        return fail(409, `${revName} is already sealed or issued. Start a new revision first.`);
      }
      if (rev.fileCount < 1) return fail(409, "Attach the PDF to be sealed first.");
      return ok("AWAITING_SEAL", {
        itemPatch: {},
        revisionPatch: null,
        revisionGuard: null,
        event: { type: "SEAL_REQUESTED", note: revName, revisionId: rev.id },
        stageEvent: { event: "SEAL_REQUESTED" },
      });
    }

    case "SEAL": {
      if (!perms.canSeal) {
        return fail(403, "Only a PE authorized by the workspace owner can record a seal.");
      }
      if (rev.sealedAt) return fail(409, "Already sealed.");
      if (rev.issuedAt) {
        return fail(409, `${revName} was issued unsealed. Start a new revision to issue it sealed.`);
      }
      if (!rev.hasPdf) return fail(409, "Attach the signed & sealed PDF first.");
      if (from !== "IN_PROGRESS" && from !== "AWAITING_SEAL" && from !== "COMMENTS") {
        return fail(409, `A ${statusLabel(state.kind, from).toLowerCase()} item can't be sealed.`);
      }
      return ok("SEALED", {
        itemPatch: {},
        revisionPatch: {
          sealedAt: clock.now,
          sealedById: perms.userId,
          sealedByName: perms.actorName,
          sealLicenseNo: perms.peLicenseNo ?? null,
        },
        revisionGuard: { sealedAt: null, issuedAt: null },
        event: {
          type: "SEALED",
          note: perms.peLicenseNo ? `${revName} · ${perms.peLicenseNo}` : revName,
          revisionId: rev.id,
        },
      });
    }

    case "REVOKE_SEAL": {
      if (!perms.canSeal || (rev.sealedById !== perms.userId && !perms.isWorkspaceOwner)) {
        return fail(403, "Only the engineer who sealed it or the workspace owner can revoke this seal.");
      }
      const reason = trimOrNull(input.reason);
      if (!reason) return fail(400, "Say why the seal is being revoked.");
      if (reason.length > 500) return fail(400, "The reason is too long.");
      if (!rev.sealedAt) return fail(409, `${revName} isn't sealed.`);
      if (rev.issuedAt) {
        return fail(409, `${revName} was already issued. Start a new revision instead of revoking its seal.`);
      }
      if (from !== "SEALED") {
        return fail(409, `A seal can't be revoked while it is ${statusLabel(state.kind, from).toLowerCase()}.`);
      }
      const sealedOn = formatDateOnly(new Date(rev.sealedAt));
      const by = rev.sealedByName ? ` by ${rev.sealedByName}` : "";
      return ok(derivedStatus("DOCUMENT", { ...rev, sealedAt: null }), {
        itemPatch: {},
        revisionPatch: {
          sealedAt: null,
          sealedById: null,
          sealedByName: null,
          sealLicenseNo: null,
        },
        revisionGuard: { sealedAt: { not: null }, issuedAt: null },
        event: {
          type: "SEAL_REVOKED",
          note: `${reason} (${revName} sealed${by} on ${sealedOn})`,
          revisionId: rev.id,
        },
      });
    }

    case "ISSUE": {
      if (!isIssueParty(input.issuedToParty)) {
        return fail(400, "Choose who it was issued to.");
      }
      const party = input.issuedToParty;
      if (rev.fileCount < 1) return fail(409, "Attach the issued files first.");
      if (rev.issuedAt) return fail(409, `${revName} was already issued. Start a new revision.`);
      if (
        from !== "IN_PROGRESS" &&
        from !== "AWAITING_SEAL" &&
        from !== "SEALED" &&
        from !== "COMMENTS"
      ) {
        return fail(409, `A ${statusLabel(state.kind, from).toLowerCase()} item can't be issued.`);
      }
      const unsealed = state.sealRequired && !rev.sealedAt;
      if (unsealed && !input.confirmUnsealed) {
        return fail(409, `${revName} isn't sealed.`, "UNSEALED");
      }
      const issuedTo = trimOrNull(input.issuedTo);
      const issuedAt = input.issuedAt ?? clock.today;
      const note =
        `${revName} → ${issuePartyLabel(party)}${issuedTo ? `: ${issuedTo}` : ""}` +
        (unsealed ? " · preliminary (not sealed)" : "");
      return ok("ISSUED", {
        itemPatch: {},
        revisionPatch: {
          issuedAt,
          issuedToParty: party,
          issuedTo,
          transmittalNote: trimOrNull(input.transmittalNote),
          issuedById: perms.userId,
        },
        revisionGuard: { issuedAt: null },
        event: { type: "ISSUED", note, revisionId: rev.id },
        stageEvent: { event: "ISSUED", issuedToParty: party },
      });
    }

    case "UNDO_ISSUE": {
      if (!rev.issuedAt) return fail(409, `${revName} hasn't been issued.`);
      if (from !== "ISSUED") {
        return fail(409, "Only an issue still marked Issued can be undone.");
      }
      if (rev.issuedById !== perms.userId && !perms.isWorkspaceManager) {
        return fail(403, "Only the person who issued it or a workspace admin can undo this issue.");
      }
      const parts = [
        `${issuePartyLabel(rev.issuedToParty) ?? "Issued"}${rev.issuedTo ? `: ${rev.issuedTo}` : ""}`,
        formatDateOnly(new Date(rev.issuedAt)),
      ];
      if (rev.transmittalNote) parts.push(rev.transmittalNote);
      return ok(derivedStatus("DOCUMENT", { ...rev, issuedAt: null }), {
        itemPatch: {},
        revisionPatch: {
          issuedAt: null,
          issuedToParty: null,
          issuedTo: null,
          transmittalNote: null,
          issuedById: null,
        },
        revisionGuard: { issuedAt: { not: null } },
        event: { type: "ISSUE_UNDONE", note: `${revName} · ${parts.join(" / ")}`, revisionId: rev.id },
      });
    }

    case "REVIEW": {
      if (!isDisposition(input.disposition)) return fail(400, "Choose a disposition.");
      const disposition = input.disposition;
      if (rev.disposition) return fail(409, "This cycle was already reviewed.");
      if (from !== "UNDER_REVIEW") {
        return fail(409, `A ${statusLabel(state.kind, from).toLowerCase()} submittal can't be reviewed.`);
      }
      const notes = trimOrNull(input.notes);
      if (notes && notes.length > 5000) return fail(400, "The notes are too long.");
      return ok(statusAfterReview(disposition), {
        itemPatch: {},
        revisionPatch: {
          disposition,
          reviewedAt: clock.now,
          reviewedById: perms.userId,
          issuedAt: input.returnedAt ?? clock.today,
          issuedToParty: "CONTRACTOR",
          issuedTo: state.party ?? null,
          issuedById: perms.userId,
          transmittalNote: notes,
        },
        revisionGuard: { disposition: null },
        event: {
          type: "REVIEWED",
          note: `${revName} — ${dispositionLabel(disposition)}`,
          revisionId: rev.id,
        },
      });
    }

    case "UNDO_REVIEW": {
      if (!rev.disposition) return fail(409, `${revName} hasn't been reviewed.`);
      if (from !== "RESUBMIT_REQUIRED" && from !== "CLOSED") {
        return fail(409, `A review can't be undone while the submittal is ${statusLabel(state.kind, from).toLowerCase()}.`);
      }
      if (rev.reviewedById !== perms.userId && !perms.isWorkspaceManager) {
        return fail(403, "Only the reviewer or a workspace admin can undo this review.");
      }
      return ok("UNDER_REVIEW", {
        itemPatch: {},
        revisionPatch: {
          disposition: null,
          reviewedAt: null,
          reviewedById: null,
          issuedAt: null,
          issuedToParty: null,
          issuedTo: null,
          issuedById: null,
          transmittalNote: null,
        },
        revisionGuard: { disposition: { not: null } },
        event: {
          type: "REVIEW_UNDONE",
          note: `${revName} — ${dispositionLabel(rev.disposition) ?? rev.disposition}`,
          revisionId: rev.id,
        },
      });
    }
  }
  return fail(400, "Unknown action.");
}

// ───────────────────────────────────────────────────────────────────────────
// Lists
// ───────────────────────────────────────────────────────────────────────────

/**
 * The register's order: open items first, soonest due first (no due date
 * last), then by number (numeric-aware, so D-9 before D-10); closed items
 * after, most recently touched first.
 */
export function compareDeliverableRows(
  a: { open: boolean; dueDate: string | Date | null; number: string; updatedAt: string | Date },
  b: { open: boolean; dueDate: string | Date | null; number: string; updatedAt: string | Date }
): number {
  if (a.open !== b.open) return a.open ? -1 : 1;
  const t = (v: string | Date | null) => (v == null ? null : new Date(v).getTime());
  if (a.open) {
    const da = t(a.dueDate);
    const db = t(b.dueDate);
    if (da !== db) {
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    }
    return a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" });
  }
  return (t(b.updatedAt) ?? 0) - (t(a.updatedAt) ?? 0);
}

// ───────────────────────────────────────────────────────────────────────────
// Empty-state suggestions
// ───────────────────────────────────────────────────────────────────────────

export interface DeliverableSuggestion {
  docType: DocType;
  title: string;
}

/** One-click starters on the empty Documents tab, per pipeline. A project
 *  with no type gets none. Product vocabulary — Juan to confirm. */
export const DELIVERABLE_SUGGESTIONS: Readonly<Record<PipelineId, readonly DeliverableSuggestion[]>> = {
  recert: [
    { docType: "REPORT", title: "Structural recertification report" },
    { docType: "DRAWINGS", title: "Repair drawings" },
    { docType: "LETTER", title: "Completion of repairs letter" },
  ],
  design: [
    { docType: "DRAWINGS", title: "Structural drawings" },
    { docType: "CALCULATIONS", title: "Structural calculations" },
    { docType: "SPECIFICATIONS", title: "Structural specifications" },
  ],
  permit: [
    { docType: "DRAWINGS", title: "Permit drawings" },
    { docType: "CALCULATIONS", title: "Structural calculations" },
    { docType: "LETTER", title: "Response to comments letter" },
  ],
  construction: [
    { docType: "REPORT", title: "Inspection report" },
    { docType: "LETTER", title: "Closeout letter" },
  ],
};
