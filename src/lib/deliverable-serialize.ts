/**
 * deliverable-serialize.ts — the JSON shapes the Deliverables API returns,
 * and the Prisma selects that feed them.
 *
 * One place for the shapes so the list, the detail, every mutation response
 * and the stage-offer response agree field for field. Two rules hold here:
 *   - a stored blob url NEVER leaves the server: every file url is
 *     fileReadUrl("deliverable", id), which re-runs the project's read rule;
 *   - every date is an ISO string (date-only fields are UTC midnight).
 */

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { fileReadUrl } from "@/lib/storage";
import {
  DELETE_BLOCKING_EVENTS,
  holderFor,
  isOpen,
  isRevisionLocked,
  manualStatuses,
  statusLabel,
  type DeliverableKind,
} from "@/lib/deliverables";
import type { StageHolder } from "@/lib/pipelines";
import type { UserLite } from "@/lib/deliverable-access";

const userLite = { select: { id: true, name: true, image: true } } as const;

const iso = (d: Date | null | undefined): string | null =>
  d ? d.toISOString() : null;

// ── Files ──────────────────────────────────────────────────────────────────

export const deliverableFileSelect = {
  id: true,
  name: true,
  size: true,
  mimeType: true,
  createdAt: true,
  revisionId: true,
  uploader: userLite,
} satisfies Prisma.DeliverableFileSelect;

type FileRow = Prisma.DeliverableFileGetPayload<{ select: typeof deliverableFileSelect }>;

export interface DeliverableFileJSON {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
  url: string;
  uploader: UserLite | null;
}

export function toFileJSON(f: FileRow): DeliverableFileJSON {
  return {
    id: f.id,
    name: f.name,
    size: f.size,
    mimeType: f.mimeType,
    createdAt: f.createdAt.toISOString(),
    url: fileReadUrl("deliverable", f.id),
    uploader: f.uploader ?? null,
  };
}

// ── Revisions ─────────────────────────────────────────────────────────────

export const revisionSelect = {
  id: true,
  sequence: true,
  label: true,
  notes: true,
  createdAt: true,
  receivedAt: true,
  disposition: true,
  reviewedAt: true,
  reviewedBy: userLite,
  sealedAt: true,
  sealedByName: true,
  sealLicenseNo: true,
  sealedBy: userLite,
  issuedAt: true,
  issuedToParty: true,
  issuedTo: true,
  transmittalNote: true,
  issuedBy: userLite,
  files: { select: deliverableFileSelect, orderBy: { createdAt: "asc" } },
} satisfies Prisma.DeliverableRevisionSelect;

type RevisionRow = Prisma.DeliverableRevisionGetPayload<{ select: typeof revisionSelect }>;

export interface RevisionJSON {
  id: string;
  sequence: number;
  label: string;
  notes: string | null;
  createdAt: string;
  receivedAt: string | null;
  disposition: string | null;
  reviewedAt: string | null;
  reviewedBy: UserLite | null;
  sealedAt: string | null;
  sealedByName: string | null;
  sealLicenseNo: string | null;
  sealedBy: UserLite | null;
  issuedAt: string | null;
  issuedToParty: string | null;
  issuedTo: string | null;
  transmittalNote: string | null;
  issuedBy: UserLite | null;
  files: DeliverableFileJSON[];
  /** Sealed, issued or reviewed: files/label frozen. */
  locked: boolean;
  /** Highest sequence — the only revision actions apply to. */
  isCurrent: boolean;
}

export function toRevisionJSON(r: RevisionRow, isCurrent: boolean): RevisionJSON {
  return {
    id: r.id,
    sequence: r.sequence,
    label: r.label,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    receivedAt: iso(r.receivedAt),
    disposition: r.disposition,
    reviewedAt: iso(r.reviewedAt),
    reviewedBy: r.reviewedBy ?? null,
    sealedAt: iso(r.sealedAt),
    sealedByName: r.sealedByName,
    sealLicenseNo: r.sealLicenseNo,
    sealedBy: r.sealedBy ?? null,
    issuedAt: iso(r.issuedAt),
    issuedToParty: r.issuedToParty,
    issuedTo: r.issuedTo,
    transmittalNote: r.transmittalNote,
    issuedBy: r.issuedBy ?? null,
    files: r.files.map(toFileJSON),
    locked: isRevisionLocked(r),
    isCurrent,
  };
}

/** Load one revision (bound to its deliverable) as RevisionJSON. */
export async function loadRevisionJSON(
  deliverableId: string,
  revisionId: string
): Promise<RevisionJSON | null> {
  const [rev, latest] = await Promise.all([
    prisma.deliverableRevision.findFirst({
      where: { id: revisionId, deliverableId },
      select: revisionSelect,
    }),
    prisma.deliverableRevision.findFirst({
      where: { deliverableId },
      orderBy: { sequence: "desc" },
      select: { id: true },
    }),
  ]);
  if (!rev) return null;
  return toRevisionJSON(rev, latest?.id === rev.id);
}

// ── Rows ──────────────────────────────────────────────────────────────────

export const deliverableRowSelect = {
  id: true,
  kind: true,
  docType: true,
  number: true,
  title: true,
  status: true,
  statusChangedAt: true,
  dueDate: true,
  receivedAt: true,
  respondedAt: true,
  sealRequired: true,
  party: true,
  updatedAt: true,
  assignee: userLite,
  revisions: {
    orderBy: { sequence: "desc" },
    take: 1,
    select: {
      id: true,
      label: true,
      sequence: true,
      sealedAt: true,
      sealedByName: true,
      issuedAt: true,
      issuedToParty: true,
      issuedTo: true,
      disposition: true,
      _count: { select: { files: true } },
    },
  },
  _count: { select: { revisions: true } },
} satisfies Prisma.DeliverableSelect;

type RowRecord = Prisma.DeliverableGetPayload<{ select: typeof deliverableRowSelect }>;

export interface DeliverableRowJSON {
  id: string;
  kind: DeliverableKind;
  docType: string | null;
  number: string;
  title: string;
  status: string;
  statusLabel: string;
  statusChangedAt: string;
  holder: StageHolder;
  open: boolean;
  dueDate: string | null;
  receivedAt: string | null;
  respondedAt: string | null;
  sealRequired: boolean;
  party: string | null;
  assignee: UserLite | null;
  currentRevision: {
    id: string;
    label: string;
    sequence: number;
    fileCount: number;
    sealedAt: string | null;
    sealedByName: string | null;
    issuedAt: string | null;
    issuedToParty: string | null;
    issuedTo: string | null;
    disposition: string | null;
  } | null;
  revisionCount: number;
  updatedAt: string;
}

export function toRowJSON(d: RowRecord): DeliverableRowJSON {
  const kind = d.kind as DeliverableKind;
  const cur = d.revisions[0] ?? null;
  return {
    id: d.id,
    kind,
    docType: d.docType,
    number: d.number,
    title: d.title,
    status: d.status,
    statusLabel: statusLabel(kind, d.status),
    statusChangedAt: d.statusChangedAt.toISOString(),
    holder: holderFor(kind, d.status, cur?.issuedToParty ?? null),
    open: isOpen(kind, d.status),
    dueDate: iso(d.dueDate),
    receivedAt: iso(d.receivedAt),
    respondedAt: iso(d.respondedAt),
    sealRequired: d.sealRequired,
    party: d.party,
    assignee: d.assignee ?? null,
    currentRevision: cur
      ? {
          id: cur.id,
          label: cur.label,
          sequence: cur.sequence,
          fileCount: cur._count.files,
          sealedAt: iso(cur.sealedAt),
          sealedByName: cur.sealedByName,
          issuedAt: iso(cur.issuedAt),
          issuedToParty: cur.issuedToParty,
          issuedTo: cur.issuedTo,
          disposition: cur.disposition,
        }
      : null,
    revisionCount: d._count.revisions,
    updatedAt: d.updatedAt.toISOString(),
  };
}

export async function loadRowJSON(deliverableId: string): Promise<DeliverableRowJSON | null> {
  const d = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    select: deliverableRowSelect,
  });
  return d ? toRowJSON(d) : null;
}

// ── Events ────────────────────────────────────────────────────────────────

export interface DeliverableEventJSON {
  id: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  actorName: string | null;
  revisionLabel: string | null;
  createdAt: string;
}

// ── Detail ────────────────────────────────────────────────────────────────

export interface DeliverableDetailJSON extends DeliverableRowJSON {
  description: string | null;
  response: string | null;
  respondedBy: UserLite | null;
  createdBy: UserLite | null;
  createdAt: string;
  /** Newest first. */
  revisions: RevisionJSON[];
  /** Item-level files (RFI attachments). */
  files: DeliverableFileJSON[];
  /** Newest first, at most 50. */
  events: DeliverableEventJSON[];
  /** Statuses PATCH accepts from the current one. */
  manualStatuses: string[];
  /** True when DELETE would 409 (a lock, an answer, or a seal/issue/review
   *  event ever recorded) — the UI disables Delete and points at Void. */
  deleteBlocked: boolean;
}

export async function loadDetailJSON(
  deliverableId: string
): Promise<DeliverableDetailJSON | null> {
  const d = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    select: {
      ...deliverableRowSelect,
      description: true,
      response: true,
      respondedBy: userLite,
      createdBy: userLite,
      createdAt: true,
    },
  });
  if (!d) return null;

  const [revisions, files, events, blockingEvents] = await Promise.all([
    prisma.deliverableRevision.findMany({
      where: { deliverableId },
      orderBy: { sequence: "desc" },
      select: revisionSelect,
    }),
    prisma.deliverableFile.findMany({
      where: { deliverableId, revisionId: null },
      orderBy: { createdAt: "asc" },
      select: deliverableFileSelect,
    }),
    prisma.deliverableEvent.findMany({
      where: { deliverableId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      select: {
        id: true,
        type: true,
        fromStatus: true,
        toStatus: true,
        note: true,
        actorName: true,
        createdAt: true,
        revision: { select: { label: true } },
      },
    }),
    prisma.deliverableEvent.count({
      where: { deliverableId, type: { in: [...DELETE_BLOCKING_EVENTS] } },
    }),
  ]);

  const row = toRowJSON(d);
  const kind = row.kind;
  const latest = revisions[0] ?? null;
  return {
    ...row,
    description: d.description,
    response: d.response,
    respondedBy: d.respondedBy ?? null,
    createdBy: d.createdBy ?? null,
    createdAt: d.createdAt.toISOString(),
    revisions: revisions.map((r, i) => toRevisionJSON(r, i === 0)),
    files: files.map(toFileJSON),
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      note: e.note,
      actorName: e.actorName,
      revisionLabel: e.revision?.label ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
    manualStatuses: manualStatuses(kind, d.status, { latestRevision: latest }),
    deleteBlocked:
      revisions.some((r) => isRevisionLocked(r)) ||
      d.respondedAt != null ||
      blockingEvents > 0,
  };
}
