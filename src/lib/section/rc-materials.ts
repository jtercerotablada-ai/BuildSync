import type { RcMaterials } from './rc-types';

// ACI 318 derived material constants. All inputs in MPa.
//
//   Ec (normal-weight concrete) = 4700·√f'c       (ACI 318-19 §19.2.2.1.b)
//   fr  (modulus of rupture)    = 0.62·√f'c       (ACI 318-19 §19.2.3)
//   εcu  (ultimate strain)      = 0.003           (ACI 318-19 §22.2.2.1)
//   β1                          = 0.85 for f'c ≤ 28 MPa (≈ 4000 psi)
//                                 = 0.85 − 0.05·(f'c − 28)/7, not less than 0.65
//                                                 (ACI 318-19 §22.2.2.4.3)

export const DEFAULT_EPS_CU = 0.003;
export const DEFAULT_ES = 200_000; // MPa

export function ecFromFc(fc: number): number {
  return 4700 * Math.sqrt(Math.max(fc, 0));
}

export function frFromFc(fc: number): number {
  return 0.62 * Math.sqrt(Math.max(fc, 0));
}

export function beta1FromFc(fc: number): number {
  if (fc <= 28) return 0.85;
  return Math.max(0.65, 0.85 - (0.05 * (fc - 28)) / 7);
}

export function resolveMaterials(m: RcMaterials) {
  const Ec = m.Ec ?? ecFromFc(m.fc);
  const fr = m.fr ?? frFromFc(m.fc);
  const epsCU = m.epsCU ?? DEFAULT_EPS_CU;
  const beta1 = m.beta1 ?? beta1FromFc(m.fc);
  const n = m.Es / Math.max(Ec, 1e-9); // modular ratio
  return {
    fc: m.fc,
    fy: m.fy,
    Es: m.Es,
    Ec,
    fr,
    epsCU,
    beta1,
    n,
    epsY: m.fy / m.Es,
  };
}

// ACI 318-19 §21.2.2: φ for flexure/axial varies with εt at nominal strength.
//   Tied-column baseline φ = 0.65 (compression-controlled, εt ≤ εy)
//   Tension-controlled       φ = 0.90 (εt ≥ 0.005)
//   Transition: linear in εt between εy and 0.005.
// For Grade 60 steel (fy = 420 MPa) εy = 0.00207.
export function phiFromStrain(epsT: number, epsY: number, spiral = false): number {
  const phiC = spiral ? 0.75 : 0.65;
  const phiT = 0.9;
  if (epsT <= epsY) return phiC;
  if (epsT >= 0.005) return phiT;
  return phiC + ((phiT - phiC) * (epsT - epsY)) / (0.005 - epsY);
}
