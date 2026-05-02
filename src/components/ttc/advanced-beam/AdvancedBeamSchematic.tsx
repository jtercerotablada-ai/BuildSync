'use client';

import React, { useMemo } from 'react';
import type { BeamModel, Support, Load, Hinge } from '@/lib/advanced-beam/types';

interface Props {
  model: BeamModel;
  /** Maximum vertical deflection in mm to scale the deformed shape (optional). */
  maxDeflectionMm?: number;
  /** Optional deflection diagram for showing deformed shape. */
  deflection?: { x: number; value: number }[];
  /** Show deformed shape if true, undeformed otherwise. Default false. */
  showDeformed?: boolean;
}

/**
 * Schematic SVG of the beam: shows segments, supports, hinges and loads to scale.
 * Fully responsive (viewBox auto-scaled). Designed for dark backgrounds with TTC gold accents.
 */
export function AdvancedBeamSchematic({ model, deflection, showDeformed = false }: Props) {
  const L = model.totalLength || 1;
  const W = 1000;                             // SVG width units
  const beamY = 220;                          // baseline y in SVG
  const beamHeight = 14;                      // visual beam thickness
  const margin = 60;                          // left/right margin
  const drawW = W - 2 * margin;

  const x2px = (x: number) => margin + (x / L) * drawW;

  // Scale deformed shape so max |δ| occupies 28 px
  const defScale = useMemo(() => {
    if (!showDeformed || !deflection || deflection.length === 0) return 0;
    let m = 0;
    for (const p of deflection) m = Math.max(m, Math.abs(p.value));
    if (m === 0) return 0;
    return 28 / m;     // px per mm
  }, [showDeformed, deflection]);

  const beamPath = useMemo(() => {
    if (!showDeformed || !deflection || deflection.length === 0 || defScale === 0) {
      // straight rectangle
      return null;
    }
    const top: string[] = [];
    const bot: string[] = [];
    for (const p of deflection) {
      const px = x2px(p.x);
      // v positive UP means deflection up. Display: SVG y grows DOWN, so apply -dy.
      const dy = -p.value * defScale;
      top.push(`${px.toFixed(2)},${(beamY + dy - beamHeight / 2).toFixed(2)}`);
      bot.unshift(`${px.toFixed(2)},${(beamY + dy + beamHeight / 2).toFixed(2)}`);
    }
    return `M ${top.join(' L ')} L ${bot.join(' L ')} Z`;
  }, [showDeformed, deflection, defScale, x2px, beamY, beamHeight]);

  // Compute deflected y at a given x (for placing supports/loads on deformed beam)
  const deflectedY = (x: number) => {
    if (!showDeformed || defScale === 0 || !deflection) return beamY;
    // Find closest sample
    let lo = 0, hi = deflection.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (deflection[mid].x <= x) lo = mid; else hi = mid;
    }
    const x0 = deflection[lo].x, x1 = deflection[hi].x;
    if (x1 === x0) return beamY - deflection[lo].value * defScale;
    const t = (x - x0) / (x1 - x0);
    const dy = -((1 - t) * deflection[lo].value + t * deflection[hi].value) * defScale;
    return beamY + dy;
  };

  return (
    <div className="ab-schematic">
      <svg viewBox={`0 0 ${W} 320`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Beam schematic">
        {/* background grid */}
        <defs>
          <pattern id="ab-grid" width="40" height="20" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 20" fill="none" stroke="rgba(201,168,76,0.05)" strokeWidth="1" />
          </pattern>
          <pattern id="ab-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(201,168,76,0.65)" strokeWidth="1.4" />
          </pattern>
        </defs>
        <rect width={W} height="320" fill="url(#ab-grid)" />

        {/* x-axis line */}
        <line x1={margin} y1={beamY + 90} x2={W - margin} y2={beamY + 90} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />

        {/* beam body */}
        {beamPath ? (
          <path d={beamPath} fill="rgba(201,168,76,0.18)" stroke="#c9a84c" strokeWidth="2" />
        ) : (
          <rect x={margin} y={beamY - beamHeight / 2} width={drawW} height={beamHeight}
                fill="rgba(201,168,76,0.18)" stroke="#c9a84c" strokeWidth="2" />
        )}

        {/* segment dividers (if multi-segment) */}
        {model.segments.length > 1 &&
          model.segments.slice(0, -1).map((s) => (
            <line key={`segdiv-${s.id}`}
              x1={x2px(s.endPosition)} y1={beamY - beamHeight / 2 - 6}
              x2={x2px(s.endPosition)} y2={beamY + beamHeight / 2 + 6}
              stroke="#c9a84c" strokeWidth="1.4" strokeDasharray="3 3" opacity="0.7"
            />
          ))}

        {/* hinges */}
        {model.hinges.map((h) => {
          const cx = x2px(h.position);
          const cy = deflectedY(h.position);
          return (
            <g key={h.id}>
              <circle cx={cx} cy={cy} r="6" fill="#0a0a0a" stroke="#c9a84c" strokeWidth="2" />
              <text x={cx} y={cy - 14} textAnchor="middle" fill="#c9a84c"
                fontSize="11" fontFamily="var(--font-inter), sans-serif">hinge</text>
            </g>
          );
        })}

        {/* supports */}
        {model.supports.map((s) => (
          <SupportSymbol key={s.id} support={s} cx={x2px(s.position)} cy={deflectedY(s.position)} />
        ))}

        {/* loads — anchored to deformed beam top so arrows ride the curve */}
        {model.loads.map((ld) => (
          <LoadSymbol key={ld.id} load={ld} L={L} x2px={x2px}
            beamYAt={deflectedY} beamHeight={beamHeight} />
        ))}

        {/* dimension labels */}
        <line x1={margin} y1="295" x2={W - margin} y2="295" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        <line x1={margin} y1="291" x2={margin} y2="299" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        <line x1={W - margin} y1="291" x2={W - margin} y2="299" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        <text x={W / 2} y="312" textAnchor="middle" fill="rgba(255,255,255,0.6)"
          fontSize="12" fontFamily="var(--font-inter), sans-serif">
          {`L = ${L.toFixed(2)} m`}
        </text>
      </svg>
    </div>
  );
}

function SupportSymbol({ support, cx, cy }: { support: Support; cx: number; cy: number }) {
  const gold = '#c9a84c';
  switch (support.type) {
    case 'pin': {
      // Triangle below beam
      return (
        <g>
          <polygon points={`${cx},${cy + 8} ${cx - 14},${cy + 32} ${cx + 14},${cy + 32}`}
            fill="none" stroke={gold} strokeWidth="2" />
          <line x1={cx - 22} y1={cy + 38} x2={cx + 22} y2={cy + 38} stroke={gold} strokeWidth="2" />
          {/* hatch ground */}
          <rect x={cx - 22} y={cy + 38} width="44" height="6" fill="url(#ab-hatch)" />
          <text x={cx} y={cy + 60} textAnchor="middle" fill="rgba(255,255,255,0.7)"
            fontSize="11" fontFamily="var(--font-inter), sans-serif">{support.id}</text>
        </g>
      );
    }
    case 'roller': {
      return (
        <g>
          <circle cx={cx - 8} cy={cy + 18} r="6" fill="none" stroke={gold} strokeWidth="2" />
          <circle cx={cx + 8} cy={cy + 18} r="6" fill="none" stroke={gold} strokeWidth="2" />
          <line x1={cx - 22} y1={cy + 28} x2={cx + 22} y2={cy + 28} stroke={gold} strokeWidth="2" />
          <rect x={cx - 22} y={cy + 28} width="44" height="6" fill="url(#ab-hatch)" />
          <text x={cx} y={cy + 50} textAnchor="middle" fill="rgba(255,255,255,0.7)"
            fontSize="11" fontFamily="var(--font-inter), sans-serif">{support.id}</text>
        </g>
      );
    }
    case 'fixed': {
      return (
        <g>
          {/* wall to the left if at x=0 visually, otherwise show as full clamp */}
          <rect x={cx - 4} y={cy - 28} width="8" height="56" fill={gold} />
          <rect x={cx + 4} y={cy - 32} width="14" height="64" fill="url(#ab-hatch)" />
          <text x={cx} y={cy + 52} textAnchor="middle" fill="rgba(255,255,255,0.7)"
            fontSize="11" fontFamily="var(--font-inter), sans-serif">{support.id} (fixed)</text>
        </g>
      );
    }
    case 'spring': {
      return (
        <g>
          {/* zigzag spring */}
          <path d={`M ${cx},${cy + 6} L ${cx - 8},${cy + 14} L ${cx + 8},${cy + 22} L ${cx - 8},${cy + 30} L ${cx + 8},${cy + 38} L ${cx},${cy + 46}`}
            fill="none" stroke={gold} strokeWidth="2" />
          <line x1={cx - 22} y1={cy + 50} x2={cx + 22} y2={cy + 50} stroke={gold} strokeWidth="2" />
          <rect x={cx - 22} y={cy + 50} width="44" height="6" fill="url(#ab-hatch)" />
          <text x={cx} y={cy + 72} textAnchor="middle" fill="rgba(255,255,255,0.7)"
            fontSize="11" fontFamily="var(--font-inter), sans-serif">
            {support.id} (k_v={support.kv ?? 0})
          </text>
        </g>
      );
    }
    case 'free':
    default:
      return (
        <g>
          <text x={cx} y={cy + 24} textAnchor="middle" fill="rgba(255,255,255,0.5)"
            fontSize="11" fontFamily="var(--font-inter), sans-serif">{support.id} (free)</text>
        </g>
      );
  }
}

function LoadSymbol({
  load,
  L,
  x2px,
  beamYAt,
  beamHeight,
}: {
  load: Load;
  L: number;
  x2px: (x: number) => number;
  /** Returns the (deflected) baseline y at beam position x (m). */
  beamYAt: (x: number) => number;
  beamHeight: number;
}) {
  const colorMap: Record<string, string> = {
    dead: '#8b7355',
    live: '#c9a84c',
    wind: '#4a90c9',
    snow: '#b0c4de',
    seismic: '#c94c4c',
  };
  const baseColor = '#c9a84c';
  const lc = (load as { loadCase?: string }).loadCase;
  const color = (lc && colorMap[lc]) || baseColor;
  // Edge of the beam where the arrow tip touches (top edge for down loads, bottom for up)
  const beamTopY = (x: number) => beamYAt(x) - beamHeight / 2;
  const beamBotY = (x: number) => beamYAt(x) + beamHeight / 2;

  if (load.type === 'point') {
    const cx = x2px(load.position);
    const isDown = load.direction === 'down';
    const tipY = isDown ? beamTopY(load.position) - 2 : beamBotY(load.position) + 2;
    const baseY = isDown ? tipY - 48 : tipY + 48;
    return (
      <g>
        <line x1={cx} y1={baseY} x2={cx} y2={tipY} stroke={color} strokeWidth="2" />
        <polygon
          points={
            isDown
              ? `${cx},${tipY} ${cx - 5},${tipY - 10} ${cx + 5},${tipY - 10}`
              : `${cx},${tipY} ${cx - 5},${tipY + 10} ${cx + 5},${tipY + 10}`
          }
          fill={color}
        />
        <text x={cx + 8} y={isDown ? baseY - 4 : baseY + 14} fill={color}
          fontSize="12" fontFamily="var(--font-inter), sans-serif" fontWeight="600">
          {`${load.magnitude} kN`}
        </text>
      </g>
    );
  }
  if (load.type === 'distributed') {
    const aPos = Math.min(load.startPosition, load.endPosition);
    const bPos = Math.max(load.startPosition, load.endPosition);
    const x1 = x2px(aPos);
    const x2 = x2px(bPos);
    const isDown = load.direction === 'down';
    const wMaxAbs = Math.max(Math.abs(load.startMagnitude), Math.abs(load.endMagnitude), 1e-9);
    const arrowMaxLen = 36;
    const wA = (load.startPosition <= load.endPosition ? load.startMagnitude : load.endMagnitude);
    const wB = (load.startPosition <= load.endPosition ? load.endMagnitude : load.startMagnitude);
    const lenAt = (frac: number) => {
      const w = Math.abs(wA + (wB - wA) * frac);
      return arrowMaxLen * (w / wMaxAbs);
    };
    const numArrows = Math.max(6, Math.min(20, Math.floor((x2 - x1) / 36)));
    const arrows: React.ReactElement[] = [];
    const topPts: string[] = [];
    for (let i = 0; i <= numArrows; i++) {
      const f = i / numArrows;
      const px = x1 + (x2 - x1) * f;
      const xPos = aPos + (bPos - aPos) * f;
      const tipY = isDown ? beamTopY(xPos) - 2 : beamBotY(xPos) + 2;
      const len = lenAt(f);
      const baseY = isDown ? tipY - len - 6 : tipY + len + 6;
      topPts.push(`${px.toFixed(1)},${baseY.toFixed(1)}`);
      if (len < 4) continue;
      arrows.push(
        <g key={`d-${load.id}-${i}`}>
          <line x1={px} y1={baseY} x2={px} y2={tipY} stroke={color} strokeWidth="1.6" opacity="0.85" />
          <polygon points={
            isDown
              ? `${px},${tipY} ${px - 3.5},${tipY - 7} ${px + 3.5},${tipY - 7}`
              : `${px},${tipY} ${px - 3.5},${tipY + 7} ${px + 3.5},${tipY + 7}`
          } fill={color} opacity="0.85" />
        </g>
      );
    }
    const labelY = isDown
      ? Math.min(...topPts.map((p) => parseFloat(p.split(',')[1]))) - 4
      : Math.max(...topPts.map((p) => parseFloat(p.split(',')[1]))) + 14;
    return (
      <g>
        {/* Connector polyline follows the arrow tops, mirroring the deformed beam */}
        <polyline points={topPts.join(' ')} fill="none" stroke={color} strokeWidth="1.6" opacity="0.9" />
        {arrows}
        <text x={(x1 + x2) / 2} y={labelY} textAnchor="middle" fill={color}
          fontSize="11" fontFamily="var(--font-inter), sans-serif" fontWeight="600">
          {load.startMagnitude === load.endMagnitude
            ? `${load.startMagnitude} kN/m`
            : `${load.startMagnitude}→${load.endMagnitude} kN/m`}
        </text>
      </g>
    );
  }
  if (load.type === 'moment') {
    const cx = x2px(load.position);
    const cy = beamYAt(load.position) - 30;
    const r = 18;
    const isCcw = load.direction === 'ccw';
    const startAng = isCcw ? -30 : 210;
    const endAng = isCcw ? 210 : -30;
    const a1 = (startAng * Math.PI) / 180;
    const a2 = (endAng * Math.PI) / 180;
    const x1a = cx + r * Math.cos(a1);
    const y1a = cy + r * Math.sin(a1);
    const x2a = cx + r * Math.cos(a2);
    const y2a = cy + r * Math.sin(a2);
    const sweep = isCcw ? 0 : 1;
    return (
      <g>
        <path d={`M ${x1a},${y1a} A ${r},${r} 0 1,${sweep} ${x2a},${y2a}`}
          fill="none" stroke={color} strokeWidth="2" />
        <polygon
          points={`${x2a},${y2a} ${x2a - (isCcw ? -8 : 8)},${y2a - 4} ${x2a - (isCcw ? -2 : 2)},${y2a + (isCcw ? 8 : -8)}`}
          fill={color}
        />
        <text x={cx} y={cy - 24} textAnchor="middle" fill={color}
          fontSize="12" fontFamily="var(--font-inter), sans-serif" fontWeight="600">
          {`${load.magnitude} kN·m`}
        </text>
      </g>
    );
  }
  if (load.type === 'thermal') {
    const cx = x2px(L / 2);
    const cy = beamYAt(L / 2) - 60;
    return (
      <g>
        <text x={cx} y={cy} textAnchor="middle" fill={color}
          fontSize="11" fontFamily="var(--font-inter), sans-serif" fontWeight="600">
          {`Δ T = ${load.deltaTGradient}°C`}
        </text>
      </g>
    );
  }
  return null;
}
