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
 * RcBeamElevation — shop-drawing quality side-view of the beam.
 *
 * Layout (top to bottom):
 *   1. Title bar
 *   2. TOP rebar dimension chain (bar callouts: "2 #9 Cont.", "2 #9 (4.25 m)")
 *   3. ELEVATION drawing (concrete + column supports + visible stirrups at
 *      actual zone density + top/bottom bars + skin reinforcement)
 *   4. BOTTOM rebar dimension chain (bar callouts below the beam)
 *   5. STIRRUP ZONE chain (callouts "12 × #3 @ 200")
 *   6. Span dimension line (L = X.XX m)
 *
 *   Right side: CROSS-SECTION INSET (mini section A-A view)
 */
export function RcBeamElevation({ input, elevation, lang = 'en' }: Props) {
  const g = input.geometry;
  const r = input.reinforcement;
  const { zoning, curtailment, devLengths, lapSplices } = elevation;

  // ── Canvas layout ────────────────────────────────────────────────────────
  const W = 1400, H = 540;
  const sectionInsetW = 220;                 // right-side cross-section inset
  const padL = 60, padR = sectionInsetW + 30, padT = 40, padB = 40;
  const canvasInnerW = W - padL - padR;

  // Vertical zones inside the elevation
  const titleH = 0;                           // title is ABOVE everything (uses padT)
  const topChainH = 70;                       // top bar callouts
  const elevH = 180;                          // beam elevation
  const botChainH = 60;                       // bottom bar callouts
  const stirrupChainH = 60;                   // stirrup zone callouts
  const spanDimH = 40;                        // overall L dimension

  void titleH;

  const topChainY = padT + 5;
  const elevY = topChainY + topChainH;
  const botChainY = elevY + elevH;
  const stirrupChainY = botChainY + botChainH;
  const spanDimY = stirrupChainY + stirrupChainH;

  const beamLeft = padL;
  const beamRight = padL + canvasInnerW;
  const beamW = beamRight - beamLeft;

  // Beam visual height in elevation (NOT-to-scale to match drawing aesthetic)
  const beamVisH = Math.min(elevH * 0.7, 130);
  const beamTop = elevY + (elevH - beamVisH) / 2;
  const beamBot = beamTop + beamVisH;

  const sx = (x_mm: number) => beamLeft + (x_mm / g.L) * beamW;

  // Visual cover band depth
  const coverPx = (g.coverClear / g.h) * beamVisH * 1.3;

  const Lm = g.L / 1000;

  // ── Bar layout ───────────────────────────────────────────────────────────
  const tensionBars = curtailment.bars.filter((b) => b.position === 'tension');
  const compressionBars = curtailment.bars.filter((b) => b.position === 'compression');

  // Y rows for bars (within concrete band)
  const topBarRowY = beamTop + coverPx + 6;
  const botBarRowY = beamBot - coverPx - 6;

  // Color palette per stirrup zone
  const zoneColors = ['#5fb674', '#c9a84c', '#e2766b', '#5fa3c9', '#a06fc9', '#76b6c9'];

  const t = (en: string, es: string) => (lang === 'es' ? es : en);

  return (
    <div className="rc-elevation">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
           xmlns="http://www.w3.org/2000/svg" className="rc-elevation__svg">

        <defs>
          {/* Hatching pattern for column ends */}
          <pattern id="col-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" />
          </pattern>
          <pattern id="col-hatch-inset" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
          </pattern>
          {/* Arrow marker for dimension lines */}
          <marker id="arrow-dim" viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.92)" />
          </marker>
          <marker id="arrow-dim-rev" viewBox="0 0 10 10" refX="1" refY="5"
                  markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 10 0 L 0 5 L 10 10 z" fill="rgba(255,255,255,0.92)" />
          </marker>
        </defs>

        {/* === TITLE === */}
        <text x={W / 2} y={22} textAnchor="middle" fontSize="14" fontWeight="700" fill="rgba(255,255,255,0.92)">
          {t(`BEAM ELEVATION — ${g.bw}×${g.h} mm — L = ${Lm.toFixed(2)} m`,
             `ELEVACIÓN DE VIGA — ${g.bw}×${g.h} mm — L = ${Lm.toFixed(2)} m`)}
        </text>

        {/* ════════════ TOP REBAR DIMENSION CHAIN ════════════ */}
        {compressionBars.map((bar, bi) => {
          const xs = sx(bar.xStart);
          const xe = sx(bar.xEnd);
          const yLine = topChainY + 18 + bi * 22;
          const lengthM = (bar.xEnd - bar.xStart) / 1000;
          const callout = bar.kind === 'running'
            ? `${bar.count} ${bar.bar} ${t('Top Cont.', 'Sup. Cont.')}`
            : `${bar.count} ${bar.bar} (${lengthM.toFixed(2)} m)`;
          return (
            <g key={`tc-${bi}`}>
              {/* End ticks */}
              <line x1={xs} y1={yLine - 4} x2={xs} y2={yLine + 4} stroke="rgba(255,255,255,0.85)" strokeWidth="0.8" />
              <line x1={xe} y1={yLine - 4} x2={xe} y2={yLine + 4} stroke="rgba(255,255,255,0.85)" strokeWidth="0.8" />
              {/* Dimension line */}
              <line x1={xs} y1={yLine} x2={xe} y2={yLine} stroke="rgba(255,255,255,0.85)" strokeWidth="0.6" />
              {/* Callout text */}
              <text x={(xs + xe) / 2} y={yLine - 6} textAnchor="middle"
                    fontSize="10" fontWeight="600" fill="#76b6c9">
                {callout}
              </text>
              {/* Bar mark badge */}
              <g>
                <circle cx={xs - 12} cy={yLine} r="9" fill="#c0a890" stroke="rgba(20,20,20,0.85)" strokeWidth="0.7" />
                <text x={xs - 12} y={yLine + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="#1a1a1a">
                  {`C${bi + 1}`}
                </text>
              </g>
            </g>
          );
        })}

        {/* ════════════ BEAM ELEVATION ════════════ */}
        {/* Column at left support */}
        <rect x={beamLeft - 28} y={beamTop - 6} width="28" height={beamVisH + 12}
              fill="url(#col-hatch)" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        <rect x={beamLeft - 28} y={beamTop - 6} width="28" height={beamVisH + 12}
              fill="rgba(180,180,180,0.15)" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />

        {/* Column at right support */}
        <rect x={beamRight} y={beamTop - 6} width="28" height={beamVisH + 12}
              fill="url(#col-hatch)" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        <rect x={beamRight} y={beamTop - 6} width="28" height={beamVisH + 12}
              fill="rgba(180,180,180,0.15)" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />

        {/* Concrete envelope */}
        <rect x={beamLeft} y={beamTop} width={beamW} height={beamVisH}
              fill="rgba(180,180,180,0.15)" stroke="#c9a84c" strokeWidth="1.5" />

        {/* Cover band (dashed inset) */}
        <rect x={beamLeft} y={beamTop + coverPx} width={beamW} height={beamVisH - 2 * coverPx}
              fill="none" stroke="rgba(201, 168, 76, 0.4)" strokeWidth="0.4" strokeDasharray="3 3" />

        {/* === STIRRUPS DRAWN AT REAL ZONE DENSITY === */}
        {zoning.zones.map((z, zi) => {
          const x0 = sx(z.xStart);
          const x1 = sx(z.xEnd);
          const color = zoneColors[zi % zoneColors.length];
          // Compute actual stirrup positions in this zone
          const stirrups: React.ReactElement[] = [];
          // Spacing in pixels = (z.s / g.L) * beamW
          const sPx = (z.s / g.L) * beamW;
          const len = z.xEnd - z.xStart;
          const n = Math.max(2, Math.floor(len / z.s) + 1);
          for (let k = 0; k < n; k++) {
            const x_mm = z.xStart + k * (len / (n - 1));
            const px = sx(x_mm);
            if (px < x0 - 0.5 || px > x1 + 0.5) continue;
            stirrups.push(
              <line key={`stirrup-${zi}-${k}`}
                x1={px} y1={beamTop + coverPx}
                x2={px} y2={beamBot - coverPx}
                stroke={color} strokeWidth="1.3" opacity="0.9" />
            );
          }
          void sPx;
          return (
            <g key={`zone-${zi}`}>
              {/* Subtle zone tint band */}
              <rect x={x0} y={beamTop + coverPx + 1} width={x1 - x0} height={beamVisH - 2 * coverPx - 2}
                    fill={color} opacity="0.05" />
              {stirrups}
            </g>
          );
        })}

        {/* === LONGITUDINAL BARS (inside concrete) === */}
        {/* Top bars */}
        {compressionBars.map((bar, bi) => {
          const xs = sx(bar.xStart);
          const xe = sx(bar.xEnd);
          const dbBar = lookupBar(bar.bar)?.db ?? 12;
          const y = topBarRowY + bi * 4;
          const dashed = bar.kind === 'curtailed';
          return (
            <g key={`top-bar-${bi}`}>
              <line x1={xs} y1={y} x2={xe} y2={y}
                    stroke="#c0a890" strokeWidth={Math.max(1.6, dbBar / 5)}
                    strokeDasharray={dashed ? '6 3' : 'none'}
                    strokeLinecap="round" />
              {/* Theoretical cutoff marker */}
              {bar.kind === 'curtailed' && bar.xTheoretical !== undefined && (
                <line x1={sx(bar.xTheoretical)} y1={y - 5}
                      x2={sx(bar.xTheoretical)} y2={y + 5}
                      stroke="#ff6a55" strokeWidth="1.5" />
              )}
            </g>
          );
        })}

        {/* Bottom bars (tension) */}
        {tensionBars.map((bar, bi) => {
          const xs = sx(bar.xStart);
          const xe = sx(bar.xEnd);
          const dbBar = lookupBar(bar.bar)?.db ?? 25;
          const y = botBarRowY - bi * 4;
          const dashed = bar.kind === 'curtailed';
          return (
            <g key={`bot-bar-${bi}`}>
              <line x1={xs} y1={y} x2={xe} y2={y}
                    stroke="#ff8a72" strokeWidth={Math.max(1.8, dbBar / 5)}
                    strokeDasharray={dashed ? '6 3' : 'none'}
                    strokeLinecap="round" />
              {bar.kind === 'curtailed' && bar.xTheoretical !== undefined && (
                <line x1={sx(bar.xTheoretical)} y1={y - 5}
                      x2={sx(bar.xTheoretical)} y2={y + 5}
                      stroke="#ff6a55" strokeWidth="1.5" />
              )}
            </g>
          );
        })}

        {/* Skin reinforcement (if present) */}
        {r.skin && r.skin.countPerFace > 0 && (() => {
          // Show 1 representative skin bar at mid-height
          const y = (beamTop + beamBot) / 2;
          return (
            <g>
              <line x1={beamLeft + 2} y1={y} x2={beamRight - 2} y2={y}
                    stroke="#76b6c9" strokeWidth="1.6" strokeDasharray="2 2" />
              <text x={beamRight - 6} y={y - 3} textAnchor="end"
                    fontSize="8.5" fill="#76b6c9" fontStyle="italic">
                {`${r.skin.countPerFace} × ${r.skin.bar} skin (each face)`}
              </text>
            </g>
          );
        })()}

        {/* ════════════ BOTTOM REBAR DIMENSION CHAIN ════════════ */}
        {tensionBars.map((bar, bi) => {
          const xs = sx(bar.xStart);
          const xe = sx(bar.xEnd);
          const yLine = botChainY + 14 + bi * 22;
          const lengthM = (bar.xEnd - bar.xStart) / 1000;
          const callout = bar.kind === 'running'
            ? `${bar.count} ${bar.bar} ${t('Bot. Cont.', 'Inf. Cont.')}`
            : `${bar.count} ${bar.bar} (${lengthM.toFixed(2)} m)`;
          return (
            <g key={`bc-${bi}`}>
              <line x1={xs} y1={yLine - 4} x2={xs} y2={yLine + 4} stroke="rgba(255,255,255,0.85)" strokeWidth="0.8" />
              <line x1={xe} y1={yLine - 4} x2={xe} y2={yLine + 4} stroke="rgba(255,255,255,0.85)" strokeWidth="0.8" />
              <line x1={xs} y1={yLine} x2={xe} y2={yLine} stroke="rgba(255,255,255,0.85)" strokeWidth="0.6" />
              <text x={(xs + xe) / 2} y={yLine + 14} textAnchor="middle"
                    fontSize="10" fontWeight="600" fill="#e2766b">
                {callout}
              </text>
              {/* Bar mark badge */}
              <g>
                <circle cx={xs - 12} cy={yLine} r="9" fill="#ff8a72" stroke="rgba(20,20,20,0.85)" strokeWidth="0.7" />
                <text x={xs - 12} y={yLine + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="#1a1a1a">
                  {`T${bi + 1}`}
                </text>
              </g>
            </g>
          );
        })}

        {/* ════════════ STIRRUP ZONE DIMENSION CHAIN ════════════ */}
        {zoning.zones.map((z, zi) => {
          const x0 = sx(z.xStart);
          const x1 = sx(z.xEnd);
          const yLine = stirrupChainY + 22;
          const color = zoneColors[zi % zoneColors.length];
          const callout = `${z.count} × ${r.stirrup.bar} @ ${z.s}`;
          const lengthM = (z.xEnd - z.xStart) / 1000;
          return (
            <g key={`zc-${zi}`}>
              {/* Vertical extension lines from beam to chain */}
              <line x1={x0} y1={beamBot + 4} x2={x0} y2={yLine + 4}
                    stroke={color} strokeWidth="0.5" strokeDasharray="1 2" opacity="0.6" />
              <line x1={x1} y1={beamBot + 4} x2={x1} y2={yLine + 4}
                    stroke={color} strokeWidth="0.5" strokeDasharray="1 2" opacity="0.6" />
              {/* Dim ticks */}
              <line x1={x0} y1={yLine - 5} x2={x0} y2={yLine + 5} stroke={color} strokeWidth="1.2" />
              <line x1={x1} y1={yLine - 5} x2={x1} y2={yLine + 5} stroke={color} strokeWidth="1.2" />
              {/* Dim line with arrows */}
              <line x1={x0 + 2} y1={yLine} x2={x1 - 2} y2={yLine}
                    stroke={color} strokeWidth="0.8"
                    markerStart="url(#arrow-dim-rev)" markerEnd="url(#arrow-dim)" />
              {/* Callout */}
              <text x={(x0 + x1) / 2} y={yLine - 6} textAnchor="middle"
                    fontSize="10" fontWeight="700" fill={color}>
                {callout}
              </text>
              <text x={(x0 + x1) / 2} y={yLine + 14} textAnchor="middle"
                    fontSize="9" fill="rgba(255,255,255,0.55)">
                {`${lengthM.toFixed(2)} m`}
              </text>
            </g>
          );
        })}

        {/* ════════════ DISTANCE-FROM-SUPPORTS markers (left and right) ════════════ */}
        {(() => {
          // Distance from face of support to first stirrup (typically ≤ 50mm)
          // and stirrup zone start labels at left support
          const firstZone = zoning.zones[0];
          if (!firstZone) return null;
          const firstStirrupX = firstZone.xStart + firstZone.s / 2;
          const yLine = stirrupChainY + 46;
          return (
            <g>
              {/* Tiny distance from support to first stirrup */}
              <text x={beamLeft + 3} y={yLine} textAnchor="start"
                    fontSize="8" fill="rgba(255,255,255,0.55)" fontStyle="italic">
                {`${(firstStirrupX).toFixed(0)} mm ${t('to 1st stirrup', 'al 1er estribo')}`}
              </text>
            </g>
          );
        })()}

        {/* ════════════ OVERALL SPAN DIMENSION ════════════ */}
        {(() => {
          const yLine = spanDimY + 16;
          return (
            <g>
              {/* Extension lines to columns */}
              <line x1={beamLeft - 14} y1={beamBot + 8} x2={beamLeft - 14} y2={yLine + 8}
                    stroke="rgba(255,255,255,0.85)" strokeWidth="0.5" />
              <line x1={beamRight + 14} y1={beamBot + 8} x2={beamRight + 14} y2={yLine + 8}
                    stroke="rgba(255,255,255,0.85)" strokeWidth="0.5" />
              {/* Column-to-column dim line */}
              <line x1={beamLeft - 14} y1={yLine} x2={beamRight + 14} y2={yLine}
                    stroke="rgba(255,255,255,0.85)" strokeWidth="0.8"
                    markerStart="url(#arrow-dim-rev)" markerEnd="url(#arrow-dim)" />
              {/* Dim text */}
              <text x={(beamLeft + beamRight) / 2} y={yLine - 6} textAnchor="middle"
                    fontSize="11" fontWeight="700" fill="rgba(255,255,255,0.92)">
                {`L = ${Lm.toFixed(2)} m`}
              </text>
            </g>
          );
        })()}

        {/* ════════════ CROSS-SECTION INSET (right side) ════════════ */}
        <g transform={`translate(${W - sectionInsetW - 15}, ${padT + 10})`}>
          <text x={sectionInsetW / 2} y="16" textAnchor="middle"
                fontSize="11" fontWeight="700" fill="rgba(255,255,255,0.92)">
            {t('SECTION A-A', 'SECCIÓN A-A')}
          </text>
          <text x={sectionInsetW / 2} y="30" textAnchor="middle"
                fontSize="9" fill="rgba(255,255,255,0.6)">
            {`${g.bw} × ${g.h} mm`}
          </text>
          {/* Render mini cross-section */}
          <CrossSectionInset
            input={input}
            originX={20}
            originY={50}
            width={sectionInsetW - 40}
            height={sectionInsetW + 10}
          />
        </g>

        {/* Section A-A label on the elevation (vertical line + label) */}
        {(() => {
          const x_section = sx(g.L / 2);
          return (
            <g>
              <line x1={x_section} y1={beamTop - 4} x2={x_section} y2={beamBot + 4}
                    stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" strokeDasharray="4 2" />
              <g transform={`translate(${x_section}, ${beamTop - 8})`}>
                <circle cx="0" cy="-6" r="8" fill="rgba(255,255,255,0.92)" stroke="rgba(20,20,20,0.3)" strokeWidth="0.5" />
                <text x="0" y="-3" textAnchor="middle" fontSize="9" fontWeight="700" fill="#1a1a1a">A</text>
              </g>
              <g transform={`translate(${x_section}, ${beamBot + 8})`}>
                <circle cx="0" cy="6" r="8" fill="rgba(255,255,255,0.92)" stroke="rgba(20,20,20,0.3)" strokeWidth="0.5" />
                <text x="0" y="9" textAnchor="middle" fontSize="9" fontWeight="700" fill="#1a1a1a">A</text>
              </g>
            </g>
          );
        })()}

      </svg>

      {/* ════════════ TABLES BELOW THE DRAWING ════════════ */}
      <div className="rc-elevation__tables">
        <div className="rc-elevation__table-card">
          <h5>{t('Stirrup zones', 'Zonas de estribos')}</h5>
          <div className="ab-table-scroll">
            <table className="ab-result-table">
              <thead>
                <tr>
                  <th>{t('Zone', 'Zona')}</th>
                  <th>x₀ (m)</th>
                  <th>x₁ (m)</th>
                  <th>{t('Spacing', 'Espac.')}</th>
                  <th>{t('Count', 'Cant.')}</th>
                  <th>{t('Mark', 'Marca')}</th>
                  <th>Vu_max</th>
                  <th>{t('Util.', 'Util.')}</th>
                  <th>{t('Status', 'Estado')}</th>
                </tr>
              </thead>
              <tbody>
                {zoning.zones.map((z, zi) => (
                  <tr key={zi} className={!z.ok ? 'ab-row-fail' : undefined}>
                    <td>
                      <span style={{ display: 'inline-block', width: 10, height: 10,
                        background: zoneColors[zi % zoneColors.length], marginRight: 4 }} />
                      {zi + 1}
                    </td>
                    <td>{(z.xStart / 1000).toFixed(2)}</td>
                    <td>{(z.xEnd / 1000).toFixed(2)}</td>
                    <td>{`${r.stirrup.bar}@${z.s} mm`}</td>
                    <td>{z.count}</td>
                    <td>{`S${zi + 1}`}</td>
                    <td>{z.VuMax.toFixed(1)} kN</td>
                    <td className={z.ratio > 1 ? 'ab-fail' : 'ab-pass'}>
                      {(z.ratio * 100).toFixed(1)}%
                    </td>
                    <td>{z.ok ? '✓' : '✗'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rc-elevation__table-card">
          <h5>{t('Bar schedule (cutoffs)', 'Esquema de barras (despiece)')}</h5>
          <div className="ab-table-scroll">
            <table className="ab-result-table">
              <thead>
                <tr>
                  <th>{t('Mark', 'Marca')}</th>
                  <th>{t('Position', 'Posición')}</th>
                  <th>{t('Bar', 'Barra')}</th>
                  <th>{t('Qty', 'Cant.')}</th>
                  <th>{t('Type', 'Tipo')}</th>
                  <th>x₀ (m)</th>
                  <th>x₁ (m)</th>
                  <th>{t('Length (mm)', 'Long. (mm)')}</th>
                </tr>
              </thead>
              <tbody>
                {curtailment.bars.map((bar, bi) => (
                  <tr key={bi}>
                    <td>{bar.position === 'tension' ? `T${bi + 1}` : `C${bi + 1}`}</td>
                    <td>{bar.position === 'tension' ? t('Bottom', 'Inferior') : t('Top', 'Superior')}</td>
                    <td>{bar.bar}</td>
                    <td>{bar.count}</td>
                    <td>{bar.kind === 'running' ? t('Running', 'Corrida') : t('Curtailed', 'Cortada')}</td>
                    <td>{(bar.xStart / 1000).toFixed(2)}</td>
                    <td>{(bar.xEnd / 1000).toFixed(2)}</td>
                    <td>{(bar.xEnd - bar.xStart).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rc-elevation__table-card">
          <h5>{t('Development length & lap splices (§25.4 / §25.5)',
                'Longitud de desarrollo y empalmes (§25.4 / §25.5)')}</h5>
          <div className="ab-table-scroll">
            <table className="ab-result-table">
              <thead>
                <tr>
                  <th>{t('Bar', 'Barra')}</th>
                  <th>db (mm)</th>
                  <th>ld (mm)</th>
                  <th>ldc (mm)</th>
                  <th>{t('Splice A', 'Empalme A')}</th>
                  <th>{t('Splice B', 'Empalme B')}</th>
                  <th>{t('Recommended', 'Recomendado')}</th>
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
    </div>
  );
}

// ============================================================================
// Cross-section inset component — mini section view inside the elevation SVG
// ============================================================================
function CrossSectionInset({ input, originX, originY, width, height }: {
  input: BeamInput;
  originX: number; originY: number;
  width: number; height: number;
}) {
  const g = input.geometry;
  const r = input.reinforcement;
  // Choose scale to fit the widest dimension (bf for T/L/inv-T) inside the inset box
  const widest = g.shape !== 'rectangular' ? Math.max(g.bf ?? g.bw, g.bw) : g.bw;
  const scale = Math.min(width / widest, height / g.h) * 0.85;
  const drawW = g.bw * scale;
  const drawH = g.h * scale;
  const cx = originX + width / 2;
  const top = originY + (height - drawH) / 2;
  const bfPx = (g.bf ?? g.bw) * scale;
  const hfPx = (g.hf ?? 120) * scale;

  const stirrupDb = lookupBar(r.stirrup.bar)?.db ?? 9.5;
  const dbT = lookupBar(r.tension[0]?.bar)?.db ?? 25;
  const dbC = lookupBar(r.compression?.[0]?.bar ?? '#4')?.db ?? 12.7;

  // Bar positions
  const tensTotal = r.tension.reduce((s, bg) => s + bg.count, 0);
  const compTotal = (r.compression ?? []).reduce((s, bg) => s + bg.count, 0);
  const innerSpan = drawW - 2 * (g.coverClear + stirrupDb + dbT / 2) * scale;

  return (
    <g>
      {/* Concrete outline — shape-aware */}
      {(() => {
        const fill = "rgba(180,180,180,0.18)";
        const stroke = "rgba(255,255,255,0.45)";
        if (g.shape === 'rectangular') {
          return (
            <rect x={cx - drawW / 2} y={top} width={drawW} height={drawH}
                  fill={fill} stroke={stroke} strokeWidth="1" />
          );
        }
        if (g.shape === 'inverted-T') {
          const webL = cx - drawW / 2;
          const flangeL = cx - bfPx / 2;
          const yWebBot = top + drawH - hfPx;
          const path =
            `M ${webL} ${top} L ${webL + drawW} ${top} L ${webL + drawW} ${yWebBot} ` +
            `L ${flangeL + bfPx} ${yWebBot} L ${flangeL + bfPx} ${top + drawH} ` +
            `L ${flangeL} ${top + drawH} L ${flangeL} ${yWebBot} L ${webL} ${yWebBot} Z`;
          return <path d={path} fill={fill} stroke={stroke} strokeWidth="1" strokeLinejoin="miter" />;
        }
        if (g.shape === 'L-beam') {
          const webR = cx + drawW / 2;
          const flangeL = webR - bfPx;
          const path =
            `M ${flangeL} ${top} L ${webR} ${top} L ${webR} ${top + drawH} ` +
            `L ${webR - drawW} ${top + drawH} L ${webR - drawW} ${top + hfPx} ` +
            `L ${flangeL} ${top + hfPx} Z`;
          return <path d={path} fill={fill} stroke={stroke} strokeWidth="1" strokeLinejoin="miter" />;
        }
        // Default: T-beam — flange on top, web below
        const webL = cx - drawW / 2;
        const flangeL = cx - bfPx / 2;
        const path =
          `M ${flangeL} ${top} L ${flangeL + bfPx} ${top} L ${flangeL + bfPx} ${top + hfPx} ` +
          `L ${webL + drawW} ${top + hfPx} L ${webL + drawW} ${top + drawH} ` +
          `L ${webL} ${top + drawH} L ${webL} ${top + hfPx} L ${flangeL} ${top + hfPx} Z`;
        return <path d={path} fill={fill} stroke={stroke} strokeWidth="1" strokeLinejoin="miter" />;
      })()}
      {/* Stirrup outline (dashed inset) */}
      <rect
        x={cx - drawW / 2 + g.coverClear * scale}
        y={top + g.coverClear * scale}
        width={drawW - 2 * g.coverClear * scale}
        height={drawH - 2 * g.coverClear * scale}
        fill="none" stroke="#76b6c9" strokeWidth="1.3" rx={stirrupDb * scale} />

      {/* Tension bars (bottom row) */}
      {Array.from({ length: tensTotal }, (_, i) => {
        const startX = cx - innerSpan / 2;
        const dx = tensTotal > 1 ? innerSpan / (tensTotal - 1) : 0;
        const cy = top + drawH - (g.coverClear + stirrupDb + dbT / 2) * scale;
        return (
          <circle key={`tns-${i}`}
            cx={tensTotal === 1 ? cx : startX + i * dx}
            cy={cy}
            r={Math.max(2, dbT * scale / 2)}
            fill="#cbd5e1" stroke="#e2e8f0" strokeWidth="0.4" />
        );
      })}

      {/* Compression bars (top row) */}
      {Array.from({ length: compTotal }, (_, i) => {
        const startX = cx - innerSpan / 2;
        const dx = compTotal > 1 ? innerSpan / (compTotal - 1) : 0;
        const cy = top + (g.coverClear + stirrupDb + dbC / 2) * scale;
        return (
          <circle key={`cmp-${i}`}
            cx={compTotal === 1 ? cx : startX + i * dx}
            cy={cy}
            r={Math.max(2, dbC * scale / 2)}
            fill="#cbd5e1" stroke="#e2e8f0" strokeWidth="0.4" />
        );
      })}

      {/* Skin reinforcement */}
      {r.skin && r.skin.countPerFace > 0 && (() => {
        const dbS = lookupBar(r.skin.bar)?.db ?? 12;
        const xL = cx - drawW / 2 + (g.coverClear + stirrupDb + dbS / 2) * scale;
        const xR = cx + drawW / 2 - (g.coverClear + stirrupDb + dbS / 2) * scale;
        const yTop = top + drawH / 2;
        const yBot = top + drawH - (g.coverClear + stirrupDb + dbT) * scale - 30 * scale;
        const span = Math.max(yBot - yTop, 1);
        const dy = r.skin.countPerFace > 1 ? span / (r.skin.countPerFace - 1) : 0;
        return Array.from({ length: r.skin.countPerFace }, (_, i) => (
          <g key={`skin-${i}`}>
            <circle cx={xL} cy={yTop + i * dy} r={Math.max(1.5, dbS * scale / 2)}
                    fill="#76b6c9" stroke="rgba(255,255,255,0.5)" strokeWidth="0.4" />
            <circle cx={xR} cy={yTop + i * dy} r={Math.max(1.5, dbS * scale / 2)}
                    fill="#76b6c9" stroke="rgba(255,255,255,0.5)" strokeWidth="0.4" />
          </g>
        ));
      })()}

      {/* Dimensions */}
      <text x={cx} y={top + drawH + 14} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="rgba(255,255,255,0.92)">
        {`b = ${g.bw}`}
      </text>
      <text x={cx + drawW / 2 + 6} y={top + drawH / 2}
            textAnchor="start" fontSize="8.5" fontWeight="600" fill="rgba(255,255,255,0.92)"
            transform={`rotate(90, ${cx + drawW / 2 + 6}, ${top + drawH / 2})`}>
        {`h = ${g.h}`}
      </text>
    </g>
  );
}
