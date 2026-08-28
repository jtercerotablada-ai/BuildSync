import { describe, expect, it } from "vitest";
import type { ProjectGate, ProjectType } from "@prisma/client";
import {
  PIPELINES,
  PIPELINE_FOR_TYPE,
  holderLabel,
  isStageValidForType,
  legacyGateFor,
  nextStage,
  pipelineForType,
  previousStage,
  resolveStage,
  stageDirection,
  stagesForType,
  type Pipeline,
  type PipelineId,
} from "./pipelines";

/**
 * THE FOUR PIPELINES.
 *
 * pipelines.ts is the schema for Project.stage — the column is TEXT, so
 * nothing in the database can reject a stage key and nothing in the database
 * remembers the order. Every guarantee the product relies on is therefore a
 * guarantee this file has to hold: keys are unique, each pipeline has exactly
 * one terminal stage and it is last, every ProjectType reaches a pipeline,
 * and a stage from one pipeline is never accepted onto another type's job.
 *
 * The stage lists below are copied from the sign-off, not from the source, on
 * purpose: they are what makes "do not add, remove, rename or reorder a
 * stage" enforceable rather than a comment.
 *
 * The last describe block is the one that matters most operationally. The
 * legacy `gate` column is still read by roughly a dozen unmigrated readouts;
 * a stage with no gate mapping would blank them silently on the day this
 * deploys, with nothing throwing anywhere.
 *
 * No database and no network — DATABASE_URL points at PRODUCTION and
 * vitest.config.ts blanks it. Nothing here imports Prisma at runtime; the two
 * enums arrive as erased types.
 */

const PIPELINE_IDS = Object.keys(PIPELINES) as PipelineId[];
const ALL_PIPELINES: Pipeline[] = PIPELINE_IDS.map((id) => PIPELINES[id]);

/** As signed off by the firm's owner. */
const SIGNED_OFF: Record<PipelineId, string[]> = {
  recert: [
    "recert.draft",
    "recert.field_work",
    "recert.report_drafting",
    "recert.awaiting_pe",
    "recert.submitted_to_client",
    "recert.awaiting_client_repairs",
    "recert.reinspection",
    "recert.awaiting_client_fees",
    "recert.submitted_to_city",
    "recert.city_comments",
    "recert.recertified",
  ],
  design: [
    "design.draft",
    "design.design_work",
    "design.awaiting_client_approval",
    "design.awaiting_pe",
    "design.submitted_to_client",
    "design.submitted_to_city",
    "design.city_comments",
    "design.permit_issued",
  ],
  permit: [
    "permit.preparing_submittal",
    "permit.awaiting_client_docs",
    "permit.submitted_to_city",
    "permit.in_plan_review",
    "permit.city_comments",
    "permit.awaiting_client_fees",
    "permit.permit_issued",
  ],
  construction: [
    "construction.draft",
    "construction.awaiting_ntp",
    "construction.under_construction",
    "construction.final_inspection",
    "construction.awaiting_repairs",
    "construction.closeout_letters",
    "construction.submitted_to_city",
    "construction.closed_out",
  ],
};

/** Every ProjectType in the schema. Typed as a Record so the schema gaining a
 *  type fails to compile here instead of quietly skipping the coverage test
 *  an `as` cast or a hand-written array would allow. */
const ALL_PROJECT_TYPES: Record<ProjectType, true> = {
  RECERTIFICATION: true,
  BSIP: true,
  DESIGN: true,
  PERMIT: true,
  CONSTRUCTION: true,
};

/** Every ProjectGate in the schema, exhaustive for the same reason. */
const ALL_PROJECT_GATES: Record<ProjectGate, true> = {
  PRE_DESIGN: true,
  DESIGN: true,
  PERMITTING: true,
  CONSTRUCTION: true,
  CLOSEOUT: true,
};

const projectTypes = Object.keys(ALL_PROJECT_TYPES) as ProjectType[];
const projectGates = Object.keys(ALL_PROJECT_GATES) as ProjectGate[];

// ───────────────────────────────────────────────────────────────────────────
// The stages are the ones that were signed off
// ───────────────────────────────────────────────────────────────────────────

describe("the four pipelines are the ones the firm signed off", () => {
  it.each(PIPELINE_IDS)("%s runs exactly its agreed stages, in order", (id) => {
    expect(PIPELINES[id].stages.map((s) => s.key)).toEqual(SIGNED_OFF[id]);
  });

  it("no stage key is used by two pipelines", () => {
    // Project.stage is a bare TEXT column: a duplicated key would resolve to
    // whichever pipeline was indexed last, silently moving a job.
    const keys = ALL_PIPELINES.flatMap((p) => p.stages.map((s) => s.key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(PIPELINE_IDS)("every %s stage key carries its own prefix", (id) => {
    for (const stage of PIPELINES[id].stages) {
      expect(stage.key.startsWith(`${id}.`)).toBe(true);
    }
  });

  it("every stage has a label and names a holder", () => {
    for (const stage of ALL_PIPELINES.flatMap((p) => p.stages)) {
      expect(stage.label.length).toBeGreaterThan(0);
      // The whole point of a stage: whose desk is this on.
      expect(holderLabel(stage.holder).length).toBeGreaterThan(0);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Each pipeline ends, once
// ───────────────────────────────────────────────────────────────────────────

describe("every pipeline has exactly one end", () => {
  it.each(PIPELINE_IDS)("%s has a single terminal stage", (id) => {
    const terminals = PIPELINES[id].stages.filter((s) => s.terminal);
    expect(terminals).toHaveLength(1);
  });

  it.each(PIPELINE_IDS)("%s's terminal stage is its last one", (id) => {
    const stages = PIPELINES[id].stages;
    expect(stages[stages.length - 1].terminal).toBe(true);
    // No terminal stage before the end — nextStage() would keep walking past
    // a "done" stage and the strip would render two finish lines.
    for (const stage of stages.slice(0, -1)) {
      expect(stage.terminal).toBeUndefined();
    }
  });

  it.each(PIPELINE_IDS)("%s ends with nobody holding the job", (id) => {
    const stages = PIPELINES[id].stages;
    expect(stages[stages.length - 1].holder).toBe("NONE");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Types reach pipelines
// ───────────────────────────────────────────────────────────────────────────

describe("every project type knows which pipeline it runs", () => {
  it.each(projectTypes)("%s maps to a pipeline that exists", (type) => {
    const pipeline = pipelineForType(type);
    expect(pipeline).not.toBeNull();
    expect(PIPELINES[PIPELINE_FOR_TYPE[type]]).toBe(pipeline);
    expect(stagesForType(type).length).toBeGreaterThan(0);
  });

  it("BSIP runs the recertification pipeline, stage for stage", () => {
    // Broward's program is procedurally identical to a Miami-Dade recert; the
    // separate type exists only so the firm can count that work on its own.
    expect(pipelineForType("BSIP")).toBe(pipelineForType("RECERTIFICATION"));
  });

  it("a project with no type has no pipeline and no stages", () => {
    // One live project is deliberately typeless — the strip must offer "Set
    // stage" rather than guess a pipeline for it.
    expect(pipelineForType(null)).toBeNull();
    expect(stagesForType(null)).toEqual([]);
    expect(stagesForType(undefined)).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Validation — what the API refuses
// ───────────────────────────────────────────────────────────────────────────

describe("a stage belongs to one pipeline and no other", () => {
  it.each(projectTypes)("%s accepts every stage of its own pipeline", (type) => {
    for (const stage of stagesForType(type)) {
      expect(isStageValidForType(type, stage.key)).toBe(true);
    }
  });

  it("refuses a key that belongs to another pipeline", () => {
    expect(isStageValidForType("RECERTIFICATION", "design.design_work")).toBe(
      false
    );
    expect(isStageValidForType("PERMIT", "recert.field_work")).toBe(false);
    // Same slug, different pipeline: the prefix is what decides.
    expect(isStageValidForType("DESIGN", "permit.submitted_to_city")).toBe(
      false
    );
  });

  it("refuses an unknown key, and any key at all on a typeless project", () => {
    expect(isStageValidForType("DESIGN", "design.not_a_stage")).toBe(false);
    expect(isStageValidForType("DESIGN", "")).toBe(false);
    expect(isStageValidForType("DESIGN", null)).toBe(false);
    expect(isStageValidForType(null, "design.draft")).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Resolving a stored value
// ───────────────────────────────────────────────────────────────────────────

describe("resolveStage reads a raw column value", () => {
  it("returns the pipeline, the stage and its position", () => {
    const resolved = resolveStage("recert.city_comments");
    expect(resolved?.pipelineId).toBe("recert");
    expect(resolved?.stage.label).toBe("City Comments");
    expect(resolved?.index).toBe(9);
  });

  it("returns null for a value it does not know, instead of throwing", () => {
    // The column is TEXT: a row seeded before a rename can hold anything, and
    // a stale value has to render as unknown, never as a 500.
    expect(resolveStage("recert.retired_stage")).toBeNull();
    expect(resolveStage("nonsense")).toBeNull();
    expect(resolveStage(null)).toBeNull();
    expect(resolveStage(undefined)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Walking a pipeline
// ───────────────────────────────────────────────────────────────────────────

describe("next and previous walk one pipeline and stop at its ends", () => {
  it.each(PIPELINE_IDS)("%s walks forward to its terminal stage", (id) => {
    const stages = PIPELINES[id].stages;
    for (let i = 0; i < stages.length - 1; i++) {
      expect(nextStage(stages[i].key)?.key).toBe(stages[i + 1].key);
    }
    expect(nextStage(stages[stages.length - 1].key)).toBeNull();
  });

  it.each(PIPELINE_IDS)("%s walks back to its first stage", (id) => {
    const stages = PIPELINES[id].stages;
    for (let i = stages.length - 1; i > 0; i--) {
      expect(previousStage(stages[i].key)?.key).toBe(stages[i - 1].key);
    }
    expect(previousStage(stages[0].key)).toBeNull();
  });

  it("returns null for a key that does not resolve", () => {
    expect(nextStage("nonsense")).toBeNull();
    expect(previousStage(null)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Direction — the number the firm actually wants
// ───────────────────────────────────────────────────────────────────────────

describe("stageDirection records how a job moved", () => {
  it("the City Comments loop back to Report Drafting is BACKWARD", () => {
    // The loop the firm spends its year in, and the only reason the direction
    // column exists: how often a job falls back is the cost of the year.
    expect(
      stageDirection("recert.city_comments", "recert.report_drafting")
    ).toBe("BACKWARD");
  });

  it("moving deeper into the same pipeline is FORWARD", () => {
    expect(stageDirection("recert.draft", "recert.field_work")).toBe("FORWARD");
    expect(
      stageDirection("permit.preparing_submittal", "permit.permit_issued")
    ).toBe("FORWARD");
  });

  it("the first stage a project is ever given is SEED", () => {
    expect(stageDirection(null, "recert.draft")).toBe("SEED");
    expect(stageDirection(undefined, "design.draft")).toBe("SEED");
  });

  it("a move that crosses pipelines is SEED, not progress", () => {
    // The project's type changed underneath it; the two orders share no scale
    // to compare, so counting it as a step forward would be a lie.
    expect(stageDirection("design.design_work", "permit.in_plan_review")).toBe(
      "SEED"
    );
    expect(stageDirection("recert.draft", "nonsense")).toBe("SEED");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Holders
// ───────────────────────────────────────────────────────────────────────────

describe("holderLabel answers whose desk this is on", () => {
  it("reads as the firm, not as a person or a company name", () => {
    expect(holderLabel("FIRM")).toBe("Us");
    expect(holderLabel("CLIENT")).toBe("The client");
    expect(holderLabel("CITY")).toBe("The city");
    expect(holderLabel("NONE")).toBe("No one");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// The legacy gate — the readouts that have not been migrated
// ───────────────────────────────────────────────────────────────────────────

describe("every stage still derives a legacy gate", () => {
  it("returns a real ProjectGate for EVERY stage of every pipeline", () => {
    // The one test that stops the ~13 unmigrated `gate` readouts from going
    // blank on deploy day. A stage added without a gate mapping fails here
    // (and in the compiler, where the map is exhaustive over StageKey).
    for (const stage of ALL_PIPELINES.flatMap((p) => p.stages)) {
      expect(projectGates).toContain(legacyGateFor(stage.key));
    }
  });

  it("a finished job reads CLOSEOUT", () => {
    for (const pipeline of ALL_PIPELINES) {
      const last = pipeline.stages[pipeline.stages.length - 1];
      expect(legacyGateFor(last.key)).toBe("CLOSEOUT");
    }
  });

  it("city and review stages read PERMITTING", () => {
    expect(legacyGateFor("recert.submitted_to_city")).toBe("PERMITTING");
    expect(legacyGateFor("permit.in_plan_review")).toBe("PERMITTING");
    expect(legacyGateFor("design.city_comments")).toBe("PERMITTING");
  });

  it("site work reads CONSTRUCTION even when a client is holding it", () => {
    expect(legacyGateFor("recert.awaiting_client_repairs")).toBe(
      "CONSTRUCTION"
    );
    expect(legacyGateFor("construction.under_construction")).toBe(
      "CONSTRUCTION"
    );
  });

  it("falls back to the column default for a missing or stale stage", () => {
    expect(legacyGateFor(null)).toBe("PRE_DESIGN");
    expect(legacyGateFor(undefined)).toBe("PRE_DESIGN");
    expect(legacyGateFor("recert.retired_stage")).toBe("PRE_DESIGN");
  });
});
