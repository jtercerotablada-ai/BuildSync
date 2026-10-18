import { afterEach, describe, expect, it, vi } from 'vitest';
import { compareWithOracle } from './compare.testlib';
import { solve } from './engine';
import { randomSpec, stableSpec, toModel } from './oracle.testlib';

// Heavy by design (exact arithmetic on hundreds of generated structures): a loaded machine runs past the 5 s default.
vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise((r) => setTimeout(r, 0)));
const yieldNow = () => new Promise((r) => setTimeout(r, 0));

/**
 * THE ENGINE AGAINST THE EXACT ORACLE (oracle.testlib.ts shares no code with it). Every generated structure is solved twice: by the engine in floating
 * point and by the oracle in exact fractions (members axis-aligned or Pythagorean, sections and loads dyadic). A structure the oracle finds singular is a
 * mechanism (or too few supports) and the engine must refuse it; one the oracle solves the engine must solve, and every number it prints for it must agree
 * to 1e-9 of the largest of its kind: displacements, reactions, the load vector P, the stiffness matrix K, the global matrix of every member, the end forces.
 */
describe('engine against the exact oracle', () => {
  it('random trusses and frames, mechanisms and solutions both agree: 600 generated', async () => {
    let solved = 0;
    let mechanisms = 0;
    for (let seed = 1; seed <= 600; seed++) {
      if (seed % 50 === 0) await yieldNow();
      const r = compareWithOracle(randomSpec(seed), `random #${seed}`);
      if (r === 'solved') solved++;
      else mechanisms++;
    }
    // Both outcomes are common enough for the comparison to mean something in both directions.
    expect(solved).toBeGreaterThan(120);
    expect(mechanisms).toBeGreaterThan(120);
  });

  it('stable frames (one fixed support at the first node): 250 generated, with member loads', async () => {
    for (let seed = 2000; seed < 2250; seed++) {
      if (seed % 50 === 0) await yieldNow();
      expect(compareWithOracle(stableSpec(seed, { mode: 'frame' }), `frame #${seed}`)).toBe('solved');
    }
  });

  it('structures with settlements: 250 generated', async () => {
    let solved = 0;
    for (let seed = 4000; seed < 4250; seed++) {
      if (seed % 50 === 0) await yieldNow();
      if (compareWithOracle(randomSpec(seed, { settlements: true }), `settling #${seed}`) === 'solved') solved++;
    }
    expect(solved).toBeGreaterThan(40);
  });

  it('the biggest the tool takes (12 nodes, up to 20 members, 36 DOFs, over 12 free so that only the result is recorded): 60 generated', async () => {
    let solved = 0;
    let over = 0;
    for (let seed = 90000; seed < 90060; seed++) {
      if (seed % 20 === 0) await yieldNow();
      const spec = seed % 2 === 0 ? stableSpec(seed, { maxNodes: 12, extra: 0.9, mode: 'frame' }) : randomSpec(seed, { maxNodes: 12, extra: 0.9 });
      if (spec.members.length > 20) continue;
      if (compareWithOracle(spec, `largest #${seed}`) === 'solved') {
        solved++;
        const out = solve(toModel(spec));
        if (out.ok && out.free.length > 12) over++;
      }
    }
    expect(solved).toBeGreaterThan(25);
    expect(over).toBeGreaterThan(10);
  });

  it('bigger structures (up to 9 nodes): 80 generated', async () => {
    for (let seed = 7000; seed < 7080; seed++) {
      if (seed % 20 === 0) await yieldNow();
      compareWithOracle(randomSpec(seed, { maxNodes: 9, extra: 0.5 }), `big #${seed}`);
    }
  });
});
