import type { AnalysisIssueCode } from './analysis';
import type { FrameNotice } from './model';
import type { ClampWhy } from './templates';
import type { FrameIssueCode, FrameLoadDir, FrameSupportKind, FrameWarningCode, StationKind } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PLANE FRAME ANALYSIS — every machine code the library returns, in one place
 * ─────────────────────────────────────────────────────────────────────────────
 * The page writes ONE SENTENCE PER CODE, in English and in Spanish. These lists are what its strings are held to: each is checked at
 * compile time to hold every member of its union (adding a code to the union without adding it here does not compile), and
 * diagnostics.test.ts / analysis.test.ts / model.test.ts / templates.test.ts produce every one of them.
 *
 *   ISSUE_CODES        what stops a solution (analysis.issues[].code): the engine's, types.ts has the numbers each carries,
 *                      plus 'duplicate-nodes' and 'scale' that analysis.ts makes of the engine's 'duplicate-node'.
 *   WARNING_CODES      what the solution comes with (analysis.warnings[].code).
 *   NOTICE_CODES       what the last edit has to tell the visitor (form.notice.code): model.ts.
 *   CLAMP_WHY          why a template parameter was changed (notice.clamped[].why).
 *   DETERMINACY_WORDS  determinacy.word (null: the model has an error that comes before any count).
 *   STATION_KINDS      the key stations of a member's diagram.
 *   SUPPORT_KINDS, LOAD_DIRECTIONS   the choices of the form.
 *   MECHANISM_KINDS    issue.kind of a 'mechanism'.
 */

type AllOf<Union extends string, List extends readonly Union[]> = Exclude<Union, List[number]> extends never ? List : never;
const all = <Union extends string>() => <const List extends readonly Union[]>(list: AllOf<Union, List>): List => list;

export const ISSUE_CODES = all<AnalysisIssueCode>()([
  'few-nodes',
  'no-members',
  'too-big',
  'number',
  'section',
  'member-node',
  'zero-length',
  'duplicate-node',
  'duplicate-nodes',
  'scale',
  'short-member',
  'duplicate-member',
  'node-unconnected',
  'disconnected',
  'support-node',
  'support-kind',
  'duplicate-support',
  'spring',
  'load-node',
  'load-member',
  'load-kind',
  'load-position',
  'depth',
  'few-supports',
  'unrestrained',
  'mechanism',
  'hinged-joint-moment',
  'sections',
  'ill-conditioned',
  'size',
  'stopped',
] as const);

/** The engine's own codes (a subset of ISSUE_CODES): what `solveFrame` can return. */
export const ENGINE_ISSUE_CODES: readonly FrameIssueCode[] = ISSUE_CODES.filter((c): c is FrameIssueCode => c !== 'duplicate-nodes' && c !== 'scale');

export const WARNING_CODES = all<FrameWarningCode>()(['no-load', 'no-stiffness', 'bar', 'free-rotation', 'no-expansion'] as const);

export const NOTICE_CODES = all<FrameNotice['code']>()(['node-removed', 'member-removed', 'limit', 'nothing-to-add', 'template'] as const);

export const CLAMP_WHY = all<ClampWhy>()(['min', 'max', 'integer', 'positive', 'number', 'base'] as const);

export const DETERMINACY_WORDS = ['determinate', 'indeterminate', 'unstable'] as const;

export const STATION_KINDS = all<StationKind>()(['end', 'load', 'zero-shear', 'zero-moment', 'zero-axial'] as const);

export const SUPPORT_KINDS = all<FrameSupportKind>()(['fixed', 'pin', 'roller', 'guide', 'spring'] as const);

export const LOAD_DIRECTIONS = all<FrameLoadDir>()(['local-y', 'local-x', 'global-x', 'global-y'] as const);

export const MECHANISM_KINDS = ['sway', 'rotation'] as const;
