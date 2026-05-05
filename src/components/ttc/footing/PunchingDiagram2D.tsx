'use client';

import React from 'react';
import type { FootingInput, FootingAnalysis } from '@/lib/footing/types';

interface Props {
  input: FootingInput;
  result: FootingAnalysis;
}

/**
 * PunchingDiagram2D — plan view of column + critical perimeter at d/2.
 *
 * Per ACI 318-25 §22.6.4.1, the critical perimeter is at d/2 from the column
 * face. This diagram shows the column footprint, the dashed critical
 * perimeter, dimension arrows for d/2, and labels for bo / Vu / φVc / ratio.
 */
export function PunchingDiagram2D({ input, result }: Props) {
  const W = 540, H = 380;

  const g = input.geometry;
  const cx = g.cx;
  const cy = g.columnShape === 'circular' ? g.cx : (g.cy ?? g.cx);
  const d = result.punching.d;

  // Critical perimeter dimensions
  const ax = cx + d;
  const ay = cy + d;

  // Scale to fit
  const drawW = W - 160;
  const drawH = H - 100;
  const scale = Math.min(drawW / ax, drawH / ay) * 0.85;

  const colW = cx * scale;
  const colH = cy * scale;
  const critW = ax * scale;
  const critH = ay * scale;
  const cX = W / 2;
  const cY = H / 2 - 10;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
         xmlns="http://www.w3.org/2000/svg"
         style={{ width: '100%', maxWidth: '100%', height: 'auto',
                  background: 'rgba(20, 20, 20, 0.5)', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.05)' }}>

      <defs>
        <marker id="dim-end-pun" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ff8a72" />
        </marker>
      </defs>

      {/* Title */}
      <text x={W / 2} y="22" textAnchor="middle"
            fontSize="13" fontWeight="700" fill="rgba(255,255,255,0.92)">
        PUNCHING SHEAR — critical perimeter at d/2
      </text>

      {/* Critical perimeter (dashed red rectangle / circle) */}
      {g.columnShape === 'circular' ? (
        <circle cx={cX} cy={cY} r={critW / 2}
                fill="rgba(255,138,114,0.10)"
                stroke="#ff6a55" strokeWidth="1.5" strokeDasharray="6 4" />
      ) : (
        <rect x={cX - critW / 2} y={cY - critH / 2} width={critW} height={critH}
              fill="rgba(255,138,114,0.10)"
              stroke="#ff6a55" strokeWidth="1.5" strokeDasharray="6 4" />
      )}

      {/* Column footprint (solid grey) */}
      {g.columnShape === 'circular' ? (
        <circle cx={cX} cy={cY} r={colW / 2}
                fill="rgba(140,140,140,0.65)" stroke="#444" strokeWidth="1.2" />
      ) : (
        <rect x={cX - colW / 2} y={cY - colH / 2} width={colW} height={colH}
              fill="rgba(140,140,140,0.65)" stroke="#444" strokeWidth="1.2" />
      )}

      {/* d/2 dimension arrow (right side) */}
      <line
        x1={cX + colW / 2}
        y1={cY - colH / 2 - 18}
        x2={cX + critW / 2}
        y2={cY - colH / 2 - 18}
        stroke="#ff8a72" strokeWidth="0.8"
        markerEnd="url(#dim-end-pun)" />
      <line x1={cX + colW / 2} y1={cY - colH / 2 - 23} x2={cX + colW / 2} y2={cY - colH / 2 - 13}
            stroke="#ff8a72" strokeWidth="0.5" />
      <line x1={cX + critW / 2} y1={cY - colH / 2 - 23} x2={cX + critW / 2} y2={cY - colH / 2 - 13}
            stroke="#ff8a72" strokeWidth="0.5" />
      <text x={(cX + colW / 2 + cX + critW / 2) / 2} y={cY - colH / 2 - 24}
            textAnchor="middle" fontSize="10" fontWeight="700" fill="#ff8a72">
        d/2 = {(d / 2).toFixed(0)} mm
      </text>

      {/* Column label */}
      <text x={cX} y={cY + 4} textAnchor="middle"
            fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.92)">
        COL {g.columnShape === 'circular' ? `Ø${cx}` : `${cx}×${cy}`}
      </text>

      {/* Critical perimeter label */}
      <text x={cX} y={cY + critH / 2 + 16} textAnchor="middle"
            fontSize="9" fill="#ff6a55" fontStyle="italic">
        Critical perimeter (§22.6.4.1)
      </text>

      {/* Result chips */}
      <g transform={`translate(20, ${H - 80})`}>
        <text x="0" y="0" fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.92)">
          Punching Results:
        </text>
        <text x="0" y="16" fontSize="9.5" fill="#cbd5e1">
          bo = {result.punching.bo.toFixed(0)} mm
        </text>
        <text x="0" y="30" fontSize="9.5" fill="#cbd5e1">
          d = {result.punching.d.toFixed(0)} mm
        </text>
        <text x="120" y="16" fontSize="9.5" fill="#cbd5e1">
          βc = {result.punching.betaC.toFixed(2)}
        </text>
        <text x="120" y="30" fontSize="9.5" fill="#cbd5e1">
          αs = {result.punching.alphaS} (interior)
        </text>
        <text x="240" y="16" fontSize="9.5" fill="#cbd5e1">
          Vu = {result.punching.Vu.toFixed(1)} kN
        </text>
        <text x="240" y="30" fontSize="9.5" fill="#cbd5e1">
          φVc = {result.punching.phiVc.toFixed(1)} kN
        </text>
        <text x="380" y="16" fontSize="9.5" fontWeight="700"
              fill={result.punching.ok ? '#5fb674' : '#ff6a55'}>
          ratio = {result.punching.ratio.toFixed(3)} {result.punching.ok ? '✓' : '✗'}
        </text>
        <text x="380" y="30" fontSize="9" fill="#a0aec0" fontStyle="italic">
          (vc = {result.punching.vc.toFixed(3)} MPa)
        </text>
      </g>

      {/* vc breakdown */}
      <g transform={`translate(20, ${H - 30})`}>
        <text x="0" y="0" fontSize="9" fill="#a0aec0" fontStyle="italic">
          vc1 = 0.33·λ·√fʹc = {result.punching.vc1.toFixed(3)} MPa
          {' · '}vc2 = 0.17·(1+2/βc)·λ·√fʹc = {result.punching.vc2.toFixed(3)} MPa
          {' · '}vc3 = 0.083·(αs·d/bo+2)·λ·√fʹc = {result.punching.vc3.toFixed(3)} MPa
        </text>
      </g>
    </svg>
  );
}
