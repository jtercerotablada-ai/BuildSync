import type { ProjectGate, ProjectType } from "@prisma/client";

/**
 * pipelines.ts — the one answer to "what stages does this kind of job have,
 * in what order, and whose desk is each one on?".
 *
 * WHY THIS EXISTS
 * A stage is not a percentage. The firm is three people running six live
 * recertifications, and the only question a status has to answer on a Monday
 * morning is who is holding the job right now — us, the PE, the client, the
 * contractor, or the city. So every stage below names a HOLDER, and a stage
 * exists only when the holder or the work genuinely changes.
 *
 * WHY IT IS DATA AND NOT AN ENUM
 * Project.stage is a TEXT column (see prisma/sql/2026-08-28-*.sql): a Postgres
 * enum value can never be dropped or renamed without rebuilding the type, and
 * this database forbids destructive migrations. Labels, order and holders live
 * here instead, so renaming or reordering a stage is a deploy with no SQL.
 * That makes THIS FILE the schema — the API validates against it, the strip
 * renders from it, and a key that does not resolve here is not a stage.
 *
 * WHY IT HAS NO DEPENDENCIES
 * Imported from both route handlers and client components. The only import is
 * a type-only one, erased at compile time, so nothing here pulls Prisma (or
 * anything else) into a browser bundle. Keep it that way.
 *
 * THESE FOUR PIPELINES ARE SIGNED OFF by the firm's owner. Adding, removing,
 * renaming or reordering a stage is a product decision, not a refactor.
 */

/**
 * Whose desk the job is on. Not a role and not a person: ARCHITECT and
 * CONTRACTOR are outside the firm, PE is the licensed signature (which is a
 * hand-off even when the same person walks over to sign it), and NONE means
 * the job is finished and nobody is holding anything.
 */
export type StageHolder =
  | "FIRM"
  | "PE"
  | "CLIENT"
  | "ARCHITECT"
  | "CONTRACTOR"
  | "CITY"
  | "NONE";

export interface Stage {
  /** Stored verbatim in Project.stage — "<pipelineId>.<slug>". */
  key: string;
  label: string;
  holder: StageHolder;
  /** The end of the pipeline. Exactly one per pipeline, always last. */
  terminal?: true;
}

export type PipelineId = "recert" | "design" | "permit" | "construction";

export interface Pipeline {
  id: PipelineId;
  label: string;
  stages: readonly Stage[];
}

/** Matches ProjectStageEvent.direction. */
export type StageDirection = "FORWARD" | "BACKWARD" | "SEED";

// ───────────────────────────────────────────────────────────────────────────
// The stages
// ───────────────────────────────────────────────────────────────────────────

// `as const satisfies` on purpose: the literal keys survive so StageKey below
// is a real union, and LEGACY_GATE_BY_STAGE cannot compile while a stage is
// missing from it.

/** Miami-Dade recertification and Broward BSIP run the identical eleven
 *  stages — the loop from City Comments back to Report Drafting is the one
 *  the firm actually spends its year in. */
const RECERT_STAGES = [
  { key: "recert.draft", label: "Draft", holder: "CLIENT" },
  { key: "recert.field_work", label: "Field Work", holder: "FIRM" },
  { key: "recert.report_drafting", label: "Report Drafting", holder: "FIRM" },
  { key: "recert.awaiting_pe", label: "Awaiting PE Signature", holder: "PE" },
  {
    key: "recert.submitted_to_client",
    label: "Submitted to Client",
    holder: "CLIENT",
  },
  {
    key: "recert.awaiting_client_repairs",
    label: "Awaiting Client Repairs",
    holder: "CLIENT",
  },
  { key: "recert.reinspection", label: "Reinspection", holder: "FIRM" },
  {
    key: "recert.awaiting_client_fees",
    label: "Awaiting Client Fees",
    holder: "CLIENT",
  },
  {
    key: "recert.submitted_to_city",
    label: "Submitted to City",
    holder: "CITY",
  },
  { key: "recert.city_comments", label: "City Comments", holder: "FIRM" },
  {
    key: "recert.recertified",
    label: "Recertified",
    holder: "NONE",
    terminal: true,
  },
] as const satisfies readonly Stage[];

const DESIGN_STAGES = [
  { key: "design.draft", label: "Draft", holder: "CLIENT" },
  { key: "design.design_work", label: "Design Work", holder: "FIRM" },
  {
    key: "design.awaiting_client_approval",
    label: "Awaiting Client Approval",
    holder: "CLIENT",
  },
  { key: "design.awaiting_pe", label: "Awaiting PE Signature", holder: "PE" },
  {
    key: "design.submitted_to_client",
    label: "Submitted to Client",
    holder: "CLIENT",
  },
  {
    key: "design.submitted_to_city",
    label: "Submitted to City",
    holder: "CITY",
  },
  { key: "design.city_comments", label: "City Comments", holder: "FIRM" },
  {
    key: "design.permit_issued",
    label: "Permit Issued",
    holder: "NONE",
    terminal: true,
  },
] as const satisfies readonly Stage[];

const PERMIT_STAGES = [
  {
    key: "permit.preparing_submittal",
    label: "Preparing Submittal",
    holder: "FIRM",
  },
  {
    key: "permit.awaiting_client_docs",
    label: "Awaiting Client Docs",
    holder: "CLIENT",
  },
  {
    key: "permit.submitted_to_city",
    label: "Submitted to City",
    holder: "CITY",
  },
  { key: "permit.in_plan_review", label: "In Plan Review", holder: "CITY" },
  { key: "permit.city_comments", label: "City Comments", holder: "FIRM" },
  {
    key: "permit.awaiting_client_fees",
    label: "Awaiting Client Fees",
    holder: "CLIENT",
  },
  {
    key: "permit.permit_issued",
    label: "Permit Issued",
    holder: "NONE",
    terminal: true,
  },
] as const satisfies readonly Stage[];

const CONSTRUCTION_STAGES = [
  { key: "construction.draft", label: "Draft", holder: "FIRM" },
  {
    key: "construction.awaiting_ntp",
    label: "Awaiting NTP",
    holder: "CONTRACTOR",
  },
  {
    key: "construction.under_construction",
    label: "Under Construction",
    holder: "CONTRACTOR",
  },
  {
    key: "construction.final_inspection",
    label: "Final Inspection",
    holder: "FIRM",
  },
  {
    key: "construction.awaiting_repairs",
    label: "Awaiting Repairs",
    holder: "CONTRACTOR",
  },
  {
    key: "construction.closeout_letters",
    label: "Closeout Letters",
    holder: "FIRM",
  },
  {
    key: "construction.submitted_to_city",
    label: "Submitted to City",
    holder: "CITY",
  },
  {
    key: "construction.closed_out",
    label: "Closed Out",
    holder: "NONE",
    terminal: true,
  },
] as const satisfies readonly Stage[];

/** Every stage key the product knows about. */
export type StageKey =
  | (typeof RECERT_STAGES)[number]["key"]
  | (typeof DESIGN_STAGES)[number]["key"]
  | (typeof PERMIT_STAGES)[number]["key"]
  | (typeof CONSTRUCTION_STAGES)[number]["key"];

export const PIPELINES: Readonly<Record<PipelineId, Pipeline>> = {
  recert: { id: "recert", label: "Recertification", stages: RECERT_STAGES },
  design: { id: "design", label: "Design", stages: DESIGN_STAGES },
  permit: { id: "permit", label: "Permitting", stages: PERMIT_STAGES },
  construction: {
    id: "construction",
    label: "Construction",
    stages: CONSTRUCTION_STAGES,
  },
};

/**
 * A Record, not a lookup with a fallback: adding a ProjectType to the schema
 * without deciding which stages it runs must fail the build here rather than
 * ship a project type whose strip is empty.
 */
export const PIPELINE_FOR_TYPE: Readonly<Record<ProjectType, PipelineId>> = {
  RECERTIFICATION: "recert",
  // Broward's BSIP is procedurally the same eleven stages as a Miami-Dade
  // recertification; it is a separate type only so the firm can count it.
  BSIP: "recert",
  DESIGN: "design",
  PERMIT: "permit",
  CONSTRUCTION: "construction",
};

/** Flat index over every stage, built once. */
const STAGE_INDEX: ReadonlyMap<
  string,
  { pipelineId: PipelineId; stage: Stage; index: number }
> = new Map(
  (Object.keys(PIPELINES) as PipelineId[]).flatMap((pipelineId) =>
    PIPELINES[pipelineId].stages.map(
      (stage, index) =>
        [stage.key, { pipelineId, stage, index }] as const
    )
  )
);

// ───────────────────────────────────────────────────────────────────────────
// Lookups
// ───────────────────────────────────────────────────────────────────────────

/** Null for a project with no type yet — the strip offers "Set stage"
 *  instead of guessing a pipeline. */
export function pipelineForType(
  type: ProjectType | null | undefined
): Pipeline | null {
  if (!type) return null;
  const pipelineId = PIPELINE_FOR_TYPE[type];
  return pipelineId ? PIPELINES[pipelineId] : null;
}

export function stagesForType(
  type: ProjectType | null | undefined
): readonly Stage[] {
  return pipelineForType(type)?.stages ?? [];
}

/**
 * Resolve a raw Project.stage value. Takes a plain string because the column
 * is TEXT and a row seeded before a rename can hold anything; returns null
 * rather than throwing so a stale value renders as "unknown", never a 500.
 * `index` is 0-based within its own pipeline.
 */
export function resolveStage(
  key: string | null | undefined
): { pipelineId: PipelineId; stage: Stage; index: number } | null {
  if (!key) return null;
  return STAGE_INDEX.get(key) ?? null;
}

/** The API's validation: a stage belongs to the pipeline this project's type
 *  runs, and to no other. Guards against a client PATCHing a design stage
 *  onto a recertification. */
export function isStageValidForType(
  type: ProjectType | null | undefined,
  key: string | null | undefined
): boolean {
  const pipeline = pipelineForType(type);
  if (!pipeline) return false;
  const resolved = resolveStage(key);
  return !!resolved && resolved.pipelineId === pipeline.id;
}

/** The next stage in the same pipeline; null at the terminal stage (and for
 *  a key that does not resolve). */
export function nextStage(key: string | null | undefined): Stage | null {
  const resolved = resolveStage(key);
  if (!resolved) return null;
  return PIPELINES[resolved.pipelineId].stages[resolved.index + 1] ?? null;
}

/** The previous stage in the same pipeline; null at the first stage. */
export function previousStage(key: string | null | undefined): Stage | null {
  const resolved = resolveStage(key);
  if (!resolved || resolved.index === 0) return null;
  return PIPELINES[resolved.pipelineId].stages[resolved.index - 1] ?? null;
}

/**
 * What kind of move this is, for ProjectStageEvent.direction.
 *
 * BACKWARD is the number the firm actually wants: how often a job falls back
 * through City Comments is the cost of the year. SEED covers both the first
 * stage a project is ever given and a move that crosses pipelines (the type
 * changed underneath it), because neither is progress or a setback — there is
 * no shared order to compare them in.
 */
export function stageDirection(
  fromKey: string | null | undefined,
  toKey: string | null | undefined
): StageDirection {
  const from = resolveStage(fromKey);
  const to = resolveStage(toKey);
  if (!from || !to || from.pipelineId !== to.pipelineId) return "SEED";
  return to.index < from.index ? "BACKWARD" : "FORWARD";
}

// ───────────────────────────────────────────────────────────────────────────
// The board column ↔ stage join
// ───────────────────────────────────────────────────────────────────────────

/**
 * WHY THIS EXISTS
 * The recertification templates shipped five board columns — Kickoff &
 * scheduling, Inspection & Reports, Building Official Review, Repairs,
 * Recertification Complete — which are a coarser COPY of the eleven stages
 * above. The stages landed after the template sections and nobody reconciled
 * them, so one screen answered "where is this job?" in two vocabularies and
 * the owner said, of the controls, that they did not give him confidence.
 *
 * The reconciliation is that a board column IS a stage: every column a recert
 * template creates is named exactly as its stage is named here, and
 * Section.stage stores the key (see prisma/sql/2026-08-30-*.sql).
 *
 * This does NOT make the stage derived from the board — that was proposed and
 * rejected. Half the recert stages are pure waiting on the client, the PE or
 * the city and carry no work of their own, so a column can never exist for
 * them and "the furthest column with open work" could never land there —
 * exactly the stages where "whose desk is this on?" is the whole question.
 * The stage stays stored and human-moved; the join is what lets the product
 * NOTICE that a stage's work is finished and OFFER the next move.
 */

/** The label a stage renders under; null for a key that does not resolve. */
export function stageLabel(key: string | null | undefined): string | null {
  return resolveStage(key)?.stage.label ?? null;
}

/**
 * The stage a column called `name` belongs to, searched within THIS project
 * type's own pipeline and no other.
 *
 * Exact label match — trimmed and case-insensitive, never fuzzy and never a
 * prefix. A column is a stage because it was NAMED as one, which is the same
 * rule the templates are built to satisfy, so the match is the exact inverse
 * of how the template's column list is generated. Anything looser would
 * quietly file "Final Inspection punch list" under Final Inspection and put a
 * job on a desk nobody chose.
 */
export function stageForSectionName(
  type: ProjectType | null | undefined,
  name: string | null | undefined
): Stage | null {
  const pipeline = pipelineForType(type);
  if (!pipeline || !name) return null;
  const wanted = name.trim().toLowerCase();
  if (!wanted) return null;
  return pipeline.stages.find((s) => s.label.toLowerCase() === wanted) ?? null;
}

export type SectionStageResolution =
  | { ok: true; stage: string | null }
  | { ok: false; error: string };

/**
 * The one rule for what Section.stage becomes, shared by every writer
 * (POST /api/projects, POST /api/sections, PATCH /api/sections/:id) so a
 * column created by a template, by the "+ Add section" button and by a rename
 * can never end up under three different rules.
 *
 *   requested = a key  → it must belong to THIS project's pipeline, or the
 *                        write is refused. Claiming a design stage on a
 *                        recertification is a bug, not a preference.
 *   requested = null   → deliberately free-form. A column that is explicitly
 *                        not a stage stays not a stage even if it is named
 *                        like one.
 *   requested = absent → derived from the column's own name. This is what
 *                        carries a template's intent through a client that
 *                        only sends section NAMES, and it is exactly the
 *                        inverse of how those names were generated.
 */
export function resolveSectionStage(
  type: ProjectType | null | undefined,
  name: string,
  requested: string | null | undefined
): SectionStageResolution {
  if (requested === null) return { ok: true, stage: null };
  if (requested === undefined) {
    return { ok: true, stage: stageForSectionName(type, name)?.key ?? null };
  }
  if (!isStageValidForType(type, requested)) {
    return {
      ok: false,
      error: `"${requested}" is not a stage of this project's pipeline`,
    };
  }
  return { ok: true, stage: requested };
}

/**
 * The column holding the work of `stageKey`, or null when this stage has no
 * column — which is the normal case for a stage that is pure waiting, not an
 * error. Pass the project's sections in position order; the first match wins,
 * because a hand-made duplicate column should not change which one the
 * product points at.
 */
export function sectionForStage<T extends { stage?: string | null }>(
  sections: readonly T[],
  stageKey: string | null | undefined
): T | null {
  if (!stageKey) return null;
  return sections.find((section) => section.stage === stageKey) ?? null;
}

/** The human word for a holder, short enough to sit in a pill next to the
 *  stage label. FIRM is "Us" rather than the company name so the strip reads
 *  the same for all three of them. */
export function holderLabel(holder: StageHolder): string {
  return HOLDER_LABELS[holder];
}

const HOLDER_LABELS: Readonly<Record<StageHolder, string>> = {
  FIRM: "Us",
  PE: "The PE",
  CLIENT: "The client",
  ARCHITECT: "The architect",
  CONTRACTOR: "The contractor",
  CITY: "The city",
  NONE: "No one",
};

// ───────────────────────────────────────────────────────────────────────────
// The legacy gate
// ───────────────────────────────────────────────────────────────────────────

/**
 * Project.gate is now SERVER-DERIVED from the stage and must never be sent
 * from the UI: two writers for one fact is how the column and the stage
 * desync, and the ~13 readouts still rendering `gate` would then disagree
 * with the strip on the same screen. Anything that moves a stage writes the
 * gate through legacyGateFor() in the same update; nothing else writes it.
 *
 * The mapping is coarse on purpose — five gates cannot express thirty-four
 * stages — and it is written out per stage rather than derived from a clever
 * rule, because the judgement calls are not derivable: client repairs are
 * site work, a PE signature is still our production, and city fees sit with
 * permitting even though the client is holding them.
 */
const LEGACY_GATE_BY_STAGE: Readonly<Record<StageKey, ProjectGate>> = {
  // recert
  "recert.draft": "PRE_DESIGN",
  "recert.field_work": "DESIGN",
  "recert.report_drafting": "DESIGN",
  "recert.awaiting_pe": "DESIGN",
  "recert.submitted_to_client": "DESIGN",
  // The client is fixing the building — site work, not a document.
  "recert.awaiting_client_repairs": "CONSTRUCTION",
  "recert.reinspection": "DESIGN",
  // The fees are the city's; the job is queued for submittal behind them.
  "recert.awaiting_client_fees": "PERMITTING",
  "recert.submitted_to_city": "PERMITTING",
  "recert.city_comments": "PERMITTING",
  "recert.recertified": "CLOSEOUT",

  // design
  "design.draft": "PRE_DESIGN",
  "design.design_work": "DESIGN",
  "design.awaiting_client_approval": "DESIGN",
  "design.awaiting_pe": "DESIGN",
  "design.submitted_to_client": "DESIGN",
  "design.submitted_to_city": "PERMITTING",
  "design.city_comments": "PERMITTING",
  "design.permit_issued": "CLOSEOUT",

  // permit — this pipeline starts mid-lifecycle: a permit job arrives with
  // the drawings already done, so it never sits in PRE_DESIGN.
  "permit.preparing_submittal": "DESIGN",
  "permit.awaiting_client_docs": "DESIGN",
  "permit.submitted_to_city": "PERMITTING",
  "permit.in_plan_review": "PERMITTING",
  "permit.city_comments": "PERMITTING",
  "permit.awaiting_client_fees": "PERMITTING",
  "permit.permit_issued": "CLOSEOUT",

  // construction
  "construction.draft": "PRE_DESIGN",
  "construction.awaiting_ntp": "PRE_DESIGN",
  "construction.under_construction": "CONSTRUCTION",
  "construction.final_inspection": "CONSTRUCTION",
  "construction.awaiting_repairs": "CONSTRUCTION",
  // Still a construction-phase deliverable, not a new design.
  "construction.closeout_letters": "CONSTRUCTION",
  "construction.submitted_to_city": "PERMITTING",
  "construction.closed_out": "CLOSEOUT",
};

/** The gate to store alongside a stage. Falls back to the column's own
 *  default for a project with no stage yet, or a value left behind by a
 *  rename — an unknown stage must not blank a legacy readout. */
export function legacyGateFor(stageKey: string | null | undefined): ProjectGate {
  if (!stageKey) return "PRE_DESIGN";
  return LEGACY_GATE_BY_STAGE[stageKey as StageKey] ?? "PRE_DESIGN";
}
