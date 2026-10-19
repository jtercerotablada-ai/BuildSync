/**
 * STIFFNESS MATRIX — generators of structures and the comparison with the second oracle (bigoracle.testlib.ts). Not part of the calculator.
 *   gen          a random structure in feet and kips, rotated, with members stiffer or softer than the rest by up to `contrast` decades;
 *   real         a realistic one: W-shape sections, one member made `k` decades stiffer in A (or in A and I);
 *   compare      the engine against the oracle on one model: the outcome and the error of the displacements, reactions and end forces;
 *   sibling      the plane frame or truss calculator on the same model.
 */
import { solve } from './engine';
import { exactSolve, rng, type Exact } from './bigoracle.testlib';
import { solveFrame } from '../frame/engine';
import type { FrameModel } from '../frame/types';
import { solveTruss } from '../truss/engine';
import type { TrussModel } from '../truss/types';
import type { Solution, StiffnessMemberLoad, StiffnessModel } from './types';

export interface Cmp {
  exact: 'singular' | 'stable';
  engine: string; // 'ok' or an issue code
  errU: number;
  errR: number;
  errF: number;
  warnings: string[];
  count?: number; // near-mechanism figure count
  share?: number;
  sol?: Solution;
  ex: Exact;
}

const maxAbs = (v: number[]) => v.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

export function compare(model: StiffnessModel): Cmp {
  const ex = exactSolve(model);
  const out = solve(model);
  if (!out.ok) {
    return { exact: ex.singular ? 'singular' : 'stable', engine: out.issues[0].code, errU: NaN, errR: NaN, errF: NaN, warnings: [], ex };
  }
  const nd = model.mode === 'frame' ? 3 : 2;
  // u errors by kind
  const tr: number[] = [];
  const rot: number[] = [];
  const dtr: number[] = [];
  const drot: number[] = [];
  out.u.forEach((v, d) => {
    if (ex.singular) return;
    if (nd === 3 && d % 3 === 2) {
      rot.push(ex.u[d]);
      drot.push(v - ex.u[d]);
    } else {
      tr.push(ex.u[d]);
      dtr.push(v - ex.u[d]);
    }
  });
  // force-like quantities are measured against the largest force of the whole problem (a zero-force bar has rounding, not a relative error)
  let fScale = 0;
  let mScale = 0;
  if (!ex.singular) {
    ex.P.forEach((v, d) => {
      if (nd === 3 && d % 3 === 2) mScale = Math.max(mScale, Math.abs(v));
      else fScale = Math.max(fScale, Math.abs(v));
    });
    out.restrained.forEach((d, k) => {
      if (nd === 3 && (d - 1) % 3 === 2) mScale = Math.max(mScale, Math.abs(ex.R[k]));
      else fScale = Math.max(fScale, Math.abs(ex.R[k]));
    });
    ex.f.forEach((fo) =>
      fo.forEach((v, q) => {
        if (nd === 3 && q % 3 === 2) mScale = Math.max(mScale, Math.abs(v));
        else fScale = Math.max(fScale, Math.abs(v));
      }),
    );
  }
  const rel = (num: number[], ref: number[], floor = 0) => {
    const r = Math.max(maxAbs(ref), floor);
    const n = maxAbs(num);
    return r > 0 ? n / r : n;
  };
  let errU = 0;
  let errR = 0;
  let errF = 0;
  if (!ex.singular) {
    errU = Math.max(rel(dtr, tr), rel(drot, rot));
    // reactions: forces and moments separately
    const rf: number[] = [];
    const rm: number[] = [];
    const drf: number[] = [];
    const drm: number[] = [];
    out.restrained.forEach((d, k) => {
      const isRot = nd === 3 && (d - 1) % 3 === 2;
      (isRot ? rm : rf).push(ex.R[k]);
      (isRot ? drm : drf).push(out.reactions[k].value - ex.R[k]);
    });
    errR = Math.max(rel(drf, rf, fScale), rel(drm, rm, mScale));
    const ff: number[] = [];
    const fm: number[] = [];
    const dff: number[] = [];
    const dfm: number[] = [];
    out.forces.forEach((fo, k) =>
      fo.f.forEach((v, q) => {
        const isM = nd === 3 && q % 3 === 2;
        (isM ? fm : ff).push(ex.f[k][q]);
        (isM ? dfm : dff).push(v - ex.f[k][q]);
      }),
    );
    errF = Math.max(rel(dff, ff, fScale), rel(dfm, fm, mScale));
  }
  const nm = out.warnings.find((w) => w.code === 'near-mechanism');
  return { exact: ex.singular ? 'singular' : 'stable', engine: 'ok', errU, errR, errF, warnings: out.warnings.map((w) => w.code), count: nm?.count, share: nm?.ratio, sol: out, ex };
}

const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

export interface GenOpts {
  mode?: 'truss' | 'frame';
  contrast?: number; // max decades
  nodes?: [number, number];
  rotate?: boolean;
  shortFrac?: number; // 0: none
  ensureStable?: boolean;
  memberLoads?: boolean;
  settle?: boolean;
  supportsMin?: number;
  sign?: 'up' | 'down' | 'both';
  fraction?: number; // share of members given a contrast factor
}

/** A random structure. */
export function gen(seed: number, o: GenOpts = {}): StiffnessModel {
  const r = rng(seed);
  const mode = o.mode ?? (r() < 0.5 ? 'truss' : 'frame');
  const nn = (o.nodes?.[0] ?? 3) + Math.floor(r() * ((o.nodes?.[1] ?? 8) - (o.nodes?.[0] ?? 3) + 1));
  const unit = pick(r, [1, 10, 0.1, 12, 100, 0.01]);
  const ang = o.rotate === false ? 0 : r() * Math.PI * 2;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const nodes: { x: number; y: number }[] = [];
  const lattice = r() < 0.6;
  while (nodes.length < nn) {
    let x: number;
    let y: number;
    if (lattice) {
      x = Math.floor(r() * 9) * unit;
      y = Math.floor(r() * 7) * unit;
    } else {
      x = Number((r() * 10 * unit).toFixed(4));
      y = Number((r() * 8 * unit).toFixed(4));
    }
    if (nodes.some((q) => Math.hypot(q.x - x, q.y - y) < 0.4 * unit)) continue;
    nodes.push({ x, y });
  }
  if (o.shortFrac && nn >= 2) {
    // pull the last node close to a random other node
    const t = nodes.length - 1;
    const near = Math.floor(r() * t);
    const dir = r() * Math.PI * 2;
    const d = o.shortFrac * 12 * unit;
    nodes[t] = { x: nodes[near].x + d * Math.cos(dir), y: nodes[near].y + d * Math.sin(dir) };
  }
  const rotated = nodes.map((q) => ({ x: o.rotate === false ? q.x : q.x * ca - q.y * sa, y: o.rotate === false ? q.y : q.x * sa + q.y * ca }));
  const members: StiffnessModel['members'] = [];
  const key = new Set<string>();
  const addM = (i: number, j: number) => {
    const k = i < j ? `${i}-${j}` : `${j}-${i}`;
    if (i === j || key.has(k)) return;
    key.add(k);
    members.push(r() < 0.5 ? { i, j } : { i: j, j: i });
  };
  for (let k = 1; k < nn; k++) addM(Math.floor(r() * k), k);
  const extra = Math.floor(r() * (nn + 2));
  for (let e = 0; e < extra; e++) addM(Math.floor(r() * nn), Math.floor(r() * nn));
  const E0 = pick(r, [29000 * 144, 200e6, 1e7, 3000 * 144]);
  const A0 = pick(r, [0.01, 0.05, 1, 0.003, 12]) * (unit > 1 ? 1 : 1);
  const I0 = A0 * A0 * pick(r, [0.05, 0.3, 1, 0.01]);
  const decades = o.contrast ?? 0;
  const mem = members.map((m) => {
    const out = { ...m } as Record<string, number>;
    if (decades > 0 && r() < (o.fraction ?? 0.35)) {
      const sg = o.sign === 'up' ? 1 : o.sign === 'down' ? -1 : r() < 0.8 ? 1 : -1;
      const f = 10 ** (Math.floor(r() * (decades + 1)) * sg);
      const w = r();
      if (w < 0.4) out.A = A0 * f;
      else if (w < 0.7) out.I = I0 * f;
      else {
        out.A = A0 * f;
        out.I = I0 * f;
      }
    }
    return out as unknown as StiffnessModel['members'][number];
  });
  // supports
  const supports: StiffnessModel['supports'] = [];
  const ns = o.ensureStable ? 2 : 1 + Math.floor(r() * 3);
  const idx = Array.from({ length: nn }, (_, i) => i).sort(() => r() - 0.5);
  for (let s = 0; s < Math.min(ns, nn); s++) {
    const kind = o.ensureStable && s < 2 ? (mode === 'frame' ? 'fixed' : 'pin') : pick(r, ['fixed', 'pin', 'roller-y', 'roller-x', 'guide']);
    const base = { node: idx[s], ux: false, uy: false, rz: false } as StiffnessModel['supports'][number];
    if (kind === 'fixed') Object.assign(base, { ux: true, uy: true, rz: mode === 'frame' });
    else if (kind === 'pin') Object.assign(base, { ux: true, uy: true });
    else if (kind === 'roller-y') Object.assign(base, { uy: true });
    else if (kind === 'roller-x') Object.assign(base, { ux: true });
    else Object.assign(base, { ux: true, rz: mode === 'frame' });
    if (o.settle && r() < 0.5) {
      if (base.ux) base.dx = (r() - 0.5) * 0.02 * unit;
      if (base.uy) base.dy = (r() - 0.5) * 0.02 * unit;
      if (base.rz) base.dr = (r() - 0.5) * 0.002;
    }
    supports.push(base);
  }
  const loads: StiffnessModel['loads'] = [];
  const nl = 1 + Math.floor(r() * 3);
  for (let l = 0; l < nl; l++) loads.push({ node: Math.floor(r() * nn), fx: Number(((r() - 0.5) * 40).toFixed(3)), fy: Number(((r() - 0.5) * 40).toFixed(3)), m: mode === 'frame' ? Number(((r() - 0.5) * 100).toFixed(3)) : 0 });
  const memberLoads: StiffnessMemberLoad[] = [];
  if (mode === 'frame' && o.memberLoads) {
    const nml = Math.floor(r() * 4);
    for (let l = 0; l < nml; l++) {
      const mi = Math.floor(r() * members.length);
      const L = Math.hypot(rotated[members[mi].j].x - rotated[members[mi].i].x, rotated[members[mi].j].y - rotated[members[mi].i].y);
      const kind = pick(r, ['udl', 'point', 'axial'] as const);
      if (kind === 'udl') memberLoads.push({ kind, member: mi, w: Number(((r() - 0.5) * 10).toFixed(3)) });
      else if (kind === 'point') memberLoads.push({ kind, member: mi, a: Number((L * (0.1 + 0.8 * r())).toPrecision(6)), P: Number(((r() - 0.5) * 30).toFixed(3)) });
      else memberLoads.push({ kind, member: mi, q: Number(((r() - 0.5) * 6).toFixed(3)) });
    }
  }
  return { mode, nodes: rotated, members: mem, supports, loads, memberLoads, E: E0, A: A0, I: I0 };
}

/** The sibling calculators' answer for the same structure: max relative error of the translations against the exact ones, or null when it refused. */
export function sibling(model: StiffnessModel, ex: Exact): { ok: boolean; err: number } {
  const frame = model.mode === 'frame';
  const member = (m: StiffnessModel['members'][number]) => ({ i: m.i, j: m.j, E: m.E ?? model.E!, A: m.A ?? model.A!, ...(frame ? { I: m.I ?? model.I! } : {}) });
  const supports = model.supports.map((s) => {
    const kind = frame ? (s.ux && s.uy && s.rz ? 'fixed' : s.ux && s.uy ? 'pin' : s.rz ? 'guide' : 'roller') : s.ux && s.uy ? 'pin' : 'roller';
    const angle = s.uy && !s.ux ? 90 : 0;
    return { node: s.node, kind, ...(kind === 'roller' || kind === 'guide' ? { angle } : {}), ...(s.dx ? { dx: s.dx } : {}), ...(s.dy ? { dy: s.dy } : {}), ...(s.dr ? { dr: s.dr } : {}) };
  });
  let disp: { ux: number; uy: number }[] | null = null;
  if (frame) {
    const fm = {
      nodes: model.nodes.map((n) => ({ ...n })),
      members: model.members.map(member),
      supports,
      loads: model.loads.map((l) => ({ ...l })),
      memberLoads: model.memberLoads.map((l) => (l.kind === 'udl' ? { kind: 'udl', member: l.member, dir: 'local-y', w: l.w } : l.kind === 'axial' ? { kind: 'udl', member: l.member, dir: 'local-x', w: l.q } : { kind: 'point', member: l.member, dir: 'local-y', a: l.a, P: l.P })),
    } as unknown as FrameModel;
    const out = solveFrame(fm);
    if (!out.ok) return { ok: false, err: NaN };
    disp = (out as unknown as { displacements: { ux: number; uy: number }[] }).displacements;
  } else {
    const tm = { nodes: model.nodes.map((n) => ({ ...n })), members: model.members.map(member), supports, loads: model.loads.map((l) => ({ node: l.node, fx: l.fx, fy: l.fy })) } as unknown as TrussModel;
    const out = solveTruss(tm);
    if (!out.ok) return { ok: false, err: NaN };
    disp = (out as unknown as { displacements: { ux: number; uy: number }[] }).displacements;
  }
  const nd = frame ? 3 : 2;
  let top = 0;
  let worst = 0;
  disp!.forEach((d, n) => {
    top = Math.max(top, Math.abs(ex.u[nd * n]), Math.abs(ex.u[nd * n + 1]));
    worst = Math.max(worst, Math.abs(d.ux - ex.u[nd * n]), Math.abs(d.uy - ex.u[nd * n + 1]));
  });
  return { ok: true, err: top > 0 ? worst / top : worst };
}

/**
 * A realistic structure: feet and kips, W-shapes, one member made `k` decades stiffer in A (and in I when `what` is 'AI' and it is a frame): a rigid link, an inextensible
 * column. `ensureStable` gives it two supports that hold it (a fixed pair, or two pins in a truss); otherwise a pin and a roller, which hold a truss that is
 * triangulated and let any other sway.
 */
export function real(seed: number, mode: 'truss' | 'frame', k: number, what: 'A' | 'AI', ensureStable: boolean): StiffnessModel {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  const nn = 4 + Math.floor(r() * 5);
  const nodes: { x: number; y: number }[] = [];
  while (nodes.length < nn) {
    const x = Math.floor(r() * 9) * pick([4, 5, 6]);
    const y = Math.floor(r() * 5) * pick([4, 5, 6]);
    if (nodes.some((q) => q.x === x && q.y === y)) continue;
    nodes.push({ x, y });
  }
  const members: StiffnessModel['members'] = [];
  const key = new Set<string>();
  const add = (i: number, j: number) => {
    const kk = i < j ? `${i}-${j}` : `${j}-${i}`;
    if (i === j || key.has(kk)) return;
    key.add(kk);
    members.push({ i, j });
  };
  for (let q = 1; q < nn; q++) add(Math.floor(r() * q), q);
  const extra = 1 + Math.floor(r() * (nn + 1));
  for (let e = 0; e < extra; e++) add(Math.floor(r() * nn), Math.floor(r() * nn));
  const A0 = pick([5, 10, 14.1, 30]) / 144;
  const I0 = pick([50, 100, 484, 1000]) / 20736;
  const rigid = Math.floor(r() * members.length);
  const mem = members.map((m, q) => (q === rigid ? { ...m, A: A0 * 10 ** k, ...(what === 'AI' && mode === 'frame' ? { I: I0 * 10 ** k } : {}) } : m));
  const idx = Array.from({ length: nn }, (_, q) => q).sort(() => r() - 0.5);
  const supports: StiffnessModel['supports'] = ensureStable
    ? [
        { node: idx[0], ux: true, uy: true, rz: mode === 'frame' },
        { node: idx[1], ux: true, uy: true, rz: mode === 'frame' },
      ]
    : [
        { node: idx[0], ux: true, uy: true, rz: false },
        { node: idx[1], ux: false, uy: true, rz: false },
      ];
  const loads = [{ node: Math.floor(r() * nn), fx: Number(((r() - 0.5) * 40).toFixed(2)), fy: Number((-(r() * 30) - 1).toFixed(2)), m: 0 }];
  return { mode, nodes, members: mem, supports, loads, memberLoads: [], E: 29000 * 144, A: A0, I: I0 };
}

/**
 * A planar truss girder of `panels` panels of 10 ft by 8 ft, in feet and kips (or the same in metres and kilonewtons), pin at the left foot and a roller holding y at the right foot,
 * every bar the same (E = 29,000 ksi, A = 10 in²), with one load `fx`, `fy` at joint `at` (an index into the nodes). Determinate: bars = 2 × joints − 3.
 *   'pratt'   bottom joints 0..panels, top joints above the inner ones; verticals, and diagonals that slope down towards mid-span;
 *   'howe'    the same with the diagonals sloping up towards mid-span;
 *   'warren'  the top joints at mid-panel, diagonals alternating, no verticals.
 */
export function girder(kind: 'pratt' | 'howe' | 'warren', panels: number, at: number, fx: number, fy: number, units: 'us' | 'si' = 'us'): StiffnessModel {
  const dx = 10;
  const dy = 8;
  const nodes: { x: number; y: number }[] = [];
  for (let i = 0; i <= panels; i++) nodes.push({ x: i * dx, y: 0 });
  const members: StiffnessModel['members'] = [];
  for (let i = 0; i < panels; i++) members.push({ i, j: i + 1 });
  if (kind === 'warren') {
    for (let j = 0; j < panels; j++) nodes.push({ x: (j + 0.5) * dx, y: dy });
    const top = (j: number) => panels + 1 + j;
    for (let j = 0; j < panels - 1; j++) members.push({ i: top(j), j: top(j + 1) });
    for (let j = 0; j < panels; j++) members.push({ i: j, j: top(j) }, { i: top(j), j: j + 1 });
  } else {
    for (let i = 1; i < panels; i++) nodes.push({ x: i * dx, y: dy });
    const top = (i: number) => panels + i; // the top joint above bottom joint i, for i = 1..panels − 1
    for (let i = 1; i < panels - 1; i++) members.push({ i: top(i), j: top(i + 1) });
    // the end diagonals run from the feet to the first and last top joints
    members.push({ i: 0, j: top(1) }, { i: panels, j: top(panels - 1) });
    for (let i = 1; i < panels; i++) members.push({ i, j: top(i) });
    for (let i = 1; i < panels - 1; i++) {
      const towardsMiddle = kind === 'pratt' ? i < panels / 2 : i >= panels / 2;
      members.push(towardsMiddle ? { i: top(i), j: i + 1 } : { i, j: top(i + 1) });
    }
  }
  const k = units === 'si' ? { E: 200e6, A: 6451.6e-6 } : { E: 29000 * 144, A: 10 / 144 };
  const L = units === 'si' ? 0.3048 : 1;
  return {
    mode: 'truss',
    nodes: nodes.map((n) => ({ x: n.x * L, y: n.y * L })),
    members,
    supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: panels, ux: false, uy: true, rz: false }],
    loads: [{ node: at, fx, fy, m: 0 }],
    memberLoads: [],
    E: k.E,
    A: k.A,
  };
}
