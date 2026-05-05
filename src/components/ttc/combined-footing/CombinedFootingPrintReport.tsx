'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import type { CombinedFootingInput, CombinedFootingAnalysis } from '@/lib/combined-footing/types';
import type { CalcStep } from '@/lib/footing/types';
import { buildCombinedCheckSummary, formatRatio } from '@/lib/combined-footing/format';
import { CombinedFootingPlan2D } from './CombinedFootingPlan2D';
import { CombinedFootingSection2D } from './CombinedFootingSection2D';

interface Props {
  input: CombinedFootingInput;
  result: CombinedFootingAnalysis;
  cover3dDataUrl?: string;
}

export function CombinedFootingPrintReport({ input, result, cover3dDataUrl }: Props) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const portalEl = document.querySelector('.slab-print-portal');
  if (!portalEl) {
    const body = typeof document !== 'undefined' ? document.body : null;
    if (!body) return null;
    return createPortal(<ReportContent input={input} result={result} cover3dDataUrl={cover3dDataUrl} />, body);
  }
  return createPortal(<ReportContent input={input} result={result} cover3dDataUrl={cover3dDataUrl} />, portalEl);
}

function ReportContent({ input, result, cover3dDataUrl }: Props) {
  const summary = buildCombinedCheckSummary(result);
  const today = new Date().toLocaleDateString();
  const branding = input.branding;

  return (
    <div className="pr-doc">
      {/* PAGE 1 — COVER */}
      <section className="pr-page pr-cover">
        <div className="pr-cover__brand">
          {branding?.logoDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoDataUrl} alt="logo" className="pr-cover__logo" />
          )}
          <div>
            <div className="pr-cover__company">
              {branding?.companyName ?? 'BuildSync — Combined Footing Design'}
            </div>
            <div className="pr-cover__tagline">
              {branding?.companyTagline ?? `${input.code} — Two-column combined footing`}
            </div>
          </div>
        </div>

        <h1 className="pr-cover__title">Combined Footing Design Report</h1>
        <div className="pr-cover__meta">
          <div><strong>Date:</strong> {today}</div>
          <div><strong>Code:</strong> {input.code} (SI Units)</div>
          <div><strong>Footing:</strong> {(input.geometry.L / 1000).toFixed(2)} × {(input.geometry.B / 1000).toFixed(2)} × {(input.geometry.T / 1000).toFixed(2)} m</div>
          <div><strong>Columns:</strong> 2 ({input.column1.cl}×{input.column1.ct ?? input.column1.cl} mm + {input.column2.cl}×{input.column2.ct ?? input.column2.cl} mm)</div>
        </div>

        {cover3dDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover3dDataUrl} alt="3D combined footing" className="pr-cover__hero" />
        )}

        <table className="pr-checks-table">
          <thead>
            <tr><th>Check</th><th>Reference</th><th>Demand</th><th>Capacity</th><th>Ratio</th><th>Status</th></tr>
          </thead>
          <tbody>
            {summary.map((row, i) => (
              <tr key={i} className={row.ok ? 'pr-row-pass' : 'pr-row-fail'}>
                <td>{row.label}</td>
                <td><small>{row.ref}</small></td>
                <td>{row.demand}</td>
                <td>{row.capacity}</td>
                <td>{formatRatio(row.ratio)}</td>
                <td>{row.notApplicable ? 'N/A' : row.ok ? '✓' : '✗'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pr-cover__signature">
          <div className="pr-blank">Engineer signature</div>
          <div className="pr-blank">License #</div>
          <div className="pr-blank">Date</div>
        </div>
      </section>

      {/* PAGE 2 — INPUTS */}
      <section className="pr-page">
        <h2>Inputs Summary</h2>
        <table className="pr-inputs-table">
          <tbody>
            <tr><th colSpan={2}>Geometry</th></tr>
            <tr><td>Footing L (longitudinal)</td><td>{input.geometry.L} mm</td></tr>
            <tr><td>Footing B (transverse)</td><td>{input.geometry.B} mm</td></tr>
            <tr><td>Thickness T</td><td>{input.geometry.T} mm</td></tr>
            <tr><td>Clear cover</td><td>{input.geometry.coverClear} mm</td></tr>
            <tr><td>Embedment</td><td>{input.geometry.embedment ?? 0} mm</td></tr>
            <tr><th colSpan={2}>Column 1 (typically exterior)</th></tr>
            <tr><td>Shape</td><td>{input.column1.shape}</td></tr>
            <tr><td>cl × ct</td><td>{input.column1.cl} × {input.column1.ct ?? input.column1.cl} mm</td></tr>
            <tr><td>Position along L</td><td>{input.column1.position} mm</td></tr>
            <tr><td>P<sub>D</sub> / P<sub>L</sub></td><td>{input.column1.PD} / {input.column1.PL} kN</td></tr>
            <tr><th colSpan={2}>Column 2 (typically interior)</th></tr>
            <tr><td>Shape</td><td>{input.column2.shape}</td></tr>
            <tr><td>cl × ct</td><td>{input.column2.cl} × {input.column2.ct ?? input.column2.cl} mm</td></tr>
            <tr><td>Position along L</td><td>{input.column2.position} mm</td></tr>
            <tr><td>P<sub>D</sub> / P<sub>L</sub></td><td>{input.column2.PD} / {input.column2.PL} kN</td></tr>
            <tr><th colSpan={2}>Soil</th></tr>
            <tr><td>q<sub>a</sub></td><td>{input.soil.qa} kPa</td></tr>
            <tr><td>γ<sub>soil</sub></td><td>{input.soil.gammaSoil ?? 18} kN/m³</td></tr>
            <tr><td>γ<sub>concrete</sub></td><td>{input.soil.gammaConcrete ?? 24} kN/m³</td></tr>
            <tr><th colSpan={2}>Materials</th></tr>
            <tr><td>f′c</td><td>{input.materials.fc} MPa</td></tr>
            <tr><td>f<sub>y</sub></td><td>{input.materials.fy} MPa</td></tr>
            <tr><td>λ (lightweight)</td><td>{input.materials.lambdaC ?? 1.0}</td></tr>
            <tr><th colSpan={2}>Reinforcement</th></tr>
            <tr><td>Bottom-long</td><td>{input.reinforcement.bottomLong.count} {input.reinforcement.bottomLong.bar}</td></tr>
            {input.reinforcement.topLong && (
              <tr><td>Top-long</td><td>{input.reinforcement.topLong.count} {input.reinforcement.topLong.bar}</td></tr>
            )}
            <tr><td>Bottom-trans</td><td>{input.reinforcement.bottomTrans.count} {input.reinforcement.bottomTrans.bar}</td></tr>
          </tbody>
        </table>
      </section>

      {/* PAGE 3 — DRAWINGS */}
      <section className="pr-page">
        <h2>Plan view</h2>
        <CombinedFootingPlan2D input={input} result={result} />
        <h2 style={{ marginTop: '1rem' }}>Section A-A (longitudinal)</h2>
        <CombinedFootingSection2D input={input} result={result} />
      </section>

      {/* PAGE 4 — BMD/SFD */}
      <section className="pr-page">
        <h2>Beam analysis (longitudinal)</h2>
        <p style={{ fontSize: '0.92rem', marginBottom: '0.6rem' }}>
          Soil reaction (factored q<sub>nu</sub> = {result.qnu.toFixed(1)} kPa) acts as an UPWARD distributed load
          (w<sub>u</sub> = {result.beam.wu.toFixed(1)} kN/m). Column reactions act DOWNWARD
          (P<sub>u1</sub> = {result.beam.Pu1.toFixed(1)}, P<sub>u2</sub> = {result.beam.Pu2.toFixed(1)} kN).
          Convention: positive M = bottom tension (sagging). Between the columns the beam curves
          concave-down → top tension, |M<sub>u−</sub>| governs negative-moment design.
        </p>
        <table className="pr-inputs-table">
          <tbody>
            <tr><th colSpan={2}>BMD / SFD peaks</th></tr>
            <tr><td>Maximum positive moment M<sub>u+</sub></td><td>{result.beam.Mu_pos_max.toFixed(1)} kN·m at x = {result.beam.x_Mu_pos_max.toFixed(0)} mm</td></tr>
            <tr><td>Maximum negative moment |M<sub>u−</sub>|</td><td>{Math.abs(result.beam.Mu_neg_max).toFixed(1)} kN·m at x = {result.beam.x_Mu_neg_max.toFixed(0)} mm</td></tr>
            <tr><td>Maximum shear at C1 face</td><td>{result.beam.Vu_max_at_col1.toFixed(1)} kN</td></tr>
            <tr><td>Maximum shear at C2 face</td><td>{result.beam.Vu_max_at_col2.toFixed(1)} kN</td></tr>
          </tbody>
        </table>
      </section>

      {/* PAGE 5+ — DETAILED CHECKS */}
      {[
        { name: 'Bearing pressure', check: result.bearing },
        { name: 'Longitudinal beam analysis', check: result.beam },
        { name: 'Two-way (punching) shear at column 1', check: result.punching1 },
        { name: 'Two-way (punching) shear at column 2', check: result.punching2 },
        { name: 'Longitudinal one-way shear', check: result.shearLong },
        { name: 'Longitudinal flexure (positive — cantilever)', check: result.flexLongPos },
        { name: 'Longitudinal flexure (negative — between cols)', check: result.flexLongNeg },
        { name: 'Transverse flexure under column 1', check: result.flexTrans1 },
        { name: 'Transverse flexure under column 2', check: result.flexTrans2 },
      ].map((c, i) => (
        <CheckPage key={i} title={c.name} steps={(c.check as { steps: CalcStep[] }).steps} />
      ))}

      {result.warnings.length > 0 && (
        <section className="pr-page">
          <h2>Warnings</h2>
          <ul>
            {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </section>
      )}

      <section className="pr-page">
        <h2>References</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>ACI 318-25 (SI Units) — §13.3.4 Two-way combined footings and mat foundations</li>
          <li>ACI 318-25 §13.3.4.3 — Design methods (factored loads / strength reduction) regardless of bearing pressure distribution</li>
          <li>ACI 318-25 §22.6 + Table 22.6.5.2 — Two-way (punching) shear at each column</li>
          <li>ACI 318-25 §22.5.5.1 — One-way shear in the longitudinal beam</li>
          <li>Wight, J. K., MacGregor, J. G. — <em>Reinforced Concrete: Mechanics and Design</em>, 7th ed., Pearson 2014, §15-6 (Combined footings, Ex. 15-5)</li>
          <li>ACI PRC-336.2 — Suggested Analysis and Design Procedures for Combined Footings and Mats</li>
        </ul>
        <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: '#666' }}>
          Cross-validated against Wight Ex 15-5 within 3% on b<sub>o</sub>, v<sub>c</sub>, V<sub>u</sub>,
          |M<sub>u−</sub>|, M<sub>u+</sub>. Final design is the responsibility of the engineer of record.
        </p>
      </section>
    </div>
  );
}

function CheckPage({ title, steps }: { title: string; steps: CalcStep[] }) {
  if (!steps || steps.length === 0) return null;
  return (
    <section className="pr-page">
      <h2>{title}</h2>
      <table className="pr-steps-table">
        <thead>
          <tr><th>Step</th><th>Formula</th><th>Substitution</th><th>Result</th></tr>
        </thead>
        <tbody>
          {steps.map((s, i) => (
            <tr key={i}>
              <td><strong>{s.title}</strong>{s.ref ? <><br /><small>{s.ref}</small></> : null}</td>
              <td><code>{s.formula}</code></td>
              <td><small>{s.substitution}</small></td>
              <td>{s.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
