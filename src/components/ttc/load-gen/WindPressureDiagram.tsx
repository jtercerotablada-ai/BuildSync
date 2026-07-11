'use client';

import React from 'react';
import type { StructureData, WindResult } from '@/lib/load-gen/types';
import type { UnitSystem } from '@/lib/beam/units';
import { fromSI, unitLabel } from '@/lib/beam/units';
import { makeIso, fitIso, poly, C30, DART, INK, GOLD, GOLD_DEEP, LINE, MUTE, type XY } from './iso';

interface Props {
  structure: StructureData;
  result: WindResult | null;
  unitSystem: UnitSystem;
}

/** Oblique 45° drafting tick at a dimension endpoint. */
function Tick({ at }: { at: XY }) {
  return <line x1={at.X - 3.2} y1={at.Y + 3.2} x2={at.X + 3.2} y2={at.Y - 3.2} stroke={MUTE} strokeWidth={1} />;
}

/**
 * Isometric building with the ASCE 7-22 MWFRS design pressures.  Wind blows
 * along −x onto the visible near-right face: windward dart arrows land on the
 * face, leeward suction behind, side-wall suction off the near-left face,
 * roof uplift near the windward edge, roof zone boundaries at h/2 · h · 2h,
 * C&C zone-5 strips and true drafting dimensions (L, B, H) with oblique ticks.
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
  const fit = fitIso(l, b, h, 240, 206, 100, 56);
  const s = fit.s, oy = fit.oy;

  const wd = result?.mwfrs.walls.windwardDesign ?? 0;
  const ld = result?.mwfrs.walls.leewardDesign ?? 0;
  const sd = result?.mwfrs.walls.sideDesign ?? 0;
  const roofP = result ? Math.min(...result.mwfrs.roof.map((z) => z.p)) : 0;
  const maxAbs = Math.max(Math.abs(wd), Math.abs(ld), 1);

  const wLen = (0.16 + 0.3 * (Math.abs(wd) / maxAbs)) * l;
  const lLen = (0.1 + 0.24 * (Math.abs(ld) / maxAbs)) * l;
  const sLen = (0.12 + 0.22 * (Math.abs(sd) / maxAbs)) * b;
  const upLen = (0.16 + 0.2 * (Math.abs(roofP) / maxAbs)) * h;

  // dimension offsets (model units)
  const offL = 0.26 * b;                 // L dim, off the y = b bottom edge
  const offB = 0.14 * l;                 // B dim, off the x = l bottom edge
  const offH = wLen + 0.18 * l;          // H dim, beyond the windward arrow tails

  // centre composition: leeward tips ↔ H dim label
  const minOff = (-0.03 * l - lLen - 0.62 * b) * C30 * s;
  const maxOff = (l + offH) * C30 * s + 62;
  const ox = W / 2 - (minOff + maxOff) / 2;
  const p = makeIso(ox, oy, s);

  // corners
  const g00 = p(0, 0, 0), gl0 = p(l, 0, 0), glb = p(l, b, 0), g0b = p(0, b, 0);
  const t00 = p(0, 0, h), tl0 = p(l, 0, h), tlb = p(l, b, h), t0b = p(0, b, h);

  // windward arrows land ON the face (x = l)
  const wArr = result
    ? [0.3 * b, 0.62 * b].flatMap((y) => [0.3 * h, 0.55 * h, 0.8 * h].map((z) => ({ tip: p(l + 0.004 * l, y, z), tail: p(l + 0.004 * l + wLen, y, z) })))
    : [];
  // leeward suction off the hidden face x = 0
  const lArr = result
    ? [0.32 * b, 0.62 * b].flatMap((y) => [0.56 * h, 0.82 * h].map((z) => ({ tail: p(-0.03 * l, y, z), tip: p(-0.03 * l - lLen, y, z) })))
    : [];
  // side-wall suction off the near-left face y = b
  const sArr = result
    ? [0.32 * l, 0.6 * l].map((x) => ({ tail: p(x, b + 0.02 * b, 0.45 * h), tip: p(x, b + sLen, 0.45 * h) }))
    : [];
  // roof uplift near the windward edge
  const rArr = result
    ? [0.25 * b, 0.5 * b, 0.75 * b].map((y) => ({ tail: p(l - 0.07 * l, y, h + 0.01 * h), tip: p(l - 0.07 * l, y, h + upLen) }))
    : [];

  const zoneXs = result ? [h / 2, h, 2 * h].map((d) => l - d).filter((xb) => xb > 0.05 * l) : [];
  const aCC = result ? Math.min(result.cc.a / 1000, 0.45 * b) : 0;

  const wLbl = wArr.length ? { X: (wArr[0].tip.X + wArr[0].tail.X) / 2 + 14, Y: Math.max(...wArr.map((q) => q.tail.Y)) + 30 } : null;
  const lLblTip = lArr.length ? lArr.reduce((m, q) => (q.tip.Y < m.tip.Y ? q : m)) : null;
  const bannerX = W - 104, bannerY = Hc - 44;

  // dimension endpoints
  const dL1 = p(0, b + offL, 0), dL2 = p(l, b + offL, 0);
  const dB1 = p(l + offB, 0, 0), dB2 = p(l + offB, b, 0);
  const dH1 = p(l + offH, 0, 0), dH2 = p(l + offH, 0, h);

  return (
    <svg viewBox={`0 0 ${W} ${Hc}`} className="stl-chart" role="img" aria-label="Wind pressure building model">
      <defs>
        <marker id="w3-g" markerWidth="10.5" markerHeight="7.5" refX="9.3" refY="3.5" orient="auto"><path d={DART} fill={GOLD_DEEP} /></marker>
        <marker id="w3-m" markerWidth="10.5" markerHeight="7.5" refX="9.3" refY="3.5" orient="auto"><path d={DART} fill={MUTE} /></marker>
        <marker id="w3-b" markerWidth="10.5" markerHeight="7.5" refX="9.3" refY="3.5" orient="auto"><path d={DART} fill={GOLD} /></marker>
      </defs>

      {/* ground plate + contact shadow */}
      <polygon points={poly([p(-0.3 * l, -0.3 * b, 0), p(l + 0.3 * l, -0.3 * b, 0), p(l + 0.3 * l, b + 0.3 * b, 0), p(-0.3 * l, b + 0.3 * b, 0)])} fill={INK} fillOpacity={0.015} />
      <polygon points={poly([p(0.05 * l, 0.05 * b, 0), p(l + 0.05 * l, 0.05 * b, 0), p(l + 0.05 * l, b + 0.05 * b, 0), p(0.05 * l, b + 0.05 * b, 0)])} fill={INK} fillOpacity={0.055} />

      {/* hidden edges */}
      {[[g00, gl0], [g00, g0b], [g00, t00]].map(([q, c], i) => (
        <line key={i} x1={q.X} y1={q.Y} x2={c.X} y2={c.Y} stroke={LINE} strokeWidth={0.9} strokeDasharray="4 3" />
      ))}

      {/* faces */}
      <polygon points={poly([g0b, glb, tlb, t0b])} fill={INK} fillOpacity={0.085} stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
      <polygon points={poly([gl0, glb, tlb, tl0])} fill={INK} fillOpacity={0.05} stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
      <polygon points={poly([t00, tl0, tlb, t0b])} fill={INK} fillOpacity={0.028} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />

      {/* roof pressure-zone boundaries */}
      {zoneXs.map((xb, i) => (
        <line key={i} x1={p(xb, 0, h).X} y1={p(xb, 0, h).Y} x2={p(xb, b, h).X} y2={p(xb, b, h).Y} stroke={GOLD} strokeWidth={0.9} strokeDasharray="4 3" opacity={0.8} />
      ))}

      {/* C&C zone-5 strips + 5/4/5 labels near the base of the windward face */}
      {result && aCC > 0 && [aCC, b - aCC].map((y, i) => (
        <line key={i} x1={p(l, y, 0).X} y1={p(l, y, 0).Y} x2={p(l, y, h).X} y2={p(l, y, h).Y} stroke={GOLD} strokeWidth={0.9} strokeDasharray="3 3" opacity={0.85} />
      ))}
      {result && aCC > 0 && [[aCC / 2, '5'], [b / 2, '4'], [b - aCC / 2, '5']].map(([y, z]) => (
        <text key={`z${y}`} x={p(l, y as number, 0.09 * h).X} y={p(l, y as number, 0.09 * h).Y + 3} textAnchor="middle" className="stl-chart__ax" style={{ fill: MUTE }}>{z}</text>
      ))}

      {/* windward push */}
      {wArr.map((q, i) => <line key={`w${i}`} x1={q.tail.X} y1={q.tail.Y} x2={q.tip.X} y2={q.tip.Y} stroke={GOLD_DEEP} strokeWidth={1.3} markerEnd="url(#w3-g)" />)}
      {result && wLbl && (
        <text x={wLbl.X} y={wLbl.Y} textAnchor="middle" className="stl-chart__lbl" style={{ fill: GOLD_DEEP, fontWeight: 600, fontSize: 9.5 }}>windward +{fp(Math.abs(wd)).replace('-', '')}</text>
      )}

      {/* leeward suction */}
      {lArr.map((q, i) => <line key={`l${i}`} x1={q.tail.X} y1={q.tail.Y} x2={q.tip.X} y2={q.tip.Y} stroke={MUTE} strokeWidth={1.1} markerEnd="url(#w3-m)" />)}
      {result && lLblTip && (
        <text x={lLblTip.tip.X - 2} y={lLblTip.tip.Y - 9} textAnchor="start" className="stl-chart__lbl" style={{ fill: MUTE, fontWeight: 600, fontSize: 9.5 }}>leeward {fp(ld)}</text>
      )}

      {/* side-wall suction */}
      {sArr.map((q, i) => <line key={`s${i}`} x1={q.tail.X} y1={q.tail.Y} x2={q.tip.X} y2={q.tip.Y} stroke={MUTE} strokeWidth={1.1} markerEnd="url(#w3-m)" />)}
      {result && sArr.length > 0 && (
        <text x={(sArr[0].tip.X + sArr[1].tip.X) / 2} y={Math.max(sArr[0].tip.Y, sArr[1].tip.Y) + 13} textAnchor="middle" className="stl-chart__ax" style={{ fill: MUTE }}>side {fp(sd)}</text>
      )}

      {/* roof uplift */}
      {rArr.map((q, i) => <line key={`r${i}`} x1={q.tail.X} y1={q.tail.Y} x2={q.tip.X} y2={q.tip.Y} stroke={GOLD_DEEP} strokeWidth={1.2} markerEnd="url(#w3-g)" />)}
      {result && rArr.length > 0 && (
        <text x={rArr[0].tip.X + 6} y={rArr[0].tip.Y - 6} textAnchor="start" className="stl-chart__lbl" style={{ fill: GOLD_DEEP, fontWeight: 600, fontSize: 9.5 }}>roof {fp(roofP)}</text>
      )}

      {/* L dimension — parallel to the y = b bottom edge */}
      <line x1={g0b.X} y1={g0b.Y} x2={p(0, b + offL + 0.04 * b, 0).X} y2={p(0, b + offL + 0.04 * b, 0).Y} stroke={LINE} strokeWidth={0.8} />
      <line x1={glb.X} y1={glb.Y} x2={p(l, b + offL + 0.04 * b, 0).X} y2={p(l, b + offL + 0.04 * b, 0).Y} stroke={LINE} strokeWidth={0.8} />
      <line x1={dL1.X} y1={dL1.Y} x2={dL2.X} y2={dL2.Y} stroke={MUTE} strokeWidth={0.9} />
      <Tick at={dL1} /><Tick at={dL2} />
      <text x={(dL1.X + dL2.X) / 2 - 6} y={Math.max(dL1.Y, dL2.Y) + 14} textAnchor="middle" className="stl-chart__ax">L = {fdim(structure.L)} {lenU} (along wind)</text>

      {/* B dimension — parallel to the x = l bottom edge (extension at gl0 shared with H) */}
      <line x1={glb.X} y1={glb.Y} x2={p(l + offB + 0.03 * l, b, 0).X} y2={p(l + offB + 0.03 * l, b, 0).Y} stroke={LINE} strokeWidth={0.8} />
      <line x1={dB1.X} y1={dB1.Y} x2={dB2.X} y2={dB2.Y} stroke={MUTE} strokeWidth={0.9} />
      <Tick at={dB1} /><Tick at={dB2} />
      <text x={dB2.X + 6} y={dB2.Y + 13} textAnchor="start" className="stl-chart__ax">B = {fdim(structure.B)} {lenU}</text>

      {/* H dimension — vertical, beyond the windward arrows */}
      <line x1={gl0.X} y1={gl0.Y} x2={p(l + offH + 0.03 * l, 0, 0).X} y2={p(l + offH + 0.03 * l, 0, 0).Y} stroke={LINE} strokeWidth={0.8} />
      <line x1={tl0.X} y1={tl0.Y} x2={p(l + offH + 0.03 * l, 0, h).X} y2={p(l + offH + 0.03 * l, 0, h).Y} stroke={LINE} strokeWidth={0.8} />
      <line x1={dH1.X} y1={dH1.Y} x2={dH2.X} y2={dH2.Y} stroke={MUTE} strokeWidth={0.9} />
      <Tick at={dH1} /><Tick at={dH2} />
      <text x={dH1.X + 6} y={(dH1.Y + dH2.Y) / 2 + 3} textAnchor="start" className="stl-chart__ax">H = {fdim(structure.H)} {lenU}</text>

      {/* WIND banner */}
      <line x1={bannerX} y1={bannerY} x2={bannerX - 52 * 0.866} y2={bannerY - 52 * 0.5} stroke={GOLD} strokeWidth={2.2} markerEnd="url(#w3-b)" />
      <text x={bannerX + 6} y={bannerY + 4} textAnchor="start" className="stl-chart__lbl" style={{ fill: GOLD_DEEP, fontWeight: 600, fontSize: 9.5, letterSpacing: '0.12em' }}>WIND</text>

      {/* caption */}
      {result && (
        <text x={W / 2} y={Hc - 6} textAnchor="middle" className="stl-chart__ax">
          qh = {fp(result.breakdown.qh)} · roof zones at h/2 · h · 2h from the windward edge · C&C corner strips = zone 5
        </text>
      )}
      {!result && <text x={W / 2} y={Hc / 2} textAnchor="middle" className="stl-note">Enter site + building data to compute wind pressures.</text>}
    </svg>
  );
}
