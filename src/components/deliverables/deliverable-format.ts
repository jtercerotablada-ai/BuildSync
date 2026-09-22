/**
 * deliverable-format.ts — the pure display rules of the Deliverables tab.
 *
 * Two kinds of dates reach the client and they must never be read the same
 * way:
 *   - DATE-ONLY fields (dueDate, receivedAt, respondedAt, issuedAt) are
 *     stored at UTC MIDNIGHT of the day. Read with local getters they shift
 *     one day back for everyone west of UTC (Miami included), so they are
 *     always formatted from their UTC calendar day.
 *   - TIMESTAMPS (sealedAt, reviewedAt, statusChangedAt, event createdAt)
 *     are real instants and are formatted in the viewer's own zone.
 *
 * "Today" is always PASSED IN (from useToday() in a component), never read
 * here: the server render runs in UTC and a clock read during render is the
 * one-day-ahead-after-8pm bug (src/lib/use-today.ts).
 *
 * PURE: no DOM, no clock, no fetch. Tested in deliverable-format.test.ts.
 */

import {
  dueDateToLocalMidnight,
  toDateOnlyISO,
} from "@/lib/date-only";
import {
  dispositionLabel,
  issuePartyLabel,
  type DeliverableKind,
} from "@/lib/deliverables";
import type { StageHolder } from "@/lib/pipelines";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Sep 28" (or "Sep 28, 2025" outside `today`'s year) for a DATE-ONLY
 *  field, read from its UTC calendar day. */
export function formatDay(
  iso: string | null | undefined,
  today?: Date | null
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getUTCFullYear();
  const base = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return today && today.getFullYear() !== y ? `${base}, ${y}` : base;
}

/** "Sep 21, 2026" for a TIMESTAMP, in the viewer's zone. */
export function formatStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "Sep 21" for a TIMESTAMP, in the viewer's zone (History rows). */
export function formatStampShort(
  iso: string | null | undefined,
  today?: Date | null
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return today && today.getFullYear() !== d.getFullYear()
    ? `${base}, ${d.getFullYear()}`
    : base;
}

/** A date-only ISO string → the "YYYY-MM-DD" an <input type="date"> holds. */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** The "YYYY-MM-DD" of `today` (local midnight) to send to the API, so an
 *  action taken after 8pm in Miami is still dated today, not tomorrow. */
export function todayInput(today: Date): string {
  return toDateOnlyISO(today);
}

/** Whole days since a TIMESTAMP, counted by the viewer's calendar days
 *  (never negative). */
export function daysSince(iso: string, today: Date): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.max(0, Math.round((today.getTime() - day.getTime()) / MS_PER_DAY));
}

/** Days a DATE-ONLY due date is past `today`; 0 when not overdue. */
export function overdueDays(dueIso: string | null | undefined, today: Date): number {
  if (!dueIso) return 0;
  const due = dueDateToLocalMidnight(dueIso);
  if (Number.isNaN(due.getTime())) return 0;
  return Math.max(0, Math.round((today.getTime() - due.getTime()) / MS_PER_DAY));
}

/** "3d", "today" → used after a holder label ("The PE · 3d"). */
export function formatDayCount(n: number): string {
  return n <= 0 ? "today" : `${n}d`;
}

/** "2 days" / "1 day" / "today" — the sheet's longer holder line. */
export function formatDayCountLong(n: number): string {
  if (n <= 0) return "today";
  return n === 1 ? "1 day" : `${n} days`;
}

/** The label of the `party` field, which means something different per kind. */
export function partyFieldLabel(kind: DeliverableKind): string {
  return kind === "RFI"
    ? "Asked by"
    : kind === "SUBMITTAL"
      ? "Submitted by"
      : "Usual recipient";
}

/** The label of the `description` field per kind. */
export function descriptionFieldLabel(kind: DeliverableKind): string {
  return kind === "RFI" ? "Question" : kind === "SUBMITTAL" ? "Description" : "Scope";
}

/** Status pill tone: gold while it is on OUR desk (us or the PE), slate
 *  while someone else holds it, faded once closed. */
export type StatusTone = "ours" | "theirs" | "closed";
export function statusTone(open: boolean, holder: StageHolder): StatusTone {
  if (!open) return "closed";
  return holder === "FIRM" || holder === "PE" ? "ours" : "theirs";
}

/** The register's last column: the current revision's issue ("Sep 22 →
 *  Client"), a submittal's disposition, or an RFI's answer day. */
export function lastOutcome(
  row: {
    kind: DeliverableKind;
    status: string;
    respondedAt: string | null;
    currentRevision: {
      issuedAt: string | null;
      issuedToParty: string | null;
      disposition: string | null;
    } | null;
  },
  today?: Date | null
): string | null {
  if (row.kind === "RFI") {
    // A reopened RFI keeps its old respondedAt (by design); only a standing
    // answer shows its date here, or the row reads as answered and open.
    if (!row.respondedAt) return null;
    if (row.status === "ANSWERED") return `Answered ${formatDay(row.respondedAt, today)}`;
    return row.status === "VOID" ? null : "Reopened";
  }
  const rev = row.currentRevision;
  if (!rev) return null;
  if (row.kind === "SUBMITTAL") return dispositionLabel(rev.disposition);
  if (!rev.issuedAt) return null;
  const party = issuePartyLabel(rev.issuedToParty);
  return `${formatDay(rev.issuedAt, today)}${party ? ` → ${party}` : ""}`;
}

/** Case-insensitive match on number or title (the search box). */
export function matchesSearch(
  row: { number: string; title: string },
  q: string
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    row.number.toLowerCase().includes(needle) ||
    row.title.toLowerCase().includes(needle)
  );
}

/** Open items per holder, in the strip's fixed order, zero counts dropped. */
const HOLDER_ORDER: readonly StageHolder[] = [
  "FIRM",
  "PE",
  "CLIENT",
  "ARCHITECT",
  "CONTRACTOR",
  "CITY",
  "NONE",
];
export function holderCounts(
  rows: readonly { open: boolean; holder: StageHolder }[]
): { holder: StageHolder; count: number }[] {
  const m = new Map<StageHolder, number>();
  for (const r of rows) {
    if (!r.open) continue;
    m.set(r.holder, (m.get(r.holder) ?? 0) + 1);
  }
  return HOLDER_ORDER.filter((h) => (m.get(h) ?? 0) > 0).map((h) => ({
    holder: h,
    count: m.get(h)!,
  }));
}

/** "1.2 MB" */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return `${i === 0 ? v : v.toFixed(1)} ${units[i]}`;
}

/** Two-letter initials for an avatar fallback. */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * The name to prefill for a party: the project's own contact for it (the
 * client contact / the AHJ from the jurisdiction feature), then the
 * deliverable's usual recipient, then — for the client only — the project's
 * client name. A city is never prefilled with the client's name.
 */
export function issueNameFor(
  party: string,
  project: {
    clientContactName?: string | null;
    jurisdiction?: string | null;
    clientName?: string | null;
  } | null,
  deliverableParty: string | null
): string {
  if (party === "CLIENT") {
    return (
      project?.clientContactName?.trim() ||
      deliverableParty?.trim() ||
      project?.clientName?.trim() ||
      ""
    );
  }
  if (party === "CITY") {
    return project?.jurisdiction?.trim() || deliverableParty?.trim() || "";
  }
  return deliverableParty?.trim() || "";
}


/**
 * One History line's text after the actor: "Sealed Rev 0 · PE 12345",
 * "Changed status to Void", "Seal revoked on Rev 0 — wrong sheet set".
 * Event notes often start with "Rev <label>" themselves; that prefix is
 * dropped when the event already names its revision, so it never reads
 * "Sealed Rev 0 — Rev 0".
 */
export function eventText(
  e: {
    type: string;
    toStatus: string | null;
    note: string | null;
    revisionLabel: string | null;
  },
  labels: {
    eventLabel: (type: string) => string;
    statusLabel: (status: string) => string;
  }
): string {
  const verb = labels.eventLabel(e.type);
  if (e.type === "STATUS") {
    return e.toStatus ? `Changed status to ${labels.statusLabel(e.toStatus)}` : verb;
  }
  if (e.type === "CREATED") return verb;
  const rev = e.revisionLabel ? `Rev ${e.revisionLabel}` : null;
  let note = (e.note ?? "").trim();
  if (rev && note.startsWith(rev)) {
    note = note.slice(rev.length).replace(/^\s*[·—-]\s*/, "").trim();
  }
  let head = verb;
  if (rev) head = e.type === "SEAL_REVOKED" ? `${verb} on ${rev}` : `${verb} ${rev}`;
  else if (/^Rev \S+$/.test(note)) {
    // A deleted revision keeps its label only in the note.
    return `${verb} ${note}`;
  }
  if (!note) return head;
  // "Issued Rev 0 → Client: Bayview" reads as one phrase; everything else
  // gets a dash.
  return note.startsWith("→") ? `${head} ${note}` : `${head} — ${note}`;
}
