import { describe, expect, it } from 'vitest';
import { solveCase, solveContinuous, type ContinuousCase } from './engine';
import { envelopeContinuous } from './envelope';
import type { ContinuousEnvelope, ContinuousModel, EndKind, Governing } from './types';

/**
 * EVERY ARRANGEMENT OF THE LIVE LOAD, against every arrangement.
 *
 * envelope.ts solves n + 1 cases and says what the 2ⁿ arrangements would.
 * Here they are solved, all of them, each in full by the engine, and the
 * envelope is held to the best of them: at every station and on both sides
 * of it, for every largest value, every support and every span — and the
 * arrangement it names is solved once more, to see that it gives the value
 * it is named for.
 *
 * Before that, the patterns every engineer knows by heart — alternate spans
 * for the moment in a span, the two adjacent ones for the moment over a
 * support — with their closed forms for two spans.
 */

const enveloped = (model: ContinuousModel): ContinuousEnvelope => {
  const out = envelopeContinuous(model);
  if (!out.ok) throw new Error(`not solved: ${JSON.stringify(out.issues)}`);
  return out;
};
const solved = (model: ContinuousModel): ContinuousCase => {
  const out = solveCase(model);
  if (!out.ok) throw new Error(`not solved: ${JSON.stringify(out.issues)}`);
  return out;
};
const near = (got: number, want: number, scale = Math.max(1, Math.abs(want)), tol = 1e-9) => {
  expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * scale);
};
/** The spans that carry a live load, ascending. */
const liveOf = (m: ContinuousModel) => [...new Set([...(m.points ?? []).filter((p) => p.live).map((p) => p.span), ...(m.dists ?? []).filter((d) => d.live).map((d) => d.span)])].sort((a, b) => a - b);
/** The model with the live load of the spans listed, and of no other. */
const arrangement = (m: ContinuousModel, on: number[]): ContinuousModel => ({
  ...m,
  points: (m.points ?? []).filter((p) => !p.live || on.includes(p.span)),
  dists: (m.dists ?? []).filter((d) => !d.live || on.includes(d.span)),
});
/** Every one of them, solved in full: 2ⁿ beams. */
const everyArrangement = (m: ContinuousModel) => {
  const live = liveOf(m);
  return Array.from({ length: 2 ** live.length }, (_, mask) => solved(arrangement(m, live.filter((_, k) => mask & (1 << k)))));
};

const L = 24;
const g = 0.8;
const q = 1.2;
/** A dead and a live load over the whole of every span. */
const deadAndLive = (lengths: number[]): ContinuousModel['dists'] =>
  lengths.flatMap((len, span) => [
    { span, a1: 0, a2: len, w1: g, w2: g },
    { span, a1: 0, a2: len, w1: q, w2: q, live: true },
  ]);

describe('envelope: the patterns everybody knows', () => {
  it('two equal spans: the moment over the support with both loaded, the moment in a span with that span alone', () => {
    const e = enveloped({ spans: [{ L, k: 1 }, { L, k: 1 }], left: 'pin', right: 'pin', dists: deadAndLive([L, L]) });
    // Over the support: −(g + q)L²/8 with both spans loaded, −gL²/8 with neither.
    expect(e.joints[1].M.min.spans).toEqual([0, 1]);
    near(e.joints[1].M.min.value, (-(g + q) * L * L) / 8);
    expect(e.joints[1].M.max.spans).toEqual([]);
    near(e.joints[1].M.max.value, (-g * L * L) / 8);
    near(e.extremes.Mmin.value, (-(g + q) * L * L) / 8);
    near(e.extremes.Mmin.x, L);
    // In the first span: its own live load and not its neighbour's. Then the
    // support moment is −(2g + q)L²/16, and the largest moment R²/2w.
    const MB = (-(2 * g + q) * L * L) / 16;
    const R = ((g + q) * L) / 2 + MB / L;
    expect(e.spans[0].Mmax.spans).toEqual([0]);
    near(e.spans[0].Mmax.value, (R * R) / (2 * (g + q)));
    near(e.spans[0].Mmax.x, R / (g + q), L, 1e-9);
    expect(e.spans[1].Mmax.spans).toEqual([1]);
    near(e.spans[1].Mmax.value, (R * R) / (2 * (g + q)));
    // The end reaction: the most with its own span loaded alone, the least with the other alone.
    expect(e.joints[0].Rv.max.spans).toEqual([0]);
    near(e.joints[0].Rv.max.value, R);
    expect(e.joints[0].Rv.min.spans).toEqual([1]);
    near(e.joints[0].Rv.min.value, (g * L) / 2 + MB / L);
    // The middle reaction: both, 5(g + q)L/4.
    expect(e.joints[1].Rv.max.spans).toEqual([0, 1]);
    near(e.joints[1].Rv.max.value, (5 * (g + q) * L) / 4);
    near(e.joints[1].Rv.min.value, (5 * g * L) / 4);
    // The shear is largest beside the middle support, with both spans loaded: 5(g + q)L/8.
    near(e.extremes.Vmax.value, (5 * (g + q) * L) / 8);
    expect(e.extremes.Vmax.spans).toEqual([0, 1]);
    // And a span sags most under its own live load alone: the other one loaded lifts it.
    expect(e.spans[0].EIvChord.spans).toEqual([0]);
    expect(e.extremes.EIvMin.spans.length).toBe(1);
    // Nothing turns a simple end, nothing is built in: no moment there in any arrangement.
    expect(e.joints[0].M).toEqual({ max: { value: 0, x: 0, spans: [] }, min: { value: 0, x: 0, spans: [] } });
    expect(e.joints[0].Rm.max).toEqual({ value: 0, x: 0, spans: [] });
  });

  it('three equal spans: alternate spans for a span, the two adjacent ones for a support', () => {
    const model: ContinuousModel = { spans: [{ L, k: 1 }, { L, k: 1 }, { L, k: 1 }], left: 'pin', right: 'pin', dists: deadAndLive([L, L, L]) };
    const e = enveloped(model);
    expect(e.spans[0].Mmax.spans).toEqual([0, 2]);
    expect(e.spans[1].Mmax.spans).toEqual([1]);
    expect(e.spans[2].Mmax.spans).toEqual([0, 2]);
    expect(e.joints[1].M.min.spans).toEqual([0, 1]);
    expect(e.joints[2].M.min.spans).toEqual([1, 2]);
    // The least hogging over a support: the far span alone.
    expect(e.joints[1].M.max.spans).toEqual([2]);
    expect(e.joints[1].Rv.max.spans).toEqual([0, 1]);
    expect(e.joints[0].Rv.max.spans).toEqual([0, 2]);
    expect(e.joints[0].Rv.min.spans).toEqual([1]);
    // The middle span can be lifted off its sag: its smallest moment at midspan is with the two outer spans loaded.
    expect(e.at(1.5 * L).M.min).toBeLessThan(e.at(1.5 * L).M.max);
    near(e.at(1.5 * L).M.min, solved(arrangement(model, [0, 2])).at(1.5 * L).M);
    near(e.at(1.5 * L).M.max, solved(arrangement(model, [1])).at(1.5 * L).M);
    // Each value named is the value of that arrangement, solved here.
    near(e.spans[0].Mmax.value, solved(arrangement(model, [0, 2])).spans[0].Mmax.value);
    near(e.spans[1].Mmax.value, solved(arrangement(model, [1])).spans[1].Mmax.value);
    near(e.joints[1].M.min.value, solved(arrangement(model, [0, 1])).joints[1].M);
    // With every span loaded: 0.1(g + q)L² over the supports — less than the two adjacent ones give.
    near(e.all.joints[1].M, -0.1 * (g + q) * L * L);
    expect(e.joints[1].M.min.value).toBeLessThan(e.all.joints[1].M);
    // The beam is the same from both ends, and so is what can happen to it.
    near(e.spans[0].Mmax.value, e.spans[2].Mmax.value);
    near(e.spans[0].Mmax.x, 3 * L - e.spans[2].Mmax.x, L, 1e-9);
    near(e.extremes.Vmax.value, -e.extremes.Vmin.value);
    near(e.joints[1].Rv.max.value, e.joints[2].Rv.max.value);
  });

  it('an overhang: its live load lifts the span beside it, and nothing on the beam reaches its own shear and moment', () => {
    const c = 8;
    const model: ContinuousModel = { spans: [{ L, k: 1 }, { L, k: 1 }, { L: c, k: 1 }], left: 'pin', right: 'free', dists: deadAndLive([L, L, c]) };
    const e = enveloped(model);
    // Over its support the moment is the overhang's alone: (g + q)c²/2 loaded, gc²/2 not.
    expect(e.joints[2].M.min).toMatchObject({ x: 2 * L, spans: [2] });
    near(e.joints[2].M.min.value, (-(g + q) * c * c) / 2);
    expect(e.joints[2].M.max).toMatchObject({ x: 2 * L, spans: [] });
    near(e.joints[2].M.max.value, (-g * c * c) / 2);
    // In the overhang, shear and moment are its own live load's and nobody else's: exactly.
    for (const of of [e.spans[2].Mmin, e.spans[2].Mmax, e.spans[2].Vmax, e.spans[2].Vmin]) expect(of.spans.every((i) => i === 2)).toBe(true);
    near(e.spans[2].Vmax.value, (g + q) * c);
    expect(e.spans[2].Vmax.spans).toEqual([2]);
    // The span beside it sags most with the overhang's live load off, and its far neighbour's off too.
    expect(e.spans[1].Mmax.spans).toEqual([1]);
    expect(e.spans[0].Mmax.spans).toEqual([0, 2]);
    // The tip: lowest with the overhang and the span next but one loaded, highest with the span beside it alone.
    expect(e.spans[2].kind).toBe('cantilever');
    near(e.at(2 * L + c).EIv.min, solved(arrangement(model, [0, 2])).at(2 * L + c).EIv);
    near(e.at(2 * L + c).EIv.max, solved(arrangement(model, [1])).at(2 * L + c).EIv);
    // No support under the tip: no reaction in any arrangement.
    expect(e.joints[3]).toMatchObject({ support: null, Rv: { max: { value: 0, spans: [] }, min: { value: 0, spans: [] } } });
  });

  it('built-in ends: the wall’s moment has its own two arrangements', () => {
    const model: ContinuousModel = { spans: [{ L, k: 1 }, { L, k: 2 }], left: 'fixed', right: 'fixed', dists: deadAndLive([L, L]) };
    const e = enveloped(model);
    // The left wall holds most with its own span loaded and the other not: counter-clockwise on the beam.
    expect(e.joints[0].Rm.max.spans).toEqual([0]);
    expect(e.joints[0].Rm.min.spans).toEqual([1]);
    near(e.joints[0].Rm.max.value, solved(arrangement(model, [0])).reactions[0].Rm);
    near(e.joints[0].Rm.max.value, -e.joints[0].M.min.value);
    // The right wall's is clockwise: its most negative, with its own span.
    expect(e.joints[2].Rm.min.spans).toEqual([1]);
    near(e.joints[2].Rm.min.value, e.joints[2].M.min.value);
    expect(e.joints[1].Rm).toEqual({ max: { value: 0, x: L, spans: [] }, min: { value: 0, x: L, spans: [] } });
  });
});

/* ── Random beams ─────────────────────────────────────────────────────── */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round2 = (v: number) => Math.round(v * 100) / 100;
const KINDS: EndKind[] = ['pin', 'fixed', 'free'];

/**
 * A beam of one to six spans, each with its own stiffness, on supports some
 * of which settle; dead and live loads of every kind on any span — on a
 * support, right to left, either way up, several live loads on one span.
 */
function randomModel(seed: number): ContinuousModel {
  const r = mulberry32(seed);
  const n = 1 + Math.floor(r() * 6);
  const spans = Array.from({ length: n }, () => ({ L: round2(4 + r() * 30), k: [1, 1, 0.5, 2, round2(0.3 + r() * 3)][Math.floor(r() * 5)] }));
  let left = KINDS[Math.floor(r() * 3)];
  let right = KINDS[Math.floor(r() * 3)];
  if (left !== 'fixed' && right !== 'fixed' && n - 1 + (left === 'pin' ? 1 : 0) + (right === 'pin' ? 1 : 0) < 2) [left, right] = ['pin', 'pin'];
  const load = () => round2(r() * 20 - 6);
  const points = Array.from({ length: Math.floor(r() * 6) }, () => {
    const span = Math.floor(r() * n);
    const u = r();
    return { span, a: u < 0.08 ? 0 : u < 0.16 ? spans[span].L : round2(r() * spans[span].L), P: load(), live: r() < 0.6 };
  });
  const dists = Array.from({ length: Math.floor(r() * 6) }, () => {
    const span = Math.floor(r() * n);
    const a = r() < 0.3 ? 0 : round2(r() * spans[span].L);
    const b = r() < 0.3 ? spans[span].L : round2(r() * spans[span].L);
    return { span, a1: a, a2: b, w1: load() / 4, w2: r() < 0.3 ? 0 : load() / 4, live: r() < 0.6 };
  });
  // …and on about half the spans a live load over the whole span, as a floor has: most beams then have several live spans.
  spans.forEach((sp, span) => {
    if (r() < 0.55) dists.push({ span, a1: 0, a2: sp.L, w1: round2(0.5 + r() * 2), w2: round2(0.5 + r() * 2), live: true });
  });
  const model: ContinuousModel = { spans, left, right, points, dists };
  if (r() < 0.4) model.settlements = Array.from({ length: n + 1 }, () => (r() < 0.5 ? 0 : round2(r() * 300 - 80)));
  return model;
}

describe('envelope: against every arrangement, solved in full (120 random beams, up to six live spans)', () => {
  const SEEDS = Array.from({ length: 120 }, (_, i) => 300 + i * 11);
  /** Each beam, its envelope and its arrangements: solved once, for the tests below. */
  const kept = new Map<number, { m: ContinuousModel; e: ContinuousEnvelope; sols: ContinuousCase[] }>();
  const beamOf = (seed: number) => {
    let beam = kept.get(seed);
    if (!beam) {
      const m = randomModel(seed);
      beam = { m, e: enveloped(m), sols: everyArrangement(m) };
      kept.set(seed, beam);
    }
    return beam;
  };
  /** What each response is measured against. */
  const scalesOf = (e: ContinuousEnvelope, m: ContinuousModel) => {
    const F = e.all.loadScale || 1;
    const soft = Math.min(...m.spans.map((p) => p.k));
    const sunk = Math.max(0, ...(m.settlements ?? []).map(Math.abs));
    // (A slope: a settlement turns a span by itself over the span's length.)
    return { V: F, M: F * e.L, T: (F * e.L ** 2) / soft + sunk / Math.min(...m.spans.map((p) => p.L)), Y: (F * e.L ** 3) / soft + sunk };
  };

  it('at every station, on both sides of it, each edge of each band is the best of them', () => {
    let arrangements = 0;
    for (const seed of SEEDS) {
      const { m, e, sols } = beamOf(seed);
      arrangements += sols.length;
      const sc = scalesOf(e, m);
      // Every station — for the beams with more than eight arrangements, every place where something
      // happens and one station in five between them.
      const places = [...new Set(e.stations.map((s) => s.x))].filter((x, i) => sols.length <= 8 || i % 5 === 0 || e.breaks.includes(x));
      for (const x of places) {
        for (const side of ['left', 'right'] as const) {
          const here = e.at(x, side);
          const states = sols.map((s) => s.at(x, side));
          near(here.V.max, Math.max(...states.map((s) => s.V)), sc.V, 1e-11);
          near(here.V.min, Math.min(...states.map((s) => s.V)), sc.V, 1e-11);
          near(here.M.max, Math.max(...states.map((s) => s.M)), sc.M, 1e-11);
          near(here.M.min, Math.min(...states.map((s) => s.M)), sc.M, 1e-11);
          near(here.EIv.max, Math.max(...states.map((s) => s.EIv)), sc.Y, 1e-11);
          near(here.EIv.min, Math.min(...states.map((s) => s.EIv)), sc.Y, 1e-11);
        }
      }
    }
    // Most of them have several live spans: over a thousand beams, each solved in full, stand behind this.
    expect(arrangements).toBeGreaterThan(1000);
    expect(SEEDS.some((seed) => liveOf(randomModel(seed)).length === 6)).toBe(true);
  }, 120_000);

  // The slope has no band drawn and no largest value named: it is followed at a point, and held here at points —
  // every place where something happens, on both sides, and one station in nine between. With it the moment
  // nearest to zero, which is neither end of the moment's range where the arrangements bend the beam both ways.
  it('at a point the slope is a range like the others, and the moment nearest to zero is the least that any arrangement gives', () => {
    let turning = 0;
    let oneWay = 0;
    for (const seed of SEEDS) {
      const { m, e, sols } = beamOf(seed);
      const sc = scalesOf(e, m);
      const places = [...new Set(e.stations.map((s) => s.x))].filter((x, i) => i % 9 === 0 || e.breaks.includes(x));
      for (const x of places) {
        for (const side of ['left', 'right'] as const) {
          const here = e.at(x, side);
          const states = sols.map((s) => s.at(x, side));
          near(here.EItheta.max, Math.max(...states.map((s) => s.EItheta)), sc.T, 1e-11);
          near(here.EItheta.min, Math.min(...states.map((s) => s.EItheta)), sc.T, 1e-11);
          const least = e.leastMoment(x, side);
          near(least, Math.min(...states.map((s) => Math.abs(s.M))), sc.M, 1e-11);
          // Never past an end of the range; and where every arrangement bends the beam one way, the nearer end itself.
          const nearer = Math.min(Math.abs(here.M.max), Math.abs(here.M.min));
          expect(least).toBeLessThanOrEqual(nearer);
          if (here.M.min >= 0 || here.M.max <= 0) {
            expect(least).toBe(nearer);
            oneWay += 1;
          } else turning += 1;
        }
      }
    }
    // Both kinds of point stand behind this, by the thousand.
    expect(turning).toBeGreaterThan(1000);
    expect(oneWay).toBeGreaterThan(1000);
  }, 120_000);

  it('the largest values are the largest any arrangement reaches, and the arrangement named reaches them', () => {
    for (const seed of SEEDS) {
      const { m, e, sols } = beamOf(seed);
      const live = liveOf(m);
      const sc = scalesOf(e, m);
      const best = (of: (s: ContinuousCase) => number, sign: 1 | -1) => sign * Math.max(...sols.map((s) => sign * of(s)));
      /** The value is the best of all arrangements; the spans named are live ones, in order; and that arrangement, solved, gives the value. */
      const held = (got: Governing, of: (s: ContinuousCase) => number, sign: 1 | -1, scale: number, what: string) => {
        near(got.value, best(of, sign), scale, 1e-11);
        expect(got.spans.every((i) => live.includes(i)), `${what}: only spans with a live load`).toBe(true);
        expect(got.spans).toEqual([...new Set(got.spans)].sort((a, b) => a - b));
        near(of(solved(arrangement(m, got.spans))), got.value, scale, 1e-11);
      };
      const x = e.extremes;
      held(x.Vmax, (s) => s.extremes.Vmax.value, 1, sc.V, 'Vmax');
      held(x.Vmin, (s) => s.extremes.Vmin.value, -1, sc.V, 'Vmin');
      held(x.Mmax, (s) => s.extremes.Mmax.value, 1, sc.M, 'Mmax');
      held(x.Mmin, (s) => s.extremes.Mmin.value, -1, sc.M, 'Mmin');
      held(x.EIvMax, (s) => s.extremes.EIvMax.value, 1, sc.Y, 'EIvMax');
      held(x.EIvMin, (s) => s.extremes.EIvMin.value, -1, sc.Y, 'EIvMin');
      // …and the value is the band's edge at the place named.
      for (const [got, of, edge] of [
        [x.Mmax, 'M', 'max'],
        [x.Mmin, 'M', 'min'],
        [x.Vmax, 'V', 'max'],
        [x.Vmin, 'V', 'min'],
        [x.EIvMax, 'EIv', 'max'],
        [x.EIvMin, 'EIv', 'min'],
      ] as const) {
        expect([e.at(got.x, 'left')[of][edge], e.at(got.x, 'right')[of][edge]]).toContain(got.value);
      }
      e.spans.forEach((p, i) => {
        expect([p.index, p.from, p.to, p.kind]).toEqual([i, e.all.spans[i].from, e.all.spans[i].to, e.all.spans[i].kind]);
        held(p.Mmax, (s) => s.spans[i].Mmax.value, 1, sc.M, 'span Mmax');
        held(p.Mmin, (s) => s.spans[i].Mmin.value, -1, sc.M, 'span Mmin');
        held(p.Vmax, (s) => s.spans[i].Vmax.value, 1, sc.V, 'span Vmax');
        held(p.Vmin, (s) => s.spans[i].Vmin.value, -1, sc.V, 'span Vmin');
        // From its own supports, either way: the largest in size.
        near(Math.abs(p.EIvChord.value), Math.max(...sols.map((s) => Math.abs(s.spans[i].EIvChord.value))), sc.Y, 1e-11);
        near(Math.abs(solved(arrangement(m, p.EIvChord.spans)).spans[i].EIvChord.value), Math.abs(p.EIvChord.value), sc.Y, 1e-11);
        for (const of of [p.Mmax, p.Mmin, p.Vmax, p.Vmin, p.EIvChord]) {
          expect(of.x).toBeGreaterThanOrEqual(p.from);
          expect(of.x).toBeLessThanOrEqual(p.to);
        }
      });
      e.joints.forEach((j, k) => {
        expect([j.x, j.support]).toEqual([e.all.joints[k].x, e.all.joints[k].support]);
        const at = e.all.joints.slice(0, k).filter((p) => p.support !== null).length;
        if (j.support) {
          held(j.Rv.max, (s) => s.reactions[at].Rv, 1, sc.V, 'Rv max');
          held(j.Rv.min, (s) => s.reactions[at].Rv, -1, sc.V, 'Rv min');
          held(j.Rm.max, (s) => s.reactions[at].Rm, 1, sc.M, 'Rm max');
          held(j.Rm.min, (s) => s.reactions[at].Rm, -1, sc.M, 'Rm min');
        } else expect([j.Rv.max.value, j.Rv.min.value, j.Rm.max.value]).toEqual([0, 0, 0]);
        held(j.M.max, (s) => s.joints[k].M, 1, sc.M, 'joint M max');
        held(j.M.min, (s) => s.joints[k].M, -1, sc.M, 'joint M min');
        for (const of of [j.Rv.max, j.Rv.min, j.Rm.max, j.Rm.min, j.M.max, j.M.min]) expect(of.x).toBe(j.x);
      });
    }
  }, 120_000);

  it('every corner of every edge is a station: between two stations no span’s effect changes sign', () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const m = randomModel(seed);
      const e = enveloped(m);
      // Each span's live load alone: its effect is what the edges are added up from.
      const alone = liveOf(m).map((span) => solved({ spans: m.spans, left: m.left, right: m.right, points: (m.points ?? []).filter((p) => p.live && p.span === span), dists: (m.dists ?? []).filter((d) => d.live && d.span === span) }));
      // The stations run in order, are the band at their place, and stand on both sides of everything that happens.
      e.stations.forEach((s, i) => {
        if (i > 0) expect(s.x).toBeGreaterThanOrEqual(e.stations[i - 1].x);
        expect([e.at(s.x, 'left'), e.at(s.x, 'right')]).toContainEqual(s);
      });
      for (const x of e.breaks) expect(e.stations.filter((s) => s.x === x)).toHaveLength(x === 0 || x === e.L ? 1 : 2);
      expect(e.breaks).toEqual(e.all.breaks);
      for (const c of alone) {
        const tops = { V: Math.max(Math.abs(c.extremes.Vmax.value), Math.abs(c.extremes.Vmin.value)), M: Math.max(Math.abs(c.extremes.Mmax.value), Math.abs(c.extremes.Mmin.value)), EIv: Math.max(Math.abs(c.extremes.EIvMax.value), Math.abs(c.extremes.EIvMin.value)) };
        for (let i = 0; i < e.stations.length - 1; i++) {
          const [a, b] = [e.stations[i].x, e.stations[i + 1].x];
          if (!(b - a > 1e-9 * e.L)) continue;
          // Just inside the cell at either end: a crossing between them shows as two signs.
          const [p, q] = [c.at(a + 1e-4 * (b - a), 'right'), c.at(b - 1e-4 * (b - a), 'left')];
          for (const of of ['V', 'M', 'EIv'] as const) {
            if (Math.abs(p[of]) <= 1e-9 * tops[of] || Math.abs(q[of]) <= 1e-9 * tops[of]) continue;
            expect(Math.sign(p[of]), `seed ${seed}: ${of} of a live span changes sign between the stations at ${a} and ${b}`).toBe(Math.sign(q[of]));
          }
        }
      }
    }
  }, 120_000);
});

describe('envelope: what is in it, and what is not', () => {
  const spans = [{ L, k: 1 }, { L: 30, k: 1.5 }, { L: 18, k: 1 }];
  it('with every live load on it is the engine’s own solution of the model', () => {
    const m = randomModel(311);
    const e = enveloped(m);
    const s = solved(m);
    expect(e.all.extremes).toEqual(s.extremes);
    expect(e.all.reactions).toEqual(s.reactions);
    expect(e.all.stations).toEqual(s.stations);
    expect(e.L).toBe(s.L);
    // …and that solution is inside the band, everywhere.
    for (const st of s.stations) {
      for (const side of ['left', 'right'] as const) {
        const [band, one] = [e.at(st.x, side), s.at(st.x, side)];
        expect(one.M).toBeLessThanOrEqual(band.M.max + 1e-9 * s.loadScale * s.L);
        expect(one.M).toBeGreaterThanOrEqual(band.M.min - 1e-9 * s.loadScale * s.L);
        expect(one.V).toBeLessThanOrEqual(band.V.max + 1e-9 * s.loadScale);
        expect(one.V).toBeGreaterThanOrEqual(band.V.min - 1e-9 * s.loadScale);
      }
    }
  });

  it('with no live load the band has no width: it is the beam, and no span is named', () => {
    const m: ContinuousModel = { spans, left: 'fixed', right: 'pin', dists: [{ span: 0, a1: 0, a2: L, w1: g, w2: g }, { span: 1, a1: 4, a2: 20, w1: 0, w2: q }], points: [{ span: 2, a: 7, P: 9 }], settlements: [0, 30, 0, 0] };
    const e = enveloped(m);
    const s = solved(m);
    for (const st of e.stations) {
      expect(st.V.max).toBe(st.V.min);
      expect(st.M.max).toBe(st.M.min);
      expect(st.EItheta.max).toBe(st.EItheta.min);
      expect(st.EIv.max).toBe(st.EIv.min);
      // One arrangement: the moment nearest to zero is the moment.
      expect(e.leastMoment(st.x, 'right')).toBe(Math.abs(e.at(st.x, 'right').M.max));
    }
    // The same stations, to the last figure of each.
    expect(e.stations.map((st) => [st.x, st.V.max, st.M.max, st.EItheta.max, st.EIv.max])).toEqual(s.stations.map((st) => [st.x, st.V, st.M, st.EItheta, st.EIv]));
    // The same largest values at the same places (found here on the band's own polynomials: to rounding), with nobody named.
    const same = (got: Governing, want: { value: number; x: number }, scale: number) => {
      near(got.value, want.value, scale, 1e-12);
      near(got.x, want.x, s.L, 1e-6);
      expect(got.spans).toEqual([]);
    };
    const [F, soft] = [s.loadScale, 1];
    same(e.extremes.Mmax, s.extremes.Mmax, F * s.L);
    same(e.extremes.Mmin, s.extremes.Mmin, F * s.L);
    same(e.extremes.Vmax, s.extremes.Vmax, F);
    same(e.extremes.Vmin, s.extremes.Vmin, F);
    same(e.extremes.EIvMax, s.extremes.EIvMax, (F * s.L ** 3) / soft);
    same(e.extremes.EIvMin, s.extremes.EIvMin, (F * s.L ** 3) / soft);
    e.spans.forEach((p, i) => {
      same(p.Mmax, s.spans[i].Mmax, F * s.L);
      same(p.Mmin, s.spans[i].Mmin, F * s.L);
      same(p.Vmax, s.spans[i].Vmax, F);
      same(p.Vmin, s.spans[i].Vmin, F);
      same(p.EIvChord, s.spans[i].EIvChord, (F * s.L ** 3) / soft);
    });
    e.joints.forEach((j, k) => {
      expect(j.M.max).toEqual({ value: s.joints[k].M, x: s.joints[k].x, spans: [] });
      expect(j.M.min).toEqual(j.M.max);
      const r = s.reactions.find((q) => q.x === j.x);
      expect(j.Rv.max).toEqual({ value: r ? r.Rv : 0, x: j.x, spans: [] });
      expect(j.Rm.min).toEqual({ value: r ? r.Rm : 0, x: j.x, spans: [] });
    });
    // A live load of no size is no live load.
    const zero = enveloped({ ...m, points: [...(m.points ?? []), { span: 1, a: 9, P: 0, live: true }], dists: [...(m.dists ?? []), { span: 0, a1: 2, a2: 9, w1: 0, w2: 0, live: true }] });
    expect(zero.extremes).toEqual(e.extremes);
  });

  it('a settlement is always there: the arrangement with no live load on is the beam on its settled supports', () => {
    const m: ContinuousModel = { spans, left: 'pin', right: 'pin', settlements: [0, 400, 0, 0], dists: [{ span: 2, a1: 0, a2: 18, w1: q, w2: q, live: true }] };
    const e = enveloped(m);
    const settledOnly = solved({ ...m, dists: [] });
    const both = solved(m);
    e.joints.forEach((j, k) => {
      const [low, high] = [settledOnly.joints[k].M, both.joints[k].M].sort((a, b) => a - b);
      near(j.M.min.value, low, Math.abs(settledOnly.joints[1].M), 1e-12);
      near(j.M.max.value, high, Math.abs(settledOnly.joints[1].M), 1e-12);
      // One of the two is the settled beam with nothing on it; the other names the one live span.
      expect(j.M.max.spans.length + j.M.min.spans.length).toBe(k === 0 || k === 3 ? 0 : 1);
    });
    // The supports are where their settlements put them in every arrangement: the band has no width there.
    expect(e.at(L).EIv).toEqual({ max: -400, min: -400 });
    expect(e.at(0).EIv).toEqual({ max: 0, min: 0 });
  });

  it('a span whose live load does nothing somewhere is not named there', () => {
    // A live load standing on a support: it is in that support's reaction, and nowhere else.
    const on: ContinuousModel = { spans, left: 'pin', right: 'pin', dists: [{ span: 0, a1: 0, a2: L, w1: g, w2: g }], points: [{ span: 1, a: 0, P: 12, live: true }] };
    const e = enveloped(on);
    const dead = solved(arrangement(on, []));
    expect(e.joints[1].Rv.max).toEqual({ value: dead.reactions[1].Rv + 12, x: L, spans: [1] });
    expect(e.joints[1].Rv.min).toEqual({ value: dead.reactions[1].Rv, x: L, spans: [] });
    for (const of of [...Object.values(e.extremes), ...e.spans.flatMap((p) => [p.Mmax, p.Mmin, p.Vmax, p.Vmin, p.EIvChord]), ...e.joints.flatMap((j) => [j.M.max, j.M.min]), e.joints[0].Rv.max, e.joints[2].Rv.min]) expect(of.spans).toEqual([]);
    for (const st of e.stations) expect([st.M.max - st.M.min, st.V.max - st.V.min, st.EIv.max - st.EIv.min]).toEqual([0, 0, 0]);
    // An upward live load: it is the LOWEST values that name it.
    const up = enveloped({ spans, left: 'pin', right: 'pin', dists: [{ span: 1, a1: 0, a2: 30, w1: -q, w2: -q, live: true }] });
    expect(up.spans[1].Mmin.spans).toEqual([1]);
    // Lifted, the beam sags over its supports: the moment there is positive, and with the load off there is none.
    expect(up.joints[1].M.max.spans).toEqual([1]);
    expect(up.joints[1].M.min).toEqual({ value: 0, x: L, spans: [] });
    expect(up.spans[0].Mmin).toMatchObject({ value: 0, spans: [] });
    expect(up.joints[1].Rv.min.spans).toEqual([1]);
    expect(up.joints[1].Rv.max).toEqual({ value: 0, x: L, spans: [] });
    expect(up.extremes.EIvMax.spans).toEqual([1]);
    expect(up.extremes.EIvMin.spans).toEqual([1]);
  });

  it('reads a point on the side asked for, as a solution does', () => {
    const m: ContinuousModel = { spans, left: 'pin', right: 'pin', dists: deadAndLive([L, 30, 18]), points: [{ span: 1, a: 10, P: 15, live: true }] };
    const e = enveloped(m);
    expect(e.at(34)).toEqual(e.at(34, 'right'));
    expect(e.at(e.L)).toEqual(e.at(e.L, 'left'));
    // Under the live point load the band drops by it on the way across: what one edge does not drop, the other does.
    const [before, after] = [e.at(34, 'left').V, e.at(34, 'right').V];
    near(before.max - after.max + (before.min - after.min), 15);
    expect(before.max - after.max).toBeGreaterThanOrEqual(0);
    expect(before.min - after.min).toBeGreaterThanOrEqual(0);
    // Over a support both edges jump, each by the reaction of its own arrangement.
    expect(e.at(L, 'right').V.max).toBeGreaterThan(e.at(L, 'left').V.max);
    expect(e.at(L, 'left').M).toEqual(e.at(L, 'right').M);
  });

  it('says what the engine says of a model it does not take, by the model’s own rows', () => {
    const live = { span: 0, a1: 0, a2: L, w1: q, w2: q, live: true };
    expect(envelopeContinuous({ spans: [], left: 'pin', right: 'pin' })).toEqual({ ok: false, issues: [{ code: 'no-spans' }] });
    expect(envelopeContinuous({ spans: [{ L, k: 1 }], left: 'pin', right: 'free', dists: [live] })).toEqual({ ok: false, issues: [{ code: 'unstable' }] });
    expect(envelopeContinuous({ spans: [{ L, k: 1 }, { L: 0.01, k: 1 }], left: 'pin', right: 'pin', dists: [live] })).toEqual({ ok: false, issues: [{ code: 'short-span', where: { list: 'spans', index: 1 } }] });
    expect(envelopeContinuous({ spans: [{ L, k: 1 }, { L, k: 5000 }], left: 'pin', right: 'pin', dists: [live] })).toEqual({ ok: false, issues: [{ code: 'stiffness', where: { list: 'spans', index: 1 } }] });
    // The third distributed load of the model, live or not: its place in the model's list.
    expect(envelopeContinuous({ spans: [{ L, k: 1 }, { L, k: 1 }], left: 'pin', right: 'pin', dists: [live, { ...live, live: false }, { ...live, span: 1, a2: 99 }], points: [{ span: 1, a: 3, P: Number.NaN, live: true }] })).toEqual({
      ok: false,
      issues: [
        { code: 'number', where: { list: 'points', index: 0 } },
        { code: 'outside', where: { list: 'dists', index: 2 } },
      ],
    });
    expect(solveContinuous({ spans: [{ L, k: 1 }], left: 'pin', right: 'pin', dists: [live] }).ok).toBe(true);
  });

  it('never returns a number that is not one: live loads at the engine’s limits', () => {
    const big: ContinuousModel = {
      spans: Array.from({ length: 6 }, () => ({ L: 1e60, k: 0.001 })),
      left: 'fixed',
      right: 'free',
      dists: Array.from({ length: 6 }, (_, span) => ({ span, a1: 0, a2: 1e60, w1: 1e60, w2: 1e60, live: true })),
    };
    const out = envelopeContinuous(big);
    if (out.ok) expect(out.stations.every((s) => [s.x, s.V.max, s.V.min, s.M.max, s.M.min, s.EItheta.max, s.EItheta.min, s.EIv.max, s.EIv.min].every(Number.isFinite))).toBe(true);
    else expect(out.issues).toEqual([{ code: 'length' }]);
    const sound = enveloped({ ...big, spans: big.spans.map(() => ({ L: 1e20, k: 0.001 })), dists: big.dists?.map((d) => ({ ...d, a2: 1e20, w1: 1e20, w2: 1e20 })) });
    expect(sound.stations.every((s) => [s.x, s.V.max, s.V.min, s.M.max, s.M.min, s.EItheta.max, s.EItheta.min, s.EIv.max, s.EIv.min].every(Number.isFinite))).toBe(true);
  });
});

describe('envelope: where the values are small, and where two places are one', () => {
  it('a span far stiffer than the loaded ones has ITS largest values, to its own figures', () => {
    // Six spans, flexible and stiff in turn: what the live load of the first and third does to the last is a
    // million-millionth of what it does to its own span, and it is all the last span has. Measured against
    // the largest value of each load ANYWHERE that was "rounding": the last span's deflection came back as
    // 3.68e-6 down, with the span beside it loaded, for 4.65e-6 up with the two far ones.
    const len = 18;
    const m: ContinuousModel = {
      spans: [0.001, 1, 0.001, 1000, 0.001, 1000].map((k) => ({ L: len, k })),
      left: 'pin',
      right: 'fixed',
      dists: [
        { span: 0, a1: 0, a2: len, w1: 20, w2: 20, live: true },
        { span: 2, a1: 0, a2: len, w1: 3, w2: 3 },
        { span: 2, a1: 0, a2: len, w1: 40, w2: 40, live: true },
      ],
      points: [{ span: 3, a: 12, P: 150, live: true }],
    };
    const e = enveloped(m);
    const sols = everyArrangement(m);
    const best = (of: (s: ContinuousCase) => number, sign: 1 | -1) => sign * Math.max(...sols.map((s) => sign * of(s)));
    e.spans.forEach((p, i) => {
      // Each against the largest of ITS span, not of the beam.
      const chord = best((s) => Math.abs(s.spans[i].EIvChord.value), 1);
      near(Math.abs(p.EIvChord.value), chord, chord, 1e-9);
      near(Math.abs(solved(arrangement(m, p.EIvChord.spans)).spans[i].EIvChord.value), chord, chord, 1e-9);
      const moment = Math.max(best((s) => s.spans[i].Mmax.value, 1), -best((s) => s.spans[i].Mmin.value, -1));
      near(p.Mmax.value, best((s) => s.spans[i].Mmax.value, 1), moment, 1e-9);
      near(p.Mmin.value, best((s) => s.spans[i].Mmin.value, -1), moment, 1e-9);
      const shear = Math.max(best((s) => s.spans[i].Vmax.value, 1), -best((s) => s.spans[i].Vmin.value, -1));
      near(p.Vmax.value, best((s) => s.spans[i].Vmax.value, 1), shear, 1e-9);
      near(p.Vmin.value, best((s) => s.spans[i].Vmin.value, -1), shear, 1e-9);
    });
    expect(e.spans[5].EIvChord.spans).toEqual([0, 2]);
    expect(e.spans[5].EIvChord.value).toBeGreaterThan(0);
    // The band at a point of that span, against the largest of the span: both edges.
    const x = e.spans[5].EIvChord.x;
    const here = e.at(x);
    const states = sols.map((s) => s.at(x));
    const top = Math.abs(e.spans[5].EIvChord.value);
    near(here.EIv.max, Math.max(...states.map((s) => s.EIv)), top, 1e-9);
    near(here.EIv.min, Math.min(...states.map((s) => s.EIv)), top, 1e-9);
    // The slope in the two stiff spans, a millionth of the slopes beside them: each edge against the steepest
    // that span is in any arrangement — its own figures, again. (With rounding measured against the largest
    // slope a load causes anywhere on the beam, an edge here came back as 3.89e-8 for 5.58e-7.)
    for (const i of [3, 5]) {
      const { from, to } = e.spans[i];
      const steepest = Math.max(...sols.flatMap((s) => s.stations.filter((st) => st.x >= from && st.x <= to).map((st) => Math.abs(st.EItheta))));
      for (const u of [0.2, 0.5, 0.8]) {
        const turned = sols.map((s) => s.at(from + u * len).EItheta);
        const band = e.at(from + u * len).EItheta;
        near(band.max, Math.max(...turned), steepest, 1e-9);
        near(band.min, Math.min(...turned), steepest, 1e-9);
        expect(band.max - band.min).toBeGreaterThan(1e-3 * steepest);
      }
    }
    // And the supports: each reaction and each moment over a support against itself.
    e.joints.forEach((j, k) => {
      for (const [got, of] of [
        [j.M.max, (s: ContinuousCase) => s.joints[k].M],
        [j.M.min, (s: ContinuousCase) => s.joints[k].M],
        [j.Rv.max, (s: ContinuousCase) => s.reactions[k].Rv],
        [j.Rv.min, (s: ContinuousCase) => s.reactions[k].Rv],
      ] as const) {
        const want = best(of, got === j.M.max || got === j.Rv.max ? 1 : -1);
        near(got.value, want, Math.max(Math.abs(best(of, 1)), Math.abs(best(of, -1))), 1e-9);
      }
    });
  });

  it('a load a hair from the wall is on the wall: the moment there is not lost', () => {
    // Two spans of 100 built in on the left, and a live load lifting the first a millionth of a millionth from
    // the wall. The lowest moment is the wall's, 12,500/7; read at the place of that load from its left it was
    // "before the beam" — nothing — and the envelope said 10,000/7, over the middle support.
    const m: ContinuousModel = {
      spans: [{ L: 100, k: 1 }, { L: 100, k: 1 }],
      left: 'fixed',
      right: 'pin',
      points: [{ span: 0, a: 1e-12, P: -300, live: true }],
      dists: [{ span: 0, a1: 0, a2: 100, w1: 2, w2: 2, live: true }, { span: 1, a1: 0, a2: 100, w1: 1, w2: 1 }],
    };
    const e = enveloped(m);
    const sols = everyArrangement(m);
    const lowest = Math.min(...sols.map((s) => s.extremes.Mmin.value));
    near(lowest, -12500 / 7, 1, 1e-9);
    near(e.extremes.Mmin.value, lowest, 1, 1e-9);
    expect([e.extremes.Mmin.x, e.extremes.Mmin.spans]).toEqual([0, [0]]);
    near(e.spans[0].Mmin.value, lowest, 1, 1e-9);
    near(e.joints[0].M.min.value, lowest, 1, 1e-9);
    near(e.spans[0].Vmin.value, Math.min(...sols.map((s) => s.spans[0].Vmin.value)), 1, 1e-9);
    expect(e.breaks).toEqual([0, 100, 200]);
    // Each case has its loads where the whole has them: a live load a hair from a dead one is at the dead one's place in both.
    const beside: ContinuousModel = { ...m, points: [{ span: 0, a: 40, P: 5 }, { span: 0, a: 40 + 6e-12, P: 70, live: true }] };
    const b = enveloped(beside);
    expect(b.breaks).toEqual([0, 40, 100, 200]);
    const each = everyArrangement(beside);
    near(b.spans[0].Vmax.value, Math.max(...each.map((s) => s.spans[0].Vmax.value)), 1, 1e-9);
    near(b.spans[0].Vmin.value, Math.min(...each.map((s) => s.spans[0].Vmin.value)), 1, 1e-9);
    for (const side of ['left', 'right'] as const) {
      near(b.at(40, side).V.max, Math.max(...each.map((s) => s.at(40, side).V)), 1, 1e-9);
      near(b.at(40, side).V.min, Math.min(...each.map((s) => s.at(40, side).V)), 1, 1e-9);
    }
  });

  it('with no live load its stations are the solution’s — on equal spans too, where a share of the beam is a whole number of cells', () => {
    // A third of the beam is 80 cells of the grid, however the third was worked out. On 18 of these 48 beams the
    // envelope, which has its shares from positions along the beam, had a station more than the solution, or fewer.
    for (let count = 1; count <= 8; count++) {
      for (const len of [24, 9.093685124603384, 7.3, 0.1, 31.7, 12.5]) {
        const lengths = Array.from({ length: count }, () => len);
        const e = enveloped({ spans: lengths.map((span) => ({ L: span, k: 1 })), left: 'pin', right: 'pin', dists: lengths.map((span, i) => ({ span: i, a1: 0, a2: span, w1: g, w2: g })) });
        expect(e.stations.map((s) => [s.x, s.V.max, s.V.min, s.M.max, s.M.min, s.EIv.max, s.EIv.min])).toEqual(e.all.stations.map((s) => [s.x, s.V, s.V, s.M, s.M, s.EIv, s.EIv]));
        // Equal spans, equal grids: 240 cells shared out (35 each for seven spans, which do not share them evenly), and a station at each end of each span.
        expect(e.all.stations).toHaveLength(count * (Math.ceil(240 / count - 1e-9) + 1));
      }
    }
  });
});

describe('envelope: a beam no table lists, every arrangement of it solved exactly by another method', () => {
  // The beam of engine.test.ts — four spans, each its own stiffness, supports that settle, an overhang — with a
  // live load on its second span and on its overhang: four arrangements, each solved by the force method in
  // exact fractions, and the best of the four taken. Nothing of envelope.ts or of the engine is in these numbers.
  const model: ContinuousModel = {
    spans: [{ L: 18, k: 1 }, { L: 24, k: 2.5 }, { L: 15, k: 0.4 }, { L: 6, k: 1.6 }],
    left: 'fixed',
    right: 'free',
    settlements: [0, 30, -12, 45, 0],
    points: [{ span: 0, a: 7, P: 12 }, { span: 2, a: 15, P: 9 }, { span: 3, a: 6, P: 4, live: true }, { span: 1, a: 10, P: -5, live: true }],
    dists: [
      { span: 0, a1: 0, a2: 18, w1: 1.2, w2: 1.2 },
      { span: 1, a1: 4, a2: 20, w1: 0.5, w2: 3, live: true },
      { span: 2, a1: 12, a2: 3, w1: 2, w2: -1 },
      { span: 3, a1: 0, a2: 6, w1: 0.8, w2: 0.8 },
    ],
  };
  const e = enveloped(model);
  const tight = (got: Governing, want: number, spans: number[], scale: number) => {
    near(got.value, want, scale, 1e-13);
    expect(got.spans).toEqual(spans);
  };

  it('the largest values, and the arrangement that gives each', () => {
    const [F, M, Y] = [25, 75, 2400];
    tight(e.extremes.Vmax, 20.62152763649402, [], F);
    tight(e.extremes.Vmin, -15.62499292277056, [1, 3], F);
    tight(e.extremes.Mmax, 67.17691408769474, [1, 3], M);
    tight(e.extremes.Mmin, -75.0822522387172, [], M);
    tight(e.extremes.EIvMax, 837.864991647814, [1, 3], Y);
    tight(e.extremes.EIvMin, -2400.6317618101916, [1, 3], Y);
  });

  it('each support: its reaction and the moment over it, highest and lowest', () => {
    const [F, M] = [25, 75];
    const Rv: [number, number[], number, number[]][] = [
      [20.62152763649402, [], 17.97500707722944, [1, 3]],
      [26.87611047185645, [1, 3], 14.289875648340294, []],
      [13.14367249194813, [1], -4.191931797374574, [3]],
      [24.689317492511528, [3], 17.396420978994716, [1]],
    ];
    Rv.forEach(([max, on, min, off], j) => {
      tight(e.joints[j].Rv.max, max, on, F);
      tight(e.joints[j].Rv.min, min, off, F);
    });
    const over: [number, number[], number, number[]][] = [
      [-59.20312888312973, [1, 3], -75.0822522387172, []],
      [-30.29475478182484, [], -62.053001492999805, [1, 3]],
      [10.939762387672893, [3], -14.453685315079298, [1]],
      [-14.4, [], -38.4, [3]],
      [0, [], 0, []],
    ];
    over.forEach(([max, on, min, off], j) => {
      tight(e.joints[j].M.max, max, on, M);
      tight(e.joints[j].M.min, min, off, M);
    });
    // The wall's moment on the beam is the moment in it, the other way round.
    tight(e.joints[0].Rm.max, 75.0822522387172, [], M);
    tight(e.joints[0].Rm.min, 59.20312888312973, [1, 3], M);
  });
});
