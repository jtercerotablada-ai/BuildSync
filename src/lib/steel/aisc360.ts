/**
 * AISC 360-22 — Steel Member Design (LRFD).
 * Imperial units throughout: force = kips, stress = ksi, length = in,
 * moment = kip·in.  E = 29 000 ksi, G = 11 200 ksi.
 *
 * Scope (v1): doubly-symmetric I-shapes (W, S), rectangular/square HSS,
 * round HSS and Pipe.  Checks: tension (Ch. D), compression (Ch. E —
 * flexural E3, torsional E4, slender-element effective area E7), flexure
 * (F2/F3 I major, F6 I minor, F7 HSS-rect, F8 round), shear (G2/G4),
 * combined axial + flexure (H1).  Every result carries its clause tag.
 *
 * Validated against AISC Manual (15th ed.) design examples — see
 * aisc360.selftest.ts.
 */

export const E = 29000; // ksi
export const Gsteel = 11200; // ksi

export type SteelFamily = 'W' | 'S' | 'HSS-R' | 'HSS-C' | 'Pipe' | 'C' | 'WT' | 'L';
export type ShapeClass = 'compact' | 'noncompact' | 'slender';

export interface SteelSection {
  designation: string;
  family: SteelFamily;
  A: number;   // in²
  d: number;   // in  (overall depth, or OD for round)
  bf: number;  // in  (flange width, or B for HSS-R)
  tf: number;  // in  (flange thickness, or wall t for HSS/pipe)
  tw: number;  // in  (web thickness, or wall t for HSS)
  Ix: number; Sx: number; Zx: number; rx: number;
  Iy: number; Sy: number; Zy: number; ry: number;
  J: number;   // in⁴
  Cw: number;  // in⁶
}

export interface SteelMaterial {
  Fy: number; // ksi
  Fu: number; // ksi
}

export interface MemberInputs {
  section: SteelSection;
  material: SteelMaterial;
  Lcx: number;  // effective length for buckling about x, in  (Kx·Lx)
  Lcy: number;  // effective length about y, in
  Lcz: number;  // effective length for torsional buckling, in
  Lb: number;   // laterally unbraced length for LTB, in
  Cb: number;   // LTB modification factor
  An: number;   // net area for tension rupture, in²
  U: number;    // shear-lag factor
  // Demands (LRFD, factored)
  Pu: number;   // axial, kips (+ tension, − compression)
  Mux: number;  // major-axis moment, kip·in
  Muy: number;  // minor-axis moment, kip·in
  Vu: number;   // major-axis shear, kips
}

export interface LimitCheck {
  name: string;
  clause: string;
  phi: number;
  Rn: number;      // nominal strength (kips or kip·in)
  phiRn: number;   // design strength
  detail?: string; // governing sub-limit / note
}

const isRound = (f: SteelFamily) => f === 'HSS-C' || f === 'Pipe';
const isHSSrect = (f: SteelFamily) => f === 'HSS-R';
const isIshape = (f: SteelFamily) => f === 'W' || f === 'S';
const isDoublySym = (f: SteelFamily) => isIshape(f) || f === 'HSS-R' || isRound(f);

/** Clear web height h ≈ d − 2·tf (fillets not in DB → slightly conservative). */
function webH(s: SteelSection): number {
  if (isRound(s.family)) return 0;
  return Math.max(0, s.d - 2 * s.tf);
}

/* ─────────────────────────  Element slenderness  ───────────────────────── */

export interface Slenderness {
  flangeLambda: number;
  flangeClassFlex: ShapeClass;    // Table B4.1b (flexure)
  flangeSlenderComp: boolean;     // Table B4.1a (compression)
  webLambda: number;
  webClassFlex: ShapeClass;
  webSlenderComp: boolean;
  lpf: number; lrf: number;       // flange flexure limits
  lpw: number; lrw: number;       // web flexure limits
  lrfComp: number; lrwComp: number;
}

export function classify(s: SteelSection, Fy: number): Slenderness {
  const k = Math.sqrt(E / Fy);
  if (isRound(s.family)) {
    // Round HSS / pipe — D/t governs (Table B4.1, case 20/15)
    const Dt = s.d / s.tf;
    const lrfComp = 0.11 * E / Fy;                 // compression slender limit
    const lpf = 0.07 * E / Fy;                     // flexure compact
    const lrf = 0.31 * E / Fy;                     // flexure noncompact/slender
    const cls: ShapeClass = Dt <= lpf ? 'compact' : Dt <= lrf ? 'noncompact' : 'slender';
    return {
      flangeLambda: Dt, flangeClassFlex: cls, flangeSlenderComp: Dt > lrfComp,
      webLambda: Dt, webClassFlex: cls, webSlenderComp: Dt > lrfComp,
      lpf, lrf, lpw: lpf, lrw: lrf, lrfComp, lrwComp: lrfComp,
    };
  }
  if (isHSSrect(s.family)) {
    const t = s.tf;
    const flangeLambda = (s.bf - 3 * t) / t;       // clear width / t
    const webLambda = (s.d - 3 * t) / t;
    const lpf = 1.12 * k, lrf = 1.40 * k;          // Table B4.1b case 17 (flange)
    const lpw = 2.42 * k, lrw = 5.70 * k;          // case 19 (web)
    const lrfComp = 1.40 * k, lrwComp = 1.40 * k;  // Table B4.1a case 6
    const flangeClassFlex: ShapeClass = flangeLambda <= lpf ? 'compact' : flangeLambda <= lrf ? 'noncompact' : 'slender';
    const webClassFlex: ShapeClass = webLambda <= lpw ? 'compact' : webLambda <= lrw ? 'noncompact' : 'slender';
    return {
      flangeLambda, flangeClassFlex, flangeSlenderComp: flangeLambda > lrfComp,
      webLambda, webClassFlex, webSlenderComp: webLambda > lrwComp,
      lpf, lrf, lpw, lrw, lrfComp, lrwComp,
    };
  }
  // I-shapes (W, S): unstiffened flange b/t = bf/2tf, stiffened web h/tw
  const flangeLambda = s.bf / (2 * s.tf);
  const webLambda = webH(s) / s.tw;
  const lpf = 0.38 * k, lrf = 1.0 * k;             // Table B4.1b case 10
  const lpw = 3.76 * k, lrw = 5.70 * k;            // case 15
  const lrfComp = 0.56 * k;                        // Table B4.1a case 1 (unstiffened)
  const lrwComp = 1.49 * k;                        // case 5 (stiffened)
  const flangeClassFlex: ShapeClass = flangeLambda <= lpf ? 'compact' : flangeLambda <= lrf ? 'noncompact' : 'slender';
  const webClassFlex: ShapeClass = webLambda <= lpw ? 'compact' : webLambda <= lrw ? 'noncompact' : 'slender';
  return {
    flangeLambda, flangeClassFlex, flangeSlenderComp: flangeLambda > lrfComp,
    webLambda, webClassFlex, webSlenderComp: webLambda > lrwComp,
    lpf, lrf, lpw, lrw, lrfComp, lrwComp: lrwComp,
  };
}

/* ────────────────────────────  Tension (Ch. D)  ─────────────────────────── */

export function tension(s: SteelSection, m: SteelMaterial, An: number, U: number): LimitCheck {
  const yield_ = 0.90 * m.Fy * s.A;                 // D2(a)
  const Ae = U * An;
  const rupture = 0.75 * m.Fu * Ae;                 // D2(b)
  const gov = Math.min(yield_, rupture);
  const detail = yield_ <= rupture ? 'Yielding on gross area (D2-1)' : 'Rupture on effective net area (D2-2)';
  const Rn = yield_ <= rupture ? m.Fy * s.A : m.Fu * Ae;
  return { name: 'Tension', clause: 'Ch. D', phi: yield_ <= rupture ? 0.90 : 0.75, Rn, phiRn: gov, detail };
}

/* ──────────────────────────  Compression (Ch. E)  ───────────────────────── */

/** Flexural-buckling stress Fcr from elastic Fe (E3-2 / E3-3). */
function fcrFromFe(Fy: number, Fe: number): number {
  if (Fe <= 0) return 0;
  return (Fy / Fe <= 2.25) ? Math.pow(0.658, Fy / Fe) * Fy : 0.877 * Fe;
}

export interface CompressionResult extends LimitCheck {
  Fe: number; Fcr: number; slender: boolean; mode: string;
  slendernessRatio: number; Ae: number;
}

export function compression(inp: MemberInputs): CompressionResult {
  const { section: s, material: m } = inp;
  const Fy = m.Fy;
  const sl = classify(s, Fy);

  // Elastic buckling stress — min of flexural (both axes) and torsional/FT.
  const rMinRatio = Math.max(inp.Lcx / s.rx, inp.Lcy / s.ry);
  const FeFlex = (Math.PI ** 2 * E) / (rMinRatio ** 2);
  let Fe = FeFlex;
  let mode = 'Flexural buckling (E3)';

  if (isDoublySym(s.family) && s.Cw > 0 && inp.Lcz > 0) {
    // Torsional buckling of doubly-symmetric members (E4-2)
    const FeTor = ((Math.PI ** 2 * E * s.Cw) / (inp.Lcz ** 2) + Gsteel * s.J) / (s.Ix + s.Iy);
    if (FeTor < Fe) { Fe = FeTor; mode = 'Torsional buckling (E4)'; }
  }

  const Fcr = fcrFromFe(Fy, Fe);

  // Slender-element effective area (E7). Non-slender → Ae = Ag.
  const slender = sl.flangeSlenderComp || sl.webSlenderComp;
  let Ae = s.A;
  if (slender) Ae = effectiveArea(s, Fy, Fcr, sl);

  const Pn = Fcr * Ae;
  const phi = 0.90;
  return {
    name: 'Compression', clause: 'Ch. E', phi, Rn: Pn, phiRn: phi * Pn,
    Fe, Fcr, slender, mode, slendernessRatio: rMinRatio, Ae,
    detail: `${mode}, Lc/r = ${rMinRatio.toFixed(0)}${slender ? ', slender elements (E7)' : ''}`,
  };
}

/** Element category for the E7 effective-width imperfection coefficients (Table E7.1). */
type ElemCat = 'stiffened' | 'hss-wall' | 'unstiffened';

/** Effective width of a slender element at stress f (E7-2 / E7-3, Table E7.1). */
function beEff(lambda: number, lambdaR: number, Fy: number, f: number, cat: ElemCat, b: number): number {
  const lim = lambdaR * Math.sqrt(Fy / f);
  if (lambda <= lim) return b;
  // Table E7.1: (a) stiffened except HSS walls 0.18, (b) HSS walls 0.20, (c) unstiffened 0.22
  const c1 = cat === 'stiffened' ? 0.18 : cat === 'hss-wall' ? 0.20 : 0.22;
  const c2 = (1 - Math.sqrt(1 - 4 * c1)) / (2 * c1);
  const Fel = Math.pow((c2 * lambdaR) / lambda, 2) * Fy; // E7-5
  return b * (1 - c1 * Math.sqrt(Fel / f)) * Math.sqrt(Fel / f); // E7-3
}

function effectiveArea(s: SteelSection, Fy: number, Fcr: number, sl: Slenderness): number {
  const f = Fcr > 0 ? Fcr : Fy;
  const k = Math.sqrt(E / Fy);
  let Ae = s.A;
  if (isRound(s.family)) {
    // Round HSS (E7.2, case for round sections) — Q = min(1, 0.038E/(FyD/t)+2/3)
    const Dt = s.d / s.tf;
    const Q = Math.min(1, 0.038 * E / (Fy * Dt) + 2 / 3);
    return Q * s.A;
  }
  if (isHSSrect(s.family)) {
    const t = s.tf;
    if (sl.flangeSlenderComp) {
      const b = s.bf - 3 * t;
      const be = beEff(sl.flangeLambda, sl.lrfComp, Fy, f, 'hss-wall', b);
      Ae -= 2 * (b - be) * t;   // two flanges
    }
    if (sl.webSlenderComp) {
      const h = s.d - 3 * t;
      const be = beEff(sl.webLambda, sl.lrwComp, Fy, f, 'hss-wall', h);
      Ae -= 2 * (h - be) * t;   // two webs
    }
    return Ae;
  }
  // I-shape: unstiffened flanges + stiffened web
  if (sl.flangeSlenderComp) {
    const b = s.bf / 2;
    const be = beEff(sl.flangeLambda, 0.56 * k, Fy, f, 'unstiffened', b);
    Ae -= 4 * (b - be) * s.tf;  // 4 flange half-widths
  }
  if (sl.webSlenderComp) {
    const h = webH(s);
    const be = beEff(sl.webLambda, 1.49 * k, Fy, f, 'stiffened', h);
    Ae -= (h - be) * s.tw;
  }
  return Math.max(Ae, 0.1 * s.A);
}

/* ────────────────────────────  Flexure (Ch. F)  ─────────────────────────── */

export interface FlexureResult extends LimitCheck {
  Mp: number; Lp?: number; Lr?: number; governs: string;
}

/** Major-axis flexure of a doubly-symmetric I-shape (F2 + F3 FLB). */
function flexureI_major(inp: MemberInputs): FlexureResult {
  const { section: s, material: m } = inp;
  const Fy = m.Fy;
  const sl = classify(s, Fy);
  const Mp = Fy * s.Zx;                              // F2-1
  const ho = s.d - s.tf;                             // dist. between flange centroids
  const rts = Math.sqrt(Math.sqrt(s.Iy * s.Cw) / s.Sx);
  const c = 1;                                       // doubly-symmetric I
  const Lp = 1.76 * s.ry * Math.sqrt(E / Fy);        // F2-5
  const Jc_Sxho = (s.J * c) / (s.Sx * ho);
  const term = Math.sqrt(Jc_Sxho ** 2 + 6.76 * ((0.7 * Fy) / E) ** 2);
  const Lr = 1.95 * rts * (E / (0.7 * Fy)) * Math.sqrt(Jc_Sxho + term); // F2-6

  // Lateral-torsional buckling (F2)
  const Lb = inp.Lb;
  let Mn_ltb: number;
  if (Lb <= Lp) {
    Mn_ltb = Mp;
  } else if (Lb <= Lr) {
    Mn_ltb = Math.min(Mp, inp.Cb * (Mp - (Mp - 0.7 * Fy * s.Sx) * (Lb - Lp) / (Lr - Lp))); // F2-2
  } else {
    const Fcr = (inp.Cb * Math.PI ** 2 * E) / ((Lb / rts) ** 2) *
      Math.sqrt(1 + 0.078 * Jc_Sxho * (Lb / rts) ** 2); // F2-4
    Mn_ltb = Math.min(Mp, Fcr * s.Sx);
  }

  // Compression-flange local buckling (F3) — only when flange noncompact/slender
  let Mn_flb = Mp;
  if (sl.flangeClassFlex === 'noncompact') {
    Mn_flb = Mp - (Mp - 0.7 * Fy * s.Sx) * (sl.flangeLambda - sl.lpf) / (sl.lrf - sl.lpf); // F3-1
  } else if (sl.flangeClassFlex === 'slender') {
    const kc = Math.min(0.76, Math.max(0.35, 4 / Math.sqrt(webH(s) / s.tw)));
    const Fcr = (0.9 * E * kc) / (sl.flangeLambda ** 2);
    Mn_flb = Fcr * s.Sx;                              // F3-2
  }

  const Mn = Math.min(Mn_ltb, Mn_flb);
  const governs = Mn_ltb <= Mn_flb
    ? (Lb <= Lp ? 'Yielding, Mp (F2)' : Lb <= Lr ? 'Inelastic LTB (F2-2)' : 'Elastic LTB (F2-3)')
    : 'Flange local buckling (F3)';
  return {
    name: 'Flexure (major)', clause: 'Ch. F2/F3', phi: 0.90, Rn: Mn, phiRn: 0.9 * Mn,
    Mp, Lp, Lr, governs, detail: governs,
  };
}

/** Major-axis flexure of a rectangular HSS (F7). */
function flexureHSSrect(inp: MemberInputs): FlexureResult {
  const { section: s, material: m } = inp;
  const Fy = m.Fy;
  const sl = classify(s, Fy);
  const Mp = Fy * s.Zx;
  const t = s.tf;
  // Flange local buckling (F7-2/F7-3)
  let Mn_flb = Mp;
  if (sl.flangeClassFlex === 'noncompact') {
    Mn_flb = Math.min(Mp, Mp - (Mp - Fy * s.Sx) * (3.57 * sl.flangeLambda * Math.sqrt(Fy / E) - 4.0)); // F7-2
  } else if (sl.flangeClassFlex === 'slender') {
    const be = Math.min(s.bf - 3 * t, 1.92 * t * Math.sqrt(E / Fy) * (1 - 0.38 / sl.flangeLambda * Math.sqrt(E / Fy)));
    const Seff = s.Sx * (be / (s.bf - 3 * t)); // approx effective modulus
    Mn_flb = Fy * Seff;
  }
  // Web local buckling (F7-6 noncompact / F7.3 slender effective web)
  let Mn_wlb = Mp;
  if (sl.webClassFlex === 'noncompact') {
    Mn_wlb = Math.min(Mp, Mp - (Mp - Fy * s.Sx) * (0.305 * sl.webLambda * Math.sqrt(Fy / E) - 0.738));
  } else if (sl.webClassFlex === 'slender') {
    const h = s.d - 3 * t;
    const be = Math.min(h, 1.92 * t * Math.sqrt(E / Fy) * (1 - 0.38 / sl.webLambda * Math.sqrt(E / Fy)));
    Mn_wlb = Fy * s.Sx * (be / h); // conservative effective-web modulus
  }
  const Mn = Math.min(Mn_flb, Mn_wlb);
  const governs = Mn_flb <= Mn_wlb
    ? (sl.flangeClassFlex === 'compact' ? 'Yielding, Mp (F7)' : 'Flange local buckling (F7)')
    : 'Web local buckling (F7)';
  return { name: 'Flexure (major)', clause: 'Ch. F7', phi: 0.90, Rn: Mn, phiRn: 0.9 * Mn, Mp, governs, detail: governs };
}

/** Major-axis flexure of round HSS / pipe (F8). */
function flexureRound(inp: MemberInputs): FlexureResult {
  const { section: s, material: m } = inp;
  const Fy = m.Fy;
  const Dt = s.d / s.tf;
  const Mp = Fy * s.Zx;
  let Mn = Mp;
  let governs = 'Yielding, Mp (F8)';
  if (Dt > 0.07 * E / Fy && Dt <= 0.31 * E / Fy) {
    Mn = ((0.021 * E) / Dt + Fy) * s.Sx;             // F8-2 noncompact
    governs = 'Local buckling — noncompact (F8-2)';
  } else if (Dt > 0.31 * E / Fy) {
    const Fcr = (0.33 * E) / Dt;
    Mn = Fcr * s.Sx;                                 // F8-3 slender
    governs = 'Local buckling — slender (F8-3)';
  }
  return { name: 'Flexure (major)', clause: 'Ch. F8', phi: 0.90, Rn: Mn, phiRn: 0.9 * Mn, Mp, governs, detail: governs };
}

export function flexureMajor(inp: MemberInputs): FlexureResult {
  const f = inp.section.family;
  if (isRound(f)) return flexureRound(inp);
  if (isHSSrect(f)) return flexureHSSrect(inp);
  return flexureI_major(inp);
}

/** Minor-axis flexure (F6 for I; HSS symmetric so same engine via Zy). */
export function flexureMinor(inp: MemberInputs): FlexureResult {
  const { section: s, material: m } = inp;
  const Fy = m.Fy;
  if (isRound(s.family)) {
    const r = flexureRound(inp);
    return { ...r, name: 'Flexure (minor)' };
  }
  if (isHSSrect(s.family)) {
    // Rectangular HSS about its minor axis: swap the wall roles (B↔H) and
    // reuse F7 with the y-axis section moduli.
    const swapped: SteelSection = { ...s, d: s.bf, bf: s.d, Sx: s.Sy, Zx: s.Zy };
    const r = flexureHSSrect({ ...inp, section: swapped });
    return { ...r, name: 'Flexure (minor)', clause: 'Ch. F7 (minor)' };
  }
  const sl = classify(s, Fy);
  const Mp = Math.min(Fy * s.Zy, 1.6 * Fy * s.Sy);   // F6-1
  let Mn = Mp;
  let governs = 'Yielding, Mp (F6)';
  // I-shape minor-axis FLB (F6-2/F6-3)
  if (sl.flangeClassFlex === 'noncompact') {
    Mn = Mp - (Mp - 0.7 * Fy * s.Sy) * (sl.flangeLambda - sl.lpf) / (sl.lrf - sl.lpf);
    governs = 'Flange local buckling (F6-2)';
  } else if (sl.flangeClassFlex === 'slender') {
    const Fcr = (0.69 * E) / (sl.flangeLambda ** 2);
    Mn = Fcr * s.Sy;
    governs = 'Flange local buckling (F6-3)';
  }
  return { name: 'Flexure (minor)', clause: 'Ch. F6', phi: 0.90, Rn: Mn, phiRn: 0.9 * Mn, Mp, governs, detail: governs };
}

/* ─────────────────────────────  Shear (Ch. G)  ──────────────────────────── */

export function shearMajor(inp: MemberInputs): LimitCheck {
  const { section: s, material: m } = inp;
  const Fy = m.Fy;
  if (isRound(s.family)) {
    // G5 round HSS. Fcr = min(0.6Fy, G5-2b). G5-2b (0.78E/(D/t)^1.5) is
    // Lv-independent; omitting the (usually larger) Lv-dependent G5-2a keeps
    // this conservative for long/slender pipes without needing Lv.
    const Dt = s.d / s.tf;
    const Fcr = Math.min(0.6 * Fy, 0.78 * E / Math.pow(Dt, 1.5));
    const Vn = Fcr * s.A / 2;                        // G5-1
    return { name: 'Shear', clause: 'Ch. G5', phi: 0.90, Rn: Vn, phiRn: 0.9 * Vn, detail: `Round HSS, Fcr = ${Fcr.toFixed(1)} ksi` };
  }
  const k = Math.sqrt(E / Fy);
  if (isHSSrect(s.family)) {
    const t = s.tf;
    const h = s.d - 3 * t;
    const Aw = 2 * h * t;                            // G4
    const kv = 5;
    const lw = h / t;
    let Cv2 = 1.0;                                   // G2.2
    if (lw <= 1.10 * Math.sqrt(kv) * k) Cv2 = 1.0;   // G2-9
    else if (lw <= 1.37 * Math.sqrt(kv) * k) Cv2 = (1.10 * Math.sqrt(kv) * k) / lw; // G2-10
    else Cv2 = (1.51 * kv * E) / (lw ** 2 * Fy);     // G2-11 (slender web)
    const Vn = 0.6 * Fy * Aw * Cv2;
    return { name: 'Shear', clause: 'Ch. G4', phi: 0.90, Rn: Vn, phiRn: 0.9 * Vn, detail: `Cv2 = ${Cv2.toFixed(2)}` };
  }
  // I-shape (G2.1)
  const Aw = s.d * s.tw;
  const hOverTw = webH(s) / s.tw;
  const kv = 5.34;
  let Cv1 = 1.0;
  let phi = 0.90;
  if (hOverTw <= 2.24 * k) {
    Cv1 = 1.0; phi = 1.00;                           // rolled I, φv = 1.0
  } else if (hOverTw <= 1.10 * Math.sqrt(kv) * k) {
    Cv1 = 1.0;
  } else {
    Cv1 = (1.10 * Math.sqrt(kv) * k) / hOverTw;      // G2-4
  }
  const Vn = 0.6 * Fy * Aw * Cv1;
  return { name: 'Shear', clause: 'Ch. G2', phi, Rn: Vn, phiRn: phi * Vn, detail: `Cv1 = ${Cv1.toFixed(2)}, φv = ${phi.toFixed(2)}` };
}

/* ──────────────────────  Combined axial + flexure (H1)  ─────────────────── */

export interface CombinedResult {
  ratio: number;
  equation: string;
  Pr: number; Pc: number;
  Mrx: number; Mcx: number;
  Mry: number; Mcy: number;
  pass: boolean;
}

export function combined(
  inp: MemberInputs, axial: LimitCheck, mMajor: FlexureResult, mMinor: FlexureResult,
): CombinedResult | null {
  const Pr = Math.abs(inp.Pu);
  const Pc = axial.phiRn;
  const Mrx = Math.abs(inp.Mux), Mry = Math.abs(inp.Muy);
  const Mcx = mMajor.phiRn, Mcy = mMinor.phiRn;
  if (Pc <= 0 || Mcx <= 0) return null;
  const p = Pr / Pc;
  let ratio: number, equation: string;
  if (p >= 0.2) {
    ratio = p + (8 / 9) * (Mrx / Mcx + Mry / Mcy);   // H1-1a
    equation = 'H1-1a';
  } else {
    ratio = p / 2 + (Mrx / Mcx + Mry / Mcy);         // H1-1b
    equation = 'H1-1b';
  }
  return { ratio, equation, Pr, Pc, Mrx, Mcx, Mry, Mcy, pass: ratio <= 1.0 };
}

/* ─────────────────────────────  Top-level run  ──────────────────────────── */

export interface MemberResult {
  slenderness: Slenderness;
  tension: LimitCheck;
  compression: CompressionResult;
  flexureMajor: FlexureResult;
  flexureMinor: FlexureResult;
  shear: LimitCheck;
  axialCheck: { ratio: number; kind: 'tension' | 'compression' | 'none' };
  bendingXCheck: number;
  bendingYCheck: number;
  shearCheck: number;
  combined: CombinedResult | null;
  governing: { name: string; ratio: number };
}

export function analyzeMember(inp: MemberInputs): MemberResult {
  const slenderness = classify(inp.section, inp.material.Fy);
  const tens = tension(inp.section, inp.material, inp.An, inp.U);
  const comp = compression(inp);
  const fMaj = flexureMajor(inp);
  const fMin = flexureMinor(inp);
  const shr = shearMajor(inp);

  const inTension = inp.Pu > 0;
  const axial = inTension ? tens : comp;
  const axialKind: 'tension' | 'compression' | 'none' =
    Math.abs(inp.Pu) < 1e-9 ? 'none' : inTension ? 'tension' : 'compression';
  const axialRatio = axial.phiRn > 0 ? Math.abs(inp.Pu) / axial.phiRn : 0;
  const bx = fMaj.phiRn > 0 ? Math.abs(inp.Mux) / fMaj.phiRn : 0;
  const by = fMin.phiRn > 0 ? Math.abs(inp.Muy) / fMin.phiRn : 0;
  const sv = shr.phiRn > 0 ? Math.abs(inp.Vu) / shr.phiRn : 0;

  const comb = (axialKind !== 'none' && (Math.abs(inp.Mux) > 0 || Math.abs(inp.Muy) > 0))
    ? combined(inp, axial, fMaj, fMin) : null;

  // governing utilisation
  const ratios: Array<{ name: string; ratio: number }> = [
    { name: `Axial ${axialKind}`, ratio: axialRatio },
    { name: 'Bending (major)', ratio: bx },
    { name: 'Bending (minor)', ratio: by },
    { name: 'Shear', ratio: sv },
  ];
  if (comb) ratios.push({ name: `Combined (${comb.equation})`, ratio: comb.ratio });
  const governing = ratios.reduce((a, b) => (b.ratio > a.ratio ? b : a), { name: '—', ratio: 0 });

  return {
    slenderness, tension: tens, compression: comp, flexureMajor: fMaj, flexureMinor: fMin, shear: shr,
    axialCheck: { ratio: axialRatio, kind: axialKind },
    bendingXCheck: bx, bendingYCheck: by, shearCheck: sv, combined: comb, governing,
  };
}
