'use client';

import React, { useMemo } from 'react';
import type { SectionProperties, Point2D } from '@/lib/section/types';
import { formatValue, unitLabel, type UnitSystem } from '@/lib/beam/units';

interface Props {
  props: SectionProperties;
  M?: number; // applied moment in SI (N·mm) for heatmap
  showHeatmap?: boolean;
  showCentroid?: boolean;
  showAxes?: boolean;
  unitSystem: UnitSystem;
  onVertexClick?: (idx: number) => void;
  activeVertex?: number | null;
}

export function SectionCanvas({
  props,
  M = 0,
  showHeatmap = false,
  showCentroid = true,
  showAxes = true,
  unitSystem,
  onVertexClick,
  activeVertex,
}: Props) {
  const { outline, xbar, ybar, xMin, xMax, yMin, yMax, Ix } = props;

  const { viewBox, scale, padding, stressMax, stressMin } = useMemo(() => {
    const w = xMax - xMin;
    const h = yMax - yMin;
    const size = Math.max(w, h, 1);
    const pad = size * 0.2;
    const vx = xMin - pad;
    const vy = -(yMax + pad);
    const vw = w + 2 * pad;
    const vh = h + 2 * pad;
    const viewBox = `${vx} ${vy} ${vw} ${vh}`;
    const scale = 1;

    // Stress range (MPa) on top and bottom fibers.
    // M here arrives in SI canonical kN·m. Convert to N·mm (×1e6) before σ = M·y/Ix
    // so that y(mm) / Ix(mm⁴) yields σ in N/mm² = MPa.
    const Mnmm = M * 1_000_000;
    let sMax = 0,
      sMin = 0;
    if (showHeatmap && Ix > 0 && Mnmm !== 0) {
      sMax = (Mnmm * (yMax - ybar)) / Ix;
      sMin = (Mnmm * (yMin - ybar)) / Ix;
    }
    return { viewBox, scale, padding: pad, stressMax: sMax, stressMin: sMin };
  }, [xMin, xMax, yMin, yMax, showHeatmap, M, ybar, Ix]);

  const pathD = pointsToPath(outline);
  const stressExtreme = Math.max(Math.abs(stressMax), Math.abs(stressMin), 1e-9);
  const gradientId = 'sb-stress-gradient';

  return (
    <div className="section-canvas">
      <svg
        className="section-canvas__svg"
        viewBox={viewBox}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Section geometry"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0" gradientUnits="userSpaceOnUse">
            {/* Map outline y-range to 0..1 */}
            <stop offset="0" stopColor={stressToColor(stressMin, stressExtreme)} />
            <stop offset="0.5" stopColor={stressToColor(0, stressExtreme)} />
            <stop offset="1" stopColor={stressToColor(stressMax, stressExtreme)} />
          </linearGradient>
        </defs>

        {/* Y-axis flip: draw in math coords (Y up) */}
        <g transform={`scale(${scale}, -${scale})`}>
          {/* Grid */}
          <GridLines xMin={xMin} xMax={xMax} yMin={yMin} yMax={yMax} padding={padding} />

          {/* Outline */}
          <path
            d={pathD}
            fill={showHeatmap && Math.abs(M) > 0 ? `url(#${gradientId})` : 'rgba(var(--color-accent-rgb, 6,121,158), 0.15)'}
            stroke="var(--color-accent)"
            strokeWidth={Math.max((xMax - xMin) * 0.003, 0.5)}
            vectorEffect="non-scaling-stroke"
          />

          {/* Axes (centroidal) */}
          {showAxes && (
            <>
              <line
                x1={xMin - padding * 0.4}
                y1={ybar}
                x2={xMax + padding * 0.4}
                y2={ybar}
                stroke="#c09a3d"
                strokeWidth={0.8}
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={xbar}
                y1={yMin - padding * 0.4}
                x2={xbar}
                y2={yMax + padding * 0.4}
                stroke="#c09a3d"
                strokeWidth={0.8}
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}

          {/* Centroid marker */}
          {showCentroid && (
            <g>
              <circle cx={xbar} cy={ybar} r={Math.max((xMax - xMin) * 0.015, 2)} fill="#c09a3d" />
              <circle cx={xbar} cy={ybar} r={Math.max((xMax - xMin) * 0.008, 1)} fill="#fff" />
            </g>
          )}

          {/* Vertex handles for polygon editor */}
          {onVertexClick &&
            outline.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={Math.max((xMax - xMin) * 0.02, 3)}
                fill={activeVertex === i ? 'var(--color-accent)' : '#fff'}
                stroke="var(--color-accent)"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                style={{ cursor: 'pointer' }}
                onClick={() => onVertexClick(i)}
              />
            ))}
        </g>
      </svg>

      {showHeatmap && Math.abs(M) > 0 && (
        <div className="section-canvas__legend">
          <div className="section-canvas__legend-title">Bending stress σ (MPa)</div>
          <div className="section-canvas__legend-bar">
            <div className="section-canvas__legend-bar-fill" />
          </div>
          <div className="section-canvas__legend-scale">
            <span>{stressMin.toFixed(1)}</span>
            <span>0</span>
            <span>+{stressMax.toFixed(1)}</span>
          </div>
        </div>
      )}

      <div className="section-canvas__meta">
        <span>
          A = {formatValue(props.A, 'A', unitSystem, 2)} {unitLabel('A', unitSystem)}
        </span>
        <span>
          Ix = {formatValue(props.Ix, 'I', unitSystem, 2)} {unitLabel('I', unitSystem)}
        </span>
        {props.Zx > 0 && (
          <span>
            Zx = {formatValue(props.Zx, 'sectionModulus', unitSystem, 2)}{' '}
            {unitLabel('sectionModulus', unitSystem)}
          </span>
        )}
      </div>
    </div>
  );
}

function pointsToPath(pts: Point2D[]): string {
  if (pts.length === 0) return '';
  const parts = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`);
  parts.push('Z');
  return parts.join(' ');
}

function stressToColor(sigma: number, sigmaMax: number): string {
  if (sigmaMax <= 0) return '#e6e6e6';
  const t = Math.max(-1, Math.min(1, sigma / sigmaMax));
  if (t > 0) {
    // Tension → red
    const a = t;
    const r = Math.round(232 - (232 - 219) * a);
    const g = Math.round(232 - (232 - 70) * a);
    const b = Math.round(232 - (232 - 70) * a);
    return `rgb(${r},${g},${b})`;
  } else {
    // Compression → blue
    const a = -t;
    const r = Math.round(232 - (232 - 40) * a);
    const g = Math.round(232 - (232 - 80) * a);
    const b = Math.round(232 - (232 - 180) * a);
    return `rgb(${r},${g},${b})`;
  }
}

function GridLines({
  xMin,
  xMax,
  yMin,
  yMax,
  padding,
}: {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  padding: number;
}) {
  const w = xMax - xMin;
  const h = yMax - yMin;
  const step = niceStep(Math.max(w, h));
  const lines: React.ReactElement[] = [];
  for (let x = Math.ceil((xMin - padding) / step) * step; x <= xMax + padding; x += step) {
    lines.push(
      <line
        key={`vx${x}`}
        x1={x}
        y1={yMin - padding}
        x2={x}
        y2={yMax + padding}
        stroke="rgba(0,0,0,0.05)"
        strokeWidth={0.3}
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  for (let y = Math.ceil((yMin - padding) / step) * step; y <= yMax + padding; y += step) {
    lines.push(
      <line
        key={`hy${y}`}
        x1={xMin - padding}
        y1={y}
        x2={xMax + padding}
        y2={y}
        stroke="rgba(0,0,0,0.05)"
        strokeWidth={0.3}
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  return <>{lines}</>;
}

function niceStep(range: number): number {
  const raw = range / 8;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const snap = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return snap * mag;
}
