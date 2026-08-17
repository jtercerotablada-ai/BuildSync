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
} as const);

/**
 * Columns on Project that must never reach a client, each for its own reason:
 *
 *   budget, currency  — commercial terms; the client's contract is not the
 *                       firm's internal number.
 *   status            — ON_TRACK / AT_RISK / OFF_TRACK is the firm's private
 *                       assessment. The owner explicitly decided a client
 *                       never sees the traffic light; they see dates and a
 *                       written note instead.
 *   notes             — internal prose.
 *   workspaceId       — a tenant identifier is an enumeration primitive.
 *   visibility        — internal RBAC state.
 *   clientName        — the firm's label FOR this client, not necessarily
 *                       what the client calls themselves.
 */
export const WITHHELD_FIELDS = Object.freeze([
  "budget",
  "currency",
  "status",
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

/** The custom field, by name, that records who owns each step. */
const RESPONSIBLE_FIELD_NAME = "Responsible";

export interface ClientMilestone {
  id: string;
  name: string;
  dueDate: Date | null;
  completed: boolean;
}

export interface ClientActionItem {
  id: string;
  name: string;
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

export interface ClientContact {
  id: string;
  name: string;
  role: string;
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
  milestones: ClientMilestone[];
  whatWeNeedFromYou: ClientActionItem[];
  documents: ClientDocument[];
  /** Omitted entirely when no status update carries a clientSummary. */
  latestUpdate?: { summary: string; postedAt: Date };
  contacts: ClientContact[];
}

/** Turn ENUM_LIKE_THIS into "Enum like this" for display. */
function humanize(value: string): string {
  const spaced = value.replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
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
  if (links.length === 0) return [];

  const fieldIds: string[] = [];
  const clientOptionIds = new Set<string>();
  for (const link of links) {
    fieldIds.push(link.field.id);
    for (const opt of readOptions(link.field.options)) {
      if (
        CLIENT_SIDE_RESPONSIBLE.has(opt.id.trim().toLowerCase()) ||
        CLIENT_SIDE_RESPONSIBLE.has(opt.label.trim().toLowerCase())
      ) {
        clientOptionIds.add(opt.id);
      }
    }
  }
  if (clientOptionIds.size === 0) return [];

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
      task: { select: { id: true, name: true, dueDate: true } },
    },
  });

  const items: ClientActionItem[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    // The value is a JSON scalar; anything that is not one of our option
    // strings (a stale id, a multi-select array) is simply not a match.
    if (typeof row.value !== "string") continue;
    if (!clientOptionIds.has(row.value)) continue;
    if (seen.has(row.task.id)) continue;
    seen.add(row.task.id);
    items.push({
      id: row.task.id,
      name: row.task.name,
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

  const [milestones, whatWeNeedFromYou, documents, update, members] =
    await Promise.all([
      // Milestones only, and never a private one. No assignee, no priority:
      // who inside the firm is doing it is not the client's business, and a
      // priority label invites an argument the schedule already settles.
      prisma.task.findMany({
        where: { projectId, taskType: "MILESTONE", isPrivate: false },
        select: { id: true, name: true, dueDate: true, completed: true },
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
      // The most recent update that HAS a client paraphrase. Rows whose
      // clientSummary is null are skipped rather than falling back to
      // `summary`, which is internal prose.
      prisma.statusUpdate.findFirst({
        where: { projectId, clientSummary: { not: null } },
        select: { clientSummary: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.projectMember.findMany({
        where: { projectId },
        select: {
          id: true,
          user: {
            select: {
              name: true,
              jobTitle: true,
              position: true,
              customTitle: true,
            },
          },
        },
      }),
    ]);

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

    milestones: milestones.map((m) => ({
      id: m.id,
      name: m.name,
      dueDate: m.dueDate,
      completed: m.completed,
    })),

    whatWeNeedFromYou,

    documents: documents.map((d) => ({
      id: d.id,
      name: d.name,
      url: d.url,
      size: d.size,
      mimeType: d.mimeType,
      createdAt: d.createdAt,
    })),

    // Name and role only. No email address reaches this page — publishing a
    // staff inbox on an unauthenticated URL is how you get harvested.
    contacts: members
      .filter((m) => m.user.name)
      .map((m) => ({
        id: m.id,
        name: m.user.name as string,
        role:
          m.user.customTitle ||
          (m.user.position ? humanize(m.user.position) : null) ||
          m.user.jobTitle ||
          "Project team",
      })),
  };

  if (update?.clientSummary) {
    view.latestUpdate = {
      summary: update.clientSummary,
      postedAt: update.createdAt,
    };
  }

  return view;
}
