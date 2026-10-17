import type { AnalysisIssue, AnalysisWarning, CableAnalysis, CableRow, RegimeLine } from '@/lib/calc/cable/analysis';
import type { CableForm, CableUnits } from '@/lib/calc/cable/model';
import type { CableUi } from '@/lib/calc/cable/strings';
import type { PullRegimeId, PullStatus, Travel } from '@/lib/calc/cable/types';

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
 * cannot print a -0, a NaN or an exponent of its own. The caller's `num` writes a
 * negative with the true minus (`trueMinus`): a sentence is read, not typed back.
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

/** A number as a sentence writes it: the true minus an engineer sets, where the formatter's own sign is a hyphen (the one a field reads back). */
export const trueMinus = (text: string): string => text.replace(/^-/, '−');

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
      // "0 10^−6/°F or more" reads as nothing: a lone bound of zero on a power-of-ten unit is just "0".
      const raw = unitText(rowUnit(issue.row, c, w));
      const unitless = raw.startsWith('10^') && !(hasMin && hasMax) && (issue.min === 0 || issue.max === 0);
      vars.bounds = fill(bounds, { min: hasMin ? num(issue.min as number) : '', max: hasMax ? num(issue.max as number) : '', unit: unitless ? '' : raw });
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
  if (warning.code === 'beyond-limit') {
    const found = warning.unknown ?? 'mu';
    vars.name = w.drum.names[found];
    vars.value = `${num(warning.numbers?.[0] ?? Number.NaN, 4)}${found === 'beta' ? (c.form.drum.wrapUnit === 'deg' ? '°' : ` ${w.words.turns}`) : ''}`;
    vars.max = `${num(warning.max ?? Number.NaN, 4)}${found === 'beta' ? (c.form.drum.wrapUnit === 'deg' ? '°' : ` ${w.words.turns}`) : ''}`;
  }
  return tidy(fill(w.warnings[warning.code], vars));
}

/* ── The cases of a pull, in words ─────────────────────────────────────── */

/** The name of a regime as a heading ("To start it moving"; a cable that holds the block back has its own: "To hold it from sliding"). */
export const regimeName = (id: PullRegimeId, w: CableUi, travel: Travel = 'along'): string => (travel === 'against' ? w.results.legend.against[id] : w.results.legend[id]);

/** The name of one regime, as a case: a cable that only RELEASES a block (it lifts it off its friction) starts its motion, so it goes by the words of a pull. */
export const regimeLabel = (r: Pick<RegimeLine, 'id' | 'role'>, w: CableUi, travel: Travel): string => regimeName(r.id, w, r.role === 'release' ? 'along' : travel);

/** The key of `statusWords` a regime's result is called by. */
export function statusKey(r: Pick<RegimeLine, 'status' | 'role'>): keyof CableUi['results']['statusWords'] {
  switch (r.status) {
    case 'pull':
      return r.role === 'restrain' ? 'holds' : r.role === 'release' ? 'releases' : 'pull';
    case 'slides-on-its-own':
      return 'slides';
    case 'no-pull-needed':
      return 'nopull';
    case 'stays-put':
      return 'stays';
    case 'self-locking':
      return 'locks';
    case 'cannot-hold':
      return 'cannot';
    case 'leaves-surface':
      return 'leaves';
  }
}

/** The key of the curve's `absent` and `empty` words that says why a case has no curve. */
export function absentKey(status: PullStatus): keyof CableUi['results']['curve']['absent'] {
  switch (status) {
    case 'slides-on-its-own':
      return 'slides';
    case 'no-pull-needed':
      return 'nopull';
    case 'stays-put':
      return 'stays';
    case 'cannot-hold':
      return 'cannot';
    case 'self-locking':
      return 'locks';
    case 'leaves-surface':
      return 'leaves';
    case 'pull':
      return 'none';
  }
}

/** What stops a curve at most of its angles: the status most of its 181 points have (a curve with no valid point is empty for that reason). */
export function curveReason(points: { status: PullStatus }[]): PullStatus {
  const count = new Map<PullStatus, number>();
  for (const p of points) count.set(p.status, (count.get(p.status) ?? 0) + 1);
  let best: PullStatus = 'pull';
  let top = -1;
  for (const [status, n] of count) {
    if (status !== 'pull' && n > top) {
      best = status;
      top = n;
    }
  }
  return best;
}

/** Why the chart has no curve at all: the one reason all the cases share, or the general one. */
export function emptyKey(reasons: PullStatus[]): keyof CableUi['results']['curve']['empty'] {
  const keys = new Set(reasons.map((r) => absentKey(r)));
  return keys.size === 1 ? [...keys][0] : 'none';
}

/** "at 30° above the surface", "at 20° below the surface", "along the surface": where the cable is, in the page's words. */
export function atAngle(phi: number, w: CableUi, num: Ctx['num']): string {
  if (phi === 0) return w.words.alongSurface;
  return fill(phi > 0 ? w.words.aboveSurface : w.words.belowSurface, { phi: num(Math.abs(phi)) });
}

/** What happens in one regime, as sentences: one for the status and, for a load that slides, one for what holds it. */
export function regimeSentences(r: RegimeLine, w: CableUi, c: Ctx): string[] {
  const { num } = c;
  const unit = forceUnit(c);
  const s = w.results.status;
  const travel = c.form.pull.travel;
  const regime = regimeLabel(r, w, travel);
  const at = atAngle(c.form.pull.phi, w, num);
  switch (r.status) {
    case 'pull': {
      const text = r.role === 'restrain' ? s.restrain : r.role === 'release' ? s.release : s.pull;
      return [tidy(fill(text, { regime, T: num(r.T ?? Number.NaN), N: num(r.N ?? Number.NaN), F: num(r.F ?? Number.NaN), unit }))];
    }
    case 'slides-on-its-own':
      return [tidy(fill(s.slides, { regime })), r.hold ? tidy(fill(s.holds, { at, T: num(r.hold.T), N: num(r.hold.N), unit })) : s.holdsNot];
    case 'no-pull-needed':
      return [tidy(fill(travel === 'against' ? s.nohold : s.nopull, { regime }))];
    case 'stays-put':
      return [tidy(fill(s.stays, { regime }))];
    case 'self-locking':
      return [tidy(fill(s.locks, { regime }))];
    case 'cannot-hold':
      return [tidy(fill(s.cannot, { regime }))];
    case 'leaves-surface':
      return [tidy(fill(s.leaves, { regime, T: num(r.rawT ?? Number.NaN), N: r.N === null ? '—' : signed(num(Math.abs(r.N)), r.N), unit })), ...(r.phiLift === null ? [] : [tidy(fill(s.leavesAt, { lift: num(r.phiLift) }))])];
  }
}

/* ── The drawings in words ─────────────────────────────────────────────── */

const lower = (text: string): string => text.toLocaleLowerCase();

/** How the move of a sling is drawn: to scale (a factor of 1), or this many times larger. */
export const drawnToScale = (factor: number | null, num: Ctx['num']): boolean => factor === null || num(factor, 3) === '1';

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
      ? load.legs[0].angle === 90
        ? fill(d.slingVertical, { T: num(load.legs[0].T), unit })
        : fill(d.slingOne, { angle: num(load.legs[0].angle), side: lower(w.load.sides[load.legs[0].side === 'left' ? 'left' : 'right']), T: num(load.legs[0].T), unit })
      : load.legs.map((l) => fill(d.slingLeg, { leg: l.label, angle: num(l.angle), side: lower(w.load.sides[l.side]), T: num(l.T), unit })).join(' ');
  const parts = moveParts(a, w, c);
  const move =
    parts.length === 0
      ? d.slingStill
      : drawnMove && sling.moveScale !== null
        ? drawnToScale(sling.moveScale, num)
          ? fill(d.slingMoveTrue, { parts: parts.join(` ${w.words.and} `) })
          : fill(d.slingMove, { parts: parts.join(` ${w.words.and} `), scale: num(sling.moveScale, 3) })
        : fill(d.slingMovePlain, { parts: parts.join(` ${w.words.and} `) });
  return tidy(fill(d.sling, { W: num(load.applied.W), unit, h, legs, move }));
}

export function bodySummary(a: CableAnalysis, regime: RegimeLine | null, w: CableUi, c: Ctx): string {
  const { num } = c;
  const unit = forceUnit(c);
  if (!a.pull || !regime) return w.drawing.bodyUnsolved;
  const arrow = (id: 'T' | 'N' | 'F') => regime.arrows.find((x) => x.id === id)?.magnitude ?? 0;
  const forces =
    regime.holdDrawn && regime.hold
      ? ` ${fill(w.drawing.bodyHold, { T: num(regime.hold.T), N: num(regime.hold.N), F: num(arrow('F')), unit })}`
      : regime.T !== null && regime.N !== null
        ? ` ${fill(w.drawing.bodyForces, { T: num(regime.T), N: num(regime.N), F: num(regime.F ?? 0), unit })}`
        : regime.status === 'no-pull-needed' && regime.N !== null
          ? ` ${fill(w.drawing.bodyFree, { N: num(regime.N), F: num(regime.F ?? 0), unit })}`
          : ` ${w.drawing.bodyNone}`;
  return tidy(
    fill(w.drawing.body, { regime: lower(regimeLabel(regime, w, a.pull.travel)), W: num(a.pull.W), unit, theta: num(a.pull.surface.theta), at: atAngle(a.pull.phi, w, num), forces }),
  );
}

const lowerFirst = (t: string): string => t.charAt(0).toLocaleLowerCase() + t.slice(1);

export function curveSummary(a: CableAnalysis, w: CableUi, c: Ctx): string {
  const { num } = c;
  const unit = forceUnit(c);
  const P = a.pull;
  if (!P) return w.drawing.curveUnsolved;
  const curves = P.curves
    .map((curve) => {
      const regime = regimeLabel(P.regimes.find((x) => x.id === curve.regime) as RegimeLine, w, P.travel);
      if (!curve.optimum) return fill(w.drawing.curveNone, { regime });
      return fill(curve.optimum.atLiftOff ? w.drawing.curveOneLift : w.drawing.curveOne, { regime, T: num(curve.optimum.T), unit, at: num(curve.optimum.phi) });
    })
    .join(' ');
  const here = P.regimes.filter((x) => x.T !== null).map((x) => fill(w.reading.curve.item, { regime: lowerFirst(regimeLabel(x, w, P.travel)), T: num(x.T as number), unit }));
  return tidy(fill(w.drawing.curve, { curves, phi: num(P.phi), here: here.length ? fill(w.drawing.curveHere, { list: here.join('; ') }) : '' }));
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
      turnWord: turnWord(d.turns, w, num),
      Tbig: num(d.Tbig),
      Tsmall: num(d.Tsmall),
      ratio: num(d.ratio),
      R: num(d.resultant.magnitude),
      unit,
    }),
  );
}

/** "turn" or "turns", as the number reads once it is written: 1.000125 turns is written "1" and is "1 turn". */
export function turnWord(turns: number, w: CableUi, num: Ctx['num']): string {
  return num(turns) === '1' ? w.words.turn : w.words.turns;
}

/* ── One plain sentence under each drawing ─────────────────────────────── */

/** "0.1124 in down and 0.02 in to the right": where the load point goes, in the words of the page. */
function moveParts(a: CableAnalysis, w: CableUi, c: Ctx): string[] {
  const load = a.load;
  if (!load) return [];
  const m = load.move.exact ?? load.move.linear;
  const parts: string[] = [];
  if (m.dy !== 0) parts.push(`${c.num(Math.abs(m.dy))} ${c.units.stretch} ${m.dy < 0 ? w.words.down : w.words.up}`);
  if (m.dx !== 0) parts.push(`${c.num(Math.abs(m.dx))} ${c.units.stretch} ${m.dx < 0 ? w.words.left : w.words.right}`);
  return parts;
}

export function slingReading(a: CableAnalysis, w: CableUi, c: Ctx, drawnMove: boolean): string {
  const load = a.load;
  const sling = a.drawing.sling;
  if (!load || !sling) return '';
  const r = w.reading.sling;
  const unit = forceUnit(c);
  const legs = load.legs;
  const two = legs.length === 2;
  const pulls =
    legs.length === 1
      ? fill(r.one, { T: c.num(legs[0].T), unit })
      : fill(r.legs, {
          tensions: c.num(legs[0].T) === c.num(legs[1].T) ? fill(r.same, { T: c.num(legs[0].T), unit }) : fill(r.differ, { T1: c.num(legs[0].T), T2: c.num(legs[1].T), unit }),
        });
  const parts = moveParts(a, w, c);
  const joined = parts.join(` ${w.words.and} `);
  const scaled = drawnMove && sling.moveScale !== null;
  const true1 = scaled && drawnToScale(sling.moveScale, c.num);
  const move =
    parts.length === 0
      ? r.still
      : true1
        ? fill(two ? r.moveTrueLegs : r.moveTrue, { parts: joined })
        : scaled
          ? fill(two ? r.moveLegs : r.move, { parts: joined, scale: c.num(sling.moveScale as number, 3) })
          : fill(two ? r.movePlainLegs : r.movePlain, { parts: joined });
  return tidy(`${pulls} ${move}`);
}

export function bodyReading(a: CableAnalysis, regime: RegimeLine | null, w: CableUi, c: Ctx): string {
  if (!a.pull || !regime) return '';
  if (regime.status !== 'pull' || regime.T === null || regime.N === null) return regimeSentences(regime, w, c).join(' ');
  const body = w.reading.body;
  const text = regime.role === 'restrain' ? body.hold[regime.id] : regime.role === 'release' ? body.hold.release : body[regime.id];
  return tidy(fill(text, { T: c.num(regime.T), at: atAngle(a.pull.phi, w, c.num), N: c.num(regime.N), F: c.num(regime.F ?? 0), unit: forceUnit(c) }));
}

export function curveReading(a: CableAnalysis, w: CableUi, c: Ctx): string {
  const P = a.pull;
  if (!P) return '';
  const r = w.reading.curve;
  const unit = forceUnit(c);
  const joined = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} ${w.words.and} ${items[items.length - 1]}`);
  const drawn = P.curves.filter((x) => x.maxValid !== null);
  if (drawn.length === 0) return tidy(r.none);
  const head = fill(r.head, { list: joined(drawn.map((x) => (P.travel === 'against' && !P.regimes.some((q) => q.id === x.regime && q.role === 'release') ? r.hold[x.regime] : r[x.regime]))) });
  const nameOf = (id: PullRegimeId) => lowerFirst(regimeLabel(P.regimes.find((q) => q.id === id) as RegimeLine, w, P.travel));
  const least = drawn
    .filter((x) => x.optimum)
    .map((x) => fill(r.itemAt, { regime: `${nameOf(x.regime)}${x.optimum!.atLiftOff ? `, ${r.leastLift}` : ''}`, T: c.num(x.optimum!.T), phi: c.num(x.optimum!.phi), unit }));
  const at = P.regimes.filter((x) => x.T !== null).map((x) => fill(r.item, { regime: nameOf(x.id), T: c.num(x.T as number), unit }));
  // The angle at which the block would lift off, once for each distinct one.
  const lifts: { phi: string; regimes: PullRegimeId[] }[] = [];
  for (const x of P.regimes) {
    if (x.phiLift === null || x.phiLift > 90 || x.phiLift <= -90) continue;
    if (!drawn.some((d) => d.regime === x.id)) continue;
    const phi = c.num(x.phiLift);
    const found = lifts.find((l) => l.phi === phi);
    if (found) found.regimes.push(x.id);
    else lifts.push({ phi, regimes: [x.id] });
  }
  const liftText = lifts.length
    ? fill(r.lift, { list: joined(lifts.map((l) => (lifts.length > 1 ? `${l.phi}° (${nameOf(l.regimes[0])})` : `${l.phi}°`))) })
    : '';
  return tidy([head, least.length ? fill(r.least, { list: least.join('; ') }) : '', at.length ? fill(r.at, { phi: c.num(P.phi), list: at.join('; ') }) : '', liftText].filter(Boolean).join(' '));
}

/** What a wrap is called in a sentence: the turns when the page was given turns, the degrees otherwise. */
export function wrapWords(a: CableAnalysis, w: CableUi, c: Ctx): string {
  const d = a.drum;
  if (!d) return '';
  return c.form.drum.wrapUnit === 'turns' ? `${c.num(d.turns)} ${turnWord(d.turns, w, c.num)}` : `${c.num(d.betaDeg)}°`;
}

export function drumReading(a: CableAnalysis, w: CableUi, c: Ctx): string {
  const d = a.drum;
  if (!d) return '';
  const r = w.reading.drum;
  const unit = forceUnit(c);
  const held = fill(r.held, { Ts: c.num(d.Tsmall), unit });
  if (d.ratio === 1 || c.num(d.ratio) === '1') return tidy(fill(r.equal, { Ts: c.num(d.Tsmall), unit }));
  return tidy(`${held} ${fill(r.gain, { wrap: wrapWords(a, w, c), mu: c.num(d.mu, 3), ratio: c.num(d.ratio), Tb: c.num(d.Tbig), unit })}`);
}

/* ── Which rope goes with which material ───────────────────────────────── */

/**
 * A rope type and a material belong together: a 6×19 wire rope is a wire rope's
 * modulus, not steel's. The form pairs them when one is chosen (the other
 * follows if it did not fit), because choosing "Wire rope" and leaving steel's
 * modulus in would under-state the stretch by about half or more; the page SAYS
 * when it did so (`section.pairedMaterial`, `section.pairedRope`). A typed factor
 * (rope 'custom') or a typed modulus (material 'custom') fits anything.
 */
const FITS: Record<string, readonly string[]> = {
  solid: ['steel', 'stainless', 'aluminum', 'custom'],
  'rope-6x19': ['rope', 'rope-fibre', 'custom'],
  'rope-6x36': ['rope', 'rope-fibre', 'custom'],
  strand7: ['strand7', 'custom'],
  locked: ['rope-locked', 'custom'],
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
