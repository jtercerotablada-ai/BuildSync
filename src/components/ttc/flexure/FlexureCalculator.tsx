'use client';

import React, { useId, useMemo, useState } from 'react';
import {
  type SectionInputs,
  designFlexure,
  capacityFromAs,
  beta1,
  effectiveDepth,
  BAR_TABLE,
  rebarLayout,
} from '@/lib/flexure/aci318';

type Mode = 'design' | 'analysis';

/* ───────────────────────── small input helper (a11y: label ↔ input) ───────────────────────── */
function Num({
  label,
  unit,
  value,
  onChange,
  step = 'any',
  hint,
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flx-field">
      <label htmlFor={id}>
        {label} {unit ? <span className="flx-unit">({unit})</span> : null}
      </label>
      <input
        id={id}
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {hint ? <small className="flx-hint">{hint}</small> : null}
    </div>
  );
}

function num(x: number, d = 2): string {
  return Number.isFinite(x) ? x.toFixed(d) : '—';
}

/* result table row */
function R({
  k,
  v,
  unit,
  ref,
  good,
}: {
  k: string;
  v: React.ReactNode;
  unit?: string;
  ref?: string;
  good?: boolean;
}) {
  return (
    <tr className={good === undefined ? '' : good ? 'flx-ok-row' : 'flx-bad-row'}>
      <td className="flx-k">{k}</td>
      <td className="flx-v">
        {v} {unit ? <span className="flx-unit">{unit}</span> : null}
      </td>
      <td className="flx-ref">{ref}</td>
    </tr>
  );
}

/* ───────────────────────── cross-section drawing ───────────────────────── */
function CrossSection({
  b,
  h,
  rCm,
  nBars,
  cMm,
  aMm,
  barLabel,
}: {
  b: number;
  h: number;
  rCm: number;
  nBars: number;
  cMm?: number;
  aMm?: number;
  barLabel?: string;
}) {
  const W = 360;
  const H = 320;
  const pad = 54;
  if (!(b > 0) || !(h > 0)) {
    return (
      <div className="flx-canvas flx-canvas--empty">Enter b &amp; h to draw the section</div>
    );
  }
  const maxW = W - 2 * pad;
  const maxH = H - 2 * pad;
  const s = Math.min(maxW / b, maxH / h); // px per metre
  const rw = b * s;
  const rh = h * s;
  const ox = (W - rw) / 2;
  const oy = (H - rh) / 2;

  const bars = rebarLayout({ b, h, rCm, fy: 0, fc: 0 }, nBars);
  const dia = Math.max(7, Math.min(16, (rw / Math.max(nBars, 1)) * 0.32));

  const naY = cMm !== undefined && cMm > 0 ? oy + (cMm / 1000) * s : null; // c from top
  const aPx = aMm !== undefined && aMm > 0 ? (aMm / 1000) * s : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="flx-svg" role="img" aria-label="Beam cross-section with reinforcement">
      <title>Cross-section: {Math.round(b * 1000)}×{Math.round(h * 1000)} mm</title>
      {/* Whitney compression block */}
      {aPx && aPx > 0 && (
        <rect x={ox} y={oy} width={rw} height={Math.min(aPx, rh)} fill="rgba(118,182,201,0.18)" />
      )}
      {/* concrete */}
      <rect x={ox} y={oy} width={rw} height={rh} fill="rgba(255,255,255,0.02)" stroke="#9aa3ad" strokeWidth={1.6} />
      {/* neutral axis */}
      {naY && naY < oy + rh && (
        <g>
          <line x1={ox - 18} y1={naY} x2={ox + rw + 18} y2={naY} stroke="#c9a84c" strokeWidth={1.3} strokeDasharray="6 4" />
          <text x={ox + rw + 22} y={naY + 4} className="flx-dim" fill="#c9a84c">N.A. c={num(cMm! , 0)}mm</text>
        </g>
      )}
      {/* rebar */}
      {bars.map((p, i) => (
        <circle
          key={i}
          cx={ox + p.x * s}
          cy={oy + (h - p.y) * s}
          r={dia}
          fill="#8e2a17"
          stroke="#3a0f08"
          strokeWidth={1}
        />
      ))}
      {/* width dim */}
      <line x1={ox} y1={oy + rh + 20} x2={ox + rw} y2={oy + rh + 20} stroke="#6b7280" strokeWidth={1} markerStart="url(#tick)" markerEnd="url(#tick)" />
      <text x={ox + rw / 2} y={oy + rh + 36} textAnchor="middle" className="flx-dim">b = {Math.round(b * 1000)} mm</text>
      {/* height dim */}
      <text x={ox - 22} y={oy + rh / 2} textAnchor="middle" className="flx-dim" transform={`rotate(-90 ${ox - 22} ${oy + rh / 2})`}>h = {Math.round(h * 1000)} mm</text>
      {/* d marker */}
      <text x={ox + rw / 2} y={oy + (h - rCm / 100) * s + (dia + 14)} textAnchor="middle" className="flx-dim" fill="#8e2a17">
        {nBars}×{barLabel ?? 'bars'} (d = {Math.round((h - rCm / 100) * 1000)} mm)
      </text>
      <defs>
        <marker id="tick" markerWidth="6" markerHeight="10" refX="3" refY="5" orient="auto">
          <line x1="3" y1="0" x2="3" y2="10" stroke="#6b7280" strokeWidth="1" />
        </marker>
      </defs>
    </svg>
  );
}

/* ───────────────────────── strain diagram ───────────────────────── */
function StrainDiagram({ hMm, dMm, cMm, et, phi }: { hMm: number; dMm: number; cMm: number; et: number; phi: number }) {
  const W = 360;
  const H = 320;
  const padT = 40;
  const padB = 40;
  if (!(hMm > 0) || !(cMm > 0) || !Number.isFinite(et)) {
    return <div className="flx-canvas flx-canvas--empty">Run a section to see strains</div>;
  }
  const top = padT;
  const bot = H - padB;
  const axH = bot - top;
  const yOf = (depthMm: number) => top + (depthMm / hMm) * axH; // depth from top
  const naY = yOf(cMm);
  const steelY = yOf(dMm);

  const baseX = 120; // zero-strain vertical line
  const sCu = 90; // px width for εcu = 0.003
  const xCu = baseX - (0.003 / 0.003) * sCu; // compression to the left
  const xEt = baseX + (et / 0.003) * sCu; // tension to the right (scaled vs εcu)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="flx-svg" role="img" aria-label="Strain diagram">
      <title>Strain diagram — εt = {et.toFixed(4)}, φ = {phi.toFixed(3)}</title>
      {/* section edges */}
      <line x1={baseX} y1={top} x2={baseX} y2={bot} stroke="#6b7280" strokeWidth={1} />
      <line x1={baseX - 8} y1={top} x2={baseX + 8} y2={top} stroke="#9aa3ad" strokeWidth={1.4} />
      <line x1={baseX - 8} y1={bot} x2={baseX + 8} y2={bot} stroke="#9aa3ad" strokeWidth={1.4} />
      {/* strain triangle: εcu at top, 0 at N.A., εt at steel */}
      <polygon points={`${baseX},${top} ${xCu},${top} ${baseX},${naY}`} fill="rgba(118,182,201,0.30)" stroke="#76b6c9" strokeWidth={1.2} />
      <polygon points={`${baseX},${naY} ${xEt},${steelY} ${baseX},${steelY}`} fill="rgba(95,182,116,0.28)" stroke="#5fb674" strokeWidth={1.2} />
      {/* neutral axis */}
      <line x1={baseX - 100} y1={naY} x2={baseX + 120} y2={naY} stroke="#c9a84c" strokeWidth={1} strokeDasharray="5 4" />
      <text x={baseX - 96} y={naY - 5} className="flx-dim" fill="#c9a84c">N.A.</text>
      {/* labels */}
      <text x={xCu - 4} y={top - 8} textAnchor="end" className="flx-dim" fill="#76b6c9">εcu = 0.003</text>
      <text x={xEt + 6} y={steelY + 4} className="flx-dim" fill="#2f8a52">εt = {et.toFixed(4)}</text>
      <text x={baseX + 6} y={bot + 24} className="flx-dim">steel (d = {Math.round(dMm)} mm)</text>
    </svg>
  );
}

/* ───────────────────────── main ───────────────────────── */
export function FlexureCalculator() {
  const [mode, setMode] = useState<Mode>('design');

  // shared section
  const [b, setB] = useState(0.25);
  const [h, setH] = useState(0.5);
  const [rCm, setRCm] = useState(3);
  const [fy, setFy] = useState(420);
  const [fc, setFc] = useState(21);

  // design
  const [Mu, setMu] = useState(200);
  const [barIdx, setBarIdx] = useState(7); // Ø22
  const [barCount, setBarCount] = useState(4);

  // analysis
  const [asAnalysis, setAsAnalysis] = useState(26);

  const inp: SectionInputs = { b, h, rCm, fy, fc };
  const dMm = effectiveDepth(h, rCm) * 1000;

  const design = useMemo(() => designFlexure(inp, Mu), [b, h, rCm, fy, fc, Mu]);
  const bar = BAR_TABLE[barIdx];
  const asProvided = bar.areaCm2 * barCount;
  const verify = useMemo(() => capacityFromAs(inp, asProvided), [b, h, rCm, fy, fc, asProvided]);
  const analysis = useMemo(() => capacityFromAs(inp, asAnalysis), [b, h, rCm, fy, fc, asAnalysis]);

  // design verdict
  const asOk = asProvided >= design.asReqCm2;
  const designPass = asOk && verify.accepted && verify.phiMnKNm >= Mu;
  // analysis verdict
  const analysisPass = analysis.accepted && analysis.aboveMin;

  return (
    <div className="flx">
      {/* sheet header */}
      <div className="flx-sheethead">
        <div>
          <div className="flx-brand">TERCERO TABLADA</div>
          <div className="flx-brand-sub">Civil &amp; Structural Engineering Inc.</div>
        </div>
        <div className="flx-sheettitle">
          <strong>{mode === 'design' ? 'FLEXURAL DESIGN (singly reinforced)' : 'FLEXURAL ANALYSIS'}</strong>
          <span className="flx-code">ACI 318-25</span>
        </div>
      </div>

      {/* mode toggle */}
      <div className="flx-modes" role="tablist" aria-label="Calculation mode">
        <button type="button" role="tab" aria-selected={mode === 'design'} className={`flx-mode ${mode === 'design' ? 'is-active' : ''}`} onClick={() => setMode('design')}>
          1 · Design (find steel from Mu)
        </button>
        <button type="button" role="tab" aria-selected={mode === 'analysis'} className={`flx-mode ${mode === 'analysis' ? 'is-active' : ''}`} onClick={() => setMode('analysis')}>
          2 · Analysis (capacity φMn from As)
        </button>
      </div>

      <div className="flx-grid">
        {/* ── left: inputs ── */}
        <div className="flx-col">
          <h3 className="flx-h">1 · Inputs</h3>
          <div className="flx-fields">
            <Num label="b — section base" unit="m" value={b} onChange={setB} hint="1.0 m for walls/slabs" />
            <Num label="h — total height" unit="m" value={h} onChange={setH} />
            <Num label="r — cover to steel centroid" unit="cm" value={rCm} onChange={setRCm} />
            <Num label="fy — steel yield" unit="MPa" value={fy} onChange={setFy} hint="Gr.60 = 420" />
            <Num label="f′c — concrete strength" unit="MPa" value={fc} onChange={setFc} />
            {mode === 'design' ? (
              <Num label="Mu — ultimate moment" unit="kN·m" value={Mu} onChange={setMu} hint="from 1.2D + 1.6L" />
            ) : (
              <Num label="As — placed steel" unit="cm²" value={asAnalysis} onChange={setAsAnalysis} hint="existing steel to evaluate" />
            )}
          </div>
          <p className="flx-note">d = h − r = <strong>{num(effectiveDepth(h, rCm), 3)} m</strong> · β1 = {num(beta1(fc), 3)}</p>
        </div>

        {/* ── middle: results ── */}
        <div className="flx-col flx-col--wide">
          {mode === 'design' ? (
            <DesignResults inp={inp} Mu={Mu} d={design} barIdx={barIdx} setBarIdx={setBarIdx} barCount={barCount} setBarCount={setBarCount} asProvided={asProvided} verify={verify} asOk={asOk} pass={designPass} />
          ) : (
            <AnalysisResults a={analysis} pass={analysisPass} />
          )}
        </div>

        {/* ── right: graphics ── */}
        <div className="flx-col flx-col--draw">
          <h3 className="flx-h">{mode === 'design' ? 'Section' : 'Section + neutral axis'}</h3>
          <CrossSection
            b={b}
            h={h}
            rCm={rCm}
            nBars={mode === 'design' ? barCount : Math.max(2, Math.min(8, Math.round(asAnalysis / 3.1)))}
            cMm={mode === 'design' ? verify.cMm : analysis.cMm}
            aMm={mode === 'design' ? verify.aMm : analysis.aMm}
            barLabel={mode === 'design' ? bar.label : undefined}
          />
          <h3 className="flx-h">Strain diagram</h3>
          <StrainDiagram hMm={h * 1000} dMm={dMm} cMm={mode === 'design' ? verify.cMm : analysis.cMm} et={mode === 'design' ? verify.et : analysis.et} phi={mode === 'design' ? verify.phi : analysis.phi} />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── design results ───────────────────────── */
function DesignResults({
  inp,
  Mu,
  d,
  barIdx,
  setBarIdx,
  barCount,
  setBarCount,
  asProvided,
  verify,
  asOk,
  pass,
}: {
  inp: SectionInputs;
  Mu: number;
  d: ReturnType<typeof designFlexure>;
  barIdx: number;
  setBarIdx: (n: number) => void;
  barCount: number;
  setBarCount: (n: number) => void;
  asProvided: number;
  verify: ReturnType<typeof capacityFromAs>;
  asOk: boolean;
  pass: boolean;
}) {
  const selId = useId();
  const cntId = useId();
  return (
    <>
      {/* result banner */}
      <div className={`flx-banner ${pass ? 'is-pass' : 'is-fail'}`}>
        <div className="flx-banner__icon">{pass ? '✓' : '✗'}</div>
        <div className="flx-banner__text">
          <strong>
            {pass
              ? `OK — provide ${barCount}${BAR_TABLE[barIdx].label} (As = ${num(asProvided)} cm²). φMn = ${num(verify.phiMnKNm)} ≥ Mu = ${num(Mu)} kN·m`
              : !d.feasible
                ? 'Section too small — Mu exceeds the singly-reinforced limit (increase h or use compression steel).'
                : !asOk
                  ? `Not enough steel — As provided ${num(asProvided)} cm² < required ${num(d.asReqCm2)} cm².`
                  : !verify.accepted
                    ? `Not ductile — εt = ${verify.et.toFixed(4)} < 0.004. Reduce steel or deepen the section.`
                    : `φMn = ${num(verify.phiMnKNm)} kN·m < Mu = ${num(Mu)} kN·m.`}
          </strong>
        </div>
      </div>

      <h3 className="flx-h">2–4 · Required steel</h3>
      <div className="ab-table-scroll">
        <table className="flx-table">
          <tbody>
            <R k="Rn = Mu/(0.9·b·d²)" v={num(d.Rn, 3)} unit="MPa" />
            <R k="ρ required" v={num(d.rho, 5)} ref="(0.85f′c/fy)(1−√(1−2Rn/0.85f′c))" />
            <R k="ρmin = 1.4/fy" v={num(d.rhoMin1, 5)} ref="ACI 9.6.1.2" />
            <R k="ρmin alt = (4/3)·ρ" v={num(d.rhoMin2, 5)} ref="ACI 9.6.1.3 (lesser governs)" />
            <R k="ρmax (εt = 0.005)" v={num(d.rhoMax, 5)} ref="keeps φ = 0.90" />
            <R k="ρ design = max(ρ, ρmin)" v={num(d.rhoDesign, 5)} />
            <R k="As required = ρ·b·d" v={<strong>{num(d.asReqCm2)}</strong>} unit="cm²" good={d.feasible} />
            <R k="Ductile? (ρ ≤ ρmax)" v={d.ductile ? 'Yes' : 'No'} good={d.ductile} />
          </tbody>
        </table>
      </div>

      <h3 className="flx-h">5 · Pick commercial bars</h3>
      <div className="flx-barpick">
        <div className="flx-field">
          <label htmlFor={selId}>Bar size</label>
          <select id={selId} value={barIdx} onChange={(e) => setBarIdx(parseInt(e.target.value))}>
            {BAR_TABLE.map((bt, i) => (
              <option key={bt.label} value={i}>
                {bt.label} ({bt.areaCm2} cm²)
              </option>
            ))}
          </select>
        </div>
        <div className="flx-field">
          <label htmlFor={cntId}>Number of bars</label>
          <input id={cntId} type="number" min={1} max={8} step={1} value={barCount} onChange={(e) => setBarCount(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))} />
        </div>
        <div className="flx-asprov">
          <span>As provided</span>
          <strong className={asOk ? 'flx-good' : 'flx-bad'}>{num(asProvided)} cm²</strong>
          <small>need ≥ {num(d.asReqCm2)} cm²</small>
        </div>
      </div>

      <h3 className="flx-h">6 · Verify the placed steel</h3>
      <div className="ab-table-scroll">
        <table className="flx-table">
          <tbody>
            <R k="As placed ≥ required?" v={asOk ? 'Yes' : 'No'} good={asOk} />
            <R k="a (stress block) = As·fy/(0.85f′c·b)" v={num(verify.aMm, 1)} unit="mm" />
            <R k="c (neutral axis) = a/β1" v={num(verify.cMm, 1)} unit="mm" />
            <R k="εt = (d−c)/c · 0.003" v={verify.et.toFixed(4)} good={verify.accepted} ref="≥ 0.004 to accept" />
            <R k="φ (transition, capped)" v={num(verify.phi, 3)} ref="Table 21.2.2" />
            <R k="Mn = b·d²·fy·ρ(1−ρfy/1.7f′c)" v={num(verify.MnKNm)} unit="kN·m" />
            <R k="φMn (capacity)" v={<strong>{num(verify.phiMnKNm)}</strong>} unit="kN·m" good={verify.phiMnKNm >= Mu} ref={`vs Mu = ${num(Mu)}`} />
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ───────────────────────── analysis results ───────────────────────── */
function AnalysisResults({ a, pass }: { a: ReturnType<typeof capacityFromAs>; pass: boolean }) {
  const verdict =
    a.et < 0.004
      ? 'Not acceptable — εt < 0.004 (too brittle).'
      : a.et < 0.005
        ? `Transition zone — φ = ${num(a.phi, 3)} (< 0.90).`
        : 'Tension-controlled — φ = 0.90 (ideal).';
  return (
    <>
      <div className={`flx-banner ${pass ? 'is-pass' : 'is-fail'}`}>
        <div className="flx-banner__icon">{pass ? '✓' : '✗'}</div>
        <div className="flx-banner__text">
          <strong>Design strength φMn = {num(a.phiMnKNm)} kN·m</strong>
          <span className="flx-banner__sub">{verdict}</span>
        </div>
      </div>

      <h3 className="flx-h">2 · Reinforcement ratio</h3>
      <div className="ab-table-scroll">
        <table className="flx-table">
          <tbody>
            <R k="ρ = As/(b·d)" v={num(a.rho, 5)} />
            <R k="ρmin = 1.4/fy" v={num(a.rhoMin, 5)} ref="ACI 9.6.1.2" />
            <R k="ρmax (εt = 0.005)" v={num(a.rhoMax, 5)} />
            <R k="ρ ≥ ρmin?" v={a.aboveMin ? 'Yes' : 'No'} good={a.aboveMin} />
          </tbody>
        </table>
      </div>

      <h3 className="flx-h">3–4 · Neutral axis &amp; φ</h3>
      <div className="ab-table-scroll">
        <table className="flx-table">
          <tbody>
            <R k="β1" v={num(a.beta1, 3)} ref="Table 22.2.2.4.3" />
            <R k="a (stress block) = As·fy/(0.85f′c·b)" v={num(a.aMm, 1)} unit="mm" />
            <R k="c (neutral axis) = a/β1" v={num(a.cMm, 1)} unit="mm" />
            <R k="εt = (d−c)/c · 0.003" v={a.et.toFixed(4)} good={a.accepted} ref="≥ 0.004 to accept" />
            <R k="φ (transition, capped)" v={num(a.phi, 3)} ref="0.65 → 0.90" />
          </tbody>
        </table>
      </div>

      <h3 className="flx-h">5 · Resisting moment</h3>
      <div className="ab-table-scroll">
        <table className="flx-table">
          <tbody>
            <R k="Mn = b·d²·fy·ρ(1−ρfy/1.7f′c)" v={num(a.MnKNm)} unit="kN·m" />
            <R k="φMn (design strength)" v={<strong>{num(a.phiMnKNm)}</strong>} unit="kN·m" good={a.accepted} />
          </tbody>
        </table>
      </div>
    </>
  );
}
