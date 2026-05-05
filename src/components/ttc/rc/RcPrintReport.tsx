'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BeamInput, BeamAnalysis } from '@/lib/rc/types';
import { lookupBar } from '@/lib/rc/types';
import { RcSection2D } from './RcSection2D';

interface Props {
  input: BeamInput;
  result: BeamAnalysis;
  cover3dDataUrl?: string;
}

/**
 * RC Beam Design — engineering-firm-quality print report.
 * Reuses .slab-print-portal CSS framework (used by slab + base plate).
 */
export function RcPrintReport({ input, result, cover3dDataUrl }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const projectId = `RCB-${today.getFullYear().toString().slice(2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${String(today.getHours()).padStart(2, '0')}${String(today.getMinutes()).padStart(2, '0')}`;

  const checks = computeChecks(result);

  const body = (
    <div className="slab-print-portal" id="slab-print-portal">
      {/* ===================== PAGE 1 — COVER ===================== */}
      <section className="pr-page pr-cover">
        <div className="pr-page-strip">
          {projectId} · {dateStr}
          {input.branding?.companyName ? ` · ${input.branding.companyName}` : ''}
        </div>

        {(input.branding?.logoDataUrl || input.branding?.companyName) && (
          <div className="pr-cover__brand">
            {input.branding.logoDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={input.branding.logoDataUrl} alt={input.branding.companyName ?? 'Company logo'}
                   className="pr-cover__userlogo" />
            )}
            {input.branding.companyName && (
              <div className="pr-cover__company">
                <h1>{input.branding.companyName}</h1>
                {input.branding.companyTagline && (
                  <div className="pr-cover__sub">{input.branding.companyTagline}</div>
                )}
              </div>
            )}
          </div>
        )}

        <h2 className="pr-cover__title">REINFORCED CONCRETE<br/>BEAM DESIGN REPORT</h2>

        {cover3dDataUrl && (
          <div className="pr-cover__hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover3dDataUrl} alt="3D model snapshot of the beam" />
            <div className="pr-cover__hero-caption">
              3D model of the analysed beam — rendered live in the design tool
            </div>
          </div>
        )}

        <table className="pr-cover-table">
          <tbody>
            <tr><th>Project ID</th><td>{projectId}</td><th>Issue date</th><td>{dateStr}</td></tr>
            <tr><th>Section</th>
                <td>{input.geometry.shape} · bw={input.geometry.bw} × h={input.geometry.h} mm</td>
                <th>Span L</th><td>{input.geometry.L} mm</td></tr>
            <tr><th>Concrete</th><td>fʹc = {input.materials.fc.toFixed(1)} MPa</td>
                <th>Reinforcement</th><td>fy = {input.materials.fy.toFixed(0)} MPa</td></tr>
            <tr><th>Tension steel</th>
                <td>{input.reinforcement.tension.map((g) => `${g.count}${g.bar}`).join(' + ')} (As = {result.flexure.As.toFixed(0)} mm²)</td>
                <th>Stirrups</th>
                <td>{input.reinforcement.stirrup.legs}-leg {input.reinforcement.stirrup.bar} @ {input.reinforcement.stirrup.spacing} mm c/c</td></tr>
            <tr><th>Loads</th>
                <td>Mu={input.loads.Mu.toFixed(1)} kN·m · Vu={input.loads.Vu.toFixed(1)} kN</td>
                <th>Code</th><td>{input.code} ({input.method})</td></tr>
            <tr><th>Reviewed by</th><td className="pr-blank">__________________________</td>
                <th>Sign / date</th><td className="pr-blank">__________________________</td></tr>
            <tr><th>Approved by</th><td className="pr-blank">__________________________</td>
                <th>Sign / date</th><td className="pr-blank">__________________________</td></tr>
          </tbody>
        </table>

        <h3>Compliance summary at a glance</h3>
        <table className="pr-checks-table">
          <thead><tr><th>Check</th><th>Demand</th><th>Capacity / Limit</th><th>Ratio</th><th>Status</th></tr></thead>
          <tbody>
            {checks.map((c, i) => (
              <tr key={i} className={c.ok ? 'pr-row-pass' : 'pr-row-fail'}>
                <td>{c.name}</td>
                <td>{c.demand}</td>
                <td>{c.capacity}</td>
                <td className="pr-num">{c.ratio}</td>
                <td className={c.ok ? 'pr-pass' : 'pr-fail'}>{c.ok ? '✓ PASS' : '✗ FAIL'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pr-disclaimer">
          <div className="pr-disclaimer__title">⚠ DISCLAIMER — DESCARGO DE RESPONSABILIDAD</div>
          <p>
            <strong>This software is in active development</strong> and is provided
            <strong> AS-IS without warranty of any kind</strong>. Calculations <strong>MUST be
            independently verified</strong> using established structural-analysis software and
            <strong> reviewed, signed, and sealed by a licensed Professional Engineer
            (P.E. / S.E.)</strong> in the jurisdiction of the project prior to any use in
            design, construction, or permitting.
          </p>
          <p>
            The user assumes full responsibility for verification. <strong>TERCERO TABLADA
            CIVIL AND STRUCTURAL ENGINEERING INC.</strong>, its principals, employees, and
            contributors expressly disclaim any liability for damages arising from the use
            of these calculations.
          </p>
          <p className="pr-disclaimer__es">
            <em>
              Este software está en desarrollo activo. Los resultados deben verificarse
              independientemente con software estructural establecido y ser revisados,
              firmados y sellados por un Ingeniero Profesional licenciado (P.E. / S.E.)
              antes de cualquier uso en diseño, construcción o trámites.
            </em>
          </p>
        </div>
      </section>

      {/* ===================== PAGE 2 — INPUTS ===================== */}
      <section className="pr-page">
        <div className="pr-page-strip">{projectId} · {dateStr}{input.branding?.companyName ? ' · ' + input.branding.companyName : ''}</div>
        <h2>1. Project inputs</h2>

        <div className="pr-row-2col">
          <div>
            <h3>1.1 Geometry</h3>
            <table>
              <tbody>
                <tr><th>Section type</th><td>{input.geometry.shape}</td></tr>
                <tr><th>Web width bw</th><td>{input.geometry.bw} mm</td></tr>
                <tr><th>Total depth h</th><td>{input.geometry.h} mm</td></tr>
                <tr><th>Effective depth d</th><td>{input.geometry.d} mm</td></tr>
                {input.geometry.dPrime !== undefined && (
                  <tr><th>Comp steel depth dʹ</th><td>{input.geometry.dPrime} mm</td></tr>
                )}
                {input.geometry.shape !== 'rectangular' && (
                  <>
                    <tr><th>Flange width bf</th><td>{input.geometry.bf} mm</td></tr>
                    <tr><th>Flange thickness hf</th><td>{input.geometry.hf} mm</td></tr>
                  </>
                )}
                <tr><th>Clear span L</th><td>{input.geometry.L} mm</td></tr>
                <tr><th>Clear cover</th><td>{input.geometry.coverClear} mm</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3>1.2 Materials &amp; loads</h3>
            <table>
              <tbody>
                <tr><th>fʹc</th><td>{input.materials.fc.toFixed(2)} MPa</td></tr>
                <tr><th>fy (tension)</th><td>{input.materials.fy.toFixed(0)} MPa</td></tr>
                <tr><th>fyt (stirrup)</th><td>{(input.materials.fyt ?? input.materials.fy).toFixed(0)} MPa</td></tr>
                <tr><th>γc</th><td>{(input.materials.gammaC ?? 24).toFixed(2)} kN/m³</td></tr>
                <tr><th>λc (concrete factor)</th><td>{(input.materials.lambdaC ?? 1.0).toFixed(2)}</td></tr>
                <tr><th>Mu (factored)</th><td>{input.loads.Mu.toFixed(2)} kN·m</td></tr>
                <tr><th>Vu (factored)</th><td>{input.loads.Vu.toFixed(2)} kN</td></tr>
                <tr><th>Ma (service)</th><td>{(input.loads.Ma ?? 0).toFixed(2)} kN·m</td></tr>
                <tr><th>Self-weight (auto)</th><td>{result.selfWeight.toFixed(2)} kN/m</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <h3>1.3 Reinforcement</h3>
        <table>
          <tbody>
            <tr><th>Tension steel</th>
                <td>{input.reinforcement.tension.map((g) => `${g.count}-${g.bar}`).join(' + ')} (As = {result.flexure.As.toFixed(0)} mm²)</td></tr>
            {(input.reinforcement.compression?.length ?? 0) > 0 && (
              <tr><th>Compression steel</th>
                  <td>{input.reinforcement.compression!.map((g) => `${g.count}-${g.bar}`).join(' + ')}</td></tr>
            )}
            <tr><th>Stirrups</th>
                <td>{input.reinforcement.stirrup.legs}-leg {input.reinforcement.stirrup.bar} @ {input.reinforcement.stirrup.spacing} mm c/c</td></tr>
          </tbody>
        </table>
      </section>

      {/* ===================== PAGE 3 — DESIGN SUMMARY ===================== */}
      <section className="pr-page">
        <div className="pr-page-strip">{projectId} · {dateStr}{input.branding?.companyName ? ' · ' + input.branding.companyName : ''}</div>
        <h2>2. Design summary</h2>
        <table className="pr-checks-table">
          <thead><tr><th>Limit state</th><th>Code</th><th>Demand</th><th>Capacity</th><th>Ratio</th><th>Status</th></tr></thead>
          <tbody>
            <tr className={result.flexure.ok ? 'pr-row-pass' : 'pr-row-fail'}>
              <td>Flexure</td><td>ACI §22.2 + §9.5</td>
              <td>Mu = {input.loads.Mu.toFixed(2)} kN·m</td>
              <td>φMn = {result.flexure.phiMn.toFixed(2)} kN·m</td>
              <td className="pr-num">{result.flexure.ratio.toFixed(3)}</td>
              <td className={result.flexure.ok ? 'pr-pass' : 'pr-fail'}>{result.flexure.ok ? '✓' : '✗'}</td>
            </tr>
            <tr className={result.flexure.As >= result.flexure.AsReq ? 'pr-row-pass' : 'pr-row-fail'}>
              <td>As required</td><td>ACI §9.6.1</td>
              <td>{result.flexure.AsReq.toFixed(0)} mm²</td>
              <td>As prov = {result.flexure.As.toFixed(0)} mm²</td>
              <td className="pr-num">{(result.flexure.AsReq / Math.max(result.flexure.As, 1)).toFixed(3)}</td>
              <td className={result.flexure.As >= result.flexure.AsReq ? 'pr-pass' : 'pr-fail'}>{result.flexure.As >= result.flexure.AsReq ? '✓' : '✗'}</td>
            </tr>
            <tr className={result.flexure.As >= result.flexure.AsMin ? 'pr-row-pass' : 'pr-row-fail'}>
              <td>Min steel</td><td>ACI §9.6.1.2</td>
              <td>As,min = {result.flexure.AsMin.toFixed(0)} mm²</td>
              <td>As prov = {result.flexure.As.toFixed(0)} mm²</td>
              <td>—</td>
              <td className={result.flexure.As >= result.flexure.AsMin ? 'pr-pass' : 'pr-fail'}>{result.flexure.As >= result.flexure.AsMin ? '✓' : '✗'}</td>
            </tr>
            <tr className={result.shear.ok ? 'pr-row-pass' : 'pr-row-fail'}>
              <td>Shear</td><td>ACI §22.5</td>
              <td>Vu = {input.loads.Vu.toFixed(2)} kN</td>
              <td>φVn = {result.shear.phiVn.toFixed(2)} kN  (Vc={result.shear.Vc.toFixed(1)} + Vs={result.shear.Vs.toFixed(1)})</td>
              <td className="pr-num">{result.shear.ratio.toFixed(3)}</td>
              <td className={result.shear.ok ? 'pr-pass' : 'pr-fail'}>{result.shear.ok ? '✓' : '✗'}</td>
            </tr>
            <tr className={input.reinforcement.stirrup.spacing <= result.shear.sMax ? 'pr-row-pass' : 'pr-row-fail'}>
              <td>Stirrup max spacing</td><td>ACI §10.7.6.5</td>
              <td>s = {input.reinforcement.stirrup.spacing} mm</td>
              <td>s,max = {result.shear.sMax.toFixed(0)} mm</td>
              <td>—</td>
              <td className={input.reinforcement.stirrup.spacing <= result.shear.sMax ? 'pr-pass' : 'pr-fail'}>
                {input.reinforcement.stirrup.spacing <= result.shear.sMax ? '✓' : '✗'}
              </td>
            </tr>
            <tr className={result.deflection.ok ? 'pr-row-pass' : 'pr-row-fail'}>
              <td>Deflection</td><td>ACI §24.2</td>
              <td>Δ = {result.deflection.deltaCheck.toFixed(2)} mm</td>
              <td>Δlimit = L/{result.deflection.deltaLimitRatio} = {result.deflection.deltaLimit.toFixed(2)} mm</td>
              <td className="pr-num">{result.deflection.ratio.toFixed(3)}</td>
              <td className={result.deflection.ok ? 'pr-pass' : 'pr-fail'}>{result.deflection.ok ? '✓' : '✗'}</td>
            </tr>
            <tr className={result.crack.ok ? 'pr-row-pass' : 'pr-row-fail'}>
              <td>Crack control</td><td>ACI §24.3.2</td>
              <td>s = {result.crack.s.toFixed(0)} mm</td>
              <td>s,max = {result.crack.sMax.toFixed(0)} mm</td>
              <td className="pr-num">{result.crack.ratio.toFixed(3)}</td>
              <td className={result.crack.ok ? 'pr-pass' : 'pr-fail'}>{result.crack.ok ? '✓' : '✗'}</td>
            </tr>
          </tbody>
        </table>

        <h3>2.1 Section response details</h3>
        <table>
          <tbody>
            <tr><th>β1 (Whitney factor)</th><td>{result.flexure.beta1.toFixed(4)}</td>
                <th>Stress block depth a</th><td>{result.flexure.a.toFixed(2)} mm</td></tr>
            <tr><th>Neutral axis depth c</th><td>{result.flexure.c.toFixed(2)} mm</td>
                <th>Net tensile strain εt</th><td>{(result.flexure.epsT * 1000).toFixed(3)} ‰</td></tr>
            <tr><th>Section classification</th><td colSpan={3} className="pr-key">{result.flexure.section.toUpperCase()}</td></tr>
            <tr><th>Strength reduction φ</th><td>{result.flexure.phi.toFixed(3)}</td>
                <th>Mn (nominal)</th><td>{result.flexure.Mn.toFixed(2)} kN·m</td></tr>
          </tbody>
        </table>
      </section>

      {/* ===================== PAGE 4 — SECTION DRAWING ===================== */}
      <section className="pr-page">
        <div className="pr-page-strip">{projectId} · {dateStr}{input.branding?.companyName ? ' · ' + input.branding.companyName : ''}</div>
        <h2>3. Cross section · strain · stress block</h2>
        <p className="pr-meta">Section view, strain distribution at ultimate, and Whitney rectangular stress block per ACI 318-25 §22.2.</p>

        <div className="pr-fig-wrap">
          <RcSection2D input={input} result={result} />
          <div className="pr-fig-caption">
            Fig. 3.1 — Beam section, strain at ultimate, Whitney equivalent stress block.
          </div>
        </div>
      </section>

      {/* ===================== PAGE 5 — CONSTRUCTION DETAILS ===================== */}
      <section className="pr-page">
        <div className="pr-page-strip">{projectId} · {dateStr}{input.branding?.companyName ? ' · ' + input.branding.companyName : ''}</div>
        <h2>4. Construction details &amp; notes</h2>

        <h3>4.1 Concrete cover &amp; reinforcement detailing</h3>
        <ul className="pr-notes-list">
          <li><strong>Clear cover</strong> = {input.geometry.coverClear} mm to outermost reinforcement (stirrup outside face). Verify per ACI §20.5.1.3 for exposure class.</li>
          <li><strong>Tension bars</strong>: {input.reinforcement.tension.map((g) => `${g.count}-${g.bar}`).join(' + ')} (As = {result.flexure.As.toFixed(0)} mm²).</li>
          {(input.reinforcement.compression?.length ?? 0) > 0 && (
            <li><strong>Compression bars</strong>: {input.reinforcement.compression!.map((g) => `${g.count}-${g.bar}`).join(' + ')} at dʹ = {input.geometry.dPrime} mm from compression face.</li>
          )}
          <li><strong>Stirrups</strong>: {input.reinforcement.stirrup.legs}-leg closed hoops {input.reinforcement.stirrup.bar} @ {input.reinforcement.stirrup.spacing} mm c/c.</li>
          <li>Provide development length per ACI §25.4 (varies by bar size, fʹc, fy, cover, transverse reinforcement).</li>
          <li>Provide standard hooks at supports per ACI §25.3 (90° or 180° hooks).</li>
        </ul>

        <h3>4.2 Concrete materials &amp; placement</h3>
        <ul className="pr-notes-list">
          <li>Concrete fʹc = {input.materials.fc.toFixed(1)} MPa minimum at 28 days, per ASTM C39 cylinder break tests.</li>
          <li>Use normal-weight concrete (γc = {(input.materials.gammaC ?? 24).toFixed(1)} kN/m³, λ = {(input.materials.lambdaC ?? 1.0).toFixed(2)}).</li>
          <li>Concrete mix design per ACI 211.1; durability class per ACI §19.3 (assess exposure to weather, sulphates, chlorides).</li>
          <li>Slump and air content per project specifications. Maximum aggregate size ≤ minimum bar spacing / 1.5 (ACI §26.4.2.1).</li>
          <li>Placement temperature 10°C – 30°C unless special provisions taken (ACI §26.5.4.1).</li>
        </ul>

        <h3>4.3 Reinforcement materials</h3>
        <ul className="pr-notes-list">
          <li>Deformed bars per ASTM A615 / A706. fy = {input.materials.fy.toFixed(0)} MPa (typical Grade 60 = 420 MPa).</li>
          <li>Stirrups per ASTM A615 / A706. fyt = {(input.materials.fyt ?? input.materials.fy).toFixed(0)} MPa.</li>
          <li>Bar identification by ASTM grade marking — confirm at delivery and document.</li>
          <li>No splices in regions of maximum moment unless detailed per ACI §25.5 (Class A or Class B lap splices, mechanical or welded).</li>
          <li>Welded splices per AWS D1.4 / ACI §26.6.4. Mechanical splices per ACI §25.5.7.</li>
        </ul>

        <h3>4.4 Inspection requirements</h3>
        <ul className="pr-notes-list">
          <li><strong>Pre-pour</strong>: verify rebar layout, cover, splice locations, hook details. Document with photos.</li>
          <li><strong>Concrete strength</strong>: minimum 6 cylinders per pour (3 at 7d, 3 at 28d) per ASTM C31 and C39.</li>
          <li><strong>Slump &amp; air content</strong>: at delivery per ASTM C143 and C231.</li>
          <li><strong>Special inspection</strong>: per IBC Chapter 17 / ACI 318-25 §26.13 for concrete placement and reinforcement.</li>
          <li><strong>Tolerances</strong>: per ACI 117 — bar position ±13 mm horizontal, ±10 mm vertical for slabs/beams ≥ 300 mm thick.</li>
        </ul>
      </section>

      {/* ===================== PAGE 6+ — HAND-CALC APPENDIX ===================== */}
      <section className="pr-page">
        <div className="pr-page-strip">{projectId} · {dateStr}{input.branding?.companyName ? ' · ' + input.branding.companyName : ''}</div>
        <h2>A. Hand-calculation appendix</h2>
        <p className="pr-meta">All formulas and substitutions per {input.code}.</p>

        {sectionFromSteps('A.1 Flexure', result.flexure.steps)}
        {sectionFromSteps('A.2 Shear', result.shear.steps)}
        {sectionFromSteps('A.3 Deflection', result.deflection.steps)}
        {sectionFromSteps('A.4 Crack control', result.crack.steps)}

        {result.warnings.length > 0 && (
          <>
            <h3>A.5 Warnings</h3>
            <ul>{result.warnings.map((w, i) => <li key={i} className="pr-warn">⚠ {w}</li>)}</ul>
          </>
        )}

        <div className="pr-footer">
          End of report · Generated on {dateStr} by{' '}
          <strong>ttcivilstructural.com</strong> · <strong>For verification —
          must be reviewed and signed by a licensed P.E. / S.E.</strong>
        </div>
      </section>
    </div>
  );

  return createPortal(body, document.body);
}

// ============================================================================
// Helpers
// ============================================================================
function sectionFromSteps(
  heading: string,
  steps: { title: string; formula: string; substitution: string; result: string; ref?: string }[] | undefined,
) {
  if (!steps || steps.length === 0) return null;
  return (
    <div className="pr-block">
      <h3>{heading}</h3>
      <ul className="pr-steps">
        {steps.map((s, i) => (
          <li key={i} className="pr-step">
            <div className="pr-step__title">{s.title}</div>
            <div className="pr-step__formula">{s.formula}</div>
            {s.substitution && <div className="pr-step__sub">{s.substitution}</div>}
            <div className="pr-step__result">{s.result}</div>
            {s.ref && <div className="pr-step__ref">{s.ref}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface CheckRow {
  name: string; demand: string; capacity: string; ratio: string; ok: boolean;
}
function computeChecks(result: BeamAnalysis): CheckRow[] {
  const rows: CheckRow[] = [];
  rows.push({
    name: 'Flexure',
    demand: `Mu = ${result.input.loads.Mu.toFixed(2)} kN·m`,
    capacity: `φMn = ${result.flexure.phiMn.toFixed(2)} kN·m`,
    ratio: result.flexure.ratio.toFixed(3),
    ok: result.flexure.ok,
  });
  rows.push({
    name: 'Min steel',
    demand: `As prov = ${result.flexure.As.toFixed(0)} mm²`,
    capacity: `As,min = ${result.flexure.AsMin.toFixed(0)} mm²`,
    ratio: (result.flexure.AsMin / Math.max(result.flexure.As, 1)).toFixed(3),
    ok: result.flexure.As >= result.flexure.AsMin,
  });
  rows.push({
    name: 'Shear',
    demand: `Vu = ${result.input.loads.Vu.toFixed(2)} kN`,
    capacity: `φVn = ${result.shear.phiVn.toFixed(2)} kN`,
    ratio: result.shear.ratio.toFixed(3),
    ok: result.shear.ok,
  });
  rows.push({
    name: 'Deflection',
    demand: `Δ = ${result.deflection.deltaCheck.toFixed(2)} mm`,
    capacity: `≤ L/${result.deflection.deltaLimitRatio} = ${result.deflection.deltaLimit.toFixed(2)} mm`,
    ratio: result.deflection.ratio.toFixed(3),
    ok: result.deflection.ok,
  });
  rows.push({
    name: 'Crack control',
    demand: `s = ${result.crack.s.toFixed(0)} mm`,
    capacity: `s,max = ${result.crack.sMax.toFixed(0)} mm`,
    ratio: result.crack.ratio.toFixed(3),
    ok: result.crack.ok,
  });
  return rows;
}

// Suppress unused import warning for lookupBar (might be needed for future detail expansions)
void lookupBar;
