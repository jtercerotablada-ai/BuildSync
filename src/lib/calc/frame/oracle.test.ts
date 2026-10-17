import { afterEach, describe, expect, it, vi } from 'vitest';
import { compare } from './compare.testlib';
import { solveFrame } from './engine';
import { randomFrame, stableFrame, staticsOf, stubFrame, toModel, type OSpec } from './oracle.testlib';

// Heavy by design (exact arithmetic on a thousand generated frames): a loaded machine runs past the 5 s default.
vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise((r) => setTimeout(r, 0)));

const yieldNow = () => new Promise((r) => setTimeout(r, 0));

/**
 * THE ENGINE AGAINST THE EXACT ORACLE (oracle.testlib.ts shares no code with it). Every generated frame is solved twice:
 * by the engine in floating point and by the oracle in exact fractions. A frame the oracle finds singular is a mechanism
 * (or too few supports) and the engine must refuse it; a frame the oracle solves the engine must solve, to the
 * tolerances of compare.testlib.ts (1e-8 of the problem's size). The comparison covers the reactions, the displacements, the end
 * forces of every member and the diagrams along it (at breakpoints on both sides and in between), and the extremes.
 *
 * Measured once on 3,500 frames (seeds 5000–7999 with up to 8 nodes and 9000–9499 stable ones with up to 9): no disagreement,
 * 2,344 solved and 1,156 mechanisms.
 */

describe('engine against the exact oracle', () => {
  it('stable frames (fixed foot, no hinges): 400 generated', async () => {
    for (let seed = 1; seed <= 400; seed++) {
      if (seed % 50 === 0) await yieldNow();
      expect(compare(stableFrame(seed), `stable #${seed}`)).toBe('solved');
    }
  });
  it('bigger stable frames (up to 9 nodes): 60 generated', async () => {
    for (let seed = 7000; seed < 7060; seed++) {
      if (seed % 20 === 0) await yieldNow();
      expect(compare(stableFrame(seed, { maxNodes: 9 }), `big #${seed}`)).toBe('solved');
    }
  });
  it('random frames with hinges, inclined rollers, guides, springs and settlements: 1,000 generated, mechanisms and solutions both agree', async () => {
    let solved = 0;
    let mechanisms = 0;
    for (let seed = 1000; seed < 2000; seed++) {
      if (seed % 50 === 0) await yieldNow();
      const r = compare(randomFrame(seed), `random #${seed}`);
      if (r === 'solved') solved++;
      else mechanisms++;
    }
    // Both outcomes are common enough for the comparison to mean something in both directions.
    expect(solved).toBeGreaterThan(250);
    expect(mechanisms).toBeGreaterThan(100);
  });
});

describe('the counting of the statics, against the rank of the equilibrium matrix', () => {
  it('degree of indeterminacy and the number of mechanisms agree with the exact rank on 600 frames (hinges, rollers, guides, inclined members; no springs)', async () => {
    let solved = 0;
    let mechanisms = 0;
    for (let seed = 20_000; seed < 20_600; seed++) {
      if (seed % 60 === 0) await yieldNow();
      const spec = randomFrame(seed, { exotic: false, maxNodes: 7, hinge: 0.2 });
      const st = staticsOf(spec);
      const out = solveFrame(toModel(spec));
      if (out.ok) {
        solved++;
        expect(st.free, `#${seed} stable`).toBe(0);
        expect(out.determinacy.degree, `#${seed}`).toBe(st.degree);
        expect(out.determinacy.word, `#${seed}`).toBe(st.degree === 0 ? 'determinate' : 'indeterminate');
      } else {
        mechanisms++;
        expect(st.free, `#${seed} ${JSON.stringify(out.issues)}`).toBeGreaterThan(0);
        // The engine's count of ways to move is the rank's: its mechanisms and its free rigid motions.
        const reported = out.issues.reduce((s, i) => s + (i.code === 'mechanism' || i.code === 'unrestrained' ? (i.count ?? 0) : 0), 0);
        if (!out.issues.some((i) => i.code === 'few-supports')) expect(reported, `#${seed} ${JSON.stringify(out.issues)}`).toBe(st.free);
      }
    }
    expect(solved).toBeGreaterThan(150);
    expect(mechanisms).toBeGreaterThan(50);
  });
});

describe('a short member among long ones', () => {
  const withStub = (stub: number): OSpec => ({
    nodes: [{ x: 0, y: 0 }, { x: 32, y: 0 }, { x: 32 + stub, y: 0 }, { x: 64, y: 0 }, { x: 32 + stub, y: 12 }],
    members: [0, 1, 2, 3].map((k) => ({ i: [0, 1, 2, 2][k], j: [1, 2, 3, 4][k], E: 29000, A: 14, I: 480, rs: false, re: false })),
    supports: [{ node: 0, kind: 'fixed' }, { node: 3, kind: 'pin' }, { node: 4, kind: 'pin' }],
    loads: [{ node: 1, fx: 3, fy: -10, m: 5 }],
    memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -1 }, { kind: 'point', member: 2, dir: 'global-y', a: 16, P: -7 }],
  });
  it('a stub of 1/64 ft (a third of an inch) in a frame 64 ft long is solved as the oracle solves it, to a millionth of the largest value (a stiffness contrast of 10¹¹ costs three figures)', () => {
    expect(compare(withStub(2 ** -6), 'stub 1/64', 1e-6)).toBe('solved');
    expect(compare(withStub(2 ** -4), 'stub 1/16', 1e-6)).toBe('solved');
  });
  it('a stub a ten-thousandth of the frame is refused rather than solved to fewer figures than the page prints: ill-conditioned, then short-member', () => {
    const refused = (stub: number) => {
      const out = solveFrame(toModel(withStub(stub)));
      return out.ok ? 'solved' : out.issues.map((i) => i.code).join();
    };
    expect(refused(2 ** -10)).toBe('ill-conditioned');
    expect(refused(2 ** -11)).toBe('short-member');
  });
});

describe('a very short bar in a long frame (hinged at both ends it has no transverse stiffness at all)', () => {
  it('stubs from 0.125 ft down to 0.0011 ft, hinged at both ends, at one end or at none, in frames 64 to 130 ft across: the oracle answer (to 1e-8 of the size when the bar is hinged at both ends, to 1e-5 when it is stiff), or a refusal that is never of a bar hinged at both ends', async () => {
    let solved = 0;
    let refused = 0;
    for (let seed = 1; seed <= 300; seed++) {
      if (seed % 50 === 0) await yieldNow();
      const spec = stubFrame(seed);
      const out = solveFrame(toModel(spec));
      if (!out.ok) {
        // A stub with a hinge at one end or none really is stiff (up to 12EI/L³ at a tenth of an inch) and may be refused; a stub hinged at both ends has no transverse stiffness and never is.
        expect(spec.members[2].rs && spec.members[2].re, `#${seed} ${JSON.stringify(out.issues)}`).toBe(false);
        refused++;
        continue;
      }
      expect(compare(spec, `stub #${seed}`, spec.members[2].rs && spec.members[2].re ? 1e-8 : 1e-5), `#${seed}`).toBe('solved');
      solved++;
    }
    expect(solved).toBeGreaterThan(150);
    expect(refused).toBeLessThan(150);
  });
  it('a member 10^8 times stiffer than the rest, hinged stubs included: the oracle answer to ten millionths, or a refusal', async () => {
    let solved = 0;
    for (let seed = 1; seed <= 200; seed++) {
      if (seed % 50 === 0) await yieldNow();
      const spec = stubFrame(seed + 5000, { stiff: 8 });
      const out = solveFrame(toModel(spec));
      if (!out.ok) continue;
      expect(compare(spec, `stiff #${seed}`, 1e-5), `#${seed}`).toBe('solved');
      solved++;
    }
    expect(solved).toBeGreaterThan(100);
  });
  it('the reviewed case: a cantilever of 50 ft, a bar of 0.0011 ft hinged at both ends to a pin: tip 2.49441 ft down, base moment 250, no shear in the bar', () => {
    const E = 4.176e6;
    const out = solveFrame({
      nodes: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50.0011, y: 0 }],
      members: [{ i: 0, j: 1 }, { i: 1, j: 2, releases: { start: true, end: true } }],
      supports: [{ node: 0, kind: 'fixed' }, { node: 2, kind: 'pin' }],
      loads: [{ node: 1, fx: 0, fy: -5, m: 0 }],
      memberLoads: [],
      E,
      A: 0.1,
      I: 0.02,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.displacements![1].uy).toBeCloseTo(-(5 * 50 ** 3) / (3 * E * 0.02), 9);
    expect(out.reactions[0].rm).toBeCloseTo(250, 9);
    expect(out.members[1].forces[1]).toBe(0);
  });
});
