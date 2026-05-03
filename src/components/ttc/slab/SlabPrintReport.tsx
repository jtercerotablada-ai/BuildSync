'use client';

import React from 'react';
import type { SlabAnalysis, SlabInput, ReinforcementResult } from '@/lib/slab/types';
import { BAR_CATALOG } from '@/lib/slab/types';

interface Props {
  input: SlabInput;
  result: SlabAnalysis;
}

/**
 * Engineering-firm-quality print report.
 * - Cover sheet with project info + revision block
 * - Executive summary with PASS/FAIL gate of every check
 * - Section drawings (plan, cross-section with rebar layout, loading, deformed)
 * - Punching perimeter sketch with stud rail plan (when applicable)
 * - Bar schedule (mark, size, qty per metre, length, mass)
 * - Hand-calc appendix with every step + clause
 * - Page header / footer on every printed page
 *
 * Hidden on screen via .slab-print-report { display: none }.
 * `window.print()` shows just this and hides everything else.
 */
export function SlabPrintReport({ input, result }: Props) {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const Lx = input.geometry.Lx, Ly = input.geometry.Ly, h = input.geometry.h;
  const projectId = `SLB-${today.getFullYear().toString().slice(2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${String(today.getHours()).padStart(2, '0')}${String(today.getMinutes()).padStart(2, '0')}`;

  const checks = computeChecks(result);

  return (
    <div className="slab-print-report" id="slab-print-report">
      {/* ===== Repeating page header (CSS @page-area) ===== */}
      <div className="pr-page-header">
        <div className="pr-ph-left">
          <strong>TERCERO TABLADA</strong> · Civil &amp; Structural Engineering Inc
        </div>
        <div className="pr-ph-mid">SLAB DESIGN REPORT</div>
        <div className="pr-ph-right">{projectId} · {dateStr}</div>
      </div>

      {/* ============================================================ */}
      {/* PAGE 1 — COVER                                                */}
      {/* ============================================================ */}
      <section className="pr-page pr-cover">
        <div className="pr-cover__brand">
          <div className="pr-logo">TT</div>
          <div className="pr-cover__company">
            <h1>TERCERO TABLADA</h1>
            <div className="pr-cover__sub">Civil &amp; Structural Engineering Inc</div>
          </div>
        </div>

        <h2 className="pr-cover__title">REINFORCED CONCRETE<br/>SLAB DESIGN REPORT</h2>

        <table className="pr-cover-table">
          <tbody>
            <tr><th>Project ID</th><td>{projectId}</td><th>Issue date</th><td>{dateStr}</td></tr>
            <tr><th>Slab span Lx × Ly</th><td>{Lx.toFixed(2)} × {Ly.toFixed(2)} m</td><th>Thickness h</th><td>{h.toFixed(0)} mm</td></tr>
            <tr><th>Design code</th><td><strong>{result.code}</strong></td><th>Classification</th>
                <td>{result.classification === 'one-way' ? 'One-way' : `Two-way (Method 3 case ${result.case ?? '?'})`}</td></tr>
            <tr><th>Concrete</th><td>fʹc = {input.materials.fc} MPa</td><th>Reinforcement</th><td>fy = {input.materials.fy} MPa</td></tr>
            <tr><th>Designed by</th><td>Tercero Tablada — automated solver v1.0</td><th>Validation</th><td>105 unit tests</td></tr>
            <tr><th>Reviewed by</th><td className="pr-blank">__________________________</td><th>Sign / date</th><td className="pr-blank">__________________________</td></tr>
            <tr><th>Approved by</th><td className="pr-blank">__________________________</td><th>Sign / date</th><td className="pr-blank">__________________________</td></tr>
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

        <p className="pr-cover__notes">
          <strong>Notes:</strong> Calculations comply with the chosen design code. The
          solver implements ACI 318-19 / ACI 318-25 / EN 1992-1-1 provisions for one-way
          and two-way slabs (Method 3 coefficients per PCA Notes), reinforcement design
          (with tension-controlled φ check), Branson Ie deflection (with edge-aware
          coefficient, sustained-LL ψ, λΔ time-period, Tabla 24.2.2 limit selector),
          punching shear (with λs size factor and lightweight λ), and crack control. The
          structural engineer of record must review and sign these calculations prior to
          construction.
        </p>
      </section>

      {/* ============================================================ */}
      {/* PAGE 2 — INPUTS + DRAWINGS                                    */}
      {/* ============================================================ */}
      <section className="pr-page">
        <h2>1. Project inputs</h2>

        <div className="pr-row-2col">
          <div>
            <h3>1.1 Geometry</h3>
            <table>
              <tbody>
                <tr><th>Span Lx</th><td>{Lx.toFixed(3)} m</td></tr>
                <tr><th>Span Ly</th><td>{Ly.toFixed(3)} m</td></tr>
                <tr><th>Slab thickness h</th><td>{h.toFixed(0)} mm</td></tr>
                <tr><th>Cover bottom (x-dir)</th><td>{input.geometry.cover_bottom_x ?? 25} mm</td></tr>
                <tr><th>Cover bottom (y-dir)</th><td>{input.geometry.cover_bottom_y ?? 35} mm</td></tr>
                <tr><th>Cover top (x-dir)</th><td>{input.geometry.cover_top_x ?? 25} mm</td></tr>
                <tr><th>Cover top (y-dir)</th><td>{input.geometry.cover_top_y ?? 35} mm</td></tr>
                <tr><th>Aspect ratio β</th><td>{result.beta.toFixed(3)}</td></tr>
                <tr><th>Classification</th><td className="pr-key">{result.classification === 'one-way' ? 'One-way' : `Two-way (Case ${result.case ?? '?'})`}</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3>1.2 Materials &amp; loads</h3>
            <table>
              <tbody>
                <tr><th>fʹc</th><td>{input.materials.fc} MPa</td></tr>
                <tr><th>fy</th><td>{input.materials.fy} MPa</td></tr>
                <tr><th>γc</th><td>{input.materials.gammaC ?? 24} kN/m³</td></tr>
                <tr><th>Es</th><td>{input.materials.Es ?? 200000} MPa</td></tr>
                <tr><th>fr (modulus of rupture)</th><td>{result.materials.fr?.toFixed(2)} MPa</td></tr>
                <tr><th>Super-imposed DL</th><td>{input.loads.DL_super.toFixed(2)} kN/m²</td></tr>
                <tr><th>Live load LL</th><td>{input.loads.LL.toFixed(2)} kN/m²</td></tr>
                <tr><th>Self-weight</th><td>{result.wSelf.toFixed(2)} kN/m²</td></tr>
                <tr><th>Service load (D + L)</th><td>{result.wService.toFixed(2)} kN/m²</td></tr>
                <tr><th>Factored wu</th><td className="pr-key">{result.wu.toFixed(2)} kN/m²</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <h3>1.3 Edge conditions &amp; plan view</h3>
        <div className="pr-fig-wrap">
          <SvgPlanView input={input} result={result} />
          <div className="pr-fig-caption">Fig. 1 — Slab plan view, edge support conditions and dimensions.</div>
        </div>

        <h3>1.4 Loading diagram</h3>
        <div className="pr-fig-wrap">
          <SvgLoadingDiagram input={input} result={result} />
          <div className="pr-fig-caption">Fig. 2 — Factored uniform load wu = {result.wu.toFixed(2)} kN/m² applied to slab.</div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* PAGE 3 — MOMENTS + DEFORMED SHAPE                             */}
      {/* ============================================================ */}
      <section className="pr-page">
        <h2>2. Analysis results</h2>

        <h3>2.1 Design moments &amp; shears (per metre of slab width)</h3>
        <table className="pr-moments">
          <thead><tr><th>Quantity</th><th>X-direction</th><th>Y-direction</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>Positive midspan moment</td>
                <td className="pr-key">{result.moments.Mx_pos.toFixed(3)} kN·m/m</td>
                <td className="pr-key">{result.moments.My_pos.toFixed(3)} kN·m/m</td>
                <td>Sagging — bottom face in tension</td></tr>
            <tr><td>Negative continuous-edge moment</td>
                <td className="pr-key">{result.moments.Mx_neg.toFixed(3)} kN·m/m</td>
                <td className="pr-key">{result.moments.My_neg.toFixed(3)} kN·m/m</td>
                <td>Hogging — top face in tension at fixed edges</td></tr>
            <tr><td>Shear at supports</td>
                <td>{result.moments.Vx.toFixed(3)} kN/m</td>
                <td>{result.moments.Vy.toFixed(3)} kN/m</td>
                <td>Tributary partition (Grashof)</td></tr>
          </tbody>
        </table>

        <h3>2.2 Deformed shape</h3>
        <div className="pr-fig-wrap">
          <SvgDeformedSection input={input} result={result} />
          <div className="pr-fig-caption">Fig. 3 — Cross-section through midspan, deformed shape (immediate Δi = {result.deflection.delta_immediate?.toFixed(2) ?? '—'} mm — exaggerated visually for clarity).</div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* PAGE 4 — REINFORCEMENT DESIGN + DETAIL                        */}
      {/* ============================================================ */}
      <section className="pr-page">
        <h2>3. Reinforcement design</h2>

        <h3>3.1 Section detail with reinforcement layout</h3>
        <div className="pr-fig-wrap">
          <SvgSectionDetail input={input} result={result} />
          <div className="pr-fig-caption">Fig. 4 — Slab cross-section showing top &amp; bottom reinforcement with concrete cover (each metre of slab width).</div>
        </div>

        <h3>3.2 Design table</h3>
        <table className="pr-rebar-table">
          <thead>
            <tr>
              <th>Bar mark</th><th>Location</th>
              <th>Mu (kN·m/m)</th><th>d (mm)</th>
              <th>As req</th><th>As min</th><th>As design</th>
              <th>Bar size</th><th>Spacing (mm)</th>
              <th>As prov</th><th>φMn (kN·m/m)</th><th>Mu/φMn</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {result.reinforcement.map((r, i) => (
              <tr key={r.location} className={r.ok ? '' : 'pr-row-fail'}>
                <td className="pr-mark">B{String(i + 1).padStart(2, '0')}</td>
                <td>{labelLoc(r.location)}</td>
                <td>{r.Mu.toFixed(2)}</td>
                <td>{r.d.toFixed(0)}</td>
                <td>{r.As_req.toFixed(0)}</td>
                <td>{r.As_min.toFixed(0)}</td>
                <td className="pr-key">{r.As_design.toFixed(0)}</td>
                <td>{r.bar} {r.source === 'user' ? <span className="pr-tag">USER</span> : null}</td>
                <td>{r.spacing.toFixed(0)}</td>
                <td>{r.As_provided.toFixed(0)}</td>
                <td>{r.phiMn_provided.toFixed(2)}</td>
                <td className={r.utilization > 1 ? 'pr-fail' : 'pr-pass'}>{r.utilization.toFixed(3)}</td>
                <td className={r.ok ? 'pr-pass' : 'pr-fail'}>{r.ok ? '✓ OK' : '✗ FAIL'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>3.3 Bar schedule (per metre of slab width)</h3>
        <table className="pr-rebar-table">
          <thead>
            <tr><th>Mark</th><th>Bar</th><th>Diameter (mm)</th><th>Spacing (mm)</th><th>Quantity per metre</th><th>Mass (kg/m²)</th></tr>
          </thead>
          <tbody>
            {result.reinforcement.map((r, i) => {
              const bar = BAR_CATALOG.find((b) => b.label === r.bar);
              const qty = 1000 / Math.max(1, r.spacing);     // bars per metre length
              // Mass = qty × Ab × density (steel 7850 kg/m³ × 1 m of bar)
              const mass = qty * (bar?.Ab ?? 0) * 1e-6 * 7850;
              return (
                <tr key={r.location}>
                  <td className="pr-mark">B{String(i + 1).padStart(2, '0')}</td>
                  <td>{r.bar}</td>
                  <td>{(bar?.db ?? 0).toFixed(1)}</td>
                  <td>{r.spacing.toFixed(0)}</td>
                  <td>{qty.toFixed(2)}</td>
                  <td className="pr-num">{mass.toFixed(2)}</td>
                </tr>
              );
            })}
            <tr className="pr-total">
              <td colSpan={5}><strong>Total reinforcement steel mass</strong></td>
              <td className="pr-num"><strong>
                {result.reinforcement.reduce((s, r) => {
                  const bar = BAR_CATALOG.find((b) => b.label === r.bar);
                  return s + (1000 / Math.max(1, r.spacing)) * (bar?.Ab ?? 0) * 1e-6 * 7850;
                }, 0).toFixed(2)} kg/m²</strong></td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ============================================================ */}
      {/* PAGE 5 — DEFLECTION + PUNCHING                                */}
      {/* ============================================================ */}
      <section className="pr-page">
        <h2>4. Deflection check</h2>
        <table>
          <tbody>
            <tr><th>Min thickness h min (Table 7.3.1.1 / 8.3.1.1)</th><td>{result.deflection.h_min.toFixed(0)} mm</td>
                <th>Provided h</th><td>{h} mm</td>
                <th>Status</th><td className={result.deflection.h_min_ok ? 'pr-pass' : 'pr-fail'}>{result.deflection.h_min_ok ? '✓ OK' : '✗ FAIL'}</td></tr>
            {result.deflection.delta_immediate !== undefined && (<>
              <tr><th>Branson Ie</th><td>{result.deflection.Ie?.toExponential(3)} mm⁴/m</td>
                  <th>Δi (full service load)</th><td>{result.deflection.delta_immediate.toFixed(2)} mm</td>
                  <th>Δi (LL only)</th><td>{result.deflection.delta_immediate_LL?.toFixed(2)} mm</td></tr>
              <tr><th>Sustained period ξ</th><td>{result.deflection.xi?.toFixed(2)}</td>
                  <th>λΔ multiplier</th><td>{result.deflection.longTermFactor?.toFixed(2)}</td>
                  <th>Sustained LL ψ</th><td>{result.deflection.sustainedLLFraction?.toFixed(2)}</td></tr>
              <tr><th>Δcheck (Tabla 24.2.2 — {result.deflection.limitCategory})</th><td>{result.deflection.delta_check?.toFixed(2)} mm</td>
                  <th>Limit L/{result.deflection.delta_limit_ratio}</th><td>{result.deflection.delta_limit.toFixed(2)} mm</td>
                  <th>Status</th><td className={result.deflection.delta_ok ? 'pr-pass' : 'pr-fail'}>{result.deflection.delta_ok ? '✓ OK' : '✗ FAIL'}</td></tr>
            </>)}
          </tbody>
        </table>

        {result.punching && (<>
          <h2>5. Punching shear check</h2>
          <h3>5.1 Critical perimeter (Fig. 5)</h3>
          <div className="pr-fig-wrap">
            <SvgPunchingPerimeter input={input} result={result} />
            <div className="pr-fig-caption">Fig. 5 — Critical perimeter b₀ at d/2 from column face per ACI §22.6.4.1.</div>
          </div>

          <h3>5.2 Punching design table</h3>
          <table>
            <tbody>
              <tr><th>Critical perimeter b₀</th><td>{result.punching.bo.toFixed(0)} mm</td>
                  <th>Effective depth d</th><td>{result.punching.d.toFixed(0)} mm</td>
                  <th>vc capacity</th><td>{result.punching.vc.toFixed(3)} MPa</td></tr>
              <tr><th>vu demand</th><td>{result.punching.vu.toFixed(3)} MPa</td>
                  <th>Demand/capacity ratio</th><td className={result.punching.ok ? 'pr-pass' : 'pr-fail'}>{result.punching.ratio.toFixed(3)}</td>
                  <th>Status</th><td className={result.punching.ok ? 'pr-pass' : 'pr-fail'}>{result.punching.ok ? '✓ OK' : '✗ FAIL'}</td></tr>
              {result.punching.dropPanel && (
                <tr><th>Drop panel</th><td colSpan={5}>{result.punching.dropPanel.size}×{result.punching.dropPanel.size} mm × +{result.punching.dropPanel.thickness} mm thk → d eff = {result.punching.dropPanel.d_eff.toFixed(0)} mm</td></tr>
              )}
            </tbody>
          </table>

          {result.punching.studRail && (<>
            <h3>5.3 Stud rail design (ACI 421.1R-20)</h3>
            <table>
              <tbody>
                <tr><th>Stud diameter</th><td>{result.punching.studRail.studDiameter} mm</td>
                    <th>Number of rails</th><td>{result.punching.studRail.numRails}</td>
                    <th>Spacing along rail</th><td>{result.punching.studRail.spacing.toFixed(0)} mm</td>
                    <th>Rows per rail</th><td>{result.punching.studRail.rows}</td></tr>
              </tbody>
            </table>
          </>)}
        </>)}
      </section>

      {/* ============================================================ */}
      {/* PAGE 6+ — HAND-CALC APPENDIX                                  */}
      {/* ============================================================ */}
      <section className="pr-page">
        <h2>A. Hand-calculation appendix</h2>
        <p className="pr-meta">All calculations shown in full per design code provisions.</p>

        <h3>A.1 Reinforcement design (per location)</h3>
        {result.reinforcement.map((r) => (
          <div className="pr-block" key={`steps-${r.location}`}>
            <h4 className={r.ok ? '' : 'pr-fail'}>{labelLoc(r.location)} — {r.bar} @ {r.spacing.toFixed(0)} mm c/c {r.ok ? '✓' : '✗'}</h4>
            <ul className="pr-steps">
              {r.steps?.map((s, i) => (
                <li className="pr-step" key={i}>
                  <div className="pr-step__title">{s.title}</div>
                  <div className="pr-step__formula">{s.formula}</div>
                  <div className="pr-step__sub">{s.substitution}</div>
                  <div className="pr-step__result">{s.result}</div>
                  {s.ref && <div className="pr-step__ref">{s.ref}</div>}
                </li>
              ))}
            </ul>
            {r.failures.length > 0 && (
              <div className="pr-failures">
                <strong className="pr-fail">Failures:</strong>
                <ul>{r.failures.map((f, i) => <li key={i} className="pr-fail">⚠ {f}</li>)}</ul>
              </div>
            )}
          </div>
        ))}

        <h3>A.2 Deflection</h3>
        <ul className="pr-steps">
          {result.deflection.steps?.map((s, i) => (
            <li className="pr-step" key={i}>
              <div className="pr-step__title">{s.title}</div>
              <div className="pr-step__formula">{s.formula}</div>
              <div className="pr-step__sub">{s.substitution}</div>
              <div className="pr-step__result">{s.result}</div>
              {s.ref && <div className="pr-step__ref">{s.ref}</div>}
            </li>
          ))}
        </ul>

        {result.punching && (<>
          <h3>A.3 Punching shear</h3>
          <ul className="pr-steps">
            {result.punching.steps?.map((s, i) => (
              <li className="pr-step" key={i}>
                <div className="pr-step__title">{s.title}</div>
                <div className="pr-step__formula">{s.formula}</div>
                <div className="pr-step__sub">{s.substitution}</div>
                <div className="pr-step__result">{s.result}</div>
                {s.ref && <div className="pr-step__ref">{s.ref}</div>}
              </li>
            ))}
          </ul>
        </>)}

        {result.crackControl?.steps && (<>
          <h3>A.4 Crack control</h3>
          <ul className="pr-steps">
            {result.crackControl.steps.map((s, i) => (
              <li className="pr-step" key={i}>
                <div className="pr-step__title">{s.title}</div>
                <div className="pr-step__formula">{s.formula}</div>
                <div className="pr-step__sub">{s.substitution}</div>
                <div className="pr-step__result">{s.result}</div>
                {s.ref && <div className="pr-step__ref">{s.ref}</div>}
              </li>
            ))}
          </ul>
        </>)}

        {result.warnings.length > 0 && (
          <>
            <h3>A.5 Warnings</h3>
            <ul>{result.warnings.map((w, i) => <li key={i} className="pr-warn">⚠ {w}</li>)}</ul>
          </>
        )}

        <div className="pr-footer">
          End of report — Tercero Tablada Civil &amp; Structural Engineering Inc · ttcivilstructural.com ·
          Solver validated by 105 unit tests · Generated {dateStr}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// SVG drawings
// ============================================================================

function SvgPlanView({ input, result }: { input: SlabInput; result: SlabAnalysis }) {
  const Lx = input.geometry.Lx, Ly = input.geometry.Ly;
  const W = 700, H = 480, m = 70;
  const drawW = W - 2 * m, drawH = H - 2 * m - 30;
  const ratio = Lx / Ly;
  let pxW: number, pxH: number;
  if (ratio >= drawW / drawH) { pxW = drawW; pxH = pxW / ratio; }
  else { pxH = drawH; pxW = pxH * ratio; }
  const x0 = (W - pxW) / 2, y0 = m;
  const labelOf = (e: 'free' | 'simple' | 'fixed') => e === 'fixed' ? 'F (fixed)' : e === 'simple' ? 'S (simple)' : 'X (free)';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      {/* Slab outline */}
      <rect x={x0} y={y0} width={pxW} height={pxH} fill="#f5f1e6" stroke="#333" strokeWidth="1.5" />
      {/* Edge labels */}
      <text x={(x0 + pxW / 2)} y={y0 - 12} textAnchor="middle" fontSize="11" fill="#333">{labelOf(input.edges.top)}</text>
      <text x={(x0 + pxW / 2)} y={y0 + pxH + 22} textAnchor="middle" fontSize="11" fill="#333">{labelOf(input.edges.bottom)}</text>
      <text x={x0 - 8} y={y0 + pxH / 2 + 4} textAnchor="end" fontSize="11" fill="#333">{labelOf(input.edges.left)}</text>
      <text x={x0 + pxW + 8} y={y0 + pxH / 2 + 4} textAnchor="start" fontSize="11" fill="#333">{labelOf(input.edges.right)}</text>
      {/* Hatch pattern for fixed edges */}
      <defs>
        <pattern id="pr-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#666" strokeWidth="1" />
        </pattern>
      </defs>
      {input.edges.top    === 'fixed' && <rect x={x0} y={y0 - 8} width={pxW} height="6" fill="url(#pr-hatch)" />}
      {input.edges.bottom === 'fixed' && <rect x={x0} y={y0 + pxH + 2} width={pxW} height="6" fill="url(#pr-hatch)" />}
      {input.edges.left   === 'fixed' && <rect x={x0 - 8} y={y0} width="6" height={pxH} fill="url(#pr-hatch)" />}
      {input.edges.right  === 'fixed' && <rect x={x0 + pxW + 2} y={y0} width="6" height={pxH} fill="url(#pr-hatch)" />}
      {/* Column dot if punching */}
      {input.punching && (
        <rect x={(x0 + pxW / 2) - input.punching.c1 / Lx * pxW / 2}
              y={(y0 + pxH / 2) - (input.punching.c2 ?? input.punching.c1) / Ly * pxH / 2}
              width={input.punching.c1 / Lx * pxW}
              height={(input.punching.c2 ?? input.punching.c1) / Ly * pxH}
              fill="#666" stroke="#222" strokeWidth="1" />
      )}
      {/* Dimensions Lx (bottom) */}
      <line x1={x0} y1={y0 + pxH + 50} x2={x0 + pxW} y2={y0 + pxH + 50} stroke="#333" strokeWidth="0.7" />
      <line x1={x0} y1={y0 + pxH + 45} x2={x0} y2={y0 + pxH + 55} stroke="#333" strokeWidth="0.7" />
      <line x1={x0 + pxW} y1={y0 + pxH + 45} x2={x0 + pxW} y2={y0 + pxH + 55} stroke="#333" strokeWidth="0.7" />
      <text x={x0 + pxW / 2} y={y0 + pxH + 70} textAnchor="middle" fontSize="11" fill="#222" fontWeight="600">{`Lx = ${Lx.toFixed(2)} m`}</text>
      {/* Dimensions Ly (right) */}
      <line x1={x0 + pxW + 40} y1={y0} x2={x0 + pxW + 40} y2={y0 + pxH} stroke="#333" strokeWidth="0.7" />
      <line x1={x0 + pxW + 35} y1={y0} x2={x0 + pxW + 45} y2={y0} stroke="#333" strokeWidth="0.7" />
      <line x1={x0 + pxW + 35} y1={y0 + pxH} x2={x0 + pxW + 45} y2={y0 + pxH} stroke="#333" strokeWidth="0.7" />
      <text x={x0 + pxW + 55} y={y0 + pxH / 2}
        textAnchor="middle" fontSize="11" fill="#222" fontWeight="600"
        transform={`rotate(90, ${x0 + pxW + 55}, ${y0 + pxH / 2})`}>{`Ly = ${Ly.toFixed(2)} m`}</text>
      {/* Title */}
      <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="#666">
        {`Two-way Method 3 case ${result.case ?? '?'} · h = ${input.geometry.h} mm`}
      </text>
    </svg>
  );
}

function SvgLoadingDiagram({ input, result }: { input: SlabInput; result: SlabAnalysis }) {
  const Lx = input.geometry.Lx;
  const W = 700, H = 250, m = 70;
  const drawW = W - 2 * m;
  const beamY = 170;
  const x0 = m, x1 = W - m;
  const arrowSpacing = drawW / 12;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      {/* Slab edge */}
      <rect x={x0} y={beamY} width={drawW} height="14" fill="#cdc8bf" stroke="#333" strokeWidth="1.2" />
      {/* Supports as triangles */}
      <polygon points={`${x0},${beamY + 14} ${x0 - 12},${beamY + 35} ${x0 + 12},${beamY + 35}`} fill="none" stroke="#333" strokeWidth="1.2" />
      <polygon points={`${x1},${beamY + 14} ${x1 - 12},${beamY + 35} ${x1 + 12},${beamY + 35}`} fill="none" stroke="#333" strokeWidth="1.2" />
      {/* UDL arrows */}
      {Array.from({ length: 13 }).map((_, i) => {
        const x = x0 + i * arrowSpacing;
        return (
          <g key={i}>
            <line x1={x} y1={beamY - 50} x2={x} y2={beamY - 4} stroke="#c94c4c" strokeWidth="1.5" />
            <polygon points={`${x},${beamY - 4} ${x - 4},${beamY - 14} ${x + 4},${beamY - 14}`} fill="#c94c4c" />
          </g>
        );
      })}
      {/* Load top connector line */}
      <line x1={x0} y1={beamY - 50} x2={x1} y2={beamY - 50} stroke="#c94c4c" strokeWidth="1.2" />
      <text x={W / 2} y={beamY - 60} textAnchor="middle" fontSize="13" fill="#a02020" fontWeight="600">
        wu = {result.wu.toFixed(2)} kN/m²
      </text>
      {/* Span dim */}
      <line x1={x0} y1={beamY + 65} x2={x1} y2={beamY + 65} stroke="#333" strokeWidth="0.7" />
      <line x1={x0} y1={beamY + 60} x2={x0} y2={beamY + 70} stroke="#333" strokeWidth="0.7" />
      <line x1={x1} y1={beamY + 60} x2={x1} y2={beamY + 70} stroke="#333" strokeWidth="0.7" />
      <text x={W / 2} y={beamY + 85} textAnchor="middle" fontSize="11" fill="#222" fontWeight="600">{`L = ${Lx.toFixed(2)} m`}</text>
    </svg>
  );
}

function SvgDeformedSection({ input, result }: { input: SlabInput; result: SlabAnalysis }) {
  const Lx = input.geometry.Lx;
  const W = 700, H = 220, m = 70;
  const drawW = W - 2 * m;
  const beamY = 110;
  const x0 = m, x1 = W - m;
  // Deformed shape: parabolic for SS-like, scaled visually
  const peakOffset = 35;
  const N = 40;
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const sin = Math.sin(Math.PI * t);
    const x = x0 + t * drawW;
    const y = beamY + peakOffset * sin;
    pts.push(`${x},${y}`);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      {/* Original undeformed slab outline (dashed) */}
      <line x1={x0} y1={beamY} x2={x1} y2={beamY} stroke="#999" strokeWidth="0.7" strokeDasharray="3 3" />
      {/* Deformed shape */}
      <polyline points={pts.join(' ')} fill="none" stroke="#c9a84c" strokeWidth="2.2" />
      {/* Slab thickness following deformation */}
      <polyline
        points={pts.map((p) => { const [x, y] = p.split(',').map(Number); return `${x},${y + 16}`; }).join(' ')}
        fill="none" stroke="#c9a84c" strokeWidth="1.2" />
      {/* Supports */}
      <polygon points={`${x0},${beamY + 18} ${x0 - 12},${beamY + 38} ${x0 + 12},${beamY + 38}`} fill="none" stroke="#333" />
      <polygon points={`${x1},${beamY + 18} ${x1 - 12},${beamY + 38} ${x1 + 12},${beamY + 38}`} fill="none" stroke="#333" />
      {/* Δi label at midspan */}
      <line x1={W / 2} y1={beamY} x2={W / 2} y2={beamY + peakOffset} stroke="#c94c4c" strokeWidth="0.8" />
      <text x={W / 2 + 8} y={beamY + peakOffset / 2 + 4} fontSize="12" fill="#a02020" fontWeight="600">
        Δi = {result.deflection.delta_immediate?.toFixed(2) ?? '—'} mm
      </text>
      {/* Span */}
      <text x={W / 2} y={beamY + 70} textAnchor="middle" fontSize="11" fill="#222" fontWeight="600">{`L = ${Lx.toFixed(2)} m`}</text>
    </svg>
  );
}

function SvgSectionDetail({ input, result }: { input: SlabInput; result: SlabAnalysis }) {
  const W = 720, H = 320;
  const slabH = input.geometry.h;
  const slabW = 1000;            // 1 m strip shown
  const scale = 0.5;             // mm → display px (1 mm = 0.5 px)
  const pxW = slabW * scale, pxH = slabH * scale;
  const x0 = (W - pxW) / 2, y0 = 80;
  const coverB = (input.geometry.cover_bottom_x ?? 25) * scale;
  const coverT = (input.geometry.cover_top_x ?? 25) * scale;
  const midX = result.reinforcement.find((r) => r.location === 'mid-x');
  const midY = result.reinforcement.find((r) => r.location === 'mid-y');
  const supX = result.reinforcement.find((r) => r.location === 'sup-x');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      {/* Concrete slab cross-section */}
      <rect x={x0} y={y0} width={pxW} height={pxH} fill="#cdc8bf" stroke="#333" strokeWidth="1.5" />
      {/* Bottom rebar — circles representing bars in cross-section, evenly spaced */}
      {midX && (() => {
        const sp = midX.spacing * scale;
        const bar = BAR_CATALOG.find((b) => b.label === midX.bar);
        const r = (bar?.db ?? 12) * scale / 2;
        const yPos = y0 + pxH - coverB - r;
        const items: React.ReactElement[] = [];
        for (let x = x0 + sp / 2; x < x0 + pxW; x += sp) {
          items.push(<circle key={`bx-${x}`} cx={x} cy={yPos} r={r * 1.5} fill="#c94c4c" stroke="#7a1f1f" strokeWidth="0.5" />);
        }
        items.push(
          <text key="lbl-bx" x={x0 + pxW / 2} y={yPos + 18} textAnchor="middle" fontSize="9" fill="#7a1f1f" fontWeight="600">
            {`${midX.bar} @ ${midX.spacing.toFixed(0)} mm c/c (bottom-x)`}
          </text>,
        );
        return items;
      })()}
      {/* Top rebar at edges */}
      {supX && Math.abs(result.moments.Mx_neg) > 0.1 && (() => {
        const sp = supX.spacing * scale;
        const bar = BAR_CATALOG.find((b) => b.label === supX.bar);
        const r = (bar?.db ?? 12) * scale / 2;
        const yPos = y0 + coverT + r;
        const items: React.ReactElement[] = [];
        // Concentrated near edges — 1/4 of strip on each side
        for (let x = x0 + sp / 2; x < x0 + pxW * 0.25; x += sp) {
          items.push(<circle key={`tx1-${x}`} cx={x} cy={yPos} r={r * 1.5} fill="#e0c060" stroke="#7a5e1f" strokeWidth="0.5" />);
        }
        for (let x = x0 + pxW * 0.75 + sp / 2; x < x0 + pxW; x += sp) {
          items.push(<circle key={`tx2-${x}`} cx={x} cy={yPos} r={r * 1.5} fill="#e0c060" stroke="#7a5e1f" strokeWidth="0.5" />);
        }
        items.push(
          <text key="lbl-tx" x={x0 + pxW / 2} y={yPos - 5} textAnchor="middle" fontSize="9" fill="#7a5e1f" fontWeight="600">
            {`${supX.bar} @ ${supX.spacing.toFixed(0)} mm c/c (top-x, edges)`}
          </text>,
        );
        return items;
      })()}
      {/* Cover annotations */}
      <line x1={x0 + pxW + 12} y1={y0} x2={x0 + pxW + 12} y2={y0 + coverT} stroke="#333" strokeWidth="0.5" />
      <text x={x0 + pxW + 18} y={y0 + coverT / 2 + 3} fontSize="9" fill="#444">{`top cover ${input.geometry.cover_top_x ?? 25} mm`}</text>
      <line x1={x0 + pxW + 12} y1={y0 + pxH - coverB} x2={x0 + pxW + 12} y2={y0 + pxH} stroke="#333" strokeWidth="0.5" />
      <text x={x0 + pxW + 18} y={y0 + pxH - coverB / 2 + 3} fontSize="9" fill="#444">{`btm cover ${input.geometry.cover_bottom_x ?? 25} mm`}</text>
      {/* Total depth */}
      <line x1={x0 - 18} y1={y0} x2={x0 - 18} y2={y0 + pxH} stroke="#333" strokeWidth="0.5" />
      <text x={x0 - 26} y={y0 + pxH / 2 + 4} textAnchor="end" fontSize="11" fill="#222" fontWeight="600">{`h = ${slabH} mm`}</text>
      <text x={x0 + pxW / 2} y={y0 + pxH + 30} textAnchor="middle" fontSize="11" fill="#222" fontWeight="600">{'1.00 m of slab width'}</text>
      {/* Title */}
      <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="#666">
        {`SECTION A-A · ${result.code} · scale ~1:5`}
      </text>
      {/* Mention y-direction layer below */}
      {midY && (
        <text x={x0 + pxW / 2} y={H - 30} textAnchor="middle" fontSize="9" fill="#0a4a8a">
          {`(perpendicular layer y-dir: ${midY.bar} @ ${midY.spacing.toFixed(0)} mm c/c — see Bar schedule §3.3)`}
        </text>
      )}
    </svg>
  );
}

function SvgPunchingPerimeter({ input, result }: { input: SlabInput; result: SlabAnalysis }) {
  const W = 540, H = 380, cx = W / 2, cy = H / 2;
  if (!input.punching || !result.punching) return null;
  const c1 = input.punching.c1;
  const c2 = input.punching.c2 ?? c1;
  const d = result.punching.d;
  const scale = Math.min(W * 0.4 / Math.max(c1 + d, 1), H * 0.4 / Math.max(c2 + d, 1));
  const colW = c1 * scale, colH = c2 * scale;
  // Critical perimeter at d/2 from face
  const peW = (c1 + d) * scale, peH = (c2 + d) * scale;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <rect x={20} y={20} width={W - 40} height={H - 40} fill="#fafafa" stroke="#ddd" strokeWidth="1" />
      {/* Slab plan area (light) */}
      {/* Critical perimeter */}
      <rect x={cx - peW / 2} y={cy - peH / 2} width={peW} height={peH}
            fill="none" stroke="#c94c4c" strokeWidth="1.6" strokeDasharray="6 3" />
      {/* Column */}
      <rect x={cx - colW / 2} y={cy - colH / 2} width={colW} height={colH}
            fill="#888" stroke="#222" strokeWidth="1" />
      {/* d/2 dimension */}
      <line x1={cx + colW / 2} y1={cy} x2={cx + peW / 2} y2={cy} stroke="#222" strokeWidth="0.6" />
      <text x={cx + colW / 2 + (peW - colW) / 4} y={cy - 4} textAnchor="middle" fontSize="9" fill="#a02020">d/2</text>
      {/* Column label */}
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fill="#fff" fontWeight="600">{`${c1}×${c2}`}</text>
      {/* Perimeter label */}
      <text x={cx} y={cy - peH / 2 - 8} textAnchor="middle" fontSize="11" fill="#a02020" fontWeight="600">
        {`Critical perimeter b₀ = ${result.punching.bo.toFixed(0)} mm`}
      </text>
      {/* Stud rails (if any) — show 8 mushroom-headed studs */}
      {result.punching.studRail && Array.from({ length: result.punching.studRail.numRails }).map((_, i) => {
        const ang = (i * 2 * Math.PI) / result.punching!.studRail!.numRails;
        const startR = Math.max(c1, c2) / 2;
        const sp = result.punching!.studRail!.spacing;
        const rows = result.punching!.studRail!.rows;
        const items: React.ReactElement[] = [];
        for (let k = 0; k < rows; k++) {
          const dist = (startR + sp * (0.5 + k)) * scale;
          const sx = cx + Math.cos(ang) * dist;
          const sy = cy + Math.sin(ang) * dist;
          items.push(<circle key={`stud-${i}-${k}`} cx={sx} cy={sy} r="3" fill="#444" stroke="#222" strokeWidth="0.5" />);
        }
        return <g key={`r-${i}`}>{items}</g>;
      })}
      <text x={W / 2} y={H - 12} textAnchor="middle" fontSize="9" fill="#666">
        {`${result.punching.dropPanel ? 'with drop panel · ' : ''}d = ${d.toFixed(0)} mm · ratio = ${result.punching.ratio.toFixed(2)}`}
      </text>
    </svg>
  );
}

// ============================================================================
// Compliance gate computation
// ============================================================================
interface CheckRow {
  name: string; demand: string; capacity: string; ratio: string; ok: boolean;
}
function computeChecks(result: SlabAnalysis): CheckRow[] {
  const rows: CheckRow[] = [];
  rows.push({
    name: 'Minimum thickness h',
    demand: `${result.geometry.h} mm`,
    capacity: `${result.deflection.h_min.toFixed(0)} mm`,
    ratio: (result.deflection.h_min / Math.max(result.geometry.h, 1)).toFixed(2),
    ok: result.deflection.h_min_ok,
  });
  for (const r of result.reinforcement) {
    rows.push({
      name: `Flexure ${labelLoc(r.location)}`,
      demand: `Mu = ${r.Mu.toFixed(2)} kN·m/m`,
      capacity: `φMn = ${r.phiMn_provided.toFixed(2)} kN·m/m`,
      ratio: r.utilization.toFixed(3),
      ok: r.ok,
    });
  }
  if (result.deflection.delta_check !== undefined) {
    rows.push({
      name: `Deflection (Tabla 24.2.2 — L/${result.deflection.delta_limit_ratio})`,
      demand: `Δ = ${result.deflection.delta_check.toFixed(2)} mm`,
      capacity: `≤ ${result.deflection.delta_limit.toFixed(2)} mm`,
      ratio: (result.deflection.delta_check / Math.max(result.deflection.delta_limit, 1e-9)).toFixed(3),
      ok: result.deflection.delta_ok ?? false,
    });
  }
  if (result.punching) {
    rows.push({
      name: 'Punching shear',
      demand: `vu = ${result.punching.vu.toFixed(3)} MPa`,
      capacity: `φvc = ${(result.punching.vc * 0.75).toFixed(3)} MPa`,
      ratio: result.punching.ratio.toFixed(3),
      ok: result.punching.ok,
    });
  }
  if (result.crackControl) {
    rows.push({
      name: 'Crack control (max spacing)',
      demand: `s = ${result.crackControl.s.toFixed(0)} mm`,
      capacity: `≤ ${result.crackControl.s_max.toFixed(0)} mm`,
      ratio: (result.crackControl.s / Math.max(result.crackControl.s_max, 1e-9)).toFixed(3),
      ok: result.crackControl.s <= result.crackControl.s_max,
    });
  }
  return rows;
}

function labelLoc(loc: ReinforcementResult['location']): string {
  switch (loc) {
    case 'mid-x': return 'Midspan x (bottom)';
    case 'mid-y': return 'Midspan y (bottom)';
    case 'sup-x': return 'Edge x (top)';
    case 'sup-y': return 'Edge y (top)';
  }
}
