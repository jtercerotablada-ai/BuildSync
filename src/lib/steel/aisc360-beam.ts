// AISC 360-16 I-beam design wrapper — assembles the validated aisc360.ts
// engine (classify · flexureMajor Ch F · shearMajor Ch G) into a beam check
// with elastic deflection (serviceability) and the governing utilisation.
// US customary throughout: kips, kip·in, ksi, in.

import {
  classify, flexureMajor, shearMajor, E,
  type SteelSection, type SteelMaterial, type MemberInputs,
  type FlexureResult, type LimitCheck, type Slenderness, type ShapeClass,
} from './aisc360';

export type DeflCase = 'ss-udl' | 'ss-point' | 'cant-udl' | 'cant-point';

export interface BeamInputs {
  section: SteelSection;
  material: SteelMaterial;
  Lb: number;    // laterally unbraced length (in)
  Cb: number;    // LTB modification factor (F1)
  Mu: number;    // factored major-axis moment demand (kip·in)
  Vu: number;    // factored shear demand (kip)
  deflCase: DeflCase;
  wService: number; // service distributed load (kip/in)
  Pservice: number; // service point load (kip)
  Lspan: number;    // deflection span (in)
  deflDen: number;  // deflection limit denominator (L/den)
}

export interface DeflResult {
  delta: number;    // in
  limit: number;    // in
  ratioSpan: number; // L/δ
  formula: string;
}

export interface BeamResult {
  classification: Slenderness;
  overallClass: ShapeClass;
  flexure: FlexureResult;
  shear: LimitCheck;
  deflection: DeflResult;
  flexUtil: number;
  shearUtil: number;
  deflUtil: number;
  governing: { name: string; ratio: number };
}

/** Worst flexural element class (F yielding requires both flange & web compact). */
export function overallFlexClass(sl: Slenderness): ShapeClass {
  const rank = (c: ShapeClass) => (c === 'compact' ? 0 : c === 'noncompact' ? 1 : 2);
  return rank(sl.flangeClassFlex) >= rank(sl.webClassFlex) ? sl.flangeClassFlex : sl.webClassFlex;
}

function memberOf(inp: BeamInputs): MemberInputs {
  return {
    section: inp.section, material: inp.material,
    Lcx: inp.Lb, Lcy: inp.Lb, Lcz: inp.Lb, Lb: inp.Lb, Cb: inp.Cb,
    An: inp.section.A, U: 1, Pu: 0, Mux: inp.Mu, Muy: 0, Vu: inp.Vu,
  };
}

/** Max elastic deflection under the service load (E in ksi, all lengths in). */
export function beamDeflection(c: DeflCase, w: number, P: number, L: number, I: number): { delta: number; formula: string } {
  const EI = E * I;
  switch (c) {
    case 'ss-udl':    return { delta: (5 * w * L ** 4) / (384 * EI), formula: '5wL⁴/384EI' };
    case 'ss-point':  return { delta: (P * L ** 3) / (48 * EI), formula: 'PL³/48EI' };
    case 'cant-udl':  return { delta: (w * L ** 4) / (8 * EI), formula: 'wL⁴/8EI' };
    case 'cant-point':return { delta: (P * L ** 3) / (3 * EI), formula: 'PL³/3EI' };
  }
}

export function analyzeBeam(inp: BeamInputs): BeamResult {
  const mi = memberOf(inp);
  const classification = classify(inp.section, inp.material.Fy);
  const overallClass = overallFlexClass(classification);
  const flexure = flexureMajor(mi);
  const shear = shearMajor(mi);

  const d = beamDeflection(inp.deflCase, inp.wService, inp.Pservice, inp.Lspan, inp.section.Ix);
  const limit = inp.deflDen > 0 ? inp.Lspan / inp.deflDen : 0;
  const deflection: DeflResult = {
    delta: d.delta,
    limit,
    ratioSpan: d.delta > 1e-9 ? inp.Lspan / d.delta : Infinity,
    formula: d.formula,
  };

  const flexUtil = flexure.phiRn > 0 ? inp.Mu / flexure.phiRn : Infinity;
  const shearUtil = shear.phiRn > 0 ? inp.Vu / shear.phiRn : Infinity;
  const deflUtil = limit > 0 ? d.delta / limit : 0;

  const cands = [
    { name: 'Flexure', ratio: flexUtil },
    { name: 'Shear', ratio: shearUtil },
    { name: 'Deflection', ratio: deflUtil },
  ];
  const governing = cands.reduce((a, b) => (b.ratio > a.ratio ? b : a));

  return { classification, overallClass, flexure, shear, deflection, flexUtil, shearUtil, deflUtil, governing };
}
