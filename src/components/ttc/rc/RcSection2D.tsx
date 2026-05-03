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
  const beamH = H - 2 * padY;
  const scaleY = beamH / g.h;     // mm → px (vertical)

  // Horizontal scale: choose based on widest dimension (bf for T-beam)
  const widestSection = g.shape !== 'rectangular' ? Math.max(g.bf ?? g.bw, g.bw) : g.bw;
  const scaleX = sectionW / widestSection * 0.85;

  const sectionCx = sectionX + sectionW / 2;
  const sectionTop = padY;
  const sectionBot = padY + beamH;

  // Tension steel y position
  const yTens = sectionTop + g.d * scaleY;
  // Compression steel y position
  const yComp = sectionTop + (g.dPrime ?? 60) * scaleY;

  // Stress block depth a (px)
  const aPx = result.flexure.a * scaleY;
  const cPx = result.flexure.c * scaleY;

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

        {/* Tension rebar — distributed across width */}
        {(() => {
          const total = input.reinforcement.tension.reduce((s, b) => s + b.count, 0);
          const dbT = input.reinforcement.tension[0]?.bar ? lookupBar(input.reinforcement.tension[0].bar)?.db ?? 25 : 25;
          const usableW = g.bw - 2 * (g.coverClear + 10);
          const sBars = total > 1 ? usableW / (total - 1) : 0;
          const startX = sectionCx - usableW * scaleX / 2;
          return Array.from({ length: total }, (_, i) => (
            <circle key={`t-${i}`}
              cx={startX + i * sBars * scaleX}
              cy={yTens}
              r={dbT * scaleX / 2}
              fill="#c94c4c" stroke="#7a1f1f" strokeWidth="0.5" />
          ));
        })()}

        {/* Compression rebar */}
        {(input.reinforcement.compression?.length ?? 0) > 0 && (() => {
          const totalC = (input.reinforcement.compression ?? []).reduce((s, b) => s + b.count, 0);
          const dbC = input.reinforcement.compression?.[0]?.bar
            ? lookupBar(input.reinforcement.compression[0].bar)?.db ?? 20 : 20;
          const usableW = g.bw - 2 * (g.coverClear + 10);
          const sBars = totalC > 1 ? usableW / (totalC - 1) : 0;
          const startX = sectionCx - usableW * scaleX / 2;
          return Array.from({ length: totalC }, (_, i) => (
            <circle key={`c-${i}`}
              cx={startX + i * sBars * scaleX}
              cy={yComp}
              r={dbC * scaleX / 2}
              fill="#e0c060" stroke="#7a5e1f" strokeWidth="0.5" />
          ));
        })()}

        {/* Stirrup outline (dashed inset) */}
        <rect
          x={sectionCx - (g.bw - 2 * g.coverClear) * scaleX / 2}
          y={sectionTop + g.coverClear * scaleY}
          width={(g.bw - 2 * g.coverClear) * scaleX}
          height={(g.h - 2 * g.coverClear) * scaleY}
          fill="none" stroke="#444" strokeWidth="0.6" strokeDasharray="4 2" />

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
