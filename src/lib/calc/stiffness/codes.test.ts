import { describe, expect, it } from 'vitest';
import { analyseSafely } from './analysis';
import {
  CHECK_IDS,
  DOF_KINDS,
  HIGHLIGHT_REASONS,
  ISSUE_CODES,
  MECHANISM_KINDS,
  MEMBER_LOAD_KINDS,
  MEMBER_STEP_IDS,
  MODES,
  NOTHING_TO_ADD_WHY,
  NOTICE_CODES,
  STAGE_OF,
  STEP_IDS,
  SUPPORT_SYMBOLS,
  WARNING_CODES,
} from './codes';
import { MEMBER_LOAD_KINDS as FORM_KINDS, emptyStiffness, reduce, type StiffnessForm } from './model';
import { TEMPLATE_IDS } from './templates';
import type { Block, Step } from './types';

const unique = (list: readonly string[]) => expect(new Set(list).size).toBe(list.length);

describe('the lists of codes', () => {
  it('have no code twice', () => {
    for (const list of [ISSUE_CODES, WARNING_CODES, NOTICE_CODES, STEP_IDS, HIGHLIGHT_REASONS, CHECK_IDS, SUPPORT_SYMBOLS, MECHANISM_KINDS, DOF_KINDS, MODES, MEMBER_LOAD_KINDS, NOTHING_TO_ADD_WHY]) unique(list);
  });
  it('the stage of every step is 1 to 14, covers every stage, and never goes back along the list', () => {
    expect(Object.keys(STAGE_OF).sort()).toEqual([...STEP_IDS].sort());
    const stages = STEP_IDS.map((id) => STAGE_OF[id]);
    expect(stages).toEqual([...stages].sort((a, b) => a - b));
    expect(new Set(stages)).toEqual(new Set(Array.from({ length: 14 }, (_, k) => k + 1)));
  });
  it('the member kinds of the form and of the codes are the same', () => {
    expect([...MEMBER_LOAD_KINDS].sort()).toEqual([...FORM_KINDS].sort());
  });
  it('the steps that come once for each member are exactly those with a member in their scope', () => {
    const steps: Step[] = [];
    for (const template of TEMPLATE_IDS) steps.push(...(analyseSafely(reduce(emptyStiffness(), { type: 'template', template })).solution?.steps ?? []));
    for (const id of STEP_IDS) {
      const of = steps.filter((s) => s.id === id);
      expect(of.length, id).toBeGreaterThan(0);
      for (const s of of) expect(s.scope.kind === 'member', `${id} ${s.key}`).toBe(MEMBER_STEP_IDS.includes(id));
    }
  });
});

describe('every code is produced by something', () => {
  it('every step id, every highlight reason and every check appears in the solutions of the templates, a mechanism and a settlement', () => {
    const steps: Step[] = [];
    for (const template of TEMPLATE_IDS) steps.push(...(analyseSafely(reduce(emptyStiffness(), { type: 'template', template })).solution?.steps ?? []));
    // a settlement
    let f: StiffnessForm = reduce(emptyStiffness(), { type: 'template', template: 'frame-propped' });
    f = reduce(f, { type: 'patch', list: 'supports', id: f.supports[1].id, patch: { dy: -1 } });
    steps.push(...analyseSafely(f).solution!.steps);
    // a mechanism: the steps up to the zero pivot
    let m: StiffnessForm = reduce(emptyStiffness(), { type: 'template', template: 'truss-five-member' });
    m = reduce(m, { type: 'remove', list: 'members', id: m.members[1].id });
    steps.push(...analyseSafely(m).partial);
    expect(new Set(steps.map((s) => s.id))).toEqual(new Set(STEP_IDS));
    const reasons = new Set<string>();
    const note = (b: Block) => {
      if (b.type === 'matrix') b.highlights?.forEach((h) => reasons.add(h.reason));
      if (b.type === 'vector') b.highlights?.forEach((h) => reasons.add(h.reason));
    };
    steps.forEach((s) => s.blocks.forEach(note));
    expect([...reasons].sort()).toEqual([...HIGHLIGHT_REASONS].sort());
    const checks = new Set(TEMPLATE_IDS.flatMap((t) => analyseSafely(reduce(emptyStiffness(), { type: 'template', template: t })).solution!.checks.map((c) => c.id)));
    expect([...checks].sort()).toEqual([...CHECK_IDS].sort());
  });
  it('every notice code, and every reason for nothing to add, comes out of the reducer', () => {
    const notices = new Set<string>();
    const whys = new Set<string>();
    const see = (form: StiffnessForm) => {
      if (form.notice) {
        notices.add(form.notice.code);
        if (form.notice.code === 'nothing-to-add') whys.add(form.notice.why);
      }
      return form;
    };
    const base = reduce(emptyStiffness(), { type: 'template', template: 'frame-l' });
    see(reduce(base, { type: 'remove', list: 'nodes', id: base.nodes[0].id }));
    see(reduce(base, { type: 'remove', list: 'members', id: base.members[0].id }));
    see(reduce(emptyStiffness(), { type: 'template', template: 'truss-two-bar' }));
    let full = base;
    while (full.nodes.length < 12) full = reduce(full, { type: 'add', list: 'nodes' });
    see(reduce(full, { type: 'add', list: 'nodes' }));
    // nothing to add: pairs, few-nodes, coincident, nodes, no-node, no-member, truss-mode
    let k5 = emptyStiffness();
    for (let k = 0; k < 4; k++) k5 = reduce(k5, { type: 'add', list: 'nodes' });
    for (let k = 0; k < 6; k++) k5 = reduce(k5, { type: 'add', list: 'members' });
    see(reduce(k5, { type: 'add', list: 'members' }));
    see(reduce(emptyStiffness(), { type: 'add', list: 'members' }));
    let co = reduce(emptyStiffness(), { type: 'add', list: 'nodes', seed: { x: 1, y: 1 } });
    co = reduce(co, { type: 'add', list: 'nodes', seed: { x: 1, y: 1 } });
    see(reduce(co, { type: 'add', list: 'members' }));
    let withSupports = base;
    for (let k = 0; k < 3; k++) withSupports = reduce(withSupports, { type: 'add', list: 'supports' });
    see(reduce(withSupports, { type: 'add', list: 'supports' }));
    see(reduce(emptyStiffness(), { type: 'add', list: 'loads' }));
    see(reduce(reduce(emptyStiffness('us', 'frame'), { type: 'add', list: 'nodes' }), { type: 'add', list: 'memberLoads' }));
    see(reduce(reduce(base, { type: 'mode', mode: 'truss' }), { type: 'add', list: 'memberLoads' }));
    expect([...notices].sort()).toEqual([...NOTICE_CODES].sort());
    expect([...whys].sort()).toEqual([...NOTHING_TO_ADD_WHY].sort());
  });
});

describe('what the library writes is notation, not words', () => {
  it('every formula, symbolic entry and factor uses only the alphabet of the contract, and no word', () => {
    const allowed = /^[A-Za-z0-9_^²³θσδΣ√·−+/=()[\]|;,←½ ]*$/;
    // (the symbols' own subscripts: u_local, f_global, P_nodal, P_equivalent — the same in both languages)
    const known = ['code', 'max', 'rhs', 'local', 'global', 'nodal', 'equivalent'];
    const texts = new Set<string>();
    const forms: StiffnessForm[] = [];
    for (const template of TEMPLATE_IDS) forms.push(reduce(emptyStiffness(), { type: 'template', template }));
    let p = reduce(emptyStiffness(), { type: 'template', template: 'frame-propped' });
    p = reduce(p, { type: 'add', list: 'memberLoads', seed: { kind: 'point' } });
    p = reduce(p, { type: 'add', list: 'memberLoads', seed: { kind: 'axial' } });
    forms.push(p);
    let m = reduce(emptyStiffness(), { type: 'template', template: 'truss-five-member' });
    m = reduce(m, { type: 'remove', list: 'members', id: m.members[1].id });
    const steps: Step[] = [...forms.flatMap((f) => analyseSafely(f).solution?.steps ?? []), ...analyseSafely(m).partial];
    for (const s of steps) {
      s.formulas.forEach((t) => texts.add(t));
      for (const b of s.blocks) {
        if (b.type === 'matrix') {
          b.symbolic?.forEach((row) => row.forEach((t) => texts.add(t)));
          if (b.factor) texts.add(b.factor);
        } else if (b.type === 'vector') b.symbolic?.forEach((t) => texts.add(t));
        else if (b.symbolic) texts.add(b.symbolic);
      }
    }
    expect(texts.size).toBeGreaterThan(60);
    for (const t of texts) {
      expect(allowed.test(t), `"${t}"`).toBe(true);
      let rest = t;
      for (const k of known) rest = rest.split(k).join(' ');
      expect(/[a-z]{4,}/.test(rest), `"${t}" has a word`).toBe(false);
    }
  });
  it('every machine code is lower case, with hyphens, or a symbol: no spaces, no sentences', () => {
    for (const c of [...ISSUE_CODES, ...WARNING_CODES, ...NOTICE_CODES, ...STEP_IDS, ...HIGHLIGHT_REASONS, ...CHECK_IDS, ...SUPPORT_SYMBOLS, ...MECHANISM_KINDS, ...NOTHING_TO_ADD_WHY]) expect(c).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });
});
