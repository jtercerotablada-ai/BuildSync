'use client';

import React from 'react';
import type { StructureData, WindResult } from '@/lib/load-gen/types';
import type { UnitSystem } from '@/lib/beam/units';
import { fromSI, unitLabel } from '@/lib/beam/units';

interface Props {
  structure: StructureData;
  result: WindResult | null;
  unitSystem: UnitSystem;
}

/**
 * SVG elevation of the building with wind arrows + C&C zone boundaries +
 * design pressures annotated on each wall. Uses the same TTC dark gradient
 * background as the other canvases.
 */
export function WindPressureDiagram({ structure, result, unitSystem }: Props) {
  const pu = unitLabel('pressureSmall', unitSystem);
  const H = structure.H;
  const L = structure.L;

  // viewBox: building + side space for arrows + labels
  const padL = Math.max(L * 0.6, 4000);
  const padR = Math.max(L * 0.6, 4000);
  const padT = Math.max(H * 0.6, 3000);
  const padB = Math.max(H * 0.35, 2500);
  const vbW = L + padL + padR;
  const vbH = H + padT + padB;
  const xW = (x: number) => padL + x;
  const yW = (y: number) => padT + H - y;

  const a = result?.cc.a ?? Math.min(0.1 * Math.min(structure.B, structure.L), 0.4 * H);

  // arrow scale — max arrow length to 35% of padL
  const maxAbs = result
    ? Math.max(
        Math.abs(result.mwfrs.walls.windwardDesign),
        Math.abs(result.mwfrs.walls.leewardDesign)
      )
    : 1;
  const arrowScale = (padL * 0.4) / Math.max(maxAbs, 1);

  const fmt = (pa: number) =>
    `${fromSI(pa, 'pressureSmall', unitSystem).toFixed(1)} ${pu}`;

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className="lg-diagram"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Wind pressure diagram"
    >
      <defs>
        <marker id="lg-arr-r" markerWidth="10" markerHeight="10" refX="9" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L9,3.5 z" fill="#ff6b6b" />
        </marker>
        <marker id="lg-arr-b" markerWidth="10" markerHeight="10" refX="9" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L9,3.5 z" fill="#5dc4d4" />
        </marker>
      </defs>

      {/* ground line */}
      <line
        x1={xW(-padL * 0.8)}
        y1={yW(0)}
        x2={xW(L + padR * 0.8)}
        y2={yW(0)}
        stroke="#c9a84c"
        strokeWidth={6}
      />
      {/* ground hatching */}
      {Array.from({ length: 30 }).map((_, i) => {
        const x = -padL * 0.8 + i * ((L + padL * 0.8 + padR * 0.8) / 30);
        return (
          <line
            key={i}
            x1={xW(x)}
            y1={yW(0)}
            x2={xW(x + 200)}
            y2={yW(-200)}
            stroke="#c9a84c"
            strokeOpacity="0.35"
            strokeWidth={3}
          />
        );
      })}

      {/* building */}
      <rect
        x={xW(0)}
        y={yW(H)}
        width={L}
        height={H}
        fill="rgba(212, 203, 191, 0.08)"
        stroke="#e0e0e0"
        strokeWidth={7}
      />

      {/* C&C zone boundaries on walls (distance a from each edge) */}
      <line
        x1={xW(a)}
        y1={yW(H)}
        x2={xW(a)}
        y2={yW(0)}
        stroke="#c9a84c"
        strokeDasharray="20 14"
        strokeWidth={4}
        opacity="0.8"
      />
      <line
        x1={xW(L - a)}
        y1={yW(H)}
        x2={xW(L - a)}
        y2={yW(0)}
        stroke="#c9a84c"
        strokeDasharray="20 14"
        strokeWidth={4}
        opacity="0.8"
      />

      {/* zone labels on walls */}
      <text x={xW(a / 2)} y={yW(H / 2)} fontSize={280} textAnchor="middle" fill="#f2efe4" fontFamily="Inter">
        5
      </text>
      <text x={xW(L / 2)} y={yW(H / 2)} fontSize={280} textAnchor="middle" fill="#f2efe4" fontFamily="Inter">
        4
      </text>
      <text x={xW(L - a / 2)} y={yW(H / 2)} fontSize={280} textAnchor="middle" fill="#f2efe4" fontFamily="Inter">
        5
      </text>

      {/* windward arrows (left side) — positive pushing right into the wall */}
      {result && Array.from({ length: 5 }).map((_, i) => {
        const y = ((i + 0.5) / 5) * H;
        const w = Math.abs(result.mwfrs.walls.windwardDesign) * arrowScale;
        return (
          <line
            key={`w-${i}`}
            x1={xW(-w)}
            y1={yW(y)}
            x2={xW(-200)}
            y2={yW(y)}
            stroke="#ff6b6b"
            strokeWidth={10}
            markerEnd="url(#lg-arr-r)"
          />
        );
      })}

      {/* leeward arrows (right side) — suction pulling away from wall */}
      {result && Array.from({ length: 5 }).map((_, i) => {
        const y = ((i + 0.5) / 5) * H;
        const w = Math.abs(result.mwfrs.walls.leewardDesign) * arrowScale;
        return (
          <line
            key={`l-${i}`}
            x1={xW(L + 200)}
            y1={yW(y)}
            x2={xW(L + w)}
            y2={yW(y)}
            stroke="#5dc4d4"
            strokeWidth={8}
            markerEnd="url(#lg-arr-b)"
          />
        );
      })}

      {/* labels */}
      {result && (
        <>
          <text
            x={xW(-padL * 0.45)}
            y={yW(H / 2) - 60}
            fontSize={260}
            fill="#ff6b6b"
            fontFamily="Inter, sans-serif"
            fontWeight={800}
          >
            Windward
          </text>
          <text
            x={xW(-padL * 0.45)}
            y={yW(H / 2) + 220}
            fontSize={220}
            fill="#ff6b6b"
            fontFamily="JetBrains Mono, monospace"
          >
            {fmt(result.mwfrs.walls.windwardDesign)}
          </text>
          <text
            x={xW(L + padR * 0.45)}
            y={yW(H / 2) - 60}
            fontSize={260}
            fill="#5dc4d4"
            fontFamily="Inter, sans-serif"
            fontWeight={800}
            textAnchor="end"
          >
            Leeward
          </text>
          <text
            x={xW(L + padR * 0.45)}
            y={yW(H / 2) + 220}
            fontSize={220}
            fill="#5dc4d4"
            fontFamily="JetBrains Mono, monospace"
            textAnchor="end"
          >
            {fmt(result.mwfrs.walls.leewardDesign)}
          </text>
          <text
            x={xW(L / 2)}
            y={yW(H) - 120}
            fontSize={260}
            fill="#f2efe4"
            fontFamily="Inter, sans-serif"
            fontWeight={700}
            textAnchor="middle"
          >
            qh = {fmt(result.breakdown.qh)}
          </text>
        </>
      )}

      {/* H dimension */}
      <line
        x1={xW(-padL * 0.15)}
        y1={yW(0)}
        x2={xW(-padL * 0.15)}
        y2={yW(H)}
        stroke="#c9a84c"
        strokeWidth={4}
      />
      <text
        x={xW(-padL * 0.15) + 60}
        y={yW(H / 2)}
        fontSize={230}
        fill="#c9a84c"
        fontFamily="JetBrains Mono, monospace"
        fontWeight={700}
      >
        H
      </text>

      {/* L dimension */}
      <line
        x1={xW(0)}
        y1={yW(-padB * 0.4)}
        x2={xW(L)}
        y2={yW(-padB * 0.4)}
        stroke="#c9a84c"
        strokeWidth={4}
      />
      <text
        x={xW(L / 2)}
        y={yW(-padB * 0.4) - 70}
        fontSize={230}
        fill="#c9a84c"
        fontFamily="JetBrains Mono, monospace"
        fontWeight={700}
        textAnchor="middle"
      >
        L
      </text>
    </svg>
  );
}
