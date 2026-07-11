'use client';

import React from 'react';
import type { SnowResult } from '@/lib/load-gen/types';
import type { UnitSystem } from '@/lib/beam/units';
import { fromSI, unitLabel } from '@/lib/beam/units';

interface Props {
  result: SnowResult | null;
  roofSlope: number;   // degrees
  unitSystem: UnitSystem;
}

const INK = '#221e17', GOLD = '#c9a84c', GOLD_DEEP = '#9a7a2c', LINE = '#cfc7b6', MUTE = '#8a8272';

/** Roof section with the governing balanced snow blanket (gable profile). */
export function SnowRoofDiagram({ result, roofSlope, unitSystem }: Props) {
  const pu = unitLabel('pressureSmall', unitSystem);
  const fmt = (pa: number) => `${fromSI(pa, 'pressureSmall', unitSystem).toFixed(1)} ${pu}`;

  const W = 560, H = 230;
  const eaveL = 150, eaveR = 410, span = eaveR - eaveL;
  const eaveY = 150, wallBot = 205;
  const rise = Math.min(70, Math.tan((Math.min(roofSlope, 70) * Math.PI) / 180) * (span / 2));
  const ridgeY = eaveY - rise, ridgeX = (eaveL + eaveR) / 2;

  // snow blanket thickness ∝ governing balanced load (visual only)
  const gov = result?.governing ?? 0;
  const pf = result?.pf ?? 0;
  const maxRef = Math.max(gov, pf, 1);
  const blanket = 12 + (gov / maxRef) * 34;

  const roofPts = `${eaveL},${eaveY} ${ridgeX},${ridgeY} ${eaveR},${eaveY}`;
  const snowPts = `${eaveL},${eaveY - blanket} ${ridgeX},${ridgeY - blanket} ${eaveR},${eaveY - blanket} ${ridgeX},${ridgeY} ${eaveL},${eaveY}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stl-chart" role="img" aria-label="Snow load roof section">
      {/* walls */}
      <line x1={eaveL} y1={eaveY} x2={eaveL} y2={wallBot} stroke={INK} strokeWidth={1.4} />
      <line x1={eaveR} y1={eaveY} x2={eaveR} y2={wallBot} stroke={INK} strokeWidth={1.4} />
      <line x1={eaveL} y1={wallBot} x2={eaveR} y2={wallBot} stroke={INK} strokeWidth={1.4} />
      {/* ground */}
      <line x1={eaveL - 60} y1={wallBot} x2={eaveR + 60} y2={wallBot} stroke={INK} strokeWidth={1} />

      {/* snow blanket */}
      {result && <polygon points={snowPts} fill={GOLD} fillOpacity={0.22} stroke={GOLD_DEEP} strokeWidth={1} />}
      {/* snow surface load ticks */}
      {result && Array.from({ length: 9 }).map((_, i) => {
        const t = (i + 0.5) / 9;
        const x = eaveL + t * span;
        const yRoof = t <= 0.5 ? eaveY - (rise) * (t / 0.5) : eaveY - rise * ((1 - t) / 0.5);
        return <line key={i} x1={x} y1={yRoof - blanket - 8} x2={x} y2={yRoof - blanket} stroke={GOLD_DEEP} strokeWidth={1} />;
      })}
      {/* roof line */}
      <polyline points={roofPts} fill="none" stroke={INK} strokeWidth={1.6} />

      {/* slope note */}
      <text x={ridgeX} y={ridgeY - blanket - 14} textAnchor="middle" className="stl-chart__ax">
        {roofSlope > 0 ? `slope ${roofSlope}°` : 'flat roof'}
      </text>

      {/* results readout */}
      {result && (
        <g>
          <text x={eaveL - 60} y={wallBot + 22} className="stl-chart__lbl" style={{ fill: MUTE }}>
            pf {fmt(result.pf)}
          </text>
          <text x={ridgeX} y={wallBot + 22} textAnchor="middle" className="stl-chart__lbl" style={{ fill: INK, fontWeight: 600 }}>
            balanced {fmt(result.governing)}
          </text>
          <text x={eaveR + 60} y={wallBot + 22} textAnchor="end" className="stl-chart__lbl" style={{ fill: MUTE }}>
            pm {fmt(result.pm)}
          </text>
        </g>
      )}
      {!result && <text x={W / 2} y={H / 2} textAnchor="middle" className="stl-note">Enter snow data to view</text>}
    </svg>
  );
}
