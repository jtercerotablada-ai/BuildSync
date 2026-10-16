import { describe, expect, it } from 'vitest';
import { fill, listOf, nodesOf, signed, sortMembers } from './text';

/** The little text machinery of the truss calculator's sentences. */

describe('fill', () => {
  it('puts a value in its hole, once, and leaves a hole it has no value for', () => {
    expect(fill('Node {node} of {count}.', { node: 3, count: 10 })).toBe('Node 3 of 10.');
    expect(fill('{missing} stays', {})).toBe('{missing} stays');
  });

  it('chooses the singular for one and the plural for the rest, zero included', () => {
    const s = '{count} {count|way|ways}';
    expect([0, 1, 2, 11].map((count) => fill(s, { count }))).toEqual(['0 ways', '1 way', '2 ways', '11 ways']);
  });

  it('does not take what was put into a hole for another hole', () => {
    expect(fill('{a} and {b}', { a: '{b}', b: 'x' })).toBe('{b} and x');
  });
});

describe('listOf', () => {
  it('writes runs of three or more as ranges, and the last with the word for “and”', () => {
    expect(listOf([], 'and')).toBe('');
    expect(listOf([3], 'and')).toBe('3');
    expect(listOf([3, 4], 'and')).toBe('3 and 4');
    expect(listOf([1, 2, 3], 'and')).toBe('1–3');
    expect(listOf([1, 2, 3, 4, 6], 'and')).toBe('1–4 and 6');
    expect(listOf([1, 2, 5, 7, 8, 9], 'y')).toBe('1, 2, 5 y 7–9');
  });

  it('sorts, and counts a number once', () => {
    expect(listOf([9, 3, 3, 4, 5], 'and')).toBe('3–5 and 9');
  });
});

describe('nodesOf', () => {
  it('says one node in the singular and several in the plural, in the words it is given', () => {
    const en = { and: 'and', theNode: 'node', theNodes: 'nodes' };
    const es = { and: 'y', theNode: 'el nudo', theNodes: 'los nudos' };
    expect(nodesOf([3], en)).toBe('node 3');
    expect(nodesOf([3, 4], en)).toBe('nodes 3 and 4');
    expect(nodesOf([3, 3], en)).toBe('node 3');
    expect(nodesOf([3], es)).toBe('el nudo 3');
    expect(nodesOf([1, 2, 3, 4, 6], es)).toBe('los nudos 1–4 y 6');
  });
});

describe('signed', () => {
  it('signs a value with a true minus and writes a zero with no sign', () => {
    expect(signed('15', 15)).toBe('+15');
    expect(signed('20', -20)).toBe('−20');
    expect(signed('0', 0)).toBe('0');
    expect(signed('0', 3e-14)).toBe('0');
    expect(signed('0', -3e-14)).toBe('0');
  });
});

describe('sortMembers', () => {
  const m = (label: number, force: number) => ({ label, force });
  const list = [m(1, 0), m(2, 15), m(3, -15), m(4, 21), m(5, -21), m(6, 15 + 1e-12)];

  it('orders by number, by the size of the force, and tension first, a tie going to the lower number', () => {
    expect(sortMembers(list, 'member').map((x) => x.label)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(sortMembers(list, 'largest').map((x) => x.label)).toEqual([4, 5, 2, 3, 6, 1]);
    expect(sortMembers(list, 'tension').map((x) => x.label)).toEqual([4, 2, 6, 1, 3, 5]);
  });

  it('gives a new list and leaves the one it was given as it was', () => {
    const copy = [...list];
    sortMembers(list, 'largest');
    expect(list).toEqual(copy);
  });
});
