'use client';

import React, { useMemo } from 'react';
import type { WallInput, WallResults } from '@/lib/retaining-wall/types';
import type { UnitSystem } from '@/lib/beam/units';

interface Props {
  input: WallInput;
  results: WallResults;
  unitSystem?: UnitSystem;
}

/**
 * Engineering section view of a cantilever retaining wall — styled after
 * Structures Explained / ASDIP / SkyCiv conventions.
 *
 *   • Blueprint-blue background with a subtle white grid
 *   • Multi-tone brown soil with random pebbles (SVG pattern)
 *   • Green grass strip on top of every soil surface
 *   • Gray concrete wall with a soft vertical gradient
 *   • Yellow triangle = active pressure, green triangle = passive pressure
 *   • Green vertical arrows over the backfill when surcharge > 0
 *   • White pill callouts with leader lines for key labels
 *   • Orange double-arrow dimensions
 */

// ─────────────────────────────────────────────────────────────────────────────
// Palette — matched against the reference images Juan provided
const C = {
  bg: '#1d4d7a',              // blueprint blue
  grid: 'rgba(255,255,255,0.08)',
  soilTop: '#a57846',          // lighter brown (top 30% of backfill)
  soilMid: '#875a2e',          // mid brown
  soilBot: '#5e3d1c',          // darker brown (foundation)
  soilStroke: '#3a2410',
  pebbleLight: '#c4925a',
  pebbleDark: '#4a2e12',
  grass: '#5aae3a',
  grassEdge: '#3d7a23',
  concrete: '#c4cbd1',
  concreteEdge: '#7d858f',
  active: '#f0c839',           // yellow = active pressure
  activeLight: 'rgba(240,200,57,0.22)',
  passive: '#46b93d',          // green = passive + surcharge arrows
  passiveLight: 'rgba(70,185,61,0.22)',
  water: '#5dc4d4',
  weight: '#f0c839',
  reaction: '#46b93d',
  bearing: '#ef6565',          // red = bearing reaction (upward)
  bearingLight: 'rgba(239,101,101,0.22)',
  dim: '#f59e0b',              // orange double arrows
  pillFill: '#ffffff',
  pillStroke: '#ffffff',
  pillText: '#1d4d7a',
  label: '#ffffff',
};

export function WallCanvas({ input, results, unitSystem = 'metric' }: Props) {
  const { geometry: g } = input;
  const H_total = g.H_stem + g.H_foot;
  const B = g.B_toe + g.t_stem_bot + g.B_heel;

  // surcharge equivalent depth for the pink/green band above backfill
  const gammaBackfill = input.backfill[0]?.gamma ?? 18;
  const qEq = input.loads.surchargeQ > 0
    ? Math.min((input.loads.surchargeQ / gammaBackfill) * 1000, H_total * 0.2)
    : 0;
  const dh = g.B_heel * Math.tan(g.backfillSlope);

  // Viewbox — keep it reasonable, don't blow up padding. Wall occupies ~55-65%
  // of the height. Pressure diagram fits in right margin. Soil extends
  // edge-to-edge (no dark slices).
  const padT = 450 + qEq + (g.backfillSlope > 0 ? dh * 0.6 : 0);
  const padB = 600;                       // space for horizontal dimension + grass below toe
  const padL = 350;                       // short left margin
  const padR = Math.max(H_total * 0.55, 2200);  // room for pressure triangle + labels
  const vbW = B + padL + padR;
  const vbH = H_total + padT + padB;

  // world (x, y)  — x=0 at toe, y=0 at FOOTING BOTTOM, +y up
  const xW = (x: number) => padL + x;
  const yW = (y: number) => padT + H_total - y;

  // Wall reference points (world)
  const footTop = g.H_foot;
  const stemTop = footTop + g.H_stem;
  const stemFrontX = g.B_toe;
  const stemBackX_bot = g.B_toe + g.t_stem_bot;
  const stemBackX_top = g.B_toe + g.t_stem_top;
  const heelX = B;
  const xLeft = -padL;
  const xRight = B + padR;
  const yBottom = -padB;
  const frontTopY = footTop + g.frontFill;
  const wedgeTopAtHeel = stemTop + dh;
  const wedgeRightEdgeY = wedgeTopAtHeel + (padR - 0) * Math.tan(g.backfillSlope);

  // Pressure diagram anchor column: just to the right of the stem back
  const prX = stemBackX_bot + Math.max(B * 0.15, 250); // offset from stem
  const prColX = prX; // vertical column origin

  // Ka·σv at base (kPa)
  const Ka = results.pressure.K;
  const sigmaSoilBase = Ka * gammaBackfill * (H_total / 1000);
  const sigmaSurch = Ka * input.loads.surchargeQ;
  const pressMax = Math.max(sigmaSoilBase + sigmaSurch, 1);
  const prScale = (padR * 0.6) / pressMax; // mm-per-kPa in pressure drawing

  // Bearing stress
  const { qMax, qMin, eccentricity, kern } = results.stability;
  const trapezoidal = Math.abs(eccentricity) <= kern;
  const bearingScale = Math.min((padB * 0.4) / Math.max(qMax, 1), 6);
  const bearingPoly: [number, number][] = trapezoidal
    ? [
        [0, 0],
        [B, 0],
        [B, -qMin * bearingScale],
        [0, -qMax * bearingScale],
      ]
    : (() => {
        const Lc = 3 * (B / 2 - Math.abs(eccentricity));
        return [
          [0, 0],
          [Math.min(Lc, B), 0],
          [0, -qMax * bearingScale],
        ];
      })();

  // ─── soil polygons (edge-to-edge so there's no dark canvas on the sides)
  const foundation: [number, number][] = [
    [xLeft, 0],
    [xRight, 0],
    [xRight, yBottom],
    [xLeft, yBottom],
  ];
  const toeFill: [number, number][] = g.frontFill > 0 ? [
    [xLeft, footTop],
    [stemFrontX, footTop],
    [stemFrontX, frontTopY],
    [xLeft, frontTopY],
  ] : [];
  const backfill: [number, number][] = [
    [stemBackX_bot, footTop],
    [xRight, footTop],
    [xRight, wedgeRightEdgeY],
    [heelX, wedgeTopAtHeel],
    [stemBackX_top, stemTop],
  ];

  // Soil sub-layer bands (horizontal stripes inside the backfill for visual depth)
  // Split backfill into 2 tonal bands: upper (lighter soil) + lower (mid soil).
  // The foundation below footing is the darkest tone.
  const backfillSplitY = footTop + g.H_stem * 0.55; // 55% up the stem
  const backfillUpper: [number, number][] = [
    [stemBackX_bot + (stemBackX_top - stemBackX_bot) * ((backfillSplitY - footTop) / g.H_stem),
      backfillSplitY],
    [xRight, backfillSplitY],
    [xRight, wedgeRightEdgeY],
    [heelX, wedgeTopAtHeel],
    [stemBackX_top, stemTop],
  ];

  const footing: [number, number][] = [
    [0, 0],
    [B, 0],
    [B, footTop],
    [0, footTop],
  ];
  const stem: [number, number][] = [
    [stemFrontX, footTop],
    [stemBackX_bot, footTop],
    [stemBackX_top, stemTop],
    [stemFrontX, stemTop],
  ];
  const keyShape: [number, number][] | null = g.key ? [
    [heelX - g.key.offsetFromHeel - g.key.width, 0],
    [heelX - g.key.offsetFromHeel, 0],
    [heelX - g.key.offsetFromHeel, -g.key.depth],
    [heelX - g.key.offsetFromHeel - g.key.width, -g.key.depth],
  ] : null;

  // Grass strips — one on top of the toe fill (front of wall) and one tracing
  // the inclined backfill top.
  const grassH = Math.max(H_total * 0.018, 60);

  // ─── helpers ────────────────────────────────────────────────────────────
  const poly = (pts: [number, number][]) =>
    pts.map(([x, y]) => `${xW(x).toFixed(1)},${yW(y).toFixed(1)}`).join(' ');

  const mm = (v: number) => {
    if (unitSystem === 'imperial') return `${(v / 25.4 / 12).toFixed(2)} ft`;
    return `${(v / 1000).toFixed(2)} m`;
  };

  const fs = {
    xl: Math.max(H_total * 0.055, 180),
    lg: Math.max(H_total * 0.042, 140),
    md: Math.max(H_total * 0.033, 110),
    sm: Math.max(H_total * 0.028, 94),
  };

  // Deterministic pebble generator — seed based on viewBox so pebbles stay put
  // when the user tweaks dims, but change when geometry actually changes.
  const pebbles = useMemo(() => {
    const seed = Math.floor(B + H_total * 7);
    const rng = mulberry32(seed);
    const count = 160;
    const list: Array<{ cx: number; cy: number; rx: number; ry: number; rot: number; dark: boolean }> = [];
    for (let i = 0; i < count; i++) {
      list.push({
        cx: xLeft + rng() * (xRight - xLeft),
        cy: yBottom + rng() * (footTop - yBottom + g.H_stem + (wedgeRightEdgeY - footTop)),
        rx: 20 + rng() * 70,
        ry: 10 + rng() * 28,
        rot: rng() * 180,
        dark: rng() > 0.5,
      });
    }
    return list;
  }, [B, H_total, xLeft, xRight, yBottom, footTop, g.H_stem, wedgeRightEdgeY]);

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className="rw-viz__svg"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Retaining wall section"
    >
      <defs>
        {/* subtle blueprint grid */}
        <pattern id="rw-grid" width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M 100 0 L 0 0 0 100" fill="none" stroke={C.grid} strokeWidth={1} />
        </pattern>
        {/* concrete gradient for dimension */}
        <linearGradient id="rw-concrete" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d7dde3" />
          <stop offset="0.5" stopColor={C.concrete} />
          <stop offset="1" stopColor="#a8b0b8" />
        </linearGradient>
        {/* arrow markers */}
        <marker id="rw-arr-y" markerWidth="10" markerHeight="10" refX="9" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L9,3.5 z" fill={C.active} />
        </marker>
        <marker id="rw-arr-g" markerWidth="10" markerHeight="10" refX="9" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L9,3.5 z" fill={C.passive} />
        </marker>
        <marker id="rw-arr-r" markerWidth="10" markerHeight="10" refX="9" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L9,3.5 z" fill={C.bearing} />
        </marker>
        <marker id="rw-arr-o" markerWidth="10" markerHeight="10" refX="9" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L9,3.5 z" fill={C.dim} />
        </marker>
        <marker id="rw-arr-o-start" markerWidth="10" markerHeight="10" refX="1" refY="3.5" orient="auto">
          <path d="M9,0 L9,7 L0,3.5 z" fill={C.dim} />
        </marker>
      </defs>

      {/* Blueprint background + grid */}
      <rect x="0" y="0" width={vbW} height={vbH} fill={C.bg} />
      <rect x="0" y="0" width={vbW} height={vbH} fill="url(#rw-grid)" />

      {/* ─── FOUNDATION (darkest brown) ─── */}
      <polygon
        points={poly(foundation)}
        fill={C.soilBot}
        stroke={C.soilStroke}
        strokeWidth={5}
      />
      {/* ─── TOE FILL on top of footing, left side ─── */}
      {g.frontFill > 0 && (
        <polygon
          points={poly(toeFill)}
          fill={C.soilMid}
          stroke={C.soilStroke}
          strokeWidth={4}
        />
      )}
      {/* ─── BACKFILL (mid-dark brown) ─── */}
      <polygon
        points={poly(backfill)}
        fill={C.soilMid}
        stroke={C.soilStroke}
        strokeWidth={4}
      />
      {/* ─── BACKFILL UPPER BAND (lighter brown) ─── */}
      <polygon
        points={poly(backfillUpper)}
        fill={C.soilTop}
      />

      {/* ─── PEBBLES (clipped to soil zones) ─── */}
      <g opacity={0.55}>
        {pebbles.map((p, i) => {
          const sx = xW(p.cx);
          const sy = yW(p.cy);
          // Only draw pebbles that fall in a soil-filled area
          const inFoundation = p.cy < 0 + 50;
          const inBackfill =
            p.cy > footTop &&
            p.cx > stemBackX_bot &&
            p.cy < wedgeTopAtHeel + (p.cx - heelX) * Math.tan(g.backfillSlope);
          const inToe =
            p.cy > footTop && p.cy < frontTopY && p.cx < stemFrontX;
          if (!inFoundation && !inBackfill && !inToe) return null;
          return (
            <ellipse
              key={i}
              cx={sx}
              cy={sy}
              rx={p.rx}
              ry={p.ry}
              fill={p.dark ? C.pebbleDark : C.pebbleLight}
              transform={`rotate(${p.rot} ${sx} ${sy})`}
            />
          );
        })}
      </g>

      {/* ─── GRASS on top of backfill (sloped) ─── */}
      <polygon
        points={poly([
          [stemBackX_top, stemTop],
          [heelX, wedgeTopAtHeel],
          [xRight, wedgeRightEdgeY],
          [xRight, wedgeRightEdgeY + grassH],
          [heelX, wedgeTopAtHeel + grassH],
          [stemBackX_top, stemTop + grassH],
        ])}
        fill={C.grass}
        stroke={C.grassEdge}
        strokeWidth={3}
      />

      {/* ─── GRASS on top of toe fill (flat) ─── */}
      {g.frontFill > 0 && (
        <polygon
          points={poly([
            [xLeft, frontTopY],
            [stemFrontX, frontTopY],
            [stemFrontX, frontTopY + grassH],
            [xLeft, frontTopY + grassH],
          ])}
          fill={C.grass}
          stroke={C.grassEdge}
          strokeWidth={3}
        />
      )}

      {/* ─── CONCRETE (footing + stem + optional key) ─── */}
      <polygon
        points={poly(footing)}
        fill="url(#rw-concrete)"
        stroke={C.concreteEdge}
        strokeWidth={6}
      />
      <polygon
        points={poly(stem)}
        fill="url(#rw-concrete)"
        stroke={C.concreteEdge}
        strokeWidth={6}
      />
      {keyShape && (
        <polygon
          points={poly(keyShape)}
          fill="url(#rw-concrete)"
          stroke={C.concreteEdge}
          strokeWidth={6}
        />
      )}

      {/* ─── Water table dashed cyan ∇ ─── */}
      {input.water.enabled && (() => {
        const yWater = stemTop - input.water.depthFromStemTop;
        return (
          <g>
            <line
              x1={xW(stemBackX_bot)}
              y1={yW(yWater)}
              x2={xW(xRight)}
              y2={yW(yWater + padR * Math.tan(g.backfillSlope))}
              stroke={C.water}
              strokeWidth={6}
              strokeDasharray="25 14"
            />
            {/* ∇ triangle marker */}
            <polygon
              points={`${xW(stemBackX_bot + 100)},${yW(yWater) - 30} ${
                xW(stemBackX_bot + 100) + 30
              },${yW(yWater) - 30} ${xW(stemBackX_bot + 100) + 15},${yW(yWater) + 5}`}
              fill={C.water}
            />
          </g>
        );
      })()}

      {/* ─── SURCHARGE: green down-arrows above grass ─── */}
      {input.loads.surchargeQ > 0 && (
        <g>
          {Array.from({ length: 9 }).map((_, i) => {
            const t = i / 8;
            const x = stemBackX_top + (xRight - stemBackX_top) * t;
            const yGrade =
              stemTop + grassH + (x - stemBackX_top) * Math.tan(g.backfillSlope);
            const yTop = yGrade + 500;
            return (
              <line
                key={i}
                x1={xW(x)}
                y1={yW(yTop)}
                x2={xW(x)}
                y2={yW(yGrade + 60)}
                stroke={C.passive}
                strokeWidth={11}
                markerEnd="url(#rw-arr-g)"
              />
            );
          })}
          <Pill
            x={xW((stemBackX_top + xRight) / 2)}
            y={yW(stemTop + grassH + 650)}
            text={`W = ${input.loads.surchargeQ.toFixed(2)} ${unitSystem === 'imperial' ? 'ksf' : 'kPa'}`}
            fs={fs.md}
            textColor={C.passive}
          />
        </g>
      )}

      {/* ─── ACTIVE PRESSURE TRIANGLE (yellow, to the right of the wall) ─── */}
      {pressMax > 1 && (
        <g>
          {/* vertical axis line */}
          <line
            x1={xW(prColX)}
            y1={yW(0)}
            x2={xW(prColX)}
            y2={yW(stemTop)}
            stroke={C.active}
            strokeWidth={5}
          />
          {/* triangle: top is narrow (surcharge rect component), bottom is wide */}
          <polygon
            points={poly([
              [prColX, stemTop],
              [prColX + sigmaSurch * prScale, stemTop],
              [prColX + (sigmaSoilBase + sigmaSurch) * prScale, 0],
              [prColX, 0],
            ])}
            fill={C.activeLight}
            stroke={C.active}
            strokeWidth={5}
          />
          {/* Horizontal arrows pushing INTO the wall (leftward) */}
          {Array.from({ length: 8 }).map((_, i) => {
            const yy = stemTop - ((i + 1) / 8) * stemTop;
            const sigma = sigmaSurch + ((sigmaSoilBase) * (1 - yy / stemTop));
            const w = sigma * prScale;
            return (
              <line
                key={i}
                x1={xW(prColX + w)}
                y1={yW(yy)}
                x2={xW(prColX - 40)}
                y2={yW(yy)}
                stroke={C.active}
                strokeWidth={6}
                markerEnd="url(#rw-arr-y)"
              />
            );
          })}
          {/* Formula pill */}
          <Pill
            x={xW(prColX + (sigmaSoilBase + sigmaSurch) * prScale + 200)}
            y={yW(50)}
            text={`Ka·γ·H = ${(sigmaSoilBase + sigmaSurch).toFixed(1)} kPa`}
            fs={fs.sm}
            textColor={C.pillText}
          />
        </g>
      )}

      {/* ─── PASSIVE PRESSURE (green triangle on toe side) ─── */}
      {input.baseSoil.passiveEnabled && g.frontFill > 0 && (() => {
        const hpm = (g.frontFill + g.H_foot) / 1000;
        const Kp = Ka > 0 ? 1 / Ka : 3;
        const sigmaPassive = Kp * input.baseSoil.gamma * hpm;
        const pScale = Math.min(padL * 0.4 / Math.max(sigmaPassive, 1), prScale * 0.5);
        const w = sigmaPassive * pScale;
        const pxCol = -30;
        return (
          <g>
            <polygon
              points={poly([
                [pxCol, frontTopY],
                [pxCol, 0],
                [pxCol - w, 0],
              ])}
              fill={C.passiveLight}
              stroke={C.passive}
              strokeWidth={4}
            />
            {Array.from({ length: 4 }).map((_, i) => {
              const yy = ((i + 1) / 4) * frontTopY;
              const s = sigmaPassive * (1 - yy / frontTopY);
              const ww = s * pScale;
              return (
                <line
                  key={i}
                  x1={xW(pxCol - ww)}
                  y1={yW(yy)}
                  x2={xW(pxCol + 50)}
                  y2={yW(yy)}
                  stroke={C.passive}
                  strokeWidth={5}
                  markerEnd="url(#rw-arr-g)"
                />
              );
            })}
          </g>
        );
      })()}

      {/* ─── BEARING STRESS under footing (red upward arrows + polygon) ─── */}
      <g>
        <polygon
          points={poly(bearingPoly)}
          fill={C.bearingLight}
          stroke={C.bearing}
          strokeWidth={4}
        />
        {Array.from({ length: 7 }).map((_, i) => {
          const t = i / 6;
          const x = t * B;
          const q = trapezoidal
            ? qMax - (qMax - qMin) * t
            : qMax * (1 - x / Math.min(3 * (B / 2 - Math.abs(eccentricity)), B));
          const h = Math.max(q, 0) * bearingScale;
          return (
            <line
              key={i}
              x1={xW(x)}
              y1={yW(-h)}
              x2={xW(x)}
              y2={yW(-20)}
              stroke={C.bearing}
              strokeWidth={6}
              markerEnd="url(#rw-arr-r)"
            />
          );
        })}
        <Pill
          x={xW(B / 2)}
          y={yW(-qMax * bearingScale - 180)}
          text={`qmax = ${qMax.toFixed(0)} ${unitSystem === 'imperial' ? 'ksf' : 'kPa'}`}
          fs={fs.sm}
          textColor={C.pillText}
        />
      </g>

      {/* ─── DIMENSIONS: orange double-arrows ─── */}
      {/* H total stem height on the far right */}
      {DoubleArrow({
        x1: xW(xRight - 120),
        y1: yW(0),
        x2: xW(xRight - 120),
        y2: yW(stemTop),
        label: `H = ${mm(g.H_stem + g.H_foot)}`,
        fs: fs.md,
        vertical: true,
        color: C.dim,
      })}

      {/* B footing width along the bottom */}
      {DoubleArrow({
        x1: xW(0),
        y1: yW(-padB * 0.45),
        x2: xW(B),
        y2: yW(-padB * 0.45),
        label: `B = ${mm(B)}`,
        fs: fs.md,
        vertical: false,
        color: C.dim,
      })}

      {/* Wall labels */}
      <text
        x={xW(stemFrontX + g.t_stem_bot / 2)}
        y={yW(stemTop - 80)}
        fontSize={fs.sm}
        textAnchor="middle"
        fill={C.label}
        fontFamily="Inter, sans-serif"
        fontWeight={800}
        letterSpacing="0.18em"
      >
        STEM
      </text>
      <text
        x={xW(B / 2)}
        y={yW(g.H_foot / 2) + fs.sm * 0.35}
        fontSize={fs.sm}
        textAnchor="middle"
        fill="#2c3238"
        fontFamily="Inter, sans-serif"
        fontWeight={800}
        letterSpacing="0.18em"
      >
        FOOTING
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable bits

function Pill({
  x, y, text, fs, textColor,
}: {
  x: number;
  y: number;
  text: string;
  fs: number;
  textColor: string;
}) {
  const padX = fs * 0.6;
  const padY = fs * 0.3;
  const w = text.length * fs * 0.5 + padX * 2;
  const h = fs + padY * 2;
  return (
    <g>
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={h / 2}
        ry={h / 2}
        fill="#ffffff"
        stroke="#ffffff"
        strokeWidth={3}
      />
      <text
        x={x}
        y={y + fs * 0.34}
        fontSize={fs}
        textAnchor="middle"
        fill={textColor}
        fontFamily="Inter, sans-serif"
        fontWeight={700}
      >
        {text}
      </text>
    </g>
  );
}

function DoubleArrow({
  x1, y1, x2, y2, label, fs, vertical, color,
}: {
  x1: number; y1: number; x2: number; y2: number;
  label: string; fs: number; vertical: boolean; color: string;
}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g key={label}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={6}
        markerStart="url(#rw-arr-o-start)"
        markerEnd="url(#rw-arr-o)"
      />
      <text
        x={vertical ? mx + 32 : mx}
        y={vertical ? my : my - 28}
        fontSize={fs}
        textAnchor={vertical ? 'start' : 'middle'}
        fill={color}
        fontFamily="Inter, sans-serif"
        fontWeight={800}
        letterSpacing="0.04em"
      >
        {label}
      </text>
    </g>
  );
}

// tiny deterministic PRNG so pebbles stay stable across renders for the same geometry
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
