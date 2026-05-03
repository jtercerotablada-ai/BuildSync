'use client';

import React, { useMemo, useReducer, useState } from 'react';
import dynamic from 'next/dynamic';
import { analyze } from '@/lib/baseplate/solver';
import {
  type BasePlateInput,
  type DesignMethod,
  type AnchorGrade,
  type WeldElectrode,
  ANCHOR_ROD_SIZES,
  ANCHOR_GRADES,
  COMMON_W_SHAPES,
} from '@/lib/baseplate/types';
import { BasePlatePrintReport } from './BasePlatePrintReport';

const BasePlate3D = dynamic(() => import('./BasePlate3D').then((m) => m.BasePlate3D), {
  ssr: false,
  loading: () => <p className="ab-empty">Loading 3D viewer…</p>,
});

// ============================================================================
// State
// ============================================================================
type Action =
  | { type: 'LOAD_PRESET'; input: BasePlateInput }
  | { type: 'SET_METHOD'; method: DesignMethod }
  | { type: 'SET_COL'; patch: Partial<BasePlateInput['column']> }
  | { type: 'SET_PLATE'; patch: Partial<BasePlateInput['plate']> }
  | { type: 'SET_CONC'; patch: Partial<BasePlateInput['concrete']> }
  | { type: 'SET_ANCH'; patch: Partial<BasePlateInput['anchors']> }
  | { type: 'SET_LOADS'; patch: Partial<BasePlateInput['loads']> }
  | { type: 'SET_WELD'; patch: Partial<BasePlateInput['weld']> }
  | { type: 'SET_BRANDING'; patch: Partial<NonNullable<BasePlateInput['branding']>> }
  | { type: 'CLEAR_BRANDING' };

function reducer(state: BasePlateInput, action: Action): BasePlateInput {
  switch (action.type) {
    case 'LOAD_PRESET':   return action.input;
    case 'SET_METHOD':    return { ...state, method: action.method };
    case 'SET_COL':       return { ...state, column:   { ...state.column,   ...action.patch } };
    case 'SET_PLATE':     return { ...state, plate:    { ...state.plate,    ...action.patch } };
    case 'SET_CONC':      return { ...state, concrete: { ...state.concrete, ...action.patch } };
    case 'SET_ANCH':      return { ...state, anchors:  { ...state.anchors,  ...action.patch } };
    case 'SET_LOADS':     return { ...state, loads:    { ...state.loads,    ...action.patch } };
    case 'SET_WELD':      return { ...state, weld:     { ...state.weld,     ...action.patch } };
    case 'SET_BRANDING':  return { ...state, branding: { ...(state.branding ?? {}), ...action.patch } };
    case 'CLEAR_BRANDING':{ const { branding, ...rest } = state; void branding; return rest as BasePlateInput; }
  }
}

// ============================================================================
// Templates
// ============================================================================
const PRESETS: { label: string; build: () => BasePlateInput }[] = [
  {
    label: 'Axial Compression — W12X65, Pu=700 k (DG1 Ex 4.7-1)',
    build: () => ({
      code: 'AISC 360-22 + ACI 318-25', method: 'LRFD',
      column: { shape: 'W', label: 'W12X65', d: 12.10, bf: 12.00, tf: 0.605, tw: 0.390, Fy: 50 },
      plate:  { B: 18, N: 20, tp: 1.5, tpAuto: false, Fy: 50 },
      concrete: { fc: 4, B2: 18, N2: 20, lambdaA: 1.0, cracked: true },
      anchors: { N: 4, da: 0.75, grade: 'F1554-36', termination: 'hex-nut',
                 hef: 12, sx: 14, sy: 16, edgeDist: 2 },
      loads: { Pu: 700, Mu: 0, Vu: 0 },
      weld:  { electrode: 'E70', size: 0.25, auto: true },
    }),
  },
  {
    label: 'Pure Tension — W10X45, Pu=70 k uplift (DG1 Ex 4.7-3)',
    build: () => ({
      code: 'AISC 360-22 + ACI 318-25', method: 'LRFD',
      column: { shape: 'W', label: 'W10X45', d: 10.10, bf: 8.02, tf: 0.620, tw: 0.350, Fy: 50 },
      plate:  { B: 14, N: 14, tp: 1.0, tpAuto: false, Fy: 50 },
      concrete: { fc: 4, B2: 100, N2: 100, lambdaA: 1.0, cracked: true },
      anchors: { N: 4, da: 0.875, grade: 'F1554-36', termination: 'hex-nut',
                 hef: 15, sx: 4, sy: 4, edgeDist: 5 },
      loads: { Pu: -70, Mu: 0, Vu: 0 },
      weld:  { electrode: 'E70', size: 0.1875, auto: true },
    }),
  },
  {
    label: 'Compression + Large Moment — W12X87 (DG1 Ex 4.7-11)',
    build: () => ({
      code: 'AISC 360-22 + ACI 318-25', method: 'LRFD',
      column: { shape: 'W', label: 'W12X87', d: 12.50, bf: 12.10, tf: 0.810, tw: 0.515, Fy: 50 },
      plate:  { B: 22, N: 24, tp: 2.0, tpAuto: false, Fy: 50 },
      concrete: { fc: 4, B2: 22, N2: 24, lambdaA: 1.0, cracked: true },
      anchors: { N: 4, da: 1.0, grade: 'F1554-36', termination: 'hex-nut',
                 hef: 18, sx: 12, sy: 16.5, edgeDist: 2.75 },
      loads: { Pu: 376, Mu: 3600, Vu: 0 },
      weld:  { electrode: 'E70', size: 0.3125, auto: true },
    }),
  },
  {
    label: 'Combined Compression + Shear — W14X90',
    build: () => ({
      code: 'AISC 360-22 + ACI 318-25', method: 'LRFD',
      column: { shape: 'W', label: 'W14X90', d: 14.0, bf: 14.5, tf: 0.71, tw: 0.44, Fy: 50 },
      plate:  { B: 22, N: 22, tp: 1.25, tpAuto: false, Fy: 50 },
      concrete: { fc: 4, B2: 36, N2: 36, lambdaA: 1.0, cracked: true },
      anchors: { N: 4, da: 1.0, grade: 'F1554-55', termination: 'hex-nut',
                 hef: 18, sx: 16, sy: 16, edgeDist: 3 },
      loads: { Pu: 250, Mu: 600, Vu: 80 },
      weld:  { electrode: 'E70', size: 0.3125, auto: true },
    }),
  },
];

// ============================================================================
// Component
// ============================================================================
export function BasePlateCalculator() {
  const [model, dispatch] = useReducer(reducer, undefined, () => PRESETS[0].build());
  const [tab, setTab] = useState<'inputs' | 'results' | 'anchors' | 'checks' | 'refs'>('inputs');
  const result = useMemo(() => analyze(model), [model]);
  const [cover3dDataUrl, setCover3dDataUrl] = useState<string | undefined>(undefined);

  const handlePrint = () => {
    const canvas = document.querySelector('.bp-3d__canvas canvas') as HTMLCanvasElement | null;
    if (canvas) {
      try { setCover3dDataUrl(canvas.toDataURL('image/png')); }
      catch (e) { console.warn('3D capture failed:', e); }
    }
    setTimeout(() => window.print(), 60);
  };

  return (
    <div className="ab-root">
      <BasePlatePrintReport input={model} result={result} cover3dDataUrl={cover3dDataUrl} />

      {/* Templates */}
      <section className="ab-section">
        <header className="ab-section__header">
          <h3>Templates</h3>
          <p className="ab-section__subtitle">Start from a verified DG1 example, then edit.</p>
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
          <label>Design method</label>
          <select value={model.method}
            onChange={(e) => dispatch({ type: 'SET_METHOD', method: e.target.value as DesignMethod })}>
            <option value="LRFD">LRFD</option>
            <option value="ASD">ASD</option>
          </select>
        </div>
        <div className="ab-input-group">
          <label>Code</label>
          <span className="ab-label">{model.code}</span>
        </div>
        <div className="ab-input-group">
          <label>Load case</label>
          <span className="ab-label">{prettyLoadCase(result.loadCase)}</span>
        </div>
        <div className="ab-input-group">
          <label>Overall</label>
          <span className={`ab-label ${result.ok ? 'ab-pass' : 'ab-fail'}`}>
            {result.ok ? '✓ PASS' : '✗ FAIL'}
          </span>
        </div>
        <button type="button" className="ab-btn ab-btn--primary slab-print-btn"
          onClick={handlePrint}>
          ⎙ Print full report
        </button>
      </section>

      {/* 3D viewer */}
      <section className="ab-section">
        <BasePlate3D input={model} result={result} />
      </section>

      {/* Tabs */}
      <section className="ab-section">
        <div className="ab-tabs">
          {(['inputs','results','anchors','checks','refs'] as const).map((t) => (
            <button key={t} type="button"
              className={`ab-tab ${tab === t ? 'ab-tab--active' : ''}`}
              onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {tab === 'inputs'  && <InputsTab model={model} dispatch={dispatch} />}
        {tab === 'results' && <ResultsTab result={result} />}
        {tab === 'anchors' && <AnchorsTab result={result} />}
        {tab === 'checks'  && <ChecksTab result={result} />}
        {tab === 'refs'    && <RefsTab />}
      </section>
    </div>
  );
}

function prettyLoadCase(c: ReturnType<typeof analyze>['loadCase']): string {
  switch (c) {
    case 'compression': return 'Pure axial compression';
    case 'tension': return 'Pure axial tension (uplift)';
    case 'compression+moment-low': return 'Compression + low moment';
    case 'compression+moment-high': return 'Compression + large moment (anchors in tension)';
    case 'tension+moment': return 'Tension + moment';
    case 'shear-only': return 'Shear only';
  }
}

// ============================================================================
// INPUTS TAB
// ============================================================================
function InputsTab({ model, dispatch }: { model: BasePlateInput; dispatch: React.Dispatch<Action> }) {
  return (
    <div className="slab-inputs-grid">
      {/* Column */}
      <div className="slab-card">
        <h4>Column</h4>
        <div className="slab-fields">
          <Field label="W-shape preset">
            <select value={model.column.label ?? ''}
              onChange={(e) => {
                const sh = COMMON_W_SHAPES.find((s) => s.label === e.target.value);
                if (sh) dispatch({ type: 'SET_COL', patch: { label: sh.label, d: sh.d, bf: sh.bf, tf: sh.tf, tw: sh.tw } });
              }}>
              <option value="">Custom</option>
              {COMMON_W_SHAPES.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="d (in) — depth"><Num val={model.column.d} step={0.1}
            onChange={(v) => dispatch({ type: 'SET_COL', patch: { d: v, label: undefined } })} /></Field>
          <Field label="bf (in) — flange width"><Num val={model.column.bf} step={0.1}
            onChange={(v) => dispatch({ type: 'SET_COL', patch: { bf: v, label: undefined } })} /></Field>
          <Field label="tf (in) — flange thk"><Num val={model.column.tf} step={0.05}
            onChange={(v) => dispatch({ type: 'SET_COL', patch: { tf: v, label: undefined } })} /></Field>
          <Field label="tw (in) — web thk"><Num val={model.column.tw} step={0.05}
            onChange={(v) => dispatch({ type: 'SET_COL', patch: { tw: v, label: undefined } })} /></Field>
          <Field label="Fy (ksi)"><Num val={model.column.Fy} step={5}
            onChange={(v) => dispatch({ type: 'SET_COL', patch: { Fy: v } })} /></Field>
        </div>
      </div>

      {/* Plate */}
      <div className="slab-card">
        <h4>Base plate</h4>
        <div className="slab-fields">
          <Field label="B (in) — width"><Num val={model.plate.B} step={0.5}
            onChange={(v) => dispatch({ type: 'SET_PLATE', patch: { B: v } })} /></Field>
          <Field label="N (in) — length"><Num val={model.plate.N} step={0.5}
            onChange={(v) => dispatch({ type: 'SET_PLATE', patch: { N: v } })} /></Field>
          <Field label="tp (in) — thickness"><Num val={model.plate.tp} step={0.0625}
            onChange={(v) => dispatch({ type: 'SET_PLATE', patch: { tp: v } })} /></Field>
          <Field label="Fy (ksi)"><Num val={model.plate.Fy} step={5}
            onChange={(v) => dispatch({ type: 'SET_PLATE', patch: { Fy: v } })} /></Field>
        </div>
      </div>

      {/* Concrete */}
      <div className="slab-card">
        <h4>Concrete pedestal</h4>
        <div className="slab-fields">
          <Field label="fʹc (ksi)"><Num val={model.concrete.fc} step={0.5}
            onChange={(v) => dispatch({ type: 'SET_CONC', patch: { fc: v } })} /></Field>
          <Field label="B2 (in) — pedestal width"><Num val={model.concrete.B2} step={1}
            onChange={(v) => dispatch({ type: 'SET_CONC', patch: { B2: v } })} /></Field>
          <Field label="N2 (in) — pedestal length"><Num val={model.concrete.N2} step={1}
            onChange={(v) => dispatch({ type: 'SET_CONC', patch: { N2: v } })} /></Field>
          <Field label="λa (concrete factor)"><Num val={model.concrete.lambdaA} step={0.05}
            onChange={(v) => dispatch({ type: 'SET_CONC', patch: { lambdaA: v } })} /></Field>
          <Field label="Concrete state">
            <select value={model.concrete.cracked ? 'cracked' : 'uncracked'}
              onChange={(e) => dispatch({ type: 'SET_CONC', patch: { cracked: e.target.value === 'cracked' } })}>
              <option value="cracked">Cracked (conservative)</option>
              <option value="uncracked">Uncracked</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Anchors */}
      <div className="slab-card">
        <h4>Anchor rods</h4>
        <div className="slab-fields">
          <Field label="N (number of rods)">
            <select value={model.anchors.N}
              onChange={(e) => dispatch({ type: 'SET_ANCH', patch: { N: parseInt(e.target.value) } })}>
              <option value={4}>4 (typical)</option>
              <option value={6}>6</option>
              <option value={8}>8</option>
            </select>
          </Field>
          <Field label="Diameter da (in)">
            <select value={model.anchors.da}
              onChange={(e) => dispatch({ type: 'SET_ANCH', patch: { da: parseFloat(e.target.value) } })}>
              {ANCHOR_ROD_SIZES.map((s) => <option key={s.da} value={s.da}>{s.da.toFixed(3)} in</option>)}
            </select>
          </Field>
          <Field label="Grade">
            <select value={model.anchors.grade}
              onChange={(e) => dispatch({ type: 'SET_ANCH', patch: { grade: e.target.value as AnchorGrade } })}>
              {Object.entries(ANCHOR_GRADES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              <option value="custom">Custom</option>
            </select>
          </Field>
          <Field label="Termination">
            <select value={model.anchors.termination}
              onChange={(e) => dispatch({ type: 'SET_ANCH', patch: { termination: e.target.value as 'hex-nut' | 'hooked' | 'plate-washer' } })}>
              <option value="hex-nut">Heavy hex nut (preferred)</option>
              <option value="plate-washer">Plate washer</option>
              <option value="hooked">Hooked (limited)</option>
            </select>
          </Field>
          <Field label="hef (in) — embedment"><Num val={model.anchors.hef} step={0.5}
            onChange={(v) => dispatch({ type: 'SET_ANCH', patch: { hef: v } })} /></Field>
          <Field label="sx (in) — spacing X"><Num val={model.anchors.sx} step={1}
            onChange={(v) => dispatch({ type: 'SET_ANCH', patch: { sx: v } })} /></Field>
          <Field label="sy (in) — spacing Y"><Num val={model.anchors.sy} step={1}
            onChange={(v) => dispatch({ type: 'SET_ANCH', patch: { sy: v } })} /></Field>
          <Field label="Edge distance (in)"><Num val={model.anchors.edgeDist} step={0.5}
            onChange={(v) => dispatch({ type: 'SET_ANCH', patch: { edgeDist: v } })} /></Field>
        </div>
      </div>

      {/* Loads */}
      <div className="slab-card">
        <h4>Loads (LRFD)</h4>
        <p className="slab-card__hint">+ve compression / -ve tension. Mu about strong axis.</p>
        <div className="slab-fields">
          <Field label="Pu (kips)"><Num val={model.loads.Pu} step={10}
            onChange={(v) => dispatch({ type: 'SET_LOADS', patch: { Pu: v } })} /></Field>
          <Field label="Mu (kip·in)"><Num val={model.loads.Mu} step={50}
            onChange={(v) => dispatch({ type: 'SET_LOADS', patch: { Mu: v } })} /></Field>
          <Field label="Vu (kips)"><Num val={model.loads.Vu} step={5}
            onChange={(v) => dispatch({ type: 'SET_LOADS', patch: { Vu: v } })} /></Field>
        </div>
      </div>

      {/* Weld */}
      <div className="slab-card">
        <h4>Column-to-plate weld</h4>
        <div className="slab-fields">
          <Field label="Electrode">
            <select value={model.weld.electrode}
              onChange={(e) => dispatch({ type: 'SET_WELD', patch: { electrode: e.target.value as WeldElectrode } })}>
              <option value="E60">E60</option>
              <option value="E70">E70 (typical)</option>
              <option value="E80">E80</option>
            </select>
          </Field>
          <Field label="Size w (in)"><Num val={model.weld.size} step={0.0625}
            onChange={(v) => dispatch({ type: 'SET_WELD', patch: { size: v } })} /></Field>
          <Field label="Auto-size">
            <select value={model.weld.auto ? 'yes' : 'no'}
              onChange={(e) => dispatch({ type: 'SET_WELD', patch: { auto: e.target.value === 'yes' } })}>
              <option value="yes">Yes</option>
              <option value="no">No (use size above)</option>
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
          {r.bearing && (
            <tr>
              <td>Concrete bearing (AISC J8)</td>
              <td>{r.bearing.fp.toFixed(3)} ksi · Pu = {r.input.loads.Pu.toFixed(1)} k</td>
              <td>{r.bearing.fpMax.toFixed(3)} ksi · φPp = {r.bearing.PpAvail.toFixed(1)} k</td>
              <td className={r.bearing.ok ? 'ab-pass' : 'ab-fail'}>{r.bearing.ratio.toFixed(3)}</td>
              <td className={r.bearing.ok ? 'ab-pass' : 'ab-fail'}>{r.bearing.ok ? '✓' : '✗'}</td>
            </tr>
          )}
          {r.plateYielding && (
            <tr>
              <td>Plate flexural yielding (DG1)</td>
              <td>tp,req = {r.plateYielding.tpReq.toFixed(3)} in</td>
              <td>tp,prov = {r.plateYielding.tpProvided.toFixed(3)} in</td>
              <td className={r.plateYielding.ok ? 'ab-pass' : 'ab-fail'}>{r.plateYielding.ratio.toFixed(3)}</td>
              <td className={r.plateYielding.ok ? 'ab-pass' : 'ab-fail'}>{r.plateYielding.ok ? '✓' : '✗'}</td>
            </tr>
          )}
          {r.momentInteraction && (
            <tr>
              <td>Moment partition (e vs ecrit)</td>
              <td>e = {r.momentInteraction.e.toFixed(2)} in</td>
              <td>ecrit = {r.momentInteraction.ecrit.toFixed(2)} in · Y = {r.momentInteraction.Y.toFixed(2)} in</td>
              <td>—</td>
              <td className={r.momentInteraction.feasible ? 'ab-pass' : 'ab-fail'}>
                {r.momentInteraction.feasible ? (r.momentInteraction.largeMoment ? 'LARGE' : 'LOW') : '✗ infeasible'}
              </td>
            </tr>
          )}
          {r.anchorTension && (
            <tr>
              <td>Anchor steel tension (ACI 17)</td>
              <td>ru = {r.anchorTension.ru.toFixed(2)} k/rod</td>
              <td>φNsa = {r.anchorTension.NsaAvail.toFixed(2)} k/rod</td>
              <td className={r.anchorTension.ok ? 'ab-pass' : 'ab-fail'}>{r.anchorTension.ratio.toFixed(3)}</td>
              <td className={r.anchorTension.ok ? 'ab-pass' : 'ab-fail'}>{r.anchorTension.ok ? '✓' : '✗'}</td>
            </tr>
          )}
          {r.concretePullout && (
            <tr>
              <td>Concrete pullout (ACI 17.6.3)</td>
              <td>ru = {r.concretePullout.ru.toFixed(2)} k/rod</td>
              <td>φNpn = {r.concretePullout.NpnAvail.toFixed(2)} k/rod</td>
              <td className={r.concretePullout.ok ? 'ab-pass' : 'ab-fail'}>{r.concretePullout.ratio.toFixed(3)}</td>
              <td className={r.concretePullout.ok ? 'ab-pass' : 'ab-fail'}>{r.concretePullout.ok ? '✓' : '✗'}</td>
            </tr>
          )}
          {r.concreteBreakout && (
            <tr>
              <td>Concrete breakout (ACI 17.6.2)</td>
              <td>T = {r.concreteBreakout.T.toFixed(2)} k</td>
              <td>φNcbg = {r.concreteBreakout.NcbgAvail.toFixed(2)} k</td>
              <td className={r.concreteBreakout.ok ? 'ab-pass' : 'ab-fail'}>{r.concreteBreakout.ratio.toFixed(3)}</td>
              <td className={r.concreteBreakout.ok ? 'ab-pass' : 'ab-fail'}>{r.concreteBreakout.ok ? '✓' : '✗'}</td>
            </tr>
          )}
          {r.anchorShear && (
            <tr>
              <td>Anchor shear (ACI 17.7)</td>
              <td>vu = {r.anchorShear.vu.toFixed(2)} k/rod</td>
              <td>φVsa = {r.anchorShear.VsaAvail.toFixed(2)} k/rod</td>
              <td className={r.anchorShear.ok ? 'ab-pass' : 'ab-fail'}>{r.anchorShear.ratio.toFixed(3)}</td>
              <td className={r.anchorShear.ok ? 'ab-pass' : 'ab-fail'}>{r.anchorShear.ok ? '✓' : '✗'}</td>
            </tr>
          )}
          {r.combinedTV && (
            <tr>
              <td>Combined T+V interaction (ACI 17.8)</td>
              <td>T/φNn + V/φVn</td>
              <td>≤ 1.2</td>
              <td className={r.combinedTV.ok ? 'ab-pass' : 'ab-fail'}>{r.combinedTV.ratio.toFixed(3)}</td>
              <td className={r.combinedTV.ok ? 'ab-pass' : 'ab-fail'}>{r.combinedTV.ok ? '✓' : '✗'}</td>
            </tr>
          )}
          {r.weld && (
            <tr>
              <td>Column-to-plate weld (AISC J2)</td>
              <td>wReq = {r.weld.wReq.toFixed(3)} in</td>
              <td>wProv = {r.weld.wProvided.toFixed(3)} in (min {r.weld.wMin.toFixed(3)})</td>
              <td className={r.weld.ok ? 'ab-pass' : 'ab-fail'}>{r.weld.ratio.toFixed(3)}</td>
              <td className={r.weld.ok ? 'ab-pass' : 'ab-fail'}>{r.weld.ok ? '✓' : '✗'}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// ANCHORS TAB
// ============================================================================
function AnchorsTab({ result }: { result: ReturnType<typeof analyze> }) {
  const a = result.input.anchors;
  return (
    <div className="ab-table-scroll">
      <table className="ab-result-table">
        <thead><tr><th>Property</th><th>Value</th><th>Note</th></tr></thead>
        <tbody>
          <tr><td>Number of anchors</td><td>{a.N}</td><td>OSHA min = 4</td></tr>
          <tr><td>Diameter da</td><td>{a.da.toFixed(3)} in</td><td/></tr>
          <tr><td>Grade</td><td>{a.grade === 'custom' ? 'custom' : ANCHOR_GRADES[a.grade].label}</td><td/></tr>
          <tr><td>Termination</td><td>{a.termination}</td><td/></tr>
          <tr><td>Embedment hef</td><td>{a.hef.toFixed(2)} in</td><td/></tr>
          <tr><td>Spacing sx × sy</td><td>{a.sx.toFixed(2)} × {a.sy.toFixed(2)} in</td><td/></tr>
          <tr><td>Edge distance ca,min</td><td>{a.edgeDist.toFixed(2)} in</td><td>min recommended ≥ 4·da</td></tr>
          {result.concreteBreakout && (<>
            <tr><td>Group projected area ANc</td><td>{result.concreteBreakout.ANc.toFixed(0)} in²</td><td/></tr>
            <tr><td>Single anchor area ANco</td><td>{result.concreteBreakout.ANco.toFixed(0)} in²</td><td>= 9·hef²</td></tr>
            <tr><td>Edge factor ψed,N</td><td>{result.concreteBreakout.psiEdN.toFixed(3)}</td><td/></tr>
            <tr><td>Cracking factor ψc,N</td><td>{result.concreteBreakout.psiCN.toFixed(3)}</td><td/></tr>
            <tr><td>Single anchor breakout Nb</td><td>{result.concreteBreakout.Nb.toFixed(2)} kips</td><td/></tr>
            <tr><td>Group breakout Ncbg</td><td>{result.concreteBreakout.Ncbg.toFixed(2)} kips</td><td/></tr>
            <tr><td>Available φNcbg</td><td>{result.concreteBreakout.NcbgAvail.toFixed(2)} kips</td><td/></tr>
          </>)}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// CHECKS TAB — full hand-calc steps
// ============================================================================
function ChecksTab({ result }: { result: ReturnType<typeof analyze> }) {
  const sections: { title: string; steps?: { title: string; formula: string; substitution: string; result: string; ref?: string }[] }[] = [
    { title: 'Concrete bearing', steps: result.bearing?.steps },
    { title: 'Plate flexural yielding', steps: result.plateYielding?.steps },
    { title: 'Moment / eccentricity', steps: result.momentInteraction?.steps },
    { title: 'Anchor steel tension', steps: result.anchorTension?.steps },
    { title: 'Concrete pullout', steps: result.concretePullout?.steps },
    { title: 'Concrete breakout', steps: result.concreteBreakout?.steps },
    { title: 'Anchor steel shear', steps: result.anchorShear?.steps },
    { title: 'Combined T+V interaction', steps: result.combinedTV?.steps },
    { title: 'Column-to-plate weld', steps: result.weld?.steps },
  ];
  return (
    <div className="slab-checks">
      {sections.filter((s) => s.steps && s.steps.length > 0).map((s) => (
        <div key={s.title} className="slab-check-block">
          <h4>{s.title}</h4>
          <ul className="slab-steps">
            {s.steps!.map((step, i) => (
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
        <li><strong>AISC Design Guide 1, 3rd Edition (2024)</strong> — &ldquo;Base Connection Design for Steel Structures&rdquo; by Amit Kanvinde, Mahmoud Maamouri &amp; Joshua Buckholt. Chapters 4 (Exposed) + Appendix B (Triangular pressure).</li>
        <li><strong>AISC 360-22</strong> — Specification for Structural Steel Buildings: §J2 (Welds), §J3 (Bolts &amp; threaded parts), §J8 (Concrete bearing).</li>
        <li><strong>ACI 318-25</strong> — Building Code Requirements for Structural Concrete: Chapter 17 (Anchoring to Concrete) — §17.6 (tension) and §17.7 (shear), §17.8 (interaction).</li>
        <li><strong>OSHA 29 CFR 1926 Subpart R</strong> — Steel Erection: minimum 4 anchor rods.</li>
      </ul>
      <h4 style={{ marginTop: '1rem' }}>Validation</h4>
      <p className="slab-card__hint">
        Solver verified against worked examples 4.7-1 (axial compression), 4.7-3 (axial tension), and 4.7-11 (large moment) from
        AISC Design Guide 1, 3rd Edition. 34/34 numerical checks pass within 0.18% relative error.
      </p>
    </div>
  );
}

// ============================================================================
// Branding card (reused pattern from slab tool)
// ============================================================================
function BrandingCard({ model, dispatch }: { model: BasePlateInput; dispatch: React.Dispatch<Action> }) {
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

// ============================================================================
// Helpers (local copies to avoid cross-tool coupling)
// ============================================================================
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="slab-field"><label>{label}</label>{children}</div>;
}
function Num({ val, onChange, step = 1 }: { val: number; onChange: (v: number) => void; step?: number }) {
  return <input type="number" className="ab-num" step={step} value={Number.isFinite(val) ? val : 0}
    onChange={(e) => { const v = parseFloat(e.target.value); onChange(Number.isFinite(v) ? v : 0); }} />;
}
