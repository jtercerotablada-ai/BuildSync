'use client';

import React from 'react';
import type { CombinedFootingInput, CombinedFootingAnalysis } from '@/lib/combined-footing/types';
import { lookupBar } from '@/lib/rc/types';
import { Sub } from '../footing/svg-typography';

interface Props {
  input: CombinedFootingInput;
  result: CombinedFootingAnalysis;
}

/**
 * CombinedFootingPlan2D — top-down plan view of a two-column combined
 * footing.  Shows the footing outline, both columns, the bottom-longitudinal
 * + bottom-transverse rebar grids, dimension lines, and a structured legend
 * block.
 */
export function CombinedFootingPlan2D({ input, result }: Props) {
  const W = 980, H = 580;
  const padTop = 60, padBottom = 130;
  const padLeft = 110, padRight = 70;

  const g = input.geometry;
  const drawW = W - padLeft - padRight;
  const drawH = H - padTop - padBottom;
  const scale = Math.min(drawW / g.L, drawH / g.B) * 0.86;
  const fW = g.L * scale;     // visual width along X-screen = footing length L
  const fH = g.B * scale;     // visual height = footing width B
  const fX = padLeft + (drawW - fW) / 2;
  const fY = padTop + (drawH - fH) / 2;

  const leftEdge = g.leftEdge ?? 0;

  // Bottom-long bar pattern (running along L = X-screen, distributed across B = Y-screen)
  const dbLong = lookupBar(input.reinforcement.bottomLong.bar)?.db ?? 22;
  const nLong = input.reinforcement.bottomLong.count;
  const innerH = (g.B - 2 * g.coverClear) * scale;
  const dyL = nLong > 1 ? innerH / (nLong - 1) : 0;

  // Bottom-trans bar pattern (running along B, distributed across L)
  const dbTrans = lookupBar(input.reinforcement.bottomTrans.bar)?.db ?? 19;
  const nTrans = input.reinforcement.bottomTrans.count;
  const innerW = (g.L - 2 * g.coverClear) * scale;
  const dxT = nTrans > 1 ? innerW / (nTrans - 1) : 0;

  const dimGap = 30;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
         xmlns="http://www.w3.org/2000/svg"
         style={{ width: '100%', maxWidth: '100%', height: 'auto',
                  background: 'rgba(20, 20, 20, 0.5)', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.05)' }}>
      <defs>
        <marker id="cf-arrow" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
        </marker>
        <marker id="cf-arrow-rev" viewBox="0 0 10 10" refX="1" refY="5"
                markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 10 0 L 0 5 L 10 10 z" fill="#cbd5e1" />
        </marker>
      </defs>

      <text x={W / 2} y="26" textAnchor="middle"
            fontSize="14" fontWeight="700" fill="rgba(255,255,255,0.95)" letterSpacing="0.5">
        PLAN VIEW — Combined footing {(g.L / 1000).toFixed(2)} × {(g.B / 1000).toFixed(2)} m
      </text>
      <text x={W / 2} y="44" textAnchor="middle"
            fontSize="9" fill="rgba(255,255,255,0.55)" fontStyle="italic">
        Bottom mat shown · cover {g.coverClear} mm · 2 columns · scale ≈ 1 : {Math.round(1 / scale * 1000)}
      </text>

      {/* Footing outline */}
      <rect x={fX} y={fY} width={fW} height={fH}
            fill="rgba(180,180,180,0.10)" stroke="#c9a84c" strokeWidth="2" />

      {/* Bottom-long bars (horizontal lines) */}
      {Array.from({ length: nLong }, (_, i) => (
        <line key={`bl-${i}`}
              x1={fX + g.coverClear * scale}
              y1={fY + g.coverClear * scale + i * dyL}
              x2={fX + fW - g.coverClear * scale}
              y2={fY + g.coverClear * scale + i * dyL}
              stroke="#ff8a72"
              strokeWidth={Math.max(0.9, dbLong * scale * 0.55)}
              opacity="0.9" />
      ))}

      {/* Bottom-trans bars (vertical lines) */}
      {Array.from({ length: nTrans }, (_, i) => (
        <line key={`bt-${i}`}
              x1={fX + g.coverClear * scale + i * dxT}
              y1={fY + g.coverClear * scale}
              x2={fX + g.coverClear * scale + i * dxT}
              y2={fY + fH - g.coverClear * scale}
              stroke="#76b6c9"
              strokeWidth={Math.max(0.9, dbTrans * scale * 0.55)}
              opacity="0.9" />
      ))}

      {/* Two columns */}
      {[input.column1, input.column2].map((col, i) => {
        const xLocal = col.position - leftEdge;     // mm in mat-local coords
        const cx = fX + xLocal * scale;
        const cy = fY + fH / 2;
        const colW = col.cl * scale;
        const colH = (col.shape === 'circular' ? col.cl : (col.ct ?? col.cl)) * scale;
        return (
          <g key={i}>
            {col.shape === 'circular' ? (
              <circle cx={cx} cy={cy} r={colW / 2}
                      fill="rgba(140,140,140,0.7)" stroke="#444" strokeWidth="1.2" />
            ) : (
              <rect x={cx - colW / 2} y={cy - colH / 2}
                    width={colW} height={colH}
                    fill="rgba(140,140,140,0.7)" stroke="#444" strokeWidth="1.2" />
            )}
            <text x={cx} y={cy + 4} textAnchor="middle"
                  fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.95)">
              C{i + 1}
            </text>
            <text x={cx} y={cy - colH / 2 - 6} textAnchor="middle"
                  fontSize="8.5" fill="rgba(255,255,255,0.6)" fontStyle="italic">
              {col.cl}{col.shape === 'circular' ? ' Ø' : `×${col.ct ?? col.cl}`} mm
            </text>
          </g>
        );
      })}

      {/* Resultant marker (⊕) */}
      {(() => {
        const xRLocal = result.bearing.xResultantFromLeft;
        const rx = fX + xRLocal * scale;
        const ry = fY + fH / 2;
        return (
          <g>
            <circle cx={rx} cy={ry} r="9" fill="none" stroke="#ff8a72" strokeWidth="1.6" />
            <line x1={rx - 11} y1={ry} x2={rx + 11} y2={ry} stroke="#ff8a72" strokeWidth="1.4" />
            <line x1={rx} y1={ry - 11} x2={rx} y2={ry + 11} stroke="#ff8a72" strokeWidth="1.4" />
            <text x={rx} y={ry + fH / 2 - 4} textAnchor="middle"
                  fontSize="9" fill="#ff8a72" fontWeight="600">
              R (offset {result.bearing.centroidOffset.toFixed(0)} mm)
            </text>
          </g>
        );
      })()}

      {/* L dimension (bottom) */}
      <g>
        <line x1={fX} y1={fY + fH + 4} x2={fX} y2={fY + fH + dimGap + 4}
              stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX + fW} y1={fY + fH + 4} x2={fX + fW} y2={fY + fH + dimGap + 4}
              stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX} y1={fY + fH + dimGap} x2={fX + fW} y2={fY + fH + dimGap}
              stroke="#cbd5e1" strokeWidth="0.85"
              markerStart="url(#cf-arrow-rev)" markerEnd="url(#cf-arrow)" />
        <text x={fX + fW / 2} y={fY + fH + dimGap + 16} textAnchor="middle"
              fontSize="11.5" fontWeight="700" fill="#cbd5e1">
          L = {g.L} mm
        </text>
      </g>

      {/* B dimension (left) */}
      <g>
        <line x1={fX - 4} y1={fY} x2={fX - dimGap - 4} y2={fY} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX - 4} y1={fY + fH} x2={fX - dimGap - 4} y2={fY + fH} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX - dimGap} y1={fY} x2={fX - dimGap} y2={fY + fH}
              stroke="#cbd5e1" strokeWidth="0.85"
              markerStart="url(#cf-arrow-rev)" markerEnd="url(#cf-arrow)" />
        <text x={fX - dimGap - 14} y={fY + fH / 2} textAnchor="middle"
              fontSize="11.5" fontWeight="700" fill="#cbd5e1"
              transform={`rotate(-90, ${fX - dimGap - 14}, ${fY + fH / 2})`}>
          B = {g.B} mm
        </text>
      </g>

      {/* Legend block */}
      <g transform={`translate(${padLeft - 20}, ${H - padBottom + 60})`}>
        <rect x="0" y="0" width={W - padLeft - padRight + 40} height="58"
              fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" rx="4" />
        <line x1="14" y1="20" x2="46" y2="20" stroke="#ff8a72" strokeWidth="2.5" />
        <text x="54" y="23" fontSize="9.5" fill="#ff8a72" fontWeight="600">
          Bottom-long: {nLong} {input.reinforcement.bottomLong.bar} (along L)
        </text>
        <line x1="14" y1="38" x2="46" y2="38" stroke="#76b6c9" strokeWidth="2.5" />
        <text x="54" y="41" fontSize="9.5" fill="#76b6c9" fontWeight="600">
          Bottom-trans: {nTrans} {input.reinforcement.bottomTrans.bar} (along B)
        </text>
        <text x="380" y="23" fontSize="9.5" fill="#c9a84c">
          q<Sub>max</Sub> = <tspan fontWeight="700">{result.bearing.q_max.toFixed(1)} kPa</tspan>
        </text>
        <text x="380" y="41" fontSize="9.5" fill="rgba(255,255,255,0.7)">
          q<Sub>a</Sub> = {input.soil.qa.toFixed(0)} kPa · q<Sub>nu</Sub> = {result.qnu.toFixed(1)} kPa
        </text>
        <text x="660" y="23" fontSize="9.5" fill="rgba(255,255,255,0.85)">
          C1: Pu = {result.beam.Pu1.toFixed(0)} kN
        </text>
        <text x="660" y="41" fontSize="9.5" fill="rgba(255,255,255,0.85)">
          C2: Pu = {result.beam.Pu2.toFixed(0)} kN
        </text>
      </g>
    </svg>
  );
}
