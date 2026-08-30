'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown } from 'lucide-react';
import type { CockpitProject, ProjectType } from './types';
import { TYPE_COLOR, TYPE_LABEL, STATUS_COLOR } from './types';
import {
  holderLabel,
  isStageValidForType,
  pipelineForType,
  resolveStage,
  type Stage,
  type StageHolder,
} from '@/lib/pipelines';
import {
  stageAdvanceDetail,
  stageAdvanceOffer,
  stageAdvancePrompt,
  type AdvanceSection,
} from '@/lib/stage-advance';
import { cn } from '@/lib/utils';

interface PipelineStripProps {
  projects: CockpitProject[];
}

const TYPE_FILTERS: (ProjectType | 'ALL')[] = ['ALL', 'CONSTRUCTION', 'DESIGN', 'RECERTIFICATION', 'BSIP', 'PERMIT'];

/**
 * Horizontal scrollable strip of project cards. Each card encodes:
 *  - Type via top-left color stripe
 *  - Stage via the segmented bar at the bottom, one segment per stage of
 *    THIS project's own pipeline
 *  - Status via the colored dot in the header
 *  - Money via the budget readout
 */
export function PipelineStrip({ projects }: PipelineStripProps) {
  const [filter, setFilter] = useState<(ProjectType | 'ALL')>('ALL');

  const filtered = filter === 'ALL' ? projects : projects.filter((p) => p.type === filter);

  return (
    <section className="cockpit-pipeline">
      <header className="cockpit-pipeline__header">
        <h2>Pipeline</h2>
        <div className="cockpit-pipeline__filters">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              className={`cockpit-pipeline__filter${filter === t ? ' is-active' : ''}`}
              onClick={() => setFilter(t)}
              style={t !== 'ALL' && filter === t ? { borderColor: TYPE_COLOR[t], color: TYPE_COLOR[t] } : undefined}
            >
              {t === 'ALL' ? 'All' : TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="cockpit-pipeline__empty">No projects in this category yet.</div>
      ) : (
        <div className="cockpit-pipeline__scroller">
          {filtered.map((p) => (
            <ProjectTile key={p.id} project={p} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectTile({ project }: { project: CockpitProject }) {
  const accent = project.type ? TYPE_COLOR[project.type] : '#666';
  // The tile is a link into the project: the bar reports where the job is and
  // is never a control. Moving a stage happens on the project itself, where
  // the viewer's edit rights are known.
  const stages = pipelineForType(project.type)?.stages ?? [];
  const stageIdx = isStageValidForType(project.type, project.stage)
    ? (resolveStage(project.stage)?.index ?? -1)
    : -1;

  return (
    <Link href={`/projects/${project.id}`} className="cockpit-pipeline-tile">
      <div className="cockpit-pipeline-tile__stripe" style={{ background: accent }} />
      <div className="cockpit-pipeline-tile__body">
        <header className="cockpit-pipeline-tile__header">
          <span
            className="cockpit-pipeline-tile__status"
            style={{ background: STATUS_COLOR[project.status] }}
            title={project.status.replace('_', ' ')}
          />
          {project.type && (
            <span className="cockpit-pipeline-tile__type" style={{ color: accent }}>
              {TYPE_LABEL[project.type]}
            </span>
          )}
        </header>
        <h3 className="cockpit-pipeline-tile__name">{project.name}</h3>
        {project.clientName && <p className="cockpit-pipeline-tile__client">{project.clientName}</p>}
        {project.location && <p className="cockpit-pipeline-tile__loc">{project.location}</p>}

        {/* A typeless project gets no bar at all — five generic segments here
            used to imply a lifecycle it has never been given. */}
        {stages.length > 0 && (
          <div className="cockpit-pipeline-tile__gates">
            {stages.map((s, i) => (
              <span
                key={s.key}
                className="cockpit-pipeline-tile__gate"
                data-active={i <= stageIdx ? 'true' : 'false'}
                style={i <= stageIdx ? { background: accent } : undefined}
                title={`${s.label} — ${holderLabel(s.holder)}`}
              />
            ))}
          </div>
        )}

        <footer className="cockpit-pipeline-tile__footer">
          {project.budget && project.currency && (
            <span className="cockpit-pipeline-tile__budget">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: project.currency,
                notation: 'compact',
                compactDisplay: 'short',
                maximumFractionDigits: 1,
              }).format(project.budget)}
            </span>
          )}
          <span className="cockpit-pipeline-tile__tasks">{project._count.tasks} tasks</span>
        </footer>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Per-project stage strip
// ─────────────────────────────────────────────────────────────────────────

/**
 * The sentence form of a holder. `holderLabel()` gives the noun that fits in
 * a pill ("The client"); this is the line under the strip, which has to read
 * as the answer to "whose desk is this on?". Exhaustive on purpose: a holder
 * added to the registry has to be given words here before it compiles.
 */
const HOLDER_DESK: Record<StageHolder, string> = {
  FIRM: 'On our desk',
  PE: "On the PE's desk",
  CLIENT: "On the client's desk",
  ARCHITECT: "On the architect's desk",
  CONTRACTOR: "On the contractor's desk",
  CITY: 'With the city',
  NONE: 'Finished',
};

/**
 * Where one click PUTS the job. HOLDER_DESK above is the same fact in the
 * present tense; this is the consequence of accepting the offer, and it is a
 * second map rather than a prefix because "Lands finished" is not a sentence —
 * the terminal stage closes the job rather than handing it to anyone.
 *
 * This is the line that makes the offer safe to click: the firm hesitates over
 * exactly one move, the hand-off to the PE, and the button should say so
 * before it is pressed.
 */
const HOLDER_LANDS: Record<StageHolder, string> = {
  FIRM: 'Lands on our desk.',
  PE: "Lands on the PE's desk.",
  CLIENT: "Lands on the client's desk.",
  ARCHITECT: "Lands on the architect's desk.",
  CONTRACTOR: "Lands on the contractor's desk.",
  CITY: 'Goes to the city.',
  NONE: 'Closes the job out.',
};

/**
 * Offers the viewer has waved off, for this tab only.
 *
 * Module scope, not component state: the strip unmounts on every navigation
 * inside a project, and an offer that reappears each time you come back is
 * wallpaper — which is how the two status controls lost the owner's trust in
 * the first place. A full reload clears it, so a dismissal is never permanent
 * and nothing has to be stored per user.
 *
 * Keyed by project AND stage: two recertifications sitting on Field Work are
 * two separate questions, and answering one must not silence the other.
 */
const dismissedAdvances = new Set<string>();

const advanceKey = (projectId: string, stageKey: string) =>
  `${projectId}|${stageKey}`;

/** Null — not "0 days" — when nothing recorded the arrival: a job whose
 *  stageEnteredAt is missing has an unknown wait, and claiming it landed
 *  today is the one thing the line must never do. */
function dwellLabel(since: string | Date | null | undefined): string | null {
  if (!since) return null;
  const entered = since instanceof Date ? since.getTime() : Date.parse(since);
  if (Number.isNaN(entered)) return null;
  const days = Math.floor((Date.now() - entered) / 86_400_000);
  if (days <= 0) return 'today';
  return days === 1 ? '1 day' : `${days} days`;
}

export interface ProjectStageStripProps {
  type: ProjectType | null;
  stage: string | null;
  /** ISO from an API payload, a Date when the server component spread the
   *  Prisma row straight through. */
  stageEnteredAt?: string | Date | null;
  blocker?: string | null;
  /**
   * Omit for a read-only strip. Supplying it is the whole permission
   * decision: the caller has already asked whether this viewer may edit the
   * project, and a context that renders inside a link never passes one.
   */
  onMove?: (stageKey: string, reason?: string) => void;
  saving?: boolean;
  /**
   * Identifies the job for the once-per-tab dismissal below. Required for the
   * advance offer, because a dismissal keyed on the stage alone would silence
   * every other project sitting on the same stage.
   */
  projectId?: string;
  /**
   * The project's board columns, each with its `stage` mapping and its tasks —
   * what lets the strip notice that this stage's work is finished and offer
   * the move. OMIT IT AND THE STRIP IS EXACTLY WHAT IT WAS: the offer is the
   * only thing these two props add, and a caller that has not loaded sections
   * (or has no right to move the stage) simply never sees it.
   */
  sections?: readonly AdvanceSection[];
}

/**
 * The stages of ONE project's own pipeline, from the registry.
 *
 * WIDTH: the rail is one flex-1 segment per stage, so eleven recertification
 * stages occupy exactly the width five gates did — in the 330px project
 * sidebar, on a phone, and inside a cockpit tile alike. Nothing scrolls
 * sideways and nothing wraps into an unreadable block of pills; the labels
 * live in the list, which is vertical and opens on demand.
 *
 * THE ADVANCE OFFER (`projectId` + `sections`) is the strip's one control that
 * the strip itself proposes: when every task in the column mapped to the
 * current stage is finished, it names the next stage and whose desk that puts
 * the job on, and one click moves it. It never moves anything on its own, it
 * appears only for a viewer who may edit, and "Not now" silences it for that
 * stage until the tab is reloaded.
 */
export function ProjectStageStrip({
  type,
  stage,
  stageEnteredAt,
  blocker,
  onMove,
  saving = false,
  projectId,
  sections,
}: ProjectStageStripProps) {
  const [listOpen, setListOpen] = useState(false);
  // A backward move waits here for a confirmation. Forward is one click,
  // because overshooting by a stage costs a click to undo; sending a job back
  // is a real event the firm counts, and a fat-fingered rail segment must not
  // be able to file one.
  const [pendingBack, setPendingBack] = useState<Stage | null>(null);
  const [reason, setReason] = useState('');
  // Mirrors the module-level set into state so waving an offer off re-renders,
  // and is SEEDED from it so a remount honours a dismissal made earlier in
  // this tab. Empty on the server and empty on the client's first paint, so
  // there is no hydration mismatch to repair.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(
    () => new Set(dismissedAdvances)
  );

  const pipeline = pipelineForType(type);
  // A key belonging to another pipeline (the type was changed under a live
  // job) is not a position in THIS strip — treat it as unset rather than
  // lighting up an unrelated segment.
  const resolved = isStageValidForType(type, stage) ? resolveStage(stage) : null;
  const currentIndex = resolved ? resolved.index : -1;
  const current = resolved?.stage ?? null;
  const editable = !!onMove;
  const dwell = dwellLabel(stageEnteredAt);

  // THE OFFER. Only for a viewer who may actually move the stage — telling a
  // reader that a stage is finished, next to a control he cannot use, is a
  // dead end. Everything else about when to stay quiet lives in the pure
  // function; see src/lib/stage-advance.ts.
  const offer = useMemo(
    () =>
      editable && projectId && sections
        ? stageAdvanceOffer({ type, stage, sections })
        : null,
    [editable, projectId, sections, type, stage]
  );
  const offerKey =
    offer && projectId ? advanceKey(projectId, offer.from.key) : null;
  // Hidden while a send-back is being confirmed: two questions about the same
  // strip at once is how a screen stops being read.
  const showOffer = !!offer && !!offerKey && !dismissed.has(offerKey) && !pendingBack;

  const dismissOffer = () => {
    if (!offerKey) return;
    dismissedAdvances.add(offerKey);
    setDismissed(new Set(dismissedAdvances));
  };

  const pick = (target: Stage, index: number) => {
    if (!onMove || saving || index === currentIndex) return;
    if (currentIndex >= 0 && index < currentIndex) {
      // Open the list too, so a rail click always shows what it is asking.
      setPendingBack(target);
      setListOpen(true);
      return;
    }
    setPendingBack(null);
    onMove(target.key);
    setListOpen(false);
  };

  const confirmBack = () => {
    if (!onMove || !pendingBack) return;
    onMove(pendingBack.key, reason.trim() || undefined);
    setPendingBack(null);
    setReason('');
    setListOpen(false);
  };

  if (!pipeline) {
    return (
      <div className="space-y-1.5">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-slate-200 text-slate-400">
          Set stage
        </span>
        <p className="text-xs text-slate-400">
          Give this project a type first — the stages come from it.
        </p>
      </div>
    );
  }

  const stages = pipeline.stages;

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-[3px]">
        {stages.map((s, i) => {
          const isCurrent = i === currentIndex;
          const reached = currentIndex >= 0 && i < currentIndex;
          const bar = cn(
            'block h-[5px] w-full rounded-full transition-colors',
            isCurrent ? 'bg-[#c9a84c]' : reached ? 'bg-[#E8D5A3]' : 'bg-slate-200'
          );
          const title = `${s.label} — ${holderLabel(s.holder)}`;
          return editable ? (
            <button
              key={s.key}
              type="button"
              title={title}
              aria-label={`Move to ${title}`}
              disabled={saving}
              onClick={() => pick(s, i)}
              // py-1.5 is the hit area, not padding: a 5px bar is not a
              // target you can hit on a phone.
              className={cn('group flex-1 min-w-[6px] py-1.5', saving && 'opacity-60')}
            >
              <span className={cn(bar, !isCurrent && 'group-hover:bg-[#DCC383]')} />
            </button>
          ) : (
            <span key={s.key} title={title} className="block flex-1 min-w-[6px] py-1.5">
              <span className={bar} />
            </span>
          );
        })}
      </div>

      <p className="text-xs text-slate-500">
        {current ? (
          <>
            <span className="font-medium text-slate-700">{current.label}</span>
            {' · '}
            {HOLDER_DESK[current.holder]}
            {/* Dwell only while somebody is holding it: how long a finished
                job has sat closed is not a wait anyone is waiting on. */}
            {current.holder !== 'NONE' && dwell ? ` · ${dwell}` : ''}
          </>
        ) : (
          'No stage set yet.'
        )}
      </p>

      {/* The one-click advance. Sits directly under the line that says where
          the job is, because it is the same sentence continued: this is where
          it is, and this is the one move the work says is available. It is an
          OFFER — the stage is never moved for him. See stage-advance.ts for
          why deriving it was rejected. */}
      {showOffer && offer && offerKey && (
        <div
          role="status"
          className="rounded-lg border border-[#e0c98a] bg-[#FBF3E4] p-2.5 space-y-2"
        >
          <p className="text-xs font-medium text-[#8F6C1F]">
            {stageAdvancePrompt(offer)}
          </p>
          <p className="text-[11px] text-[#a8893a]">
            {stageAdvanceDetail(offer)} {HOLDER_LANDS[offer.next.holder]}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (!onMove || saving) return;
                // Forward, so no reason and no confirmation — the same one
                // click a rail segment costs. It goes through the caller's
                // handleStageMove and therefore through PATCH
                // /api/projects/:id/stage, which is the only writer of
                // stageEnteredAt and the ProjectStageEvent history.
                //
                // Not dismissed here on purpose: if the move fails the caller
                // rolls the stage back, and the offer should come back with
                // it rather than vanish on a click that did nothing.
                setListOpen(false);
                onMove(offer.next.key);
              }}
              className="px-2.5 py-1 rounded text-xs font-medium bg-[#c9a84c] text-white disabled:opacity-60"
            >
              Move to {offer.next.label}
            </button>
            <button
              type="button"
              onClick={dismissOffer}
              className="px-2.5 py-1 rounded text-xs text-slate-500 hover:text-slate-700"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {blocker && <p className="text-xs text-slate-400">Blocked · {blocker}</p>}

      {editable && (
        <div>
          <button
            type="button"
            onClick={() => setListOpen((open) => !open)}
            disabled={saving}
            aria-expanded={listOpen}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#a8893a] hover:text-[#8a7028] disabled:opacity-60"
          >
            {current ? 'Move stage' : 'Set stage'}
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', listOpen && 'rotate-180')} />
          </button>

          {listOpen && (
            <div className="mt-1.5 border border-slate-200 rounded-lg overflow-hidden">
              {stages.map((s, i) => {
                const isCurrent = i === currentIndex;
                const isBehind = currentIndex >= 0 && i < currentIndex;
                return (
                  <button
                    key={s.key}
                    type="button"
                    disabled={saving || isCurrent}
                    onClick={() => pick(s, i)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs border-b border-slate-100 last:border-b-0',
                      isCurrent
                        ? 'bg-[#FBF3E4] text-[#8F6C1F] cursor-default'
                        : isBehind
                          ? 'text-slate-400 hover:bg-slate-50'
                          : 'text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      {isCurrent && <Check className="w-3 h-3 flex-shrink-0" />}
                      <span className="truncate">{s.label}</span>
                    </span>
                    <span className="flex-shrink-0 text-[11px] text-slate-400">
                      {holderLabel(s.holder)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {pendingBack && (
            <div className="mt-1.5 rounded-lg border border-[#e0c98a] bg-[#FBF3E4] p-2.5 space-y-2">
              <p className="text-xs text-[#8F6C1F]">
                Send this job back to{' '}
                <span className="font-medium">{pendingBack.label}</span>?
              </p>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 200))}
                placeholder="Why? City rejection, missing docs…"
                className="w-full px-2 py-1 text-xs bg-white border border-[#e0c98a] rounded focus:outline-none focus:ring-1 focus:ring-[#c9a84c]"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={confirmBack}
                  className="px-2.5 py-1 rounded text-xs font-medium bg-[#c9a84c] text-white disabled:opacity-60"
                >
                  Send back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingBack(null);
                    setReason('');
                  }}
                  className="px-2.5 py-1 rounded text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
