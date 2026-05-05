'use client';

// Master print report for the retaining-wall tool. ONE report supports
// all 8 wall kinds; sections are rendered conditionally based on
// geometry.kind and which result fields are populated.
//
// CRITICAL: portal wraps in <div className="slab-print-portal"
// id="slab-print-portal"> to reuse the global @media screen / print
// rules in ttc-globals.css. Earlier print reports leaked because they
// used 'pr-doc' instead — fixed in commit 1d11e1e and we don't
// reintroduce it here.
//
// References cited in the report:
//   • ACI 318-25 SI / 318-19 (concrete)
//   • AASHTO LRFD 9e (abutments)
//   • Wight & MacGregor 7e §18-3 (retaining walls)

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WallInput, WallResults } from '@/lib/retaining-wall/types';

interface Props {
  input: WallInput;
  result: WallResults;
  /** PNG snapshot of the current 2D WallCanvas (optional, captured before window.print). */
  cover2dDataUrl?: string;
}

const KIND_LABELS: Record<WallInput['geometry']['kind'], string> = {
  cantilever: 'Cantilever wall',
  gravity: 'Gravity (mass concrete) wall',
  'semi-gravity': 'Semi-gravity wall',
  'l-shaped': 'L-shaped wall',
  counterfort: 'Counterfort wall',
  buttressed: 'Buttressed wall',
  basement: 'Basement / restrained-top wall',
  abutment: 'Bridge abutment',
};

export function RetainingWallPrintReport({ input, result, cover2dDataUrl }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <ReportContent input={input} result={result} cover2dDataUrl={cover2dDataUrl} />,
    document.body,
  );
}

function ReportContent({ input, result, cover2dDataUrl }: Props) {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const projectId = `RW-${today.getFullYear().toString().slice(2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${String(today.getHours()).padStart(2, '0')}${String(today.getMinutes()).padStart(2, '0')}`;
  const code = input.code ?? 'ACI 318-25';
  const g = input.geometry;
  const branding = input.branding;
  const kindLabel = KIND_LABELS[g.kind];

  return (
    <div className="slab-print-portal" id="slab-print-portal">
      {/* ─── PAGE 1 — COVER ─── */}
      <section className="pr-page pr-cover">
        <div className="pr-page-strip">
          {projectId} · {dateStr}
          {branding?.companyName ? ` · ${branding.companyName}` : ''}
        </div>
        {(branding?.logoDataUrl || branding?.companyName) && (
          <div className="pr-cover__brand">
            {branding.logoDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoDataUrl} alt={branding.companyName ?? 'Company logo'}
                   className="pr-cover__userlogo" />
            )}
            {branding.companyName && (
              <div className="pr-cover__company">
                <h1>{branding.companyName}</h1>
                {branding.companyTagline && <div className="pr-cover__sub">{branding.companyTagline}</div>}
              </div>
            )}
          </div>
        )}
        <h1 className="pr-cover__title">{kindLabel} — Design Report</h1>
        <div className="pr-cover__meta">
          <div><strong>Date:</strong> {today.toLocaleDateString()}</div>
          <div><strong>Code:</strong> {code} (SI Units)</div>
          <div><strong>Wall type:</strong> {kindLabel}</div>
          <div><strong>Stem height:</strong> {(g.H_stem / 1000).toFixed(2)} m</div>
          <div><strong>Footing width:</strong> {((g.B_toe + g.t_stem_bot + g.B_heel) / 1000).toFixed(2)} m</div>
        </div>

        {cover2dDataUrl && (
          <div className="pr-cover__hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover2dDataUrl} alt="Wall section" />
          </div>
        )}

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

      {/* ─── PAGE 2 — INPUTS ─── */}
      <section className="pr-page">
        <h2>1. Project inputs</h2>

        <h3>1.1 Geometry</h3>
        <table className="pr-table">
          <tbody>
            <tr><th>H_stem</th><td>{g.H_stem} mm ({(g.H_stem/1000).toFixed(2)} m)</td></tr>
            <tr><th>t_stem (top → bottom)</th><td>{g.t_stem_top} → {g.t_stem_bot} mm</td></tr>
            <tr><th>B_toe</th><td>{g.B_toe} mm</td></tr>
            <tr><th>B_heel</th><td>{g.B_heel} mm</td></tr>
            <tr><th>H_foot</th><td>{g.H_foot} mm</td></tr>
            <tr><th>Backfill slope β</th><td>{(g.backfillSlope * 180 / Math.PI).toFixed(1)}°</td></tr>
            <tr><th>Front fill</th><td>{g.frontFill} mm</td></tr>
            {g.kind === 'gravity' && (
              <>
                <tr><th>Front batter</th><td>{(g.batterFront * 180 / Math.PI).toFixed(1)}°</td></tr>
                <tr><th>Back batter</th><td>{(g.batterBack * 180 / Math.PI).toFixed(1)}°</td></tr>
              </>
            )}
            {g.kind === 'counterfort' && (
              <>
                <tr><th>Counterfort spacing</th><td>{g.counterfortSpacing} mm</td></tr>
                <tr><th>Counterfort thickness</th><td>{g.counterfortThickness} mm</td></tr>
              </>
            )}
            {g.kind === 'buttressed' && (
              <>
                <tr><th>Buttress spacing</th><td>{g.buttressSpacing} mm</td></tr>
                <tr><th>Buttress thickness</th><td>{g.buttressThickness} mm</td></tr>
              </>
            )}
            {g.kind === 'basement' && (
              <>
                <tr><th>Top-support elevation</th><td>{g.topElevation} mm above footing top</td></tr>
                <tr><th>Top fixity</th><td>{g.topFixity}</td></tr>
              </>
            )}
            {g.kind === 'abutment' && (
              <>
                <tr><th>Bridge seat width</th><td>{g.bridgeSeat.width} mm</td></tr>
                <tr><th>Bridge DL</th><td>{g.bridgeSeat.deadLoad.toFixed(1)} kN/m</td></tr>
                <tr><th>Bridge LL</th><td>{g.bridgeSeat.liveLoad.toFixed(1)} kN/m</td></tr>
                <tr><th>Backwall H × t</th><td>{g.backwall.H} × {g.backwall.t} mm</td></tr>
                {g.wingWall && (
                  <tr><th>Wing wall L × H × t</th><td>{g.wingWall.length} × {g.wingWall.H} × {g.wingWall.t} mm</td></tr>
                )}
              </>
            )}
            {g.key && (
              <tr><th>Shear key (w × d, offset)</th><td>{g.key.width} × {g.key.depth} mm, offset {g.key.offsetFromHeel} from heel</td></tr>
            )}
          </tbody>
        </table>

        <h3>1.2 Materials</h3>
        <table className="pr-table">
          <tbody>
            <tr><th>f&#39;c</th><td>{input.concrete.fc} MPa</td></tr>
            <tr><th>fy</th><td>{input.concrete.fy} MPa</td></tr>
            <tr><th>γ_concrete</th><td>{input.concrete.gamma} kN/m³</td></tr>
            <tr><th>Cover</th><td>{input.concrete.cover} mm</td></tr>
          </tbody>
        </table>

        <h3>1.3 Soil profile</h3>
        <table className="pr-table">
          <thead><tr><th>Layer</th><th>γ (kN/m³)</th><th>φ (°)</th><th>c (kPa)</th><th>Thickness (mm)</th></tr></thead>
          <tbody>
            {input.backfill.map((L, i) => (
              <tr key={i}>
                <td>{L.name}</td>
                <td>{L.gamma}</td>
                <td>{(L.phi * 180 / Math.PI).toFixed(1)}</td>
                <td>{L.c}</td>
                <td>{L.thickness === 0 || !isFinite(L.thickness) ? '∞' : L.thickness}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="pr-table" style={{ marginTop: '0.4cm' }}>
          <tbody>
            <tr><th>Base soil γ / φ / δ / ca / qAllow</th>
                <td>{input.baseSoil.gamma} kN/m³ / {(input.baseSoil.phi * 180 / Math.PI).toFixed(1)}° / {(input.baseSoil.delta * 180 / Math.PI).toFixed(1)}° / {input.baseSoil.ca} kPa / {input.baseSoil.qAllow} kPa</td>
            </tr>
            <tr><th>Passive resistance</th><td>{input.baseSoil.passiveEnabled ? 'Included' : 'Excluded (conservative)'}</td></tr>
            <tr><th>Water table</th><td>{input.water.enabled ? `at ${input.water.depthFromStemTop} mm from stem top, γw = ${input.water.gammaW} kN/m³` : 'Not present'}</td></tr>
            <tr><th>Surcharge q</th><td>{input.loads.surchargeQ} kPa</td></tr>
            <tr><th>Seismic kh / kv</th><td>{input.loads.seismic.kh.toFixed(2)} / {input.loads.seismic.kv.toFixed(2)}</td></tr>
            <tr><th>Earth-pressure theory</th><td>{input.theory === 'rankine' ? 'Rankine' : 'Coulomb (with wall friction δ)'}</td></tr>
          </tbody>
        </table>
      </section>

      {/* ─── PAGE 3 — STABILITY ─── */}
      <section className="pr-page">
        <h2>2. Stability checks</h2>

        <h3>2.1 Earth pressure</h3>
        <table className="pr-table">
          <tbody>
            <tr><th>Ka coefficient</th><td>{result.pressure.K.toFixed(3)}</td></tr>
            <tr><th>Pa (active soil)</th><td>{result.pressure.Pa.toFixed(2)} kN/m</td></tr>
            <tr><th>Pq (surcharge)</th><td>{result.pressure.Pq.toFixed(2)} kN/m</td></tr>
            <tr><th>Pw (water)</th><td>{result.pressure.Pw.toFixed(2)} kN/m</td></tr>
            <tr><th>ΔPae (seismic)</th><td>{result.pressure.dPae.toFixed(2)} kN/m</td></tr>
            <tr><th>Resultant ȳ above footing base</th><td>{(result.pressure.yBar / 1000).toFixed(3)} m</td></tr>
          </tbody>
        </table>

        <h3>2.2 Resultants & FS</h3>
        <table className="pr-table">
          <thead>
            <tr><th>Check</th><th>Demand</th><th>Capacity / Limit</th><th>Ratio</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Overturning</td>
              <td>Mo = {result.stability.Mo.toFixed(2)} kN·m/m</td>
              <td>Mr = {result.stability.Mr.toFixed(2)} kN·m/m, FS_min = {input.safetyFactors.overturning}</td>
              <td>{result.stability.FS_overturning.toFixed(2)}</td>
              <td>{result.stability.overturningOk ? '✓' : '✗'}</td>
            </tr>
            <tr>
              <td>Sliding</td>
              <td>ΣH = {result.stability.sumH.toFixed(2)} kN/m</td>
              <td>μ·ΣV + Pp = {(result.stability.slidingMu * result.stability.sumV + result.stability.passiveResistance + result.stability.keyContribution).toFixed(2)} kN/m, FS_min = {input.safetyFactors.sliding}</td>
              <td>{result.stability.FS_sliding.toFixed(2)}</td>
              <td>{result.stability.slidingOk ? '✓' : '✗'}</td>
            </tr>
            <tr>
              <td>Bearing (allowable)</td>
              <td>qmax = {result.stability.qMax.toFixed(1)} kPa</td>
              <td>qAllow = {input.baseSoil.qAllow.toFixed(0)} kPa</td>
              <td>{result.stability.bearingUtilization.toFixed(2)}</td>
              <td>{result.stability.bearingOk ? '✓' : '✗'}</td>
            </tr>
            <tr>
              <td>Eccentricity</td>
              <td>e = {result.stability.eccentricity.toFixed(0)} mm</td>
              <td>kern = {result.stability.kern.toFixed(0)} mm ({input.safetyFactors.eccentricity})</td>
              <td>{(Math.abs(result.stability.eccentricity) / result.stability.kern).toFixed(2)}</td>
              <td>{result.stability.eccentricityOk ? '✓' : '✗'}</td>
            </tr>
          </tbody>
        </table>

        {result.stability.bearingMeyerhof && (
          <>
            <h3>2.3 Ultimate bearing (Meyerhof / Vesić)</h3>
            <table className="pr-table">
              <tbody>
                <tr><th>Nc / Nq / Nγ</th><td>{result.stability.bearingMeyerhof.Nc.toFixed(2)} / {result.stability.bearingMeyerhof.Nq.toFixed(2)} / {result.stability.bearingMeyerhof.Ng.toFixed(2)}</td></tr>
                <tr><th>Shape sc / sq / sγ</th><td>{result.stability.bearingMeyerhof.sc.toFixed(2)} / {result.stability.bearingMeyerhof.sq.toFixed(2)} / {result.stability.bearingMeyerhof.sg.toFixed(2)}</td></tr>
                <tr><th>Depth dc / dq / dγ</th><td>{result.stability.bearingMeyerhof.dc.toFixed(2)} / {result.stability.bearingMeyerhof.dq.toFixed(2)} / {result.stability.bearingMeyerhof.dg.toFixed(2)}</td></tr>
                <tr><th>Inclination ic / iq / iγ</th><td>{result.stability.bearingMeyerhof.ic.toFixed(2)} / {result.stability.bearingMeyerhof.iq.toFixed(2)} / {result.stability.bearingMeyerhof.ig.toFixed(2)}</td></tr>
                <tr><th>qu (ultimate)</th><td>{result.stability.bearingMeyerhof.qu.toFixed(0)} kPa</td></tr>
                <tr><th>qa,ult / FS</th><td>{result.stability.bearingMeyerhof.qaUlt.toFixed(0)} kPa</td></tr>
              </tbody>
            </table>
          </>
        )}
      </section>

      {/* ─── PAGE 4 — REINFORCEMENT DESIGN ─── */}
      <section className="pr-page">
        <h2>3. Reinforcement design</h2>

        {result.gravityStress ? (
          <>
            <h3>3.1 Gravity wall — plain-concrete stress (ACI 318-25 §14.5)</h3>
            <table className="pr-table">
              <tbody>
                <tr><th>σ_max (compression face)</th><td>{(result.gravityStress.sigma_max / 1000).toFixed(2)} MPa</td></tr>
                <tr><th>σ_min (tension face)</th><td>{(result.gravityStress.sigma_min / 1000).toFixed(2)} MPa</td></tr>
                <tr><th>σ_allow = φ · 0.45 · f&#39;c</th><td>{(result.gravityStress.sigma_allow / 1000).toFixed(2)} MPa</td></tr>
                <tr><th>Status</th><td>{result.gravityStress.ok ? '✓ Within plain-concrete limits' : '✗ Exceeds limits — convert to semi-gravity or cantilever'}</td></tr>
              </tbody>
            </table>
          </>
        ) : (
          <>
            <h3>3.1 Stem</h3>
            <MemberTable label="Stem (rear face)" m={result.stem} />
            {result.stem.frontFace && (
              <table className="pr-table" style={{ marginTop: '0.3cm' }}>
                <tbody>
                  <tr><th colSpan={2} style={{ textAlign: 'left' }}>Stem (front face — basement / restrained-top)</th></tr>
                  <tr><th>Mu</th><td>{result.stem.frontFace.Mu.toFixed(2)} kN·m/m</td></tr>
                  <tr><th>As_req</th><td>{result.stem.frontFace.As_req.toFixed(0)} mm²/m</td></tr>
                  <tr><th>Crack control</th><td>{result.stem.frontFace.crack.ok ? '✓' : '✗'}</td></tr>
                </tbody>
              </table>
            )}

            <h3>3.2 Heel</h3>
            <MemberTable label="Heel" m={result.heel} />

            <h3>3.3 Toe</h3>
            <MemberTable label="Toe" m={result.toe} />

            {result.key.enabled && (
              <>
                <h3>3.4 Shear key</h3>
                <table className="pr-table">
                  <tbody>
                    <tr><th>Hp_key</th><td>{result.key.Hp_key.toFixed(2)} kN/m</td></tr>
                    <tr><th>Mu / Vu</th><td>{result.key.Mu.toFixed(2)} kN·m/m / {result.key.Vu.toFixed(2)} kN/m</td></tr>
                    <tr><th>As_req</th><td>{result.key.As_req.toFixed(0)} mm²/m</td></tr>
                    <tr><th>Shear OK</th><td>{result.key.shearOk ? '✓' : '✗'}</td></tr>
                  </tbody>
                </table>
              </>
            )}
          </>
        )}

        {result.counterfortDesign && (
          <>
            <h3>3.5 Counterfort design</h3>
            <MemberTable label="Stem slab (between counterforts)" m={result.counterfortDesign.stemSlab} />
            <MemberTable label="Heel slab (between counterforts)" m={result.counterfortDesign.heelSlab} />
            <table className="pr-table" style={{ marginTop: '0.3cm' }}>
              <tbody>
                <tr><th colSpan={2} style={{ textAlign: 'left' }}>Counterfort T-beam</th></tr>
                <tr><th>Mu / Vu</th><td>{result.counterfortDesign.counterfort.Mu.toFixed(2)} kN·m / {result.counterfortDesign.counterfort.Vu.toFixed(2)} kN</td></tr>
                <tr><th>bw × d</th><td>{result.counterfortDesign.counterfort.bw} × {result.counterfortDesign.counterfort.d.toFixed(0)} mm</td></tr>
                <tr><th>As_req (rear face tension)</th><td>{result.counterfortDesign.counterfort.As_req.toFixed(0)} mm²</td></tr>
                <tr><th>φMn / Vc</th><td>{result.counterfortDesign.counterfort.phiMn.toFixed(1)} kN·m / {result.counterfortDesign.counterfort.Vc.toFixed(1)} kN</td></tr>
                <tr><th>Shear OK</th><td>{result.counterfortDesign.counterfort.shearOk ? '✓' : '✗'}</td></tr>
              </tbody>
            </table>
          </>
        )}

        {result.buttressedDesign && (
          <>
            <h3>3.5 Buttress design (compression)</h3>
            <MemberTable label="Stem slab (between buttresses)" m={result.buttressedDesign.stemSlab} />
            <MemberTable label="Heel slab (between buttresses)" m={result.buttressedDesign.heelSlab} />
            <p style={{ fontSize: '9pt', fontStyle: 'italic', color: '#444' }}>
              Buttresses are in compression — only nominal As_min reinforcement required (ACI 318-25 §11.6 + §24.4.3).
            </p>
          </>
        )}

        {result.topSupport && (
          <>
            <h3>3.5 Top-support reaction (basement / restrained-top)</h3>
            <table className="pr-table">
              <tbody>
                <tr><th>Top reaction (factored)</th><td>{result.topSupport.reaction.toFixed(2)} kN/m at y = {(g.kind === 'basement' ? g.topElevation / 1000 : 0).toFixed(2)} m</td></tr>
                <tr><th>M+ (front face midspan)</th><td>{result.topSupport.Mmax_pos.toFixed(2)} kN·m/m at y = {(result.topSupport.yMax_pos/1000).toFixed(2)} m</td></tr>
                <tr><th>M− (rear face base)</th><td>{result.topSupport.Mmax_neg.toFixed(2)} kN·m/m</td></tr>
                <tr><th>Top fixity</th><td>{result.topSupport.fixity}</td></tr>
              </tbody>
            </table>
            <p style={{ fontSize: '9pt', fontStyle: 'italic', color: '#444' }}>
              The floor slab / diaphragm at the top must be designed to develop this reaction (ACI 318-25 §16.3 + §11.4.5).
            </p>
          </>
        )}

        {result.abutmentDesign && (
          <>
            <h3>3.5 Bridge abutment design (AASHTO LRFD §11.6)</h3>
            <table className="pr-table">
              <tbody>
                <tr><th>Bridge seat factored DL (γDC = 1.25)</th><td>{result.abutmentDesign.seat.PuD.toFixed(1)} kN/m</td></tr>
                <tr><th>Bridge seat factored LL (γLL = 1.75)</th><td>{result.abutmentDesign.seat.PuL.toFixed(1)} kN/m</td></tr>
                <tr><th>Total Pu</th><td>{result.abutmentDesign.seat.PuTotal.toFixed(1)} kN/m</td></tr>
              </tbody>
            </table>
            <MemberTable label="Backwall" m={result.abutmentDesign.backwall} />
            {result.abutmentDesign.wingWall && (
              <MemberTable label="Wing wall" m={result.abutmentDesign.wingWall} />
            )}
          </>
        )}
      </section>

      {/* ─── PAGE 5 — REFERENCES + ISSUES ─── */}
      <section className="pr-page">
        <h2>4. Code references</h2>
        <ul>
          <li><strong>{code === 'AASHTO LRFD' ? 'AASHTO LRFD Bridge Design Specifications, 9e' : code}</strong>
            {code === 'ACI 318-25' && ' (SI Units)'}</li>
          <li>ACI 318-25 §13.3 — Foundation design</li>
          <li>ACI 318-25 §22.2 — Flexure, §22.5 — One-way shear, §22.9 — Shear-friction</li>
          <li>ACI 318-25 §24.3 — Crack control, §24.4.3 — Temperature/shrinkage steel</li>
          <li>ACI 318-25 §25.4 — Development of reinforcement, §25.5 — Lap splices</li>
          {g.kind === 'gravity' && <li>ACI 318-25 §14.5 — Plain-concrete stress limits</li>}
          {g.kind === 'abutment' && <li>AASHTO LRFD §3.4 (load factors), §11.6 (abutments), §5.10.8 (anchorage)</li>}
          {g.kind === 'basement' && <li>ACI 318-25 §11 (walls), §16.3 + §11.4.5 (slab-to-wall connections)</li>}
          <li>Wight, J. K. & MacGregor, J. G. — <em>Reinforced Concrete: Mechanics &amp; Design</em>, 7e (Pearson, 2014), §17 retaining walls</li>
        </ul>

        {result.issues.length > 0 && (
          <>
            <h2>5. Issues / warnings</h2>
            <ul>
              {result.issues.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </>
        )}

        {result.errors.length > 0 && (
          <>
            <h2>6. Errors (must be addressed)</h2>
            <ul style={{ color: '#a83030' }}>
              {result.errors.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function MemberTable({ label, m }: { label: string; m: { Mu: number; Vu: number; As_req: number; As_min: number; phiMn: number; shearOk: boolean; crack: { ok: boolean; s_max: number; s_req: number } } }) {
  return (
    <table className="pr-table" style={{ marginTop: '0.3cm' }}>
      <tbody>
        <tr><th colSpan={2} style={{ textAlign: 'left' }}>{label}</th></tr>
        <tr><th>Mu</th><td>{m.Mu.toFixed(2)} kN·m/m</td></tr>
        <tr><th>Vu</th><td>{m.Vu.toFixed(2)} kN/m</td></tr>
        <tr><th>As_req</th><td>{m.As_req.toFixed(0)} mm²/m</td></tr>
        <tr><th>As_min (§24.4.3)</th><td>{m.As_min.toFixed(0)} mm²/m</td></tr>
        <tr><th>φMn</th><td>{m.phiMn.toFixed(2)} kN·m/m</td></tr>
        <tr><th>Shear (φVc)</th><td>{m.shearOk ? '✓' : '✗'}</td></tr>
        <tr><th>Crack control (§24.3.2)</th><td>{m.crack.ok ? `✓ s_req ${m.crack.s_req.toFixed(0)} ≤ s_max ${m.crack.s_max.toFixed(0)} mm` : `✗ s_req ${m.crack.s_req.toFixed(0)} > s_max ${m.crack.s_max.toFixed(0)} mm`}</td></tr>
      </tbody>
    </table>
  );
}
