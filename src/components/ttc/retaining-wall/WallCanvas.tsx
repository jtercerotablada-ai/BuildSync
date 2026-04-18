'use client';

import React, { useMemo } from 'react';
import type { WallInput, WallResults } from '@/lib/retaining-wall/types';
import type { UnitSystem } from '@/lib/beam/units';
import { fromSI, unitLabel } from '@/lib/beam/units';

interface Props {
  input: WallInput;
  results: WallResults;
  unitSystem?: UnitSystem;
}

// Palette — solid high-contrast colors matching pro retaining-wall software.
const C = {
  concrete: '#d4d4d4',
  concreteStroke: '#6f6f6f',
  backfill: '#8b6f3e',          // warm brown
  backfillStroke: '#5e4a24',
  surcharge: '#d99595',          // pink-red band
  surchargeStroke: '#b24848',
  foundation: '#d97706',         // orange
  foundationStroke: '#8a4a06',
  toeFill: '#c4b95b',            // yellow-green
  toeFillStroke: '#7f7736',
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

  // Surcharge band height (visual only, represents q/γ)
  const gammaBackfill = input.backfill[0]?.gamma ?? 18;
  const qEq_mm = input.loads.surchargeQ > 0
    ? Math.min((input.loads.surchargeQ / gammaBackfill) * 1000, H_total * 0.35)
    : 0;
  // Sloping wedge rise over heel
  const dh = g.B_heel * Math.tan(g.backfillSlope);
  const wedgeTop = g.H_stem + dh;

  // ViewBox: wall at center-right, with ample room LEFT for pressure diagram
  // and BELOW for bearing stress + foundation block.
  const padL = Math.max(B * 0.55, 2800);
  const padR = Math.max(B * 0.6, 2500);
  const padT = Math.max(H_total * 0.25 + qEq_mm + 600, 1400);
  const padB = Math.max(H_total * 0.55, 2000);
  const vbW = B + padL + padR;
  const vbH = H_total + padT + padB;

  // World: y=0 at footing BOTTOM, +y up. x=0 at toe.
  const xW = (x: number) => padL + x;
  const yW = (y: number) => padT + H_total - y;

  // Wall points
  const footTop = g.H_foot;
  const stemTop = footTop + g.H_stem;
  const stemFrontX = g.B_toe;
  const stemBackX_bot = g.B_toe + g.t_stem_bot;
  const stemBackX_top = g.B_toe + g.t_stem_top;
  const heelX = B;

  // ---- background soil zones (edge-to-edge) ----
  // 1) Foundation soil: covers ENTIRE bottom of viewBox, from below footing
  //    out to all edges. Color: solid orange.
  // 2) Toe fill: from left edge of viewBox to stem front face, above footing
  //    top up to height g.frontFill. Color: yellow-green.
  // 3) Backfill (main): from stem back face to right edge of viewBox, above
  //    footing top up to stem top + slope-rise at heel. Color: brown.
  // 4) Surcharge band: strip of pink above the backfill top, arrows pointing down.

  // Foundation (below footing): entire viewBox bottom half
  const foundationBottomY = -padB; // extends all the way down
  const foundation = [
    [-padL, 0],
    [B + padR, 0],
    [B + padR, foundationBottomY],
    [-padL, foundationBottomY],
  ];

  // Toe fill: left-of-stem on top of footing (includes front fill above footing top)
  const frontTopY = footTop + g.frontFill;
  const toeFill = [
    [-padL, footTop],
    [stemFrontX, footTop],
    [stemFrontX, frontTopY],
    [-padL, frontTopY],
  ];

  // Main backfill polygon (stem back → heel → right edge → up at slope)
  // Top surface slopes at angle β from horizontal.
  const backfillRightEdgeY_top = wedgeTop + padR * Math.tan(g.backfillSlope);
  const backfill = [
    [stemBackX_bot, footTop],
    [stemBackX_top, stemTop],
    [heelX, wedgeTop],
    [B + padR, backfillRightEdgeY_top],
    [B + padR, footTop],
  ];

  // Surcharge band on top of backfill (pink strip)
  const surchargeBand =
    input.loads.surchargeQ > 0
      ? [
          [stemBackX_top, stemTop],
          [heelX, wedgeTop],
          [B + padR, backfillRightEdgeY_top],
          [B + padR, backfillRightEdgeY_top + qEq_mm],
          [stemBackX_top, stemTop + qEq_mm],
        ]
      : null;

  // Sky/air fill (above surcharge & above toe fill) — fills remaining top space
  // to avoid black edges.
  const skyTopY = vbH; // large number
  const sky = [
    [-padL, frontTopY],
    [stemFrontX, frontTopY],
    [stemFrontX, stemTop],
    [stemBackX_top, stemTop],
    [stemBackX_top, stemTop + qEq_mm],
    [B + padR, backfillRightEdgeY_top + qEq_mm],
    [B + padR, skyTopY],
    [-padL, skyTopY],
  ];

  // ---- wall concrete ----
  const footing = [
    [0, 0],
    [B, 0],
    [B, footTop],
    [0, footTop],
  ];
  const stem = [
    [stemFrontX, footTop],
    [stemBackX_bot, footTop],
    [stemBackX_top, stemTop],
    [stemFrontX, stemTop],
  ];
  const keyShape = g.key
    ? [
        [heelX - g.key.offsetFromHeel - g.key.width, 0],
        [heelX - g.key.offsetFromHeel, 0],
        [heelX - g.key.offsetFromHeel, -g.key.depth],
        [heelX - g.key.offsetFromHeel - g.key.width, -g.key.depth],
      ]
    : null;

  // ---- Bearing diagram (below footing) ----
  const { qMax, qMin, eccentricity, kern } = results.stability;
  const qVisScale = Math.min(padB * 0.6 / Math.max(qMax, 1), 20); // mm-per-kPa
  const trapezoidal = Math.abs(eccentricity) <= kern;
  const bearingPoly: [number, number][] = trapezoidal
    ? [
        [0, 0],
        [B, 0],
        [B, -qMin * qVisScale],
        [0, -qMax * qVisScale],
      ]
    : (() => {
        const Lc = 3 * (B / 2 - Math.abs(eccentricity));
        return [
          [0, 0],
          [Lc, 0],
          [0, -qMax * qVisScale],
        ];
      })();

  // ---- helpers ----
  const poly = (pts: number[][]) =>
    pts.map(([x, y]) => `${xW(x).toFixed(1)},${yW(y).toFixed(1)}`).join(' ');

  const fsLabel = Math.max(H_total * 0.009, 45);
  const fsDim = Math.max(H_total * 0.011, 55);

  const dim = (x1: number, y1: number, x2: number, y2: number, text: string, offset = 0) => {
    const vertical = Math.abs(x1 - x2) < 1;
    const mx = (xW(x1) + xW(x2)) / 2;
    const my = (yW(y1) + yW(y2)) / 2;
    return (
      <g>
        <line
          x1={xW(x1)}
          y1={yW(y1)}
          x2={xW(x2)}
          y2={yW(y2)}
          stroke={C.dim}
          strokeWidth={3}
        />
        <line
          x1={xW(x1) - 15}
          y1={yW(y1) - (vertical ? 0 : 15)}
          x2={xW(x1) + 15}
          y2={yW(y1) + (vertical ? 0 : 15)}
          stroke={C.dim}
          strokeWidth={3}
        />
        <line
          x1={xW(x2) - 15}
          y1={yW(y2) - (vertical ? 0 : 15)}
          x2={xW(x2) + 15}
          y2={yW(y2) + (vertical ? 0 : 15)}
          stroke={C.dim}
          strokeWidth={3}
        />
        <text
          x={vertical ? mx + 20 : mx}
          y={vertical ? my : my - 14}
          fontSize={fsDim}
          textAnchor={vertical ? 'start' : 'middle'}
          fill={C.dim}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={700}
        >
          {text}
        </text>
      </g>
    );
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
        <marker id="rw-arrow-red" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto">
          <path d="M0,0 L0,8 L10,4 z" fill={C.pressure} />
        </marker>
        <marker id="rw-arrow-green" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto">
          <path d="M0,0 L0,8 L10,4 z" fill={C.bearing} />
        </marker>
      </defs>

      {/* Sky / air background (prevents black edges above ground) */}
      <polygon points={poly(sky)} fill="#1a1a1e" />

      {/* Foundation soil — full edge-to-edge below footing */}
      <polygon
        points={poly(foundation)}
        fill={C.foundation}
        stroke={C.foundationStroke}
        strokeWidth={3}
      />

      {/* Toe fill (front of wall) */}
      {g.frontFill > 0 && (
        <polygon
          points={poly(toeFill)}
          fill={C.toeFill}
          stroke={C.toeFillStroke}
          strokeWidth={3}
        />
      )}

      {/* Backfill */}
      <polygon
        points={poly(backfill)}
        fill={C.backfill}
        stroke={C.backfillStroke}
        strokeWidth={3}
      />

      {/* Surcharge band (pink) */}
      {surchargeBand && (
        <>
          <polygon
            points={poly(surchargeBand)}
            fill={C.surcharge}
            stroke={C.surchargeStroke}
            strokeWidth={3}
            opacity={0.9}
          />
          {/* Arrows pointing DOWN onto the backfill */}
          {Array.from({ length: 7 }).map((_, i) => {
            const t = i / 6;
            const x = stemBackX_top + (heelX + padR * 0.15 - stemBackX_top) * t;
            const yTop =
              stemTop +
              qEq_mm +
              (x - stemBackX_top) * Math.tan(g.backfillSlope);
            const yBot =
              stemTop + (x - stemBackX_top) * Math.tan(g.backfillSlope) + 30;
            return (
              <line
                key={i}
                x1={xW(x)}
                y1={yW(yTop)}
                x2={xW(x)}
                y2={yW(yBot)}
                stroke={C.surchargeStroke}
                strokeWidth={5}
                markerEnd="url(#rw-arrow-red)"
              />
            );
          })}
          <text
            x={xW((stemBackX_top + heelX) / 2)}
            y={yW(stemTop + qEq_mm + 200)}
            fontSize={fsLabel * 1.1}
            textAnchor="middle"
            fill={C.pressure}
            fontFamily="JetBrains Mono, monospace"
            fontWeight={700}
          >
            q = {input.loads.surchargeQ.toFixed(2)} {unitSystem === 'imperial' ? 'ksf' : 'kPa'}
          </text>
        </>
      )}

      {/* Water table */}
      {input.water.enabled && (() => {
        const yWater = stemTop - input.water.depthFromStemTop;
        return (
          <>
            <line
              x1={xW(stemBackX_bot)}
              y1={yW(yWater)}
              x2={xW(B + padR)}
              y2={yW(yWater + padR * Math.tan(g.backfillSlope))}
              stroke={C.water}
              strokeWidth={6}
              strokeDasharray="30 15"
            />
            <text
              x={xW(heelX + 100)}
              y={yW(yWater) - 30}
              fontSize={fsLabel}
              fill={C.water}
              fontFamily="JetBrains Mono, monospace"
              fontWeight={700}
            >
              W.T.
            </text>
          </>
        );
      })()}

      {/* Concrete (footing + stem + optional key) */}
      <polygon points={poly(footing)} fill={C.concrete} stroke={C.concreteStroke} strokeWidth={4} />
      <polygon points={poly(stem)} fill={C.concrete} stroke={C.concreteStroke} strokeWidth={4} />
      {keyShape && (
        <polygon points={poly(keyShape)} fill={C.concrete} stroke={C.concreteStroke} strokeWidth={4} />
      )}

      {/* ---- Active pressure triangle on stem back ---- */}
      {(() => {
        const sigmaBase = results.pressure.K * gammaBackfill * (H_total / 1000);
        const sigmaSurch = results.pressure.K * input.loads.surchargeQ;
        const maxDrawWidth = padL * 0.55;
        const scale = maxDrawWidth / Math.max(sigmaBase + sigmaSurch, 1);
        const wBase = (sigmaBase + sigmaSurch) * scale;
        const wTop = sigmaSurch * scale;
        // Triangle from stem-back-top ≡ (stemBackX_top, stemTop) along the INCLINED
        // back face down to footing bottom. Arrows point LEFT (into the stem).
        const backTopX = stemBackX_top;
        const backBotX = stemBackX_bot;
        const pts = [
          [backTopX, stemTop],
          [backTopX - wTop, stemTop],
          [backBotX - wBase, 0],
          [backBotX, 0],
        ];
        return (
          <g>
            <polygon
              points={poly(pts)}
              fill="rgba(255,107,107,0.25)"
              stroke={C.pressure}
              strokeWidth={3}
            />
            {/* Resultant arrow */}
            <line
              x1={xW(backBotX - wBase * 0.7)}
              y1={yW(results.pressure.yBar)}
              x2={xW(backBotX - wBase - 200)}
              y2={yW(results.pressure.yBar)}
              stroke={C.pressure}
              strokeWidth={8}
              markerEnd="url(#rw-arrow-red)"
            />
            <text
              x={xW(backBotX - wBase - 220)}
              y={yW(results.pressure.yBar) - 20}
              fontSize={fsLabel * 1.1}
              textAnchor="end"
              fill={C.pressure}
              fontFamily="JetBrains Mono, monospace"
              fontWeight={700}
            >
              Pa = {(results.pressure.Pa + results.pressure.Pq + results.pressure.Pw).toFixed(1)}{' '}
              {unitSystem === 'imperial' ? 'klf' : 'kN/m'}
            </text>
            <text
              x={xW(backBotX - wBase - 220)}
              y={yW(results.pressure.yBar) + fsLabel * 1.15}
              fontSize={fsLabel * 0.85}
              textAnchor="end"
              fill={C.pressure}
              fontFamily="JetBrains Mono, monospace"
            >
              σh = {sigmaBase.toFixed(1)} kPa
            </text>
          </g>
        );
      })()}

      {/* ---- Bearing stress diagram below footing ---- */}
      <g>
        <polygon
          points={poly(bearingPoly)}
          fill="rgba(61,215,141,0.25)"
          stroke={C.bearing}
          strokeWidth={3}
        />
        <text
          x={xW(0) + 10}
          y={yW(-qMax * qVisScale) + fsLabel + 10}
          fontSize={fsLabel}
          fill={C.bearing}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={700}
        >
          qmax = {qMax.toFixed(0)} {unitSystem === 'imperial' ? 'ksf' : 'kPa'}
        </text>
        {trapezoidal && (
          <text
            x={xW(B) - 10}
            y={yW(-qMin * qVisScale) + fsLabel + 10}
            fontSize={fsLabel}
            textAnchor="end"
            fill={C.bearing}
            fontFamily="JetBrains Mono, monospace"
            fontWeight={700}
          >
            qmin = {qMin.toFixed(0)}
          </text>
        )}
      </g>

      {/* ---- Dimensions ---- */}
      {dim(0, -padB * 0.55, stemFrontX, -padB * 0.55, mm(g.B_toe))}
      {dim(stemFrontX, -padB * 0.55, stemBackX_bot, -padB * 0.55, mm(g.t_stem_bot))}
      {dim(stemBackX_bot, -padB * 0.55, B, -padB * 0.55, mm(g.B_heel))}
      {dim(-padL * 0.45, 0, -padL * 0.45, footTop, mm(g.H_foot))}
      {dim(-padL * 0.45, footTop, -padL * 0.45, stemTop, mm(g.H_stem))}

      {/* ---- Member labels ---- */}
      <text
        x={xW(stemFrontX + g.t_stem_bot / 2)}
        y={yW(stemTop + 200)}
        fontSize={fsLabel * 1.3}
        textAnchor="middle"
        fill={C.label}
        fontFamily="Inter, sans-serif"
        fontWeight={700}
        letterSpacing="0.15em"
      >
        STEM
      </text>
      <text
        x={xW(B / 2)}
        y={yW(g.H_foot / 2) + fsLabel / 2}
        fontSize={fsLabel * 1.1}
        textAnchor="middle"
        fill="#0a0a0b"
        fontFamily="Inter, sans-serif"
        fontWeight={700}
        letterSpacing="0.15em"
      >
        FOOTING
      </text>
    </svg>
  );
}
