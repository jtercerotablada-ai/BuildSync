import { afterEach, describe, expect, it, vi } from 'vitest';
import { solveFrame } from '../frame/engine';
import type { FrameModel } from '../frame/types';
import { solveTruss } from '../truss/engine';
import type { TrussModel } from '../truss/types';
import { analyseSafely, TOLERANCES } from './analysis';
import { solve } from './engine';
import { randomForm } from './forms.testlib';
import {
  convertStiffness,
  decodeStiffness,
  defaultStiffness,
  emptyStiffness,
  reduceStiffness as reduce,
  STIFFNESS_MATERIALS,
  strayOf,
  toEngine,
  type StiffnessForm,
} from './model';
import { randomSpec, rng, solveExactly, stableSpec, toModel, toNumber, type OSpec } from './oracle.testlib';
import type { MatrixBlock, VectorBlock } from './types';
import { ZERO } from './types';

// Heavy by design (exact arithmetic on generated structures): a loaded machine runs past the 5 s default.
vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise((r) => setTimeout(r, 0)));

/**
 * THE REVIEW ROUND OF THE ENGINE AND ITS NUMBERS. Each test is one defect the adversarial review found, with the very case that showed it (or one that
 * fails the same way), and it fails on the engine as it was: a pivot compared with the stiffness its DOF started with (E1), a bar that carries nothing
 * printed as tension (E2), a floor measured against the biggest entry of a matrix (E4), marks on entries that did not change (E5), no sign that
 * displacements are not small (E6), a warning that could not appear (E7).
 */

const PORTAL = 'Kqfz2efg025;1;f;us;s,29000,3000000000,484;0,0_20,0_0,10_20,10;1,3_2,4_3,4;1,7_2,7;3,10,0;';
const FIVE_BAR = 'K5ts2oqtd23;1;t;us;s,29000,10,100;0,0_16,0_8,6_24,6;1,2_1,3_2,3_3,4_2,4;1,3_2,2;3,12,0;';
const portal = (A: number): StiffnessForm => reduce(decodeStiffness(PORTAL)!, { type: 'section', patch: { A } });

/** The portal of the page as an exact specification, in feet and kips, with the area in square feet (the way the form hands it to the engine). */
const portalSpec = (A: number): OSpec => ({
  mode: 'frame',
  nodes: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 10 }, { x: 20, y: 10 }],
  members: [
    { i: 0, j: 2, E: 29000 * 144, A: A / 144, I: 484 / 20736 },
    { i: 1, j: 3, E: 29000 * 144, A: A / 144, I: 484 / 20736 },
    { i: 2, j: 3, E: 29000 * 144, A: A / 144, I: 484 / 20736 },
  ],
  supports: [{ node: 0, ux: true, uy: true, rz: true }, { node: 1, ux: true, uy: true, rz: true }],
  loads: [{ node: 2, fx: 10, fy: 0, m: 0 }],
  memberLoads: [],
});

describe('E1/T1: a stable structure with a very stiff member is not a mechanism', () => {
  it('the portal with an area of 3×10⁹ in² (and 1.41×10⁹): solved, no mechanism, nothing unstable, and the answer is the exact one to the figures the warning promises', () => {
    for (const A of [1e5, 1e8, 1.41e9, 3e9, 1e10]) {
      const a = analyseSafely(portal(A));
      expect(a.issues, `A = ${A}`).toEqual([]);
      expect(a.determinacy.word, `A = ${A}`).toBe('indeterminate');
      expect(a.solution, `A = ${A}`).not.toBeNull();
      // the answer is the exact solution of the very numbers, to the figures the warning says (and to a millionth when it says nothing)
      const exact = solveExactly(portalSpec(A))!;
      const out = solve(toModel(portalSpec(A)));
      expect(out.ok).toBe(true);
      if (!out.ok) continue;
      const top = Math.max(...exact.u.map((q) => Math.abs(toNumber(q))));
      const error = Math.max(...out.u.map((v, d) => Math.abs(v - toNumber(exact.u[d])))) / top;
      const w = out.warnings.find((x) => x.code === 'near-mechanism');
      expect(error, `A = ${A}`).toBeLessThan(w ? 10 ** -w.count! : 1e-6);
    }
  });
  it('the figures counted grow as the contrast does, from none at an ordinary area to one figure; a pivot lost in rounding is refused, as a stiffness range and not as a mechanism', () => {
    const counts = [1e3, 1e8, 1e10, 1e12, 1e13].map((A) => analyseSafely(portal(A)).warnings.find((w) => w.code === 'near-mechanism')?.count ?? Infinity);
    expect(counts[0]).toBe(Infinity);
    for (let k = 1; k < counts.length; k++) expect(counts[k]).toBeLessThanOrEqual(counts[k - 1]);
    expect(counts[counts.length - 1]).toBe(1);
    const lost = analyseSafely(portal(1e14));
    expect(lost.issues.map((i) => i.code)).toEqual(['stiffness-range']);
    expect(lost.determinacy.word).toBeNull();
    expect(lost.partial[lost.partial.length - 1].facts).toMatchObject({ singular: true, cause: 'range' });
  });
  it('a stub of 0.02 ft in a 22 ft portal is solved without a word, and 0.002 ft with the figures counted; neither is a mechanism', () => {
    const base = portal(100);
    for (const stub of [0.02, 0.002]) {
      let g = reduce(base, { type: 'add', list: 'nodes', seed: { x: stub, y: 10 } });
      const middle = g.nodes[4].id;
      g = reduce(g, { type: 'patch', list: 'members', id: g.members[2].id, patch: { i: g.nodes[2].id, j: middle } });
      g = reduce(g, { type: 'add', list: 'members', seed: { i: middle, j: g.nodes[3].id } });
      const a = analyseSafely(g);
      expect(a.issues, `stub ${stub}`).toEqual([]);
      expect(a.solution, `stub ${stub}`).not.toBeNull();
    }
  });
  it('one truss bar of 10¹⁰ in² (a rigid link) is solved, and says how many figures stand', () => {
    const f = defaultStiffness();
    const g = reduce(f, { type: 'patch', list: 'members', id: f.members[0].id, patch: { A: 1e10 } });
    const a = analyseSafely(g);
    expect(a.issues).toEqual([]);
    expect(a.warnings.map((w) => w.code)).toEqual(['near-mechanism']);
    expect(a.warnings[0].count).toBeGreaterThanOrEqual(3);
  });
  it('a true mechanism is a mechanism whatever the sections, and names the right DOF, with a very stiff member in the structure or not', () => {
    for (const A of [1e-3, 10, 1e6, 1e12]) {
      const out = solve({ mode: 'truss', nodes: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }], members: [{ i: 0, j: 1 }, { i: 1, j: 2 }], supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 2, ux: true, uy: true, rz: false }], loads: [{ node: 1, fx: 0, fy: -1, m: 0 }], memberLoads: [], E: 100, A });
      expect(out.ok, `A = ${A}`).toBe(false);
      if (!out.ok) expect(out.issues[0], `A = ${A}`).toMatchObject({ code: 'mechanism', dof: 4, node: 2, kind: 'sway' });
    }
    // a rectangle of four bars with one of them 10¹¹ times stiffer: still the sway of a rectangle
    const square = (A0: number) => solve({ mode: 'truss', nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }], members: [{ i: 0, j: 1, A: A0 }, { i: 1, j: 2 }, { i: 2, j: 3 }, { i: 3, j: 0 }], supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 1, ux: false, uy: true, rz: false }], loads: [{ node: 2, fx: 10, fy: 0, m: 0 }], memberLoads: [], E: 1000, A: 1 });
    for (const A0 of [1, 1e6, 1e11]) {
      const out = square(A0);
      expect(out.ok, `A0 = ${A0}`).toBe(false);
      if (!out.ok) expect(out.issues[0].code, `A0 = ${A0}`).toBe('mechanism');
    }
  });
  it('600 generated structures, a third with a member from 10² to 10¹¹ times stiffer: no mechanism solved, no stable structure called a mechanism, no mechanism called anything else', () => {
    const r = rng(2026);
    let solved = 0;
    let mechanisms = 0;
    for (let n = 0; n < 600; n++) {
      const seed = 31000 + n;
      const mode = n % 2 === 0 ? 'truss' : 'frame';
      const spec = n % 3 === 0 ? stableSpec(seed, { mode, maxNodes: 8, extra: 0.7 }) : randomSpec(seed, { mode, maxNodes: 8, extra: 0.7 });
      if (spec.members.length === 0) continue;
      let stiff = 0;
      if (n % 3 !== 0) {
        stiff = 2 + Math.floor(r() * 10);
        const m = Math.floor(r() * spec.members.length);
        spec.members[m] = { ...spec.members[m], A: spec.members[m].A * 10 ** stiff, I: spec.members[m].I * 10 ** Math.min(stiff, 4) };
      }
      const exact = solveExactly(spec);
      const mine = solve(toModel(spec));
      if (exact === null) {
        mechanisms++;
        expect(mine.ok, `#${seed} a mechanism was solved`).toBe(false);
        // (beside a member 10⁹ times stiffer the movement of a mechanism cannot be told from the stable one next to it, and the tool says 'stiffness range' and does not swear)
        if (!mine.ok) expect(stiff >= 9 ? ['mechanism', 'few-supports', 'stiffness-range'] : ['mechanism', 'few-supports'], `#${seed}`).toContain(mine.issues[0].code);
      } else {
        solved++;
        if (!mine.ok) {
          // a refusal of a structure that has a solution may only be for the arithmetic, never for a mechanism
          expect(['stiffness-range', 'ill-conditioned'], `#${seed} ${JSON.stringify(mine.issues)}`).toContain(mine.issues[0].code);
        } else {
          const top = Math.max(...exact.u.map((q) => Math.abs(toNumber(q))), 1e-300);
          const error = Math.max(...mine.u.map((v, d) => Math.abs(v - toNumber(exact.u[d])))) / top;
          const w = mine.warnings.find((x) => x.code === 'near-mechanism');
          expect(error, `#${seed}`).toBeLessThan(Math.max(w ? 10 ** -w.count! : 0, 1e-6));
        }
      }
    }
    expect(solved).toBeGreaterThan(150);
    expect(mechanisms).toBeGreaterThan(150);
  });
});

describe('E2: a bar that carries nothing carries nothing', () => {
  it('the five-bar truss without the load on the free node: the zero-force bars are exactly 0, in US and in SI, with no tension and no compression', () => {
    for (const units of ['us', 'si'] as const) {
      const f = convertStiffness(decodeStiffness(FIVE_BAR)!, units);
      const a = analyseSafely(f);
      const bars = a.results!.members;
      expect(bars.map((b) => b.bar!.state), units).toEqual(['tension', 'tension', 'compression', 'zero', 'zero']);
      for (const b of [bars[3], bars[4]]) {
        expect(b.bar).toMatchObject({ N: 0, stress: 0, elongation: 0, state: 'zero' });
        expect([b.start.N, b.end.N]).toEqual([0, 0]);
      }
      // the drawing says the same
      expect(a.drawing.forces.map((x) => x.state)).toEqual(['tension', 'tension', 'compression', 'zero', 'zero']);
      // and the step that prints the bar's numbers
      const step = a.solution!.steps.find((s) => s.key === 'end-forces#4')!;
      const N = step.blocks.find((b) => b.type === 'scalar' && b.name === 'N') as { value: number };
      expect(N.value).toBe(0);
      const f4 = step.blocks.find((b) => b.type === 'vector' && b.name === 'f') as VectorBlock;
      expect(f4.values.every((v) => v === 0)).toBe(true);
    }
  });
  it('300 solved structures: no end force is a value under a billionth of the force scale that is not exactly 0 (a bar is in tension or in compression, or it is idle)', () => {
    let checked = 0;
    for (let seed = 1; seed <= 1500 && checked < 300; seed++) {
      const a = analyseSafely(randomForm(seed, 30));
      if (!a.solution) continue;
      checked++;
      const sol = a.solution;
      const floor = ZERO * sol.scale;
      const moment = floor * Math.max(sol.size, 1e-300);
      for (const m of a.results!.members) {
        for (const v of [m.start.N, m.end.N, m.start.V, m.end.V]) expect(v === 0 || Math.abs(v) > floor, `seed ${seed}: ${v}`).toBe(true);
        for (const v of [m.start.M, m.end.M]) expect(v === 0 || Math.abs(v) > moment, `seed ${seed}: ${v}`).toBe(true);
        if (m.bar) expect(m.bar.state === 'zero', `seed ${seed}`).toBe(m.bar.N === 0);
      }
      // …and settling changes no end force by more than that floor: the numbers are the engine's
      const raw = solve(toEngine(randomForm(seed, 30)).model);
      if (raw.ok) {
        raw.forces.forEach((f, k) => {
          const m = a.results!.members[k];
          for (const [mine, theirs] of [[m.start.N, f.start.N], [m.end.N, f.end.N], [m.start.V, f.start.V], [m.end.V, f.end.V]]) expect(Math.abs(mine - theirs), `seed ${seed}`).toBeLessThanOrEqual(floor * 1.0000001);
          for (const [mine, theirs] of [[m.start.M, f.start.M], [m.end.M, f.end.M]]) expect(Math.abs(mine - theirs), `seed ${seed}`).toBeLessThanOrEqual(moment * 1.0000001);
        });
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});

describe('E4: what is printed in the elimination is what was computed', () => {
  /** The unknowns that the LAST triangle printed gives, redone the way a reader redoes them. */
  function fromTheTriangle(a: ReturnType<typeof analyseSafely>): { redone: number[]; printed: number[]; triangle: number[][] } {
    const steps = a.solution!.steps;
    const passes = steps.filter((s) => s.id === 'forward-pass');
    const last = passes[passes.length - 1];
    const triangle = (last.blocks.find((b) => b.type === 'matrix') as MatrixBlock).values;
    const n = triangle.length;
    const redone = new Array<number>(n).fill(0);
    for (let k = n - 1; k >= 0; k--) {
      let s = triangle[k][n];
      for (let j = k + 1; j < n; j++) s -= triangle[k][j] * redone[j];
      redone[k] = s / triangle[k][k];
    }
    const printed = (steps.find((s) => s.id === 'solution')!.blocks.find((b) => b.type === 'vector' && b.name === 'u_F') as VectorBlock).values;
    return { redone, printed, triangle };
  }
  it('the portal with a stiff column: an entry smaller than a billionth of the biggest is real, is printed, and the triangle gives the unknowns', () => {
    for (const A of [1e6, 1e7, 1e8]) {
      const a = analyseSafely(portal(A));
      expect(a.solution, `A = ${A}`).not.toBeNull();
      const { redone, printed, triangle } = fromTheTriangle(a);
      const top = Math.max(...triangle.flat().map(Math.abs));
      // the hazard: a floor of ZERO times the biggest entry of the matrix would have made a real entry 0
      expect(triangle.flat().some((v) => v !== 0 && Math.abs(v) < ZERO * top), `A = ${A}`).toBe(true);
      const scale = Math.max(...printed.map(Math.abs));
      redone.forEach((v, k) => expect(Math.abs(v - printed[k]) / scale, `A = ${A} unknown ${k + 1}`).toBeLessThan(1e-9));
    }
  });
  it('300 solved structures: the last triangle printed gives the unknowns printed', () => {
    let checked = 0;
    for (let seed = 1; seed <= 2500 && checked < 300; seed++) {
      const a = analyseSafely(randomForm(seed, 40));
      if (!a.solution || a.solution.steps.every((s) => s.id !== 'forward-pass')) continue;
      checked++;
      const { redone, printed } = fromTheTriangle(a);
      const scale = Math.max(...printed.map(Math.abs), 1e-300);
      redone.forEach((v, k) => expect(Math.abs(v - printed[k]) / scale, `seed ${seed} unknown ${k + 1}`).toBeLessThan(1e-9));
    }
    expect(checked).toBeGreaterThan(100);
  });
});

describe('E5: a mark says that something changed', () => {
  it('"eliminated" is only an entry under the pivot that was not already 0, "updated" only an entry whose value changed, in every pass of every template', () => {
    let totalMarked = 0;
    for (const template of ['truss-two-bar', 'truss-three-bar', 'truss-five-member', 'frame-propped', 'frame-l', 'frame-portal'] as const) {
      const a = analyseSafely(reduce(emptyStiffness(), { type: 'template', template }));
      const steps = a.solution!.steps.filter((s) => s.id === 'forward-pass');
      let marked = 0;
      let previous = (a.solution!.steps.find((s) => s.id === 'augmented')!.blocks[0] as MatrixBlock).values;
      for (const step of steps) {
        const m = step.blocks.find((b) => b.type === 'matrix') as MatrixBlock;
        const k = step.facts.pass as number;
        for (const h of m.highlights ?? []) {
          if (h.reason === 'eliminated') {
            marked++;
            expect(previous[h.row][h.col], `${template} pass ${k}`).not.toBe(0);
            expect(m.values[h.row][h.col]).toBe(0);
          }
          if (h.reason === 'updated') {
            marked++;
            expect(m.values[h.row][h.col], `${template} pass ${k} (${h.row}, ${h.col})`).not.toBe(previous[h.row][h.col]);
          }
        }
        // …and every entry that did change is marked
        const updated = new Set((m.highlights ?? []).filter((h) => h.reason === 'updated').map((h) => `${h.row},${h.col}`));
        m.values.forEach((row, r) =>
          row.forEach((v, c) => {
            if (r >= k && c >= k && v !== previous[r][c]) expect(updated.has(`${r},${c}`), `${template} pass ${k} (${r}, ${c})`).toBe(true);
          }),
        );
        previous = m.values;
      }
      totalMarked += marked;
    }
    expect(totalMarked).toBeGreaterThan(20);
    // the example of the page: the multiplier of its first pass is 0, so nothing in that pass is changed or made zero
    const two = analyseSafely(defaultStiffness());
    const first = two.solution!.steps.find((s) => s.key === 'forward-pass#1')!;
    expect(first.blocks.find((b) => b.type === 'vector' && b.name === 'multipliers')).toMatchObject({ values: [0] });
    expect((first.blocks.find((b) => b.type === 'matrix') as MatrixBlock).highlights).toEqual([{ row: 0, col: 0, reason: 'pivot' }]);
  });
  it('the running K marks every cell the members added so far have written into, with who wrote there', () => {
    const a = analyseSafely(reduce(emptyStiffness(), { type: 'template', template: 'truss-five-member' }));
    const steps = a.solution!.steps.filter((s) => s.id === 'assembly');
    steps.forEach((step, k) => {
      const running = step.blocks.find((b) => b.type === 'matrix' && b.name === 'running') as MatrixBlock;
      const written = new Map<string, number[]>();
      steps.slice(0, k + 1).forEach((earlier) => {
        const c = earlier.blocks.find((b) => b.type === 'matrix' && b.name === 'contribution') as MatrixBlock;
        for (const h of c.highlights ?? []) written.set(`${h.row},${h.col}`, [...(written.get(`${h.row},${h.col}`) ?? []), earlier.facts.member as number]);
      });
      expect(new Set((running.highlights ?? []).map((h) => `${h.row},${h.col}`)), `after member ${k + 1}`).toEqual(new Set(written.keys()));
      for (const h of running.highlights ?? []) expect(h.members, `after member ${k + 1}`).toEqual(written.get(`${h.row},${h.col}`));
    });
  });
});

describe('E6/B5: first order only', () => {
  it('the two-bar truss with its apex 0.001 ft off the line: a warning that names the member, a deformed shape drawn at a reduction (never "magnified 0 times")', () => {
    const f = reduce(defaultStiffness(), { type: 'patch', list: 'nodes', id: defaultStiffness().nodes[2].id, patch: { x: 8, y: 0.001 } });
    const a = analyseSafely(f);
    const w = a.warnings.find((x) => x.code === 'large-displacements')!;
    expect(w).toBeDefined();
    expect(w.ratio!).toBeGreaterThan(TOLERANCES.large);
    expect([1, 2]).toContain(w.count);
    expect(w.nodes).toContain(3);
    const d = a.drawing.deformed!;
    expect(d.large).toBe(true);
    expect(d.factor!).toBeLessThan(1);
    expect(d.factor!).toBeGreaterThan(0);
    expect(d.shrink!).toBeGreaterThan(1);
    // the factor is exactly one over a clean number
    expect(d.factor).toBe(1 / d.shrink!);
    // an apex a millionth of a foot off the line: the factor is a small number, still not 0
    for (const y of [1e-7, 1e-9]) {
      const g = analyseSafely(reduce(defaultStiffness(), { type: 'patch', list: 'nodes', id: defaultStiffness().nodes[2].id, patch: { x: 8, y } }));
      if (g.solution) {
        expect(g.drawing.deformed!.factor!, `y = ${y}`).toBeGreaterThan(0);
        expect(g.drawing.deformed!.shrink, `y = ${y}`).toBeGreaterThan(1);
        expect(g.warnings.map((x) => x.code), `y = ${y}`).toContain('large-displacements');
      } else expect(g.issues[0].code, `y = ${y}`).toBe('mechanism');
    }
  });
  it('the ordinary examples carry no such warning and are drawn magnified, as before', () => {
    for (const template of ['truss-two-bar', 'truss-three-bar', 'truss-five-member', 'frame-propped', 'frame-l', 'frame-portal', 'frame-fixed-point'] as const) {
      const a = analyseSafely(reduce(emptyStiffness(), { type: 'template', template }));
      expect(a.warnings.map((x) => x.code), template).not.toContain('large-displacements');
      const d = a.drawing.deformed!;
      expect(d.large, template).toBe(false);
      if (d.factor !== null) {
        expect(d.shrink, template).toBeNull();
        expect(d.factor, template).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('E7/T2: a settlement typed on a DOF the support does not hold is told', () => {
  it('the propped cantilever with a settlement along x on its roller: a warning by DOF, the structure solved as if it were not there; ticking the restraint makes it count', () => {
    let f = reduce(emptyStiffness(), { type: 'template', template: 'frame-propped' });
    const roller = f.supports[1];
    f = reduce(f, { type: 'patch', list: 'supports', id: roller.id, patch: { dx: 5, dr: 0.01 } });
    expect(strayOf(f.supports[1], 'frame')).toEqual({ dx: true, dy: false, dr: true });
    const a = analyseSafely(f);
    expect(a.solution).not.toBeNull();
    expect(a.warnings).toContainEqual({ code: 'settlement-ignored', dofs: [4, 6] });
    // the numbers are those of the structure without the stray value
    const plain = analyseSafely(reduce(emptyStiffness(), { type: 'template', template: 'frame-propped' }));
    expect(a.solution!.u).toEqual(plain.solution!.u);
    // the drawing does not show a settlement that counts for nothing
    expect(a.drawing.supports[1].settle).toBeNull();
    // ticking the restraint along x gives the value its effect, and the warning for that DOF goes
    const held = reduce(f, { type: 'patch', list: 'supports', id: roller.id, patch: { ux: true } });
    const b = analyseSafely(held);
    expect(b.warnings).toContainEqual({ code: 'settlement-ignored', dofs: [6] });
    expect(b.solution!.u[3]).toBeCloseTo(5 / 12, 12);
  });
  it('a value typed on a truss support for the rotation is not a stray value: a truss has no rotation to leave free', () => {
    let t = defaultStiffness();
    t = reduce(t, { type: 'patch', list: 'supports', id: t.supports[0].id, patch: { dr: 0.3 } });
    expect(analyseSafely(t).warnings).toEqual([]);
  });
});

describe('T17/B12: the sentence about a section is told which kind of field it is about', () => {
  it('the structure’s own field or a member’s, and a value of zero or below or out of range', () => {
    const base = defaultStiffness();
    const ownZero = analyseSafely(reduce(base, { type: 'section', patch: { A: 0 } })).issues;
    expect(ownZero).toEqual([{ code: 'section', row: { list: 'model', field: 'A' }, count: 1, max: 1 }]);
    const ownHuge = analyseSafely(reduce(base, { type: 'section', patch: { E: 1e40 } })).issues;
    expect(ownHuge).toEqual([{ code: 'section', row: { list: 'model', field: 'E' }, count: 1, max: 0 }]);
    const memberNegative = analyseSafely(reduce(base, { type: 'patch', list: 'members', id: base.members[1].id, patch: { A: -5 } })).issues;
    expect(memberNegative).toEqual([{ code: 'section', row: { list: 'members', id: base.members[1].id, field: 'A' }, at: 2, count: 0, max: 1 }]);
    const memberHuge = analyseSafely(reduce(base, { type: 'patch', list: 'members', id: base.members[0].id, patch: { A: 1e40 } })).issues;
    expect(memberHuge).toEqual([{ code: 'section', row: { list: 'members', id: base.members[0].id, field: 'A' }, at: 1, count: 0, max: 0 }]);
  });
});

describe('E8/U22: the units', () => {
  it('a listed modulus is the other system’s listed one, steel and aluminum, in the structure and in a member; any other modulus is converted exactly and comes back', () => {
    const f = reduce(defaultStiffness(), { type: 'patch', list: 'members', id: defaultStiffness().members[1].id, patch: { E: 29000 } });
    const si = convertStiffness(f, 'si');
    expect([si.E, si.members[1].E]).toEqual([200, 200]);
    expect(convertStiffness(si, 'us').E).toBe(29000);
    const al = reduce(defaultStiffness(), { type: 'material', material: 'aluminum' });
    expect(al.E).toBe(10100);
    expect(convertStiffness(al, 'si').E).toBe(STIFFNESS_MATERIALS.aluminum.si);
    expect(convertStiffness(convertStiffness(al, 'si'), 'us').E).toBe(10100);
    // a modulus of the visitor’s own comes back as it was, converted exactly (not rounded to a listed value)
    const own = reduce(defaultStiffness(), { type: 'section', patch: { E: 28123.456 } });
    expect(own.material).toBe('custom');
    const there = convertStiffness(own, 'si');
    expect(there.E).toBeCloseTo(28123.456 * 0.0068947572932, 4);
    expect(convertStiffness(there, 'us').E).toBe(28123.456);
    // the two systems differ in the fourth figure of a result, by the 0.026 percent between the two listed values
    const ux = analyseSafely(defaultStiffness()).results!.displacements[2].ux;
    const uxSi = analyseSafely(convertStiffness(defaultStiffness(), 'si')).results!.displacements[2].ux;
    const apart = Math.abs(uxSi / 25.4 / ux - 1);
    expect(apart).toBeGreaterThan(1e-4);
    expect(apart).toBeLessThan(5e-4);
  });
  it('a pasted number of nine to twelve figures comes back from the other system to within a part in 10¹⁴, and one of eight figures or fewer comes back as itself', () => {
    const r = rng(9);
    let worst = 0;
    for (let n = 0; n < 1500; n++) {
      const figures = 1 + Math.floor(r() * 12);
      const v = Number((r() * 10 ** Math.floor(r() * 6 - 2)).toPrecision(figures)) || 1;
      const f = reduce(emptyStiffness(), { type: 'add', list: 'nodes', seed: { x: v, y: v / 7 } });
      const back = convertStiffness(convertStiffness(f, 'si'), 'us');
      const error = Math.abs(back.nodes[0].x - v) / v;
      worst = Math.max(worst, error);
      if (figures <= 8) expect(back.nodes[0].x, `${v}`).toBe(v);
    }
    expect(worst).toBeLessThan(1e-14);
  });
});

describe('against the plane frame calculator and the truss calculator, which share none of this code', () => {
  const frameOf = (spec: OSpec): FrameModel => ({
    nodes: spec.nodes.map((n) => ({ ...n })),
    members: spec.members.map((m) => ({ i: m.i, j: m.j, E: m.E, A: m.A, I: m.I })),
    supports: spec.supports.map((s) => {
      const kind = s.ux && s.uy && s.rz ? 'fixed' : s.ux && s.uy ? 'pin' : 'roller';
      return { node: s.node, kind, ...(kind === 'roller' ? { angle: s.uy ? 90 : 0 } : {}), ...(s.dx ? { dx: s.dx } : {}), ...(s.dy ? { dy: s.dy } : {}), ...(s.dr ? { dr: s.dr } : {}) } as FrameModel['supports'][number];
    }),
    loads: spec.loads.map((l) => ({ ...l })),
    memberLoads: spec.memberLoads.map((l) => (l.kind === 'udl' ? { kind: 'udl', member: l.member, dir: 'local-y', w: l.w } : l.kind === 'axial' ? { kind: 'udl', member: l.member, dir: 'local-x', w: l.q } : { kind: 'point', member: l.member, dir: 'local-y', a: l.a, P: l.P })) as FrameModel['memberLoads'],
  });
  const trussOf = (spec: OSpec): TrussModel => ({
    nodes: spec.nodes.map((n) => ({ ...n })),
    members: spec.members.map((m) => ({ i: m.i, j: m.j, E: m.E, A: m.A })),
    supports: spec.supports.map((s) => (s.ux && s.uy ? { node: s.node, kind: 'pin' as const } : { node: s.node, kind: 'roller' as const, angle: s.uy ? 90 : 0 })),
    loads: spec.loads.map((l) => ({ node: l.node, fx: l.fx, fy: l.fy })),
  });
  it('300 structures, trusses and frames, a third with a member 10² to 10⁸ times stiffer: what both solve agrees to a hundred-thousandth, and neither calculator solves what this one calls a mechanism', () => {
    const r = rng(77);
    let both = 0;
    for (let n = 0; n < 300; n++) {
      const seed = 11000 + n;
      const mode = n % 2 === 0 ? 'truss' : 'frame';
      const spec = n % 3 === 0 ? stableSpec(seed, { mode, maxNodes: 7, settlements: mode === 'frame' }) : randomSpec(seed, { mode, maxNodes: 7, settlements: mode === 'frame' });
      if (spec.members.length === 0) continue;
      let k = 0;
      if (n % 3 === 1) {
        k = 2 + Math.floor(r() * 7);
        const m = Math.floor(r() * spec.members.length);
        spec.members[m] = { ...spec.members[m], A: spec.members[m].A * 10 ** k, I: spec.members[m].I * 10 ** Math.min(k, 4) };
      }
      const mine = solve(toModel(spec));
      const them = mode === 'truss' ? solveTruss(trussOf(spec)) : solveFrame(frameOf(spec));
      if (!mine.ok && them.ok) throw new Error(`#${seed} k=${k}: the sibling solved it and this refused it: ${JSON.stringify(mine.issues)}`);
      if (mine.ok && them.ok) {
        both++;
        const top = Math.max(1e-300, ...mine.u.map(Math.abs));
        const nd = mode === 'truss' ? 2 : 3;
        const displacements = (them as { displacements: { ux: number; uy: number }[] }).displacements;
        displacements.forEach((d, node) => {
          expect(Math.abs(mine.u[nd * node] - d.ux) / top, `#${seed} k=${k} ux`).toBeLessThan(1e-5);
          expect(Math.abs(mine.u[nd * node + 1] - d.uy) / top, `#${seed} k=${k} uy`).toBeLessThan(1e-5);
        });
        const topR = Math.max(1e-300, ...mine.reactions.map((q) => Math.abs(q.value)));
        (them as { reactions: { node: number; rx: number; ry: number }[] }).reactions.forEach((q) => {
          const x = mine.reactions.find((e) => e.node === q.node + 1 && e.kind === 'x')?.value ?? 0;
          const y = mine.reactions.find((e) => e.node === q.node + 1 && e.kind === 'y')?.value ?? 0;
          expect(Math.abs(x - q.rx) / topR, `#${seed} k=${k} rx`).toBeLessThan(1e-5);
          expect(Math.abs(y - q.ry) / topR, `#${seed} k=${k} ry`).toBeLessThan(1e-5);
        });
      }
    }
    expect(both).toBeGreaterThan(100);
  });
});
