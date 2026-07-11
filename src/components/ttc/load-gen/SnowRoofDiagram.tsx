'use client';

import React from 'react';
import type { SnowResult, StructureData } from '@/lib/load-gen/types';
import type { UnitSystem } from '@/lib/beam/units';
import { fromSI, unitLabel } from '@/lib/beam/units';
import { makeIso, fitIso, poly, C30, DART, INK, GOLD_DEEP, LINE } from './iso';

interface Props {
  result: SnowResult | null;
  structure: StructureData;
  roofSlope: number; // degrees
  unitSystem: UnitSystem;
}

const SNOW_TOP = '#fdfcf8';
const SNOW_SHADE = '#f3efe4';

/**
 * Isometric building with the balanced snow blanket and the balanced load
 * drawn as an area load: a light load plane hovering above the snow with a
 * grid of downward dart arrows onto the surface.  Gable ridge along the depth
 * axis at x = l/2 (flat roof when the slope is ~0).  Composition centred.
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
  const t = hasSnow ? 0.14 * he : 0;
  const aLen = hasSnow ? 0.2 * he : 0; // area-load arrow length

  const fit = fitIso(l, b, he + r + t + aLen, 320, 220, 100, 44);
  const s = fit.s, oy = fit.oy;
  const ox = W / 2 - ((l - b) * C30 * s) / 2; // centre the footprint horizontally
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

  // snow top elevation at x (for the area-load arrows)
  const zTop = (x: number) => (isGable ? he + t + (x <= l / 2 ? (r * x) / (l / 2) : (r * (l - x)) / (l / 2)) : he + t);

  // area-load plane (hovering aLen above the snow) + arrow grid
  const planeRight = [p(l, 0, he + t + aLen), p(l, b, he + t + aLen), p(l / 2, b, ridgeZ + t + aLen), p(l / 2, 0, ridgeZ + t + aLen)];
  const planeLeft = [p(l / 2, 0, ridgeZ + t + aLen), p(l / 2, b, ridgeZ + t + aLen), p(0, b, he + t + aLen), p(0, 0, he + t + aLen)];
  const planeFlat = [p(0, 0, he + t + aLen), p(l, 0, he + t + aLen), p(l, b, he + t + aLen), p(0, b, he + t + aLen)];
  const gridXs = [0.12, 0.37, 0.63, 0.88].map((f) => f * l);
  const gridYs = [0.22, 0.5, 0.78].map((f) => f * b);

  const ridgeTop = p(l / 2, b * 0.5, ridgeZ + t + aLen);
  const lblY = p(0, 0, ridgeZ + t + aLen).Y - 8; // above the whole load plane
  const slopeAnchor = p(l + 0.14 * l, 0.08 * b, he + t / 2);

  return (
    <svg viewBox={`0 0 ${W} ${Hc}`} className="stl-chart" role="img" aria-label="Snow load building model">
      <defs>
        <marker id="sn3-g" markerWidth="10.5" markerHeight="7.5" refX="9.3" refY="3.5" orient="auto"><path d={DART} fill={GOLD_DEEP} /></marker>
      </defs>

      {/* ground plate + contact shadow */}
      <polygon points={poly([p(-0.3 * l, -0.3 * b, 0), p(l + 0.3 * l, -0.3 * b, 0), p(l + 0.3 * l, b + 0.3 * b, 0), p(-0.3 * l, b + 0.3 * b, 0)])} fill={INK} fillOpacity={0.015} />
      <polygon points={poly([p(0.05 * l, 0.05 * b, 0), p(l + 0.05 * l, 0.05 * b, 0), p(l + 0.05 * l, b + 0.05 * b, 0), p(0.05 * l, b + 0.05 * b, 0)])} fill={INK} fillOpacity={0.055} />

      {/* hidden edges */}
      {[[g00, gl0], [g00, g0b], [g00, p(0, 0, he)]].map(([q, c], i) => (
        <line key={i} x1={q.X} y1={q.Y} x2={c.X} y2={c.Y} stroke={LINE} strokeWidth={0.9} strokeDasharray="4 3" />
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

          {/* area load: hovering plane outline + downward dart arrows onto the snow */}
          {isGable ? (
            <>
              <polygon points={poly(planeLeft)} fill="none" stroke={GOLD_DEEP} strokeWidth={0.7} opacity={0.55} />
              <polygon points={poly(planeRight)} fill="none" stroke={GOLD_DEEP} strokeWidth={0.7} opacity={0.55} />
            </>
          ) : (
            <polygon points={poly(planeFlat)} fill="none" stroke={GOLD_DEEP} strokeWidth={0.7} opacity={0.55} />
          )}
          {gridXs.flatMap((x) =>
            gridYs.map((y) => {
              const tail = p(x, y, zTop(x) + aLen), tip = p(x, y, zTop(x) + 0.015 * he);
              return <line key={`${x}-${y}`} x1={tail.X} y1={tail.Y} x2={tip.X} y2={tip.Y} stroke={GOLD_DEEP} strokeWidth={1.1} markerEnd="url(#sn3-g)" />;
            })
          )}
        </>
      )}

      {/* labels */}
      {hasSnow && result && (
        <text x={ridgeTop.X} y={lblY} textAnchor="middle" className="stl-chart__lbl" style={{ fill: INK, fontWeight: 600, fontSize: 10 }}>
          balanced {fp(result.governing)}{result.minimumGoverns ? ' · minimum governs' : ''}
        </text>
      )}
      {!hasSnow && (
        <text x={ridgeTop.X} y={lblY} textAnchor="middle" className="stl-chart__ax">no roof snow (pg ≈ 0)</text>
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
