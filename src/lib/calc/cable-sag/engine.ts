import { argmin, bracketFrom, illinois } from './numerics';
import { lightAt, shapeAt } from './shape';
import {
  MAX_FACTOR_ROWS,
  MAX_POINT_LOADS,
  MAX_RISE_RATIO,
  MAX_SAG_RATIO,
  MAX_TABLE_ROWS,
  MIN_SAG_RATIO,
  PARABOLA_TOLERANCE,
  STRAIN_WARNING,
  type CableIssue,
  type CableShape,
  type CableWarning,
  type Difference,
  type Family,
  type HangingInput,
  type HangingOutcome,
  type Joint,
  type Known,
  type PointLoad,
  type PointsInput,
  type PointsOutcome,
  type Segment,
  type Setup,
  type StateInput,
  type StateLoads,
  type StateOutcome,
  type StateRow,
} from './types';

export { curveOf, shapeAt } from './shape';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CABLE SAG AND PRETENSION — the three solvers
 * ─────────────────────────────────────────────────────────────────────────────
 *   solveHanging(input)  a cable between two supports, one thing known
 *   solveState(input)    a change of state (load and temperature), with tables
 *   solvePoints(input)   a funicular cable under point loads
 *
 * None of them throws and none returns NaN or Infinity: a problem comes back as
 * `{ ok: false, issues }` with codes (types.ts lists every one with the numbers it
 * carries). The physics and the units are in types.ts; the integrals in shape.ts.
 *
 * TOLERANCES. The brackets are closed to 1e-14 of their root (numerics.ts). A
 * given sag, length or tension comes back to within 1e-11 of itself; the
 * sag → H → sag and length → sag → length round trips close to 1e-10 (engine.test.ts).
 *
 * THE RANGE. H is searched between 1e-4 and 1e9 times the load scale (q + w)·L: the
 * first is a mid-span sag of ~1,250 spans for a parabola, the second a sag of
 * ~1e-10 of the span. The known sag must lie in 1e-6 … 100 spans, so a solution
 * is always inside the search.
 */

/* ── Checking what is given ───────────────────────────────────────────── */

const BIG = 1e30;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= BIG;

function checkGeometry(L: number, h: number, out: CableIssue[]): void {
  if (!finite(L)) out.push({ code: 'number', field: 'L' });
  else if (!(L > 0)) out.push({ code: 'span', field: 'L' });
  if (!finite(h)) out.push({ code: 'number', field: 'h' });
  else if (finite(L) && L > 0 && Math.abs(h) > MAX_RISE_RATIO * L) out.push({ code: 'rise', ratio: Math.abs(h) / L, max: MAX_RISE_RATIO });
}

function checkLoads(loads: StateLoads, state: 1 | 2 | undefined, out: CableIssue[], zeroCode: 'load-zero' | 'state2-load-zero' = 'load-zero'): boolean {
  const before = out.length;
  if (!finite(loads.q) || loads.q < 0) out.push({ code: 'number', field: 'q', ...(state ? { state } : {}) });
  if (!finite(loads.w) || loads.w < 0) out.push({ code: 'number', field: 'w', ...(state ? { state } : {}) });
  if (out.length === before && loads.q + loads.w === 0) {
    out.push({ code: zeroCode, ...(state ? { state } : {}) });
    return false;
  }
  return out.length === before;
}

function checkEA(EA: number | null, out: CableIssue[]): void {
  if (EA !== null && (!finite(EA) || !(EA > 0))) out.push({ code: 'section', field: 'EA' });
}

function checkKnown(known: Known, L: number, out: CableIssue[]): void {
  const v = (known as { value?: unknown }).value;
  if (!finite(v) || !(v > 0)) {
    out.push({ code: 'known-value', field: (known as { kind?: string }).kind ?? 'known' });
    return;
  }
  if ((known.kind === 'sag-mid' || known.kind === 'sag-low') && finite(L) && L > 0) {
    const ratio = v / L;
    if (ratio < MIN_SAG_RATIO || ratio > MAX_SAG_RATIO) out.push({ code: 'sag-range', ratio, min: MIN_SAG_RATIO, max: MAX_SAG_RATIO, field: known.kind });
  }
}

const KINDS = ['H', 'sag-mid', 'sag-low', 'T-high', 'T-low', 'length'];

/* ── One cable, one known ─────────────────────────────────────────────── */

type Solved = { shape: CableShape; alternative: { H: number; sagMid: number } | null } | { issue: CableIssue };

/** Lower and upper end of the search for H, as multiples of the load scale. */
const H_LOW = 1e-4;
const H_HIGH = 1e9;

/**
 * A first guess of H for a given mid-span sag d (or a lowest-point sag): the parabola's qL²/8d for the load per
 * horizontal length plus the level catenary's w·a for the weight, a = L/2z with z = acosh(1 + 2(d/L)z) (a fixed point
 * that converges in a few steps, for any sag/span). Inclination is ignored: the walk after it finds the sign change.
 */
function guessFromSag(set: Setup, d: number): number {
  const r = d / set.L;
  let z = 1;
  for (let i = 0; i < 40; i++) z = Math.acosh(1 + 2 * r * z);
  return (set.q * set.L * set.L) / (8 * d) + (set.w * set.L) / (2 * z);
}

/** The same for an unstretched length s: the level catenary has s = 2a·sinh(c/2a) over the chord c, and the parabola's excess length is 8d²/3c. */
function guessFromLength(set: Setup, chord: number, s: number): number {
  const ratio = Math.max(s / chord, 1 + 1e-12);
  let lo = 1e-9;
  let hi = 700;
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    if (Math.sinh(mid) / mid < ratio) lo = mid;
    else hi = mid;
  }
  const z = 0.5 * (lo + hi);
  const d0 = Math.sqrt((3 * chord * Math.max(s - chord, 1e-12 * chord)) / 8);
  return (set.q * set.L * set.L) / (8 * d0) + (set.w * chord) / (2 * z);
}

/** The cable for a known quantity, or the problem. `state` tags the issue. */
export function solveKnown(set: Setup, known: Known, state?: 1 | 2, hint?: number): Solved {
  const tag = (issue: CableIssue): { issue: CableIssue } => ({ issue: state ? { ...issue, state } : issue });
  const chord = Math.hypot(set.L, set.h);
  const Hs = (set.q + set.w) * set.L;
  const xmin = Math.log(H_LOW * Hs);
  const xmax = Math.log(H_HIGH * Hs);
  const at = (x: number) => shapeAt(set, Math.exp(x));
  // From the first guess; if the cable cannot even be found there (an absurdly slack guess), from the middle of the range, then from its tight end.
  // `hint`: an H known to be near the answer (a neighbouring state of the same cable): the walk starts there, in small steps.
  const walk = (f: (x: number) => number, guess: number, increasing: boolean) =>
    (hint !== undefined && hint > 0 ? bracketFrom(f, Math.log(hint), 0.05, xmin, xmax, increasing) : null) ??
    bracketFrom(f, guess, 0.5, xmin, xmax, increasing) ??
    bracketFrom(f, 0.5 * (xmin + xmax), 0.5, xmin, xmax, increasing) ??
    bracketFrom(f, xmax - 1, 0.5, xmin, xmax, increasing);
  const done = (x: number): Solved => {
    const shape = at(x);
    return shape ? { shape, alternative: null } : tag({ code: 'solver', field: known.kind });
  };

  switch (known.kind) {
    case 'H': {
      const shape = shapeAt(set, known.value);
      return shape ? { shape, alternative: null } : tag({ code: 'solver', field: 'H' });
    }
    case 'sag-mid':
    case 'sag-low': {
      const d = known.value;
      const pick = known.kind === 'sag-mid' ? (s: CableShape) => s.sagMid : (s: CableShape) => s.sagLow;
      // A cable too slack to compute (absurdly deep) has a sag larger than any given: +∞, which keeps the sign of the walk.
      const f = (x: number): number => {
        const s = at(x);
        return s ? pick(s) - d : Number.POSITIVE_INFINITY;
      };
      const guess = known.kind === 'sag-mid' ? guessFromSag(set, d) : guessFromSag(set, d) * (set.h === 0 ? 1 : 1 / (1 + Math.abs(set.h) / (4 * d)));
      const br = walk(f, Math.log(guess), false);
      if (!br) return tag({ code: 'solver', field: known.kind });
      const x = br.a === br.b ? br.a : illinois(f, br.a, br.b, br.fa, br.fb, 1e-14, 140, 2e-15);
      return Number.isFinite(x) ? done(x) : tag({ code: 'solver', field: known.kind });
    }
    case 'length': {
      const target = known.value;
      if (set.EA === null && target <= chord * (1 + 1e-13)) return tag({ code: 'length-below-chord', chord, length: target });
      const f = (x: number): number => {
        const s = lightAt(set, Math.exp(x));
        return s ? s.unstretched - target : Number.POSITIVE_INFINITY;
      };
      const br = walk(f, Math.log(guessFromLength(set, chord, target)), false);
      if (!br) return tag(target < chord ? { code: 'length-below-chord', chord, length: target } : { code: 'solver', field: 'length' });
      const x = br.a === br.b ? br.a : illinois(f, br.a, br.b, br.fa, br.fb, 1e-14, 140, 2e-15);
      return Number.isFinite(x) ? done(x) : tag({ code: 'solver', field: 'length' });
    }
    case 'T-high':
    case 'T-low': {
      const target = known.value;
      const tOf = (x: number): number => {
        const s = lightAt(set, Math.exp(x));
        return s ? (known.kind === 'T-high' ? s.high : s.low) : Number.POSITIVE_INFINITY;
      };
      // The tension has a minimum in H (a very slack cable is also tight): the taut cable is on the right of it.
      // The slack end of the search is shorter for a tension: below 1e-2 of the load scale the cable is tens of spans deep.
      const xlow = Math.log(1e-2 * Hs);
      const xs = argmin(tOf, xlow, xmax);
      const tmin = tOf(xs);
      if (!Number.isFinite(tmin)) return tag({ code: 'solver', field: known.kind });
      if (target < tmin * (1 - 1e-12)) return tag({ code: 'tension-below-minimum', min: tmin, value: target });
      const f = (x: number) => tOf(x) - target;
      const fs = f(xs);
      let xr = xs;
      if (fs < 0) {
        const fb = f(xmax);
        if (!(fb > 0)) return tag({ code: 'known-value', field: known.kind });
        xr = illinois(f, xs, xmax, fs, fb, 1e-14, 140, 2e-15);
        if (!Number.isFinite(xr)) return tag({ code: 'solver', field: known.kind });
      }
      const shape = at(xr);
      if (!shape) return tag({ code: 'solver', field: known.kind });
      // The slack cable with the same tension, if there is one.
      let alternative: { H: number; sagMid: number } | null = null;
      if (fs < 0) {
        // On the slack side T falls as H grows; walk left from the minimum until it is above the target again.
        const left = bracketFrom(f, xs - 1e-6, 0.5, xlow, xs, false);
        if (left && left.fa * left.fb < 0) {
          const xa = illinois(f, left.a, left.b, left.fa, left.fb, 1e-14, 140, 2e-15);
          const other = Number.isFinite(xa) ? at(xa) : null;
          if (other) alternative = { H: other.H, sagMid: other.sagMid };
        }
      }
      return { shape, alternative };
    }
  }
  return tag({ code: 'known-value', field: 'known' });
}

const relative = (a: number, b: number): number => (b === 0 ? (a === 0 ? 0 : Number.POSITIVE_INFINITY) : (a - b) / b);

function differenceOf(parabolic: CableShape, exact: CableShape): Difference {
  const H = relative(parabolic.H, exact.H);
  const tension = relative(parabolic.tension.max, exact.tension.max);
  const sagMid = relative(parabolic.sagMid, exact.sagMid);
  return { H, tension, sagMid, length: relative(parabolic.length, exact.length), worst: Math.max(Math.abs(H), Math.abs(tension), Math.abs(sagMid)) };
}

const familyOf = (q: number, w: number): Family => (w === 0 ? 'parabola' : q === 0 ? 'catenary' : 'combined');

function shapeWarnings(shape: CableShape, state?: 1 | 2): CableWarning[] {
  const out: CableWarning[] = [];
  const tag = <T extends CableWarning>(w: T): T => (state ? { ...w, state } : w);
  if (shape.strain !== null && shape.strain > STRAIN_WARNING) out.push(tag({ code: 'strain-high', strain: shape.strain }));
  if (!shape.vertex.inside) out.push(tag({ code: 'vertex-outside', x: shape.vertex.x }));
  return out;
}

/* ── The hanging cable ────────────────────────────────────────────────── */

function allFinite(shape: CableShape): boolean {
  return [shape.H, shape.sagMid, shape.sagLow, shape.length, shape.unstretched, shape.tension.max].every(Number.isFinite);
}

export function solveHanging(input: HangingInput): HangingOutcome {
  try {
    return hanging(input);
  } catch {
    return { ok: false, issues: [{ code: 'solver' }] };
  }
}

function hanging(input: HangingInput): HangingOutcome {
  const issues: CableIssue[] = [];
  checkGeometry(input.L, input.h, issues);
  const loadsOk = checkLoads(input, undefined, issues);
  checkEA(input.EA, issues);
  if (!input.known || !KINDS.includes((input.known as { kind?: string }).kind ?? '')) issues.push({ code: 'known-value', field: 'known' });
  else checkKnown(input.known, input.L, issues);
  if (issues.length > 0 || !loadsOk) return { ok: false, issues };

  const set: Setup = { L: input.L, h: input.h, q: input.q, w: input.w, EA: input.EA };
  const chord = Math.hypot(set.L, set.h);
  const family = familyOf(set.q, set.w);
  const exact = solveKnown(set, input.known);
  if ('issue' in exact) return { ok: false, issues: [exact.issue] };
  if (!allFinite(exact.shape)) return { ok: false, issues: [{ code: 'size' }] };

  let parabolic: CableShape | null = exact.shape;
  let difference: Difference | null = null;
  if (family !== 'parabola') {
    const p = solveKnown({ ...set, q: set.q + set.w, w: 0 }, input.known);
    parabolic = 'shape' in p && allFinite(p.shape) ? p.shape : null;
    difference = parabolic ? differenceOf(parabolic, exact.shape) : null;
  }

  const warnings: CableWarning[] = [];
  if (difference && difference.worst > PARABOLA_TOLERANCE) warnings.push({ code: 'parabola-differs', difference: difference.worst, tolerance: PARABOLA_TOLERANCE, ratio: exact.shape.sagMid / set.L });
  warnings.push(...shapeWarnings(exact.shape));
  if (exact.alternative) warnings.push({ code: 'tension-two-roots', value: exact.alternative.H });
  return { ok: true, family, chord, exact: exact.shape, parabolic, difference, alternative: exact.alternative, warnings };
}

/* ── A change of state ────────────────────────────────────────────────── */

export function solveState(input: StateInput): StateOutcome {
  try {
    return changeOfState(input);
  } catch {
    return { ok: false, issues: [{ code: 'solver' }] };
  }
}

function rowOf(index: number, solved: Solved): StateRow {
  if ('issue' in solved) return { index, ok: false, code: solved.issue.code === 'length-below-chord' ? 'state2-too-short' : solved.issue.code };
  const s = solved.shape;
  return {
    index,
    ok: true,
    H: s.H,
    sagMid: s.sagMid,
    sagLow: s.sagLow,
    tensionMax: s.tension.max,
    tensionHigh: s.tension.high,
    tensionLow: s.tension.low,
    length: s.length,
    unstretched: s.unstretched,
  };
}

function changeOfState(input: StateInput): StateOutcome {
  const issues: CableIssue[] = [];
  checkGeometry(input.L, input.h, issues);
  checkLoads(input.state1, 1, issues);
  checkEA(input.EA, issues);
  const thermal = input.state2?.thermal;
  if (!finite(thermal)) issues.push({ code: 'thermal', value: typeof thermal === 'number' ? thermal : Number.NaN });
  else if (thermal <= -1) issues.push({ code: 'thermal', value: thermal });
  if (!input.state2 || !finite(input.state2.q) || input.state2.q < 0) issues.push({ code: 'number', field: 'q', state: 2 });
  if (!input.state2 || !finite(input.state2.w) || input.state2.w < 0) issues.push({ code: 'number', field: 'w', state: 2 });
  if (!input.known || !KINDS.includes((input.known as { kind?: string }).kind ?? '')) issues.push({ code: 'known-value', field: 'known', state: 1 });
  else checkKnown(input.known, input.L, issues);
  const sweep = input.sweep ?? {};
  if (sweep.thermal && sweep.thermal.length > MAX_TABLE_ROWS) issues.push({ code: 'table', field: 'thermal', count: sweep.thermal.length, max: MAX_TABLE_ROWS });
  if (sweep.loads && sweep.loads.length > MAX_FACTOR_ROWS) issues.push({ code: 'table', field: 'loads', count: sweep.loads.length, max: MAX_FACTOR_ROWS });
  if (issues.length > 0) return { ok: false, issues };

  const chord = Math.hypot(input.L, input.h);
  const base = { L: input.L, h: input.h, EA: input.EA };
  const set1: Setup = { ...base, q: input.state1.q, w: input.state1.w };
  const family = familyOf(set1.q, set1.w);
  const first = solveKnown(set1, input.known, 1);
  if ('issue' in first) return { ok: false, issues: [first.issue] };
  const s1 = first.shape;
  if (!allFinite(s1)) return { ok: false, issues: [{ code: 'size', state: 1 }] };

  const lu2 = s1.unstretched * (1 + thermal);
  if (input.state2.q + input.state2.w === 0) return { ok: false, issues: [{ code: 'state2-load-zero', state: 2, chord, length: lu2 }] };

  // State 2 for given loads and thermal strain: the cable whose unstressed length is the first one's, altered by the temperature.
  const stateTwo = (loads: StateLoads, strain: number, from: CableShape, hint?: number): Solved => {
    const target = from.unstretched * (1 + strain);
    const set: Setup = { ...base, q: loads.q, w: loads.w };
    if (set.EA === null && target <= chord * (1 + 1e-13)) return { issue: { code: 'state2-too-short', state: 2, chord, length: target } };
    const out = solveKnown(set, { kind: 'length', value: target }, 2, hint);
    if ('issue' in out && out.issue.code === 'length-below-chord') return { issue: { code: 'state2-too-short', state: 2, chord, length: target } };
    return out;
  };

  const sameLoads = input.state2.q === set1.q && input.state2.w === set1.w;
  const second: Solved = sameLoads && thermal === 0 ? { shape: s1, alternative: null } : stateTwo(input.state2, thermal, s1, s1.H);
  if ('issue' in second) return { ok: false, issues: [second.issue] };
  const s2 = second.shape;
  if (!allFinite(s2)) return { ok: false, issues: [{ code: 'size', state: 2 }] };

  // The same change with all the load per horizontal length.
  let parabolic: { state1: CableShape; state2: CableShape } | null = null;
  if (family !== 'parabola' || input.state2.w !== 0) {
    const p1 = solveKnown({ ...set1, q: set1.q + set1.w, w: 0 }, input.known, 1);
    if ('shape' in p1) {
      const p2 = sameLoads && thermal === 0 ? { shape: p1.shape, alternative: null } : stateTwo({ q: input.state2.q + input.state2.w, w: 0 }, thermal, p1.shape, s2.H);
      if ('shape' in p2 && allFinite(p1.shape) && allFinite(p2.shape)) parabolic = { state1: p1.shape, state2: p2.shape };
    }
  } else {
    parabolic = { state1: s1, state2: s2 };
  }

  const tables = {
    thermal: (sweep.thermal ?? []).map((strain, i) => (finite(strain) && strain > -1 ? rowOf(i, stateTwo(input.state2, strain, s1, s2.H)) : ({ index: i, ok: false, code: 'thermal' } as StateRow))),
    loads: (sweep.loads ?? []).map((loads, i) => {
      if (!loads || !finite(loads.q) || !finite(loads.w) || loads.q < 0 || loads.w < 0) return { index: i, ok: false, code: 'number' } as StateRow;
      if (loads.q + loads.w === 0) return { index: i, ok: false, code: 'state2-load-zero' } as StateRow;
      return rowOf(i, stateTwo(loads, thermal, s1, s2.H * ((loads.q + loads.w) / (input.state2.q + input.state2.w))));
    }),
  };

  const warnings: CableWarning[] = [];
  if (parabolic) {
    const d1 = differenceOf(parabolic.state1, s1);
    const d2 = differenceOf(parabolic.state2, s2);
    const worst = Math.max(d1.worst, d2.worst);
    if (family !== 'parabola' || input.state2.w !== 0) {
      if (worst > PARABOLA_TOLERANCE) warnings.push({ code: 'parabola-differs', difference: worst, tolerance: PARABOLA_TOLERANCE, ratio: Math.max(s1.sagMid, s2.sagMid) / input.L });
    }
  }
  warnings.push(...shapeWarnings(s1, 1));
  if (s2 !== s1) warnings.push(...shapeWarnings(s2, 2));
  if (first.alternative) warnings.push({ code: 'tension-two-roots', value: first.alternative.H, state: 1 });

  return { ok: true, family, chord, exact: { state1: s1, state2: s2 }, parabolic, ratioH: s2.H / s1.H, ratioLength: 1 + thermal, tables, warnings };
}

/* ── The funicular cable ──────────────────────────────────────────────── */

export function solvePoints(input: PointsInput): PointsOutcome {
  try {
    return points(input);
  } catch {
    return { ok: false, issues: [{ code: 'solver' }] };
  }
}

function points(input: PointsInput): PointsOutcome {
  const issues: CableIssue[] = [];
  checkGeometry(input.L, input.h, issues);
  const loads: PointLoad[] = Array.isArray(input.loads) ? input.loads : [];
  if (loads.length > MAX_POINT_LOADS) issues.push({ code: 'too-many-loads', count: loads.length, max: MAX_POINT_LOADS });
  const geometryOk = issues.length === 0;
  if (loads.length <= MAX_POINT_LOADS) {
    loads.forEach((l, i) => {
      if (!l || !finite(l.x) || !finite(l.P)) issues.push({ code: 'number', field: !l || !finite(l.x) ? 'x' : 'P', index: i });
      else if (geometryOk && !(l.x > 0 && l.x < input.L)) issues.push({ code: 'load-position', index: i, value: l.x });
    });
  }
  const k = input.known as { kind?: string; value?: unknown; x?: unknown } | undefined;
  if (!k || (k.kind !== 'sag' && k.kind !== 'H' && k.kind !== 'T-max')) issues.push({ code: 'known-value', field: 'known' });
  else if (!finite(k.value) || (k.kind === 'sag' ? k.value === 0 : !(k.value > 0))) issues.push({ code: 'known-value', field: k.kind });
  else if (k.kind === 'sag' && (!finite(k.x) || !(geometryOk ? k.x > 0 && k.x < input.L : true))) issues.push({ code: 'sag-position', value: typeof k.x === 'number' ? k.x : Number.NaN });
  if (issues.length > 0) return { ok: false, issues };

  const L = input.L;
  const h = input.h;
  const c = h / L;
  const sorted = loads.map((l, source) => ({ x: l.x, P: l.P, source })).sort((a, b) => a.x - b.x || a.source - b.source);
  for (let i = 1; i < sorted.length; i++) if (sorted[i].x === sorted[i - 1].x) issues.push({ code: 'duplicate-position', indices: [sorted[i - 1].source, sorted[i].source] });
  if (issues.length > 0) return { ok: false, issues };
  if (sorted.every((l) => l.P === 0)) return { ok: false, issues: [{ code: 'no-loads' }] };

  // The loads on a simple beam of span L: its left reaction, then its moment M0(x) and shear V0 on each segment.
  const RA0 = sorted.reduce((s, l) => s + (l.P * (L - l.x)) / L, 0);
  const M0 = (x: number): number => RA0 * x - sorted.reduce((s, l) => (l.x < x ? s + l.P * (x - l.x) : s), 0);
  const shear: number[] = [];
  let running = RA0;
  shear.push(running);
  for (const l of sorted) {
    running -= l.P;
    shear.push(running);
  }
  const scale = sorted.reduce((s, l) => s + Math.abs(l.P), 0);

  let H: number;
  const known = input.known;
  if (known.kind === 'H') {
    H = known.value;
  } else if (known.kind === 'sag') {
    const m = M0(known.x);
    if (Math.abs(m) <= 1e-13 * scale * L) return { ok: false, issues: [{ code: 'sag-position', value: known.x }] };
    H = m / known.value;
    if (!(H > 0)) return { ok: false, issues: [{ code: 'negative-tension', value: H }] };
  } else {
    // The largest tension: max over the segments of √(H² + (cH − V0)²), convex in H, so the taut cable is right of its minimum.
    const tmax = (Hh: number) => shear.reduce((m, v) => Math.max(m, Math.hypot(Hh, c * Hh - v)), 0);
    const f = (x: number) => tmax(Math.exp(x));
    const xlo = Math.log(1e-6 * scale);
    const xhi = Math.log(1e9 * scale);
    const xs = argmin(f, xlo, xhi);
    const tmin = f(xs);
    if (known.value < tmin * (1 - 1e-12)) return { ok: false, issues: [{ code: 'tension-below-minimum', min: tmin, value: known.value }] };
    const g = (x: number) => f(x) - known.value;
    const gs = g(xs);
    let xr = xs;
    if (gs < 0) {
      const gb = g(xhi);
      if (!(gb > 0)) return { ok: false, issues: [{ code: 'known-value', field: 'T-max' }] };
      xr = illinois(g, xs, xhi, gs, gb, 1e-14, 140, 2e-15);
    }
    H = Math.exp(xr);
  }
  if (!(H > 0) || !Number.isFinite(H)) return { ok: false, issues: [{ code: 'size' }] };

  const joints: Joint[] = [{ kind: 'A', source: -1, x: 0, z: 0, sag: 0, P: 0 }];
  for (const l of sorted) {
    const sag = M0(l.x) / H;
    joints.push({ kind: 'load', source: l.source, x: l.x, z: c * l.x - sag, sag, P: l.P });
  }
  joints.push({ kind: 'B', source: -1, x: L, z: h, sag: 0, P: 0 });

  const segments: Segment[] = [];
  let length = 0;
  for (let i = 0; i + 1 < joints.length; i++) {
    const a = joints[i];
    const b = joints[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    // Computed from the beam's shear, not from the ordinates' difference: no cancellation on a taut cable.
    const slope = c - shear[i] / H;
    const len = dx * Math.hypot(1, slope);
    length += len;
    segments.push({ from: i, to: i + 1, dx, dz, length: len, slope, angle: (Math.atan(slope) * 180) / Math.PI, tension: H * Math.hypot(1, slope), vertical: H * slope });
  }
  let top = 0;
  segments.forEach((s, i) => {
    if (s.tension > segments[top].tension) top = i;
  });
  let lowest = 0;
  joints.forEach((j, i) => {
    if (j.z < joints[lowest].z) lowest = i;
  });

  const reaction = { A: -H * segments[0].slope, B: H * segments[segments.length - 1].slope };
  const numbers = [H, length, reaction.A, reaction.B, ...joints.map((j) => j.z), ...segments.map((s) => s.tension)];
  if (!numbers.every(Number.isFinite)) return { ok: false, issues: [{ code: 'size' }] };

  const warnings: CableWarning[] = [];
  const up = sorted.filter((l) => l.P < 0).length;
  const zero = sorted.filter((l) => l.P === 0).length;
  if (up > 0) warnings.push({ code: 'upward-load', count: up });
  if (zero > 0) warnings.push({ code: 'zero-load', count: zero });
  if (known.kind === 'sag' && !sorted.some((l) => Math.abs(l.x - known.x) <= 1e-12 * L)) warnings.push({ code: 'sag-not-at-load', value: known.x });

  return {
    ok: true,
    chord: Math.hypot(L, h),
    H,
    joints,
    segments,
    length,
    reaction,
    tensionMax: { value: segments[top].tension, segment: top },
    lowest: { joint: lowest, z: joints[lowest].z },
    totalLoad: sorted.reduce((s, l) => s + l.P, 0),
    warnings,
  };
}
