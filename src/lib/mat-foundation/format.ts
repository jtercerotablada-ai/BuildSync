// Mat Foundation — formatting helpers shared by UI + print report.

import type { MatFoundationAnalysis } from './types';

export interface MatCheckSummary {
  label: string;
  ref: string;
  demand: string;
  capacity: string;
  ratio: number | null;
  ok: boolean;
  notApplicable?: boolean;
}

export function buildMatCheckSummary(r: MatFoundationAnalysis): MatCheckSummary[] {
  const rows: MatCheckSummary[] = [
    {
      label: 'Bearing pressure (rigid method)',
      ref: 'ACI §13.3.4.3',
      demand: `qmax = ${r.bearing.q_max.toFixed(1)} kPa`,
      capacity: `qa = ${r.input.soil.qa.toFixed(1)} kPa`,
      ratio: r.bearing.ratio,
      ok: r.bearing.ok,
    },
  ];
  for (const p of r.punching) {
    rows.push({
      label: `Punching at column ${p.columnId} (${p.location})`,
      ref: 'ACI §22.6',
      demand: `Vu = ${p.Vu.toFixed(1)} kN`,
      capacity: `φVc = ${p.phiVc.toFixed(1)} kN`,
      ratio: p.ratio,
      ok: p.ok,
    });
  }
  for (const bi of r.bearingInterface) {
    rows.push({
      label: `Bearing interface at column ${bi.columnId}`,
      ref: 'ACI §22.8',
      demand: `Pu = ${bi.Pu.toFixed(1)} kN`,
      capacity: `φBn = ${bi.phiBn.toFixed(1)} kN`,
      ratio: bi.ratio,
      ok: bi.ok,
    });
  }
  rows.push({
    label: 'Strip-method flexure (X)',
    ref: 'ACI §13.3.4',
    demand: `+Mu req: ${r.stripFlexureX.AsReq_pos_per_m.toFixed(0)} mm²/m`,
    capacity: `prov ${r.stripFlexureX.AsProv_pos_per_m.toFixed(0)} mm²/m`,
    ratio: r.stripFlexureX.AsReq_pos_per_m / Math.max(r.stripFlexureX.AsProv_pos_per_m, 1e-9),
    ok: r.stripFlexureX.ok,
  });
  rows.push({
    label: 'Strip-method flexure (Y)',
    ref: 'ACI §13.3.4',
    demand: `+Mu req: ${r.stripFlexureY.AsReq_pos_per_m.toFixed(0)} mm²/m`,
    capacity: `prov ${r.stripFlexureY.AsProv_pos_per_m.toFixed(0)} mm²/m`,
    ratio: r.stripFlexureY.AsReq_pos_per_m / Math.max(r.stripFlexureY.AsProv_pos_per_m, 1e-9),
    ok: r.stripFlexureY.ok,
  });
  for (const bf of r.barFit) {
    rows.push({
      label: `Bar fit / spacing — ${bf.layer}`,
      ref: 'ACI §25.2.1',
      demand: `sclear = ${bf.s_clear.toFixed(0)} mm`,
      capacity: `${bf.s_min.toFixed(0)} ≤ s ≤ ${bf.s_max.toFixed(0)} mm`,
      ratio: null,
      ok: bf.ok,
    });
  }
  return rows;
}

export function formatRatio(r: number | null): string {
  if (r === null) return '—';
  return r.toFixed(2);
}
