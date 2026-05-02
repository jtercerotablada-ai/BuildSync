'use client';

import React, { useMemo, useReducer, useState } from 'react';
import { analyze } from '@/lib/slab/solver';
import {
  BAR_CATALOG,
  CONCRETE_PRESETS,
  REBAR_PRESETS,
  type SlabInput,
  type EdgeCondition,
  type Code,
  type ConcreteGrade,
  type RebarGrade,
  type ColumnPosition,
  type UserRebar,
} from '@/lib/slab/types';
import dynamic from 'next/dynamic';
import { SlabContour } from './SlabContour';
import { SlabPrintReport } from './SlabPrintReport';
const Slab3D = dynamic(() => import('./Slab3D').then((m) => m.Slab3D), {
  ssr: false,
  loading: () => <p className="ab-empty">Loading 3D viewer…</p>,
});

// ----------------------------------------------------------------------------
// State
// ----------------------------------------------------------------------------
type Action =
  | { type: 'LOAD_PRESET'; input: SlabInput }
  | { type: 'SET_CODE'; code: Code }
  | { type: 'SET_GEOM'; patch: Partial<SlabInput['geometry']> }
  | { type: 'SET_EDGE'; side: keyof SlabInput['edges']; value: EdgeCondition }
  | { type: 'SET_MAT'; patch: Partial<SlabInput['materials']> }
  | { type: 'SET_LOAD'; patch: Partial<SlabInput['loads']> }
  | { type: 'TOGGLE_PUNCHING'; on: boolean }
  | { type: 'SET_PUNCH'; patch: Partial<NonNullable<SlabInput['punching']>> }
  | { type: 'SET_USER_REBAR'; location: UserRebar['location']; bar: string; spacing: number }
  | { type: 'CLEAR_USER_REBAR'; location: UserRebar['location'] };

function reducer(state: SlabInput, action: Action): SlabInput {
  switch (action.type) {
    case 'LOAD_PRESET': return action.input;
    case 'SET_CODE':    return { ...state, code: action.code };
    case 'SET_GEOM':    return { ...state, geometry: { ...state.geometry, ...action.patch } };
    case 'SET_EDGE':    return { ...state, edges: { ...state.edges, [action.side]: action.value } };
    case 'SET_MAT':     return { ...state, materials: { ...state.materials, ...action.patch } };
    case 'SET_LOAD':    return { ...state, loads: { ...state.loads, ...action.patch } };
    case 'TOGGLE_PUNCHING':
      if (action.on) {
        return {
          ...state,
          punching: state.punching ?? {
            c1: 300, c2: 300, position: 'interior', Vu: 200, d: undefined,
          },
        };
      }
      const { punching, ...rest } = state;
      void punching;
      return rest as SlabInput;
    case 'SET_PUNCH':
      return state.punching
        ? { ...state, punching: { ...state.punching, ...action.patch } }
        : state;
    case 'SET_USER_REBAR': {
      const others = (state.userRebar ?? []).filter((u) => u.location !== action.location);
      return { ...state, userRebar: [...others, { location: action.location, bar: action.bar, spacing: action.spacing }] };
    }
    case 'CLEAR_USER_REBAR':
      return { ...state, userRebar: (state.userRebar ?? []).filter((u) => u.location !== action.location) };
  }
}

// ----------------------------------------------------------------------------
// Templates
// ----------------------------------------------------------------------------
const PRESETS: { label: string; build: () => SlabInput }[] = [
  {
    label: 'One-way SS (4 × 12, h=180)',
    build: () => ({
      code: 'ACI 318-19', units: 'SI',
      geometry: { Lx: 4, Ly: 12, h: 180 },
      edges: { left: 'simple', right: 'simple', top: 'simple', bottom: 'simple' },
      materials: { fc: 28, fy: 420, concreteGrade: 'fc-28', rebarGrade: 'Gr60' },
      loads: { DL_super: 1.5, LL: 4.8 },
    }),
  },
  {
    label: 'One-way fixed-fixed (4 × 12, h=180)',
    build: () => ({
      code: 'ACI 318-19', units: 'SI',
      geometry: { Lx: 4, Ly: 12, h: 180 },
      edges: { left: 'fixed', right: 'fixed', top: 'simple', bottom: 'simple' },
      materials: { fc: 28, fy: 420, concreteGrade: 'fc-28', rebarGrade: 'Gr60' },
      loads: { DL_super: 1.5, LL: 4.8 },
    }),
  },
  {
    label: 'Two-way SS (5 × 5, h=200)',
    build: () => ({
      code: 'ACI 318-19', units: 'SI',
      geometry: { Lx: 5, Ly: 5, h: 200 },
      edges: { left: 'simple', right: 'simple', top: 'simple', bottom: 'simple' },
      materials: { fc: 28, fy: 420, concreteGrade: 'fc-28', rebarGrade: 'Gr60' },
      loads: { DL_super: 1.5, LL: 4.8 },
    }),
  },
  {
    label: 'Two-way interior panel (5 × 5)',
    build: () => ({
      code: 'ACI 318-19', units: 'SI',
      geometry: { Lx: 5, Ly: 5, h: 200 },
      edges: { left: 'fixed', right: 'fixed', top: 'fixed', bottom: 'fixed' },
      materials: { fc: 28, fy: 420, concreteGrade: 'fc-28', rebarGrade: 'Gr60' },
      loads: { DL_super: 1.5, LL: 4.8 },
    }),
  },
  {
    label: 'Two-way corner panel (5 × 5)',
    build: () => ({
      code: 'ACI 318-19', units: 'SI',
      geometry: { Lx: 5, Ly: 5, h: 200 },
      edges: { left: 'fixed', right: 'simple', top: 'simple', bottom: 'fixed' },
      materials: { fc: 28, fy: 420, concreteGrade: 'fc-28', rebarGrade: 'Gr60' },
      loads: { DL_super: 1.5, LL: 4.8 },
    }),
  },
  {
    label: 'Eurocode interior (5 × 6, C25/30)',
    build: () => ({
      code: 'EN 1992-1-1', units: 'SI',
      geometry: { Lx: 5, Ly: 6, h: 200 },
      edges: { left: 'fixed', right: 'fixed', top: 'fixed', bottom: 'fixed' },
      materials: { fc: 25, fy: 500, concreteGrade: 'C25/30', rebarGrade: 'B500B' },
      loads: { DL_super: 1.5, LL: 4 },
    }),
  },
  {
    label: 'With punching (6 × 6 + interior column)',
    build: () => ({
      code: 'ACI 318-19', units: 'SI',
      geometry: { Lx: 6, Ly: 6, h: 220 },
      edges: { left: 'fixed', right: 'fixed', top: 'fixed', bottom: 'fixed' },
      materials: { fc: 28, fy: 420, concreteGrade: 'fc-28', rebarGrade: 'Gr60' },
      loads: { DL_super: 2.5, LL: 5 },
      punching: { c1: 400, c2: 400, position: 'interior', Vu: 450 },
    }),
  },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------
export function SlabCalculator() {
  const [model, dispatch] = useReducer(reducer, undefined, () => PRESETS[2].build());
  const [tab, setTab] = useState<'inputs' | 'results' | 'rebar' | 'checks' | 'refs'>('inputs');
  const result = useMemo(() => analyze(model), [model]);

  return (
    <div className="ab-root">
      {/* Print-only report (hidden on screen). Triggered by window.print(). */}
      <SlabPrintReport input={model} result={result} />

      {/* Templates */}
      <section className="ab-section">
        <header className="ab-section__header">
          <h3>Templates</h3>
          <p className="ab-section__subtitle">Start from a textbook setup, then edit.</p>
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

      {/* Top bar — code selector */}
      <section className="ab-section ab-topbar">
        <div className="ab-input-group">
          <label htmlFor="slab-code">Design Code</label>
          <select id="slab-code" value={model.code}
            onChange={(e) => dispatch({ type: 'SET_CODE', code: e.target.value as Code })}>
            <option value="ACI 318-25">ACI 318-25 (US, latest)</option>
            <option value="ACI 318-19">ACI 318-19 (US)</option>
            <option value="EN 1992-1-1">EN 1992-1-1 (Eurocode 2)</option>
          </select>
        </div>
        <div className="ab-input-group">
          <label>Classification</label>
          <span className="ab-label">{result.classification === 'one-way' ? 'One-way' : `Two-way (Case ${result.case ?? '?'})`}</span>
        </div>
        <div className="ab-input-group">
          <label>β = L_long / L_short</label>
          <span className="ab-label">{result.beta.toFixed(3)}</span>
        </div>
        <div className="ab-input-group">
          <label>w_u (factored)</label>
          <span className="ab-label">{result.wu.toFixed(2)} kN/m²</span>
        </div>
        <button type="button" className="ab-btn ab-btn--primary slab-print-btn"
          onClick={() => window.print()}>
          ⎙ Print full report
        </button>
      </section>

      {/* View mode toggle + Schematic / 3D */}
      <SlabViews input={model} result={result} />

      {/* Contour plots */}
      {result.solved && (
        <section className="ab-section">
          <header className="ab-section__header">
            <h3>Contour plots (2D)</h3>
            <p className="ab-section__subtitle">Spatial distribution of moments and required reinforcement (Method 3 + shape reconstruction). Toggle Mx / My / As fields.</p>
          </header>
          <SlabContour result={result} />
        </section>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <section className="ab-section ab-warnings">
          {result.warnings.map((w, i) => <div key={i} className="ab-warning">⚠ {w}</div>)}
        </section>
      )}

      {/* Tabs */}
      <section className="ab-section">
        <nav className="ab-tabs" role="tablist">
          {[
            ['inputs',  'Inputs'],
            ['results', `Moments`],
            ['rebar',   `Reinforcement`],
            ['checks',  `Deflection · Punching · Crack`],
            ['refs',    'Code references'],
          ].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k}
              className={`ab-tab ${tab === k ? 'ab-tab--active' : ''}`}
              onClick={() => setTab(k as typeof tab)}>{label}</button>
          ))}
        </nav>

        {tab === 'inputs'  && <InputsTab model={model} dispatch={dispatch} />}
        {tab === 'results' && <MomentsTab result={result} />}
        {tab === 'rebar'   && <ReinforcementTab result={result} model={model} dispatch={dispatch} />}
        {tab === 'checks'  && <ChecksTab result={result} />}
        {tab === 'refs'    && <CodeRefsTab result={result} />}
      </section>
    </div>
  );
}

// ============================================================================
// Inputs tab
// ============================================================================
function SlabViews({ input, result }:
  { input: SlabInput; result: ReturnType<typeof analyze> }) {
  return (
    <section className="ab-section">
      <header className="ab-section__header">
        <h3>Live 3D model</h3>
        <p className="ab-section__subtitle">
          Drag to rotate · scroll to zoom · right-click drag to pan · choose what to color the slab by · toggle deformed shape
        </p>
      </header>
      <div className="ab-schematic-wrap" style={{ padding: 0, border: 'none', background: 'transparent' }}>
        {result.solved
          ? <Slab3D result={result} input={input} />
          : <p className="ab-empty">3D model awaits a solved analysis.</p>}
      </div>
    </section>
  );
}

function InputsTab({ model, dispatch }:
  { model: SlabInput; dispatch: React.Dispatch<Action> }) {
  return (
    <div className="slab-inputs-grid">
      {/* Geometry */}
      <div className="slab-card">
        <h4>Geometry</h4>
        <div className="slab-fields">
          <Field label="Lx (m)"><Num val={model.geometry.Lx} step={0.1}
            onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { Lx: v } })} /></Field>
          <Field label="Ly (m)"><Num val={model.geometry.Ly} step={0.1}
            onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { Ly: v } })} /></Field>
          <Field label="Slab thickness h (mm)"><Num val={model.geometry.h} step={5}
            onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { h: v } })} /></Field>
          <Field label="Cover bottom (x-dir, mm)"><Num val={model.geometry.cover_bottom_x ?? 25} step={5}
            onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { cover_bottom_x: v } })} /></Field>
          <Field label="Cover bottom (y-dir, mm)"><Num val={model.geometry.cover_bottom_y ?? 35} step={5}
            onChange={(v) => dispatch({ type: 'SET_GEOM', patch: { cover_bottom_y: v } })} /></Field>
        </div>
      </div>

      {/* Edges */}
      <div className="slab-card">
        <h4>Edge conditions</h4>
        <p className="slab-card__hint">Set each edge to free / simply supported / fixed (continuous).</p>
        <div className="slab-fields">
          {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
            <Field key={side} label={`${side[0].toUpperCase()}${side.slice(1)} edge`}>
              <select value={model.edges[side]}
                onChange={(e) => dispatch({ type: 'SET_EDGE', side, value: e.target.value as EdgeCondition })}>
                <option value="free">Free</option>
                <option value="simple">Simply supp.</option>
                <option value="fixed">Fixed / continuous</option>
              </select>
            </Field>
          ))}
        </div>
      </div>

      {/* Materials */}
      <div className="slab-card">
        <h4>Materials</h4>
        <div className="slab-fields">
          <Field label="Concrete grade">
            <select value={model.materials.concreteGrade ?? 'custom'}
              onChange={(e) => {
                const g = e.target.value as ConcreteGrade;
                if (g === 'custom') dispatch({ type: 'SET_MAT', patch: { concreteGrade: 'custom' } });
                else dispatch({ type: 'SET_MAT', patch: { concreteGrade: g, fc: CONCRETE_PRESETS[g].fc } });
              }}>
              <option value="custom">Custom</option>
              {Object.entries(CONCRETE_PRESETS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </Field>
          <Field label="f'c (MPa)"><Num val={model.materials.fc} step={1}
            onChange={(v) => dispatch({ type: 'SET_MAT', patch: { fc: v, concreteGrade: 'custom' } })} /></Field>
          <Field label="Rebar grade">
            <select value={model.materials.rebarGrade ?? 'custom'}
              onChange={(e) => {
                const g = e.target.value as RebarGrade;
                if (g === 'custom') dispatch({ type: 'SET_MAT', patch: { rebarGrade: 'custom' } });
                else dispatch({ type: 'SET_MAT', patch: { rebarGrade: g, fy: REBAR_PRESETS[g].fy } });
              }}>
              <option value="custom">Custom</option>
              {Object.entries(REBAR_PRESETS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </Field>
          <Field label="fy (MPa)"><Num val={model.materials.fy} step={10}
            onChange={(v) => dispatch({ type: 'SET_MAT', patch: { fy: v, rebarGrade: 'custom' } })} /></Field>
          <Field label="γc (kN/m³)"><Num val={model.materials.gammaC ?? 24} step={0.5}
            onChange={(v) => dispatch({ type: 'SET_MAT', patch: { gammaC: v } })} /></Field>
        </div>
      </div>

      {/* Loads */}
      <div className="slab-card">
        <h4>Loads</h4>
        <div className="slab-fields">
          <Field label="Super-imposed DL (kN/m²)"><Num val={model.loads.DL_super} step={0.1}
            onChange={(v) => dispatch({ type: 'SET_LOAD', patch: { DL_super: v } })} /></Field>
          <Field label="Live load LL (kN/m²)"><Num val={model.loads.LL} step={0.1}
            onChange={(v) => dispatch({ type: 'SET_LOAD', patch: { LL: v } })} /></Field>
          <Field label="DL self-weight (auto, kN/m²)">
            <span className="ab-label">{((model.materials.gammaC ?? 24) * model.geometry.h / 1000).toFixed(2)}</span>
          </Field>
          <Field label="Override factor DL (—)"><Num val={model.loads.factor_DL ?? (model.code === 'EN 1992-1-1' ? 1.35 : 1.2)} step={0.05}
            onChange={(v) => dispatch({ type: 'SET_LOAD', patch: { factor_DL: v } })} /></Field>
          <Field label="Override factor LL (—)"><Num val={model.loads.factor_LL ?? (model.code === 'EN 1992-1-1' ? 1.5 : 1.6)} step={0.05}
            onChange={(v) => dispatch({ type: 'SET_LOAD', patch: { factor_LL: v } })} /></Field>
        </div>
      </div>

      {/* Long-term deflection settings */}
      <div className="slab-card">
        <h4>Deflection settings</h4>
        <p className="slab-card__hint">ACI Tabla 24.2.2 limits + Tabla 24.2.4.1.3 ξ multiplier</p>
        <div className="slab-fields">
          <Field label="Use case (deflection limit)">
            <select value={model.loads.deflectionLimitCategory ?? 'floor-attached-likely-damage'}
              onChange={(e) => dispatch({ type: 'SET_LOAD', patch: { deflectionLimitCategory: e.target.value as NonNullable<SlabInput['loads']['deflectionLimitCategory']> } })}>
              <option value="flat-roof-no-attached">Flat roof, no attached non-struct (L/180)</option>
              <option value="floor-no-attached">Floor, no attached non-struct (L/360)</option>
              <option value="floor-attached-not-likely">Floor, attached not likely damage (L/240)</option>
              <option value="floor-attached-likely-damage">Floor, attached likely to damage (L/480)</option>
            </select>
          </Field>
          <Field label="Sustained load period (months)">
            <select value={String(model.loads.longTermPeriodMonths ?? 60)}
              onChange={(e) => dispatch({ type: 'SET_LOAD', patch: { longTermPeriodMonths: parseInt(e.target.value) } })}>
              <option value="3">3 months (ξ = 1.0)</option>
              <option value="6">6 months (ξ = 1.2)</option>
              <option value="12">12 months (ξ = 1.4)</option>
              <option value="60">5+ years (ξ = 2.0)</option>
            </select>
          </Field>
          <Field label="Sustained LL fraction ψ (0–1)">
            <Num val={model.loads.sustainedLLFraction ?? 0.25} step={0.05}
              onChange={(v) => dispatch({ type: 'SET_LOAD', patch: { sustainedLLFraction: Math.max(0, Math.min(1, v)) } })} />
          </Field>
        </div>
      </div>

      {/* Punching */}
      <div className="slab-card">
        <h4>
          Punching shear
          <label className="ab-toggle slab-card__toggle">
            <input type="checkbox" checked={!!model.punching}
              onChange={(e) => dispatch({ type: 'TOGGLE_PUNCHING', on: e.target.checked })} />
            <span>Enable</span>
          </label>
        </h4>
        {model.punching ? (
          <div className="slab-fields">
            <Field label="Position">
              <select value={model.punching.position}
                onChange={(e) => dispatch({ type: 'SET_PUNCH', patch: { position: e.target.value as ColumnPosition } })}>
                <option value="interior">Interior</option>
                <option value="edge">Edge</option>
                <option value="corner">Corner</option>
              </select>
            </Field>
            <Field label="Column c1 (mm)"><Num val={model.punching.c1} step={50}
              onChange={(v) => dispatch({ type: 'SET_PUNCH', patch: { c1: v } })} /></Field>
            <Field label="Column c2 (mm)"><Num val={model.punching.c2 ?? model.punching.c1} step={50}
              onChange={(v) => dispatch({ type: 'SET_PUNCH', patch: { c2: v } })} /></Field>
            <Field label="Vu (kN)"><Num val={model.punching.Vu} step={10}
              onChange={(v) => dispatch({ type: 'SET_PUNCH', patch: { Vu: v } })} /></Field>
            <Field label="Mu transfer (kN·m)"><Num val={model.punching.Mu ?? 0} step={5}
              onChange={(v) => dispatch({ type: 'SET_PUNCH', patch: { Mu: v || undefined } })} /></Field>
            <Field label="Drop panel size (mm, 0 = none)"><Num val={model.punching.dropPanelSize ?? 0} step={100}
              onChange={(v) => dispatch({ type: 'SET_PUNCH', patch: { dropPanelSize: v || undefined } })} /></Field>
            <Field label="Drop panel +thickness (mm)"><Num val={model.punching.dropPanelThickness ?? 0} step={25}
              onChange={(v) => dispatch({ type: 'SET_PUNCH', patch: { dropPanelThickness: v || undefined } })} /></Field>
            <Field label="Stud-rail fy (MPa)"><Num val={model.punching.studFy ?? 420} step={10}
              onChange={(v) => dispatch({ type: 'SET_PUNCH', patch: { studFy: v } })} /></Field>
          </div>
        ) : (
          <p className="ab-empty">Disabled — toggle on to add a column and compute v_u / φ·v_c.</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Moments tab
// ============================================================================
function MomentsTab({ result }: { result: ReturnType<typeof analyze> }) {
  const M = result.moments;
  return (
    <div className="ab-table-scroll">
      <table className="ab-result-table">
        <thead><tr><th>Quantity</th><th>X-direction</th><th>Y-direction</th><th>Notes</th></tr></thead>
        <tbody>
          <tr>
            <td data-label="Quantity">Positive midspan M (kN·m / m)</td>
            <td data-label="X" className="ab-label">{M.Mx_pos.toFixed(3)}</td>
            <td data-label="Y" className="ab-label">{M.My_pos.toFixed(3)}</td>
            <td data-label="Notes">sagging</td>
          </tr>
          <tr>
            <td data-label="Quantity">Negative continuous-edge M (kN·m / m)</td>
            <td data-label="X" className="ab-label">{M.Mx_neg.toFixed(3)}</td>
            <td data-label="Y" className="ab-label">{M.My_neg.toFixed(3)}</td>
            <td data-label="Notes">hogging at fixed/continuous edges</td>
          </tr>
          <tr>
            <td data-label="Quantity">Shear at supports V (kN / m)</td>
            <td data-label="X" className="ab-label">{M.Vx.toFixed(3)}</td>
            <td data-label="Y" className="ab-label">{M.Vy.toFixed(3)}</td>
            <td data-label="Notes">tributary load partition</td>
          </tr>
          <tr>
            <td data-label="Quantity">Self-weight (kN/m²)</td>
            <td data-label="X">{result.wSelf.toFixed(2)}</td>
            <td data-label="Y">—</td>
            <td data-label="Notes">γc · h</td>
          </tr>
          <tr>
            <td data-label="Quantity">Service load w (kN/m²)</td>
            <td data-label="X">{result.wService.toFixed(2)}</td>
            <td data-label="Y">—</td>
            <td data-label="Notes">DL+LL unfactored, for SLS</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Reinforcement tab
// ============================================================================
function ReinforcementTab({ result, model, dispatch }:
  { result: ReturnType<typeof analyze>; model: SlabInput; dispatch: React.Dispatch<Action> }) {
  if (result.reinforcement.length === 0) return <p className="ab-empty">No reinforcement computed.</p>;

  const isACI = model.code === 'ACI 318-19' || model.code === 'ACI 318-25';
  const barOptions = isACI
    ? BAR_CATALOG.filter((b) => b.system === 'imperial' && b.db >= 9.5)
    : BAR_CATALOG.filter((b) => b.system === 'metric'   && b.db >= 8);

  return (
    <div>
      <p className="ab-section__subtitle" style={{ marginBottom: '0.75rem' }}>
        Toggle a row to <strong>Edit</strong> and override the auto-selected bar/spacing — the
        solver re-computes As provided, φMn and demand/capacity ratio. ✓ = compliant; ✗ = NOT
        compliant (reasons listed in the hand-calc panel below).
      </p>
      <div className="ab-table-scroll">
        <table className="ab-result-table">
          <thead>
            <tr>
              <th>Location</th><th>Mu (kN·m/m)</th><th>d (mm)</th>
              <th>As req</th><th>As min</th><th>As design</th>
              <th>Bar</th><th>Spacing (mm)</th>
              <th>As prov.</th><th>φMn</th><th>Mu/φMn</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {result.reinforcement.map((r) => {
              const userOverride = (model.userRebar ?? []).find((u) => u.location === r.location);
              return (
                <tr key={r.location} className={r.ok ? '' : 'slab-row-fail'}>
                  <td data-label="Location" className="ab-label">{labelLoc(r.location)}</td>
                  <td data-label="Mu">{r.Mu.toFixed(2)}</td>
                  <td data-label="d">{r.d.toFixed(0)}</td>
                  <td data-label="As req">{r.As_req.toFixed(0)}</td>
                  <td data-label="As min">{r.As_min.toFixed(0)}</td>
                  <td data-label="As design" className="ab-label">{r.As_design.toFixed(0)}</td>
                  <td data-label="Bar">
                    {userOverride ? (
                      <select value={userOverride.bar}
                        onChange={(e) => dispatch({ type: 'SET_USER_REBAR', location: r.location, bar: e.target.value, spacing: userOverride.spacing })}>
                        {barOptions.map((b) => <option key={b.label} value={b.label}>{b.label} (Ab={b.Ab})</option>)}
                      </select>
                    ) : <span>{r.bar}</span>}
                  </td>
                  <td data-label="Spacing">
                    {userOverride ? (
                      <Num val={userOverride.spacing} step={10}
                        onChange={(v) => dispatch({ type: 'SET_USER_REBAR', location: r.location, bar: userOverride.bar, spacing: v })} />
                    ) : <span>{r.spacing.toFixed(0)}</span>}
                  </td>
                  <td data-label="As prov.">{r.As_provided.toFixed(0)}</td>
                  <td data-label="φMn">{r.phiMn_provided.toFixed(2)}</td>
                  <td data-label="Mu/φMn" className={r.utilization > 1 ? 'slab-row__value--bad' : 'slab-row__value--ok'}>
                    {r.utilization.toFixed(3)}
                  </td>
                  <td data-label="Status">
                    {r.source === 'user' ? (
                      <button type="button" className="ab-btn ab-btn--danger"
                        title="Revert to auto"
                        onClick={() => dispatch({ type: 'CLEAR_USER_REBAR', location: r.location })}>↺ Auto</button>
                    ) : (
                      <button type="button" className="ab-btn"
                        title="Override bar / spacing"
                        onClick={() => dispatch({ type: 'SET_USER_REBAR', location: r.location, bar: r.bar, spacing: r.spacing })}>
                        ✏️ Edit
                      </button>
                    )}
                    <span className={r.ok ? 'slab-row__value--ok' : 'slab-row__value--bad'} style={{ marginLeft: '0.4rem' }}>
                      {r.ok ? '✓' : '✗'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="slab-handcalcs">
        <h4>Hand calculations + verification (per location)</h4>
        {result.reinforcement.map((r) => (
          <details key={r.location} className={`slab-handcalc ${r.ok ? '' : 'slab-handcalc--fail'}`}>
            <summary>
              <span className="ab-label">{labelLoc(r.location)}</span>
              <span className="slab-handcalc__sub">
                {r.source === 'user' ? '✏️ user-override · ' : ''}
                Mu = {r.Mu.toFixed(2)} kN·m/m → {r.bar} @ {r.spacing.toFixed(0)} mm,
                As prov = {r.As_provided.toFixed(0)} mm²/m, φMn = {r.phiMn_provided.toFixed(2)} kN·m/m,
                util = {r.utilization.toFixed(3)} {r.ok ? ' ✓' : ' ✗'}
              </span>
            </summary>
            {r.failures.length > 0 && (
              <ul className="slab-fail-list">
                {r.failures.map((f, i) => <li key={i}>⚠ {f}</li>)}
              </ul>
            )}
            {r.steps && <Steps steps={r.steps} />}
          </details>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Checks tab — deflection + punching + crack
// ============================================================================
function ChecksTab({ result }: { result: ReturnType<typeof analyze> }) {
  return (
    <div className="slab-checks-grid">
      <div className="slab-card">
        <h4>Deflection</h4>
        <Row label="Minimum thickness h min" value={`${result.deflection.h_min.toFixed(0)} mm`}
          ok={result.deflection.h_min_ok} />
        {result.deflection.spanDepth !== undefined && (
          <Row label="L/d ratio (EN §7.4.2)" value={`${result.deflection.spanDepth.toFixed(1)} ≤ ${result.deflection.spanDepthLimit?.toFixed(1)}`}
            ok={result.deflection.spanDepthOk} />
        )}
        {result.deflection.delta_immediate !== undefined && (
          <Row label="Δi (full service load)" value={`${result.deflection.delta_immediate.toFixed(2)} mm`} />
        )}
        {result.deflection.delta_immediate_LL !== undefined && (
          <Row label="Δi (LL only)" value={`${result.deflection.delta_immediate_LL.toFixed(2)} mm`} />
        )}
        {result.deflection.xi !== undefined && (
          <Row label="ξ (sustained period)" value={`${result.deflection.xi.toFixed(2)}`} />
        )}
        {result.deflection.longTermFactor !== undefined && (
          <Row label="λΔ = ξ/(1+50ρ′)" value={`${result.deflection.longTermFactor.toFixed(2)}`} />
        )}
        {result.deflection.sustainedLLFraction !== undefined && (
          <Row label="ψ (sustained LL fraction)" value={`${result.deflection.sustainedLLFraction.toFixed(2)}`} />
        )}
        {result.deflection.delta_check !== undefined && (
          <Row label={`Δcheck (Tabla 24.2.2 — L/${result.deflection.delta_limit_ratio})`}
            value={`${result.deflection.delta_check.toFixed(2)} mm  ≤  ${result.deflection.delta_limit.toFixed(2)} mm`}
            ok={result.deflection.delta_ok} />
        )}
        {result.deflection.steps && (
          <details className="slab-handcalc">
            <summary><span className="ab-label">Hand calculation</span></summary>
            <Steps steps={result.deflection.steps} />
          </details>
        )}
      </div>

      <div className="slab-card">
        <h4>Punching shear</h4>
        {result.punching ? (
          <>
            {result.punching.dropPanel && (
              <p className="slab-card__hint">Drop panel: {result.punching.dropPanel.size}×{result.punching.dropPanel.size} mm × +{result.punching.dropPanel.thickness} mm thk → d_eff = {result.punching.dropPanel.d_eff.toFixed(0)} mm</p>
            )}
            <Row label="b₀ (critical perimeter)" value={`${result.punching.bo.toFixed(0)} mm`} />
            <Row label="d (effective depth)" value={`${result.punching.d.toFixed(0)} mm`} />
            <Row label="v_c capacity" value={`${result.punching.vc.toFixed(3)} MPa`} />
            <Row label="v_u demand" value={`${result.punching.vu.toFixed(3)} MPa`} />
            <Row label="Demand / capacity" value={`${result.punching.ratio.toFixed(3)}`}
              ok={result.punching.ok} />
            {result.punching.studRail && (
              <div className="slab-studrail">
                <h5>Stud rail design (ACI 421.1R-20)</h5>
                <Row label="Stud diameter" value={`${result.punching.studRail.studDiameter} mm`} />
                <Row label="Number of rails" value={`${result.punching.studRail.numRails}`} />
                <Row label="Spacing along rail" value={`${result.punching.studRail.spacing.toFixed(0)} mm`} />
                <Row label="Rows per rail" value={`${result.punching.studRail.rows}`} />
                <p className="slab-card__hint">Extend stud rails until punching is satisfied at the outermost perimeter (~ 2d from column).</p>
              </div>
            )}
            {result.punching.needsReinf && !result.punching.studRail && (
              <p className="slab-card__warn">⚠ v_u &gt; φ·v_c — add stud rails / drop panel / increase d / f&apos;c.</p>
            )}
            <p className="slab-card__ref">{result.punching.ref}</p>
            {result.punching.steps && (
              <details className="slab-handcalc">
                <summary><span className="ab-label">Hand calculation</span></summary>
                <Steps steps={result.punching.steps} />
              </details>
            )}
          </>
        ) : (
          <p className="ab-empty">No punching column defined. Enable in Inputs tab.</p>
        )}
      </div>

      <div className="slab-card">
        <h4>Crack control (worst midspan)</h4>
        {result.crackControl ? (
          <>
            <Row label="Service stress fs (≈ 2/3·fy)" value={`${result.crackControl.fs.toFixed(0)} MPa`} />
            <Row label="Spacing used" value={`${result.crackControl.s.toFixed(0)} mm`} />
            <Row label="Max spacing s max" value={`${result.crackControl.s_max.toFixed(0)} mm`}
              ok={result.crackControl.s <= result.crackControl.s_max} />
            {result.crackControl.wk !== undefined && (
              <Row label="Crack width wk (EN §7.3.4)" value={`${result.crackControl.wk.toFixed(3)} mm  ≤  ${result.crackControl.wk_limit?.toFixed(2)} mm`}
                ok={result.crackControl.wk_ok} />
            )}
            <p className="slab-card__ref">{result.crackControl.ref}</p>
            {result.crackControl.steps && (
              <details className="slab-handcalc">
                <summary><span className="ab-label">Hand calculation</span></summary>
                <Steps steps={result.crackControl.steps} />
              </details>
            )}
          </>
        ) : (
          <p className="ab-empty">—</p>
        )}
      </div>
    </div>
  );
}

function Steps({ steps }: { steps: { title: string; formula: string; substitution: string; result: string; ref?: string }[] }) {
  return (
    <ol className="slab-steps">
      {steps.map((s, i) => (
        <li key={i}>
          <div className="slab-step__title">{s.title}</div>
          <div className="slab-step__formula">{s.formula}</div>
          <div className="slab-step__sub">{s.substitution}</div>
          <div className="slab-step__result">{s.result}</div>
          {s.ref && <div className="slab-step__ref">{s.ref}</div>}
        </li>
      ))}
    </ol>
  );
}

// ============================================================================
// Code refs tab
// ============================================================================
function CodeRefsTab({ result }: { result: ReturnType<typeof analyze> }) {
  const code = result.code;
  const aciHeader = code === 'ACI 318-25' ? 'ACI 318-25' : 'ACI 318-19';
  const refs: { area: string; clauses: string[] }[] = (code === 'ACI 318-19' || code === 'ACI 318-25') ? [
    { area: 'Code edition',          clauses: [`${aciHeader} (SI) — same provisions as 318-19 for these checks (§§ identical)`] },
    { area: 'Load factors',          clauses: ['§5.3.1 — basic 1.2D + 1.6L'] },
    { area: 'Two-way moments',       clauses: ['DDM and EFM removed from main text in 318-25 (R6.2.4.1) but permitted via §8.2.1', 'Method 3 (PCA Notes / Appendix A from 318-99) used here as accepted equilibrium-based analysis'] },
    { area: 'One-way coefficients',  clauses: ['§6.5 — simplified coefficients for continuous one-way slabs/beams'] },
    { area: 'Flexure φ',             clauses: ['§22.2.2 — φ = 0.9 for tension-controlled'] },
    { area: 'Min reinforcement',     clauses: ['§7.6.1.1 — shrinkage & temperature ρ ≥ 0.0018·420/fy ≥ 0.0014', '§9.6.1 — flexural minimum'] },
    { area: 'Max bar spacing',       clauses: ['§7.7.2.3 — slabs: lesser of 3h or 450 mm'] },
    { area: 'Crack control',         clauses: ['§24.3.2 — s ≤ 380(280/fs) − 2.5cc and ≤ 300(280/fs)'] },
    { area: 'Min thickness',         clauses: ['Table 7.3.1.1 (one-way), modified by §7.3.1.1.1 factor (0.4 + fy/700)', 'Table 8.3.1.1 (two-way without beams) — interpolated for fy and adjusted for edge beams + drop panels'] },
    { area: 'Deflection',            clauses: ['§24.2.4 — long-term multiplier λ = ξ/(1+50ρ′), ξ=2.0 (5+ years)', 'Branson Ie via Eq. 24.2.3.5a'] },
    { area: 'Punching shear',        clauses: ['§22.6.5.2 — vc = least of 0.33·λs·√fc, (0.17+0.33/β)·λs·√fc, (αs·d/(12·b₀)+0.17)·λs·√fc', '§22.6.5.2.1 — λs = √(2/(1+0.004·d)) ≤ 1', '§22.6.3.1 — √fc capped at 8.3 MPa', '§21.2.1 — φ = 0.75 for shear', '§22.6.7 + ACI 421.1R-20 — stud rails when v_u > φv_c'] },
  ] : [
    { area: 'Load factors',          clauses: ['EN 1990 Table A1.2(B) — γG = 1.35, γQ = 1.5'] },
    { area: 'Two-way moments',       clauses: ['Method 3 (PCA) used as elastic plate analysis acceptable under §5.1.3 simplified analysis'] },
    { area: 'Flexure design',        clauses: ['§6.1 — bending capacity', 'γs = 1.15, γc = 1.5'] },
    { area: 'Min reinforcement',     clauses: ['§9.3.1.1 — As,min = max(0.26·fctm/fyk, 0.0013) · b · d'] },
    { area: 'Max bar spacing',       clauses: ['§9.3.1.1(3) — slabs: ≤ 3h ≤ 400 mm'] },
    { area: 'Crack control',         clauses: ['§7.3.3 Table 7.3N — max spacing for given fs (Tier-1 deemed-to-satisfy)', '§7.3.4 — direct crack-width calculation (deferred to v2)'] },
    { area: 'Span/depth (deflection)', clauses: ['§7.4.2 — basic L/d ratios for ρ ≈ 0.5%: SS=20, end span=26, interior=30'] },
    { area: 'Punching shear',        clauses: ['§6.4.4 — vRdc = max(CRdc·k(100ρl·fck)^(1/3), vmin)', '§6.4.2 — basic control perimeter at 2d'] },
  ];
  return (
    <div className="slab-refs-grid">
      {refs.map((r) => (
        <div className="slab-card" key={r.area}>
          <h4>{r.area}</h4>
          <ul>{r.clauses.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      ))}
      <div className="slab-card slab-card--validation">
        <h4>Validation</h4>
        <p>Solver passes <strong>105/105</strong> unit tests against ACI 318-19, ACI 318-25 and EN 1992-1-1, including:</p>
        <ul>
          <li>Closed-form one-way moments (SS, fixed-fixed)</li>
          <li>PCA Notes Method 3 coefficient lookup (Cases 1–9)</li>
          <li>Hand-calc flexural design (As req, As min)</li>
          <li>Branson Ie cracked-section deflection</li>
          <li>ACI 318 §22.6 punching shear with λ_s size factor and √fc ≤ 8.3 MPa cap</li>
          <li>EN 1992 §6.4.4 punching with basic perimeter at 2d</li>
          <li>Crack-control max spacing per §24.3.2 / §7.3.3</li>
          <li>Min thickness Table 7.3.1.1 with fy modifier (0.4+fy/700)</li>
          <li>Min thickness Table 8.3.1.1 fy interpolation, edge-beam differentiation, drop-panel reduction</li>
          <li>Edge-condition rotational symmetry</li>
          <li>318-25 vs 318-19 numerical equivalence + edition-specific clause refs</li>
          <li>User-editable bar+spacing override + φMn ≥ Mu compliance check (Mu/φMn utilization)</li>
          <li>Tension-controlled φ check (§21.2.2) — εt iterated, φ reduces from 0.9 toward 0.65 in transition zone</li>
          <li>λΔ time-period selector (3 mo/6 mo/12 mo/5+ years) per Tabla 24.2.4.1.3</li>
          <li>Sustained-LL fraction ψ for long-term creep — only sustained portion gets λΔ multiplier</li>
          <li>Tabla 24.2.2 deflection-limit selector (L/180 / L/240 / L/360 / L/480) by use case</li>
          <li>Edge-condition-aware service moment (1/8 SS, 1/14 one-end-cont, 1/24 fixed-fixed)</li>
          <li>Edge-condition-aware deflection coefficient (5/384, 1/185, 1/384)</li>
          <li>Lightweight concrete λ factor (§19.2.4) propagated to fr and vc punching</li>
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// Tiny helpers
// ============================================================================
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="slab-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function Num({ val, onChange, step = 1 }: { val: number; onChange: (v: number) => void; step?: number }) {
  return (
    <input type="number" className="ab-num" step={step} value={Number.isFinite(val) ? val : 0}
      onChange={(e) => { const v = parseFloat(e.target.value); onChange(Number.isFinite(v) ? v : 0); }} />
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="slab-row">
      <span className="slab-row__label">{label}</span>
      <span className={`slab-row__value ${ok === false ? 'slab-row__value--bad' : ok === true ? 'slab-row__value--ok' : ''}`}>
        {value}{ok === true ? '  ✓' : ok === false ? '  ✗' : ''}
      </span>
    </div>
  );
}

function labelLoc(loc: 'mid-x' | 'mid-y' | 'sup-x' | 'sup-y'): string {
  switch (loc) {
    case 'mid-x': return 'Midspan x (bottom)';
    case 'mid-y': return 'Midspan y (bottom)';
    case 'sup-x': return 'Edge x (top)';
    case 'sup-y': return 'Edge y (top)';
  }
}
