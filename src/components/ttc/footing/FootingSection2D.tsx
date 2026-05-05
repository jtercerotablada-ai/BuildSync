'use client';

import React from 'react';
import type { FootingInput, FootingAnalysis } from '@/lib/footing/types';
import { lookupBar } from '@/lib/rc/types';
import { Sub } from './svg-typography';

interface Props {
  input: FootingInput;
  result: FootingAnalysis;
}

/**
 * FootingSection2D — engineer-grade construction detail.
 *
 * Two stacked SVGs:
 *   1) CONSTRUCTION DETAIL:
 *      • Soil body with sloped excavation walls (H:V = 0.5:1)
 *      • Ground line / finished grade
 *      • Compacted base + concrete blinding (PCC bed)
 *      • Footing with concrete-aggregate stipple
 *      • Bottom rebar mat with 90° end-hooks (basket shape)
 *      • Top rebar mat when present
 *      • Column above with main bars (red) anchored on bottom mat
 *      • Column ties (stirrups) visible at intervals
 *      • Lap-length zone marker
 *      • Construction joint at column-footing interface
 *      • Dimensions: B, T, Vmax (with rigid/flexible classification)
 *      • Callouts: Column / Column reinforcement / 90° hook on bottom
 *        mat / Construction joint / Bottom footing reinforcement /
 *        Concrete blinding (PCC bed) / Compacted base / Bar chairs
 *
 *   2) SOIL BEARING PRESSURE (Bowles convention):
 *      • Polygon hangs DOWN from baseline
 *      • qa reference line, qmax / qmin with leader-line labels
 *      • Resultant R at centroid of pressure
 */
export function FootingSection2D({ input, result }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <ConstructionDetail input={input} result={result} />
      <PressureDiagram input={input} result={result} />
    </div>
  );
}

// ─── CONSTRUCTION DETAIL ───────────────────────────────────────────

function ConstructionDetail({ input, result: _result }: Props) {
  const W = 1080, H = 600;
  const padX = 150;

  const g = input.geometry;
  const B_mm = g.B;
  const T_mm = g.T;

  const fW = W - 2 * padX;
  const scaleX = fW / B_mm;
  const fH = Math.max(80, Math.min(150, (T_mm / B_mm) * fW * 1.5));
  const scaleY = fH / T_mm;

  // Vertical layout
  const colTopY = 80;
  const colExposedH = 70;
  const groundY = colTopY + colExposedH;
  const excavationGap = 50;          // visible embedment between grade and footing top
  const fY = groundY + excavationGap;
  const fBot = fY + fH;
  const fX = padX;

  // Layers below footing
  const blindingH = 14;
  const blindingY = fBot;
  const blindingBot = blindingY + blindingH;
  const compactedH = 18;
  const compactedY = blindingBot;
  const compactedBot = compactedY + compactedH;

  // Column geometry
  const colW = g.cx * scaleX;
  const colCx = (W - colW) / 2 + (g.ex ?? 0) * scaleX;
  const colX = colCx;

  // Bottom rebar — circles = bottomY count (perpendicular to cut)
  const dbBotY = lookupBar(input.reinforcement.bottomY.bar)?.db ?? 16;
  const nBotCircles = input.reinforcement.bottomY.count;
  const dbBotX = lookupBar(input.reinforcement.bottomX.bar)?.db ?? 16;
  const innerW = (B_mm - 2 * g.coverClear) * scaleX;
  const dxCircles = nBotCircles > 1 ? innerW / (nBotCircles - 1) : 0;
  const barY = fBot - g.coverClear * scaleY - dbBotY * scaleY / 2;
  const barRadiusVis = Math.max(3, dbBotY * scaleX * 0.6);
  const hookLen = 16;

  // Top rebar
  const topBars = input.reinforcement.topY;
  const dbTop = topBars ? (lookupBar(topBars.bar)?.db ?? 12) : 0;
  const nTopCircles = topBars?.count ?? 0;
  const dxTopCircles = nTopCircles > 1 ? innerW / (nTopCircles - 1) : 0;
  const topBarY = fY + g.coverClear * scaleY + dbTop * scaleY / 2;

  // Vmax
  const Vmax = (B_mm - g.cx) / 2;
  const isRigid = Vmax <= 2 * T_mm;

  const dimGap = 36;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
         xmlns="http://www.w3.org/2000/svg"
         style={{ width: '100%', maxWidth: '100%', height: 'auto',
                  background: 'rgba(20, 20, 20, 0.5)', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.05)' }}>

      <defs>
        {/* Soil hatch — vertical lines with sparse dots (construction-detail convention) */}
        <pattern id="cd-soil" width="6" height="14" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="14" stroke="rgba(120,90,50,0.55)" strokeWidth="0.7" />
          <circle cx="3" cy="4" r="0.7" fill="rgba(120,90,50,0.4)" />
          <circle cx="3" cy="10" r="0.5" fill="rgba(120,90,50,0.3)" />
        </pattern>
        {/* Concrete stipple — random aggregate dots */}
        <pattern id="cd-conc" width="22" height="22" patternUnits="userSpaceOnUse">
          <rect width="22" height="22" fill="rgba(195,180,150,0.10)" />
          <circle cx="3"  cy="4"  r="0.8" fill="rgba(255,255,255,0.20)" />
          <circle cx="11" cy="3"  r="0.5" fill="rgba(160,140,100,0.5)" />
          <circle cx="17" cy="7"  r="0.7" fill="rgba(255,255,255,0.16)" />
          <circle cx="6"  cy="10" r="0.5" fill="rgba(160,140,100,0.4)" />
          <circle cx="14" cy="13" r="0.9" fill="rgba(255,255,255,0.18)" />
          <circle cx="20" cy="17" r="0.5" fill="rgba(160,140,100,0.45)" />
          <circle cx="2"  cy="18" r="0.6" fill="rgba(255,255,255,0.14)" />
          <circle cx="9"  cy="19" r="0.5" fill="rgba(160,140,100,0.4)" />
        </pattern>
        {/* Compacted base */}
        <pattern id="cd-base" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(140,110,70,0.55)" strokeWidth="0.5" />
        </pattern>
        {/* Blinding (light grey concrete) */}
        <pattern id="cd-blinding" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="rgba(160,160,160,0.2)" />
          <circle cx="2" cy="2" r="0.45" fill="rgba(255,255,255,0.22)" />
          <circle cx="4.5" cy="4.5" r="0.4" fill="rgba(255,255,255,0.18)" />
        </pattern>
        {/* Pour joint (junta) */}
        <pattern id="cd-joint" width="6" height="5" patternUnits="userSpaceOnUse">
          <rect width="6" height="5" fill="rgba(140,140,140,0.3)" />
          <line x1="0" y1="2.5" x2="6" y2="2.5" stroke="rgba(255,255,255,0.35)" strokeWidth="0.35" strokeDasharray="2 1.5" />
        </pattern>
        <marker id="cd-end" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
        </marker>
        <marker id="cd-start" viewBox="0 0 10 10" refX="1" refY="5"
                markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 10 0 L 0 5 L 10 10 z" fill="#cbd5e1" />
        </marker>
      </defs>

      {/* Title */}
      <text x={W / 2} y="26" textAnchor="middle"
            fontSize="14" fontWeight="700" fill="rgba(255,255,255,0.95)" letterSpacing="0.5">
        SECTION A-A — Construction detail (isolated footing)
      </text>
      <text x={W / 2} y="46" textAnchor="middle"
            fontSize="9" fill="rgba(255,255,255,0.55)" fontStyle="italic">
        Cut along X · ACI 318-25 §13.2 · {isRigid ? 'rigid' : 'flexible'} footing (V<Sub>max</Sub> {isRigid ? '≤' : '>'} 2h) · cover {g.coverClear} mm
      </text>

      {/* ─── SOIL BODY (with sloped excavation walls H:V = 0.5:1) ─── */}
      {(() => {
        const slopeRatio = 0.5;     // horizontal:vertical (typical for stable soil)
        const excDepth = compactedBot - groundY;
        const slopeOffset = excDepth * slopeRatio;
        const soilBotY = compactedBot + 50;   // soil body extends below excavation
        return (
          <>
            {/* LEFT soil body (wedge) */}
            <polygon
              points={`
                0,${groundY}
                ${fX - 4 - slopeOffset},${groundY}
                ${fX - 4},${compactedBot}
                ${fX - 4},${soilBotY}
                0,${soilBotY}
              `}
              fill="url(#cd-soil)"
              stroke="rgba(120,90,50,0.6)" strokeWidth="0.5" />

            {/* RIGHT soil body (mirror) */}
            <polygon
              points={`
                ${W},${groundY}
                ${fX + fW + 4 + slopeOffset},${groundY}
                ${fX + fW + 4},${compactedBot}
                ${fX + fW + 4},${soilBotY}
                ${W},${soilBotY}
              `}
              fill="url(#cd-soil)"
              stroke="rgba(120,90,50,0.6)" strokeWidth="0.5" />

            {/* Excavation slope edges (drawn explicitly for clarity) */}
            <line x1={fX - 4 - slopeOffset} y1={groundY}
                  x2={fX - 4} y2={compactedBot}
                  stroke="rgba(120,90,50,0.85)" strokeWidth="1.2" />
            <line x1={fX + fW + 4 + slopeOffset} y1={groundY}
                  x2={fX + fW + 4} y2={compactedBot}
                  stroke="rgba(120,90,50,0.85)" strokeWidth="1.2" />

            {/* Bottom of excavation under blinding/base — soil hatch underneath */}
            <rect x={fX - 4} y={compactedBot} width={fW + 8} height={soilBotY - compactedBot}
                  fill="url(#cd-soil)" />
          </>
        );
      })()}

      {/* Ground line (cota terreno / rasante) */}
      <line x1={0} y1={groundY} x2={W} y2={groundY}
            stroke="rgba(120,90,50,0.85)" strokeWidth="1.2" />
      <text x={W - 14} y={groundY - 6} textAnchor="end"
            fontSize="9" fill="rgba(120,90,50,0.85)" fontStyle="italic">
        finished grade
      </text>

      {/* ─── COMPACTED BASE ──────────────────────────────────── */}
      <rect x={fX - 6} y={compactedY} width={fW + 12} height={compactedH}
            fill="url(#cd-base)" stroke="rgba(140,110,70,0.55)" strokeWidth="0.5" />

      {/* ─── BLINDING (PCC bed / concrete blinding) ─────────── */}
      <rect x={fX - 4} y={blindingY} width={fW + 8} height={blindingH}
            fill="url(#cd-blinding)" stroke="rgba(160,160,160,0.5)" strokeWidth="0.5" />

      {/* ─── FOOTING CONCRETE (with aggregate stipple) ──────── */}
      <rect x={fX} y={fY} width={fW} height={fH}
            fill="url(#cd-conc)" />
      <rect x={fX} y={fY} width={fW} height={fH}
            fill="rgba(180,180,180,0.04)"
            stroke="#c9a84c" strokeWidth="2" />

      {/* ─── BOTTOM REBAR MAT (basket with hooks) ────────────── */}
      <path
        d={`
          M ${fX + g.coverClear * scaleX},${barY - hookLen}
          L ${fX + g.coverClear * scaleX},${barY}
          L ${fX + fW - g.coverClear * scaleX},${barY}
          L ${fX + fW - g.coverClear * scaleX},${barY - hookLen}
        `}
        fill="none" stroke="#ff8a72"
        strokeWidth={Math.max(1.6, dbBotX * scaleX * 0.5)}
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Distributed circles — perpendicular Y-bars cut by section */}
      {Array.from({ length: nBotCircles }, (_, i) => {
        const x = fX + g.coverClear * scaleX + i * dxCircles;
        return (
          <g key={`bb-${i}`}>
            <circle cx={x} cy={barY} r={barRadiusVis}
                    fill="#ff8a72" stroke="#a02020" strokeWidth="0.7" />
            <circle cx={x} cy={barY} r={Math.max(0.7, barRadiusVis * 0.30)}
                    fill="rgba(255,255,255,0.85)" />
          </g>
        );
      })}

      {/* ─── TOP REBAR MAT (when present) ────────────────────── */}
      {topBars && (
        <>
          <path
            d={`
              M ${fX + g.coverClear * scaleX},${topBarY + 10}
              L ${fX + g.coverClear * scaleX},${topBarY}
              L ${fX + fW - g.coverClear * scaleX},${topBarY}
              L ${fX + fW - g.coverClear * scaleX},${topBarY + 10}
            `}
            fill="none" stroke="#76b6c9"
            strokeWidth={Math.max(1.4, dbTop * scaleX * 0.5)}
            strokeLinecap="round" strokeLinejoin="round" />
          {Array.from({ length: nTopCircles }, (_, i) => {
            const x = fX + g.coverClear * scaleX + i * dxTopCircles;
            return (
              <circle key={`tb-${i}`} cx={x} cy={topBarY}
                      r={Math.max(2.5, dbTop * scaleX * 0.6)}
                      fill="#76b6c9" stroke="#3a6a8a" strokeWidth="0.6" />
            );
          })}
        </>
      )}

      {/* ─── COLUMN (concrete) ──────────────────────────────── */}
      <rect x={colX} y={colTopY} width={colW} height={fY - colTopY}
            fill="url(#cd-conc)" />
      <rect x={colX} y={colTopY} width={colW} height={fY - colTopY}
            fill="rgba(180,180,180,0.04)"
            stroke="#888" strokeWidth="1.2" />

      {/* Column main bars — CONTINUOUS from top of column through joint
          into footing, with 90° hooks landing on bottom mat (per ACI 318
          §25.4.3, ldh = 0.24·fy·db / (λ·√fc) typical) */}
      {(() => {
        const c = 22;
        const dbCol = 20;          // assumed column bar diameter (mm) for visual
        const hookEndY = barY - 2;  // lands just above bottom mat
        const hookOut = Math.max(14, dbCol * 0.6);
        return (
          <g>
            {/* LEFT main bar: from top of column → down → 90° hook inward */}
            <path d={`
              M ${colX + c},${colTopY + 4}
              L ${colX + c},${hookEndY}
              L ${colX + c + hookOut},${hookEndY}
            `}
              fill="none" stroke="#ff8a72" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round" />
            {/* RIGHT main bar: mirror */}
            <path d={`
              M ${colX + colW - c},${colTopY + 4}
              L ${colX + colW - c},${hookEndY}
              L ${colX + colW - c - hookOut},${hookEndY}
            `}
              fill="none" stroke="#ff8a72" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      })()}

      {/* Column stirrups (cercos) — extend through full column height */}
      {(() => {
        const stirrups: React.ReactElement[] = [];
        const c = 19;
        const startY = colTopY + 14;
        const endY = fY - 6;     // stop at construction joint
        const step = 18;
        for (let y = startY; y < endY; y += step) {
          stirrups.push(
            <line key={`st-${y}`}
                  x1={colX + c} y1={y} x2={colX + colW - c} y2={y}
                  stroke="#ff8a72" strokeWidth="0.8" opacity="0.85" />
          );
        }
        return stirrups;
      })()}

      {/* Lap-length zone marker (typical 50·db above the joint) */}
      {(() => {
        const lapH = 36;     // visual representation of lap zone
        const lapTopY = fY - lapH;
        const lapBotY = fY - 4;
        return (
          <g>
            {/* Bracket on left side of column showing lap zone */}
            <line x1={colX - 6} y1={lapTopY} x2={colX - 12} y2={lapTopY}
                  stroke="rgba(118,182,201,0.9)" strokeWidth="0.6" />
            <line x1={colX - 6} y1={lapBotY} x2={colX - 12} y2={lapBotY}
                  stroke="rgba(118,182,201,0.9)" strokeWidth="0.6" />
            <line x1={colX - 9} y1={lapTopY} x2={colX - 9} y2={lapBotY}
                  stroke="#76b6c9" strokeWidth="0.8"
                  markerStart="url(#cd-start)" markerEnd="url(#cd-end)" />
            <text x={colX - 14} y={(lapTopY + lapBotY) / 2 + 3}
                  textAnchor="end" fontSize="9" fill="#76b6c9" fontWeight="700">
              Lap length
            </text>
            <text x={colX - 14} y={(lapTopY + lapBotY) / 2 + 14}
                  textAnchor="end" fontSize="8" fill="rgba(118,182,201,0.7)" fontStyle="italic">
              ≈ 50·db (ACI 318 §25.5.2)
            </text>
          </g>
        );
      })()}

      {/* Pour joint (junta de hormigonado) at interface */}
      <rect x={colX - 1} y={fY - 3} width={colW + 2} height={6}
            fill="url(#cd-joint)" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4"
            strokeDasharray="3 2" />

      {/* Column dimension annotation */}
      <text x={colX + colW / 2} y={colTopY - 8} textAnchor="middle"
            fontSize="9" fill="rgba(255,255,255,0.6)" fontStyle="italic">
        Column {g.cx} × {g.columnShape === 'circular' ? g.cx : (g.cy ?? g.cx)} mm
      </text>

      {/* ─── DIMENSIONS ─────────────────────────────────────── */}

      {/* B (above footing, between column area and top edge) */}
      <g>
        <line x1={fX} y1={fY - 6} x2={fX} y2={fY - dimGap - 6}
              stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX + fW} y1={fY - 6} x2={fX + fW} y2={fY - dimGap - 6}
              stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX} y1={fY - dimGap} x2={fX + fW} y2={fY - dimGap}
              stroke="#cbd5e1" strokeWidth="0.85"
              markerStart="url(#cd-start)" markerEnd="url(#cd-end)" />
        <text x={fX + fW / 2} y={fY - dimGap - 8} textAnchor="middle"
              fontSize="11" fontWeight="700" fill="#cbd5e1">
          B = {B_mm} mm
        </text>
      </g>

      {/* T (left of footing) */}
      <g>
        <line x1={fX - 8} y1={fY} x2={fX - 50} y2={fY}
              stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX - 8} y1={fBot} x2={fX - 50} y2={fBot}
              stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX - 44} y1={fY} x2={fX - 44} y2={fBot}
              stroke="#cbd5e1" strokeWidth="0.85"
              markerStart="url(#cd-start)" markerEnd="url(#cd-end)" />
        <text x={fX - 60} y={fY + fH / 2} textAnchor="middle"
              fontSize="11" fontWeight="700" fill="#cbd5e1"
              transform={`rotate(-90, ${fX - 60}, ${fY + fH / 2})`}>
          T = {T_mm} mm
        </text>
      </g>

      {/* V_max (column-face to footing-edge cantilever) */}
      {Vmax > 0 && (
        <g>
          <line x1={fX} y1={fY + 14} x2={fX} y2={fY + 26}
                stroke="rgba(118,182,201,0.8)" strokeWidth="0.5" />
          <line x1={colX} y1={fY + 14} x2={colX} y2={fY + 26}
                stroke="rgba(118,182,201,0.8)" strokeWidth="0.5" />
          <line x1={fX} y1={fY + 20} x2={colX} y2={fY + 20}
                stroke="#76b6c9" strokeWidth="0.8"
                markerStart="url(#cd-start)" markerEnd="url(#cd-end)" />
          <text x={(fX + colX) / 2} y={fY + 34} textAnchor="middle"
                fontSize="9.5" fill="#76b6c9" fontWeight="700">
            V<Sub>max</Sub> = {Vmax.toFixed(0)} mm
          </text>
        </g>
      )}

      {/* ─── CALLOUTS ───────────────────────────────────────── */}

      {/* Column / Column reinforcement (top right) */}
      <g>
        <line x1={colX + colW + 3} y1={colTopY + 28}
              x2={colX + colW + 50} y2={colTopY + 12}
              stroke="rgba(203,213,225,0.55)" strokeWidth="0.5" />
        <text x={colX + colW + 53} y={colTopY + 14}
              fontSize="9" fill="rgba(203,213,225,0.92)" fontWeight="600">
          Column
        </text>
        <text x={colX + colW + 53} y={colTopY + 26}
              fontSize="8.5" fill="#ff8a72" fontWeight="600">
          Column reinforcement (verticals + ties)
        </text>
      </g>

      {/* Hooked anchorage callout (90° hook on bottom mat) */}
      <g>
        <line x1={colX + colW + 3} y1={barY - 8}
              x2={colX + colW + 48} y2={barY - 28}
              stroke="rgba(203,213,225,0.55)" strokeWidth="0.5" />
        <text x={colX + colW + 51} y={barY - 28}
              fontSize="9" fill="#ff8a72" fontWeight="600">
          90° hook on bottom mat
        </text>
        <text x={colX + colW + 51} y={barY - 16}
              fontSize="8" fill="rgba(255,138,114,0.7)" fontStyle="italic">
          ldh per ACI 318-25 §25.4.3
        </text>
      </g>

      {/* Construction joint callout — RIGHT side (Lap length is on LEFT) */}
      <g>
        <line x1={colX + colW + 4} y1={fY}
              x2={colX + colW + 48} y2={fY - 18}
              stroke="rgba(203,213,225,0.55)" strokeWidth="0.5" />
        <text x={colX + colW + 51} y={fY - 20}
              fontSize="9" fill="rgba(203,213,225,0.92)" fontWeight="600">
          Construction joint
        </text>
        <text x={colX + colW + 51} y={fY - 8}
              fontSize="8" fill="rgba(255,255,255,0.55)" fontStyle="italic">
          rough · clean · moistened
        </text>
      </g>

      {/* Bottom footing reinforcement callout */}
      <g>
        <line x1={fX + fW * 0.25} y1={barY + 4}
              x2={fX + fW * 0.18} y2={fBot + 38}
              stroke="rgba(203,213,225,0.55)" strokeWidth="0.5" />
        <text x={fX + fW * 0.18} y={fBot + 50}
              fontSize="9" fill="#ff8a72" fontWeight="600">
          Bottom footing reinforcement
        </text>
        <text x={fX + fW * 0.18} y={fBot + 62}
              fontSize="8" fill="rgba(255,138,114,0.72)">
          {input.reinforcement.bottomX.count} {input.reinforcement.bottomX.bar} (X) · {input.reinforcement.bottomY.count} {input.reinforcement.bottomY.bar} (Y) · 90° end hooks
        </text>
      </g>

      {/* Concrete blinding (PCC bed) callout */}
      <g>
        <line x1={fX + fW * 0.55} y1={blindingY + blindingH / 2}
              x2={fX + fW * 0.55 + 60} y2={blindingY + blindingH + 32}
              stroke="rgba(203,213,225,0.55)" strokeWidth="0.5" />
        <text x={fX + fW * 0.55 + 62} y={blindingY + blindingH + 36}
              fontSize="9" fill="rgba(203,213,225,0.92)" fontWeight="600">
          Concrete blinding (PCC bed)
        </text>
        <text x={fX + fW * 0.55 + 62} y={blindingY + blindingH + 48}
              fontSize="8" fill="rgba(255,255,255,0.55)">
          ≥ 50 mm · f′c ≈ 14 MPa
        </text>
      </g>

      {/* f'c callout — concrete strength of footing (centred in concrete) */}
      <text x={colX - colW * 0.4 - 30} y={(fY + fBot) / 2 - 6}
            fontSize="10" fill="rgba(255,255,255,0.55)" fontWeight="600" fontStyle="italic">
        Concrete
      </text>
      <text x={colX - colW * 0.4 - 30} y={(fY + fBot) / 2 + 6}
            fontSize="10" fill="rgba(201,168,76,0.9)" fontWeight="700">
        f′c = {input.materials.fc} MPa
      </text>
      <text x={colX - colW * 0.4 - 30} y={(fY + fBot) / 2 + 18}
            fontSize="9" fill="rgba(255,255,255,0.55)" fontStyle="italic">
        f<Sub>y</Sub> = {input.materials.fy} MPa
      </text>

      {/* Compacted base callout */}
      <g>
        <line x1={fX + fW * 0.85} y1={compactedY + compactedH / 2}
              x2={fX + fW * 0.85 + 30} y2={compactedY + compactedH + 28}
              stroke="rgba(203,213,225,0.55)" strokeWidth="0.5" />
        <text x={fX + fW * 0.85 + 32} y={compactedY + compactedH + 32}
              fontSize="9" fill="rgba(203,213,225,0.92)" fontWeight="600">
          Compacted base
        </text>
        <text x={fX + fW * 0.85 + 32} y={compactedY + compactedH + 44}
              fontSize="8" fill="rgba(255,255,255,0.55)">
          improved subgrade · CBR ≥ 80%
        </text>
      </g>

      {/* Bar chairs / spacers callout */}
      <g>
        <line x1={fX + fW * 0.42} y1={barY + barRadiusVis + 1}
              x2={fX + fW * 0.42 + 30} y2={barY + barRadiusVis + 26}
              stroke="rgba(203,213,225,0.4)" strokeWidth="0.4" strokeDasharray="2 2" />
        <text x={fX + fW * 0.42 + 32} y={barY + barRadiusVis + 30}
              fontSize="8" fill="rgba(255,255,255,0.6)" fontStyle="italic">
          Bar chairs ≥ 50 mm
        </text>
      </g>

      {/* Cover annotation */}
      <g>
        <line x1={fX + 5} y1={fBot - 6}
              x2={fX + g.coverClear * scaleX} y2={barY}
              stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
        <text x={fX + 5} y={fBot - 10}
              fontSize="8.5" fill="rgba(255,255,255,0.7)">
          c = {g.coverClear} mm
        </text>
      </g>
    </svg>
  );
}

// ─── PRESSURE DIAGRAM ────────────────────────────────────────────────

function PressureDiagram({ input, result }: Props) {
  const W = 1080, H = 280;
  const padX = 150;

  const g = input.geometry;
  const B_mm = g.B;
  const fW = W - 2 * padX;
  const scaleX = fW / B_mm;
  const fX = padX;

  const baselineY = 80;
  const pressureH = 130;
  const qmax = result.bearing.q_max;
  const qmin = Math.max(0, result.bearing.q_min);
  const qa = input.soil.qa;
  const qPeak = Math.max(qmax, qa, 1) * 1.20;
  const pressureScale = pressureH / qPeak;

  // Resultant of pressure (CG of trapezoid)
  const sumQ = qmax + qmin;
  const xCgFromLeft = sumQ > 0 ? B_mm * (2 * qmax + qmin) / (3 * sumQ) : B_mm / 2;
  const resultantX = fX + xCgFromLeft * scaleX;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
         xmlns="http://www.w3.org/2000/svg"
         style={{ width: '100%', maxWidth: '100%', height: 'auto',
                  background: 'rgba(20, 20, 20, 0.5)', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.05)' }}>
      <defs>
        <pattern id="pd-fill" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(255,138,114,0.4)" strokeWidth="0.7" />
        </pattern>
        <marker id="pd-res" viewBox="0 0 10 10" refX="5" refY="9"
                markerWidth="9" markerHeight="9" orient="auto">
          <path d="M 0 0 L 5 9 L 10 0 z" fill="#ff8a72" />
        </marker>
      </defs>

      {/* Title */}
      <text x={W / 2} y="24" textAnchor="middle"
            fontSize="13" fontWeight="700" fill="rgba(255,255,255,0.92)" letterSpacing="0.5">
        SOIL BEARING PRESSURE — Bowles convention (kPa)
      </text>
      <text x={W / 2} y="42" textAnchor="middle"
            fontSize="9" fill="rgba(255,255,255,0.55)" fontStyle="italic">
        {result.upliftRegion ? 'Bowles partial-uplift triangle (e > B/6)' : 'Trapezoidal distribution · service combination D + L'}
      </text>

      {/* Footing underside reference (top of pressure region) */}
      <line x1={fX - 8} y1={baselineY} x2={fX + fW + 8} y2={baselineY}
            stroke="#cbd5e1" strokeWidth="0.9" />
      <text x={fX - 12} y={baselineY + 3} textAnchor="end"
            fontSize="9" fill="rgba(203,213,225,0.7)">
        underside of footing
      </text>
      <text x={fX + fW + 12} y={baselineY + 3}
            fontSize="9" fill="rgba(203,213,225,0.7)">
        0
      </text>

      {/* qa reference line */}
      {qa * pressureScale < pressureH && (
        <g>
          <line x1={fX} y1={baselineY + qa * pressureScale}
                x2={fX + fW} y2={baselineY + qa * pressureScale}
                stroke="#c9a84c" strokeWidth="0.85" strokeDasharray="6 3" />
          <text x={fX + fW + 12} y={baselineY + qa * pressureScale + 3}
                fontSize="9.5" fill="#c9a84c" fontWeight="700">
            q<Sub>a</Sub> = {qa.toFixed(0)} kPa
          </text>
        </g>
      )}

      {/* Pressure polygon hangs DOWN */}
      {result.upliftRegion ? (
        <polygon
          points={`
            ${fX},${baselineY}
            ${fX + fW * 0.7},${baselineY}
            ${fX},${baselineY + qmax * pressureScale}
          `}
          fill="url(#pd-fill)" stroke="#ff6a55" strokeWidth="1.6" />
      ) : (
        <polygon
          points={`
            ${fX},${baselineY}
            ${fX + fW},${baselineY}
            ${fX + fW},${baselineY + qmin * pressureScale}
            ${fX},${baselineY + qmax * pressureScale}
          `}
          fill="url(#pd-fill)" stroke="#ff6a55" strokeWidth="1.6" />
      )}

      {/* q max */}
      <g>
        <line x1={fX - 4} y1={baselineY + qmax * pressureScale}
              x2={fX - 28} y2={baselineY + qmax * pressureScale}
              stroke="#ff6a55" strokeWidth="0.6" />
        <text x={fX - 32} y={baselineY + qmax * pressureScale + 4}
              textAnchor="end" fontSize="10" fill="#ff6a55" fontWeight="700">
          q<Sub>max</Sub> = {qmax.toFixed(1)} kPa
        </text>
      </g>

      {/* q min */}
      {!result.upliftRegion && (
        <g>
          <line x1={fX + fW + 4} y1={baselineY + qmin * pressureScale}
                x2={fX + fW + 28} y2={baselineY + qmin * pressureScale}
                stroke="#ff6a55" strokeWidth="0.6" />
          <text x={fX + fW + 32} y={baselineY + qmin * pressureScale + 4}
                fontSize="10" fill="#ff6a55" fontWeight="700">
            q<Sub>min</Sub> = {qmin.toFixed(1)} kPa
          </text>
        </g>
      )}

      {/* Resultant arrow */}
      <g>
        <line x1={resultantX} y1={baselineY + pressureH + 12}
              x2={resultantX} y2={baselineY - 4}
              stroke="#ff8a72" strokeWidth="1.4" markerEnd="url(#pd-res)" />
        <text x={resultantX + 8} y={baselineY + pressureH + 8}
              fontSize="9.5" fill="#ff8a72" fontWeight="700" fontStyle="italic">
          R
        </text>
        <text x={resultantX + 8} y={baselineY + pressureH + 20}
              fontSize="8" fill="rgba(255,138,114,0.7)" fontStyle="italic">
          (pressure centroid)
        </text>
      </g>

      {/* Footnote */}
      <text x={fX} y={H - 12} fontSize="8.5" fill="rgba(255,255,255,0.45)" fontStyle="italic">
        Gross contact pressures · q<Sub>a</Sub> is the net allowable · linear distribution per ACI 318-25 §13.2 (rigid footing).
        {input.frictionMu != null && `   μ = ${input.frictionMu.toFixed(2)}`}
        {(g.embedment ?? 0) > 0 && `   ·   embedment = ${g.embedment} mm`}
      </text>
    </svg>
  );
}
