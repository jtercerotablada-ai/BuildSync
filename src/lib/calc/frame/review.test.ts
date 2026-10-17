import { describe, expect, it } from 'vitest';
import { analyseFrame, memberValuesAt } from './analysis';
import { pieceAt } from './element';
import { solveFrame } from './engine';
import { emptyFrame, type FrameForm } from './model';
import type { FrameModel } from './types';

/**
 * Findings of the review of 2026-10-17 (engine and analysis side). Each test fails on the code of e026e4b.
 */

const SEC = { E: 29000 * 144, A: 14.1 / 144, I: 484 / 20736 };

describe('A5: one "largest deflection" on the page', () => {
  it('the deformed-shape note and the member table give the same largest deflection (simply supported 20 ft, load at 0.2 L)', () => {
    const L = 20;
    const model: FrameModel = {
      nodes: [{ x: 0, y: 0 }, { x: L, y: 0 }],
      members: [{ i: 0, j: 1 }],
      supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }],
      loads: [],
      memberLoads: [{ kind: 'point', member: 0, dir: 'global-y', a: 0.2 * L, P: -10 }],
      ...SEC,
    };
    const out = solveFrame(model);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    // Exact: the largest |v| along the member, found on a fine grid of the exact polynomials.
    let best = 0;
    for (let q = 0; q <= 20000; q++) {
      const v = pieceAt(out.members[0].pieces, (L * q) / 20000, 'right').v!;
      best = Math.max(best, Math.abs(v));
    }
    const inches = best * 12;
    // The analysis of the same frame, through the page's own entry.
    const a = analyseFrame(formOfBeam(L, 0.2 * L));
    expect(a.drawing.deflected!.maxDisplacement).toBeCloseTo(inches, 6);
    expect(Math.abs(a.results!.members[0].deflection!.value)).toBeCloseTo(inches, 6);
  });
});

/** The form of the 20 ft beam above (US units: ft, kip, in²…), through the model module so the page's own path is used. */
function formOfBeam(L: number, a: number): FrameForm {
  const f = emptyFrame();
  const sup = (id: number, node: number, kind: 'pin' | 'roller') => ({ id, node, kind, angle: 90, kx: 0, ky: 0, kr: 0, dx: 0, dy: 0, dr: 0 });
  return {
    ...f,
    nodes: [{ id: 1, x: 0, y: 0 }, { id: 2, x: L, y: 0 }],
    members: [{ id: 3, i: 1, j: 2, A: null, I: null, E: null, hingeStart: false, hingeEnd: false, h: null }],
    supports: [sup(4, 1, 'pin'), sup(5, 2, 'roller')],
    memberLoads: [{ id: 6, member: 3, kind: 'point', dir: 'global-y', w: 0, w2: 0, P: -10, M: 0, a, b: 0, dT: 0, dTg: 0, alpha: 0 }],
    nextId: 7,
    E: 29000,
    A: 14.1,
    I: 484,
  };
}

describe('A7: loads at one node are added together before the hinged-joint test', () => {
  it('two couples of +5 and −5 at an all-hinged node are no couple', () => {
    const base: FrameModel = {
      // Three bars meeting in node 1, each hinged there: a stable little truss, and a joint that cannot take a couple.
      nodes: [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 0 }, { x: 10, y: -6 }],
      members: [{ i: 0, j: 1, releases: { end: true } }, { i: 2, j: 1, releases: { end: true } }, { i: 3, j: 1, releases: { end: true } }],
      supports: [{ node: 0, kind: 'pin' }, { node: 2, kind: 'pin' }, { node: 3, kind: 'pin' }],
      loads: [{ node: 1, fx: 0, fy: -4, m: 0 }],
      memberLoads: [],
      ...SEC,
    };
    const alone = solveFrame({ ...base, loads: [...base.loads, { node: 1, fx: 0, fy: 0, m: 5 }] });
    expect(alone.ok).toBe(false);
    if (!alone.ok) expect(alone.issues.map((i) => i.code)).toContain('hinged-joint-moment');
    const cancelled = solveFrame({ ...base, loads: [...base.loads, { node: 1, fx: 0, fy: 0, m: 5 }, { node: 1, fx: 0, fy: 0, m: -5 }] });
    expect(cancelled.ok).toBe(true);
    const same = solveFrame(base);
    if (cancelled.ok && same.ok) expect(cancelled.reactions[0].ry).toBeCloseTo(same.reactions[0].ry, 12);
  });
});

describe('A12: a place one ulp past the last end is the last piece', () => {
  it('pieceAt with the side "left" and x just past the end returns the end of the member, not its start', () => {
    const model: FrameModel = {
      nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      members: [{ i: 0, j: 1 }],
      supports: [{ node: 0, kind: 'fixed' }],
      loads: [],
      memberLoads: [{ kind: 'point', member: 0, dir: 'global-y', a: 4, P: -10 }],
      ...SEC,
    };
    const out = solveFrame(model);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const pieces = out.members[0].pieces;
    const end = pieces[pieces.length - 1].x1;
    const atEnd = pieceAt(pieces, end, 'left');
    const past = pieceAt(pieces, end * (1 + 1e-15), 'left');
    expect(past.V).toBeCloseTo(atEnd.V, 12);
    expect(past.M).toBeCloseTo(atEnd.M, 9);
    expect(Math.abs(past.M - pieceAt(pieces, 0, 'right').M)).toBeGreaterThan(1);
  });
});

describe('memberValuesAt past the end', () => {
  it('is the last piece for either side', () => {
    const a = analyseFrame(formOfBeam(20, 4));
    const r = a.results!;
    const end = r.members[0].pieces[r.members[0].pieces.length - 1].x1;
    const atEnd = memberValuesAt(r, 1, end, 'left')!;
    const past = memberValuesAt(r, 1, end * (1 + 1e-15), 'left')!;
    expect(past.M).toBeCloseTo(atEnd.M, 9);
    expect(past.V).toBeCloseTo(atEnd.V, 9);
  });
});

describe('A13: a hinged arch is refused as a mechanism only below a rise of about 3 × 10⁻⁵ of its span (as the engine header says)', () => {
  const arch = (rise: number): FrameModel => ({
    nodes: [{ x: 0, y: 0 }, { x: 50, y: rise }, { x: 100, y: 0 }],
    members: [{ i: 0, j: 1, releases: { end: true } }, { i: 1, j: 2, releases: { start: true } }],
    supports: [{ node: 0, kind: 'pin' }, { node: 2, kind: 'pin' }],
    loads: [{ node: 1, fx: 0, fy: -10, m: 0 }],
    memberLoads: [],
    ...SEC,
  });
  it('a rise of a ten-thousandth of the span is solved, with the thrust P·L/(4·f); a hundred-thousandth is a mechanism to first order', () => {
    const ok = solveFrame(arch(0.01));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(Math.abs(ok.reactions[0].rx)).toBeCloseTo((10 * 100) / (4 * 0.01), 6);
    const flat = solveFrame(arch(0.001));
    expect(flat.ok).toBe(false);
    if (!flat.ok) expect(flat.issues.map((i) => i.code)).toEqual(['mechanism']);
  });
});

describe('A1: the stiffness contrast is refused before the solve, as the message says', () => {
  const frame = (iBeam: number): FrameModel => ({
    nodes: [{ x: 0, y: 0 }, { x: 0, y: 12 }, { x: 40, y: 12 }, { x: 40, y: 0 }],
    members: [{ i: 0, j: 1 }, { i: 1, j: 2, I: iBeam }, { i: 2, j: 3 }],
    supports: [{ node: 0, kind: 'fixed' }, { node: 3, kind: 'fixed' }],
    loads: [{ node: 1, fx: 5, fy: 0, m: 0 }],
    memberLoads: [],
    ...SEC,
  });
  it('a member 10^14 times stiffer than the rest is refused as ill-conditioned; 10^8 times is solved', () => {
    const wild = solveFrame(frame(SEC.I * 1e14));
    expect(wild.ok).toBe(false);
    if (!wild.ok) expect(wild.issues.map((i) => i.code)).toEqual(['ill-conditioned']);
    expect(solveFrame(frame(SEC.I * 1e8)).ok).toBe(true);
  });
});
