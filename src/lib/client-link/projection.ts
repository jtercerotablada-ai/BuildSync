/**
 * THE ONLY PLACE THAT DECIDES WHAT A CLIENT SEES.
 *
 * Everything reachable from a `/p/<token>` page is assembled here. If a field
 * is not named in this file, a client cannot see it. That is the entire point:
 * the blast radius of "did we leak the budget?" is one file, not a component
 * tree.
 *
 * Two rules keep it that way, and both are load-bearing:
 *
 *   1. Every Prisma read uses an EXPLICIT `select`. Never `include` a whole
 *      relation, never a bare `findUnique` that returns the model.
 *   2. No Prisma object is ever `...`-spread into a return value. Spreading is
 *      how a column added next year silently becomes client-visible; each
 *      field below is copied out by hand so that adding a column to Project is
 *      inert here until someone deliberately edits this file.
 *
 * WITHHELD_FIELDS names the columns whose exposure would be a real incident,
 * and projection.test.ts asserts the select does not contain them.
 */

import prisma from "@/lib/prisma";

/**
 * Exactly the Project columns a client may see. Frozen so a caller cannot
 * mutate the shared object into selecting more.
 *
 * `color` is a client-safe display accent (the firm sets it deliberately and
 * it carries no commercial meaning) — it drives the hero band until a real
 * `Project.coverImageUrl` column exists.
 *
 * `status` IS selected here on purpose, but it never leaves this file as the
 * raw enum: `toClientStatus` collapses the firm's private traffic-light into a
 * friendly, non-alarming label before it is ever placed on the view. See the
 * status note below.
 */
export const CLIENT_PROJECT_SELECT = Object.freeze({
  id: true,
  name: true,
  projectNumber: true,
  type: true,
  location: true,
  startDate: true,
  endDate: true,
  gate: true,
  color: true,
  status: true,
} as const);

/**
 * Columns on Project that must never reach a client, each for its own reason:
 *
 *   budget, currency  — commercial terms; the client's contract is not the
 *                       firm's internal number.
 *   notes             — internal prose.
 *   workspaceId       — a tenant identifier is an enumeration primitive.
 *   visibility        — internal RBAC state.
 *   clientName        — the firm's label FOR this client, not necessarily
 *                       what the client calls themselves.
 *
 * `status` was here originally and has been deliberately removed: the raw
 * ON_TRACK / AT_RISK / OFF_TRACK enum still must never ship, but the column is
 * now read and translated server-side into a friendly label by
 * `toClientStatus` — the enum value itself never enters the payload.
 */
export const WITHHELD_FIELDS = Object.freeze([
  "budget",
  "currency",
  "notes",
  "workspaceId",
  "visibility",
  "clientName",
] as const);

/**
 * Values of the "Responsible" dropdown that mean "the client owes us this".
 *
 * Matched case-insensitively against BOTH the stored option id and its
 * display label, because the id is only stable for projects seeded from
 * src/lib/project-templates.ts — a field created by hand in the UI gets a
 * generated id and a typed label.
 */
const CLIENT_SIDE_RESPONSIBLE = new Set([
  "owner",
  "client",
  "building owner",
  "property owner",
  "building_owner",
  "property_owner",
]);

/**
 * The single "Responsible" option that means "our inspector performs a site
 * visit" — the source of the client's Upcoming Inspections. Matched the same
 * case-insensitive way as the client set above.
 */
const INSPECTOR_RESPONSIBLE = new Set(["inspector"]);

/** The custom field, by name, that records who owns each step. */
const RESPONSIBLE_FIELD_NAME = "Responsible";

export interface ClientMilestone {
  id: string;
  name: string;
  dueDate: Date | null;
  completed: boolean;
  completedAt: Date | null;
}

export interface ClientActionItem {
  id: string;
  name: string;
  /** Client-safe one-liner beneath the item. Null → the UI omits the sub-line. */
  description: string | null;
  dueDate: Date | null;
}

export interface ClientDocument {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: Date;
}

/** A future site visit tagged to the firm's inspector. Never carries a time. */
export interface ClientInspection {
  id: string;
  name: string;
  dueDate: Date;
}

/** One message on the client thread — the firm's (tagged @cliente) or the
 *  client's own reply, posted through the share link. */
export interface ClientMessage {
  id: string;
  content: string;
  at: Date;
  /** Who is speaking: the firm, or the client themselves via this link. */
  from: "FIRM" | "CLIENT";
  /** Display name: the real author (Juan's call — the client should see WHO
   *  wrote it), or the reply's own link label. Never an email address. */
  authorName: string;
}

/**
 * The message-visibility rule, in one pure, testable place: a project-chat
 * message reaches the client ONLY when the firm explicitly tagged it with
 * @cliente (or @client — the check is a case-insensitive "@client" substring,
 * which matches both). Everything else in the internal chat stays internal.
 *
 * This is opt-in per message by construction: the default for a new message is
 * invisible, and no bulk setting can flip old messages into the portal. The
 * SQL query narrows on the same substring; this function is the final gate
 * re-applied to every row, so the two can never drift apart silently.
 */
export const CLIENT_MESSAGE_TAG = "@client";
export function isClientTaggedMessage(content: string): boolean {
  return content.toLowerCase().includes(CLIENT_MESSAGE_TAG);
}

/** A message reaches the client thread when the firm tagged it — or when the
 *  client themselves sent it through a share link (clientLinkId set by the
 *  public reply endpoint, and only by it). */
export function isClientVisibleMessage(m: {
  content: string;
  clientLinkId: string | null;
}): boolean {
  return m.clientLinkId !== null || isClientTaggedMessage(m.content);
}

/** The friendly, non-alarming translation of the firm's private status. */
export interface ClientStatusBadge {
  label: string;
  tone: "positive" | "neutral";
}

export interface ClientProgress {
  done: number;
  total: number;
  percent: number;
}

export type StageState = "done" | "active" | "upcoming";

export interface ClientStage {
  /** Client-facing label — a relabel where one is approved, else the real
   *  Section name. Internal lane names are dropped upstream and never appear. */
  label: string;
  /** Per-stage state derived from THIS section's own task completion, never
   *  from position: done = all done, active = some done, upcoming = none done. */
  state: StageState;
  /** Real non-private task tallies for the section (0/0 for the gate fallback). */
  done: number;
  total: number;
  /** True for the single furthest-along incomplete stage — the current step. */
  current: boolean;
}

export interface ClientCurrentStage {
  label: string;
  subline: string;
}

export interface ClientBallHolder {
  side: "CLIENT" | "US";
  reason: string;
}

export interface ClientActivityEvent {
  id: string;
  text: string;
  /** Always the firm, never an individual — see buildClientActivityFeed. */
  actor: "Tercero Tablada";
  at: Date;
}

export interface ClientProjectView {
  id: string;
  name: string;
  projectNumber: string | null;
  type: string | null;
  location: string | null;
  startDate: Date | null;
  endDate: Date | null;
  gate: string | null;
  /** Hero accent band (Project.color). Never a fabricated photo. */
  coverColor: string;
  /** Friendly badge; the raw status enum is never on this object. */
  status: ClientStatusBadge;
  /** One sentence for the hero — the firm's own note, or a tone-only default. */
  friendlySentence: string;
  /** Task-count completion, or null when the project has no root tasks yet. */
  progress: ClientProgress | null;
  /** The real Section-derived rail (every project type); null → gate fallback. */
  stages: ClientStage[] | null;
  /** The one stage to name in the stat card (works for rail OR gate fallback). */
  currentStage: ClientCurrentStage | null;
  milestones: ClientMilestone[];
  whatWeNeedFromYou: ClientActionItem[];
  documents: ClientDocument[];
  upcomingInspections: ClientInspection[];
  /** Project-chat messages the firm tagged @cliente — nothing else, ever. */
  messages: ClientMessage[];
  whoHasTheBall: ClientBallHolder;
  activity: ClientActivityEvent[];
  /** Omitted entirely when no status update carries a clientSummary. */
  latestUpdate?: { summary: string; postedAt: Date };
}

/** Turn ENUM_LIKE_THIS into "Enum like this" for display. */
function humanize(value: string): string {
  const spaced = value.replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/* ─────────────────────────────────────────────────────────────────────────
   PURE HELPERS — no Prisma, unit-tested in projection.test.ts. These are the
   client-safety decisions expressed as functions of plain data, so they can
   be exercised without a database.
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Translate the firm's private ProjectStatus into a friendly badge. The raw
 * enum must NEVER reach the client, so this is the only thing the view carries.
 *
 * AT_RISK and OFF_TRACK deliberately collapse to the SAME neutral "In
 * Progress" label: a client is never shown the firm's internal alarm, and the
 * two must be indistinguishable so the collapse cannot be reverse-engineered.
 */
export function toClientStatus(status: string): ClientStatusBadge {
  switch (status) {
    case "ON_TRACK":
      return { label: "On Track", tone: "positive" };
    case "COMPLETE":
      return { label: "Complete", tone: "positive" };
    case "ON_HOLD":
      return { label: "On Hold", tone: "neutral" };
    case "AT_RISK":
    case "OFF_TRACK":
    default:
      return { label: "In Progress", tone: "neutral" };
  }
}

/**
 * The hero sentence. Prefer the firm's own client paraphrase; otherwise a
 * single sentence keyed on nothing finer than the badge tone (so it can never
 * betray the AT_RISK/OFF_TRACK collapse).
 */
export function friendlySentence(
  clientSummary: string | null,
  tone: ClientStatusBadge["tone"]
): string {
  if (clientSummary && clientSummary.trim()) return clientSummary.trim();
  return tone === "positive"
    ? "Your project is progressing as planned. Keep an eye on your action items below."
    : "Your project is moving forward. See your action items below.";
}

/**
 * Overall progress from ROOT tasks only (parentTaskId IS NULL), never earned
 * value. `total === 0 → null` so the UI can say "Not started yet" instead of a
 * bare, dispiriting 0%.
 */
export function computeProgress(
  tasks: { completed: boolean }[]
): ClientProgress | null {
  const total = tasks.length;
  if (total === 0) return null;
  const done = tasks.filter((t) => t.completed).length;
  return { done, total, percent: Math.round((done / total) * 100) };
}

/**
 * Approved client relabels for known section names — OPTIONAL. A section whose
 * normalized name is not here renders its OWN real name, so a renamed or newly
 * added section shows up automatically instead of being silently dropped.
 * Keyed by normalized (trim + lowercase) Section.name.
 */
const SECTION_RELABEL: Record<string, string> = {
  "kickoff & scheduling": "Kickoff",
  "building official review": "City Review",
  "repairs (if required)": "Repairs",
  "recertification complete": "Recertified",
};

/**
 * The three internal field-inspection lanes. These are the firm's own workflow
 * swim-lanes, NOT client phases, and their names must never reach the client —
 * so they are the ONLY sections dropped from the rail, matched by normalized
 * name. Everything else the project defines is a real client phase.
 */
const INTERNAL_SECTION_LANES = new Set(["scheduled", "performed", "report issued"]);

export interface StageSectionInput {
  name: string;
  tasks: { completed: boolean }[];
}

/**
 * Build the client stage rail from a project's REAL Section rows, in their real
 * `position` order (the caller passes them ordered). The rail is 100% driven by
 * the sections that exist:
 *
 *   • which sections appear  — every section except the three internal lanes;
 *   • their labels           — an approved relabel if one exists, else the real
 *                              Section name;
 *   • their per-stage state  — from each section's OWN non-private task tally,
 *                              never from position:
 *                                done     = total > 0 && done === total
 *                                active   = done > 0 && done < total
 *                                upcoming = done === 0
 *   • the CURRENT step       — the furthest-along partially-done section
 *                              (highest index with 0 < done < total); if none is
 *                              partial, the first incomplete one; if all are
 *                              complete, the last.
 *
 * Each stage carries its real { done, total } so the UI can print "5 of 20".
 * Returns null only when there is no client-visible section at all, so the
 * caller can fall back to the gate rail rather than render nothing.
 */
export function computeSectionStages(sections: StageSectionInput[]): {
  stages: ClientStage[];
  currentStage: ClientCurrentStage | null;
} | null {
  const visible = sections.filter(
    (s) => !INTERNAL_SECTION_LANES.has(s.name.trim().toLowerCase())
  );
  if (visible.length === 0) return null;

  const staged = visible.map((s) => {
    const total = s.tasks.length;
    const done = s.tasks.filter((t) => t.completed).length;
    let state: StageState;
    if (total > 0 && done === total) state = "done";
    else if (done > 0) state = "active";
    else state = "upcoming";
    const label = SECTION_RELABEL[s.name.trim().toLowerCase()] ?? s.name;
    return { label, state, done, total };
  });

  const isComplete = (x: { done: number; total: number }) =>
    x.total > 0 && x.done === x.total;
  const isPartial = (x: { done: number; total: number }) =>
    x.done > 0 && x.done < x.total;

  const incomplete = staged
    .map((s, i) => ({ i, s }))
    .filter(({ s }) => !isComplete(s));

  let currentIdx: number;
  if (incomplete.length === 0) {
    // Everything is done — the current step is the final section.
    currentIdx = staged.length - 1;
  } else {
    const partials = incomplete.filter(({ s }) => isPartial(s));
    currentIdx = partials.length
      ? partials[partials.length - 1].i // furthest-along in-progress section
      : incomplete[0].i; // nothing started yet → the first incomplete section
  }

  const stages: ClientStage[] = staged.map((s, i) => ({
    label: s.label,
    state: s.state,
    done: s.done,
    total: s.total,
    current: i === currentIdx,
  }));

  const cur = staged[currentIdx];
  const currentStage: ClientCurrentStage =
    incomplete.length === 0
      ? { label: cur.label, subline: "Complete" }
      : { label: cur.label, subline: `Step ${currentIdx + 1} of ${staged.length}` };

  return { stages, currentStage };
}

const GATE_ORDER = [
  "PRE_DESIGN",
  "DESIGN",
  "PERMITTING",
  "CONSTRUCTION",
  "CLOSEOUT",
] as const;

const GATE_LABEL: Record<string, string> = {
  PRE_DESIGN: "Pre-design",
  DESIGN: "Design",
  PERMITTING: "Permitting",
  CONSTRUCTION: "Construction",
  CLOSEOUT: "Closeout",
};

/** The current-stage stat card for non-recert projects, derived from `gate`. */
export function gateCurrentStage(gate: string | null): ClientCurrentStage | null {
  const idx = gate ? GATE_ORDER.indexOf(gate as (typeof GATE_ORDER)[number]) : -1;
  if (idx === -1) return null;
  return {
    label: GATE_LABEL[gate as string] ?? humanize(gate as string),
    subline: `Step ${idx + 1} of ${GATE_ORDER.length}`,
  };
}

const US_REASON_BY_GATE: Record<string, string> = {
  PRE_DESIGN: "We're finalizing project scope and initial planning.",
  DESIGN: "We're preparing your design documents.",
  PERMITTING: "We're preparing your permit submission.",
  CONSTRUCTION: "We're coordinating construction activities.",
  CLOSEOUT: "We're finalizing closeout documentation.",
};
const US_REASON_DEFAULT = "We're moving your project forward.";

/**
 * Who the next move belongs to. If the client owns any action item, the ball
 * is on their side and the reason is that item's name. Otherwise the ball is
 * on the firm, and the reason is a STATIC per-gate sentence — never a live
 * internal task name, because `isPrivate` cannot be trusted on this surface.
 */
export function computeWhoHasTheBall(
  actionCount: number,
  topActionName: string | null,
  gate: string | null
): ClientBallHolder {
  if (actionCount > 0 && topActionName) {
    return { side: "CLIENT", reason: topActionName };
  }
  return {
    side: "US",
    reason: (gate && US_REASON_BY_GATE[gate]) || US_REASON_DEFAULT,
  };
}

/**
 * A brand-new, allow-listed activity feed. It NEVER reads the internal
 * `Activity` model — it is assembled here from three already-client-safe
 * sources the projection has otherwise fetched, so no staff identity, task
 * assignment, comment or internal note can reach it.
 *
 * The actor is always the literal firm name; individuals are never named.
 * Merged desc by timestamp, capped at eight rows.
 */
export function buildClientActivityFeed(input: {
  updates: { id: string; createdAt: Date }[];
  milestones: { id: string; name: string; completed: boolean; completedAt: Date | null }[];
  documents: { id: string; name: string; createdAt: Date }[];
}): ClientActivityEvent[] {
  const events: ClientActivityEvent[] = [];

  for (const u of input.updates) {
    events.push({
      id: `update-${u.id}`,
      text: "Project update posted",
      actor: "Tercero Tablada",
      at: u.createdAt,
    });
  }
  for (const m of input.milestones) {
    if (m.completed && m.completedAt) {
      events.push({
        id: `milestone-${m.id}`,
        text: `${m.name} completed`,
        actor: "Tercero Tablada",
        at: m.completedAt,
      });
    }
  }
  for (const d of input.documents) {
    events.push({
      id: `file-${d.id}`,
      text: `${d.name} shared`,
      actor: "Tercero Tablada",
      at: d.createdAt,
    });
  }

  events.sort((a, b) => b.at.getTime() - a.at.getTime());
  return events.slice(0, 8);
}

interface DropdownOption {
  id: string;
  label: string;
}

/** Narrow the untyped `options` Json on a CustomFieldDefinition. */
function readOptions(raw: unknown): DropdownOption[] {
  if (!Array.isArray(raw)) return [];
  const out: DropdownOption[] = [];
  for (const entry of raw) {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const rec = entry as Record<string, unknown>;
      const id = typeof rec.id === "string" ? rec.id : null;
      if (!id) continue;
      out.push({
        id,
        label: typeof rec.label === "string" ? rec.label : id,
      });
    }
  }
  return out;
}

/**
 * Resolve the "Responsible" dropdown field(s) on a project and the set of
 * option-ids that mean a given side owns the step. Shared by both the client
 * action-item read and the inspector-inspection read below, since the two are
 * the same query with a different option filter.
 */
async function resolveResponsibleField(
  projectId: string,
  match: Set<string>
): Promise<{ fieldIds: string[]; optionIds: Set<string> }> {
  const links = await prisma.projectCustomField.findMany({
    where: {
      projectId,
      field: {
        name: { equals: RESPONSIBLE_FIELD_NAME, mode: "insensitive" },
        type: "DROPDOWN",
      },
    },
    select: { field: { select: { id: true, options: true } } },
  });

  const fieldIds: string[] = [];
  const optionIds = new Set<string>();
  for (const link of links) {
    fieldIds.push(link.field.id);
    for (const opt of readOptions(link.field.options)) {
      if (
        match.has(opt.id.trim().toLowerCase()) ||
        match.has(opt.label.trim().toLowerCase())
      ) {
        optionIds.add(opt.id);
      }
    }
  }
  return { fieldIds, optionIds };
}

/**
 * "What we need from you" — the block that makes this page worth sending.
 *
 * The firm records ownership of each step in a per-workspace DROPDOWN custom
 * field named "Responsible" (see src/lib/project-templates.ts, where the
 * recertification and permit templates define it with the options
 * building_official / owner / engineer / contractor / inspector). The chosen
 * option is stored in CustomFieldValue.value as the bare option-id STRING —
 * that is exactly how custom-field-cell.tsx reads it back
 * (`options.find(o => o.id === value)`).
 *
 * So: find the Responsible field(s) attached to this project, work out which
 * of their options mean "the client", then return this project's incomplete,
 * non-private tasks carrying one of those values.
 *
 * Returns [] when the project has no such field — a project that never
 * assigned responsibility simply has nothing to ask for, which is honest.
 */
async function buildWhatWeNeedFromYou(
  projectId: string
): Promise<ClientActionItem[]> {
  const { fieldIds, optionIds } = await resolveResponsibleField(
    projectId,
    CLIENT_SIDE_RESPONSIBLE
  );
  if (fieldIds.length === 0 || optionIds.size === 0) return [];

  // isPrivate is filtered HERE, explicitly. It is enforced in only one other
  // place in the whole API, so it cannot be assumed to have been applied
  // upstream — and this is an unauthenticated surface.
  const rows = await prisma.customFieldValue.findMany({
    where: {
      fieldId: { in: fieldIds },
      task: { projectId, isPrivate: false, completed: false },
    },
    select: {
      value: true,
      task: {
        select: { id: true, name: true, dueDate: true, description: true },
      },
    },
  });

  const items: ClientActionItem[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    // The value is a JSON scalar; anything that is not one of our option
    // strings (a stale id, a multi-select array) is simply not a match.
    if (typeof row.value !== "string") continue;
    if (!optionIds.has(row.value)) continue;
    if (seen.has(row.task.id)) continue;
    seen.add(row.task.id);
    items.push({
      id: row.task.id,
      name: row.task.name,
      // Trimmed to non-empty, else null so the UI shows no sub-line rather
      // than an empty one — never a fabricated description.
      description: row.task.description?.trim() || null,
      dueDate: row.task.dueDate,
    });
  }

  // Soonest first; undated last.
  items.sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.name.localeCompare(b.name);
  });
  return items;
}

/**
 * Upcoming inspections — the same Responsible-field read as above, but
 * matching the FIRM-side `inspector` option and only FUTURE, incomplete,
 * non-private tasks. The task NAMES ("Structural inspection — photos & form")
 * are client-appropriate; no assignee is ever read. There is no time-of-day
 * field anywhere in the schema, so the row carries the date only.
 */
async function buildUpcomingInspections(
  projectId: string
): Promise<ClientInspection[]> {
  const { fieldIds, optionIds } = await resolveResponsibleField(
    projectId,
    INSPECTOR_RESPONSIBLE
  );
  if (fieldIds.length === 0 || optionIds.size === 0) return [];

  const now = new Date();
  const rows = await prisma.customFieldValue.findMany({
    where: {
      fieldId: { in: fieldIds },
      task: {
        projectId,
        isPrivate: false,
        completed: false,
        dueDate: { gt: now },
      },
    },
    select: {
      value: true,
      task: { select: { id: true, name: true, dueDate: true } },
    },
  });

  const items: ClientInspection[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (typeof row.value !== "string") continue;
    if (!optionIds.has(row.value)) continue;
    if (!row.task.dueDate) continue; // narrowed by the query, re-checked for the type
    if (seen.has(row.task.id)) continue;
    seen.add(row.task.id);
    items.push({
      id: row.task.id,
      name: row.task.name,
      dueDate: row.task.dueDate,
    });
  }

  items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  return items;
}

/**
 * Assemble everything a client link may render, or null if the project is
 * gone. The caller 404s on null.
 */
export async function buildClientProjectView(
  projectId: string
): Promise<ClientProjectView | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: CLIENT_PROJECT_SELECT,
  });
  if (!project) return null;

  const [
    milestones,
    whatWeNeedFromYou,
    documents,
    updates,
    rootTasks,
    sectionRows,
    upcomingInspections,
    taggedMessages,
  ] = await Promise.all([
    // Milestones only, and never a private one. No assignee, no priority:
    // who inside the firm is doing it is not the client's business, and a
    // priority label invites an argument the schedule already settles.
    // completedAt is read purely to timestamp the activity feed.
    prisma.task.findMany({
      where: { projectId, taskType: "MILESTONE", isPrivate: false },
      select: {
        id: true,
        name: true,
        dueDate: true,
        completed: true,
        completedAt: true,
      },
      orderBy: [{ dueDate: "asc" }, { name: "asc" }],
    }),
    buildWhatWeNeedFromYou(projectId),
    // Opt-in per document. The default is false, so a file is private
    // until someone deliberately shares it.
    prisma.file.findMany({
      where: { projectId, sharedWithClient: true },
      select: {
        id: true,
        name: true,
        url: true,
        size: true,
        mimeType: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    // Every update that HAS a client paraphrase (widened from findFirst so the
    // activity feed can list each). Rows whose clientSummary is null are
    // skipped rather than falling back to `summary`, which is internal prose.
    prisma.statusUpdate.findMany({
      where: { projectId, clientSummary: { not: null } },
      select: { id: true, clientSummary: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    // Root, non-private tasks only — the denominator of the progress ring.
    // Matches the internal convention and never touches earned value/budget.
    prisma.task.findMany({
      where: { projectId, parentTaskId: null, isPrivate: false },
      select: { completed: true },
    }),
    // Sections + their non-private task completion, for the real stage rail.
    // A nested explicit select (not an include) keeps the header rule honest.
    prisma.section.findMany({
      where: { projectId },
      select: {
        name: true,
        tasks: { where: { isPrivate: false }, select: { completed: true } },
      },
      orderBy: { position: "asc" },
    }),
    buildUpcomingInspections(projectId),
    // The client thread: messages the firm tagged @cliente, plus the client's
    // own replies (clientLinkId is set only by the public reply endpoint).
    // author is an explicit nested select of NAME ONLY — the client may see
    // who on the team wrote to them (Juan's call), never an email or id.
    prisma.message.findMany({
      where: {
        projectId,
        OR: [
          { content: { contains: CLIENT_MESSAGE_TAG, mode: "insensitive" } },
          { clientLinkId: { not: null } },
        ],
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        clientLinkId: true,
        clientAuthorLabel: true,
        author: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const status = toClientStatus(project.status);
  const progress = computeProgress(rootTasks);

  // The real rail is driven by the project's Section rows for EVERY project
  // type. gateCurrentStage remains only as the fallback for a project that has
  // no client-visible sections at all, so the rail is never empty.
  const sectionRail = computeSectionStages(
    sectionRows.map((s) => ({ name: s.name, tasks: s.tasks }))
  );
  const stages = sectionRail?.stages ?? null;
  const currentStage = sectionRail?.currentStage ?? gateCurrentStage(project.gate);

  const milestoneViews: ClientMilestone[] = milestones.map((m) => ({
    id: m.id,
    name: m.name,
    dueDate: m.dueDate,
    completed: m.completed,
    completedAt: m.completedAt,
  }));

  const documentViews: ClientDocument[] = documents.map((d) => ({
    id: d.id,
    name: d.name,
    url: d.url,
    size: d.size,
    mimeType: d.mimeType,
    createdAt: d.createdAt,
  }));

  const latest = updates[0];
  const activity = buildClientActivityFeed({
    updates: updates.map((u) => ({ id: u.id, createdAt: u.createdAt })),
    milestones: milestoneViews,
    documents: documentViews.map((d) => ({
      id: d.id,
      name: d.name,
      createdAt: d.createdAt,
    })),
  });

  // Field-by-field copy, never a spread. See the header.
  const view: ClientProjectView = {
    id: project.id,
    name: project.name,
    projectNumber: project.projectNumber,
    type: project.type,
    location: project.location,
    startDate: project.startDate,
    endDate: project.endDate,
    gate: project.gate,

    coverColor: project.color,
    status,
    friendlySentence: friendlySentence(
      latest?.clientSummary ?? null,
      status.tone
    ),
    progress,
    stages,
    currentStage,

    milestones: milestoneViews,

    whatWeNeedFromYou,

    documents: documentViews,

    upcomingInspections,

    // Chronological (oldest → newest, like a chat), re-gated through the pure
    // rule so the SQL narrowing and the policy can never drift apart.
    messages: taggedMessages
      .filter((m) => isClientVisibleMessage(m))
      .reverse()
      .map((m) => ({
        id: m.id,
        content: m.content,
        at: m.createdAt,
        from: m.clientLinkId !== null ? ("CLIENT" as const) : ("FIRM" as const),
        authorName:
          m.clientLinkId !== null
            ? m.clientAuthorLabel || "Client"
            : m.author?.name || "Tercero Tablada",
      })),

    whoHasTheBall: computeWhoHasTheBall(
      whatWeNeedFromYou.length,
      whatWeNeedFromYou[0]?.name ?? null,
      project.gate
    ),

    activity,
  };

  if (latest?.clientSummary) {
    view.latestUpdate = {
      summary: latest.clientSummary,
      postedAt: latest.createdAt,
    };
  }

  return view;
}
