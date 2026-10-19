import { describe, expect, it, vi } from 'vitest';
import { analyseSafely } from './analysis';
import { solve } from './engine';
import { emptyStiffness, reduceStiffness, toEngine, type StiffnessForm } from './model';

vi.setConfig({ testTimeout: 120_000 });

/**
 * THE FORCES AT THE ENDS OF A MEMBER are settled against what rounding could have put into each of them, not against the loads of the whole structure.
 * A member a million times stiffer than the rest (the "rigid link", the inextensible portal) is added up from terms far larger than its own force; settled
 * against the loads it keeps its force, and a bar that carries nothing is still exactly 0 with no state.
 */

const portal = (A: number): StiffnessForm => {
  let form = reduceStiffness(emptyStiffness('us', 'frame'), { type: 'template', template: 'frame-portal' });
  // Only the lateral load of the textbook case: no gravity on the beam.
  form = { ...form, memberLoads: [], loads: form.loads.map((l) => ({ ...l, fx: 10, fy: 0, m: 0 })).slice(0, 1) };
  return reduceStiffness(form, { type: 'section', patch: { E: 29000, A, I: 484 } });
};
const fiveBar = (opts: { loadNode4: boolean; stiff?: number }): StiffnessForm => {
  let form = reduceStiffness(emptyStiffness('us', 'truss'), { type: 'template', template: 'truss-five-member' });
  if (!opts.loadNode4) form = { ...form, loads: form.loads.filter((l) => l.node !== form.nodes[3].id) };
  if (opts.stiff) form = reduceStiffness(form, { type: 'patch', list: 'members', id: form.members[2].id, patch: { A: opts.stiff } });
  return form;
};
const ends = (form: StiffnessForm) => analyseSafely(form).results!.members.map((m) => [m.start.N, m.start.V, m.start.M, m.end.N, m.end.V, m.end.M]);
const bars = (form: StiffnessForm) => analyseSafely(form).results!.members.map((m) => ({ N: m.bar!.N, state: m.bar!.state }));

describe('a member much stiffer than the rest keeps its forces', () => {
  // The inextensible portal: columns carry 5 kip of shear and 1.875 kip of axial force, the beam 5 kip of axial force.
  const hand = [
    [1.875, 5, -31.25, 1.875, 5, 18.75],
    [-1.875, 5, -31.25, -1.875, 5, 18.75],
    [-5, -1.875, 18.75, -5, -1.875, -18.75],
  ];
  for (const A of [1e5, 1e7, 1e8, 1e9, 1e10, 1e12]) {
    it(`the portal with A = ${A} in² on every member prints its 18 end forces`, () => {
      const printed = ends(portal(A));
      printed.forEach((row, m) =>
        row.forEach((v, c) => {
          expect(Math.abs(v - hand[m][c]), `member ${m + 1} component ${c}`).toBeLessThan(1e-3 * Math.max(1, Math.abs(hand[m][c])));
          expect(v, `member ${m + 1} component ${c} is not printed as 0`).not.toBe(0);
        }),
      );
    });
  }
  for (const A of [1e5, 1e7, 1e8, 1e9, 1e10]) {
    it(`the five-bar truss with bar 3 at A = ${A} in² prints the forces of the other bars`, () => {
      // (the reviewer's reference, from an independent solver: −4, +20, −20, +20 and −25 kip... bar 3 is the stiff one)
      const printed = bars(fiveBar({ loadNode4: true, stiff: A }));
      expect(printed.filter((b) => b.state === 'zero').length, JSON.stringify(printed)).toBe(0);
      const raw = solve(toEngine(fiveBar({ loadNode4: true, stiff: A })).model);
      if ('forces' in raw) raw.forces.forEach((f, k) => expect(printed[k].N).toBeCloseTo(f.bar!.N, 6));
    });
  }
});

describe('a bar that carries nothing still prints as 0 and says so', () => {
  it('the five-bar truss without its load on node 4, in both units', () => {
    for (const units of ['us', 'si'] as const) {
      let form = fiveBar({ loadNode4: false });
      if (units === 'si') form = reduceStiffness(form, { type: 'units', units: 'si' });
      const printed = bars(form);
      const zero = printed.filter((b) => b.state === 'zero');
      expect(zero.length, `${units}: ${JSON.stringify(printed)}`).toBe(2);
      zero.forEach((b) => expect(b.N).toBe(0));
    }
  });
  it('and with a very stiff bar beside it', () => {
    const printed = bars(fiveBar({ loadNode4: false, stiff: 1e8 }));
    // The two bars that are zero-force without the load are zero-force still, whatever the stiff one does.
    expect(printed.filter((b) => b.state === 'zero').length, JSON.stringify(printed)).toBeGreaterThanOrEqual(2);
  });
});

describe('nothing smaller than its floor is printed as a force, nothing larger is lost', () => {
  it('on every template, in both units, with a stiff member in turn', () => {
    for (const template of ['truss-two-bar', 'truss-three-bar', 'truss-five-member', 'frame-propped', 'frame-l', 'frame-portal', 'frame-fixed-point'] as const) {
      for (const units of ['us', 'si'] as const) {
        const base = reduceStiffness(emptyStiffness(units), { type: 'template', template });
        for (const scale of [1, 1e6, 1e8]) {
          const form = base.members.length ? reduceStiffness(base, { type: 'patch', list: 'members', id: base.members[0].id, patch: { A: (base.A ?? 1) * scale } }) : base;
          const model = toEngine(form).model;
          const raw = solve(model);
          if (!('forces' in raw)) continue;
          const settled = analyseSafely(form).solution!;
          settled.forces.forEach((f, k) => {
            f.f.forEach((v, q) => {
              const r = raw.forces[k].f[q];
              const floor = raw.forces[k].floor[q];
              if (Math.abs(r) > floor) expect(v, `${template} ${units} x${scale} member ${k + 1} component ${q}`).toBe(r);
              else expect(v, `${template} ${units} x${scale} member ${k + 1} component ${q}`).toBe(0);
            });
          });
        }
      }
    }
  });
});
