'use client';

import React, { useMemo } from 'react';
import type { RcParams, RcResults } from '@/lib/section/rc-types';
import { formatValue, unitLabel, type UnitSystem } from '@/lib/beam/units';
import { findBar } from '@/lib/section/rc-rebar-presets';

interface Props {
  params: RcParams;
  results: RcResults;
  unitSystem: UnitSystem;
  /** Neutral axis depth c from top (mm). If not provided, uses flexural strength c. */
  overlay?: 'none' | 'flexural' | 'cracked';
}

type Point = { x: number; y: number };

function concreteOutline(shape: RcParams['concrete']): Point[] {
  // y = 0 at top, y = h at bottom (down positive), x = 0 at left corner of compression face
  if (shape.kind === 'rectangular') {
    const { b, h } = shape;
    return [
      { x: 0, y: 0 },
      { x: b, y: 0 },
      { x: b, y: h },
      { x: 0, y: h },
    ];
  }
  // T-beam: flange on top (width bf), web below (width bw), centered
  const { bw, bf, hf, h } = shape;
  const cx = bf / 2;
  const xfL = 0;
  const xfR = bf;
  const xwL = cx - bw / 2;
  const xwR = cx + bw / 2;
  return [
    { x: xfL, y: 0 },
    { x: xfR, y: 0 },
    { x: xfR, y: hf },
    { x: xwR, y: hf },
    { x: xwR, y: h },
    { x: xwL, y: h },
    { x: xwL, y: hf },
    { x: xfL, y: hf },
  ];
}

function rebarCenterX(shape: RcParams['concrete']): number {
  if (shape.kind === 'rectangular') return shape.b / 2;
  return shape.bf / 2;
}

function barDistributeX(shape: RcParams['concrete'], count: number, cover = 40) {
  const cx = rebarCenterX(shape);
  const availableWidth =
    shape.kind === 'rectangular'
      ? shape.b - 2 * cover
      : shape.bw - 2 * cover; // use web width even for top flange — conservative
  if (count <= 1) return [cx];
  const spacing = availableWidth / (count - 1);
  const x0 = cx - availableWidth / 2;
  return Array.from({ length: count }, (_, i) => x0 + i * spacing);
}

export function RcCanvas({ params, results, unitSystem, overlay = 'flexural' }: Props) {
  const outline = useMemo(() => concreteOutline(params.concrete), [params.concrete]);

  const { h } = params.concrete;
  const w = params.concrete.kind === 'rectangular' ? params.concrete.b : params.concrete.bf;

  const { viewBox, pad } = useMemo(() => {
    const size = Math.max(w, h, 1);
    const p = size * 0.15;
    return {
      viewBox: `${-p} ${-p} ${w + 2 * p} ${h + 2 * p}`,
      pad: p,
    };
  }, [w, h]);

  const strokeW = Math.max(w, h) * 0.004;
  const fontSize = Math.max(w, h) * 0.028;
  const dimOffset = Math.max(w, h) * 0.06;

  const naDepth =
    overlay === 'flexural'
      ? results.flexural.c
      : overlay === 'cracked'
      ? results.cracked?.kd ?? null
      : null;

  const pathD = outline
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ') + ' Z';

  return (
    <div className="rc-canvas">
      <svg
        viewBox={viewBox}
        xmlns="http://www.w3.org/2000/svg"
        className="rc-canvas__svg"
        role="img"
        aria-label="Reinforced concrete section"
      >
        {/* Compression zone shading (above NA) */}
        {naDepth !== null && naDepth > 0 && (
          <defs>
            <clipPath id="compression-zone">
              <rect x={-pad} y={-pad} width={w + 2 * pad} height={naDepth + pad} />
            </clipPath>
          </defs>
        )}

        {/* Concrete outline */}
        <path
          d={pathD}
          fill="rgba(140, 140, 140, 0.15)"
          stroke="#3c4858"
          strokeWidth={strokeW}
          strokeLinejoin="round"
        />

        {/* Compressive zone overlay */}
        {naDepth !== null && naDepth > 0 && (
          <path
            d={pathD}
            fill="rgba(56, 128, 255, 0.18)"
            clipPath="url(#compression-zone)"
          />
        )}

        {/* Neutral axis line */}
        {naDepth !== null && naDepth > 0 && naDepth < h && (
          <>
            <line
              x1={-pad * 0.5}
              x2={w + pad * 0.5}
              y1={naDepth}
              y2={naDepth}
              stroke="#d63a3a"
              strokeWidth={strokeW * 1.5}
              strokeDasharray={`${strokeW * 4} ${strokeW * 4}`}
            />
            <text
              x={w + pad * 0.55}
              y={naDepth}
              fontSize={fontSize}
              fill="#d63a3a"
              dominantBaseline="middle"
              textAnchor="start"
            >
              c = {formatValue(naDepth, 'dimension', unitSystem, 1)}{' '}
              {unitLabel('dimension', unitSystem)}
            </text>
          </>
        )}

        {/* Rebar markers */}
        {params.layers.map((L) => {
          const bar = inferBar(L);
          const xs = barDistributeX(params.concrete, L.count);
          return (
            <g key={L.id} data-layer={L.id}>
              {xs.map((x, i) => (
                <circle
                  key={i}
                  cx={x}
                  cy={L.depth}
                  r={Math.max(bar.diameter / 2, strokeW * 2)}
                  fill="#1a1a1a"
                  stroke="#555"
                  strokeWidth={strokeW * 0.5}
                />
              ))}
              {/* Layer label to the left */}
              <text
                x={-pad * 0.5}
                y={L.depth}
                fontSize={fontSize * 0.85}
                fill="#555"
                dominantBaseline="middle"
                textAnchor="end"
              >
                {L.label ?? L.id}
              </text>
            </g>
          );
        })}

        {/* Dim lines: width and height */}
        <g className="rc-canvas__dims" opacity="0.65">
          {/* width dim (below) */}
          <line
            x1={0}
            x2={w}
            y1={h + dimOffset}
            y2={h + dimOffset}
            stroke="#888"
            strokeWidth={strokeW * 0.8}
          />
          <line
            x1={0}
            x2={0}
            y1={h}
            y2={h + dimOffset + strokeW * 3}
            stroke="#888"
            strokeWidth={strokeW * 0.5}
          />
          <line
            x1={w}
            x2={w}
            y1={h}
            y2={h + dimOffset + strokeW * 3}
            stroke="#888"
            strokeWidth={strokeW * 0.5}
          />
          <text
            x={w / 2}
            y={h + dimOffset + fontSize * 0.8}
            fontSize={fontSize}
            fill="#555"
            textAnchor="middle"
          >
            {formatValue(w, 'dimension', unitSystem, 1)} {unitLabel('dimension', unitSystem)}
          </text>

          {/* height dim (left) */}
          <line
            x1={-dimOffset}
            x2={-dimOffset}
            y1={0}
            y2={h}
            stroke="#888"
            strokeWidth={strokeW * 0.8}
          />
          <text
            x={-dimOffset - fontSize * 0.3}
            y={h / 2}
            fontSize={fontSize}
            fill="#555"
            textAnchor="end"
            dominantBaseline="middle"
            transform={`rotate(-90 ${-dimOffset - fontSize * 0.3} ${h / 2})`}
          >
            {formatValue(h, 'dimension', unitSystem, 1)} {unitLabel('dimension', unitSystem)}
          </text>
        </g>
      </svg>
    </div>
  );
}

function inferBar(L: { area: number; count: number }) {
  const areaPer = L.count > 0 ? L.area / L.count : 510;
  // Approx diameter = sqrt(4·A/π)
  const diameter = Math.sqrt((4 * areaPer) / Math.PI);
  return { diameter, area: areaPer };
}

export { findBar };
