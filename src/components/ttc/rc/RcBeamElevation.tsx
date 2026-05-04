'use client';

import React from 'react';
import type { ElevationData, BeamInput } from '@/lib/rc/types';
import { lookupBar } from '@/lib/rc/types';

interface Props {
  input: BeamInput;
  elevation: ElevationData;
  lang?: 'en' | 'es';
}

/**
 * RcBeamElevation — side-view SVG of the beam showing:
 *   • Concrete envelope (rectangular outline)
 *   • Stirrup zones (vertical lines at each stirrup position, color-coded per zone)
 *   • Longitudinal bars: top + bottom, with running vs curtailed bars indicated
 *   • Bar curtailment markers (cutoff x position + extension)
 *   • Development-length annotations
 *   • Dimensioning along the beam length
 *
 * This is the production "Rebar Layout Drawing" — shop-drawing-quality output.
 */
export function RcBeamElevation({ input, elevation, lang = 'en' }: Props) {
  const g = input.geometry;
  const { zoning, curtailment, devLengths, lapSplices } = elevation;

  // SVG canvas — wide aspect ratio for beam elevation
  const W = 1100, H = 360;
  const padX = 60, padY = 40;
  const dimY = 30;     // vertical space for bottom dimensions
  const innerW = W - 2 * padX;
  const innerH = H - 2 * padY - dimY;

  // Beam scaling: X = beam length, Y = beam height
  // Maintain aspect ratio for the beam (h/L typical 1/15 → very wide)
  // We'll use innerW for length and a fraction of innerH for height
  const beamY = padY + 60;
  const beamH = Math.min(innerH * 0.55, 110);     // visual height of beam in px (NOT to-scale)
  const beamW = innerW;
  const beamLeftX = padX;
  const beamRightX = padX + beamW;

  const sx = (x_mm: number) => beamLeftX + (x_mm / g.L) * beamW;

  // Cover lines (visual hint for top and bottom of stirrup envelope)
  const coverPx = (g.coverClear / g.h) * beamH * 1.2;

  // Bar geometry — top bars sit just below top cover, bottom bars sit just above bottom cover
  const topBarY = beamY + coverPx + 4;
  const botBarY = beamY + beamH - coverPx - 4;

  const Lm = g.L / 1000;
  const xTickStep = Lm <= 4 ? 0.5 : Lm <= 8 ? 1 : 2;

  // Color palette per stirrup zone — distinguishable but not gaudy
  const zoneColors = ['#5fb674', '#c9a84c', '#e2766b', '#5fa3c9', '#a06fc9', '#76b6c9'];

  return (
    <div className="rc-elevation">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
           xmlns="http://www.w3.org/2000/svg" className="rc-elevation__svg">

        {/* Title */}
        <text x={W / 2} y={20} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1e293b">
          {lang === 'es'
            ? `ELEVACIÓN DEL ARMADO — Viga ${g.bw}×${g.h} mm, L = ${Lm.toFixed(2)} m`
            : `REBAR ELEVATION — Beam ${g.bw}×${g.h} mm, L = ${Lm.toFixed(2)} m`}
        </text>

        {/* Concrete envelope */}
        <rect x={beamLeftX} y={beamY} width={beamW} height={beamH}
              fill="#cdc8bf" fillOpacity="0.4" stroke="#5a4f30" strokeWidth="1.5" />

        {/* Cover band (stirrup envelope) */}
        <rect x={beamLeftX} y={beamY + coverPx} width={beamW} height={beamH - 2 * coverPx}
              fill="none" stroke="#9b8848" strokeWidth="0.4" strokeDasharray="3 3" />

        {/* === STIRRUP ZONES === */}
        {zoning.zones.map((z, zi) => {
          const x0 = sx(z.xStart);
          const x1 = sx(z.xEnd);
          const color = zoneColors[zi % zoneColors.length];
          // Render each stirrup as a vertical line within the zone
          const stirrups: React.ReactElement[] = [];
          const len = z.xEnd - z.xStart;
          const n = Math.max(2, Math.floor(len / z.s) + 1);
          for (let k = 0; k < n; k++) {
            const xs = z.xStart + (k + 0.5) * (len / n);
            if (xs < z.xStart || xs > z.xEnd) continue;
            stirrups.push(
              <line key={`s-${zi}-${k}`}
                x1={sx(xs)} y1={beamY + coverPx}
                x2={sx(xs)} y2={beamY + beamH - coverPx}
                stroke={color} strokeWidth="1.2" opacity="0.85" />
            );
          }
          return (
            <g key={`zone-${zi}`}>
              {/* Zone background tint */}
              <rect x={x0} y={beamY + beamH + 2} width={x1 - x0} height={6}
                    fill={color} opacity="0.5" />
              {/* All stirrups in this zone */}
              {stirrups}
              {/* Zone label below */}
              <text x={(x0 + x1) / 2} y={beamY + beamH + 22} textAnchor="middle"
                    fontSize="9" fontWeight="600" fill={color}>
                {`${input.reinforcement.stirrup.bar}@${z.s}`}
              </text>
              <text x={(x0 + x1) / 2} y={beamY + beamH + 32} textAnchor="middle"
                    fontSize="8" fill="#475569">
                {`${z.count} ${lang === 'es' ? 'estribos' : 'stirrups'}`}
              </text>
            </g>
          );
        })}

        {/* === LONGITUDINAL BARS === */}
        {curtailment.bars.map((bar, bi) => {
          const dbBar = lookupBar(bar.bar)?.db ?? 20;
          const isTop = bar.position === 'compression';
          const baseY = isTop ? topBarY : botBarY;
          const yOffset = bi * 4;     // stack multiple bar groups
          const y = isTop ? baseY + yOffset : baseY - yOffset;
          const color = isTop ? '#7a6450' : '#a02020';
          const xs = sx(bar.xStart);
          const xe = sx(bar.xEnd);
          const dashed = bar.kind === 'curtailed';

          return (
            <g key={`bar-${bi}`}>
              {/* The bar */}
              <line x1={xs} y1={y} x2={xe} y2={y}
                    stroke={color} strokeWidth={Math.max(1.5, dbBar / 6)}
                    strokeDasharray={dashed ? '6 3' : 'none'}
                    strokeLinecap="round" />
              {/* Curtailment marker — small "x" at theoretical cutoff */}
              {bar.kind === 'curtailed' && bar.xTheoretical !== undefined && (
                <g>
                  <line x1={sx(bar.xTheoretical)} y1={y - 4}
                        x2={sx(bar.xTheoretical)} y2={y + 4}
                        stroke="#dc2626" strokeWidth="1.5" />
                  <line x1={sx(bar.xTheoretical) - 3} y1={y - 3}
                        x2={sx(bar.xTheoretical) + 3} y2={y + 3}
                        stroke="#dc2626" strokeWidth="1" />
                </g>
              )}
              {/* Bar mark label */}
              <text x={isTop ? xs - 4 : xs - 4} y={y + 3}
                    textAnchor="end" fontSize="9" fontWeight="600" fill={color}>
                {`${bar.count}${bar.bar}`}
              </text>
            </g>
          );
        })}

        {/* === X-AXIS DIMENSION LINE === */}
        <line x1={beamLeftX} y1={H - dimY} x2={beamRightX} y2={H - dimY} stroke="#475569" strokeWidth="0.5" />
        {/* Tick marks */}
        {Array.from({ length: Math.floor(Lm / xTickStep) + 1 }, (_, i) => {
          const xt = i * xTickStep;
          const px = sx(xt * 1000);
          return (
            <g key={`tick-${i}`}>
              <line x1={px} y1={H - dimY - 3} x2={px} y2={H - dimY + 3}
                    stroke="#475569" strokeWidth="0.5" />
              <text x={px} y={H - dimY + 14} textAnchor="middle"
                    fontSize="9" fill="#1e293b">
                {`${xt.toFixed(xTickStep < 1 ? 1 : 0)} m`}
              </text>
            </g>
          );
        })}
        {/* Final tick at L */}
        <g>
          <line x1={sx(g.L)} y1={H - dimY - 3} x2={sx(g.L)} y2={H - dimY + 3}
                stroke="#475569" strokeWidth="0.5" />
          <text x={sx(g.L)} y={H - dimY + 14} textAnchor="middle"
                fontSize="9" fontWeight="600" fill="#1e293b">
            {`L = ${Lm.toFixed(2)} m`}
          </text>
        </g>

        {/* === LEGEND === */}
        <g transform={`translate(${padX}, ${H - 12})`}>
          <text x={0} y={0} fontSize="9" fill="#475569">
            {lang === 'es'
              ? `Σ acero longitudinal: ${curtailment.totalMass.toFixed(1)} kg · Σ estribos: ${zoning.totalCount} (${zoning.totalMass.toFixed(1)} kg)`
              : `Σ longitudinal steel: ${curtailment.totalMass.toFixed(1)} kg · Σ stirrups: ${zoning.totalCount} (${zoning.totalMass.toFixed(1)} kg)`}
          </text>
        </g>
        <g transform={`translate(${beamRightX - 220}, ${H - 12})`}>
          <line x1={0} y1={-3} x2={20} y2={-3} stroke="#a02020" strokeWidth="2.5" />
          <text x={24} y={0} fontSize="9" fill="#1e293b">
            {lang === 'es' ? 'Acero inferior (tracción)' : 'Bottom steel (tension)'}
          </text>
          <line x1={0} y1={9} x2={20} y2={9} stroke="#7a6450" strokeWidth="2" />
          <text x={24} y={12} fontSize="9" fill="#1e293b">
            {lang === 'es' ? 'Acero superior (percheros)' : 'Top steel (hangers)'}
          </text>
        </g>
      </svg>

      {/* Bar schedule + zone table below the drawing */}
      <div className="rc-elevation__tables">
        {/* Stirrup zones table */}
        <div className="rc-elevation__table-card">
          <h5>{lang === 'es' ? 'Zonas de estribos' : 'Stirrup zones'}</h5>
          <table className="ab-result-table">
            <thead>
              <tr>
                <th>{lang === 'es' ? 'Zona' : 'Zone'}</th>
                <th>x₀ (m)</th>
                <th>x₁ (m)</th>
                <th>{lang === 'es' ? 'Espac.' : 'Spacing'}</th>
                <th>{lang === 'es' ? 'Cant.' : 'Count'}</th>
                <th>Vu_max</th>
                <th>{lang === 'es' ? 'Util.' : 'Util.'}</th>
                <th>{lang === 'es' ? 'Estado' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {zoning.zones.map((z, zi) => (
                <tr key={zi} className={!z.ok ? 'ab-row-fail' : undefined}>
                  <td><span style={{ display: 'inline-block', width: 10, height: 10, background: zoneColors[zi % zoneColors.length], marginRight: 4 }} />{zi + 1}</td>
                  <td>{(z.xStart / 1000).toFixed(2)}</td>
                  <td>{(z.xEnd / 1000).toFixed(2)}</td>
                  <td>{`${input.reinforcement.stirrup.bar}@${z.s} mm`}</td>
                  <td>{z.count}</td>
                  <td>{z.VuMax.toFixed(1)} kN</td>
                  <td className={z.ratio > 1 ? 'ab-fail' : 'ab-pass'}>{(z.ratio * 100).toFixed(1)}%</td>
                  <td>{z.ok ? '✓' : '✗'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bar schedule with cutoffs */}
        <div className="rc-elevation__table-card">
          <h5>{lang === 'es' ? 'Esquema de barras (despiece)' : 'Bar schedule (cutoffs)'}</h5>
          <table className="ab-result-table">
            <thead>
              <tr>
                <th>{lang === 'es' ? 'Marca' : 'Mark'}</th>
                <th>{lang === 'es' ? 'Posición' : 'Position'}</th>
                <th>{lang === 'es' ? 'Barra' : 'Bar'}</th>
                <th>{lang === 'es' ? 'Cant.' : 'Qty'}</th>
                <th>{lang === 'es' ? 'Tipo' : 'Type'}</th>
                <th>x₀ (m)</th>
                <th>x₁ (m)</th>
                <th>{lang === 'es' ? 'Long. (mm)' : 'Length (mm)'}</th>
              </tr>
            </thead>
            <tbody>
              {curtailment.bars.map((bar, bi) => (
                <tr key={bi}>
                  <td>{bar.position === 'tension' ? `T${bi + 1}` : `C${bi + 1}`}</td>
                  <td>{bar.position === 'tension' ? (lang === 'es' ? 'Inferior' : 'Bottom') : (lang === 'es' ? 'Superior' : 'Top')}</td>
                  <td>{bar.bar}</td>
                  <td>{bar.count}</td>
                  <td>{bar.kind === 'running' ? (lang === 'es' ? 'Corrida' : 'Running') : (lang === 'es' ? 'Cortada' : 'Curtailed')}</td>
                  <td>{(bar.xStart / 1000).toFixed(2)}</td>
                  <td>{(bar.xEnd / 1000).toFixed(2)}</td>
                  <td>{(bar.xEnd - bar.xStart).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Development length + lap splices */}
        <div className="rc-elevation__table-card">
          <h5>{lang === 'es' ? 'Longitud de desarrollo y empalmes (§25.4 / §25.5)' : 'Development length & lap splices (§25.4 / §25.5)'}</h5>
          <table className="ab-result-table">
            <thead>
              <tr>
                <th>{lang === 'es' ? 'Barra' : 'Bar'}</th>
                <th>db (mm)</th>
                <th>ld (mm)</th>
                <th>ldc (mm)</th>
                <th>{lang === 'es' ? 'Empalme A' : 'Splice A'}</th>
                <th>{lang === 'es' ? 'Empalme B' : 'Splice B'}</th>
                <th>{lang === 'es' ? 'Recomendado' : 'Recommended'}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(devLengths).map(([bar, info]) => {
                const splice = lapSplices[bar];
                return (
                  <tr key={bar}>
                    <td>{bar}</td>
                    <td>{info.db.toFixed(1)}</td>
                    <td>{info.ld.toFixed(0)}</td>
                    <td>{info.ldc.toFixed(0)}</td>
                    <td>{splice.classA.toFixed(0)}</td>
                    <td>{splice.classB.toFixed(0)}</td>
                    <td><strong>{splice.recommended === 'A' ? 'A (1.0·ld)' : 'B (1.3·ld)'}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
