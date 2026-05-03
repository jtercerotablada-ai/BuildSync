'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BasePlateInput, BasePlateAnalysis } from '@/lib/baseplate/types';
import { ANCHOR_GRADES } from '@/lib/baseplate/types';
import {
  HOLE_WASHER_TABLE,
  HEAVY_HEX_NUTS,
  COUPLING_NUTS,
  ANCHOR_TOLERANCES,
  TOLERANCE_CONSTANTS,
  ERECTION_METHODS,
  FIELD_FIX_GUIDANCE,
  lookupHoleWasher,
  lookupHexNut,
  lookupAnchorTolerance,
  washerThicknessForGrade,
  recommendedThreadProjection,
  groutRequirements,
  weldingNotes,
  anchorRodMaterialSpec,
} from '@/lib/baseplate/construction';

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

      {/* ============================== PAGE 4 — MATERIAL SPECIFICATIONS ============================== */}
      <section className="pr-page">
        <div className="pr-page-strip">{projectId} · {dateStr}{input.branding?.companyName ? ' · ' + input.branding.companyName : ''}</div>
        <h2>3. Material specifications</h2>
        <p className="pr-meta">Per AISC Design Guide 1, 3rd Ed. §2 + AISC 360-22 + AWS A5.1 + ASTM standards.</p>

        <h3>3.1 Base plate</h3>
        <table>
          <tbody>
            <tr><th>Specification</th><td>ASTM A572/A572M</td><th>Grade</th><td>50</td></tr>
            <tr><th>Yield strength Fy</th><td>{input.plate.Fy.toFixed(0)} ksi</td><th>Tensile strength Fu</th><td>65 ksi (typical)</td></tr>
            <tr><th>Thickness availability</th><td colSpan={3}>1/8″ increments up to 1-1/4″, then 1/4″ increments above (DG1 §2.2)</td></tr>
            <tr><th>Surface finishing</th><td colSpan={3}>Per AISC 360 §M2.8 — milling not required for plates ≤ 2″ thick or for grouted bases</td></tr>
          </tbody>
        </table>

        <h3>3.2 Anchor rods</h3>
        {(() => { const rod = anchorRodMaterialSpec(input.anchors.grade, input.anchors.Fy, input.anchors.Fu);
          return (
            <table>
              <tbody>
                <tr><th>Specification</th><td>{rod.rodMaterial}</td><th>Grade</th><td>{rod.rodGrade}</td></tr>
                <tr><th>Yield strength Fy</th><td>{rod.rodFy} ksi</td><th>Tensile strength Fu</th><td>{rod.rodFu} ksi</td></tr>
                <tr><th>Color code (F1554)</th>
                    <td><span style={{ display: 'inline-block', width: 12, height: 12, background: rod.colorHex, border: '0.4pt solid #333', verticalAlign: 'middle', marginRight: 4 }} />{rod.colorCode}</td>
                    <th>Thread series</th><td>{rod.threads}</td></tr>
                <tr><th>Nut material</th><td>{rod.nutMaterial}</td><th>Nut type</th><td>{rod.nutSpec}</td></tr>
              </tbody>
            </table>
          );
        })()}

        <h3>3.3 Washers (per DG1 Table 4-3)</h3>
        {(() => { const hw = lookupHoleWasher(input.anchors.da);
                  const wt = washerThicknessForGrade(hw, input.anchors.grade);
          return (
            <table>
              <tbody>
                <tr><th>Plate-washer material</th><td colSpan={3}>ASTM A572/A572M Grade 50 — custom thermally cut from plate or bar stock</td></tr>
                <tr><th>Recommended width</th><td>{hw.washerWidth.toFixed(2)}″ (square or round)</td>
                    <th>Recommended thickness</th><td>{wt.toFixed(3)}″ for {input.anchors.grade}</td></tr>
                <tr><th>Plate-washer hole</th><td>1/16″ oversize over rod</td>
                    <th>Material specification</th><td>ASTM A572/A572M Gr 50</td></tr>
              </tbody>
            </table>
          );
        })()}

        <h3>3.4 Welds</h3>
        <table>
          <tbody>
            <tr><th>Electrode classification</th><td>{input.weld.electrode}</td>
                <th>Electrode AWS spec</th><td>AWS A5.1 / A5.5</td></tr>
            <tr><th>Welding code</th><td colSpan={3}>AWS D1.1 / D1.1M Structural Welding Code — Steel, latest edition</td></tr>
            <tr><th>Welder qualification</th><td colSpan={3}>Per AWS D1.1 Clause 4 — certified by independent agency</td></tr>
            <tr><th>Inspection</th><td colSpan={3}>Visual (VT) per AWS D1.1 §6.9.1; MT or UT for critical welds where specified by SER</td></tr>
          </tbody>
        </table>

        <h3>3.5 Concrete &amp; grout</h3>
        {(() => { const g = groutRequirements(input.concrete.fc, input.plate.B);
          return (
            <table>
              <tbody>
                <tr><th>Concrete fʹc</th><td>{input.concrete.fc.toFixed(2)} ksi (specified)</td>
                    <th>Concrete spec</th><td>ACI 318-25 + project specifications</td></tr>
                <tr><th>Grout material</th><td colSpan={3}>Non-shrink, premixed grout per ASTM C1107</td></tr>
                <tr><th>Grout fʹc (recommended)</th><td>{g.requiredFc.toFixed(2)} ksi (= 2·fʹc concrete)</td>
                    <th>Grout thickness</th><td>{g.recommendedThickness.toFixed(2)}″ (min {g.minThickness.toFixed(2)}″)</td></tr>
              </tbody>
            </table>
          );
        })()}
      </section>

      {/* ============================== PAGE 5 — ANCHOR ASSEMBLY DETAIL DRAWING ============================== */}
      <section className="pr-page">
        <div className="pr-page-strip">{projectId} · {dateStr}{input.branding?.companyName ? ' · ' + input.branding.companyName : ''}</div>
        <h2>4. Anchor assembly detail</h2>
        <p className="pr-meta">Section view of one anchor with washer stack, hex nut, embedment depth, and clearances.</p>

        <div className="pr-fig-wrap">
          <SvgAnchorAssembly input={input} />
          <div className="pr-fig-caption">Fig. 4.1 — Anchor rod assembly side view (1 of {input.anchors.N} rods). Heavy hex nut + plate washer + round washer per DG1 §4.5.3 + ASME B18.2.2.</div>
        </div>

        {(() => { const nut = lookupHexNut(input.anchors.da);
                  const hw = lookupHoleWasher(input.anchors.da);
                  const wt = washerThicknessForGrade(hw, input.anchors.grade);
                  const tp = recommendedThreadProjection(input.anchors.da, input.plate.tp);
          return (
            <table>
              <tbody>
                <tr><th>Anchor rod diameter da</th><td>{input.anchors.da.toFixed(3)}″</td>
                    <th>Embedment hef</th><td>{input.anchors.hef.toFixed(2)}″</td></tr>
                <tr><th>Heavy hex nut F (across flats)</th><td>{nut.acrossFlats.toFixed(3)}″</td>
                    <th>Heavy hex nut H (height)</th><td>{nut.height.toFixed(3)}″</td></tr>
                <tr><th>Plate washer width</th><td>{hw.washerWidth.toFixed(2)}″ × {hw.washerWidth.toFixed(2)}″</td>
                    <th>Plate washer thickness</th><td>{wt.toFixed(3)}″ ({input.anchors.grade})</td></tr>
                <tr><th>Plate hole diameter</th><td>{hw.holeDia.toFixed(4)}″</td>
                    <th>Round washer OD</th><td>{(input.anchors.da * 2.25).toFixed(2)}″ (SAE flat)</td></tr>
                <tr><th>Total rod length (min)</th><td>hef + plate + nut + 3″ = {(input.anchors.hef + input.plate.tp + nut.height + 3).toFixed(2)}″</td>
                    <th>Recommended (preferred)</th><td>{tp.preferred.toFixed(2)}″ (allows ±1/2″ setting tolerance)</td></tr>
              </tbody>
            </table>
          );
        })()}
      </section>

      {/* ============================== PAGE 6 — PLAN + ELEVATION DRAWINGS ============================== */}
      <section className="pr-page">
        <div className="pr-page-strip">{projectId} · {dateStr}{input.branding?.companyName ? ' · ' + input.branding.companyName : ''}</div>
        <h2>5. Plan view &amp; elevation</h2>

        <div className="pr-fig-wrap">
          <SvgPlanView input={input} />
          <div className="pr-fig-caption">Fig. 5.1 — Base plate plan view: column footprint (W-shape), {input.anchors.N}-rod anchor pattern, plate dimensions.</div>
        </div>

        <div className="pr-fig-wrap">
          <SvgElevationView input={input} />
          <div className="pr-fig-caption">Fig. 5.2 — Elevation: column · plate · grout layer · pedestal · embedded anchors with hef.</div>
        </div>
      </section>

      {/* ============================== PAGE 7 — CONSTRUCTION DETAILS (HOLE/WASHER/NUT TABLES) ============================== */}
      <section className="pr-page">
        <div className="pr-page-strip">{projectId} · {dateStr}{input.branding?.companyName ? ' · ' + input.branding.companyName : ''}</div>
        <h2>6. Construction details</h2>

        <h3>6.1 Recommended hole &amp; washer sizes (DG1 Table 4-3)</h3>
        <table>
          <thead>
            <tr><th>Anchor da (in)</th><th>Plate hole (in)</th><th>Washer width (in)</th>
                <th>Washer thk Gr 36</th><th>Washer thk Gr 55</th><th>Washer thk Gr 105</th></tr>
          </thead>
          <tbody>
            {HOLE_WASHER_TABLE.map((row) => (
              <tr key={row.da} className={Math.abs(row.da - input.anchors.da) < 1e-3 ? 'pr-row-pass' : ''}>
                <td>{row.da.toFixed(3)}{Math.abs(row.da - input.anchors.da) < 1e-3 ? ' ← this design' : ''}</td>
                <td>{row.holeDia.toFixed(4)}</td>
                <td>{row.washerWidth.toFixed(2)}</td>
                <td>{row.washerThk.gr36.toFixed(3)}</td>
                <td>{row.washerThk.gr55.toFixed(3)}</td>
                <td>{row.washerThk.gr105.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="pr-meta">Notes per DG1 Table 4-3: Hole sizes correlate with ACI 117-10. Plate washer material: ASTM A572/A572M Gr 50. Round washers per ASTM F844 may be used only when hole diameter is limited to da + 5/16″ (rods ≤ 1″) — see DG1 §4.5.3 for the trade-off vs. setting tolerance.</p>

        <h3>6.2 Heavy hex nut dimensions (ASME B18.2.2)</h3>
        <table>
          <thead>
            <tr><th>da (in)</th><th>Across flats F (in)</th><th>Across corners (in)</th><th>Height H (in)</th></tr>
          </thead>
          <tbody>
            {HEAVY_HEX_NUTS.filter((n) => n.da >= 0.625 && n.da <= 2.0).map((nut) => (
              <tr key={nut.da} className={Math.abs(nut.da - input.anchors.da) < 1e-3 ? 'pr-row-pass' : ''}>
                <td>{nut.da.toFixed(3)}{Math.abs(nut.da - input.anchors.da) < 1e-3 ? ' ← this design' : ''}</td>
                <td>{nut.acrossFlats.toFixed(4)}</td>
                <td>{nut.acrossCorners.toFixed(4)}</td>
                <td>{nut.height.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>6.3 Hex coupling nut dimensions (DG1 Table 4-4 — for thread extension)</h3>
        <table>
          <thead>
            <tr><th>da (in)</th><th>Across flats (in)</th><th>Across corners (in)</th><th>Height (in)</th></tr>
          </thead>
          <tbody>
            {COUPLING_NUTS.filter((n) => n.da >= 0.75 && n.da <= 2.0).map((cn) => (
              <tr key={cn.da}>
                <td>{cn.da.toFixed(3)}</td>
                <td>{cn.acrossFlats.toFixed(4)}</td>
                <td>{cn.acrossCorners.toFixed(4)}</td>
                <td>{cn.height.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="pr-meta">Coupling nuts per ASME B18.2.2-2022, ASTM A563/A563M Grade A. Used for field-fix when anchor projection is too short — see §9.3.</p>

        <h3>6.4 Thread length recommendations (DG1 §4.5.3)</h3>
        {(() => { const tp = recommendedThreadProjection(input.anchors.da, input.plate.tp);
                  const nut = lookupHexNut(input.anchors.da);
          return (
            <table>
              <tbody>
                <tr><th>Required thread for full nut engagement</th><td>≥ {nut.height.toFixed(3)}″ (= heavy hex nut height H)</td></tr>
                <tr><th>Thread length above plate (min)</th><td>{(nut.height + 3).toFixed(2)}″ (DG1: nut + 3″ extra)</td></tr>
                <tr><th>Thread length above plate (preferred)</th><td>{(nut.height + 6).toFixed(2)}″ (DG1: nut + 6″ extra to absorb setting variations)</td></tr>
                <tr><th>Total rod length specified</th><td>≥ {tp.preferred.toFixed(2)}″ (hef + plate + nut + 6″ thread)</td></tr>
              </tbody>
            </table>
          );
        })()}
      </section>

      {/* ============================== PAGE 8 — TOLERANCES + GROUTING + WELDING ============================== */}
      <section className="pr-page">
        <div className="pr-page-strip">{projectId} · {dateStr}{input.branding?.companyName ? ' · ' + input.branding.companyName : ''}</div>
        <h2>7. Tolerances</h2>
        <p className="pr-meta">Per ACI 117-10 §2.3 + AISC Code of Standard Practice 2022 §7.5.1.</p>

        <h3>7.1 Anchor rod placement tolerances</h3>
        <table>
          <thead><tr><th>Tolerance</th><th>Limit</th><th>Reference</th></tr></thead>
          <tbody>
            <tr><td>Anchor assembly centerline from specified location — horizontal</td>
                <td>±{TOLERANCE_CONSTANTS.assemblyHorizontal.toFixed(2)}″</td>
                <td>ACI 117-10 §2.3</td></tr>
            <tr><td>Anchor assembly centerline from specified location — vertical</td>
                <td>±{TOLERANCE_CONSTANTS.assemblyVertical.toFixed(2)}″</td>
                <td>ACI 117-10 §2.3</td></tr>
            <tr><td>Top of anchor rod from specified elevation — vertical</td>
                <td>±{TOLERANCE_CONSTANTS.verticalElevation.toFixed(2)}″</td>
                <td>ACI 117-10 + AISC CoSP §7.5.1</td></tr>
          </tbody>
        </table>

        <h3>7.2 Individual anchor rod horizontal tolerance (AISC CoSP §7.5.1)</h3>
        <table>
          <thead><tr><th>Anchor diameter range</th><th>Horizontal tolerance from centerline</th></tr></thead>
          <tbody>
            {ANCHOR_TOLERANCES.map((t, i) => (
              <tr key={i} className={input.anchors.da >= t.daMin && input.anchors.da <= t.daMax ? 'pr-row-pass' : ''}>
                <td>{t.daMin.toFixed(3)}″ to {t.daMax.toFixed(3)}″ {input.anchors.da >= t.daMin && input.anchors.da <= t.daMax ? ' ← this design' : ''}</td>
                <td>±{t.horizontalCenterline.toFixed(3)}″</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="pr-meta">For this design ({input.anchors.da.toFixed(3)}″ rods): horizontal placement tolerance is <strong>±{lookupAnchorTolerance(input.anchors.da).toFixed(3)}″</strong> from specified location. Specify ACI 117-10 in CSI Division 3 to clearly establish basis for acceptance.</p>

        <h2>8. Grouting requirements (DG1 §4.5.6)</h2>
        {(() => { const g = groutRequirements(input.concrete.fc, input.plate.B);
          return (
            <ul className="pr-notes-list">
              {g.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          );
        })()}

        <h2>9. Welding requirements (DG1 §4.5.2 + AISC 360 §J2)</h2>
        <ul className="pr-notes-list">
          {weldingNotes(input.plate.tp, input.weld.electrode).map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      </section>

      {/* ============================== PAGE 9 — ERECTION + INSPECTION + REPAIR ============================== */}
      <section className="pr-page">
        <div className="pr-page-strip">{projectId} · {dateStr}{input.branding?.companyName ? ' · ' + input.branding.companyName : ''}</div>
        <h2>10. Erection methods (DG1 §4.5.5)</h2>
        <p className="pr-meta">Three common methods of column-base elevation setting. Method choice depends on column weight, project requirements, and local construction practice.</p>

        {ERECTION_METHODS.map((em) => (
          <div key={em.name} className="pr-block">
            <h3>{em.name}</h3>
            <p><strong>Best for:</strong> {em.bestFor}</p>
            <ul className="pr-notes-list">
              {em.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        ))}

        <h2>11. Inspection requirements</h2>
        <ul className="pr-notes-list">
          <li><strong>Pre-pour:</strong> Anchor rod position survey by experienced construction surveyor — measure each rod against anchor-layout drawing. Must read structural drawings; typical land surveyor may not be qualified (DG1 §4.5.4).</li>
          <li><strong>Post-pour, before erection:</strong> OSHA requires general contractor to notify erector in writing that anchor rods are ready (positions verified, repairs complete, concrete strength achieved).</li>
          <li><strong>Pre-construction meeting:</strong> Recommended with general contractor and foundation crew to review anchor setting plans (DG1 §4.5.4).</li>
          <li><strong>Concrete strength:</strong> Verify by cylinder break test per ASTM C39 prior to anchor loading.</li>
          <li><strong>Grout cure:</strong> Verify by manufacturer&apos;s recommended cure period before applying load.</li>
          <li><strong>Welding inspection:</strong> Visual (VT) per AWS D1.1 §6.9.1 for all fillets; MT/UT for critical welds where specified.</li>
          <li><strong>Bolt installation:</strong> Anchor rods are typically snug-tight only (no torque/turn-of-nut required) unless specified for vibration or fatigue applications.</li>
          <li><strong>Records:</strong> Keep records of any anchor rod repairs, modifications, and inspection results — required by OSHA and good engineering practice.</li>
        </ul>

        <h2>12. Repair / field-fix guidance (DG1 §4.6)</h2>
        <p className="pr-meta">OSHA 29 CFR 1926 Subpart R: <strong>any modification of anchor rods must be reviewed and approved by the Engineer of Record.</strong></p>

        {FIELD_FIX_GUIDANCE.map((ff, i) => (
          <div key={i} className="pr-block">
            <h3>12.{i + 1} {ff.problem}</h3>
            <ul className="pr-notes-list">
              {ff.solutions.map((s, j) => <li key={j}>{s}</li>)}
            </ul>
          </div>
        ))}
      </section>

      {/* ============================== PAGE 10 — GENERAL NOTES + STANDARDS REFERENCED ============================== */}
      <section className="pr-page">
        <div className="pr-page-strip">{projectId} · {dateStr}{input.branding?.companyName ? ' · ' + input.branding.companyName : ''}</div>
        <h2>13. General notes</h2>
        <ol className="pr-notes-list">
          <li>All work shall conform to the requirements of the building code in effect at the project location, including the latest editions of AISC 360, ACI 318, AWS D1.1, and ASTM specifications referenced herein.</li>
          <li>Discrepancies between drawings, specifications, and this report shall be referred to the Structural Engineer of Record (SER) for resolution prior to fabrication.</li>
          <li>The contractor is responsible for the means and methods of construction, including erection bracing, scaffolding, formwork, and worker safety. The SER&apos;s design assumes the completed structure as detailed.</li>
          <li>OSHA 29 CFR 1926 Subpart R requires a minimum of four anchor rods at all column base plate connections. Columns ≤ 300 lb post-type are exempt.</li>
          <li>Anchor rod patterns shall use a symmetrical layout in both directions wherever possible, and as few different layouts as possible (DG1 §4.5.3).</li>
          <li>Coordinate anchor rod layout with reinforcing steel and post-tensioning tendons; in piers/walls, anchor rods shall NOT extend below the bottom of the pier into the footing (DG1 §4.5.3).</li>
          <li>Specify thread length on rods at least 3″ (preferably 6″) longer than the calculated minimum to absorb setting tolerance (DG1 §4.5.3).</li>
          <li>Anchor rods are typically snug-tight only — torque/turn-of-nut not required for typical building applications. Pretension only when specified by SER for vibration/fatigue.</li>
          <li>Plate washers shall NOT be welded to base plate, except when the anchor rods are designed to resist shear at the column base (DG1 §4.5.3).</li>
          <li>For F1554 anchor rods, color-coded marking required for field identification: Grade 36 = BLUE, Grade 55 = YELLOW, Grade 105 = RED.</li>
          <li>The Erection Engineer is responsible for design of the anchor rods and washers for erection loads (setting nut and washer method).</li>
          <li>Grouting is the responsibility of the concrete contractor (DG1 §4.5.6 recommendation). Specify in CSI Division 3.</li>
          <li>This report has been generated by an automated solver based on AISC Design Guide 1, 3rd Edition (2024). All calculations require independent verification per the disclaimer on the cover page.</li>
        </ol>

        <h2>14. Standards referenced</h2>
        <table>
          <thead><tr><th>Document</th><th>Title</th><th>Year</th></tr></thead>
          <tbody>
            <tr><td>AISC Design Guide 1</td><td>Base Connection Design for Steel Structures (Kanvinde, Maamouri, Buckholt)</td><td>3rd Ed., 2024</td></tr>
            <tr><td>ANSI/AISC 360</td><td>Specification for Structural Steel Buildings</td><td>2022</td></tr>
            <tr><td>ANSI/AISC 341</td><td>Seismic Provisions for Structural Steel Buildings</td><td>2022</td></tr>
            <tr><td>AISC Code of Standard Practice</td><td>Code of Standard Practice for Steel Buildings and Bridges</td><td>2022</td></tr>
            <tr><td>AISC Steel Construction Manual</td><td>16th Edition (2023) — Tables &amp; design aids</td><td>2023</td></tr>
            <tr><td>ACI CODE-318</td><td>Building Code Requirements for Structural Concrete (Chapter 17 — Anchoring)</td><td>2025</td></tr>
            <tr><td>ACI 117-10</td><td>Specification for Tolerances for Concrete Construction and Materials</td><td>2010 (re-approved 2015)</td></tr>
            <tr><td>AWS D1.1 / D1.1M</td><td>Structural Welding Code — Steel</td><td>2020 (or current)</td></tr>
            <tr><td>AWS A5.1 / A5.5</td><td>Carbon &amp; low-alloy steel covered electrodes</td><td>current</td></tr>
            <tr><td>ASTM F1554</td><td>Anchor Bolts, Steel, 36, 55, and 105-ksi Yield Strength</td><td>current</td></tr>
            <tr><td>ASTM A572/A572M</td><td>High-Strength Low-Alloy Columbium-Vanadium Structural Steel</td><td>current</td></tr>
            <tr><td>ASTM A563 / A563M</td><td>Carbon and Alloy Steel Nuts</td><td>current</td></tr>
            <tr><td>ASME B18.2.2</td><td>Nuts for General Applications: Machine Screw Nuts, Hex, Square, Hex Flange, and Coupling Nuts (Inch Series)</td><td>2022</td></tr>
            <tr><td>ASTM C1107 / C1107M</td><td>Packaged Dry, Hydraulic-Cement Grout (Nonshrink)</td><td>current</td></tr>
            <tr><td>ASTM F844</td><td>Washers, Steel, Plain (Flat), Unhardened for General Use</td><td>2019</td></tr>
            <tr><td>ASTM C39 / C39M</td><td>Standard Test Method for Compressive Strength of Cylindrical Concrete Specimens</td><td>current</td></tr>
            <tr><td>OSHA 29 CFR 1926 Subpart R</td><td>Steel Erection</td><td>current</td></tr>
            <tr><td>IBC</td><td>International Building Code</td><td>2024 (or applicable)</td></tr>
          </tbody>
        </table>
      </section>

      {/* ============================== PAGE 11+ — HAND-CALC APPENDIX ============================== */}
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

// ============================================================================
// SVG DETAIL DRAWINGS — engineering-shop-drawing style
// ============================================================================

/**
 * SvgAnchorAssembly — Side view of one anchor with full detail:
 *   Round washer → plate washer → heavy hex nut → rod → embedment → anchor head
 * Engineering-drawing convention: dimensions on the right with arrowheads,
 * material callouts on the left.
 */
function SvgAnchorAssembly({ input }: { input: BasePlateInput }) {
  const da = input.anchors.da;            // in
  const hef = input.anchors.hef;
  const tp = input.plate.tp;
  const nut = lookupHexNut(da);
  const hw = lookupHoleWasher(da);
  const wt = washerThicknessForGrade(hw, input.anchors.grade);
  const roundWasherOD = da * 2.25;
  const roundWasherThk = Math.max(0.125, da / 8);
  const projection = 0.25;                // 1/4" projection above nut

  // Coordinate system: y=0 at concrete top surface (= bottom of plate)
  // Above (positive y): plate, washer stack, nut, rod projection
  // Below (negative y): grout (omitted for simplicity), embedded rod, anchor head nut
  const yPlateTop = tp;
  const yRoundWasherTop = yPlateTop + roundWasherThk;
  const yPlateWasherTop = yRoundWasherTop + wt;
  const yNutTop = yPlateWasherTop + nut.height;
  const yRodTop = yNutTop + projection;
  const yEmbedTop = 0;
  const yEmbedBot = -hef;
  const yHeadTop = yEmbedBot;
  const yHeadBot = yEmbedBot - nut.height;

  // SVG plotting: choose scale so total assembly fits in ~280 mm height
  const totalHeightIn = yRodTop - yHeadBot;
  const SCALE = 220 / totalHeightIn;          // px per inch
  const W = 700, H = 540;
  const cx = 240;                              // assembly centerline x
  const yOffset = 30 + (yRodTop * SCALE);     // shift so y=yRodTop maps to top of viewBox

  const yPx = (y: number) => yOffset - y * SCALE;
  const xPx = (x: number) => cx + x * SCALE;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="bp-hatch-conc" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#999" strokeWidth="0.6" />
        </pattern>
        <pattern id="bp-hatch-steel" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="#444" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* CONCRETE — semi-transparent so we see embedded portion */}
      <rect x={cx - 100} y={yPx(0)} width={200} height={(0 - yEmbedBot - 0.5) * SCALE + 30}
            fill="url(#bp-hatch-conc)" stroke="#777" strokeWidth="0.6" />
      <text x={cx - 95} y={yPx(0) + 14} fontSize="9" fill="#666">CONCRETE PEDESTAL</text>
      <text x={cx - 95} y={yPx(0) + 24} fontSize="9" fill="#666">{`fʹc = ${input.concrete.fc.toFixed(2)} ksi`}</text>

      {/* BASE PLATE */}
      <rect x={cx - 110} y={yPx(yPlateTop)} width={220} height={tp * SCALE}
            fill="#7a7a7a" stroke="#333" strokeWidth="1" />
      {/* Plate hole — visible as gap */}
      <rect x={cx - hw.holeDia / 2 * SCALE} y={yPx(yPlateTop)} width={hw.holeDia * SCALE} height={tp * SCALE}
            fill="#fff" stroke="#333" strokeWidth="0.5" />
      <text x={cx - 105} y={yPx(yPlateTop / 2)} fontSize="9" fill="#fff" fontWeight="600">{`PL ${input.plate.tp.toFixed(3)}″`}</text>

      {/* ROUND WASHER (SAE flat) */}
      <rect x={cx - roundWasherOD / 2 * SCALE} y={yPx(yRoundWasherTop)}
            width={roundWasherOD * SCALE} height={roundWasherThk * SCALE}
            fill="#8a8a8a" stroke="#333" strokeWidth="0.6" />

      {/* PLATE WASHER */}
      <rect x={cx - hw.washerWidth / 2 * SCALE} y={yPx(yPlateWasherTop)}
            width={hw.washerWidth * SCALE} height={wt * SCALE}
            fill="#7a7a7a" stroke="#333" strokeWidth="0.7" />

      {/* HEAVY HEX NUT — top */}
      <rect x={cx - nut.acrossFlats / 2 * SCALE} y={yPx(yNutTop)}
            width={nut.acrossFlats * SCALE} height={nut.height * SCALE}
            fill="#5a5a5a" stroke="#222" strokeWidth="1" />
      {/* hex chamfer indication */}
      <line x1={cx - nut.acrossFlats / 2 * SCALE} y1={yPx(yNutTop) + 3}
            x2={cx + nut.acrossFlats / 2 * SCALE} y2={yPx(yNutTop) + 3} stroke="#888" strokeWidth="0.4" />

      {/* ROD — full length, drawn as cylinder front */}
      <rect x={cx - da / 2 * SCALE} y={yPx(yRodTop)} width={da * SCALE} height={(yRodTop - yHeadBot) * SCALE}
            fill="#9a9a9a" stroke="#333" strokeWidth="0.6" />
      {/* THREAD HATCH on top portion */}
      {Array.from({ length: 30 }, (_, i) => {
        const tStart = yPx(yRodTop);
        const tEnd = yPx(yPlateTop - 0.5);
        const yL = tStart + (tEnd - tStart) * (i / 30);
        if (yL > yPx(yPlateTop - 0.5)) return null;
        return (
          <line key={i} x1={cx - da / 2 * SCALE + 0.5} y1={yL} x2={cx + da / 2 * SCALE - 0.5} y2={yL + 1.5}
                stroke="#666" strokeWidth="0.4" />
        );
      })}

      {/* ANCHOR HEAD (heavy hex nut at the bottom) */}
      <rect x={cx - nut.acrossFlats / 2 * SCALE} y={yPx(yHeadTop)}
            width={nut.acrossFlats * SCALE} height={nut.height * SCALE}
            fill="#5a5a5a" stroke="#222" strokeWidth="1" />

      {/* DIMENSION LINES — right side */}
      {/* Embedment hef */}
      <DimVertical x={xPx(0) + 130} y1={yPx(yEmbedTop)} y2={yPx(yEmbedBot)}
        label={`hef = ${hef.toFixed(2)}″`} />
      {/* Plate thickness */}
      <DimVertical x={xPx(0) + 100} y1={yPx(yPlateTop)} y2={yPx(0)}
        label={`tp = ${tp.toFixed(3)}″`} />
      {/* Nut height */}
      <DimVertical x={xPx(0) + 130} y1={yPx(yNutTop)} y2={yPx(yPlateWasherTop)}
        label={`H = ${nut.height.toFixed(3)}″`} />
      {/* Plate washer thickness */}
      <DimVertical x={xPx(0) + 100} y1={yPx(yPlateWasherTop)} y2={yPx(yRoundWasherTop)}
        label={`PL washer ${wt.toFixed(3)}″`} />
      {/* Rod projection */}
      <DimVertical x={xPx(0) + 100} y1={yPx(yRodTop)} y2={yPx(yNutTop)}
        label={`proj. ${projection.toFixed(2)}″`} />

      {/* CALLOUTS — left side */}
      <Callout x={cx - 200} y={yPx(yRodTop)} text={`ASTM F1554 ${input.anchors.grade.replace('F1554-', 'Gr ')}`} target={[cx, yPx(yRodTop) + 5]} />
      <Callout x={cx - 200} y={yPx(yNutTop) + 8} text={`Heavy hex nut F = ${nut.acrossFlats.toFixed(3)}″`} target={[cx + nut.acrossFlats / 2 * SCALE, yPx(yNutTop) + nut.height * SCALE / 2]} />
      <Callout x={cx - 200} y={yPx(yPlateWasherTop) + 6} text={`Plate washer ${hw.washerWidth.toFixed(2)}×${hw.washerWidth.toFixed(2)}×${wt.toFixed(3)}″`} target={[cx + hw.washerWidth / 2 * SCALE, yPx(yPlateWasherTop) + wt * SCALE / 2]} />
      <Callout x={cx - 200} y={yPx(yPlateTop) - 4} text={`Round washer OD ${roundWasherOD.toFixed(2)}″`} target={[cx + roundWasherOD / 2 * SCALE, yPx(yRoundWasherTop) + roundWasherThk * SCALE / 2]} />
      <Callout x={cx - 200} y={yPx(yPlateTop) + 8} text={`Base plate PL ${tp.toFixed(3)}″ (A572 Gr 50)`} target={[cx - hw.holeDia / 2 * SCALE - 3, yPx(yPlateTop / 2)]} />
      <Callout x={cx - 200} y={yPx(0) + 16} text={`Plate hole ⌀${hw.holeDia.toFixed(4)}″ (oversize)`} target={[cx + hw.holeDia / 2 * SCALE + 2, yPx(yPlateTop / 2)]} />
      <Callout x={cx - 200} y={yPx(yEmbedTop) + 26} text={`Smooth shaft (no threads in concrete)`} target={[cx + da / 2 * SCALE, yPx(yEmbedTop / 2 + yEmbedBot / 2)]} />
      <Callout x={cx - 200} y={yPx(yHeadBot) - 6} text={`Anchor head: heavy hex nut`} target={[cx + nut.acrossFlats / 2 * SCALE, yPx(yHeadBot + nut.height / 2)]} />

      {/* TITLE BLOCK */}
      <text x={W / 2} y={H - 10} textAnchor="middle" fontSize="9" fill="#666">
        {`ANCHOR ASSEMBLY DETAIL · ⌀${da.toFixed(3)}″ ${input.anchors.grade} · scale not to scale`}
      </text>
    </svg>
  );
}

/**
 * SvgPlanView — Top-down view of the base plate showing column footprint,
 * anchor pattern, plate dimensions B × N.
 */
function SvgPlanView({ input }: { input: BasePlateInput }) {
  const B = input.plate.B, N = input.plate.N;
  const colD = input.column.d, colBf = input.column.bf, colTw = input.column.tw, colTf = input.column.tf;
  const sx = input.anchors.sx, sy = input.anchors.sy;
  const da = input.anchors.da;
  const hw = lookupHoleWasher(da);

  // Canvas + scale
  const W = 720, H = 460;
  const drawW = W - 200, drawH = H - 160;
  const scale = Math.min(drawW / B, drawH / N) * 0.95;
  const cx = W / 2, cy = H / 2;
  const x = (xIn: number) => cx + xIn * scale;
  const y = (yIn: number) => cy - yIn * scale;

  // 4-rod pattern positions (centered)
  const anchorPositions: [number, number][] = [
    [-sx / 2, -sy / 2], [+sx / 2, -sy / 2],
    [-sx / 2, +sy / 2], [+sx / 2, +sy / 2],
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      {/* Plate outline */}
      <rect x={x(-B / 2)} y={y(N / 2)} width={B * scale} height={N * scale}
            fill="#f5f1e6" stroke="#222" strokeWidth="1.5" />

      {/* Column footprint (W-shape) — 3 rectangles: top flange, web, bottom flange */}
      {/* Top flange */}
      <rect x={x(-colBf / 2)} y={y(colD / 2)} width={colBf * scale} height={colTf * scale}
            fill="#a0a0a0" stroke="#333" strokeWidth="0.6" />
      {/* Bottom flange */}
      <rect x={x(-colBf / 2)} y={y(-colD / 2 + colTf)} width={colBf * scale} height={colTf * scale}
            fill="#a0a0a0" stroke="#333" strokeWidth="0.6" />
      {/* Web */}
      <rect x={x(-colTw / 2)} y={y(colD / 2 - colTf)} width={colTw * scale} height={(colD - 2 * colTf) * scale}
            fill="#a0a0a0" stroke="#333" strokeWidth="0.6" />

      {/* Anchor rod holes (circles) */}
      {anchorPositions.map(([px, py], i) => (
        <g key={i}>
          {/* Hole */}
          <circle cx={x(px)} cy={y(py)} r={hw.holeDia / 2 * scale} fill="#fff" stroke="#666" strokeWidth="0.5" />
          {/* Rod (smaller circle inside) */}
          <circle cx={x(px)} cy={y(py)} r={da / 2 * scale} fill="#5a5a5a" stroke="#222" strokeWidth="0.7" />
          {/* Centerlines + */}
          <line x1={x(px) - 8} y1={y(py)} x2={x(px) + 8} y2={y(py)} stroke="#c94c4c" strokeWidth="0.5" />
          <line x1={x(px)} y1={y(py) - 8} x2={x(px)} y2={y(py) + 8} stroke="#c94c4c" strokeWidth="0.5" />
        </g>
      ))}

      {/* DIMENSION LINES */}
      {/* B (overall width, top) */}
      <DimHorizontal y={y(N / 2) - 30} x1={x(-B / 2)} x2={x(B / 2)} label={`B = ${B.toFixed(2)}″`} />
      {/* N (overall length, right) */}
      <DimVerticalRight x={x(B / 2) + 30} y1={y(N / 2)} y2={y(-N / 2)} label={`N = ${N.toFixed(2)}″`} />
      {/* sx (anchor spacing X, top) */}
      <DimHorizontal y={y(N / 2) - 60} x1={x(-sx / 2)} x2={x(sx / 2)} label={`sx = ${sx.toFixed(2)}″`} small />
      {/* sy (anchor spacing Y, left) */}
      <DimVerticalLeft x={x(-B / 2) - 30} y1={y(-sy / 2)} y2={y(sy / 2)} label={`sy = ${sy.toFixed(2)}″`} small />

      {/* Edge distance callout */}
      <Callout x={20} y={H - 50} text={`Edge dist. = ${input.anchors.edgeDist.toFixed(2)}″`} target={[x(-B / 2 + input.anchors.edgeDist), y(-sy / 2)]} />
      <Callout x={20} y={H - 30} text={`${input.anchors.N} anchors @ ⌀${da.toFixed(3)}″`} target={[x(sx / 2), y(sy / 2)]} />

      {/* Title */}
      <text x={W / 2} y={H - 10} textAnchor="middle" fontSize="9" fill="#666">
        {`PLAN VIEW · ${input.column.label ?? `W ${colD.toFixed(1)}×${colBf.toFixed(1)}`} · PL ${B.toFixed(0)}×${N.toFixed(0)}×${input.plate.tp.toFixed(3)}″`}
      </text>
    </svg>
  );
}

/**
 * SvgElevationView — Side view of column-plate-grout-pedestal assembly with
 * embedded anchors visible (cutaway concrete).
 */
function SvgElevationView({ input }: { input: BasePlateInput }) {
  const colD = input.column.d, colTf = input.column.tf, colTw = input.column.tw;
  void colTf; void colTw;
  const tp = input.plate.tp, hef = input.anchors.hef;
  const N = input.plate.N, sy = input.anchors.sy;
  const pedN = input.concrete.N2;
  const grout = 1.0;            // 1" grout layer
  const colHeight = N * 0.8;

  const totalH = colHeight + tp + grout + hef + 4;       // +4 for pedestal below embedment
  const totalW = Math.max(N * 1.6, pedN);

  const W = 700, H = 480;
  const drawW = W - 100, drawH = H - 120;
  const scale = Math.min(drawW / totalW, drawH / totalH) * 0.92;

  // Coord system: y=0 at concrete top (plate bottom = grout top)
  const cx = W / 2;
  const yOffset = 50 + colHeight * scale + tp * scale + grout * scale;  // y=concrete top
  const xPx = (x: number) => cx + x * scale;
  const yPx = (y: number) => yOffset - y * scale;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="bp-elev-conc" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#999" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* PEDESTAL */}
      <rect x={xPx(-pedN / 2)} y={yPx(0)} width={pedN * scale} height={(hef + 4) * scale}
            fill="url(#bp-elev-conc)" stroke="#666" strokeWidth="1" />

      {/* GROUT LAYER */}
      <rect x={xPx(-N / 2 * 1.05)} y={yPx(grout)} width={N * 1.05 * scale} height={grout * scale}
            fill="#bdb8ad" stroke="#666" strokeWidth="0.5" opacity="0.7" />

      {/* BASE PLATE */}
      <rect x={xPx(-N / 2)} y={yPx(grout + tp)} width={N * scale} height={tp * scale}
            fill="#7a7a7a" stroke="#222" strokeWidth="1" />

      {/* COLUMN STUB (W-shape side view = just a rectangle of width = bf) */}
      <rect x={xPx(-input.column.bf / 2)} y={yPx(grout + tp + colHeight)}
            width={input.column.bf * scale} height={colHeight * scale}
            fill="#6a6a6a" stroke="#222" strokeWidth="1" />

      {/* EMBEDDED ANCHORS — left and right */}
      {[-sy / 2, +sy / 2].map((yA, i) => {
        const nut = lookupHexNut(input.anchors.da);
        const projAbove = grout + tp + 1.5;     // approx top of nut
        const yRodTop = projAbove;
        const yEmbedBot = -hef;
        return (
          <g key={i}>
            {/* Rod */}
            <rect x={xPx(yA - input.anchors.da / 2)} y={yPx(yRodTop)}
                  width={input.anchors.da * scale} height={(yRodTop - yEmbedBot) * scale}
                  fill="#9a9a9a" stroke="#333" strokeWidth="0.5" />
            {/* Top nut */}
            <rect x={xPx(yA - nut.acrossFlats / 2)} y={yPx(grout + tp + nut.height)}
                  width={nut.acrossFlats * scale} height={nut.height * scale}
                  fill="#5a5a5a" stroke="#222" strokeWidth="0.7" />
            {/* Anchor head */}
            <rect x={xPx(yA - nut.acrossFlats / 2)} y={yPx(yEmbedBot)}
                  width={nut.acrossFlats * scale} height={nut.height * scale}
                  fill="#5a5a5a" stroke="#222" strokeWidth="0.7" />
          </g>
        );
      })}

      {/* DIMENSIONS */}
      {/* hef on right */}
      <DimVertical x={xPx(pedN / 2) + 40} y1={yPx(0)} y2={yPx(-hef)}
        label={`hef = ${hef.toFixed(2)}″`} />
      {/* sy at top */}
      <DimHorizontal y={yPx(grout + tp + colHeight) - 25} x1={xPx(-sy / 2)} x2={xPx(sy / 2)}
        label={`sy = ${sy.toFixed(2)}″`} />
      {/* N (plate) at top */}
      <DimHorizontal y={yPx(grout + tp + colHeight) - 50} x1={xPx(-N / 2)} x2={xPx(N / 2)}
        label={`N = ${N.toFixed(2)}″`} />
      {/* Grout thickness on left */}
      <DimVerticalLeft x={xPx(-N / 2 * 1.05) - 18} y1={yPx(grout)} y2={yPx(0)} small label={`${grout.toFixed(2)}″ grout`} />

      {/* CALLOUTS */}
      <Callout x={20} y={H - 60} text={`Concrete pedestal fʹc = ${input.concrete.fc.toFixed(2)} ksi`} target={[xPx(-pedN / 4), yPx(-hef / 2)]} />
      <Callout x={20} y={H - 40} text={`Non-shrink grout per ASTM C1107`} target={[xPx(-N / 4), yPx(grout / 2)]} />
      <Callout x={W - 200} y={H - 60} text={`Anchor head: heavy hex nut`} target={[xPx(sy / 2), yPx(-hef + 0.5)]} />

      {/* Title */}
      <text x={W / 2} y={H - 10} textAnchor="middle" fontSize="9" fill="#666">
        {`ELEVATION · column · plate · grout · pedestal · embedded anchors (1 of ${input.anchors.N / 2} pairs shown)`}
      </text>
    </svg>
  );
}

// ============================================================================
// SVG dimension-line helpers (engineering-drawing style)
// ============================================================================
function DimVertical({ x, y1, y2, label }: { x: number; y1: number; y2: number; label: string }) {
  const ymin = Math.min(y1, y2), ymax = Math.max(y1, y2);
  return (
    <g>
      <line x1={x} y1={ymin} x2={x} y2={ymax} stroke="#222" strokeWidth="0.6" />
      {/* Arrowheads */}
      <polygon points={`${x},${ymin} ${x - 3},${ymin + 7} ${x + 3},${ymin + 7}`} fill="#222" />
      <polygon points={`${x},${ymax} ${x - 3},${ymax - 7} ${x + 3},${ymax - 7}`} fill="#222" />
      {/* Witness lines */}
      <line x1={x - 8} y1={ymin} x2={x + 8} y2={ymin} stroke="#222" strokeWidth="0.4" />
      <line x1={x - 8} y1={ymax} x2={x + 8} y2={ymax} stroke="#222" strokeWidth="0.4" />
      {/* Label */}
      <text x={x + 6} y={(ymin + ymax) / 2 + 3} fontSize="9" fill="#222" fontWeight="600">{label}</text>
    </g>
  );
}

function DimVerticalRight({ x, y1, y2, label, small }: { x: number; y1: number; y2: number; label: string; small?: boolean }) {
  return <DimVerticalLabel x={x} y1={y1} y2={y2} label={label} small={small} side="right" />;
}
function DimVerticalLeft({ x, y1, y2, label, small }: { x: number; y1: number; y2: number; label: string; small?: boolean }) {
  return <DimVerticalLabel x={x} y1={y1} y2={y2} label={label} small={small} side="left" />;
}
function DimVerticalLabel({ x, y1, y2, label, small, side }: { x: number; y1: number; y2: number; label: string; small?: boolean; side: 'left' | 'right' }) {
  const ymin = Math.min(y1, y2), ymax = Math.max(y1, y2);
  const fs = small ? 8 : 10;
  const tx = side === 'right' ? x + 5 : x - 5;
  const anchor = side === 'right' ? 'start' : 'end';
  return (
    <g>
      <line x1={x} y1={ymin} x2={x} y2={ymax} stroke="#222" strokeWidth="0.6" />
      <polygon points={`${x},${ymin} ${x - 3},${ymin + 7} ${x + 3},${ymin + 7}`} fill="#222" />
      <polygon points={`${x},${ymax} ${x - 3},${ymax - 7} ${x + 3},${ymax - 7}`} fill="#222" />
      <line x1={x - 8} y1={ymin} x2={x + 8} y2={ymin} stroke="#222" strokeWidth="0.4" />
      <line x1={x - 8} y1={ymax} x2={x + 8} y2={ymax} stroke="#222" strokeWidth="0.4" />
      <text x={tx} y={(ymin + ymax) / 2 + 3} fontSize={fs} fill="#222" fontWeight="600" textAnchor={anchor}>{label}</text>
    </g>
  );
}

function DimHorizontal({ y, x1, x2, label, small }: { y: number; x1: number; x2: number; label: string; small?: boolean }) {
  const xmin = Math.min(x1, x2), xmax = Math.max(x1, x2);
  const fs = small ? 8 : 10;
  return (
    <g>
      <line x1={xmin} y1={y} x2={xmax} y2={y} stroke="#222" strokeWidth="0.6" />
      <polygon points={`${xmin},${y} ${xmin + 7},${y - 3} ${xmin + 7},${y + 3}`} fill="#222" />
      <polygon points={`${xmax},${y} ${xmax - 7},${y - 3} ${xmax - 7},${y + 3}`} fill="#222" />
      <line x1={xmin} y1={y - 8} x2={xmin} y2={y + 8} stroke="#222" strokeWidth="0.4" />
      <line x1={xmax} y1={y - 8} x2={xmax} y2={y + 8} stroke="#222" strokeWidth="0.4" />
      <text x={(xmin + xmax) / 2} y={y - 5} fontSize={fs} fill="#222" fontWeight="600" textAnchor="middle">{label}</text>
    </g>
  );
}

function Callout({ x, y, text, target }: { x: number; y: number; text: string; target: [number, number] }) {
  return (
    <g>
      <line x1={x + text.length * 3.2} y1={y - 3} x2={target[0]} y2={target[1]}
            stroke="#444" strokeWidth="0.4" />
      <circle cx={target[0]} cy={target[1]} r="1.5" fill="#444" />
      <text x={x} y={y} fontSize="8" fill="#222" fontWeight="500">{text}</text>
    </g>
  );
}
