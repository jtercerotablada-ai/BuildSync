import type { AnalysisIssue, AnalysisWarning, CableAnalysis, CableRow, RegimeLine } from '@/lib/calc/cable/analysis';
import type { CableForm, CableUnits } from '@/lib/calc/cable/model';
import type { CableUi } from '@/lib/calc/cable/strings';
import type { PullRegimeId } from '@/lib/calc/cable/types';

/**
 * The little text machinery of the cable calculator's sentences. No React, no
 * words of its own (a calculator's words are a prop: lib/calc/cable/strings.ts).
 *
 *   fill           a sentence with holes: `{count}` is the number, and
 *                  `{count|way|ways}` is the first word when it is 1 and the second
 *                  otherwise. One pass over the sentence, so that nothing typed into
 *                  a hole is taken for another hole.
 *   signed         a number with its sign and a true minus; a zero with none.
 *   unitText       a unit as the page sets it: the raised minus of 10⁻⁶ is not in the
 *                  page's type (lib/calc/format.ts says why), so it is written 10^−6.
 *   issueSentence  the sentence for one problem the analysis reports, the numbers
 *                  the code carries put in its holes.
 *   warningSentence, regimeSentences, and the summaries of the four drawings, for
 *                  whoever cannot see them (slingSummary, bodySummary, curveSummary,
 *                  drumSummary).
 *
 * Every number reaching a sentence is already settled by analysis.ts (what is
 * rounding is zero there) and written by the caller's `num`, so a sentence
 * cannot print a -0, a NaN or an exponent of its own.
 */

export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)(?:\|([^|}]*)\|([^|}]*))?\}/g, (all, key: string, one?: string, many?: string) => {
    const value = vars[key];
    if (value === undefined) return all;
    if (one !== undefined && many !== undefined) return Number(value) === 1 ? one : many;
    return String(value);
  });
}

/** A sentence once its holes are filled: no space before a stop, none doubled, none at the ends. */
const tidy = (text: string): string => text.replace(/ +([.,;:)°])/g, '$1').replace(/ {2,}/g, ' ').trim();

/** A value with its sign: "+15", "−20", "0" - a true minus, and none for a zero. */
export function signed(text: string, value: number): string {
  return value === 0 || text === '0' ? '0' : `${value > 0 ? '+' : '−'}${text}`;
}

/** A unit as the page sets it. */
export const unitText = (unit: string): string => unit.replace('⁻⁶', '^−6');

/** What a sentence needs to write a number: the form, its units, and the page's way of writing one. */
export interface Ctx {
  form: CableForm;
  units: CableUnits;
  num: (value: number, significant?: number) => string;
}

const forceUnit = (c: Ctx): string => c.units.force[c.form.forceUnit];

/** The key of `fields` that names the value a row is about. */
export function fieldKey(row: CableRow | undefined, form: CableForm): keyof CableUi['fields'] {
  if (!row) return 'value';
  if (row.group === 'pull' && row.field === 'W' && form.pull.massInput) return 'mass';
  if (row.group === 'dT') return 'dT';
  return row.field;
}

/** The unit a row's value is written in (empty for a number with none). */
export function rowUnit(row: CableRow | undefined, c: Ctx, w: CableUi): string {
  if (!row) return '';
  const u = c.units;
  const force = forceUnit(c);
  switch (row.group) {
    case 'section':
    case 'leg2section':
      return { d: u.dia, A: u.area, factor: '', E: u.E, alpha: unitText(u.alpha), mbf: force }[row.field];
    case 'dT':
      return u.dT;
    case 'design':
      return row.field === 'allowable' ? u.stress : '';
    case 'load':
      return row.field === 'legs' ? '' : force;
    case 'leg1':
    case 'leg2':
      return row.field === 'angle' ? '°' : row.field === 'length' ? u.length : '';
    case 'pull':
      return { W: c.form.pull.massInput ? u.mass : force, theta: '°', muS: '', muK: '', phi: '°', accel: u.accel, travel: '', length: u.length }[row.field];
    case 'drum':
      return row.field === 'Tbig' || row.field === 'Tsmall' ? force : row.field === 'wrap' ? (c.form.drum.wrapUnit === 'deg' ? '°' : w.words.turns) : '';
  }
}

/** The angle between the two legs' directions, degrees, from the form: two legs on one side differ by their angles, on opposite sides they add up to the straight angle. */
export function angleBetweenLegs(form: CableForm): number {
  const { leg1, leg2 } = form.load;
  const between = leg1.side === leg2.side ? Math.abs(leg1.angle - leg2.angle) : 180 - (leg1.angle + leg2.angle);
  return Math.abs(between);
}

/** The sentence for one problem the analysis reports: its code's line in the words given, with the numbers the code carries put in its holes. */
export function issueSentence(issue: AnalysisIssue, w: CableUi, c: Ctx): string {
  const { num } = c;
  const unit = forceUnit(c);
  const vars: Record<string, string | number> = { unit };
  const n0 = issue.numbers?.[0];
  const n1 = issue.numbers?.[1];
  switch (issue.code) {
    case 'number':
      vars.field = w.fields[fieldKey(issue.row, c.form)];
      break;
    case 'range': {
      vars.field = w.fields[fieldKey(issue.row, c.form)];
      const hasMin = issue.min !== undefined;
      const hasMax = issue.max !== undefined;
      const bounds = hasMin && hasMax ? w.bounds.between : hasMin ? (issue.minOpen ? w.bounds.above : w.bounds.atLeast) : hasMax ? w.bounds.atMost : w.bounds.other;
      vars.bounds = fill(bounds, { min: hasMin ? num(issue.min as number) : '', max: hasMax ? num(issue.max as number) : '', unit: unitText(rowUnit(issue.row, c, w)) });
      break;
    }
    case 'parallel-legs':
      vars.between = num(angleBetweenLegs(c.form));
      break;
    case 'slack-leg':
      vars.leg = issue.leg ?? 1;
      vars.T = num(Math.abs(issue.numbers?.[(issue.leg ?? 1) - 1] ?? 0));
      break;
    case 'underdetermined':
      vars.count = issue.count ?? 0;
      break;
    case 'order':
      vars.Tbig = num(n0 ?? Number.NaN);
      vars.Tsmall = num(n1 ?? Number.NaN);
      break;
    case 'degenerate': {
      const words = w.degenerate[issue.unknown === 'mu' ? 'mu' : 'beta'];
      vars.unknown = words.unknown;
      vars.zero = words.zero;
      vars.need = words.need;
      vars.Tbig = num(n0 ?? Number.NaN);
      vars.Tsmall = num(n1 ?? Number.NaN);
      break;
    }
    case 'overflow':
      vars.exponent = num(n0 ?? Number.NaN, 3);
      break;
    default:
      break;
  }
  return tidy(fill(w.issues[issue.code], vars));
}

/** Where a problem is, for the results box: the group of the form it sits in. */
export function whereOf(row: CableRow | undefined, w: CableUi): string | null {
  return row ? w.where[row.group] : null;
}

export function warningSentence(warning: AnalysisWarning, w: CableUi, c: Ctx): string {
  const { num } = c;
  const vars: Record<string, string | number> = {};
  if (warning.leg !== undefined) vars.leg = warning.leg;
  if (warning.code === 'large-strain') vars.strain = `${num((warning.numbers?.[0] ?? 0) * 100, 3)} %`;
  if (warning.code === 'kinetic-above-static') {
    vars.muS = num(warning.numbers?.[0] ?? Number.NaN, 3);
    vars.muK = num(warning.numbers?.[1] ?? Number.NaN, 3);
  }
  return tidy(fill(w.warnings[warning.code], vars));
}

/** The name of a regime as a heading ("To start it moving"). */
export const regimeName = (id: PullRegimeId, w: CableUi): string => w.results.legend[id];

/** What happens in one regime, as sentences: one for the status and, for a load that slides, one for what holds it. */
export function regimeSentences(r: RegimeLine, w: CableUi, c: Ctx): string[] {
  const { num } = c;
  const unit = forceUnit(c);
  const s = w.results.status;
  const regime = regimeName(r.id, w);
  switch (r.status) {
    case 'pull':
      return [tidy(fill(s.pull, { regime, T: num(r.T ?? Number.NaN), N: num(r.N ?? Number.NaN), F: num(r.F ?? Number.NaN), unit }))];
    case 'slides-on-its-own':
      return [
        tidy(fill(s.slides, { regime })),
        r.hold ? tidy(fill(s.holds, { phi: num(c.form.pull.phi), T: num(r.hold.T), N: num(r.hold.N), unit })) : s.holdsNot,
      ];
    case 'stays-put':
      return [tidy(fill(s.stays, { regime }))];
    case 'self-locking':
      return [tidy(fill(s.locks, { regime }))];
    case 'leaves-surface':
      return [tidy(fill(s.leaves, { regime, T: num(r.rawT ?? Number.NaN), N: r.N === null ? '—' : signed(num(Math.abs(r.N)), r.N), unit })), ...(r.phiLift === null ? [] : [tidy(fill(s.leavesAt, { lift: num(r.phiLift) }))])];
  }
}

/* ── The drawings in words ─────────────────────────────────────────────── */

const lower = (text: string): string => text.toLocaleLowerCase();

export function slingSummary(a: CableAnalysis, w: CableUi, c: Ctx, drawnMove: boolean): string {
  const { num } = c;
  const unit = forceUnit(c);
  const load = a.load;
  const sling = a.drawing.sling;
  if (!load || !sling) return w.drawing.slingUnsolved;
  const d = w.drawing;
  const H = load.applied.H;
  const h = H === 0 ? '' : ` ${fill(d.slingH, { H: num(Math.abs(H)), unit, side: H > 0 ? w.words.right : w.words.left })}`;
  const legs =
    load.legs.length === 1
      ? fill(d.slingOne, { angle: num(load.legs[0].angle), side: lower(w.load.sides[load.legs[0].side === 'left' ? 'left' : 'right']), T: num(load.legs[0].T), unit })
      : load.legs.map((l) => fill(d.slingLeg, { leg: l.label, angle: num(l.angle), side: lower(w.load.sides[l.side]), T: num(l.T), unit })).join(' ');
  const m = load.move.exact ?? load.move.linear;
  const parts: string[] = [];
  const stretch = c.units.stretch;
  if (m.dy !== 0) parts.push(`${num(Math.abs(m.dy))} ${stretch} ${m.dy < 0 ? w.words.down : w.words.up}`);
  if (m.dx !== 0) parts.push(`${num(Math.abs(m.dx))} ${stretch} ${m.dx < 0 ? w.words.left : w.words.right}`);
  const move =
    parts.length === 0
      ? d.slingStill
      : drawnMove && sling.moveScale !== null
        ? fill(d.slingMove, { parts: parts.join(` ${w.words.and} `), scale: num(sling.moveScale, 3) })
        : fill(d.slingMovePlain, { parts: parts.join(` ${w.words.and} `) });
  return tidy(fill(d.sling, { W: num(load.applied.W), unit, h, legs, move }));
}

export function bodySummary(a: CableAnalysis, regime: RegimeLine | null, w: CableUi, c: Ctx): string {
  const { num } = c;
  const unit = forceUnit(c);
  if (!a.pull || !regime) return w.drawing.bodyUnsolved;
  const forces =
    regime.T !== null && regime.N !== null
      ? ` ${fill(w.drawing.bodyForces, { T: num(regime.T), N: num(regime.N), F: num(regime.F ?? 0), unit })}`
      : ` ${w.drawing.bodyNone}`;
  return tidy(fill(w.drawing.body, { regime: regimeName(regime.id, w), W: num(a.pull.W), unit, theta: num(a.pull.surface.theta), phi: num(a.pull.phi), forces }));
}

export function curveSummary(a: CableAnalysis, w: CableUi, c: Ctx): string {
  const { num } = c;
  const unit = forceUnit(c);
  if (!a.pull) return w.drawing.curveUnsolved;
  const curves = a.pull.curves
    .map((curve) => {
      const regime = regimeName(curve.regime, w);
      return curve.optimum ? fill(w.drawing.curveOne, { regime, T: num(curve.optimum.T), unit, at: num(curve.optimum.phi) }) : fill(w.drawing.curveNone, { regime });
    })
    .join(' ');
  return tidy(fill(w.drawing.curve, { curves, phi: num(a.pull.phi) }));
}

export function drumSummary(a: CableAnalysis, w: CableUi, c: Ctx): string {
  const { num } = c;
  const unit = forceUnit(c);
  const d = a.drum;
  if (!d) return w.drawing.drumUnsolved;
  return tidy(
    fill(w.drawing.drum, {
      wrap: num(d.betaDeg),
      turns: num(d.turns),
      turnWord: d.turns === 1 ? w.words.turn : w.words.turns,
      Tbig: num(d.Tbig),
      Tsmall: num(d.Tsmall),
      ratio: num(d.ratio),
      R: num(d.resultant.magnitude),
      unit,
    }),
  );
}

/* ── Which rope goes with which material ───────────────────────────────── */

/**
 * A rope type and a material belong together: a 6×19 wire rope is a wire rope's
 * modulus, not steel's. The form pairs them when one is chosen (the other
 * follows if it did not fit), because choosing "Wire rope" and leaving steel's
 * modulus in would under-state the stretch by more than half. A typed factor
 * (rope 'custom') or a typed modulus (material 'custom') fits anything.
 */
const FITS: Record<string, readonly string[]> = {
  solid: ['steel', 'stainless', 'aluminum', 'custom'],
  'rope-6x19': ['rope', 'rope-fibre', 'custom'],
  'rope-6x36': ['rope', 'rope-fibre', 'custom'],
  strand7: ['strand7', 'custom'],
  locked: ['rope-spiral', 'custom'],
  spiral: ['rope-spiral', 'custom'],
};
export const ropeFits = (rope: string, material: string): boolean => rope === 'custom' || (FITS[rope] ?? []).includes(material);

/** The material to set when a rope was chosen and the one in use does not fit it: the rope's usual one; null when nothing is to change. */
export function materialForRope(rope: string, material: string, usual: string): string | null {
  return ropeFits(rope, material) ? null : usual;
}
/** The rope to set when a material was chosen and the rope in use does not fit it: the material's usual one; null when nothing is to change. */
export function ropeForMaterial(material: string, rope: string, usual: string): string | null {
  return material === 'custom' || ropeFits(rope, material) ? null : usual;
}
