// Combined Footing — formatting helpers shared by UI + print report.

import type { CombinedFootingAnalysis } from './types';

export interface CombinedCheckSummary {
  label: string;
  ref: string;
  demand: string;
  capacity: string;
  ratio: number | null;
  ok: boolean;
  notApplicable?: boolean;
}

export function buildCombinedCheckSummary(r: CombinedFootingAnalysis): CombinedCheckSummary[] {
  return [
    {
      label: 'Bearing pressure (service, rigid method)',
      ref: 'ACI §13.3.1 / 13.3.4.3',
      demand: `qmax = ${r.bearing.q_max.toFixed(1)} kPa`,
      capacity: `qa = ${r.input.soil.qa.toFixed(1)} kPa`,
      ratio: r.bearing.ratio,
      ok: r.bearing.ok,
    },
    {
      label: 'Two-way shear at column 1',
      ref: 'ACI §22.6',
      demand: `Vu = ${r.punching1.Vu.toFixed(1)} kN`,
      capacity: `φVc = ${r.punching1.phiVc.toFixed(1)} kN`,
      ratio: r.punching1.ratio,
      ok: r.punching1.ok,
    },
    {
      label: 'Two-way shear at column 2',
      ref: 'ACI §22.6',
      demand: `Vu = ${r.punching2.Vu.toFixed(1)} kN`,
      capacity: `φVc = ${r.punching2.phiVc.toFixed(1)} kN`,
      ratio: r.punching2.ratio,
      ok: r.punching2.ok,
    },
    {
      label: 'Longitudinal one-way shear',
      ref: 'ACI §22.5.5.1',
      demand: `Vu = ${r.shearLong.Vu.toFixed(1)} kN`,
      capacity: `φVc = ${r.shearLong.phiVc.toFixed(1)} kN`,
      ratio: r.shearLong.ratio,
      ok: r.shearLong.ok,
    },
    {
      label: 'Longitudinal flexure (positive — cantilever)',
      ref: 'ACI §13.3.3 / §9.3',
      demand: `Mu+ = ${r.flexLongPos.Mu.toFixed(1)} kN·m`,
      capacity: `φMn = ${r.flexLongPos.phiMn.toFixed(1)} kN·m`,
      ratio: r.flexLongPos.ratio,
      ok: r.flexLongPos.ok,
    },
    {
      label: 'Longitudinal flexure (negative — between cols)',
      ref: 'ACI §13.3.3 / §9.3',
      demand: `Mu− = ${Math.abs(r.flexLongNeg.Mu).toFixed(1)} kN·m`,
      capacity: `φMn = ${r.flexLongNeg.phiMn.toFixed(1)} kN·m`,
      ratio: r.flexLongNeg.ratio,
      ok: r.flexLongNeg.ok,
    },
    {
      label: 'Transverse flexure under column 1',
      ref: 'ACI §13.3.3 / §15-6 (Wight)',
      demand: `Mu = ${r.flexTrans1.Mu.toFixed(1)} kN·m`,
      capacity: `φMn = ${r.flexTrans1.phiMn.toFixed(1)} kN·m`,
      ratio: r.flexTrans1.ratio,
      ok: r.flexTrans1.ok,
    },
    {
      label: 'Transverse flexure under column 2',
      ref: 'ACI §13.3.3 / §15-6 (Wight)',
      demand: `Mu = ${r.flexTrans2.Mu.toFixed(1)} kN·m`,
      capacity: `φMn = ${r.flexTrans2.phiMn.toFixed(1)} kN·m`,
      ratio: r.flexTrans2.ratio,
      ok: r.flexTrans2.ok,
    },
  ];
}

export function formatRatio(r: number | null): string {
  if (r === null) return '—';
  return r.toFixed(2);
}
