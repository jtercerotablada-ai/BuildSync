'use client';

import React, { useMemo } from 'react';
import type { WallInput, WallResults } from '@/lib/retaining-wall/types';
import type { UnitSystem } from '@/lib/beam/units';

/**
 * 2D view sub-mode — CYPE separates the section drawing into focused views,
 * each one showing only what's relevant to that aspect. We do the same so
 * the section never feels cluttered.
 *
 *   • 'arch'      — Architecture: concrete + soil + dimensions + ground
 *                   elevation labels. The clean default.
 *   • 'loads'     — Architecture + surcharge / point-load arrows.
 *   • 'pressures' — Architecture + active / passive / bearing diagrams.
 *   • 'rebar'     — Architecture (faded) + all rebar + cyan annotations.
 */
export type WallView2DMode = 'arch' | 'loads' | 'pressures' | 'rebar';

interface Props {
  input: WallInput;
  results: WallResults;
  unitSystem?: UnitSystem;
  mode?: WallView2DMode;
}

/**
 * Engineering section view of a cantilever retaining wall — textbook
 * presentation style.
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
// Palette — matched to the TTC dark theme (same look as Section Builder)
const C = {
  grid: 'rgba(201,168,76,0.05)', // gold-tinted gridline, very subtle
  soilTop: '#a57846',             // lighter brown (top of backfill)
  soilMid: '#875a2e',             // mid brown
  soilBot: '#5e3d1c',             // darker brown (foundation)
  soilStroke: '#3a2410',
  pebbleLight: '#c4925a',
  pebbleDark: '#4a2e12',
  grass: '#5aae3a',
  grassEdge: '#3d7a23',
  concrete: '#c4cbd1',
  concreteEdge: '#7d858f',
  // Drainage system — gray gravel + white pipe (matches reference images)
  gravel:       '#8d8d8a',         // base gravel band fill
  gravelStroke: '#3a3a36',
  gravelLight:  '#c8c8c2',
  gravelDark:   '#5a5a55',
  pipeWhite:    '#ececec',
  pipeShadow:   '#a8a8a8',
  active: '#f0c839',              // yellow = active pressure
  activeLight: 'rgba(240,200,57,0.22)',
  passive: '#46b93d',             // green = passive + surcharge arrows
  passiveLight: 'rgba(70,185,61,0.22)',
  water: '#5dc4d4',
  bearing: '#ef6565',             // red = bearing reaction (upward)
  bearingLight: 'rgba(239,101,101,0.22)',
  dim: 'var(--color-accent, #c9a84c)', // TTC gold for dimensions
  dimHex: '#c9a84c',
  pillFill: 'rgba(20,20,24,0.92)',     // dark pill on dark canvas
  pillStroke: 'rgba(201,168,76,0.55)', // gold border
  pillText: '#f2efe4',                 // light cream text
  label: '#f2efe4',
  callout: '#f2efe4',                  // leader-line text colour (cream)
  calloutDot: '#c9a84c',                // small dot at the end of the leader line
  // Rebar — CYPE convention: red bars + cyan annotations
  rebar:        '#e8472f',             // bright red, the rebar itself
  rebarOutline: '#5a1106',
  rebarLabel:   '#5dc4d4',             // cyan, the bar-callout text
  rebarLabelBg: 'rgba(10,28,32,0.9)',
};

/**
 * Pick a rebar diameter (mm) and spacing (mm) given a required area
 * As_req (mm²/m). Walks a standard #4–#10 catalog and picks the smallest
 * diameter with spacing in [80, sMax] mm.
 */
function pickBarLayout(As_req: number, sMax: number = 300):
  { db: number; ab: number; spacing: number; label: string } {
  const catalog: Array<{ db: number; ab: number; label: string }> = [
    { db: 12.7, ab: 129, label: '#4' },
    { db: 15.9, ab: 199, label: '#5' },
    { db: 19.1, ab: 284, label: '#6' },
    { db: 22.2, ab: 387, label: '#7' },
    { db: 25.4, ab: 510, label: '#8' },
    { db: 28.7, ab: 645, label: '#9' },
    { db: 32.3, ab: 819, label: '#10' },
  ];
  for (const bar of catalog) {
    const s = (1000 * bar.ab) / Math.max(As_req, 1);
    if (s <= sMax && s >= 80) {
      return { db: bar.db, ab: bar.ab, spacing: s, label: bar.label };
    }
  }
  const last = catalog[catalog.length - 1];
  return { db: last.db, ab: last.ab, spacing: 80, label: last.label };
}

export function WallCanvas({ input, results, unitSystem = 'metric', mode = 'arch' }: Props) {
  const { geometry: g } = input;
  const H_total = g.H_stem + g.H_foot;
  const B = g.B_toe + g.t_stem_bot + g.B_heel;
  // CYPE-style sub-mode flags. Architecture base is always shown; the rest
  // toggle on the chosen view.
  const showSurcharge = mode === 'loads';
  const showPressures = mode === 'pressures';
  const showRebar     = mode === 'rebar';
  // Architecture callouts (Fuste/Punta/Talón/Relleno…) only on the
  // Architecture and Loads views — Pressures/Rebar have their own labels
  // that would compete with the structural labels.
  const showArchCallouts = mode === 'arch' || mode === 'loads';

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
  // Foundation extends UP to the top of the footing so it wraps around the
  // sides of the buried footing — the concrete footing polygon drawn later
  // covers the middle strip. This eliminates the "hueco"/gap that showed on
  // either side of the footing when foundation only covered y < 0.
  const foundation: [number, number][] = [
    [xLeft, footTop],
    [xRight, footTop],
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

  // ─── DRAINAGE SYSTEM (best-practice behind the wall) ───────────────────
  // Gravel pack against rear face of the stem, full stem height, plus a
  // perforated pipe at the base. Defaults to enabled (best practice per
  // every retaining-wall textbook); user can disable for unusual cases.
  const drainage = input.drainage ?? { enabled: true, gravelThickness: 300, pipeDiameter: 100 };
  const gravelThickness = drainage.enabled ? drainage.gravelThickness : 0;
  const pipeDiameter   = drainage.enabled ? drainage.pipeDiameter   : 0;
  const gravelPoly: [number, number][] = drainage.enabled ? [
    [stemBackX_bot, footTop],
    [stemBackX_bot + gravelThickness, footTop],
    [stemBackX_top + gravelThickness, stemTop],
    [stemBackX_top, stemTop],
  ] : [];
  const pipeCx = stemBackX_bot + gravelThickness / 2;
  const pipeCy = footTop + pipeDiameter / 2 + 30; // 30 mm above footing for the gravel bed

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

  // ─── REBAR layouts (computed from calculated As) ───────────────────────
  // CYPE-style annotation: section view shows the actual chosen bar
  // diameter and spacing (#6@180 etc.), so engineers can read the design
  // straight off the drawing.
  const cover = input.concrete.cover; // mm
  const stemVert2D = pickBarLayout(results.stem.As_req, 300);
  const As_horiz_2D = results.stem.horizontalReinforcement?.As_horizontal_per_m
                       ?? 0.0020 * 1000 * g.t_stem_bot;
  const sMax_horiz_2D = results.stem.horizontalReinforcement?.s_max
                          ?? Math.min(3 * g.t_stem_bot, 450);
  const stemHoriz2D = pickBarLayout(As_horiz_2D, sMax_horiz_2D);
  const heelTop2D = pickBarLayout(results.heel.As_req, 300);
  const toeBot2D = pickBarLayout(results.toe.As_req, 300);
  // Footing longitudinal distribution bars — minimum #4 @ 300 mm
  const footLong2D = { db: 12.7, label: '#4', spacing: 300 };

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
          <path d="M0,0 L0,7 L9,3.5 z" fill={C.dimHex} />
        </marker>
        <marker id="rw-arr-o-start" markerWidth="10" markerHeight="10" refX="1" refY="3.5" orient="auto">
          <path d="M9,0 L9,7 L0,3.5 z" fill={C.dimHex} />
        </marker>
      </defs>

      {/* Subtle gold-tinted grid on top of the canvas dark gradient */}
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
          // Foundation now wraps around the sides of the footing. A pebble is
          // in foundation if it's below footing bottom OR beside the footing
          // (outside x in [0, B]) and below footTop.
          const inFoundation =
            p.cy < 0 + 50 ||
            (p.cy < footTop && (p.cx < 0 || p.cx > B));
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

      {/* ─── DRAINAGE GRAVEL (gray pack between stem rear face + backfill) ─── */}
      {drainage.enabled && (
        <g>
          <polygon
            points={poly(gravelPoly)}
            fill={C.gravel}
            stroke={C.gravelStroke}
            strokeWidth={3}
          />
          {/* Gravel "pebbles" texture inside the gravel band */}
          {(() => {
            const gravelSeed = Math.floor(stemTop + gravelThickness * 13);
            const rng = mulberry32(gravelSeed);
            const count = Math.floor((stemTop - footTop) * gravelThickness / 12000);
            const els: React.ReactElement[] = [];
            for (let i = 0; i < count; i++) {
              const t = rng();
              const tt = rng();
              // Interpolate the gravel band width that tapers with the stem
              const yy = footTop + t * (stemTop - footTop);
              const taperT = (yy - footTop) / Math.max(stemTop - footTop, 1);
              const xLeftBand = stemBackX_bot + (stemBackX_top - stemBackX_bot) * taperT;
              const xRightBand = xLeftBand + gravelThickness;
              const xx = xLeftBand + tt * (xRightBand - xLeftBand);
              const r = 18 + rng() * 24;
              els.push(
                <circle key={`gv-${i}`}
                  cx={xW(xx)} cy={yW(yy)} r={r}
                  fill={rng() > 0.5 ? C.gravelLight : C.gravelDark}
                  opacity={0.7} />,
              );
            }
            return els;
          })()}
        </g>
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

      {/* ─── REBAR — drawn ON TOP of concrete (CYPE-style) ──────────────────
          • Vertical bars in the stem (run in-plane) → vertical RED line
          • Horizontal bars (run perpendicular to section) → DOTS at heights
          • Footing transverse mats (run in-plane) → horizontal RED lines
          • Footing longitudinal bars (run perpendicular) → DOTS across width
          • Cap beam at top of stem → 2 dots                                 */}
      {showRebar && (() => {
        // Stem face X at any Y (taper interpolation). Front face is vertical
        // in this implementation; back face tapers from t_bot to t_top.
        const stemFrontXAt = (_y: number) => stemFrontX;
        const stemBackXAt = (y: number) => {
          const t = Math.max(0, Math.min(1, (y - footTop) / Math.max(g.H_stem, 1)));
          return stemBackX_bot + (stemBackX_top - stemBackX_bot) * t;
        };
        const els: React.ReactElement[] = [];

        // ═══ Stem vertical bar (rear face, main flexural rebar) ═══
        const dbSV = stemVert2D.db;
        const yBotDev = footTop - g.H_foot * 0.6; // anchor development depth
        const yTopBend = stemTop - cover;
        const xRearBot = stemBackXAt(footTop) - cover - dbSV / 2;
        const xRearTop = stemBackXAt(yTopBend) - cover - dbSV / 2;
        // 2-segment polyline: starts in footing, comes up rear face
        els.push(
          <polyline key="stem-vert"
            points={[
              [xW(xRearBot), yW(yBotDev)].join(','),
              [xW(xRearBot), yW(footTop)].join(','),
              [xW(xRearTop), yW(yTopBend)].join(','),
            ].join(' ')}
            fill="none" stroke={C.rebar}
            strokeWidth={Math.max(dbSV * 1.6, 14)}
            strokeLinecap="round" strokeLinejoin="round" />
        );
        // Hook at the bottom (extends toward toe ~ R13.3.6 commentary)
        const hookLen = Math.max(12 * dbSV, 150);
        els.push(
          <line key="stem-hook"
            x1={xW(xRearBot)} y1={yW(yBotDev)}
            x2={xW(xRearBot - hookLen)} y2={yW(yBotDev)}
            stroke={C.rebar} strokeWidth={Math.max(dbSV * 1.6, 14)}
            strokeLinecap="round" />
        );

        // ═══ Stem horizontal bars (dots at multiple heights, both faces) ═══
        const sHoriz = stemHoriz2D.spacing;
        const dbSH = stemHoriz2D.db;
        const yStartH = footTop + cover + dbSH;
        const yEndH = stemTop - cover - dbSH * 2;
        const nHoriz = Math.max(2, Math.floor((yEndH - yStartH) / sHoriz) + 1);
        const dyHoriz = (yEndH - yStartH) / Math.max(nHoriz - 1, 1);
        const rDot = Math.max(dbSH * 0.95, 11);
        for (let i = 0; i < nHoriz; i++) {
          const yi = yStartH + i * dyHoriz;
          const xR = stemBackXAt(yi) - cover - dbSH / 2;
          const xF = stemFrontXAt(yi) + cover + dbSH / 2;
          els.push(
            <circle key={`sh-r-${i}`} cx={xW(xR)} cy={yW(yi)} r={rDot}
              fill={C.rebar} stroke={C.rebarOutline} strokeWidth={2} />
          );
          els.push(
            <circle key={`sh-f-${i}`} cx={xW(xF)} cy={yW(yi)} r={rDot}
              fill={C.rebar} stroke={C.rebarOutline} strokeWidth={2} />
          );
        }

        // ═══ Cap beam (2#4 at top of stem) ═══
        const capDb = 12.7;
        const yCap = stemTop - cover - capDb / 2;
        const xCapR = stemBackXAt(yCap) - cover - capDb / 2;
        const xCapF = stemFrontXAt(yCap) + cover + capDb / 2;
        const rCap = Math.max(capDb * 1.1, 14);
        els.push(
          <circle key="cap-r" cx={xW(xCapR)} cy={yW(yCap)} r={rCap}
            fill={C.rebar} stroke={C.rebarOutline} strokeWidth={3} />
        );
        els.push(
          <circle key="cap-f" cx={xW(xCapF)} cy={yW(yCap)} r={rCap}
            fill={C.rebar} stroke={C.rebarOutline} strokeWidth={3} />
        );

        // ═══ Footing TOP mat — transverse bars (heel reinforcement) ═══
        const dbTop = heelTop2D.db;
        const yTopMat = footTop - cover - dbTop / 2;
        els.push(
          <line key="ft-top"
            x1={xW(cover)} y1={yW(yTopMat)}
            x2={xW(B - cover)} y2={yW(yTopMat)}
            stroke={C.rebar} strokeWidth={Math.max(dbTop * 1.6, 12)}
            strokeLinecap="round" />
        );

        // ═══ Footing BOTTOM mat — transverse bars (toe reinforcement) ═══
        const dbBot = toeBot2D.db;
        const yBotMat = cover + dbBot / 2;
        els.push(
          <line key="ft-bot"
            x1={xW(cover)} y1={yW(yBotMat)}
            x2={xW(B - cover)} y2={yW(yBotMat)}
            stroke={C.rebar} strokeWidth={Math.max(dbBot * 1.6, 12)}
            strokeLinecap="round" />
        );

        // ═══ Footing LONGITUDINAL bars (dots, top + bottom mats) ═══
        const sLong = footLong2D.spacing;
        const dbLong = footLong2D.db;
        const nLong = Math.max(3, Math.floor((B - 2 * cover) / sLong) + 1);
        const dxLong = (B - 2 * cover) / Math.max(nLong - 1, 1);
        const rLong = Math.max(dbLong * 0.85, 9);
        for (let i = 0; i < nLong; i++) {
          const xi = cover + i * dxLong;
          // Top mat dot — sits ABOVE the transverse top bars
          const yT = footTop - cover - dbTop - dbLong / 2;
          // Bottom mat dot — sits BELOW the transverse bottom bars
          const yB = cover + dbBot + dbLong / 2;
          els.push(
            <circle key={`fl-t-${i}`} cx={xW(xi)} cy={yW(yT)} r={rLong}
              fill={C.rebar} stroke={C.rebarOutline} strokeWidth={2} />
          );
          els.push(
            <circle key={`fl-b-${i}`} cx={xW(xi)} cy={yW(yB)} r={rLong}
              fill={C.rebar} stroke={C.rebarOutline} strokeWidth={2} />
          );
        }

        return <g>{els}</g>;
      })()}

      {/* ─── REBAR ANNOTATIONS (CYPE-style: cyan callouts with leader) ─────
          Each label sits in clear space and points at the rebar group
          with a thin cyan line + dot, just like CYPE's reinforcement
          drawings. Labels include the bar size and spacing in mm.        */}
      {showRebar && (() => {
        const stemBackXAt = (y: number) => {
          const t = Math.max(0, Math.min(1, (y - footTop) / Math.max(g.H_stem, 1)));
          return stemBackX_bot + (stemBackX_top - stemBackX_bot) * t;
        };
        const labels: Array<{
          tx: number; ty: number; dx: number; dy: number; text: string;
        }> = [
          // Stem vertical
          {
            text: `${stemVert2D.label}@${stemVert2D.spacing.toFixed(0)} (fuste vert.)`,
            tx: xW(stemFrontX - 1100),
            ty: yW(stemTop - g.H_stem * 0.45),
            dx: xW(stemBackXAt(stemTop - g.H_stem * 0.45) - cover),
            dy: yW(stemTop - g.H_stem * 0.45),
          },
          // Stem horizontal
          {
            text: `${stemHoriz2D.label}@${stemHoriz2D.spacing.toFixed(0)} (fuste horiz.)`,
            tx: xW(stemBackX_bot + 900),
            ty: yW(stemTop - g.H_stem * 0.18),
            dx: xW(stemBackXAt(stemTop - g.H_stem * 0.18) - cover * 1.5),
            dy: yW(stemTop - g.H_stem * 0.18),
          },
          // Cap beam
          {
            text: '2 #4 (cabeza)',
            tx: xW(stemFrontX - 1100),
            ty: yW(stemTop + 100),
            dx: xW(stemFrontX + 50),
            dy: yW(stemTop - cover * 1.5),
          },
          // Heel top
          {
            text: `${heelTop2D.label}@${heelTop2D.spacing.toFixed(0)} (talón sup.)`,
            tx: xW(B + 700),
            ty: yW(footTop + 250),
            dx: xW((stemBackX_bot + B) / 2),
            dy: yW(footTop - cover - heelTop2D.db / 2),
          },
          // Toe bottom
          {
            text: `${toeBot2D.label}@${toeBot2D.spacing.toFixed(0)} (punta inf.)`,
            tx: xW(B / 2 - 600),
            ty: yW(-padB * 0.32),
            dx: xW(B / 2),
            dy: yW(cover + toeBot2D.db / 2),
          },
          // Footing longitudinal
          {
            text: `${footLong2D.label}@${footLong2D.spacing} (long. zapata)`,
            tx: xW(0 + 200),
            ty: yW(-padB * 0.32),
            dx: xW(g.B_toe * 0.5),
            dy: yW(cover + toeBot2D.db + footLong2D.db / 2),
          },
        ];
        return (
          <g>
            {labels.map((lb, i) => (
              <g key={`rebar-lb-${i}`}>
                {/* leader line */}
                <line
                  x1={lb.tx} y1={lb.ty}
                  x2={lb.dx} y2={lb.dy}
                  stroke={C.rebarLabel} strokeWidth={3}
                  strokeDasharray="6 4" opacity={0.85}
                />
                {/* dot at the rebar end */}
                <circle cx={lb.dx} cy={lb.dy} r={9}
                  fill={C.rebarLabel} stroke="#04181c" strokeWidth={2.5} />
                {/* label background pill */}
                {(() => {
                  const padX = fs.sm * 0.5;
                  const padY = fs.sm * 0.25;
                  const w = lb.text.length * fs.sm * 0.48 + padX * 2;
                  const h = fs.sm + padY * 2;
                  return (
                    <rect
                      x={lb.tx - w / 2} y={lb.ty - h / 2}
                      width={w} height={h}
                      rx={h * 0.3} ry={h * 0.3}
                      fill={C.rebarLabelBg}
                      stroke={C.rebarLabel} strokeWidth={2}
                    />
                  );
                })()}
                {/* label text */}
                <text
                  x={lb.tx} y={lb.ty + fs.sm * 0.34}
                  fontSize={fs.sm}
                  textAnchor="middle"
                  fill={C.rebarLabel}
                  fontFamily="ui-monospace, 'SF Mono', monospace"
                  fontWeight={700}
                  letterSpacing="0.02em"
                >
                  {lb.text}
                </text>
              </g>
            ))}
          </g>
        );
      })()}

      {/* ─── DRAINAGE PIPE (perforated, white circle near base of gravel) ─── */}
      {drainage.enabled && pipeDiameter > 0 && (
        <g>
          {/* Outer pipe wall */}
          <circle cx={xW(pipeCx)} cy={yW(pipeCy)} r={pipeDiameter / 2}
            fill={C.pipeWhite} stroke={C.pipeShadow} strokeWidth={5} />
          {/* Inner shadow */}
          <circle cx={xW(pipeCx)} cy={yW(pipeCy)} r={pipeDiameter / 2 * 0.65}
            fill="rgba(0,0,0,0.45)" />
          {/* Perforation marks (small holes) */}
          {Array.from({ length: 6 }).map((_, i) => {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
            const r = pipeDiameter / 2 * 0.75;
            const px = xW(pipeCx) + Math.cos(a) * r;
            const py = yW(pipeCy) + Math.sin(a) * r;
            return <circle key={`p-${i}`} cx={px} cy={py} r={pipeDiameter * 0.08}
                          fill={C.pipeShadow} />;
          })}
        </g>
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
      {showSurcharge && input.loads.surchargeQ > 0 && (
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
      {showPressures && pressMax > 1 && (
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
            textColor={C.label}
          />
        </g>
      )}

      {/* ─── PASSIVE PRESSURE (green triangle on toe side) ─── */}
      {showPressures && input.baseSoil.passiveEnabled && g.frontFill > 0 && (() => {
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
      {showPressures && <g>
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
          textColor={C.label}
        />
      </g>}

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
        color: C.dimHex,
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
        color: C.dimHex,
      })}

      {/* ─── SPANISH CALLOUTS — leader-line + dot + label ─────────────────────
          Estilo educativo / didáctico en español, con líneas guía
          terminadas en un pequeño punto dorado sobre el elemento que
          identifican (estilo de las imágenes de referencia ACI / SkyBird /
          textbooks profesionales).
          Sólo en Architecture y Loads (en Pressures/Rebar competirían con
          los callouts propios de cada vista).                              */}
      {showArchCallouts && (() => {
        const items: Array<{ side: 'left' | 'right'; tx: number; ty: number;
                             dx: number; dy: number; text: string; fs: number }> = [];

        // Stem / wall body — left side
        items.push({
          side: 'left',
          tx: xW(xLeft + 200),
          ty: yW(stemTop - g.H_stem * 0.35),
          dx: xW(stemFrontX + g.t_stem_bot * 0.5),
          dy: yW(stemTop - g.H_stem * 0.35),
          text: 'Fuste',
          fs: fs.sm,
        });
        // Punta (toe) — left side, lower
        if (g.B_toe > 0) {
          items.push({
            side: 'left',
            tx: xW(xLeft + 200),
            ty: yW(g.H_foot * 0.5 - padB * 0.05),
            dx: xW(g.B_toe * 0.5),
            dy: yW(g.H_foot * 0.5),
            text: 'Punta',
            fs: fs.sm,
          });
        }
        // Talón (heel) — right side
        items.push({
          side: 'right',
          tx: xW(B + padR * 0.5),
          ty: yW(g.H_foot * 0.4 - padB * 0.06),
          dx: xW((stemBackX_bot + B) / 2),
          dy: yW(g.H_foot * 0.5),
          text: 'Talón',
          fs: fs.sm,
        });
        // Suelo de cimentación — bottom-left
        items.push({
          side: 'left',
          tx: xW(xLeft + 250),
          ty: yW(-padB * 0.55),
          dx: xW(B * 0.25),
          dy: yW(-padB * 0.30),
          text: 'Suelo de cimentación',
          fs: fs.sm,
        });
        // Relleno — far right, upper-right corner
        items.push({
          side: 'right',
          tx: xW(B + padR * 0.5),
          ty: yW(stemTop - g.H_stem * 0.3),
          dx: xW(B + padR * 0.18),
          dy: yW(stemTop - g.H_stem * 0.3),
          text: 'Relleno',
          fs: fs.sm,
        });
        // Drainage labels — only when drainage is enabled
        if (drainage.enabled) {
          items.push({
            side: 'right',
            tx: xW(B + padR * 0.5),
            ty: yW(stemTop - g.H_stem * 0.6),
            dx: xW(stemBackX_bot + gravelThickness * 0.5),
            dy: yW(stemTop - g.H_stem * 0.55),
            text: 'Grava drenante',
            fs: fs.sm,
          });
          if (pipeDiameter > 0) {
            items.push({
              side: 'right',
              tx: xW(B + padR * 0.5),
              ty: yW(stemTop - g.H_stem * 0.85),
              dx: xW(pipeCx),
              dy: yW(pipeCy),
              text: 'Tubo de drenaje',
              fs: fs.sm,
            });
          }
        }
        return items.map((it, i) => (
          <Callout key={`cal-${i}`} {...it} />
        ));
      })()}
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
  textColor?: string;
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
        fill="rgba(20,20,24,0.92)"
        stroke="rgba(201,168,76,0.55)"
        strokeWidth={3}
      />
      <text
        x={x}
        y={y + fs * 0.34}
        fontSize={fs}
        textAnchor="middle"
        fill={textColor ?? '#f2efe4'}
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

// ─────────────────────────────────────────────────────────────────────────────
// Callout — leader line + dot + label, matches the reference-image style
// ("Fuste", "Talón", "Grava drenante", etc).
function Callout({
  side, tx, ty, dx, dy, text, fs,
}: {
  side: 'left' | 'right';
  tx: number; ty: number;       // text anchor position (svg coords)
  dx: number; dy: number;       // dot position (on the element being labeled)
  text: string; fs: number;
}) {
  // The leader line has 2 segments: horizontal stub from the text, then a
  // diagonal to the dot.
  const stub = side === 'left' ? +60 : -60;
  return (
    <g>
      <line
        x1={tx + (side === 'left' ? 8 : -8)} y1={ty}
        x2={tx + stub} y2={ty}
        stroke="#f2efe4" strokeWidth={3}
      />
      <line
        x1={tx + stub} y1={ty}
        x2={dx} y2={dy}
        stroke="#f2efe4" strokeWidth={3}
      />
      <circle cx={dx} cy={dy} r={9} fill="#c9a84c" stroke="#1a1a1a" strokeWidth={2} />
      <text
        x={tx} y={ty + fs * 0.34}
        fontSize={fs}
        textAnchor={side === 'left' ? 'end' : 'start'}
        fill="#f2efe4"
        fontFamily="Inter, sans-serif"
        fontWeight={600}
        style={{ paintOrder: 'stroke fill', stroke: '#1a1a1a', strokeWidth: 4 }}
      >
        {text}
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
