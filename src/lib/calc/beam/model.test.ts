import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LAYOUTS,
  MATERIALS,
  MAX_ROWS,
  US_TO_SI,
  analyse,
  bendingStress,
  convertUnits,
  decodeBeam,
  defaultBeam,
  encodeBeam,
  layoutSupports,
  reduceBeam,
  sectionProps,
  shearStress,
  stiffness,
  toEngine,
  type BeamForm,
  type SteelShape,
} from './model';
import { solveBeam } from './solver';

/**
 * BETWEEN THE FORM AND THE ENGINE: units, the section, and the address.
 *
 * The engine is checked against the tables in solver.test.ts, in whatever
 * consistent units. What can still go wrong is here: a factor of 12 or of
 * 1,000 between the span and the section, a stress in the wrong unit, a beam
 * that is not the same beam after the units are switched, a link that opens
 * another beam.
 */

const shapes: SteelShape[] = JSON.parse(readFileSync(join(resolve(__dirname, '..', '..'), 'steel', 'aisc-shapes.json'), 'utf8')).shapes;
const shape = (name: string) => shapes.find((s) => s.designation === name)!;
const near = (got: number, want: number, tol = 1e-9) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(want)));

/** A 20 ft simple span, 1.2 kip/ft, with a W18×50's properties typed in. */
const simple = (): BeamForm => ({ ...defaultBeam(), points: [] });

describe('beam form: a worked example, by hand', () => {
  // w = 1.2 kip/ft = 0.1 kip/in, L = 240 in, E = 29,000 ksi, I = 800 in⁴, S = 88.9 in³.
  const a = analyse(simple());
  const s = a.solution!;

  it('reactions and moment in kips and feet', () => {
    near(s.reactions[0].Rv, 12);
    near(s.extremes.Mmax.value, 60);
  });

  it('deflection in inches: 5wL⁴/384EI', () => {
    const inches = (5 * 0.1 * 240 ** 4) / (384 * 29000 * 800);
    near(s.extremes.EIvMin.value * a.toDeflection, -inches);
    near(inches, 0.18621, 1e-4);
    // …and as a fraction of the span.
    expect(a.spans).toHaveLength(1);
    near(a.spans[0].ratio!, 240 / inches);
  });

  it('end slope in radians: wL³/24EI', () => {
    near(s.at(0).EItheta * a.toSlope, -(0.1 * 240 ** 3) / (24 * 29000 * 800));
  });

  it('bending stress in ksi: M/S, and shear stress V over the area given', () => {
    near(bendingStress('us', a.section, s.extremes.Mmax.value)!, (60 * 12) / 88.9);
    near(shearStress('us', a.section, s.extremes.Vmax.value)!, 12 / 6.39);
  });

  it('the same beam in metres and kilonewtons gives the same beam', () => {
    const si = convertUnits(simple(), 'si');
    expect(si.units).toBe('si');
    near(si.L, 6.096);
    near(si.dists[0].w1, 1.2 * US_TO_SI.line, 1e-3);
    expect(si.section.E).toBe(200000);
    const b = analyse(si);
    const t = b.solution!;
    // Rounded to four figures on the way, so a part in a thousand.
    near(t.reactions[0].Rv, 12 * US_TO_SI.force, 1e-3);
    near(t.extremes.Mmax.value, 60 * US_TO_SI.moment, 1e-3);
    // 29,000 ksi is 199,948 MPa; the listed 200,000 is 0.03 % stiffer.
    near(t.extremes.EIvMin.value * b.toDeflection, -0.18621 * 25.4, 2e-3);
    near(bendingStress('si', b.section, t.extremes.Mmax.value)!, ((60 * 12) / 88.9) * US_TO_SI.E, 2e-3);
    near(shearStress('si', b.section, t.extremes.Vmax.value)!, (12 / 6.39) * US_TO_SI.E, 2e-3);
    near(b.spans[0].ratio!, a.spans[0].ratio!, 2e-3);
  });

  // Looking at a beam in the other system and coming back must not change it.
  it('and back again, to the very same numbers', () => {
    expect(convertUnits(convertUnits(defaultBeam(), 'si'), 'us')).toEqual(defaultBeam());
    expect(convertUnits(defaultBeam(), 'us')).toEqual(defaultBeam());
    const odd: BeamForm = {
      ...defaultBeam(),
      L: 37.25,
      supports: [{ id: 1, kind: 'fixed', x: 0 }, { id: 2, kind: 'roller', x: 28.5 }],
      points: [{ id: 3, x: 33.125, P: 12.75, dir: 'up' }],
      dists: [{ id: 4, x1: 2.5, x2: 28.5, w1: 0.85, w2: 2.4, dir: 'down' }],
      couples: [{ id: 5, x: 14, M: 62.5, dir: 'cw' }],
      section: { ...defaultBeam().section, I: 1830, S: 154, Av: 9.48, b: 5.125, h: 13.5 },
    };
    expect(convertUnits(convertUnits(odd, 'si'), 'us')).toEqual(odd);
    const metric = convertUnits(odd, 'si');
    expect(convertUnits(convertUnits(metric, 'us'), 'si')).toEqual(metric);
  });
});

describe('beam form: the conversion factors are the definitions', () => {
  it('a foot, a kip, an inch', () => {
    expect(US_TO_SI.length).toBe(0.3048);
    near(US_TO_SI.force, 4.4482216152605);
    near(US_TO_SI.line, 14.5939029372, 1e-9);
    near(US_TO_SI.moment, 1.3558179483, 1e-9);
    near(US_TO_SI.E, 6.894757293, 1e-9);
    near(US_TO_SI.I, 0.416231426, 1e-8);
    near(US_TO_SI.S, 16.387064);
    near(US_TO_SI.A, 645.16);
  });

  it('stiffness: E·I per foot squared, or per metre squared', () => {
    const p = sectionProps(simple());
    near(stiffness('us', p), (29000 * 800) / 144);
    const si = sectionProps(convertUnits(simple(), 'si'));
    // 200,000 MPa × 333.0 × 10⁶ mm⁴ = 6.66 × 10¹³ N·mm² = 66,600 kN·m².
    near(stiffness('si', si), 200000 * si.I * 1e-3);
    near(stiffness('si', { ...si, E: 200000, I: 333 }), 66600);
  });

  it('the listed moduli are the ones their codes give', () => {
    expect(MATERIALS.steel).toEqual({ us: 29000, si: 200000 });
    expect(MATERIALS.aluminum.us).toBe(10100);
    // 57,000 √4000 psi.
    near(MATERIALS.concrete.us, (57000 * Math.sqrt(4000)) / 1000, 1e-4);
    // 4,700 √28 MPa.
    near(MATERIALS.concrete.si, 4700 * Math.sqrt(28), 1e-4);
    expect(MATERIALS.wood.us).toBe(1600);
  });
});

describe('beam form: the section', () => {
  it('a rectangle: bh³/12, bh²/6, and shear at 1.5 times the average', () => {
    const form: BeamForm = { ...simple(), section: { ...simple().section, mode: 'rect', material: 'wood', E: 1600, b: 3.5, h: 11.25 } };
    const p = sectionProps(form);
    near(p.I, (3.5 * 11.25 ** 3) / 12);
    near(p.S, (3.5 * 11.25 ** 2) / 6);
    near(shearStress('us', p, 2)!, (1.5 * 2) / (3.5 * 11.25));
    expect(p.shearRule).toBe('rect');
    // The same piece of wood in millimetres.
    const mm = sectionProps(convertUnits(form, 'si'));
    near(mm.I, ((3.5 * 11.25 ** 3) / 12) * US_TO_SI.I, 2e-3);
    near(mm.S, ((3.5 * 11.25 ** 2) / 6) * US_TO_SI.S, 2e-3);
    near(shearStress('si', mm, 2 * US_TO_SI.force)!, ((1.5 * 2) / (3.5 * 11.25)) * US_TO_SI.E, 2e-3);
  });

  it('a rolled shape: its own I and S, steel’s modulus, and the shear area of its family', () => {
    const base = simple();
    const withShape = (name: string, selfWeight = false): BeamForm => ({ ...base, section: { ...base.section, mode: 'shape', shape: name, selfWeight } });
    const w = sectionProps(withShape('W18X50'), shape('W18X50'));
    expect([w.E, w.I, w.S]).toEqual([29000, 800, 88.9]);
    near(w.Av, 18 * 0.355);
    expect(w.shearRule).toBe('web');
    const hss = shape('HSS6X4X3/8');
    const r = sectionProps(withShape(hss.designation), hss);
    near(r.Av, 2 * (6 - 3 * 0.349) * 0.349);
    expect(r.shearRule).toBe('hss');
    const pipe = shape('Pipe5XS');
    near(sectionProps(withShape(pipe.designation), pipe).Av, 5.73 / 2);
    // Not loaded yet: nothing is reported rather than something wrong.
    const none = sectionProps(withShape('W18X50'), null);
    expect([none.I, none.S, none.Av]).toEqual([0, 0, 0]);
    expect(analyse(withShape('W18X50'), null).toDeflection).toBe(0);
  });

  it('a rolled shape’s own weight is a uniform load over the whole beam, when asked for', () => {
    const base = simple();
    const form: BeamForm = { ...base, dists: [], section: { ...base.section, mode: 'shape', shape: 'W18X50', selfWeight: true } };
    const a = analyse(form, shape('W18X50'));
    // 50 lb/ft over 20 ft.
    near(a.solution!.totalLoad, 1);
    near(a.solution!.extremes.Mmax.value, (0.05 * 20 * 20) / 8);
    expect(analyse({ ...form, section: { ...form.section, selfWeight: false } }, shape('W18X50')).solution!.totalLoad).toBe(0);
    // In SI: 50 lb/ft is 0.7297 kN/m.
    const si = analyse(convertUnits(form, 'si'), shape('W18X50'));
    near(si.solution!.totalLoad, 1 * US_TO_SI.force, 1e-9);
    near(si.section.I, 800 * US_TO_SI.I);
  });

  it('with no I there is no deflection, with no S no stress — and the diagrams are still there', () => {
    const base = simple();
    const a = analyse({ ...base, section: { ...base.section, I: 0, S: 0, Av: 0 } });
    expect(a.solution).not.toBeNull();
    expect(a.issues).toEqual([]);
    expect(a.toDeflection).toBe(0);
    expect(a.spans[0].ratio).toBeNull();
    expect(bendingStress('us', a.section, 60)).toBeNull();
    expect(shearStress('us', a.section, 12)).toBeNull();
  });

  it('a negative or meaningless section value is named, not computed with', () => {
    const base = simple();
    for (const section of [{ ...base.section, E: -1 }, { ...base.section, I: Number.NaN }, { ...base.section, mode: 'rect' as const, h: -2 }]) {
      expect(analyse({ ...base, section }).issues).toEqual([{ code: 'section' }]);
    }
  });
});

describe('beam form: what the engine is given', () => {
  it('directions become signs', () => {
    const form: BeamForm = {
      ...defaultBeam(),
      points: [
        { id: 10, x: 5, P: 3, dir: 'down' },
        { id: 11, x: 6, P: 3, dir: 'up' },
      ],
      dists: [{ id: 12, x1: 0, x2: 10, w1: 1, w2: 2, dir: 'up' }],
      couples: [
        { id: 13, x: 4, M: 7, dir: 'ccw' },
        { id: 14, x: 8, M: 7, dir: 'cw' },
      ],
    };
    const m = toEngine(form, sectionProps(form));
    expect(m.points).toEqual([{ x: 5, P: 3 }, { x: 6, P: -3 }]);
    expect(m.dists).toEqual([{ x1: 0, x2: 10, w1: -1, w2: -2 }]);
    expect(m.couples).toEqual([{ x: 4, M: 7 }, { x: 8, M: -7 }]);
  });

  it('an entry the engine refuses is named by its row', () => {
    const form: BeamForm = { ...defaultBeam(), points: [{ id: 41, x: 3, P: 1, dir: 'down' }, { id: 42, x: 25, P: 1, dir: 'down' }], hinges: [{ id: 43, x: 0 }] };
    const a = analyse(form);
    expect(a.solution).toBeNull();
    // In the engine's order: hinges are read before loads.
    expect(a.issues).toEqual([
      { code: 'hinge-at-end', row: { list: 'hinges', id: 43 } },
      { code: 'outside', row: { list: 'points', id: 42 } },
    ]);
    expect(analyse({ ...defaultBeam(), supports: [] }).issues).toEqual([{ code: 'no-supports', row: undefined }]);
    expect(analyse({ ...defaultBeam(), supports: [{ id: 1, kind: 'pin', x: 0 }] }).issues).toEqual([{ code: 'unstable', row: undefined }]);
  });

  it('every support layout holds a loaded beam', () => {
    for (const layout of LAYOUTS) {
      const supports = layoutSupports(layout, 30);
      const out = solveBeam({ L: 30, supports, dists: [{ x1: 0, x2: 30, w1: 1, w2: 1 }] });
      expect(out.ok, layout).toBe(true);
      for (const s of supports) {
        expect(s.x, layout).toBeGreaterThanOrEqual(0);
        expect(s.x, layout).toBeLessThanOrEqual(30);
      }
    }
    expect(layoutSupports('three-span', 30).map((s) => s.x)).toEqual([0, 10, 20, 30]);
  });

  it('each span gets its own deflection ratio; an overhang is measured against twice its length', () => {
    const form: BeamForm = { ...simple(), L: 26, supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 20 }], dists: [{ id: 4, x1: 0, x2: 26, w1: 1.2, w2: 1.2, dir: 'down' }] };
    const a = analyse(form);
    expect(a.spans.map((p) => p.kind)).toEqual(['span', 'cantilever']);
    near(a.spans[0].ratio!, (20 * 12) / Math.abs(a.spans[0].deflection));
    near(a.spans[1].ratio!, (2 * 6 * 12) / Math.abs(a.spans[1].deflection));
  });
});

describe('beam form: a beam in an address', () => {
  const full: BeamForm = {
    units: 'si',
    L: 12.5,
    supports: [
      { id: 1, kind: 'fixed', x: 0 },
      { id: 2, kind: 'roller', x: 8 },
      { id: 3, kind: 'pin', x: 12.5 },
    ],
    hinges: [{ id: 4, x: 5.25 }],
    points: [
      { id: 5, x: 3, P: 40, dir: 'down' },
      { id: 6, x: 10, P: 12.5, dir: 'up' },
    ],
    dists: [
      { id: 7, x1: 0, x2: 8, w1: 6, w2: 15, dir: 'down' },
      { id: 8, x1: 8, x2: 12.5, w1: 4, w2: 4, dir: 'up' },
    ],
    couples: [
      { id: 9, x: 2, M: 30, dir: 'cw' },
      { id: 10, x: 11, M: 18, dir: 'ccw' },
    ],
    section: { mode: 'rect', material: 'concrete', E: 24870, I: 0, S: 0, Av: 0, b: 300, h: 600, shape: 'W18X50', selfWeight: false },
    nextId: 11,
  };
  const physics = (f: BeamForm) => {
    const a = analyse(f, shapes.find((s) => s.designation === f.section.shape));
    const s = a.solution!;
    return [s.reactions.map((r) => [r.Rv, r.Rm]), s.extremes.Mmax, s.extremes.Mmin, s.extremes.EIvMin.value * a.toDeflection, a.section];
  };

  it('opens the same beam', () => {
    const text = encodeBeam(full);
    expect(text).toMatch(/^[A-Za-z0-9.,;_/-]+$/);
    const back = decodeBeam(text)!;
    expect(back).not.toBeNull();
    expect(physics(back)).toEqual(physics(full));
    expect(back.supports.map((s) => [s.kind, s.x])).toEqual(full.supports.map((s) => [s.kind, s.x]));
    expect(back.points.map((p) => [p.x, p.P, p.dir])).toEqual(full.points.map((p) => [p.x, p.P, p.dir]));
    expect(back.dists.map((d) => [d.x1, d.x2, d.w1, d.w2, d.dir])).toEqual(full.dists.map((d) => [d.x1, d.x2, d.w1, d.w2, d.dir]));
    expect(back.couples.map((c) => [c.x, c.M, c.dir])).toEqual(full.couples.map((c) => [c.x, c.M, c.dir]));
    expect(back.section).toMatchObject({ mode: 'rect', material: 'concrete', E: 24870, b: 300, h: 600 });
    // Every row has its own id, and the next one is free.
    const ids = [...back.supports, ...back.hinges, ...back.points, ...back.dists, ...back.couples].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(back.nextId).toBeGreaterThan(Math.max(...ids));
  });

  it('carries each kind of section, and a material of the visitor’s own', () => {
    const shaped: BeamForm = { ...defaultBeam(), section: { ...defaultBeam().section, mode: 'shape', shape: 'HSS6X4X3/8', selfWeight: true } };
    expect(decodeBeam(encodeBeam(shaped))!.section).toMatchObject({ mode: 'shape', shape: 'HSS6X4X3/8', selfWeight: true });
    const custom: BeamForm = { ...defaultBeam(), section: { ...defaultBeam().section, material: 'custom', E: 12345 } };
    expect(decodeBeam(encodeBeam(custom))!.section).toMatchObject({ mode: 'props', material: 'custom', E: 12345, I: 800, S: 88.9, Av: 6.39 });
    const concrete: BeamForm = { ...defaultBeam(), section: { ...defaultBeam().section, material: 'concrete', E: 3605 } };
    expect(decodeBeam(encodeBeam(concrete))!.section.material).toBe('concrete');
    expect(physics(decodeBeam(encodeBeam(defaultBeam()))!)).toEqual(physics(defaultBeam()));
  });

  // Seventy-eight of the shapes have a hyphen in their name. The link used
  // to drop it, and opened with no section at all.
  it('carries a shape whose name has a hyphen', () => {
    const hyphenated = shapes.filter((s) => s.designation.includes('-'));
    expect(hyphenated.length).toBeGreaterThan(50);
    for (const s of hyphenated) {
      const form: BeamForm = { ...defaultBeam(), section: { ...defaultBeam().section, mode: 'shape', shape: s.designation, selfWeight: true } };
      expect(decodeBeam(encodeBeam(form))?.section.shape, s.designation).toBe(s.designation);
    }
    // Every name in the table goes through, whatever it is made of.
    for (const s of shapes) expect(s.designation, s.designation).toMatch(/^[A-Za-z0-9./-]{2,24}$/);
  });

  // What a link does not carry starts from the default section in the
  // LINK's units: a link in SI used to leave 12 and 24 (inches) under "mm".
  it('a link in SI opens with every section field in SI', () => {
    const si = convertUnits(defaultBeam(), 'si');
    const back = decodeBeam(encodeBeam(si))!;
    expect(back.section).toEqual(si.section);
    expect(back.section.b).toBeCloseTo(304.8, 6);
    expect(back.section.h).toBeCloseTo(609.6, 6);
    const rect: BeamForm = { ...si, section: { ...si.section, mode: 'rect', b: 300, h: 600 } };
    const opened = decodeBeam(encodeBeam(rect))!;
    // The properties it did not carry are the SI defaults, not 800 and 88.9.
    expect(opened.section.I).toBeCloseTo(si.section.I, 6);
    expect(opened.section.S).toBeCloseTo(si.section.S, 6);
    expect(decodeBeam(encodeBeam(defaultBeam()))!.section).toEqual(defaultBeam().section);
  });

  it('a distributed load with ends of opposite sign survives the trip', () => {
    const form: BeamForm = { ...defaultBeam(), dists: [{ id: 4, x1: 2, x2: 14, w1: 2, w2: -1, dir: 'down' }] };
    const back = decodeBeam(encodeBeam(form))!;
    expect(physics(back)).toEqual(physics(form));
  });

  it('refuses anything that is not a beam', () => {
    const good = encodeBeam(full);
    for (const text of [
      '',
      'hello',
      good.replace(/^si/, 'xx'),
      good.replace(';12.5;', ';<script>;'),
      good.replace(';12.5;', ';-3;'),
      good.replace(';12.5;', ';1e999;'),
      good.replace('f0', 'z0'),
      `${good};extra`,
      good.replace(/r,c,.*/, 'r,c,1,2'),
      good.replace(/r,c,.*/, 'q,c,1,2,3'),
      good.replace(/r,c,.*/, 's,W18X50<b>,0'),
      `us;20;${Array.from({ length: MAX_ROWS + 1 }, (_, i) => `p${i}`).join('_')};;;;;p,s,29000,800,88.9,6.39`,
      'x'.repeat(3000),
    ]) {
      expect(decodeBeam(text), text.slice(0, 60)).toBeNull();
    }
    // Twelve rows are the limit, and are accepted.
    expect(decodeBeam(`us;20;${Array.from({ length: MAX_ROWS }, (_, i) => `p${i}`).join('_')};;;;;p,s,29000,800,88.9,6.39`)).not.toBeNull();
  });
});

describe('beam form: what each edit does', () => {
  const start = defaultBeam();
  const ids = (f: BeamForm) => [...f.supports, ...f.hinges, ...f.points, ...f.dists, ...f.couples].map((r) => r.id);

  it('adds a row of each kind with an id nobody has had, and a value that draws something', () => {
    let f = start;
    for (const list of ['supports', 'hinges', 'points', 'dists', 'couples'] as const) {
      const before = f[list].length;
      f = reduceBeam(f, { type: 'add', list });
      expect(f[list]).toHaveLength(before + 1);
    }
    expect(new Set(ids(f)).size).toBe(ids(f).length);
    expect(f.nextId).toBeGreaterThan(Math.max(...ids(f)));
    expect(f.points[1]).toMatchObject({ x: 10, P: 10, dir: 'down' });
    expect(f.dists[1]).toMatchObject({ x1: 0, x2: 20, w1: 1, w2: 1 });
    // In SI the starting values are SI-sized.
    expect(reduceBeam(convertUnits(start, 'si'), { type: 'add', list: 'points' }).points[1].P).toBe(50);
    // A removed row's id is not handed out again.
    const removed = reduceBeam(f, { type: 'remove', list: 'couples', id: f.couples[0].id });
    expect(reduceBeam(removed, { type: 'add', list: 'couples' }).couples[0].id).toBeGreaterThan(f.couples[0].id);
  });

  it('stops at twelve rows', () => {
    let f = start;
    for (let i = 0; i < MAX_ROWS + 5; i++) f = reduceBeam(f, { type: 'add', list: 'points' });
    expect(f.points).toHaveLength(MAX_ROWS);
  });

  it('changes one row and leaves the others', () => {
    const f = reduceBeam(start, { type: 'patch', list: 'supports', id: 2, patch: { kind: 'fixed', x: 15 } });
    expect(f.supports).toEqual([{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'fixed', x: 15 }]);
    expect(f.points).toBe(start.points);
  });

  it('a layout replaces the supports, drops the hinges and keeps the loads', () => {
    const hinged = reduceBeam(start, { type: 'add', list: 'hinges' });
    const f = reduceBeam(hinged, { type: 'layout', layout: 'two-span' });
    expect(f.supports.map((s) => [s.kind, s.x])).toEqual([['pin', 0], ['roller', 10], ['roller', 20]]);
    expect(f.hinges).toEqual([]);
    expect(f.points).toBe(hinged.points);
    expect(new Set(ids(f)).size).toBe(ids(f).length);
  });

  it('a listed material brings its modulus; other keeps what was typed', () => {
    expect(reduceBeam(start, { type: 'material', material: 'aluminum' }).section.E).toBe(10100);
    expect(reduceBeam(convertUnits(start, 'si'), { type: 'material', material: 'wood' }).section.E).toBe(11000);
    const typed = reduceBeam(start, { type: 'section', patch: { E: 12345, material: 'custom' } });
    expect(reduceBeam(typed, { type: 'material', material: 'custom' }).section.E).toBe(12345);
  });

  it('switching units is the same edit as convertUnits', () => {
    expect(reduceBeam(start, { type: 'units', units: 'si' })).toEqual(convertUnits(start, 'si'));
  });

  // The length field reports every keystroke; the end support follows only
  // when the field is left. Typing 85 over 20 passes through 8.
  it('typing a new length moves nothing; leaving the field carries what sat on the end', () => {
    const withLoadAt8: BeamForm = { ...start, points: [{ id: 3, x: 8, P: 8, dir: 'down' }] };
    let f = reduceBeam(withLoadAt8, { type: 'length', L: 8 });
    f = reduceBeam(f, { type: 'length', L: 85 });
    expect(f.supports[1].x).toBe(20);
    expect(f.points[0].x).toBe(8);
    f = reduceBeam(f, { type: 'carry-end', from: 20, to: 85 });
    expect(f.supports.map((s) => s.x)).toEqual([0, 85]);
    expect(f.dists[0]).toMatchObject({ x1: 0, x2: 85 });
    // …and the load at 8 is still at 8.
    expect(f.points[0].x).toBe(8);
    expect(analyse(f).solution).not.toBeNull();
  });

  it('carries nothing from or to a length that is not one', () => {
    for (const [from, to] of [[0, 20], [20, 0], [Number.NaN, 20], [20, 20], [-5, 20]]) {
      expect(reduceBeam(start, { type: 'carry-end', from, to })).toBe(start);
    }
  });
});
