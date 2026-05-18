'use client';

import React, { useMemo, useState } from 'react';
import { buildContours, colorFor, type ContourField } from '@/lib/slab/contour';
import type { SlabAnalysis } from '@/lib/slab/types';

interface Props {
  result: SlabAnalysis;
}

type FieldKey = 'Mx' | 'My' | 'Asx' | 'Asy';

export function SlabContour({ result }: Props) {
  const contours = useMemo(() => buildContours(result), [result]);
  const [active, setActive] = useState<FieldKey>('Mx');

  if (!result.solved) return null;
  const field = contours[active];
  const isSigned = active === 'Mx' || active === 'My';

  return (
    <div className="slab-contour">
      <div className="slab-contour__tabs">
        {(['Mx', 'My', 'Asx', 'Asy'] as const).map((k) => (
          <button key={k} type="button"
            className={`slab-contour__tab ${k === active ? 'slab-contour__tab--active' : ''}`}
            onClick={() => setActive(k)}>
            {contours[k].label}
          </button>
        ))}
      </div>
      <ContourSVG field={field} signed={isSigned} />
      <Legend field={field} signed={isSigned} />
    </div>
  );
}

function ContourSVG({ field, signed }: { field: ContourField; signed: boolean }) {
  const W = 800, H = 500;
  const margin = 40;
  const drawW = W - 2 * margin;
  const drawH = H - 2 * margin - 30;
  const Lx = field.xs[field.xs.length - 1];
  const Ly = field.ys[field.ys.length - 1];
  const ratio = Lx / Ly;
  const fitRatio = drawW / drawH;
  let pxW: number, pxH: number;
  if (ratio >= fitRatio) { pxW = drawW; pxH = pxW / ratio; }
  else                   { pxH = drawH; pxW = pxH * ratio; }
  const x0 = (W - pxW) / 2;
  const y0 = margin;

  const nx = field.xs.length;
  const ny = field.ys.length;
  // Use 1-cell shifted positions for cell-centred rendering
  const dx = pxW / (nx - 1);
  const dy = pxH / (ny - 1);

  // Build cells
  const cells: React.ReactElement[] = [];
  for (let i = 0; i < nx - 1; i++) {
    for (let j = 0; j < ny - 1; j++) {
      // average value at cell corners
      const v = 0.25 * (field.values[i][j] + field.values[i + 1][j] + field.values[i][j + 1] + field.values[i + 1][j + 1]);
      const color = colorFor(v, field.vmin, field.vmax, signed);
      // Note: SVG y grows downward, but our y axis grows upward; flip j → ny-2-j
      const py = y0 + pxH - (j + 1) * dy;
      const px = x0 + i * dx;
      cells.push(
        <rect key={`c-${i}-${j}`} x={px} y={py} width={dx + 0.6} height={dy + 0.6} fill={color} stroke="none" />,
      );
    }
  }

  // Find peak location to annotate
  let vMaxAbs = 0; let iMax = 0; let jMax = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    if (Math.abs(field.values[i][j]) > vMaxAbs) {
      vMaxAbs = Math.abs(field.values[i][j]); iMax = i; jMax = j;
    }
  }
  const peakX = x0 + iMax * dx;
  const peakY = y0 + pxH - jMax * dy;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
      role="img" aria-label={`Contour plot of ${field.label}`}>
      {cells}
      {/* Border */}
      <rect x={x0} y={y0} width={pxW} height={pxH} fill="none" stroke="#c9a84c" strokeWidth="2" />
      {/* Peak marker */}
      <circle cx={peakX} cy={peakY} r="5" fill="none" stroke="#fff" strokeWidth="2" />
      <text x={peakX + 9} y={peakY - 6} fill="#fff" className="ab-svg-load">
        {`peak ${field.values[iMax][jMax].toFixed(field.unit.includes('mm') ? 0 : 2)} ${field.unit}`}
      </text>
      {/* Axes */}
      <text x={x0 + pxW / 2} y={y0 + pxH + 22} textAnchor="middle"
        fill="rgba(255,255,255,0.65)" className="ab-svg-dim">{`Lx = ${Lx.toFixed(2)} m`}</text>
      <text x={x0 - 12} y={y0 + pxH / 2 + 4} textAnchor="end"
        fill="rgba(255,255,255,0.65)" className="ab-svg-dim"
        transform={`rotate(-90, ${x0 - 12}, ${y0 + pxH / 2 + 4})`}>{`Ly = ${Ly.toFixed(2)} m`}</text>
    </svg>
  );
}

function Legend({ field, signed }: { field: ContourField; signed: boolean }) {
  const stops = 11;
  const steps: { v: number; color: string }[] = [];
  if (signed) {
    const span = Math.max(Math.abs(field.vmin), Math.abs(field.vmax));
    for (let i = 0; i < stops; i++) {
      const t = -1 + (2 * i) / (stops - 1);
      const v = t * span;
      steps.push({ v, color: colorFor(v, -span, span, true) });
    }
  } else {
    for (let i = 0; i < stops; i++) {
      const v = field.vmin + (i / (stops - 1)) * (field.vmax - field.vmin);
      steps.push({ v, color: colorFor(v, field.vmin, field.vmax, false) });
    }
  }
  return (
    <div className="slab-contour__legend">
      {steps.map((s, i) => (
        <div className="slab-contour__legend-cell" key={i}
          style={{ background: s.color }} title={`${s.v.toFixed(2)} ${field.unit}`}>
          {(i === 0 || i === stops - 1 || i === Math.floor(stops / 2))
            ? <span>{s.v.toFixed(field.unit.includes('mm') ? 0 : 1)}</span>
            : null}
        </div>
      ))}
    </div>
  );
}
