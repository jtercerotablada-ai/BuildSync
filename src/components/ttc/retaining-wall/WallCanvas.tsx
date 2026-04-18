'use client';

import React, { useMemo } from 'react';
import type { WallInput, WallResults } from '@/lib/retaining-wall/types';

interface Props {
  input: WallInput;
  results: WallResults;
}

export function WallCanvas({ input, results }: Props) {
  const { geometry: g } = input;
  const H_total = g.H_stem + g.H_foot;
  const B = g.B_toe + g.t_stem_bot + g.B_heel;

  // Leave room on all sides for labels, pressure diagram (left of stem),
  // bearing diagram (below footing), and the soil wedge behind the heel.
  const view = useMemo(() => {
    const marginL = Math.max(H_total * 0.35, 500); // left: pressure diagram + labels
    const marginR = Math.max(B * 0.35, 600); // right: backfill slope + surcharge arrows
    const marginT = Math.max(H_total * 0.25, 400); // top: surcharge label
    const marginB = Math.max(H_total * 0.6, 600); // bottom: bearing diagram + foundation soil
    const vbW = B + marginL + marginR;
    const vbH = H_total + marginT + marginB;
    // Shift: place wall toe at (marginL, marginT + H_stem)
    return {
      vbW,
      vbH,
      xOffset: marginL,
      yOffset: marginT,
    };
  }, [H_total, B]);

  // Wall coords helpers (origin at toe of footing, top-left of viewbox):
  // xWall(x) — wall-coord x in mm maps to viewBox x
  const xW = (x: number) => view.xOffset + x;
  // World y increases UPWARD, SVG y increases DOWNWARD. Footing bottom is at
  // view.yOffset + H_total. For a world-y coordinate measured from footing
  // bottom (up +), SVG y = view.yOffset + H_total − y.
  const yW = (y: number) => view.yOffset + H_total - y;

  const toeX = 0;
  const stemFrontX = g.B_toe;
  const stemBackX_top = g.B_toe + g.t_stem_top; // top of stem back face
  const stemBackX_bot = g.B_toe + g.t_stem_bot;
  const heelX = B;

  const footTop = g.H_foot; // y from footing bottom
  const stemTop = footTop + g.H_stem;

  // Backfill polygon behind stem (from heel up, includes sloping wedge)
  const dh = g.B_heel * Math.tan(g.backfillSlope); // mm rise over heel width
  const backfill = [
    [stemBackX_bot, footTop],
    [heelX, footTop],
    [heelX, stemTop + dh], // top of backfill at heel
    [stemBackX_top, stemTop],
  ];

  // Stem polygon
  const stem = [
    [stemFrontX, footTop],
    [stemBackX_bot, footTop],
    [stemBackX_top, stemTop],
    [stemFrontX, stemTop],
  ];

  // Footing polygon
  const footing = [
    [toeX, 0],
    [heelX, 0],
    [heelX, footTop],
    [toeX, footTop],
  ];

  // Key polygon (optional)
  const keyShape = g.key
    ? [
        [heelX - g.key.offsetFromHeel - g.key.width, 0],
        [heelX - g.key.offsetFromHeel, 0],
        [heelX - g.key.offsetFromHeel, -g.key.depth],
        [heelX - g.key.offsetFromHeel - g.key.width, -g.key.depth],
      ]
    : null;

  // Toe soil (front fill above footing, in front of stem)
  const toeSoil =
    g.frontFill > 0
      ? [
          [toeX, footTop],
          [stemFrontX, footTop],
          [stemFrontX, footTop + g.frontFill],
          [toeX, footTop + g.frontFill],
        ]
      : null;

  // Foundation soil (below footing, simple rectangle to bottom of viewbox)
  const foundationTop = 0;
  const foundationBottom = -Math.max(H_total * 0.55, 500);
  const foundationSoil = [
    [-Math.max(B * 0.3, 400), foundationTop],
    [heelX + Math.max(B * 0.3, 400), foundationTop],
    [heelX + Math.max(B * 0.3, 400), foundationBottom],
    [-Math.max(B * 0.3, 400), foundationBottom],
  ];

  // ======= Active pressure diagram (linear from 0 at top → σ_max at bottom) =======
  // For the schematic diagram we show Rankine triangular soil + rectangular surcharge + water.
  const Ka = results.pressure.K;
  const gammaAvg =
    input.backfill[0]?.gamma ?? 18; // simple for drawing; solver uses multi-layer
  const H_total_m = H_total / 1000;
  const sigmaSoilBase = Ka * gammaAvg * H_total_m; // kPa at base
  const sigmaSurchargeTop = Ka * input.loads.surchargeQ; // kPa (uniform over height)

  // Max horizontal "length" allowed for pressure diagram (mm, in drawing units)
  const pressureScale = (view.xOffset - 120) / Math.max(sigmaSoilBase + sigmaSurchargeTop, 1);
  // Pressure arrows originate on the back face of the stem, pointing left
  // (toward the wall / front). Back face: from (stemBackX_top, stemTop) to (heelX, footTop)
  // is sloped. For simplicity we draw arrows along the BACK face but in the
  // stem region only (stem back) — the portion on the backfill above heel is
  // carried by soil weight (computed in the solver).
  // The diagram below is purely illustrative: triangle on the stem back.
  const backBotX = stemBackX_bot; // front face of pressure arrows origin
  const pressureOriginY = (y: number) => y; // pass through

  // Bearing stress diagram under footing
  const { qMax, qMin, eccentricity, kern } = results.stability;
  const bearingScale = (foundationBottom - (-200)) / Math.max(qMax, 1); // negative since foundationBottom is below 0
  const bearingUnderTop = foundationTop; // y=0 top of soil (footing bottom)
  const trapezoidal = Math.abs(eccentricity) <= kern;

  // Stress polygon
  const bearingPolygon: [number, number][] = (() => {
    if (trapezoidal) {
      return [
        [toeX, bearingUnderTop],
        [heelX, bearingUnderTop],
        [heelX, bearingUnderTop - qMin * 1.2], // negative y → going down
        [toeX, bearingUnderTop - qMax * 1.2],
      ];
    }
    const Lc = 3 * (B / 2 - Math.abs(eccentricity));
    return [
      [toeX, bearingUnderTop],
      [toeX + Lc, bearingUnderTop],
      [toeX, bearingUnderTop - qMax * 1.2],
    ];
  })();

  // Helpers
  const poly = (pts: number[][]) =>
    pts.map(([x, y]) => `${xW(x).toFixed(1)},${yW(y).toFixed(1)}`).join(' ');

  const dim = (x1: number, y1: number, x2: number, y2: number, text: string) => {
    const mx = (xW(x1) + xW(x2)) / 2;
    const my = (yW(y1) + yW(y2)) / 2;
    const vertical = Math.abs(x1 - x2) < 1;
    return (
      <g className="rw-viz__dim">
        <line x1={xW(x1)} y1={yW(y1)} x2={xW(x2)} y2={yW(y2)} stroke="#c9a84c" strokeWidth={1.2} />
        <line x1={xW(x1) - 6} y1={yW(y1)} x2={xW(x1) + 6} y2={yW(y1)} stroke="#c9a84c" strokeWidth={1.2} />
        <line x1={xW(x2) - 6} y1={yW(y2)} x2={xW(x2) + 6} y2={yW(y2)} stroke="#c9a84c" strokeWidth={1.2} />
        <text
          x={vertical ? mx + 10 : mx}
          y={vertical ? my : my - 6}
          fontSize={22}
          textAnchor={vertical ? 'start' : 'middle'}
          fill="#c9a84c"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          {text}
        </text>
      </g>
    );
  };

  const mm = (v: number) => (v / 1000).toFixed(2);

  return (
    <svg
      viewBox={`0 0 ${view.vbW} ${view.vbH}`}
      className="rw-viz__svg"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Retaining wall section"
    >
      <defs>
        <pattern id="rw-backfill" patternUnits="userSpaceOnUse" width={30} height={30} patternTransform="rotate(35)">
          <rect width={30} height={30} fill="rgba(193, 153, 98, 0.35)" />
          <line x1={0} y1={0} x2={0} y2={30} stroke="rgba(193, 153, 98, 0.9)" strokeWidth={2} />
        </pattern>
        <pattern id="rw-foundation" patternUnits="userSpaceOnUse" width={40} height={40} patternTransform="rotate(-35)">
          <rect width={40} height={40} fill="rgba(140, 110, 70, 0.25)" />
          <line x1={0} y1={0} x2={0} y2={40} stroke="rgba(140, 110, 70, 0.6)" strokeWidth={1.5} />
        </pattern>
        <pattern id="rw-water" patternUnits="userSpaceOnUse" width={20} height={8}>
          <path d="M 0 4 Q 5 0 10 4 T 20 4" stroke="rgba(92, 168, 212, 0.8)" strokeWidth={1.2} fill="none" />
        </pattern>
        <marker id="rw-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#ff6b6b" />
        </marker>
        <marker id="rw-arrow-up" markerWidth="10" markerHeight="10" refX="3" refY="8" orient="auto" markerUnits="strokeWidth">
          <path d="M0,9 L6,9 L3,0 z" fill="#3dd78d" />
        </marker>
      </defs>

      {/* Foundation soil */}
      <polygon points={poly(foundationSoil)} fill="url(#rw-foundation)" />
      <line
        x1={xW(-Math.max(B * 0.3, 400))}
        y1={yW(0)}
        x2={xW(heelX + Math.max(B * 0.3, 400))}
        y2={yW(0)}
        stroke="rgba(140,110,70,0.85)"
        strokeWidth={1.5}
      />

      {/* Backfill behind wall */}
      <polygon points={poly(backfill)} fill="url(#rw-backfill)" stroke="rgba(193,153,98,0.95)" strokeWidth={1.5} />

      {/* Backfill extends into the distance on the right (slope or level) */}
      {(() => {
        const xExtend = heelX + Math.max(B * 0.3, 400);
        const yExtendTop = stemTop + dh + (xExtend - heelX) * Math.tan(g.backfillSlope);
        const pts = [
          [heelX, footTop],
          [xExtend, footTop],
          [xExtend, yExtendTop],
          [heelX, stemTop + dh],
        ];
        return <polygon points={poly(pts)} fill="url(#rw-backfill)" stroke="rgba(193,153,98,0.6)" strokeWidth={1} />;
      })()}

      {/* Toe soil (front fill) */}
      {toeSoil && <polygon points={poly(toeSoil)} fill="url(#rw-foundation)" stroke="rgba(140,110,70,0.6)" strokeWidth={1} />}

      {/* Toe soil extending to the left */}
      {g.frontFill > 0 && (
        <polygon
          points={poly([
            [-Math.max(B * 0.3, 400), footTop],
            [toeX, footTop],
            [toeX, footTop + g.frontFill],
            [-Math.max(B * 0.3, 400), footTop + g.frontFill],
          ])}
          fill="url(#rw-foundation)"
          stroke="rgba(140,110,70,0.6)"
          strokeWidth={1}
        />
      )}

      {/* Concrete shapes (footing, stem, optional key) */}
      <polygon points={poly(footing)} fill="#d3d3d3" stroke="#8a8a8a" strokeWidth={2} />
      <polygon points={poly(stem)} fill="#d3d3d3" stroke="#8a8a8a" strokeWidth={2} />
      {keyShape && <polygon points={poly(keyShape)} fill="#d3d3d3" stroke="#8a8a8a" strokeWidth={2} />}

      {/* Water table line */}
      {input.water.enabled && (() => {
        const yWater = stemTop - input.water.depthFromStemTop;
        return (
          <>
            <line
              x1={xW(stemBackX_bot + (yWater - footTop) / g.H_stem * (g.t_stem_top - g.t_stem_bot))}
              y1={yW(yWater)}
              x2={xW(heelX + Math.max(B * 0.3, 400))}
              y2={yW(yWater + (Math.max(B * 0.3, 400)) * Math.tan(g.backfillSlope))}
              stroke="#5ca8d4"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
            <text
              x={xW(heelX + 50)}
              y={yW(yWater) - 10}
              fontSize={22}
              fill="#5ca8d4"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              W.T.
            </text>
          </>
        );
      })()}

      {/* Surcharge arrows */}
      {input.loads.surchargeQ > 0 && (
        <g>
          {Array.from({ length: 6 }).map((_, i) => {
            const x = stemBackX_bot + (g.B_heel / 5) * i;
            const yBot = stemTop + (x - heelX + g.B_heel) / g.B_heel * dh;
            const yTop = yBot + Math.max(H_total * 0.1, 400);
            return (
              <line
                key={i}
                x1={xW(x)}
                y1={yW(yTop)}
                x2={xW(x)}
                y2={yW(yBot + 20)}
                stroke="#ff6b6b"
                strokeWidth={2}
                markerEnd="url(#rw-arrow)"
              />
            );
          })}
          <text
            x={xW((stemBackX_bot + heelX) / 2)}
            y={yW(stemTop + Math.max(H_total * 0.13, 500))}
            fontSize={22}
            textAnchor="middle"
            fill="#ff6b6b"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            q = {input.loads.surchargeQ.toFixed(1)} kPa
          </text>
        </g>
      )}

      {/* Active pressure triangle on the back of the stem */}
      {(() => {
        const yTop = stemTop;
        const yBotFoot = 0; // bottom of footing
        // Simplified triangle from stem top to footing bottom on the back face
        // Draw at the x of stem back bottom; width proportional to σ
        const sigmaBase = sigmaSoilBase + sigmaSurchargeTop;
        const width = sigmaBase * pressureScale;
        const sigmaTop = sigmaSurchargeTop * pressureScale; // rectangle from surcharge
        const pts = [
          [backBotX, yTop],
          [backBotX + sigmaTop, yTop],
          [backBotX + width, yBotFoot],
          [backBotX, yBotFoot],
        ];
        return (
          <g opacity={0.9}>
            <polygon
              points={poly(pts)}
              fill="rgba(255,107,107,0.2)"
              stroke="#ff6b6b"
              strokeWidth={1.5}
            />
            {/* Pressure label */}
            <text
              x={xW(backBotX + width + 20)}
              y={yW(yBotFoot) - 6}
              fontSize={20}
              fill="#ff6b6b"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              σh = {sigmaBase.toFixed(1)} kPa
            </text>
            {/* Arrow showing resultant */}
            <line
              x1={xW(backBotX + width * 0.8)}
              y1={yW(results.pressure.yBar)}
              x2={xW(backBotX - 40)}
              y2={yW(results.pressure.yBar)}
              stroke="#ff6b6b"
              strokeWidth={3}
              markerEnd="url(#rw-arrow)"
            />
            <text
              x={xW(backBotX - 50)}
              y={yW(results.pressure.yBar) - 10}
              fontSize={22}
              textAnchor="end"
              fill="#ff6b6b"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              Pa = {(results.pressure.Pa + results.pressure.Pq + results.pressure.Pw).toFixed(1)} kN/m
            </text>
          </g>
        );
      })()}

      {/* Bearing stress diagram under footing */}
      <g opacity={0.85}>
        <polygon
          points={poly(bearingPolygon)}
          fill="rgba(61,215,141,0.18)"
          stroke="#3dd78d"
          strokeWidth={1.5}
        />
        <text
          x={xW(toeX)}
          y={yW(bearingUnderTop - qMax * 1.2) + 30}
          fontSize={22}
          fill="#3dd78d"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          qmax = {qMax.toFixed(0)} kPa
        </text>
        {trapezoidal && (
          <text
            x={xW(heelX)}
            y={yW(bearingUnderTop - qMin * 1.2) + 30}
            fontSize={22}
            textAnchor="end"
            fill="#3dd78d"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            qmin = {qMin.toFixed(0)} kPa
          </text>
        )}
      </g>

      {/* Dimensions */}
      {/* B_toe */}
      {dim(toeX, -200, stemFrontX, -200, `${mm(g.B_toe)} m`)}
      {/* B_stem */}
      {dim(stemFrontX, -200, stemBackX_bot, -200, `${mm(g.t_stem_bot)} m`)}
      {/* B_heel */}
      {dim(stemBackX_bot, -200, heelX, -200, `${mm(g.B_heel)} m`)}
      {/* H_stem */}
      {dim(-250, footTop, -250, stemTop, `${mm(g.H_stem)} m`)}
      {/* H_foot */}
      {dim(-250, 0, -250, footTop, `${mm(g.H_foot)} m`)}

      {/* Labels */}
      <text
        x={xW(stemFrontX + g.t_stem_bot / 2)}
        y={yW(stemTop + Math.max(H_total * 0.05, 200))}
        fontSize={24}
        textAnchor="middle"
        fill="#f2efe4"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        STEM
      </text>
      <text
        x={xW(B / 2)}
        y={yW(g.H_foot / 2)}
        fontSize={20}
        textAnchor="middle"
        fill="#0a0a0b"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        FOOTING
      </text>
    </svg>
  );
}
