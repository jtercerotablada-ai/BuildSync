import { MATERIALS, ROPES, type CableForm, type SectionForm } from './model';
import type { MaterialId, RopeId } from './types';
import { MATERIAL_IDS, ROPE_IDS } from './types';

/* Helpers for the cable tests. Nothing here is the engine's: the oracles the tests use are written in the test files. */

/** A small seeded generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const between = (r: () => number, lo: number, hi: number): number => lo + (hi - lo) * r();
export const pickOf = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length];
/** A number the way a field holds it: six significant figures. */
export const six = (v: number): number => Number(v.toPrecision(6)) + 0;

export function near(a: number, b: number, rel = 1e-12, abs = 0): boolean {
  return Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b)) + abs;
}

/** Every number in a value (nested objects and arrays), to check that none is NaN, infinite or −0. */
export function numbersIn(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number') out.push(value);
  else if (Array.isArray(value)) for (const v of value) numbersIn(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) numbersIn(v, out);
  return out;
}

export function randomSection(r: () => number, units: 'us' | 'si'): SectionForm {
  const material = pickOf<MaterialId>(r, MATERIAL_IDS);
  const rope = pickOf<RopeId>(r, ROPE_IDS);
  const by = r() < 0.5 ? 'diameter' : 'area';
  const preset = material === 'custom' ? null : MATERIALS[material];
  const factor = rope === 'solid' ? null : rope === 'custom' ? six(between(r, 0.3, 0.8)) : ROPES[rope].factor;
  return {
    by,
    d: r() < 0.1 ? null : six(units === 'us' ? between(r, 0.1, 2) : between(r, 3, 50)),
    A: r() < 0.1 ? null : six(units === 'us' ? between(r, 0.01, 3) : between(r, 8, 2000)),
    rope,
    factor,
    material,
    E: preset ? preset.E[units] : six(between(r, 5000, 30000) * (units === 'us' ? 1 : 0.0069)),
    alpha: preset ? preset.alpha[units] : six(between(r, 4, 25)),
    mbf: r() < 0.5 ? null : six(between(r, 100, 1e5)),
  };
}

/** A form with random numbers anywhere in its range — not necessarily one that solves. For the address tests. */
export function randomForm(r: () => number): CableForm {
  const units = r() < 0.5 ? 'us' : 'si';
  const n = (lo: number, hi: number) => six(between(r, lo, hi));
  const maybe = (lo: number, hi: number, p = 0.3): number | null => (r() < p ? null : n(lo, hi));
  const sometimesNaN = (v: number): number => (r() < 0.03 ? Number.NaN : v);
  return {
    units,
    forceUnit: r() < 0.5 ? 'small' : 'large',
    mode: pickOf(r, ['load', 'pull', 'drum'] as const),
    section: randomSection(r, units),
    dT: sometimesNaN(n(-200, 200)),
    n: maybe(1, 10),
    allowable: maybe(1, 100),
    load: {
      W: sometimesNaN(n(0, 1e5)),
      H: n(-1e4, 1e4),
      legs: r() < 0.5 ? 1 : 2,
      leg1: { angle: n(0, 90), side: r() < 0.5 ? 'left' : 'right', length: n(0.1, 100) },
      leg2: { angle: n(0, 90), side: r() < 0.5 ? 'left' : 'right', length: n(0.1, 100) },
      own2: r() < 0.4 ? randomSection(r, units) : null,
    },
    pull: { W: n(1, 1e4), massInput: r() < 0.5, theta: n(-30, 60), muS: n(0, 1), muK: n(0, 1), phi: n(-90, 90), accel: maybe(-5, 5), travel: r() < 0.5 ? 'along' : 'against', length: n(0.1, 100) },
    drum: { Tbig: maybe(1, 1e4), Tsmall: maybe(1, 1e4), mu: maybe(0, 1), wrap: maybe(0, 720), wrapUnit: r() < 0.5 ? 'deg' : 'turns' },
  };
}

/** A form that always solves in mode `mode`, with ordinary numbers. For the property tests. */
export function solvableForm(r: () => number, mode: 'load' | 'pull' | 'drum', units: 'us' | 'si' = 'us'): CableForm {
  const us = units === 'us';
  const mat = pickOf<Exclude<MaterialId, 'custom'>>(r, ['steel', 'stainless', 'aluminum', 'strand7', 'rope', 'rope-spiral'] as const);
  const rope: Exclude<RopeId, 'custom'> = MATERIALS[mat].rope === 'solid' ? 'solid' : (MATERIALS[mat].rope as Exclude<RopeId, 'custom'>);
  const d = six(us ? between(r, 0.2, 1.5) : between(r, 5, 40));
  const section: SectionForm = {
    by: 'diameter',
    d,
    A: null,
    rope,
    factor: rope === 'solid' ? null : ROPES[rope].factor,
    material: mat,
    E: MATERIALS[mat].E[units],
    alpha: MATERIALS[mat].alpha[units],
    mbf: r() < 0.5 ? null : six(us ? between(r, 5000, 80000) : between(r, 20000, 350000)),
  };
  const f = us ? 1 : 4.448;
  const a1 = six(between(r, 15, 80));
  const a2 = six(between(r, 15, 80));
  return {
    units,
    forceUnit: 'small',
    mode,
    section,
    dT: six(between(r, -50, 80) * (us ? 1 : 0.5556)),
    n: r() < 0.5 ? null : six(between(r, 2, 6)),
    allowable: r() < 0.5 ? null : six(us ? between(r, 10, 80) : between(r, 70, 550)),
    load: {
      W: six(between(r, 500, 8000) * f),
      H: r() < 0.4 ? 0 : six(between(r, -300, 300) * f),
      legs: r() < 0.2 ? 1 : 2,
      leg1: { angle: a1, side: 'left', length: six(us ? between(r, 3, 40) : between(r, 1, 12)) },
      leg2: { angle: a2, side: 'right', length: six(us ? between(r, 3, 40) : between(r, 1, 12)) },
      own2: null,
    },
    pull: { W: six(between(r, 20, 800) * f), massInput: false, theta: six(between(r, -10, 30)), muS: six(between(r, 0.3, 0.8)), muK: six(between(r, 0.15, 0.3)), phi: six(between(r, -10, 35)), accel: r() < 0.5 ? null : six(between(r, 0.1, 4)), travel: 'along', length: six(us ? between(r, 3, 60) : between(r, 1, 18)) },
    drum: { Tbig: six(between(r, 200, 5000) * f), Tsmall: null, mu: six(between(r, 0.1, 0.6)), wrap: six(between(r, 0.5, 4)), wrapUnit: 'turns' },
  };
}
