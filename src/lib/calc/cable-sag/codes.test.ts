import { describe, expect, it } from 'vitest';
import { solveHanging, solvePoints, solveState } from './engine';
import { ISSUE_CODES, WARNING_CODES, type CableIssueCode, type CableWarningCode, type HangingInput, type PointsInput, type StateInput } from './types';

/**
 * EVERY DIAGNOSTIC CODE, once. The page writes one sentence per code (in English and in Spanish), so a code that the
 * engine can no longer produce, or a new one that the contract does not list, is a sentence nobody reads or a
 * problem nobody explains. This file triggers each code of types.ts and checks the list is complete both ways.
 */

const seen = new Set<CableIssueCode>();
const seenWarnings = new Set<CableWarningCode>();

const hanging: HangingInput = { L: 100, h: 0, q: 0.1, w: 0, EA: null, known: { kind: 'sag-mid', value: 10 } };
const state: StateInput = { L: 300, h: 0, EA: 5000, known: { kind: 'sag-mid', value: 6 }, state1: { q: 0, w: 0.0016 }, state2: { q: 0, w: 0.0026, thermal: -2.6e-4 } };
const points: PointsInput = { L: 60, h: 0, loads: [{ x: 15, P: 10 }, { x: 45, P: 10 }], known: { kind: 'sag', x: 15, value: 5 } };

function issues(out: { ok: boolean; issues?: { code: CableIssueCode }[] }): CableIssueCode[] {
  const codes = out.ok ? [] : (out.issues ?? []).map((i) => i.code);
  codes.forEach((c) => seen.add(c));
  return codes;
}

describe('every issue code is produced, by the solver that owns it', () => {
  const H = (over: Partial<HangingInput>) => issues(solveHanging({ ...hanging, ...over }));
  const S = (over: Partial<StateInput>) => issues(solveState({ ...state, ...over }));
  const P = (over: Partial<PointsInput>) => issues(solvePoints({ ...points, ...over }));

  it('number', () => {
    expect(H({ L: Number.NaN })).toEqual(['number']);
    expect(H({ q: -1 })).toEqual(['number']);
    expect(H({ L: 1e31 })).toContain('number');
  });
  it('span', () => expect(H({ L: 0 })).toEqual(['span']));
  it('rise', () => expect(H({ h: 1e5 })).toEqual(['rise']));
  it('load-zero', () => expect(H({ q: 0, w: 0 })).toEqual(['load-zero']));
  it('section', () => expect(H({ EA: 0 })).toEqual(['section']));
  it('known-value', () => expect(H({ known: { kind: 'sag-mid', value: 0 } })).toEqual(['known-value']));
  it('sag-range', () => expect(H({ known: { kind: 'sag-mid', value: 1e5 } })).toEqual(['sag-range']));
  it('length-below-chord', () => expect(H({ known: { kind: 'length', value: 99 } })).toEqual(['length-below-chord']));
  it('tension-below-minimum', () => expect(H({ known: { kind: 'T-high', value: 1 } })).toEqual(['tension-below-minimum']));
  it('state2-load-zero', () => expect(S({ state2: { q: 0, w: 0, thermal: 0 } })).toEqual(['state2-load-zero']));
  it('state2-too-short', () => expect(S({ EA: null, state2: { q: 0, w: 0.0016, thermal: -0.01 } })).toEqual(['state2-too-short']));
  it('thermal', () => expect(S({ state2: { q: 0, w: 0.001, thermal: -2 } })).toEqual(['thermal']));
  it('table', () => expect(S({ sweep: { thermal: Array.from({ length: 42 }, () => 0) } })).toEqual(['table']));
  it('too-many-loads', () => expect(P({ loads: Array.from({ length: 13 }, (_, i) => ({ x: i + 1, P: 1 })) })).toEqual(['too-many-loads']));
  it('load-position', () => expect(P({ loads: [{ x: 70, P: 1 }] })).toEqual(['load-position']));
  it('duplicate-position', () => expect(P({ loads: [{ x: 10, P: 1 }, { x: 10, P: 1 }] })).toEqual(['duplicate-position']));
  it('no-loads', () => expect(P({ loads: [] })).toEqual(['no-loads']));
  it('sag-position', () => expect(P({ known: { kind: 'sag', x: 0, value: 1 } })).toEqual(['sag-position']));
  it('negative-tension', () => expect(P({ known: { kind: 'sag', x: 15, value: -5 } })).toEqual(['negative-tension']));
  it('solver: a bracket that cannot close (a length no H in range gives), and whatever throws inside', () => {
    expect(H({ known: { kind: 'length', value: 1e12 } })).toEqual(['solver']);
    const booby = { ...hanging, get known(): never { throw new Error('boom'); } };
    expect(issues(solveHanging(booby as unknown as HangingInput))).toEqual(['solver']);
    expect(issues(solveState({ ...state, get state1(): never { throw new Error('boom'); } } as unknown as StateInput))).toEqual(['solver']);
    expect(issues(solvePoints({ ...points, get loads(): never { throw new Error('boom'); } } as unknown as PointsInput))).toEqual(['solver']);
  });
  it('size', () => expect(P({ known: { kind: 'sag', x: 15, value: 5e-324 } })).toEqual(['size']));

  it('the list in types.ts is exactly the codes produced above (no sentence without a code, no code without a sentence)', () => {
    expect([...seen].sort()).toEqual([...ISSUE_CODES].sort());
    expect(new Set(ISSUE_CODES).size).toBe(ISSUE_CODES.length);
  });
});

describe('every warning code is produced', () => {
  const codes = (w: { code: CableWarningCode }[]) => {
    w.forEach((x) => seenWarnings.add(x.code));
    return w.map((x) => x.code);
  };
  it('parabola-differs, strain-high, vertex-outside, tension-two-roots', () => {
    const deep = solveHanging({ L: 100, h: 0, q: 0, w: 1, EA: null, known: { kind: 'sag-mid', value: 30 } });
    expect(deep.ok && codes(deep.warnings)).toEqual(['parabola-differs']);
    const soft = solveHanging({ L: 100, h: 0, q: 1, w: 0, EA: 100, known: { kind: 'sag-mid', value: 5 } });
    expect(soft.ok && codes(soft.warnings)).toEqual(['strain-high']);
    const steep = solveHanging({ L: 100, h: 60, q: 0.1, w: 0, EA: null, known: { kind: 'sag-mid', value: 1 } });
    expect(steep.ok && codes(steep.warnings)).toEqual(['vertex-outside']);
    const two = solveHanging({ L: 100, h: 0, q: 0, w: 1, EA: null, known: { kind: 'T-high', value: 80 } });
    expect(two.ok && codes(two.warnings)).toContain('tension-two-roots');
  });
  it('upward-load, zero-load, sag-not-at-load', () => {
    const p = solvePoints({ L: 60, h: 0, loads: [{ x: 10, P: 10 }, { x: 20, P: 0 }, { x: 30, P: -1 }, { x: 45, P: 12 }], known: { kind: 'sag', x: 25, value: 6 } });
    expect(p.ok && codes(p.warnings).sort()).toEqual(['sag-not-at-load', 'upward-load', 'zero-load']);
  });
  it('the change of state raises them too, tagged with the state', () => {
    const s = solveState({ L: 100, h: 0, EA: 100, known: { kind: 'sag-mid', value: 5 }, state1: { q: 1, w: 0 }, state2: { q: 1, w: 0, thermal: 0 } });
    expect(s.ok && s.warnings.some((w) => w.code === 'strain-high' && w.state === 1)).toBe(true);
  });
  it('the list in types.ts is exactly the warnings produced above', () => {
    expect([...seenWarnings].sort()).toEqual([...WARNING_CODES].sort());
  });
});
