// AISC 360-22 (LRFD) design of flat plates and rectangular bars.
// Flexure: Section F11 (rectangular bars) — yielding (F11-1) and, for major-axis
// bending, lateral-torsional buckling (F11.2: F11-3 inelastic, F11-4/F11-5
// elastic, in the Lb·d/t² regions).  Minor-axis bending has no LTB and no local
// buckling (solid rectangle).  Math is identical to 360-16 (labels renumbered).
// Shear: Section J4.2 — shear yielding (J4-3, φ=1.00) and rupture (J4-4, φ=0.75).
// US customary: kips, kip·in, ksi, in.

export const E = 29000; // ksi
export const PHI_B = 0.90;
export const PHI_SY = 1.00;  // shear yielding φ (J4.2)
export const PHI_SR = 0.75;  // shear rupture φ (J4.2)

export type BendAxis = 'minor' | 'major';

export interface PlateProps {
  A: number;                    // b·t (in²)
  // minor axis (flatwise, depth = t)
  Iyy: number; Symin: number; Zymin: number;
  // major axis (on edge, depth = b)
  Ixx: number; Sxmaj: number; Zxmaj: number;
}

export function plateProps(b: number, t: number): PlateProps {
  // Normalise so W = larger dimension, T = smaller (thickness): minor = weak
  // axis (flatwise, depth = T), major = strong axis (on edge, depth = W).
  // Robust to the user entering thickness > width.
  const W = Math.max(b, t), T = Math.min(b, t);
  return {
    A: b * t,
    Iyy: (W * T ** 3) / 12, Symin: (W * T ** 2) / 6, Zymin: (W * T ** 2) / 4,
    Ixx: (T * W ** 3) / 12, Sxmaj: (T * W ** 2) / 6, Zxmaj: (T * W ** 2) / 4,
  };
}

export interface PlateFlexure {
  axis: BendAxis;
  Mp: number; My: number; Mn: number; phiMn: number;
  S: number; Z: number;
  ltbParam?: number;  // Lb·d/t²
  governs: string; clause: string;
}

/** F11 flexure.  For 'major', d = b (depth), t = thickness and LTB is checked. */
export function plateFlexure(b: number, t: number, Fy: number, axis: BendAxis, Lb: number, Cb: number): PlateFlexure {
  const p = plateProps(b, t);
  const S = axis === 'minor' ? p.Symin : p.Sxmaj;
  const Z = axis === 'minor' ? p.Zymin : p.Zxmaj;
  const My = Fy * S;
  const Mp = Math.min(Fy * Z, 1.6 * My); // F11-1 (cap 1.6·My; for a rectangle Z/S=1.5 so Fy·Z governs)

  if (axis === 'minor') {
    return { axis, Mp, My, Mn: Mp, phiMn: PHI_B * Mp, S, Z, governs: 'Yielding, Mp (F11-1)', clause: 'F11.1' };
  }

  // Major-axis LTB (F11.2): depth d = larger dim, thickness = smaller dim
  const d = Math.max(b, t), th = Math.min(b, t);
  const lam = (Lb * d) / (th * th);   // Lb·d/t²
  const r1 = (0.08 * E) / Fy;
  const r2 = (1.9 * E) / Fy;
  let Mn: number; let governs: string;
  if (lam <= r1) { Mn = Mp; governs = 'Yielding, Mp (F11-1)'; }
  else if (lam <= r2) {
    Mn = Math.min(Mp, Cb * (1.52 - 0.274 * lam * (Fy / E)) * My); // F11-3 (360-22)
    governs = 'Inelastic LTB (F11-3)';
  } else {
    const Fcr = (1.9 * E * Cb) / lam;  // F11-5
    Mn = Math.min(Mp, Fcr * S);         // F11-4
    governs = 'Elastic LTB (F11-4)';
  }
  return { axis, Mp, My, Mn, phiMn: PHI_B * Mn, S, Z, ltbParam: lam, governs, clause: 'F11.2' };
}

export interface PlateShear {
  Agv: number; Anv: number;
  VnYield: number; VnRupture: number;
  phiVnYield: number; phiVnRupture: number;
  phiVn: number; governs: string;
}

/** J4.2 shear of the plate cross-section (Agv = b·t; holes reduce Anv). */
export function plateShear(b: number, t: number, Fy: number, Fu: number, holeArea: number): PlateShear {
  const Agv = b * t;
  const Anv = Math.max(0, Agv - holeArea);
  const VnYield = 0.6 * Fy * Agv;                 // J4-3
  const VnRupture = 0.6 * Fu * Anv;               // J4-4
  const phiVnYield = PHI_SY * VnYield;
  const phiVnRupture = PHI_SR * VnRupture;
  const phiVn = Math.min(phiVnYield, phiVnRupture);
  const governs = phiVnYield <= phiVnRupture ? 'Shear yielding (J4-3)' : 'Shear rupture (J4-4)';
  return { Agv, Anv, VnYield, VnRupture, phiVnYield, phiVnRupture, phiVn, governs };
}

export interface PlateInputs {
  b: number; t: number; Fy: number; Fu: number;
  axis: BendAxis; Lb: number; Cb: number; holeArea: number;
  Mu: number; Vu: number;
}
export interface PlateResult {
  props: PlateProps;
  flexure: PlateFlexure;
  shear: PlateShear;
  flexUtil: number; shearUtil: number;
  governing: { name: string; ratio: number };
}

export function analyzePlate(inp: PlateInputs): PlateResult {
  const props = plateProps(inp.b, inp.t);
  const flexure = plateFlexure(inp.b, inp.t, inp.Fy, inp.axis, inp.Lb, inp.Cb);
  const shear = plateShear(inp.b, inp.t, inp.Fy, inp.Fu, inp.holeArea);
  const flexUtil = flexure.phiMn > 0 ? inp.Mu / flexure.phiMn : Infinity;
  const shearUtil = shear.phiVn > 0 ? inp.Vu / shear.phiVn : Infinity;
  const cands = [
    { name: 'Flexure', ratio: flexUtil },
    { name: 'Shear', ratio: shearUtil },
  ];
  const governing = cands.reduce((a, x) => (x.ratio > a.ratio ? x : a));
  return { props, flexure, shear, flexUtil, shearUtil, governing };
}
