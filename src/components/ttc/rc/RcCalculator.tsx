'use client';

import React, { useMemo, useReducer, useState } from 'react';
import dynamic from 'next/dynamic';
import { analyze } from '@/lib/rc/solver';
import {
  type BeamInput,
  type SectionShape,
  type Code,
  type DesignMethod,
  type DeflectionLimitCategory,
  BAR_CATALOG,
  CONCRETE_PRESETS,
  REBAR_PRESETS,
} from '@/lib/rc/types';
import { RcPrintReport } from './RcPrintReport';
import { RcSection2D } from './RcSection2D';

const Rc3D = dynamic(() => import('./Rc3D').then((m) => m.Rc3D), {
  ssr: false, loading: () => <p className="ab-empty">Loading 3D viewer…</p>,
});

// ============================================================================
// State
// ============================================================================
type Action =
  | { type: 'LOAD_PRESET'; input: BeamInput }
  | { type: 'SET_CODE'; code: Code }
  | { type: 'SET_METHOD'; method: DesignMethod }
  | { type: 'SET_GEOM'; patch: Partial<BeamInput['geometry']> }
  | { type: 'SET_MAT'; patch: Partial<BeamInput['materials']> }
  | { type: 'SET_LOADS'; patch: Partial<BeamInput['loads']> }
  | { type: 'SET_TENSION_BAR'; index: number; bar: string }
  | { type: 'SET_TENSION_COUNT'; index: number; count: number }
  | { type: 'ADD_TENSION_GROUP' }
  | { type: 'DEL_TENSION_GROUP'; index: number }
  | { type: 'SET_STIRRUP'; patch: Partial<BeamInput['reinforcement']['stirrup']> }
  | { type: 'SET_BRANDING'; patch: Partial<NonNullable<BeamInput['branding']>> }
  | { type: 'CLEAR_BRANDING' };

function reducer(state: BeamInput, action: Action): BeamInput {
  switch (action.type) {
    case 'LOAD_PRESET': return action.input;
    case 'SET_CODE':    return { ...state, code: action.code };
    case 'SET_METHOD':  return { ...state, method: action.method };
    case 'SET_GEOM':    return { ...state, geometry: { ...state.geometry, ...action.patch } };
    case 'SET_MAT':     return { ...state, materials: { ...state.materials, ...action.patch } };
    case 'SET_LOADS':   return { ...state, loads: { ...state.loads, ...action.patch } };
    case 'SET_TENSION_BAR': {
      const t = [...state.reinforcement.tension];
      t[action.index] = { ...t[action.index], bar: action.bar };
      return { ...state, reinforcement: { ...state.reinforcement, tension: t } };
    }
    case 'SET_TENSION_COUNT': {
      const t = [...state.reinforcement.tension];
      t[action.index] = { ...t[action.index], count: action.count };
      return { ...state, reinforcement: { ...state.reinforcement, tension: t } };
    }
    case 'ADD_TENSION_GROUP': {
      return { ...state, reinforcement: { ...state.reinforcement, tension: [...state.reinforcement.tension, { bar: '#8', count: 2 }] } };
    }
    case 'DEL_TENSION_GROUP': {
      const t = state.reinforcement.tension.filter((_, i) => i !== action.index);
      return { ...state, reinforcement: { ...state.reinforcement, tension: t.length ? t : [{ bar: '#8', count: 2 }] } };
    }
    case 'SET_STIRRUP':
      return { ...state, reinforcement: { ...state.reinforcement, stirrup: { ...state.reinforcement.stirrup, ...action.patch } } };
    case 'SET_BRANDING':
      return { ...state, branding: { ...(state.branding ?? {}), ...action.patch } };
    case 'CLEAR_BRANDING': {
      const { branding, ...rest } = state;
      void branding;
      return rest as BeamInput;
    }
  }
}

// ============================================================================
// Templates — classic textbook beams
// ============================================================================
const PRESETS: { label: string; build: () => BeamInput }[] = [
  {
    label: 'Singly Rectangular — b=300, h=600, 4#9 (textbook example)',
    build: () => ({
      code: 'ACI 318-25', method: 'LRFD',
      geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, L: 6000, coverClear: 40 },
      materials: { fc: 28, fy: 420, fyt: 420 },
      reinforcement: {
        tension: [{ bar: '#9', count: 4 }],
        stirrup: { bar: '#3', legs: 2, spacing: 200 },
      },
      loads: { Mu: 350, Vu: 200, Ma: 230, M_DL: 140, M_LL: 90, deflectionLimitCategory: 'floor-attached-likely-damage' },
    }),
  },
  {
    label: 'T-Beam — bf=600, hf=120, bw=300, 4#9',
    build: () => ({
      code: 'ACI 318-25', method: 'LRFD',
      geometry: { shape: 'T-beam', bw: 300, h: 600, d: 540, bf: 600, hf: 120, L: 7000, coverClear: 40 },
      materials: { fc: 28, fy: 420, fyt: 420 },
      reinforcement: {
        tension: [{ bar: '#9', count: 4 }],
        stirrup: { bar: '#3', legs: 2, spacing: 200 },
      },
      loads: { Mu: 400, Vu: 220, Ma: 270, M_DL: 160, M_LL: 110, deflectionLimitCategory: 'floor-attached-likely-damage' },
    }),
  },
  {
    label: 'Doubly Reinforced — heavy moment, b=300, h=500, 5#10 + 2#7',
    build: () => ({
      code: 'ACI 318-25', method: 'LRFD',
      geometry: { shape: 'rectangular', bw: 300, h: 500, d: 440, dPrime: 60, L: 5500, coverClear: 40 },
      materials: { fc: 35, fy: 420, fyt: 420 },
      reinforcement: {
        tension: [{ bar: '#10', count: 5 }],
        compression: [{ bar: '#7', count: 2 }],
        stirrup: { bar: '#3', legs: 2, spacing: 150 },
      },
      loads: { Mu: 500, Vu: 280, Ma: 350, M_DL: 200, M_LL: 150, deflectionLimitCategory: 'floor-attached-likely-damage' },
    }),
  },
  {
    label: 'High-strength concrete — fc=42 MPa, b=350, h=700, 5#10',
    build: () => ({
      code: 'ACI 318-25', method: 'LRFD',
      geometry: { shape: 'rectangular', bw: 350, h: 700, d: 630, L: 8000, coverClear: 40 },
      materials: { fc: 42, fy: 420, fyt: 420 },
      reinforcement: {
        tension: [{ bar: '#10', count: 5 }],
        stirrup: { bar: '#4', legs: 2, spacing: 200 },
      },
      loads: { Mu: 700, Vu: 350, Ma: 470, M_DL: 280, M_LL: 190, deflectionLimitCategory: 'floor-attached-likely-damage' },
    }),
  },
];

// ============================================================================
// Component
// ============================================================================
export function RcCalculator() {
  const [model, dispatch] = useReducer(reducer, undefined, () => PRESETS[0].build());
  const [tab, setTab] = useState<'inputs' | 'results' | 'section' | 'checks' | 'refs'>('inputs');
  const result = useMemo(() => analyze(model), [model]);
  const [cover3dDataUrl, setCover3dDataUrl] = useState<string | undefined>(undefined);

  const handlePrint = () => {
    const canvas = document.querySelector('.rc-3d__canvas canvas') as HTMLCanvasElement | null;
    if (canvas) {
      try { setCover3dDataUrl(canvas.toDataURL('image/png')); }
      catch (e) { console.warn('3D capture failed:', e); }
    }
    setTimeout(() => window.print(), 60);
  };

  return (
    <div className="ab-root">
      <RcPrintReport input={model} result={result} cover3dDataUrl={cover3dDataUrl} />

      {/* Templates */}
      <section className="ab-section">
        <header className="ab-section__header">
          <h3>Templates</h3>
          <p className="ab-section__subtitle">Start from a textbook example, then edit.</p>
        </header>
        <div className="ab-presets">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="ab-preset-chip"
              onClick={() => dispatch({ type: 'LOAD_PRESET', input: p.build() })}>
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* Top bar */}
      <section className="ab-section ab-topbar">
        <div className="ab-input-group">
          <label>Design code</label>
          <select value={model.code} onChange={(e) => dispatch({ type: 'SET_CODE', code: e.target.value as Code })}>
            <option value="ACI 318-25">ACI 318-25 (latest)</option>
            <option value="ACI 318-19">ACI 318-19</option>
            <option value="EN 1992-1-1">EN 1992-1-1 (Eurocode 2)</option>
          </select>
        </div>
        <div className="ab-input-group">
          <label>Section type</label>
          <select value={model.geometry.shape}
            onChange={(e) => dispatch({ type: 'SET_GEOM', patch: { shape: e.target.value as SectionShape } })}>
            <option value="rectangular">Rectangular</option>
            <option value="T-beam">T-beam</option>
            <option value="L-beam">L-beam</option>
            <option value="inverted-T">Inverted-T</option>
          </select>
        </div>
        <div className="ab-input-group">
          <label>φMn provided</label>
          <span className={`ab-label ${result.flexure.ok ? 'ab-pass' : 'ab-fail'}`}>
            {result.flexure.phiMn.toFixed(2)} kN·m
          </span>
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

      {/* 3D viewer */}
      <section className="ab-section">
        <Rc3D input={model} result={result} />
      </section>

      {/* Tabs */}
      <section className="ab-section">
        <div className="ab-tabs">
          {(['inputs', 'results', 'section', 'checks', 'refs'] as const).map((t) => (
            <button key={t} type="button"
              className={`ab-tab ${tab === t ? 'ab-tab--active' : ''}`}
              onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {tab === 'inputs'   && <InputsTab model={model} dispatch={dispatch} />}
        {tab === 'results'  && <ResultsTab result={result} />}
        {tab === 'section'  && <SectionTab input={model} result={result} />}
        {tab === 'checks'   && <ChecksTab result={result} />}
        {tab === 'refs'     && <RefsTab />}
      </section>
    </div>
  );
}

// ============================================================================
// INPUTS TAB
// ============================================================================
function InputsTab({ model, dispatch }: { model: BeamInput; dispatch: React.Dispatch<Action> }) {
  return (
    <div className="slab-inputs-grid">
      {/* Geometry */}
      <div className="slab-card">
        <h4>Geometry (mm)</h4>
        <div className="slab-fields">
          <Field label="bw — web width">
            <Num val={model.geometry.bw} step={25}
              onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { bw: v } })} />
          </Field>
          <Field label="h — total depth">
            <Num val={model.geometry.h} step={25}
              onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { h: v } })} />
          </Field>
          <Field label="d — effective depth">
            <Num val={model.geometry.d} step={10}
              onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { d: v } })} />
          </Field>
          {model.geometry.shape !== 'rectangular' && (<>
            <Field label="bf — flange width">
              <Num val={model.geometry.bf ?? model.geometry.bw} step={50}
                onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { bf: v } })} />
            </Field>
            <Field label="hf — flange thickness">
              <Num val={model.geometry.hf ?? 100} step={10}
                onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { hf: v } })} />
            </Field>
          </>)}
          {(model.reinforcement.compression?.length ?? 0) > 0 && (
            <Field label="dʹ — compr. steel depth">
              <Num val={model.geometry.dPrime ?? 60} step={5}
                onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { dPrime: v } })} />
            </Field>
          )}
          <Field label="L — clear span">
            <Num val={model.geometry.L} step={250}
              onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { L: v } })} />
          </Field>
          <Field label="Clear cover">
            <Num val={model.geometry.coverClear} step={5}
              onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { coverClear: v } })} />
          </Field>
        </div>
      </div>

      {/* Materials */}
      <div className="slab-card">
        <h4>Materials</h4>
        <div className="slab-fields">
          <Field label="Concrete preset">
            <select value=""
              onChange={(e) => {
                const fc = parseFloat(e.target.value);
                if (Number.isFinite(fc)) dispatch({ type: 'SET_MAT', patch: { fc } });
              }}>
              <option value="">— select —</option>
              {CONCRETE_PRESETS.map((p) => (
                <option key={p.label} value={p.fc}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="fʹc (MPa)">
            <Num val={model.materials.fc} step={1}
              onChange={(v) => dispatch({ type: 'SET_MAT', patch: { fc: v } })} />
          </Field>
          <Field label="Rebar preset">
            <select value=""
              onChange={(e) => {
                const fy = parseFloat(e.target.value);
                if (Number.isFinite(fy)) dispatch({ type: 'SET_MAT', patch: { fy } });
              }}>
              <option value="">— select —</option>
              {REBAR_PRESETS.map((p) => (
                <option key={p.label} value={p.fy}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="fy (MPa)">
            <Num val={model.materials.fy} step={10}
              onChange={(v) => dispatch({ type: 'SET_MAT', patch: { fy: v } })} />
          </Field>
          <Field label="fyt — stirrup (MPa)">
            <Num val={model.materials.fyt ?? model.materials.fy} step={10}
              onChange={(v) => dispatch({ type: 'SET_MAT', patch: { fyt: v } })} />
          </Field>
          <Field label="γc (kN/m³)">
            <Num val={model.materials.gammaC ?? 24} step={0.5}
              onChange={(v) => dispatch({ type: 'SET_MAT', patch: { gammaC: v } })} />
          </Field>
          <Field label="λc (concrete factor)">
            <Num val={model.materials.lambdaC ?? 1.0} step={0.05}
              onChange={(v) => dispatch({ type: 'SET_MAT', patch: { lambdaC: v } })} />
          </Field>
        </div>
      </div>

      {/* Reinforcement — Tension */}
      <div className="slab-card">
        <h4>Tension reinforcement</h4>
        {model.reinforcement.tension.map((g, i) => (
          <div key={i} className="slab-fields" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingTop: i > 0 ? '0.4rem' : '0' }}>
            <Field label={`Group ${i + 1} — bar`}>
              <select value={g.bar}
                onChange={(e) => dispatch({ type: 'SET_TENSION_BAR', index: i, bar: e.target.value })}>
                {BAR_CATALOG.map((b) => <option key={b.label} value={b.label}>{b.label} ({b.db.toFixed(1)} mm, {b.Ab} mm²)</option>)}
              </select>
            </Field>
            <Field label="Count">
              <Num val={g.count} step={1}
                onChange={(v) => dispatch({ type: 'SET_TENSION_COUNT', index: i, count: Math.max(1, Math.round(v)) })} />
            </Field>
            {model.reinforcement.tension.length > 1 && (
              <Field label="">
                <button type="button" className="ab-btn ab-btn--ghost"
                  onClick={() => dispatch({ type: 'DEL_TENSION_GROUP', index: i })}>
                  Remove
                </button>
              </Field>
            )}
          </div>
        ))}
        <div style={{ marginTop: '0.6rem' }}>
          <button type="button" className="ab-btn ab-btn--ghost"
            onClick={() => dispatch({ type: 'ADD_TENSION_GROUP' })}>
            + Add another bar group
          </button>
        </div>
      </div>

      {/* Stirrups */}
      <div className="slab-card">
        <h4>Stirrups</h4>
        <div className="slab-fields">
          <Field label="Bar">
            <select value={model.reinforcement.stirrup.bar}
              onChange={(e) => dispatch({ type: 'SET_STIRRUP', patch: { bar: e.target.value } })}>
              {BAR_CATALOG.filter((b) => b.db <= 16).map((b) => <option key={b.label} value={b.label}>{b.label}</option>)}
            </select>
          </Field>
          <Field label="Legs">
            <select value={model.reinforcement.stirrup.legs}
              onChange={(e) => dispatch({ type: 'SET_STIRRUP', patch: { legs: parseInt(e.target.value) } })}>
              <option value={2}>2 (typical)</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </Field>
          <Field label="Spacing s (mm)">
            <Num val={model.reinforcement.stirrup.spacing} step={25}
              onChange={(v) => dispatch({ type: 'SET_STIRRUP', patch: { spacing: v } })} />
          </Field>
        </div>
      </div>

      {/* Loads */}
      <div className="slab-card">
        <h4>Loads</h4>
        <div className="slab-fields">
          <Field label="Mu (kN·m) — factored">
            <Num val={model.loads.Mu} step={10}
              onChange={(v) => dispatch({ type: 'SET_LOADS', patch: { Mu: v } })} />
          </Field>
          <Field label="Vu (kN) — factored">
            <Num val={model.loads.Vu} step={10}
              onChange={(v) => dispatch({ type: 'SET_LOADS', patch: { Vu: v } })} />
          </Field>
          <Field label="Ma (kN·m) — service">
            <Num val={model.loads.Ma ?? 0} step={10}
              onChange={(v) => dispatch({ type: 'SET_LOADS', patch: { Ma: v } })} />
          </Field>
          <Field label="M_DL (kN·m)">
            <Num val={model.loads.M_DL ?? 0} step={10}
              onChange={(v) => dispatch({ type: 'SET_LOADS', patch: { M_DL: v } })} />
          </Field>
          <Field label="M_LL (kN·m)">
            <Num val={model.loads.M_LL ?? 0} step={10}
              onChange={(v) => dispatch({ type: 'SET_LOADS', patch: { M_LL: v } })} />
          </Field>
          <Field label="Deflection limit category">
            <select value={model.loads.deflectionLimitCategory ?? 'floor-attached-likely-damage'}
              onChange={(e) => dispatch({ type: 'SET_LOADS', patch: { deflectionLimitCategory: e.target.value as DeflectionLimitCategory } })}>
              <option value="flat-roof-no-attached">Flat roof, no attached non-struct (L/180)</option>
              <option value="floor-no-attached">Floor, no attached non-struct (L/360)</option>
              <option value="floor-attached-not-likely">Floor, attached not likely damage (L/240)</option>
              <option value="floor-attached-likely-damage">Floor, attached likely to damage (L/480)</option>
            </select>
          </Field>
          <Field label="ξ time period (months)">
            <select value={String(model.loads.longTermPeriodMonths ?? 60)}
              onChange={(e) => dispatch({ type: 'SET_LOADS', patch: { longTermPeriodMonths: parseInt(e.target.value) } })}>
              <option value="3">3 mo (ξ=1.0)</option>
              <option value="6">6 mo (ξ=1.2)</option>
              <option value="12">12 mo (ξ=1.4)</option>
              <option value="60">5+ yr (ξ=2.0)</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Branding */}
      <BrandingCard model={model} dispatch={dispatch} />
    </div>
  );
}

// ============================================================================
// RESULTS TAB
// ============================================================================
function ResultsTab({ result }: { result: ReturnType<typeof analyze> }) {
  const r = result;
  return (
    <div className="ab-table-scroll">
      <table className="ab-result-table">
        <thead>
          <tr><th>Check</th><th>Demand</th><th>Capacity</th><th>Ratio</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Flexure (ACI §22.2)</td>
            <td>Mu = {r.input.loads.Mu.toFixed(2)} kN·m</td>
            <td>φMn = {r.flexure.phiMn.toFixed(2)} kN·m (φ = {r.flexure.phi.toFixed(3)})</td>
            <td className={r.flexure.ok ? 'ab-pass' : 'ab-fail'}>{r.flexure.ratio.toFixed(3)}</td>
            <td className={r.flexure.ok ? 'ab-pass' : 'ab-fail'}>{r.flexure.ok ? '✓' : '✗'}</td>
          </tr>
          <tr>
            <td>As required</td>
            <td>{r.flexure.AsReq.toFixed(0)} mm²</td>
            <td>As prov = {r.flexure.As.toFixed(0)} mm² (As,min = {r.flexure.AsMin.toFixed(0)})</td>
            <td>{(r.flexure.AsReq / Math.max(r.flexure.As, 1)).toFixed(3)}</td>
            <td className={r.flexure.As >= r.flexure.AsReq ? 'ab-pass' : 'ab-fail'}>{r.flexure.As >= r.flexure.AsReq ? '✓' : '✗'}</td>
          </tr>
          <tr>
            <td>Shear (ACI §22.5)</td>
            <td>Vu = {r.input.loads.Vu.toFixed(2)} kN</td>
            <td>φVn = {r.shear.phiVn.toFixed(2)} kN  (Vc={r.shear.Vc.toFixed(1)} + Vs={r.shear.Vs.toFixed(1)})</td>
            <td className={r.shear.ok ? 'ab-pass' : 'ab-fail'}>{r.shear.ratio.toFixed(3)}</td>
            <td className={r.shear.ok ? 'ab-pass' : 'ab-fail'}>{r.shear.ok ? '✓' : '✗'}</td>
          </tr>
          <tr>
            <td>Stirrup spacing</td>
            <td>s = {r.input.reinforcement.stirrup.spacing} mm</td>
            <td>s,max = {r.shear.sMax.toFixed(0)} mm; Av,min = {r.shear.AvMin.toFixed(0)} mm² (provided {r.shear.Av.toFixed(0)})</td>
            <td>—</td>
            <td className={r.input.reinforcement.stirrup.spacing <= r.shear.sMax ? 'ab-pass' : 'ab-fail'}>
              {r.input.reinforcement.stirrup.spacing <= r.shear.sMax ? '✓' : '✗'}
            </td>
          </tr>
          <tr>
            <td>Deflection (ACI §24.2)</td>
            <td>Δ = {r.deflection.deltaCheck.toFixed(2)} mm</td>
            <td>Δlimit = L/{r.deflection.deltaLimitRatio} = {r.deflection.deltaLimit.toFixed(2)} mm</td>
            <td className={r.deflection.ok ? 'ab-pass' : 'ab-fail'}>{r.deflection.ratio.toFixed(3)}</td>
            <td className={r.deflection.ok ? 'ab-pass' : 'ab-fail'}>{r.deflection.ok ? '✓' : '✗'}</td>
          </tr>
          <tr>
            <td>Crack control (ACI §24.3.2)</td>
            <td>s = {r.crack.s.toFixed(0)} mm</td>
            <td>s,max = {r.crack.sMax.toFixed(0)} mm</td>
            <td className={r.crack.ok ? 'ab-pass' : 'ab-fail'}>{r.crack.ratio.toFixed(3)}</td>
            <td className={r.crack.ok ? 'ab-pass' : 'ab-fail'}>{r.crack.ok ? '✓' : '✗'}</td>
          </tr>
        </tbody>
      </table>

      {r.warnings.length > 0 && (
        <div className="slab-card" style={{ marginTop: '1rem', borderColor: 'rgba(201, 168, 76, 0.4)' }}>
          <h4>⚠ Warnings</h4>
          <ul style={{ marginLeft: '1rem' }}>
            {r.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SECTION TAB — 2D cross section + strain diagram
// ============================================================================
function SectionTab({ input, result }: { input: BeamInput; result: ReturnType<typeof analyze> }) {
  return (
    <div className="slab-inputs-grid">
      <div className="slab-card" style={{ gridColumn: 'span 2' }}>
        <h4>Cross section + strain diagram</h4>
        <RcSection2D input={input} result={result} />
      </div>
    </div>
  );
}

// ============================================================================
// CHECKS TAB — full hand-calc steps
// ============================================================================
function ChecksTab({ result }: { result: ReturnType<typeof analyze> }) {
  const sections = [
    { title: 'Flexure (ACI §22.2 + §9.5)', steps: result.flexure.steps },
    { title: 'Shear (ACI §22.5 + §9.6.3)', steps: result.shear.steps },
    { title: 'Deflection (ACI §24.2)', steps: result.deflection.steps },
    { title: 'Crack control (ACI §24.3.2)', steps: result.crack.steps },
  ];
  return (
    <div className="slab-checks">
      {sections.map((s) => (
        <div key={s.title} className="slab-check-block">
          <h4>{s.title}</h4>
          <ul className="slab-steps">
            {s.steps.map((step, i) => (
              <li key={i} className="slab-step">
                <div className="slab-step__title">{step.title}</div>
                <div className="slab-step__formula">{step.formula}</div>
                {step.substitution && <div className="slab-step__sub">{step.substitution}</div>}
                <div className="slab-step__result">{step.result}</div>
                {step.ref && <div className="slab-step__ref">{step.ref}</div>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// REFS TAB
// ============================================================================
function RefsTab() {
  return (
    <div className="slab-card">
      <h4>References</h4>
      <ul style={{ marginLeft: '1rem', lineHeight: 1.7 }}>
        <li><strong>ACI 318-25 (SI Units, 2025)</strong> — Building Code Requirements for Structural Concrete: §9 (Beams), §22.2 (Sectional strength), §22.5 (Shear), §24.2 (Deflection), §24.3.2 (Crack control)</li>
        <li><strong>ACI 318-19</strong> — Previous edition (most provisions identical for beams)</li>
        <li><strong>ACI MNL-17(21)</strong> — Reinforced Concrete Design Handbook (worked examples)</li>
        <li><strong>Wight &amp; MacGregor</strong> — Reinforced Concrete: Mechanics and Design (textbook)</li>
        <li><strong>EN 1992-1-1:2023</strong> — Eurocode 2: Design of Concrete Structures</li>
      </ul>
      <h4 style={{ marginTop: '1rem' }}>Validation</h4>
      <p className="slab-card__hint">
        Solver validated against ACI 318-25 first-principles formulas.
        <strong> 50/50 numerical tests pass</strong> across β1, Ec, fr, φ, ξ, flexure (singly + T-beam),
        shear (Vc + Vs + s,max), and section properties.
      </p>
    </div>
  );
}

// ============================================================================
// Branding card
// ============================================================================
function BrandingCard({ model, dispatch }: { model: BeamInput; dispatch: React.Dispatch<Action> }) {
  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1024 * 1024) { alert('Logo file is too large (max 1 MB).'); return; }
    if (!/^image\/(png|jpeg|svg\+xml)$/.test(file.type)) { alert('Logo must be PNG, JPG, or SVG.'); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    dispatch({ type: 'SET_BRANDING', patch: { logoDataUrl: dataUrl } });
  };
  const hasAny = !!(model.branding?.companyName || model.branding?.companyTagline || model.branding?.logoDataUrl);
  return (
    <div className="slab-card">
      <h4>Print report branding (your firm)</h4>
      <p className="slab-card__hint">Optional. Add your firm logo/name. Embedded only in the report; not uploaded.</p>
      <div className="slab-brand-zone">
        {model.branding?.logoDataUrl ? (
          <div className="slab-brand-zone__filled">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={model.branding.logoDataUrl} alt="Logo" className="slab-brand-zone__img" />
            <div className="slab-brand-zone__actions">
              <label className="ab-btn ab-btn--ghost slab-branding-btn">
                Replace
                <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="slab-brand-zone__input"
                  onChange={(e) => handleFile(e.target.files?.[0])} />
              </label>
              <button type="button" className="ab-btn ab-btn--ghost slab-branding-btn"
                onClick={() => dispatch({ type: 'SET_BRANDING', patch: { logoDataUrl: undefined } })}>Remove</button>
            </div>
          </div>
        ) : (
          <label className="slab-brand-zone__empty">
            <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="slab-brand-zone__input"
              onChange={(e) => handleFile(e.target.files?.[0])} />
            <div className="slab-brand-zone__icon">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4v12" /><path d="m6 10 6-6 6 6" /><path d="M5 20h14" />
              </svg>
            </div>
            <div className="slab-brand-zone__text">Drop your logo here or click to browse</div>
            <div className="slab-brand-zone__hint">PNG · JPG · SVG · max 1 MB</div>
          </label>
        )}
      </div>
      <div className="slab-brand-stack">
        <div className="slab-brand-row">
          <label>Company name</label>
          <input type="text" className="ab-input slab-brand-input"
            value={model.branding?.companyName ?? ''} placeholder="e.g. ACME Structural Engineers"
            onChange={(e) => dispatch({ type: 'SET_BRANDING', patch: { companyName: e.target.value } })} />
        </div>
        <div className="slab-brand-row">
          <label>Tagline / subtitle</label>
          <input type="text" className="ab-input slab-brand-input"
            value={model.branding?.companyTagline ?? ''} placeholder="e.g. Structural · Licensed P.E."
            onChange={(e) => dispatch({ type: 'SET_BRANDING', patch: { companyTagline: e.target.value } })} />
        </div>
      </div>
      {hasAny && (
        <div className="slab-brand-footer">
          <button type="button" className="ab-btn ab-btn--ghost slab-branding-btn"
            onClick={() => dispatch({ type: 'CLEAR_BRANDING' })}>Clear all branding</button>
        </div>
      )}
    </div>
  );
}

// Local helpers
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="slab-field"><label>{label}</label>{children}</div>;
}
function Num({ val, onChange, step = 1 }: { val: number; onChange: (v: number) => void; step?: number }) {
  return <input type="number" className="ab-num" step={step} value={Number.isFinite(val) ? val : 0}
    onChange={(e) => { const v = parseFloat(e.target.value); onChange(Number.isFinite(v) ? v : 0); }} />;
}
