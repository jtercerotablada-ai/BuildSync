'use client';

import React from 'react';
import type { SnowResult, StructureData } from '@/lib/load-gen/types';
import type { UnitSystem } from '@/lib/beam/units';
import { fromSI, unitLabel } from '@/lib/beam/units';
import { makeIso, fitIso, poly, INK, GOLD_DEEP, LINE } from './iso';

interface Props {
  result: SnowResult | null;
  structure: StructureData;
  roofSlope: number; // degrees
  unitSystem: UnitSystem;
}

const SNOW_TOP = '#fdfcf8';
const SNOW_SHADE = '#f3efe4';

/**
 * Isometric building with the balanced snow blanket on the roof.  Gable ridge
 * runs along the depth axis at x = l/2 (flat roof when the slope is ~0); the
 * snow is a uniform-thickness slab whose front and eave cut faces are visible.
 */
export function SnowRoofDiagram({ result, structure, roofSlope, unitSystem }: Props) {
  const pu = unitLabel('pressureSmall', unitSystem);
  const fp = (pa: number) => `${fromSI(pa, 'pressureSmall', unitSystem).toFixed(1)} ${pu}`;

  const W = 560, Hc = 356;
  const l = Math.max(structure.L, 1000) / 1000;
  const b = Math.max(structure.B, 1000) / 1000;
  const he = Math.max(structure.H, 1000) / 1000;

  const theta = Math.max(0, Math.min(roofSlope, 70));
  const isGable = theta >= 1;
  const r = isGable ? Math.min(Math.tan((theta * Math.PI) / 180) * (l / 2), 1.15 * he) : 0;

  const hasSnow = !!result && result.governing > 20; // > ~0.4 psf
  const t = hasSnow ? 0.16 * he : 0;

  const { s, ox, oy } = fitIso(l, b, he + r + t, 300, 218, 108, 46);
  const p = makeIso(ox, oy, s);

  // building corners
  const g00 = p(0, 0, 0), gl0 = p(l, 0, 0), glb = p(l, b, 0), g0b = p(0, b, 0);
  const ridgeZ = he + r;

  // near-left gable face (y = b): pentagon (rect when flat)
  const faceL = isGable
    ? [g0b, glb, p(l, b, he), p(l / 2, b, ridgeZ), p(0, b, he)]
    : [g0b, glb, p(l, b, he), p(0, b, he)];
  // near-right eave face (x = l): rectangle to eave height
  const faceR = [gl0, glb, p(l, b, he), p(l, 0, he)];

  // snow slab surfaces
  const snowTopRight = [p(l, 0, he + t), p(l, b, he + t), p(l / 2, b, ridgeZ + t), p(l / 2, 0, ridgeZ + t)];
  const snowTopLeft = [p(l / 2, 0, ridgeZ + t), p(l / 2, b, ridgeZ + t), p(0, b, he + t), p(0, 0, he + t)];
  const snowTopFlat = [p(0, 0, he + t), p(l, 0, he + t), p(l, b, he + t), p(0, b, he + t)];
  const snowFront = isGable
    ? [p(0, b, he), p(l / 2, b, ridgeZ), p(l, b, he), p(l, b, he + t), p(l / 2, b, ridgeZ + t), p(0, b, he + t)]
    : [p(0, b, he), p(l, b, he), p(l, b, he + t), p(0, b, he + t)];
  const snowEaveR = [p(l, 0, he), p(l, b, he), p(l, b, he + t), p(l, 0, he + t)];

  // measure ticks along the front snow surface edge
  const zTop = (x: number) => (isGable ? he + t + (x <= l / 2 ? (r * x) / (l / 2) : (r * (l - x)) / (l / 2)) : he + t);
  const ticks = hasSnow ? [0.12, 0.26, 0.4, 0.6, 0.74, 0.88].map((f) => f * l) : [];

  const ridgeTop = p(l / 2, b * 0.5, ridgeZ + t);
  const slopeAnchor = p(l + 0.14 * l, 0.08 * b, he + t / 2);

  return (
    <svg viewBox={`0 0 ${W} ${Hc}`} className="stl-chart" role="img" aria-label="Snow load building model">
      {/* ground plate + contact shadow */}
      <polygon points={poly([p(-0.3 * l, -0.3 * b, 0), p(l + 0.3 * l, -0.3 * b, 0), p(l + 0.3 * l, b + 0.3 * b, 0), p(-0.3 * l, b + 0.3 * b, 0)])} fill={INK} fillOpacity={0.015} />
      <polygon points={poly([p(0.05 * l, 0.05 * b, 0), p(l + 0.05 * l, 0.05 * b, 0), p(l + 0.05 * l, b + 0.05 * b, 0), p(0.05 * l, b + 0.05 * b, 0)])} fill={INK} fillOpacity={0.055} />

      {/* hidden edges */}
      {[[g00, gl0], [g00, g0b], [g00, p(0, 0, he)]].map(([a, c], i) => (
        <line key={i} x1={a.X} y1={a.Y} x2={c.X} y2={c.Y} stroke={LINE} strokeWidth={0.9} strokeDasharray="4 3" />
      ))}

      {/* building faces */}
      <polygon points={poly(faceL)} fill={INK} fillOpacity={0.085} stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
      <polygon points={poly(faceR)} fill={INK} fillOpacity={0.05} stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />

      {/* roof planes when bare (no snow) */}
      {!hasSnow && isGable && (
        <>
          <polygon points={poly([p(l / 2, 0, ridgeZ), p(l / 2, b, ridgeZ), p(0, b, he), p(0, 0, he)])} fill={INK} fillOpacity={0.02} stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
          <polygon points={poly([p(l, 0, he), p(l, b, he), p(l / 2, b, ridgeZ), p(l / 2, 0, ridgeZ)])} fill={INK} fillOpacity={0.04} stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
        </>
      )}
      {!hasSnow && !isGable && (
        <polygon points={poly([p(0, 0, he), p(l, 0, he), p(l, b, he), p(0, b, he)])} fill={INK} fillOpacity={0.028} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
      )}

      {/* snow slab */}
      {hasSnow && (
        <>
          {isGable ? (
            <>
              <polygon points={poly(snowTopLeft)} fill={SNOW_SHADE} stroke={GOLD_DEEP} strokeWidth={0.9} strokeLinejoin="round" />
              <polygon points={poly(snowTopRight)} fill={SNOW_TOP} stroke={GOLD_DEEP} strokeWidth={0.9} strokeLinejoin="round" />
            </>
          ) : (
            <polygon points={poly(snowTopFlat)} fill={SNOW_TOP} stroke={GOLD_DEEP} strokeWidth={0.9} strokeLinejoin="round" />
          )}
          <polygon points={poly(snowFront)} fill="#ffffff" stroke={GOLD_DEEP} strokeWidth={0.9} strokeLinejoin="round" />
          <polygon points={poly(snowEaveR)} fill={SNOW_SHADE} stroke={GOLD_DEEP} strokeWidth={0.9} strokeLinejoin="round" />
          {/* depth ticks on the snow surface (front edge) */}
          {ticks.map((x, i) => {
            const a = p(x, b, zTop(x)), c = p(x, b, zTop(x) + 0.05 * he);
            return <line key={i} x1={a.X} y1={a.Y} x2={c.X} y2={c.Y} stroke={GOLD_DEEP} strokeWidth={0.9} />;
          })}
        </>
      )}

      {/* labels */}
      {hasSnow && result && (
        <text x={ridgeTop.X} y={ridgeTop.Y - 12} textAnchor="middle" className="stl-chart__lbl" style={{ fill: INK, fontWeight: 600, fontSize: 10 }}>
          balanced {fp(result.governing)}{result.minimumGoverns ? ' · minimum governs' : ''}
        </text>
      )}
      {!hasSnow && (
        <text x={ridgeTop.X} y={ridgeTop.Y - 12} textAnchor="middle" className="stl-chart__ax">no roof snow (pg ≈ 0)</text>
      )}
      {isGable && (
        <text x={slopeAnchor.X + 6} y={slopeAnchor.Y + 3} textAnchor="start" className="stl-chart__ax">θ = {theta}°</text>
      )}

      {/* caption */}
      {result && (
        <text x={W / 2} y={Hc - 6} textAnchor="middle" className="stl-chart__ax">
          pf {fp(result.pf)} · ps {fp(result.ps)} · pm {fp(result.pm)} · Ce {result.Ce.toFixed(2)} · Ct {result.Ct.toFixed(2)} · Cs {result.Cs.toFixed(3)}
        </text>
      )}
      {!result && <text x={W / 2} y={Hc / 2} textAnchor="middle" className="stl-note">Enter snow data to view</text>}
    </svg>
  );
}
