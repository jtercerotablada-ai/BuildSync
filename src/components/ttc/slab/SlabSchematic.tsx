'use client';

import React from 'react';
import type { SlabInput, EdgeCondition, PunchingInput } from '@/lib/slab/types';

interface Props {
  input: SlabInput;
}

/**
 * Top-down plan view of the slab panel showing edges (free/simple/fixed) and an
 * optional column at the centre when punching shear input is provided.
 */
export function SlabSchematic({ input }: Props) {
  const { Lx, Ly, h } = input.geometry;
  const e = input.edges;
  const W = 1000, H = 540;
  const margin = 90;

  // Aspect-fit panel rectangle into viewBox
  const drawW = W - 2 * margin;
  const drawH = H - 2 * margin - 40;        // leave bottom space for x-dimension
  const ratio = Lx / Ly;
  const fitRatio = drawW / drawH;
  let pxW: number, pxH: number;
  if (ratio >= fitRatio) {
    pxW = drawW; pxH = pxW / ratio;
  } else {
    pxH = drawH; pxW = pxH * ratio;
  }
  const cx = W / 2;
  const cy = (margin + drawH / 2);
  const x0 = cx - pxW / 2;
  const y0 = cy - pxH / 2;
  const x1 = x0 + pxW;
  const y1 = y0 + pxH;

  return (
    <div className="ab-schematic">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img"
        aria-label="Slab plan view schematic">
        <defs>
          <pattern id="slab-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(201,168,76,0.05)" strokeWidth="1" />
          </pattern>
          <pattern id="slab-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(201,168,76,0.55)" strokeWidth="1.4" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#slab-grid)" />

        {/* Slab plate */}
        <rect x={x0} y={y0} width={pxW} height={pxH}
          fill="rgba(201,168,76,0.10)" stroke="#c9a84c" strokeWidth="2" />

        {/* Edge symbols */}
        <EdgeSymbol edge={e.left}   side="left"   x={x0} y={y0} pxW={pxW} pxH={pxH} />
        <EdgeSymbol edge={e.right}  side="right"  x={x0} y={y0} pxW={pxW} pxH={pxH} />
        <EdgeSymbol edge={e.top}    side="top"    x={x0} y={y0} pxW={pxW} pxH={pxH} />
        <EdgeSymbol edge={e.bottom} side="bottom" x={x0} y={y0} pxW={pxW} pxH={pxH} />

        {/* Optional column dot */}
        {input.punching && (
          <ColumnSymbol p={input.punching}
            cx={(x0 + x1) / 2} cy={(y0 + y1) / 2}
            pxW={pxW} pxH={pxH} Lx={Lx} Ly={Ly} />
        )}

        {/* Direction arrow N/S/E/W */}
        <g transform={`translate(${margin - 20}, ${margin - 20})`}>
          <text className="ab-svg-small" fill="rgba(255,255,255,0.5)">+y ↑</text>
        </g>
        <g transform={`translate(${W - margin + 20}, ${margin - 20})`}>
          <text className="ab-svg-small" fill="rgba(255,255,255,0.5)" textAnchor="end">+x →</text>
        </g>

        {/* Lx dimension (bottom) */}
        <line x1={x0} y1={y1 + 28} x2={x1} y2={y1 + 28} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        <line x1={x0} y1={y1 + 22} x2={x0} y2={y1 + 34} stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
        <line x1={x1} y1={y1 + 22} x2={x1} y2={y1 + 34} stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
        <text x={(x0 + x1) / 2} y={y1 + 50} textAnchor="middle"
          fill="rgba(255,255,255,0.7)" className="ab-svg-dim">
          {`Lx = ${Lx.toFixed(2)} m`}
        </text>

        {/* Ly dimension (right side) */}
        <line x1={x1 + 30} y1={y0} x2={x1 + 30} y2={y1} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        <line x1={x1 + 24} y1={y0} x2={x1 + 36} y2={y0} stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
        <line x1={x1 + 24} y1={y1} x2={x1 + 36} y2={y1} stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
        <text x={x1 + 38} y={(y0 + y1) / 2 + 4}
          fill="rgba(255,255,255,0.7)" className="ab-svg-dim"
          transform={`rotate(90, ${x1 + 38}, ${(y0 + y1) / 2 + 4})`}>
          {`Ly = ${Ly.toFixed(2)} m`}
        </text>

        {/* h annotation */}
        <text x={cx} y={cy} textAnchor="middle" fill="rgba(201,168,76,0.55)"
          className="ab-svg-load">{`h = ${h} mm`}</text>
      </svg>
    </div>
  );
}

function EdgeSymbol({ edge, side, x, y, pxW, pxH }:
  { edge: EdgeCondition; side: 'left' | 'right' | 'top' | 'bottom'; x: number; y: number; pxW: number; pxH: number }) {
  const gold = '#c9a84c';
  const off = 14;        // offset from slab edge for hatch / labels
  let lineProps: { x1: number; y1: number; x2: number; y2: number };
  let labelXY: [number, number] = [0, 0];
  let textAnchor: 'start' | 'middle' | 'end' = 'middle';

  if (side === 'left')   { lineProps = { x1: x, y1: y, x2: x, y2: y + pxH }; labelXY = [x - off - 18, y + pxH / 2]; textAnchor = 'end'; }
  else if (side === 'right') { lineProps = { x1: x + pxW, y1: y, x2: x + pxW, y2: y + pxH }; labelXY = [x + pxW + off + 18, y + pxH / 2]; textAnchor = 'start'; }
  else if (side === 'top') { lineProps = { x1: x, y1: y, x2: x + pxW, y2: y }; labelXY = [x + pxW / 2, y - off - 6]; }
  else                     { lineProps = { x1: x, y1: y + pxH, x2: x + pxW, y2: y + pxH }; labelXY = [x + pxW / 2, y + pxH + off + 14]; }

  // Hatch outside the panel for fixed support
  let hatch: React.ReactElement | null = null;
  if (edge === 'fixed') {
    const t = 12;
    if (side === 'left')   hatch = <rect x={x - t} y={y} width={t} height={pxH} fill="url(#slab-hatch)" />;
    if (side === 'right')  hatch = <rect x={x + pxW} y={y} width={t} height={pxH} fill="url(#slab-hatch)" />;
    if (side === 'top')    hatch = <rect x={x} y={y - t} width={pxW} height={t} fill="url(#slab-hatch)" />;
    if (side === 'bottom') hatch = <rect x={x} y={y + pxH} width={pxW} height={t} fill="url(#slab-hatch)" />;
  }

  // Stroke style: free = thin dashed grey, simple = solid gold, fixed = double
  let strokeColor = gold;
  let strokeWidth = 2;
  let strokeDash: string | undefined;
  if (edge === 'free')   { strokeColor = 'rgba(255,255,255,0.25)'; strokeWidth = 1.5; strokeDash = '5 4'; }
  if (edge === 'fixed')  { strokeWidth = 3; }

  // Draw a small "tick" series for SS (rollers) along the edge for visual cue
  const ssTicks: React.ReactElement[] = [];
  if (edge === 'simple') {
    const N = 6;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      let cx = 0, cy = 0;
      if (side === 'top')    { cx = x + pxW * t; cy = y - 6; }
      if (side === 'bottom') { cx = x + pxW * t; cy = y + pxH + 6; }
      if (side === 'left')   { cx = x - 6; cy = y + pxH * t; }
      if (side === 'right')  { cx = x + pxW + 6; cy = y + pxH * t; }
      ssTicks.push(<circle key={`tick-${side}-${i}`} cx={cx} cy={cy} r="2.5" fill={gold} />);
    }
  }

  const labelText = edge === 'fixed' ? 'Fixed' : edge === 'simple' ? 'Simply supp.' : 'Free';

  return (
    <g>
      {hatch}
      <line {...lineProps} stroke={strokeColor} strokeWidth={strokeWidth}
        strokeDasharray={strokeDash} />
      {ssTicks}
      <text x={labelXY[0]} y={labelXY[1]} textAnchor={textAnchor}
        fill={edge === 'free' ? 'rgba(255,255,255,0.5)' : gold}
        className="ab-svg-load">{labelText}</text>
    </g>
  );
}

function ColumnSymbol({ p, cx, cy, pxW, pxH, Lx, Ly }:
  { p: PunchingInput; cx: number; cy: number; pxW: number; pxH: number; Lx: number; Ly: number }) {
  // Scale column relative to panel size
  const c1 = (p.c1 / 1000) / Lx * pxW;
  const c2 = (p.c2 ?? p.c1) / 1000 / Ly * pxH;
  const w = Math.max(8, c1);
  const h = Math.max(8, c2);
  return (
    <g>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h}
        fill="rgba(201,168,76,0.55)" stroke="#c9a84c" strokeWidth="1.5" />
      <text x={cx} y={cy + h / 2 + 18} textAnchor="middle"
        fill="#c9a84c" className="ab-svg-load">
        {`${p.c1}×${p.c2 ?? p.c1} mm column · Vu=${p.Vu} kN`}
      </text>
    </g>
  );
}
