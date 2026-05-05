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
 * Shows: soil hatch outside footing, concrete envelope, top + bottom rebar
 * circles, column above the footing, soil-pressure trapezoid below the footing
 * (or triangle if outside kern).
 */
export function FootingSection2D({ input, result }: Props) {
  const W = 800, H = 380;
  const padX = 80, padY = 50;

  const g = input.geometry;
  const B_mm = g.B;
  const T_mm = g.T;

  // Drawing area
  const drawW = W - 2 * padX;
  const drawH = H - 2 * padY - 80;     // reserve 80 px for soil-pressure diagram below

  // Footing visual rect
  const fW = drawW * 0.85;
  const fH = Math.min(drawH * 0.5, T_mm / B_mm * fW * 1.5);     // exaggerate thickness for visibility
  const fX = (W - fW) / 2;
  const fY = padY + drawH * 0.5;

  // Scale
  const scaleX = fW / B_mm;
  const scaleY = fH / T_mm;

  // Column above
  const colW = g.cx * scaleX;
  const colH = Math.min(120, fH * 1.5);
  const colX = (W - colW) / 2 + (g.ex ?? 0) * scaleX;
  const colY = fY - colH;

  // Bottom rebar
  const dbBot = lookupBar(input.reinforcement.bottomX.bar)?.db ?? 16;
  const nBot = input.reinforcement.bottomX.count;
  const innerW = (B_mm - 2 * g.coverClear) * scaleX;
  const dxBars = nBot > 1 ? innerW / (nBot - 1) : 0;
  const barY = fY + fH - g.coverClear * scaleY - dbBot * scaleY / 2;
  const barRadiusVis = Math.max(2, dbBot * scaleX * 0.7);

  // Top rebar (if present)
  const topBars = input.reinforcement.topX;
  const dbTop = topBars ? lookupBar(topBars.bar)?.db ?? 12 : 0;
  const nTop = topBars?.count ?? 0;
  const dxTopBars = nTop > 1 ? innerW / (nTop - 1) : 0;
  const topBarY = fY + g.coverClear * scaleY + dbTop * scaleY / 2;

  // Soil-pressure diagram below
  const pressureBaseY = fY + fH + 25;
  const pressureMaxH = 50;
  const qmax = result.bearing.q_max;
  const qmin = Math.max(0, result.bearing.q_min);
  const qa = input.soil.qa;
  const pressureScale = pressureMaxH / Math.max(qmax, qa, 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
         xmlns="http://www.w3.org/2000/svg"
         style={{ width: '100%', maxWidth: '100%', height: 'auto',
                  background: 'rgba(20, 20, 20, 0.5)', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.05)' }}>

      <defs>
        <pattern id="ftg-soil-h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(120,90,50,0.4)" strokeWidth="0.6" />
        </pattern>
        <marker id="dim-end" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
        </marker>
        <marker id="dim-start" viewBox="0 0 10 10" refX="1" refY="5"
                markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 10 0 L 0 5 L 10 10 z" fill="#cbd5e1" />
        </marker>
      </defs>

      {/* Title */}
      <text x={W / 2} y="22" textAnchor="middle"
            fontSize="13" fontWeight="700" fill="rgba(255,255,255,0.92)">
        SECTION A-A — concrete + rebar + soil pressure
      </text>

      {/* Soil hatch on both sides */}
      <rect x={0} y={fY - 5} width={fX} height={fH + 10} fill="url(#ftg-soil-h)" />
      <rect x={fX + fW} y={fY - 5} width={W - fX - fW} height={fH + 10} fill="url(#ftg-soil-h)" />
      <line x1={0} y1={fY - 5} x2={W} y2={fY - 5} stroke="rgba(120,90,50,0.5)" strokeWidth="1" strokeDasharray="3 3" />

      {/* Footing concrete envelope */}
      <rect x={fX} y={fY} width={fW} height={fH}
            fill="rgba(180,180,180,0.18)"
            stroke="#c9a84c" strokeWidth="1.8" />

      {/* Column above */}
      <rect x={colX} y={colY} width={colW} height={colH}
            fill="rgba(140,140,140,0.55)" stroke="#666" strokeWidth="1" />
      <text x={colX + colW / 2} y={colY + 16} textAnchor="middle"
            fontSize="9" fontWeight="700" fill="rgba(255,255,255,0.9)">
        COL
      </text>

      {/* Bottom rebar circles */}
      {Array.from({ length: nBot }, (_, i) => (
        <circle key={`bb-${i}`}
                cx={fX + g.coverClear * scaleX + i * dxBars}
                cy={barY}
                r={barRadiusVis}
                fill="#ff8a72" stroke="#a02020" strokeWidth="0.4" />
      ))}

      {/* Top rebar circles (if present) */}
      {topBars && Array.from({ length: nTop }, (_, i) => (
        <circle key={`tb-${i}`}
                cx={fX + g.coverClear * scaleX + i * dxTopBars}
                cy={topBarY}
                r={Math.max(1.5, dbTop * scaleX * 0.7)}
                fill="#76b6c9" stroke="#3a6a8a" strokeWidth="0.4" />
      ))}

      {/* B dimension (top) */}
      <line x1={fX} y1={fY - 30} x2={fX + fW} y2={fY - 30}
            stroke="#cbd5e1" strokeWidth="0.7"
            markerStart="url(#dim-start)" markerEnd="url(#dim-end)" />
      <text x={fX + fW / 2} y={fY - 36} textAnchor="middle"
            fontSize="11" fontWeight="700" fill="#cbd5e1">
        B = {B_mm} mm
      </text>

      {/* T dimension (left) */}
      <line x1={fX - 30} y1={fY} x2={fX - 30} y2={fY + fH}
            stroke="#cbd5e1" strokeWidth="0.7"
            markerStart="url(#dim-start)" markerEnd="url(#dim-end)" />
      <text x={fX - 50} y={fY + fH / 2} textAnchor="middle"
            fontSize="11" fontWeight="700" fill="#cbd5e1"
            transform={`rotate(-90, ${fX - 50}, ${fY + fH / 2})`}>
        T = {T_mm} mm
      </text>

      {/* Cover annotation (bottom) */}
      <text x={fX + 4} y={barY + barRadiusVis + 12} fontSize="8" fill="#a0aec0">
        cover {g.coverClear} mm
      </text>

      {/* Soil-pressure diagram */}
      <g>
        <text x={fX} y={pressureBaseY - 5} fontSize="9" fill="#cbd5e1" fontWeight="600">
          Soil pressure (kPa)
        </text>
        {result.upliftRegion ? (
          // Triangular distribution — Bowles partial uplift
          <polygon
            points={`
              ${fX},${pressureBaseY}
              ${fX + fW * 0.7},${pressureBaseY}
              ${fX},${pressureBaseY + qmax * pressureScale}
            `}
            fill="rgba(255,138,114,0.35)" stroke="#ff8a72" strokeWidth="1" />
        ) : (
          // Trapezoidal distribution
          <polygon
            points={`
              ${fX},${pressureBaseY}
              ${fX + fW},${pressureBaseY}
              ${fX + fW},${pressureBaseY + qmin * pressureScale}
              ${fX},${pressureBaseY + qmax * pressureScale}
            `}
            fill="rgba(255,138,114,0.25)" stroke="#ff8a72" strokeWidth="1" />
        )}

        {/* qa reference line */}
        <line x1={fX} y1={pressureBaseY + qa * pressureScale}
              x2={fX + fW} y2={pressureBaseY + qa * pressureScale}
              stroke="#c9a84c" strokeWidth="0.7" strokeDasharray="4 3" />
        <text x={fX + fW + 5} y={pressureBaseY + qa * pressureScale + 3}
              fontSize="9" fill="#c9a84c">
          qa = {qa.toFixed(0)}
        </text>

        {/* qmax label */}
        <text x={fX - 5} y={pressureBaseY + qmax * pressureScale + 4}
              textAnchor="end" fontSize="9" fill="#ff8a72" fontWeight="700">
          q_max = {qmax.toFixed(1)}
        </text>
        {!result.upliftRegion && (
          <text x={fX + fW + 5} y={pressureBaseY + qmin * pressureScale + 4}
                fontSize="9" fill="#ff8a72" fontWeight="700">
            q_min = {qmin.toFixed(1)}
          </text>
        )}
      </g>
    </svg>
  );
}
