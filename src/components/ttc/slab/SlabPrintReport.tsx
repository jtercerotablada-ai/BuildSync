'use client';

import React from 'react';
import type { SlabAnalysis, SlabInput, ReinforcementResult } from '@/lib/slab/types';

interface Props {
  input: SlabInput;
  result: SlabAnalysis;
}

/**
 * Dedicated A4-friendly report rendered ONLY on print.
 * Hidden on screen via .slab-print-report { display: none } (in ttc-globals.css).
 * `window.print()` shows just this and hides everything else.
 */
export function SlabPrintReport({ input, result }: Props) {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div className="slab-print-report">
      <header>
        <h1>Slab Design Report</h1>
        <div className="pr-meta">
          <strong>Tercero Tablada · Civil &amp; Structural Engineering</strong> ·
          generated {dateStr} ·
          <span> design code: <span className="pr-key">{result.code}</span></span> ·
          <span> classification: <span className="pr-key">{result.classification === 'one-way' ? 'One-way' : `Two-way (Method 3 case ${result.case ?? '?'})`}</span></span>
        </div>
      </header>

      {/* 1. Inputs */}
      <section className="pr-block">
        <h2>1. Inputs</h2>
        <h3>Geometry</h3>
        <table>
          <tbody>
            <tr><th>Lx</th><td>{input.geometry.Lx.toFixed(2)} m</td>
                <th>Ly</th><td>{input.geometry.Ly.toFixed(2)} m</td>
                <th>Slab thickness h</th><td>{input.geometry.h.toFixed(0)} mm</td></tr>
            <tr><th>Cover bottom x</th><td>{input.geometry.cover_bottom_x ?? 25} mm</td>
                <th>Cover bottom y</th><td>{input.geometry.cover_bottom_y ?? 35} mm</td>
                <th>Cover top x</th><td>{input.geometry.cover_top_x ?? 25} mm</td></tr>
          </tbody>
        </table>

        <h3>Edge conditions</h3>
        <table>
          <tbody>
            <tr><th>Top edge</th><td>{input.edges.top}</td>
                <th>Bottom edge</th><td>{input.edges.bottom}</td>
                <th>Left edge</th><td>{input.edges.left}</td>
                <th>Right edge</th><td>{input.edges.right}</td></tr>
          </tbody>
        </table>

        <h3>Materials</h3>
        <table>
          <tbody>
            <tr><th>Concrete strength fʹc</th><td>{input.materials.fc} MPa</td>
                <th>Rebar yield fy</th><td>{input.materials.fy} MPa</td>
                <th>Concrete unit weight γc</th><td>{input.materials.gammaC ?? 24} kN/m³</td></tr>
          </tbody>
        </table>

        <h3>Loads</h3>
        <table>
          <tbody>
            <tr><th>Super-imposed DL</th><td>{input.loads.DL_super.toFixed(2)} kN/m²</td>
                <th>Live load LL</th><td>{input.loads.LL.toFixed(2)} kN/m²</td>
                <th>Self-weight DL</th><td>{result.wSelf.toFixed(2)} kN/m²</td></tr>
            <tr><th>Factor DL</th><td>{input.loads.factor_DL?.toFixed(2) ?? (result.code === 'EN 1992-1-1' ? '1.35' : '1.20')}</td>
                <th>Factor LL</th><td>{input.loads.factor_LL?.toFixed(2) ?? (result.code === 'EN 1992-1-1' ? '1.50' : '1.60')}</td>
                <th>Factored wu</th><td className="pr-key">{result.wu.toFixed(2)} kN/m²</td></tr>
          </tbody>
        </table>

        {input.punching && (
          <>
            <h3>Punching shear input</h3>
            <table>
              <tbody>
                <tr><th>Position</th><td>{input.punching.position}</td>
                    <th>Column c1</th><td>{input.punching.c1} mm</td>
                    <th>Column c2</th><td>{input.punching.c2 ?? input.punching.c1} mm</td></tr>
                <tr><th>Vu</th><td>{input.punching.Vu} kN</td>
                    <th>Mu transfer</th><td>{input.punching.Mu ?? 0} kN·m</td>
                    <th>Drop panel</th><td>{input.punching.dropPanelSize ? `${input.punching.dropPanelSize}×${input.punching.dropPanelSize} +${input.punching.dropPanelThickness} mm` : 'none'}</td></tr>
              </tbody>
            </table>
          </>
        )}
      </section>

      {/* 2. Moments */}
      <section className="pr-block">
        <h2>2. Design moments &amp; shears (per metre width)</h2>
        <table>
          <thead>
            <tr><th>Quantity</th><th>X-direction</th><th>Y-direction</th><th>Notes</th></tr>
          </thead>
          <tbody>
            <tr><td>Positive midspan moment</td>
                <td className="pr-key">{result.moments.Mx_pos.toFixed(3)} kN·m/m</td>
                <td className="pr-key">{result.moments.My_pos.toFixed(3)} kN·m/m</td>
                <td>sagging</td></tr>
            <tr><td>Negative continuous-edge moment</td>
                <td className="pr-key">{result.moments.Mx_neg.toFixed(3)} kN·m/m</td>
                <td className="pr-key">{result.moments.My_neg.toFixed(3)} kN·m/m</td>
                <td>hogging at fixed/continuous edges</td></tr>
            <tr><td>Shear at supports</td>
                <td>{result.moments.Vx.toFixed(3)} kN/m</td>
                <td>{result.moments.Vy.toFixed(3)} kN/m</td>
                <td>tributary partition</td></tr>
          </tbody>
        </table>
      </section>

      {/* 3. Reinforcement */}
      <section className="pr-block">
        <h2>3. Reinforcement design &amp; verification</h2>
        <table>
          <thead>
            <tr>
              <th>Location</th><th>Mu (kN·m/m)</th><th>d (mm)</th>
              <th>As req (mm²/m)</th><th>As min (mm²/m)</th><th>As design (mm²/m)</th>
              <th>Bar</th><th>Spacing (mm)</th>
              <th>As prov.</th><th>φMn (kN·m/m)</th><th>Mu/φMn</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {result.reinforcement.map((r) => (
              <tr key={r.location} className={r.ok ? '' : 'pr-fail'}>
                <td>{labelLoc(r.location)}</td>
                <td>{r.Mu.toFixed(2)}</td>
                <td>{r.d.toFixed(0)}</td>
                <td>{r.As_req.toFixed(0)}</td>
                <td>{r.As_min.toFixed(0)}</td>
                <td className="pr-key">{r.As_design.toFixed(0)}</td>
                <td>{r.bar} {r.source === 'user' ? '(user)' : ''}</td>
                <td>{r.spacing.toFixed(0)}</td>
                <td>{r.As_provided.toFixed(0)}</td>
                <td>{r.phiMn_provided.toFixed(2)}</td>
                <td className={r.utilization > 1 ? 'pr-fail' : 'pr-pass'}>{r.utilization.toFixed(3)}</td>
                <td className={r.ok ? 'pr-pass' : 'pr-fail'}>{r.ok ? '✓ OK' : '✗ FAIL'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {result.reinforcement.map((r) => (
          <div className="pr-block" key={`steps-${r.location}`}>
            <h3>{labelLoc(r.location)} — hand calculation</h3>
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
              <div>
                <strong className="pr-fail">Failures:</strong>
                <ul>{r.failures.map((f, i) => <li key={i} className="pr-fail">⚠ {f}</li>)}</ul>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* 4. Deflection */}
      <section className="pr-block">
        <h2>4. Deflection check</h2>
        <table>
          <tbody>
            <tr><th>Min thickness h_min</th><td>{result.deflection.h_min.toFixed(0)} mm</td>
                <th>Provided h</th><td>{input.geometry.h} mm</td>
                <th>Status</th><td className={result.deflection.h_min_ok ? 'pr-pass' : 'pr-fail'}>{result.deflection.h_min_ok ? '✓ OK' : '✗ FAIL'}</td></tr>
            {result.deflection.delta_immediate !== undefined && (
              <tr><th>Δi (full service)</th><td>{result.deflection.delta_immediate.toFixed(2)} mm</td>
                  <th>Δi (LL only)</th><td>{result.deflection.delta_immediate_LL?.toFixed(2)} mm</td>
                  <th>Branson Ie</th><td>{result.deflection.Ie?.toExponential(3)} mm⁴/m</td></tr>
            )}
            {result.deflection.xi !== undefined && (
              <tr><th>Sustained period ξ</th><td>{result.deflection.xi.toFixed(2)}</td>
                  <th>λΔ</th><td>{result.deflection.longTermFactor?.toFixed(2)}</td>
                  <th>ψ (sustained LL)</th><td>{result.deflection.sustainedLLFraction?.toFixed(2)}</td></tr>
            )}
            {result.deflection.delta_check !== undefined && (
              <tr><th>Δcheck (Tabla 24.2.2)</th><td>{result.deflection.delta_check.toFixed(2)} mm</td>
                  <th>Limit L/{result.deflection.delta_limit_ratio}</th><td>{result.deflection.delta_limit.toFixed(2)} mm</td>
                  <th>Status</th><td className={result.deflection.delta_ok ? 'pr-pass' : 'pr-fail'}>{result.deflection.delta_ok ? '✓ OK' : '✗ FAIL'}</td></tr>
            )}
          </tbody>
        </table>
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
      </section>

      {/* 5. Punching */}
      {result.punching && (
        <section className="pr-block">
          <h2>5. Punching shear check</h2>
          <table>
            <tbody>
              <tr><th>Critical perimeter b₀</th><td>{result.punching.bo.toFixed(0)} mm</td>
                  <th>Effective depth d</th><td>{result.punching.d.toFixed(0)} mm</td>
                  <th>vc capacity</th><td>{result.punching.vc.toFixed(3)} MPa</td></tr>
              <tr><th>vu demand</th><td>{result.punching.vu.toFixed(3)} MPa</td>
                  <th>Demand/capacity</th><td className={result.punching.ok ? 'pr-pass' : 'pr-fail'}>{result.punching.ratio.toFixed(3)}</td>
                  <th>Status</th><td className={result.punching.ok ? 'pr-pass' : 'pr-fail'}>{result.punching.ok ? '✓ OK' : '✗ FAIL — needs reinf.'}</td></tr>
              {result.punching.dropPanel && (
                <tr><th>Drop panel</th><td colSpan={5}>{result.punching.dropPanel.size}×{result.punching.dropPanel.size} mm × +{result.punching.dropPanel.thickness} mm thk → d_eff = {result.punching.dropPanel.d_eff.toFixed(0)} mm</td></tr>
              )}
            </tbody>
          </table>
          {result.punching.studRail && (
            <>
              <h3>Stud rail design (ACI 421.1R-20)</h3>
              <table>
                <tbody>
                  <tr><th>Stud diameter</th><td>{result.punching.studRail.studDiameter} mm</td>
                      <th>Number of rails</th><td>{result.punching.studRail.numRails}</td>
                      <th>Spacing along rail</th><td>{result.punching.studRail.spacing.toFixed(0)} mm</td>
                      <th>Rows per rail</th><td>{result.punching.studRail.rows}</td></tr>
                </tbody>
              </table>
            </>
          )}
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
        </section>
      )}

      {/* 6. Crack control */}
      {result.crackControl && (
        <section className="pr-block">
          <h2>6. Crack control</h2>
          <table>
            <tbody>
              <tr><th>Service stress fs</th><td>{result.crackControl.fs.toFixed(0)} MPa</td>
                  <th>Spacing used</th><td>{result.crackControl.s.toFixed(0)} mm</td>
                  <th>s_max</th><td className={result.crackControl.s <= result.crackControl.s_max ? 'pr-pass' : 'pr-fail'}>{result.crackControl.s_max.toFixed(0)} mm</td></tr>
              {result.crackControl.wk !== undefined && (
                <tr><th>EN crack width wk</th><td>{result.crackControl.wk.toFixed(3)} mm</td>
                    <th>Limit wk</th><td>{result.crackControl.wk_limit?.toFixed(2)} mm</td>
                    <th>Status</th><td className={result.crackControl.wk_ok ? 'pr-pass' : 'pr-fail'}>{result.crackControl.wk_ok ? '✓ OK' : '✗ FAIL'}</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* 7. Warnings */}
      {result.warnings.length > 0 && (
        <section className="pr-block">
          <h2>7. Warnings</h2>
          <ul>
            {result.warnings.map((w, i) => <li key={i} className="pr-warn">⚠ {w}</li>)}
          </ul>
        </section>
      )}

      <div className="pr-footer">
        Tercero Tablada Civil &amp; Structural Engineering Inc · ttcivilstructural.com ·
        Solver validated by 105 unit tests · {dateStr}
      </div>
    </div>
  );
}

function labelLoc(loc: ReinforcementResult['location']): string {
  switch (loc) {
    case 'mid-x': return 'Midspan x (bottom)';
    case 'mid-y': return 'Midspan y (bottom)';
    case 'sup-x': return 'Edge x (top)';
    case 'sup-y': return 'Edge y (top)';
  }
}
