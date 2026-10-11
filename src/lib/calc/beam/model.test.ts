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
  type FormIssueCode,
  type SteelShape,
} from './model';
import { fieldNumber } from '../format';
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

/** What a link carries of a form: each row by what it says (a link numbers the rows again), and the section in use. */
const carried = (f: BeamForm) => ({
  units: f.units,
  L: f.L,
  supports: f.supports.map((s) => [s.kind, s.x]),
  hinges: f.hinges.map((h) => h.x),
  points: f.points.map((p) => [p.x, p.P, p.dir]),
  dists: f.dists.map((d) => [d.x1, d.x2, d.w1, d.w2, d.dir]),
  couples: f.couples.map((c) => [c.x, c.M, c.dir]),
  section:
    f.section.mode === 'shape'
      ? ['shape', f.section.shape, f.section.selfWeight]
      : f.section.mode === 'rect'
        ? ['rect', f.section.material, f.section.E, f.section.b, f.section.h]
        : ['props', f.section.material, f.section.E, f.section.I, f.section.S, f.section.Av],
});

/* The check a link begins with, worked out here a second time from its
   description in model.ts: the length of the rest and a sum of its
   characters, in base 36. People keep the links they were sent, so the rule
   may not drift — and a test that asked model.ts for it could not tell. */
const checkOf = (body: string) => {
  let sum = 0;
  for (const ch of body) sum = (sum * 31 + ch.charCodeAt(0)) % 1296;
  return (body.length * 1296 + sum).toString(36);
};
/** These eight fields as the page would write them: behind their check. */
const sealed = (body: string) => `${checkOf(body)};${body}`;
/** The eight fields of a link, without its check. */
const bodyOf = (link: string) => link.slice(link.indexOf(';') + 1);

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

  // One uniform load cannot tell a point load converted as a line load, a
  // hinge left where it was, or a modulus left in ksi. And there-and-back
  // cannot tell a wrong factor at all: it multiplies and divides by the same one.
  it('switching units converts every kind of row, each as its own quantity', () => {
    const form: BeamForm = {
      ...defaultBeam(),
      L: 30,
      supports: [{ id: 1, kind: 'fixed', x: 0 }, { id: 2, kind: 'roller', x: 30 }],
      hinges: [{ id: 3, x: 10 }],
      points: [{ id: 4, x: 22, P: 9, dir: 'down' }],
      dists: [{ id: 5, x1: 4, x2: 30, w1: 0.6, w2: 1.4, dir: 'down' }],
      couples: [{ id: 6, x: 5, M: 40, dir: 'cw' }],
      section: { ...defaultBeam().section, material: 'custom', E: 10000 },
      nextId: 7,
    };
    const si = convertUnits(form, 'si');
    // Feet to metres, kips to kilonewtons, kip/ft to kN/m, kip·ft to kN·m, ksi to MPa.
    near(si.L, 30 * 0.3048, 1e-5);
    near(si.supports[1].x, 30 * 0.3048, 1e-5);
    near(si.hinges[0].x, 10 * 0.3048, 1e-5);
    near(si.points[0].x, 22 * 0.3048, 1e-5);
    near(si.points[0].P, 9 * 4.4482216152605, 1e-5);
    near(si.dists[0].x1, 4 * 0.3048, 1e-5);
    near(si.dists[0].x2, 30 * 0.3048, 1e-5);
    near(si.dists[0].w1, 0.6 * 14.5939029372, 1e-5);
    near(si.dists[0].w2, 1.4 * 14.5939029372, 1e-5);
    near(si.couples[0].x, 5 * 0.3048, 1e-5);
    near(si.couples[0].M, 40 * 1.3558179483, 1e-5);
    near(si.section.E, 10000 * 6.894757293, 1e-5);
    // …and it is the same beam: the fixing moment, the roller, the
    // deflection — and the slope, which is radians in both systems.
    const a = analyse(form);
    const b = analyse(si);
    expect(b.issues).toEqual([]);
    near(b.solution!.reactions[0].Rm, a.solution!.reactions[0].Rm * US_TO_SI.moment, 1e-4);
    near(b.solution!.reactions[1].Rv, a.solution!.reactions[1].Rv * US_TO_SI.force, 1e-4);
    near(b.solution!.extremes.EIvMin.value * b.toDeflection, a.solution!.extremes.EIvMin.value * a.toDeflection * 25.4, 1e-4);
    near(b.solution!.at(30 * 0.3048).EItheta * b.toSlope, a.solution!.at(30).EItheta * a.toSlope, 1e-4);
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
    expect(sectionProps(withShape(pipe.designation), pipe).shearRule).toBe('round');
    // An S shape is sheared on its web like a W (d = 3 in, tw = 0.17 in), and
    // V/A carries no factor for a rolled shape.
    const s = shape('S3X5.7');
    const sweb = sectionProps(withShape(s.designation), s);
    near(sweb.Av, 3 * 0.17);
    expect(sweb.shearRule).toBe('web');
    expect([w.shearFactor, r.shearFactor, sweb.shearFactor]).toEqual([1, 1, 1]);
    // Not loaded yet: nothing is reported rather than something wrong.
    const none = sectionProps(withShape('W18X50'), null);
    expect([none.I, none.S, none.Av]).toEqual([0, 0, 0]);
    expect(analyse(withShape('W18X50'), null).toDeflection).toBe(0);
  });

  // In metric a rolled shape is still read from a table in inches: its I, its
  // S and its area each have their own power of 25.4 to cross, and its
  // modulus is the metric one.
  it('a rolled shape in SI: its S, its shear area and its modulus are SI', () => {
    const base = simple();
    const form = convertUnits({ ...base, section: { ...base.section, mode: 'shape', shape: 'W18X50' } }, 'si');
    const p = sectionProps(form, shape('W18X50'));
    // AISC: Ix = 800 in⁴, Sx = 88.9 in³, d = 18 in, tw = 0.355 in.
    expect(p.E).toBe(200000);
    near(p.I, 800 * 0.416231426, 1e-8);
    near(p.S, 88.9 * 16.387064);
    near(p.Av, 18 * 0.355 * 645.16);
    expect([p.shearFactor, p.shearRule]).toEqual([1, 'web']);
    // 60 kip·ft and 12 kip on it are 8.099 ksi and 1.878 ksi, in whatever units they are worked out.
    near(bendingStress('si', p, 60 * US_TO_SI.moment)!, ((60 * 12) / 88.9) * US_TO_SI.E);
    near(shearStress('si', p, 12 * US_TO_SI.force)!, (12 / (18 * 0.355)) * US_TO_SI.E);
    near((60 * 12) / 88.9, 8.099, 1e-4);
    near(12 / (18 * 0.355), 1.878, 1e-4);
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
    // The note under the shear stress names the rule in use, and none where there is no area.
    expect(sectionProps(base).shearRule).toBe('area');
    expect(a.section.shearRule).toBe('none');
    expect(sectionProps({ ...base, section: { ...base.section, mode: 'rect', b: 0, h: 12 } }).shearRule).toBe('none');
  });

  it('a negative or meaningless section value is named, not computed with', () => {
    const base = simple();
    for (const section of [
      { ...base.section, E: -1 },
      { ...base.section, I: Number.NaN },
      { ...base.section, S: -1 },
      { ...base.section, Av: Number.NaN },
      { ...base.section, mode: 'rect' as const, b: -2 },
      { ...base.section, mode: 'rect' as const, h: -2 },
    ]) {
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

  // Two supports, or two hinges, too close together to be solved: the engine
  // names the one further right by its place in the list it was given, and
  // that place is the row's place in the form.
  it('supports or hinges too close together are named by the row of the one further right', () => {
    const base = defaultBeam();
    const named = (code: FormIssueCode, list: 'supports' | 'hinges', id: number) => [{ code, row: { list, id } }];
    // 0.01 ft apart on 20 ft, half a thousandth of the length — and listed
    // out of order, so that a place in the list is not a place on the beam.
    const pair = [{ id: 7, kind: 'roller' as const, x: 19.99 }, { id: 2, kind: 'roller' as const, x: 20 }];
    const pin = { id: 1, kind: 'pin' as const, x: 0 };
    for (const supports of [[pair[0], pair[1], pin], [pin, pair[1], pair[0]], [pair[1], pin, pair[0]]]) {
      const a = analyse({ ...base, supports });
      expect(a.solution).toBeNull();
      expect(a.issues).toEqual(named('close-supports', 'supports', 2));
    }
    // Fixed at both ends, with two hinges a ten-millionth of the length apart.
    const ends = [{ id: 1, kind: 'fixed' as const, x: 0 }, { id: 2, kind: 'fixed' as const, x: 20 }];
    const near8 = [{ id: 30, x: 8 }, { id: 31, x: 8.000002 }];
    for (const hinges of [near8, [near8[1], near8[0]]]) {
      const a = analyse({ ...base, supports: ends, hinges });
      expect(a.solution).toBeNull();
      expect(a.issues).toEqual(named('close-hinges', 'hinges', 31));
    }
  });

  // The beam's own weight is one more distributed load, put at the END of
  // the engine's list: no row before it changes place, and it is itself no row.
  it('the beam’s own weight moves no row, and is no row itself', () => {
    const base = defaultBeam();
    const section = { ...base.section, mode: 'shape' as const, shape: 'W18X50', selfWeight: true };
    const form: BeamForm = {
      ...base,
      supports: [{ id: 7, kind: 'roller', x: 19.99 }, { id: 2, kind: 'roller', x: 20 }, { id: 1, kind: 'pin', x: 0 }],
      section,
    };
    expect(toEngine(form, sectionProps(form, shape('W18X50'))).dists).toHaveLength(form.dists.length + 1);
    expect(analyse(form, shape('W18X50')).issues).toEqual([{ code: 'close-supports', row: { list: 'supports', id: 2 } }]);
    // A load past the end of the beam is still its own row, with the weight behind it…
    const off: BeamForm = { ...base, dists: [...base.dists, { id: 61, x1: 5, x2: 25, w1: 1, w2: 1, dir: 'down' }], section };
    expect(analyse(off, shape('W18X50')).issues).toEqual([{ code: 'outside', row: { list: 'dists', id: 61 } }]);
    // …and a weight that is not a number is nobody's row: the issue is the beam's.
    const issues = analyse({ ...base, section }, { ...shape('W18X50'), weight: Infinity }).issues;
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('number');
    expect(issues[0].row).toBeUndefined();
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

  // Holding a beam is not being the layout that was asked for: a "fixed
  // both ends" that is fixed and roller holds it too.
  it('each layout is the layout it is called', () => {
    const laid = (layout: (typeof LAYOUTS)[number]) => layoutSupports(layout, 40).map((s) => [s.kind, s.x]);
    expect(laid('simple')).toEqual([['pin', 0], ['roller', 40]]);
    expect(laid('cantilever')).toEqual([['fixed', 0]]);
    expect(laid('propped')).toEqual([['fixed', 0], ['roller', 40]]);
    expect(laid('fixed')).toEqual([['fixed', 0], ['fixed', 40]]);
    expect(laid('overhang')).toEqual([['pin', 0], ['roller', 30]]);
    expect(laid('two-span')).toEqual([['pin', 0], ['roller', 20], ['roller', 40]]);
    expect(laid('three-span')).toEqual([['pin', 0], ['roller', 13.33], ['roller', 26.67], ['roller', 40]]);
    expect(LAYOUTS).toHaveLength(7);
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
    expect(carried(back)).toEqual(carried(form));
  });

  // The only upward load of the beam above is uniform: written with its
  // first intensity twice, it would come back the same.
  it('an upward load whose ends differ keeps both intensities and its direction', () => {
    const form: BeamForm = { ...defaultBeam(), dists: [{ id: 4, x1: 2, x2: 14, w1: 1, w2: 3, dir: 'up' }] };
    const back = decodeBeam(encodeBeam(form))!;
    expect(back.dists.map((d) => [d.x1, d.x2, d.w1, d.w2, d.dir])).toEqual([[2, 14, 1, 3, 'up']]);
    expect(physics(back)).toEqual(physics(form));
  });

  // "Whatever is on screen is in the address": a field keeps eight figures,
  // and so does the link. At six, 1234.567 kip at 12.34567 ft came back as
  // 1234.57 at 12.3457 — and supports at 10 and 10.000002 as one support.
  it('carries the eight figures a field shows', () => {
    const form: BeamForm = {
      ...defaultBeam(),
      supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 10 }, { id: 5, kind: 'roller', x: 10.000002 }, { id: 6, kind: 'roller', x: 20 }],
      points: [{ id: 3, x: 12.34567, P: 1234.567, dir: 'down' }],
    };
    const back = decodeBeam(encodeBeam(form))!;
    expect(carried(back)).toEqual(carried(form));
    // Each number is written as its field shows it, whatever its size.
    for (const v of [20, 12.34567, 1234.567, 10.000002, 0.1 + 0.2, 1 / 3, 12.3456789, 29000, 1e-7, 0.000001234, 2e12, 123456789012, 1e21, 1.5e300, Number.MAX_VALUE, 5e-324]) {
      const text = bodyOf(encodeBeam({ ...defaultBeam(), L: v })).split(';')[1];
      expect(text, String(v)).toBe(fieldNumber(v).replace('+', ''));
      expect(decodeBeam(encodeBeam({ ...defaultBeam(), L: v }))!.L, String(v)).toBe(Number(fieldNumber(v)));
    }
    // A ninth figure is not on screen, and does not travel.
    expect(decodeBeam(encodeBeam({ ...defaultBeam(), L: 12.3456789 }))!.L).toBe(12.345679);
  });

  // A field holds whatever number is typed: a length of 0 on the way to
  // 0.5, or left there. That beam's address, reloaded, used to bring the
  // example back with "could not be read", and everything entered was gone.
  it('reopens as the form on screen, whatever a field holds', () => {
    for (const L of [0, -5, 2e12, 1e21, 1e-7]) {
      const form: BeamForm = { ...full, L };
      const link = encodeBeam(form);
      expect(link, String(L)).toMatch(/^[A-Za-z0-9.,;_/-]+$/);
      expect(carried(decodeBeam(link)!), String(L)).toEqual(carried(form));
    }
    // What the form says about such a length, it says again after the reload.
    for (const L of [0, -5]) expect(analyse(decodeBeam(encodeBeam({ ...defaultBeam(), L }))!).issues).toEqual([{ code: 'length', row: undefined }]);
    // The address of the report, as the page wrote it before links had a check.
    expect(decodeBeam('us;0;p0_r20;;12,33;0,20,1.2,1.2;;p,s,29000,800,88.9,6.39')?.points[0].P).toBe(33);
    // Rows and section values of every kind, at awkward sizes.
    const odd: BeamForm = {
      units: 'us',
      L: 37.25,
      supports: [{ id: 1, kind: 'fixed', x: 0 }, { id: 2, kind: 'pin', x: 28.5 }, { id: 3, kind: 'roller', x: 1e-9 }],
      hinges: [{ id: 4, x: 33.333333 }, { id: 5, x: 50 }],
      points: [{ id: 6, x: 33.125, P: 12.75, dir: 'up' }, { id: 7, x: -4, P: 3e15, dir: 'down' }],
      dists: [{ id: 8, x1: 28.5, x2: 2.5, w1: 0.85, w2: 2.4, dir: 'up' }, { id: 9, x1: 0, x2: 37.25, w1: 0.000012345678, w2: 0, dir: 'down' }],
      couples: [{ id: 10, x: 14, M: 62.5, dir: 'cw' }, { id: 11, x: 14, M: 1e21, dir: 'ccw' }],
      section: { ...defaultBeam().section, material: 'custom', E: 12345.678, I: 0, S: 1e-12, Av: 9.48 },
      nextId: 12,
    };
    expect(carried(decodeBeam(encodeBeam(odd))!)).toEqual(carried(odd));
    const rect: BeamForm = { ...odd, section: { ...odd.section, mode: 'rect', material: 'wood', E: 1600, b: 0, h: 11.25 } };
    expect(carried(decodeBeam(encodeBeam(rect))!)).toEqual(carried(rect));
  });

  // The beams above are chosen; these are not. Every kind of row, any number
  // a field can show, either direction, each kind of section, both systems.
  it('three hundred random forms each reopen as themselves', () => {
    let seed = 20261010;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const pick = <T>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)];
    // Any number, as a field holds it once it has been shown: to eight figures.
    const any = () => Number(fieldNumber(pick([0, 20, 12.5, -3, 1e21, 1e-7, 2e12, 123456789012, 5e-324, (rnd() - 0.3) * 100, (rnd() - 0.5) * 10 ** Math.round((rnd() - 0.5) * 600)])));
    const size = () => Math.abs(any());
    const some = <T>(row: (id: number) => T): T[] => Array.from({ length: Math.floor(rnd() * 4) }, (_, i) => row(i + 1));
    for (let i = 0; i < 300; i++) {
      const units = pick(['us', 'si'] as const);
      const material = pick(['steel', 'aluminum', 'concrete', 'wood', 'custom'] as const);
      const form: BeamForm = {
        units,
        L: any(),
        supports: some((id) => ({ id, kind: pick(['pin', 'roller', 'fixed'] as const), x: any() })),
        hinges: some((id) => ({ id, x: any() })),
        points: some((id) => ({ id, x: any(), P: size(), dir: pick(['down', 'up'] as const) })),
        dists: some((id) => ({ id, x1: any(), x2: any(), w1: size(), w2: size(), dir: pick(['down', 'up'] as const) })),
        couples: some((id) => ({ id, x: any(), M: size(), dir: pick(['cw', 'ccw'] as const) })),
        section: {
          ...defaultBeam().section,
          mode: pick(['props', 'rect', 'shape'] as const),
          material,
          E: material === 'custom' ? size() : MATERIALS[material][units],
          I: size(),
          S: size(),
          Av: size(),
          b: size(),
          h: size(),
          shape: pick(['W18X50', 'HSS6X4X3/8', 'Pipe5XS']),
          selfWeight: rnd() < 0.5,
        },
        nextId: 9,
      };
      const link = encodeBeam(form);
      const back = decodeBeam(link)!;
      expect(carried(back), link).toEqual(carried(form));
      // The address of the beam that came back is the address it came from: nothing drifts from reload to reload.
      expect(encodeBeam(back), link).toBe(link);
      expect(analyse(back).issues.map((issue) => issue.code), link).toEqual(analyse(form).issues.map((issue) => issue.code));
      // …and with its last few characters gone it is no link at all.
      expect(decodeBeam(link.slice(0, -1 - Math.floor(rnd() * 8))), link).toBeNull();
    }
  });

  // A size being retyped passes through 0. An upward load, or a clockwise
  // couple, at 0 used to reopen pointing the other way, and the digits typed
  // next made it a load in the wrong direction.
  it('a load of size zero keeps its direction', () => {
    const form: BeamForm = {
      ...defaultBeam(),
      points: [{ id: 3, x: 12, P: 0, dir: 'up' }, { id: 5, x: 6, P: 0, dir: 'down' }],
      dists: [
        { id: 4, x1: 0, x2: 20, w1: 0, w2: 0, dir: 'up' },
        { id: 6, x1: 0, x2: 20, w1: 0, w2: 3, dir: 'up' },
        { id: 7, x1: 0, x2: 20, w1: 3, w2: 0, dir: 'up' },
        { id: 8, x1: 0, x2: 20, w1: 0, w2: 0, dir: 'down' },
        { id: 9, x1: 0, x2: 20, w1: 0, w2: 3, dir: 'down' },
      ],
      couples: [{ id: 10, x: 4, M: 0, dir: 'cw' }, { id: 11, x: 8, M: 0, dir: 'ccw' }],
    };
    const back = decodeBeam(encodeBeam(form))!;
    // toEqual tells 0 from −0: none of the zeros that come back is a −0.
    expect(carried(back)).toEqual(carried(form));
  });

  // A size typed with a minus is the same load pointing the other way, and
  // reopens said the usual way: the beam is the same, to the last figure.
  it('a size typed with a minus reopens as the same load', () => {
    const form: BeamForm = {
      ...defaultBeam(),
      points: [{ id: 3, x: 12, P: -5, dir: 'down' }, { id: 5, x: 6, P: -2, dir: 'up' }],
      dists: [
        { id: 4, x1: 0, x2: 20, w1: -2, w2: -1, dir: 'down' },
        { id: 6, x1: 0, x2: 20, w1: 2, w2: -1, dir: 'up' },
        { id: 7, x1: 0, x2: 20, w1: 0, w2: -3, dir: 'down' },
        { id: 8, x1: 0, x2: 20, w1: 0, w2: -3, dir: 'up' },
      ],
      couples: [{ id: 9, x: 4, M: -7, dir: 'cw' }],
    };
    const back = decodeBeam(encodeBeam(form))!;
    expect(back.points.map((p) => [p.P, p.dir])).toEqual([[5, 'up'], [2, 'down']]);
    expect(back.dists.map((d) => [d.w1, d.w2, d.dir])).toEqual([[2, 1, 'up'], [-2, 1, 'down'], [0, 3, 'up'], [0, 3, 'down']]);
    expect(back.couples.map((c) => [c.M, c.dir])).toEqual([[7, 'ccw']]);
    expect(physics(back)).toEqual(physics(form));
    // …and from there on it is the form that travels.
    expect(carried(decodeBeam(encodeBeam(back))!)).toEqual(carried(back));
  });

  // 10³⁰⁸ kip is a number; in kilonewtons it is past the largest there is,
  // and the field is left empty with its row marked. That is a form too.
  it('a value that is no longer a number is still the form that was on screen', () => {
    const huge = convertUnits({ ...defaultBeam(), points: [{ id: 3, x: 12, P: 1e308, dir: 'up' }] }, 'si');
    expect(huge.points[0].P).toBe(Infinity);
    const link = encodeBeam(huge);
    expect(link).toMatch(/^[A-Za-z0-9.,;_/-]+$/);
    const back = decodeBeam(link)!;
    expect(carried(back)).toEqual(carried(huge));
    expect(analyse(back).issues).toEqual([{ code: 'number', row: { list: 'points', id: back.points[0].id } }]);
    for (const L of [Infinity, -Infinity, Number.NaN]) expect(decodeBeam(encodeBeam({ ...defaultBeam(), L }))?.L, String(L)).toBe(L);
  });

  it('refuses anything that is not a beam', () => {
    const good = bodyOf(encodeBeam(full));
    expect(decodeBeam(sealed(good))).not.toBeNull();
    const rows = (n: number) => `us;20;${Array.from({ length: n }, (_, i) => `p${i}`).join('_')};;;;;p,s,29000,800,88.9,6.39`;
    const plain = 'us;20;p0_r20;;12,8;0,20,1.2,1.2;;p,s,29000,800,88.9,6.39';
    for (const body of [
      '',
      'hello',
      good.replace(/^si/, 'xx'),
      good.replace(/^si/, ''),
      good.replace(';12.5;', ';<script>;'),
      good.replace('f0', 'z0'),
      `${good};extra`,
      good.replace(/r,c,.*/, 'r,c,1,2'),
      good.replace(/r,c,.*/, 'q,c,1,2,3'),
      good.replace(/r,c,.*/, 's,W18X50<b>,0'),
      // A material that is none of the five. "constructor" is a property of
      // every object: looked up as one, it took the page down.
      good.replace(/r,c,.*/, 'r,z,24870,300,600'),
      good.replace(/r,c,.*/, 'r,constructor,24870,300,600'),
      plain.replace('p,s,', 'p,z,'),
      plain.replace('p,s,', 'p,toString,'),
      plain.replace('p,s,', 'p,__proto__,'),
      // A number in any notation but the page's own, or no number at all.
      plain.replace(';20;', ';0x14;'),
      plain.replace(';20;', ';2e+1;'),
      plain.replace(';20;', ';20.;'),
      plain.replace(';20;', ';.5;'),
      plain.replace(';20;', '; 20;'),
      plain.replace(';20;', ';2E1;'),
      plain.replace(';20;', ';;'),
      plain.replace(';20;', ';1e999;'),
      plain.replace(';20;', ';Infinity;'),
      plain.replace(';20;', ';NaN;'),
      plain.replace(';20;', ';INF;'),
      plain.replace(';20;', ';+inf;'),
      plain.replace('p0_r20', 'p_r20'),
      plain.replace('p0_r20', '0_r20'),
      plain.replace('p0_r20', 'p0__r20'),
      plain.replace('12,8', '12,+8'),
      plain.replace('12,8', '12,8ft'),
      plain.replace('12,8', '12,--8'),
      // A row with a field too many or too few.
      plain.replace('12,8', '12,8,9'),
      plain.replace('12,8', '12'),
      plain.replace('0,20,1.2,1.2', '0,20,1.2,1.2,7'),
      plain.replace('0,20,1.2,1.2', '0,20,1.2'),
      plain.replace(';;p,s', ';4,5,6;p,s'),
      plain.replace(';;p,s', ';4;p,s'),
      plain.replace('p0_r20;;', 'p0_r20;5,6;'),
      plain.replace('p0_r20', 'p0,1_r20'),
      rows(MAX_ROWS + 1),
      'x'.repeat(3000),
    ]) {
      // Behind a check that is right, so that it is the beam that is refused; and bare, as an older link.
      expect(() => decodeBeam(sealed(body)), body.slice(0, 60)).not.toThrow();
      expect(decodeBeam(sealed(body)), body.slice(0, 60)).toBeNull();
      expect(decodeBeam(body), body.slice(0, 60)).toBeNull();
    }
    // Twelve rows are the limit, and are accepted.
    expect(decodeBeam(sealed(rows(MAX_ROWS)))).not.toBeNull();
    expect(decodeBeam(rows(MAX_ROWS))).not.toBeNull();
  });

  // No form writes more than this: twelve rows of every kind, every number
  // at its longest. It must open; and nothing longer is looked at.
  it('reads the longest link a form can write, and nothing longer', () => {
    const big = -1.2345678e20;
    expect(String(big)).toHaveLength(22);
    const twelve = <T>(row: (id: number) => T) => Array.from({ length: MAX_ROWS }, (_, i) => row(i + 1));
    const worst: BeamForm = {
      units: 'us',
      L: big,
      supports: twelve((id) => ({ id, kind: 'roller' as const, x: big })),
      hinges: twelve((id) => ({ id, x: big })),
      points: twelve((id) => ({ id, x: big, P: big, dir: 'down' as const })),
      dists: twelve((id) => ({ id, x1: big, x2: big, w1: big, w2: big, dir: 'down' as const })),
      couples: twelve((id) => ({ id, x: big, M: big, dir: 'ccw' as const })),
      section: { ...defaultBeam().section, material: 'custom', E: big, I: big, S: big, Av: big },
      nextId: 100,
    };
    const link = encodeBeam(worst);
    expect(link).toHaveLength(2899);
    expect(decodeBeam(link)).not.toBeNull();
    // Zeros after a decimal point are still the number, so a link can be
    // padded to any length with every field in order: it is the length that
    // is refused.
    const padded = (zeros: number) => sealed(bodyOf(encodeBeam(defaultBeam())).replace(';20;', `;20.${'0'.repeat(zeros)};`));
    expect(decodeBeam(padded(2900))?.L).toBe(20);
    expect(padded(2950).length).toBeGreaterThan(3000);
    expect(decodeBeam(padded(2950))).toBeNull();
  });
});

describe('beam form: a link that lost part of itself', () => {
  const d = defaultBeam();
  const si = convertUnits(d, 'si');
  const withSection = (f: BeamForm, patch: Partial<BeamForm['section']>): BeamForm => ({ ...f, section: { ...f.section, ...patch } });
  // Each kind of section, own weight on and off, both unit systems.
  const forms: [string, BeamForm][] = [
    ['typed properties', d],
    ['typed properties, SI', si],
    ['rectangle', withSection(d, { mode: 'rect' })],
    ['rectangle, SI', withSection(si, { mode: 'rect', material: 'concrete', E: 24870, b: 300, h: 600 })],
    ['steel shape', withSection(d, { mode: 'shape' })],
    ['steel shape with its own weight', withSection(d, { mode: 'shape', selfWeight: true })],
    ['steel shape, SI', withSection(si, { mode: 'shape', shape: 'HSS6X4X3/8' })],
    ['steel shape with its own weight, SI', withSection(si, { mode: 'shape', shape: 'HSS6X4X3/8', selfWeight: true })],
    ['a beam of one support and nothing else', { ...d, supports: [{ id: 1, kind: 'fixed', x: 0 }], points: [], dists: [] }],
  ];

  // …;r,s,29000,12,24 without its last character is …;r,s,29000,12,2 — a
  // rectangle 12 × 2, with 1,700 times the deflection, and it opened without
  // a word. The check counts the characters behind it.
  it('cut short anywhere, it is not a link to another beam', () => {
    for (const [name, form] of forms) {
      const link = encodeBeam(form);
      expect(carried(decodeBeam(link)!), name).toEqual(carried(form));
      for (let length = 0; length < link.length; length++) {
        const cut = link.slice(0, length);
        expect(decodeBeam(cut), `${name}: ${cut}`).toBeNull();
      }
    }
    // The beam of the report: whole, it is 12 × 24.
    const rect = encodeBeam(withSection(d, { mode: 'rect' }));
    expect(rect.endsWith(';r,s,29000,12,24')).toBe(true);
    expect(decodeBeam(rect)?.section.h).toBe(24);
    expect(decodeBeam(rect.slice(0, -1))).toBeNull();
  });

  it('nor with something added, one character changed, or two neighbours swapped', () => {
    const letters = '0123456789.,;_-/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const [name, form] of forms.slice(0, 5)) {
      const link = encodeBeam(form);
      const at = link.indexOf(';');
      const [check, body] = [link.slice(0, at), link.slice(at + 1)];
      for (const more of ['0', '.', ')', ';', ' ', '%20']) expect(decodeBeam(link + more), `${name} + "${more}"`).toBeNull();
      for (let i = 0; i < body.length; i++) {
        for (const ch of letters) {
          if (ch === body[i]) continue;
          const changed = `${check};${body.slice(0, i)}${ch}${body.slice(i + 1)}`;
          expect(decodeBeam(changed), `${name}: ${changed}`).toBeNull();
        }
        if (i + 1 < body.length && body[i] !== body[i + 1]) {
          const swapped = `${check};${body.slice(0, i)}${body[i + 1]}${body[i]}${body.slice(i + 2)}`;
          expect(decodeBeam(swapped), `${name}: ${swapped}`).toBeNull();
        }
      }
      // The check itself is part of the link: another one is another link.
      for (const other of ['', '0', 'us', check.slice(0, -1), `${check}0`, check.toUpperCase() === check ? `${check}a` : check.toUpperCase()]) {
        expect(decodeBeam(`${other};${body}`), `${name}: "${other}"`).toBeNull();
      }
    }
  });

  // Links have been sent to people since the page opened. They begin with
  // the units, carry no check, and must open as they did.
  it('a link from before the check still opens', () => {
    expect(carried(decodeBeam('us;20;p0_r20;;12,8;0,20,1.2,1.2;;p,s,29000,800,88.9,6.39')!)).toEqual(carried(d));
    expect(decodeBeam('us;20;p0_r20;;12,8;0,20,1.2,1.2;;p,s,29000,800,88.9,6.39')!.section).toEqual(d.section);
    expect(carried(decodeBeam('us;20;p0_r20;;12,8;0,20,1.2,1.2;;r,s,29000,12,24')!).section).toEqual(['rect', 'steel', 29000, 12, 24]);
    expect(carried(decodeBeam('us;30;f0_r30;10;22,9;4,30,0.6,1.4;5,-40;p,u,10000,800,88.9,6.39')!)).toEqual({
      units: 'us',
      L: 30,
      supports: [['fixed', 0], ['roller', 30]],
      hinges: [10],
      points: [[22, 9, 'down']],
      dists: [[4, 30, 0.6, 1.4, 'down']],
      couples: [[5, 40, 'cw']],
      section: ['props', 'custom', 10000, 800, 88.9, 6.39],
    });
    expect(carried(decodeBeam('si;6.096;p0_r6.096;;3,-12.5;0,6.096,0,-3_0,6.096,-4,-4_2,5,2,-1;1,18;s,HSS6X4X3/8,1')!)).toEqual({
      units: 'si',
      L: 6.096,
      supports: [['pin', 0], ['roller', 6.096]],
      hinges: [],
      points: [[3, 12.5, 'up']],
      dists: [[0, 6.096, 0, 3, 'up'], [0, 6.096, 4, 4, 'up'], [2, 5, 2, -1, 'down']],
      couples: [[1, 18, 'ccw']],
      section: ['shape', 'HSS6X4X3/8', true],
    });
    // What the page writes now is those same eight fields, behind their check.
    for (const [name, form] of forms) {
      const link = encodeBeam(form);
      expect(link, name).toBe(sealed(bodyOf(link)));
      expect(carried(decodeBeam(bodyOf(link))!), name).toEqual(carried(form));
    }
    expect(bodyOf(encodeBeam(d))).toBe('us;20;p0_r20;;12,8;0,20,1.2,1.2;;p,s,29000,800,88.9,6.39');
  });

  // Written out, so that the rule is pinned by something other than itself:
  // 56 characters is 1k in base 36, and their sum is 1,018, which is sa.
  it('the check of the example beam is 1ksa', () => {
    expect(encodeBeam(d)).toBe('1ksa;us;20;p0_r20;;12,8;0,20,1.2,1.2;;p,s,29000,800,88.9,6.39');
    expect(encodeBeam(withSection(d, { mode: 'rect' }))).toBe('1cse;us;20;p0_r20;;12,8;0,20,1.2,1.2;;r,s,29000,12,24');
    expect(encodeBeam(withSection(d, { mode: 'shape', selfWeight: true }))).toBe('1730;us;20;p0_r20;;12,8;0,20,1.2,1.2;;s,W18X50,1');
    expect(carried(decodeBeam('1ksa;us;20;p0_r20;;12,8;0,20,1.2,1.2;;p,s,29000,800,88.9,6.39')!)).toEqual(carried(d));
    // Never the two letters an older link begins with.
    for (const [name, form] of forms) expect(encodeBeam(form).split(';')[0].length, name).toBeGreaterThanOrEqual(3);
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

  // Each new row is the row the page promises: a roller, a load pointing
  // down, a clockwise couple — at midspan, or over the whole beam.
  it('a new row of each kind is the usual one of its kind', () => {
    let f = start;
    for (const list of ['supports', 'hinges', 'points', 'dists', 'couples'] as const) f = reduceBeam(f, { type: 'add', list });
    expect(f.supports[2]).toEqual({ id: 5, kind: 'roller', x: 10 });
    expect(f.hinges[0]).toEqual({ id: 6, x: 10 });
    expect(f.points[1]).toEqual({ id: 7, x: 10, P: 10, dir: 'down' });
    expect(f.dists[1]).toEqual({ id: 8, x1: 0, x2: 20, w1: 1, w2: 1, dir: 'down' });
    expect(f.couples[0]).toEqual({ id: 9, x: 10, M: 20, dir: 'cw' });
    let m = convertUnits(start, 'si');
    for (const list of ['dists', 'couples'] as const) m = reduceBeam(m, { type: 'add', list });
    expect(m.dists[1]).toMatchObject({ x1: 0, x2: 6.096, w1: 15, w2: 15, dir: 'down' });
    expect(m.couples[0]).toMatchObject({ x: 3.048, M: 30, dir: 'cw' });
  });

  // Only ever tried on the last row of a list, a remove that drops the last
  // row whatever was pressed would pass.
  it('removing a row removes THAT row', () => {
    let f = reduceBeam(start, { type: 'add', list: 'points' });
    f = reduceBeam(f, { type: 'add', list: 'points' });
    const [a, b, c] = f.points.map((p) => p.id);
    expect(reduceBeam(f, { type: 'remove', list: 'points', id: a }).points.map((p) => p.id)).toEqual([b, c]);
    expect(reduceBeam(f, { type: 'remove', list: 'points', id: b }).points.map((p) => p.id)).toEqual([a, c]);
    expect(reduceBeam(f, { type: 'remove', list: 'points', id: c }).points.map((p) => p.id)).toEqual([a, b]);
    // The rows of the other lists are not its business, nor an id that is nobody's.
    expect(reduceBeam(f, { type: 'remove', list: 'supports', id: a }).supports).toEqual(f.supports);
    expect(reduceBeam(f, { type: 'remove', list: 'points', id: 999 }).points).toEqual(f.points);
    // With the first of two loads gone, the beam carries the other one alone:
    // 10 kip at midspan and 24 kip of uniform load, 17 kip a side.
    const one = reduceBeam(reduceBeam(start, { type: 'add', list: 'points' }), { type: 'remove', list: 'points', id: 3 });
    expect(one.points).toEqual([{ id: 5, x: 10, P: 10, dir: 'down' }]);
    for (const r of analyse(one).solution!.reactions) near(r.Rv, 17);
  });

  it('stops at twelve rows', () => {
    let f = start;
    for (let i = 0; i < MAX_ROWS + 5; i++) f = reduceBeam(f, { type: 'add', list: 'points' });
    expect(f.points).toHaveLength(MAX_ROWS);
  });

  it('a beam from a link replaces the whole form', () => {
    const other = decodeBeam('si;8;f0;;4,25;;;p,s,200000,333,1457,4123')!;
    expect(reduceBeam(start, { type: 'load', form: other })).toBe(other);
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
    // The supports took new ids, and the next row must not take one of
    // theirs: a change or a remove would then land on two rows at once.
    for (const list of ['supports', 'hinges', 'points', 'dists', 'couples'] as const) {
      const next = reduceBeam(f, { type: 'add', list });
      expect(new Set(ids(next)).size, list).toBe(ids(next).length);
      expect(next.nextId, list).toBeGreaterThan(Math.max(...ids(next)));
    }
    // Positions are worked out to four figures, on the beam as long as it is now.
    const long = reduceBeam({ ...start, L: 37.25 }, { type: 'layout', layout: 'three-span' });
    expect(long.supports.map((s) => [s.kind, s.x])).toEqual([['pin', 0], ['roller', 12.42], ['roller', 24.83], ['roller', 37.25]]);
    expect(reduceBeam({ ...start, L: 37.25 }, { type: 'layout', layout: 'overhang' }).supports.map((s) => s.x)).toEqual([0, 27.94]);
  });

  it('a listed material brings its modulus; other keeps what was typed', () => {
    expect(reduceBeam(start, { type: 'material', material: 'aluminum' }).section.E).toBe(10100);
    expect(reduceBeam(convertUnits(start, 'si'), { type: 'material', material: 'wood' }).section.E).toBe(11000);
    const typed = reduceBeam(start, { type: 'section', patch: { E: 12345, material: 'custom' } });
    expect(reduceBeam(typed, { type: 'material', material: 'custom' }).section.E).toBe(12345);
    // Every listed modulus, in both systems: each metric value is its US
    // value to within the rounding of a listed number.
    expect(MATERIALS.aluminum).toEqual({ us: 10100, si: 69600 });
    expect(MATERIALS.wood).toEqual({ us: 1600, si: 11000 });
    for (const key of ['steel', 'aluminum', 'concrete', 'wood'] as const) {
      near(MATERIALS[key].si, MATERIALS[key].us * US_TO_SI.E, 4e-3);
      expect(reduceBeam(convertUnits(start, 'si'), { type: 'material', material: key }).section, key).toMatchObject({ material: key, E: MATERIALS[key].si });
    }
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

  // A cantilever's tip is where its loads are: a load, a couple and the
  // start of a distributed load on the end go with the end, as a support does.
  it('what the end of the beam carries goes with it, and nothing else does', () => {
    const tip: BeamForm = {
      ...start,
      L: 26,
      supports: [{ id: 1, kind: 'fixed', x: 0 }],
      points: [{ id: 3, x: 20, P: 8, dir: 'down' }, { id: 6, x: 23, P: 1, dir: 'down' }, { id: 7, x: 19.5, P: 1, dir: 'down' }],
      couples: [{ id: 5, x: 20, M: 10, dir: 'cw' }, { id: 8, x: 12, M: 10, dir: 'cw' }],
      dists: [{ id: 4, x1: 20, x2: 12, w1: 1, w2: 1, dir: 'down' }],
    };
    const f = reduceBeam(tip, { type: 'carry-end', from: 20, to: 26 });
    expect(f.supports.map((s) => s.x)).toEqual([0]);
    // The load at 23 was past the old end, the one at 19.5 short of it: neither sat on it.
    expect(f.points.map((p) => p.x)).toEqual([26, 23, 19.5]);
    expect(f.couples.map((c) => c.x)).toEqual([26, 12]);
    expect(f.dists.map((d) => [d.x1, d.x2])).toEqual([[26, 12]]);
    // Shortening the beam brings them back the same way.
    const back = reduceBeam({ ...f, L: 20 }, { type: 'carry-end', from: 26, to: 20 });
    expect(back.points.map((p) => p.x)).toEqual([20, 23, 19.5]);
    expect(back.couples.map((c) => c.x)).toEqual([20, 12]);
    expect(back.dists.map((d) => [d.x1, d.x2])).toEqual([[20, 12]]);
  });

  it('carries nothing from or to a length that is not one', () => {
    for (const [from, to] of [[0, 20], [20, 0], [Number.NaN, 20], [20, 20], [-5, 20]]) {
      expect(reduceBeam(start, { type: 'carry-end', from, to })).toBe(start);
    }
  });
});

describe('beam form: the size of the problem', () => {
  it('the loads add up to the scale the page measures rounding against', () => {
    // 8 kip, and 1.2 kip/ft over 20 ft.
    near(analyse(defaultBeam()).loadScale, 8 + 1.2 * 20);
    const f = defaultBeam();
    // A couple counts as its moment over the length; up or down, a load is its size.
    near(analyse({ ...f, points: [], dists: [], couples: [{ id: 90, x: 5, M: 40, dir: 'ccw' }] }).loadScale, 40 / 20);
    near(analyse({ ...f, points: [{ id: 91, x: 4, P: 3, dir: 'up' }, { id: 92, x: 9, P: 3, dir: 'down' }], dists: [] }).loadScale, 6);
    // A trapezoid is its mean intensity over its length.
    near(analyse({ ...f, points: [], dists: [{ id: 93, x1: 2, x2: 12, w1: 1, w2: 3, dir: 'down' }] }).loadScale, 20);
    expect(analyse({ ...f, points: [], dists: [] }).loadScale).toBe(0);
    // Entered from right to left it is the same load, and counts the same:
    // counted as −20 kip, every floor the page measures against would be negative.
    near(analyse({ ...f, points: [], dists: [{ id: 93, x1: 12, x2: 2, w1: 1, w2: 3, dir: 'down' }] }).loadScale, 20);
    // 2 kip/ft down at one end and 2 up at the other over 20 ft is two
    // triangles of 10 kip, not nothing. The scale may count it high (it takes
    // the two ends' sizes, 40), never as the zero the two cancel to.
    const crossing = analyse({ ...f, points: [], dists: [{ id: 94, x1: 0, x2: 20, w1: 2, w2: -2, dir: 'down' }] }).loadScale;
    expect(crossing).toBeGreaterThanOrEqual(20);
    expect(crossing).toBeLessThanOrEqual(40);
    // A couple is its moment over the length of THIS beam, and a value that is not a number counts for nothing.
    near(analyse({ ...f, L: 40, supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 40 }], points: [], dists: [], couples: [{ id: 90, x: 5, M: 40, dir: 'cw' }] }).loadScale, 1);
    near(analyse({ ...f, points: [{ id: 3, x: 12, P: Number.NaN, dir: 'down' }] }).loadScale, 24);
  });

  it('the beam’s own weight is one of the loads it counts', () => {
    const f = defaultBeam();
    const own = analyse({ ...f, points: [], dists: [], section: { ...f.section, mode: 'shape', shape: 'W18X50', selfWeight: true } }, shape('W18X50'));
    // 50 lb/ft over 20 ft is one kip.
    near(own.loadScale, 1, 1e-3);
    expect(own.section.selfWeight).toBeGreaterThan(0);
  });

  it('a value the chosen kind of section does not use is not an error of it', () => {
    const f = defaultBeam();
    // A rolled shape brings steel's modulus: the E left in the other tab is not asked for.
    expect(analyse({ ...f, section: { ...f.section, mode: 'shape', shape: 'W18X50', E: -1 } }, shape('W18X50')).issues).toEqual([]);
    // …and where it IS used, it is still named.
    expect(analyse({ ...f, section: { ...f.section, E: -1 } }).issues).toEqual([{ code: 'section' }]);
    expect(analyse({ ...f, section: { ...f.section, mode: 'rect', b: 10, h: 20, E: -1 } }).issues).toEqual([{ code: 'section' }]);
    // The same for every field of a tab that is not the one on screen: the
    // typed properties under a rectangle, the rectangle's sides under typed
    // properties, and all of them under a rolled shape.
    const rect = analyse({ ...f, section: { ...f.section, mode: 'rect', b: 10, h: 20, I: -1, S: Number.NaN, Av: -3 } });
    expect(rect.issues).toEqual([]);
    near(rect.section.I, (10 * 20 ** 3) / 12);
    const props = analyse({ ...f, section: { ...f.section, mode: 'props', b: -1, h: Number.NaN } });
    expect(props.issues).toEqual([]);
    expect(props.section.I).toBe(800);
    expect(analyse({ ...f, section: { ...f.section, mode: 'shape', shape: 'W18X50', I: -1, S: -1, Av: Number.NaN, b: -1, h: Infinity } }, shape('W18X50')).issues).toEqual([]);
  });
});

describe('beam form: what a link may say', () => {
  const code = bodyOf(encodeBeam(defaultBeam()));
  const withSection = (section: string) => sealed(code.replace(/;[^;]*$/, `;${section}`));

  it('the own-weight mark is 0 or 1, and nothing else', () => {
    expect(decodeBeam(withSection('s,W18X50,1'))?.section.selfWeight).toBe(true);
    expect(decodeBeam(withSection('s,W18X50,0'))?.section.selfWeight).toBe(false);
    for (const mark of ['2', '', 'true', '01', '-1', '1.0']) expect(decodeBeam(withSection(`s,W18X50,${mark}`)), mark).toBeNull();
  });

  it('a modulus that is not the listed material’s opens as a material of the visitor’s own', () => {
    expect(decodeBeam(sealed(code))?.section.material).toBe('steel');
    const other = decodeBeam(sealed(code.replace('29000', '29500')));
    expect(other?.section.E).toBe(29500);
    // "Steel" beside 29,500 would be a label that contradicts its number.
    expect(other?.section.material).toBe('custom');
    // Each letter is its material, with its own modulus beside it; u is the visitor's own, whatever the number.
    for (const [letter, E, material] of [['s', 29000, 'steel'], ['a', 10100, 'aluminum'], ['c', 3605, 'concrete'], ['w', 1600, 'wood'], ['u', 29000, 'custom'], ['w', 3605, 'custom']] as const) {
      expect(decodeBeam(withSection(`p,${letter},${E},800,88.9,6.39`))?.section, letter).toMatchObject({ mode: 'props', material, E });
      expect(decodeBeam(withSection(`r,${letter},${E},12,24`))?.section, letter).toMatchObject({ mode: 'rect', material, E, b: 12, h: 24 });
    }
  });
});
