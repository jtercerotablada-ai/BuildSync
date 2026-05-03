'use client';

import React from 'react';
import type { BeamInput, BeamAnalysis } from '@/lib/rc/types';
import { lookupBar } from '@/lib/rc/types';

interface Props {
  input: BeamInput;
  result: BeamAnalysis;
}

/**
 * RcSection2D — three-pane diagram showing a beam cross-section, the strain
 * distribution at ultimate, and the Whitney rectangular stress block.
 * Standard textbook (Wight & MacGregor / ACI MNL-17) presentation.
 */
export function RcSection2D({ input, result }: Props) {
  const W = 900, H = 460;
  const padX = 30, padY = 50;
  const sectionW = 240;
  const strainW = 200;
  const stressW = 280;
  const gap = 40;

  const sectionX = padX;
  const strainX = sectionX + sectionW + gap;
  const stressX = strainX + strainW + gap;
  void stressW;

  // Section dimensions
  const g = input.geometry;
  const r = input.reinforcement;
  const beamH = H - 2 * padY;
  const scaleY = beamH / g.h;     // mm → px (vertical)

  // Horizontal scale: choose based on widest dimension (bf for T-beam)
  const widestSection = g.shape !== 'rectangular' ? Math.max(g.bf ?? g.bw, g.bw) : g.bw;
  const scaleX = sectionW / widestSection * 0.85;
  // Use a single uniform scale for bar diameters so circles look round
  const scaleBar = Math.min(scaleX, scaleY);

  const sectionCx = sectionX + sectionW / 2;
  const sectionTop = padY;
  const sectionBot = padY + beamH;

  // Bar diameters (mm)
  const stirrupDb = lookupBar(r.stirrup.bar)?.db ?? 9.5;
  const dbTens = lookupBar(r.tension[0]?.bar ?? '#9')?.db ?? 25;
  const dbComp = lookupBar(r.compression?.[0]?.bar ?? '#4')?.db ?? 12.7;
  const dbSkin = r.skin ? (lookupBar(r.skin.bar)?.db ?? 12) : 0;

  // Inner stirrup envelope (mm from outer face)
  const innerInset = g.coverClear + stirrupDb;

  // Bar Y positions — kept inside the stirrup
  // Tension: at user-specified d
  const yTens = sectionTop + g.d * scaleY;
  // Compression: at d' (default 50 mm)
  const yComp = sectionTop + (g.dPrime ?? 50) * scaleY;

  // Stress block depth a (px)
  const aPx = result.flexure.a * scaleY;
  const cPx = result.flexure.c * scaleY;

  // Section outer edges (px)
  const secLeft = sectionCx - g.bw * scaleX / 2;
  const secRight = sectionCx + g.bw * scaleX / 2;
  // Stirrup outer edges (offset by cover from outer face)
  const stirOutLeft = secLeft + g.coverClear * scaleX;
  const stirOutRight = secRight - g.coverClear * scaleX;
  const stirOutTop = sectionTop + g.coverClear * scaleY;
  const stirOutBot = sectionTop + (g.h - g.coverClear) * scaleY;
  // Stirrup INNER edges (offset by stirrup db from outer-face edges)
  const stirInLeft = stirOutLeft + stirrupDb * scaleX;
  const stirInRight = stirOutRight - stirrupDb * scaleX;
  void stirOutBot; void stirOutTop;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"
         style={{ width: '100%', maxWidth: '100%', height: 'auto', background: '#fafafa', borderRadius: 6 }}>
      {/* Title */}
      <text x={W / 2} y={20} textAnchor="middle" fontSize="13" fontWeight="700" fill="#222">
        BEAM SECTION · STRAIN DIAGRAM · WHITNEY STRESS BLOCK
      </text>

      {/* === PANE 1: CROSS SECTION === */}
      <g>
        <text x={sectionCx} y={padY - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#222">
          CROSS SECTION
        </text>

        {/* Section outline */}
        {g.shape === 'rectangular' ? (
          <rect x={sectionCx - g.bw * scaleX / 2} y={sectionTop}
                width={g.bw * scaleX} height={g.h * scaleY}
                fill="#cdc8bf" stroke="#333" strokeWidth="1.5" />
        ) : (
          <>
            {/* T-beam: flange + web */}
            <rect x={sectionCx - (g.bf ?? g.bw) * scaleX / 2} y={sectionTop}
                  width={(g.bf ?? g.bw) * scaleX} height={(g.hf ?? 100) * scaleY}
                  fill="#cdc8bf" stroke="#333" strokeWidth="1.5" />
            <rect x={sectionCx - g.bw * scaleX / 2} y={sectionTop + (g.hf ?? 100) * scaleY}
                  width={g.bw * scaleX} height={(g.h - (g.hf ?? 100)) * scaleY}
                  fill="#cdc8bf" stroke="#333" strokeWidth="1.5" />
          </>
        )}

        {/* Stirrup — drawn as a real closed loop with proper thickness + 135° hook (ACI §25.3.2) */}
        {(() => {
          const strW = Math.max(2, stirrupDb * scaleBar);   // visual stirrup line thickness
          // Stirrup centerline rect (between outer and inner faces)
          const cx1 = stirOutLeft + (stirrupDb / 2) * scaleX;
          const cx2 = stirOutRight - (stirrupDb / 2) * scaleX;
          const cy1 = sectionTop + (g.coverClear + stirrupDb / 2) * scaleY;
          const cy2 = sectionTop + (g.h - g.coverClear - stirrupDb / 2) * scaleY;
          const rxCorner = 2 * stirrupDb * scaleBar;     // §25.3.2 inside bend ≥ 4·db; centerline radius ≈ 2·db
          // Hook: 135° hook at top-right corner extending inward to mid-section
          const hookLen = 6 * stirrupDb * scaleBar;
          const hookDx = -hookLen * Math.cos(Math.PI / 4);
          const hookDy = +hookLen * Math.sin(Math.PI / 4);
          return (
            <g>
              <rect x={cx1} y={cy1} width={cx2 - cx1} height={cy2 - cy1}
                    rx={rxCorner} ry={rxCorner}
                    fill="none" stroke="#3a4a6a" strokeWidth={strW}
                    strokeLinejoin="round" strokeLinecap="round" />
              {/* 135° hook detail at top-right corner */}
              <line x1={cx2 - rxCorner * 0.3} y1={cy1 + rxCorner * 0.3}
                    x2={cx2 - rxCorner * 0.3 + hookDx} y2={cy1 + rxCorner * 0.3 + hookDy}
                    stroke="#3a4a6a" strokeWidth={strW} strokeLinecap="round" />
            </g>
          );
        })()}

        {/* Tension rebar — placed INSIDE stirrup inner envelope */}
        {(() => {
          const total = r.tension.reduce((s, b) => s + b.count, 0);
          if (total === 0) return null;
          const halfBar = (dbTens / 2) * scaleX;
          const xLeft = stirInLeft + halfBar;
          const xRight = stirInRight - halfBar;
          const xUsable = Math.max(xRight - xLeft, 1);
          const dx = total > 1 ? xUsable / (total - 1) : 0;
          // Y position: keep at d but ensure inside stirrup
          const yMin = stirInLeft;     // not used
          void yMin;
          const yInnerBot = sectionTop + (g.h - g.coverClear - stirrupDb) * scaleY;
          const yBar = Math.min(yTens, yInnerBot - (dbTens / 2) * scaleY);
          return Array.from({ length: total }, (_, i) => (
            <circle key={`t-${i}`}
              cx={total === 1 ? sectionCx : xLeft + i * dx}
              cy={yBar}
              r={(dbTens / 2) * scaleBar}
              fill="#c94c4c" stroke="#5a1212" strokeWidth="0.6" />
          ));
        })()}

        {/* Compression / hanger rebar — placed INSIDE stirrup top inner edge */}
        {(r.compression?.length ?? 0) > 0 && (() => {
          const totalC = (r.compression ?? []).reduce((s, b) => s + b.count, 0);
          if (totalC === 0) return null;
          const halfBar = (dbComp / 2) * scaleX;
          const xLeft = stirInLeft + halfBar;
          const xRight = stirInRight - halfBar;
          const xUsable = Math.max(xRight - xLeft, 1);
          const dx = totalC > 1 ? xUsable / (totalC - 1) : 0;
          const yInnerTop = sectionTop + (g.coverClear + stirrupDb) * scaleY;
          const yBar = Math.max(yComp, yInnerTop + (dbComp / 2) * scaleY);
          return Array.from({ length: totalC }, (_, i) => (
            <circle key={`c-${i}`}
              cx={totalC === 1 ? sectionCx : xLeft + i * dx}
              cy={yBar}
              r={(dbComp / 2) * scaleBar}
              fill="#e0c060" stroke="#5a4710" strokeWidth="0.6" />
          ));
        })()}

        {/* Skin reinforcement (h > 900 mm, ACI §9.7.2.3) — INSIDE stirrup vertical legs */}
        {r.skin && r.skin.countPerFace > 0 && (() => {
          const sk = r.skin!;
          const halfBar = (dbSkin / 2) * scaleX;
          // Skin bars sit just inside the vertical legs of the stirrup
          const xL = stirInLeft + halfBar;
          const xR = stirInRight - halfBar;
          // Distributed over h/2 from tension face up
          const skinBot = yTens - (dbTens / 2) * scaleY - 30 * scaleY;
          const skinTop = sectionTop + (g.h / 2) * scaleY;
          const span = Math.max(skinBot - skinTop, 1);
          const dy = sk.countPerFace > 1 ? span / (sk.countPerFace - 1) : 0;
          return Array.from({ length: sk.countPerFace }, (_, i) => (
            <g key={`sk-${i}`}>
              <circle cx={xL} cy={skinTop + i * dy} r={(dbSkin / 2) * scaleBar}
                      fill="#5fa3c9" stroke="#143b6a" strokeWidth="0.6" />
              <circle cx={xR} cy={skinTop + i * dy} r={(dbSkin / 2) * scaleBar}
                      fill="#5fa3c9" stroke="#143b6a" strokeWidth="0.6" />
            </g>
          ));
        })()}

        {/* Dimensions */}
        <text x={sectionCx} y={sectionBot + 18} textAnchor="middle" fontSize="9" fill="#222" fontWeight="600">
          {`bw = ${g.bw} mm`}
        </text>
        {g.shape !== 'rectangular' && g.bf && (
          <text x={sectionCx} y={sectionTop - 18} textAnchor="middle" fontSize="9" fill="#222" fontWeight="600">
            {`bf = ${g.bf} mm`}
          </text>
        )}
        <text x={sectionCx + sectionW / 2 - 5} y={sectionTop + beamH / 2}
              textAnchor="end" fontSize="9" fill="#222" fontWeight="600"
              transform={`rotate(-90, ${sectionCx + sectionW / 2 - 5}, ${sectionTop + beamH / 2})`}>
          {`h = ${g.h} mm`}
        </text>
        <text x={sectionCx + sectionW / 2 - 22} y={yTens + 2}
              fontSize="8" fill="#a02020" fontWeight="600">
          {`d = ${g.d} mm`}
        </text>

        {/* d line indicator */}
        <line x1={sectionCx + g.bw * scaleX / 2 + 4} y1={yTens}
              x2={sectionCx + g.bw * scaleX / 2 + 14} y2={yTens}
              stroke="#a02020" strokeWidth="0.6" />
      </g>

      {/* === PANE 2: STRAIN DIAGRAM === */}
      <g>
        <text x={strainX + strainW / 2} y={padY - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#222">
          STRAIN DIAGRAM
        </text>

        {/* Vertical reference axis */}
        <line x1={strainX + strainW / 2} y1={sectionTop} x2={strainX + strainW / 2} y2={sectionBot}
              stroke="#888" strokeWidth="0.5" strokeDasharray="2 2" />

        {/* Strain triangle: εcu = 0.003 (compression) at top, 0 at NA (c), εt (tension) at d */}
        <polygon
          points={`
            ${strainX + strainW / 2 - 60},${sectionTop}
            ${strainX + strainW / 2},${sectionTop + cPx}
            ${strainX + strainW / 2 + Math.min(120, Math.abs(result.flexure.epsT) / 0.003 * 60)},${yTens}
          `}
          fill="rgba(201, 168, 76, 0.25)" stroke="#c9a84c" strokeWidth="1" />

        {/* Neutral axis line */}
        <line x1={strainX} y1={sectionTop + cPx}
              x2={strainX + strainW} y2={sectionTop + cPx}
              stroke="#a02020" strokeWidth="0.7" strokeDasharray="3 2" />
        <text x={strainX + 6} y={sectionTop + cPx - 3} fontSize="8" fill="#a02020" fontWeight="600">
          {`Neutral axis (c = ${result.flexure.c.toFixed(1)} mm)`}
        </text>

        {/* εcu label */}
        <text x={strainX + strainW / 2 - 65} y={sectionTop + 4} textAnchor="end"
              fontSize="9" fill="#222" fontWeight="600">
          εcu = 0.003
        </text>

        {/* εt label */}
        <text x={strainX + strainW / 2 + 65} y={yTens + 4}
              fontSize="9" fill="#222" fontWeight="600">
          εt = {(result.flexure.epsT * 1000).toFixed(2)}‰
        </text>

        {/* Top + tension labels */}
        <text x={strainX + strainW / 2 - 75} y={sectionTop - 6} textAnchor="end" fontSize="8" fill="#666">
          (compression)
        </text>
        <text x={strainX + strainW / 2 + 75} y={sectionBot + 12} textAnchor="end" fontSize="8" fill="#666">
          (tension)
        </text>
      </g>

      {/* === PANE 3: WHITNEY STRESS BLOCK === */}
      <g>
        <text x={stressX + 140} y={padY - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#222">
          WHITNEY STRESS BLOCK
        </text>

        {/* Beam outline (shadow) */}
        <rect x={stressX} y={sectionTop} width={g.bw * scaleX * 1.4} height={beamH}
              fill="#f5f1e6" stroke="#333" strokeWidth="0.5" />

        {/* Compressive stress block — solid 0.85·fc over depth a */}
        <rect x={stressX} y={sectionTop} width={g.bw * scaleX * 1.4} height={aPx}
              fill="rgba(201, 76, 76, 0.40)" stroke="#7a1f1f" strokeWidth="0.7" />

        {/* Stress arrow (compressive, pointing down on the block) */}
        <line x1={stressX + g.bw * scaleX * 0.7} y1={sectionTop - 8}
              x2={stressX + g.bw * scaleX * 0.7} y2={sectionTop + aPx / 2}
              stroke="#7a1f1f" strokeWidth="1.5" markerEnd="url(#arrow-comp)" />
        <defs>
          <marker id="arrow-comp" viewBox="0 0 10 10" refX="5" refY="5"
                  markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#7a1f1f" />
          </marker>
        </defs>

        {/* "0.85·fc" label */}
        <text x={stressX + g.bw * scaleX * 0.7 + 8} y={sectionTop + aPx / 2 - 5} fontSize="9" fill="#7a1f1f" fontWeight="600">
          {`0.85·fʹc = ${(0.85 * input.materials.fc).toFixed(2)} MPa`}
        </text>

        {/* a label */}
        <line x1={stressX + g.bw * scaleX * 1.4 + 6} y1={sectionTop}
              x2={stressX + g.bw * scaleX * 1.4 + 6} y2={sectionTop + aPx}
              stroke="#222" strokeWidth="0.6" />
        <line x1={stressX + g.bw * scaleX * 1.4 + 3} y1={sectionTop}
              x2={stressX + g.bw * scaleX * 1.4 + 9} y2={sectionTop} stroke="#222" strokeWidth="0.5" />
        <line x1={stressX + g.bw * scaleX * 1.4 + 3} y1={sectionTop + aPx}
              x2={stressX + g.bw * scaleX * 1.4 + 9} y2={sectionTop + aPx} stroke="#222" strokeWidth="0.5" />
        <text x={stressX + g.bw * scaleX * 1.4 + 12} y={sectionTop + aPx / 2 + 3}
              fontSize="9" fill="#222" fontWeight="600">
          {`a = ${result.flexure.a.toFixed(1)} mm`}
        </text>

        {/* Tension force line */}
        <line x1={stressX + g.bw * scaleX * 0.7} y1={yTens}
              x2={stressX + g.bw * scaleX * 0.7} y2={yTens + 30}
              stroke="#1f6a36" strokeWidth="1.5" markerEnd="url(#arrow-tens)" />
        <defs>
          <marker id="arrow-tens" viewBox="0 0 10 10" refX="5" refY="5"
                  markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#1f6a36" />
          </marker>
        </defs>

        <text x={stressX + g.bw * scaleX * 0.7 + 8} y={yTens + 18}
              fontSize="9" fill="#1f6a36" fontWeight="600">
          T = As · fy = {((result.flexure.As * input.materials.fy) / 1000).toFixed(1)} kN
        </text>

        {/* Mn annotation */}
        <text x={stressX + 6} y={sectionBot + 18}
              fontSize="9" fill="#222" fontWeight="600">
          {`Mn = ${result.flexure.Mn.toFixed(1)} kN·m  →  φMn = ${result.flexure.phiMn.toFixed(1)} kN·m`}
        </text>
      </g>
    </svg>
  );
}
