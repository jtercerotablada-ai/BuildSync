/**
 * CSA S16-14 — Steel I-Beam Design (Limit States Design).
 * SI units throughout the solver: force = N, stress = MPa (= N/mm²),
 * length = mm, moment = N·mm.  E = 200 000 MPa, G = 77 000 MPa, φ = 0.90.
 * (The UI converts to kN, kN·m, m for display.)
 *
 * Scope: hot-rolled doubly-symmetric I-sections (W, S) as flexural members.
 * Limit states: section classification (Cl. 11.2 / Table 1), flexural
 * resistance incl. lateral-torsional buckling (Cl. 13.5 / 13.6), shear
 * resistance (Cl. 13.4.1.1) and serviceability deflection.
 *
 * Validated against CISC Handbook of Steel Construction values — see
 * csaS16.selftest.ts.
 */

export const E = 200000; // MPa
export const Gsteel = 77000; // MPa
export const PHI = 0.9; // structural steel resistance factor (Cl. 13.1)

export type IFamily = 'W' | 'S';
export type SectionClass = 1 | 2 | 3 | 4;

/** All geometric properties in base SI: mm, mm², mm³, mm⁴, mm⁶. */
export interface CsaSection {
  designation: string; // CISC metric label, e.g. "W360×64"
  imperial: string;    // AISC imperial label, e.g. "W14×43"
  family: IFamily;
  mass: number;        // kg/m
  A: number;           // mm²
  d: number;           // mm  (overall depth)
  h: number;           // mm  (clear web depth for h/w classification & shear)
  bf: number;          // mm  (flange width)
  tf: number;          // mm  (flange thickness)
  tw: number;          // mm  (web thickness)
  Ix: number; Sx: number; Zx: number; rx: number;
  Iy: number; Sy: number; Zy: number; ry: number;
  J: number;           // mm⁴  (St-Venant torsion constant)
  Cw: number;          // mm⁶  (warping constant)
}

export interface CsaMaterial {
  Fy: number; // MPa
  Fu: number; // MPa
}

export type DeflCase = 'ss-udl' | 'ss-point' | 'cant-udl' | 'cant-point';

export interface BeamInputs {
  section: CsaSection;
  material: CsaMaterial;
  Lb: number;          // laterally unbraced length, mm
  omega2: number;      // moment-gradient factor ω₂ (1.0 … 2.5)
  a: number;           // transverse stiffener spacing, mm (0 = unstiffened web)
  // Factored demands (ULS)
  Mf: number;          // factored bending moment, N·mm
  Vf: number;          // factored shear, N
  // Serviceability (specified / unfactored)
  deflCase: DeflCase;
  wService: number;    // service UDL, N/mm  (for *-udl cases)
  Pservice: number;    // service point load, N (for *-point cases)
  Lspan: number;       // span for the deflection calc, mm
  deflDen: number;     // deflection limit denominator, e.g. 360 → L/360
}

/* ── classification (Cl. 11.2, Table 1 — flexure) ─────────────────────── */
export interface Classification {
  flangeBT: number; webHW: number;
  flangeClass: SectionClass; webClass: SectionClass;
  overall: SectionClass;
  flangeLimits: [number, number, number]; // class 1/2/3 b/t limits
  webLimits: [number, number, number];    // class 1/2/3 h/w limits
}

export function classify(s: CsaSection, Fy: number): Classification {
  const rt = Math.sqrt(Fy);
  // projecting flange element (b = half flange width), Cf = 0 for pure flexure
  const flangeBT = s.bf / 2 / s.tf;
  const fL: [number, number, number] = [145 / rt, 170 / rt, 200 / rt];
  const flangeClass = (flangeBT <= fL[0] ? 1 : flangeBT <= fL[1] ? 2 : flangeBT <= fL[2] ? 3 : 4) as SectionClass;
  // web in flexural compression (both edges supported), Cf = 0
  const webHW = s.h / s.tw;
  const wL: [number, number, number] = [1100 / rt, 1700 / rt, 1900 / rt];
  const webClass = (webHW <= wL[0] ? 1 : webHW <= wL[1] ? 2 : webHW <= wL[2] ? 3 : 4) as SectionClass;
  const overall = Math.max(flangeClass, webClass) as SectionClass;
  return { flangeBT, webHW, flangeClass, webClass, overall, flangeLimits: fL, webLimits: wL };
}

/* ── flexure incl. LTB (Cl. 13.5 / 13.6) ──────────────────────────────── */
export interface FlexureResult {
  clause: string;
  Mp: number; My: number;      // N·mm (nominal)
  Mu: number;                  // N·mm  elastic critical moment (13.6)
  MrSection: number;           // φ·Mp or φ·My or φ·Se·Fy  (cross-section cap)
  MrLTB: number;               // 13.6 LTB-reduced
  Mr: number;                  // governing φ·Mn (min)
  ltbMode: 'none' | 'inelastic' | 'elastic';
  basis: 'Mp' | 'My' | 'Se';
  governs: 'Yielding' | 'LTB';
  classNote?: string;
}

/** Effective section modulus for a Class-4 section (rare for rolled shapes):
 *  knock the modulus down by the worst slender element's overshoot past its
 *  Class-3 limit. Conservative stand-in for Cl. 13.5(c) — flagged in the UI.
 *  Handles a slender flange OR web (never reached by standard rolled W/S). */
function effectiveSx(s: CsaSection, cls: Classification): number {
  let ratio = 1;
  if (cls.flangeClass === 4) ratio = Math.min(ratio, cls.flangeLimits[2] / (s.bf / 2 / s.tf));
  if (cls.webClass === 4) ratio = Math.min(ratio, cls.webLimits[2] / (s.h / s.tw));
  return s.Sx * Math.max(0.3, Math.min(1, ratio));
}

export function flexure(s: CsaSection, Fy: number, Lb: number, omega2: number, cls: Classification): FlexureResult {
  const Mp = s.Zx * Fy;
  const My = s.Sx * Fy;
  const c = cls.overall;
  const Me = (c === 4 ? effectiveSx(s, cls) : s.Sx) * Fy; // effective yield moment (Class 4)

  let MrSection: number; let basis: FlexureResult['basis']; let classNote: string | undefined;
  if (c <= 2) { MrSection = PHI * Mp; basis = 'Mp'; }
  else if (c === 3) { MrSection = PHI * My; basis = 'My'; }
  else { MrSection = PHI * Me; basis = 'Se'; classNote = 'Class 4 — effective section (verify per Cl. 13.5(c))'; }

  // Reference moment for the 13.6 LTB branches — consistent with MrSection:
  // Mp (Class 1&2), My (Class 3), effective Me (Class 4).
  const Mref = c <= 2 ? Mp : c === 3 ? My : Me;
  // Elastic critical moment (13.6): doubly-symmetric section
  const Mu = (omega2 * Math.PI / Lb) *
    Math.sqrt(E * s.Iy * Gsteel * s.J + Math.pow(Math.PI * E / Lb, 2) * s.Iy * s.Cw);

  let MrLTB: number; let ltbMode: FlexureResult['ltbMode'];
  if (Mu > 0.67 * Mref) {
    MrLTB = 1.15 * PHI * Mref * (1 - 0.28 * Mref / Mu);
    ltbMode = 'inelastic';
  } else {
    MrLTB = PHI * Mu;
    ltbMode = 'elastic';
  }
  MrLTB = Math.min(MrLTB, MrSection); // never exceed the cross-section resistance
  const Mr = Math.min(MrSection, MrLTB);
  const governs = MrLTB < MrSection - 1 ? 'LTB' : 'Yielding';
  const clause = governs === 'LTB' ? `13.6(${c <= 2 ? 'a' : 'b'})` : `13.5(${c <= 2 ? 'a' : c === 3 ? 'b' : 'c'})`;
  return { clause, Mp, My, Mu, MrSection, MrLTB, Mr, ltbMode: governs === 'Yielding' ? 'none' : ltbMode, basis, governs, classNote };
}

/* ── shear (Cl. 13.4.1.1) ─────────────────────────────────────────────── */
export interface ShearResult {
  clause: string;
  hw: number; kv: number; Fs: number; Aw: number;
  Vr: number;                 // N
  mode: string;
  stiffened: boolean;
}

export function shear(s: CsaSection, Fy: number, a: number): ShearResult {
  const hw = s.h / s.tw;
  const stiffened = a > 0;
  let kv: number;
  if (!stiffened) kv = 5.34;
  else { const ah = a / s.h; kv = ah < 1 ? 4 + 5.34 / (ah * ah) : 5.34 + 4 / (ah * ah); }

  const b1 = 439 * Math.sqrt(kv / Fy);
  const b2 = 502 * Math.sqrt(kv / Fy);
  const b3 = 621 * Math.sqrt(kv / Fy);
  const Fcri = 290 * Math.sqrt(Fy * kv) / hw;
  const Fcre = 180000 * kv / (hw * hw);
  const ka = stiffened ? 1 / Math.sqrt(1 + Math.pow(a / s.h, 2)) : 0;

  let Fs: number; let mode: string;
  if (hw <= b1) { Fs = 0.66 * Fy; mode = 'Shear yield (0.66Fy)'; }
  else if (hw <= b2) { Fs = Fcri; mode = 'Inelastic buckling'; }
  else if (hw <= b3) {
    Fs = stiffened ? Fcri + ka * (0.5 * Fy - 0.866 * Fcri) : Fcri;
    mode = stiffened ? 'Inelastic + tension field' : 'Inelastic buckling';
  } else {
    Fs = stiffened ? Fcre + ka * (0.5 * Fy - 0.866 * Fcre) : Fcre;
    mode = stiffened ? 'Elastic + tension field' : 'Elastic buckling';
  }
  const Aw = s.d * s.tw;      // shear area of a rolled I-section (overall depth × web)
  const Vr = PHI * Aw * Fs;   // N
  return { clause: '13.4.1.1', hw, kv, Fs, Aw, Vr, mode, stiffened };
}

/* ── serviceability deflection ────────────────────────────────────────── */
export interface DeflResult {
  delta: number;      // mm
  limit: number;      // mm
  ratioSpan: number;  // L / delta  (reported as span/δ)
  utilisation: number; // delta / limit
  formula: string;
}

export function deflection(inp: BeamInputs): DeflResult {
  const { section: s, Lspan: L, deflCase, wService: w, Pservice: P, deflDen } = inp;
  const I = s.Ix; let delta: number; let formula: string;
  switch (deflCase) {
    case 'ss-udl': delta = 5 * w * Math.pow(L, 4) / (384 * E * I); formula = '5wL⁴/384EI'; break;
    case 'ss-point': delta = P * Math.pow(L, 3) / (48 * E * I); formula = 'PL³/48EI'; break;
    case 'cant-udl': delta = w * Math.pow(L, 4) / (8 * E * I); formula = 'wL⁴/8EI'; break;
    case 'cant-point': delta = P * Math.pow(L, 3) / (3 * E * I); formula = 'PL³/3EI'; break;
  }
  const limit = L / deflDen;
  return { delta, limit, ratioSpan: delta > 0 ? L / delta : Infinity, utilisation: limit > 0 ? delta / limit : 0, formula };
}

/* ── top-level analysis ───────────────────────────────────────────────── */
export interface BeamResult {
  classification: Classification;
  flexure: FlexureResult;
  shear: ShearResult;
  deflection: DeflResult;
  flexUtil: number;
  shearUtil: number;
  deflUtil: number;
  governing: { name: string; ratio: number };
  pass: boolean;
}

export function analyzeBeam(inp: BeamInputs): BeamResult {
  const { section: s, material, Lb, omega2, a, Mf, Vf } = inp;
  const cls = classify(s, material.Fy);
  const fx = flexure(s, material.Fy, Lb, omega2, cls);
  const sh = shear(s, material.Fy, a);
  const df = deflection(inp);

  const flexUtil = Mf / fx.Mr;
  const shearUtil = Vf / sh.Vr;
  const deflUtil = df.utilisation;

  const checks = [
    { name: 'Flexure (Mf/Mr)', ratio: flexUtil },
    { name: 'Shear (Vf/Vr)', ratio: shearUtil },
    { name: 'Deflection (δ/δlim)', ratio: deflUtil },
  ];
  const governing = checks.reduce((a2, b) => (b.ratio > a2.ratio ? b : a2));
  return { classification: cls, flexure: fx, shear: sh, deflection: df, flexUtil, shearUtil, deflUtil, governing, pass: governing.ratio <= 1.0 };
}
