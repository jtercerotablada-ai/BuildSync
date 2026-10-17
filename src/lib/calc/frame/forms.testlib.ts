import { rng } from './oracle.testlib';
import {
  FRAME_UNITS,
  SECTION_PRESETS,
  defaultFrame,
  emptyFrame,
  reduceFrame,
  type FrameAction,
  type FrameForm,
  type FrameList,
} from './model';
import { TEMPLATE_IDS } from './templates';

/** Test library: random forms made by random edits, and the normal form that a link reads back to. */

export const LISTS: FrameList[] = ['nodes', 'members', 'supports', 'loads', 'memberLoads'];

/** A number with at most eight significant figures, of every sort a field holds. */
export function randomNumber(r: () => number): number {
  const kind = Math.floor(r() * 7);
  switch (kind) {
    case 0:
      return 0;
    case 1:
      return Math.round((r() - 0.5) * 200);
    case 2:
      return Number(((r() - 0.5) * 1000).toPrecision(5));
    case 3:
      return Number(((r() - 0.5) * 100).toPrecision(8));
    case 4:
      return Number(((r() + 0.01) * 10 ** Math.floor(r() * 12 - 6)).toPrecision(6));
    case 5:
      return Number(((r() - 0.5) * 1e5).toFixed(2));
    default:
      return Math.round(r() * 40) / 4;
  }
}

export const positive = (r: () => number): number => Number((Math.abs(randomNumber(r)) + 0.001).toPrecision(8));

/** A form made by a random sequence of actions from the example or a template: valid references, arbitrary numbers. */
export function randomForm(seed: number, steps = 25, units = true): FrameForm {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  let form: FrameForm = r() < 0.5 ? defaultFrame() : emptyFrame(r() < 0.5 ? 'us' : 'si');
  for (let s = 0; s < steps; s++) {
    const roll = r();
    let action: FrameAction;
    if (roll < 0.3) action = { type: 'add', list: pick(LISTS), seed: r() < 0.3 ? { kind: pick(['point', 'moment', 'trapezoid', 'temperature', 'udl-projected', 'roller', 'guide', 'spring']) } : {} };
    else if (roll < 0.65) {
      const list = pick(LISTS);
      const rows = form[list];
      if (rows.length === 0) continue;
      const row = pick(rows as { id: number }[]);
      const patch: Record<string, unknown> = {};
      const fields: Record<FrameList, string[]> = {
        nodes: ['x', 'y'],
        members: ['A', 'I', 'E', 'h', 'hingeStart', 'hingeEnd', 'i', 'j'],
        supports: ['angle', 'kx', 'ky', 'kr', 'dx', 'dy', 'dr', 'kind', 'node'],
        loads: ['fx', 'fy', 'm', 'node'],
        memberLoads: ['w', 'w2', 'P', 'M', 'a', 'b', 'dT', 'dTg', 'alpha', 'kind', 'dir', 'member'],
      };
      const key = pick(fields[list]);
      if (key === 'hingeStart' || key === 'hingeEnd') patch[key] = r() < 0.5;
      else if (key === 'kind') patch[key] = list === 'supports' ? pick(['fixed', 'pin', 'roller', 'guide', 'spring']) : pick(['udl', 'udl-projected', 'trapezoid', 'point', 'moment', 'temperature']);
      else if (key === 'dir') patch[key] = pick(['local-y', 'local-x', 'global-x', 'global-y']);
      else if (key === 'i' || key === 'j' || key === 'node') patch[key] = pick(form.nodes).id;
      else if (key === 'member') patch[key] = pick(form.members).id;
      else if (['A', 'I', 'E', 'h'].includes(key) && r() < 0.3) patch[key] = null;
      else patch[key] = randomNumber(r);
      action = { type: 'patch', list, id: row.id, patch };
    } else if (roll < 0.75) {
      const list = pick(LISTS);
      if (form[list].length === 0) continue;
      action = { type: 'remove', list, id: pick(form[list] as { id: number }[]).id };
    } else if (roll < 0.82) {
      if (!units) continue;
      action = { type: 'units', units: form.units === 'us' ? 'si' : 'us' };
    } else if (roll < 0.88) action = { type: 'template', template: pick(TEMPLATE_IDS), params: { width: positive(r) % 40 + 2, height: positive(r) % 20 + 2, bays: Math.floor(r() * 4) + 1, storeys: Math.floor(r() * 3) + 1, base: r() < 0.5 ? 'fixed' : 'pinned', hinge: r() < 0.5 } };
    else if (roll < 0.92) action = { type: 'section', patch: { E: r() < 0.2 ? null : positive(r), A: positive(r), I: r() < 0.2 ? null : positive(r) } };
    else if (roll < 0.95) action = { type: 'preset', preset: pick(SECTION_PRESETS).id, ...(r() < 0.5 && form.members.length > 0 ? { member: pick(form.members).id } : {}) };
    else if (roll < 0.98) action = { type: 'material', material: pick(['steel', 'aluminum', 'custom'] as const) };
    else action = { type: 'clear' };
    form = reduceFrame(form, action);
  }
  return form;
}

/** The form a link reads back to: ids renumbered in the order the link numbers them, the notice gone, no −0. */
export function normal(form: FrameForm): FrameForm {
  const z = (v: number): number => v + 0;
  let id = 1;
  const nodeId = new Map(form.nodes.map((n) => [n.id, id++]));
  const memberId = new Map(form.members.map((m) => [m.id, id++]));
  const supportId = form.supports.map(() => id++);
  const loadId = form.loads.map(() => id++);
  const mlId = form.memberLoads.map(() => id++);
  const opt = (v: number | null) => (v === null ? null : z(v));
  return {
    units: form.units,
    nodes: form.nodes.map((n) => ({ id: nodeId.get(n.id)!, x: z(n.x), y: z(n.y) })),
    members: form.members.map((m) => ({ id: memberId.get(m.id)!, i: nodeId.get(m.i)!, j: nodeId.get(m.j)!, A: opt(m.A), I: opt(m.I), E: opt(m.E), hingeStart: m.hingeStart, hingeEnd: m.hingeEnd, h: opt(m.h) })),
    supports: form.supports.map((s, k) => ({ ...s, id: supportId[k], node: nodeId.get(s.node)!, angle: z(s.angle), kx: z(s.kx), ky: z(s.ky), kr: z(s.kr), dx: z(s.dx), dy: z(s.dy), dr: z(s.dr) })),
    loads: form.loads.map((l, k) => ({ id: loadId[k], node: nodeId.get(l.node)!, fx: z(l.fx), fy: z(l.fy), m: z(l.m) })),
    memberLoads: form.memberLoads.map((l, k) => ({ ...l, id: mlId[k], member: memberId.get(l.member)!, w: z(l.w), w2: z(l.w2), P: z(l.P), M: z(l.M), a: z(l.a), b: z(l.b), dT: z(l.dT), dTg: z(l.dTg), alpha: z(l.alpha) })),
    material: form.material,
    E: opt(form.E),
    A: opt(form.A),
    I: opt(form.I),
    notice: null,
    nextId: id,
  };
}

export { FRAME_UNITS };
