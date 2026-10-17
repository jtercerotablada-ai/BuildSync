import { afterEach, describe, expect, it, vi } from 'vitest';
import { solvePoints } from './engine';
import { between, logBetween, rng } from './oracle.testlib';
import { MAX_POINT_LOADS, type PointLoad, type PointsInput, type PointsKnown, type PointsSolution } from './types';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/**
 * THE FUNICULAR CABLE (point loads), against what is known.
 *
 *   — TEXTBOOK problems with the hand numbers in the comments (a 60 ft span with 10/20/10 kip, an inclined 40 ft
 *     span with 600 and 400 lb);
 *   — the EQUILIBRIUM of every joint, recomputed here from the coordinates and the tensions (not read from the
 *     engine's slopes), and the moments about BOTH supports;
 *   — a BRUTE-FORCE check: solving with the sag given at any one load (or at any position) gives the same shape;
 *   — properties: scaling, the single load (closed form), H known ↔ sag known ↔ T_max known;
 *   — every code.
 */

const points = (i: PointsInput): PointsSolution => {
  const out = solvePoints(i);
  if (!out.ok) throw new Error(`not solved: ${JSON.stringify(i)} ${JSON.stringify(out.issues)}`);
  return out;
};
const near = (got: number, want: number, tol = 1e-9, scale = Math.max(Math.abs(want), 1e-300)) => {
  expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * scale);
};

function random(seed: number) {
  const r = rng(seed);
  return () => {
    const L = logBetween(r, 10, 300);
    const h = between(r, -0.6, 0.6) * L * (r() < 0.3 ? 0 : 1);
    const n = 1 + Math.floor(r() * MAX_POINT_LOADS);
    const xs = new Set<number>();
    while (xs.size < n) xs.add(Math.round(between(r, 0.02, 0.98) * 1e6) / 1e6 * L);
    const loads: PointLoad[] = [...xs].map((x) => ({ x, P: logBetween(r, 0.1, 50) }));
    // shuffle the order of the input: the engine sorts, results keep their sources
    loads.sort(() => r() - 0.5);
    const known: PointsKnown = { kind: 'H', value: loads.reduce((s, l) => s + l.P, 0) * logBetween(r, 0.2, 5) };
    return { L, h, loads, known } satisfies PointsInput;
  };
}

describe('textbook problems', () => {
  it('a 60 ft level span: 10, 20 and 10 kip at 15, 30 and 45 ft, 12 ft of sag under the middle one', () => {
    // Beam reactions 20 kip each; M0(30) = 20·30 − 10·15 = 450 kip·ft; H = 450/12 = 37.5 kip.
    // Ordinates M0/H: at 15: 20·15/37.5 = 8 ft; at 30: 12 ft; at 45: 8 ft.
    // Segments (15 ft across): 8 down, 4 down, 4 up, 8 up: lengths 17 (8-15-17), 15.524, 15.524, 17; total 65.048 ft.
    // Tensions: H·len/dx = 37.5·17/15 = 42.5 and 37.5·15.524/15 = 38.810 kip. Reactions 20 kip vertical and 37.5 horizontal.
    const s = points({ L: 60, h: 0, loads: [{ x: 15, P: 10 }, { x: 30, P: 20 }, { x: 45, P: 10 }], known: { kind: 'sag', x: 30, value: 12 } });
    near(s.H, 37.5, 1e-13);
    expect(s.joints.map((j) => j.kind)).toEqual(['A', 'load', 'load', 'load', 'B']);
    near(s.joints[1].z, -8, 1e-13);
    near(s.joints[2].z, -12, 1e-13);
    near(s.joints[3].z, -8, 1e-13);
    expect(s.joints.map((j) => j.sag)).toEqual([0, expect.closeTo(8, 12), expect.closeTo(12, 12), expect.closeTo(8, 12), 0]);
    expect(s.segments.map((g) => g.length)).toEqual([expect.closeTo(17, 12), expect.closeTo(15.524174696260024, 12), expect.closeTo(15.524174696260024, 12), expect.closeTo(17, 12)]);
    near(s.segments[0].tension, 42.5, 1e-13);
    near(s.segments[1].tension, 38.81043674065006, 1e-12);
    near(s.length, 65.04834939252005, 1e-12);
    near(s.reaction.A, 20, 1e-13);
    near(s.reaction.B, 20, 1e-13);
    expect(s.tensionMax.segment).toBe(0);
    near(s.tensionMax.value, 42.5, 1e-13);
    expect(s.lowest).toEqual({ joint: 2, z: expect.closeTo(-12, 12) });
    near(s.totalLoad, 40, 1e-14);
    expect(s.warnings).toEqual([]);
  });

  it('an inclined 40 ft span (B 10 ft higher): 600 lb at 10 ft and 400 lb at 25 ft, 5 ft of sag under the first', () => {
    // Beam reaction R_A0 = (600·30 + 400·15)/40 = 600 lb; M0(10) = 6000 lb·ft; H = 6000/5 = 1200 lb.
    // M0(25) = 600·25 − 600·15 = 6000: the sag under the second load is also 5 ft.
    // Chord: z = x/4. Ordinates: z(10) = 2.5 − 5 = −2.5 ft; z(25) = 6.25 − 5 = 1.25 ft; B at 10.
    // Slopes −0.25, +0.25, +0.58333; tensions 1200·√(1.0625) = 1236.9, 1236.9, 1200·√(1.34028) = 1389.2 lb.
    // Reactions: V_A = −H·slope₀ = 300 lb, V_B = H·0.58333 = 700 lb; 300 + 700 = 1000 = 600 + 400.
    const s = points({ L: 40, h: 10, loads: [{ x: 10, P: 600 }, { x: 25, P: 400 }], known: { kind: 'sag', x: 10, value: 5 } });
    near(s.H, 1200, 1e-13);
    near(s.joints[1].z, -2.5, 1e-13);
    near(s.joints[2].z, 1.25, 1e-13);
    expect(s.segments.map((g) => g.slope)).toEqual([expect.closeTo(-0.25, 12), expect.closeTo(0.25, 12), expect.closeTo(0.5833333333333334, 12)]);
    near(s.segments[0].tension, 1200 * Math.sqrt(1.0625), 1e-12);
    near(s.segments[2].tension, 1200 * Math.sqrt(1 + 0.58333333333333 ** 2), 1e-11);
    near(s.reaction.A, 300, 1e-12);
    near(s.reaction.B, 700, 1e-12);
    expect(s.tensionMax.segment).toBe(2);
    near(s.length, Math.hypot(10, 2.5) + Math.hypot(15, 3.75) + Math.hypot(15, 8.75), 1e-13);
  });

  it('a single load at x = a on a level span: the triangle, sag s = P·a(L − a)/(L·H)', () => {
    const r = rng(41);
    for (let n = 0; n < 100; n++) {
      const L = logBetween(r, 5, 200);
      const a = between(r, 0.05, 0.95) * L;
      const P = logBetween(r, 0.1, 100);
      const s0 = logBetween(r, 0.01, 0.8) * L;
      const out = points({ L, h: 0, loads: [{ x: a, P }], known: { kind: 'sag', x: a, value: s0 } });
      near(out.H, (P * a * (L - a)) / (L * s0), 1e-12);
      near(out.joints[1].z, -s0, 1e-12);
      near(out.length, Math.hypot(a, s0) + Math.hypot(L - a, s0), 1e-12);
      // moments at the load: H·slope change = P
      near(out.H * (out.segments[1].slope - out.segments[0].slope), P, 1e-11);
    }
  });
});

describe('equilibrium, recomputed from the coordinates', () => {
  it('every load joint balances: the two tensions, taken along the segments as drawn, plus the load, sum to zero', () => {
    const gen = random(42);
    for (let n = 0; n < 150; n++) {
      const input = gen();
      const s = points(input);
      const scale = s.tensionMax.value;
      for (let i = 1; i + 1 < s.joints.length; i++) {
        const j = s.joints[i];
        const left = s.joints[i - 1];
        const right = s.joints[i + 1];
        // tension forces on the joint, along the segments towards the neighbours, with the tension in each segment
        const tl = s.segments[i - 1].tension;
        const tr = s.segments[i].tension;
        const ll = Math.hypot(left.x - j.x, left.z - j.z);
        const lr = Math.hypot(right.x - j.x, right.z - j.z);
        const fx = (tl * (left.x - j.x)) / ll + (tr * (right.x - j.x)) / lr;
        const fz = (tl * (left.z - j.z)) / ll + (tr * (right.z - j.z)) / lr - j.P;
        expect(Math.abs(fx), `fx at ${i}`).toBeLessThanOrEqual(1e-10 * scale);
        expect(Math.abs(fz), `fz at ${i}`).toBeLessThanOrEqual(1e-9 * scale);
      }
    }
  });

  it('the supports balance the loads: Σ forces and the moments about A and about B vanish (horizontal H at each end)', () => {
    const gen = random(43);
    for (let n = 0; n < 150; n++) {
      const input = gen();
      const s = points(input);
      const loads = input.loads;
      const total = loads.reduce((t, l) => t + l.P, 0);
      const scale = Math.max(total, s.H) * Math.max(input.L, Math.abs(input.h));
      near(s.reaction.A + s.reaction.B, total, 1e-10, Math.max(total, 1e-12));
      // forces on the cable: at A (−H, VA); at B (+H, VB); loads (0, −P) at (x, z of the cable, but the loads act at x)
      const L = input.L;
      const h = input.h;
      const momentA = s.reaction.B * L - s.H * h - loads.reduce((t, l) => t + l.P * l.x, 0);
      expect(Math.abs(momentA)).toBeLessThanOrEqual(1e-9 * scale);
      const momentB = -s.reaction.A * L - s.H * h + loads.reduce((t, l) => t + l.P * (L - l.x), 0);
      // about B: A is at (−L, −h) from B: moment of (−H, VA) is (−L)(VA) − (−h)(−H) = −L·VA − h·H
      expect(Math.abs(momentB)).toBeLessThanOrEqual(1e-9 * scale);
    }
  });

  it('the polygon is made of straight segments between the ordinates: each segment\'s slope is the difference of its joints', () => {
    const gen = random(44);
    for (let n = 0; n < 100; n++) {
      const s = points(gen());
      s.segments.forEach((g) => {
        const a = s.joints[g.from];
        const b = s.joints[g.to];
        near(g.slope, (b.z - a.z) / (b.x - a.x), 1e-9, Math.max(1, Math.abs(g.slope)));
        near(g.length, Math.hypot(b.x - a.x, b.z - a.z), 1e-11);
        near(g.tension, s.H * Math.hypot(1, g.slope), 1e-12);
        near(g.vertical, s.H * g.slope, 1e-12, Math.max(Math.abs(g.vertical), 1e-12));
        near(g.angle, (Math.atan(g.slope) * 180) / Math.PI, 1e-12, 180);
      });
      near(s.length, s.segments.reduce((t, g) => t + g.length, 0), 1e-12);
    }
  });
});

describe('the sag may be given anywhere: the same shape comes back', () => {
  it('re-solving with the sag read at each load joint, or at an arbitrary position, gives the same H and the same ordinates', () => {
    const gen = random(45);
    for (let n = 0; n < 80; n++) {
      const input = gen();
      const first = points(input);
      for (const j of first.joints.filter((x) => x.kind === 'load')) {
        const again = points({ ...input, known: { kind: 'sag', x: j.x, value: j.sag } });
        near(again.H, first.H, 1e-10);
        again.joints.forEach((q, i) => near(q.z, first.joints[i].z, 1e-9, Math.max(1, Math.abs(first.joints[i].z))));
      }
      // at a position that is not a load: read the cable there off the first solution's polygon
      const x = 0.5 * (first.joints[1].x + first.joints[2].x);
      const a = first.joints[1];
      const b = first.joints[2];
      const zc = a.z + ((x - a.x) / (b.x - a.x)) * (b.z - a.z);
      const sag = (input.h / input.L) * x - zc;
      const mid = points({ ...input, known: { kind: 'sag', x, value: sag } });
      near(mid.H, first.H, 1e-8);
      expect(mid.warnings.map((w) => w.code)).toContain('sag-not-at-load');
    }
  });

  it('H known, T_max known and the sag known give the same cable: sag → H → T_max → H', () => {
    const gen = random(46);
    for (let n = 0; n < 80; n++) {
      const input = gen();
      const base = points(input);
      const t = points({ ...input, known: { kind: 'T-max', value: base.tensionMax.value } });
      // T(H) has a minimum: the taut root is returned; the original H is the taut one when it is the larger root
      expect(t.tensionMax.value).toBeCloseTo(base.tensionMax.value, 9);
      if (t.H < base.H * (1 - 1e-6)) {
        // then the original was the other root: same tension, a cable with less H
        near(t.tensionMax.value, base.tensionMax.value, 1e-9);
      } else {
        near(t.H, base.H, 1e-8);
      }
      const j = base.joints.find((q) => q.kind === 'load')!;
      const s = points({ ...input, known: { kind: 'sag', x: j.x, value: j.sag } });
      near(s.H, base.H, 1e-10);
    }
  });

  it('scaling: every load ×k doubles H and every tension, with the sag given unchanged, and leaves the geometry', () => {
    const gen = random(47);
    for (let n = 0; n < 60; n++) {
      const input = gen();
      const first = points({ ...input, known: { kind: 'H', value: 10 } });
      const j = first.joints[1];
      const sagKnown: PointsKnown = { kind: 'sag', x: j.x, value: j.sag };
      for (const k of [2, 0.25, 40]) {
        const a = points({ ...input, loads: input.loads.map((l) => ({ ...l, P: k * l.P })), known: sagKnown });
        const b = points({ ...input, known: sagKnown });
        near(a.H, k * b.H, 1e-11);
        near(a.tensionMax.value, k * b.tensionMax.value, 1e-11);
        near(a.length, b.length, 1e-11);
      }
    }
  });
});

describe('the order of the loads in the input does not matter, and results point back to their sources', () => {
  it('a shuffled input gives the same cable; a joint\'s source is its index in the input', () => {
    const a: PointLoad[] = [{ x: 45, P: 10 }, { x: 15, P: 10 }, { x: 30, P: 20 }];
    const s = points({ L: 60, h: 0, loads: a, known: { kind: 'H', value: 37.5 } });
    expect(s.joints.map((j) => j.source)).toEqual([-1, 1, 2, 0, -1]);
    expect(s.joints.map((j) => j.x)).toEqual([0, 15, 30, 45, 60]);
    near(s.joints[2].z, -12, 1e-13);
  });
});

describe('what cannot be solved is said by code', () => {
  const base: PointsInput = { L: 60, h: 0, loads: [{ x: 15, P: 10 }, { x: 45, P: 10 }], known: { kind: 'sag', x: 15, value: 5 } };
  const codes = (i: unknown) => {
    const out = solvePoints(i as PointsInput);
    return out.ok ? [] : out.issues;
  };

  it('number, span, rise', () => {
    expect(codes({ ...base, L: Number.NaN })).toEqual([{ code: 'number', field: 'L' }]);
    expect(codes({ ...base, L: 0 })).toEqual([{ code: 'span', field: 'L' }]);
    expect(codes({ ...base, h: Number.POSITIVE_INFINITY })).toEqual([{ code: 'number', field: 'h' }]);
    expect(codes({ ...base, h: 7000 })).toEqual([{ code: 'rise', ratio: 7000 / 60, max: 100 }]);
    expect(codes({ ...base, loads: [{ x: Number.NaN, P: 1 }] })).toEqual([{ code: 'number', field: 'x', index: 0 }]);
    expect(codes({ ...base, loads: [{ x: 5, P: Number.NaN }] })).toEqual([{ code: 'number', field: 'P', index: 0 }]);
  });

  it('too-many-loads: 13 loads', () => {
    const loads = Array.from({ length: MAX_POINT_LOADS + 1 }, (_, i) => ({ x: i + 1, P: 1 }));
    expect(codes({ ...base, loads })).toEqual([{ code: 'too-many-loads', count: MAX_POINT_LOADS + 1, max: MAX_POINT_LOADS }]);
    expect(solvePoints({ ...base, loads: loads.slice(0, MAX_POINT_LOADS), known: { kind: 'H', value: 10 } }).ok).toBe(true);
  });

  it('load-position (outside the open interval 0 … L) and duplicate-position', () => {
    expect(codes({ ...base, loads: [{ x: 0, P: 1 }] })).toEqual([{ code: 'load-position', index: 0, value: 0 }]);
    expect(codes({ ...base, loads: [{ x: 10, P: 1 }, { x: 60, P: 1 }] })).toEqual([{ code: 'load-position', index: 1, value: 60 }]);
    expect(codes({ ...base, loads: [{ x: 10, P: 1 }, { x: -5, P: 1 }] })[0]).toMatchObject({ code: 'load-position', index: 1 });
    expect(codes({ ...base, loads: [{ x: 10, P: 1 }, { x: 20, P: 1 }, { x: 10, P: 2 }] })).toEqual([{ code: 'duplicate-position', indices: [0, 2] }]);
  });

  it('no-loads: none, or all zero', () => {
    expect(codes({ ...base, loads: [], known: { kind: 'H', value: 5 } })).toEqual([{ code: 'no-loads' }]);
    expect(codes({ ...base, loads: [{ x: 10, P: 0 }], known: { kind: 'H', value: 5 } })).toEqual([{ code: 'no-loads' }]);
  });

  it('known-value and sag-position', () => {
    expect(codes({ ...base, known: { kind: 'H', value: 0 } })).toEqual([{ code: 'known-value', field: 'H' }]);
    expect(codes({ ...base, known: { kind: 'sag', x: 15, value: 0 } })).toEqual([{ code: 'known-value', field: 'sag' }]);
    expect(codes({ ...base, known: { kind: 'T-max', value: -3 } })).toEqual([{ code: 'known-value', field: 'T-max' }]);
    expect(codes({ ...base, known: { kind: 'x', value: 1 } })).toEqual([{ code: 'known-value', field: 'known' }]);
    expect(codes({ ...base, known: { kind: 'sag', x: 0, value: 3 } })).toEqual([{ code: 'sag-position', value: 0 }]);
    expect(codes({ ...base, known: { kind: 'sag', x: 70, value: 3 } })).toEqual([{ code: 'sag-position', value: 70 }]);
    expect(codes({ ...base, known: { kind: 'sag', x: Number.NaN, value: 3 } })[0].code).toBe('sag-position');
  });

  it('negative-tension: a sag on the wrong side of the chord (a cable above its chord is slack), with the H it would need', () => {
    const out = codes({ ...base, known: { kind: 'sag', x: 15, value: -5 } });
    expect(out).toHaveLength(1);
    expect(out[0].code).toBe('negative-tension');
    // R_A0 = (10·45 + 10·15)/60 = 10 kip; M0(15) = 150; H = 150 / (−5) = −30
    near(out[0].value ?? 0, -30, 1e-12);
  });

  it('the sag at a position where the loads\' moment is zero is a sag-position problem (it would be 0 for any H): uplift cancelling the downward load', () => {
    // +10 at 20 and −10 at 40 on a level span: R_A0 = 10/3 and M0(30) = 100 − 100 = 0
    const out = codes({ L: 60, h: 0, loads: [{ x: 20, P: 10 }, { x: 40, P: -10 }], known: { kind: 'sag', x: 30, value: 3 } });
    expect(out).toEqual([{ code: 'sag-position', value: 30 }]);
  });

  it('tension-below-minimum: the largest tension cannot be less than the cable needs; known-value when it is larger than the search', () => {
    const out = codes({ ...base, known: { kind: 'T-max', value: 1 } });
    expect(out).toHaveLength(1);
    expect(out[0].code).toBe('tension-below-minimum');
    expect(out[0].min).toBeGreaterThan(1);
    expect(out[0].value).toBe(1);
    expect(codes({ ...base, known: { kind: 'T-max', value: 1e300 } })[0].code).toBe('known-value');
  });

  it('size: a sag so small (the smallest double) that H is past a double', () => {
    expect(codes({ ...base, known: { kind: 'sag', x: 15, value: 5e-324 } })).toEqual([{ code: 'size' }]);
  });

  it('solver: whatever throws inside is caught and said (a load list that throws when read)', () => {
    const booby = { L: 60, h: 0, known: { kind: 'H', value: 1 }, get loads(): never { throw new Error('boom'); } };
    expect(solvePoints(booby as unknown as PointsInput)).toEqual({ ok: false, issues: [{ code: 'solver' }] });
  });

  it('never throws on rubbish', () => {
    for (const r of [undefined, null, {}, { L: 'a' }, { L: 1, h: 0, loads: 'x', known: 3 }, { L: 1, h: 0, loads: [null], known: { kind: 'H', value: 1 } }]) {
      expect(() => solvePoints(r as unknown as PointsInput)).not.toThrow();
      expect(solvePoints(r as unknown as PointsInput).ok).toBe(false);
    }
  });
});

describe('warnings', () => {
  it('upward-load, zero-load, sag-not-at-load', () => {
    const s = points({ L: 60, h: 0, loads: [{ x: 10, P: 10 }, { x: 20, P: 0 }, { x: 30, P: -1 }, { x: 45, P: 12 }], known: { kind: 'sag', x: 25, value: 6 } });
    const codes = s.warnings.map((w) => w.code).sort();
    expect(codes).toEqual(['sag-not-at-load', 'upward-load', 'zero-load']);
    expect(s.warnings.find((w) => w.code === 'upward-load')?.count).toBe(1);
    expect(s.warnings.find((w) => w.code === 'zero-load')?.count).toBe(1);
    expect(s.warnings.find((w) => w.code === 'sag-not-at-load')?.value).toBe(25);
  });
});
