'use client';

import React from 'react';
import type { Results } from '@/lib/advanced-beam/types';

interface Props { results: Results; totalLength: number }

const INK = '#221e17', GOLD = '#c9a84c', GOLD_DEEP = '#9a7a2c', LINE = '#cfc7b6';
const fmt = (x: number, d = 1) => (Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');

/** One stacked diagram panel — ink line, subtle fill, gold peak markers. */
function Panel({ data, W, H, y0, L, label, unit, invert }: {
  data: { x: number; value: number }[]; W: number; H: number; y0: number; L: number; label: string; unit: string; invert?: boolean;
}) {
  const mL = 52, mR = 12;
  const ys = data.map((d) => d.value);
  const yAbs = Math.max(1e-9, ...ys.map((v) => Math.abs(v)));
  const px = (x: number) => mL + (x / L) * (W - mL - mR);
  const midY = y0 + H / 2;
  const s = invert ? -1 : 1;
  const py = (v: number) => midY - s * (v / yAbs) * (H / 2 - 8);
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${px(d.x).toFixed(1)},${py(d.value).toFixed(1)}`).join(' ');
  const area = `M${px(0).toFixed(1)},${midY.toFixed(1)} ${line.slice(1)} L${px(L).toFixed(1)},${midY.toFixed(1)} Z`;
  let iMax = 0, iMin = 0; ys.forEach((v, i) => { if (v > ys[iMax]) iMax = i; if (v < ys[iMin]) iMin = i; });
  const peaks = [iMax, iMin].filter((i, k, a) => a.indexOf(i) === k && Math.abs(ys[i]) > 1e-6 * yAbs);
  return (
    <g>
      <text x={mL} y={y0 + 12} className="stl-chart__lbl" style={{ fontWeight: 600, fill: INK }}>{label}</text>
      <text x={mL - 6} y={y0 + 12} textAnchor="end" className="stl-chart__ax">{unit}</text>
      <line x1={mL} y1={midY} x2={W - mR} y2={midY} stroke={LINE} strokeWidth={1} />
      <path d={area} fill={INK} fillOpacity={0.055} />
      <path d={line} fill="none" stroke={INK} strokeWidth={1.5} />
      {peaks.map((i) => (
        <g key={i}>
          <circle cx={px(data[i].x)} cy={py(ys[i])} r={3} fill={GOLD} stroke={INK} strokeWidth={0.6} />
          <text x={px(data[i].x)} y={py(ys[i]) + (ys[i] >= 0 ? -5 : 12) * s} textAnchor="middle" className="stl-chart__lbl" style={{ fill: GOLD_DEEP, fontWeight: 600 }}>{fmt(ys[i], Math.abs(ys[i]) < 10 ? 2 : 0)}</text>
        </g>
      ))}
    </g>
  );
}

export function AdvancedBeamDiagrams({ results, totalLength }: Props) {
  if (!results.solved || results.shear.length === 0) {
    return <p className="stl-note">Diagrams will appear after a successful solve.</p>;
  }
  const L = totalLength;
  const W = 560, hPanel = 96, mT = 6, gap = 8;
  const panels: { data: { x: number; value: number }[]; label: string; unit: string; invert?: boolean }[] = [
    { data: results.shear, label: 'Shear V', unit: 'kN' },
    { data: results.moment, label: 'Moment M (sagging +)', unit: 'kN·m', invert: true },
    { data: results.slope, label: 'Slope θ', unit: 'rad' },
    { data: results.deflection, label: 'Deflection δ (up +)', unit: 'mm', invert: true },
  ];
  const totalH = mT + panels.length * (hPanel + gap) + 16;
  return (
    <svg viewBox={`0 0 ${W} ${totalH}`} className="stl-chart" role="img" aria-label="beam diagrams">
      {panels.map((p, i) => (
        <Panel key={p.label} data={p.data} W={W} H={hPanel} y0={mT + i * (hPanel + gap)} L={L} label={p.label} unit={p.unit} invert={p.invert} />
      ))}
      <text x={W / 2} y={totalH - 3} textAnchor="middle" className="stl-chart__ax">x (m) · span {fmt(L, 1)} m</text>
    </svg>
  );
}
