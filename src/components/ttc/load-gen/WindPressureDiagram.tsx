'use client';

import React from 'react';
import type { StructureData, WindResult } from '@/lib/load-gen/types';
import type { UnitSystem } from '@/lib/beam/units';
import { fromSI, unitLabel } from '@/lib/beam/units';

interface Props {
  structure: StructureData;
  result: WindResult | null;
  unitSystem: UnitSystem;
}

const INK = '#221e17', GOLD = '#c9a84c', GOLD_DEEP = '#9a7a2c', LINE = '#cfc7b6', MUTE = '#8a8272';

/**
 * Luxury light-theme wind-pressure elevation: MWFRS windward (push) + leeward
 * (suction) design pressures on the building section, with C&C zone boundaries
 * at distance a from each edge. Normalised viewBox so strokes/labels stay crisp.
 */
export function WindPressureDiagram({ structure, result, unitSystem }: Props) {
  const pu = unitLabel('pressureSmall', unitSystem);
  const fmt = (pa: number) => `${fromSI(pa, 'pressureSmall', unitSystem).toFixed(1)} ${pu}`;

  const W = 560, Htot = 320;
  const cx0 = 210, cx1 = 470;      // horizontal band reserved for the building
  const bandW = cx1 - cx0;
  const groundY = 250, roofTopMin = 60;

  const Lb = Math.max(structure.L, 1);
  const Hb = Math.max(structure.H, 1);
  // fit building into the band; keep aspect ratio sane
  const bw = bandW;
  const bh = Math.min(groundY - roofTopMin, (Hb / Lb) * bw);
  const bx = cx0, byTop = groundY - bh;
  const aFrac = Math.min(
    result ? result.cc.a / Lb : Math.min(0.1 * Math.min(structure.B, Lb), 0.4 * Hb) / Lb,
    0.49
  );
  const aPx = aFrac * bw;

  const wDes = result?.mwfrs.walls.windwardDesign ?? 0;   // + push
  const lDes = result?.mwfrs.walls.leewardDesign ?? 0;    // − suction
  const maxAbs = Math.max(Math.abs(wDes), Math.abs(lDes), 1);
  const arrowMax = 46;
  const wLen = (Math.abs(wDes) / maxAbs) * arrowMax;
  const lLen = (Math.abs(lDes) / maxAbs) * arrowMax;

  const rows = 4;
  return (
    <svg viewBox={`0 0 ${W} ${Htot}`} className="stl-chart" role="img" aria-label="Wind pressure elevation">
      <defs>
        <marker id="lgw-push" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill={GOLD_DEEP} />
        </marker>
        <marker id="lgw-suck" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill={MUTE} />
        </marker>
      </defs>

      {/* ground + hatch */}
      <line x1={cx0 - 130} y1={groundY} x2={cx1 + 70} y2={groundY} stroke={INK} strokeWidth={1.4} />
      {Array.from({ length: 26 }).map((_, i) => {
        const x = cx0 - 128 + i * ((bandW + 190) / 26);
        return <line key={i} x1={x} y1={groundY} x2={x - 8} y2={groundY + 9} stroke={LINE} strokeWidth={1} />;
      })}

      {/* building */}
      <rect x={bx} y={byTop} width={bw} height={bh} fill={INK} fillOpacity={0.04} stroke={INK} strokeWidth={1.4} />

      {/* C&C zone boundaries + labels (5 corner / 4 interior / 5 corner) */}
      {[aPx, bw - aPx].map((dx, i) => (
        <line key={i} x1={bx + dx} y1={byTop} x2={bx + dx} y2={groundY} stroke={GOLD} strokeDasharray="5 4" strokeWidth={1} />
      ))}
      {result && [
        { x: bx + aPx / 2, t: '5' }, { x: bx + bw / 2, t: '4' }, { x: bx + bw - aPx / 2, t: '5' },
      ].map((z) => (
        <text key={z.t + z.x} x={z.x} y={byTop + bh / 2} textAnchor="middle" className="stl-chart__ax" style={{ fill: MUTE }}>{z.t}</text>
      ))}

      {/* windward push arrows (left → into wall) */}
      {result && Array.from({ length: rows }).map((_, i) => {
        const y = byTop + ((i + 0.5) / rows) * bh;
        return <line key={`w${i}`} x1={bx - 8 - wLen} y1={y} x2={bx - 8} y2={y} stroke={GOLD_DEEP} strokeWidth={1.4} markerEnd="url(#lgw-push)" />;
      })}
      {/* leeward suction arrows (right, pulling away → pointing right/out) */}
      {result && Array.from({ length: rows }).map((_, i) => {
        const y = byTop + ((i + 0.5) / rows) * bh;
        return <line key={`l${i}`} x1={bx + bw + 8} y1={y} x2={bx + bw + 8 + lLen} y2={y} stroke={MUTE} strokeWidth={1.2} markerEnd="url(#lgw-suck)" />;
      })}

      {/* labels */}
      {result && (
        <>
          <text x={bx - 12 - arrowMax} y={byTop - 8} textAnchor="start" className="stl-chart__lbl" style={{ fill: GOLD_DEEP, fontWeight: 600 }}>Windward (push)</text>
          <text x={bx - 12 - arrowMax} y={groundY + 22} textAnchor="start" className="stl-chart__lbl" style={{ fill: INK, fontWeight: 600 }}>{fmt(wDes)}</text>
          <text x={bx + bw + 12 + arrowMax} y={byTop - 8} textAnchor="end" className="stl-chart__lbl" style={{ fill: MUTE, fontWeight: 600 }}>Leeward (suction)</text>
          <text x={bx + bw + 12 + arrowMax} y={groundY + 22} textAnchor="end" className="stl-chart__lbl" style={{ fill: INK, fontWeight: 600 }}>{fmt(lDes)}</text>
          <text x={bx + bw / 2} y={byTop - 8} textAnchor="middle" className="stl-chart__ax">qh = {fmt(result.breakdown.qh)}</text>
        </>
      )}

      {/* H + L dimensions */}
      <line x1={bx - 20} y1={byTop} x2={bx - 20} y2={groundY} stroke={LINE} strokeWidth={1} />
      <text x={bx - 24} y={byTop + bh / 2} textAnchor="end" className="stl-chart__ax" transform={`rotate(-90 ${bx - 24} ${byTop + bh / 2})`}>H</text>
      <line x1={bx} y1={groundY + 30} x2={bx + bw} y2={groundY + 30} stroke={LINE} strokeWidth={1} />
      <text x={bx + bw / 2} y={groundY + 42} textAnchor="middle" className="stl-chart__ax">L (along wind)</text>
    </svg>
  );
}
