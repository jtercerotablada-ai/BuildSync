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
 * CombinedFootingSection2D — longitudinal section A-A through both columns.
 * Shows the footing concrete, both columns rising, top + bottom longitudinal
 * rebar mats, and the uniform factored soil pressure beneath.
 */
export function CombinedFootingSection2D({ input, result }: Props) {
  const W = 1080, H = 540;
  const padX = 130;

  const g = input.geometry;
  const fW = W - 2 * padX;
  const scaleX = fW / g.L;
  const fH = Math.max(70, Math.min(140, (g.T / g.L) * fW * 1.5));
  const scaleY = fH / g.T;

  const colTopY = 90;
  const colHpix = 130;
  const fY = colTopY + colHpix;
  const fBot = fY + fH;
  const fX = padX;
  const leftEdge = g.leftEdge ?? 0;

  // Bottom-long bar diameter (visible as circles in section if cut perpendicular)
  // But Section A-A is along L → bottom-long bars run along the page → visible as
  // continuous lines.  Bottom-trans bars run perpendicular to the page → circles.
  const dbLong = lookupBar(input.reinforcement.bottomLong.bar)?.db ?? 22;
  const dbTrans = lookupBar(input.reinforcement.bottomTrans.bar)?.db ?? 19;
  const nTrans = input.reinforcement.bottomTrans.count;

  // Pressure diagram below
  const pressureGap = 70;
  const pressureBaselineY = fBot + pressureGap;
  const pressureH = 100;
  const qnu = result.qnu;
  const qa = input.soil.qa;
  const qPeak = Math.max(qnu, qa, 1) * 1.15;
  const pressureScale = pressureH / qPeak;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
         xmlns="http://www.w3.org/2000/svg"
         style={{ width: '100%', maxWidth: '100%', height: 'auto',
                  background: 'rgba(20, 20, 20, 0.5)', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.05)' }}>
      <defs>
        <pattern id="csec-soil" width="6" height="14" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="14" stroke="rgba(120,90,50,0.55)" strokeWidth="0.7" />
          <circle cx="3" cy="4" r="0.6" fill="rgba(120,90,50,0.4)" />
          <circle cx="3" cy="10" r="0.5" fill="rgba(120,90,50,0.3)" />
        </pattern>
        <pattern id="csec-conc" width="22" height="22" patternUnits="userSpaceOnUse">
          <rect width="22" height="22" fill="rgba(195,180,150,0.10)" />
          <circle cx="3" cy="4" r="0.7" fill="rgba(255,255,255,0.18)" />
          <circle cx="11" cy="3" r="0.5" fill="rgba(160,140,100,0.5)" />
          <circle cx="17" cy="7" r="0.6" fill="rgba(255,255,255,0.16)" />
          <circle cx="6" cy="10" r="0.5" fill="rgba(160,140,100,0.4)" />
          <circle cx="14" cy="13" r="0.8" fill="rgba(255,255,255,0.18)" />
          <circle cx="20" cy="17" r="0.5" fill="rgba(160,140,100,0.45)" />
          <circle cx="2" cy="18" r="0.5" fill="rgba(255,255,255,0.14)" />
          <circle cx="9" cy="19" r="0.5" fill="rgba(160,140,100,0.4)" />
        </pattern>
        <pattern id="csec-press" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(255,138,114,0.4)" strokeWidth="0.7" />
        </pattern>
        <marker id="csec-end" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
        </marker>
        <marker id="csec-start" viewBox="0 0 10 10" refX="1" refY="5"
                markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 10 0 L 0 5 L 10 10 z" fill="#cbd5e1" />
        </marker>
      </defs>

      <text x={W / 2} y="26" textAnchor="middle"
            fontSize="14" fontWeight="700" fill="rgba(255,255,255,0.95)" letterSpacing="0.5">
        SECTION A-A — Combined footing longitudinal
      </text>
      <text x={W / 2} y="44" textAnchor="middle"
            fontSize="9" fill="rgba(255,255,255,0.55)" fontStyle="italic">
        Cut along L through both column centrelines · ACI 318-25 §13.3.4 · cover {g.coverClear} mm
      </text>

      {/* Soil hatch on either side */}
      <rect x={0} y={fY - 5} width={fX} height={fH + 5} fill="url(#csec-soil)" />
      <rect x={fX + fW} y={fY - 5} width={W - fX - fW} height={fH + 5} fill="url(#csec-soil)" />
      <line x1={0} y1={fY - 5} x2={W} y2={fY - 5}
            stroke="rgba(120,90,50,0.6)" strokeWidth="1" strokeDasharray="4 3" />
      <text x={W - 14} y={fY - 9} textAnchor="end" fontSize="9" fill="rgba(120,90,50,0.85)" fontStyle="italic">
        finished grade
      </text>

      {/* Footing concrete */}
      <rect x={fX} y={fY} width={fW} height={fH} fill="url(#csec-conc)" />
      <rect x={fX} y={fY} width={fW} height={fH}
            fill="rgba(180,180,180,0.04)" stroke="#c9a84c" strokeWidth="2" />

      {/* Both columns */}
      {[input.column1, input.column2].map((col, i) => {
        const xLocal = col.position - leftEdge;
        const colW = col.cl * scaleX;
        const colX = fX + xLocal * scaleX - colW / 2;
        return (
          <g key={i}>
            <rect x={colX} y={colTopY} width={colW} height={colHpix}
                  fill="url(#csec-conc)" />
            <rect x={colX} y={colTopY} width={colW} height={colHpix}
                  fill="rgba(180,180,180,0.04)" stroke="#888" strokeWidth="1.2" />
            {/* Cut hatch (X) */}
            <line x1={colX} y1={colTopY} x2={colX + colW} y2={colTopY + colHpix}
                  stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
            <line x1={colX + colW} y1={colTopY} x2={colX} y2={colTopY + colHpix}
                  stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
            <text x={colX + colW / 2} y={colTopY + colHpix / 2 + 4} textAnchor="middle"
                  fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.92)">
              C{i + 1}
            </text>
            <text x={colX + colW / 2} y={colTopY - 8} textAnchor="middle"
                  fontSize="9" fill="rgba(255,255,255,0.55)" fontStyle="italic">
              Pu = {(i === 0 ? result.beam.Pu1 : result.beam.Pu2).toFixed(0)} kN
            </text>
          </g>
        );
      })}

      {/* Bottom-long rebar (continuous line) with hooks */}
      <path
        d={`
          M ${fX + g.coverClear * scaleX},${fBot - g.coverClear * scaleY - dbLong * scaleY / 2 - 14}
          L ${fX + g.coverClear * scaleX},${fBot - g.coverClear * scaleY - dbLong * scaleY / 2}
          L ${fX + fW - g.coverClear * scaleX},${fBot - g.coverClear * scaleY - dbLong * scaleY / 2}
          L ${fX + fW - g.coverClear * scaleX},${fBot - g.coverClear * scaleY - dbLong * scaleY / 2 - 14}
        `}
        fill="none" stroke="#ff8a72"
        strokeWidth={Math.max(1.6, dbLong * scaleX * 0.5)}
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Bottom-trans bars as circles */}
      {Array.from({ length: nTrans }, (_, i) => {
        const dxT = nTrans > 1 ? (g.L - 2 * g.coverClear) * scaleX / (nTrans - 1) : 0;
        const x = fX + g.coverClear * scaleX + i * dxT;
        const y = fBot - g.coverClear * scaleY - dbTrans * scaleY / 2;
        const r = Math.max(2.5, dbTrans * scaleX * 0.6);
        return (
          <g key={`bt-${i}`}>
            <circle cx={x} cy={y} r={r} fill="#76b6c9" stroke="#3a6a8a" strokeWidth="0.6" />
            <circle cx={x} cy={y} r={Math.max(0.7, r * 0.3)} fill="rgba(255,255,255,0.85)" />
          </g>
        );
      })}

      {/* Top-long rebar (between columns, negative-moment region) */}
      {input.reinforcement.topLong && (() => {
        const dbTop = lookupBar(input.reinforcement.topLong.bar)?.db ?? 22;
        const xc1 = (input.column1.position - leftEdge) * scaleX;
        const xc2 = (input.column2.position - leftEdge) * scaleX;
        return (
          <line x1={fX + xc1 - input.column1.cl * scaleX / 2 - 30}
                y1={fY + g.coverClear * scaleY + dbTop * scaleY / 2}
                x2={fX + xc2 + input.column2.cl * scaleX / 2 + 30}
                y2={fY + g.coverClear * scaleY + dbTop * scaleY / 2}
                stroke="#76b6c9" strokeWidth={Math.max(1.4, dbTop * scaleX * 0.5)}
                opacity="0.85" strokeLinecap="round" />
        );
      })()}

      {/* L dimension */}
      <g>
        <line x1={fX} y1={fY - 6} x2={fX} y2={fY - 30} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX + fW} y1={fY - 6} x2={fX + fW} y2={fY - 30} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX} y1={fY - 24} x2={fX + fW} y2={fY - 24}
              stroke="#cbd5e1" strokeWidth="0.85"
              markerStart="url(#csec-start)" markerEnd="url(#csec-end)" />
        <text x={fX + fW / 2} y={fY - 30} textAnchor="middle"
              fontSize="11" fontWeight="700" fill="#cbd5e1">
          L = {g.L} mm
        </text>
      </g>

      {/* T dimension on left */}
      <g>
        <line x1={fX - 6} y1={fY} x2={fX - 38} y2={fY} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX - 6} y1={fBot} x2={fX - 38} y2={fBot} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={fX - 32} y1={fY} x2={fX - 32} y2={fBot}
              stroke="#cbd5e1" strokeWidth="0.85"
              markerStart="url(#csec-start)" markerEnd="url(#csec-end)" />
        <text x={fX - 50} y={fY + fH / 2} textAnchor="middle"
              fontSize="11" fontWeight="700" fill="#cbd5e1"
              transform={`rotate(-90, ${fX - 50}, ${fY + fH / 2})`}>
          T = {g.T} mm
        </text>
      </g>

      {/* Soil-pressure baseline + uniform qnu */}
      <text x={fX} y={pressureBaselineY - 22} fontSize="11" fontWeight="700"
            fill="rgba(255,255,255,0.9)" letterSpacing="0.5">
        FACTORED SOIL PRESSURE (kPa)
      </text>
      <text x={fX + fW} y={pressureBaselineY - 22} textAnchor="end"
            fontSize="9" fill="rgba(255,255,255,0.55)" fontStyle="italic">
        Uniform q<tspan baselineShift="sub" fontSize="0.72em">nu</tspan> assumed (rigid method, ACI §13.3.4.3)
      </text>
      <line x1={fX - 8} y1={pressureBaselineY} x2={fX + fW + 8} y2={pressureBaselineY}
            stroke="#cbd5e1" strokeWidth="0.9" />
      <rect x={fX} y={pressureBaselineY}
            width={fW} height={qnu * pressureScale}
            fill="url(#csec-press)" stroke="#ff6a55" strokeWidth="1.4" />
      <text x={fX - 6} y={pressureBaselineY + qnu * pressureScale / 2 + 3}
            textAnchor="end" fontSize="10" fill="#ff6a55" fontWeight="700">
        q<Sub>nu</Sub> = {qnu.toFixed(1)} kPa
      </text>
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
    </svg>
  );
}
