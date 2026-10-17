import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { spanPage } from '@/lib/calc/beam/span-page-strings';
import { spanUi } from '@/lib/calc/beam/span-strings';
import { beamStrings } from '@/lib/calc/beam/strings';
import { cablePage } from '@/lib/calc/cable/page-strings';
import { cableSagPage } from '@/lib/calc/cable-sag/page-strings';
import { continuousPage } from '@/lib/calc/continuous/page-strings';
import { continuousUi } from '@/lib/calc/continuous/strings';
import { analyseSafely } from '@/lib/calc/frame/analysis';
import { solveFrame } from '@/lib/calc/frame/engine';
import { FRAME_KEY, defaultFrame, toEngine } from '@/lib/calc/frame/model';
import { framePage } from '@/lib/calc/frame/page-strings';
import { MAX_MEMBERS, MAX_MEMBER_LOADS, MAX_NODAL_LOADS, MAX_NODES, MAX_SUPPORTS, type FrameModel, type FrameSolution } from '@/lib/calc/frame/types';
import { shaftPage } from '@/lib/calc/shaft/page-strings';
import { trussPage } from '@/lib/calc/truss/page-strings';
import { trussUi } from '@/lib/calc/truss/strings';
import { calculatorFamilies } from '@/lib/ttc/calculators';
import { openCalculatorPaths } from '@/lib/ttc/calculator-paths';
import type { Lang } from '@/lib/ttc/i18n';
import { DESCRIPTION_LIMIT_PX, TITLE_BUDGET_PX, descriptionPx, titlePx } from '@/lib/ttc/serp';

/**
 * The plane frame calculator's PAGE words (lib/calc/frame/page-strings.ts),
 * held to the engine and to the other calculators' pages. The tool's own
 * behaviour is tested where it lives (lib/calc/frame, calc/frame); this file
 * does not render the form, and reads the form's words (strings.ts) only in the
 * one test that compares them with the page's.
 */

const LANGS: Lang[] = ['en', 'es'];

/** The page's address; FrameView.tsx exports the same constant (read as text, so that this file does not need the form). */
const FRAME_PATH = '/resources/plane-frame-analysis';

function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}
const wordsOf = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
const runsOf = (t: string) => {
  const w = wordsOf(t);
  return w.length < 6 ? [] : Array.from({ length: w.length - 5 }, (_, i) => w.slice(i, i + 6).join(' '));
};
const sharedRuns = (ours: string[], theirs: string[]) => {
  const known = new Set(theirs.flatMap(runsOf));
  return [...new Set(ours.flatMap(runsOf).filter((run) => known.has(run)))];
};
const LEGAL = /^(disclaimer\.|sheet\.)/;

const near = (a: number, b: number, rel = 1e-9, abs = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(abs + rel * Math.abs(b));
const model = (o: Partial<FrameModel>): FrameModel => ({ nodes: [], members: [], supports: [], loads: [], memberLoads: [], E: 1000, A: 10, I: 100, ...o });
function solved(m: FrameModel): FrameSolution {
  const out = solveFrame(m);
  if (!out.ok) throw new Error(JSON.stringify(out.issues));
  return out;
}
const beam = (L: number, supports: FrameModel['supports'], extra: Partial<FrameModel> = {}): FrameModel =>
  model({ nodes: [{ x: 0, y: 0 }, { x: L, y: 0 }], members: [{ i: 0, j: 1 }], supports, ...extra });

describe('frame page: the cases it gives to check by hand', () => {
  it('a beam fixed at one end and on a roller: 3wL/8 at the roller, 5wL/8 and wL²/8 at the wall, 9wL²/128 at 3L/8 from the roller', () => {
    const L = 14;
    const w = 1.7;
    const s = solved(beam(L, [{ node: 0, kind: 'fixed' }, { node: 1, kind: 'roller' }], { memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -w }] }));
    near(s.reactions[1].ry, (3 * w * L) / 8);
    near(s.reactions[0].ry, (5 * w * L) / 8);
    near(s.members[0].start.M, -(w * L * L) / 8);
    near(s.members[0].maxima.M.max.value, (9 * w * L * L) / 128);
    near(s.members[0].maxima.M.max.x, L - (3 * L) / 8);
  });

  it('fixed at both ends: wL²/12 hogging at each end, wL²/24 sagging at mid-length', () => {
    const L = 9;
    const w = 2.3;
    const s = solved(beam(L, [{ node: 0, kind: 'fixed' }, { node: 1, kind: 'fixed' }], { memberLoads: [{ kind: 'udl', member: 0, dir: 'local-y', w: -w }] }));
    near(s.members[0].start.M, -(w * L * L) / 12);
    near(s.members[0].end.M, -(w * L * L) / 12);
    near(s.members[0].maxima.M.max.value, (w * L * L) / 24);
  });

  it('the fixed-end forces: PL/8 for a point load at mid-length, Pab²/L² and Pa²b/L² for one at a and b', () => {
    const L = 10;
    const P = 6;
    const fixed = [{ node: 0, kind: 'fixed' as const }, { node: 1, kind: 'fixed' as const }];
    const mid = solved(beam(L, fixed, { memberLoads: [{ kind: 'point', member: 0, dir: 'local-y', a: L / 2, P: -P }] }));
    near(mid.members[0].start.M, -(P * L) / 8);
    near(mid.members[0].end.M, -(P * L) / 8);
    const a = 3;
    const b = L - a;
    const off = solved(beam(L, fixed, { memberLoads: [{ kind: 'point', member: 0, dir: 'local-y', a, P: -P }] }));
    near(off.members[0].start.M, -(P * a * b * b) / (L * L));
    near(off.members[0].end.M, -(P * a * a * b) / (L * L));
  });

  it('a fixed-base portal with a stiff beam under a horizontal load H: each column takes H/2, Hh/4 at foot and top, vertical reactions Hh/(2L)', () => {
    const L = 24;
    const h = 12;
    const H = 8;
    const out = solved(
      model({
        nodes: [{ x: 0, y: 0 }, { x: L, y: 0 }, { x: 0, y: h }, { x: L, y: h }],
        members: [{ i: 0, j: 2 }, { i: 1, j: 3 }, { i: 2, j: 3, I: 1e9 * 100, A: 1e9 * 10 }],
        supports: [{ node: 0, kind: 'fixed' }, { node: 1, kind: 'fixed' }],
        loads: [{ node: 2, fx: H, fy: 0, m: 0 }],
        A: 1e9 * 10,
      }),
    );
    const tol = 1e-6;
    for (const k of [0, 1]) {
      near(Math.abs(out.members[k].start.V), H / 2, tol);
      near(Math.abs(out.members[k].start.M), (H * h) / 4, tol);
      near(Math.abs(out.members[k].end.M), (H * h) / 4, tol);
    }
    near(out.reactions[0].ry, -(H * h) / (2 * L), tol);
    near(out.reactions[1].ry, (H * h) / (2 * L), tol);
    near(out.reactions[0].rx + out.reactions[1].rx, -H, tol);
  });

  it('a settlement of Δ with no load: 6EIΔ/L² at each end and 12EIΔ/L³ of shear; and a restrained rise ΔT gives N = −EAαΔT and no bending', () => {
    const L = 10;
    const D = 0.05;
    const s = solved(beam(L, [{ node: 0, kind: 'fixed' }, { node: 1, kind: 'fixed', dy: -D }]));
    near(Math.abs(s.reactions[0].rm), (6 * 1000 * 100 * D) / (L * L));
    near(Math.abs(s.reactions[1].rm), (6 * 1000 * 100 * D) / (L * L));
    near(Math.abs(s.reactions[0].ry), (12 * 1000 * 100 * D) / L ** 3);
    const T = solved(beam(L, [{ node: 0, kind: 'fixed' }, { node: 1, kind: 'fixed' }], { memberLoads: [{ kind: 'temperature', member: 0, dT: 40, dTg: 0, alpha: 6.5e-6 }] }));
    near(T.members[0].start.N, -1000 * 10 * 6.5e-6 * 40);
    expect(Math.abs(T.members[0].maxima.M.max.value)).toBeLessThan(1e-9);
    expect(Math.abs(T.members[0].maxima.M.min.value)).toBeLessThan(1e-9);
  });

  it('a gradient: EIαΔTg/h sagging when the +ȳ face is warmer, held at both ends; a free member bows toward +ȳ', () => {
    const grad = (supports: FrameModel['supports']) => {
      const m = beam(10, supports, { memberLoads: [{ kind: 'temperature', member: 0, dT: 0, dTg: 25, alpha: 1e-5 }] });
      m.members[0].h = 0.8;
      return solved(m);
    };
    const held = grad([{ node: 0, kind: 'fixed' }, { node: 1, kind: 'fixed' }]);
    near(held.members[0].start.M, (1000 * 100 * 1e-5 * 25) / 0.8);
    const loose = grad([{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }]);
    const mid = loose.members[0].pieces.find((p) => p.x0 <= 5 && 5 <= p.x1)!;
    expect(mid.v).not.toBeNull();
    expect(mid.v![0] + mid.v![1] * (5 - mid.x0) + mid.v![2] * (5 - mid.x0) ** 2).toBeGreaterThan(0);
  });

  it('a three-hinged gable under w per horizontal length: thrust wL²/(8f) at each foot and wL/2 vertical', () => {
    const L = 30;
    const f = 6;
    const w = 1.4;
    const gable = (supports: FrameModel['supports'], memberLoads: FrameModel['memberLoads']) =>
      solved(
        model({
          nodes: [{ x: 0, y: 0 }, { x: L / 2, y: f }, { x: L, y: 0 }],
          members: [{ i: 0, j: 1, releases: { end: true } }, { i: 1, j: 2, releases: { start: true } }],
          supports,
          memberLoads,
        }),
      );
    const out = gable(
      [{ node: 0, kind: 'pin' }, { node: 2, kind: 'pin' }],
      [{ kind: 'udl-projected', member: 0, dir: 'global-y', w: -w }, { kind: 'udl-projected', member: 1, dir: 'global-y', w: -w }],
    );
    expect(out.determinacy.word).toBe('determinate');
    near(Math.abs(out.reactions[0].rx), (w * L * L) / (8 * f));
    near(out.reactions[0].rx + out.reactions[1].rx, 0, 1e-9, 1e-9);
    near(out.reactions[0].ry, (w * L) / 2);
    near(out.reactions[1].ry, (w * L) / 2);
    // A determinate frame moved by temperature or a settlement develops no force.
    const still = gable([{ node: 0, kind: 'pin' }, { node: 2, kind: 'pin', dx: 0.3, dy: -0.2 }], [{ kind: 'temperature', member: 0, dT: 30, dTg: 0, alpha: 1e-5 }]);
    for (const m of still.members) {
      expect(Math.abs(m.start.N)).toBeLessThan(1e-9);
      expect(Math.abs(m.start.V)).toBeLessThan(1e-9);
    }
  });
});

describe('frame page: what the notes say of the engine, the engine does', () => {
  it('the sign worked example: V +10, 0, −10 and M 0, +25, 0; drawn the other way round, M reads −25 at mid-length and V changes sign', () => {
    const w = [{ kind: 'udl' as const, member: 0, dir: 'global-y' as const, w: -2 }];
    const forward = solved(model({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }], members: [{ i: 0, j: 1 }], supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }], memberLoads: w }));
    near(forward.members[0].start.V, 10);
    near(forward.members[0].end.V, -10);
    near(forward.members[0].maxima.M.max.value, 25);
    near(forward.members[0].maxima.M.max.x, 5);
    near(forward.members[0].start.N, 0, 1e-9, 1e-9);
    const back = solved(model({ nodes: [{ x: 10, y: 0 }, { x: 0, y: 0 }], members: [{ i: 0, j: 1 }], supports: [{ node: 0, kind: 'roller' }, { node: 1, kind: 'pin' }], memberLoads: w }));
    near(back.members[0].maxima.M.min.value, -25);
    near(back.members[0].start.V, -10);
  });

  it('the example the page opens with: the solver’s 0.311 and 9.689 kip, the hand solution’s 0.2 and 9.8; with A very large it is the hand answer', () => {
    const { model: m } = toEngine(defaultFrame());
    const s = solved(m);
    near(s.reactions[0].rx, -0.311, 0, 5e-4);
    near(s.reactions[1].rx, -9.689, 0, 5e-4);
    expect(s.reactions[0].rx).not.toBeCloseTo(-0.2, 2);
    // The hand solution: members inextensible, columns and beam of one I.
    const stiff = solved({ ...m, A: m.A! * 1e6, members: m.members.map((x) => ({ ...x, A: undefined })) });
    near(stiff.reactions[0].rx, -0.2, 0, 5e-5);
    near(stiff.reactions[1].rx, -9.8, 0, 5e-5);
    near(stiff.reactions[0].ry, 10.125, 0, 5e-5);
    near(stiff.reactions[1].ry, 13.875, 0, 5e-5);
  });

  it('the degree of indeterminacy counted as written: 3 per member plus the reactions, less 3 per node, less 1 per hinge', () => {
    const { model: m } = toEngine(defaultFrame());
    const s = solved(m);
    expect(s.determinacy.degree).toBe(3 * 3 + 6 - 3 * 4);
    expect(s.determinacy.word).toBe('indeterminate');
    // A hinge takes one off.
    const hinged = solved({ ...m, members: m.members.map((x, k) => (k === 2 ? { ...x, releases: { start: true } } : x)) });
    expect(hinged.determinacy.degree).toBe(2);
    // …and a determinate frame without section properties gives forces and reactions, and no displacements.
    const bare = solved(beam(10, [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }], { E: undefined, A: undefined, I: undefined, memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -2 }] }));
    expect(bare.displacements).toBeNull();
    near(bare.members[0].maxima.M.max.value, 25);
    // …and an indeterminate one without them is refused.
    const refused = solveFrame({ ...m, E: undefined, A: undefined, I: undefined });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.issues.map((i) => i.code)).toContain('sections');
  });

  it('a roller at any angle is exact: the same frame on a roller at 45° satisfies equilibrium and the reaction lies along its line', () => {
    const s = solved(
      model({
        nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        members: [{ i: 0, j: 1 }],
        supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', angle: 45 }],
        memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -2 }],
      }),
    );
    const r = s.reactions[1];
    near(r.rx, r.ry, 1e-9, 1e-9);
    near(s.reactions[0].ry + r.ry, 20, 1e-9, 1e-9);
    near(s.reactions[0].rx + r.rx, 0, 1e-9, 1e-9);
  });

  it('a hinge at one end of a member fixed at the other and held in place at the first is the propped cantilever', () => {
    const w = -2;
    const L = 10;
    const hinge = solved(beam(L, [{ node: 0, kind: 'fixed' }, { node: 1, kind: 'pin' }], { members: [{ i: 0, j: 1, releases: { end: true } }], memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w }] }));
    near(hinge.reactions[1].ry, (3 * -w * L) / 8);
    near(hinge.members[0].end.M, 0, 1e-9, 1e-9);
    near(hinge.members[0].start.M, (w * L * L) / 8);
  });

  it('a mechanism is refused and the nodes are named: a pinned-base portal with a hinge at the top of both columns', () => {
    const out = analyseSafely({
      ...defaultFrame(),
      supports: defaultFrame().supports.map((s) => ({ ...s, kind: 'pin' as const })),
      members: defaultFrame().members.map((m, k) => (k < 2 ? { ...m, hingeEnd: true } : { ...m, hingeStart: true, hingeEnd: true })),
    });
    expect(out.results).toBeNull();
    const mech = out.issues.find((i) => i.code === 'mechanism');
    expect(mech).toBeDefined();
    expect((mech as { nodes?: number[] }).nodes?.length).toBeGreaterThan(0);
  });

  it('a frame its supports cannot hold is refused: fewer than 3 reaction components, or 3 parallel or concurrent', () => {
    const base = { nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }], members: [{ i: 0, j: 1 }] };
    const codes = (supports: FrameModel['supports']) => {
      const out = solveFrame(model({ ...base, supports }));
      return out.ok ? [] : out.issues.map((i) => i.code);
    };
    expect(codes([{ node: 0, kind: 'pin' }])).toContain('few-supports');
    // Two parallel vertical rollers and a third parallel to them.
    expect(codes([{ node: 0, kind: 'roller', angle: 90 }, { node: 1, kind: 'roller', angle: 90 }])).toContain('few-supports');
    const three = model({ nodes: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }], members: [{ i: 0, j: 1 }, { i: 1, j: 2 }], supports: [{ node: 0, kind: 'roller', angle: 90 }, { node: 1, kind: 'roller', angle: 90 }, { node: 2, kind: 'roller', angle: 90 }] });
    const parallel = solveFrame(three);
    expect(parallel.ok).toBe(false);
    if (!parallel.ok) expect(parallel.issues.map((i) => i.code)).toContain('unrestrained');
  });

  it('a member shorter than a hundred-thousandth of the frame is refused as too short; a longer stub is not', () => {
    const stub = (len: number) => ({ ...beam(100, [{ node: 0, kind: 'fixed' }, { node: 1, kind: 'fixed' }, { node: 2, kind: 'fixed' }]), nodes: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100 + len, y: 0 }], members: [{ i: 0, j: 1 }, { i: 1, j: 2 }] });
    const short = solveFrame(stub(0.0005));
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.issues.map((i) => i.code)).toContain('short-member');
    const longer = solveFrame(stub(0.002));
    if (!longer.ok) expect(longer.issues.map((i) => i.code)).not.toContain('short-member');
  });

  it('two nodes in one place, a node with no member, a load outside its member and a gradient with no depth are each refused', () => {
    const codes = (m: FrameModel) => {
      const out = solveFrame(m);
      return out.ok ? [] : out.issues.map((i) => i.code);
    };
    const sup = [{ node: 0, kind: 'fixed' as const }];
    expect(codes(model({ nodes: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }], members: [{ i: 0, j: 2 }, { i: 1, j: 2 }], supports: sup }))).toContain('duplicate-node');
    expect(codes(model({ nodes: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 9, y: 9 }], members: [{ i: 0, j: 1 }], supports: sup }))).toContain('node-unconnected');
    expect(codes(beam(10, sup, { memberLoads: [{ kind: 'point', member: 0, dir: 'local-y', a: 11, P: -1 }] }))).toContain('load-position');
    expect(codes(beam(10, sup, { memberLoads: [{ kind: 'temperature', member: 0, dT: 0, dTg: 5, alpha: 1e-5 }] }))).toContain('depth');
    expect(codes(model({ nodes: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 9, y: 9 }, { x: 14, y: 9 }], members: [{ i: 0, j: 1 }, { i: 2, j: 3 }], supports: [{ node: 0, kind: 'fixed' }, { node: 2, kind: 'fixed' }] }))).toContain('disconnected');
    expect(codes(model({ nodes: [{ x: 0, y: 0 }, { x: 5, y: 0 }], members: [{ i: 0, j: 1, releases: { start: true, end: true } }], supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'pin' }], loads: [{ node: 1, fx: 0, fy: 0, m: 5 }] }))).toContain('hinged-joint-moment');
  });

  it('the limits it states are the engine’s', () => {
    expect([MAX_NODES, MAX_MEMBERS, MAX_SUPPORTS, MAX_NODAL_LOADS, MAX_MEMBER_LOADS]).toEqual([50, 100, 40, 60, 120]);
    for (const [lang, re] of [
      ['en', /^Up to 50 nodes, 100 members, 40 supports, 60 nodal loads and 120 member loads\.$/],
      ['es', /^Hasta 50 nudos, 100 barras, 40 apoyos, 60 cargas nodales y 120 cargas en barras\.$/],
    ] as const) {
      expect(framePage[lang].limits.items.filter((x) => re.test(x))).toHaveLength(1);
    }
    expect(framePage.en.sub).toContain(`up to ${MAX_NODES} nodes`);
    expect(framePage.es.sub).toContain(`hasta ${MAX_NODES} nudos`);
  });

  it('the address is written after the key the form uses', () => {
    expect(FRAME_KEY).toBe('f');
    for (const lang of LANGS) expect(JSON.stringify(framePage[lang].signs)).toContain(`#${FRAME_KEY}=`);
  });
});

describe('frame page: the words', () => {
  const en = leaves(framePage.en);
  const es = leaves(framePage.es);
  const OTHERS = (lang: Lang) => [beamStrings[lang].page, spanPage[lang], continuousPage[lang], shaftPage[lang], trussPage[lang], cablePage[lang], cableSagPage[lang]];

  it('says the same things in both languages, and leaves nothing blank', () => {
    expect(es.map(([p]) => p)).toEqual(en.map(([p]) => p));
    for (const [path, s] of [...en, ...es]) expect(s.trim().length, path).toBeGreaterThan(0);
    const parts = (page: unknown) => leaves(page).map(([p]) => p.replace(/\[\d+\]/g, '[]'));
    expect([...new Set(parts(framePage.en))]).toEqual([...new Set(parts(beamStrings.en.page))]);
  });

  it('the Spanish is Spanish: no sentence is the English one left in place, no grouping comma, “usted”', () => {
    const same = en.filter(([, s], i) => s === es[i][1] && s.split(/\s+/).length > 3).map(([path]) => path);
    expect(same).toEqual([]);
    for (const [path, s] of es) {
      expect(s, path).not.toMatch(/\d,\d{3}(?!\d)/);
      expect(s, path).not.toMatch(/\b(introduces|escribes|eliges|incluyes|pides|puedes|tienes|quieres|tu|tus|ti|te)\b/);
      // The true minus in a sentence, never a hyphen before a figure.
      expect(s, path).not.toMatch(/(^|\s)-\d/);
    }
    for (const [path, s] of en) expect(s, path).not.toMatch(/(^|\s)-\d/);
    // The Spanish says the words an engineer there says.
    const all = JSON.stringify(framePage.es);
    for (const re of [/pórtico/, /nudo/, /barra/, /empotramiento/, /rótula/, /momento flector/, /fuerza cortante/, /fuerza axial/, /deformada/, /luz/, /isostático/, /hiperestático/]) expect(all).toMatch(re);
    expect(all).not.toMatch(/\bmarco\b|\bjuntas?\b|\bmiembros?\b|\bviga-columna\b/);
    // The formulas are the same in both: a case's symbols are not translated.
    const formulas = (s: string) =>
      s.match(/12EI\/L³|6EI\/L²|4EI\/L|2EI\/L|EA\/L|wL²\/12|wL²\/24|wL²\/8|wL²\/\(8f\)|PL\/8|Pab²\/L²|Pa²b\/L²|3wL\/8|5wL\/8|9wL²\/128|3L\/8|Hh\/\(2L\)|Hh\/4|H\/2|6EIΔ\/L²|12EIΔ\/L³|N = −EAαΔT|EIαΔTg\/h|wL\/2|M\/EI/g) ?? [];
    en.forEach(([path, s], i) => expect(formulas(es[i][1]), path).toEqual(formulas(s)));
    expect(en.flatMap(([, s]) => formulas(s)).length).toBeGreaterThanOrEqual(25);
  });

  it('names no other company’s product, no price, no date, no standard, no verdict, not the word “free”', () => {
    for (const [path, s] of [...en, ...es]) {
      expect(s, path).not.toMatch(/skyciv|ftool|sap2000|etabs|robot|risa|staad|autodesk|enercalc|clearcalcs|midas|ansys|dlubal|tekla/i);
      expect(s, path).not.toMatch(/\bfree\b|\bgratis\b|\bgratuit|\$|\bprice\b|\bprecio\b|\b20\d\d\b/i);
      expect(s, path).not.toMatch(/Civil\s*&\s*Structural/i);
      expect(s, path).not.toMatch(/\b(ACI|AISC|ASCE|ASME|ANSI|ISO|DIN|IBC|Eurocode|Eurocódigo|LRFD|ASD|NDS|AWS|ASTM|NSR|NTC)\b/);
      if (LEGAL.test(path)) continue;
      expect(s, path).not.toMatch(/\b(ok|okay|pass|passes|passed|fail|fails|failed|adequate|inadequate|sufficient|insufficient|enough|acceptable|complies|satisf\w*|safe|safely|unsafe|allowable|permissible|recommended|verified|reliable|rely|relied)\b/i);
      expect(s, path).not.toMatch(/\b(cumple|cumplen|no cumple|falla|fallan|aprobad\w*|suficiente|insuficiente|adecuad\w*|inadecuad\w*|aceptable|basta|segur[oa]|satisf\w*|verifica|admisible|permisible|recomendad\w*|confiable)\b/i);
    }
  });

  it('writes no figure but those of its formulas, its limits, its example and its 90 degrees', () => {
    const written = (lang: Lang) =>
      leaves(framePage[lang])
        .filter(([path]) => !LEGAL.test(path))
        .map(([, s]) => s)
        .join(' ');
    // 0, 1, 2, 3, 4, 5, 6, 8, 9, 12, 24, 128 and 90 are in formulas, counts and the 90° of the axes; 50, 100, 40, 60 and 120 are the limits;
    // 10 and 25 (the worked example, held to the engine above), 0.311, 9.689, 0.2 and 9.8 (the opening example, held above), 10⁷ the area that
    // gives the hand answer (above), 2 the kip/ft of the worked example.
    const expected = ['0', '0.2', '0.311', '1', '10', '100', '12', '120', '128', '2', '24', '25', '3', '4', '40', '5', '50', '6', '60', '8', '9', '9.689', '9.8', '90'].sort();
    for (const lang of LANGS) {
      const numbers = written(lang).match(/\d+(\.\d+)?/g) ?? [];
      expect([...new Set(numbers)].sort()).toEqual(expected);
    }
  });

  it('a frame page says frame: it does not speak of beams as its subject, and the catalogue’s other name is read from the catalogue', () => {
    expect(en.filter(([, s]) => /\bframes?\b/i.test(s)).length).toBeGreaterThan(15);
    expect(es.filter(([, s]) => /\bpórticos?\b/i.test(s)).length).toBeGreaterThan(15);
    const truss = calculatorFamilies.flatMap((f) => f.items).find((i) => i.name.en === 'Truss member forces')!;
    expect(truss).toBeDefined();
    expect(JSON.stringify(framePage.en.assumes)).toContain(truss.name.en);
    expect(JSON.stringify(framePage.es.assumes)).toContain(truss.name.es);
    // The search words are in the title and the description, each in its own language.
    for (const re of [/frame/i, /moment/i, /shear/i, /axial/i]) expect(framePage.en.title + framePage.en.description).toMatch(re);
    for (const re of [/pórticos/i, /momento/i, /cortante/i, /axial/i]) expect(framePage.es.title + framePage.es.description).toMatch(re);
    for (const re of [/direct stiffness/, /reactions/, /hinges/, /temperature/, /settle/]) expect(framePage.en.description).toMatch(re);
    for (const re of [/rigidez directa/, /reacciones/, /rótulas/, /temperatura/, /asentamientos/]) expect(framePage.es.description).toMatch(re);
  });

  it('says what it leaves out, each by name: buckling and P–Δ, shear deformation, prismatic members, inextensible hand solutions, self-weight, factors, semi-rigid joints, mechanisms, ill-conditioning', () => {
    const assumes = (lang: Lang) => framePage[lang].assumes.items;
    const limits = (lang: Lang) => framePage[lang].limits.items;
    const NOT: [(l: Lang) => string[], RegExp, RegExp][] = [
      [assumes, /no P–Δ effect and no buckling load/, /no hay efecto P–Δ ni carga de pandeo/],
      [assumes, /shear deformation is not included/, /se desprecia la distorsión causada por el cortante/],
      [assumes, /straight and prismatic/, /rectas y prismáticas/],
      [assumes, /treats members as inextensible/, /trata las barras como inextensibles/],
      [assumes, /self-weight is not added/, /peso propio de una barra no se añade/],
      [assumes, /Nothing is multiplied by a factor and no combination is formed/, /Nada se multiplica por un factor ni se forma combinación alguna/],
      [assumes, /semi-rigid connection, a panel zone/, /conexión semirrígida, una zona de panel/],
      [assumes, /typical values for a first estimate/, /valores típicos para una primera estimación/],
      [limits, /^The results are forces, moments, reactions and displacements, and nothing beyond them/, /^Los resultados son fuerzas, momentos, reacciones y desplazamientos, y nada más allá de ellos/],
      [limits, /^A mechanism is refused/, /^Un mecanismo se rechaza/],
      [limits, /refused as ill-conditioned/, /se rechaza por mal condicionado/],
      [limits, /refused as too short/, /se rechaza por demasiado corta/],
    ];
    for (const [list, inEnglish, inSpanish] of NOT) {
      expect(list('en').filter((x) => inEnglish.test(x)), String(inEnglish)).toHaveLength(1);
      expect(list('es').filter((x) => inSpanish.test(x)), String(inSpanish)).toHaveLength(1);
    }
    expect(limits('en')).toHaveLength(limits('es').length);
    expect(assumes('en')).toHaveLength(assumes('es').length);
  });

  it('the legal words are the first calculator’s own, and the credit names this calculator', () => {
    for (const lang of LANGS) {
      const ours = framePage[lang];
      const first = beamStrings[lang].page;
      expect(ours.disclaimer).toBe(first.disclaimer);
      expect(ours.sheet.kind).toBe(first.sheet.kind);
      expect(ours.sheet.margin).toBe(first.sheet.margin);
      for (const key of ['{firm}', '{address}']) expect(ours.sheet.credit, `${lang} ${key}`).toContain(key);
      for (const other of OTHERS(lang)) expect(ours.sheet.credit).not.toBe(other.sheet.credit);
      expect(ours.sheet.credit).toMatch(lang === 'en' ? /plane frame calculator/ : /calculadora de pórticos planos/);
    }
  });

  it('no sentence of the other calculators’ pages, nor a line of the catalogue, is said again here, beyond the legal words', () => {
    const rows = calculatorFamilies.flatMap((f) => f.items);
    for (const lang of LANGS) {
      const ours = leaves(framePage[lang]).filter(([path]) => !LEGAL.test(path));
      const theirs = [...OTHERS(lang).flatMap((page) => leaves(page)), ...leaves(beamStrings[lang].ui), ...leaves(spanUi[lang]), ...leaves(continuousUi[lang]), ...leaves(trussUi[lang])].map(([, s]) => s);
      for (const [path, s] of ours) {
        expect(sharedRuns([s], theirs), `${lang} ${path}`).toEqual([]);
        expect(sharedRuns([s], rows.map((r) => r.does[lang])), `${lang} ${path}`).toEqual([]);
      }
      expect(sharedRuns([framePage[lang].disclaimer.body], theirs).length).toBeGreaterThan(20);
    }
  });

  it('no sentence the form already says is said again here (the signs and the facts may agree word for word)', async () => {
    const { frameUi } = await import('@/lib/calc/frame/strings');
    for (const lang of LANGS) {
      const form = leaves(frameUi[lang]).map(([, s]) => s);
      for (const [path, s] of leaves(framePage[lang]).filter(([p]) => !LEGAL.test(p))) {
        if (/^(signs|facts)/.test(path)) continue;
        expect(sharedRuns([s], form), `${lang} ${path} (form)`).toEqual([]);
      }
    }
  });

  it('the view declares the same address', () => {
    expect(readFileSync(join(__dirname, 'FrameView.tsx'), 'utf8')).toContain(`FRAME_PATH = '${FRAME_PATH}'`);
  });

  it('the h1 begins with the catalogue’s name for the row, which links here', () => {
    const row = calculatorFamilies.flatMap((f) => f.items).find((i) => i.href === FRAME_PATH)!;
    expect(row).toBeDefined();
    expect(openCalculatorPaths).toContain(FRAME_PATH);
    for (const lang of LANGS) expect(framePage[lang].h1.startsWith(row.name[lang]), lang).toBe(true);
    expect(row.name).toEqual({ en: 'Plane frame analysis', es: 'Análisis de pórticos planos' });
  });

  it('a search result fits: the title and the description are within their pixel budgets', () => {
    for (const lang of LANGS) {
      expect(titlePx(framePage[lang].title), lang).toBeLessThanOrEqual(TITLE_BUDGET_PX);
      expect(descriptionPx(framePage[lang].description), lang).toBeLessThanOrEqual(DESCRIPTION_LIMIT_PX);
    }
  });
});

describe('frame page: the claims of the review of 2026-10-17, each solved with the engine', () => {
  it('A2: the gable thrust is wL²/(8f) with f the crown above the FEET: the template has an eave and a ridge rise, and f is their sum', () => {
    const L = 40;
    const eave = 15;
    const rise = 8;
    const w = 0.8;
    const out = solved(
      model({
        nodes: [{ x: 0, y: 0 }, { x: L, y: 0 }, { x: 0, y: eave }, { x: L, y: eave }, { x: L / 2, y: eave + rise }],
        members: [{ i: 0, j: 2 }, { i: 1, j: 3 }, { i: 2, j: 4, releases: { end: true } }, { i: 4, j: 3, releases: { start: true } }],
        supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'pin' }],
        memberLoads: [{ kind: 'udl-projected', member: 2, dir: 'global-y', w: -w }, { kind: 'udl-projected', member: 3, dir: 'global-y', w: -w }],
      }),
    );
    near(Math.abs(out.reactions[0].rx), (w * L * L) / (8 * (eave + rise)));
    // With f read as the rise above the eaves the formula would give 20 kip: the copy must not say that.
    expect(Math.abs(Math.abs(out.reactions[0].rx) - (w * L * L) / (8 * rise))).toBeGreaterThan(5);
    for (const lang of LANGS) {
      const text = framePage[lang].method.paragraphs.join(' ');
      expect(text).toMatch(lang === 'en' ? /the crown a height f above the feet/ : /cumbrera a una altura f sobre los pies/);
      expect(text).not.toMatch(lang === 'en' ? /each foot pushes inward/ : /flecha f/);
    }
  });

  it('A3: defined from its other end a member keeps V at each place (the end columns swap) and M changes sign', () => {
    const load = (dir: 1 | -1): FrameModel =>
      model({
        nodes: dir === 1 ? [{ x: 0, y: 0 }, { x: 10, y: 0 }] : [{ x: 10, y: 0 }, { x: 0, y: 0 }],
        members: [{ i: 0, j: 1 }],
        supports: dir === 1 ? [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }] : [{ node: 1, kind: 'pin' }, { node: 0, kind: 'roller' }],
        memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -2 }],
      });
    const fwd = solved(load(1)).members[0];
    const rev = solved(load(-1)).members[0];
    near(fwd.start.V, 10);
    near(fwd.end.V, -10);
    near(rev.start.V, -10);
    near(rev.end.V, 10);
    const mid = (m: typeof fwd) => m.pieces[0] && m.maxima.M;
    near(mid(fwd).max.value, 25);
    near(mid(rev).min.value, -25);
    for (const lang of LANGS) {
      const text = framePage[lang].signs.items.join(' ');
      expect(text).not.toMatch(lang === 'en' ? /V changes sign/ : /V cambia de signo/);
    }
  });

  it('A4: the Spanish page says the moment diagram is drawn on the tension side whichever way the member was drawn', () => {
    expect(framePage.es.signs.items.join(' ')).toMatch(/sea cual sea el sentido en que se dibujó la barra/);
    expect(framePage.en.signs.items.join(' ')).toMatch(/whichever way the member was drawn/);
  });

  it('A16: a couple on a member exactly at a hinged end stays with the member: the moment at the hinge is the couple', () => {
    const out = solved(
      beam(10, [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }], {
        members: [{ i: 0, j: 1, releases: { start: true } }],
        memberLoads: [{ kind: 'moment', member: 0, a: 0, M: 12 }],
      }),
    );
    expect(Math.abs(out.members[0].start.M)).toBeCloseTo(12, 9);
    expect(framePage.en.limits.items.join(' ')).toMatch(/moment at the hinge is the couple and not zero/);
  });
});
