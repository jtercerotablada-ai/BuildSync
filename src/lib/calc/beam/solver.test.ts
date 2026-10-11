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
/** What is wrong with it: each issue whole, with the entry it names. */
const refusal = (model: BeamModel) => {
  const out = solveBeam(model);
  return out.ok ? [] : out.issues;
};
const issuesOf = (model: BeamModel) => refusal(model).map((i) => i.code);
/** Every number a solution holds: the reactions, the extremes, the stations, each span's deflection, what is left over. */
const numbersOf = (s: BeamSolution): number[] => [
  s.totalLoad,
  s.residual.force,
  s.residual.moment,
  ...s.breaks,
  ...s.reactions.flatMap((r) => [r.x, r.Rv, r.Rm]),
  ...Object.values(s.extremes).flatMap((e) => [e.value, e.x]),
  ...s.stations.flatMap((st) => [st.x, st.w, st.V, st.M, st.EItheta, st.EIv]),
  ...beamSpans(s).flatMap((p) => [p.EIv.value, p.EIv.x]),
];
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
    // …and the slope is not the same on its two sides. On the left, the tip
    // of that cantilever: wa³/6 + (wL/4)a²/2 with a = L/2. On the right, a
    // simple span whose left end has dropped: the chord, 7wL³/192, less its
    // own end slope, wL³/192.
    near(s.at(L / 2, 'left').EItheta, (-5 * w * L ** 3) / 96);
    near(s.at(L / 2, 'right').EItheta, (w * L ** 3) / 32);
    near(s.at(L).EItheta, (w * L ** 3) / 24);
    // The deflection is the integral of that slope on both sides of the hinge.
    const h = L * 1e-4;
    for (const x of [L * 0.3, L * 0.7, L * 0.9]) near((s.at(x + h).EIv - s.at(x - h).EIv) / (2 * h), s.at(x).EItheta, w * L ** 3, 1e-6);
  });

  it('fixed at both ends with a hinge at midspan is two cantilevers: moments, deflection and both slopes', () => {
    const s = solved({ L, supports: [{ x: 0, kind: 'fixed' }, { x: L, kind: 'fixed' }], hinges: [L / 2], dists: [{ x1: 0, x2: L, w1: w, w2: w }] });
    near(s.reactions[0].Rv, (w * L) / 2);
    near(s.reactions[1].Rv, (w * L) / 2);
    near(s.reactions[0].Rm, (w * L * L) / 8);
    near(s.reactions[1].Rm, (-w * L * L) / 8);
    near(s.at(L / 2).M, 0, w * L * L);
    near(s.at(L / 2).EIv, (-w * L ** 4) / 128);
    near(s.at(L / 2, 'left').EItheta, (-w * L ** 3) / 48);
    near(s.at(L / 2, 'right').EItheta, (w * L ** 3) / 48);
  });

  it('fixed at both ends with one hinge off centre: the shear the hinge passes, by compatibility', () => {
    // Hinge at a, a load P on the left part at c < a. The two cantilever
    // tips meet at the hinge: Pc²(3a − c)/6 − Xa³/3 = Xb³/3.
    const a = 9;
    const b = L - a;
    const c = 5;
    const X = (P * c * c * (3 * a - c)) / 6 / (a ** 3 / 3 + b ** 3 / 3);
    const s = solved({ L, supports: [{ x: 0, kind: 'fixed' }, { x: L, kind: 'fixed' }], hinges: [a], points: [{ x: c, P }] });
    near(s.reactions[1].Rv, X);
    near(s.reactions[0].Rv, P - X);
    near(s.reactions[1].Rm, -X * b);
    near(s.reactions[0].Rm, P * c - X * a);
    near(s.at(a).EIv, (-X * b ** 3) / 3);
    near(s.at(a, 'right').EItheta, (X * b * b) / 2);
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
    // …unless one of them is fixed, whichever of the two is listed first.
    const fixedLast = solved({ L, supports: [{ x: 5, kind: 'pin' }, { x: 5, kind: 'fixed' }], points: [{ x: 20, P }] });
    const fixedFirst = solved({ L, supports: [{ x: 5, kind: 'fixed' }, { x: 5, kind: 'pin' }], points: [{ x: 20, P }] });
    for (const s of [fixedLast, fixedFirst]) {
      expect(s.reactions.map((r) => r.kind)).toEqual(['fixed']);
      near(s.reactions[0].Rm, P * 15);
    }
  });

  it('a mechanism is called one however close or far apart its supports are', () => {
    // A pin and a roller one foot apart with a hinge between them: the beam folds at the hinge.
    expect(issuesOf({ L, supports: [{ x: 10, kind: 'pin' }, { x: 11, kind: 'roller' }], hinges: [10.5], points: [{ x: 20, P }] })).toEqual(['unstable']);
    // Three supports, one of them a twentieth of the span from the next, and three hinges too many.
    expect(issuesOf({ L, supports: [{ x: 0, kind: 'pin' }, { x: 1.2, kind: 'roller' }, { x: 24, kind: 'roller' }], hinges: [6, 12, 18], points: [{ x: 20, P }] })).toEqual(['unstable']);
    // Two supports a hair apart do clamp the beam where they stand — and the
    // part past the hinge at 15 hangs on nothing all the same. "Too close
    // together" was said of this one, and moving a support does not cure it.
    expect(refusal({ L, supports: [{ x: 10, kind: 'pin' }, { x: 10.01, kind: 'roller' }], hinges: [15], points: [{ x: 20, P }] })).toEqual([{ code: 'unstable' }]);
    expect(issuesOf({ L: 20, supports: [{ x: 10, kind: 'pin' }, { x: 10.01, kind: 'pin' }], hinges: [15], points: [{ x: 18, P: 10 }] })).toEqual(['unstable']);
    expect(issuesOf({ L: 20, supports: [{ x: 0, kind: 'fixed' }, { x: 0.01, kind: 'roller' }, { x: 20, kind: 'roller' }], hinges: [5, 10], points: [{ x: 18, P: 10 }] })).toEqual(['unstable']);
    expect(issuesOf({ L, supports: [{ x: 0, kind: 'fixed' }, { x: 12, kind: 'roller' }, { x: 12.01, kind: 'roller' }, { x: 24, kind: 'fixed' }], hinges: [3, 6, 9, 15, 18, 21], points: [{ x: 20, P }] })).toEqual(['unstable']);
    // A hinge BETWEEN the two: they hold two different pieces, one point each.
    expect(issuesOf({ L, supports: [{ x: 10, kind: 'pin' }, { x: 10.01, kind: 'roller' }], hinges: [10.005], points: [{ x: 20, P }] })).toEqual(['unstable']);
    // A pin UNDER a hinge holds that one point of both pieces: the piece on
    // the left has nothing else, and swings about it.
    expect(issuesOf({ L, supports: [{ x: 8, kind: 'pin' }, { x: 16, kind: 'roller' }, { x: L, kind: 'roller' }], hinges: [8], points: [{ x: 20, P }] })).toEqual(['unstable']);
    // Hinges a hair apart, and one too many of them.
    expect(issuesOf({ L: 20, supports: [{ x: 0, kind: 'fixed' }, { x: 20, kind: 'fixed' }], hinges: [8, 8.000002, 14], points: [{ x: 18, P: 10 }] })).toEqual(['unstable']);
  });

  it('a piece held by one support and the pin under its far hinge holds up the piece that leans on it', () => {
    // Pins at 2, 9, 12 and a roller at 20; hinges at 6 and at 12, over the
    // pin. The first piece overhangs its pin by 2 and hangs from the second,
    // which stands on the pin at 9 and the one under the hinge. A load P on
    // the tip: 1.5P at 2 and 0.5P down through the hinge at 6; that lifts
    // the second piece, −P at 9 and 0.5P at 12; nothing reaches the third.
    const s = solved({ L, supports: [{ x: 2, kind: 'pin' }, { x: 9, kind: 'pin' }, { x: 12, kind: 'pin' }, { x: 20, kind: 'roller' }], hinges: [6, 12], points: [{ x: 0, P }] });
    [1.5 * P, -P, 0.5 * P, 0].forEach((R, i) => near(s.reactions[i].Rv, R));
    // …and the same beam seen from the other end.
    const m = solved({ L, supports: [{ x: 4, kind: 'roller' }, { x: 12, kind: 'pin' }, { x: 15, kind: 'pin' }, { x: 22, kind: 'pin' }], hinges: [12, 18], points: [{ x: L, P }] });
    [0, 0.5 * P, -P, 1.5 * P].forEach((R, i) => near(m.reactions[i].Rv, R));
  });

  it('a mechanism that rounding hid: three hinges in a row with no support between them', () => {
    // Found by comparing random beams with another method: two of the hinges
    // are a ten-millionth of the span apart, and the elimination went
    // through and returned five finite reactions.
    const hidden: BeamModel = {
      L: 1.28,
      supports: [
        { x: 0, kind: 'fixed' },
        { x: 0.4185263233387578, kind: 'roller' },
        { x: 0.8464473021030426, kind: 'roller' },
        { x: 1.27999872, kind: 'roller' },
        { x: 1.28, kind: 'fixed' },
      ],
      hinges: [0.119999872, 0.12, 0.41852592021226886],
      dists: [{ x1: 0, x2: 1.28, w1: w, w2: w }],
    };
    expect(issuesOf(hidden)).toEqual(['unstable']);
    // The same with the hinges at round places.
    expect(issuesOf({ ...hidden, supports: [{ x: 0, kind: 'fixed' }, { x: 0.5, kind: 'roller' }, { x: 0.85, kind: 'roller' }, { x: 1.28, kind: 'fixed' }], hinges: [0.1, 0.2, 0.4] })).toEqual(['unstable']);
  });

  const udl20 = { dists: [{ x1: 0, x2: 20, w1: 1.2, w2: 1.2 }] };
  it('two supports closer than a thousandth of the length are refused, and the one further right is named', () => {
    // Each of these was SOLVED, and wrongly: the pair's two reactions are a
    // difference of nearly equal numbers, their sum stays right, and nothing
    // in the solution showed it. (a) printed 15.29 and −0.29 where the beam
    // has 15.00 and +0.00009.
    const a: BeamModel = { L: 20, supports: [{ x: 0, kind: 'pin' }, { x: 19.9998, kind: 'fixed' }, { x: 20, kind: 'pin' }], ...udl20 };
    expect(refusal(a)).toEqual([{ code: 'close-supports', where: { list: 'supports', index: 2 } }]);
    // (b) 7.698 and 7.302 for 7.5003 and 7.4999.
    const b: BeamModel = { L: 20, supports: [{ x: 0, kind: 'pin' }, { x: 10, kind: 'fixed' }, { x: 10.0005, kind: 'fixed' }, { x: 20, kind: 'pin' }], ...udl20 };
    expect(refusal(b)).toEqual([{ code: 'close-supports', where: { list: 'supports', index: 2 } }]);
    // (c) 10.88 and 4.121 for 10.5 and 4.5.
    const c: BeamModel = { L: 20, supports: [{ x: 0, kind: 'pin' }, { x: 10, kind: 'roller' }, { x: 10.000002, kind: 'roller' }, { x: 20, kind: 'roller' }], ...udl20 };
    expect(refusal(c)).toEqual([{ code: 'close-supports', where: { list: 'supports', index: 2 } }]);
    // The governing reaction 15% low: 8.074 for 9.5057.
    const d: BeamModel = { L: 20, supports: [{ x: 4, kind: 'fixed' }, { x: 4.0002, kind: 'fixed' }, { x: 20, kind: 'roller' }], points: [{ x: 7, P: 10 }] };
    expect(refusal(d)).toEqual([{ code: 'close-supports', where: { list: 'supports', index: 1 } }]);
    // The entry named is the caller's own, in whatever order the supports came.
    expect(refusal({ ...a, supports: [a.supports[2], a.supports[0], a.supports[1]] })).toEqual([{ code: 'close-supports', where: { list: 'supports', index: 0 } }]);
    // A hinge on one of the two changes nothing: the part to its right still rests on both.
    expect(issuesOf({ L: 20, supports: [{ x: 0, kind: 'pin' }, { x: 10, kind: 'pin' }, { x: 10.01, kind: 'pin' }], hinges: [10], points: [{ x: 15, P: 10 }] })).toEqual(['close-supports']);
  });

  it('a hinge BETWEEN two supports that close changes nothing either: the rule is about two supports next to each other', () => {
    // Rollers 0.08 ft either side of a hinge on a 200 ft beam, 8e-4 of the
    // length apart. They hold two different pieces, each with a support of
    // its own far away, and this beam was being solved, and right. It is
    // refused because the same two with a wall among them were solved wrong
    // (see CLOSE in the engine): one rule, with no exception to measure.
    const split: BeamModel = {
      L: 200,
      supports: [{ x: 0, kind: 'pin' }, { x: 99.92, kind: 'roller' }, { x: 100.08, kind: 'roller' }, { x: 200, kind: 'roller' }],
      hinges: [100],
      dists: [{ x1: 0, x2: 200, w1: 2, w2: 2 }],
      points: [{ x: 60, P: 25 }],
    };
    expect(refusal(split)).toEqual([{ code: 'close-supports', where: { list: 'supports', index: 2 } }]);
    // A thousandth of the length apart they are far enough, hinge or no
    // hinge: solved, and the four reactions carry the 425 kip on the beam.
    const apart = solved({ ...split, supports: [split.supports[0], { x: 99.9, kind: 'roller' }, { x: 100.1, kind: 'roller' }, split.supports[3]] });
    near(apart.reactions.reduce((sum, r) => sum + r.Rv, 0), 2 * 200 + 25);
  });

  it('a crowd of supports: each one too close to the one before it is named', () => {
    // A wall, and three supports within a ten-thousandth of the span (found
    // by comparing ten thousand random beams with another method).
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
    expect(refusal(crowded)).toEqual([
      { code: 'close-supports', where: { list: 'supports', index: 1 } },
      { code: 'close-supports', where: { list: 'supports', index: 3 } },
    ]);
    // Held by the crowd alone, it is still held: not a mechanism.
    expect(issuesOf({ ...crowded, supports: crowded.supports.slice(1) })).toEqual(['close-supports', 'close-supports']);
    // The same beam with the crowd thinned to one support is solved.
    expect(solveBeam({ ...crowded, supports: crowded.supports.slice(0, 2) }).ok).toBe(true);
  });

  it('a thousandth of the length apart is far enough: solved, and right', () => {
    // Moments about the first support: R₂ × 0.024 = P × 12.
    const s = solved({ L, supports: [{ x: 0, kind: 'pin' }, { x: 0.024, kind: 'roller' }], points: [{ x: 12, P }] });
    near(s.reactions[1].Rv, (P * 12) / 0.024, (P * 12) / 0.024, 1e-9);
    near(s.reactions[0].Rv, P - (P * 12) / 0.024, (P * 12) / 0.024, 1e-9);
    // …and a hair less is not.
    expect(issuesOf({ L, supports: [{ x: 0, kind: 'pin' }, { x: 0.02399, kind: 'roller' }], points: [{ x: 12, P }] })).toEqual(['close-supports']);
    // Two supports alone, a millionth apart: that, said once, and nothing about hinges.
    expect(refusal({ L, supports: [{ x: 10, kind: 'pin' }, { x: 10.000024, kind: 'roller' }], points: [{ x: 12, P }] })).toEqual([{ code: 'close-supports', where: { list: 'supports', index: 1 } }]);
    // A fixed support beside a pin, the pair that loses most: 3wℓ/8 on the
    // far pin and 5wℓ/8 on the wall from the long side, and a stub of 0.02
    // on the other. The wall's 15 kip is right to seven figures; the last
    // pin's 3 × w × 0.02 / 8 = 0.009 kip is 2 in 100,000 off, which its four
    // printed figures do not show. A ten-thousandth apart they did: (a) below.
    const stub = solved({ L: 20, supports: [{ x: 0, kind: 'pin' }, { x: 19.98, kind: 'fixed' }, { x: 20, kind: 'pin' }], ...udl20 });
    near(stub.reactions[0].Rv, (3 * 1.2 * 19.98) / 8);
    near(stub.reactions[1].Rv, (5 * 1.2 * 19.98) / 8 + (5 * 1.2 * 0.02) / 8, 24, 1e-7);
    near(stub.reactions[2].Rv, (3 * 1.2 * 0.02) / 8, (3 * 1.2 * 0.02) / 8, 1e-4);
  });

  it('a hinge too close to another hinge, or to the one support of its piece, is refused and named', () => {
    const ends = [{ x: 0, kind: 'fixed' as const }, { x: 20, kind: 'fixed' as const }];
    // Two hinges a ten-millionth of the span apart: two cantilevers and a
    // link between their tips. Held — and it was called a mechanism.
    expect(refusal({ L: 20, supports: ends, hinges: [8, 8.000002], ...udl20 })).toEqual([{ code: 'close-hinges', where: { list: 'hinges', index: 1 } }]);
    expect(refusal({ L: 20, supports: ends, hinges: [8.000002, 8], ...udl20 })).toEqual([{ code: 'close-hinges', where: { list: 'hinges', index: 0 } }]);
    // …and just under a hundred-thousandth of it.
    expect(issuesOf({ L: 20, supports: ends, hinges: [8, 8.000199], ...udl20 })).toEqual(['close-hinges']);
    // A pin between two hinges that close.
    expect(refusal({ L: 20, supports: [ends[0], { x: 8, kind: 'pin' }, ends[1]], hinges: [7.999998, 8.000002], ...udl20 })).toEqual([{ code: 'close-hinges', where: { list: 'hinges', index: 1 } }]);
    // A hinge a millionth of the span before the roller that ends the beam:
    // the piece past the hinge rests on the hinge and the roller alone.
    expect(refusal({ L: 20, supports: [ends[0], { x: 20, kind: 'roller' }], hinges: [19.99998], ...udl20 })).toEqual([{ code: 'close-hinges', where: { list: 'hinges', index: 0 } }]);
    // Beside a roller in mid-beam, when the piece has nothing else to rest
    // on: the part past the hinge at 15 leans on it, and holds nothing up.
    expect(refusal({ L: 20, supports: [ends[0], { x: 10, kind: 'roller' }, { x: 20, kind: 'roller' }], hinges: [9.99998, 15], ...udl20 })).toEqual([{ code: 'close-hinges', where: { list: 'hinges', index: 0 } }]);
    // Two hinges that close, a pin under the second and a roller as close
    // again, the only other support of what follows: the second hinge is at
    // fault on both its sides and named once, and so is the roller.
    expect(refusal({ L: 20, supports: [ends[0], { x: 8.000002, kind: 'pin' }, { x: 8.000004, kind: 'roller' }], hinges: [8, 8.000002], ...udl20 })).toEqual([
      { code: 'close-supports', where: { list: 'supports', index: 2 } },
      { code: 'close-hinges', where: { list: 'hinges', index: 1 } },
    ]);
    // The same before the last support of three, with the beam running on past it.
    expect(refusal({ L: 24, supports: [{ x: 0, kind: 'pin' }, { x: 8, kind: 'roller' }, { x: 20, kind: 'roller' }], hinges: [19.99998], ...udl20 })).toEqual([{ code: 'close-hinges', where: { list: 'hinges', index: 0 } }]);
    // Two such links in one beam, seven feet apart: each is named, by its own hinge.
    expect(refusal({ L: 20, supports: [ends[0], { x: 8, kind: 'roller' }, { x: 10, kind: 'roller' }, ends[1]], hinges: [5, 5.000002, 12, 12.000002], points: [{ x: 9, P: 1 }] })).toEqual([
      { code: 'close-hinges', where: { list: 'hinges', index: 1 } },
      { code: 'close-hinges', where: { list: 'hinges', index: 3 } },
    ]);
  });

  it('a hinge a hundred-thousandth of the length from its neighbour is far enough: solved, and right', () => {
    const d = 0.0002;
    const q = 1.2;
    // Two cantilevers of 8 and 12 − d, each carrying half of the link between their tips.
    const link = solved({ L: 20, supports: [{ x: 0, kind: 'fixed' }, { x: 20, kind: 'fixed' }], hinges: [8, 8 + d], ...udl20 });
    near(link.reactions[0].Rv, q * 8 + (q * d) / 2, 24, 1e-8);
    near(link.reactions[0].Rm, (q * 8 * 8) / 2 + ((q * d) / 2) * 8, 240, 1e-8);
    near(link.reactions[1].Rv, q * (12 - d) + (q * d) / 2, 24, 1e-8);
    near(link.reactions[1].Rm, -((q * (12 - d) ** 2) / 2 + ((q * d) / 2) * (12 - d)), 240, 1e-8);
    // A cantilever of 20 − d, and a span of d from its tip to the roller.
    const tip = solved({ L: 20, supports: [{ x: 0, kind: 'fixed' }, { x: 20, kind: 'roller' }], hinges: [20 - d], ...udl20 });
    near(tip.reactions[1].Rv, (q * d) / 2, 24, 1e-8);
    near(tip.reactions[0].Rm, (q * (20 - d) ** 2) / 2 + ((q * d) / 2) * (20 - d), 240, 1e-8);
  });

  it('a hinge beside a support that is not the only one of its piece is solved at any distance', () => {
    // Beside a roller in the middle of the beam, a ten-millionth of the span
    // away: the piece on the left rests on two pins ten feet apart and
    // overhangs by d; the piece on the right is a simple span from the hinge.
    const d = 0.000002;
    const q = 1.2;
    const s = solved({ L: 20, supports: [{ x: 0, kind: 'pin' }, { x: 10, kind: 'pin' }, { x: 20, kind: 'pin' }], hinges: [10 + d], ...udl20 });
    const X = (q * (10 - d)) / 2;
    const R10 = ((q * (10 + d) ** 2) / 2 + X * (10 + d)) / 10;
    near(s.reactions[2].Rv, X, 24, 1e-8);
    near(s.reactions[1].Rv, R10, 24, 1e-8);
    near(s.reactions[0].Rv, q * (10 + d) + X - R10, 24, 1e-8);
    // Beside a wall: a stub of d, then a simple span on the hinge and the roller.
    const wall = solved({ L: 20, supports: [{ x: 0, kind: 'fixed' }, { x: 20, kind: 'roller' }], hinges: [d], ...udl20 });
    const Rm = (q * d * d) / 2 + ((q * (20 - d)) / 2) * d;
    near(wall.reactions[1].Rv, (q * (20 - d)) / 2, 24, 1e-12);
    near(wall.reactions[0].Rm, Rm, Rm, 1e-9);
    // Just BEFORE a roller, on a piece that goes on to a second one: what
    // that piece rests on runs from the hinge to the LAST of its supports,
    // 12 ft, not to the first of them. With the hinge all but on the roller
    // this is a propped cantilever of 8 and a simple span of 12: 5wa/8 and
    // wa²/8 at the wall, 3wa/8 + wb/2 and wb/2 on the rollers, to within d.
    const before = solved({ L: 20, supports: [{ x: 0, kind: 'fixed' }, { x: 8 + d, kind: 'roller' }, { x: 20, kind: 'roller' }], hinges: [8], ...udl20 });
    near(before.reactions.reduce((sum, r) => sum + r.Rv, 0), 24);
    near(before.reactions[0].Rv, (5 * q * 8) / 8, 24, 1e-6);
    near(before.reactions[0].Rm, (q * 8 * 8) / 8, 240, 1e-6);
    near(before.reactions[1].Rv, (3 * q * 8) / 8 + (q * 12) / 2, 24, 1e-6);
    near(before.reactions[2].Rv, (q * 12) / 2, 24, 1e-6);
  });

  it('held, nothing closer than its limit, and still too much for the arithmetic: refused, and not as a mechanism', () => {
    // Found by comparing random beams with another method, the only one of
    // its kind in twenty-two thousand: a hinge a hundred-thousandth of the
    // span from a wall, a second as close to the first, a third as close to
    // a pin. Each is AT its limit and they multiply: the beam is held, with
    // reactions of ±2,325,000 under loads of 1,400, and the elimination
    // gives up on it. It was called a mechanism.
    const stacked: BeamModel = {
      L: 25.99,
      supports: [
        { x: 0, kind: 'fixed' },
        { x: 10.6997401, kind: 'pin' },
        { x: 25.99, kind: 'pin' },
        { x: 25.99, kind: 'fixed' },
      ],
      hinges: [0.00025990000000000003, 0.0006352705011831597, 10.7],
      points: [
        { x: 0, P: 1228.7795443328555 },
        { x: 25.99, P: 128.90596540104787 },
      ],
      dists: [
        { x1: 18.05942885005148, x2: 0.0006352705011831597, w1: 0, w2: 13.157134501464414 },
        { x1: 25.99, x2: 18.05821320356563, w1: -41.345953840856254, w2: 0 },
      ],
    };
    // The hinge named is the one with the least room: the one beside the pin.
    expect(refusal(stacked)).toEqual([{ code: 'close-hinges', where: { list: 'hinges', index: 2 } }]);
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
    // …and it is THAT hinge and THAT couple, not the first of the list.
    expect(refusal({ L, supports: [{ x: 0, kind: 'pin' }, { x: 12, kind: 'fixed' }, { x: 24, kind: 'fixed' }], hinges: [6, 12] })).toEqual([{ code: 'hinge-at-fixed', where: { list: 'hinges', index: 1 } }]);
    expect(refusal({ L, supports: [{ x: 0, kind: 'fixed' }, { x: L, kind: 'roller' }], hinges: [12], couples: [{ x: 3, M: 5 }, { x: 12, M: 5 }] })).toEqual([{ code: 'couple-at-hinge', where: { list: 'couples', index: 1 } }]);
    // A couple of zero on a hinge is no couple.
    expect(refusal({ L, supports: [{ x: 0, kind: 'fixed' }, { x: L, kind: 'roller' }], hinges: [12], couples: [{ x: 12, M: 0 }], points: [{ x: 6, P }] })).toEqual([]);
  });

  it('names every position that is off the beam, whatever list it is in', () => {
    // Without the check the entry is pulled onto the end of the beam and a
    // result is returned: a roller left at 30 after the beam was cut to 24.
    expect(refusal({ L, supports: [{ x: 0, kind: 'pin' }, { x: 30, kind: 'roller' }], points: [{ x: 5, P }] })).toEqual([{ code: 'outside', where: { list: 'supports', index: 1 } }]);
    expect(refusal({ L, supports: [{ x: 0, kind: 'fixed' }, { x: L, kind: 'fixed' }], hinges: [-3] })).toEqual([{ code: 'outside', where: { list: 'hinges', index: 0 } }]);
    expect(refusal({ L, supports: [{ x: 0, kind: 'fixed' }, { x: L, kind: 'fixed' }], hinges: [8, 30] })).toEqual([{ code: 'outside', where: { list: 'hinges', index: 1 } }]);
    expect(refusal({ L, supports: SS, couples: [{ x: 25, M: 5 }] })).toEqual([{ code: 'outside', where: { list: 'couples', index: 0 } }]);
    expect(refusal({ L, supports: SS, dists: [{ x1: 2, x2: 40, w1: 1, w2: 1 }] })).toEqual([{ code: 'outside', where: { list: 'dists', index: 0 } }]);
    expect(refusal({ L, supports: SS, dists: [{ x1: -1, x2: 4, w1: 1, w2: 1 }] })).toEqual([{ code: 'outside', where: { list: 'dists', index: 0 } }]);
  });

  it('names every value that is not a number, in each list and each field', () => {
    const nan = Number.NaN;
    expect(refusal({ L, supports: [{ x: nan, kind: 'pin' }, { x: L, kind: 'roller' }] })).toEqual([{ code: 'number', where: { list: 'supports', index: 0 } }]);
    expect(refusal({ L, supports: [{ x: 0, kind: 'fixed' }], hinges: [nan] })).toEqual([{ code: 'number', where: { list: 'hinges', index: 0 } }]);
    expect(refusal({ L, supports: SS, points: [{ x: 3, P: nan }] })).toEqual([{ code: 'number', where: { list: 'points', index: 0 } }]);
    expect(refusal({ L, supports: SS, points: [{ x: Number.POSITIVE_INFINITY, P: 1 }] })).toEqual([{ code: 'number', where: { list: 'points', index: 0 } }]);
    expect(refusal({ L, supports: SS, couples: [{ x: 3, M: nan }] })).toEqual([{ code: 'number', where: { list: 'couples', index: 0 } }]);
    expect(refusal({ L, supports: SS, couples: [{ x: nan, M: 3 }] })).toEqual([{ code: 'number', where: { list: 'couples', index: 0 } }]);
    for (const bad of [
      { x1: nan, x2: 4, w1: 1, w2: 1 },
      { x1: 0, x2: nan, w1: 1, w2: 1 },
      { x1: 0, x2: 4, w1: nan, w2: 1 },
      { x1: 0, x2: 4, w1: 1, w2: nan },
    ]) {
      expect(refusal({ L, supports: SS, dists: [bad] })).toEqual([{ code: 'number', where: { list: 'dists', index: 0 } }]);
    }
    expect(refusal({ L: -5, supports: SS })).toEqual([{ code: 'length' }]);
    expect(refusal({ L: Number.POSITIVE_INFINITY, supports: SS })).toEqual([{ code: 'length' }]);
  });

  it('a load too large for the results to be numbers is not taken, and its row is named', () => {
    // Two beams as a link brought them. A uniform load of 1e308 on a 20 ft
    // simple span was refused for "two supports closer than a thousandth"…
    expect(refusal({ L: 20, supports: [{ x: 0, kind: 'pin' }, { x: 20, kind: 'roller' }], points: [{ x: 12, P: 8 }], dists: [{ x1: 0, x2: 20, w1: 1e308, w2: 1e308 }] })).toEqual([
      { code: 'number', where: { list: 'dists', index: 0 } },
    ]);
    // …and 1e308 down at 5 ft with 1e308 up at 15 ft was returned as solved,
    // with Infinity among its moments and deflections.
    expect(refusal({ L: 20, supports: [{ x: 0, kind: 'pin' }, { x: 20, kind: 'roller' }], points: [{ x: 5, P: 1e308 }, { x: 15, P: -1e308 }] })).toEqual([
      { code: 'number', where: { list: 'points', index: 0 } },
      { code: 'number', where: { list: 'points', index: 1 } },
    ]);
    // Each kind of load and each of its sizes, either way, just past the
    // limit and at the largest number there is: the row it is in, and no other.
    const rows = { points: [{ x: 3, P }], couples: [{ x: 4, M: 5 }], dists: [{ x1: 0, x2: L, w1: w, w2: w }] };
    for (const size of [1e308, -1e308, 1.0001e60, -1.0001e60, Number.MAX_VALUE]) {
      expect(refusal({ L, supports: SS, ...rows, points: [...rows.points, { x: 12, P: size }] }), `P = ${size}`).toEqual([{ code: 'number', where: { list: 'points', index: 1 } }]);
      expect(refusal({ L, supports: SS, ...rows, couples: [...rows.couples, { x: 12, M: size }] }), `M = ${size}`).toEqual([{ code: 'number', where: { list: 'couples', index: 1 } }]);
      expect(refusal({ L, supports: SS, ...rows, dists: [...rows.dists, { x1: 2, x2: 9, w1: size, w2: 1 }] }), `w1 = ${size}`).toEqual([{ code: 'number', where: { list: 'dists', index: 1 } }]);
      expect(refusal({ L, supports: SS, ...rows, dists: [...rows.dists, { x1: 2, x2: 9, w1: 1, w2: size }] }), `w2 = ${size}`).toEqual([{ code: 'number', where: { list: 'dists', index: 1 } }]);
    }
  });

  it('up to that limit a load of any size is solved, and every number of the solution is a number', () => {
    const layouts: BeamModel['supports'][] = [
      SS,
      [{ x: 0, kind: 'fixed' }],
      [{ x: 0, kind: 'fixed' }, { x: L, kind: 'roller' }],
      [{ x: 0, kind: 'pin' }, { x: 12, kind: 'roller' }, { x: L, kind: 'roller' }],
    ];
    // 1e59, and the limit itself, 1e60, either way.
    for (const size of [1e59, 1e60, -1e60]) {
      const loads: Partial<BeamModel>[] = [
        { points: [{ x: 15, P: size }] },
        { couples: [{ x: 6, M: size }] },
        { dists: [{ x1: 0, x2: L, w1: size, w2: 1.2 }] },
        { dists: [{ x1: 0, x2: L, w1: 1.2, w2: size }] },
        { points: [{ x: 15, P: size }], couples: [{ x: 6, M: size }], dists: [{ x1: 0, x2: L, w1: size, w2: size }] },
      ];
      for (const supports of layouts) {
        for (const load of loads) {
          const s = solved({ L, supports, ...load });
          expect(numbersOf(s).filter((v) => !Number.isFinite(v)), `${size} on ${JSON.stringify(supports)} as ${JSON.stringify(load)}`).toEqual([]);
        }
      }
    }
    // …and the right ones: P/2, PL/4 and PL³/48EI do not care how large P is.
    const s = solved({ L, supports: SS, points: [{ x: L / 2, P: 1e59 }] });
    near(s.reactions[0].Rv, 5e58, 1e59);
    near(s.extremes.Mmax.value, (1e59 * L) / 4, 1e59 * L);
    near(s.extremes.EIvMin.value, (-1e59 * L ** 3) / 48, 1e59 * L ** 3);
  });

  it('a length too large or too small for the results to be numbers is not taken', () => {
    const wall: BeamModel['supports'] = [{ x: 0, kind: 'fixed' }];
    // 1e60 is taken, with a load as large on it: wL, wL²/2 and wL⁴/8EI of a
    // cantilever, the last of them 1.25e299.
    const long = solved({ L: 1e60, supports: wall, dists: [{ x1: 0, x2: 1e60, w1: 1e60, w2: 1e60 }] });
    near(long.reactions[0].Rv, 1e120, 1e120);
    near(long.reactions[0].Rm, 5e179, 5e179);
    near(long.extremes.EIvMin.value, -1.25e299, 1.25e299);
    expect(numbersOf(long).filter((v) => !Number.isFinite(v))).toEqual([]);
    // A hair longer is not, whatever is on it.
    expect(refusal({ L: 1.0001e60, supports: wall, points: [{ x: 5, P }] })).toEqual([{ code: 'length' }]);
    expect(refusal({ L: Number.MAX_VALUE, supports: wall })).toEqual([{ code: 'length' }]);
    // A couple is divided by the length: M₀/L on each support of a simple
    // span. 1e-60 is taken, with the largest couple there is on it…
    const short = solved({ L: 1e-60, supports: [{ x: 0, kind: 'pin' }, { x: 1e-60, kind: 'roller' }], couples: [{ x: 0, M: 1e60 }] });
    near(short.reactions[0].Rv, 1e120, 1e120);
    near(short.reactions[1].Rv, -1e120, 1e120);
    expect(numbersOf(short).filter((v) => !Number.isFinite(v))).toEqual([]);
    // …and a hair shorter is not: on a beam of 1e-310 ft a couple of 8 was
    // "two supports closer than a thousandth".
    expect(refusal({ L: 0.9999e-60, supports: [{ x: 0, kind: 'pin' }, { x: 0.9999e-60, kind: 'roller' }] })).toEqual([{ code: 'length' }]);
    expect(refusal({ L: 1e-310, supports: [{ x: 0, kind: 'pin' }, { x: 1e-310, kind: 'roller' }], couples: [{ x: 0, M: 8 }] })).toEqual([{ code: 'length' }]);
  });

  it('never returns a number that is not one: a levered piece on a beam at both limits is refused for its length', () => {
    // A wall, a hinge at midspan and a pin a hundred-thousandth of the
    // length past it, the rest overhanging: the pin's reaction is 12,500
    // times the load, and the tip swings with it. Under one uniform load at
    // the limit the largest number of the solution is 2.6e307, a number still.
    const lever: BeamModel = { L: 1e60, supports: [{ x: 0, kind: 'fixed' }, { x: 5.0001e59, kind: 'pin' }], hinges: [5e59] };
    const load = { x1: 0, x2: 1e60, w1: 1e60, w2: 1e60 };
    const one = solved({ ...lever, dists: [load] });
    near(one.reactions[1].Rv, 12500 * 1e120, 12500 * 1e120, 1e-4);
    expect(numbersOf(one).filter((v) => !Number.isFinite(v))).toEqual([]);
    expect(Math.max(...numbersOf(one).map(Math.abs))).toBeGreaterThan(1e307);
    // Under twelve, the most a form holds, it is past the largest there is:
    // that was returned as a solution, with Infinity for its deflections.
    expect(refusal({ ...lever, dists: Array.from({ length: 12 }, () => load) })).toEqual([{ code: 'length' }]);
  });

  it('takes the supports in any order, and two hinges at one point as one', () => {
    const load = { dists: [{ x1: 0, x2: 2 * L, w1: w, w2: w }] };
    // "Add a support" puts the new one after the end support: this is the form's ordinary beam.
    const s = solved({ L: 2 * L, supports: [{ x: 0, kind: 'pin' }, { x: 2 * L, kind: 'roller' }, { x: L, kind: 'roller' }], ...load });
    expect(s.reactions.map((r) => r.x)).toEqual([0, L, 2 * L]);
    near(s.reactions[0].Rv, (3 * w * L) / 8);
    near(s.reactions[1].Rv, (5 * w * L) / 4);
    near(s.reactions[2].Rv, (3 * w * L) / 8);
    expect(beamSpans(s).map((p) => [p.from, p.to, p.kind])).toEqual([
      [0, L, 'span'],
      [L, 2 * L, 'span'],
    ]);
    // Two at one point are still one when another sits between them in the list.
    expect(solved({ L, supports: [{ x: 5, kind: 'pin' }, { x: 20, kind: 'roller' }, { x: 5, kind: 'roller' }], points: [{ x: 12, P }] }).reactions.map((r) => r.x)).toEqual([5, 20]);
    // Fixed ends take two hinges and no more: [8, 8, 16] is two.
    const ends = [{ x: 0, kind: 'fixed' as const }, { x: L, kind: 'fixed' as const }];
    const one = solved({ L, supports: ends, hinges: [8, 16], dists: [{ x1: 0, x2: L, w1: w, w2: w }] });
    const twice = solved({ L, supports: ends, hinges: [8, 8, 16], dists: [{ x1: 0, x2: L, w1: w, w2: w }] });
    near(twice.reactions[0].Rm, one.reactions[0].Rm);
    near(twice.reactions[0].Rm, (w * 8 * 8) / 2 + ((w * 8) / 2) * 8);
    near(twice.extremes.EIvMin.value, one.extremes.EIvMin.value, Math.abs(one.extremes.EIvMin.value));
  });

  it('takes a distributed load entered right to left, and ignores one of no length or no intensity', () => {
    const a = solved({ L, supports: SS, dists: [{ x1: 4, x2: 16, w1: 1, w2: 3 }] });
    const b = solved({ L, supports: SS, dists: [{ x1: 16, x2: 4, w1: 3, w2: 1 }, { x1: 8, x2: 8, w1: 9, w2: 9 }, { x1: 2, x2: 9, w1: 0, w2: 0 }] });
    near(b.reactions[0].Rv, a.reactions[0].Rv);
    near(b.extremes.Mmax.value, a.extremes.Mmax.value);
    expect(b.breaks).toEqual(a.breaks);
    // The intensity at the load's own ends: the load's on the inner side, nothing on the outer.
    expect(b.at(4, 'left').w).toBe(0);
    near(b.at(4, 'right').w, 1);
    near(b.at(10).w, 2);
    near(b.at(16, 'left').w, 3);
    expect(b.at(16, 'right').w).toBe(0);
    // "No length", to the engine, is anything under a billionth of the
    // beam's: two positions that close are one. 10 kip spread over 2e-8 ft
    // of a 20 ft cantilever is not applied at all; over 3e-8 ft it is.
    const wall = [{ x: 0, kind: 'fixed' as const }];
    const none = solved({ L: 20, supports: wall, dists: [{ x1: 10, x2: 10.00000002, w1: 5e8, w2: 5e8 }] });
    near(none.totalLoad, 0);
    near(none.reactions[0].Rv, 0);
    near(none.reactions[0].Rm, 0);
    const some = solved({ L: 20, supports: wall, dists: [{ x1: 10, x2: 10.00000003, w1: 10 / 3e-8, w2: 10 / 3e-8 }] });
    near(some.totalLoad, 10, 10, 1e-6);
    near(some.reactions[0].Rv, 10, 10, 1e-6);
    near(some.reactions[0].Rm, 100, 100, 1e-6);
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

  it('a very short triangular load is its resultant at a third of its length: the reactions add up to it', () => {
    // 10 kip as a triangle rising to 1e7 kip/ft over a ten-millionth of the
    // span, on the tip of a cantilever. Its slope is 5e12: written as two
    // endless ramps, one taken from the other, it came out as 9.875 kip
    // with 198.75 at the wall — and was returned as the solution.
    const len = 0.000002;
    const tip = solved({ L: 20, supports: [{ x: 20, kind: 'fixed' }], dists: [{ x1: 0, x2: len, w1: 0, w2: 1e7 }] });
    near(tip.reactions[0].Rv, 10, 10, 1e-12);
    near(tip.reactions[0].Rm, -10 * (20 - (2 * len) / 3), 200, 1e-12);
    near(tip.totalLoad, 10);
    near(tip.at(10).V, -10, 10, 1e-12);
    near(tip.at(10).M, -10 * (10 - (2 * len) / 3), 100, 1e-12);
    // The tip of a cantilever under a load at a: Pb²(3L − b)/6 with b = L − a.
    const b = 20 - (2 * len) / 3;
    near(tip.at(0).EIv, (-10 * b * b * (3 * 20 - b)) / 6, 10 * 20 ** 3, 1e-9);
    // Falling instead of rising, and at every length down to a billionth of the span.
    for (const short of [1e-3, 1e-5, 1e-7, 2e-9]) {
      // The length the two positions have as numbers: 3 + d is not exactly d past 3.
      const end = 3 + short * 20;
      const d = end - 3;
      const s = solved({ L: 20, supports: [{ x: 20, kind: 'fixed' }], dists: [{ x1: 3, x2: end, w1: 20 / d, w2: 0 }] });
      near(s.reactions[0].Rv, 10, 10, 1e-12);
      near(s.reactions[0].Rm, -10 * (17 - d / 3), 200, 1e-12);
    }
  });

  it('a very short trapezoid, on a simple span: the reactions of its resultant at its centroid', () => {
    for (const short of [1e-3, 1e-5, 1e-7]) {
      const c = 10;
      const len = c + short * L - c;
      const [w1, w2] = [(0.4 * P) / len, (1.6 * P) / len];
      const s = solved({ L, supports: SS, dists: [{ x1: c, x2: c + short * L, w1, w2 }] });
      const W = ((w1 + w2) / 2) * len;
      const centroid = c + (len * (w1 + 2 * w2)) / (3 * (w1 + w2));
      near(s.totalLoad, W, P, 1e-12);
      near(s.reactions[1].Rv, (W * centroid) / L, P, 1e-12);
      near(s.reactions[0].Rv, W - (W * centroid) / L, P, 1e-12);
      // Past the load nothing of it is left but that resultant.
      near(s.at(18).V, (-W * centroid) / L, P, 1e-12);
      near(s.at(18).M, ((W * centroid) / L) * (L - 18), P * L, 1e-12);
      // …and the beam sags as under a point load there, to the square of the load's length.
      const p = solved({ L, supports: SS, points: [{ x: centroid, P: W }] });
      near(s.at(16).EIv, p.at(16).EIv, P * L ** 3, short * short + 1e-11);
    }
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
      // The loads added up HERE, from the model — not the engine's account
      // of them, which says "nothing left over" of whatever it solved.
      const sum = (list: number[]) => list.reduce((p, q) => p + q, 0);
      const dists = m.dists ?? [];
      const W = sum((m.points ?? []).map((p) => p.P)) + sum(dists.map((d) => ((d.w1 + d.w2) / 2) * (d.x2 - d.x1)));
      near(sum(s.reactions.map((r) => r.Rv)), W, F, 1e-9);
      near(s.totalLoad, W, F, 1e-12);
      // About x = 0, counter-clockwise: ∫ w·x dx of a trapezoid is (x₂ − x₁)[w₁(2x₁ + x₂) + w₂(x₁ + 2x₂)]/6.
      const ofLoads =
        sum((m.couples ?? []).map((c) => c.M)) -
        sum((m.points ?? []).map((p) => p.P * p.x)) -
        sum(dists.map((d) => ((d.x2 - d.x1) * (d.w1 * (2 * d.x1 + d.x2) + d.w2 * (d.x1 + 2 * d.x2))) / 6));
      near(sum(s.reactions.map((r) => r.Rv * r.x + r.Rm)) + ofLoads, 0, F * m.L, 1e-9);
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

  it('a root found a hair inside either end of the beam is read on the beam, not past it', () => {
    // A cantilever with a load on its tip and, on the same tip, a couple so
    // small that the moment changes sign half a billionth of the span in:
    // closer to the end than two positions are told apart. Read on the
    // wrong side, that point is the empty air beyond the tip — shear zero —
    // on a beam whose shear is 11 or 12 from end to end.
    const hair = 5e-10 * L;
    const left = solved({ L, supports: [{ x: L, kind: 'fixed' }], points: [{ x: 0, P }, { x: 0.24, P: 1 }], couples: [{ x: 0, M: -P * hair }] });
    near(left.extremes.Vmax.value, -P);
    near(left.extremes.Vmin.value, -P - 1);
    const right = solved({ L, supports: [{ x: 0, kind: 'fixed' }], points: [{ x: L, P }, { x: L - 0.24, P: 1 }], couples: [{ x: L, M: P * hair }] });
    near(right.extremes.Vmin.value, P);
    near(right.extremes.Vmax.value, P + 1);
  });

  it('finds the crossing in a cell that opens on an exact zero: the shear at a free end', () => {
    // A cantilever under a load that pulls up by 0.1 at the tip and pushes
    // down by 60 at the wall. V = 0.1x − (60.1/48)x²: zero AT the tip, and
    // again 0.08 ft in — inside the first cell of the grid, the only one
    // with a crossing. Skipped for its zero end, the largest sagging moment
    // came out 22% low, at the next grid point.
    const x0 = 4.8 / 60.1;
    const M0 = 0.05 * x0 ** 2 - (60.1 / 144) * x0 ** 3;
    const s = solved({ L, supports: [{ x: L, kind: 'fixed' }], dists: [{ x1: 0, x2: L, w1: -0.1, w2: 60 }] });
    near(s.extremes.Mmax.value, M0, M0, 1e-6);
    near(s.extremes.Mmax.x, x0, L, 1e-9);
    // Seen from the other side the zero at the tip is not exact: it is the
    // rounding left of 720 kip of load and reaction. The same crossing.
    const m = solved({ L, supports: [{ x: 0, kind: 'fixed' }], dists: [{ x1: 0, x2: L, w1: 60, w2: -0.1 }] });
    near(m.extremes.Mmax.value, M0, M0, 1e-6);
    near(m.extremes.Mmax.x, L - x0, L, 1e-9);
    // The moment at a free end, and the slope it turns: M = 0.1x − 2x²,
    // zero at the tip and at 0.05.
    const t = solved({ L, supports: [{ x: 6, kind: 'pin' }, { x: L, kind: 'roller' }], points: [{ x: 0, P: -0.1 }], dists: [{ x1: 0, x2: 6, w1: 4, w2: 4 }] });
    near(t.extremes.EIthetaMax.x, 0.05, L, 1e-9);
    near(t.extremes.EIthetaMax.value - t.at(0).EItheta, 0.05 * 0.05 ** 2 - (2 / 3) * 0.05 ** 3, 0.05 ** 3, 1e-6);
  });

  it('finds the crossing in a cell that ends on a hinge, where the moment is zero but for rounding', () => {
    // A wall, a hinge at midspan and a roller; the cantilever carries w and
    // its tip is LIFTED by U, the pull of an upward load on the hung span.
    // M = Ut − wt²/2 at t before the hinge: zero at the hinge and at
    // t = 2U/w = 0.04 ft before it, in the last cell — and there the slope
    // is at its lowest. The moment at the hinge comes out as ±1e-15; with a
    // sign taken from that, the crossing is found or not by chance.
    const h = L / 2;
    // Twenty-four of them, for the rounding to fall on both sides.
    for (let i = 1; i <= 24; i++) {
      const t0 = 0.004 * i;
      const U = (w * t0) / 2;
      const s = solved({ L, supports: [{ x: 0, kind: 'fixed' }, { x: L, kind: 'roller' }], hinges: [h], points: [{ x: (3 * L) / 4, P: -2 * U }], dists: [{ x1: 0, x2: h, w1: w, w2: w }] });
      near(s.extremes.EIthetaMin.x, h - t0, L, 1e-9);
      near(s.extremes.EIthetaMin.value, (U * (h * h - t0 * t0)) / 2 - (w * (h ** 3 - t0 ** 3)) / 6, w * h ** 3, 1e-12);
    }
    // From the exhaustive comparison with an independent solver: three
    // walls and two hinges, the lowest slope 0.036 ft before the hinge at 10
    // (its values are that solver's). Here the moment at the hinge is not an
    // exact zero, and its sign falls either way as the load changes: of
    // these twenty-four, eleven lost the crossing.
    const walls = (w2: number): BeamModel => ({
      L: 12,
      supports: [{ x: 3, kind: 'fixed' }, { x: 8, kind: 'fixed' }, { x: 12, kind: 'fixed' }],
      hinges: [4, 10],
      dists: [{ x1: 1, x2: 11, w1: 0, w2 }],
      points: [{ x: 0, P: 3 }, { x: 12, P: -4 }],
      couples: [{ x: 0, M: 9 }, { x: 12, M: 5 }],
    });
    const found = solved(walls(2));
    near(found.extremes.EIthetaMin.x, 9.964188612760879, 12, 1e-9);
    near(found.extremes.EIthetaMin.value, -2.2022985419372425, 2.2, 1e-12);
    for (let k = 0; k < 24; k++) {
      const s = solved(walls(2 + 0.05 * k));
      let lowest = Infinity;
      for (let i = 0; i < 400; i++) lowest = Math.min(lowest, s.at(9.9 + (0.1 * i) / 400, 'left').EItheta);
      expect(s.extremes.EIthetaMin.value, `w2 = ${2 + 0.05 * k}`).toBeLessThanOrEqual(lowest + 1e-11);
    }
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

  it('one support inside the beam is two overhangs, each with its own tip', () => {
    const s = solved({ L, supports: [{ x: 12, kind: 'fixed' }], points: [{ x: 0, P }, { x: L, P: 2 * P }] });
    const spans = beamSpans(s);
    expect(spans.map((p) => [p.from, p.to, p.kind])).toEqual([
      [0, 12, 'cantilever'],
      [12, L, 'cantilever'],
    ]);
    near(spans[0].EIv.value, (-P * 12 ** 3) / 3);
    near(spans[0].EIv.x, 0);
    near(spans[1].EIv.value, (-2 * P * 12 ** 3) / 3);
    near(spans[1].EIv.x, L);
    // With no side asked, the right end of the beam is read from the left:
    // the shear and the moment the wall takes, not the nothing beyond it.
    const wall = solved({ L, supports: [{ x: L, kind: 'fixed' }], points: [{ x: 0, P }] });
    near(wall.at(L).V, -P);
    near(wall.at(L).M, -P * L);
    near(wall.at(L, 'right').V, 0);
  });

  it('each stretch has ITS largest deflection, also where the beam as a whole deflects more elsewhere', () => {
    // Two unequal simple spans joined by a hinge over the middle support.
    const s = solved({ L: 30, supports: [{ x: 0, kind: 'pin' }, { x: 10, kind: 'pin' }, { x: 30, kind: 'roller' }], hinges: [10], dists: [{ x1: 0, x2: 30, w1: w, w2: w }] });
    const spans = beamSpans(s);
    near(spans[0].EIv.value, (-5 * w * 10 ** 4) / 384);
    near(spans[0].EIv.x, 5, 30, 1e-7);
    near(spans[1].EIv.value, (-5 * w * 20 ** 4) / 384);
    near(spans[1].EIv.x, 20, 30, 1e-7);
    // An unloaded overhang lifts: θ at the support × its length, upward.
    const lift = beamSpans(solved({ L: 26, supports: [{ x: 0, kind: 'pin' }, { x: 20, kind: 'roller' }], dists: [{ x1: 0, x2: 20, w1: w, w2: w }] }));
    near(lift[1].EIv.value, ((w * 20 ** 3) / 24) * 6);
    near(lift[1].EIv.x, 26);
  });

  it('closes a turning point in a cell that opens on a slope of exactly zero', () => {
    // The shape EI·v = x²(0.3 − x) between supports at 0 and 0.3, known at
    // its two ends only: flat at the left end, and turning at x = 0.2.
    const v = (x: number) => x * x * (0.3 - x);
    const theta = (x: number) => 3 * x * (0.2 - x);
    const at = (x: number) => ({ x, w: 0, V: 0, M: 0, EItheta: theta(x), EIv: v(x) });
    const none = { value: 0, x: 0 };
    const shape: BeamSolution = {
      ok: true,
      L: 0.3,
      breaks: [0, 0.3],
      reactions: [{ x: 0, kind: 'fixed', Rv: 0, Rm: 0 }, { x: 0.3, kind: 'roller', Rv: 0, Rm: 0 }],
      at,
      stations: [at(0), at(0.3)],
      extremes: { Vmax: none, Vmin: none, Mmax: none, Mmin: none, EIvMax: none, EIvMin: none, EIthetaMax: none, EIthetaMin: { value: theta(0.3), x: 0.3 } },
      totalLoad: 0,
      residual: { force: 0, moment: 0 },
    };
    const [span] = beamSpans(shape);
    near(span.EIv.x, 0.2, 0.3, 1e-9);
    near(span.EIv.value, v(0.2), v(0.2), 1e-9);
  });
});
