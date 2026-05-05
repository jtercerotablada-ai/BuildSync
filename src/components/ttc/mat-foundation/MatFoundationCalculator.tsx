'use client';

import React, { useReducer, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { analyzeMatFoundation } from '@/lib/mat-foundation/solver';
import { MAT_FOUNDATION_PRESETS } from '@/lib/mat-foundation/presets';
import { buildMatCheckSummary, formatRatio } from '@/lib/mat-foundation/format';
import type { MatFoundationInput, MatColumn } from '@/lib/mat-foundation/types';
import type { ColumnShape, ReportBranding } from '@/lib/footing/types';
import { MatFoundationSection2D } from './MatFoundationSection2D';
import { MatFoundationPrintReport } from './MatFoundationPrintReport';
import { autoDesignMatFoundation } from '@/lib/mat-foundation/autoDesign';

const MatFoundation3D = dynamic(
  () => import('./MatFoundation3D').then((m) => m.MatFoundation3D),
  { ssr: false, loading: () => <div className="rc-3d slab-3d"><p style={{ padding: '2rem', textAlign: 'center' }}>Loading 3D viewer…</p></div> },
);

type Code = 'ACI 318-25' | 'ACI 318-19';
type Tab = 'inputs' | 'auto' | 'plan' | 'sections' | '3d' | 'checks' | 'refs';

type Action =
  | { type: 'LOAD_PRESET'; input: MatFoundationInput }
  | { type: 'SET_CODE'; code: Code }
  | { type: 'SET_GEOM'; patch: Partial<MatFoundationInput['geometry']> }
  | { type: 'SET_SOIL'; patch: Partial<MatFoundationInput['soil']> }
  | { type: 'SET_MAT'; patch: Partial<MatFoundationInput['materials']> }
  | { type: 'SET_COL'; idx: number; patch: Partial<MatColumn> }
  | { type: 'ADD_COL' }
  | { type: 'REMOVE_COL'; idx: number }
  | { type: 'SET_BRANDING'; patch: Partial<ReportBranding> }
  | { type: 'CLEAR_BRANDING' };

function reducer(state: MatFoundationInput, action: Action): MatFoundationInput {
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
    case 'SET_COL': {
      const cols = [...state.columns];
      cols[action.idx] = { ...cols[action.idx], ...action.patch };
      return { ...state, columns: cols };
    }
    case 'ADD_COL':
      return {
        ...state,
        columns: [
          ...state.columns,
          {
            id: `C${state.columns.length + 1}`,
            cx: 500, cy: 500, shape: 'square',
            PD: 1000, PL: 600,
            x: state.geometry.B / 2, y: state.geometry.L / 2,
          },
        ],
      };
    case 'REMOVE_COL':
      return {
        ...state,
        columns: state.columns.filter((_, i) => i !== action.idx),
      };
    case 'SET_BRANDING':
      return { ...state, branding: { ...(state.branding ?? {}), ...action.patch } };
    case 'CLEAR_BRANDING': {
      const { branding: _, ...rest } = state;
      void _;
      return rest as MatFoundationInput;
    }
    default:
      return state;
  }
}

export function MatFoundationCalculator() {
  const [model, dispatch] = useReducer(reducer, undefined as unknown, () =>
    MAT_FOUNDATION_PRESETS[0].build()
  );
  const result = useMemo(() => analyzeMatFoundation(model), [model]);
  const summary = buildMatCheckSummary(result);
  const [tab, setTab] = useState<Tab>('inputs');
  const [cover3dDataUrl, setCover3dDataUrl] = useState<string | undefined>();

  const captureCover3d = useCallback(() => {
    const canvas = document.querySelector('.slab-3d__canvas canvas') as HTMLCanvasElement | null;
    if (canvas) {
      try { setCover3dDataUrl(canvas.toDataURL('image/png')); } catch { /* CORS */ }
    }
  }, []);
  const handlePrint = useCallback(() => {
    captureCover3d();
    setTimeout(() => window.print(), 80);
  }, [captureCover3d]);

  return (
    <div className="ab-section">
      <section className="slab-topbar">
        <div className="slab-topbar__group">
          <label>Preset</label>
          <select
            onChange={(e) => {
              const p = MAT_FOUNDATION_PRESETS[parseInt(e.target.value, 10)];
              if (p) dispatch({ type: 'LOAD_PRESET', input: p.build() });
            }}
            defaultValue="0"
          >
            {MAT_FOUNDATION_PRESETS.map((p, i) => (
              <option key={i} value={i.toString()}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="slab-topbar__group">
          <label>Code</label>
          <select value={model.code}
            onChange={(e) => dispatch({ type: 'SET_CODE', code: e.target.value as Code })}>
            <option value="ACI 318-25">ACI 318-25 (SI)</option>
            <option value="ACI 318-19">ACI 318-19</option>
          </select>
        </div>
        <div className="slab-topbar__group">
          <label>Mat</label>
          <span className="ab-label">
            {(model.geometry.B / 1000).toFixed(2)} × {(model.geometry.L / 1000).toFixed(2)} × {(model.geometry.T / 1000).toFixed(2)} m
          </span>
        </div>
        <div className="slab-topbar__group">
          <label>Columns</label>
          <span className="ab-label">{model.columns.length}</span>
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

      {/* Print-only report (hidden on screen) */}
      <MatFoundationPrintReport input={model} result={result} cover3dDataUrl={cover3dDataUrl} />

      <section className={`rc-status ${result.ok ? 'rc-status--pass' : 'rc-status--fail'}`}>
        <div className="rc-status__icon">{result.ok ? '✓' : '✗'}</div>
        <div className="rc-status__text">
          <strong>
            {result.ok
              ? <>Mat OK — q<sub>max</sub> = {result.bearing.q_max.toFixed(1)} kPa, {summary.filter((s) => s.ok).length}/{summary.length} checks pass</>
              : `Mat FAILS — ${result.warnings.length} issue(s)`}
          </strong>
          <span className="rc-status__es">
            qnu = {result.qnu_avg.toFixed(1)} kPa · resultant offset (eX, eY) = ({result.bearing.eX.toFixed(0)}, {result.bearing.eY.toFixed(0)}) mm
          </span>
        </div>
      </section>

      <nav className="ab-tabs" aria-label="Mat foundation tabs">
        {([
          ['inputs', 'Inputs'],
          ['auto', 'Auto-design'],
          ['plan', 'Plan view'],
          ['sections', 'Sections'],
          ['3d', '3D'],
          ['checks', 'Checks'],
          ['refs', 'References'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button"
            className={`ab-tab ${tab === id ? 'ab-tab--active' : ''}`}
            onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      {tab === 'inputs' && <InputsTab model={model} dispatch={dispatch} />}
      {tab === 'auto' && <AutoDesignTab model={model} dispatch={dispatch} />}
      {tab === 'plan' && <PlanTab model={model} result={result} />}
      {tab === 'sections' && <SectionsTab model={model} result={result} />}
      {tab === '3d' && <MatFoundation3D input={model} result={result} />}
      {tab === 'checks' && <ChecksTab summary={summary} />}
      {tab === 'refs' && <RefsTab />}

      {result.warnings.length > 0 && (
        <div className="slab-card" style={{ borderColor: 'rgba(201,168,76,0.55)', marginTop: '1rem' }}>
          <h4>Warnings</h4>
          <ul>
            {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── INPUTS TAB ────────────────────────────────────────────────────────────

function InputsTab({ model, dispatch }: { model: MatFoundationInput; dispatch: React.Dispatch<Action> }) {
  return (
    <div className="slab-inputs-grid">
      <div className="slab-card">
        <h4>Mat geometry (mm)</h4>
        <div className="slab-fields">
          <Field label="B — width along X (mm)">
            <Num val={model.geometry.B} step={500}
              onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { B: v } })} />
          </Field>
          <Field label="L — length along Y (mm)">
            <Num val={model.geometry.L} step={500}
              onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { L: v } })} />
          </Field>
          <Field label="T — thickness (mm)">
            <Num val={model.geometry.T} step={50}
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

      {/* Columns */}
      <div className="slab-card" style={{ gridColumn: 'span 2' }}>
        <h4>Columns ({model.columns.length})
          <button type="button" className="ab-btn ab-btn--small" style={{ marginLeft: '0.6rem' }}
            onClick={() => dispatch({ type: 'ADD_COL' })}>
            + Add
          </button>
        </h4>
        <div className="ab-table-scroll">
          <table className="ab-result-table" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>ID</th><th>Shape</th><th>cx (mm)</th><th>cy (mm)</th>
                <th>x (mm)</th><th>y (mm)</th><th>PD (kN)</th><th>PL (kN)</th>
                <th>Loc (αs)</th><th></th>
              </tr>
            </thead>
            <tbody>
              {model.columns.map((c, i) => (
                <tr key={i}>
                  <td>
                    <input type="text" value={c.id} style={{ width: '60px' }}
                      onChange={(e) => dispatch({ type: 'SET_COL', idx: i, patch: { id: e.target.value } })} />
                  </td>
                  <td>
                    <select value={c.shape}
                      onChange={(e) => dispatch({ type: 'SET_COL', idx: i, patch: { shape: e.target.value as ColumnShape } })}>
                      <option value="square">sq</option>
                      <option value="rectangular">rect</option>
                      <option value="circular">circ</option>
                    </select>
                  </td>
                  <td><Num val={c.cx} step={50} onChange={(v) => dispatch({ type: 'SET_COL', idx: i, patch: { cx: v } })} /></td>
                  <td>{c.shape === 'rectangular' && (
                    <Num val={c.cy ?? c.cx} step={50}
                      onChange={(v) => dispatch({ type: 'SET_COL', idx: i, patch: { cy: v } })} />
                  )}</td>
                  <td><Num val={c.x} step={100} onChange={(v) => dispatch({ type: 'SET_COL', idx: i, patch: { x: v } })} /></td>
                  <td><Num val={c.y} step={100} onChange={(v) => dispatch({ type: 'SET_COL', idx: i, patch: { y: v } })} /></td>
                  <td><Num val={c.PD} step={50} onChange={(v) => dispatch({ type: 'SET_COL', idx: i, patch: { PD: v } })} /></td>
                  <td><Num val={c.PL} step={50} onChange={(v) => dispatch({ type: 'SET_COL', idx: i, patch: { PL: v } })} /></td>
                  <td>
                    <select value={c.columnLocation ?? 'auto'}
                      onChange={(e) => {
                        const v = e.target.value;
                        dispatch({ type: 'SET_COL', idx: i, patch: { columnLocation: v === 'auto' ? undefined : v as 'interior' | 'edge' | 'corner' } });
                      }}>
                      <option value="auto">auto</option>
                      <option value="interior">interior</option>
                      <option value="edge">edge</option>
                      <option value="corner">corner</option>
                    </select>
                  </td>
                  <td>
                    <button type="button" className="ab-btn ab-btn--small ab-btn--danger"
                      onClick={() => dispatch({ type: 'REMOVE_COL', idx: i })}
                      disabled={model.columns.length <= 1}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print branding card */}
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
              placeholder="e.g. Project 24-117 — Mat M-1"
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

// ─── AUTO-DESIGN TAB ───────────────────────────────────────────────────────

function AutoDesignTab({
  model, dispatch,
}: {
  model: MatFoundationInput;
  dispatch: React.Dispatch<Action>;
}) {
  const [aspect, setAspect] = useState(1.0);
  const [recommendation, setRecommendation] = useState<ReturnType<typeof autoDesignMatFoundation> | null>(null);

  const handleRun = () => {
    const r = autoDesignMatFoundation(model, { aspect });
    setRecommendation(r);
  };
  const handleApply = () => {
    if (recommendation) dispatch({ type: 'LOAD_PRESET', input: recommendation.patchedInput });
  };

  return (
    <div className="slab-card" style={{ borderColor: 'rgba(127,182,145,0.55)' }}>
      <h4>Auto-Design Mat (sizes B, L, T + picks 4 mats from strip-method)</h4>
      <p className="ab-empty" style={{ marginBottom: '0.6rem' }}>
        Given the column array + soil + materials, the driver fits a rectangle around the
        columns with margin, sizes B and L for the required area, iterates T until punching
        passes at every column, then picks the 4 mats (top X/Y, bottom X/Y) from strip-method
        flexure (per metre) plus the §8.6.1.1 minimum. {model.code} references throughout.
      </p>
      <div className="slab-fields" style={{ marginBottom: '0.6rem' }}>
        <Field label="B/L aspect (target)">
          <Num val={aspect} step={0.1}
            onChange={(v) => setAspect(Math.max(0.5, Math.min(3, v)))} />
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
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
            <span className="ab-label">B = {recommendation.patchedInput.geometry.B} mm</span>
            <span className="ab-label">L = {recommendation.patchedInput.geometry.L} mm</span>
            <span className="ab-label">T = {recommendation.patchedInput.geometry.T} mm</span>
            <span className="ab-label">
              Bot-X: {recommendation.patchedInput.reinforcement.bottomX.bar}@{recommendation.patchedInput.reinforcement.bottomX.spacing}
            </span>
            <span className="ab-label">
              Bot-Y: {recommendation.patchedInput.reinforcement.bottomY.bar}@{recommendation.patchedInput.reinforcement.bottomY.spacing}
            </span>
            <span className="ab-label">
              Top-X: {recommendation.patchedInput.reinforcement.topX.bar}@{recommendation.patchedInput.reinforcement.topX.spacing}
            </span>
            <span className="ab-label">
              Top-Y: {recommendation.patchedInput.reinforcement.topY.bar}@{recommendation.patchedInput.reinforcement.topY.spacing}
            </span>
            <span className={`ab-label ${recommendation.ok ? 'ab-pass' : 'ab-fail'}`}>
              {recommendation.ok ? '✓ All checks pass' : '⚠ Some checks need review'}
            </span>
          </div>

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

// ─── SECTIONS TAB (X + Y axis cuts) ─────────────────────────────────────────

function SectionsTab({
  model, result,
}: { model: MatFoundationInput; result: ReturnType<typeof analyzeMatFoundation> }) {
  return (
    <div className="slab-inputs-grid">
      <div className="slab-card" style={{ gridColumn: 'span 2' }}>
        <h4>Section A-A (along X)</h4>
        <MatFoundationSection2D input={model} result={result} axis="X" />
      </div>
      <div className="slab-card" style={{ gridColumn: 'span 2' }}>
        <h4>Section B-B (along Y)</h4>
        <MatFoundationSection2D input={model} result={result} axis="Y" />
      </div>
    </div>
  );
}

// ─── PLAN VIEW (top-down with N columns + corner pressures) ─────────────────

function PlanTab({ model, result }: { model: MatFoundationInput; result: ReturnType<typeof analyzeMatFoundation> }) {
  const W = 900, H = 700;
  const padX = 80, padY = 80;
  const drawW = W - 2 * padX;
  const drawH = H - 2 * padY;
  const sx = drawW / model.geometry.B;
  const sy = drawH / model.geometry.L;
  const s = Math.min(sx, sy) * 0.9;

  const fW = model.geometry.B * s;
  const fH = model.geometry.L * s;
  const fX = padX + (drawW - fW) / 2;
  // Note: Y axis inverted in SVG (origin top-left), so y=0 (mat-local) is at the BOTTOM
  // We invert: SVG y = fY + (model.geometry.L - mat_y) * s
  const fY = padY + (drawH - fH) / 2;

  return (
    <div className="slab-card" style={{ marginTop: '1rem' }}>
      <h4>Plan view — Mat with {model.columns.length} columns + corner pressures</h4>
      <p className="ab-empty" style={{ marginBottom: '0.6rem', fontSize: '0.86rem' }}>
        Bilinear pressure (rigid method): q at the four corners shown in kPa.
        Resultant of column loads marked with ⊕ (offset eX, eY from mat centre).
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
           xmlns="http://www.w3.org/2000/svg"
           style={{ width: '100%', maxWidth: '100%', height: 'auto',
                    background: 'rgba(20, 20, 20, 0.5)', borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Title */}
        <text x={W / 2} y="28" textAnchor="middle"
              fontSize="14" fontWeight="700" fill="rgba(255,255,255,0.95)">
          PLAN — {(model.geometry.B / 1000).toFixed(1)} × {(model.geometry.L / 1000).toFixed(1)} m mat ({model.columns.length} columns)
        </text>

        {/* Mat outline */}
        <rect x={fX} y={fY} width={fW} height={fH}
              fill="rgba(180,180,180,0.10)"
              stroke="#c9a84c" strokeWidth="2" />

        {/* Corner pressure labels */}
        {[
          { x: fX,        y: fY + fH, label: 'BL', q: result.bearing.q_corner_BL },
          { x: fX + fW,   y: fY + fH, label: 'BR', q: result.bearing.q_corner_BR },
          { x: fX,        y: fY,      label: 'TL', q: result.bearing.q_corner_TL },
          { x: fX + fW,   y: fY,      label: 'TR', q: result.bearing.q_corner_TR },
        ].map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r="4" fill="#c9a84c" />
            <text x={c.x + (c.label.includes('L') ? -8 : 8)}
                  y={c.y + (c.label.includes('B') ? 18 : -8)}
                  textAnchor={c.label.includes('L') ? 'end' : 'start'}
                  fontSize="10" fill="#c9a84c" fontWeight="700">
              {c.q.toFixed(1)} kPa
            </text>
          </g>
        ))}

        {/* Columns */}
        {model.columns.map((col, i) => {
          const cx_px = fX + col.x * s;
          const cy_px = fY + (model.geometry.L - col.y) * s;     // invert Y
          const colSize_px = col.cx * s;
          const cySize_px = (col.cy ?? col.cx) * s;
          const punching = result.punching[i];
          return (
            <g key={i}>
              {col.shape === 'circular' ? (
                <circle cx={cx_px} cy={cy_px} r={colSize_px / 2}
                        fill="rgba(140,140,140,0.7)" stroke="#444" strokeWidth="1.2" />
              ) : (
                <rect x={cx_px - colSize_px / 2} y={cy_px - cySize_px / 2}
                      width={colSize_px} height={cySize_px}
                      fill="rgba(140,140,140,0.7)" stroke="#444" strokeWidth="1.2" />
              )}
              {/* Column ID */}
              <text x={cx_px} y={cy_px + 4} textAnchor="middle"
                    fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.95)">
                {col.id}
              </text>
              {/* Punching ratio chip */}
              <text x={cx_px} y={cy_px + cySize_px / 2 + 14} textAnchor="middle"
                    fontSize="9" fill={punching.ok ? '#7fb691' : '#e8836a'} fontWeight="700">
                {punching.ratio.toFixed(2)} {punching.ok ? '✓' : '✗'}
              </text>
            </g>
          );
        })}

        {/* Resultant ⊕ */}
        {(() => {
          const rx_px = fX + result.bearing.xResultant * s;
          const ry_px = fY + (model.geometry.L - result.bearing.yResultant) * s;
          return (
            <g>
              <circle cx={rx_px} cy={ry_px} r="10" fill="none"
                      stroke="#ff8a72" strokeWidth="1.5" />
              <line x1={rx_px - 12} y1={ry_px} x2={rx_px + 12} y2={ry_px}
                    stroke="#ff8a72" strokeWidth="1.5" />
              <line x1={rx_px} y1={ry_px - 12} x2={rx_px} y2={ry_px + 12}
                    stroke="#ff8a72" strokeWidth="1.5" />
              <text x={rx_px + 14} y={ry_px - 6}
                    fontSize="9" fill="#ff8a72" fontWeight="700">
                Resultant (e = {result.bearing.eX.toFixed(0)}, {result.bearing.eY.toFixed(0)})
              </text>
            </g>
          );
        })()}

        {/* Compass */}
        <g transform={`translate(${W - 60}, ${H - 60})`}>
          <circle cx="0" cy="0" r="20" fill="rgba(0,0,0,0.35)"
                  stroke="rgba(255,255,255,0.3)" strokeWidth="0.7" />
          <line x1="0" y1="0" x2="14" y2="0" stroke="#cbd5e1" strokeWidth="1.2" />
          <polygon points="14,-3 18,0 14,3" fill="#cbd5e1" />
          <line x1="0" y1="0" x2="0" y2="-14" stroke="#cbd5e1" strokeWidth="1.2" />
          <polygon points="-3,-14 0,-18 3,-14" fill="#cbd5e1" />
          <text x="20" y="3" fontSize="9" fill="#cbd5e1" fontWeight="700">+X</text>
          <text x="0" y="-22" textAnchor="middle" fontSize="9" fill="#cbd5e1" fontWeight="700">+Y</text>
        </g>
      </svg>
    </div>
  );
}

// ─── CHECKS TAB ────────────────────────────────────────────────────────────

function ChecksTab({ summary }: { summary: ReturnType<typeof buildMatCheckSummary> }) {
  return (
    <div className="ab-table-scroll" style={{ marginTop: '1rem' }}>
      <table className="ab-result-table">
        <thead>
          <tr>
            <th>Check</th><th>Reference</th><th>Demand</th>
            <th>Capacity</th><th>Ratio</th><th>Status</th>
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
        <li><strong>ACI 318-25 §13.3.4.4</strong> — Minimum reinforcement per §8.6.1.1</li>
        <li><strong>ACI 318-25 R13.3.4.4</strong> — Continuous reinforcement near both faces in BOTH directions for crack control + punching crack interception</li>
        <li><strong>ACI 318-25 §22.6.4 / Table 22.6.5.2</strong> — Two-way (punching) shear at each column</li>
        <li><strong>ACI 318-25 §22.6.5.3</strong> — αs interior 40 / edge 30 / corner 20 (auto-detected by proximity to mat edges)</li>
        <li><strong>Wight & MacGregor 7e §15-7</strong> — Mat foundation design method</li>
        <li><strong>ACI PRC-336.2</strong> — Detailed mat foundation design recommendations</li>
      </ul>
      <p style={{ marginTop: '1rem', fontSize: '0.86rem', color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>
        Strip-method flexure (column-line beams) and plate-on-Winkler-foundation
        analysis are out of scope for the current rigid-method release; for
        rigorous mat design with subgrade reaction, export geometry to CSI
        SAFE or PLAXIS.
      </p>
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
    <input type="number" step={step} value={val}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
  );
}
