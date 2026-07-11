// AISC 360-16 (LRFD) design of hot-rolled CHANNEL (C, MC) sections.
// Channels are singly-symmetric (axis of symmetry = geometric x-axis): F2 major
// flexure uses c = (ho/2)·√(Iy/Cw) (Eq F2-8b, ≠ 1), the flange is a full-width
// unstiffened element (b = bf), and compression can be governed by flexural-
// torsional buckling (E4).  US customary: kips, kip·in, ksi, in.

import { E, Gsteel } from './aisc360';

export const PHI_B = 0.90;
export const PHI_V = 0.90;
export const PHI_C = 0.90;

export interface ChannelSection {
  designation: string;
  family: 'C' | 'MC';
  weight: number;
  A: number; d: number; bf: number; tf: number; tw: number;
  Ix: number; Sx: number; Zx: number; rx: number;
  Iy: number; Sy: number; Zy: number; ry: number;
  J: number; Cw: number;
  xbar: number; // centroid → back of web (in)
  xo: number;   // centroid → shear centre offset along axis of symmetry (in)
  ro: number;   // polar radius of gyration about the shear centre (in)
  H: number;    // flexural constant 1 − xo²/ro²
  htw: number;  // AISC-tabulated web slenderness h/tw
  hw: number;   // clear web height = htw·tw (in)
}

export type ShapeClass = 'compact' | 'noncompact' | 'slender';

/* ── classification (Table B4.1b flexure / B4.1a compression) ── */
export interface ChannelClass {
  flangeLambda: number; flangeClassFlex: ShapeClass;
  webLambda: number; webClassFlex: ShapeClass;
  lpf: number; lrf: number; lpw: number; lrw: number;
  flangeSlenderComp: boolean; webSlenderComp: boolean;
}

export function classifyChannel(s: ChannelSection, Fy: number): ChannelClass {
  const k = Math.sqrt(E / Fy);
  const flangeLambda = s.bf / s.tf;          // Case 1 — full flange width for a channel
  const webLambda = s.htw;                    // Case 15
  const lpf = 0.38 * k, lrf = 1.0 * k;
  const lpw = 3.76 * k, lrw = 5.70 * k;
  const cls = (lam: number, lp: number, lr: number): ShapeClass => (lam <= lp ? 'compact' : lam <= lr ? 'noncompact' : 'slender');
  return {
    flangeLambda, flangeClassFlex: cls(flangeLambda, lpf, lrf),
    webLambda, webClassFlex: cls(webLambda, lpw, lrw),
    lpf, lrf, lpw, lrw,
    flangeSlenderComp: flangeLambda > 0.56 * k,   // Case 1 (compression)
    webSlenderComp: webLambda > 1.49 * k,          // Case 5 (compression)
  };
}

/* ── F2 major-axis flexure (channel c-factor) + F3 flange local buckling ── */
export interface ChannelFlexure {
  Mp: number; Lp: number; Lr: number; c: number; rts: number;
  Mn: number; phiMn: number; governs: string; clause: string;
}

export function flexureChannelMajor(s: ChannelSection, Fy: number, Lb: number, Cb: number): ChannelFlexure {
  const cls = classifyChannel(s, Fy);
  const Mp = Fy * s.Zx;                                   // F2-1
  const ho = s.d - s.tf;                                  // between flange centroids
  const rts = Math.sqrt(Math.sqrt(s.Iy * s.Cw) / s.Sx);  // F2-7
  const c = (ho / 2) * Math.sqrt(s.Iy / s.Cw);           // F2-8b (channel)
  const Lp = 1.76 * s.ry * Math.sqrt(E / Fy);            // F2-5
  const JcSxho = (s.J * c) / (s.Sx * ho);
  const term = Math.sqrt(JcSxho ** 2 + 6.76 * ((0.7 * Fy) / E) ** 2);
  const Lr = 1.95 * rts * (E / (0.7 * Fy)) * Math.sqrt(JcSxho + term); // F2-6

  // Lateral-torsional buckling (F2)
  let Mn_ltb: number; let ltbMode: string;
  if (Lb <= Lp) { Mn_ltb = Mp; ltbMode = 'Yielding, Mp (F2)'; }
  else if (Lb <= Lr) {
    Mn_ltb = Math.min(Mp, Cb * (Mp - (Mp - 0.7 * Fy * s.Sx) * (Lb - Lp) / (Lr - Lp))); // F2-2
    ltbMode = 'Inelastic LTB (F2-2)';
  } else {
    const Fcr = (Cb * Math.PI ** 2 * E) / ((Lb / rts) ** 2) * Math.sqrt(1 + 0.078 * JcSxho * (Lb / rts) ** 2); // F2-4
    Mn_ltb = Math.min(Mp, Fcr * s.Sx);                   // F2-3
    ltbMode = 'Elastic LTB (F2-3)';
  }

  // Flange local buckling (F3) — only when flange noncompact/slender
  let Mn_flb = Mp;
  if (cls.flangeClassFlex === 'noncompact') {
    Mn_flb = Mp - (Mp - 0.7 * Fy * s.Sx) * (cls.flangeLambda - cls.lpf) / (cls.lrf - cls.lpf); // F3-1
  } else if (cls.flangeClassFlex === 'slender') {
    const kc = Math.min(0.76, Math.max(0.35, 4 / Math.sqrt(s.hw / s.tw)));
    const Fcr = (0.9 * E * kc) / (cls.flangeLambda ** 2);
    Mn_flb = Fcr * s.Sx;                                 // F3-2
  }

  const Mn = Math.min(Mn_ltb, Mn_flb);
  const governs = Mn_ltb <= Mn_flb ? ltbMode : 'Flange local buckling (F3)';
  return { Mp, Lp, Lr, c, rts, Mn, phiMn: PHI_B * Mn, governs, clause: 'Ch. F2/F3' };
}

/* ── F6 minor-axis flexure ── */
export function flexureChannelMinor(s: ChannelSection, Fy: number): { Mn: number; phiMn: number; governs: string } {
  const cls = classifyChannel(s, Fy);
  const Mp = Math.min(Fy * s.Zy, 1.6 * Fy * s.Sy);       // F6-1
  let Mn = Mp; let governs = 'Yielding, Mp (F6)';
  if (cls.flangeClassFlex === 'noncompact') {
    Mn = Mp - (Mp - 0.7 * Fy * s.Sy) * (cls.flangeLambda - cls.lpf) / (cls.lrf - cls.lpf); // F6-2
    governs = 'Flange local buckling (F6-2)';
  } else if (cls.flangeClassFlex === 'slender') {
    const Fcr = (0.69 * E) / (cls.flangeLambda ** 2);
    Mn = Fcr * s.Sy; governs = 'Flange local buckling (F6-3)';                            // F6-3
  }
  return { Mn, phiMn: PHI_B * Mn, governs };
}

/* ── G2.1 shear (major axis) ──
   Channels fall under G2.1(b): φv = 0.90 always (the φv = 1.00 branch is only
   for webs of rolled I-shapes, G2.1(a)).  kv = 5.34 unstiffened. */
export function shearChannel(s: ChannelSection, Fy: number): { Vn: number; phiVn: number; Cv1: number; phiV: number; detail: string } {
  const k = Math.sqrt(E / Fy);
  const Aw = s.d * s.tw;
  const hOverTw = s.htw;
  const kv = 5.34;
  let Cv1 = 1.0;
  if (hOverTw <= 1.10 * Math.sqrt(kv) * k) Cv1 = 1.0;             // G2-3
  else Cv1 = (1.10 * Math.sqrt(kv) * k) / hOverTw;               // G2-4
  const phiV = PHI_V;                                             // 0.90 for channels
  const Vn = 0.6 * Fy * Aw * Cv1;
  return { Vn, phiVn: phiV * Vn, Cv1, phiV, detail: `Cv1 = ${Cv1.toFixed(2)}, φv = 0.90 (G2.1b)` };
}

/* ── E3 / E4 compression (flexural + flexural-torsional buckling) ──
   A channel's axis of symmetry is x, so FTB (E4-3) couples Fex (about the
   symmetry/major axis) with the torsional Fez; the uncoupled independent mode
   is Fey (about the minor axis y).  Governing Fe = min(Fey, Fe_FTB). */
export function fcrFromFe(Fy: number, Fe: number): number {
  if (Fe <= 0) return 0;
  return Fy / Fe <= 2.25 ? Math.pow(0.658, Fy / Fe) * Fy : 0.877 * Fe; // E3-2 / E3-3
}

export interface ChannelCompression {
  Fe: number; Fcr: number; Ae: number; Pn: number; phiPn: number; mode: string;
  Fex: number; Fey: number; Fez: number; FeFTB: number; slender: boolean;
}

/** E7 effective width of a slender element under uniform compression (Fcr).
 *  Stiffened (web): c1=0.18, c2=1.31.  Unstiffened (flange): c1=0.22, c2=1.49. */
function effectiveWidth(b: number, lambda: number, lambdaR: number, Fy: number, Fcr: number, stiffened: boolean): number {
  if (lambda <= lambdaR * Math.sqrt(Fy / Fcr)) return b;         // E7-2 (no reduction)
  const c1 = stiffened ? 0.18 : 0.22;
  const c2 = stiffened ? 1.31 : 1.49;
  const Fel = (c2 * lambdaR / lambda) ** 2 * Fy;                 // E7-5
  const be = b * (1 - c1 * Math.sqrt(Fel / Fcr)) * Math.sqrt(Fel / Fcr); // E7-3
  return Math.min(b, Math.max(0, be));
}

export function compressionChannel(s: ChannelSection, Fy: number, Lcx: number, Lcy: number, Lcz: number): ChannelCompression {
  const Fex = (Math.PI ** 2 * E) / ((Lcx / s.rx) ** 2);                          // E4-5
  const Fey = (Math.PI ** 2 * E) / ((Lcy / s.ry) ** 2);                          // E4-6
  const Fez = ((Math.PI ** 2 * E * s.Cw) / (Lcz ** 2) + Gsteel * s.J) / (s.A * s.ro ** 2); // E4-7
  const H = s.H;                                                                 // E4-8 (tabulated)
  const sum = Fex + Fez;
  const disc = Math.max(0, 1 - (4 * Fex * Fez * H) / (sum ** 2));
  const FeFTB = (sum / (2 * H)) * (1 - Math.sqrt(disc));                         // E4-3 (channel: Fex↔Fez)

  let Fe = Fey, mode = 'Flexural buckling about y (E3)';
  if (FeFTB < Fe) { Fe = FeFTB; mode = 'Flexural-torsional buckling (E4)'; }
  const Fcr = fcrFromFe(Fy, Fe);
  const cls = classifyChannel(s, Fy);
  const slender = cls.flangeSlenderComp || cls.webSlenderComp;

  // E7 effective area for slender elements (web stiffened, flange unstiffened)
  const k = Math.sqrt(E / Fy);
  let Ae = s.A;
  if (Fcr > 0) {
    if (cls.webSlenderComp) {
      const be = effectiveWidth(s.hw, s.htw, 1.49 * k, Fy, Fcr, true);
      Ae -= (s.hw - be) * s.tw;
    }
    if (cls.flangeSlenderComp) {
      const be = effectiveWidth(s.bf, s.bf / s.tf, 0.56 * k, Fy, Fcr, false);
      Ae -= 2 * (s.bf - be) * s.tf; // two flanges
    }
  }
  Ae = Math.max(Ae, 0.1 * s.A);
  const Pn = Fcr * Ae;                                                           // E7-1 (= E3-1 when Ae = A)
  if (slender) mode += ' · E7 Ae';
  return { Fe, Fcr, Ae, Pn, phiPn: PHI_C * Pn, mode, Fex, Fey, Fez, FeFTB, slender };
}

/* ── deflection (serviceability) ── */
export type DeflCase = 'ss-udl' | 'ss-point' | 'cant-udl' | 'cant-point';
export function channelDeflection(c: DeflCase, w: number, P: number, L: number, I: number): { delta: number; formula: string } {
  const EI = E * I;
  switch (c) {
    case 'ss-udl':     return { delta: (5 * w * L ** 4) / (384 * EI), formula: '5wL⁴/384EI' };
    case 'ss-point':   return { delta: (P * L ** 3) / (48 * EI), formula: 'PL³/48EI' };
    case 'cant-udl':   return { delta: (w * L ** 4) / (8 * EI), formula: 'wL⁴/8EI' };
    case 'cant-point': return { delta: (P * L ** 3) / (3 * EI), formula: 'PL³/3EI' };
  }
}

/* ── member wrapper: bending + shear + buckling + deflection + governing ── */
export interface ChannelInputs {
  section: ChannelSection; Fy: number;
  Lb: number; Cb: number;
  Mux: number; Muy: number; Vu: number; Pu: number; // demands (kip·in, kip·in, kip, kip)
  Lcx: number; Lcy: number; Lcz: number;            // compression effective lengths (in)
  deflCase: DeflCase; wService: number; Pservice: number; Lspan: number; deflDen: number;
}
export interface ChannelResult {
  classification: ChannelClass;
  overallClass: ShapeClass;
  flexMajor: ChannelFlexure;
  flexMinor: { Mn: number; phiMn: number; governs: string };
  shear: ReturnType<typeof shearChannel>;
  compression: ChannelCompression;
  deflection: { delta: number; limit: number; ratioSpan: number; formula: string };
  flexUtil: number; flexMinorUtil: number; shearUtil: number; comprUtil: number; deflUtil: number;
  h1Util: number; h1Eq: string; // combined axial + flexure (H1-1), 0 when Pu = 0
  governing: { name: string; ratio: number };
}

export function analyzeChannel(inp: ChannelInputs): ChannelResult {
  const s = inp.section, Fy = inp.Fy;
  const classification = classifyChannel(s, Fy);
  const rank = (c: ShapeClass) => (c === 'compact' ? 0 : c === 'noncompact' ? 1 : 2);
  const overallClass: ShapeClass = rank(classification.flangeClassFlex) >= rank(classification.webClassFlex) ? classification.flangeClassFlex : classification.webClassFlex;
  const flexMajor = flexureChannelMajor(s, Fy, inp.Lb, inp.Cb);
  const flexMinor = flexureChannelMinor(s, Fy);
  const shear = shearChannel(s, Fy);
  const compression = compressionChannel(s, Fy, inp.Lcx, inp.Lcy, inp.Lcz);

  const d = channelDeflection(inp.deflCase, inp.wService, inp.Pservice, inp.Lspan, s.Ix);
  const limit = inp.deflDen > 0 ? inp.Lspan / inp.deflDen : 0;
  const deflection = { delta: d.delta, limit, ratioSpan: d.delta > 1e-9 ? inp.Lspan / d.delta : Infinity, formula: d.formula };

  const flexUtil = flexMajor.phiMn > 0 ? inp.Mux / flexMajor.phiMn : Infinity;
  const flexMinorUtil = flexMinor.phiMn > 0 && inp.Muy > 0 ? inp.Muy / flexMinor.phiMn : 0;
  const shearUtil = shear.phiVn > 0 ? inp.Vu / shear.phiVn : Infinity;
  const comprUtil = compression.phiPn > 0 && inp.Pu > 0 ? inp.Pu / compression.phiPn : 0;
  const deflUtil = limit > 0 ? d.delta / limit : 0;

  // H1-1 combined axial + flexure interaction (only meaningful when Pu > 0)
  let h1Util = 0, h1Eq = '';
  if (inp.Pu > 0 && compression.phiPn > 0) {
    const PrPc = inp.Pu / compression.phiPn;
    const Mratio = (flexMajor.phiMn > 0 ? inp.Mux / flexMajor.phiMn : 0) + (flexMinor.phiMn > 0 ? inp.Muy / flexMinor.phiMn : 0);
    if (PrPc >= 0.2) { h1Util = PrPc + (8 / 9) * Mratio; h1Eq = 'H1-1a'; }
    else { h1Util = PrPc / 2 + Mratio; h1Eq = 'H1-1b'; }
  }

  const cands = [
    { name: 'Flexure (major)', ratio: flexUtil },
    { name: 'Flexure (minor)', ratio: flexMinorUtil },
    { name: 'Shear', ratio: shearUtil },
    { name: 'Compression', ratio: comprUtil },
    { name: inp.Pu > 0 ? `Combined (${h1Eq})` : 'Combined', ratio: h1Util },
    { name: 'Deflection', ratio: deflUtil },
  ];
  const governing = cands.reduce((a, b) => (b.ratio > a.ratio ? b : a));
  return { classification, overallClass, flexMajor, flexMinor, shear, compression, deflection, flexUtil, flexMinorUtil, shearUtil, comprUtil, deflUtil, h1Util, h1Eq, governing };
}
