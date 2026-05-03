'use client';

import React from 'react';
import type { EnvelopeAnalysis, StationResult } from '@/lib/rc/types';

interface Props {
  result: EnvelopeAnalysis;
  /** 'en' | 'es' for narrative labels. */
  lang?: 'en' | 'es';
}

/**
 * RcEnvelopeDiagram — capacity-vs-demand envelope plots along beam length.
 *
 * Visual convention follows Wight & MacGregor Fig 8-19g (moment-strength
 * diagram superimposed on required-moment envelope):
 *   • Demand curve (Mu(x), Vu(x)) — solid filled
 *   • Capacity curve (φMn(x), φVn(x)) — dashed line
 *   • Pass region (φCap ≥ demand) — neutral
 *   • Fail region (demand > φCap) — solid red shading
 *
 * Two stacked panels: flexure (top) and shear (bottom).
 */
export function RcEnvelopeDiagram({ result, lang = 'en' }: Props) {
  const stations = result.stations;
  if (stations.length < 2) {
    return <p className="ab-empty">{lang === 'es' ? 'No hay estaciones que graficar.' : 'No stations to plot.'}</p>;
  }

  const L = result.input.geometry.L;     // mm
  const Lm = L / 1000;                   // m

  return (
    <div className="rc-env">
      <EnvelopePanel
        title={lang === 'es' ? 'FLEXIÓN — Mu(x) vs φMn(x)' : 'FLEXURE — Mu(x) vs φMn(x)'}
        unit="kN·m"
        L={L}
        stations={stations}
        kind="flexure"
        lang={lang}
      />
      <EnvelopePanel
        title={lang === 'es' ? 'CORTANTE — Vu(x) vs φVn(x)' : 'SHEAR — Vu(x) vs φVn(x)'}
        unit="kN"
        L={L}
        stations={stations}
        kind="shear"
        lang={lang}
      />
      <p className="rc-env__caption">
        {lang === 'es'
          ? `Longitud L = ${Lm.toFixed(2)} m. Estaciones evaluadas: ${stations.length}. Convención: x medido desde el apoyo izquierdo.`
          : `Span L = ${Lm.toFixed(2)} m. Stations evaluated: ${stations.length}. Convention: x measured from left support.`}
      </p>
    </div>
  );
}

// ============================================================================
// Single panel (flexure or shear)
// ============================================================================
function EnvelopePanel({
  title, unit, L, stations, kind, lang,
}: {
  title: string;
  unit: string;
  L: number;
  stations: StationResult[];
  kind: 'flexure' | 'shear';
  lang: 'en' | 'es';
}) {
  // SVG canvas
  const W = 880, H = 280;
  const padL = 70, padR = 30, padT = 40, padB = 50;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // Demand and capacity getters
  const demand = (s: StationResult) => kind === 'flexure' ? s.Mu : s.Vu;
  const capacity = (s: StationResult) => kind === 'flexure' ? s.phiMn : s.phiVn;
  const ratio = (s: StationResult) => kind === 'flexure' ? s.flexureRatio : s.shearRatio;

  // Y range
  const maxDemand = Math.max(...stations.map((s) => demand(s)));
  const maxCap = Math.max(...stations.map((s) => capacity(s)));
  const yMax = Math.max(maxDemand, maxCap) * 1.15;
  const yMin = 0;

  const sx = (x_mm: number) => padL + (x_mm / L) * innerW;
  const sy = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  // Worst (max ratio) station
  const worst = stations.reduce((a, b) => (ratio(b) > ratio(a) ? b : a));
  const worstFails = ratio(worst) > 1;
  const worstUtilPct = (ratio(worst) * 100);

  // Demand polygon: from (0, 0) along the demand curve back to (L, 0)
  const demandPts: [number, number][] = stations.map((s) => [sx(s.x), sy(demand(s))]);
  const demandPath =
    `M ${sx(0)},${sy(0)} ` +
    demandPts.map(([x, y]) => `L ${x},${y}`).join(' ') +
    ` L ${sx(L)},${sy(0)} Z`;

  const demandLine =
    `M ${demandPts[0][0]},${demandPts[0][1]} ` +
    demandPts.slice(1).map(([x, y]) => `L ${x},${y}`).join(' ');

  // Capacity polyline
  const capPts: [number, number][] = stations.map((s) => [sx(s.x), sy(capacity(s))]);
  const capLine =
    `M ${capPts[0][0]},${capPts[0][1]} ` +
    capPts.slice(1).map(([x, y]) => `L ${x},${y}`).join(' ');

  // FAIL polygons: where demand > capacity
  // Build segments: for each pair of consecutive stations where either endpoint fails,
  // draw a polygon between the two curves.
  const failPolys: string[] = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i], b = stations[i + 1];
    const fa = demand(a) > capacity(a);
    const fb = demand(b) > capacity(b);
    if (!fa && !fb) continue;
    // For simplicity in Phase 1: shade the full segment if either end fails.
    // A future refinement would interpolate the crossing x.
    const xa = sx(a.x), xb = sx(b.x);
    const yda = sy(demand(a)), ydb = sy(demand(b));
    const yca = sy(capacity(a)), ycb = sy(capacity(b));
    failPolys.push(`M ${xa},${yda} L ${xb},${ydb} L ${xb},${ycb} L ${xa},${yca} Z`);
  }

  // X axis ticks every 0.5 m, capped to ~10 ticks
  const Lm = L / 1000;
  const tickStep = Lm <= 4 ? 0.5 : Lm <= 8 ? 1 : Lm <= 16 ? 2 : 4;
  const xTicks: number[] = [];
  for (let xt = 0; xt <= Lm + 1e-6; xt += tickStep) xTicks.push(xt);

  // Y axis ticks: 5 evenly spaced
  const yTicks: number[] = [];
  for (let i = 0; i <= 5; i++) yTicks.push(yMin + (yMax - yMin) * (i / 5));

  const labelEn = (s: string) => s;
  const labelEs = (s: string) => s;
  const t = lang === 'es' ? labelEs : labelEn;
  void t;

  const passLabel = lang === 'es' ? 'CUMPLE' : 'PASSES';
  const failLabel = lang === 'es' ? 'NO CUMPLE' : 'FAILS';
  const worstLabel = lang === 'es' ? 'peor' : 'worst';

  return (
    <div className="rc-env__panel">
      <div className="rc-env__hdr">
        <h4 className="rc-env__title">{title}</h4>
        <span className={`rc-env__badge ${worstFails ? 'rc-env__badge--fail' : 'rc-env__badge--pass'}`}>
          {worstFails ? failLabel : passLabel} · {worstUtilPct.toFixed(1)}%
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="rc-env__svg">
        {/* Plot frame */}
        <rect x={padL} y={padT} width={innerW} height={innerH} fill="#fafafa" stroke="#cbd5e1" strokeWidth="1" />

        {/* Y-axis grid + ticks */}
        {yTicks.map((v, i) => (
          <g key={`yt-${i}`}>
            <line x1={padL} y1={sy(v)} x2={padL + innerW} y2={sy(v)} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="2 3" />
            <text x={padL - 8} y={sy(v) + 4} fontSize="11" fill="#475569" textAnchor="end" fontFamily="ui-sans-serif">
              {v.toFixed(0)}
            </text>
          </g>
        ))}
        <text x={20} y={padT + innerH / 2} fontSize="11" fill="#1e293b" textAnchor="middle"
              transform={`rotate(-90, 20, ${padT + innerH / 2})`} fontFamily="ui-sans-serif">
          {unit}
        </text>

        {/* X-axis grid + ticks */}
        {xTicks.map((xt, i) => (
          <g key={`xt-${i}`}>
            <line x1={sx(xt * 1000)} y1={padT} x2={sx(xt * 1000)} y2={padT + innerH} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="2 3" />
            <text x={sx(xt * 1000)} y={padT + innerH + 16} fontSize="11" fill="#475569" textAnchor="middle" fontFamily="ui-sans-serif">
              {xt.toFixed(tickStep < 1 ? 1 : 0)}
            </text>
          </g>
        ))}
        <text x={padL + innerW / 2} y={H - 12} fontSize="11" fill="#1e293b" textAnchor="middle" fontFamily="ui-sans-serif">
          x (m)
        </text>

        {/* Demand area (filled) */}
        <path d={demandPath} fill={kind === 'flexure' ? 'rgba(59,130,246,0.18)' : 'rgba(34,197,94,0.16)'} stroke="none" />
        <path d={demandLine} fill="none" stroke={kind === 'flexure' ? '#2563eb' : '#16a34a'} strokeWidth="2.25" />

        {/* Capacity dashed line (φCap) */}
        <path d={capLine} fill="none" stroke="#0f172a" strokeWidth="2" strokeDasharray="8 4" />

        {/* FAIL polygons (red) — overlaid */}
        {failPolys.map((d, i) => (
          <path key={`fp-${i}`} d={d} fill="rgba(220,38,38,0.55)" stroke="#dc2626" strokeWidth="1.5" />
        ))}

        {/* Worst station marker */}
        <g>
          <line x1={sx(worst.x)} y1={padT} x2={sx(worst.x)} y2={padT + innerH}
                stroke={worstFails ? '#dc2626' : '#f59e0b'} strokeWidth="1.5" strokeDasharray="4 3" />
          <circle cx={sx(worst.x)} cy={sy(demand(worst))} r="4.5"
                  fill={worstFails ? '#dc2626' : '#f59e0b'} stroke="white" strokeWidth="1.5" />
          <g transform={`translate(${sx(worst.x) + 10}, ${sy(demand(worst)) - 6})`}>
            <rect x={-2} y={-12} width={130} height={32} rx={4}
                  fill="white" stroke={worstFails ? '#dc2626' : '#f59e0b'} strokeWidth="1" opacity="0.95" />
            <text x={4} y={2} fontSize="11" fill="#0f172a" fontFamily="ui-sans-serif" fontWeight="600">
              {worstLabel} x={(worst.x / 1000).toFixed(2)}m
            </text>
            <text x={4} y={15} fontSize="10.5" fill="#0f172a" fontFamily="ui-sans-serif">
              {kind === 'flexure'
                ? `Mu=${worst.Mu.toFixed(1)}, φMn=${worst.phiMn.toFixed(1)}`
                : `Vu=${worst.Vu.toFixed(1)}, φVn=${worst.phiVn.toFixed(1)}`}
            </text>
          </g>
        </g>

        {/* Legend (top-right) */}
        <g transform={`translate(${padL + innerW - 230}, ${padT + 8})`}>
          <rect x={-6} y={-12} width={228} height={28} rx={3}
                fill="white" stroke="#cbd5e1" strokeWidth="0.75" opacity="0.92" />
          <line x1={0} y1={-2} x2={20} y2={-2} stroke={kind === 'flexure' ? '#2563eb' : '#16a34a'} strokeWidth="2.25" />
          <text x={24} y={2} fontSize="10.5" fill="#1e293b" fontFamily="ui-sans-serif">
            {kind === 'flexure' ? 'Mu (demand)' : 'Vu (demand)'}
          </text>
          <line x1={108} y1={-2} x2={128} y2={-2} stroke="#0f172a" strokeWidth="2" strokeDasharray="6 3" />
          <text x={132} y={2} fontSize="10.5" fill="#1e293b" fontFamily="ui-sans-serif">
            {kind === 'flexure' ? 'φMn (capacity)' : 'φVn (capacity)'}
          </text>
        </g>
      </svg>
    </div>
  );
}
