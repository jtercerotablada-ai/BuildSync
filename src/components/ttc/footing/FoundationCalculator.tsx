'use client';

import React, { useMemo, useReducer, useState } from 'react';
import dynamic from 'next/dynamic';
import type {
  FootingInput, ColumnShape, Code, ReportBranding,
} from '@/lib/footing/types';
import { analyzeFooting } from '@/lib/footing/solver';
import { FOOTING_PRESETS } from '@/lib/footing/presets';
import { buildCheckSummary, formatRatio } from '@/lib/footing/format';
import { BAR_CATALOG } from '@/lib/rc/types';
import { FootingPlan2D } from './FootingPlan2D';
import { FootingSection2D } from './FootingSection2D';
import { PunchingDiagram2D } from './PunchingDiagram2D';
import { FootingPrintReport } from './FootingPrintReport';

// Dynamic-import the 3D viewer (R3F adds ~200kB; defer until needed)
const Footing3D = dynamic(() => import('./Footing3D').then((m) => m.Footing3D), {
  ssr: false,
  loading: () => <p className="ab-empty">Loading 3D viewer…</p>,
});

// ─── State management ──────────────────────────────────────────────────────

type Action =
  | { type: 'LOAD_PRESET'; input: FootingInput }
  | { type: 'SET_CODE'; code: Code }
  | { type: 'SET_GEOM'; patch: Partial<FootingInput['geometry']> }
  | { type: 'SET_SOIL'; patch: Partial<FootingInput['soil']> }
  | { type: 'SET_MAT'; patch: Partial<FootingInput['materials']> }
  | { type: 'SET_LOADS'; patch: Partial<FootingInput['loads']> }
  | { type: 'SET_REINF_LAYER'; layer: 'bottomX' | 'bottomY' | 'topX' | 'topY'; bar: string; count: number }
  | { type: 'CLEAR_REINF_LAYER'; layer: 'topX' | 'topY' }
  | { type: 'SET_LATERAL'; H?: number; mu?: number; cohesion?: number }
  | { type: 'SET_BRANDING'; patch: Partial<ReportBranding> }
  | { type: 'CLEAR_BRANDING' };

function reducer(state: FootingInput, action: Action): FootingInput {
  switch (action.type) {
    case 'LOAD_PRESET': return action.input;
    case 'SET_CODE':    return { ...state, code: action.code };
    case 'SET_GEOM':    return { ...state, geometry: { ...state.geometry, ...action.patch } };
    case 'SET_SOIL':    return { ...state, soil: { ...state.soil, ...action.patch } };
    case 'SET_MAT':     return { ...state, materials: { ...state.materials, ...action.patch } };
    case 'SET_LOADS':   return { ...state, loads: { ...state.loads, ...action.patch } };
    case 'SET_REINF_LAYER': {
      const value = { bar: action.bar, count: action.count };
      return { ...state, reinforcement: { ...state.reinforcement, [action.layer]: value } };
    }
    case 'CLEAR_REINF_LAYER': {
      const r = { ...state.reinforcement };
      delete r[action.layer];
      return { ...state, reinforcement: r };
    }
    case 'SET_LATERAL':
      return {
        ...state,
        H: action.H ?? state.H,
        frictionMu: action.mu ?? state.frictionMu,
        cohesion: action.cohesion ?? state.cohesion,
      };
    case 'SET_BRANDING':
      return { ...state, branding: { ...(state.branding ?? {}), ...action.patch } };
    case 'CLEAR_BRANDING': {
      const { branding, ...rest } = state;
      void branding;
      return rest as FootingInput;
    }
  }
}

// ─── Tab type ──────────────────────────────────────────────────────────────

type Tab = 'inputs' | 'drawings' | '3d' | 'checks' | 'refs';

// ─── Number input helper ───────────────────────────────────────────────────

function Num({ val, step = 1, onChange }: { val: number; step?: number; onChange: (v: number) => void }) {
  return (
    <input type="number" value={val} step={step}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v)) onChange(v);
      }} />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ab-input-group">
      <label>{label}</label>
      {children}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function FoundationCalculator() {
  const [model, dispatch] = useReducer(reducer, undefined, () => FOOTING_PRESETS[1].build());
  const [tab, setTab] = useState<Tab>('inputs');
  const [cover3dDataUrl, setCover3dDataUrl] = useState<string | undefined>();

  const result = useMemo(() => analyzeFooting(model), [model]);
  const summary = useMemo(() => buildCheckSummary(result), [result]);

  const handlePrint = () => {
    const canvas = document.querySelector('.rc-3d__canvas canvas') as HTMLCanvasElement | null;
    if (canvas) {
      try { setCover3dDataUrl(canvas.toDataURL('image/png')); }
      catch (e) { console.warn('3D capture failed:', e); }
    }
    setTimeout(() => window.print(), 80);
  };

  return (
    <div className="ab-root">
      <FootingPrintReport input={model} result={result} cover3dDataUrl={cover3dDataUrl} />

      {/* Templates */}
      <section className="ab-section">
        <header className="ab-section__header">
          <h3>Templates</h3>
          <p className="ab-section__subtitle">Start from a textbook example, then edit.</p>
        </header>
        <div className="ab-presets">
          {FOOTING_PRESETS.map((p) => (
            <button key={p.label} type="button" className="ab-preset-chip"
              onClick={() => dispatch({ type: 'LOAD_PRESET', input: p.build() })}>
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* Status banner */}
      <section className={`rc-status ${result.ok ? 'rc-status--pass' : 'rc-status--fail'}`}>
        <div className="rc-status__icon">{result.ok ? '✓' : '✗'}</div>
        <div className="rc-status__text">
          <strong>
            {result.ok
              ? `Footing OK — q_max = ${result.bearing.q_max.toFixed(1)} kPa, ${summary.filter((s) => s.ok).length}/${summary.length} checks pass`
              : `Footing FAILS — ${result.warnings.length} issue(s)`}
          </strong>
          <span className="rc-status__es">
            {result.upliftRegion
              ? '⚠ Eccentricity outside kern → partial uplift detected'
              : `qnu = ${result.qnu.toFixed(1)} kPa, Wf = ${result.Wf.toFixed(1)} kN`}
          </span>
        </div>
      </section>

      {/* Top bar */}
      <section className="ab-section ab-topbar">
        <div className="ab-input-group">
          <label>Design code</label>
          <select value={model.code}
            onChange={(e) => dispatch({ type: 'SET_CODE', code: e.target.value as Code })}>
            <option value="ACI 318-25">ACI 318-25 (latest)</option>
            <option value="ACI 318-19">ACI 318-19</option>
          </select>
        </div>
        <div className="ab-input-group">
          <label>Footing area</label>
          <span className="ab-label">
            {(model.geometry.B / 1000).toFixed(2)} × {(model.geometry.L / 1000).toFixed(2)} m
          </span>
        </div>
        <div className="ab-input-group">
          <label>Thickness</label>
          <span className="ab-label">{model.geometry.T} mm</span>
        </div>
        <div className="ab-input-group">
          <label>Overall</label>
          <span className={`ab-label ${result.ok ? 'ab-pass' : 'ab-fail'}`}>
            {result.ok ? '✓ PASS' : '✗ FAIL'}
          </span>
        </div>
        <button type="button" className="ab-btn ab-btn--primary slab-print-btn" onClick={handlePrint}>
          ⎙ Print full report
        </button>
      </section>

      {/* Tab nav */}
      <nav className="ab-tabs" aria-label="Foundation design tabs">
        {([
          ['inputs',   '📋 Inputs'],
          ['drawings', '📐 Drawings'],
          ['3d',       '🧊 3D'],
          ['checks',   '🔬 Checks'],
          ['refs',     '📚 References'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button"
            className={`ab-tab ${tab === id ? 'ab-tab--active' : ''}`}
            onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      {/* Tab content */}
      {tab === 'inputs'   && <InputsTab model={model} dispatch={dispatch} />}
      {tab === 'drawings' && <DrawingsTab input={model} result={result} />}
      {tab === '3d'       && <Footing3D input={model} result={result} />}
      {tab === 'checks'   && <ChecksTab result={result} summary={summary} />}
      {tab === 'refs'     && <RefsTab />}

      {result.warnings.length > 0 && (
        <section className="slab-card" style={{ marginTop: '1rem', borderColor: 'rgba(201,168,76,0.35)' }}>
          <h4>⚠ Warnings</h4>
          <ul style={{ marginLeft: '1rem' }}>
            {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}

// ─── INPUTS TAB ────────────────────────────────────────────────────────────

function InputsTab({ model, dispatch }: { model: FootingInput; dispatch: React.Dispatch<Action> }) {
  return (
    <div className="slab-inputs-grid">
      {/* Geometry */}
      <div className="slab-card">
        <h4>Footing Geometry (mm)</h4>
        <div className="slab-fields">
          <Field label="B — width along X">
            <Num val={model.geometry.B} step={50}
              onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { B: v } })} />
          </Field>
          <Field label="L — length along Y">
            <Num val={model.geometry.L} step={50}
              onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { L: v } })} />
          </Field>
          <Field label="T — thickness">
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

      {/* Column */}
      <div className="slab-card">
        <h4>Column</h4>
        <div className="slab-fields">
          <Field label="Shape">
            <select value={model.geometry.columnShape}
              onChange={(e) => dispatch({ type: 'SET_GEOM', patch: { columnShape: e.target.value as ColumnShape } })}>
              <option value="square">Square</option>
              <option value="rectangular">Rectangular</option>
              <option value="circular">Circular</option>
            </select>
          </Field>
          <Field label={model.geometry.columnShape === 'circular' ? 'Diameter (mm)' : 'cx — along X (mm)'}>
            <Num val={model.geometry.cx} step={25}
              onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { cx: v } })} />
          </Field>
          {model.geometry.columnShape === 'rectangular' && (
            <Field label="cy — along Y (mm)">
              <Num val={model.geometry.cy ?? model.geometry.cx} step={25}
                onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { cy: v } })} />
            </Field>
          )}
          <Field label="Eccentricity ex (mm)">
            <Num val={model.geometry.ex ?? 0} step={25}
              onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { ex: v } })} />
          </Field>
          <Field label="Eccentricity ey (mm)">
            <Num val={model.geometry.ey ?? 0} step={25}
              onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { ey: v } })} />
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
          <Field label="γs — soil unit weight (kN/m³)">
            <Num val={model.soil.gammaSoil ?? 18} step={1}
              onChange={(v) => dispatch({ type: 'SET_SOIL', patch: { gammaSoil: v } })} />
          </Field>
          <Field label="γc — concrete unit weight (kN/m³)">
            <Num val={model.soil.gammaConcrete ?? 24} step={1}
              onChange={(v) => dispatch({ type: 'SET_SOIL', patch: { gammaConcrete: v } })} />
          </Field>
        </div>
      </div>

      {/* Materials */}
      <div className="slab-card">
        <h4>Materials (MPa)</h4>
        <div className="slab-fields">
          <Field label="fʹc">
            <Num val={model.materials.fc} step={1}
              onChange={(v) => dispatch({ type: 'SET_MAT', patch: { fc: v } })} />
          </Field>
          <Field label="fy">
            <Num val={model.materials.fy} step={10}
              onChange={(v) => dispatch({ type: 'SET_MAT', patch: { fy: v } })} />
          </Field>
          <Field label="λ (lightweight)">
            <Num val={model.materials.lambdaC ?? 1.0} step={0.05}
              onChange={(v) => dispatch({ type: 'SET_MAT', patch: { lambdaC: v } })} />
          </Field>
        </div>
      </div>

      {/* Loads */}
      <div className="slab-card">
        <h4>Loads (service)</h4>
        <div className="slab-fields">
          <Field label="PD — dead load (kN)">
            <Num val={model.loads.PD} step={50}
              onChange={(v) => dispatch({ type: 'SET_LOADS', patch: { PD: v } })} />
          </Field>
          <Field label="PL — live load (kN)">
            <Num val={model.loads.PL} step={50}
              onChange={(v) => dispatch({ type: 'SET_LOADS', patch: { PL: v } })} />
          </Field>
          <Field label="Mx — moment about X (kN·m)">
            <Num val={model.loads.Mx ?? 0} step={10}
              onChange={(v) => dispatch({ type: 'SET_LOADS', patch: { Mx: v } })} />
          </Field>
          <Field label="My — moment about Y (kN·m)">
            <Num val={model.loads.My ?? 0} step={10}
              onChange={(v) => dispatch({ type: 'SET_LOADS', patch: { My: v } })} />
          </Field>
          <Field label="H — lateral horizontal (kN)">
            <Num val={model.H ?? 0} step={10}
              onChange={(v) => dispatch({ type: 'SET_LATERAL', H: v })} />
          </Field>
          <Field label="μ — friction coefficient">
            <Num val={model.frictionMu ?? 0.45} step={0.05}
              onChange={(v) => dispatch({ type: 'SET_LATERAL', mu: v })} />
          </Field>
        </div>
      </div>

      {/* Branding (for print report) */}
      <div className="slab-card">
        <h4>Print branding (optional)</h4>
        <div className="slab-fields">
          <Field label="Company name">
            <input type="text" value={model.branding?.companyName ?? ''}
              onChange={(e) => dispatch({ type: 'SET_BRANDING', patch: { companyName: e.target.value } })} />
          </Field>
          <Field label="Tagline / project ID">
            <input type="text" value={model.branding?.companyTagline ?? ''}
              onChange={(e) => dispatch({ type: 'SET_BRANDING', patch: { companyTagline: e.target.value } })} />
          </Field>
        </div>
      </div>

      {/* Reinforcement */}
      <div className="slab-card">
        <h4>Reinforcement</h4>
        <div className="slab-fields">
          <Field label="Bottom-X bar">
            <select value={model.reinforcement.bottomX.bar}
              onChange={(e) => dispatch({ type: 'SET_REINF_LAYER', layer: 'bottomX', bar: e.target.value, count: model.reinforcement.bottomX.count })}>
              {BAR_CATALOG.filter((b) => b.system === 'imperial').map((b) => (
                <option key={b.label} value={b.label}>{b.label} ({b.db.toFixed(1)} mm)</option>
              ))}
            </select>
          </Field>
          <Field label="Bottom-X count">
            <Num val={model.reinforcement.bottomX.count} step={1}
              onChange={(v) => dispatch({ type: 'SET_REINF_LAYER', layer: 'bottomX', bar: model.reinforcement.bottomX.bar, count: Math.max(2, Math.round(v)) })} />
          </Field>
          <Field label="Bottom-Y bar">
            <select value={model.reinforcement.bottomY.bar}
              onChange={(e) => dispatch({ type: 'SET_REINF_LAYER', layer: 'bottomY', bar: e.target.value, count: model.reinforcement.bottomY.count })}>
              {BAR_CATALOG.filter((b) => b.system === 'imperial').map((b) => (
                <option key={b.label} value={b.label}>{b.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Bottom-Y count">
            <Num val={model.reinforcement.bottomY.count} step={1}
              onChange={(v) => dispatch({ type: 'SET_REINF_LAYER', layer: 'bottomY', bar: model.reinforcement.bottomY.bar, count: Math.max(2, Math.round(v)) })} />
          </Field>
        </div>
      </div>
    </div>
  );
}

// ─── CHECKS TAB ────────────────────────────────────────────────────────────

function ChecksTab({
  result,
  summary,
}: {
  result: ReturnType<typeof analyzeFooting>;
  summary: ReturnType<typeof buildCheckSummary>;
}) {
  void result;
  return (
    <div className="ab-table-scroll">
      <table className="ab-result-table">
        <thead>
          <tr>
            <th>Check</th><th>Reference</th><th>Demand</th><th>Capacity</th><th>Ratio</th><th>Status</th>
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

// ─── DRAWINGS TAB ──────────────────────────────────────────────────────────

function DrawingsTab({ input, result }: { input: FootingInput; result: ReturnType<typeof analyzeFooting> }) {
  return (
    <div className="slab-inputs-grid">
      <div className="slab-card" style={{ gridColumn: 'span 2' }}>
        <h4>Plan view (top-down)</h4>
        <FootingPlan2D input={input} result={result} />
      </div>
      <div className="slab-card" style={{ gridColumn: 'span 2' }}>
        <h4>Cross-section A-A</h4>
        <FootingSection2D input={input} result={result} />
      </div>
      <div className="slab-card" style={{ gridColumn: 'span 2' }}>
        <h4>Punching shear diagram</h4>
        <PunchingDiagram2D input={input} result={result} />
      </div>
    </div>
  );
}

// ─── REFS TAB ──────────────────────────────────────────────────────────────

function RefsTab() {
  return (
    <div className="slab-card">
      <h4>Code references</h4>
      <ul style={{ marginLeft: '1rem', lineHeight: 1.8 }}>
        <li><strong>ACI 318-25 §13</strong> — Foundations (general design)</li>
        <li><strong>ACI 318-25 §13.3.1</strong> — Service-load bearing</li>
        <li><strong>ACI 318-25 §13.3.3</strong> — Flexure at face of column</li>
        <li><strong>ACI 318-25 §13.3.4</strong> — Reinforcement detailing</li>
        <li><strong>ACI 318-25 §22.5.5.1(a)</strong> — One-way shear: Vc = 0.17·λ·√fʹc·bw·d</li>
        <li><strong>ACI 318-25 §22.6 + Table 22.6.5.2</strong> — Two-way (punching) shear</li>
        <li><strong>ACI 318-25 §22.8</strong> — Bearing at member interfaces</li>
        <li><strong>ACI 318-25 §8.6.1.1</strong> — Min reinforcement (T&S)</li>
        <li><strong>ACI 318-25 §16.3.4</strong> — Dowel reinforcement</li>
        <li><strong>ACI 318-25 §25.2.1</strong> — Min clear bar spacing</li>
        <li><strong>ACI 318-25 §25.4.2.3</strong> — Tension development length (simplified)</li>
        <li><strong>ACI 318-25 §25.4.3</strong> — Hooks in tension</li>
        <li>Wight & MacGregor, <em>Reinforced Concrete: Mechanics and Design</em> 7e — Ch 15 Footings</li>
        <li>ACI SP-17(14) — <em>Reinforced Concrete Design Manual</em></li>
        <li>Bowles, <em>Foundation Analysis and Design</em> — Ch 7 (overturning, sliding, kern)</li>
      </ul>
    </div>
  );
}
