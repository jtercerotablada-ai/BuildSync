'use client';

import React from 'react';
import type { SeismicResult } from '@/lib/load-gen/types';
import type { UnitSystem } from '@/lib/beam/units';
import { fromSI, unitLabel } from '@/lib/beam/units';

interface Props {
  result: SeismicResult | null;
  unitSystem: UnitSystem;
}

const INK = '#221e17', GOLD = '#c9a84c', GOLD_DEEP = '#9a7a2c', LINE = '#cfc7b6', MUTE = '#8a8272';

/** ELF vertical force distribution — story forces Fx and base shear V. */
export function SeismicDiagram({ result, unitSystem }: Props) {
  const fu = unitLabel('force', unitSystem);
  const fmt = (n: number) => `${fromSI(n, 'force', unitSystem).toFixed(1)} ${fu}`;

  const W = 560, H = 320;
  const baseY = 275, topY = 40, colX = 235, colW = 70;
  const forces = result?.forces ?? [];
  const N = forces.length;
  const storyH = N > 0 ? (baseY - topY) / N : baseY - topY;
  const maxF = Math.max(1, ...forces.map((f) => Math.abs(f.Fx)));
  const arrowMax = 150;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stl-chart" role="img" aria-label="Seismic vertical force distribution">
      {/* ground + hatch */}
      <line x1={colX - 40} y1={baseY} x2={colX + colW + 210} y2={baseY} stroke={INK} strokeWidth={1.4} />
      {Array.from({ length: 14 }).map((_, i) => {
        const x = colX - 38 + i * ((colW + 240) / 14);
        return <line key={i} x1={x} y1={baseY} x2={x - 7} y2={baseY + 8} stroke={LINE} strokeWidth={1} />;
      })}

      {/* building column with story boxes */}
      {Array.from({ length: Math.max(N, 1) }).map((_, i) => {
        const y = baseY - (i + 1) * storyH;
        return <rect key={i} x={colX} y={y} width={colW} height={storyH} fill={INK} fillOpacity={0.04} stroke={INK} strokeWidth={1.1} />;
      })}

      {/* story force arrows + labels + triangular envelope */}
      {forces.map((f) => {
        const yLevel = baseY - f.level * storyH + storyH * 0.32;
        const len = (Math.abs(f.Fx) / maxF) * arrowMax;
        const x0 = colX + colW;
        return (
          <g key={f.level}>
            <line x1={x0} y1={yLevel} x2={x0 + len} y2={yLevel} stroke={GOLD_DEEP} strokeWidth={1.6} markerEnd="url(#lgs-arr)" />
            <text x={x0 + len + 6} y={yLevel + 3} className="stl-chart__lbl" style={{ fill: INK, fontWeight: 600 }}>
              F{f.level} {fmt(f.Fx)}
            </text>
          </g>
        );
      })}
      {/* envelope line connecting arrow tips */}
      {N > 1 && (
        <polyline
          points={forces
            .map((f) => `${colX + colW + (Math.abs(f.Fx) / maxF) * arrowMax},${baseY - f.level * storyH + storyH * 0.32}`)
            .join(' ')}
          fill="none" stroke={GOLD} strokeDasharray="4 4" strokeWidth={1}
        />
      )}

      {/* base shear */}
      {result && (
        <>
          <line x1={colX - 6} y1={baseY + 20} x2={colX + colW + 6} y2={baseY + 20} stroke={INK} strokeWidth={0} />
          <text x={colX + colW / 2} y={baseY + 22} textAnchor="middle" className="stl-chart__lbl" style={{ fill: GOLD_DEEP, fontWeight: 600 }}>
            V = {fmt(result.V)}
          </text>
        </>
      )}
      {!result && <text x={W / 2} y={H / 2} textAnchor="middle" className="stl-note">Enter seismic data to view</text>}

      <defs>
        <marker id="lgs-arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill={GOLD_DEEP} />
        </marker>
      </defs>
    </svg>
  );
}
