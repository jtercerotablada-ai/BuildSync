'use client';

import React, { useMemo } from 'react';
import type { SectionProperties, Point2D } from '@/lib/section/types';
import { formatValue, unitLabel, type UnitSystem } from '@/lib/beam/units';

export type HeatmapMode = 'off' | 'sigma' | 'tau';

interface Props {
  props: SectionProperties;
  M?: number; // applied moment in SI (kN·m) for σ heatmap
  V?: number; // applied shear in SI (kN) for τ heatmap
  heatmapMode?: HeatmapMode;
  showCentroid?: boolean;
  showAxes?: boolean;
  showShearCenter?: boolean;
  unitSystem: UnitSystem;
  onVertexClick?: (idx: number) => void;
  activeVertex?: number | null;
}

export function SectionCanvas({
  props,
  M = 0,
  V = 0,
  heatmapMode = 'off',
  showCentroid = true,
  showAxes = true,
  showShearCenter = true,
  unitSystem,
  onVertexClick,
  activeVertex,
}: Props) {
  const {
    outline,
    subShapes,
    xbar,
    ybar,
    xMin,
    xMax,
    yMin,
    yMax,
    Ix,
    Qx_max,
    shearCenterX,
    shearCenterY,
  } = props;

  const { viewBox, padding, stressMax, stressMin, tauMax, tNA, naOffset } = useMemo(() => {
    const w = xMax - xMin;
    const h = yMax - yMin;
    const size = Math.max(w, h, 1);
    const pad = size * 0.2;
    const vx = xMin - pad;
    const vy = -(yMax + pad);
    const vw = w + 2 * pad;
    const vh = h + 2 * pad;
    const viewBox = `${vx} ${vy} ${vw} ${vh}`;

    // Bending stress σ (MPa) on extreme fibers.
    // M is in SI (kN·m). Convert to N·mm by ×1e6; then σ = M·y/Ix gives N/mm² = MPa.
    let sMax = 0;
    let sMin = 0;
    if (heatmapMode === 'sigma' && Ix > 0 && M !== 0) {
      const Mnmm = M * 1_000_000;
      sMax = (Mnmm * (yMax - ybar)) / Ix;
      sMin = (Mnmm * (yMin - ybar)) / Ix;
    }

    // Transverse shear stress τ_max (MPa) at neutral axis.
    // V is in SI kN; convert to N by ×1000. τ = V·Q/(I·t) where t is the outline width at y=ybar.
    // For composites: t = Σ add-widths − Σ subtract-widths across sub-shapes.
    let tMax = 0;
    const tNaNumeric = subShapes && subShapes.length > 0
      ? subShapes.reduce(
          (sum, s) => sum + (s.op === 'add' ? 1 : -1) * thicknessAt(s.outline, ybar),
          0
        )
      : thicknessAt(outline, ybar);
    if (heatmapMode === 'tau' && Ix > 0 && V !== 0 && tNaNumeric > 0 && Qx_max > 0) {
      tMax = (V * 1000 * Qx_max) / (Ix * tNaNumeric);
    }

    // Position of the neutral axis within the bbox, as a gradient offset [0..1].
    // Gradient y-axis in userSpaceOnUse spans from yMin (offset 0) to yMax (offset 1) in user math coords.
    const naOff = h > 0 ? (ybar - yMin) / h : 0.5;

    return {
      viewBox,
      padding: pad,
      stressMax: sMax,
      stressMin: sMin,
      tauMax: tMax,
      tNA: tNaNumeric,
      naOffset: naOff,
    };
  }, [xMin, xMax, yMin, yMax, heatmapMode, M, V, ybar, Ix, Qx_max, outline, subShapes]);

  const pathD = pointsToPath(outline);
  const stressExtreme = Math.max(Math.abs(stressMax), Math.abs(stressMin), 1e-9);
  const tauExtreme = Math.max(Math.abs(tauMax), 1e-9);
  const sigmaGradId = 'sb-sigma-gradient';
  const tauGradId = 'sb-tau-gradient';
  const subtractHatchId = 'sb-subtract-hatch';

  const activeFill =
    heatmapMode === 'sigma' && Math.abs(M) > 0
      ? `url(#${sigmaGradId})`
      : heatmapMode === 'tau' && Math.abs(V) > 0 && Qx_max > 0
        ? `url(#${tauGradId})`
        : 'rgba(201,168,76,0.15)';

  const strokeWidth = Math.max((xMax - xMin) * 0.003, 0.5);

  // Shear center shown only if distinct from centroid (within 1% of bbox max).
  const size = Math.max(xMax - xMin, yMax - yMin, 1);
  const scIsOffset =
    Math.abs(shearCenterX - xbar) > size * 0.01 ||
    Math.abs(shearCenterY - ybar) > size * 0.01;

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
          {/* Bending gradient: bottom fiber → top fiber along the math-y axis.
              userSpaceOnUse + transform-aware: gradient spans [yMin..yMax] in user coords. */}
          <linearGradient
            id={sigmaGradId}
            x1={xMin}
            y1={yMin}
            x2={xMin}
            y2={yMax}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor={sigmaColor(stressMin, stressExtreme)} />
            <stop offset={naOffset.toFixed(4)} stopColor={sigmaColor(0, stressExtreme)} />
            <stop offset="1" stopColor={sigmaColor(stressMax, stressExtreme)} />
          </linearGradient>

          {/* Shear gradient: zero at both top & bottom fibers, max at the neutral axis.
              Approximates the parabolic τ(y) distribution (exact for rectangles). */}
          <linearGradient
            id={tauGradId}
            x1={xMin}
            y1={yMin}
            x2={xMin}
            y2={yMax}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor={tauColor(0, tauExtreme)} />
            <stop offset={(naOffset * 0.5).toFixed(4)} stopColor={tauColor(tauMax * 0.75, tauExtreme)} />
            <stop offset={naOffset.toFixed(4)} stopColor={tauColor(tauMax, tauExtreme)} />
            <stop offset={((naOffset + 1) * 0.5).toFixed(4)} stopColor={tauColor(tauMax * 0.75, tauExtreme)} />
            <stop offset="1" stopColor={tauColor(0, tauExtreme)} />
          </linearGradient>

          {/* Crosshatch pattern to indicate 'subtract' operands in composites */}
          <pattern
            id={subtractHatchId}
            patternUnits="userSpaceOnUse"
            width={Math.max((xMax - xMin) * 0.02, 6)}
            height={Math.max((xMax - xMin) * 0.02, 6)}
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2={Math.max((xMax - xMin) * 0.02, 6)}
              stroke="#b0323b"
              strokeWidth={Math.max((xMax - xMin) * 0.005, 1)}
              vectorEffect="non-scaling-stroke"
            />
          </pattern>
        </defs>

        {/* Y-axis flip: draw in math coords (Y up) */}
        <g transform="scale(1, -1)">
          <GridLines xMin={xMin} xMax={xMax} yMin={yMin} yMax={yMax} padding={padding} />

          {subShapes && subShapes.length > 0 ? (
            <g>
              {subShapes.map((s, i) => (
                <path
                  key={`sub-${i}`}
                  d={pointsToPath(s.outline)}
                  fill={s.op === 'subtract' ? `url(#${subtractHatchId})` : activeFill}
                  stroke={s.op === 'subtract' ? '#b0323b' : 'var(--color-accent)'}
                  strokeWidth={strokeWidth}
                  strokeDasharray={s.op === 'subtract' ? '4 3' : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          ) : (
            <path
              d={pathD}
              fill={activeFill}
              stroke="var(--color-accent)"
              strokeWidth={strokeWidth}
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Centroidal axes (gold dashed) */}
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

          {/* Centroid marker (filled gold) */}
          {showCentroid && (
            <g>
              <circle cx={xbar} cy={ybar} r={Math.max(size * 0.015, 2)} fill="#c09a3d" />
              <circle cx={xbar} cy={ybar} r={Math.max(size * 0.008, 1)} fill="#fff" />
            </g>
          )}

          {/* Shear-center marker (open teal ring) — drawn only when offset from centroid */}
          {showShearCenter && scIsOffset && (
            <g>
              <circle
                cx={shearCenterX}
                cy={shearCenterY}
                r={Math.max(size * 0.018, 3)}
                fill="#fff"
                stroke="#10784c"
                strokeWidth={Math.max(size * 0.004, 1)}
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={shearCenterX} cy={shearCenterY} r={Math.max(size * 0.005, 1)} fill="#10784c" />
              {/* Dashed connector from centroid to shear-center */}
              <line
                x1={xbar}
                y1={ybar}
                x2={shearCenterX}
                y2={shearCenterY}
                stroke="#10784c"
                strokeWidth={0.6}
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )}

          {/* Polygon editor vertex handles */}
          {onVertexClick &&
            outline.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={Math.max(size * 0.02, 3)}
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

      {heatmapMode === 'sigma' && Math.abs(M) > 0 && (
        <div className="section-canvas__legend">
          <div className="section-canvas__legend-title">Bending stress σ (MPa)</div>
          <div
            className="section-canvas__legend-bar"
            style={{
              background: `linear-gradient(to right, ${sigmaColor(stressMin, stressExtreme)}, ${sigmaColor(0, stressExtreme)}, ${sigmaColor(stressMax, stressExtreme)})`,
            }}
          />
          <div className="section-canvas__legend-scale">
            <span>{stressMin.toFixed(1)}</span>
            <span>0</span>
            <span>+{stressMax.toFixed(1)}</span>
          </div>
        </div>
      )}

      {heatmapMode === 'tau' && Math.abs(V) > 0 && Qx_max > 0 && (
        <div className="section-canvas__legend">
          <div className="section-canvas__legend-title">
            Shear stress τ (MPa) — max {tauMax.toFixed(2)} at NA, t = {tNA.toFixed(1)} mm
          </div>
          <div
            className="section-canvas__legend-bar"
            style={{
              background: `linear-gradient(to right, ${tauColor(0, tauExtreme)}, ${tauColor(tauMax * 0.75, tauExtreme)}, ${tauColor(tauMax, tauExtreme)}, ${tauColor(tauMax * 0.75, tauExtreme)}, ${tauColor(0, tauExtreme)})`,
            }}
          />
          <div className="section-canvas__legend-scale">
            <span>0</span>
            <span>{(tauMax * 0.75).toFixed(2)}</span>
            <span>{tauMax.toFixed(2)}</span>
            <span>{(tauMax * 0.75).toFixed(2)}</span>
            <span>0</span>
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

// Width of a simple polygon outline at horizontal line y = cut.
// Sums the lengths of all horizontal "inside" spans (outline may be non-convex).
function thicknessAt(outline: Point2D[], y: number): number {
  if (outline.length < 3) return 0;
  const crossings: number[] = [];
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % n];
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
      const t = (y - a.y) / (b.y - a.y);
      crossings.push(a.x + t * (b.x - a.x));
    }
  }
  crossings.sort((c1, c2) => c1 - c2);
  let w = 0;
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    w += crossings[i + 1] - crossings[i];
  }
  return w;
}

// Bending-stress color: blue (compression) → gray (zero) → red (tension).
function sigmaColor(sigma: number, sigmaExtreme: number): string {
  if (sigmaExtreme <= 0) return '#e6e6e6';
  const t = Math.max(-1, Math.min(1, sigma / sigmaExtreme));
  if (t > 0) {
    const a = t;
    const r = Math.round(232 - (232 - 219) * a);
    const g = Math.round(232 - (232 - 70) * a);
    const b = Math.round(232 - (232 - 70) * a);
    return `rgb(${r},${g},${b})`;
  } else {
    const a = -t;
    const r = Math.round(232 - (232 - 40) * a);
    const g = Math.round(232 - (232 - 80) * a);
    const b = Math.round(232 - (232 - 180) * a);
    return `rgb(${r},${g},${b})`;
  }
}

// Shear-stress color: light gray (zero) → deep teal/green (max).
function tauColor(tau: number, tauExtreme: number): string {
  if (tauExtreme <= 0) return '#e6e6e6';
  const t = Math.max(0, Math.min(1, Math.abs(tau) / tauExtreme));
  const r = Math.round(232 - (232 - 16) * t);
  const g = Math.round(232 - (232 - 120) * t);
  const b = Math.round(232 - (232 - 76) * t);
  return `rgb(${r},${g},${b})`;
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
