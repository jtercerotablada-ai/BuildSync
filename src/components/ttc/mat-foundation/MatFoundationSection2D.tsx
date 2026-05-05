'use client';

import React from 'react';
import type { MatFoundationInput, MatFoundationAnalysis } from '@/lib/mat-foundation/types';
import { lookupBar } from '@/lib/rc/types';
import { Sub } from '../footing/svg-typography';

interface Props {
  input: MatFoundationInput;
  result: MatFoundationAnalysis;
  /** Which axis to cut along — 'X' shows columns aligned along X, 'Y' along Y. */
  axis?: 'X' | 'Y';
}

/**
 * MatFoundationSection2D — section view through the mat along the chosen
 * axis.  Shows the slab, all columns whose centerline falls within ±cl/2 of
 * the section cut, and the four rebar mats (top X/Y + bottom X/Y).
 */
export function MatFoundationSection2D({ input, result, axis = 'X' }: Props) {
  const W = 1080, H = 460;
  const padX = 130;

  const g = input.geometry;
  const cutDim = axis === 'X' ? g.B : g.L;
  const fW = W - 2 * padX;
  const scaleX = fW / cutDim;
  const fH = Math.max(70, Math.min(140, (g.T / cutDim) * fW * 1.5));

  const colTopY = 90;
  const colHpix = 130;
  const fY = colTopY + colHpix;
  const fBot = fY + fH;
  const fX = padX;

  // Pick the columns to render — those whose perpendicular position is roughly
  // on the cut line. For simplicity, render ALL columns, but darken the ones
  // not on the cut.
  const columnsToRender = input.columns;

  const dbBot = lookupBar(input.reinforcement.bottomX.bar)?.db ?? 16;
  const dbTop = lookupBar(input.reinforcement.topX.bar)?.db ?? 16;
  const spacingBot = (axis === 'X' ? input.reinforcement.bottomY.spacing : input.reinforcement.bottomX.spacing);
  const spacingTop = (axis === 'X' ? input.reinforcement.topY.spacing : input.reinforcement.topX.spacing);
  const nBot = Math.max(2, Math.floor((cutDim - 2 * g.coverClear) / spacingBot) + 1);
  const nTop = Math.max(2, Math.floor((cutDim - 2 * g.coverClear) / spacingTop) + 1);

  // Pressure diagram below
  const pressureGap = 60;
  const pressureBaselineY = fBot + pressureGap;
  const pressureH = 90;
  const qa = input.soil.qa;
  const qmax = result.bearing.q_max;
  const qPeak = Math.max(qmax, qa, 1) * 1.15;
  const pressureScale = pressureH / qPeak;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
         xmlns="http://www.w3.org/2000/svg"
         style={{ width: '100%', maxWidth: '100%', height: 'auto',
                  background: 'rgba(20, 20, 20, 0.5)', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.05)' }}>
      <defs>
        <pattern id="msec-soil" width="6" height="14" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="14" stroke="rgba(120,90,50,0.55)" strokeWidth="0.7" />
          <circle cx="3" cy="4" r="0.6" fill="rgba(120,90,50,0.4)" />
        </pattern>
        <pattern id="msec-conc" width="22" height="22" patternUnits="userSpaceOnUse">
          <rect width="22" height="22" fill="rgba(195,180,150,0.10)" />
          <circle cx="3" cy="4" r="0.7" fill="rgba(255,255,255,0.18)" />
          <circle cx="11" cy="3" r="0.5" fill="rgba(160,140,100,0.5)" />
          <circle cx="14" cy="13" r="0.8" fill="rgba(255,255,255,0.18)" />
          <circle cx="20" cy="17" r="0.5" fill="rgba(160,140,100,0.45)" />
        </pattern>
        <pattern id="msec-press" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(255,138,114,0.4)" strokeWidth="0.7" />
        </pattern>
        <marker id="msec-end" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
        </marker>
        <marker id="msec-start" viewBox="0 0 10 10" refX="1" refY="5"
                markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 10 0 L 0 5 L 10 10 z" fill="#cbd5e1" />
        </marker>
      </defs>

      <text x={W / 2} y="26" textAnchor="middle"
            fontSize="14" fontWeight="700" fill="rgba(255,255,255,0.95)" letterSpacing="0.5">
        SECTION {axis === 'X' ? 'A-A' : 'B-B'} — Mat foundation along {axis}
      </text>
      <text x={W / 2} y="44" textAnchor="middle"
            fontSize="9" fill="rgba(255,255,255,0.55)" fontStyle="italic">
        ACI 318-25 §13.3.4 · cover {g.coverClear} mm · top + bottom mats both directions
      </text>

      {/* Soil hatch */}
      <rect x={0} y={fY - 5} width={fX} height={fH + 5} fill="url(#msec-soil)" />
      <rect x={fX + fW} y={fY - 5} width={W - fX - fW} height={fH + 5} fill="url(#msec-soil)" />
      <line x1={0} y1={fY - 5} x2={W} y2={fY - 5}
            stroke="rgba(120,90,50,0.6)" strokeWidth="1" strokeDasharray="4 3" />

      {/* Mat slab */}
      <rect x={fX} y={fY} width={fW} height={fH} fill="url(#msec-conc)" />
      <rect x={fX} y={fY} width={fW} height={fH}
            fill="rgba(180,180,180,0.04)" stroke="#c9a84c" strokeWidth="2" />

      {/* Columns whose center is along the cut axis. For X-section, project
          all columns onto the X axis (their X position becomes the screen X). */}
      {columnsToRender.map((col, i) => {
        const colCutPos = axis === 'X' ? col.x : col.y;
        const cx = fX + colCutPos * scaleX;
        const colDim = (axis === 'X' ? col.cx : (col.cy ?? col.cx));
        const colW = colDim * scaleX;
        return (
          <g key={i}>
            <rect x={cx - colW / 2} y={colTopY} width={colW} height={colHpix}
                  fill="url(#msec-conc)" />
            <rect x={cx - colW / 2} y={colTopY} width={colW} height={colHpix}
                  fill="rgba(180,180,180,0.04)" stroke="#888" strokeWidth="1" />
            <line x1={cx - colW / 2} y1={colTopY} x2={cx + colW / 2} y2={colTopY + colHpix}
                  stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
            <line x1={cx + colW / 2} y1={colTopY} x2={cx - colW / 2} y2={colTopY + colHpix}
                  stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
            <text x={cx} y={colTopY + colHpix / 2 + 4} textAnchor="middle"
                  fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.92)">
              {col.id}
            </text>
            <text x={cx} y={colTopY - 8} textAnchor="middle"
                  fontSize="8.5" fill="rgba(255,255,255,0.55)" fontStyle="italic">
              Pu = {(1.2 * col.PD + 1.6 * col.PL).toFixed(0)} kN
            </text>
          </g>
        );
      })}

      {/* Bottom mat: continuous bar with hooks at the ends + circles for perpendicular */}
      <path
        d={`
          M ${fX + g.coverClear * scaleX},${fBot - g.coverClear - 14}
          L ${fX + g.coverClear * scaleX},${fBot - g.coverClear}
          L ${fX + fW - g.coverClear * scaleX},${fBot - g.coverClear}
          L ${fX + fW - g.coverClear * scaleX},${fBot - g.coverClear - 14}
        `}
        fill="none" stroke="#ff8a72"
        strokeWidth={Math.max(1.4, dbBot * scaleX * 0.45)}
        strokeLinecap="round" strokeLinejoin="round" />
      {Array.from({ length: nBot }, (_, i) => {
        const dxStep = (cutDim - 2 * g.coverClear) * scaleX / Math.max(nBot - 1, 1);
        const x = fX + g.coverClear * scaleX + i * dxStep;
        const y = fBot - g.coverClear - dbBot / 2 - 4;
        const r = Math.max(2, dbBot * scaleX * 0.5);
        return (
          <circle key={`bm-${i}`} cx={x} cy={y} r={r}
                  fill="#ff8a72" stroke="#a02020" strokeWidth="0.5" />
        );
      })}

      {/* Top mat */}
      <line x1={fX + g.coverClear * scaleX} y1={fY + g.coverClear + dbTop / 2 + 4}
            x2={fX + fW - g.coverClear * scaleX} y2={fY + g.coverClear + dbTop / 2 + 4}
            stroke="#76b6c9" strokeWidth={Math.max(1.4, dbTop * scaleX * 0.45)}
            strokeLinecap="round" />
      {Array.from({ length: nTop }, (_, i) => {
        const dxStep = (cutDim - 2 * g.coverClear) * scaleX / Math.max(nTop - 1, 1);
        const x = fX + g.coverClear * scaleX + i * dxStep;
        const y = fY + g.coverClear + dbTop / 2 + 4;
        const r = Math.max(2, dbTop * scaleX * 0.5);
        return (
          <circle key={`tm-${i}`} cx={x} cy={y} r={r}
                  fill="#76b6c9" stroke="#3a6a8a" strokeWidth="0.5" />
        );
      })}

      {/* Cut-axis dimension */}
      <g>
        <line x1={fX} y1={fY - 6} x2={fX} y2={fY - 30} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX + fW} y1={fY - 6} x2={fX + fW} y2={fY - 30} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX} y1={fY - 24} x2={fX + fW} y2={fY - 24}
              stroke="#cbd5e1" strokeWidth="0.85"
              markerStart="url(#msec-start)" markerEnd="url(#msec-end)" />
        <text x={fX + fW / 2} y={fY - 30} textAnchor="middle"
              fontSize="11" fontWeight="700" fill="#cbd5e1">
          {axis === 'X' ? `B = ${g.B} mm` : `L = ${g.L} mm`}
        </text>
      </g>

      {/* T dim */}
      <g>
        <line x1={fX - 6} y1={fY} x2={fX - 38} y2={fY} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX - 6} y1={fBot} x2={fX - 38} y2={fBot} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX - 32} y1={fY} x2={fX - 32} y2={fBot}
              stroke="#cbd5e1" strokeWidth="0.85"
              markerStart="url(#msec-start)" markerEnd="url(#msec-end)" />
        <text x={fX - 50} y={fY + fH / 2} textAnchor="middle"
              fontSize="11" fontWeight="700" fill="#cbd5e1"
              transform={`rotate(-90, ${fX - 50}, ${fY + fH / 2})`}>
          T = {g.T} mm
        </text>
      </g>

      {/* Pressure diagram */}
      <text x={fX} y={pressureBaselineY - 18} fontSize="11" fontWeight="700"
            fill="rgba(255,255,255,0.9)" letterSpacing="0.5">
        SOIL PRESSURE (rigid method, kPa)
      </text>
      <line x1={fX - 8} y1={pressureBaselineY} x2={fX + fW + 8} y2={pressureBaselineY}
            stroke="#cbd5e1" strokeWidth="0.8" />
      {/* Bilinear: extract corner values along the cut axis */}
      {(() => {
        const qStart = axis === 'X' ? result.bearing.q_corner_BL : result.bearing.q_corner_BL;
        const qEnd   = axis === 'X' ? result.bearing.q_corner_BR : result.bearing.q_corner_TL;
        return (
          <polygon
            points={`
              ${fX},${pressureBaselineY}
              ${fX + fW},${pressureBaselineY}
              ${fX + fW},${pressureBaselineY + qEnd * pressureScale}
              ${fX},${pressureBaselineY + qStart * pressureScale}
            `}
            fill="url(#msec-press)" stroke="#ff6a55" strokeWidth="1.4" />
        );
      })()}
      {qa * pressureScale < pressureH && (
        <>
          <line x1={fX} y1={pressureBaselineY + qa * pressureScale}
                x2={fX + fW} y2={pressureBaselineY + qa * pressureScale}
                stroke="#c9a84c" strokeWidth="0.85" strokeDasharray="6 3" />
          <text x={fX + fW + 8} y={pressureBaselineY + qa * pressureScale + 3}
                fontSize="9.5" fill="#c9a84c" fontWeight="700">
            q<Sub>a</Sub> = {qa.toFixed(0)}
          </text>
        </>
      )}
      <text x={fX - 6} y={pressureBaselineY + result.bearing.q_max * pressureScale + 3}
            textAnchor="end" fontSize="10" fill="#ff6a55" fontWeight="700">
        q<Sub>max</Sub> = {result.bearing.q_max.toFixed(1)}
      </text>
    </svg>
  );
}
