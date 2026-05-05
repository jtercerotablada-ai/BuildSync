'use client';

import React from 'react';
import type { FootingInput, FootingAnalysis } from '@/lib/footing/types';
import { Sub } from './svg-typography';

interface Props {
  input: FootingInput;
  result: FootingAnalysis;
}

/**
 * PunchingDiagram2D — plan view of column + critical perimeter at d/2.
 *
 * Per ACI 318-25 §22.6.4.1, the critical perimeter is at d/2 from the column
 * face. This diagram shows the column footprint, the dashed critical
 * perimeter, dimension arrows for d/2, and a structured results legend
 * BELOW the diagram (not on top of it) to avoid overlap.
 */
export function PunchingDiagram2D({ input, result }: Props) {
  const W = 760, H = 600;
  const drawingTop = 80;
  const drawingH = 360;
  const legendTop = drawingTop + drawingH + 30;

  const g = input.geometry;
  const cx = g.cx;
  const cy = g.columnShape === 'circular' ? g.cx : (g.cy ?? g.cx);
  const d = result.punching.d;

  // Critical perimeter dimensions (mm)
  const ax = cx + d;
  const ay = cy + d;

  // Scale to fit drawing area
  const drawW = W - 200;
  const scale = Math.min(drawW / ax, drawingH / ay) * 0.78;

  const colW = cx * scale;
  const colH = cy * scale;
  const critW = ax * scale;
  const critH = ay * scale;
  const cX = W / 2;
  const cY = drawingTop + drawingH / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
         xmlns="http://www.w3.org/2000/svg"
         style={{ width: '100%', maxWidth: '100%', height: 'auto',
                  background: 'rgba(20, 20, 20, 0.5)', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.05)' }}>

      <defs>
        <marker id="dim-end-pun" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ff8a72" />
        </marker>
        <marker id="dim-start-pun" viewBox="0 0 10 10" refX="1" refY="5"
                markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 10 0 L 0 5 L 10 10 z" fill="#ff8a72" />
        </marker>
      </defs>

      {/* Title */}
      <text x={W / 2} y="28" textAnchor="middle"
            fontSize="14" fontWeight="700" fill="rgba(255,255,255,0.95)" letterSpacing="0.5">
        PUNCHING SHEAR — critical perimeter at d/2
      </text>
      <text x={W / 2} y="46" textAnchor="middle"
            fontSize="9" fill="rgba(255,255,255,0.55)" fontStyle="italic">
        ACI 318-25 §22.6.4.1 · interior column · v<Sub>c</Sub> = min(v<Sub>c1</Sub>, v<Sub>c2</Sub>, v<Sub>c3</Sub>)
      </text>

      {/* Critical perimeter (dashed red rectangle / circle) */}
      {g.columnShape === 'circular' ? (
        <circle cx={cX} cy={cY} r={critW / 2}
                fill="rgba(255,138,114,0.10)"
                stroke="#ff6a55" strokeWidth="1.6" strokeDasharray="7 4" />
      ) : (
        <rect x={cX - critW / 2} y={cY - critH / 2} width={critW} height={critH}
              fill="rgba(255,138,114,0.10)"
              stroke="#ff6a55" strokeWidth="1.6" strokeDasharray="7 4" />
      )}

      {/* Column footprint (solid grey) */}
      {g.columnShape === 'circular' ? (
        <circle cx={cX} cy={cY} r={colW / 2}
                fill="rgba(140,140,140,0.65)" stroke="#444" strokeWidth="1.2" />
      ) : (
        <rect x={cX - colW / 2} y={cY - colH / 2} width={colW} height={colH}
              fill="rgba(140,140,140,0.65)" stroke="#444" strokeWidth="1.2" />
      )}

      {/* Column centre cross */}
      <line x1={cX - 6} y1={cY} x2={cX + 6} y2={cY}
            stroke="rgba(255,255,255,0.65)" strokeWidth="0.5" />
      <line x1={cX} y1={cY - 6} x2={cX} y2={cY + 6}
            stroke="rgba(255,255,255,0.65)" strokeWidth="0.5" />

      {/* d/2 dimension arrow (top) */}
      <g>
        <line x1={cX + colW / 2} y1={cY - critH / 2 - 26} x2={cX + colW / 2} y2={cY - critH / 2 - 6}
              stroke="rgba(255,138,114,0.6)" strokeWidth="0.5" />
        <line x1={cX + critW / 2} y1={cY - critH / 2 - 26} x2={cX + critW / 2} y2={cY - critH / 2 - 6}
              stroke="rgba(255,138,114,0.6)" strokeWidth="0.5" />
        <line
          x1={cX + colW / 2}
          y1={cY - critH / 2 - 18}
          x2={cX + critW / 2}
          y2={cY - critH / 2 - 18}
          stroke="#ff8a72" strokeWidth="0.9"
          markerStart="url(#dim-start-pun)" markerEnd="url(#dim-end-pun)" />
        <text x={(cX + colW / 2 + cX + critW / 2) / 2} y={cY - critH / 2 - 24}
              textAnchor="middle" fontSize="10" fontWeight="700" fill="#ff8a72">
          d/2 = {(d / 2).toFixed(0)} mm
        </text>
      </g>

      {/* Column label */}
      <text x={cX} y={cY + 4} textAnchor="middle"
            fontSize="10.5" fontWeight="700" fill="rgba(255,255,255,0.95)">
        COL {g.columnShape === 'circular' ? `Ø${cx}` : `${cx}×${cy}`}
      </text>

      {/* Critical perimeter callout — leader line OUTSIDE drawing */}
      <g>
        <line
          x1={cX + critW / 2 + 10}
          y1={cY + critH / 2 + 8}
          x2={cX + critW / 2 + 60}
          y2={cY + critH / 2 + 30}
          stroke="rgba(255,106,85,0.55)" strokeWidth="0.6" />
        <text x={cX + critW / 2 + 64} y={cY + critH / 2 + 34}
              fontSize="9" fill="#ff6a55" fontStyle="italic">
          critical perimeter b<Sub>0</Sub>
        </text>
        <text x={cX + critW / 2 + 64} y={cY + critH / 2 + 46}
              fontSize="8.5" fill="rgba(255,106,85,0.7)" fontStyle="italic">
          (§22.6.4.1)
        </text>
      </g>

      {/* ─── RESULTS LEGEND BLOCK (below diagram) ──────────────────── */}
      <g transform={`translate(40, ${legendTop})`}>
        <rect x="0" y="0" width={W - 80} height="120"
              fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" rx="4" />

        <text x="14" y="20" fontSize="11" fontWeight="700" fill="rgba(255,255,255,0.9)" letterSpacing="0.5">
          PUNCHING-SHEAR RESULTS
        </text>

        {/* Column 1 — geometry */}
        <text x="14" y="42" fontSize="9.5" fontWeight="700" fill="rgba(255,255,255,0.65)">
          GEOMETRY
        </text>
        <text x="14" y="58" fontSize="9.5" fill="#cbd5e1">
          b<Sub>0</Sub> = <tspan fontWeight="700">{result.punching.bo.toFixed(0)} mm</tspan>
        </text>
        <text x="14" y="72" fontSize="9.5" fill="#cbd5e1">
          d &nbsp;= <tspan fontWeight="700">{result.punching.d.toFixed(0)} mm</tspan>
        </text>
        <text x="14" y="86" fontSize="9.5" fill="#cbd5e1">
          β<Sub>c</Sub> = <tspan fontWeight="700">{result.punching.betaC.toFixed(2)}</tspan>
        </text>
        <text x="14" y="100" fontSize="9.5" fill="#cbd5e1">
          α<Sub>s</Sub> = <tspan fontWeight="700">{result.punching.alphaS}</tspan>
          <tspan fill="rgba(255,255,255,0.5)" fontStyle="italic"> (interior)</tspan>
        </text>

        {/* Column 2 — demand vs capacity */}
        <line x1="180" y1="32" x2="180" y2="108"
              stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <text x="196" y="42" fontSize="9.5" fontWeight="700" fill="rgba(255,255,255,0.65)">
          DEMAND / CAPACITY
        </text>
        <text x="196" y="58" fontSize="9.5" fill="#cbd5e1">
          V<Sub>u</Sub> &nbsp;= <tspan fontWeight="700">{result.punching.Vu.toFixed(1)} kN</tspan>
        </text>
        <text x="196" y="72" fontSize="9.5" fill="#cbd5e1">
          φV<Sub>c</Sub> = <tspan fontWeight="700">{result.punching.phiVc.toFixed(1)} kN</tspan>
        </text>
        <text x="196" y="86" fontSize="9.5"
              fill={result.punching.ok ? '#5fb674' : '#ff6a55'}>
          ratio = <tspan fontWeight="700">{result.punching.ratio.toFixed(3)}</tspan>
          <tspan dx="6">{result.punching.ok ? '✓ OK' : '✗ FAIL'}</tspan>
        </text>
        <text x="196" y="100" fontSize="9" fill="rgba(255,255,255,0.55)" fontStyle="italic">
          v<Sub>c</Sub> = {result.punching.vc.toFixed(3)} MPa (governing)
        </text>

        {/* Column 3 — three vc candidates */}
        <line x1="400" y1="32" x2="400" y2="108"
              stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <text x="416" y="42" fontSize="9.5" fontWeight="700" fill="rgba(255,255,255,0.65)">
          v<Sub>c</Sub> CANDIDATES (Table 22.6.5.2)
        </text>
        <text x="416" y="58" fontSize="9" fill="#cbd5e1">
          v<Sub>c1</Sub> = 0.33·λ·√f′c &nbsp;&nbsp;= <tspan fontWeight="700">{result.punching.vc1.toFixed(3)} MPa</tspan>
        </text>
        <text x="416" y="72" fontSize="9" fill="#cbd5e1">
          v<Sub>c2</Sub> = 0.17·(1+2/β<Sub>c</Sub>)·λ·√f′c = <tspan fontWeight="700">{result.punching.vc2.toFixed(3)} MPa</tspan>
        </text>
        <text x="416" y="86" fontSize="9" fill="#cbd5e1">
          v<Sub>c3</Sub> = 0.083·(α<Sub>s</Sub>·d/b<Sub>0</Sub>+2)·λ·√f′c = <tspan fontWeight="700">{result.punching.vc3.toFixed(3)} MPa</tspan>
        </text>
        <text x="416" y="100" fontSize="8.5" fill="rgba(255,255,255,0.45)" fontStyle="italic">
          Take the minimum of v<Sub>c1</Sub>, v<Sub>c2</Sub>, v<Sub>c3</Sub> → v<Sub>c</Sub>
        </text>
      </g>
    </svg>
  );
}
