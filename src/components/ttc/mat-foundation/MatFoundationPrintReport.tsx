'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import type { MatFoundationInput, MatFoundationAnalysis } from '@/lib/mat-foundation/types';
import type { CalcStep } from '@/lib/footing/types';
import { buildMatCheckSummary, formatRatio } from '@/lib/mat-foundation/format';
import { MatFoundationSection2D } from './MatFoundationSection2D';

interface Props {
  input: MatFoundationInput;
  result: MatFoundationAnalysis;
  cover3dDataUrl?: string;
  /** Reference to the live plan-view SVG (optional). When provided, it is
   *  cloned into the print report for consistent pagination.  Currently the
   *  Plan tab in the calculator already shows the same SVG inline, so we
   *  reuse the same component here. */
}

export function MatFoundationPrintReport({ input, result, cover3dDataUrl }: Props) {
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
  const summary = buildMatCheckSummary(result);
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
              {branding?.companyName ?? 'BuildSync — Mat Foundation Design'}
            </div>
            <div className="pr-cover__tagline">
              {branding?.companyTagline ?? `${input.code} — Multi-column rigid mat`}
            </div>
          </div>
        </div>

        <h1 className="pr-cover__title">Mat Foundation Design Report</h1>
        <div className="pr-cover__meta">
          <div><strong>Date:</strong> {today}</div>
          <div><strong>Code:</strong> {input.code} (SI Units)</div>
          <div><strong>Mat:</strong> {(input.geometry.B / 1000).toFixed(2)} × {(input.geometry.L / 1000).toFixed(2)} × {(input.geometry.T / 1000).toFixed(2)} m</div>
          <div><strong>Columns:</strong> {input.columns.length}</div>
          <div><strong>Method:</strong> Conventional rigid (ACI §13.3.4.3)</div>
        </div>

        {cover3dDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover3dDataUrl} alt="3D mat" className="pr-cover__hero" />
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

      {/* PAGE 2 — INPUTS + COLUMN SCHEDULE */}
      <section className="pr-page">
        <h2>Inputs Summary</h2>
        <table className="pr-inputs-table">
          <tbody>
            <tr><th colSpan={2}>Mat geometry</th></tr>
            <tr><td>B (along X)</td><td>{input.geometry.B} mm</td></tr>
            <tr><td>L (along Y)</td><td>{input.geometry.L} mm</td></tr>
            <tr><td>Thickness T</td><td>{input.geometry.T} mm</td></tr>
            <tr><td>Clear cover</td><td>{input.geometry.coverClear} mm</td></tr>
            <tr><td>Embedment</td><td>{input.geometry.embedment ?? 0} mm</td></tr>
            <tr><th colSpan={2}>Soil</th></tr>
            <tr><td>q<sub>a</sub></td><td>{input.soil.qa} kPa</td></tr>
            <tr><td>γ<sub>soil</sub></td><td>{input.soil.gammaSoil ?? 18} kN/m³</td></tr>
            <tr><td>γ<sub>concrete</sub></td><td>{input.soil.gammaConcrete ?? 24} kN/m³</td></tr>
            <tr><th colSpan={2}>Materials</th></tr>
            <tr><td>f′c</td><td>{input.materials.fc} MPa</td></tr>
            <tr><td>f<sub>y</sub></td><td>{input.materials.fy} MPa</td></tr>
            <tr><td>λ (lightweight)</td><td>{input.materials.lambdaC ?? 1.0}</td></tr>
            <tr><th colSpan={2}>Reinforcement (4 mats — top + bottom × 2 directions)</th></tr>
            <tr><td>Top-X</td><td>{input.reinforcement.topX.bar} @ {input.reinforcement.topX.spacing} mm o.c.</td></tr>
            <tr><td>Top-Y</td><td>{input.reinforcement.topY.bar} @ {input.reinforcement.topY.spacing} mm o.c.</td></tr>
            <tr><td>Bottom-X</td><td>{input.reinforcement.bottomX.bar} @ {input.reinforcement.bottomX.spacing} mm o.c.</td></tr>
            <tr><td>Bottom-Y</td><td>{input.reinforcement.bottomY.bar} @ {input.reinforcement.bottomY.spacing} mm o.c.</td></tr>
          </tbody>
        </table>
        <h3 style={{ marginTop: '1rem' }}>Column schedule</h3>
        <table className="pr-inputs-table">
          <thead>
            <tr><th>ID</th><th>Shape</th><th>cx × cy (mm)</th><th>x (mm)</th><th>y (mm)</th>
                <th>P<sub>D</sub> (kN)</th><th>P<sub>L</sub> (kN)</th><th>Loc</th></tr>
          </thead>
          <tbody>
            {input.columns.map((c, i) => (
              <tr key={i}>
                <td>{c.id}</td>
                <td>{c.shape}</td>
                <td>{c.cx} × {c.cy ?? c.cx}</td>
                <td>{c.x}</td>
                <td>{c.y}</td>
                <td>{c.PD}</td>
                <td>{c.PL}</td>
                <td>{c.columnLocation ?? '(auto)'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* PAGE 3 — SECTION (X axis) */}
      <section className="pr-page">
        <h2>Section A-A (along X)</h2>
        <MatFoundationSection2D input={input} result={result} axis="X" />
        <h2 style={{ marginTop: '1rem' }}>Section B-B (along Y)</h2>
        <MatFoundationSection2D input={input} result={result} axis="Y" />
      </section>

      {/* PAGE 4 — BEARING */}
      <section className="pr-page">
        <h2>Bearing pressure (rigid method)</h2>
        <p style={{ fontSize: '0.92rem' }}>
          Resultant of all column loads + self-weight + overburden, located at
          ({result.bearing.xResultant.toFixed(0)}, {result.bearing.yResultant.toFixed(0)}) mm in
          mat-local coordinates. Eccentricity from mat centre: (e<sub>X</sub>, e<sub>Y</sub>) =
          ({result.bearing.eX.toFixed(0)}, {result.bearing.eY.toFixed(0)}) mm. Bilinear pressure
          per q(x, y) = P/A ± 6·M<sub>x</sub>·c<sub>y</sub>/(B·L²) ± 6·M<sub>y</sub>·c<sub>x</sub>/(L·B²).
        </p>
        <CheckSteps steps={result.bearing.steps} />
      </section>

      {/* PAGE 5+ — PUNCHING AT EACH COLUMN */}
      {result.punching.map((p, i) => (
        <section key={i} className="pr-page">
          <h2>Punching shear at column {p.columnId} ({p.location})</h2>
          <CheckSteps steps={p.steps} />
        </section>
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
          <li>ACI 318-25 §13.3.4.3 — Design methods regardless of bearing pressure distribution</li>
          <li>ACI 318-25 R13.3.4.4 — Continuous reinforcement near both faces in BOTH directions for crack control</li>
          <li>ACI 318-25 §22.6 + Table 22.6.5.2 — Two-way (punching) shear at each column</li>
          <li>ACI 318-25 §22.6.5.3 — αs interior 40 / edge 30 / corner 20</li>
          <li>Wight, J. K., MacGregor, J. G. — <em>Reinforced Concrete: Mechanics and Design</em>, 7th ed., Pearson 2014, §15-7 (Mat foundations)</li>
          <li>ACI PRC-336.2 — Suggested Analysis and Design Procedures for Combined Footings and Mats</li>
        </ul>
        <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: '#666' }}>
          For rigorous plate-on-Winkler-foundation analysis with subgrade reaction (k<sub>s</sub>),
          export geometry to CSI SAFE or PLAXIS. Final design is the responsibility of the
          engineer of record.
        </p>
      </section>
    </div>
  );
}

function CheckSteps({ steps }: { steps: CalcStep[] }) {
  if (!steps || steps.length === 0) return null;
  return (
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
  );
}
