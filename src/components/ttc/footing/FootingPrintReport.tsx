'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import type { FootingInput, FootingAnalysis, CalcStep } from '@/lib/footing/types';
import { buildCheckSummary, formatRatio } from '@/lib/footing/format';
import { FootingPlan2D } from './FootingPlan2D';
import { FootingSection2D } from './FootingSection2D';
import { PunchingDiagram2D } from './PunchingDiagram2D';

interface Props {
  input: FootingInput;
  result: FootingAnalysis;
  cover3dDataUrl?: string;
}

/**
 * FootingPrintReport — multi-page print-friendly report.
 *
 * Rendered into a portal that's hidden in normal view (display: none) and
 * shown only when window.print() runs. Reuses .slab-print-portal CSS.
 */
export function FootingPrintReport({ input, result, cover3dDataUrl }: Props) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const portalEl = document.querySelector('.slab-print-portal');
  if (!portalEl) {
    // Fallback: render into the body (CSS still hides it in non-print)
    const body = typeof document !== 'undefined' ? document.body : null;
    if (!body) return null;
    return createPortal(<ReportContent input={input} result={result} cover3dDataUrl={cover3dDataUrl} />, body);
  }
  return createPortal(<ReportContent input={input} result={result} cover3dDataUrl={cover3dDataUrl} />, portalEl);
}

function ReportContent({ input, result, cover3dDataUrl }: Props) {
  const summary = buildCheckSummary(result);
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
              {branding?.companyName ?? 'BuildSync — Foundation Design'}
            </div>
            <div className="pr-cover__tagline">
              {branding?.companyTagline ?? `${input.code} — Spread Footing Design`}
            </div>
          </div>
        </div>

        <h1 className="pr-cover__title">Foundation Design Report</h1>
        <div className="pr-cover__meta">
          <div><strong>Date:</strong> {today}</div>
          <div><strong>Code:</strong> {input.code} (SI Units)</div>
          <div><strong>Footing:</strong> {(input.geometry.B / 1000).toFixed(2)} × {(input.geometry.L / 1000).toFixed(2)} × {(input.geometry.T / 1000).toFixed(2)} m</div>
          <div><strong>Column:</strong> {input.geometry.columnShape} {input.geometry.cx}{input.geometry.cy ? `×${input.geometry.cy}` : ''} mm</div>
        </div>

        {cover3dDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover3dDataUrl} alt="3D footing" className="pr-cover__hero" />
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
            <tr><th>Geometry</th></tr>
            <tr><td>Footing B (along X)</td><td>{input.geometry.B} mm</td></tr>
            <tr><td>Footing L (along Y)</td><td>{input.geometry.L} mm</td></tr>
            <tr><td>Thickness T</td><td>{input.geometry.T} mm</td></tr>
            <tr><td>Clear cover</td><td>{input.geometry.coverClear} mm</td></tr>
            <tr><td>Embedment</td><td>{input.geometry.embedment ?? 0} mm</td></tr>
            <tr><th>Column</th></tr>
            <tr><td>Shape</td><td>{input.geometry.columnShape}</td></tr>
            <tr><td>cx</td><td>{input.geometry.cx} mm</td></tr>
            {input.geometry.cy && <tr><td>cy</td><td>{input.geometry.cy} mm</td></tr>}
            <tr><td>Eccentricity ex / ey</td><td>{input.geometry.ex ?? 0} / {input.geometry.ey ?? 0} mm</td></tr>
            <tr><th>Soil</th></tr>
            <tr><td>Allowable bearing q<sub>a</sub></td><td>{input.soil.qa} kPa</td></tr>
            <tr><td>γ<sub>soil</sub></td><td>{input.soil.gammaSoil ?? 18} kN/m³</td></tr>
            <tr><td>γ<sub>concrete</sub></td><td>{input.soil.gammaConcrete ?? 24} kN/m³</td></tr>
            <tr><th>Materials</th></tr>
            <tr><td>f′c</td><td>{input.materials.fc} MPa</td></tr>
            <tr><td>f<sub>y</sub></td><td>{input.materials.fy} MPa</td></tr>
            <tr><td>λ (lightweight)</td><td>{input.materials.lambdaC ?? 1.0}</td></tr>
            <tr><th>Loads (service)</th></tr>
            <tr><td>P<sub>D</sub></td><td>{input.loads.PD} kN</td></tr>
            <tr><td>P<sub>L</sub></td><td>{input.loads.PL} kN</td></tr>
            <tr><td>M<sub>x</sub> / M<sub>y</sub></td><td>{input.loads.Mx ?? 0} / {input.loads.My ?? 0} kN·m</td></tr>
            <tr><td>H (lateral)</td><td>{input.H ?? 0} kN</td></tr>
            <tr><th>Reinforcement</th></tr>
            <tr><td>Bottom-X</td><td>{input.reinforcement.bottomX.count} {input.reinforcement.bottomX.bar}</td></tr>
            <tr><td>Bottom-Y</td><td>{input.reinforcement.bottomY.count} {input.reinforcement.bottomY.bar}</td></tr>
            {input.reinforcement.topX && (
              <tr><td>Top-X</td><td>{input.reinforcement.topX.count} {input.reinforcement.topX.bar}</td></tr>
            )}
            {input.reinforcement.topY && (
              <tr><td>Top-Y</td><td>{input.reinforcement.topY.count} {input.reinforcement.topY.bar}</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* PAGE 3 — DRAWINGS */}
      <section className="pr-page">
        <h2>Plan view</h2>
        <FootingPlan2D input={input} result={result} />
        <h2 style={{ marginTop: '1rem' }}>Cross-section A-A</h2>
        <FootingSection2D input={input} result={result} />
      </section>

      <section className="pr-page">
        <h2>Punching shear diagram</h2>
        <PunchingDiagram2D input={input} result={result} />
      </section>

      {/* PAGE 4+ — DETAILED CHECKS */}
      {[
        { name: 'Bearing pressure', check: result.bearing },
        { name: 'Two-way (punching) shear', check: result.punching },
        { name: 'One-way shear (X)', check: result.shearX },
        { name: 'One-way shear (Y)', check: result.shearY },
        { name: 'Flexure (X)', check: result.flexureX },
        { name: 'Flexure (Y)', check: result.flexureY },
        { name: 'Bearing at column-footing interface', check: result.bearingInterface },
        { name: 'Overturning', check: result.overturning },
        { name: 'Sliding', check: result.sliding },
        { name: 'Bar fit (X)', check: result.barFitX },
        { name: 'Bar fit (Y)', check: result.barFitY },
        { name: 'Development (X)', check: result.developmentX },
        { name: 'Development (Y)', check: result.developmentY },
      ].map((c, i) => (
        <CheckPage key={i} title={c.name} steps={(c.check as { steps: CalcStep[] }).steps} />
      ))}

      {/* WARNINGS PAGE */}
      {result.warnings.length > 0 && (
        <section className="pr-page">
          <h2>Warnings</h2>
          <ul>
            {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </section>
      )}

      {/* REFERENCES PAGE */}
      <section className="pr-page">
        <h2>References</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>ACI 318-25 (SI Units) — Building Code Requirements for Structural Concrete</li>
          <li>ACI SP-17(14) — The Reinforced Concrete Design Manual</li>
          <li>Wight, J. K., MacGregor, J. G. — <em>Reinforced Concrete: Mechanics and Design</em>, 7th ed., Pearson 2014</li>
          <li>Bowles, J. E. — <em>Foundation Analysis and Design</em>, 5th ed., McGraw-Hill 1996</li>
          <li>CRSI Design Guide on the ACI 318-19 Building Code Requirements</li>
        </ul>
        <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: '#666' }}>
          This report was generated by BuildSync Foundation Design tool.
          All calculations follow ACI 318-25 SI Units. Final design is the
          responsibility of the engineer of record.
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
