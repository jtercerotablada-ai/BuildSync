import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseCable, analyseSafely } from './analysis';
import { convertCable, defaultCase, exampleOf, reduceCable, type CableForm } from './model';
import { between, near, numbersIn, pickOf, randomForm, rng, solvableForm } from './testlib';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

const A = (Math.PI / 4) * 0.25 ** 2;
const RAD = Math.PI / 180;

describe('the default case of each mode: the hand answers', () => {
  it('load: a symmetric sling of two 10 ft legs at 60° carrying 2,000 lbf', () => {
    const a = analyseCable(defaultCase());
    expect(a.issues).toEqual([]);
    expect(a.warnings).toEqual([]);
    expect(a.typical).toBe(false);
    const l = a.load!;
    const T = 2000 / (2 * Math.sin(60 * RAD));
    expect(l.legs[0].T).toBeCloseTo(T, 9); // 1,154.70 lbf
    expect(l.legs[0].stress).toBeCloseTo(T / A / 1000, 9); // 23.523 ksi
    expect(l.legs[0].stress).toBeCloseTo(23.523, 3);
    expect(l.legs[0].strain).toBeCloseTo(T / A / 29e6, 12); // 8.1115 × 10⁻⁴
    expect(l.legs[0].elastic).toBeCloseTo(0.09734, 5); // in
    expect(l.legs[0].thermal).toBe(0);
    expect(l.legs[0].stretch).toBeCloseTo(0.09734, 5);
    expect(l.legs[0].newLength).toBeCloseTo(10 + 0.09734 / 12, 6); // ft
    expect(l.legs[0].length).toBe(10);
    expect(l.legs[0].A).toBeCloseTo(A, 12);
    expect(l.legs[0].E).toBe(29000);
    expect(l.legs[0].alpha).toBe(6.5);
    expect(l.move.linear.dx).toBe(0);
    expect(l.move.linear.dy).toBeCloseTo(-0.1124, 4);
    expect(l.move.exact!.dy).toBeCloseTo(-0.1124, 3);
    expect(l.move.difference).toBeGreaterThan(0);
    // In the displaced geometry the legs are a hair steeper: the tension is 0.03 % lower.
    expect(Math.abs(l.secondOrder!.T1 - T)).toBeLessThan(1);
    expect(l.secondOrder!.T1).toBeLessThan(T);
    expect(l.balanced).toBe(true);
    expect(l.thermal).toBe(false);
    expect(l.legs.map((x) => x.share)).toEqual([1, 1]);
    // The drawing: anchors at ±5 ft, 8.66 ft up; the load point at the origin.
    const d = a.drawing.sling!;
    expect(d.anchors[0].x).toBeCloseTo(-5, 12);
    expect(d.anchors[1].x).toBeCloseTo(5, 12);
    expect(d.anchors[0].y).toBeCloseTo(8.660254, 5);
    expect(d.anchors[0].tension).toBeCloseTo(T, 9);
    expect(d.arrows).toHaveLength(1);
    expect(d.arrows[0]).toMatchObject({ id: 'W', fx: 0, fy: -2000, dx: 0, dy: -1, share: 1 });
    expect(d.displaced!.y).toBeCloseTo(-0.1124 / 12, 5);
    expect(d.moveScale).toBeGreaterThan(1);
    expect(d.box.x0).toBeCloseTo(-5, 12);
    expect(d.box.x1).toBeCloseTo(5, 12);
    expect(d.box.y0).toBe(0);
    expect(a.pull).toBeNull();
    expect(a.drum).toBeNull();
  });

  it('pull: the textbook crate (100 lb, μ 0.5 / 0.4, 30°)', () => {
    const a = analyseCable(exampleOf('pull'));
    expect(a.issues).toEqual([]);
    const p = a.pull!;
    const run = p.regimes.find((r) => r.id === 'run')!;
    const start = p.regimes.find((r) => r.id === 'start')!;
    expect(run.T).toBeCloseTo(37.5226, 3);
    expect(run.N).toBeCloseTo(81.2387, 3);
    expect(run.F).toBeCloseTo(32.4955, 3);
    expect(start.T).toBeCloseTo(44.8018, 3);
    expect(run.optimum.phi).toBeCloseTo(21.8014, 4);
    expect(run.optimum.T).toBeCloseTo(37.1391, 3);
    expect(p.governing).toBe('start');
    // The cable carries the governing tension: σ, δe over 20 ft.
    expect(start.cable!.T).toBeCloseTo(44.8018, 3);
    expect(start.cable!.stress).toBeCloseTo(44.8018 / A / 1000, 5);
    expect(start.cable!.elastic).toBeCloseTo((44.8018 * 240) / (A * 29e6), 6); // in
    expect(start.cable!.length).toBe(20);
    expect(p.surface).toMatchObject({ theta: 0, sx: 1, sy: 0, nx: 0, ny: 1 });
    expect(p.cableAngle).toBe(30);
    expect(p.mass).toBe(100);
    expect(a.drawing.sling).toBeNull();
  });

  it('drum: 2 turns round a post, μ 0.3, 1,000 lbf', () => {
    const a = analyseCable(exampleOf('drum'));
    expect(a.issues).toEqual([]);
    const d = a.drum!;
    expect(d.solved).toBe('Tsmall');
    expect(d.Tsmall).toBeCloseTo(23.0541, 3);
    expect(d.ratio).toBeCloseTo(43.3762, 3);
    expect(d.betaDeg).toBeCloseTo(720, 12);
    expect(d.turns).toBeCloseTo(2, 14);
    expect(d.holdShare).toBeCloseTo(0.02305, 4);
    // Two whole turns: the forces on the drum differ by Tbig − Tsmall, and the x component is rounding → exactly 0.
    expect(d.resultant.magnitude).toBeCloseTo(1000 - 23.0541, 3);
    expect(d.resultant.x).toBe(0);
    expect(d.resultant.y).toBeCloseTo(-(1000 - 23.0541), 3);
    expect(d.cable!.T).toBe(1000);
    expect(d.cable!.stress).toBeCloseTo(1000 / A / 1000, 6);
    expect(d.cable!.elastic).toBeNull(); // no length
    const dr = a.drawing.drum!;
    expect(dr.wrap).toBeCloseTo(720, 12);
    expect(dr.bigPoint).toEqual({ x: 1, y: 0 });
    expect(dr.smallPoint.x).toBeCloseTo(1, 12);
    expect(dr.smallPoint.y).toBe(0);
    const sum = dr.arrows[0].fx + dr.arrows[1].fx;
    expect(Math.abs(sum - dr.arrows[2].fx)).toBeLessThan(1e-9);
  });
});

describe('the modes’ other results', () => {
  it('load: the restrained thermal force, the MBF ratio, the MBF that n·T asks for, the area for an allowable stress', () => {
    let f = reduceCable(defaultCase(), { type: 'dT', value: -50 });
    f = reduceCable(f, { type: 'section', patch: { mbf: 6000 } });
    f = reduceCable(f, { type: 'design', patch: { n: 5, allowable: 30 } });
    const l = analyseCable(f).load!;
    const hand = 29e6 * A * 6.5e-6 * 50; // 462.65 lbf, tension on cooling
    const T = 2000 / Math.sqrt(3);
    expect(l.legs[0].restrainedForce).toBeCloseTo(hand, 8);
    expect(l.legs[0].restrainedStress).toBeCloseTo(29 * 6.5e-3 * 50, 9); // 9.425 ksi
    expect(l.legs[0].combinedTension).toBeCloseTo(T + hand, 8);
    expect(l.legs[0].combinedSlack).toBe(false);
    expect(l.legs[0].thermal).toBeCloseTo(-6.5e-6 * 120 * 50, 12); // a contraction of 0.039 in
    expect(l.legs[0].mbf).toBe(6000);
    expect(l.legs[0].mbfRatio).toBeCloseTo(6000 / T, 12);
    expect(l.legs[0].mbfRatioCombined).toBeCloseTo(6000 / (T + hand), 12);
    expect(l.legs[0].requiredMbf).toBeCloseTo(5 * T, 9);
    expect(l.legs[0].requiredArea).toBeCloseTo(T / 30000, 12);
    expect(l.legs[0].requiredArea! * 1).toBeCloseTo(0.038490, 5); // in²
    expect(l.legs[0].requiredDiameter).toBeCloseTo(Math.sqrt((4 * T) / (Math.PI * 30000)), 12);
    expect(l.thermal).toBe(true);
  });
  it('load: a warm cable with its ends held goes slack, said as a warning with the leg', () => {
    const a = analyseCable(reduceCable(defaultCase(), { type: 'dT', value: 150 }));
    expect(a.warnings).toEqual([{ code: 'restrained-slack', leg: 1 }, { code: 'restrained-slack', leg: 2 }]);
    expect(a.load!.legs[0].combinedSlack).toBe(true);
    expect(a.load!.legs[0].combinedTension).toBeLessThan(0);
  });
  it('load: a thermal stretch that cancels an elastic one is exactly zero, never 1e-17', () => {
    // Choose ΔT so that α·L·ΔT = −T·L/(A·E): the stretch is 0 to the last bit or a rounding of it.
    const T = 2000 / Math.sqrt(3);
    const dT = -T / (A * 29e6) / 6.5e-6;
    const l = analyseCable(reduceCable(defaultCase(), { type: 'dT', value: dT })).load!;
    expect(l.legs[0].stretch).toBe(0);
    expect(Object.is(l.legs[0].stretch, 0)).toBe(true);
    expect(l.move.linear.dy).toBe(0);
    expect(l.move.exact!.dy === 0 || Math.abs(l.move.exact!.dy) < 1e-12).toBe(true);
  });
  it('load: one leg with a horizontal force, and no load', () => {
    let f = reduceCable(defaultCase(), { type: 'legs', legs: 1 });
    f = reduceCable(f, { type: 'loadInput', patch: { W: 300, H: 400 } });
    const l = analyseCable(f).load!;
    expect(l.legs).toHaveLength(1);
    expect(l.legs[0].T).toBeCloseTo(500, 9);
    expect(l.legs[0].angle).toBeCloseTo(36.8699, 4);
    expect(l.legs[0].side).toBe('left');
    expect(l.secondOrder).toBeNull();
    const none = analyseCable(reduceCable(defaultCase(), { type: 'loadInput', patch: { W: 0 } }));
    expect(none.warnings.map((w) => w.code)).toContain('no-load');
    expect(none.load!.legs[0].T).toBe(0);
    expect(none.load!.legs[0].share).toBe(0);
    expect(none.load!.move.linear).toEqual({ dx: 0, dy: 0, magnitude: 0 });
    expect(none.drawing.sling!.displaced).toBeNull();
    expect(none.drawing.sling!.moveScale).toBeNull();
  });
  it('load: a leg with its own rope section stretches by its own modulus', () => {
    let f = reduceCable(defaultCase(), { type: 'own2', on: true });
    f = reduceCable(f, { type: 'material', material: 'rope', target: 'leg2' });
    f = reduceCable(f, { type: 'rope', rope: 'rope-6x19', target: 'leg2' });
    f = reduceCable(f, { type: 'section', patch: { d: 0.5 }, target: 'leg2' });
    const a = analyseCable(f);
    expect(a.typical).toBe(true);
    const l = a.load!;
    const T = 2000 / Math.sqrt(3);
    expect(l.legs[1].A).toBeCloseTo(0.4 * 0.25, 12);
    expect(l.legs[1].E).toBe(13000);
    expect(l.legs[1].elastic).toBeCloseTo((T * 120) / (0.1 * 13e6), 9);
    // The load point moves sideways as well as down, because the legs stretch differently.
    expect(l.move.linear.dx).not.toBe(0);
  });
  it('pull: refuses what leaves the surface, finds what slides, holds it, and carries the governing tension into the cable', () => {
    const f = reduceCable(exampleOf('pull'), { type: 'pullInput', patch: { theta: 45, muS: 0.2, muK: 0.2, phi: 60 } });
    const p = analyseCable(f).pull!;
    expect(p.regimes[1].status).toBe('leaves-surface');
    expect(p.regimes[1].T).toBeNull();
    expect(p.regimes[1].cable).toBeNull();
    expect(p.regimes[1].phiLift).toBeCloseTo(45, 12);
    expect(p.governing).toBeNull();
    const slide = analyseCable(reduceCable(exampleOf('pull'), { type: 'pullInput', patch: { theta: -20, muS: 0.2, muK: 0.2, phi: 10 } }));
    expect(slide.pull!.regimes[1].status).toBe('slides-on-its-own');
    expect(slide.pull!.regimes[1].hold!.T).toBeGreaterThan(0);
    expect(slide.warnings.map((w) => w.code)).toContain('no-governing');
  });
  it('pull: acceleration and a mass', () => {
    let f = reduceCable(exampleOf('pull'), { type: 'pullInput', patch: { accel: 8.04351 } });
    let p = analyseCable(f).pull!;
    const acc = p.regimes.find((r) => r.id === 'accel')!;
    expect(acc.aOverG).toBeCloseTo(0.25, 5);
    expect(acc.a).toBeCloseTo(8.04351, 10);
    expect(acc.T).toBeCloseTo((100 * (0.4 + 0.25)) / (Math.cos(30 * RAD) + 0.2), 4);
    expect(p.governing).toBe('accel');
    f = reduceCable(f, { type: 'units', units: 'si' });
    f = reduceCable(f, { type: 'pullInput', patch: { massInput: true } });
    p = analyseCable(f).pull!;
    expect(p.mass).toBeCloseTo(45.359, 2);
    expect(p.W).toBeCloseTo(444.82, 1);
  });
  it('pull: the curve, its marked minimum and the plot window', () => {
    const p = analyseCable(exampleOf('pull')).pull!;
    for (const c of p.curves) {
      expect(c.points).toHaveLength(181);
      expect(c.minIndex).not.toBeNull();
      const least = Math.min(...c.points.filter((x) => x.valid).map((x) => x.T!));
      expect(c.points[c.minIndex!].T).toBe(least);
      expect(c.optimum!.T).toBeLessThanOrEqual(least + 1e-9);
      expect(c.maxValid).toBeGreaterThan(least);
      expect(c.plotMax).toBeLessThanOrEqual(c.maxValid!);
      expect(c.plotMax).toBeGreaterThan(least);
    }
  });
  it('pull: the free-body arrows balance (a = 0), and balance with the inertia force when accelerating', () => {
    const r = rng(71);
    for (let k = 0; k < 300; k++) {
      const f = solvableForm(r, 'pull');
      const a = analyseCable(f);
      for (const reg of a.pull!.regimes) {
        if (reg.status !== 'pull') {
          expect(reg.arrows.map((x) => x.id)).toEqual(['W']);
          continue;
        }
        const sx = reg.arrows.reduce((s, x) => s + x.fx, 0);
        const sy = reg.arrows.reduce((s, x) => s + x.fy, 0);
        // What is left is m·a along the direction of travel (the surface at θ).
        const th = f.pull.theta * RAD;
        const ma = reg.inertia;
        expect(Math.abs(sx - ma * Math.cos(th))).toBeLessThan(1e-9 * a.pull!.W + 1e-12);
        expect(Math.abs(sy - ma * Math.sin(th))).toBeLessThan(1e-9 * a.pull!.W + 1e-12);
        expect(Math.max(...reg.arrows.map((x) => x.share))).toBe(1);
      }
    }
  });
  it('drum: each unknown, the holding force, and the faults', () => {
    const d = exampleOf('drum');
    const big = analyseCable(reduceCable(d, { type: 'drumInput', patch: { Tbig: null, Tsmall: 23.0541 } })).drum!;
    expect(big.solved).toBe('Tbig');
    expect(big.Tbig).toBeCloseTo(1000, 1);
    const mu = analyseCable(reduceCable(d, { type: 'drumInput', patch: { mu: null, Tsmall: 23.0541 } })).drum!;
    expect(mu.solved).toBe('mu');
    expect(mu.mu).toBeCloseTo(0.3, 5);
    const wrap = analyseCable(reduceCable(d, { type: 'drumInput', patch: { wrap: null, Tsmall: 23.0541 } })).drum!;
    expect(wrap.solved).toBe('beta');
    expect(wrap.turns).toBeCloseTo(2, 4);
    expect(wrap.betaDeg).toBeCloseTo(720, 2);
    // In degrees.
    const deg = analyseCable(reduceCable(d, { type: 'drumInput', patch: { wrap: 180, wrapUnit: 'deg' } })).drum!;
    expect(deg.ratio).toBeCloseTo(Math.exp(0.3 * Math.PI), 12);
    expect(deg.resultant.magnitude).toBeCloseTo(1000 + deg.Tsmall, 9);
    expect(deg.resultant.x).toBe(0);
    const under = analyseCable(reduceCable(d, { type: 'drumInput', patch: { mu: null } }));
    expect(under.issues).toEqual([{ code: 'underdetermined', count: 2 }]);
    expect(under.drum).toBeNull();
    expect(analyseCable(reduceCable(d, { type: 'drumInput', patch: { Tsmall: 5 } })).issues).toEqual([{ code: 'overdetermined' }]);
    const order = analyseCable(reduceCable(d, { type: 'force', force: 'large' }));
    expect(order.drum).not.toBeNull();
    const ord = analyseCable(reduceCable(reduceCable(d, { type: 'force', force: 'large' }), { type: 'drumInput', patch: { Tsmall: 2, Tbig: 1, mu: null } }));
    // Numbers are in the force unit shown (kip).
    expect(ord.issues).toEqual([{ code: 'order', numbers: [1, 2] }]);
    const w = analyseCable(reduceCable(d, { type: 'drumInput', patch: { wrap: 101, wrapUnit: 'turns' } }));
    expect(w.issues[0]).toMatchObject({ code: 'range', row: { group: 'drum', field: 'wrap' }, max: 100 });
    const wd = analyseCable(reduceCable(d, { type: 'drumInput', patch: { wrap: 40000, wrapUnit: 'deg' } }));
    expect(wd.issues[0]).toMatchObject({ code: 'range', max: 36000 });
  });
});

describe('faults, by the row of the form', () => {
  const rowOf = (f: CableForm) => analyseCable(f).issues[0];
  it('names the field in the form’s vocabulary', () => {
    expect(rowOf(reduceCable(defaultCase(), { type: 'section', patch: { d: null } }))).toMatchObject({ code: 'number', row: { group: 'section', field: 'd' } });
    expect(rowOf(reduceCable(defaultCase(), { type: 'section', patch: { by: 'area', A: 0 } }))).toMatchObject({ code: 'range', row: { group: 'section', field: 'A' }, min: 0, minOpen: true });
    expect(rowOf(reduceCable(defaultCase(), { type: 'section', patch: { E: Number.NaN } }))).toMatchObject({ code: 'number', row: { group: 'section', field: 'E' } });
    expect(rowOf(reduceCable(defaultCase(), { type: 'leg', leg: 2, patch: { angle: 91 } }))).toMatchObject({ code: 'range', row: { group: 'leg2', field: 'angle' }, leg: 2, min: 0, max: 90 });
    expect(rowOf(reduceCable(defaultCase(), { type: 'leg', leg: 1, patch: { length: 0 } }))).toMatchObject({ code: 'range', row: { group: 'leg1', field: 'length' } });
    expect(rowOf(reduceCable(defaultCase(), { type: 'loadInput', patch: { W: -1 } }))).toMatchObject({ code: 'range', row: { group: 'load', field: 'W' } });
    expect(rowOf(reduceCable(defaultCase(), { type: 'dT', value: Number.NaN }))).toMatchObject({ code: 'number', row: { group: 'dT' } });
    expect(rowOf(reduceCable(defaultCase(), { type: 'design', patch: { n: -2 } }))).toMatchObject({ code: 'range', row: { group: 'design', field: 'n' } });
    // Leg 2's own section.
    let own = reduceCable(defaultCase(), { type: 'own2', on: true });
    own = reduceCable(own, { type: 'section', patch: { d: Number.NaN }, target: 'leg2' });
    expect(rowOf(own)).toMatchObject({ code: 'number', row: { group: 'leg2section', field: 'd' }, leg: 2 });
    expect(rowOf(reduceCable(exampleOf('pull'), { type: 'pullInput', patch: { muS: Number.NaN } }))).toMatchObject({ code: 'number', row: { group: 'pull', field: 'muS' } });
    expect(rowOf(reduceCable(exampleOf('pull'), { type: 'pullInput', patch: { accel: Number.NaN } }))).toMatchObject({ row: { group: 'pull', field: 'accel' } });
    expect(rowOf(reduceCable(exampleOf('pull'), { type: 'pullInput', patch: { theta: 70 } }))).toMatchObject({ code: 'range', row: { group: 'pull', field: 'theta' }, min: -30, max: 60 });
    expect(rowOf(reduceCable(exampleOf('pull'), { type: 'pullInput', patch: { W: 0 } }))).toMatchObject({ row: { group: 'pull', field: 'W' } });
  });
  it('says the bounds in the units shown', () => {
    // A weight that is a mass is bounded in lb or kg, a length in ft or m: the bound 0 is open either way; the limit 1e30 of the number is not a "range".
    const a = analyseCable(reduceCable(exampleOf('load'), { type: 'leg', leg: 1, patch: { length: -3 } }));
    expect(a.issues[0]).toMatchObject({ code: 'range', min: 0, minOpen: true });
  });
  it('a sling that cannot be solved is said by its code and the numbers, in the force unit', () => {
    const slack = analyseCable(reduceCable(reduceCable(defaultCase(), { type: 'leg', leg: 2, patch: { side: 'left', angle: 30 } }), { type: 'leg', leg: 1, patch: { angle: 60 } }));
    expect(slack.issues[0].code).toBe('slack-leg');
    expect(slack.issues[0].numbers).toHaveLength(2);
    expect(Math.min(...slack.issues[0].numbers!)).toBeLessThan(0);
    const parallel = analyseCable(reduceCable(reduceCable(defaultCase(), { type: 'leg', leg: 1, patch: { angle: 90 } }), { type: 'leg', leg: 2, patch: { angle: 90 } }));
    expect(parallel.issues[0].code).toBe('parallel-legs');
    expect(parallel.load).toBeNull();
    expect(parallel.drawing.sling).toBeNull();
  });
  it('a missing cable does not stop the pull or the drum, it empties the cable block and says why', () => {
    const p = analyseCable(reduceCable(exampleOf('pull'), { type: 'section', patch: { d: null } }));
    expect(p.issues).toEqual([]);
    expect(p.pull!.regimes[0].T).toBeCloseTo(44.8018, 3);
    expect(p.pull!.regimes[0].cable).toBeNull();
    expect(p.cableIssues[0]).toMatchObject({ code: 'number', row: { group: 'section', field: 'd' } });
    const d = analyseCable(reduceCable(exampleOf('drum'), { type: 'section', patch: { E: null } }));
    expect(d.drum!.Tsmall).toBeGreaterThan(0);
    expect(d.drum!.cable).toBeNull();
    expect(d.cableIssues[0].row).toEqual({ group: 'section', field: 'E' });
    const len = analyseCable(reduceCable(exampleOf('pull'), { type: 'pullInput', patch: { length: 0 } }));
    expect(len.cableIssues[0]).toMatchObject({ code: 'range', row: { group: 'pull', field: 'length' } });
  });
});

/** The presets are written out in each system (200 GPa for 29,000 ksi: 0.03 % apart; the rope's 90 GPa for 13,000 ksi: 0.4 %), so the exact comparison is made on a modulus typed in. */
const ownSteel = (f: CableForm): CableForm => ({ ...f, section: { ...f.section, material: 'custom' } });

describe('the settled numbers', () => {
  it('has no NaN, no Infinity and no −0 anywhere, over random forms of every kind (also those that do not solve)', () => {
    const r = rng(81);
    for (let k = 0; k < 1200; k++) {
      const f = r() < 0.5 ? randomForm(r) : solvableForm(r, pickOf(r, ['load', 'pull', 'drum'] as const), r() < 0.5 ? 'us' : 'si');
      const a = analyseSafely(f);
      for (const v of numbersIn({ ...a, units: undefined })) {
        expect(Number.isFinite(v)).toBe(true);
        expect(Object.is(v, -0)).toBe(false);
      }
      expect(a.mode).toBe(f.mode);
    }
  });
  it('a force that is rounding is 0, not 1e-13', () => {
    // One leg, H = 0, many W: the cable is vertical, ux is exactly 0 (never −0).
    const r = rng(82);
    for (let k = 0; k < 300; k++) {
      let f = reduceCable(defaultCase(), { type: 'legs', legs: 1 });
      f = reduceCable(f, { type: 'loadInput', patch: { W: between(r, 10, 9000), H: 0 } });
      const l = analyseCable(f).load!;
      expect(Object.is(l.legs[0].ux, 0)).toBe(true);
      expect(l.residual).toBe(0);
    }
    // A two-leg sling with a horizontal force that leaves one leg at exactly zero.
    // 60° / 30° legs: T2 = 0 when H = W/ tan(60°)... use H so that T1 u1 = (−H, W) exactly: leg 1 only.
    let f = reduceCable(defaultCase(), { type: 'leg', leg: 1, patch: { angle: 45 } });
    f = reduceCable(f, { type: 'loadInput', patch: { W: 1000, H: 1000 } });
    f = reduceCable(f, { type: 'leg', leg: 2, patch: { angle: 45 } });
    const l = analyseCable(f).load!;
    // u1 = (−cos45, sin45), u2 = (cos45, sin45); (−H, W) = (−1000, 1000) = T1 u1 → T1 = 1414.2, T2 = 0.
    expect(l.legs[0].T).toBeCloseTo(1000 * Math.SQRT2, 9);
    expect(l.legs[1].T).toBe(0);
    expect(l.legs[1].stress).toBe(0);
    expect(l.legs[1].mbfRatio).toBeNull();
    expect(l.legs[1].share).toBe(0);
  });
  it('the unit systems agree: every number in SI is the same number in US, to the rounding of the converted fields', () => {
    const r = rng(83);
    const F = 4.4482216152605;
    const KSI = 6.894757293168;
    for (let k = 0; k < 150; k++) {
      const us = ownSteel(solvableForm(r, 'load', 'us'));
      const si = convertCable(us, 'si');
      const a = analyseCable(us).load;
      const b = analyseCable(si).load;
      if (!a || !b) {
        expect(!!a).toBe(!!b);
        continue;
      }
      const tol = 3e-4;
      a.legs.forEach((x, i) => {
        const y = b.legs[i];
        expect(near(y.T, x.T * F, tol, 1e-9)).toBe(true);
        expect(near(y.stress, x.stress * KSI, tol, 1e-9)).toBe(true);
        expect(near(y.strain, x.strain, tol, 1e-12)).toBe(true);
        const big = Math.max(Math.abs(x.elastic!), Math.abs(x.thermal!)) * 25.4;
        expect(Math.abs(y.elastic! - x.elastic! * 25.4)).toBeLessThanOrEqual(tol * big + 1e-12);
        expect(Math.abs(y.thermal! - x.thermal! * 25.4)).toBeLessThanOrEqual(tol * big + 1e-12);
        expect(Math.abs(y.stretch! - x.stretch! * 25.4)).toBeLessThanOrEqual(tol * big + 1e-12);
        expect(Math.abs(y.restrainedForce - x.restrainedForce * F)).toBeLessThanOrEqual(tol * Math.abs(x.restrainedForce) * F + 1e-9);
        expect(near(y.angle, x.angle, 1e-4, 1e-4)).toBe(true);
      });
    }
    for (let k = 0; k < 150; k++) {
      const us = ownSteel(solvableForm(r, 'pull', 'us'));
      const si = convertCable(us, 'si');
      const a = analyseCable(us).pull!;
      const b = analyseCable(si).pull!;
      a.regimes.forEach((x, i) => {
        const y = b.regimes[i];
        expect(y.status).toBe(x.status);
        if (x.T !== null) {
          expect(near(y.T!, x.T * F, 3e-4, 1e-9)).toBe(true);
          expect(near(y.N!, x.N! * F, 3e-4, 1e-9)).toBe(true);
          expect(near(y.cable!.stress, x.cable!.stress * KSI, 3e-4, 1e-9)).toBe(true);
        }
        expect(near(y.optimum.phi, x.optimum.phi, 1e-3, 1e-9)).toBe(true);
      });
    }
    for (let k = 0; k < 150; k++) {
      const us = ownSteel(solvableForm(r, 'drum', 'us'));
      const si = convertCable(us, 'si');
      const a = analyseCable(us).drum!;
      const b = analyseCable(si).drum!;
      expect(near(b.Tsmall, a.Tsmall * F, 3e-4)).toBe(true);
      expect(near(b.ratio, a.ratio, 1e-12)).toBe(true);
      expect(near(b.resultant.magnitude, a.resultant.magnitude * F, 3e-4, 1e-9)).toBe(true);
    }
  });
  it('kip and lbf are the same case: a force unit is a label (×1000), the results scale with it', () => {
    const r = rng(84);
    for (let k = 0; k < 60; k++) {
      const f = solvableForm(r, pickOf(r, ['load', 'pull', 'drum'] as const));
      const big = reduceCable(f, { type: 'force', force: 'large' });
      const a = analyseCable(f);
      const b = analyseCable(big);
      if (f.mode === 'load') {
        expect(near(b.load!.legs[0].T * 1000, a.load!.legs[0].T, 1e-9)).toBe(true);
        expect(near(b.load!.legs[0].stress, a.load!.legs[0].stress, 1e-9)).toBe(true);
      } else if (f.mode === 'pull') {
        expect(near(b.pull!.regimes[0].T! * 1000, a.pull!.regimes[0].T!, 1e-9)).toBe(true);
      } else expect(near(b.drum!.Tsmall * 1000, a.drum!.Tsmall, 1e-9)).toBe(true);
    }
  });
  it('twice the load gives twice every force and stress in every mode, and the same angles and ratios', () => {
    const r = rng(85);
    for (let k = 0; k < 60; k++) {
      const f = solvableForm(r, 'load');
      const g = reduceCable(reduceCable(f, { type: 'loadInput', patch: { W: f.load.W * 2, H: f.load.H * 2 } }), { type: 'dT', value: f.dT });
      const a = analyseCable(f).load!;
      const b = analyseCable(g).load!;
      a.legs.forEach((x, i) => {
        expect(near(b.legs[i].T, 2 * x.T, 1e-9, 1e-9)).toBe(true);
        expect(near(b.legs[i].stress, 2 * x.stress, 1e-9, 1e-9)).toBe(true);
        expect(b.legs[i].angle).toBe(x.angle);
      });
    }
    const p = solvableForm(r, 'pull');
    const q = reduceCable(p, { type: 'pullInput', patch: { W: p.pull.W * 2 } });
    const a = analyseCable(p).pull!;
    const b = analyseCable(q).pull!;
    a.regimes.forEach((x, i) => {
      if (x.T !== null) {
        expect(near(b.regimes[i].T!, 2 * x.T, 1e-9, 1e-9)).toBe(true);
        expect(near(b.regimes[i].cable!.stress, 2 * x.cable!.stress, 1e-9, 1e-9)).toBe(true);
      }
      expect(b.regimes[i].optimum.phi).toBe(x.optimum.phi);
    });
  });
  it('ΔT is a difference: the same physical change in °F or °C gives the same thermal stretch in the same length', () => {
    const us = reduceCable(defaultCase(), { type: 'dT', value: 90 }); // 90 °F = 50 °C
    const si = convertCable(us, 'si');
    expect(si.dT).toBeCloseTo(50, 5);
    const a = analyseCable(us).load!.legs[0];
    const b = analyseCable(si).load!.legs[0];
    expect(b.thermal!).toBeCloseTo(a.thermal! * 25.4, 3);
    // 0 °C change is not 32 °F change.
    expect(analyseCable(convertCable(defaultCase(), 'si')).load!.legs[0].thermal).toBe(0);
  });
});

describe('analyseSafely', () => {
  it('never throws, whatever the form is', () => {
    const r = rng(91);
    const junk = [null, undefined, 5, 'x', {}, [], Number.NaN, Infinity];
    for (let k = 0; k < 1000; k++) {
      const f = randomForm(r) as unknown as Record<string, unknown>;
      const key = pickOf(r, Object.keys(f));
      const broken = { ...f, [key]: pickOf(r, junk) };
      expect(() => analyseSafely(broken as unknown as CableForm)).not.toThrow();
    }
    for (const bad of junk) {
      const a = analyseSafely(bad as unknown as CableForm);
      expect(a.issues[0].code).toBe('stopped');
      expect(a.load).toBeNull();
    }
  });
  it('says stopped when the arithmetic threw, and stays a result with its units', () => {
    const a = analyseSafely({ ...defaultCase(), load: null } as unknown as CableForm);
    expect(a.issues).toEqual([{ code: 'stopped' }]);
    expect(a.units.length).toBe('ft');
    expect(a.mode).toBe('load');
  });
});
