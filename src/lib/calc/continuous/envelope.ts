import type { BeamState, Side } from '../beam/solver';
import { cellsIn, placedLoads, polyAt, polyRoots, solveCase, stretchOf, type ContinuousCase } from './engine';
import type { ContinuousEnvelope, ContinuousModel, EnvelopeJoint, EnvelopeOutcome, EnvelopeSpan, EnvelopeState, Governing } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTINUOUS BEAM — every arrangement of the live load
 * ─────────────────────────────────────────────────────────────────────────────
 * The live load of each span may be on or off whatever the others are: 2ⁿ
 * arrangements for n spans that carry one. None of them is solved here.
 *
 * THE METHOD. The beam is linear, so an arrangement is a sum: what is
 * always there (the loads not marked live, and the settlements — the
 * `base`) plus, for each span whose live load is on, what that span's live
 * load does alone. So the engine is asked n + 1 times: the base, and each
 * span's live load by itself. At a point the highest value of a response is
 * then the base's value plus every span's effect that is positive THERE,
 * and the lowest the base's plus every one that is negative — the best of
 * all 2ⁿ, exactly, at the price of n + 1.
 *
 * THE LARGEST VALUES ARE EXACT TOO, not the best of the stations. Which
 * spans count changes only where some span's effect changes sign. Between
 * two such places (and two places where something happens on the beam) the
 * edge of the band is ONE arrangement, one polynomial: its largest value is
 * at an end of that stretch or where its derivative changes sign — found as
 * the engine finds any (`stretchOf`, `polyRoots`), and then READ by the
 * engine's own formulas, case by case, like any other point. The places
 * where an effect changes sign are corners of the band's edge, and are
 * among the stations.
 *
 * WHAT COUNTS AS AN EFFECT. A span's live load that does nothing at a point
 * is not part of the arrangement named there: a load standing on a support
 * bends nothing, a load does not move a support. Most of those zeros are
 * exact in the engine; one that is rounding is taken as the zero it is, and
 * is neither added nor named — rounding being measured WHERE THE EFFECT IS:
 * against the largest value that live load causes in the span the point is
 * in (at a joint, in the two spans that meet there), which is what the
 * engine's own figures there are good to (within 5e-13 of it, measured
 * against an exact solver on beams whose stiffness factors are a million
 * times apart).
 *
 * Not against the largest value the load causes anywhere, as this file first
 * had it. A span a million times stiffer than the loaded one deflects a
 * million-millionth as much, and that is its deflection, known to every
 * figure: left out, the largest deflection of such a span came back as
 * −3.87e-6 for +5.56e-6, with the wrong arrangement named (six spans, their
 * stiffness factors 0.001 and 1,000 in turn).
 *
 * WHERE THE LOADS ARE. Every case reads the beam by position (`at`), so
 * every case must have its loads where the others have theirs: the cases
 * are solved on the loads as the engine places them (`placedLoads`: two
 * places a position cannot tell apart are one), not as they were entered.
 *
 * MEASURED against every arrangement, each solved in exact fractions by
 * another method (the force method: engine.ts says how). On 4,900 random
 * beams and 7,300 of a lattice — 304,000 arrangements, 166,000 of them on
 * 716 beams of eight spans with a live load on each —:
 *   — the two edges of each band, at every station and on both sides of
 *     every place where something happens, are within 2e-12 of the band's
 *     largest value; so is every largest value, every reaction and every
 *     moment over a support. (Where a band is all but nothing — under a
 *     millionth of load × length — within 4e-16 of load × length.)
 *   — each of 766,000 values with an arrangement to its name is the value
 *     that arrangement gives, solved again from nothing;
 *   — no span is named whose effect is zero or of the other sign, and none
 *     is left out that adds more than 1e-12 of the largest value of the
 *     span it is in.
 */

/** The four responses that are followed: shear, moment, deflection, and deflection from the span's own supports. */
type Response = 'V' | 'M' | 'Y' | 'C';
const RESPONSES: Response[] = ['V', 'M', 'Y', 'C'];

/** One case of loading, solved, with what is rounding for each of its responses: in each span, and at each joint. */
interface Case {
  solution: ContinuousCase;
  zero: Record<Response, number>[];
  zeroAt: Record<'Rv' | 'M', number>[];
}

/** A place where an edge of the band may be largest: found on the polynomials, to be read by the engine. */
interface Spot {
  value: number;
  x: number;
  side: Side;
}

/* Under this share of the largest value a live load causes in a span, what it does at a point of that span is
   rounding. */
const ROUNDING = 1e-12;
const settle = (value: number, zero: number) => (Math.abs(value) <= zero ? 0 : value);

export function envelopeContinuous(model: ContinuousModel): EnvelopeOutcome {
  // Every live load on: the arrangement a page shows first, and the one that says what is wrong with the model.
  const all = solveCase(model);
  if (!all.ok) return all;

  /* ── The cases ─────────────────────────────────────────────────────── */
  // The loads at their places, as the engine has them: each case is some of them, where they are in the whole.
  const { points, dists } = placedLoads(model);
  const geometry = { spans: model.spans, left: model.left, right: model.right };
  /** The spans that carry a live load that is one, ascending. */
  const liveSpans = [...new Set([...points.filter((p) => p.live && p.P !== 0).map((p) => p.span), ...dists.filter((d) => d.live && (d.w1 !== 0 || d.w2 !== 0)).map((d) => d.span)])].sort((p, q) => p - q);
  const solved = [
    solveCase({ ...geometry, settlements: model.settlements, points: points.filter((p) => !p.live), dists: dists.filter((d) => !d.live) }),
    ...liveSpans.map((span) => solveCase({ ...geometry, points: points.filter((p) => p.live && p.span === span), dists: dists.filter((d) => d.live && d.span === span) })),
  ];
  // The whole model was taken, so its parts are: the same spans, some of the same loads. Should one of them
  // still be too much for the arithmetic, it is the spans that are named, and they are the model's own.
  const cases: Case[] = [];
  for (const solution of solved) {
    if (!solution.ok) return solution;
    const top = (...v: number[]) => ROUNDING * Math.max(0, ...v.map(Math.abs));
    // In a span: against the largest of the response in it. (A live load settles no support: the deflection of
    // a span under one IS its deflection from its own supports.)
    const zero = solution.spans.map((p) => ({ V: top(p.Vmax.value, p.Vmin.value), M: top(p.Mmax.value, p.Mmin.value), Y: top(p.EIvChord.value), C: top(p.EIvChord.value) }));
    // At a joint: against the two spans that meet there — and, for the reaction, against itself: a load
    // standing on the support is in nothing else.
    let support = 0;
    const zeroAt = solution.joints.map((joint, j) => {
      const beside = zero.slice(Math.max(0, j - 1), j + 1);
      const Rv = joint.support ? solution.reactions[support++].Rv : 0;
      return { Rv: Math.max(top(Rv), ...beside.map((z) => z.V)), M: Math.max(0, ...beside.map((z) => z.M)) };
    });
    cases.push({ solution, zero, zeroAt });
  }
  const [base, ...lives] = cases;

  /** The response asked for, of one case at one point of span `index`. */
  const valueOf = (c: Case, r: Response, index: number, x: number, side: Side): number => {
    if (r === 'C') return c.solution.fromSupports(index, x, side).EIv;
    const s = c.solution.at(x, side);
    return r === 'V' ? s.V : r === 'M' ? s.M : s.EIv;
  };
  /** The base's value and every live span's effect that has the sign asked for: the value, and the arrangement that gives it. */
  const govern = (ofBase: number, effects: number[], x: number, sign: 1 | -1): Governing => {
    let value = ofBase;
    const on: number[] = [];
    effects.forEach((effect, k) => {
      if (sign * effect <= 0) return;
      value += effect;
      on.push(liveSpans[k]);
    });
    return { value: value + 0, x, spans: on };
  };
  const governAt = (spot: Spot, r: Response, index: number, sign: 1 | -1): Governing =>
    govern(
      valueOf(base, r, index, spot.x, spot.side),
      lives.map((c) => settle(valueOf(c, r, index, spot.x, spot.side), c.zero[index][r])),
      spot.x,
      sign,
    );

  const at = (x: number, side?: Side): EnvelopeState => {
    const index = all.spanOf(x, side);
    const b = base.solution.at(x, side);
    const state: EnvelopeState = { x: b.x, V: { max: b.V, min: b.V }, M: { max: b.M, min: b.M }, EIv: { max: b.EIv, min: b.EIv } };
    for (const c of lives) {
      const s: BeamState = c.solution.at(x, side);
      const add = (range: { max: number; min: number }, effect: number) => {
        if (effect > 0) range.max += effect;
        else if (effect < 0) range.min += effect;
      };
      add(state.V, settle(s.V, c.zero[index].V));
      add(state.M, settle(s.M, c.zero[index].M));
      add(state.EIv, settle(s.EIv, c.zero[index].Y));
    }
    return state;
  };

  /* ── Span by span, stretch by stretch ──────────────────────────────── */
  const breaks = all.breaks;
  const stations: EnvelopeState[] = [];
  /** For each span and each response: where its upper edge is highest and its lower edge lowest. */
  const found: Record<Response, { hi: Spot | null; lo: Spot | null }>[] = all.spans.map(() => ({ V: { hi: null, lo: null }, M: { hi: null, lo: null }, Y: { hi: null, lo: null }, C: { hi: null, lo: null } }));
  all.spans.forEach((span, index) => {
    const k = model.spans[index].k;
    const first = breaks.indexOf(span.from);
    const last = breaks.indexOf(span.to);
    for (let m = first; m < last; m++) {
      const p = breaks[m];
      const q = breaks[m + 1];
      const h = q - p;
      // Each case on this stretch, as the polynomials it is: the response, and what its slope is a multiple of.
      const polys = cases.map((c) => {
        const start = c.solution.at(p, 'right');
        const own = c.solution.fromSupports(index, p, 'right');
        const st = stretchOf(start, c.solution.at(q, 'left').w, h, k);
        // From its own supports the deflection is the same polynomial less a straight line: its first two coefficients.
        const ownT = [own.EItheta, ...st.T.slice(1)];
        const of: Record<Response, [number[], number[]]> = { V: [st.V, st.w], M: [st.M, st.V], Y: [st.Y, st.T], C: [[own.EIv, h * own.EItheta, ...st.Y.slice(2)], ownT] };
        return of;
      });
      const [basePolys, ...livePolys] = polys;
      // A point of the stretch, read on the side that is inside it: one that lands on an end of the stretch
      // (a root a rounding short of it) must not be read past a load or a support there.
      const place = (u: number): { x: number; side: Side } => ({ x: u === 1 ? q : p + u * h, side: u < 0.5 ? 'right' : 'left' });
      /** Where along the stretch each edge has a corner: a live span's effect changes sign. */
      const corners = {} as Record<Response, number[]>;
      for (const r of RESPONSES) {
        corners[r] = [...new Set(livePolys.flatMap((c) => polyRoots(c[r][0])))].filter((u) => u > 0 && u < 1).sort((a, b) => a - b);
        const cuts = [0, ...corners[r], 1];
        for (let i = 0; i < cuts.length - 1; i++) {
          const ua = cuts[i];
          const ub = cuts[i + 1];
          const mid = (ua + ub) / 2;
          // Between two corners the spans that count are the same all along: read in the middle.
          const signs = livePolys.map((c, n) => Math.sign(settle(polyAt(c[r][0], mid), lives[n].zero[index][r])));
          for (const sign of [1, -1] as const) {
            // This edge here is one arrangement: the base and the spans of that sign.
            const edge = basePolys[r][0].slice();
            const slope = basePolys[r][1].slice();
            livePolys.forEach((c, n) => {
              if (signs[n] !== sign) return;
              c[r][0].forEach((v, j) => (edge[j] += v));
              c[r][1].forEach((v, j) => (slope[j] += v));
            });
            for (const u of [ua, ...polyRoots(slope, ua, ub), ub]) {
              const spot: Spot = { value: polyAt(edge, u), ...place(u) };
              const best = found[index][r];
              if (sign === 1 ? best.hi === null || spot.value > best.hi.value : best.lo === null || spot.value < best.lo.value) best[sign === 1 ? 'hi' : 'lo'] = spot;
            }
          }
        }
      }
      // Stations: the engine's own grid — the same places, so that with no live load they are the solution's
      // stations — and every corner of the three bands that are drawn. (A corner a rounding from an end of the
      // stretch is that end, which has its station.)
      const cells = cellsIn(h / all.L);
      const grid = Array.from({ length: cells - 1 }, (_, j) => p + (h * (j + 1)) / cells);
      const bends = [...corners.V, ...corners.M, ...corners.Y].map((u) => p + u * h).filter((x) => x > p && x < q && !grid.includes(x));
      stations.push(at(p, 'right'));
      for (const x of [...grid, ...new Set(bends)].sort((a, b) => a - b)) stations.push(at(x, x - p < q - x ? 'right' : 'left'));
      stations.push(at(q, 'left'));
    }
  });
  const finite = (r: { max: number; min: number }) => Number.isFinite(r.max) && Number.isFinite(r.min);
  // Each case is made of numbers; their sum, at the engine's limits, may not be. As there: no solution, and it is the length that took it there.
  if (!stations.every((s) => Number.isFinite(s.x) && finite(s.V) && finite(s.M) && finite(s.EIv))) return { ok: false, issues: [{ code: 'length' }] };

  /* ── What a page asks of it ────────────────────────────────────────── */
  /** Every span has both, once a stretch of it has been walked. */
  const governing = (index: number, r: Response, sign: 1 | -1): Governing => governAt(found[index][r][sign === 1 ? 'hi' : 'lo'] as Spot, r, index, sign);
  const spans: EnvelopeSpan[] = all.spans.map((span, index) => {
    const up = governing(index, 'C', 1);
    const down = governing(index, 'C', -1);
    const chord = Math.abs(down.value) > Math.abs(up.value) ? down : up;
    return {
      index,
      from: span.from,
      to: span.to,
      kind: span.kind,
      Mmax: governing(index, 'M', 1),
      Mmin: governing(index, 'M', -1),
      Vmax: governing(index, 'V', 1),
      Vmin: governing(index, 'V', -1),
      // As in a solution: a span that does not bend deflects nowhere, at its start by convention.
      EIvChord: chord.value === 0 ? { value: 0, x: span.from, spans: [] } : chord,
    };
  });
  /** The best of the spans' own: the first of them, among equals. */
  const overall = (of: (index: number) => Governing, sign: 1 | -1): Governing => {
    let best = of(0);
    for (let index = 1; index < all.spans.length; index++) {
      const g = of(index);
      if (sign * g.value > sign * best.value) best = g;
    }
    return best;
  };

  /** The reaction of each joint in one case: by its place among the joints, not among the supports. */
  const reactionOf = (c: Case, j: number) => c.solution.reactions[all.joints.slice(0, j).filter((joint) => joint.support !== null).length];
  const joints: EnvelopeJoint[] = all.joints.map((joint, j) => {
    const both = (of: (c: Case) => number, zero: 'Rv' | 'M') => {
      const effects = lives.map((c) => settle(of(c), c.zeroAt[j][zero]));
      return { max: govern(of(base), effects, joint.x, 1), min: govern(of(base), effects, joint.x, -1) };
    };
    /** Where there is nothing to have: no support, or one that holds no moment. */
    const none = () => ({ max: { value: 0, x: joint.x, spans: [] }, min: { value: 0, x: joint.x, spans: [] } });
    return {
      x: joint.x,
      support: joint.support,
      Rv: joint.support ? both((c) => reactionOf(c, j).Rv, 'Rv') : none(),
      Rm: joint.support === 'fixed' ? both((c) => reactionOf(c, j).Rm, 'M') : none(),
      M: both((c) => c.solution.joints[j].M, 'M'),
    };
  });

  const envelope: ContinuousEnvelope = {
    ok: true,
    L: all.L,
    breaks,
    at,
    stations,
    extremes: {
      Vmax: overall((i) => spans[i].Vmax, 1),
      Vmin: overall((i) => spans[i].Vmin, -1),
      Mmax: overall((i) => spans[i].Mmax, 1),
      Mmin: overall((i) => spans[i].Mmin, -1),
      EIvMax: overall((i) => governing(i, 'Y', 1), 1),
      EIvMin: overall((i) => governing(i, 'Y', -1), -1),
    },
    joints,
    spans,
    all,
  };
  return envelope;
}
