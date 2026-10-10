import { describe, expect, it } from 'vitest';
import { analyzeBeam } from '@/lib/beam-analysis/beamAnalysis';
import { beamSpans, solveBeam, type BeamModel, type BeamSolution } from './solver';

/**
 * THE BEAM ENGINE, against what is known in closed form.
 *
 * Every number below is a textbook result (the beam diagrams and formulas
 * of the AISC Manual, Table 3-23; Roark) written as its formula, not as a
 * decimal somebody copied. The engine is exact — sums of polynomials — so
 * the tolerance is rounding, not "within half a percent".
 *
 * Then what no table lists: random beams held to the things that are true
 * of every beam (equilibrium, the support conditions, each diagram the
 * derivative of the next, superposition, mirror symmetry), and the same
 * random beams solved by a second, unrelated method — the finite-element
 * solver this engine replaces.
 */

const solved = (model: BeamModel): BeamSolution => {
  const out = solveBeam(model);
  if (!out.ok) throw new Error(`not solved: ${JSON.stringify(out.issues)}`);
  return out;
};
const issuesOf = (model: BeamModel) => {
  const out = solveBeam(model);
  return out.ok ? [] : out.issues.map((i) => i.code);
};
/** Equal to rounding: relative to the size of the numbers in play. */
const near = (got: number, want: number, scale = Math.max(1, Math.abs(want)), tol = 1e-9) => {
  expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * scale);
};

const L = 24;
const w = 1.7;
const P = 11;
const SS = [
  { x: 0, kind: 'pin' as const },
  { x: L, kind: 'roller' as const },
];

describe('beam: simply supported', () => {
  it('uniform load: wL/2, wL²/8 at midspan, 5wL⁴/384EI, end slopes wL³/24EI', () => {
    const s = solved({ L, supports: SS, dists: [{ x1: 0, x2: L, w1: w, w2: w }] });
    near(s.reactions[0].Rv, (w * L) / 2);
    near(s.reactions[1].Rv, (w * L) / 2);
    near(s.extremes.Mmax.value, (w * L * L) / 8);
    near(s.extremes.Mmax.x, L / 2);
    near(s.extremes.EIvMin.value, (-5 * w * L ** 4) / 384);
    near(s.extremes.EIvMin.x, L / 2);
    near(s.at(0).EItheta, (-w * L ** 3) / 24);
    near(s.at(L).EItheta, (w * L ** 3) / 24);
    near(s.extremes.Vmax.value, (w * L) / 2);
    near(s.extremes.Vmin.value, (-w * L) / 2);
    near(s.totalLoad, w * L);
  });

  it('point load at midspan: P/2, PL/4, PL³/48EI', () => {
    const s = solved({ L, supports: SS, points: [{ x: L / 2, P }] });
    near(s.reactions[0].Rv, P / 2);
    near(s.extremes.Mmax.value, (P * L) / 4);
    near(s.extremes.EIvMin.value, (-P * L ** 3) / 48);
    near(s.at(0).EItheta, (-P * L * L) / 16);
    // Shear jumps by P under the load.
    near(s.at(L / 2, 'left').V, P / 2);
    near(s.at(L / 2, 'right').V, -P / 2);
  });

  it('point load off centre: Pb/L, Pab/L, Pa²b²/3EIL under it, and the maximum where the table puts it', () => {
    const a = 15;
    const b = L - a;
    const s = solved({ L, supports: SS, points: [{ x: a, P }] });
    near(s.reactions[0].Rv, (P * b) / L);
    near(s.reactions[1].Rv, (P * a) / L);
    near(s.extremes.Mmax.value, (P * a * b) / L);
    near(s.extremes.Mmax.x, a);
    near(s.at(a).EIv, (-P * a * a * b * b) / (3 * L));
    // a > b: the largest deflection is on the longer side.
    near(s.extremes.EIvMin.x, Math.sqrt((L * L - b * b) / 3), L, 1e-7);
    near(s.extremes.EIvMin.value, (-P * b * (L * L - b * b) ** 1.5) / (9 * Math.sqrt(3) * L));
  });

  it('triangular load rising to w: wL/6 and wL/3, wL²/9√3 at L/√3, and its largest deflection', () => {
    const s = solved({ L, supports: SS, dists: [{ x1: 0, x2: L, w1: 0, w2: w }] });
    near(s.reactions[0].Rv, (w * L) / 6);
    near(s.reactions[1].Rv, (w * L) / 3);
    near(s.extremes.Mmax.value, (w * L * L) / (9 * Math.sqrt(3)));
    near(s.extremes.Mmax.x, L / Math.sqrt(3), L, 1e-7);
    const x = L * Math.sqrt(1 - Math.sqrt(8 / 15));
    near(s.extremes.EIvMin.x, x, L, 1e-7);
    near(s.extremes.EIvMin.value, (-w * x * (3 * x ** 4 - 10 * L * L * x * x + 7 * L ** 4)) / (360 * L));
  });

  it('a couple at the left end: reactions ±M₀/L and a straight line of moment', () => {
    const M0 = 90;
    const s = solved({ L, supports: SS, couples: [{ x: 0, M: M0 }] });
    near(s.reactions[0].Rv, M0 / L);
    near(s.reactions[1].Rv, -M0 / L);
    near(s.at(0, 'right').M, -M0);
    near(s.at(L / 4).M, -M0 * (1 - 1 / 4));
    near(s.at(L, 'left').M, 0, M0);
  });

  it('a counter-clockwise couple in the span: the moment drops by M₀ across it', () => {
    const M0 = 60;
    const a = L / 3;
    const s = solved({ L, supports: SS, couples: [{ x: a, M: M0 }] });
    near(s.reactions[0].Rv, M0 / L);
    near(s.at(a, 'left').M, (M0 * a) / L);
    near(s.at(a, 'right').M, (M0 * a) / L - M0);
    near(s.extremes.Mmax.value, (M0 * a) / L);
    near(s.extremes.Mmin.value, (-M0 * (L - a)) / L);
  });

  it('a partial uniform load: reactions by statics, and zero shear where the moment peaks', () => {
    const a = 6;
    const c = 14;
    const s = solved({ L, supports: SS, dists: [{ x1: a, x2: c, w1: w, w2: w }] });
    const W = w * (c - a);
    const RA = (W * (L - (a + c) / 2)) / L;
    near(s.reactions[0].Rv, RA);
    near(s.reactions[1].Rv, W - RA);
    const x0 = a + RA / w;
    near(s.extremes.Mmax.x, x0, L, 1e-7);
    near(s.extremes.Mmax.value, RA * x0 - (w * (x0 - a) ** 2) / 2);
    near(s.at(x0).V, 0, W);
  });
});

describe('beam: cantilever', () => {
  it('fixed on the left, load at the tip: PL, PL³/3EI, PL²/2EI', () => {
    const s = solved({ L, supports: [{ x: 0, kind: 'fixed' }], points: [{ x: L, P }] });
    near(s.reactions[0].Rv, P);
    // The wall turns the beam counter-clockwise against a load that turns it clockwise.
    near(s.reactions[0].Rm, P * L);
    near(s.at(0, 'right').M, -P * L);
    near(s.extremes.Mmin.value, -P * L);
    near(s.at(L).EIv, (-P * L ** 3) / 3);
    near(s.at(L).EItheta, (-P * L * L) / 2);
    near(s.at(L, 'right').V, 0, P);
  });

  it('fixed on the left, uniform load: wL²/2, wL⁴/8EI, wL³/6EI', () => {
    const s = solved({ L, supports: [{ x: 0, kind: 'fixed' }], dists: [{ x1: 0, x2: L, w1: w, w2: w }] });
    near(s.reactions[0].Rv, w * L);
    near(s.reactions[0].Rm, (w * L * L) / 2);
    near(s.extremes.Mmin.value, (-w * L * L) / 2);
    near(s.extremes.EIvMin.value, (-w * L ** 4) / 8);
    near(s.at(L).EItheta, (-w * L ** 3) / 6);
  });

  it('fixed on the right: the mirror image, with the reaction moment clockwise', () => {
    const s = solved({ L, supports: [{ x: L, kind: 'fixed' }], points: [{ x: 0, P }] });
    near(s.reactions[0].Rv, P);
    near(s.reactions[0].Rm, -P * L);
    near(s.at(L, 'left').M, -P * L);
    near(s.at(0).EIv, (-P * L ** 3) / 3);
    near(s.at(0).EItheta, (P * L * L) / 2);
    // To the right of the load the left part is pushed DOWN.
    near(s.at(L / 2).V, -P);
  });

  it('an upward load lifts the tip', () => {
    const s = solved({ L, supports: [{ x: 0, kind: 'fixed' }], points: [{ x: L, P: -P }] });
    near(s.reactions[0].Rv, -P);
    near(s.extremes.EIvMax.value, (P * L ** 3) / 3);
    near(s.extremes.Mmax.value, P * L);
  });
});

describe('beam: statically indeterminate', () => {
  it('fixed at both ends, uniform load: wL²/12 at the ends, wL²/24 at midspan, wL⁴/384EI', () => {
    const s = solved({ L, supports: [{ x: 0, kind: 'fixed' }, { x: L, kind: 'fixed' }], dists: [{ x1: 0, x2: L, w1: w, w2: w }] });
    near(s.reactions[0].Rv, (w * L) / 2);
    near(s.reactions[0].Rm, (w * L * L) / 12);
    near(s.reactions[1].Rm, (-w * L * L) / 12);
    near(s.extremes.Mmin.value, (-w * L * L) / 12);
    near(s.extremes.Mmax.value, (w * L * L) / 24);
    near(s.extremes.EIvMin.value, (-w * L ** 4) / 384);
  });

  it('fixed at both ends, load at midspan: PL/8 either sign, PL³/192EI', () => {
    const s = solved({ L, supports: [{ x: 0, kind: 'fixed' }, { x: L, kind: 'fixed' }], points: [{ x: L / 2, P }] });
    near(s.extremes.Mmin.value, (-P * L) / 8);
    near(s.extremes.Mmax.value, (P * L) / 8);
    near(s.extremes.EIvMin.value, (-P * L ** 3) / 192);
  });

  it('propped cantilever, uniform load: 5wL/8 and 3wL/8, wL²/8 at the wall, 9wL²/128 in the span', () => {
    const s = solved({ L, supports: [{ x: 0, kind: 'fixed' }, { x: L, kind: 'roller' }], dists: [{ x1: 0, x2: L, w1: w, w2: w }] });
    near(s.reactions[0].Rv, (5 * w * L) / 8);
    near(s.reactions[1].Rv, (3 * w * L) / 8);
    near(s.extremes.Mmin.value, (-w * L * L) / 8);
    near(s.extremes.Mmax.value, (9 * w * L * L) / 128);
    near(s.extremes.Mmax.x, (5 * L) / 8, L, 1e-7);
    // Largest deflection at (1 + √33)L/16 from the propped end.
    const d = (L * (1 + Math.sqrt(33))) / 16;
    near(s.extremes.EIvMin.x, L - d, L, 1e-7);
    near(s.extremes.EIvMin.value, (-w * d * (L ** 3 - 3 * L * d * d + 2 * d ** 3)) / 48);
  });

  it('propped cantilever, load at midspan: 11P/16 and 5P/16, 3PL/16 at the wall, 5PL/32 under the load', () => {
    const s = solved({ L, supports: [{ x: 0, kind: 'fixed' }, { x: L, kind: 'roller' }], points: [{ x: L / 2, P }] });
    near(s.reactions[0].Rv, (11 * P) / 16);
    near(s.reactions[1].Rv, (5 * P) / 16);
    near(s.extremes.Mmin.value, (-3 * P * L) / 16);
    near(s.extremes.Mmax.value, (5 * P * L) / 32);
  });

  it('two equal spans, uniform load: 3wL/8, 5wL/4, 3wL/8 and wL²/8 over the middle support', () => {
    const s = solved({ L: 2 * L, supports: [{ x: 0, kind: 'pin' }, { x: L, kind: 'roller' }, { x: 2 * L, kind: 'roller' }], dists: [{ x1: 0, x2: 2 * L, w1: w, w2: w }] });
    near(s.reactions[0].Rv, (3 * w * L) / 8);
    near(s.reactions[1].Rv, (5 * w * L) / 4);
    near(s.reactions[2].Rv, (3 * w * L) / 8);
    near(s.extremes.Mmin.value, (-w * L * L) / 8);
    near(s.extremes.Mmin.x, L);
    near(s.extremes.Mmax.value, (9 * w * L * L) / 128);
  });

  it('three equal spans, uniform load: 0.4wL and 1.1wL, 0.1wL² over the supports, 0.08wL² and 0.025wL² in the spans', () => {
    const s = solved({
      L: 3 * L,
      supports: [0, 1, 2, 3].map((i) => ({ x: i * L, kind: i === 0 ? ('pin' as const) : ('roller' as const) })),
      dists: [{ x1: 0, x2: 3 * L, w1: w, w2: w }],
    });
    near(s.reactions[0].Rv, 0.4 * w * L);
    near(s.reactions[1].Rv, 1.1 * w * L);
    near(s.reactions[2].Rv, 1.1 * w * L);
    near(s.reactions[3].Rv, 0.4 * w * L);
    near(s.at(L).M, -0.1 * w * L * L);
    near(s.at(2 * L).M, -0.1 * w * L * L);
    near(s.extremes.Mmax.value, 0.08 * w * L * L);
    near(s.extremes.Mmax.x % (3 * L), 0.4 * L, L, 1e-6);
    near(s.at(1.5 * L).M, 0.025 * w * L * L);
  });

  it('an overhang: the moment over the last support is the cantilever’s', () => {
    const a = 18;
    const s = solved({ L, supports: [{ x: 0, kind: 'pin' }, { x: a, kind: 'roller' }], dists: [{ x1: 0, x2: L, w1: w, w2: w }] });
    near(s.reactions[1].Rv, (w * L * L) / (2 * a));
    near(s.reactions[0].Rv, w * L - (w * L * L) / (2 * a));
    near(s.at(a).M, (-w * (L - a) ** 2) / 2);
    near(s.at(L, 'right').M, 0, w * L * L);
  });
});

describe('beam: internal hinges', () => {
  it('a wall, a hinge at midspan and a roller: the right half hangs on the hinge', () => {
    const s = solved({ L, supports: [{ x: 0, kind: 'fixed' }, { x: L, kind: 'roller' }], hinges: [L / 2], dists: [{ x1: 0, x2: L, w1: w, w2: w }] });
    near(s.reactions[1].Rv, (w * L) / 4);
    near(s.reactions[0].Rv, (3 * w * L) / 4);
    near(s.reactions[0].Rm, (w * L * L) / 4);
    near(s.at(L / 2).M, 0, w * L * L);
    near(s.extremes.Mmax.value, (w * L * L) / 32);
    near(s.extremes.Mmax.x, (3 * L) / 4, L, 1e-7);
    // The hinge drops as the tip of a cantilever carrying the half beam's reaction.
    near(s.at(L / 2).EIv, (-7 * w * L ** 4) / 384);
    // …and the slope is not the same on its two sides.
    expect(Math.abs(s.at(L / 2, 'left').EItheta - s.at(L / 2, 'right').EItheta)).toBeGreaterThan(1);
  });

  it('a two-span beam with a hinge in the second span is the textbook Gerber beam', () => {
    // Supports at 0, 20, 36; hinge at 26; a point load on the suspended part.
    const s = solved({ L: 36, supports: [{ x: 0, kind: 'pin' }, { x: 20, kind: 'roller' }, { x: 36, kind: 'roller' }], hinges: [26], points: [{ x: 31, P }] });
    // The part from the hinge to the last support is a 10-long simple beam with the load at its middle.
    near(s.reactions[2].Rv, P / 2);
    // Its other half, P/2, comes down on the overhang at 26: moments about the first support.
    near(s.reactions[1].Rv, ((P / 2) * 26) / 20);
    near(s.reactions[0].Rv, P / 2 - ((P / 2) * 26) / 20);
    near(s.at(26).M, 0, P * 36);
    near(s.at(20).M, (-(P / 2) * 6));
  });

  it('fixed ends take one hinge or two; a third makes a mechanism', () => {
    const ends = [{ x: 0, kind: 'fixed' as const }, { x: L, kind: 'fixed' as const }];
    const load = { dists: [{ x1: 0, x2: L, w1: w, w2: w }] };
    expect(solveBeam({ L, supports: ends, hinges: [8], ...load }).ok).toBe(true);
    const two = solved({ L, supports: ends, hinges: [6, 18], ...load });
    near(two.at(6).M, 0, w * L * L);
    near(two.at(18).M, 0, w * L * L);
    // Between the hinges: a 12-long simple beam; each cantilever carries its end reaction.
    near(two.extremes.Mmax.value, (w * 12 * 12) / 8);
    near(two.extremes.Mmin.value, -((w * 6 * 6) / 2 + ((w * 12) / 2) * 6));
    expect(issuesOf({ L, supports: ends, hinges: [6, 12, 18], ...load })).toEqual(['unstable']);
  });

  it('a hinge over a pin support is allowed, and the beam is two simple spans', () => {
    const s = solved({ L: 2 * L, supports: [{ x: 0, kind: 'pin' }, { x: L, kind: 'pin' }, { x: 2 * L, kind: 'roller' }], hinges: [L], dists: [{ x1: 0, x2: 2 * L, w1: w, w2: w }] });
    near(s.reactions[0].Rv, (w * L) / 2);
    near(s.reactions[1].Rv, w * L);
    near(s.at(L).M, 0, w * L * L);
    near(s.extremes.Mmax.value, (w * L * L) / 8);
  });
});

describe('beam: what cannot be solved, and why', () => {
  const load = { points: [{ x: L / 2, P }] };
  it('says so when the supports do not hold the beam', () => {
    expect(issuesOf({ L, supports: [], ...load })).toEqual(['no-supports']);
    expect(issuesOf({ L, supports: [{ x: 4, kind: 'pin' }], ...load })).toEqual(['unstable']);
    expect(issuesOf({ L, supports: SS, hinges: [10], ...load })).toEqual(['unstable']);
    expect(issuesOf({ L, supports: [{ x: 0, kind: 'fixed' }], hinges: [10], ...load })).toEqual(['unstable']);
    // Two supports at the same point are one support.
    expect(issuesOf({ L, supports: [{ x: 5, kind: 'pin' }, { x: 5, kind: 'roller' }], ...load })).toEqual(['unstable']);
    // …unless one of them is fixed.
    expect(solveBeam({ L, supports: [{ x: 5, kind: 'pin' }, { x: 5, kind: 'fixed' }], ...load }).ok).toBe(true);
  });

  it('supports too close to tell apart are named as that — the beam they hold is not a mechanism', () => {
    // A wall, and three supports within a millionth of the span of each other
    // (found by comparing ten thousand random beams with another method). The
    // beam is held; the arithmetic cannot separate the three reactions.
    const crowded: BeamModel = {
      L: 55.34,
      supports: [
        { x: 0.00006275254157410934, kind: 'fixed' },
        { x: 28.5, kind: 'roller' },
        { x: 28.493997010061328, kind: 'pin' },
        { x: 28.50005534, kind: 'pin' },
      ],
      points: [
        { x: 15, P: 89.5771865218939 },
        { x: 0, P: 248.7681396290434 },
      ],
      couples: [
        { x: 28.493997010061328, M: -2376.5708656124852 },
        { x: 55.33910919609746, M: -14987.467592860385 },
        { x: 5.15, M: 17656.00711937588 },
      ],
    };
    expect(issuesOf(crowded)).toEqual(['close-supports']);
    // The same beam with the crowd thinned to one support is solved.
    expect(solveBeam({ ...crowded, supports: crowded.supports.slice(0, 2) }).ok).toBe(true);
    // A real mechanism is still called one, however its supports are spaced.
    expect(issuesOf({ L, supports: [{ x: 4, kind: 'pin' }], ...load })).toEqual(['unstable']);
    expect(issuesOf({ L, supports: SS, hinges: [10], ...load })).toEqual(['unstable']);
  });

  it('is unstable with no load on it too: the supports decide, not the loads', () => {
    expect(issuesOf({ L, supports: [{ x: 4, kind: 'pin' }] })).toEqual(['unstable']);
    const idle = solved({ L, supports: SS });
    near(idle.extremes.Mmax.value, 0);
    idle.reactions.forEach((r) => near(r.Rv, 0));
  });

  it('names the entry that is wrong', () => {
    expect(issuesOf({ L: 0, supports: SS })).toEqual(['length']);
    expect(issuesOf({ L: Number.NaN, supports: SS })).toEqual(['length']);
    const out = solveBeam({ L, supports: SS, points: [{ x: 3, P }, { x: 30, P }], dists: [{ x1: 0, x2: Number.NaN, w1: 1, w2: 1 }] });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.issues).toEqual([
        { code: 'outside', where: { list: 'points', index: 1 } },
        { code: 'number', where: { list: 'dists', index: 0 } },
      ]);
    }
    expect(issuesOf({ L, supports: SS, hinges: [0] })).toEqual(['hinge-at-end']);
    expect(issuesOf({ L, supports: SS, hinges: [L] })).toEqual(['hinge-at-end']);
    expect(issuesOf({ L, supports: [{ x: 0, kind: 'pin' }, { x: 12, kind: 'fixed' }], hinges: [12] })).toEqual(['hinge-at-fixed']);
    expect(issuesOf({ L, supports: [{ x: 0, kind: 'fixed' }, { x: L, kind: 'roller' }], hinges: [12], couples: [{ x: 12, M: 5 }] })).toEqual(['couple-at-hinge']);
  });

  it('takes a distributed load entered right to left, and ignores one of no length or no intensity', () => {
    const a = solved({ L, supports: SS, dists: [{ x1: 4, x2: 16, w1: 1, w2: 3 }] });
    const b = solved({ L, supports: SS, dists: [{ x1: 16, x2: 4, w1: 3, w2: 1 }, { x1: 8, x2: 8, w1: 9, w2: 9 }, { x1: 2, x2: 9, w1: 0, w2: 0 }] });
    near(b.reactions[0].Rv, a.reactions[0].Rv);
    near(b.extremes.Mmax.value, a.extremes.Mmax.value);
    expect(b.breaks).toEqual(a.breaks);
  });
});

describe('beam: where a load sits cannot spoil the answer', () => {
  it('a load a millionth of the span from a support is still the textbook value', () => {
    for (const eps of [1e-3, 1e-6, 1e-8]) {
      const a = L * eps;
      const b = L - a;
      const s = solved({ L, supports: SS, points: [{ x: a, P }] });
      near(s.reactions[0].Rv, (P * b) / L);
      near(s.extremes.Mmax.value, (P * a * b) / L, P * L);
      near(s.at(L / 2).EIv, (-P * a * (3 * L * L - 4 * a * a)) / 48, P * L ** 3);
    }
  });

  it('a very short, very heavy distributed load is the point load it adds up to', () => {
    const c = 10;
    const len = 1e-5;
    const s = solved({ L, supports: SS, dists: [{ x1: c - len / 2, x2: c + len / 2, w1: P / len, w2: P / len }] });
    const p = solved({ L, supports: SS, points: [{ x: c, P }] });
    near(s.reactions[0].Rv, p.reactions[0].Rv, P, 1e-8);
    near(s.extremes.EIvMin.value, p.extremes.EIvMin.value, P * L ** 3, 1e-8);
  });

  it('the answer does not depend on the unit of length', () => {
    const feet = solved({ L, supports: [{ x: 0, kind: 'fixed' }, { x: 16, kind: 'roller' }], points: [{ x: 20, P }], dists: [{ x1: 2, x2: 12, w1: w, w2: 2 * w }] });
    const k = 12;
    const inches = solved({ L: L * k, supports: [{ x: 0, kind: 'fixed' }, { x: 16 * k, kind: 'roller' }], points: [{ x: 20 * k, P }], dists: [{ x1: 2 * k, x2: 12 * k, w1: w / k, w2: (2 * w) / k }] });
    near(inches.reactions[1].Rv, feet.reactions[1].Rv);
    near(inches.reactions[0].Rm, feet.reactions[0].Rm * k, Math.abs(feet.reactions[0].Rm * k));
    near(inches.extremes.Mmin.value, feet.extremes.Mmin.value * k, Math.abs(feet.extremes.Mmin.value * k));
    near(inches.extremes.EIvMin.value, feet.extremes.EIvMin.value * k ** 3, Math.abs(feet.extremes.EIvMin.value * k ** 3));
    near(inches.extremes.EIvMin.x, feet.extremes.EIvMin.x * k, L * k, 1e-7);
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

/** A stable beam with no hinge: one wall, or two to four supports. */
function randomBeam(seed: number): BeamModel {
  const r = mulberry32(seed);
  const len = 4 + r() * 40;
  const pos = () => Math.round(r() * len * 100) / 100;
  const kinds = ['pin', 'roller', 'fixed'] as const;
  const n = 1 + Math.floor(r() * 4);
  const supports =
    n === 1
      ? [{ x: r() < 0.5 ? 0 : len, kind: 'fixed' as const }]
      : Array.from({ length: n }, (_, i) => ({ x: Math.round((((i + r() * 0.8) * len) / n) * 100) / 100, kind: kinds[Math.floor(r() * 3)] }));
  const load = () => Math.round((r() * 20 - 6) * 100) / 100;
  return {
    L: len,
    supports,
    points: Array.from({ length: Math.floor(r() * 4) }, () => ({ x: pos(), P: load() })),
    couples: Array.from({ length: Math.floor(r() * 3) }, () => ({ x: pos(), M: load() * 3 })),
    dists: Array.from({ length: Math.floor(r() * 3) }, () => {
      const a = pos();
      const b = pos();
      return { x1: Math.min(a, b), x2: Math.max(a, b) + 0.5 > len ? len : Math.max(a, b) + 0.5, w1: load() / 4, w2: load() / 4 };
    }),
  };
}

const SEEDS = Array.from({ length: 60 }, (_, i) => 1000 + i * 7);
const loadScale = (m: BeamModel) =>
  Math.max(1, ...(m.points ?? []).map((p) => Math.abs(p.P)), ...(m.dists ?? []).map((d) => (Math.abs(d.w1) + Math.abs(d.w2)) * m.L), ...(m.couples ?? []).map((c) => Math.abs(c.M) / m.L));

describe('beam: what is true of every beam (60 random ones)', () => {
  it('is in equilibrium, and nothing is left past either end', () => {
    for (const seed of SEEDS) {
      const m = randomBeam(seed);
      const s = solved(m);
      const F = loadScale(m);
      near(s.residual.force, 0, F, 1e-8);
      near(s.residual.moment, 0, F * m.L, 1e-8);
      expect(s.at(0, 'left')).toMatchObject({ V: 0, M: 0 });
      near(s.at(m.L, 'right').V, 0, F, 1e-8);
      near(s.at(m.L, 'right').M, 0, F * m.L, 1e-8);
    }
  });

  it('does not move at a support, nor turn at a fixed one', () => {
    for (const seed of SEEDS) {
      const m = randomBeam(seed);
      const s = solved(m);
      const F = loadScale(m);
      for (const r of s.reactions) {
        near(s.at(r.x).EIv, 0, F * m.L ** 3, 1e-9);
        if (r.kind === 'fixed') near(s.at(r.x).EItheta, 0, F * m.L ** 2, 1e-9);
        else expect(r.Rm).toBe(0);
      }
    }
  });

  it('each diagram is the derivative of the next: V′ = −w, M′ = V, EIθ′ = M, EIv′ = EIθ', () => {
    for (const seed of SEEDS) {
      const m = randomBeam(seed);
      const s = solved(m);
      const F = loadScale(m);
      const r = mulberry32(seed + 5);
      for (let i = 0; i < 12; i++) {
        const x = (0.02 + 0.96 * r()) * m.L;
        const h = m.L * 1e-4;
        // Away from every break, where the derivative is not defined.
        if (s.breaks.some((b) => Math.abs(b - x) < 3 * h)) continue;
        const [a, c, b] = [s.at(x - h), s.at(x), s.at(x + h)];
        const d = (p: number, q: number) => (q - p) / (2 * h);
        near(d(a.V, b.V), -c.w, F / m.L, 1e-5);
        near(d(a.M, b.M), c.V, F, 1e-5);
        near(d(a.EItheta, b.EItheta), c.M, F * m.L, 1e-5);
        near(d(a.EIv, b.EIv), c.EItheta, F * m.L ** 2, 1e-5);
      }
    }
  });

  it('adds up: two sets of loads together are the two answers added', () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const base = randomBeam(seed);
      const other = randomBeam(seed + 1);
      const k = base.L / other.L;
      const extra = {
        points: (other.points ?? []).map((p) => ({ x: p.x * k, P: p.P })),
        couples: (other.couples ?? []).map((c) => ({ x: c.x * k, M: c.M })),
        dists: (other.dists ?? []).map((d) => ({ x1: d.x1 * k, x2: d.x2 * k, w1: d.w1, w2: d.w2 })),
      };
      const a = solved(base);
      const b = solved({ L: base.L, supports: base.supports, ...extra });
      const both = solved({
        L: base.L,
        supports: base.supports,
        points: [...(base.points ?? []), ...extra.points],
        couples: [...(base.couples ?? []), ...extra.couples],
        dists: [...(base.dists ?? []), ...extra.dists],
      });
      const F = loadScale(base) + loadScale({ ...base, ...extra });
      for (const t of [0.13, 0.37, 0.5, 0.71, 0.94]) {
        const x = t * base.L;
        near(both.at(x).V, a.at(x).V + b.at(x).V, F, 1e-8);
        near(both.at(x).M, a.at(x).M + b.at(x).M, F * base.L, 1e-8);
        near(both.at(x).EIv, a.at(x).EIv + b.at(x).EIv, F * base.L ** 3, 1e-8);
      }
    }
  });

  it('mirrors: the same beam seen from the other side', () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const m = randomBeam(seed);
      const flip = (x: number) => m.L - x;
      const mirrored: BeamModel = {
        L: m.L,
        supports: m.supports.map((s) => ({ x: flip(s.x), kind: s.kind })),
        points: (m.points ?? []).map((p) => ({ x: flip(p.x), P: p.P })),
        couples: (m.couples ?? []).map((c) => ({ x: flip(c.x), M: -c.M })),
        dists: (m.dists ?? []).map((d) => ({ x1: flip(d.x2), x2: flip(d.x1), w1: d.w2, w2: d.w1 })),
      };
      const a = solved(m);
      const b = solved(mirrored);
      const F = loadScale(m);
      for (const t of [0.11, 0.29, 0.5, 0.63, 0.87]) {
        const x = t * m.L;
        if (a.breaks.some((p) => Math.abs(p - x) < 1e-6 * m.L)) continue;
        near(b.at(flip(x)).V, -a.at(x).V, F, 1e-8);
        near(b.at(flip(x)).M, a.at(x).M, F * m.L, 1e-8);
        near(b.at(flip(x)).EIv, a.at(x).EIv, F * m.L ** 3, 1e-8);
        near(b.at(flip(x)).EItheta, -a.at(x).EItheta, F * m.L ** 2, 1e-8);
      }
      const Rm = (s: BeamSolution) => s.reactions.map((r) => r.Rm).sort((p, q) => p - q);
      Rm(b).forEach((v, i) => near(v, -Rm(a).reverse()[i], F * m.L, 1e-8));
    }
  });

  it('reports extremes that no point of the beam exceeds', () => {
    for (const seed of SEEDS) {
      const m = randomBeam(seed);
      const s = solved(m);
      const F = loadScale(m);
      const e = s.extremes;
      for (let i = 0; i <= 500; i++) {
        for (const side of ['left', 'right'] as const) {
          const st = s.at((i / 500) * m.L, side);
          expect(st.V).toBeLessThanOrEqual(e.Vmax.value + 1e-7 * F);
          expect(st.V).toBeGreaterThanOrEqual(e.Vmin.value - 1e-7 * F);
          expect(st.M).toBeLessThanOrEqual(e.Mmax.value + 1e-7 * F * m.L);
          expect(st.M).toBeGreaterThanOrEqual(e.Mmin.value - 1e-7 * F * m.L);
          expect(st.EIv).toBeLessThanOrEqual(e.EIvMax.value + 1e-7 * F * m.L ** 3);
          expect(st.EIv).toBeGreaterThanOrEqual(e.EIvMin.value - 1e-7 * F * m.L ** 3);
        }
      }
      // …and each is the value at the place it names.
      const hit = (x: number, of: (st: ReturnType<BeamSolution['at']>) => number, value: number, scale: number) =>
        expect(Math.min(Math.abs(of(s.at(x, 'left')) - value), Math.abs(of(s.at(x, 'right')) - value))).toBeLessThanOrEqual(1e-9 * scale);
      hit(e.Vmax.x, (st) => st.V, e.Vmax.value, F);
      hit(e.Mmax.x, (st) => st.M, e.Mmax.value, F * m.L);
      hit(e.Mmin.x, (st) => st.M, e.Mmin.value, F * m.L);
      hit(e.EIvMin.x, (st) => st.EIv, e.EIvMin.value, F * m.L ** 3);
    }
  }, 30_000);
});

describe('beam: the extremes are values the beam takes', () => {
  // Found by an independent solver run against this one: a cantilever
  // lifted at its tip, whose shear is negative from end to end, reported a
  // largest shear of ZERO — the value past the tip, read there because the
  // moment's last root landed on the end of the beam.
  it('a shear diagram that never reaches zero has no zero among its extremes', () => {
    const s = solved({
      L: 1.61,
      supports: [{ x: 0, kind: 'fixed' }],
      points: [{ x: 1.61, P: -41874.68661041406 }],
      couples: [
        { x: 0.51, M: 0.000277692789492358 },
        { x: 1.3507359656854534, M: 0.000014529069667974629 },
        { x: 0, M: 0.00668191396617265 },
      ],
      dists: [
        { x1: 0.5523996576084755, x2: 1.5931698641898344, w1: 108.3014456861793, w2: 29.802115712055922 },
        { x1: 1.47, x2: 1.61, w1: 68049.7961524316, w2: 0 },
      ],
    });
    expect(s.extremes.Vmax.value).toBeLessThan(-30000);
    near(s.extremes.Vmax.value, -37039.33384368081, 37039, 1e-9);
    // The largest is at the wall, where the shear is the reaction; the
    // smallest just short of the tip, where it is the load that lifts it.
    near(s.extremes.Vmax.value, s.reactions[0].Rv, 41874, 1e-9);
    near(s.extremes.Vmax.x, 0);
    near(s.extremes.Vmin.value, -41874.68661041406, 41874, 1e-9);
  });

  it('on sixty random beams, every extreme is reached at a station or between two of them', () => {
    for (const seed of SEEDS) {
      const m = randomBeam(seed);
      const s = solved(m);
      const F = loadScale(m);
      const top = (of: (st: (typeof s.stations)[number]) => number) => Math.max(...s.stations.map(of));
      const bottom = (of: (st: (typeof s.stations)[number]) => number) => Math.min(...s.stations.map(of));
      const e = s.extremes;
      // The stations are all inside the beam, on the inner side of every
      // break; an extreme can beat the best of them only by what a curve
      // rises between two neighbours.
      expect(e.Vmax.value, `seed ${seed}`).toBeLessThanOrEqual(top((st) => st.V) + 1e-3 * F);
      expect(e.Vmin.value, `seed ${seed}`).toBeGreaterThanOrEqual(bottom((st) => st.V) - 1e-3 * F);
      expect(e.Mmax.value, `seed ${seed}`).toBeLessThanOrEqual(top((st) => st.M) + 1e-3 * F * m.L);
      expect(e.Mmin.value, `seed ${seed}`).toBeGreaterThanOrEqual(bottom((st) => st.M) - 1e-3 * F * m.L);
      expect(e.EIvMax.value, `seed ${seed}`).toBeLessThanOrEqual(top((st) => st.EIv) + 1e-3 * F * m.L ** 3);
      expect(e.EIvMin.value, `seed ${seed}`).toBeGreaterThanOrEqual(bottom((st) => st.EIv) - 1e-3 * F * m.L ** 3);
    }
  });
});

describe('beam: a second opinion — the finite-element solver this engine replaces', () => {
  // lib/beam-analysis solves the same beams by direct stiffness on a fine
  // mesh: another method, written at another time. Its conventions:
  // deflection positive DOWNWARD; everything else as here. It is the looser
  // of the two: a load a hundredth of a foot from a support gives it a
  // hair-long element, and its stiffness matrix loses digits with it (the
  // reason this engine has no mesh) — hence a tolerance of two in a thousand
  // where the checks above hold to rounding.
  it('agrees on reactions, shear, moment and deflection', () => {
    let compared = 0;
    for (const seed of SEEDS) {
      const m = randomBeam(seed);
      const s = solved(m);
      const EI = 1;
      const fe = analyzeBeam({
        L: m.L,
        EI,
        supports: m.supports.map((p) => ({ pos: p.x, type: p.kind })),
        points: (m.points ?? []).map((p) => ({ pos: p.x, P: p.P })),
        moments: (m.couples ?? []).map((c) => ({ pos: c.x, M: c.M })),
        dists: (m.dists ?? []).filter((d) => d.x2 - d.x1 > 1e-9).map((d) => ({ x1: d.x1, x2: d.x2, w1: d.w1, w2: d.w2 })),
      });
      if (!fe.stable) continue;
      // Supports that share a position are merged here and not there.
      if (new Set(m.supports.map((p) => p.x)).size !== m.supports.length) continue;
      compared += 1;
      const F = loadScale(m);
      const byX = [...m.supports].map((p, i) => ({ x: p.x, fe: fe.reactions[i] })).sort((p, q) => p.x - q.x);
      s.reactions.forEach((r, i) => near(r.Rv, byX[i].fe.Rv, F, 2e-3));
      const r = mulberry32(seed + 11);
      for (let i = 0; i < 10; i++) {
        const x = (0.03 + 0.94 * r()) * m.L;
        if (s.breaks.some((b) => Math.abs(b - x) < 2e-3 * m.L)) continue;
        // Its nearest station.
        let k = 0;
        for (let j = 1; j < fe.x.length; j++) if (Math.abs(fe.x[j] - x) < Math.abs(fe.x[k] - x)) k = j;
        const st = s.at(fe.x[k]);
        near(st.V, fe.shear[k], F, 2e-3);
        near(st.M, fe.moment[k], F * m.L, 2e-3);
        near(-st.EIv / EI, fe.deflection[k], F * m.L ** 3, 2e-3);
      }
    }
    // Most of the sixty must actually have been compared.
    expect(compared).toBeGreaterThan(45);
    // (The time is the old solver's: a dense 400 × 400 elimination per beam.)
  }, 60_000);
});

describe('beam: spans, for a deflection limit', () => {
  it('lists each span and each overhang with its own largest deflection', () => {
    const s = solved({ L: 30, supports: [{ x: 4, kind: 'pin' }, { x: 22, kind: 'roller' }], dists: [{ x1: 0, x2: 30, w1: w, w2: w }] });
    const spans = beamSpans(s);
    expect(spans.map((p) => [p.from, p.to, p.kind])).toEqual([
      [0, 4, 'cantilever'],
      [4, 22, 'span'],
      [22, 30, 'cantilever'],
    ]);
    for (const p of spans) {
      expect(p.EIv.x).toBeGreaterThanOrEqual(p.from);
      expect(p.EIv.x).toBeLessThanOrEqual(p.to);
      near(s.at(p.EIv.x).EIv, p.EIv.value, Math.abs(p.EIv.value));
    }
    // The overhangs' largest deflection is at their tips.
    near(spans[0].EIv.x, 0);
    near(spans[2].EIv.x, 30);
  });

  it('a simple span is one span, and its deflection is the beam’s', () => {
    const s = solved({ L, supports: SS, points: [{ x: 15, P }] });
    const spans = beamSpans(s);
    expect(spans).toHaveLength(1);
    near(spans[0].EIv.value, s.extremes.EIvMin.value);
    near(spans[0].EIv.x, s.extremes.EIvMin.x, L, 1e-7);
  });

  it('a cantilever is one overhang', () => {
    const s = solved({ L, supports: [{ x: 0, kind: 'fixed' }], points: [{ x: L, P }] });
    expect(beamSpans(s).map((p) => [p.from, p.to, p.kind])).toEqual([[0, L, 'cantilever']]);
  });
});
