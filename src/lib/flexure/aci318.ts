// Simple flexure (singly-reinforced rectangular section) per ACI 318-25.
// Faithful port of the Tercero Tablada "Diseño/Análisis a Flexión" spreadsheet.
//
// Unit convention (matches the spreadsheet's "DATOS DE INICIO"):
//   b, h : metres (m)        — section base & total height
//   r    : centimetres (cm)  — cover to the centroid of the steel
//   fy, fc : MPa
//   Mu   : kN·m
//   As   : cm²
// Internally we compute in mm / MPa / N and report kN·m, so the numbers
// line up 1:1 with the Excel sheet.

export const EPS_CU = 0.003; // concrete crushing strain
export const ES = 200_000; // MPa, steel modulus (εty = fy/Es ≈ 0.0021 for Gr.60)

/** Commercial bar table from the spreadsheet (Ø in mm, area each in cm²). */
export const BAR_TABLE: { dia: number; areaCm2: number; label: string }[] = [
  { dia: 8, areaCm2: 0.503, label: 'Ø8' },
  { dia: 10, areaCm2: 0.785, label: 'Ø10' },
  { dia: 12, areaCm2: 1.131, label: 'Ø12' },
  { dia: 14, areaCm2: 1.539, label: 'Ø14' },
  { dia: 16, areaCm2: 2.011, label: 'Ø16' },
  { dia: 18, areaCm2: 2.545, label: 'Ø18' },
  { dia: 20, areaCm2: 3.142, label: 'Ø20' },
  { dia: 22, areaCm2: 3.801, label: 'Ø22' },
  { dia: 25, areaCm2: 4.909, label: 'Ø25' },
  { dia: 28, areaCm2: 6.158, label: 'Ø28' },
  { dia: 32, areaCm2: 8.042, label: 'Ø32' },
];

export interface SectionInputs {
  b: number; // m
  h: number; // m
  rCm: number; // cm, cover to steel centroid
  fy: number; // MPa
  fc: number; // MPa
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** ACI Table 22.2.2.4.3 — stress-block factor β1. */
export function beta1(fc: number): number {
  if (fc <= 28) return 0.85;
  if (fc >= 55) return 0.65;
  return 0.85 - 0.05 * (fc - 28) / 7;
}

/** Effective depth d = h − r (returns metres). */
export function effectiveDepth(h: number, rCm: number): number {
  return h - rCm / 100;
}

/** ρmin per ACI 9.6.1.2 (1.4/fy governs for fc ≤ ~31 MPa; the √fc term for higher). */
export function rhoMinCode(fy: number, fc: number): number {
  return Math.max(1.4 / fy, (0.25 * Math.sqrt(fc)) / fy);
}

/** ρ at the tension-controlled limit εt = 0.005 (keeps φ = 0.90). */
export function rhoMaxDuctile(fc: number, fy: number): number {
  const b1 = beta1(fc);
  return 0.85 * b1 * (fc / fy) * (EPS_CU / (EPS_CU + 0.005));
}

export interface DesignResult {
  dM: number; // effective depth (m)
  Rn: number; // MPa
  rho: number; // required (from Mu)
  rhoMin1: number; // 1.4/fy
  rhoMin2: number; // (4/3)·ρ  (ACI 9.6.1.3 — may govern the lower bound)
  rhoMinAdopted: number; // min(rhoMin1, rhoMin2)
  rhoMax: number; // εt = 0.005
  rhoDesign: number; // max(ρ, ρmin adoptado)
  asReqCm2: number; // required steel area
  ductile: boolean; // ρ ≤ ρmax
  beta1: number;
  feasible: boolean; // false ⇒ Mu too large for a singly-reinforced section
}

/** Section 1–4 of the "Diseño a Flexión" sheet: from Mu → required steel. */
export function designFlexure(inp: SectionInputs, MuKNm: number): DesignResult {
  const { b, h, rCm, fy, fc } = inp;
  const dM = effectiveDepth(h, rCm);
  const bMm = b * 1000;
  const dMm = dM * 1000;
  const b1 = beta1(fc);

  // Rn = Mu / (0.9·b·d²)   (N·mm, mm ⇒ MPa)
  const Rn = (MuKNm * 1e6) / (0.9 * bMm * dMm * dMm);

  const inner = 1 - (2 * Rn) / (0.85 * fc);
  const feasible = inner >= 0;
  const rho = feasible ? (0.85 * fc) / fy * (1 - Math.sqrt(inner)) : NaN;

  const rhoMin1 = 1.4 / fy;
  const rhoMin2 = (4 / 3) * (feasible ? rho : 0);
  const rhoMinAdopted = Math.min(rhoMin1, rhoMin2);
  const rhoMax = rhoMaxDuctile(fc, fy);
  const rhoDesign = Math.max(feasible ? rho : 0, rhoMinAdopted);

  const asReqMm2 = rhoDesign * bMm * dMm;

  return {
    dM,
    Rn,
    rho,
    rhoMin1,
    rhoMin2,
    rhoMinAdopted,
    rhoMax,
    rhoDesign,
    asReqCm2: asReqMm2 / 100,
    ductile: feasible ? rho <= rhoMax : false,
    beta1: b1,
    feasible,
  };
}

export interface CapacityResult {
  dM: number;
  rho: number;
  beta1: number;
  aMm: number; // Whitney block depth a (mm)
  cMm: number; // neutral axis depth c (mm)
  et: number; // net tensile strain εt
  phiRaw: number; // 0.65 + (εt − 0.002)·250/3
  phi: number; // clamped to [0.65, 0.90]
  MnKNm: number;
  phiMnKNm: number;
  rhoMin: number;
  rhoMax: number;
  aboveMin: boolean; // ρ ≥ ρmin
  accepted: boolean; // εt ≥ 0.004
  tensionControlled: boolean; // εt ≥ 0.005 ⇒ φ = 0.90
}

/**
 * Sections 5–6 of "Diseño" (verification of the placed steel) AND the whole
 * "Análisis a Flexión" sheet: from a section + As → capacity φMn.
 */
export function capacityFromAs(inp: SectionInputs, asCm2: number): CapacityResult {
  const { b, h, rCm, fy, fc } = inp;
  const dM = effectiveDepth(h, rCm);
  const bMm = b * 1000;
  const dMm = dM * 1000;
  const asMm2 = asCm2 * 100;
  const b1 = beta1(fc);

  const rho = asMm2 / (bMm * dMm);
  const aMm = (asMm2 * fy) / (0.85 * fc * bMm);
  const cMm = aMm / b1;
  const et = ((dMm - cMm) / cMm) * EPS_CU;

  const phiRaw = 0.65 + (et - 0.002) * (250 / 3);
  const phi = clamp(phiRaw, 0.65, 0.9);

  // Mn = b·d²·fy·ρ·(1 − ρ·fy/(1.7·f'c))   (N·mm ⇒ kN·m)
  const MnKNm = (bMm * dMm * dMm * fy * rho * (1 - (rho * fy) / (1.7 * fc))) / 1e6;
  const phiMnKNm = phi * MnKNm;

  const rhoMin = rhoMinCode(fy, fc);
  const rhoMax = rhoMaxDuctile(fc, fy);

  return {
    dM,
    rho,
    beta1: b1,
    aMm,
    cMm,
    et,
    phiRaw,
    phi,
    MnKNm,
    phiMnKNm,
    rhoMin,
    rhoMax,
    aboveMin: rho >= rhoMin,
    accepted: et >= 0.004,
    tensionControlled: et >= 0.005,
  };
}

/** Bar centroid positions for the cross-section drawing (single row, evenly spread). */
export function rebarLayout(
  inp: SectionInputs,
  nBars: number,
): { x: number; y: number }[] {
  const { b, h, rCm } = inp;
  const n = Math.max(1, Math.min(8, Math.round(nBars)));
  const cover = rCm / 100; // m, to centroid
  void h;
  const yBar = cover; // tension steel centroid sits r above the bottom face
  const usable = Math.max(b - 2 * cover, 0);
  const pts: { x: number; y: number }[] = [];
  if (n === 1) {
    pts.push({ x: b / 2, y: yBar });
  } else {
    const step = usable / (n - 1);
    for (let i = 0; i < n; i++) pts.push({ x: cover + i * step, y: yBar });
  }
  return pts;
}
