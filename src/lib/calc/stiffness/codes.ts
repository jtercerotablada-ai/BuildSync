import type { SupportSymbol } from './analysis';
import type { StiffnessNotice } from './model';
import type { CheckId, DofKind, HighlightReason, IssueCode, Mode, StepId, WarningCode } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STIFFNESS MATRIX, STEP BY STEP — every machine code the library returns, in one place
 * ─────────────────────────────────────────────────────────────────────────────
 * The page writes ONE SENTENCE PER CODE, in English and in Spanish. These lists are what its strings are held to: each is checked at compile time to hold
 * every member of its union (adding a code to the union without adding it here does not compile), and diagnostics.test.ts / engine.test.ts /
 * model.test.ts produce every one of them.
 *
 *   ISSUE_CODES        what stops a solution (analysis.issues[].code).
 *   WARNING_CODES      what the solution comes with (analysis.warnings[].code).
 *   NOTICE_CODES       what the last edit has to tell the visitor (form.notice.code).
 *   STEP_IDS           the ids (= title codes) of the steps of the worked solution, in order; STAGE_OF their stage (1–14).
 *   HIGHLIGHT_REASONS  why a cell of a matrix or an entry of a vector is marked.
 *   CHECK_IDS          the checks of step 14.
 *   SUPPORT_SYMBOLS    what a support is drawn as.
 *   MECHANISM_KINDS    issue.kind of a 'mechanism'.
 *   DOF_KINDS          the last character of a DOF label.
 *   MODES, MEMBER_LOAD_KINDS   the choices of the form.
 */

type AllOf<Union extends string, List extends readonly Union[]> = Exclude<Union, List[number]> extends never ? List : never;
const all = <Union extends string>() => <const List extends readonly Union[]>(list: AllOf<Union, List>): List => list;

export const ISSUE_CODES = all<IssueCode>()([
  'mode',
  'few-nodes',
  'no-members',
  'too-big',
  'number',
  'section',
  'section-missing',
  'member-node',
  'zero-length',
  'duplicate-node',
  'short-member',
  'duplicate-member',
  'node-unconnected',
  'disconnected',
  'support-node',
  'duplicate-support',
  'load-node',
  'load-member',
  'load-kind',
  'load-position',
  'few-supports',
  'mechanism',
  'stiffness-range',
  'ill-conditioned',
  'size',
  'stopped',
] as const);

export const WARNING_CODES = all<WarningCode>()(['no-load', 'member-loads-ignored', 'settlement-ignored', 'empty-support', 'near-mechanism', 'large-displacements'] as const);

export const NOTICE_CODES = all<StiffnessNotice['code']>()(['node-removed', 'member-removed', 'limit', 'nothing-to-add', 'template'] as const);

export const STEP_IDS = all<StepId>()([
  'structure',
  'geometry',
  'local-stiffness',
  'transformation',
  'global-member',
  'assembly',
  'assembled',
  'nodal-loads',
  'member-loads',
  'load-vector',
  'partition',
  'reduced',
  'augmented',
  'forward-pass',
  'back-substitution',
  'solution',
  'displacements',
  'reactions',
  'end-forces',
  'checks',
] as const);

/** The stage (1–14) of each step id. */
export const STAGE_OF: Record<StepId, number> = {
  structure: 1,
  geometry: 2,
  'local-stiffness': 3,
  transformation: 4,
  'global-member': 5,
  assembly: 6,
  assembled: 6,
  'nodal-loads': 7,
  'member-loads': 7,
  'load-vector': 7,
  partition: 8,
  reduced: 9,
  augmented: 10,
  'forward-pass': 10,
  'back-substitution': 10,
  solution: 10,
  displacements: 11,
  reactions: 12,
  'end-forces': 13,
  checks: 14,
};

/** The steps that come once for each member (scope 'member'). */
export const MEMBER_STEP_IDS: readonly StepId[] = ['geometry', 'local-stiffness', 'transformation', 'global-member', 'assembly', 'member-loads', 'end-forces'];

export const HIGHLIGHT_REASONS = all<HighlightReason>()(['axial', 'bending', 'position', 'contributed', 'shared', 'pivot', 'eliminated', 'updated', 'zero-pivot', 'prescribed', 'restrained'] as const);

export const CHECK_IDS = all<CheckId>()(['sum-fx', 'sum-fy', 'sum-moment', 'joints', 'energy', 'system', 'solve'] as const);

export const SUPPORT_SYMBOLS = all<SupportSymbol>()(['fixed', 'pin', 'roller-y', 'roller-x', 'guide-x', 'guide-y', 'rotation', 'none'] as const);

export const MECHANISM_KINDS = ['sway', 'rigid-body'] as const;

export const DOF_KINDS = all<DofKind>()(['x', 'y', 'θ'] as const);

export const MODES = all<Mode>()(['truss', 'frame'] as const);

export const MEMBER_LOAD_KINDS = ['udl', 'point', 'axial'] as const;

/** Why an add had nothing to add (notice 'nothing-to-add', `why`). */
export const NOTHING_TO_ADD_WHY = ['pairs', 'few-nodes', 'coincident', 'nodes', 'no-node', 'no-member', 'truss-mode'] as const;
