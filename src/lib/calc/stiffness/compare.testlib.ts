import { expect } from 'vitest';
import { solve } from './engine';
import { solveExactly, toModel, toNumber, type OSpec } from './oracle.testlib';

/**
 * The engine against the exact oracle on one specification: a structure the oracle finds singular must be refused (a mechanism, or too few supports);
 * one it solves must be solved, and every number the engine prints for it must agree: the displacements, the reactions, the end forces, the stiffness matrix,
 * the load vector and the global matrix of each member. Each kind of number is compared against the largest of its kind in the whole structure.
 * Returns what happened.
 */
export function compareWithOracle(spec: OSpec, label: string, tolerance = 1e-9): 'solved' | 'mechanism' {
  const exact = solveExactly(spec);
  const out = solve(toModel(spec));
  if (exact === null) {
    expect(out.ok, `${label}: the oracle finds a mechanism, the engine solved it`).toBe(false);
    if (!out.ok) expect(out.issues.some((i) => i.code === 'mechanism' || i.code === 'few-supports'), `${label}: ${JSON.stringify(out.issues.map((i) => i.code))}`).toBe(true);
    return 'mechanism';
  }
  if (!out.ok) throw new Error(`${label}: the engine refused a structure the oracle solves: ${JSON.stringify(out.issues)}`);
  const nd = exact.nd;
  const top = (...lists: number[][]) => Math.max(1e-300, ...lists.flatMap((l) => l.map(Math.abs)));
  const close = (a: number[], b: number[], what: string, scale: number) => {
    expect(a.length, `${label} ${what} length`).toBe(b.length);
    a.forEach((v, k) => {
      expect(Math.abs(v - b[k]), `${label} ${what}[${k}] engine ${v} oracle ${b[k]} scale ${scale}`).toBeLessThanOrEqual(tolerance * scale);
    });
  };
  const rotation = (k: number) => nd === 3 && k % 3 === 2;
  const u = exact.u.map(toNumber);
  const reactions = exact.reactions.map((r) => toNumber(r.value));
  const forces = exact.forces.map((f) => f.map(toNumber));
  const P = exact.P.map(toNumber);
  const force = top(reactions, P, ...forces);
  const trans = top(u.filter((_, k) => !rotation(k)));
  close(out.u.filter((_, k) => !rotation(k)), u.filter((_, k) => !rotation(k)), 'u translations', trans);
  if (nd === 3) close(out.u.filter((_, k) => rotation(k)), u.filter((_, k) => rotation(k)), 'u rotations', top(u.filter((_, k) => rotation(k))));
  close(out.reactions.map((r) => r.value), reactions, 'reactions', force);
  close(out.P, P, 'P', force);
  const K = exact.K.flat().map(toNumber);
  close(out.K.flat(), K, 'K', top(K));
  out.members.forEach((m, k) => {
    const ke = out.steps.find((s) => s.key === `global-member#${k + 1}`)!.blocks.find((b) => b.type === 'matrix' && b.name === 'K_e');
    if (!ke || ke.type !== 'matrix') throw new Error('no K_e');
    const exactKe = exact.Ke[k].flat().map(toNumber);
    close(ke.values.flat(), exactKe, `K_e of member ${m.label}`, top(exactKe));
    close(out.forces[k].f, forces[k], `end forces of member ${m.label}`, force);
  });
  return 'solved';
}
