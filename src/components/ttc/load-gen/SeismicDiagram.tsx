'use client';

import React from 'react';
import type { SeismicResult } from '@/lib/load-gen/types';
import type { UnitSystem } from '@/lib/beam/units';
import { fromSI, unitLabel } from '@/lib/beam/units';
import { makeIso, fitIso, poly, INK, GOLD, GOLD_DEEP, LINE } from './iso';

interface Props {
  result: SeismicResult | null;
  unitSystem: UnitSystem;
}

/**
 * Isometric tower with the ELF story forces Fx striking the near-right face,
 * the dashed triangular envelope through the arrow tails and the base shear V
 * at ground level (§12.8.3).
 */
export function SeismicDiagram({ result, unitSystem }: Props) {
  const fu = unitLabel('force', unitSystem);
  const ff = (kn: number) => `${fromSI(kn, 'force', unitSystem).toFixed(1)} ${fu}`;

  const W = 560, Hc = 384;
  const forces = result?.forces ?? [];
  const N = Math.max(forces.length, 1);
  const hn = forces.length ? Math.max(...forces.map((f) => f.hx)) / 1000 : 12;
  const a = Math.max(0.3 * hn, (hn / N) * 0.85);

  const { s, ox, oy } = fitIso(a, a, hn, 160, 250, 74, 52);
  const p = makeIso(ox, oy, s);

  const g00 = p(0, 0, 0), ga0 = p(a, 0, 0), gaa = p(a, a, 0), g0a = p(0, a, 0);
  const t00 = p(0, 0, hn), ta0 = p(a, 0, hn), taa = p(a, a, hn), t0a = p(0, a, hn);

  const maxF = Math.max(1e-9, ...forces.map((f) => Math.abs(f.Fx)));
  const Lmax = 0.52 * hn;
  const gapA = 0.06 * a;
  const storyH = hn / N;

  const arrows = forces.map((f) => {
    const z = f.hx / 1000;
    const len = Math.max(0.08 * hn, Lmax * (Math.abs(f.Fx) / maxF));
    return { f, tip: p(a + gapA, 0.5 * a, z), tail: p(a + gapA + len, 0.5 * a, z) };
  });
  const ordered = [...arrows].sort((x, y) => x.f.level - y.f.level);

  const vTail = p(a + gapA + Lmax * 1.06, 0.5 * a, 0.03 * hn);
  const vTip = p(a + gapA * 0.5, 0.5 * a, 0.03 * hn);

  const sumW = forces.reduce((acc, f) => acc + f.wx, 0);

  return (
    <svg viewBox={`0 0 ${W} ${Hc}`} className="stl-chart" role="img" aria-label="Seismic story-force building model">
      <defs>
        <marker id="se3-g" markerWidth="8" markerHeight="8" refX="6.5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill={GOLD_DEEP} /></marker>
        <marker id="se3-v" markerWidth="9" markerHeight="9" refX="7.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L8,3.5 z" fill={GOLD} /></marker>
      </defs>

      {/* ground plate + contact shadow */}
      <polygon points={poly([p(-0.6 * a, -0.6 * a, 0), p(a + 0.7 * a, -0.6 * a, 0), p(a + 0.7 * a, a + 0.6 * a, 0), p(-0.6 * a, a + 0.6 * a, 0)])} fill={INK} fillOpacity={0.015} />
      <polygon points={poly([p(0.06 * a, 0.06 * a, 0), p(a + 0.06 * a, 0.06 * a, 0), p(a + 0.06 * a, a + 0.06 * a, 0), p(0.06 * a, a + 0.06 * a, 0)])} fill={INK} fillOpacity={0.055} />

      {/* hidden edges */}
      {[[g00, ga0], [g00, g0a], [g00, t00]].map(([q, c], i) => (
        <line key={i} x1={q.X} y1={q.Y} x2={c.X} y2={c.Y} stroke={LINE} strokeWidth={0.9} strokeDasharray="4 3" />
      ))}

      {/* faces */}
      <polygon points={poly([g0a, gaa, taa, t0a])} fill={INK} fillOpacity={0.085} stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
      <polygon points={poly([ga0, gaa, taa, ta0])} fill={INK} fillOpacity={0.05} stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
      <polygon points={poly([t00, ta0, taa, t0a])} fill={INK} fillOpacity={0.028} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />

      {/* story lines on both visible faces */}
      {Array.from({ length: N - 1 }).map((_, i) => {
        const z = (i + 1) * storyH;
        const r1 = p(a, 0, z), r2 = p(a, a, z), l1 = p(0, a, z);
        return (
          <g key={i}>
            <line x1={r1.X} y1={r1.Y} x2={r2.X} y2={r2.Y} stroke={INK} strokeWidth={0.7} opacity={0.45} />
            <line x1={l1.X} y1={l1.Y} x2={r2.X} y2={r2.Y} stroke={INK} strokeWidth={0.7} opacity={0.45} />
          </g>
        );
      })}

      {/* envelope through arrow tails */}
      {ordered.length > 1 && (
        <polyline points={ordered.map((q) => `${q.tail.X.toFixed(1)},${q.tail.Y.toFixed(1)}`).join(' ')} fill="none" stroke={GOLD} strokeWidth={0.9} strokeDasharray="4 4" />
      )}

      {/* story forces */}
      {arrows.map((q) => (
        <g key={q.f.level}>
          <line x1={q.tail.X} y1={q.tail.Y} x2={q.tip.X} y2={q.tip.Y} stroke={GOLD_DEEP} strokeWidth={1.6} markerEnd="url(#se3-g)" />
          <text x={q.tail.X + 6} y={q.tail.Y + 3} textAnchor="start" className="stl-chart__lbl" style={{ fill: INK, fontWeight: 600, fontSize: 9.5 }}>
            F{q.f.level} {ff(q.f.Fx)}
          </text>
        </g>
      ))}

      {/* base shear */}
      {result && (
        <g>
          <line x1={vTail.X} y1={vTail.Y} x2={vTip.X} y2={vTip.Y} stroke={GOLD} strokeWidth={2.4} markerEnd="url(#se3-v)" />
          <text x={(vTail.X + vTip.X) / 2} y={vTail.Y + 18} textAnchor="middle" className="stl-chart__lbl" style={{ fill: GOLD_DEEP, fontWeight: 600, fontSize: 10.5 }}>
            V = {ff(result.V)}
          </text>
        </g>
      )}

      {/* caption */}
      {result && (
        <text x={W / 2} y={Hc - 6} textAnchor="middle" className="stl-chart__ax">
          Ta {result.Ta.toFixed(3)} s · k {result.k.toFixed(2)} · Cs {result.Cs.toFixed(4)} · SDC {result.SDC} · W {ff(sumW)}
        </text>
      )}
      {!result && <text x={W / 2} y={Hc / 2} textAnchor="middle" className="stl-note">Enter seismic data to view</text>}
    </svg>
  );
}
