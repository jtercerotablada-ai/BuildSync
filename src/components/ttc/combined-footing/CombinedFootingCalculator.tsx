'use client';

import React, { useReducer, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { analyzeCombinedFooting } from '@/lib/combined-footing/solver';
import { COMBINED_FOOTING_PRESETS } from '@/lib/combined-footing/presets';
import { buildCombinedCheckSummary, formatRatio } from '@/lib/combined-footing/format';
import type { CombinedFootingInput, CombinedColumn } from '@/lib/combined-footing/types';
import type { ColumnShape, ReportBranding } from '@/lib/footing/types';
import { CombinedFootingPlan2D } from './CombinedFootingPlan2D';
import { CombinedFootingSection2D } from './CombinedFootingSection2D';
import { CombinedFootingPrintReport } from './CombinedFootingPrintReport';
import { autoDesignCombinedFooting } from '@/lib/combined-footing/autoDesign';

// Dynamic import for the 3D viewer (R3F) — client-only
const CombinedFooting3D = dynamic(
  () => import('./CombinedFooting3D').then((m) => m.CombinedFooting3D),
  { ssr: false, loading: () => <div className="rc-3d slab-3d"><p style={{ padding: '2rem', textAlign: 'center' }}>Loading 3D viewer…</p></div> },
);

type Code = 'ACI 318-25' | 'ACI 318-19';
type Tab = 'inputs' | 'auto' | 'drawings' | 'beam' | '3d' | 'checks' | 'refs';

type Action =
  | { type: 'LOAD_PRESET'; input: CombinedFootingInput }
  | { type: 'SET_CODE'; code: Code }
  | { type: 'SET_GEOM'; patch: Partial<CombinedFootingInput['geometry']> }
  | { type: 'SET_SOIL'; patch: Partial<CombinedFootingInput['soil']> }
  | { type: 'SET_MAT'; patch: Partial<CombinedFootingInput['materials']> }
  | { type: 'SET_COL'; which: 1 | 2; patch: Partial<CombinedColumn> }
  | { type: 'SET_REINF'; patch: Partial<CombinedFootingInput['reinforcement']> }
  | { type: 'SET_BRANDING'; patch: Partial<ReportBranding> }
  | { type: 'CLEAR_BRANDING' };

function reducer(state: CombinedFootingInput, action: Action): CombinedFootingInput {
  switch (action.type) {
    case 'LOAD_PRESET':
      return action.input;
    case 'SET_CODE':
      return { ...state, code: action.code };
    case 'SET_GEOM':
      return { ...state, geometry: { ...state.geometry, ...action.patch } };
    case 'SET_SOIL':
      return { ...state, soil: { ...state.soil, ...action.patch } };
    case 'SET_MAT':
      return { ...state, materials: { ...state.materials, ...action.patch } };
    case 'SET_COL':
      return action.which === 1
        ? { ...state, column1: { ...state.column1, ...action.patch } }
        : { ...state, column2: { ...state.column2, ...action.patch } };
    case 'SET_REINF':
      return { ...state, reinforcement: { ...state.reinforcement, ...action.patch } };
    case 'SET_BRANDING':
      return { ...state, branding: { ...(state.branding ?? {}), ...action.patch } };
    case 'CLEAR_BRANDING': {
      const { branding: _, ...rest } = state;
      void _;
      return rest as CombinedFootingInput;
    }
    default:
      return state;
  }
}

export function CombinedFootingCalculator() {
  const [model, dispatch] = useReducer(reducer, undefined as unknown, () =>
    COMBINED_FOOTING_PRESETS[0].build()
  );
  const result = useMemo(() => analyzeCombinedFooting(model), [model]);
  const summary = buildCombinedCheckSummary(result);
  const [tab, setTab] = useState<Tab>('inputs');
  const [cover3dDataUrl, setCover3dDataUrl] = useState<string | undefined>();

  // Capture the current 3D viewer canvas as a data URL for the print cover
  const captureCover3d = useCallback(() => {
    const canvas = document.querySelector('.slab-3d__canvas canvas') as HTMLCanvasElement | null;
    if (canvas) {
      try { setCover3dDataUrl(canvas.toDataURL('image/png')); } catch { /* CORS — ignore */ }
    }
  }, []);

  const handlePrint = useCallback(() => {
    captureCover3d();
    setTimeout(() => window.print(), 80);
  }, [captureCover3d]);

  return (
    <div className="ab-section">
      {/* Topbar with presets + code selector */}
      <section className="slab-topbar">
        <div className="slab-topbar__group">
          <label>Preset</label>
          <select
            onChange={(e) => {
              const p = COMBINED_FOOTING_PRESETS[parseInt(e.target.value, 10)];
              if (p) dispatch({ type: 'LOAD_PRESET', input: p.build() });
            }}
            defaultValue="0"
          >
            {COMBINED_FOOTING_PRESETS.map((p, i) => (
              <option key={i} value={i.toString()}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="slab-topbar__group">
          <label>Code</label>
          <select
            value={model.code}
            onChange={(e) => dispatch({ type: 'SET_CODE', code: e.target.value as Code })}
          >
            <option value="ACI 318-25">ACI 318-25 (SI)</option>
            <option value="ACI 318-19">ACI 318-19</option>
          </select>
        </div>
        <div className="slab-topbar__group">
          <label>Footing</label>
          <span className="ab-label">
            {(model.geometry.L / 1000).toFixed(2)} × {(model.geometry.B / 1000).toFixed(2)} × {(model.geometry.T / 1000).toFixed(2)} m
          </span>
        </div>
        <div className="slab-topbar__group">
          <label>Overall</label>
          <span className={`ab-label ${result.ok ? 'ab-pass' : 'ab-fail'}`}>
            {result.ok ? '✓ PASS' : '✗ FAIL'}
          </span>
        </div>
        <button type="button" className="ab-btn ab-btn--primary slab-print-btn" onClick={handlePrint}>
          ⎙ Print full report
        </button>
      </section>

      {/* Print-only report (hidden on screen).  Triggered by handlePrint(). */}
      <CombinedFootingPrintReport input={model} result={result} cover3dDataUrl={cover3dDataUrl} />

      {/* Status banner */}
      <section className={`rc-status ${result.ok ? 'rc-status--pass' : 'rc-status--fail'}`}>
        <div className="rc-status__icon">{result.ok ? '✓' : '✗'}</div>
        <div className="rc-status__text">
          <strong>
            {result.ok
              ? <>Combined footing OK — q<sub>max</sub> = {result.bearing.q_max.toFixed(1)} kPa, {summary.filter((s) => s.ok).length}/{summary.length} checks pass</>
              : `Combined footing FAILS — ${result.warnings.length} issue(s)`}
          </strong>
          <span className="rc-status__es">
            qnu = {result.qnu.toFixed(1)} kPa · |Mu−| = {Math.abs(result.beam.Mu_neg_max).toFixed(1)} kN·m · Mu+ = {result.beam.Mu_pos_max.toFixed(1)} kN·m
          </span>
        </div>
      </section>

      {/* Tab nav */}
      <nav className="ab-tabs" aria-label="Combined footing tabs">
        {([
          ['inputs', 'Inputs'],
          ['auto', 'Auto-design'],
          ['drawings', 'Drawings'],
          ['beam', 'Beam analysis'],
          ['3d', '3D'],
          ['checks', 'Checks'],
          ['refs', 'References'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`ab-tab ${tab === id ? 'ab-tab--active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      {tab === 'inputs' && <InputsTab model={model} dispatch={dispatch} />}
      {tab === 'auto' && <AutoDesignTab model={model} dispatch={dispatch} />}
      {tab === 'drawings' && <DrawingsTab input={model} result={result} />}
      {tab === 'beam' && <BeamTab result={result} />}
      {tab === '3d' && <CombinedFooting3D input={model} result={result} />}
      {tab === 'checks' && <ChecksTab summary={summary} />}
      {tab === 'refs' && <RefsTab />}

      {result.warnings.length > 0 && (
        <div className="slab-card" style={{ borderColor: 'rgba(201,168,76,0.55)', marginTop: '1rem' }}>
          <h4>Warnings</h4>
          <ul>
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── INPUTS TAB ────────────────────────────────────────────────────────────

function InputsTab({
  model,
  dispatch,
}: {
  model: CombinedFootingInput;
  dispatch: React.Dispatch<Action>;
}) {
  return (
    <div className="slab-inputs-grid">
      {/* Geometry */}
      <div className="slab-card">
        <h4>Footing geometry (mm)</h4>
        <div className="slab-fields">
          <Field label="L — longitudinal length (mm)">
            <Num val={model.geometry.L} step={100}
              onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { L: v } })} />
          </Field>
          <Field label="B — transverse width (mm)">
            <Num val={model.geometry.B} step={100}
              onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { B: v } })} />
          </Field>
          <Field label="T — thickness (mm)">
            <Num val={model.geometry.T} step={25}
              onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { T: v } })} />
          </Field>
          <Field label="Clear cover (mm)">
            <Num val={model.geometry.coverClear} step={5}
              onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { coverClear: v } })} />
          </Field>
          <Field label="Embedment (mm)">
            <Num val={model.geometry.embedment ?? 0} step={50}
              onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { embedment: v } })} />
          </Field>
        </div>
      </div>

      {/* Soil */}
      <div className="slab-card">
        <h4>Soil</h4>
        <div className="slab-fields">
          <Field label="qa — allowable bearing (kPa)">
            <Num val={model.soil.qa} step={10}
              onChange={(v) => dispatch({ type: 'SET_SOIL', patch: { qa: v } })} />
          </Field>
          <Field label="γs (kN/m³)">
            <Num val={model.soil.gammaSoil ?? 18} step={1}
              onChange={(v) => dispatch({ type: 'SET_SOIL', patch: { gammaSoil: v } })} />
          </Field>
          <Field label="γc (kN/m³)">
            <Num val={model.soil.gammaConcrete ?? 24} step={1}
              onChange={(v) => dispatch({ type: 'SET_SOIL', patch: { gammaConcrete: v } })} />
          </Field>
        </div>
      </div>

      {/* Materials */}
      <div className="slab-card">
        <h4>Materials (MPa)</h4>
        <div className="slab-fields">
          <Field label="f′c">
            <Num val={model.materials.fc} step={1}
              onChange={(v) => dispatch({ type: 'SET_MAT', patch: { fc: v } })} />
          </Field>
          <Field label="fy">
            <Num val={model.materials.fy} step={5}
              onChange={(v) => dispatch({ type: 'SET_MAT', patch: { fy: v } })} />
          </Field>
          <Field label="λ (lightweight)">
            <Num val={model.materials.lambdaC ?? 1.0} step={0.05}
              onChange={(v) => dispatch({ type: 'SET_MAT', patch: { lambdaC: v } })} />
          </Field>
        </div>
      </div>

      {/* Column 1 */}
      <ColumnCard which={1} col={model.column1} dispatch={dispatch} />

      {/* Column 2 */}
      <ColumnCard which={2} col={model.column2} dispatch={dispatch} />

      {/* Reinforcement */}
      <div className="slab-card">
        <h4>Reinforcement</h4>
        <div className="slab-fields">
          <Field label="Bottom-long bar">
            <input type="text" value={model.reinforcement.bottomLong.bar}
              onChange={(e) => dispatch({ type: 'SET_REINF', patch: { bottomLong: { ...model.reinforcement.bottomLong, bar: e.target.value } } })} />
          </Field>
          <Field label="Bottom-long count">
            <Num val={model.reinforcement.bottomLong.count} step={1}
              onChange={(v) => dispatch({ type: 'SET_REINF', patch: { bottomLong: { ...model.reinforcement.bottomLong, count: v } } })} />
          </Field>
          <Field label="Top-long bar">
            <input type="text" value={model.reinforcement.topLong?.bar ?? '#7'}
              onChange={(e) => dispatch({ type: 'SET_REINF', patch: { topLong: { bar: e.target.value, count: model.reinforcement.topLong?.count ?? 10 } } })} />
          </Field>
          <Field label="Top-long count">
            <Num val={model.reinforcement.topLong?.count ?? 10} step={1}
              onChange={(v) => dispatch({ type: 'SET_REINF', patch: { topLong: { bar: model.reinforcement.topLong?.bar ?? '#7', count: v } } })} />
          </Field>
          <Field label="Bottom-trans bar">
            <input type="text" value={model.reinforcement.bottomTrans.bar}
              onChange={(e) => dispatch({ type: 'SET_REINF', patch: { bottomTrans: { ...model.reinforcement.bottomTrans, bar: e.target.value } } })} />
          </Field>
          <Field label="Bottom-trans count">
            <Num val={model.reinforcement.bottomTrans.count} step={1}
              onChange={(v) => dispatch({ type: 'SET_REINF', patch: { bottomTrans: { ...model.reinforcement.bottomTrans, count: v } } })} />
          </Field>
        </div>
      </div>

      {/* Print branding (logo + company) */}
      <div className="slab-card">
        <h4>Print branding (your firm)</h4>
        <p className="ab-empty" style={{ marginBottom: '0.6rem', fontSize: '0.86rem' }}>
          Optional. Logo + company name + tagline appear on the print-report cover page.
        </p>
        <div className="slab-fields">
          <Field label="Company name">
            <input type="text"
              value={model.branding?.companyName ?? ''}
              placeholder="e.g. Tercero Tablada Civil & Structural Eng. Inc"
              onChange={(e) => dispatch({ type: 'SET_BRANDING', patch: { companyName: e.target.value } })} />
          </Field>
          <Field label="Tagline / project ref">
            <input type="text"
              value={model.branding?.companyTagline ?? ''}
              placeholder="e.g. Project 24-117 — Combined footing F-1"
              onChange={(e) => dispatch({ type: 'SET_BRANDING', patch: { companyTagline: e.target.value } })} />
          </Field>
          <Field label="Logo (PNG/SVG)">
            <input type="file" accept="image/png,image/jpeg,image/svg+xml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  if (typeof ev.target?.result === 'string') {
                    dispatch({ type: 'SET_BRANDING', patch: { logoDataUrl: ev.target.result } });
                  }
                };
                reader.readAsDataURL(file);
              }} />
          </Field>
          {model.branding?.logoDataUrl && (
            <div className="ab-input-group">
              <span>Logo preview</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={model.branding.logoDataUrl} alt="logo"
                  style={{ maxWidth: 96, maxHeight: 64, background: 'rgba(255,255,255,0.95)',
                           padding: 4, borderRadius: 4 }} />
                <button type="button" className="ab-btn ab-btn--small"
                  onClick={() => dispatch({ type: 'CLEAR_BRANDING' })}>
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DRAWINGS TAB (Plan + Section) ──────────────────────────────────────────

// ─── AUTO-DESIGN TAB ───────────────────────────────────────────────────────

function AutoDesignTab({
  model, dispatch,
}: {
  model: CombinedFootingInput;
  dispatch: React.Dispatch<Action>;
}) {
  const [aspect, setAspect] = useState(2.5);
  const [recommendation, setRecommendation] = useState<ReturnType<typeof autoDesignCombinedFooting> | null>(null);

  const handleRun = () => {
    const r = autoDesignCombinedFooting(model, { aspect, designForOverturning: true });
    setRecommendation(r);
  };
  const handleApply = () => {
    if (recommendation) dispatch({ type: 'LOAD_PRESET', input: recommendation.patchedInput });
  };

  return (
    <div className="slab-card" style={{ borderColor: 'rgba(127,182,145,0.55)' }}>
      <h4>Auto-Design Combined Footing (sizes L, B, T + picks rebar)</h4>
      <p className="ab-empty" style={{ marginBottom: '0.6rem' }}>
        Given the two columns + their service loads, soil (qa), and materials, the
        auto-design driver iteratively sizes the footing length L (centroid on the load
        resultant for uniform pressure), width B (from required area), and thickness T
        (until punching + 1-way shear pass), then picks bottom-long, top-long, and
        bottom-trans rebar. {model.code} references throughout.
      </p>
      <div className="slab-fields" style={{ marginBottom: '0.6rem' }}>
        <Field label="L/B aspect (target)">
          <Num val={aspect} step={0.1}
            onChange={(v) => setAspect(Math.max(1.5, Math.min(4, v)))} />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <button type="button" className="ab-btn ab-btn--primary" onClick={handleRun}>
          Run Auto-Design
        </button>
        {recommendation && (
          <button type="button" className="ab-btn" onClick={handleApply}>
            Apply Recommendation
          </button>
        )}
      </div>

      {recommendation && (
        <div>
          {/* Summary chips */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
            <span className="ab-label">L = {recommendation.patchedInput.geometry.L} mm</span>
            <span className="ab-label">B = {recommendation.patchedInput.geometry.B} mm</span>
            <span className="ab-label">T = {recommendation.patchedInput.geometry.T} mm</span>
            <span className="ab-label">
              Bot-long: {recommendation.patchedInput.reinforcement.bottomLong.count} {recommendation.patchedInput.reinforcement.bottomLong.bar}
            </span>
            {recommendation.patchedInput.reinforcement.topLong && (
              <span className="ab-label">
                Top-long: {recommendation.patchedInput.reinforcement.topLong.count} {recommendation.patchedInput.reinforcement.topLong.bar}
              </span>
            )}
            <span className="ab-label">
              Bot-trans: {recommendation.patchedInput.reinforcement.bottomTrans.count} {recommendation.patchedInput.reinforcement.bottomTrans.bar}
            </span>
            <span className={`ab-label ${recommendation.ok ? 'ab-pass' : 'ab-fail'}`}>
              {recommendation.ok ? '✓ All checks pass' : '⚠ Some checks need review'}
            </span>
          </div>

          {/* Rationale */}
          <div className="ab-table-scroll">
            <table className="ab-result-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr><th>Step</th><th>Formula</th><th>Substitution</th><th>Result</th></tr>
              </thead>
              <tbody>
                {recommendation.rationaleSteps.map((s, i) => (
                  <tr key={i}>
                    <td><strong>{s.title}</strong></td>
                    <td><code>{s.formula}</code></td>
                    <td><small>{s.substitution}</small></td>
                    <td>{s.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {recommendation.warnings.length > 0 && (
            <ul style={{ marginTop: '0.6rem', color: '#c9a84c' }}>
              {recommendation.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function DrawingsTab({
  input, result,
}: {
  input: CombinedFootingInput; result: ReturnType<typeof analyzeCombinedFooting>;
}) {
  return (
    <div className="slab-inputs-grid">
      <div className="slab-card" style={{ gridColumn: 'span 2' }}>
        <h4>Plan view (top-down)</h4>
        <CombinedFootingPlan2D input={input} result={result} />
      </div>
      <div className="slab-card" style={{ gridColumn: 'span 2' }}>
        <h4>Section A-A (longitudinal, through both columns)</h4>
        <CombinedFootingSection2D input={input} result={result} />
      </div>
    </div>
  );
}

function ColumnCard({
  which, col, dispatch,
}: {
  which: 1 | 2;
  col: CombinedColumn;
  dispatch: React.Dispatch<Action>;
}) {
  return (
    <div className="slab-card">
      <h4>Column {which} {which === 1 ? '(typically exterior)' : '(typically interior)'}</h4>
      <div className="slab-fields">
        <Field label="Shape">
          <select value={col.shape}
            onChange={(e) => dispatch({ type: 'SET_COL', which, patch: { shape: e.target.value as ColumnShape } })}>
            <option value="square">Square</option>
            <option value="rectangular">Rectangular</option>
            <option value="circular">Circular</option>
          </select>
        </Field>
        <Field label={col.shape === 'circular' ? 'Diameter (mm)' : 'cl — along L (mm)'}>
          <Num val={col.cl} step={25}
            onChange={(v) => dispatch({ type: 'SET_COL', which, patch: { cl: v } })} />
        </Field>
        {col.shape === 'rectangular' && (
          <Field label="ct — along B (mm)">
            <Num val={col.ct ?? col.cl} step={25}
              onChange={(v) => dispatch({ type: 'SET_COL', which, patch: { ct: v } })} />
          </Field>
        )}
        <Field label="PD (kN)">
          <Num val={col.PD} step={50}
            onChange={(v) => dispatch({ type: 'SET_COL', which, patch: { PD: v } })} />
        </Field>
        <Field label="PL (kN)">
          <Num val={col.PL} step={50}
            onChange={(v) => dispatch({ type: 'SET_COL', which, patch: { PL: v } })} />
        </Field>
        <Field label="Position along L (mm)">
          <Num val={col.position} step={50}
            onChange={(v) => dispatch({ type: 'SET_COL', which, patch: { position: v } })} />
        </Field>
        <Field label="Location (αs)">
          <select value={col.columnLocation ?? 'interior'}
            onChange={(e) => dispatch({ type: 'SET_COL', which, patch: { columnLocation: e.target.value as 'interior' | 'edge' | 'corner' } })}>
            <option value="interior">Interior (αs = 40)</option>
            <option value="edge">Edge (αs = 30)</option>
            <option value="corner">Corner (αs = 20)</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

// ─── BEAM TAB (BMD/SFD) ─────────────────────────────────────────────────────

function BeamTab({ result }: { result: ReturnType<typeof analyzeCombinedFooting> }) {
  const W = 900, H = 460;
  const padX = 80, padTop = 40;
  const beamH = 100, sfdH = 130, bmdH = 130;

  const beam = result.beam;
  const L_mm = result.input.geometry.L;
  const xc1 = (result.input.column1.position - (result.input.geometry.leftEdge ?? 0));
  const xc2 = (result.input.column2.position - (result.input.geometry.leftEdge ?? 0));

  const sxScale = (W - 2 * padX) / L_mm;
  const beamY = padTop;

  // SFD scale
  const Vmax = Math.max(...beam.bmd.map((p) => Math.abs(p.V)), 1);
  const sfdScale = sfdH / 2 / Vmax;
  const sfdY0 = padTop + beamH + 30 + sfdH / 2;

  // BMD scale
  const Mmax = Math.max(...beam.bmd.map((p) => Math.abs(p.M)), 1);
  const bmdScale = bmdH / 2 / Mmax;
  const bmdY0 = sfdY0 + sfdH / 2 + 30 + bmdH / 2;

  return (
    <div className="slab-card" style={{ marginTop: '1rem' }}>
      <h4>Longitudinal beam analysis (BMD / SFD)</h4>
      <p className="ab-empty" style={{ marginBottom: '0.6rem', fontSize: '0.86rem' }}>
        Soil pressure (factored, qnu = {result.qnu.toFixed(1)} kPa) acts as an UPWARD distributed
        load on the beam (wu = {beam.wu.toFixed(1)} kN/m). Column reactions act DOWNWARD
        (Pu1 = {beam.Pu1.toFixed(1)}, Pu2 = {beam.Pu2.toFixed(1)} kN). Convention: positive M = bottom
        tension (sagging). Between columns the beam curves concave-down → top tension, MUmax_neg.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
           xmlns="http://www.w3.org/2000/svg"
           style={{ width: '100%', maxWidth: '100%', height: 'auto',
                    background: 'rgba(20, 20, 20, 0.5)', borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Beam diagram */}
        <rect x={padX} y={beamY} width={L_mm * sxScale} height={beamH}
              fill="rgba(180,180,180,0.10)" stroke="#c9a84c" strokeWidth="1.5" />
        {/* Distributed upward load arrows */}
        {Array.from({ length: 12 }, (_, i) => {
          const x = padX + (i + 0.5) * (L_mm * sxScale) / 12;
          return (
            <g key={`arrow-${i}`}>
              <line x1={x} y1={beamY + beamH + 8} x2={x} y2={beamY + beamH + 22}
                    stroke="#76b6c9" strokeWidth="1" />
              <polygon points={`${x - 3},${beamY + beamH + 12} ${x + 3},${beamY + beamH + 12} ${x},${beamY + beamH + 6}`}
                       fill="#76b6c9" />
            </g>
          );
        })}
        <text x={padX + L_mm * sxScale / 2} y={beamY + beamH + 36} textAnchor="middle"
              fontSize="10" fill="#76b6c9">
          wu = {beam.wu.toFixed(1)} kN/m (soil reaction, upward)
        </text>

        {/* Columns (downward) */}
        {[
          { x: xc1, P: beam.Pu1, label: 'Pu1' },
          { x: xc2, P: beam.Pu2, label: 'Pu2' },
        ].map((c) => (
          <g key={c.label}>
            <line x1={padX + c.x * sxScale} y1={beamY - 22}
                  x2={padX + c.x * sxScale} y2={beamY}
                  stroke="#ff8a72" strokeWidth="2" />
            <polygon points={`${padX + c.x * sxScale - 4},${beamY - 8} ${padX + c.x * sxScale + 4},${beamY - 8} ${padX + c.x * sxScale},${beamY}`}
                     fill="#ff8a72" />
            <text x={padX + c.x * sxScale} y={beamY - 26} textAnchor="middle"
                  fontSize="10" fontWeight="700" fill="#ff8a72">
              {c.label} = {c.P.toFixed(0)} kN
            </text>
          </g>
        ))}

        {/* SFD */}
        <text x={padX} y={sfdY0 - sfdH / 2 - 8} fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.85)">
          SHEAR (kN)
        </text>
        <line x1={padX} y1={sfdY0} x2={padX + L_mm * sxScale} y2={sfdY0}
              stroke="#cbd5e1" strokeWidth="0.7" />
        {/* SFD polyline */}
        <polyline
          fill="none"
          stroke="#76b6c9"
          strokeWidth="1.5"
          points={beam.bmd.map((p) => `${padX + p.x * sxScale},${sfdY0 - p.V * sfdScale}`).join(' ')}
        />

        {/* BMD */}
        <text x={padX} y={bmdY0 - bmdH / 2 - 8} fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.85)">
          MOMENT (kN·m) — note: M&lt;0 = top tension (between columns)
        </text>
        <line x1={padX} y1={bmdY0} x2={padX + L_mm * sxScale} y2={bmdY0}
              stroke="#cbd5e1" strokeWidth="0.7" />
        {/* BMD polyline */}
        <polyline
          fill="none"
          stroke="#ff8a72"
          strokeWidth="1.5"
          points={beam.bmd.map((p) => `${padX + p.x * sxScale},${bmdY0 - p.M * bmdScale}`).join(' ')}
        />
        {/* Mark Mu peaks */}
        <circle cx={padX + beam.x_Mu_neg_max * sxScale}
                cy={bmdY0 - beam.Mu_neg_max * bmdScale}
                r="4" fill="#ff6a55" />
        <text x={padX + beam.x_Mu_neg_max * sxScale + 8}
              y={bmdY0 - beam.Mu_neg_max * bmdScale - 4}
              fontSize="9" fill="#ff6a55" fontWeight="700">
          |Mu−| = {Math.abs(beam.Mu_neg_max).toFixed(0)}
        </text>
        <circle cx={padX + beam.x_Mu_pos_max * sxScale}
                cy={bmdY0 - beam.Mu_pos_max * bmdScale}
                r="4" fill="#7fb691" />
        <text x={padX + beam.x_Mu_pos_max * sxScale + 8}
              y={bmdY0 - beam.Mu_pos_max * bmdScale + 4}
              fontSize="9" fill="#7fb691" fontWeight="700">
          Mu+ = {beam.Mu_pos_max.toFixed(0)}
        </text>
      </svg>
    </div>
  );
}

// ─── CHECKS TAB ────────────────────────────────────────────────────────────

function ChecksTab({ summary }: { summary: ReturnType<typeof buildCombinedCheckSummary> }) {
  return (
    <div className="ab-table-scroll" style={{ marginTop: '1rem' }}>
      <table className="ab-result-table">
        <thead>
          <tr>
            <th>Check</th>
            <th>Reference</th>
            <th>Demand</th>
            <th>Capacity</th>
            <th>Ratio</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {summary.map((row, i) => (
            <tr key={i}>
              <td><strong>{row.label}</strong></td>
              <td><small>{row.ref}</small></td>
              <td>{row.demand}</td>
              <td>{row.capacity}</td>
              <td className={row.ok ? 'ab-pass' : 'ab-fail'}>{formatRatio(row.ratio)}</td>
              <td className={row.ok ? 'ab-pass' : 'ab-fail'}>
                {row.notApplicable ? 'N/A' : row.ok ? '✓' : '✗'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── REFS TAB ──────────────────────────────────────────────────────────────

function RefsTab() {
  return (
    <div className="slab-card" style={{ marginTop: '1rem' }}>
      <h4>Code references</h4>
      <ul style={{ lineHeight: 1.8, fontSize: '0.92rem' }}>
        <li><strong>ACI 318-25 §13.3.4</strong> — Two-way combined footings and mat foundations</li>
        <li><strong>ACI 318-25 §13.3.4.3</strong> — Design methods (factored loads / strength reduction) regardless of bearing pressure distribution</li>
        <li><strong>ACI 318-25 §22.6.4 / Table 22.6.5.2</strong> — Two-way (punching) shear at each column</li>
        <li><strong>ACI 318-25 §22.5.5.1</strong> — One-way shear in the longitudinal beam</li>
        <li><strong>ACI 318-25 §13.3.3 / §9.3</strong> — Longitudinal flexure (positive at cantilever, negative between columns)</li>
        <li><strong>ACI 318-25 §15-6 (Wight)</strong> — Transverse "crossbeam" idealisation under each column</li>
        <li><strong>Wight & MacGregor 7e §15-6 Example 15-5</strong> — Cross-validated within 3% on bo, vc, Vu, |Mu−|, Mu+</li>
      </ul>
    </div>
  );
}

// ─── HELPERS ───────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="ab-input-group">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Num({ val, step, onChange }: { val: number; step: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      step={step}
      value={val}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    />
  );
}
