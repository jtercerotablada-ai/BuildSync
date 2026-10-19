import { describe, expect, it } from 'vitest';
import { DD_ZERO, dd, ddAbs, ddAdd, ddCompare, ddDiv, ddDot, ddMatMul, ddMul, ddMulD, ddNeg, ddSign, ddSqrt, ddSub, prod2, sum2, type DD } from './dd';
import { add, div, fromNumber, mul, neg, q, rng, sub, type Q } from './oracle.testlib';

/**
 * THE DOUBLE-DOUBLE ARITHMETIC is checked against exact fractions (the oracle's BigInt Q): every operation is within 2⁻¹⁰² of the exact result, and the two
 * parts of a result are a proper pair (|lo| ≤ ulp(hi)/2), so that hi is the result rounded to a double.
 */

const exactOf = (a: DD): Q => add(fromNumber(a[0]), fromNumber(a[1]));
/** |a − b| / |b| as a double (b not zero). */
function relative(a: Q, b: Q): number {
  const d = sub(a, b);
  if (d.n === BigInt(0)) return 0;
  const r = div(d, b);
  const n = Number(r.n < BigInt(0) ? -r.n : r.n);
  const m = Number(r.d);
  // (the numerator and denominator of a tiny ratio can leave the range of a double: work with the bit lengths)
  const bits = (x: bigint) => (x < BigInt(0) ? -x : x).toString(2).length;
  if (Number.isFinite(n) && Number.isFinite(m) && m !== 0) return n / m;
  return 2 ** (bits(r.n) - bits(r.d));
}

describe('double-double arithmetic', () => {
  const r = rng(404);
  const pick = (): number => {
    const mantissa = (r() - 0.5) * 2;
    const exponent = Math.floor(r() * 40 - 20);
    return mantissa * 10 ** exponent;
  };
  const dd1 = (): DD => {
    const a = pick();
    const b = pick() * 1e-17;
    return sum2(a, b);
  };

  it('prod2 and sum2 are exact', () => {
    for (let k = 0; k < 400; k++) {
      const a = pick();
      const b = pick();
      const p = prod2(a, b);
      expect(relative(exactOf(p), mul(fromNumber(a), fromNumber(b)))).toBe(0);
      const s = sum2(a, b);
      expect(relative(exactOf(s), add(fromNumber(a), fromNumber(b)))).toBe(0);
    }
  });

  it('add, sub, mul and div are within 2⁻¹⁰² of the exact result, and every result is a proper pair', () => {
    let worst = 0;
    for (let k = 0; k < 600; k++) {
      const a = dd1();
      const b = dd1();
      const ea = exactOf(a);
      const eb = exactOf(b);
      const results: [DD, Q][] = [
        [ddAdd(a, b), add(ea, eb)],
        [ddSub(a, b), sub(ea, eb)],
        [ddMul(a, b), mul(ea, eb)],
        [ddDiv(a, b), div(ea, eb)],
        [ddMulD(a, b[0]), mul(ea, fromNumber(b[0]))],
      ];
      for (const [got, want] of results) {
        if (want.n === BigInt(0)) {
          expect(got[0]).toBe(0);
          continue;
        }
        const e = relative(exactOf(got), want);
        worst = Math.max(worst, e);
        expect(e, `${JSON.stringify([a, b])}`).toBeLessThan(2 ** -100);
        expect(Math.abs(got[1]), 'a proper pair').toBeLessThanOrEqual(Math.abs(got[0]) * 2 ** -52);
      }
    }
    expect(worst).toBeLessThan(2 ** -102);
  });

  it('sqrt is within 2⁻¹⁰² of the root, and the root of a perfect square is the integer', () => {
    for (let k = 0; k < 300; k++) {
      const a = ddAbs(dd1());
      const root = ddSqrt(a);
      const back = mul(exactOf(root), exactOf(root));
      expect(relative(back, exactOf(a))).toBeLessThan(2 ** -101);
    }
    for (const n of [1, 4, 9, 25, 100, 144, 169, 289, 625]) expect(ddSqrt(dd(n))).toEqual([Math.sqrt(n), 0]);
    expect(ddSqrt(DD_ZERO)).toEqual([0, 0]);
    expect(Number.isNaN(ddSqrt(dd(-1))[0])).toBe(true);
  });

  it('one third, written twice, is one third to 32 digits (a double alone has 16)', () => {
    const third = ddDiv(dd(1), dd(3));
    const back = ddMul(third, dd(3));
    expect(Math.abs(back[0] - 1) + Math.abs(back[1])).toBeLessThan(2 ** -100);
    // the same sum in doubles loses the small term altogether
    expect(1e16 + 1 - 1e16).toBe(0);
    expect(ddSub(ddAdd(dd(1e16), dd(1)), dd(1e16))[0]).toBe(1);
  });

  it('sign, absolute value, negation and order never give −0', () => {
    expect(ddNeg(DD_ZERO)).toEqual([0, 0]);
    expect(Object.is(ddNeg(DD_ZERO)[0], 0)).toBe(true);
    expect(ddSign([0, 0])).toBe(0);
    expect(ddSign([-3, 0])).toBe(-1);
    expect(ddAbs([-3, 1e-20])).toEqual([3, -1e-20]);
    expect(ddCompare([1, 1e-20], [1, 0])).toBe(1);
    expect(ddCompare([1, 0], [1, 1e-20])).toBe(-1);
  });

  it('a dot product and a matrix product keep every digit of the terms', () => {
    const a = [dd(1e16), dd(1), dd(-1e16)];
    const b = [dd(1), dd(1), dd(1)];
    expect(ddDot(a, b).value[0]).toBe(1);
    const m = ddMatMul([[dd(1e16), dd(1)]], [[dd(1)], [dd(-1e16)]]);
    expect(m[0][0][0]).toBe(0 + 1e16 - 1e16);
    const n = ddMatMul([[dd(2), dd(1e16), dd(-1e16)]], [[dd(1)], [dd(1)], [dd(1)]]);
    expect(n[0][0][0]).toBe(2);
    void neg;
    void q;
  });
});
