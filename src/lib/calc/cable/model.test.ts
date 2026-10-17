import { afterEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 120_000 });
import { checkOf } from '../beam/model';
import { solveLoad } from './engine';
import {
  CABLE_KEY,
  CABLE_UNITS,
  CABLE_US_TO_SI,
  G_SI,
  G_US,
  MATERIALS,
  MAX_LINK,
  ROPES,
  choicesOf,
  convertCable,
  convertForceUnit,
  decodeCable,
  defaultCase,
  drumInput,
  encodeCable,
  engineScale,
  exampleOf,
  loadInput,
  pullInput,
  reduceCable,
  ropeFactor,
  sectionField,
  sectionInput,
  type CableAction,
  type CableForm,
} from './model';
import { between, near, pickOf, randomForm, rng, six } from './testlib';
import { MATERIAL_IDS, ROPE_IDS } from './types';

afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

const A_QUARTER = (Math.PI / 4) * 0.25 ** 2;

describe('the tables', () => {
  it('has a preset for every material and every rope but the visitor’s own', () => {
    expect(Object.keys(MATERIALS).sort()).toEqual(MATERIAL_IDS.filter((m) => m !== 'custom').sort());
    expect(Object.keys(ROPES).sort()).toEqual(ROPE_IDS.filter((m) => m !== 'custom').sort());
  });
  it('writes each material in both systems as the same metal (E within 1.5 %, α within 1 %)', () => {
    for (const m of Object.values(MATERIALS)) {
      const ksiToGpa = CABLE_US_TO_SI.E;
      expect(Math.abs(m.E.si / (m.E.us * ksiToGpa) - 1)).toBeLessThan(0.015);
      // A coefficient per °F is 9/5 of the one per °C’s difference: α_C = 1.8 α_F.
      expect(Math.abs(m.alpha.si / (m.alpha.us * 1.8) - 1)).toBeLessThan(0.01);
    }
  });
  it('has the numbers the contract names', () => {
    expect(MATERIALS.steel.E).toEqual({ us: 29000, si: 200 });
    expect(MATERIALS.steel.alpha).toEqual({ us: 6.5, si: 11.7 });
    expect(MATERIALS.stainless.E).toEqual({ us: 28000, si: 193 });
    expect(MATERIALS.stainless.alpha).toEqual({ us: 9.2, si: 16.6 });
    expect(MATERIALS.aluminum.E).toEqual({ us: 10000, si: 69 });
    expect(MATERIALS.aluminum.alpha).toEqual({ us: 13, si: 23.4 });
    expect(MATERIALS.strand7.E.us).toBe(28500);
    // The verified moduli of the ropes (EN 1993-1-11 Table 3.1; Hanes): steel core 100 GPa, fibre core 80, spiral strand 150, locked coil 160.
    expect(MATERIALS.rope.E).toEqual({ us: 14500, si: 100 });
    expect(MATERIALS['rope-fibre'].E).toEqual({ us: 11500, si: 80 });
    expect(MATERIALS['rope-spiral'].E).toEqual({ us: 21800, si: 150 });
    expect(MATERIALS['rope-locked'].E).toEqual({ us: 23200, si: 160 });
  });
  it('a wire rope’s effective modulus is not steel’s: about half with a steel core, about 40 % with a fibre core; spiral and locked-coil are stiffer, in that order', () => {
    const steel = MATERIALS.steel.E;
    for (const sys of ['us', 'si'] as const) {
      expect(MATERIALS.rope.E[sys] / steel[sys]).toBeGreaterThan(0.45);
      expect(MATERIALS.rope.E[sys] / steel[sys]).toBeLessThan(0.55);
      expect(MATERIALS['rope-fibre'].E[sys] / steel[sys]).toBeGreaterThan(0.35);
      expect(MATERIALS['rope-fibre'].E[sys] / steel[sys]).toBeLessThan(0.45);
    }
    expect(MATERIALS.rope.E.us).toBeGreaterThanOrEqual(13000);
    expect(MATERIALS.rope.E.us).toBeLessThanOrEqual(15500);
    expect(MATERIALS['rope-fibre'].E.us).toBeLessThan(MATERIALS.rope.E.us);
    expect(MATERIALS['rope-spiral'].E.us).toBeGreaterThan(MATERIALS.rope.E.us);
    expect(MATERIALS['rope-locked'].E.us).toBeGreaterThan(MATERIALS['rope-spiral'].E.us);
    for (const m of ['rope', 'rope-fibre', 'rope-spiral', 'rope-locked'] as const) expect(MATERIALS[m].typical).toBe(true);
  });
  it('locked-coil rope has its own material, and the rope factors are the verified ones (EN 1993-1-11 Annex C)', () => {
    expect(ROPES.locked.material).toBe('rope-locked');
    expect(ROPES.spiral.material).toBe('rope-spiral');
    expect(MATERIALS['rope-locked'].rope).toBe('locked');
    expect(ROPES['rope-6x19'].factor).toBe(0.41);
    expect(ROPES['rope-6x36'].factor).toBe(0.455);
    expect(ROPES.locked.factor).toBe(0.66);
    expect(ROPES.spiral.factor).toBe(0.58);
    expect(ROPES.strand7.factor).toBe(0.6);
  });
  it('has rope factors below π/4 (a rope is not a solid bar) and the solid round at π/4', () => {
    expect(ROPES.solid.factor).toBe(Math.PI / 4);
    for (const [id, r] of Object.entries(ROPES)) if (id !== 'solid') {
      expect(r.factor).toBeLessThan(Math.PI / 4);
      expect(r.factor).toBeGreaterThan(0.3);
      expect(r.typical).toBe(true);
    }
    // 7-wire strand: ASTM A416 ½ in strand is 0.153 in² = 0.612 d².
    expect(Math.abs(ROPES.strand7.factor - 0.153 / 0.25)).toBeLessThan(0.02);
  });
});

describe('the units, in one place', () => {
  it('has the engine scales the contract says', () => {
    expect(engineScale('us', 'small')).toMatchObject({ force: 1, length: 12, E: 1000, stress: 1000, alpha: 1e-6, dT: 1 });
    expect(engineScale('us', 'large').force).toBe(1000);
    expect(engineScale('si', 'small')).toMatchObject({ force: 1, length: 1000, E: 1000, stress: 1, alpha: 1e-6 });
    expect(engineScale('us', 'small').accel).toBeCloseTo(1 / 32.17404855643044, 15);
    expect(engineScale('si', 'small').accel).toBeCloseTo(1 / 9.80665, 15);
    expect(G_US * 0.3048).toBeCloseTo(G_SI, 14);
    expect(engineScale('si', 'small').mass).toBe(G_SI);
    expect(CABLE_UNITS.us.force).toEqual({ small: 'lbf', large: 'kip' });
    expect(CABLE_UNITS.si.force).toEqual({ small: 'N', large: 'kN' });
  });
  it('turns the default case into the engine’s lbf / inch / psi numbers', () => {
    const f = defaultCase();
    const i = loadInput(f);
    expect(i.W).toBe(2000);
    expect(i.legs[0].length).toBe(120);
    expect(i.legs[0].section.A).toBeCloseTo(A_QUARTER, 15);
    expect(i.legs[0].section.E).toBe(29e6);
    expect(i.legs[0].section.alpha).toBe(6.5e-6);
    const kip = convertForceUnit(f, 'large');
    expect(kip.load.W).toBe(2);
    expect(loadInput(kip).W).toBe(2000);
  });
  it('gives the same engine problem in SI as in US units (to the rounding of the converted fields)', () => {
    const us = defaultCase();
    const si = convertCable(us, 'si');
    const a = loadInput(us);
    const b = loadInput(si);
    // lbf → N, in → mm.
    expect(near(b.W, a.W * 4.4482216152605, 1e-5)).toBe(true);
    expect(near(b.legs[0].length, a.legs[0].length * 25.4, 1e-5)).toBe(true);
    expect(near(b.legs[0].section.A, a.legs[0].section.A * 645.16, 1e-4)).toBe(true);
    expect(near(b.legs[0].section.E, a.legs[0].section.E * 4.4482216152605 / 645.16, 1e-3)).toBe(true);
    // α per °C = 1.8 α per °F, to the rounding of the listed values.
    expect(near(b.legs[0].section.alpha, a.legs[0].section.alpha * 1.8, 5e-3)).toBe(true);
  });
  it('converts a temperature CHANGE as a difference: no offset, zero stays zero', () => {
    const f = { ...defaultCase(), dT: 100 };
    expect(convertCable(f, 'si').dT).toBeCloseTo(55.5556, 4);
    expect(convertCable({ ...f, dT: 0 }, 'si').dT).toBe(0);
    expect(convertCable({ ...f, dT: -45 }, 'si').dT).toBeCloseTo(-25, 6);
    expect(convertCable(convertCable(f, 'si'), 'us').dT).toBe(100);
    // 50 °F of change is the same thermal stretch as 27.778 °C, of the same cable: α per °C is 1.8 × α per °F.
    const us = loadInput({ ...defaultCase(), dT: 50 });
    const si = loadInput(convertCable({ ...defaultCase(), dT: 50 }, 'si'));
    const dUs = us.legs[0].section.alpha * us.legs[0].length * (us.dT as number);
    const dSi = si.legs[0].section.alpha * si.legs[0].length * (si.dT as number);
    expect(near(dSi, dUs * 25.4, 2e-3)).toBe(true);
  });
  it('round-trips the unit system to the same form, for values of up to four figures', () => {
    const r = rng(51);
    for (let k = 0; k < 600; k++) {
      const f = randomForm(r);
      // Four figures everywhere, no NaN, and an E and α that are listed or typed in the system they are in.
      const four = JSON.parse(JSON.stringify(f, (_, v) => (typeof v === 'number' ? (Number.isFinite(v) ? Number(v.toPrecision(3)) : 1) : v))) as CableForm;
      const us = convertCable(four, 'us');
      const there = convertCable(us, 'si');
      const back = convertCable(there, 'us');
      expect(back).toEqual(us);
    }
    const d = defaultCase();
    expect(convertCable(convertCable(d, 'si'), 'us')).toEqual(d);
    expect(convertCable(d, 'us')).toBe(d);
  });
  it('a mass converts as a mass and a weight as a force', () => {
    const f = { ...defaultCase(), pull: { ...defaultCase().pull, W: 100, massInput: true } };
    expect(convertCable(f, 'si').pull.W).toBeCloseTo(45.3592, 2); // 100 lb = 45.3592 kg
    expect(convertCable({ ...f, pull: { ...f.pull, massInput: false } }, 'si').pull.W).toBeCloseTo(444.822, 1); // 100 lbf
    // 100 lb of mass weighs 100 lbf: the engine gets the same force either way, in each system.
    expect(pullInput(f).W).toBe(100);
    expect(near(pullInput(convertCable(f, 'si')).W, 100 * 4.4482216152605, 1e-5)).toBe(true);
  });
  it('an acceleration is brought to a / g', () => {
    const f = { ...defaultCase(), pull: { ...defaultCase().pull, accel: 8.04351 } };
    expect(pullInput(f).aOverG).toBeCloseTo(0.25, 5); // 8.04351 ft/s² is g/4
    expect(pullInput(convertCable(f, 'si')).aOverG).toBeCloseTo(0.25, 4);
    expect(pullInput(defaultCase()).aOverG).toBeNull();
  });
  it('a wrap in degrees or turns reaches the engine in radians', () => {
    const d = defaultCase();
    expect(drumInput(d).beta).toBeCloseTo(4 * Math.PI, 14);
    expect(drumInput({ ...d, drum: { ...d.drum, wrap: 180, wrapUnit: 'deg' } }).beta).toBeCloseTo(Math.PI, 14);
    expect(drumInput({ ...d, drum: { ...d.drum, wrap: null } }).beta).toBeNull();
    expect(drumInput(d).Tsmall).toBeNull();
  });
});

describe('what each edit does', () => {
  const f0 = defaultCase();
  const act = (a: CableAction, f: CableForm = f0) => reduceCable(f, a);

  it('loads, resets, and changes the mode without losing the other modes’ inputs', () => {
    const other = { ...f0, dT: 33 };
    expect(act({ type: 'load', form: other })).toBe(other);
    expect(act({ type: 'reset' }, other)).toEqual(f0);
    const p = act({ type: 'mode', mode: 'pull' });
    expect(p.mode).toBe('pull');
    expect(p.load).toBe(f0.load);
    expect(p.drum).toBe(f0.drum);
    expect(act({ type: 'mode', mode: 'nonsense' as never })).toBe(f0);
    expect(exampleOf('drum').mode).toBe('drum');
    expect(exampleOf('pull', 'si').units).toBe('si');
  });
  it('picks a material: E and α follow it; a typed E or α makes it the visitor’s own', () => {
    const rope = act({ type: 'material', material: 'rope' });
    expect(rope.section.material).toBe('rope');
    expect(rope.section.E).toBe(14500);
    const si = act({ type: 'units', units: 'si' }, rope);
    expect(si.section.E).toBe(100);
    expect(si.section.alpha).toBe(11.7);
    expect(act({ type: 'material', material: 'aluminum' }, si).section.E).toBe(69);
    const typed = act({ type: 'section', patch: { E: 12345 } }, rope);
    expect(typed.section.material).toBe('custom');
    expect(typed.section.E).toBe(12345);
    expect(act({ type: 'section', patch: { alpha: 7 } }, rope).section.material).toBe('custom');
    // Typing the listed value keeps the material.
    expect(act({ type: 'section', patch: { E: 14500 } }, rope).section.material).toBe('rope');
    expect(act({ type: 'material', material: 'custom' }, rope).section.E).toBe(14500);
    expect(act({ type: 'material', material: 'unobtainium' as never })).toBe(f0);
  });
  it('picks a rope: the factor follows it; a typed factor makes it custom; solid has none', () => {
    const r = act({ type: 'rope', rope: 'rope-6x19' });
    expect(r.section.rope).toBe('rope-6x19');
    expect(r.section.factor).toBe(0.41);
    expect(ropeFactor(r.section)).toBe(0.41);
    expect(act({ type: 'section', patch: { factor: 0.44 } }, r).section.rope).toBe('custom');
    expect(act({ type: 'section', patch: { factor: 0.41 } }, r).section.rope).toBe('rope-6x19');
    const c = act({ type: 'rope', rope: 'custom' }, f0);
    expect(c.section.rope).toBe('custom');
    expect(c.section.factor).toBe(0.5);
    const s = act({ type: 'rope', rope: 'solid' }, r);
    expect(s.section.factor).toBeNull();
    expect(ropeFactor(s.section)).toBe(Math.PI / 4);
    // The engine area of a rope given by diameter: A = factor·d².
    const rope = act({ type: 'section', patch: { d: 1 } }, r);
    expect(sectionInput(rope.section, rope).A).toBeCloseTo(0.41, 14);
    expect(sectionInput(rope.section, rope).factor).toBe(0.41);
    expect(sectionInput(f0.section, f0).factor).toBeNull();
  });
  it('gives the section by diameter or by area, and names the form field of an engine field', () => {
    const area = act({ type: 'section', patch: { by: 'area', A: 0.2 } });
    expect(sectionInput(area.section, area).A).toBe(0.2);
    expect(sectionInput({ ...area.section, A: null }, area).A).toBeNaN();
    expect(sectionInput({ ...f0.section, d: null }, f0).A).toBeNaN();
    expect(sectionField({ by: 'diameter' }, 'A')).toBe('d');
    expect(sectionField({ by: 'area' }, 'A')).toBe('A');
    expect(sectionField({ by: 'area' }, 'E')).toBe('E');
    expect(sectionField({ by: 'area' }, 'angle')).toBeNull();
    expect(sectionInput({ ...f0.section, E: null }, f0).E).toBeNaN();
  });
  it('gives leg 2 its own section (a copy), and takes it away', () => {
    const own = act({ type: 'own2', on: true });
    expect(own.load.own2).toEqual(f0.section);
    expect(own.load.own2).not.toBe(f0.section);
    const edited = act({ type: 'material', material: 'rope', target: 'leg2' }, own);
    expect(edited.section.material).toBe('steel');
    expect(edited.load.own2!.material).toBe('rope');
    expect(loadInput(edited).legs[1].section.E).toBe(14.5e6);
    expect(loadInput(edited).legs[0].section.E).toBe(29e6);
    expect(act({ type: 'section', patch: { d: 0.5 }, target: 'leg2' }, edited).load.own2!.d).toBe(0.5);
    expect(act({ type: 'section', patch: { d: 0.5 }, target: 'leg2' })).toBe(f0); // no own section: nothing to edit
    expect(act({ type: 'own2', on: false }, edited).load.own2).toBeNull();
    expect(act({ type: 'own2', on: true }, own)).toBe(own);
    expect(act({ type: 'own2', on: false })).toBe(f0);
  });
  it('edits the fields and ignores anything that is not a field or not a number', () => {
    expect(act({ type: 'dT', value: 40 }).dT).toBe(40);
    expect(act({ type: 'dT', value: Number.NaN }).dT).toBeNaN();
    expect(act({ type: 'dT', value: 'x' as never })).toBe(f0);
    expect(act({ type: 'design', patch: { n: 4, allowable: 30 } })).toMatchObject({ n: 4, allowable: 30 });
    expect(act({ type: 'design', patch: { n: null } }).n).toBeNull();
    expect(act({ type: 'design', patch: { n: 'x' as never } }).n).toBeNull();
    expect(act({ type: 'legs', legs: 1 }).load.legs).toBe(1);
    expect(act({ type: 'legs', legs: 3 as never })).toBe(f0);
    expect(act({ type: 'leg', leg: 2, patch: { angle: 30, side: 'left', length: 5 } }).load.leg2).toEqual({ angle: 30, side: 'left', length: 5 });
    expect(act({ type: 'leg', leg: 1, patch: { angle: 'x' as never, side: 'up' as never, hack: 1 } as never }).load.leg1).toEqual(f0.load.leg1);
    expect(act({ type: 'loadInput', patch: { W: 5, H: -2 } }).load).toMatchObject({ W: 5, H: -2 });
    expect(act({ type: 'pullInput', patch: { theta: 20, travel: 'against', accel: 3, muS: 0.6 } }).pull).toMatchObject({ theta: 20, travel: 'against', accel: 3, muS: 0.6 });
    expect(act({ type: 'pullInput', patch: { accel: null } }).pull.accel).toBeNull();
    expect(act({ type: 'pullInput', patch: { travel: 'sideways' as never } }).pull.travel).toBe('along');
    expect(act({ type: 'drumInput', patch: { Tbig: null, Tsmall: 20, wrapUnit: 'deg', wrap: 360 } }).drum).toMatchObject({ Tbig: null, Tsmall: 20, wrapUnit: 'deg', wrap: 360 });
    expect(act({ type: 'drumInput', patch: { wrapUnit: 'rad' as never } }).drum.wrapUnit).toBe('turns');
  });
  it('turns the weight field into a mass field and back, keeping the same body', () => {
    const m = act({ type: 'pullInput', patch: { massInput: true } });
    expect(m.pull.massInput).toBe(true);
    expect(m.pull.W).toBe(100); // 100 lbf weighs as 100 lb of mass in US units
    const si = act({ type: 'units', units: 'si' }, f0);
    const sm = act({ type: 'pullInput', patch: { massInput: true } }, si);
    expect(sm.pull.W).toBeCloseTo(si.pull.W / 9.80665, 3);
    expect(pullInput(sm).W).toBeCloseTo(pullInput(si).W, 3);
    const back = act({ type: 'pullInput', patch: { massInput: false } }, sm);
    expect(back.pull.W).toBeCloseTo(si.pull.W, 3);
    // Retyped together with the switch: taken as typed.
    expect(act({ type: 'pullInput', patch: { massInput: true, W: 55 } }, si).pull.W).toBe(55);
  });
  it('switches the force between lbf and kip (N and kN) by a factor of 1000, exactly and back', () => {
    const big = reduceCable({ ...f0, section: { ...f0.section, mbf: 12000 }, drum: { ...f0.drum, Tsmall: 25 } }, { type: 'force', force: 'large' });
    expect(big.forceUnit).toBe('large');
    expect(big.load.W).toBe(2);
    expect(big.section.mbf).toBe(12);
    expect(big.drum.Tbig).toBe(1);
    expect(big.drum.Tsmall).toBe(0.025);
    expect(big.pull.W).toBe(0.1);
    expect(reduceCable(big, { type: 'force', force: 'small' })).toEqual({ ...f0, section: { ...f0.section, mbf: 12000 }, drum: { ...f0.drum, Tsmall: 25 } });
    // A mass does not change with the force unit.
    const m = reduceCable({ ...f0, pull: { ...f0.pull, massInput: true } }, { type: 'force', force: 'large' });
    expect(m.pull.W).toBe(100);
    expect(reduceCable(f0, { type: 'force', force: 'bogus' as never })).toBe(f0);
  });
});

/* ── The address ───────────────────────────────────────────────────────── */

describe('the address', () => {
  it('is #k=', () => {
    expect(CABLE_KEY).toBe('k');
  });
  it('writes the default case and reads it back, exactly', () => {
    const f = defaultCase();
    const text = encodeCable(f);
    expect(text.startsWith('K')).toBe(true);
    expect(text.split(';')).toHaveLength(9);
    expect(decodeCable(text)).toEqual(f);
    // A pinned example (the format is versioned and links are kept by those they were sent to).
    expect(text.slice(text.indexOf(';') + 1)).toBe('1;us,s,l;d,s,,s,0.25,,29000,6.5,;;0,,;2000,0,2,60,l,10,60,r,10;100,0,0,0.5,0.4,30,,a,20;1000,,0.3,2,t');
  });
  it('is URL-safe and compact', () => {
    const text = encodeCable({ ...defaultCase(), load: { ...defaultCase().load, own2: defaultCase().section } });
    expect(text).toMatch(/^[A-Za-z0-9;,._+-]+$/);
    expect(encodeCable(defaultCase()).length).toBeLessThan(150);
  });
  it('reads back every form it wrote, over thousands of random forms (NaN, nulls, own section, any mode)', () => {
    const r = rng(61);
    for (let k = 0; k < 5000; k++) {
      const f = randomForm(r);
      const text = encodeCable(f);
      expect(text.length).toBeLessThanOrEqual(MAX_LINK);
      expect(decodeCable(text)).toEqual(f);
    }
  });
  it('is bounded: the longest form it can write is under MAX_LINK', () => {
    const w = -1.2345678e-21;
    const sec = { by: 'diameter' as const, d: w, A: w, rope: 'custom' as const, factor: w, material: 'custom' as const, E: w, alpha: w, mbf: w };
    const f: CableForm = {
      units: 'si',
      forceUnit: 'large',
      mode: 'drum',
      section: sec,
      dT: w,
      n: w,
      allowable: w,
      load: { W: w, H: w, legs: 2, leg1: { angle: w, side: 'right', length: w }, leg2: { angle: w, side: 'right', length: w }, own2: sec },
      pull: { W: w, massInput: true, theta: w, muS: w, muK: w, phi: w, accel: w, travel: 'against', length: w },
      drum: { Tbig: w, Tsmall: w, mu: w, wrap: w, wrapUnit: 'deg' },
    };
    const text = encodeCable(f);
    expect(text.length).toBeLessThan(MAX_LINK);
    expect(text.length).toBeGreaterThan(300);
    expect(decodeCable(text)).toEqual(f);
    expect(decodeCable(text + 'x'.repeat(MAX_LINK))).toBeNull();
  });
  it('gives null for any single character changed, added or removed anywhere (the check)', () => {
    const r = rng(62);
    const good = encodeCable({ ...defaultCase(), load: { ...defaultCase().load, own2: defaultCase().section } });
    const alphabet = '0123456789;,.-abcdefghijklmnopqrstuvwxyzKXe';
    for (let k = 0; k < 4000; k++) {
      const i = Math.floor(r() * good.length);
      const c = alphabet[Math.floor(r() * alphabet.length)];
      const kind = k % 3;
      const bad = kind === 0 ? good.slice(0, i) + c + good.slice(i + 1) : kind === 1 ? good.slice(0, i) + c + good.slice(i) : good.slice(0, i) + good.slice(i + 1);
      if (bad !== good) expect(decodeCable(bad)).toBeNull();
    }
    for (let i = 0; i < good.length; i++) expect(decodeCable(good.slice(0, i))).toBeNull();
  });
  it('gives null for the wrong shape even when the check is right', () => {
    const seal = (body: string) => `${checkOf(body)};${body}`;
    const ok = 'us,s,l;d,s,,s,0.25,,29000,6.5,;;0,,;2000,0,2,60,l,10,60,r,10;100,0,0,0.5,0.4,30,,a,20;1000,,0.3,2,t';
    expect(decodeCable(seal(`1;${ok}`))).not.toBeNull();
    const cases = [
      `2;${ok}`, // another version
      ok, // no version
      `1;${ok};extra`, // a ninth field
      `1;${ok.replace('us,s,l', 'xx,s,l')}`,
      `1;${ok.replace('us,s,l', 'us,s,z')}`,
      `1;${ok.replace('us,s,l', 'us,q,l')}`,
      `1;${ok.replace('d,s,,s,0.25', 'z,s,,s,0.25')}`, // by
      `1;${ok.replace('d,s,,s,0.25', 'd,#,,s,0.25')}`, // rope letter
      `1;${ok.replace('d,s,,s,0.25', 'd,s,,#,0.25')}`, // material letter
      `1;${ok.replace('0.25', '1/4')}`, // not the page's number
      `1;${ok.replace('0.25', '1e400')}`, // not finite
      `1;${ok.replace('0.25', '.25')}`,
      `1;${ok.replace(',2,60,l', ',3,60,l')}`, // legs
      `1;${ok.replace('60,l', '60,x')}`, // side
      `1;${ok.replace(';100,0,0', ';100,2,0')}`, // mass flag
      `1;${ok.replace(',a,20', ',x,20')}`, // travel
      `1;${ok.replace(',t', ',q')}`, // wrap unit
      `1;${ok.replace('2000,0,2', '2000,0')}`, // too few fields
      `1;${ok.replace('2000,0,2', '2000,0,2,9')}`, // too many
      `1;${ok.replace('2000', '')}`, // a required number missing
      `1;${ok.replace(';0,,;', ';0,;')}`, // design with two fields
    ];
    for (const body of cases) expect(decodeCable(seal(body)), body).toBeNull();
    // NaN and the named non-numbers are written and read back.
    const nan = decodeCable(seal(`1;${ok.replace('2000', 'nan')}`));
    expect(nan?.load.W).toBeNaN();
    expect(decodeCable('')).toBeNull();
    expect(decodeCable(';')).toBeNull();
  });
  it('never throws: 100,000 strings, random and damaged', () => {
    const r = rng(63);
    const alphabet = '0123456789;,.-+_eEnaKfs ulrdbtpgiocxz%é−';
    const base = encodeCable(defaultCase());
    let read = 0;
    for (let k = 0; k < 100000; k++) {
      let text: string;
      const m = k % 5;
      if (m === 0) text = Array.from({ length: Math.floor(r() * 120) }, () => alphabet[Math.floor(r() * alphabet.length)]).join('');
      else if (m === 1) text = base.slice(0, Math.floor(r() * base.length));
      else if (m === 2) {
        // A damaged body that is sealed again: the shape checks have to hold.
        const body = base.slice(base.indexOf(';') + 1).split('');
        for (let j = 0; j < 1 + Math.floor(r() * 3); j++) body[Math.floor(r() * body.length)] = alphabet[Math.floor(r() * alphabet.length)];
        text = `${checkOf(body.join(''))};${body.join('')}`;
      } else if (m === 3) text = `${checkOf(`1;${Array.from({ length: Math.floor(r() * 80) }, () => alphabet[Math.floor(r() * alphabet.length)]).join('')}`)};1;x`;
      else text = String.fromCharCode(...Array.from({ length: Math.floor(r() * 30) }, () => Math.floor(r() * 65536)));
      const f = decodeCable(text);
      if (f) {
        read++;
        // Whatever reads is a form that writes and reads again to itself.
        expect(decodeCable(encodeCable(f))).toEqual(f);
      }
    }
    // The fuzz is not vacuous: some damaged-but-sealed bodies are still a case.
    expect(read).toBeGreaterThan(50);
    for (const bad of [null, undefined, 5, {}, [], true] as unknown[]) expect(decodeCable(bad as string)).toBeNull();
  });
});

describe('the form reaches the engine', () => {
  it('solves the default case in each mode’s input builders, in both systems', () => {
    const f = defaultCase();
    const l = solveLoad(loadInput(f));
    expect(l.ok).toBe(true);
    for (const units of ['us', 'si'] as const) {
      const g = exampleOf('load', units);
      expect(solveLoad(loadInput(g)).ok).toBe(true);
    }
    expect(loadInput({ ...f, load: { ...f.load, legs: 1 } }).legs).toHaveLength(1);
    expect(loadInput(f).legs).toHaveLength(2);
    expect(pickOf(rng(1), [1])).toBe(1);
    expect(between(rng(1), 2, 3)).toBeGreaterThanOrEqual(2);
    expect(six(1.23456789)).toBe(1.23457);
  });
});

/* ── The reviewers' findings, held at the reducer: the sequences a visitor makes ──────── */

function solveDrumTsmall(f: CableForm): number {
  const i = drumInput(f);
  const ratio = Math.exp((i.mu as number) * (i.beta as number));
  return (i.Tbig as number) / ratio;
}

describe('B1 — the wrap field turned from turns to degrees (and back) keeps the same wrap', () => {
  const f0 = defaultCase(); // 2 turns
  it('2 turns is 720°, and back again, exactly', () => {
    const deg = reduceCable(f0, { type: 'drumInput', patch: { wrapUnit: 'deg' } });
    expect(deg.drum.wrap).toBe(720);
    expect(deg.drum.wrapUnit).toBe('deg');
    const turns = reduceCable(deg, { type: 'drumInput', patch: { wrapUnit: 'turns' } });
    expect(turns.drum.wrap).toBe(2);
    // The same case: the engine is given the same β either way (the reviewer: T small went from 23.05 to 989.58 lbf).
    expect(drumInput(deg).beta).toBeCloseTo(drumInput(f0).beta as number, 12);
    expect(solveDrumTsmall(deg)).toBeCloseTo(solveDrumTsmall(f0), 9);
    expect(solveDrumTsmall(f0)).toBeCloseTo(23.05, 2);
  });
  it('a wrap that does not divide evenly comes back to the very number it was (30° and a twelfth of a turn)', () => {
    let f = reduceCable(f0, { type: 'drumInput', patch: { wrapUnit: 'deg', wrap: 30 } });
    expect(f.drum.wrap).toBe(30);
    f = reduceCable(f, { type: 'drumInput', patch: { wrapUnit: 'turns' } });
    expect(f.drum.wrap).toBeCloseTo(1 / 12, 5);
    f = reduceCable(f, { type: 'drumInput', patch: { wrapUnit: 'deg' } });
    expect(f.drum.wrap).toBe(30);
  });
  it('a blank wrap stays blank, a wrap typed with the switch is what was typed, and the same unit changes nothing', () => {
    const blank = { ...f0, drum: { ...f0.drum, wrap: null } };
    expect(reduceCable(blank, { type: 'drumInput', patch: { wrapUnit: 'deg' } }).drum.wrap).toBeNull();
    expect(reduceCable(f0, { type: 'drumInput', patch: { wrapUnit: 'deg', wrap: 90 } }).drum.wrap).toBe(90);
    expect(reduceCable(f0, { type: 'drumInput', patch: { wrapUnit: 'turns' } })).toEqual(f0);
    const nan = { ...f0, drum: { ...f0.drum, wrap: Number.NaN } };
    expect(reduceCable(nan, { type: 'drumInput', patch: { wrapUnit: 'deg' } }).drum.wrap).toBeNaN();
  });
});

describe('B5 — the number of legs is a choice, and is solved in the render that shows it', () => {
  it('going from two legs to one (and back) changes the choices, though legs is a number', () => {
    const two = defaultCase();
    const one = reduceCable(two, { type: 'legs', legs: 1 });
    expect(choicesOf(one)).not.toBe(choicesOf(two));
    expect(choicesOf(reduceCable(one, { type: 'legs', legs: 2 }))).toBe(choicesOf(two));
  });
  it('typing a number does not change the choices; a unit, a mode, a list and a switch do', () => {
    const f = defaultCase();
    expect(choicesOf(reduceCable(f, { type: 'loadInput', patch: { W: 2500 } }))).toBe(choicesOf(f));
    expect(choicesOf(reduceCable(f, { type: 'leg', leg: 1, patch: { angle: 45 } }))).toBe(choicesOf(f));
    expect(choicesOf(reduceCable(f, { type: 'section', patch: { d: 0.5 } }))).toBe(choicesOf(f));
    expect(choicesOf(reduceCable(f, { type: 'mode', mode: 'pull' }))).not.toBe(choicesOf(f));
    expect(choicesOf(reduceCable(f, { type: 'units', units: 'si' }))).not.toBe(choicesOf(f));
    expect(choicesOf(reduceCable(f, { type: 'material', material: 'rope' }))).not.toBe(choicesOf(f));
    expect(choicesOf(reduceCable(f, { type: 'leg', leg: 2, patch: { side: 'left' } }))).not.toBe(choicesOf(f));
    expect(choicesOf(reduceCable(f, { type: 'own2', on: true }))).not.toBe(choicesOf(f));
  });
});

describe('B8 / B9 — a conversion comes back to the very number', () => {
  it('weight and mass in SI: 100 N is 10.1972 kg and is 100 N again, not 99.999999', () => {
    const si = reduceCable(exampleOf('pull', 'si'), { type: 'pullInput', patch: { W: 100 } });
    const mass = reduceCable(si, { type: 'pullInput', patch: { massInput: true } });
    expect(mass.pull.W).toBeCloseTo(10.1972, 4);
    expect(reduceCable(mass, { type: 'pullInput', patch: { massInput: false } }).pull.W).toBe(100);
    // In kN too.
    const kn = reduceCable(reduceCable(si, { type: 'force', force: 'large' }), { type: 'pullInput', patch: { massInput: true } });
    expect(reduceCable(kn, { type: 'pullInput', patch: { massInput: false } }).pull.W).toBeCloseTo(0.1, 12);
  });
  it('lbf and kip keep every figure a field can hold: 12,345.6789 lbf comes back as 12,345.6789', () => {
    let f = reduceCable(defaultCase(), { type: 'loadInput', patch: { W: 12345.6789, H: 0.123456789 } });
    f = reduceCable(f, { type: 'force', force: 'large' });
    expect(f.load.W).toBe(12.3456789);
    f = reduceCable(f, { type: 'force', force: 'small' });
    expect(f.load.W).toBe(12345.6789);
    expect(f.load.H).toBe(0.123456789);
    // A random sample of ordinary values.
    const r = rng(2024);
    for (let k = 0; k < 500; k++) {
      const w = Number(between(r, 1, 99999).toPrecision(1 + Math.floor(r() * 9)));
      const back = reduceCable(reduceCable(reduceCable(defaultCase(), { type: 'loadInput', patch: { W: w } }), { type: 'force', force: 'large' }), { type: 'force', force: 'small' });
      expect(back.load.W).toBe(w);
    }
  });
});

describe('the material and the rope: a locked-coil rope has its own', () => {
  it('picking the locked-coil rope sets the factor and a material that pairs with it', () => {
    const f = reduceCable(defaultCase(), { type: 'rope', rope: 'locked' });
    expect(f.section.factor).toBe(0.66);
    const m = reduceCable(f, { type: 'material', material: 'rope-locked' });
    expect(m.section.E).toBe(23200);
    expect(reduceCable(m, { type: 'units', units: 'si' }).section.E).toBe(160);
    // The address carries it, and an old address that had a locked-coil rope on the spiral material still reads.
    expect(decodeCable(encodeCable(m))).toEqual(m);
    const spiralMat = reduceCable(f, { type: 'material', material: 'rope-spiral' });
    expect(decodeCable(encodeCable(spiralMat))).toEqual(spiralMat);
  });
});

describe('leg 2 section survives being taken off and put back', () => {
  it('off and on again gives back the section that was typed, not a fresh copy', () => {
    let f = reduceCable(defaultCase(), { type: 'own2', on: true });
    f = reduceCable(f, { type: 'section', patch: { d: 0.5 }, target: 'leg2' });
    f = reduceCable(f, { type: 'material', material: 'rope', target: 'leg2' });
    const typed = f.load.own2 as NonNullable<typeof f.load.own2>;
    const off = reduceCable(f, { type: 'own2', on: false });
    expect(off.load.own2).toBeNull();
    expect(reduceCable(off, { type: 'own2', on: true }).load.own2).toEqual(off.section); // nothing remembered: the shared one
    const back = reduceCable(off, { type: 'own2', on: true, restore: typed });
    expect(back.load.own2).toEqual(typed);
    expect(back.load.own2).not.toBe(typed);
  });
});
