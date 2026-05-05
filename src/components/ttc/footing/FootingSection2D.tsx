'use client';

import React from 'react';
import type { FootingInput, FootingAnalysis } from '@/lib/footing/types';
import { lookupBar } from '@/lib/rc/types';

interface Props {
  input: FootingInput;
  result: FootingAnalysis;
}

/**
 * FootingSection2D — cross-section through the footing (along X-axis, looking +Y).
 *
 * Engineering layout:
 *   • Title
 *   • Soil hatching outside footing edges
 *   • Footing concrete (gold outline) with:
 *       - bottom rebar circles (red)
 *       - top rebar circles, if present (blue-grey)
 *       - cover note
 *   • Column above footing (eccentric if ex ≠ 0)
 *   • B + T dimensions with proper extension lines
 *   • Soil-pressure trapezoid (or Bowles triangle) BELOW the section
 *       - separated baseline; q_max / q_min labels above the polygon
 *       - q_a reference line drawn through, label parked at left
 */
export function FootingSection2D({ input, result }: Props) {
  // Wider canvas; reserve full bottom strip for soil-pressure
  const W = 900, H = 520;
  const padX = 110;
  const sectionTop = 90;
  const sectionH = 200;          // section drawing height (excl. column)
  const pressureGap = 40;
  const pressureH = 110;

  const g = input.geometry;
  const B_mm = g.B;
  const T_mm = g.T;

  // Footing visual rect
  const drawW = W - 2 * padX;
  const fW = drawW;
  const fH = Math.min(sectionH * 0.55, T_mm / B_mm * fW * 1.6);    // exaggerate T for clarity
  const fX = padX;
  const fY = sectionTop + (sectionH - fH);     // align footing flush with bottom of section band

  // Scale
  const scaleX = fW / B_mm;
  const scaleY = fH / T_mm;

  // Column above
  const colW = g.cx * scaleX;
  const colH = Math.min(110, fH * 1.5);
  const colX = (W - colW) / 2 + (g.ex ?? 0) * scaleX;
  const colY = fY - colH;

  // Bottom rebar
  const dbBot = lookupBar(input.reinforcement.bottomX.bar)?.db ?? 16;
  const nBot = input.reinforcement.bottomX.count;
  const innerW = (B_mm - 2 * g.coverClear) * scaleX;
  const dxBars = nBot > 1 ? innerW / (nBot - 1) : 0;
  const barY = fY + fH - g.coverClear * scaleY - dbBot * scaleY / 2;
  const barRadiusVis = Math.max(2.5, dbBot * scaleX * 0.7);

  // Top rebar
  const topBars = input.reinforcement.topX;
  const dbTop = topBars ? lookupBar(topBars.bar)?.db ?? 12 : 0;
  const nTop = topBars?.count ?? 0;
  const dxTopBars = nTop > 1 ? innerW / (nTop - 1) : 0;
  const topBarY = fY + g.coverClear * scaleY + dbTop * scaleY / 2;

  // Soil-pressure diagram below
  const pressureBaseY = fY + fH + pressureGap;
  const qmax = result.bearing.q_max;
  const qmin = Math.max(0, result.bearing.q_min);
  const qa = input.soil.qa;
  const pressurePeak = Math.max(qmax, qa, 1) * 1.1;
  const pressureScale = pressureH / pressurePeak;

  const dimGap = 28;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
         xmlns="http://www.w3.org/2000/svg"
         style={{ width: '100%', maxWidth: '100%', height: 'auto',
                  background: 'rgba(20, 20, 20, 0.5)', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.05)' }}>

      <defs>
        <pattern id="ftg-soil-h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(120,90,50,0.45)" strokeWidth="0.7" />
        </pattern>
        <pattern id="ftg-conc-h" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(201,168,76,0.18)" strokeWidth="0.5" />
        </pattern>
        <marker id="dim-end" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
        </marker>
        <marker id="dim-start" viewBox="0 0 10 10" refX="1" refY="5"
                markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 10 0 L 0 5 L 10 10 z" fill="#cbd5e1" />
        </marker>
      </defs>

      {/* Title */}
      <text x={W / 2} y="26" textAnchor="middle"
            fontSize="14" fontWeight="700" fill="rgba(255,255,255,0.95)" letterSpacing="0.5">
        SECTION A-A — concrete · rebar · soil pressure
      </text>
      <text x={W / 2} y="44" textAnchor="middle"
            fontSize="9" fill="rgba(255,255,255,0.5)" fontStyle="italic">
        Cut through column centreline along X · view +Y · cover {g.coverClear} mm
      </text>

      {/* Ground line (dashed) */}
      <line x1={0} y1={fY} x2={W} y2={fY}
            stroke="rgba(120,90,50,0.55)" strokeWidth="0.8" strokeDasharray="3 3" />

      {/* Soil hatch on both sides */}
      <rect x={0} y={fY} width={fX} height={fH} fill="url(#ftg-soil-h)" />
      <rect x={fX + fW} y={fY} width={W - fX - fW} height={fH} fill="url(#ftg-soil-h)" />

      {/* Footing concrete (with subtle hatch fill) */}
      <rect x={fX} y={fY} width={fW} height={fH} fill="url(#ftg-conc-h)" />
      <rect x={fX} y={fY} width={fW} height={fH}
            fill="rgba(180,180,180,0.10)"
            stroke="#c9a84c" strokeWidth="2" />

      {/* Column above */}
      <rect x={colX} y={colY} width={colW} height={colH}
            fill="rgba(140,140,140,0.6)" stroke="#666" strokeWidth="1.2" />
      {/* Column hatch indicating cut */}
      <line x1={colX} y1={colY} x2={colX + colW} y2={colY + colH}
            stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
      <line x1={colX + colW} y1={colY} x2={colX} y2={colY + colH}
            stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
      <text x={colX + colW / 2} y={colY + 14} textAnchor="middle"
            fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.92)">
        COL
      </text>
      <text x={colX + colW / 2} y={colY - 6} textAnchor="middle"
            fontSize="8.5" fill="rgba(255,255,255,0.55)" fontStyle="italic">
        {g.cx} × {g.columnShape === 'circular' ? g.cx : (g.cy ?? g.cx)} mm
      </text>

      {/* Bottom rebar circles */}
      {Array.from({ length: nBot }, (_, i) => (
        <g key={`bb-${i}`}>
          <circle
            cx={fX + g.coverClear * scaleX + i * dxBars}
            cy={barY}
            r={barRadiusVis}
            fill="#ff8a72" stroke="#a02020" strokeWidth="0.5" />
          <circle
            cx={fX + g.coverClear * scaleX + i * dxBars}
            cy={barY}
            r={Math.max(0.8, barRadiusVis * 0.35)}
            fill="rgba(255,255,255,0.7)" />
        </g>
      ))}

      {/* Top rebar circles (if present) */}
      {topBars && Array.from({ length: nTop }, (_, i) => (
        <circle key={`tb-${i}`}
                cx={fX + g.coverClear * scaleX + i * dxTopBars}
                cy={topBarY}
                r={Math.max(2, dbTop * scaleX * 0.7)}
                fill="#76b6c9" stroke="#3a6a8a" strokeWidth="0.5" />
      ))}

      {/* Cover annotation (bottom-left, leader line to first bar) */}
      <g>
        <line x1={fX + 4} y1={fY + fH - 4}
              x2={fX + g.coverClear * scaleX} y2={barY}
              stroke="rgba(255,255,255,0.45)" strokeWidth="0.5" />
        <text x={fX + 4} y={fY + fH - 8} fontSize="8.5" fill="rgba(255,255,255,0.7)">
          cover {g.coverClear} mm
        </text>
      </g>

      {/* ─── B dimension (top, between column and footing) ─────────── */}
      <g>
        <line x1={fX} y1={fY - 4} x2={fX} y2={fY - dimGap - 4} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX + fW} y1={fY - 4} x2={fX + fW} y2={fY - dimGap - 4} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX} y1={fY - dimGap} x2={fX + fW} y2={fY - dimGap}
              stroke="#cbd5e1" strokeWidth="0.8"
              markerStart="url(#dim-start)" markerEnd="url(#dim-end)" />
        <text x={fX + fW / 2} y={fY - dimGap - 6} textAnchor="middle"
              fontSize="11.5" fontWeight="700" fill="#cbd5e1">
          B = {B_mm} mm
        </text>
      </g>

      {/* ─── T dimension (left) ────────────────────────────────────── */}
      <g>
        <line x1={fX - 4} y1={fY} x2={fX - dimGap - 4} y2={fY} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX - 4} y1={fY + fH} x2={fX - dimGap - 4} y2={fY + fH} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX - dimGap} y1={fY} x2={fX - dimGap} y2={fY + fH}
              stroke="#cbd5e1" strokeWidth="0.8"
              markerStart="url(#dim-start)" markerEnd="url(#dim-end)" />
        <text x={fX - dimGap - 12} y={fY + fH / 2} textAnchor="middle"
              fontSize="11.5" fontWeight="700" fill="#cbd5e1"
              transform={`rotate(-90, ${fX - dimGap - 12}, ${fY + fH / 2})`}>
          T = {T_mm} mm
        </text>
      </g>

      {/* ─── SOIL-PRESSURE DIAGRAM (below) ─────────────────────────── */}
      <g>
        {/* heading */}
        <text x={fX} y={pressureBaseY - pressureH - 16}
              fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.85)">
          SOIL BEARING PRESSURE (kPa)
        </text>
        <text x={fX + fW} y={pressureBaseY - pressureH - 16} textAnchor="end"
              fontSize="9" fill="rgba(255,255,255,0.55)" fontStyle="italic">
          {result.upliftRegion ? 'Bowles triangle (e > B/6)' : 'Trapezoidal'}
        </text>

        {/* axis (vertical scale) */}
        <line x1={fX - 6} y1={pressureBaseY - pressureH}
              x2={fX - 6} y2={pressureBaseY}
              stroke="rgba(203,213,225,0.5)" strokeWidth="0.6" />

        {/* baseline (footing underside) */}
        <line x1={fX} y1={pressureBaseY} x2={fX + fW} y2={pressureBaseY}
              stroke="#cbd5e1" strokeWidth="0.7" />

        {/* qa reference line */}
        <line x1={fX} y1={pressureBaseY - qa * pressureScale}
              x2={fX + fW} y2={pressureBaseY - qa * pressureScale}
              stroke="#c9a84c" strokeWidth="0.7" strokeDasharray="4 3" />
        <text x={fX - 10} y={pressureBaseY - qa * pressureScale + 3}
              textAnchor="end" fontSize="9" fill="#c9a84c" fontWeight="600">
          q_a = {qa.toFixed(0)}
        </text>

        {/* pressure polygon */}
        {result.upliftRegion ? (
          // Bowles triangle (q_max at one side, zero at distance 3a)
          <polygon
            points={`
              ${fX},${pressureBaseY}
              ${fX + fW * 0.7},${pressureBaseY}
              ${fX},${pressureBaseY - qmax * pressureScale}
            `}
            fill="rgba(255,138,114,0.30)" stroke="#ff8a72" strokeWidth="1.2" />
        ) : (
          <polygon
            points={`
              ${fX},${pressureBaseY}
              ${fX + fW},${pressureBaseY}
              ${fX + fW},${pressureBaseY - qmin * pressureScale}
              ${fX},${pressureBaseY - qmax * pressureScale}
            `}
            fill="rgba(255,138,114,0.25)" stroke="#ff8a72" strokeWidth="1.2" />
        )}

        {/* q_max label — placed ABOVE diagram, leader to top-left corner */}
        <line x1={fX} y1={pressureBaseY - qmax * pressureScale}
              x2={fX - 14} y2={pressureBaseY - qmax * pressureScale - 16}
              stroke="rgba(255,138,114,0.6)" strokeWidth="0.5" />
        <text x={fX - 16} y={pressureBaseY - qmax * pressureScale - 18}
              textAnchor="end" fontSize="9.5" fill="#ff8a72" fontWeight="700">
          q_max = {qmax.toFixed(1)} kPa
        </text>

        {/* q_min label — placed ABOVE diagram on the right, only when no uplift */}
        {!result.upliftRegion && (
          <>
            <line x1={fX + fW} y1={pressureBaseY - qmin * pressureScale}
                  x2={fX + fW + 14} y2={pressureBaseY - qmin * pressureScale - 16}
                  stroke="rgba(255,138,114,0.6)" strokeWidth="0.5" />
            <text x={fX + fW + 16} y={pressureBaseY - qmin * pressureScale - 18}
                  fontSize="9.5" fill="#ff8a72" fontWeight="700">
              q_min = {qmin.toFixed(1)} kPa
            </text>
          </>
        )}
      </g>
    </svg>
  );
}
