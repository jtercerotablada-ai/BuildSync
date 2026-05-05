'use client';

import React from 'react';
import type { FootingInput, FootingAnalysis } from '@/lib/footing/types';
import { lookupBar } from '@/lib/rc/types';

interface Props {
  input: FootingInput;
  result: FootingAnalysis;
}

/**
 * FootingPlan2D — top-down plan view (X-Y plane).
 *
 * Layers (back → front):
 *   1. Subtle grid background
 *   2. Soil-pressure heat-map (corners qmin → qmax) when eccentric
 *   3. Footing outline (gold)
 *   4. Column footprint (grey, with eccentricity)
 *   5. Bottom-X rebar (red lines along X)
 *   6. Bottom-Y rebar (blue lines along Y)
 *   7. Dimension lines (B, L)
 *   8. Compass (+x →, +y ↑)
 */
export function FootingPlan2D({ input, result }: Props) {
  const W = 820, H = 540;
  const padX = 110, padY = 60;

  const g = input.geometry;
  const B_mm = g.B;
  const L_mm = g.L;

  // Drawing area
  const drawW = W - 2 * padX;
  const drawH = H - 2 * padY;

  // Scale: fit footing into drawing area
  const scale = Math.min(drawW / B_mm, drawH / L_mm) * 0.85;
  const fW = B_mm * scale;
  const fH = L_mm * scale;
  const fX = (W - fW) / 2;
  const fY = (H - fH) / 2;

  // Column footprint (with eccentricity)
  const colCx = g.cx;
  const colCy = g.columnShape === 'circular' ? g.cx : (g.cy ?? g.cx);
  const colW = colCx * scale;
  const colH = colCy * scale;
  const colCenterX = fX + fW / 2 + (g.ex ?? 0) * scale;
  const colCenterY = fY + fH / 2 - (g.ey ?? 0) * scale;     // y inverted in SVG
  const colX = colCenterX - colW / 2;
  const colY = colCenterY - colH / 2;

  // Bar diameters (mm) and counts
  const dbX = lookupBar(input.reinforcement.bottomX.bar)?.db ?? 16;
  const dbY = lookupBar(input.reinforcement.bottomY.bar)?.db ?? 16;
  const nX = input.reinforcement.bottomX.count;
  const nY = input.reinforcement.bottomY.count;

  // Bar positions (X bars run ALONG X = horizontal lines, distributed across Y direction)
  const innerW = (B_mm - 2 * g.coverClear) * scale;
  const innerH = (L_mm - 2 * g.coverClear) * scale;

  // Bottom-X bars: run along X, spaced across Y
  const dxYY = nY > 1 ? innerH / (nY - 1) : 0;
  const xBars: number[] = [];
  for (let i = 0; i < nY; i++) {
    xBars.push(fY + g.coverClear * scale + i * dxYY);
  }

  // Bottom-Y bars: run along Y, spaced across X
  const dxXX = nX > 1 ? innerW / (nX - 1) : 0;
  const yBars: number[] = [];
  for (let i = 0; i < nX; i++) {
    yBars.push(fX + g.coverClear * scale + i * dxXX);
  }

  // Soil-pressure visualization (corner pressures)
  const qmax = result.bearing.q_max;
  const qmin = Math.max(0, result.bearing.q_min);
  const pressureRange = qmax - qmin;
  void pressureRange;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
         xmlns="http://www.w3.org/2000/svg"
         style={{ width: '100%', maxWidth: '100%', height: 'auto',
                  background: 'rgba(20, 20, 20, 0.5)', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.05)' }}>

      <defs>
        <marker id="dim-arrow" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
        </marker>
        <marker id="dim-arrow-rev" viewBox="0 0 10 10" refX="1" refY="5"
                markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 10 0 L 0 5 L 10 10 z" fill="#cbd5e1" />
        </marker>
        <pattern id="ftg-soil" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="rgba(60,40,20,0.08)" />
          <line x1="0" y1="8" x2="8" y2="0" stroke="rgba(120,90,50,0.3)" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* Title */}
      <text x={W / 2} y="28" textAnchor="middle"
            fontSize="13" fontWeight="700" fill="rgba(255,255,255,0.92)">
        PLAN VIEW — {(B_mm / 1000).toFixed(2)} × {(L_mm / 1000).toFixed(2)} m
      </text>

      {/* Soil pressure heat-tint behind footing (subtle) */}
      <rect x={fX} y={fY} width={fW} height={fH}
            fill="url(#ftg-soil)" />

      {/* Footing outline */}
      <rect x={fX} y={fY} width={fW} height={fH}
            fill="rgba(180,180,180,0.18)"
            stroke="#c9a84c" strokeWidth="1.8" />

      {/* Bottom-X rebar (red lines along X) */}
      {xBars.map((y, i) => (
        <line key={`barX-${i}`}
              x1={fX + g.coverClear * scale}
              y1={y}
              x2={fX + fW - g.coverClear * scale}
              y2={y}
              stroke="#ff8a72"
              strokeWidth={Math.max(0.8, dbX * scale * 0.5)}
              opacity="0.85" />
      ))}

      {/* Bottom-Y rebar (blue lines along Y) */}
      {yBars.map((x, i) => (
        <line key={`barY-${i}`}
              x1={x}
              y1={fY + g.coverClear * scale}
              x2={x}
              y2={fY + fH - g.coverClear * scale}
              stroke="#76b6c9"
              strokeWidth={Math.max(0.8, dbY * scale * 0.5)}
              opacity="0.85" />
      ))}

      {/* Column footprint */}
      {g.columnShape === 'circular' ? (
        <circle cx={colCenterX} cy={colCenterY} r={colW / 2}
                fill="rgba(140,140,140,0.65)" stroke="#444" strokeWidth="1" />
      ) : (
        <rect x={colX} y={colY} width={colW} height={colH}
              fill="rgba(140,140,140,0.65)" stroke="#444" strokeWidth="1" />
      )}

      {/* Column label */}
      <text x={colCenterX} y={colCenterY + 4} textAnchor="middle"
            fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.92)">
        COL {colCx}×{colCy}
      </text>

      {/* B dimension (bottom) */}
      <g>
        <line x1={fX} y1={fY + fH + 30} x2={fX + fW} y2={fY + fH + 30}
              stroke="#cbd5e1" strokeWidth="0.7"
              markerStart="url(#dim-arrow-rev)" markerEnd="url(#dim-arrow)" />
        <line x1={fX} y1={fY + fH + 25} x2={fX} y2={fY + fH + 35} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX + fW} y1={fY + fH + 25} x2={fX + fW} y2={fY + fH + 35} stroke="#cbd5e1" strokeWidth="0.5" />
        <text x={fX + fW / 2} y={fY + fH + 50} textAnchor="middle"
              fontSize="11" fontWeight="700" fill="#cbd5e1">
          B = {B_mm} mm
        </text>
      </g>

      {/* L dimension (right) */}
      <g>
        <line x1={fX + fW + 30} y1={fY} x2={fX + fW + 30} y2={fY + fH}
              stroke="#cbd5e1" strokeWidth="0.7"
              markerStart="url(#dim-arrow-rev)" markerEnd="url(#dim-arrow)" />
        <line x1={fX + fW + 25} y1={fY} x2={fX + fW + 35} y2={fY} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX + fW + 25} y1={fY + fH} x2={fX + fW + 35} y2={fY + fH} stroke="#cbd5e1" strokeWidth="0.5" />
        <text x={fX + fW + 60} y={fY + fH / 2} textAnchor="middle"
              fontSize="11" fontWeight="700" fill="#cbd5e1"
              transform={`rotate(-90, ${fX + fW + 60}, ${fY + fH / 2})`}>
          L = {L_mm} mm
        </text>
      </g>

      {/* Rebar callouts */}
      <text x={fX + 8} y={fY + fH + 70} fontSize="9" fill="#ff8a72" fontWeight="600">
        Bottom-X: {nX} {input.reinforcement.bottomX.bar} (running along X, distributed in Y)
      </text>
      <text x={fX + 8} y={fY + fH + 84} fontSize="9" fill="#76b6c9" fontWeight="600">
        Bottom-Y: {nY} {input.reinforcement.bottomY.bar} (running along Y, distributed in X)
      </text>

      {/* Compass */}
      <g transform={`translate(${W - 50}, ${H - 50})`}>
        <line x1="0" y1="0" x2="20" y2="0" stroke="#cbd5e1" strokeWidth="1.2"
              markerEnd="url(#dim-arrow)" />
        <line x1="0" y1="0" x2="0" y2="-20" stroke="#cbd5e1" strokeWidth="1.2"
              markerEnd="url(#dim-arrow)" />
        <text x="24" y="4" fontSize="9" fill="#cbd5e1">+X</text>
        <text x="-3" y="-24" fontSize="9" fill="#cbd5e1">+Y</text>
      </g>

      {/* Soil-pressure summary */}
      <text x={padX} y={H - 18} fontSize="9" fill="rgba(255,255,255,0.6)" fontStyle="italic">
        q_max = {qmax.toFixed(1)} kPa, q_min = {qmin.toFixed(1)} kPa, qa = {input.soil.qa.toFixed(1)} kPa
        {result.upliftRegion ? '  ⚠ Partial uplift (Bowles)' : ''}
      </text>
    </svg>
  );
}
