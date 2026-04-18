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
 * Engineering section view of a cantilever retaining wall.
 *
 *  Layout philosophy (matches SkyCiv / ASDIP / Prokon conventions):
 *
 *    ┌──────────────────────────────────┐  ← sky line (implicit, canvas bg)
 *    │  pressure   │ surcharge ARROWS   │
 *    │  diagram →  │ ▼ ▼ ▼ ▼ ▼ ▼ ▼     │
 *    │         Pa─►├──── pink band ────│  ← grade (stem top)
 *    │             │░░░░░░░░ BROWN ░░░░│
 *    │  ◂ σh triangle ░░░░░░░░░░░░░░░░ │
 *    │   ▒▒▒▒▒▒▒ │  │ ▒▒▒▒▒▒▒░░░░░░░░░│  ← grade (front fill top)
 *    │   yellow  │  │ yellow backfill │
 *    │   toe fill│st│  (multi-layer)  │
 *    ├───────────┼──┼─────────────────┤  ← footing top
 *    │           ░░░░░░░░                │  ← footing bottom
 *    │ ░░░░░░░ ORANGE  FOUNDATION  ░░░░░│
 *    │                                   │
 *    │  [qmax ──── qmin]   bearing      │
 *    └──────────────────────────────────┘
 *
 *  Key decisions:
 *   • NO "sky" polygon — canvas background shows through (dark, matches site).
 *   • Every soil zone extends edge-to-edge of the viewBox so there are no
 *     "cut-off" slices of dark canvas around the drawing.
 *   • Padding is lean: just enough for pressure diagram (left), bearing
 *     diagram (bottom), and optional surcharge band (top).
 *   • Colors: SkyCiv-matched brown/orange/yellow-green/pink/gray.
 *   • Stroke on every soil polygon so boundaries read even on dark bg.
 */

const C = {
  concrete: '#e0e0e0',
  concreteEdge: '#6f6f6f',
  backfill: '#9c7a46',        // warm saturated brown
  backfillEdge: '#5e4a24',
  foundation: '#e48320',      // saturated orange
  foundationEdge: '#9b5110',
  toeFill: '#c9bd5a',         // yellow-green
  toeFillEdge: '#7f7736',
  surcharge: '#e8b5b5',       // pink
  surchargeEdge: '#b24848',
  grade: '#a8a8a8',
  water: '#5ca8d4',
  dim: '#c9a84c',
  pressure: '#ff6b6b',
  bearing: '#3dd78d',
  label: '#f2efe4',
};

export function WallCanvas({ input, results, unitSystem = 'metric' }: Props) {
  const { geometry: g } = input;
  const H_total = g.H_stem + g.H_foot;
  const B = g.B_toe + g.t_stem_bot + g.B_heel;

  // Pull a representative backfill γ for the q-equivalent height
  const gammaBackfill = input.backfill[0]?.gamma ?? 18;
  const qEq_mm =
    input.loads.surchargeQ > 0
      ? Math.min((input.loads.surchargeQ / gammaBackfill) * 1000, H_total * 0.25)
      : 0;
  const dh = g.B_heel * Math.tan(g.backfillSlope); // slope rise over heel width

  // ---- viewBox padding: LEAN so the wall dominates the canvas ----
  // Left: room for Ka·σv triangle + Pa arrow + units label
  // Right: room for backfill to extend + q label
  // Top: just enough for surcharge arrows + "q = …" label
  // Bottom: enough for bearing diagram + qmax label + horizontal dim
  const pressureRoom = Math.max(H_total * 0.55, 1800);
  const padL = pressureRoom;
  const padR = Math.max(B * 0.35, 1400);
  const surchargeRoom = qEq_mm > 0 ? qEq_mm + 450 : 350;
  const padT = surchargeRoom;
  const bearingRoom = Math.max(results.stability.qMax * 6, 800); // ~6 mm per kPa
  const padB = Math.max(bearingRoom + 300, 1100);

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
  const yTop = H_total + padT;
  const frontTopY = footTop + g.frontFill;
  const wedgeTopAtHeel = stemTop + dh;
  const wedgeRightEdgeY = wedgeTopAtHeel + padR * Math.tan(g.backfillSlope);

  // ---------- SOIL POLYGONS (edge-to-edge) ----------
  // Foundation: fills ENTIRE below-footing area
  const foundation: [number, number][] = [
    [xLeft, 0],
    [xRight, 0],
    [xRight, yBottom],
    [xLeft, yBottom],
  ];

  // Toe fill: left of stem, from ground in front of wall to toe face
  const toeFill: [number, number][] = [
    [xLeft, footTop],
    [stemFrontX, footTop],
    [stemFrontX, frontTopY],
    [xLeft, frontTopY],
  ];

  // Backfill: right of stem up to backfill top (sloped)
  const backfill: [number, number][] = [
    [stemBackX_bot, footTop],
    [xRight, footTop],
    [xRight, wedgeRightEdgeY],
    [heelX, wedgeTopAtHeel],
    [stemBackX_top, stemTop],
  ];

  // Surcharge band on TOP of backfill
  const surchargeBand: [number, number][] | null =
    qEq_mm > 0
      ? [
          [stemBackX_top, stemTop],
          [heelX, wedgeTopAtHeel],
          [xRight, wedgeRightEdgeY],
          [xRight, wedgeRightEdgeY + qEq_mm],
          [stemBackX_top, stemTop + qEq_mm],
        ]
      : null;

  // ---------- CONCRETE ----------
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
  const keyShape: [number, number][] | null = g.key
    ? [
        [heelX - g.key.offsetFromHeel - g.key.width, 0],
        [heelX - g.key.offsetFromHeel, 0],
        [heelX - g.key.offsetFromHeel, -g.key.depth],
        [heelX - g.key.offsetFromHeel - g.key.width, -g.key.depth],
      ]
    : null;

  // ---------- BEARING DIAGRAM ----------
  const { qMax, qMin, eccentricity, kern } = results.stability;
  const qVis = Math.min(bearingRoom / Math.max(qMax, 1), 8); // mm-per-kPa
  const trapezoidal = Math.abs(eccentricity) <= kern;
  const bearingPoly: [number, number][] = trapezoidal
    ? [
        [0, 0],
        [B, 0],
        [B, -qMin * qVis],
        [0, -qMax * qVis],
      ]
    : (() => {
        const Lc = 3 * (B / 2 - Math.abs(eccentricity));
        return [
          [0, 0],
          [Math.min(Lc, B), 0],
          [0, -qMax * qVis],
        ];
      })();

  // ---------- PRESSURE DIAGRAM (rectangle for surcharge + triangle for soil) ----------
  // Ka·σv at base (kPa)
  const Ka = results.pressure.K;
  const sigmaSoilBase = Ka * gammaBackfill * (H_total / 1000);
  const sigmaSurch = Ka * input.loads.surchargeQ;
  const pressMax = Math.max(sigmaSoilBase + sigmaSurch, 1);
  const pxPerKPa = (pressureRoom * 0.55) / pressMax;
  const wBase = (sigmaSoilBase + sigmaSurch) * pxPerKPa;
  const wTop = sigmaSurch * pxPerKPa;

  // ---------- helpers ----------
  const poly = (pts: [number, number][]) =>
    pts.map(([x, y]) => `${xW(x).toFixed(1)},${yW(y).toFixed(1)}`).join(' ');

  const fs = {
    lg: Math.max(H_total * 0.042, 140),
    md: Math.max(H_total * 0.032, 105),
    sm: Math.max(H_total * 0.026, 90),
    dim: Math.max(H_total * 0.028, 95),
  };

  const mm = (v: number) => {
    if (unitSystem === 'imperial') return `${(v / 25.4 / 12).toFixed(2)} ft`;
    return `${(v / 1000).toFixed(2)} m`;
  };

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
        <marker id="rw-arrow-red" markerWidth="10" markerHeight="10" refX="9" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L9,3.5 z" fill={C.pressure} />
        </marker>
      </defs>

      {/* ===== SOIL ZONES (edge-to-edge, solid colors) ===== */}
      <polygon
        points={poly(foundation)}
        fill={C.foundation}
        stroke={C.foundationEdge}
        strokeWidth={6}
      />
      {g.frontFill > 0 && (
        <polygon
          points={poly(toeFill)}
          fill={C.toeFill}
          stroke={C.toeFillEdge}
          strokeWidth={6}
        />
      )}
      <polygon
        points={poly(backfill)}
        fill={C.backfill}
        stroke={C.backfillEdge}
        strokeWidth={6}
      />
      {surchargeBand && (
        <polygon
          points={poly(surchargeBand)}
          fill={C.surcharge}
          stroke={C.surchargeEdge}
          strokeWidth={5}
        />
      )}

      {/* Surcharge arrows and label (drawn above the band) */}
      {qEq_mm > 0 && (
        <>
          {Array.from({ length: 7 }).map((_, i) => {
            const tt = i / 6;
            const x = stemBackX_top + (xRight - stemBackX_top) * tt;
            const yBottomLocal =
              stemTop + qEq_mm + (x - stemBackX_top) * Math.tan(g.backfillSlope);
            const yTopLocal = yBottomLocal + 380;
            return (
              <line
                key={i}
                x1={xW(x)}
                y1={yW(yTopLocal)}
                x2={xW(x)}
                y2={yW(yBottomLocal + 40)}
                stroke={C.pressure}
                strokeWidth={10}
                markerEnd="url(#rw-arrow-red)"
              />
            );
          })}
          <text
            x={xW((stemBackX_top + xRight) / 2)}
            y={yW(stemTop + qEq_mm + 420)}
            fontSize={fs.md}
            textAnchor="middle"
            fill={C.pressure}
            fontFamily="Inter, sans-serif"
            fontWeight={700}
          >
            q = {input.loads.surchargeQ.toFixed(2)} {unitSystem === 'imperial' ? 'ksf' : 'kPa'}
          </text>
        </>
      )}

      {/* ===== CONCRETE ===== */}
      <polygon points={poly(footing)} fill={C.concrete} stroke={C.concreteEdge} strokeWidth={7} />
      <polygon points={poly(stem)} fill={C.concrete} stroke={C.concreteEdge} strokeWidth={7} />
      {keyShape && (
        <polygon points={poly(keyShape)} fill={C.concrete} stroke={C.concreteEdge} strokeWidth={7} />
      )}

      {/* Water-table line across the backfill */}
      {input.water.enabled && (() => {
        const yWater = stemTop - input.water.depthFromStemTop;
        return (
          <line
            x1={xW(stemBackX_bot)}
            y1={yW(yWater)}
            x2={xW(xRight)}
            y2={yW(yWater + padR * Math.tan(g.backfillSlope))}
            stroke={C.water}
            strokeWidth={7}
            strokeDasharray="30 18"
          />
        );
      })()}

      {/* ===== ACTIVE PRESSURE TRIANGLE (left of stem) ===== */}
      {pressMax > 1 && (
        <g>
          <polygon
            points={poly([
              [stemFrontX, stemTop],
              [stemFrontX - wTop, stemTop],
              [stemFrontX - wBase, 0],
              [stemFrontX, 0],
            ])}
            fill="rgba(255,107,107,0.22)"
            stroke={C.pressure}
            strokeWidth={5}
          />
          {/* Pa resultant */}
          <line
            x1={xW(stemFrontX - wBase * 0.65)}
            y1={yW(results.pressure.yBar)}
            x2={xW(stemFrontX - wBase - 180)}
            y2={yW(results.pressure.yBar)}
            stroke={C.pressure}
            strokeWidth={14}
            markerEnd="url(#rw-arrow-red)"
          />
          <text
            x={xW(stemFrontX - wBase - 220)}
            y={yW(results.pressure.yBar) - 60}
            fontSize={fs.md}
            textAnchor="end"
            fill={C.pressure}
            fontFamily="Inter, sans-serif"
            fontWeight={700}
          >
            Pa = {(results.pressure.Pa + results.pressure.Pq + results.pressure.Pw).toFixed(1)}{' '}
            {unitSystem === 'imperial' ? 'klf' : 'kN/m'}
          </text>
          <text
            x={xW(stemFrontX - wBase - 220)}
            y={yW(results.pressure.yBar) + fs.md - 20}
            fontSize={fs.sm}
            textAnchor="end"
            fill={C.pressure}
            fontFamily="JetBrains Mono, monospace"
          >
            σh,max = {sigmaSoilBase.toFixed(1)} kPa
          </text>
        </g>
      )}

      {/* ===== BEARING STRESS DIAGRAM (below footing) ===== */}
      <g>
        <polygon
          points={poly(bearingPoly)}
          fill="rgba(61,215,141,0.3)"
          stroke={C.bearing}
          strokeWidth={5}
        />
        <text
          x={xW(0)}
          y={yW(-qMax * qVis) + fs.sm + 30}
          fontSize={fs.sm}
          fill={C.bearing}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={700}
        >
          qmax = {qMax.toFixed(0)} {unitSystem === 'imperial' ? 'ksf' : 'kPa'}
        </text>
        {trapezoidal && (
          <text
            x={xW(B)}
            y={yW(-qMin * qVis) + fs.sm + 30}
            fontSize={fs.sm}
            textAnchor="end"
            fill={C.bearing}
            fontFamily="JetBrains Mono, monospace"
            fontWeight={700}
          >
            qmin = {qMin.toFixed(0)}
          </text>
        )}
      </g>

      {/* ===== DIMENSIONS (bottom row + left column) ===== */}
      {dim(xW, yW, 0, -padB * 0.4, stemFrontX, -padB * 0.4, mm(g.B_toe), fs.dim)}
      {dim(xW, yW, stemFrontX, -padB * 0.4, stemBackX_bot, -padB * 0.4, mm(g.t_stem_bot), fs.dim)}
      {dim(xW, yW, stemBackX_bot, -padB * 0.4, B, -padB * 0.4, mm(g.B_heel), fs.dim)}
      {dim(xW, yW, -padL * 0.2, 0, -padL * 0.2, footTop, mm(g.H_foot), fs.dim, true)}
      {dim(xW, yW, -padL * 0.2, footTop, -padL * 0.2, stemTop, mm(g.H_stem), fs.dim, true)}

      {/* ===== MEMBER LABELS ===== */}
      <text
        x={xW(stemFrontX + g.t_stem_bot / 2)}
        y={yW(stemTop + 100) - fs.md}
        fontSize={fs.md}
        textAnchor="middle"
        fill={C.label}
        fontFamily="Inter, sans-serif"
        fontWeight={800}
        letterSpacing="0.2em"
      >
        STEM
      </text>
      <text
        x={xW(B / 2)}
        y={yW(g.H_foot / 2) + fs.md / 3}
        fontSize={fs.md}
        textAnchor="middle"
        fill="#0a0a0b"
        fontFamily="Inter, sans-serif"
        fontWeight={800}
        letterSpacing="0.2em"
      >
        FOOTING
      </text>
    </svg>
  );
}

// -------- dimension helper (rendered outside component for JSX clarity) --------
function dim(
  xW: (x: number) => number,
  yW: (y: number) => number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  text: string,
  fontSize: number,
  vertical = false,
) {
  const mxPx = (xW(x1) + xW(x2)) / 2;
  const myPx = (yW(y1) + yW(y2)) / 2;
  const tickLen = fontSize * 0.45;
  return (
    <g key={`${x1}-${y1}-${x2}-${y2}`}>
      <line x1={xW(x1)} y1={yW(y1)} x2={xW(x2)} y2={yW(y2)} stroke={C.dim} strokeWidth={3} />
      {vertical ? (
        <>
          <line x1={xW(x1) - tickLen} y1={yW(y1)} x2={xW(x1) + tickLen} y2={yW(y1)} stroke={C.dim} strokeWidth={3} />
          <line x1={xW(x2) - tickLen} y1={yW(y2)} x2={xW(x2) + tickLen} y2={yW(y2)} stroke={C.dim} strokeWidth={3} />
        </>
      ) : (
        <>
          <line x1={xW(x1)} y1={yW(y1) - tickLen} x2={xW(x1)} y2={yW(y1) + tickLen} stroke={C.dim} strokeWidth={3} />
          <line x1={xW(x2)} y1={yW(y2) - tickLen} x2={xW(x2)} y2={yW(y2) + tickLen} stroke={C.dim} strokeWidth={3} />
        </>
      )}
      <text
        x={vertical ? mxPx + fontSize * 0.35 : mxPx}
        y={vertical ? myPx + fontSize * 0.35 : myPx - fontSize * 0.35}
        fontSize={fontSize}
        textAnchor={vertical ? 'start' : 'middle'}
        fill={C.dim}
        fontFamily="JetBrains Mono, monospace"
        fontWeight={700}
      >
        {text}
      </text>
    </g>
  );
}
