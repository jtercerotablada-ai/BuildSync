/**
 * AISC 360-16 — Steel Angle Design (LRFD), single (L) and double (2L) angles.
 * Imperial units: force = kips, stress = ksi, length = in, moment = kip·in.
 * E = 29000 ksi, G = 11200 ksi.
 *
 * Limit states:
 *  · Tension  (Ch. D): D2 yielding (φ=0.90) + rupture (φ=0.75), D3 shear-lag U.
 *  · Compression (Ch. E): single angle via E5 effective slenderness → E3, E7
 *    slender legs; double angle via E3 (x, flexural) + E4 (y, flexural-torsional)
 *    with E6 built-up modified slenderness.
 *  · Flexure (F10 single, F9 double): yielding, LTB, leg local buckling.
 *
 * Validated against AISC Design Examples v15 (D.2, E.5/E.6, F.11A/B/C, F9) —
 * see aiscAngle.selftest.ts.  Block shear (J4.3) and H2 biaxial interaction are
 * out of scope and flagged for separate checking.
 */

export const E = 29000; // ksi
export const Gsteel = 11200; // ksi
export const PHI_Y = 0.9;   // tensile yielding, compression, flexure
export const PHI_R = 0.75;  // tensile rupture

/* ── section types (from angle-shapes.json) ───────────────────────────── */
export interface AngleSingle {
  designation: string; family: 'L'; weight: number;
  A: number; d: number; b: number; t: number; x: number; y: number;
  Ix: number; Sx: number; Zx: number; rx: number;
  Iy: number; Sy: number; Zy: number; ry: number;
  Iz: number; rz: number; Sz: number;
  J: number; Cw: number; ro: number; H: number | null; tanAlpha: number;
  SwA: number | null; SwB: number | null; SwC: number | null;
  SzA: number | null; SzB: number | null; SzC: number | null;
  equalLeg: boolean;
}
export interface AngleDouble {
  designation: string; family: '2L'; base: string;
  orientation: 'equal' | 'LLBB' | 'SLBB'; gap: string; weight: number;
  A: number; d: number; b: number; t: number; y: number;
  Ix: number; Sx: number; Zx: number; rx: number;
  Iy: number; Sy: number; Zy: number; ry: number;
  ro: number; H: number | null;
  J2: number | null; rzSingle: number | null; tSingle: number | null;
  legLong: number | null; legShort: number | null; equalLeg: boolean;
}

export interface Material { Fy: number; Fu: number; } // ksi

/* β_w (Table C-F10.1), keyed "long×short" nominal legs (in). Equal-leg = 0.
 * Magnitude for SHORT-leg-in-compression (positive); negate for long-leg comp. */
const BETA_W: Record<string, number> = {
  '8x6': 3.31, '8x4': 5.48, '7x4': 4.37, '6x4': 3.14, '6x3.5': 3.69,
  '5x3.5': 2.40, '5x3': 2.99, '4x3.5': 0.87, '4x3': 1.65, '3.5x3': 0.87,
  '3.5x2.5': 1.62, '3x2.5': 0.86, '3x2': 1.56, '2.5x2': 0.85, '2.5x1.5': 1.49,
};
/** parse nominal legs from an L designation, e.g. "L6X4X1/2" → [6,4] */
function nominalLegs(desig: string): [number, number] {
  const m = /^L(\d+(?:-\d+\/\d+)?(?:\.\d+)?)X(\d+(?:-\d+\/\d+)?(?:\.\d+)?)/i.exec(desig);
  const parse = (s: string) => { const p = s.split('-'); let v = 0; for (const q of p) { if (q.includes('/')) { const [a, b] = q.split('/'); v += (+a) / (+b); } else v += +q; } return v; };
  return m ? [parse(m[1]), parse(m[2])] : [0, 0];
}
export function betaW(single: AngleSingle, shortLegCompression: boolean): number {
  if (single.equalLeg) return 0;
  const [lg, sh] = nominalLegs(single.designation);
  const key = `${lg}x${sh}`.replace(/\.0\b/g, '');
  const mag = BETA_W[key];
  if (mag == null) return NaN; // untabulated → caller flags
  return shortLegCompression ? mag : -mag;
}

/* ── E3 flexural-buckling critical stress ─────────────────────────────── */
export function fcrE3(KLr: number, Fy: number): { Fe: number; Fcr: number; inelastic: boolean } {
  const Fe = (Math.PI ** 2 * E) / (KLr * KLr);
  const inelastic = KLr <= 4.71 * Math.sqrt(E / Fy); // ⇔ Fe ≥ 0.44 Fy
  const Fcr = inelastic ? Math.pow(0.658, Fy / Fe) * Fy : 0.877 * Fe;
  return { Fe, Fcr, inelastic };
}

/* ── E7 slender-leg effective area (unstiffened elements, c1=0.22,c2=1.49) ─ */
function effectiveAreaLegs(legs: { b: number; t: number }[], Fy: number, Fcr: number): { Ae: number; slender: boolean } {
  const lambda_r = 0.45 * Math.sqrt(E / Fy);
  let dA = 0; let slender = false;
  for (const leg of legs) {
    const lam = leg.b / leg.t;
    if (lam <= lambda_r * Math.sqrt(Fy / Fcr)) continue; // effective full width
    slender = true;
    const Fel = Math.pow(1.49 * lambda_r / lam, 2) * Fy; // c2=1.49
    const be = leg.b * (1 - 0.22 * Math.sqrt(Fel / Fcr)) * Math.sqrt(Fel / Fcr); // c1=0.22
    dA += (leg.b - Math.max(0, Math.min(be, leg.b))) * leg.t;
  }
  return { Ae: dA, slender };
}

/* ── TENSION (Ch. D) ──────────────────────────────────────────────────── */
export type ConnType = 'bolted' | 'welded';
export interface TensionInputs {
  conn: ConnType;
  boltDia: number;      // in (bolted)
  nPerLine: number;     // fasteners per gage line (bolted)
  connLength: number;   // l: (n-1)·pitch bolted, or weld length welded (in)
  connectedLegLong: boolean; // connected through the long leg?
}
export interface TensionResult {
  clause: string;
  phiPy: number; phiPr: number; phiPn: number;
  governs: 'Yielding' | 'Rupture';
  U: number; An: number; Ae: number; xbar: number;
  note: string;
}
export function tension(sec: AngleSingle | AngleDouble, mat: Material, t: TensionInputs): TensionResult {
  const isDouble = sec.family === '2L';
  const nAng = isDouble ? 2 : 1;
  const Aone = isDouble ? sec.A / 2 : sec.A;
  const Ag = sec.A;
  // connection eccentricity xbar = centroid distance from the connected leg's back
  const single = isDouble ? null : (sec as AngleSingle);
  let xbar: number;
  if (single) xbar = t.connectedLegLong ? single.x : single.y; // eccentricity ⟂ connected leg: x for long leg, y for short
  else { const legL = (sec as AngleDouble).legLong ?? 0, legS = (sec as AngleDouble).legShort ?? 0; xbar = (sec as AngleDouble).y ?? 0; if (legL && legS) xbar = (sec as AngleDouble).y ?? 0; }
  const tLeg = isDouble ? ((sec as AngleDouble).tSingle ?? sec.t) : sec.t;

  // net area of ONE angle
  let Uone: number, Anone: number;
  const U2 = t.connLength > 0 ? 1 - xbar / t.connLength : 0; // Case 2
  if (t.conn === 'bolted') {
    const dhEff = t.boltDia + 0.125; // std hole d+1/16 + B4.3b 1/16
    Anone = Aone - dhEff * tLeg;     // one gage line, one hole
    const U8 = t.nPerLine >= 4 ? 0.6 : 0.8; // Case 8
    Uone = Math.max(U2, U8);
  } else {
    Anone = Aone; // welded: no holes
    Uone = U2;    // Case 8 not permitted for welded
  }
  const An = Anone * nAng;
  const Ae = Anone * Uone * nAng;

  const phiPy = PHI_Y * mat.Fy * Ag;
  const phiPr = PHI_R * mat.Fu * Ae;
  const governs = phiPy <= phiPr ? 'Yielding' : 'Rupture';
  return {
    clause: governs === 'Yielding' ? 'D2(a)' : 'D2(b)',
    phiPy, phiPr, phiPn: Math.min(phiPy, phiPr), governs,
    U: Uone, An, Ae, xbar,
    note: 'Check block shear (J4.3) separately — it can govern at the connection.',
  };
}

/* ── COMPRESSION — SINGLE angle via E5 effective slenderness ──────────── */
export type TrussType = 'planar' | 'box';
export interface CompSingleInputs {
  L: number;            // length between work points (in)
  truss: TrussType;     // planar/individual vs box/space
  connectedLegLong: boolean;
}
export interface CompSingleResult {
  clause: string;
  KLreff: number; Fe: number; Fcr: number; Ae: number; slender: boolean;
  phiPn: number; note: string; valid: boolean;
}
export function compressionSingle(sec: AngleSingle, mat: Material, ci: CompSingleInputs): CompSingleResult {
  const bl = Math.max(sec.d, sec.b), bs = Math.min(sec.d, sec.b);
  const ratio = bl / bs;
  // r about the geometric axis PARALLEL to the connected leg. The long leg is
  // parallel to the minor (y) axis (that is why Ix/rx is the larger value), so a
  // long-leg connection uses ry and a short-leg connection uses rx.
  const rGeom = ci.connectedLegLong ? sec.ry : sec.rx;
  const Lr = ci.L / rGeom;
  let KLreff: number;
  if (ci.truss === 'planar') KLreff = Lr <= 80 ? 72 + 0.75 * Lr : 32 + 1.25 * Lr;
  else KLreff = Lr <= 75 ? 60 + 0.8 * Lr : 45 + Lr;
  // short-leg-connected modifier (unequal legs, connected through the shorter leg)
  const shortConnected = !sec.equalLeg && !ci.connectedLegLong;
  if (shortConnected) KLreff = Math.max(KLreff + 4 * (ratio * ratio - 1), 0.95 * (ci.L / sec.rz));
  const valid = ratio < 1.7 && KLreff <= 200;

  const { Fe, Fcr } = fcrE3(KLreff, mat.Fy);
  const { Ae: dA, slender } = effectiveAreaLegs([{ b: sec.d, t: sec.t }, { b: sec.b, t: sec.t }], mat.Fy, Fcr);
  const Aeff = sec.A - dA;
  const phiPn = PHI_Y * Fcr * Aeff;
  return {
    clause: ci.truss === 'planar' ? 'E5-1/E5-2' : 'E5-3/E5-4', KLreff, Fe, Fcr, Ae: Aeff, slender, phiPn,
    valid, note: valid ? (slender ? 'Slender leg(s): E7 effective area applied.' : '') : 'Outside E5 scope (b_l/b_s ≥ 1.7 or (Lc/r)eff > 200) — verify by E3 about rz + E4 FTB.',
  };
}

/* ── COMPRESSION — DOUBLE angle: E3 (x) + E4 FTB (y) with E6 ───────────── */
export interface CompDoubleInputs {
  Lcx: number; Lcy: number;   // effective lengths (in)
  connSpacing: number;        // a: connector spacing (in); 0 → single connector-less (use Lcy)
  connWelded: boolean;        // welded/pretensioned (E6-2) vs snug-tight (E6-1)
}
export interface CompDoubleResult {
  clause: string;
  xAxis: { KLr: number; Fcr: number; phiPn: number };
  yAxisFTB: { KLrm: number; Fey: number; Fez: number; Fe: number; Fcr: number; phiPn: number };
  governing: 'x-flexural' | 'y-flexural-torsional';
  Ae: number; slender: boolean; phiPn: number;
}
export function compressionDouble(sec: AngleDouble, mat: Material, ci: CompDoubleInputs): CompDoubleResult {
  const Ag = sec.A, ri = sec.rzSingle ?? sec.ry, J = sec.J2 ?? 0, ro = sec.ro, Hh = sec.H ?? 1;
  // x-axis: pure flexural, no E6
  const KLrx = ci.Lcx / sec.rx;
  const fx = fcrE3(KLrx, mat.Fy);
  // y-axis: E6 modified slenderness, then E4 flexural-torsional
  const KLry = ci.Lcy / sec.ry;
  let KLrm = KLry;
  if (ci.connSpacing > 0) {
    const ari = ci.connSpacing / ri;
    if (!ci.connWelded) KLrm = Math.sqrt(KLry * KLry + ari * ari);
    else if (ari > 40) KLrm = Math.sqrt(KLry * KLry + Math.pow(0.5 * ari, 2)); // Ki=0.50 angles b-to-b
  }
  const Fey = (Math.PI ** 2 * E) / (KLrm * KLrm);
  const Fez = (Gsteel * J) / (Ag * ro * ro);
  const Fe = ((Fey + Fez) / (2 * Hh)) * (1 - Math.sqrt(Math.max(0, 1 - (4 * Fey * Fez * Hh) / Math.pow(Fey + Fez, 2))));
  const inelasticY = mat.Fy / Fe <= 2.25;
  const FcrY = inelasticY ? Math.pow(0.658, mat.Fy / Fe) * mat.Fy : 0.877 * Fe;
  // slender legs (both legs of both angles, unstiffened) — reduce with the governing Fcr
  const govFcr = Math.min(fx.Fcr, FcrY);
  const { Ae: dA, slender } = effectiveAreaLegs([{ b: sec.d, t: sec.t }, { b: sec.b, t: sec.t }], mat.Fy, govFcr);
  const Aeff = Ag - 2 * dA; // two angles
  const xPhi = PHI_Y * fx.Fcr * Aeff;
  const yPhi = PHI_Y * FcrY * Aeff;
  const governing = xPhi <= yPhi ? 'x-flexural' : 'y-flexural-torsional';
  return {
    clause: 'E3 / E4 / E6',
    xAxis: { KLr: KLrx, Fcr: fx.Fcr, phiPn: xPhi },
    yAxisFTB: { KLrm, Fey, Fez, Fe, Fcr: FcrY, phiPn: yPhi },
    governing, Ae: Aeff, slender, phiPn: Math.min(xPhi, yPhi),
  };
}

/* ── FLEXURE — SINGLE angle (F10) ─────────────────────────────────────── */
export type BendAxis = 'geometric' | 'principal-w' | 'principal-z';
export interface FlexSingleInputs {
  axis: BendAxis; Lb: number; Cb: number;
  restrained: boolean;         // lateral restraint at max-moment point (geometric)
  shortLegCompression: boolean; // which toe is in compression (principal-w β_w sign)
}
export interface FlexSingleResult {
  clause: string;
  My: number; Mcr: number | null; Mn: number; phiMn: number;
  governs: 'Yielding' | 'LTB' | 'Leg local buckling';
  valid: boolean; // false → geometric-axis bending of an unequal-leg angle (use principal axes)
  note: string;
}
function legLocalBucklingMn(bt: number, Fy: number, Sc: number): { Mn: number; governs: boolean } {
  const lam_p = 0.54 * Math.sqrt(E / Fy), lam_r = 0.91 * Math.sqrt(E / Fy);
  if (bt <= lam_p) return { Mn: Infinity, governs: false }; // compact — no LLB limit
  if (bt <= lam_r) return { Mn: Fy * Sc * (2.43 - 1.72 * bt * Math.sqrt(Fy / E)), governs: true };
  const Fcr = 0.71 * E / (bt * bt);
  return { Mn: Fcr * Sc, governs: true };
}
export function flexureSingle(sec: AngleSingle, mat: Material, fi: FlexSingleInputs): FlexSingleResult {
  const Fy = mat.Fy, Cb = Math.min(fi.Cb, 1.5), Lb = fi.Lb, bt = sec.b / sec.t;
  let My: number, Mcr: number | null = null, MnLTB = Infinity, note = '';
  let Sc: number; // modulus to compression toe for leg local buckling

  if (fi.axis === 'geometric') {
    if (!sec.equalLeg) { note = 'Geometric-axis bending of unequal-leg angles must be resolved into principal components (H2) — use principal axes.'; }
    const Sgeom = sec.Sx;
    My = Fy * Sgeom;                       // F10-1 yielding (full)
    Sc = 0.80 * Sgeom;                     // compression-toe modulus (equal-leg geometric)
    // F10-5a (max compression at toe): '-1' branch
    const f = Lb * sec.t / (sec.b * sec.b);
    let McrBase = (0.58 * E * Math.pow(sec.b, 4) * sec.t * Cb / (Lb * Lb)) * (Math.sqrt(1 + 0.88 * f * f) - 1);
    const MyLTB = fi.restrained ? Fy * Sgeom : 0.80 * Fy * Sgeom;
    if (fi.restrained) McrBase *= 1.25;
    Mcr = McrBase;
    MnLTB = ltbMn(MyLTB, Mcr);
  } else if (fi.axis === 'principal-w') {
    const Sw = sec.SwC ?? sec.SwA ?? sec.Sx;      // major-axis modulus (comp toe)
    My = Fy * Sw;
    Sc = Sw;
    const bw = betaW(sec, fi.shortLegCompression);
    if (Number.isNaN(bw)) { note = 'β_w not tabulated for this unequal-leg size — major-axis LTB requires a manual β_w.'; Mcr = null; MnLTB = Infinity; }
    else {
      const k = bw * sec.rz / (Lb * sec.t);
      Mcr = (9 * E * sec.A * sec.rz * sec.t * Cb / (8 * Lb)) * (Math.sqrt(1 + 4.4 * k * k) + 4.4 * k);
      MnLTB = ltbMn(My, Mcr);
    }
  } else { // principal-z: yielding + leg LB only, no LTB
    const Sz = Math.min(...[sec.SzA, sec.SzB, sec.SzC].filter((v): v is number => v != null));
    My = Fy * Sz;
    Sc = Math.max(...[sec.SzA, sec.SzB, sec.SzC].filter((v): v is number => v != null)); // comp toe
    note = 'Minor principal (z) axis: no lateral-torsional buckling limit state.';
  }

  const Myield = 1.5 * My;                                   // F10-1
  const llb = legLocalBucklingMn(bt, Fy, Sc);
  const candidates: { name: FlexSingleResult['governs']; Mn: number }[] = [
    { name: 'Yielding', Mn: Myield },
    { name: 'LTB', Mn: MnLTB },
    { name: 'Leg local buckling', Mn: llb.Mn },
  ];
  const gov = candidates.reduce((a, b) => (b.Mn < a.Mn ? b : a));
  const Mn = gov.Mn;
  const valid = !(fi.axis === 'geometric' && !sec.equalLeg);
  return { clause: fi.axis === 'geometric' ? 'F10.2/F10.3' : fi.axis === 'principal-w' ? 'F10.2 (w)' : 'F10.1 (z)', My: Myield, Mcr, Mn, phiMn: PHI_Y * Mn, governs: gov.name, valid, note };
}
function ltbMn(My: number, Mcr: number): number {
  if (!Number.isFinite(Mcr) || Mcr <= 0) return Infinity;
  const r = My / Mcr;
  return r <= 1.0
    ? Math.min((1.92 - 1.17 * Math.sqrt(r)) * My, 1.5 * My) // F10-2 inelastic
    : (0.92 - 0.17 * Mcr / My) * Mcr;                        // F10-3 elastic
}

/* ── FLEXURE — DOUBLE angle (F9), bending about x (plane of symmetry) ──── */
export interface FlexDoubleInputs { Lb: number; Cb: number; webLegsInCompression: boolean; }
export interface FlexDoubleResult {
  clause: string; Mp: number; My: number; Lp: number; Lr: number | null;
  Mcr: number | null; Mn: number; phiMn: number; governs: string; note: string;
}
export function flexureDouble(sec: AngleDouble, mat: Material, fi: FlexDoubleInputs): FlexDoubleResult {
  const Fy = mat.Fy, Sx = sec.Sx, Zx = sec.Zx, Lb = fi.Lb, J = sec.J2 ?? 0;
  const My = Fy * Sx;
  // F9 yielding
  const Mp = fi.webLegsInCompression ? 1.5 * My : Math.min(Fy * Zx, 1.6 * My);
  // F9 LTB (about axis of symmetry y): Lp/Lr and Mcr
  const Lp = 1.76 * sec.ry * Math.sqrt(E / Fy);
  const dSect = sec.d; // F9 section depth = the back-to-back (stem) leg
  const B = (fi.webLegsInCompression ? -1 : 1) * 2.3 * (dSect / Lb) * Math.sqrt(sec.Iy / J);
  const Mcr = J > 0 ? (1.95 * E / Lb) * Math.sqrt(sec.Iy * J) * (B + Math.sqrt(1 + B * B)) : null;
  let MnLTB = Infinity; let ltbActive = false;
  if (Lb > Lp && Mcr != null) { MnLTB = Math.min(Mcr, Mp); ltbActive = true; }
  // F10.3 leg local buckling — width of the leg actually in flexural compression
  const bComp = fi.webLegsInCompression ? sec.d : sec.b; // stem (back-to-back) vs outstanding leg
  const bt = bComp / (sec.tSingle ?? sec.t);
  const llb = legLocalBucklingMn(bt, Fy, Sx);
  const cands: { name: string; Mn: number }[] = [
    { name: 'Yielding', Mn: Mp },
    { name: 'LTB', Mn: MnLTB },
    { name: 'Leg local buckling', Mn: llb.Mn },
  ];
  const gov = cands.reduce((a, b) => (b.Mn < a.Mn ? b : a));
  return {
    clause: 'F9', Mp, My, Lp, Lr: null, Mcr, Mn: gov.Mn, phiMn: PHI_Y * gov.Mn, governs: gov.name,
    note: ltbActive ? '' : (Lb <= Lp ? 'Lb ≤ Lp — LTB does not apply.' : ''),
  };
}
