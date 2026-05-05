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
 * Engineering-drawing layout:
 *   • Title block (top centre)            — "PLAN VIEW — B × L"
 *   • Drawing area                        — footing + rebar grid + column
 *   • B dimension (bottom)                — extension lines + arrows + value
 *   • L dimension (left)                  — extension lines + arrows + value
 *   • Compass rose (top-right)
 *   • Legend block (bottom, full-width)   — rebar Bottom-X / Bottom-Y / soil-pressure
 */
export function FootingPlan2D({ input, result }: Props) {
  // Wide canvas so dimensions + legend never collide with the footing
  const W = 900, H = 660;
  const padTop = 60, padBottom = 150;
  const padLeft = 110, padRight = 80;

  const g = input.geometry;
  const B_mm = g.B;
  const L_mm = g.L;

  // Drawing area
  const drawW = W - padLeft - padRight;
  const drawH = H - padTop - padBottom;

  // Scale: fit footing into drawing area (keep aspect)
  const scale = Math.min(drawW / B_mm, drawH / L_mm) * 0.86;
  const fW = B_mm * scale;
  const fH = L_mm * scale;
  const fX = padLeft + (drawW - fW) / 2;
  const fY = padTop + (drawH - fH) / 2;

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

  // Bar positions
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

  const qmax = result.bearing.q_max;
  const qmin = Math.max(0, result.bearing.q_min);

  // Spacing between bars (for callout)
  const sX_mm = nX > 1 ? (B_mm - 2 * g.coverClear) / (nX - 1) : 0;
  const sY_mm = nY > 1 ? (L_mm - 2 * g.coverClear) / (nY - 1) : 0;

  // Dimension line offsets
  const dimGap = 32;        // distance from footing edge to dimension line

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
         xmlns="http://www.w3.org/2000/svg"
         style={{ width: '100%', maxWidth: '100%', height: 'auto',
                  background: 'rgba(20, 20, 20, 0.5)', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.05)' }}>

      <defs>
        <marker id="dim-arrow" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
        </marker>
        <marker id="dim-arrow-rev" viewBox="0 0 10 10" refX="1" refY="5"
                markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 10 0 L 0 5 L 10 10 z" fill="#cbd5e1" />
        </marker>
        <marker id="north-arrow" viewBox="0 0 10 10" refX="5" refY="0"
                markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 10 L 5 0 L 10 10 z" fill="#cbd5e1" />
        </marker>
        <pattern id="ftg-soil" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="rgba(60,40,20,0.06)" />
          <line x1="0" y1="8" x2="8" y2="0" stroke="rgba(120,90,50,0.25)" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* Title block (top) */}
      <text x={W / 2} y="28" textAnchor="middle"
            fontSize="14" fontWeight="700" fill="rgba(255,255,255,0.95)"
            letterSpacing="0.5">
        PLAN VIEW — {(B_mm / 1000).toFixed(2)} × {(L_mm / 1000).toFixed(2)} m
      </text>
      <text x={W / 2} y="44" textAnchor="middle"
            fontSize="9" fill="rgba(255,255,255,0.5)" fontStyle="italic">
        Bottom mat reinforcement shown · cover {g.coverClear} mm · scale ≈ 1 : {Math.round(1 / scale * 1000)}
      </text>

      {/* Soil hatching behind footing */}
      <rect x={fX} y={fY} width={fW} height={fH} fill="url(#ftg-soil)" />

      {/* Footing outline */}
      <rect x={fX} y={fY} width={fW} height={fH}
            fill="rgba(180,180,180,0.18)"
            stroke="#c9a84c" strokeWidth="2" />

      {/* Bottom-X rebar (red lines along X) */}
      {xBars.map((y, i) => (
        <line key={`barX-${i}`}
              x1={fX + g.coverClear * scale}
              y1={y}
              x2={fX + fW - g.coverClear * scale}
              y2={y}
              stroke="#ff8a72"
              strokeWidth={Math.max(0.9, dbX * scale * 0.55)}
              opacity="0.9" />
      ))}

      {/* Bottom-Y rebar (blue lines along Y) */}
      {yBars.map((x, i) => (
        <line key={`barY-${i}`}
              x1={x}
              y1={fY + g.coverClear * scale}
              x2={x}
              y2={fY + fH - g.coverClear * scale}
              stroke="#76b6c9"
              strokeWidth={Math.max(0.9, dbY * scale * 0.55)}
              opacity="0.9" />
      ))}

      {/* Column footprint */}
      {g.columnShape === 'circular' ? (
        <circle cx={colCenterX} cy={colCenterY} r={colW / 2}
                fill="rgba(140,140,140,0.7)" stroke="#444" strokeWidth="1.2" />
      ) : (
        <rect x={colX} y={colY} width={colW} height={colH}
              fill="rgba(140,140,140,0.7)" stroke="#444" strokeWidth="1.2" />
      )}

      {/* Column centre cross */}
      <line x1={colCenterX - 6} y1={colCenterY} x2={colCenterX + 6} y2={colCenterY}
            stroke="rgba(255,255,255,0.7)" strokeWidth="0.5" />
      <line x1={colCenterX} y1={colCenterY - 6} x2={colCenterX} y2={colCenterY + 6}
            stroke="rgba(255,255,255,0.7)" strokeWidth="0.5" />

      {/* Column label */}
      <text x={colCenterX} y={colCenterY - colH / 2 - 4} textAnchor="middle"
            fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.92)">
        COL {g.columnShape === 'circular' ? `Ø${colCx}` : `${colCx}×${colCy}`}
      </text>

      {/* ─── B dimension (bottom) ─────────────────────────────────── */}
      <g>
        {/* extension (witness) lines */}
        <line x1={fX} y1={fY + fH + 4} x2={fX} y2={fY + fH + dimGap + 4}
              stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX + fW} y1={fY + fH + 4} x2={fX + fW} y2={fY + fH + dimGap + 4}
              stroke="#cbd5e1" strokeWidth="0.5" />
        {/* dimension line */}
        <line x1={fX} y1={fY + fH + dimGap} x2={fX + fW} y2={fY + fH + dimGap}
              stroke="#cbd5e1" strokeWidth="0.8"
              markerStart="url(#dim-arrow-rev)" markerEnd="url(#dim-arrow)" />
        {/* dimension text */}
        <text x={fX + fW / 2} y={fY + fH + dimGap + 16} textAnchor="middle"
              fontSize="11.5" fontWeight="700" fill="#cbd5e1">
          B = {B_mm} mm
        </text>
      </g>

      {/* ─── L dimension (left) ───────────────────────────────────── */}
      <g>
        <line x1={fX - 4} y1={fY} x2={fX - dimGap - 4} y2={fY}
              stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX - 4} y1={fY + fH} x2={fX - dimGap - 4} y2={fY + fH}
              stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX - dimGap} y1={fY} x2={fX - dimGap} y2={fY + fH}
              stroke="#cbd5e1" strokeWidth="0.8"
              markerStart="url(#dim-arrow-rev)" markerEnd="url(#dim-arrow)" />
        <text x={fX - dimGap - 14} y={fY + fH / 2} textAnchor="middle"
              fontSize="11.5" fontWeight="700" fill="#cbd5e1"
              transform={`rotate(-90, ${fX - dimGap - 14}, ${fY + fH / 2})`}>
          L = {L_mm} mm
        </text>
      </g>

      {/* ─── Compass (top-right) ───────────────────────────────────── */}
      <g transform={`translate(${W - 50}, 70)`}>
        <circle cx="0" cy="0" r="22" fill="rgba(0,0,0,0.35)"
                stroke="rgba(255,255,255,0.3)" strokeWidth="0.7" />
        <line x1="0" y1="0" x2="0" y2="-16" stroke="#cbd5e1" strokeWidth="1.2"
              markerEnd="url(#north-arrow)" />
        <line x1="0" y1="0" x2="14" y2="0" stroke="rgba(203,213,225,0.7)" strokeWidth="0.8"
              markerEnd="url(#dim-arrow)" />
        <text x="0" y="-26" textAnchor="middle" fontSize="9" fontWeight="700" fill="#cbd5e1">+Y</text>
        <text x="22" y="3" fontSize="9" fontWeight="700" fill="#cbd5e1">+X</text>
      </g>

      {/* ─── LEGEND BLOCK (bottom) ─────────────────────────────────── */}
      <g transform={`translate(${padLeft - 20}, ${H - padBottom + 60})`}>
        {/* outer frame */}
        <rect x="0" y="0" width={W - padLeft - padRight + 40} height="76"
              fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" rx="4" />

        {/* Column 1 — rebar legend */}
        <text x="14" y="18" fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.85)">
          REINFORCEMENT (bottom mat)
        </text>
        <line x1="14" y1="32" x2="46" y2="32" stroke="#ff8a72" strokeWidth="2.5" />
        <text x="54" y="35" fontSize="9.5" fill="#ff8a72" fontWeight="600">
          Bottom-X: {nX} {input.reinforcement.bottomX.bar} @ ≈ {sY_mm.toFixed(0)} mm o.c.
        </text>
        <line x1="14" y1="50" x2="46" y2="50" stroke="#76b6c9" strokeWidth="2.5" />
        <text x="54" y="53" fontSize="9.5" fill="#76b6c9" fontWeight="600">
          Bottom-Y: {nY} {input.reinforcement.bottomY.bar} @ ≈ {sX_mm.toFixed(0)} mm o.c.
        </text>
        <text x="14" y="68" fontSize="8.5" fill="rgba(255,255,255,0.5)" fontStyle="italic">
          Bars run direction noted; spacing centre-to-centre.
        </text>

        {/* Column 2 — soil-pressure summary */}
        <line x1="380" y1="10" x2="380" y2="68"
              stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <text x="396" y="18" fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.85)">
          SOIL BEARING (service)
        </text>
        <text x="396" y="34" fontSize="9.5" fill="#c9a84c">
          q_max = <tspan fontWeight="700">{qmax.toFixed(1)} kPa</tspan>
        </text>
        <text x="396" y="50" fontSize="9.5" fill="#c9a84c">
          q_min &nbsp;= <tspan fontWeight="700">{qmin.toFixed(1)} kPa</tspan>
        </text>
        <text x="396" y="66" fontSize="9.5" fill="rgba(255,255,255,0.7)">
          q_a &nbsp;&nbsp;&nbsp;= <tspan fontWeight="700">{input.soil.qa.toFixed(1)} kPa</tspan>
          {result.upliftRegion ? (
            <tspan fill="#ff8a72" fontStyle="italic">  · partial uplift (Bowles)</tspan>
          ) : null}
        </text>

        {/* Column 3 — column callout */}
        <line x1="600" y1="10" x2="600" y2="68"
              stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        <text x="616" y="18" fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.85)">
          COLUMN
        </text>
        <text x="616" y="34" fontSize="9.5" fill="rgba(255,255,255,0.85)">
          {g.columnShape === 'circular' ? `Ø ${colCx} mm` : `${colCx} × ${colCy} mm`}
        </text>
        <text x="616" y="50" fontSize="9.5" fill="rgba(255,255,255,0.85)">
          ex = {(g.ex ?? 0).toFixed(0)} mm · ey = {(g.ey ?? 0).toFixed(0)} mm
        </text>
        <text x="616" y="66" fontSize="9.5" fill="rgba(255,255,255,0.7)">
          Cover (clear) = {g.coverClear} mm
        </text>
      </g>
    </svg>
  );
}
