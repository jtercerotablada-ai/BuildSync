'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BasePlateInput, BasePlateAnalysis } from '@/lib/baseplate/types';
import { ANCHOR_GRADES } from '@/lib/baseplate/types';

interface Props {
  input: BasePlateInput;
  result: BasePlateAnalysis;
  cover3dDataUrl?: string;
}

/**
 * Engineering-firm-quality print report for base plate design.
 * Renders into a portal at document.body so @media print can hide every other
 * top-level body child via display:none. Reuses .slab-print-portal CSS.
 */
export function BasePlatePrintReport({ input, result, cover3dDataUrl }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const projectId = `BPL-${today.getFullYear().toString().slice(2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${String(today.getHours()).padStart(2, '0')}${String(today.getMinutes()).padStart(2, '0')}`;

  const checks = computeChecks(result);

  const body = (
    <div className="slab-print-portal" id="slab-print-portal">
      {/* ============================== PAGE 1 — COVER ============================== */}
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

        <h2 className="pr-cover__title">STEEL COLUMN<br/>BASE PLATE DESIGN REPORT</h2>

        {cover3dDataUrl && (
          <div className="pr-cover__hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover3dDataUrl} alt="3D model snapshot of the base plate connection" />
            <div className="pr-cover__hero-caption">
              3D model of the base connection — rendered live in the design tool
            </div>
          </div>
        )}

        <table className="pr-cover-table">
          <tbody>
            <tr><th>Project ID</th><td>{projectId}</td><th>Issue date</th><td>{dateStr}</td></tr>
            <tr><th>Column</th><td>{input.column.label ?? 'custom'} · d={input.column.d.toFixed(2)}″ · bf={input.column.bf.toFixed(2)}″</td>
                <th>Plate</th><td>{input.plate.B.toFixed(1)} × {input.plate.N.toFixed(1)} × {input.plate.tp.toFixed(3)}″</td></tr>
            <tr><th>Concrete</th><td>fʹc = {input.concrete.fc.toFixed(2)} ksi</td>
                <th>Anchors</th><td>{input.anchors.N} × ⌀{input.anchors.da.toFixed(3)}″ {input.anchors.grade}</td></tr>
            <tr><th>Loads</th><td>Pu={input.loads.Pu.toFixed(1)} k · Mu={input.loads.Mu.toFixed(0)} k·in · Vu={input.loads.Vu.toFixed(1)} k</td>
                <th>Method</th><td>{input.method} per {input.code}</td></tr>
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

        {/* Disclaimer */}
        <div className="pr-disclaimer">
          <div className="pr-disclaimer__title">⚠ DISCLAIMER — DESCARGO DE RESPONSABILIDAD</div>
          <p>
            <strong>This software is in active development</strong> and is provided
            <strong> AS-IS without warranty of any kind</strong>, express or implied. Results may
            contain errors. Calculations <strong>MUST be independently verified</strong> using
            established structural engineering software (such as IDEA StatiCa, RISA Base Plate,
            CSI SAP2000, ETABS, SkyCiv, or equivalent) and <strong>reviewed, signed, and sealed
            by a licensed Professional Engineer (P.E. / S.E.)</strong> in the jurisdiction of
            the project prior to any use in design, construction, or permitting.
          </p>
          <p>
            The user assumes full responsibility for verification of every input, every
            assumption, and every output. <strong>TERCERO TABLADA CIVIL AND STRUCTURAL
            ENGINEERING INC.</strong>, its principals, employees, and contributors expressly
            disclaim any and all liability for direct, indirect, incidental, consequential,
            or punitive damages arising from the use or inability to use these calculations.
          </p>
          <p className="pr-disclaimer__es">
            <em>
              Este software está en desarrollo activo. Los resultados deben verificarse
              independientemente con software estructural establecido (IDEA StatiCa, RISA, SAP2000,
              etc.) y ser revisados, firmados y sellados por un Ingeniero Profesional licenciado
              (P.E. / S.E.) antes de cualquier uso en diseño, construcción o trámites.
            </em>
          </p>
        </div>
      </section>

      {/* ============================== PAGE 2 — INPUTS + DRAWING ============================== */}
      <section className="pr-page">
        <div className="pr-page-strip">{projectId} · {dateStr}{input.branding?.companyName ? ' · ' + input.branding.companyName : ''}</div>
        <h2>1. Project inputs</h2>

        <div className="pr-row-2col">
          <div>
            <h3>1.1 Column</h3>
            <table>
              <tbody>
                <tr><th>Section</th><td>{input.column.label ?? 'custom'}</td></tr>
                <tr><th>Shape</th><td>{input.column.shape}</td></tr>
                <tr><th>d</th><td>{input.column.d.toFixed(3)} in</td></tr>
                <tr><th>bf</th><td>{input.column.bf.toFixed(3)} in</td></tr>
                <tr><th>tf</th><td>{input.column.tf.toFixed(3)} in</td></tr>
                <tr><th>tw</th><td>{input.column.tw.toFixed(3)} in</td></tr>
                <tr><th>Fy</th><td>{input.column.Fy.toFixed(0)} ksi</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3>1.2 Plate &amp; concrete</h3>
            <table>
              <tbody>
                <tr><th>Plate B × N × tp</th><td>{input.plate.B.toFixed(2)} × {input.plate.N.toFixed(2)} × {input.plate.tp.toFixed(3)} in</td></tr>
                <tr><th>Plate Fy</th><td>{input.plate.Fy.toFixed(0)} ksi</td></tr>
                <tr><th>fʹc</th><td>{input.concrete.fc.toFixed(2)} ksi</td></tr>
                <tr><th>Pedestal B2 × N2</th><td>{input.concrete.B2.toFixed(1)} × {input.concrete.N2.toFixed(1)} in</td></tr>
                <tr><th>√(A2/A1)</th><td>{Math.min(Math.sqrt(input.concrete.B2 * input.concrete.N2 / (input.plate.B * input.plate.N)), 2).toFixed(3)} (capped at 2)</td></tr>
                <tr><th>λa (concrete)</th><td>{input.concrete.lambdaA.toFixed(2)}</td></tr>
                <tr><th>State</th><td>{input.concrete.cracked ? 'cracked (conservative)' : 'uncracked'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <h3>1.3 Anchor pattern</h3>
        <table>
          <tbody>
            <tr><th>Number of anchors</th><td>{input.anchors.N}</td>
                <th>Diameter da</th><td>{input.anchors.da.toFixed(3)} in</td></tr>
            <tr><th>Grade</th><td>{input.anchors.grade === 'custom' ? 'custom' : ANCHOR_GRADES[input.anchors.grade].label}</td>
                <th>Termination</th><td>{input.anchors.termination}</td></tr>
            <tr><th>Embedment hef</th><td>{input.anchors.hef.toFixed(2)} in</td>
                <th>Edge distance</th><td>{input.anchors.edgeDist.toFixed(2)} in</td></tr>
            <tr><th>Spacing sx × sy</th><td>{input.anchors.sx.toFixed(2)} × {input.anchors.sy.toFixed(2)} in</td>
                <th colSpan={2}>(rectangular pattern centred on column)</th></tr>
          </tbody>
        </table>

        <h3>1.4 Loads &amp; weld</h3>
        <table>
          <tbody>
            <tr><th>Pu (axial)</th><td>{input.loads.Pu.toFixed(2)} kips ({input.loads.Pu >= 0 ? 'compression' : 'tension'})</td>
                <th>Mu (moment)</th><td>{input.loads.Mu.toFixed(2)} kip·in</td></tr>
            <tr><th>Vu (shear)</th><td>{input.loads.Vu.toFixed(2)} kips</td>
                <th>Weld electrode / size</th><td>{input.weld.electrode} / {input.weld.size.toFixed(3)}″ {input.weld.auto ? '(auto)' : ''}</td></tr>
          </tbody>
        </table>
      </section>

      {/* ============================== PAGE 3 — RESULTS TABLE ============================== */}
      <section className="pr-page">
        <div className="pr-page-strip">{projectId} · {dateStr}{input.branding?.companyName ? ' · ' + input.branding.companyName : ''}</div>
        <h2>2. Design summary</h2>
        <table className="pr-checks-table">
          <thead><tr><th>Limit state</th><th>Code</th><th>Demand</th><th>Capacity</th><th>Ratio</th><th>Status</th></tr></thead>
          <tbody>
            {result.bearing && (
              <tr className={result.bearing.ok ? 'pr-row-pass' : 'pr-row-fail'}>
                <td>Concrete bearing</td><td>AISC §J8</td>
                <td>fp = {result.bearing.fp.toFixed(3)} ksi</td>
                <td>fp,max = {result.bearing.fpMax.toFixed(3)} ksi</td>
                <td className="pr-num">{result.bearing.ratio.toFixed(3)}</td>
                <td className={result.bearing.ok ? 'pr-pass' : 'pr-fail'}>{result.bearing.ok ? '✓' : '✗'}</td>
              </tr>
            )}
            {result.plateYielding && (
              <tr className={result.plateYielding.ok ? 'pr-row-pass' : 'pr-row-fail'}>
                <td>Plate flexural yielding</td><td>DG1 §4.3.1</td>
                <td>tp,req = {result.plateYielding.tpReq.toFixed(3)} in</td>
                <td>tp,prov = {result.plateYielding.tpProvided.toFixed(3)} in</td>
                <td className="pr-num">{result.plateYielding.ratio.toFixed(3)}</td>
                <td className={result.plateYielding.ok ? 'pr-pass' : 'pr-fail'}>{result.plateYielding.ok ? '✓' : '✗'}</td>
              </tr>
            )}
            {result.anchorTension && (
              <tr className={result.anchorTension.ok ? 'pr-row-pass' : 'pr-row-fail'}>
                <td>Anchor steel tension</td><td>AISC §J3</td>
                <td>ru = {result.anchorTension.ru.toFixed(2)} k/rod</td>
                <td>φNsa = {result.anchorTension.NsaAvail.toFixed(2)} k/rod</td>
                <td className="pr-num">{result.anchorTension.ratio.toFixed(3)}</td>
                <td className={result.anchorTension.ok ? 'pr-pass' : 'pr-fail'}>{result.anchorTension.ok ? '✓' : '✗'}</td>
              </tr>
            )}
            {result.concretePullout && (
              <tr className={result.concretePullout.ok ? 'pr-row-pass' : 'pr-row-fail'}>
                <td>Concrete pullout</td><td>ACI §17.6.3</td>
                <td>ru = {result.concretePullout.ru.toFixed(2)} k</td>
                <td>φNpn = {result.concretePullout.NpnAvail.toFixed(2)} k</td>
                <td className="pr-num">{result.concretePullout.ratio.toFixed(3)}</td>
                <td className={result.concretePullout.ok ? 'pr-pass' : 'pr-fail'}>{result.concretePullout.ok ? '✓' : '✗'}</td>
              </tr>
            )}
            {result.concreteBreakout && (
              <tr className={result.concreteBreakout.ok ? 'pr-row-pass' : 'pr-row-fail'}>
                <td>Concrete breakout (group)</td><td>ACI §17.6.2</td>
                <td>T = {result.concreteBreakout.T.toFixed(2)} k</td>
                <td>φNcbg = {result.concreteBreakout.NcbgAvail.toFixed(2)} k</td>
                <td className="pr-num">{result.concreteBreakout.ratio.toFixed(3)}</td>
                <td className={result.concreteBreakout.ok ? 'pr-pass' : 'pr-fail'}>{result.concreteBreakout.ok ? '✓' : '✗'}</td>
              </tr>
            )}
            {result.anchorShear && (
              <tr className={result.anchorShear.ok ? 'pr-row-pass' : 'pr-row-fail'}>
                <td>Anchor steel shear</td><td>ACI §17.7.1</td>
                <td>vu = {result.anchorShear.vu.toFixed(2)} k/rod</td>
                <td>φVsa = {result.anchorShear.VsaAvail.toFixed(2)} k/rod</td>
                <td className="pr-num">{result.anchorShear.ratio.toFixed(3)}</td>
                <td className={result.anchorShear.ok ? 'pr-pass' : 'pr-fail'}>{result.anchorShear.ok ? '✓' : '✗'}</td>
              </tr>
            )}
            {result.combinedTV && (
              <tr className={result.combinedTV.ok ? 'pr-row-pass' : 'pr-row-fail'}>
                <td>Combined T+V interaction</td><td>ACI §17.8</td>
                <td>T/φNn + V/φVn</td>
                <td>≤ 1.2</td>
                <td className="pr-num">{result.combinedTV.ratio.toFixed(3)}</td>
                <td className={result.combinedTV.ok ? 'pr-pass' : 'pr-fail'}>{result.combinedTV.ok ? '✓' : '✗'}</td>
              </tr>
            )}
            {result.weld && (
              <tr className={result.weld.ok ? 'pr-row-pass' : 'pr-row-fail'}>
                <td>Column-to-plate weld</td><td>AISC §J2</td>
                <td>wReq = {result.weld.wReq.toFixed(3)} in</td>
                <td>wProv = {result.weld.wProvided.toFixed(3)} in</td>
                <td className="pr-num">{result.weld.ratio.toFixed(3)}</td>
                <td className={result.weld.ok ? 'pr-pass' : 'pr-fail'}>{result.weld.ok ? '✓' : '✗'}</td>
              </tr>
            )}
          </tbody>
        </table>

        {result.momentInteraction && (
          <>
            <h3>2.1 Moment / eccentricity partition</h3>
            <table>
              <tbody>
                <tr><th>Eccentricity e</th><td>{result.momentInteraction.e.toFixed(3)} in</td>
                    <th>Critical eccentricity ecrit</th><td>{result.momentInteraction.ecrit.toFixed(3)} in</td></tr>
                <tr><th>Maximum line load qmax</th><td>{result.momentInteraction.qmax.toFixed(2)} kip/in</td>
                    <th>Bearing length Y</th><td>{result.momentInteraction.Y.toFixed(3)} in</td></tr>
                <tr><th>Anchor tension T</th><td>{result.momentInteraction.T.toFixed(2)} kips</td>
                    <th>Classification</th><td className={result.momentInteraction.feasible ? 'pr-pass' : 'pr-fail'}>
                      {result.momentInteraction.feasible
                        ? (result.momentInteraction.largeMoment ? 'LARGE moment (anchors in tension)' : 'LOW moment (bearing only)')
                        : '✗ NO REAL SOLUTION — increase plate dimensions'}
                    </td></tr>
              </tbody>
            </table>
          </>
        )}
      </section>

      {/* ============================== PAGE 4+ — HAND-CALC APPENDIX ============================== */}
      <section className="pr-page">
        <div className="pr-page-strip">{projectId} · {dateStr}{input.branding?.companyName ? ' · ' + input.branding.companyName : ''}</div>
        <h2>A. Hand-calculation appendix</h2>
        <p className="pr-meta">All calculations shown per AISC Design Guide 1, 3rd Edition (2024).</p>

        {sectionFromSteps('A.1 Concrete bearing', result.bearing?.steps)}
        {sectionFromSteps('A.2 Plate flexural yielding', result.plateYielding?.steps)}
        {sectionFromSteps('A.3 Moment / eccentricity partition', result.momentInteraction?.steps)}
        {sectionFromSteps('A.4 Anchor steel tension', result.anchorTension?.steps)}
        {sectionFromSteps('A.5 Concrete pullout', result.concretePullout?.steps)}
        {sectionFromSteps('A.6 Concrete breakout (group)', result.concreteBreakout?.steps)}
        {sectionFromSteps('A.7 Anchor steel shear', result.anchorShear?.steps)}
        {sectionFromSteps('A.8 Combined T+V interaction', result.combinedTV?.steps)}
        {sectionFromSteps('A.9 Column-to-plate weld', result.weld?.steps)}

        {result.warnings.length > 0 && (
          <>
            <h3>A.X Warnings</h3>
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
function computeChecks(result: BasePlateAnalysis): CheckRow[] {
  const rows: CheckRow[] = [];
  if (result.bearing) rows.push({
    name: 'Concrete bearing', demand: `Pu = ${result.input.loads.Pu.toFixed(1)} k`,
    capacity: `φPp = ${result.bearing.PpAvail.toFixed(1)} k`,
    ratio: result.bearing.ratio.toFixed(3), ok: result.bearing.ok,
  });
  if (result.plateYielding) rows.push({
    name: 'Plate flexural yielding',
    demand: `tp,req = ${result.plateYielding.tpReq.toFixed(3)} in`,
    capacity: `tp,prov = ${result.plateYielding.tpProvided.toFixed(3)} in`,
    ratio: result.plateYielding.ratio.toFixed(3), ok: result.plateYielding.ok,
  });
  if (result.anchorTension) rows.push({
    name: 'Anchor steel tension', demand: `ru = ${result.anchorTension.ru.toFixed(2)} k/rod`,
    capacity: `φNsa = ${result.anchorTension.NsaAvail.toFixed(2)} k/rod`,
    ratio: result.anchorTension.ratio.toFixed(3), ok: result.anchorTension.ok,
  });
  if (result.concretePullout) rows.push({
    name: 'Concrete pullout', demand: `ru = ${result.concretePullout.ru.toFixed(2)} k`,
    capacity: `φNpn = ${result.concretePullout.NpnAvail.toFixed(2)} k`,
    ratio: result.concretePullout.ratio.toFixed(3), ok: result.concretePullout.ok,
  });
  if (result.concreteBreakout) rows.push({
    name: 'Concrete breakout', demand: `T = ${result.concreteBreakout.T.toFixed(2)} k`,
    capacity: `φNcbg = ${result.concreteBreakout.NcbgAvail.toFixed(2)} k`,
    ratio: result.concreteBreakout.ratio.toFixed(3), ok: result.concreteBreakout.ok,
  });
  if (result.anchorShear) rows.push({
    name: 'Anchor steel shear', demand: `vu = ${result.anchorShear.vu.toFixed(2)} k/rod`,
    capacity: `φVsa = ${result.anchorShear.VsaAvail.toFixed(2)} k/rod`,
    ratio: result.anchorShear.ratio.toFixed(3), ok: result.anchorShear.ok,
  });
  if (result.combinedTV) rows.push({
    name: 'Combined T+V interaction', demand: 'T/φNn + V/φVn', capacity: '≤ 1.2',
    ratio: result.combinedTV.ratio.toFixed(3), ok: result.combinedTV.ok,
  });
  if (result.weld) rows.push({
    name: 'Column-to-plate weld', demand: `wReq = ${result.weld.wReq.toFixed(3)} in`,
    capacity: `wProv = ${result.weld.wProvided.toFixed(3)} in`,
    ratio: result.weld.ratio.toFixed(3), ok: result.weld.ok,
  });
  return rows;
}
