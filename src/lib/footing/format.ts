// Foundation Design — formatting helpers shared by UI + print report.

import type { FootingAnalysis } from './types';

export interface CheckSummary {
  label: string;
  ref: string;
  demand: string;
  capacity: string;
  ratio: number | null;     // null when N/A
  ok: boolean;
  notApplicable?: boolean;
}

/** Build the standard 13-row check summary used in the Checks tab + print. */
export function buildCheckSummary(r: FootingAnalysis): CheckSummary[] {
  return [
    {
      label: 'Bearing pressure (service)',
      ref: 'ACI §13.3.1',
      demand: `qmax = ${r.bearing.q_max.toFixed(1)} kPa`,
      capacity: `qa = ${r.input.soil.qa.toFixed(1)} kPa`,
      ratio: r.bearing.ratio,
      ok: r.bearing.ok,
    },
    {
      label: 'Two-way (punching) shear',
      ref: 'ACI §22.6',
      demand: `Vu = ${r.punching.Vu.toFixed(1)} kN`,
      capacity: `φVc = ${r.punching.phiVc.toFixed(1)} kN`,
      ratio: r.punching.ratio,
      ok: r.punching.ok,
    },
    {
      label: 'One-way shear (X)',
      ref: 'ACI §22.5.5.1',
      demand: `Vu = ${r.shearX.Vu.toFixed(1)} kN`,
      capacity: `φVc = ${r.shearX.phiVc.toFixed(1)} kN`,
      ratio: r.shearX.ratio,
      ok: r.shearX.ok,
    },
    {
      label: 'One-way shear (Y)',
      ref: 'ACI §22.5.5.1',
      demand: `Vu = ${r.shearY.Vu.toFixed(1)} kN`,
      capacity: `φVc = ${r.shearY.phiVc.toFixed(1)} kN`,
      ratio: r.shearY.ratio,
      ok: r.shearY.ok,
    },
    {
      label: 'Flexure (X)',
      ref: 'ACI §13.3.3',
      demand: `Mu = ${r.flexureX.Mu.toFixed(1)} kN·m`,
      capacity: `φMn = ${r.flexureX.phiMn.toFixed(1)} kN·m`,
      ratio: r.flexureX.ratio,
      ok: r.flexureX.ok,
    },
    {
      label: 'Flexure (Y)',
      ref: 'ACI §13.3.3',
      demand: `Mu = ${r.flexureY.Mu.toFixed(1)} kN·m`,
      capacity: `φMn = ${r.flexureY.phiMn.toFixed(1)} kN·m`,
      ratio: r.flexureY.ratio,
      ok: r.flexureY.ok,
    },
    {
      label: 'Bearing at column-footing interface',
      ref: 'ACI §22.8',
      demand: `Pu = ${r.bearingInterface.Pu.toFixed(1)} kN`,
      capacity: `φBn = ${r.bearingInterface.phiBn.toFixed(1)} kN`,
      ratio: r.bearingInterface.ratio,
      ok: r.bearingInterface.ok,
    },
    {
      label: 'Column dowels',
      ref: 'ACI §16.3.4.1',
      demand: r.dowel.informational
        ? `AsReq = ${r.dowel.AsDowelReq.toFixed(0)} mm² (informational)`
        : `AsProv = ${r.dowel.AsDowelProv.toFixed(0)} mm²`,
      capacity: `AsReq = ${r.dowel.AsDowelReq.toFixed(0)} mm² (0.005·Ag = ${r.dowel.AsDowelMin.toFixed(0)})`,
      ratio: r.dowel.AsDowelReq > 0 && !r.dowel.informational
        ? r.dowel.AsDowelProv / r.dowel.AsDowelReq
        : null,
      ok: r.dowel.ok,
      notApplicable: r.dowel.informational,
    },
    {
      label: 'Overturning stability',
      ref: 'Bowles §7.3',
      demand: r.overturning.notApplicable ? 'N/A' : `Movt = ${r.overturning.M_overturn.toFixed(1)} kN·m`,
      capacity: r.overturning.notApplicable ? 'N/A' : `Mres = ${r.overturning.M_resist.toFixed(1)} kN·m (FOS ≥ 1.5)`,
      ratio: r.overturning.notApplicable ? null : r.overturning.ratio,
      ok: r.overturning.ok,
      notApplicable: r.overturning.notApplicable,
    },
    {
      label: 'Sliding stability',
      ref: 'Bowles §7.4',
      demand: r.sliding.notApplicable ? 'N/A' : `H = ${r.sliding.H.toFixed(1)} kN`,
      capacity: r.sliding.notApplicable ? 'N/A' : `Hallow = ${r.sliding.H_allow.toFixed(1)} kN (FOS ≥ 1.5)`,
      ratio: r.sliding.notApplicable ? null : r.sliding.ratio,
      ok: r.sliding.ok,
      notApplicable: r.sliding.notApplicable,
    },
    {
      label: 'Bar fit / spacing (X)',
      ref: 'ACI §25.2.1',
      demand: `sclear = ${r.barFitX.s_clear.toFixed(0)} mm`,
      capacity: `${r.barFitX.s_min.toFixed(0)} ≤ s ≤ ${r.barFitX.s_max.toFixed(0)} mm`,
      ratio: null,
      ok: r.barFitX.ok,
    },
    {
      label: 'Bar fit / spacing (Y)',
      ref: 'ACI §25.2.1',
      demand: `s_clear = ${r.barFitY.s_clear.toFixed(0)} mm`,
      capacity: `${r.barFitY.s_min.toFixed(0)} ≤ s ≤ ${r.barFitY.s_max.toFixed(0)} mm`,
      ratio: null,
      ok: r.barFitY.ok,
    },
    {
      label: 'Development length (X)',
      ref: 'ACI §25.4.2.3',
      demand: `ld = ${r.developmentX.ld.toFixed(0)} mm`,
      capacity: `embedment = ${r.developmentX.embedment.toFixed(0)} mm`,
      ratio: null,
      ok: r.developmentX.ok,
    },
    {
      label: 'Development length (Y)',
      ref: 'ACI §25.4.2.3',
      demand: `ld = ${r.developmentY.ld.toFixed(0)} mm`,
      capacity: `embedment = ${r.developmentY.embedment.toFixed(0)} mm`,
      ratio: null,
      ok: r.developmentY.ok,
    },
  ];
}

export function formatRatio(r: number | null): string {
  if (r === null) return '—';
  return r.toFixed(2);
}
