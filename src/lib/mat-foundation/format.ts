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
  return rows;
}

export function formatRatio(r: number | null): string {
  if (r === null) return '—';
  return r.toFixed(2);
}
