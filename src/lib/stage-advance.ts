/**
 * stage-advance.ts — "the work for this stage is finished; move it?"
 *
 * WHY THIS EXISTS
 * The owner looked at a recertification and said he saw two places to set a
 * status, and that the statuses "should update themselves as things get
 * finished". He was looking at three different answers to one question: the
 * hand-written STATUS (how the job is going), the STAGE (whose desk it is on,
 * from @/lib/pipelines), and the board's columns — which, on the recert
 * template, are a coarser copy of the same pipeline. Section.stage is the join
 * between the last two, and this file is what it buys: the product can now
 * notice that a stage's work is done and OFFER the move.
 *
 * WHY IT ONLY OFFERS
 * Deriving the stage from task completion was proposed and rejected on
 * inspection. Several recertification stages — Awaiting Client Repairs,
 * Awaiting Client Fees, Reinspection — carry no column at all on the
 * templates the firm uses, because no task of theirs is the firm's to do;
 * "the furthest column with open work" could never land on one of them, so a
 * derived stage would silently skip exactly the stages where "whose desk is
 * this on?" is the entire question. Of the ones that DO have a column, the
 * column holds the act that STARTS the wait ("Submit reports to owner" under
 * Submitted to Client), not the wait itself — so finishing it is a reason to
 * ask, never a reason to move a job on the product's own authority. Deriving
 * would also throw away stageEnteredAt, stageBlocker and the
 * ProjectStageEvent history. The stage stays stored and human-moved. This
 * decides only whether to ask.
 *
 * THE THREE RULES, AND WHY EACH ONE IS A RULE
 *  1. A stage with NO section mapped to it is never "finished" here. There is
 *     nothing to finish, and offering to advance it would be the product
 *     guessing about the PE, the client or the city.
 *  2. An EMPTY mapped section is not a finished section. Zero of zero tasks is
 *     not an accomplishment, and prompting on it would fire the moment a
 *     project is created — the fastest possible way to teach the firm to
 *     ignore the prompt.
 *  3. The next stage is whatever the registry says is next, never a guess.
 *     Adjacency lives in pipelines.ts and nowhere else.
 *
 * PURE. No database, no network, no clock, no DOM — the caller passes the
 * sections it already rendered. The only imports are the stage registry and
 * an erased type.
 */

import type { ProjectType } from "@prisma/client";
import {
  isStageValidForType,
  nextStage,
  resolveStage,
  type Stage,
} from "@/lib/pipelines";

/** The one field of a task this decision reads. */
export interface AdvanceTask {
  completed: boolean;
}

/**
 * A board column. `stage` is Section.stage — a Project.stage key such as
 * "recert.field_work", or null for a free-form column, which is most of them
 * and which this file simply ignores.
 */
export interface AdvanceSection {
  name?: string | null;
  stage?: string | null;
  tasks?: readonly AdvanceTask[] | null;
}

export interface StageAdvanceInput {
  type: ProjectType | null | undefined;
  /** Raw Project.stage. TEXT column, so it may be null or stale. */
  stage: string | null | undefined;
  sections: readonly AdvanceSection[] | null | undefined;
}

export interface StageAdvanceOffer {
  /** The stage whose work is finished — where the job is right now. */
  from: Stage;
  /** The stage one click away. Carries the holder the UI names. */
  next: Stage;
  /** The column that earned the offer; the first named one when a project
   *  maps more than one column to the same stage. Null when it has no name. */
  sectionName: string | null;
  /** How many tasks had to be finished. Never 0 — see rule 2. */
  taskCount: number;
}

/**
 * The offer, or null for "say nothing".
 *
 * Null is the answer for every ordinary moment: no type, no stage, a stage key
 * left behind by a type change, a stage nobody has mapped a column to, an
 * empty column, one open task, or the end of the pipeline. Silence is the
 * default because this thing gets rendered on every project the firm opens.
 */
export function stageAdvanceOffer(
  input: StageAdvanceInput
): StageAdvanceOffer | null {
  const { type, stage, sections } = input;

  if (!sections || sections.length === 0) return null;

  // A key belonging to another pipeline (the type was changed under a live
  // job) is not a position in this job's strip, so there is no "next" to
  // offer — the same rule the strip itself renders by.
  if (!isStageValidForType(type, stage)) return null;

  const resolved = resolveStage(stage);
  if (!resolved) return null;

  // Terminal stage: nothing comes after Recertified. Asked before counting
  // tasks so a finished job never computes an offer it cannot make.
  const next = nextStage(resolved.stage.key);
  if (!next) return null;

  // Rule 1. Exact key match only: a column mapped to Field Work says nothing
  // about a job sitting in Report Drafting, and null never matches.
  const mapped = sections.filter((s) => s.stage === resolved.stage.key);
  if (mapped.length === 0) return null;

  // Every mapped column counts as one body of work. A project that split
  // Field Work across two columns has not finished the stage until both are
  // done, and the count the owner reads is the total.
  //
  // WHAT THIS CANNOT SEE: the caller passes the sections it RENDERED, and the
  // project page filters tasks through taskPrivacyClause(), so a private task
  // the viewer may not open is not in this list. The offer therefore speaks
  // for the board in front of him and no more — which is why it is an offer
  // with a "Not now" and not an automatic move.
  let taskCount = 0;
  for (const section of mapped) {
    for (const task of section.tasks ?? []) {
      if (!task.completed) return null;
      taskCount += 1;
    }
  }

  // Rule 2.
  if (taskCount === 0) return null;

  const named = mapped.find((s) => !!s.name && s.name.trim().length > 0);

  return {
    from: resolved.stage,
    next,
    sectionName: named?.name?.trim() ?? null,
    taskCount,
  };
}

/**
 * The question, in the owner's words: "All Field Work is done. Move to Report
 * Drafting?" It names both stages because the whole complaint was that the
 * screen never said which of its controls meant what.
 */
export function stageAdvancePrompt(offer: StageAdvanceOffer): string {
  return `All ${offer.from.label} is done. Move to ${offer.next.label}?`;
}

/**
 * The evidence under the question — what was actually counted, so the offer
 * is checkable rather than magic.
 */
export function stageAdvanceDetail(offer: StageAdvanceOffer): string {
  const tasks = offer.taskCount === 1 ? "1 task" : `${offer.taskCount} tasks`;
  // The column is named only when it is not the stage label over again: on the
  // recert template the column IS "Field Work", and "6 tasks in Field Work"
  // under a line that already said Field Work twice reads as noise.
  const name = offer.sectionName;
  if (!name || name.toLowerCase() === offer.from.label.toLowerCase()) {
    return `${tasks}, all complete.`;
  }
  return `${tasks} in ${name}, all complete.`;
}
