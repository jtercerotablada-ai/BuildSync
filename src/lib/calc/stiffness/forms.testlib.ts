import { rng } from './oracle.testlib';
import { LIMITS, defaultStiffness, emptyStiffness, reduceStiffness, type StiffnessAction, type StiffnessForm, type StiffnessList } from './model';
import { TEMPLATE_IDS } from './templates';

/** Test library: random forms made by random edits, and the normal form that a link reads back to. */

export const LISTS: StiffnessList[] = ['nodes', 'members', 'supports', 'loads', 'memberLoads'];

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

/** A form made by a random sequence of actions from the example, a template or nothing: valid references, arbitrary numbers. */
export function randomForm(seed: number, steps = 25): StiffnessForm {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  let form: StiffnessForm = r() < 0.4 ? defaultStiffness() : r() < 0.5 ? emptyStiffness(r() < 0.5 ? 'us' : 'si', r() < 0.5 ? 'truss' : 'frame') : reduceStiffness(emptyStiffness('us'), { type: 'template', template: pick(TEMPLATE_IDS) });
  for (let s = 0; s < steps; s++) {
    const roll = r();
    let action: StiffnessAction;
    if (roll < 0.3) action = { type: 'add', list: pick(LISTS), seed: r() < 0.3 ? { kind: pick(['point', 'axial', 'udl']), preset: pick(['fixed', 'pin', 'roller']) } : {} };
    else if (roll < 0.7) {
      const list = pick(LISTS);
      const rows = form[list];
      if (rows.length === 0) continue;
      const row = pick(rows as { id: number }[]);
      const patch: Record<string, unknown> = {};
      const fields: Record<StiffnessList, string[]> = {
        nodes: ['x', 'y'],
        members: ['E', 'A', 'I', 'i', 'j'],
        supports: ['ux', 'uy', 'rz', 'dx', 'dy', 'dr', 'node'],
        loads: ['fx', 'fy', 'm', 'node'],
        memberLoads: ['w', 'P', 'a', 'q', 'kind', 'member'],
      };
      const count = 1 + Math.floor(r() * 2);
      for (let k = 0; k < count; k++) {
        const f = pick(fields[list]);
        if (f === 'i' || f === 'j' || f === 'node') patch[f] = pick(form.nodes).id;
        else if (f === 'member') patch[f] = pick(form.members).id;
        else if (f === 'kind') patch[f] = pick(['udl', 'point', 'axial']);
        else if (f === 'ux' || f === 'uy' || f === 'rz') patch[f] = r() < 0.5;
        else if (f === 'E' || f === 'A' || f === 'I') patch[f] = r() < 0.2 ? null : positive(r);
        else patch[f] = randomNumber(r);
      }
      action = { type: 'patch', list, id: row.id, patch };
    } else if (roll < 0.78) {
      const list = pick(LISTS);
      if (form[list].length === 0) continue;
      action = { type: 'remove', list, id: pick(form[list] as { id: number }[]).id };
    } else if (roll < 0.85) action = { type: 'mode', mode: pick(['truss', 'frame'] as const) };
    else if (roll < 0.9) action = { type: 'units', units: pick(['us', 'si'] as const) };
    else if (roll < 0.94) action = { type: 'material', material: pick(['steel', 'aluminum', 'custom'] as const) };
    else if (roll < 0.97) action = { type: 'section', patch: { E: r() < 0.1 ? null : positive(r), A: positive(r), I: r() < 0.1 ? null : positive(r) } };
    else action = { type: 'template', template: pick(TEMPLATE_IDS) };
    form = reduceStiffness(form, action);
  }
  return form;
}

/** A form as a link reads it back: no notice, and the rows numbered again from 1 (nodes, members, supports, loads, member loads). */
export function normal(form: StiffnessForm): StiffnessForm {
  let id = 1;
  const nodeId = new Map(form.nodes.map((n) => [n.id, id++]));
  const memberId = new Map(form.members.map((m) => [m.id, id++]));
  return {
    ...form,
    notice: null,
    nodes: form.nodes.map((n) => ({ ...n, id: nodeId.get(n.id)! })),
    members: form.members.map((m) => ({ ...m, id: memberId.get(m.id)!, i: nodeId.get(m.i)!, j: nodeId.get(m.j)! })),
    supports: form.supports.map((s) => ({ ...s, id: id++, node: nodeId.get(s.node)! })),
    loads: form.loads.map((l) => ({ ...l, id: id++, node: nodeId.get(l.node)! })),
    memberLoads: form.memberLoads.map((l) => ({ ...l, id: id++, member: memberId.get(l.member)! })),
    nextId: id,
  };
}

export { LIMITS };
