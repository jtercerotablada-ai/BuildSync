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

export type StageState = "done" | "current" | "upcoming";

export interface ClientStage {
  label: string;
  state: StageState;
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
  /** The real Section-derived rail for recertifications; null → gate fallback. */
  stages: ClientStage[] | null;
  /** The one stage to name in the stat card (works for rail OR gate fallback). */
  currentStage: ClientCurrentStage | null;
  milestones: ClientMilestone[];
  whatWeNeedFromYou: ClientActionItem[];
  documents: ClientDocument[];
  upcomingInspections: ClientInspection[];
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

/** Canonical recertification phase order + the client-facing relabel. */
const RECERT_STAGES: { key: string; label: string }[] = [
  { key: "kickoff & scheduling", label: "Kickoff" },
  { key: "inspection & reports", label: "Inspection & Reports" },
  { key: "building official review", label: "City Review" },
  { key: "repairs (if required)", label: "Repairs" },
  { key: "recertification complete", label: "Recertified" },
];

export interface StageSectionInput {
  name: string;
  tasks: { completed: boolean }[];
}

/**
 * Build the real, client-labeled stage rail from a recertification project's
 * Section rows. Only the canonical recert phases are surfaced, in canonical
 * order — a project also carries internal field-inspection lanes (Scheduled /
 * Performed / Report Issued) that are not client phases and are dropped here.
 *
 * `current` is the first phase with an incomplete non-private task; phases
 * before it are `done`, phases after are `upcoming`. Returns null when none of
 * the canonical phases are present, so the caller can fall back to the gate
 * rail rather than render nothing.
 */
export function computeRecertStages(sections: StageSectionInput[]): {
  stages: ClientStage[];
  currentStage: ClientCurrentStage | null;
} | null {
  const byName = new Map<string, StageSectionInput>();
  for (const s of sections) byName.set(s.name.trim().toLowerCase(), s);

  const ordered: { label: string; tasks: { completed: boolean }[] }[] = [];
  for (const phase of RECERT_STAGES) {
    const match = byName.get(phase.key);
    if (match) ordered.push({ label: phase.label, tasks: match.tasks });
  }
  if (ordered.length === 0) return null;

  const currentIdx = ordered.findIndex((s) => s.tasks.some((t) => !t.completed));

  const stages: ClientStage[] = ordered.map((s, i) => {
    let state: StageState;
    if (currentIdx === -1 || i < currentIdx) state = "done";
    else if (i === currentIdx) state = "current";
    else state = "upcoming";
    return { label: s.label, state };
  });

  const currentStage: ClientCurrentStage | null =
    currentIdx === -1
      ? { label: ordered[ordered.length - 1].label, subline: "Complete" }
      : {
          label: ordered[currentIdx].label,
          subline: `Step ${currentIdx + 1} of ${ordered.length}`,
        };

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
  ]);

  const status = toClientStatus(project.status);
  const progress = computeProgress(rootTasks);

  // The real rail for recertifications; anything else falls back to the
  // generic gate rail so the rail is never empty.
  const recert =
    project.type === "RECERTIFICATION"
      ? computeRecertStages(
          sectionRows.map((s) => ({ name: s.name, tasks: s.tasks }))
        )
      : null;
  const stages = recert?.stages ?? null;
  const currentStage = recert?.currentStage ?? gateCurrentStage(project.gate);

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
