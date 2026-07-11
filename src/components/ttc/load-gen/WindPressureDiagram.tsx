'use client';

import React from 'react';
import type { StructureData, WindResult } from '@/lib/load-gen/types';
import type { UnitSystem } from '@/lib/beam/units';
import { fromSI, unitLabel } from '@/lib/beam/units';
import { makeIso, fitIso, poly, INK, GOLD, GOLD_DEEP, LINE, MUTE } from './iso';

interface Props {
  structure: StructureData;
  result: WindResult | null;
  unitSystem: UnitSystem;
}

/**
 * Isometric building view with the ASCE 7-22 MWFRS design pressures.
 * Wind blows along −x so it strikes the visible near-right face (x = l):
 * windward push arrows on that face, leeward suction behind (x = 0), side-wall
 * suction off the near-left face (y = b), roof uplift near the windward edge,
 * roof pressure-zone boundaries at h/2 · h · 2h and C&C zone-5 corner strips.
 */
export function WindPressureDiagram({ structure, result, unitSystem }: Props) {
  const pu = unitLabel('pressureSmall', unitSystem);
  const fp = (pa: number) => `${fromSI(pa, 'pressureSmall', unitSystem).toFixed(1)} ${pu}`;
  const lenU = unitSystem === 'imperial' ? 'ft' : 'm';
  const fdim = (mm: number) => (unitSystem === 'imperial' ? Math.round(mm / 304.8) : Math.round(mm / 100) / 10);

  const W = 560, Hc = 384;
  const l = Math.max(structure.L, 1000) / 1000;
  const b = Math.max(structure.B, 1000) / 1000;
  const h = Math.max(structure.H, 1000) / 1000;
  const { s, ox, oy } = fitIso(l, b, h, 250, 214, 100, 58);
  const p = makeIso(ox, oy, s);

  const wd = result?.mwfrs.walls.windwardDesign ?? 0;
  const ld = result?.mwfrs.walls.leewardDesign ?? 0;
  const sd = result?.mwfrs.walls.sideDesign ?? 0;
  const roofP = result ? Math.min(...result.mwfrs.roof.map((r) => r.p)) : 0;
  const maxAbs = Math.max(Math.abs(wd), Math.abs(ld), 1);

  const gap = 0.03 * l;
  const wLen = (0.16 + 0.3 * (Math.abs(wd) / maxAbs)) * l;
  const lLen = (0.1 + 0.24 * (Math.abs(ld) / maxAbs)) * l;
  const sLen = (0.12 + 0.22 * (Math.abs(sd) / maxAbs)) * b;
  const upLen = (0.16 + 0.2 * (Math.abs(roofP) / maxAbs)) * h;

  // corners
  const gl0 = p(l, 0, 0), glb = p(l, b, 0), g0b = p(0, b, 0), g00 = p(0, 0, 0);
  const t00 = p(0, 0, h), tl0 = p(l, 0, h), tlb = p(l, b, h), t0b = p(0, b, h);

  // windward arrows on face x = l (2 cols × 3 rows)
  const wArr = result
    ? [0.3 * b, 0.62 * b].flatMap((y) => [0.3 * h, 0.55 * h, 0.8 * h].map((z) => ({ tip: p(l + gap, y, z), tail: p(l + gap + wLen, y, z) })))
    : [];
  const XdimH = Math.max(gl0.X, tl0.X, ...wArr.map((a) => a.tail.X)) + 16;

  // leeward suction arrows off hidden face x = 0 (point away, up-left)
  const lArr = result
    ? [0.32 * b, 0.62 * b].flatMap((y) => [0.56 * h, 0.82 * h].map((z) => ({ tail: p(-gap, y, z), tip: p(-gap - lLen, y, z) })))
    : [];

  // side-wall suction off face y = b (point away, down-left)
  const sArr = result
    ? [0.32 * l, 0.6 * l].map((x) => ({ tail: p(x, b + 0.02 * b, 0.45 * h), tip: p(x, b + sLen, 0.45 * h) }))
    : [];

  // roof uplift near the windward edge
  const rArr = result
    ? [0.25 * b, 0.5 * b, 0.75 * b].map((y) => ({ tail: p(l - 0.07 * l, y, h + 0.01 * h), tip: p(l - 0.07 * l, y, h + upLen) }))
    : [];

  // roof zone boundaries at h/2, h, 2h from the windward edge (x = l)
  const zoneXs = result ? [h / 2, h, 2 * h].map((d) => l - d).filter((xb) => xb > 0.05 * l) : [];

  // C&C zone-5 strips at distance a from the corners of the windward face
  const aCC = result ? Math.min(result.cc.a / 1000, 0.45 * b) : 0;

  const wLbl = wArr.length ? { X: (wArr[0].tip.X + XdimH) / 2 - 8, Y: Math.max(...wArr.map((a) => a.tail.Y)) + 16 } : null;
  const lLblTip = lArr.length ? lArr.reduce((m, a) => (a.tip.Y < m.tip.Y ? a : m)) : null;
  const bannerX = W - 118, bannerY = Hc - 46;

  return (
    <svg viewBox={`0 0 ${W} ${Hc}`} className="stl-chart" role="img" aria-label="Wind pressure building model">
      <defs>
        <marker id="w3-g" markerWidth="8" markerHeight="8" refX="6.5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill={GOLD_DEEP} /></marker>
        <marker id="w3-m" markerWidth="8" markerHeight="8" refX="6.5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill={MUTE} /></marker>
        <marker id="w3-b" markerWidth="9" markerHeight="9" refX="7.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L8,3.5 z" fill={GOLD} /></marker>
      </defs>

      {/* ground plate + contact shadow */}
      <polygon points={poly([p(-0.3 * l, -0.3 * b, 0), p(l + 0.3 * l, -0.3 * b, 0), p(l + 0.3 * l, b + 0.3 * b, 0), p(-0.3 * l, b + 0.3 * b, 0)])} fill={INK} fillOpacity={0.015} />
      <polygon points={poly([p(0.05 * l, 0.05 * b, 0), p(l + 0.05 * l, 0.05 * b, 0), p(l + 0.05 * l, b + 0.05 * b, 0), p(0.05 * l, b + 0.05 * b, 0)])} fill={INK} fillOpacity={0.055} />

      {/* hidden edges */}
      {[[g00, gl0], [g00, g0b], [g00, t00]].map(([a, c], i) => (
        <line key={i} x1={a.X} y1={a.Y} x2={c.X} y2={c.Y} stroke={LINE} strokeWidth={0.9} strokeDasharray="4 3" />
      ))}

      {/* faces: near-left (y=b), near-right (x=l), top */}
      <polygon points={poly([g0b, glb, tlb, t0b])} fill={INK} fillOpacity={0.085} stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
      <polygon points={poly([gl0, glb, tlb, tl0])} fill={INK} fillOpacity={0.05} stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
      <polygon points={poly([t00, tl0, tlb, t0b])} fill={INK} fillOpacity={0.028} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />

      {/* roof pressure-zone boundaries */}
      {zoneXs.map((xb, i) => (
        <line key={i} x1={p(xb, 0, h).X} y1={p(xb, 0, h).Y} x2={p(xb, b, h).X} y2={p(xb, b, h).Y} stroke={GOLD} strokeWidth={0.9} strokeDasharray="4 3" opacity={0.8} />
      ))}

      {/* C&C zone-5 corner strips + 5/4/5 labels on the windward face */}
      {result && aCC > 0 && [aCC, b - aCC].map((y, i) => (
        <line key={i} x1={p(l, y, 0).X} y1={p(l, y, 0).Y} x2={p(l, y, h).X} y2={p(l, y, h).Y} stroke={GOLD} strokeWidth={0.9} strokeDasharray="3 3" opacity={0.85} />
      ))}
      {result && aCC > 0 && [[aCC / 2, '5'], [b / 2, '4'], [b - aCC / 2, '5']].map(([y, t]) => (
        <text key={`z${y}`} x={p(l, y as number, 0.5 * h).X} y={p(l, y as number, 0.5 * h).Y + 3} textAnchor="middle" className="stl-chart__ax" style={{ fill: MUTE }}>{t}</text>
      ))}

      {/* windward push */}
      {wArr.map((a, i) => <line key={`w${i}`} x1={a.tail.X} y1={a.tail.Y} x2={a.tip.X} y2={a.tip.Y} stroke={GOLD_DEEP} strokeWidth={1.5} markerEnd="url(#w3-g)" />)}
      {result && wLbl && (
        <text x={wLbl.X} y={wLbl.Y} textAnchor="middle" className="stl-chart__lbl" style={{ fill: GOLD_DEEP, fontWeight: 600, fontSize: 9.5 }}>windward +{fp(Math.abs(wd)).replace('-', '')}</text>
      )}

      {/* leeward suction */}
      {lArr.map((a, i) => <line key={`l${i}`} x1={a.tail.X} y1={a.tail.Y} x2={a.tip.X} y2={a.tip.Y} stroke={MUTE} strokeWidth={1.2} markerEnd="url(#w3-m)" />)}
      {result && lLblTip && (
        <text x={lLblTip.tip.X - 2} y={lLblTip.tip.Y - 7} textAnchor="start" className="stl-chart__lbl" style={{ fill: MUTE, fontWeight: 600, fontSize: 9.5 }}>leeward {fp(ld)}</text>
      )}

      {/* side-wall suction */}
      {sArr.map((a, i) => <line key={`s${i}`} x1={a.tail.X} y1={a.tail.Y} x2={a.tip.X} y2={a.tip.Y} stroke={MUTE} strokeWidth={1.1} markerEnd="url(#w3-m)" />)}
      {result && sArr.length > 0 && (
        <text x={(sArr[0].tip.X + sArr[1].tip.X) / 2} y={Math.max(sArr[0].tip.Y, sArr[1].tip.Y) + 13} textAnchor="middle" className="stl-chart__ax" style={{ fill: MUTE }}>side {fp(sd)}</text>
      )}

      {/* roof uplift */}
      {rArr.map((a, i) => <line key={`r${i}`} x1={a.tail.X} y1={a.tail.Y} x2={a.tip.X} y2={a.tip.Y} stroke={GOLD_DEEP} strokeWidth={1.3} markerEnd="url(#w3-g)" />)}
      {result && rArr.length > 0 && (
        <text x={rArr[0].tip.X + 6} y={rArr[0].tip.Y - 6} textAnchor="start" className="stl-chart__lbl" style={{ fill: GOLD_DEEP, fontWeight: 600, fontSize: 9.5 }}>roof {fp(roofP)}</text>
      )}

      {/* L dimension (bottom-left edge, y = b) */}
      {(() => {
        const ydim = Math.max(g0b.Y, glb.Y) + 24;
        return (
          <g>
            <line x1={g0b.X} y1={g0b.Y + 3} x2={g0b.X} y2={ydim} stroke={LINE} strokeWidth={0.8} />
            <line x1={glb.X} y1={glb.Y + 3} x2={glb.X} y2={ydim} stroke={LINE} strokeWidth={0.8} />
            <line x1={g0b.X} y1={ydim} x2={glb.X} y2={ydim} stroke={MUTE} strokeWidth={0.9} />
            <text x={(g0b.X + glb.X) / 2} y={ydim + 12} textAnchor="middle" className="stl-chart__ax">L = {fdim(structure.L)} {lenU} (along wind)</text>
          </g>
        );
      })()}

      {/* H dimension (right of the windward arrows) */}
      <line x1={gl0.X + 4} y1={gl0.Y} x2={XdimH} y2={gl0.Y} stroke={LINE} strokeWidth={0.8} />
      <line x1={tl0.X + 4} y1={tl0.Y} x2={XdimH} y2={tl0.Y} stroke={LINE} strokeWidth={0.8} />
      <line x1={XdimH} y1={tl0.Y} x2={XdimH} y2={gl0.Y} stroke={MUTE} strokeWidth={0.9} />
      <text x={XdimH + 5} y={(gl0.Y + tl0.Y) / 2 + 3} textAnchor="start" className="stl-chart__ax">H = {fdim(structure.H)} {lenU}</text>

      {/* WIND banner (lower right, blowing up-left onto the near face) */}
      <line x1={bannerX} y1={bannerY} x2={bannerX - 52 * 0.866} y2={bannerY - 52 * 0.5} stroke={GOLD} strokeWidth={2.2} markerEnd="url(#w3-b)" />
      <text x={bannerX + 6} y={bannerY + 4} textAnchor="start" className="stl-chart__lbl" style={{ fill: GOLD_DEEP, fontWeight: 600, fontSize: 9.5, letterSpacing: '0.12em' }}>WIND</text>

      {/* caption */}
      {result && (
        <text x={W / 2} y={Hc - 6} textAnchor="middle" className="stl-chart__ax">
          qh = {fp(result.breakdown.qh)} · B = {fdim(structure.B)} {lenU} · roof zones at h/2 · h · 2h from windward edge
        </text>
      )}
      {!result && <text x={W / 2} y={Hc / 2} textAnchor="middle" className="stl-note">Enter site + building data to compute wind pressures.</text>}
    </svg>
  );
}
