'use client';

import React from 'react';
import type { FootingInput, FootingAnalysis } from '@/lib/footing/types';
import { lookupBar } from '@/lib/rc/types';

interface Props {
  input: FootingInput;
  result: FootingAnalysis;
}

/**
 * FootingSection2D — cross-section A-A through the footing along X.
 *
 * Strict top-down layout (no overlaps):
 *
 *   ┌─────────────────────────────────────────────────────┐
 *   │  TITLE / SUBTITLE                                   │  y ≈ 25 / 46
 *   │                                                     │
 *   │              ┌───┐  COL label                       │  column block
 *   │              │COL│  (with cut hatch)                │  y ≈ 80…190
 *   │              └─┬─┘                                  │
 *   │  ◀── B dimension ──▶                                │  y ≈ 200
 *   │  ╔═══════════════════════════╗                      │
 *   │  ║ FOOTING (concrete + bars) ║                      │  y ≈ 220…340
 *   │  ╚═══════════════════════════╝                      │
 *   │  T  (vertical dim on LEFT)                          │
 *   │                                                     │
 *   │  ─── ground line (dashed) ───                       │
 *   │  hatch                              hatch           │
 *   │                                                     │
 *   │  GAP (≥ 50 px)                                      │
 *   │                                                     │
 *   │  SOIL BEARING PRESSURE (kPa)        Trapezoidal     │  y ≈ 400
 *   │  ──── 0 reference ──────────────────────────────    │  baseline
 *   │  q_max ◀ ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱ ▶ q_min  │  polygon hangs DOWN
 *   │                                                     │
 *   └─────────────────────────────────────────────────────┘
 */
export function FootingSection2D({ input, result }: Props) {
  // Wide tall canvas — soil-pressure diagram needs full vertical room
  const W = 960, H = 660;
  const padX = 130;

  const g = input.geometry;
  const B_mm = g.B;
  const T_mm = g.T;

  // ─── Section drawing geometry ─────────────────────────────────────
  const fW = W - 2 * padX;
  const scaleX = fW / B_mm;

  // Footing thickness exaggerated for clarity (clamped)
  const fH = Math.max(80, Math.min(140, (T_mm / B_mm) * fW * 1.5));
  const scaleY = fH / T_mm;

  // Vertical placement
  const colHpix = 110;
  const colTopY = 92;
  const fY = colTopY + colHpix;          // footing top = column bottom
  const fBot = fY + fH;
  const fX = padX;

  // Column above (eccentric if ex ≠ 0)
  const colW = g.cx * scaleX;
  const colCx = (W - colW) / 2 + (g.ex ?? 0) * scaleX;
  const colX = colCx;
  const colY = colTopY;

  // Bottom rebar (X-direction bars in section)
  const dbBot = lookupBar(input.reinforcement.bottomX.bar)?.db ?? 16;
  const nBot = input.reinforcement.bottomX.count;
  const innerW = (B_mm - 2 * g.coverClear) * scaleX;
  const dxBars = nBot > 1 ? innerW / (nBot - 1) : 0;
  const barY = fBot - g.coverClear * scaleY - dbBot * scaleY / 2;
  const barRadiusVis = Math.max(3.5, dbBot * scaleX * 0.7);

  // Top rebar
  const topBars = input.reinforcement.topX;
  const dbTop = topBars ? (lookupBar(topBars.bar)?.db ?? 12) : 0;
  const nTop = topBars?.count ?? 0;
  const dxTopBars = nTop > 1 ? innerW / (nTop - 1) : 0;
  const topBarY = fY + g.coverClear * scaleY + dbTop * scaleY / 2;

  // ─── Pressure diagram geometry ────────────────────────────────────
  // Polygon hangs DOWN from baseline (Bowles convention)
  const pressureGap = 70;                                  // vertical gap below footing
  const pressureBaselineY = fBot + pressureGap;            // baseline = 0 pressure
  const pressureH = 130;                                   // max polygon extent down
  const qmax = result.bearing.q_max;
  const qmin = Math.max(0, result.bearing.q_min);
  const qa = input.soil.qa;
  const qPeak = Math.max(qmax, qa, 1) * 1.20;
  const pressureScale = pressureH / qPeak;

  // Resultant of soil pressure (CG of trapezoid)
  // x_cg from left = B · (2qmax + qmin) / (3(qmax + qmin))
  const sumQ = qmax + qmin;
  const xCgFromLeft = sumQ > 0 ? B_mm * (2 * qmax + qmin) / (3 * sumQ) : B_mm / 2;
  const resultantX = fX + xCgFromLeft * scaleX;

  const dimGap = 30;

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
        <pattern id="ftg-conc-h" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(201,168,76,0.18)" strokeWidth="0.55" />
        </pattern>
        <pattern id="press-fill" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(255,138,114,0.4)" strokeWidth="0.7" />
        </pattern>
        <marker id="dim-end-s" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
        </marker>
        <marker id="dim-start-s" viewBox="0 0 10 10" refX="1" refY="5"
                markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 10 0 L 0 5 L 10 10 z" fill="#cbd5e1" />
        </marker>
        <marker id="resultant-arrow" viewBox="0 0 10 10" refX="5" refY="9"
                markerWidth="9" markerHeight="9" orient="auto">
          <path d="M 0 0 L 5 9 L 10 0 z" fill="#ff8a72" />
        </marker>
      </defs>

      {/* ─── TITLE ─────────────────────────────────────────────── */}
      <text x={W / 2} y="26" textAnchor="middle"
            fontSize="14" fontWeight="700" fill="rgba(255,255,255,0.95)" letterSpacing="0.5">
        SECTION A-A — concrete · rebar · soil bearing
      </text>
      <text x={W / 2} y="46" textAnchor="middle"
            fontSize="9" fill="rgba(255,255,255,0.55)" fontStyle="italic">
        Cut along X through column centreline · view +Y · ACI 318-25 §13.2 (linear pressure, rigid footing)
      </text>

      {/* ─── SECTION DRAWING (column above + footing) ─────────── */}

      {/* Ground line at top of footing (dashed, schematic) */}
      <line x1={0} y1={fY - 5} x2={W} y2={fY - 5}
            stroke="rgba(120,90,50,0.6)" strokeWidth="1" strokeDasharray="5 4" />
      <text x={W - 12} y={fY - 9} textAnchor="end" fontSize="8.5" fill="rgba(120,90,50,0.7)" fontStyle="italic">
        finished grade
      </text>

      {/* Soil hatch outside footing on both sides */}
      <rect x={0} y={fY - 5} width={fX} height={fH + 5} fill="url(#ftg-soil-h)" />
      <rect x={fX + fW} y={fY - 5} width={W - fX - fW} height={fH + 5} fill="url(#ftg-soil-h)" />

      {/* Footing concrete (hatch fill + outline) */}
      <rect x={fX} y={fY} width={fW} height={fH} fill="url(#ftg-conc-h)" />
      <rect x={fX} y={fY} width={fW} height={fH}
            fill="rgba(180,180,180,0.10)"
            stroke="#c9a84c" strokeWidth="2" />

      {/* Column above — with cut-X hatch */}
      <rect x={colX} y={colY} width={colW} height={colHpix}
            fill="rgba(140,140,140,0.55)" stroke="#666" strokeWidth="1.2" />
      <line x1={colX} y1={colY} x2={colX + colW} y2={colY + colHpix}
            stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
      <line x1={colX + colW} y1={colY} x2={colX} y2={colY + colHpix}
            stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
      <text x={colX + colW / 2} y={colY + colHpix / 2 + 4} textAnchor="middle"
            fontSize="10.5" fontWeight="700" fill="rgba(255,255,255,0.92)">
        COL
      </text>
      <text x={colX + colW / 2} y={colY - 8} textAnchor="middle"
            fontSize="9" fill="rgba(255,255,255,0.55)" fontStyle="italic">
        {g.cx} × {g.columnShape === 'circular' ? g.cx : (g.cy ?? g.cx)} mm
      </text>

      {/* Bottom rebar in section (with white inner dot — bar-in-section symbol) */}
      {Array.from({ length: nBot }, (_, i) => {
        const x = fX + g.coverClear * scaleX + i * dxBars;
        return (
          <g key={`bb-${i}`}>
            <circle cx={x} cy={barY} r={barRadiusVis}
                    fill="#ff8a72" stroke="#a02020" strokeWidth="0.6" />
            <circle cx={x} cy={barY} r={Math.max(0.9, barRadiusVis * 0.30)}
                    fill="rgba(255,255,255,0.85)" />
          </g>
        );
      })}

      {/* Top rebar */}
      {topBars && Array.from({ length: nTop }, (_, i) => {
        const x = fX + g.coverClear * scaleX + i * dxTopBars;
        return (
          <g key={`tb-${i}`}>
            <circle cx={x} cy={topBarY} r={Math.max(2.5, dbTop * scaleX * 0.7)}
                    fill="#76b6c9" stroke="#3a6a8a" strokeWidth="0.6" />
            <circle cx={x} cy={topBarY} r={Math.max(0.7, dbTop * scaleX * 0.25)}
                    fill="rgba(255,255,255,0.85)" />
          </g>
        );
      })}

      {/* Cover annotation (leader to first bar) */}
      <g>
        <line x1={fX + 6} y1={fBot - 6}
              x2={fX + g.coverClear * scaleX} y2={barY}
              stroke="rgba(255,255,255,0.45)" strokeWidth="0.5" />
        <text x={fX + 6} y={fBot - 10} fontSize="9" fill="rgba(255,255,255,0.7)">
          c = {g.coverClear} mm
        </text>
      </g>

      {/* B dimension (above footing, between column and footing top) */}
      <g>
        <line x1={fX} y1={fY - 6} x2={fX} y2={fY - dimGap - 6}
              stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX + fW} y1={fY - 6} x2={fX + fW} y2={fY - dimGap - 6}
              stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX} y1={fY - dimGap} x2={fX + fW} y2={fY - dimGap}
              stroke="#cbd5e1" strokeWidth="0.85"
              markerStart="url(#dim-start-s)" markerEnd="url(#dim-end-s)" />
        <text x={fX + fW / 2} y={fY - dimGap - 8} textAnchor="middle"
              fontSize="11.5" fontWeight="700" fill="#cbd5e1">
          B = {B_mm} mm
        </text>
      </g>

      {/* T dimension (LEFT of footing, parked outside soil hatch) */}
      <g>
        <line x1={fX - 6} y1={fY} x2={fX - 38} y2={fY}
              stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX - 6} y1={fBot} x2={fX - 38} y2={fBot}
              stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX - 32} y1={fY} x2={fX - 32} y2={fBot}
              stroke="#cbd5e1" strokeWidth="0.85"
              markerStart="url(#dim-start-s)" markerEnd="url(#dim-end-s)" />
        <text x={fX - 50} y={fY + fH / 2} textAnchor="middle"
              fontSize="11.5" fontWeight="700" fill="#cbd5e1"
              transform={`rotate(-90, ${fX - 50}, ${fY + fH / 2})`}>
          T = {T_mm} mm
        </text>
      </g>

      {/* ─── PRESSURE DIAGRAM HEADER ──────────────────────────── */}
      <text x={fX} y={pressureBaselineY - 24} fontSize="11" fontWeight="700"
            fill="rgba(255,255,255,0.9)" letterSpacing="0.5">
        SOIL BEARING PRESSURE (kPa)
      </text>
      <text x={fX + fW} y={pressureBaselineY - 24} textAnchor="end"
            fontSize="9" fill="rgba(255,255,255,0.55)" fontStyle="italic">
        {result.upliftRegion
          ? `Bowles partial-uplift triangle  ·  e > B/6`
          : `Trapezoidal distribution  ·  service combination D + L`}
      </text>

      {/* Connection lines from footing edges to pressure baseline (visual link) */}
      <line x1={fX} y1={fBot} x2={fX} y2={pressureBaselineY}
            stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" strokeDasharray="2 3" />
      <line x1={fX + fW} y1={fBot} x2={fX + fW} y2={pressureBaselineY}
            stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" strokeDasharray="2 3" />

      {/* Baseline (zero pressure) */}
      <line x1={fX - 8} y1={pressureBaselineY} x2={fX + fW + 8} y2={pressureBaselineY}
            stroke="#cbd5e1" strokeWidth="0.9" />
      <text x={fX + fW + 12} y={pressureBaselineY + 3} fontSize="9" fill="rgba(203,213,225,0.7)">
        0
      </text>

      {/* qa reference line (dashed, gold) */}
      {qa * pressureScale < pressureH && (
        <g>
          <line x1={fX} y1={pressureBaselineY + qa * pressureScale}
                x2={fX + fW} y2={pressureBaselineY + qa * pressureScale}
                stroke="#c9a84c" strokeWidth="0.8" strokeDasharray="6 3" />
          <text x={fX + fW + 12} y={pressureBaselineY + qa * pressureScale + 3}
                fontSize="9.5" fill="#c9a84c" fontWeight="700">
            q_a = {qa.toFixed(0)}
          </text>
        </g>
      )}

      {/* Pressure polygon HANGS DOWN from baseline */}
      {result.upliftRegion ? (
        <polygon
          points={`
            ${fX},${pressureBaselineY}
            ${fX + fW * 0.7},${pressureBaselineY}
            ${fX},${pressureBaselineY + qmax * pressureScale}
          `}
          fill="url(#press-fill)" stroke="#ff6a55" strokeWidth="1.6" strokeLinejoin="round" />
      ) : (
        <polygon
          points={`
            ${fX},${pressureBaselineY}
            ${fX + fW},${pressureBaselineY}
            ${fX + fW},${pressureBaselineY + qmin * pressureScale}
            ${fX},${pressureBaselineY + qmax * pressureScale}
          `}
          fill="url(#press-fill)" stroke="#ff6a55" strokeWidth="1.6" strokeLinejoin="round" />
      )}

      {/* q_max label (left, leader going LEFT outside) */}
      <g>
        <line x1={fX - 4} y1={pressureBaselineY + qmax * pressureScale}
              x2={fX - 28} y2={pressureBaselineY + qmax * pressureScale}
              stroke="#ff6a55" strokeWidth="0.6" />
        <text x={fX - 32} y={pressureBaselineY + qmax * pressureScale + 4}
              textAnchor="end" fontSize="10.5" fill="#ff6a55" fontWeight="700">
          q_max = {qmax.toFixed(1)} kPa
        </text>
      </g>

      {/* q_min label (right, leader going RIGHT outside) — only if no uplift */}
      {!result.upliftRegion && (
        <g>
          <line x1={fX + fW + 4} y1={pressureBaselineY + qmin * pressureScale}
                x2={fX + fW + 28} y2={pressureBaselineY + qmin * pressureScale}
                stroke="#ff6a55" strokeWidth="0.6" />
          <text x={fX + fW + 32} y={pressureBaselineY + qmin * pressureScale + 4}
                fontSize="10.5" fill="#ff6a55" fontWeight="700">
            q_min = {qmin.toFixed(1)} kPa
          </text>
        </g>
      )}

      {/* Resultant arrow (R) at centroid of pressure distribution */}
      <g>
        <line x1={resultantX} y1={pressureBaselineY + pressureH + 8}
              x2={resultantX} y2={pressureBaselineY - 4}
              stroke="#ff8a72" strokeWidth="1.4" markerEnd="url(#resultant-arrow)" />
        <text x={resultantX + 8} y={pressureBaselineY + pressureH + 4}
              fontSize="9.5" fill="#ff8a72" fontWeight="700" fontStyle="italic">
          R
        </text>
        <text x={resultantX + 8} y={pressureBaselineY + pressureH + 16}
              fontSize="8" fill="rgba(255,138,114,0.7)" fontStyle="italic">
          (pressure resultant)
        </text>
      </g>

      {/* Footnote */}
      <text x={fX} y={H - 18} fontSize="8.5" fill="rgba(255,255,255,0.45)" fontStyle="italic">
        Pressures shown are gross contact (unfactored).  q_a is the net allowable bearing.
        {input.frictionMu != null && `  μ = ${input.frictionMu.toFixed(2)}`}
        {(g.embedment ?? 0) > 0 && `  ·  embedment = ${g.embedment} mm`}
      </text>
    </svg>
  );
}
