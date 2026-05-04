'use client';

import React, { useMemo, useReducer, useState } from 'react';
import dynamic from 'next/dynamic';
import { analyze, analyzeEnvelope } from '@/lib/rc/solver';
import {
  type BeamInput,
  type BeamAnalysis,
  type BeamEnvelopeInput,
  type DemandSource,
  type PointLoad,
  type ManualStation,
  type SectionShape,
  type Code,
  type DesignMethod,
  type DeflectionLimitCategory,
  BAR_CATALOG,
  CONCRETE_PRESETS,
  REBAR_PRESETS,
  lookupBar,
} from '@/lib/rc/types';
import { RcPrintReport } from './RcPrintReport';
import { RcSection2D } from './RcSection2D';
import { RcEnvelopeDiagram } from './RcEnvelopeDiagram';
import { RcBeamElevation } from './RcBeamElevation';

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
  | { type: 'SET_COMPRESSION'; list: NonNullable<BeamInput['reinforcement']['compression']> }
  | { type: 'SET_SKIN'; skin: NonNullable<BeamInput['reinforcement']['skin']> }
  | { type: 'SET_BRANDING'; patch: Partial<NonNullable<BeamInput['branding']>> }
  | { type: 'CLEAR_BRANDING' };

function reducer(state: BeamInput, action: Action): BeamInput {
  switch (action.type) {
    case 'LOAD_PRESET': return action.input;
    case 'SET_CODE':    return { ...state, code: action.code };
    case 'SET_METHOD':  return { ...state, method: action.method };
    case 'SET_GEOM': {
      const next: BeamInput['geometry'] = { ...state.geometry, ...action.patch };
      // Auto-populate bf/hf when shape changes to non-rectangular (so the form
      // is never silently in a "T-beam selected but bf/hf undefined" state).
      const shapeChanged = action.patch.shape && action.patch.shape !== state.geometry.shape;
      if (shapeChanged && next.shape !== 'rectangular') {
        if (next.hf === undefined) next.hf = 120;        // typical slab thickness
        if (next.bf === undefined) {
          // ACI §6.3.2 effective width — sensible default per shape:
          //   T-beam   → bf = min(L/4, bw + 16·hf)
          //   L-beam   → bf = min(L/12 + bw, bw + 6·hf)   (smaller, asymmetric)
          //   inv-T    → same as T-beam
          const hf = next.hf ?? 120;
          if (next.shape === 'L-beam') {
            next.bf = Math.min(next.L / 12 + next.bw, next.bw + 6 * hf, next.bw + 600);
          } else {
            next.bf = Math.min(next.L / 4, next.bw + 16 * hf, next.bw + 1200);
          }
          // Round to nearest 50 mm for cleanliness
          next.bf = Math.round(next.bf / 50) * 50;
        }
      }
      return { ...state, geometry: next };
    }
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
    case 'SET_COMPRESSION':
      return { ...state, reinforcement: { ...state.reinforcement, compression: action.list } };
    case 'SET_SKIN':
      return { ...state, reinforcement: { ...state.reinforcement, skin: action.skin } };
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
      geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, dPrime: 50, L: 6000, coverClear: 40 },
      materials: { fc: 28, fy: 420, fyt: 420, aggSize: 19, exposure: 'interior' },
      reinforcement: {
        tension: [{ bar: '#9', count: 4 }],
        compression: [{ bar: '#4', count: 2 }],   // hanger bars
        stirrup: { bar: '#3', legs: 2, spacing: 200 },
      },
      loads: { Mu: 350, Vu: 200, Ma: 230, M_DL: 140, M_LL: 90, deflectionLimitCategory: 'floor-attached-likely-damage' },
    }),
  },
  {
    label: 'T-Beam — bf=600, hf=120, bw=300, 4#9',
    build: () => ({
      code: 'ACI 318-25', method: 'LRFD',
      geometry: { shape: 'T-beam', bw: 300, h: 600, d: 540, bf: 600, hf: 120, dPrime: 50, L: 7000, coverClear: 40 },
      materials: { fc: 28, fy: 420, fyt: 420, aggSize: 19, exposure: 'interior' },
      reinforcement: {
        tension: [{ bar: '#9', count: 4 }],
        compression: [{ bar: '#4', count: 2 }],   // hanger bars
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
      materials: { fc: 35, fy: 420, fyt: 420, aggSize: 19, exposure: 'interior' },
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
      geometry: { shape: 'rectangular', bw: 350, h: 700, d: 630, dPrime: 50, L: 8000, coverClear: 40 },
      materials: { fc: 42, fy: 420, fyt: 420, aggSize: 19, exposure: 'interior' },
      reinforcement: {
        tension: [{ bar: '#10', count: 5 }],
        compression: [{ bar: '#4', count: 2 }],
        stirrup: { bar: '#4', legs: 2, spacing: 200 },
      },
      loads: { Mu: 700, Vu: 350, Ma: 470, M_DL: 280, M_LL: 190, deflectionLimitCategory: 'floor-attached-likely-damage' },
    }),
  },
  {
    label: 'Deep beam (h=1100) — skin reinforcement required',
    build: () => ({
      code: 'ACI 318-25', method: 'LRFD',
      geometry: { shape: 'rectangular', bw: 500, h: 1100, d: 1020, dPrime: 50, L: 9000, coverClear: 50 },
      materials: { fc: 35, fy: 420, fyt: 420, aggSize: 19, exposure: 'interior' },
      reinforcement: {
        tension: [{ bar: '#10', count: 6 }],
        compression: [{ bar: '#4', count: 2 }],
        stirrup: { bar: '#4', legs: 2, spacing: 200 },
        skin: { bar: '#4', countPerFace: 4 },
      },
      loads: { Mu: 1200, Vu: 500, Ma: 800, M_DL: 480, M_LL: 320, deflectionLimitCategory: 'floor-attached-likely-damage' },
    }),
  },
];

// ============================================================================
// Default demand (simply-supported, derived to roughly match the first preset)
// ============================================================================
const DEFAULT_DEMAND: DemandSource = {
  kind: 'simply-supported',
  udl: { wu: 60 },
  point: [{ x: 3000, Pu: 30 }],
  nStations: 21,
};

// ============================================================================
// Component
// ============================================================================
type Engine = 'single' | 'envelope';
type Tab = 'inputs' | 'stations' | 'section' | 'checks' | 'detailing' | 'elevation' | 'refs';

export function RcCalculator() {
  const [model, dispatch] = useReducer(reducer, undefined, () => PRESETS[0].build());
  const [engine, setEngine] = useState<Engine>('envelope');
  const [demand, setDemand] = useState<DemandSource>(DEFAULT_DEMAND);
  const [tab, setTab] = useState<Tab>('inputs');
  const [cover3dDataUrl, setCover3dDataUrl] = useState<string | undefined>(undefined);

  // Single-section result (always computed; cheap)
  const singleResult = useMemo(() => analyze(model), [model]);

  // Envelope result (only when in envelope mode)
  const envInput: BeamEnvelopeInput = useMemo(() => ({
    code: model.code,
    method: model.method,
    geometry: model.geometry,
    materials: model.materials,
    reinforcement: model.reinforcement,
    demand,
    loads: model.loads,
    branding: model.branding,
  }), [model, demand]);
  const envResult = useMemo(() => analyzeEnvelope(envInput), [envInput]);

  // The result object the existing tabs (Section, Checks, Results, 3D, Print) consume.
  // In envelope mode we synthesize a BeamAnalysis from the worst-station checks.
  const result: BeamAnalysis = useMemo(() => {
    if (engine === 'single') return singleResult;
    // Synthesize a BeamInput at the worst station so 3D/Section components show governing case
    const worstFlexStn = envResult.stations.reduce(
      (a, b) => (b.flexureRatio > a.flexureRatio ? b : a),
      envResult.stations[0] ?? { Mu: 0, Vu: 0, x: 0, phiMn: 0, phiVn: 0, flexureRatio: 0, shearRatio: 0, ok: true } as never,
    );
    const worstShrStn = envResult.stations.reduce(
      (a, b) => (b.shearRatio > a.shearRatio ? b : a),
      envResult.stations[0] ?? { Mu: 0, Vu: 0, x: 0, phiMn: 0, phiVn: 0, flexureRatio: 0, shearRatio: 0, ok: true } as never,
    );
    const synthInput: BeamInput = {
      ...model,
      loads: { ...model.loads, Mu: Math.abs(worstFlexStn.Mu), Vu: Math.abs(worstShrStn.Vu) },
    };
    return {
      input: synthInput,
      flexure: envResult.flexureWorst,
      shear: envResult.shearWorst,
      deflection: envResult.deflection,
      crack: envResult.crack,
      detailing: envResult.detailing,
      torsion: envResult.torsion,
      selfWeight: envResult.selfWeight,
      sectionType: envResult.sectionType,
      warnings: envResult.warnings,
      ok: envResult.ok,
      solved: envResult.solved,
    };
  }, [engine, singleResult, envResult, model]);

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

      {/* Status banner — semáforo with governing-failure narrative (envelope mode) */}
      {engine === 'envelope' && envResult.solved && (
        <section className={`rc-status ${envResult.ok ? 'rc-status--pass' : 'rc-status--fail'}`}>
          <div className="rc-status__icon">{envResult.ok ? '✓' : '✗'}</div>
          <div className="rc-status__text">
            <strong>{envResult.governing.narrativeEn}</strong>
            <span className="rc-status__es">{envResult.governing.narrativeEs}</span>
            {envResult.governing.actionEn && (
              <span className="rc-status__action">→ {envResult.governing.actionEn} / {envResult.governing.actionEs}</span>
            )}
          </div>
        </section>
      )}

      {/* Top bar */}
      <section className="ab-section ab-topbar">
        <div className="ab-input-group">
          <label>Engine</label>
          <select value={engine} onChange={(e) => {
            setEngine(e.target.value as Engine);
          }}>
            <option value="envelope">Envelope (multi-section)</option>
            <option value="single">Single section</option>
          </select>
        </div>
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
          <label>{engine === 'envelope' ? 'Worst Mu/φMn' : 'φMn provided'}</label>
          <span className={`ab-label ${result.flexure.ok ? 'ab-pass' : 'ab-fail'}`}>
            {engine === 'envelope'
              ? `${(envResult.maxFlexureRatio * 100).toFixed(1)}%`
              : `${result.flexure.phiMn.toFixed(2)} kN·m`}
          </span>
        </div>
        <div className="ab-input-group">
          <label>Overall</label>
          <span className={`ab-label ${(engine === 'envelope' ? envResult.ok : result.ok) ? 'ab-pass' : 'ab-fail'}`}>
            {(engine === 'envelope' ? envResult.ok : result.ok) ? '✓ PASS' : '✗ FAIL'}
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

      {/* ALWAYS-VISIBLE envelope diagram (engine=envelope) — visual headline */}
      {engine === 'envelope' && (
        <section className="ab-section rc-env-headline">
          <RcEnvelopeDiagram result={envResult} lang="en" />
        </section>
      )}

      {/* Tabs — workflow order: Inputs → Stations → Section → Checks → Detailing → Elevation → Refs */}
      <section className="ab-section">
        <div className="ab-tabs">
          {(engine === 'envelope'
            ? (['inputs', 'stations', 'section', 'checks', 'detailing', 'elevation', 'refs'] as const)
            : (['inputs', 'section', 'checks', 'detailing', 'refs'] as const)
          ).map((t) => (
            <button key={t} type="button"
              className={`ab-tab ${tab === t ? 'ab-tab--active' : ''}`}
              onClick={() => setTab(t as Tab)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {tab === 'inputs'     && <InputsTab model={model} dispatch={dispatch} engine={engine} demand={demand} setDemand={setDemand} />}
        {tab === 'stations'   && engine === 'envelope' && <StationsTab envResult={envResult} />}
        {tab === 'section'    && <SectionTab input={model} result={result} />}
        {tab === 'checks'     && <ChecksTab result={result} />}
        {tab === 'detailing'  && <DetailingTab input={model} result={result} />}
        {tab === 'elevation'  && engine === 'envelope' && envResult.elevation && (
          <ElevationTab input={model} elevation={envResult.elevation} />
        )}
        {tab === 'refs'       && <RefsTab />}
      </section>
    </div>
  );
}

// ============================================================================
// ELEVATION TAB — beam side-view drawing + bar schedule + zones (Phase 3)
// ============================================================================
function ElevationTab({ input, elevation }: {
  input: BeamInput;
  elevation: NonNullable<ReturnType<typeof analyzeEnvelope>['elevation']>;
}) {
  return (
    <div className="rc-elevation-tab">
      <div className={`rc-status ${elevation.zoning.ok && elevation.curtailment.ok ? 'rc-status--pass' : 'rc-status--fail'}`} style={{ marginBottom: '0.8rem' }}>
        <div className="rc-status__icon">{elevation.zoning.ok && elevation.curtailment.ok ? '✓' : '⚠'}</div>
        <div className="rc-status__text">
          <strong>{elevation.zoning.narrativeEn} {elevation.curtailment.narrativeEn}</strong>
          <span className="rc-status__es">{elevation.zoning.narrativeEs} {elevation.curtailment.narrativeEs}</span>
        </div>
      </div>
      <RcBeamElevation input={input} elevation={elevation} lang="en" />
    </div>
  );
}

// ============================================================================
// STATIONS TAB — table of all envelope stations
// ============================================================================
function StationsTab({ envResult }: { envResult: ReturnType<typeof analyzeEnvelope> }) {
  return (
    <div className="rc-env-tab__table-wrap">
      <h4 className="rc-env-tab__sub">Stations (x in m, ratios as Mu/φMn or Vu/φVn)</h4>
      <div className="ab-table-scroll">
        <table className="ab-result-table">
          <thead>
            <tr>
              <th>x (m)</th>
              <th>Mu (kN·m)</th>
              <th>φMn (kN·m)</th>
              <th>Mu/φMn</th>
              <th>Vu (kN)</th>
              <th>φVn (kN)</th>
              <th>Vu/φVn</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {envResult.stations.map((s, i) => (
              <tr key={i} className={!s.ok ? 'ab-row-fail' : undefined}>
                <td>{(s.x / 1000).toFixed(2)}</td>
                <td>{s.Mu.toFixed(1)}</td>
                <td>{s.phiMn.toFixed(1)}</td>
                <td className={s.flexureRatio > 1 ? 'ab-fail' : 'ab-pass'}>{(s.flexureRatio * 100).toFixed(1)}%</td>
                <td>{s.Vu.toFixed(1)}</td>
                <td>{s.phiVn.toFixed(1)}</td>
                <td className={s.shearRatio > 1 ? 'ab-fail' : 'ab-pass'}>{(s.shearRatio * 100).toFixed(1)}%</td>
                <td>{s.ok ? '✓' : '✗'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// DEMAND CARD — choose source (manual / simply-supported) + edit values
// ============================================================================
function DemandCard({
  demand, setDemand, L,
}: {
  demand: DemandSource;
  setDemand: (d: DemandSource) => void;
  L: number;
}) {
  const kind = demand.kind;
  return (
    <div className="slab-card rc-demand">
      <h4>Demand source</h4>
      <div className="slab-fields">
        <Field label="Mode">
          <select value={kind} onChange={(e) => {
            const next = e.target.value as DemandSource['kind'];
            if (next === 'simply-supported') {
              setDemand({ kind: 'simply-supported', udl: { wu: 60 }, point: [{ x: L / 2, Pu: 30 }], nStations: 21 });
            } else {
              setDemand({
                kind: 'manual',
                stations: [
                  { x: 0, Mu: 0, Vu: 200 },
                  { x: L / 2, Mu: 350, Vu: 0 },
                  { x: L, Mu: 0, Vu: 200 },
                ],
              });
            }
          }}>
            <option value="simply-supported">Simply-supported (UDL + point loads)</option>
            <option value="manual">Manual stations (x, Mu, Vu)</option>
          </select>
        </Field>
      </div>

      {kind === 'simply-supported' && demand.kind === 'simply-supported' && (
        <>
          <div className="slab-fields" style={{ marginTop: '0.5rem' }}>
            <Field label="wu — UDL (kN/m)">
              <Num val={demand.udl?.wu ?? 0} step={5}
                onChange={(v) => setDemand({ ...demand, udl: { wu: v } })} />
            </Field>
            <Field label="N stations">
              <Num val={demand.nStations ?? 21} step={1}
                onChange={(v) => setDemand({ ...demand, nStations: Math.max(3, Math.min(101, Math.round(v))) })} />
            </Field>
          </div>
          <div className="rc-demand__points">
            <div className="rc-demand__points-hdr">
              <h5>Point loads</h5>
              <button type="button" className="ab-btn ab-btn--ghost"
                onClick={() => setDemand({ ...demand, point: [...demand.point, { x: L / 2, Pu: 20 }] })}>
                + Add point load
              </button>
            </div>
            {demand.point.length === 0 && <p className="ab-empty">No point loads. Use UDL only or add some.</p>}
            {demand.point.map((p: PointLoad, i: number) => (
              <div key={i} className="slab-fields">
                <Field label={`P${i + 1} — x (mm)`}>
                  <Num val={p.x} step={250}
                    onChange={(v) => {
                      const np = [...demand.point];
                      np[i] = { ...np[i], x: Math.max(0, Math.min(L, v)) };
                      setDemand({ ...demand, point: np });
                    }} />
                </Field>
                <Field label={`P${i + 1} — Pu (kN)`}>
                  <Num val={p.Pu} step={5}
                    onChange={(v) => {
                      const np = [...demand.point];
                      np[i] = { ...np[i], Pu: v };
                      setDemand({ ...demand, point: np });
                    }} />
                </Field>
                <Field label="">
                  <button type="button" className="ab-btn ab-btn--ghost"
                    onClick={() => setDemand({ ...demand, point: demand.point.filter((_: PointLoad, j: number) => j !== i) })}>
                    Remove
                  </button>
                </Field>
              </div>
            ))}
          </div>
        </>
      )}

      {kind === 'manual' && demand.kind === 'manual' && (
        <div className="rc-demand__points">
          <div className="rc-demand__points-hdr">
            <h5>Stations (x_mm, Mu_kNm, Vu_kN)</h5>
            <button type="button" className="ab-btn ab-btn--ghost"
              onClick={() => setDemand({ ...demand, stations: [...demand.stations, { x: L / 2, Mu: 0, Vu: 0 }] })}>
              + Add station
            </button>
          </div>
          {demand.stations.map((s: ManualStation, i: number) => (
            <div key={i} className="slab-fields">
              <Field label="x (mm)">
                <Num val={s.x} step={250}
                  onChange={(v) => {
                    const ns = [...demand.stations];
                    ns[i] = { ...ns[i], x: Math.max(0, Math.min(L, v)) };
                    setDemand({ ...demand, stations: ns });
                  }} />
              </Field>
              <Field label="Mu (kN·m)">
                <Num val={s.Mu} step={10}
                  onChange={(v) => {
                    const ns = [...demand.stations];
                    ns[i] = { ...ns[i], Mu: v };
                    setDemand({ ...demand, stations: ns });
                  }} />
              </Field>
              <Field label="Vu (kN)">
                <Num val={s.Vu} step={10}
                  onChange={(v) => {
                    const ns = [...demand.stations];
                    ns[i] = { ...ns[i], Vu: v };
                    setDemand({ ...demand, stations: ns });
                  }} />
              </Field>
              <Field label="">
                <button type="button" className="ab-btn ab-btn--ghost"
                  onClick={() => setDemand({ ...demand, stations: demand.stations.filter((_: ManualStation, j: number) => j !== i) })}>
                  Remove
                </button>
              </Field>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// INPUTS TAB
// ============================================================================
function InputsTab({ model, dispatch, engine, demand, setDemand }: {
  model: BeamInput;
  dispatch: React.Dispatch<Action>;
  engine: Engine;
  demand: DemandSource;
  setDemand: (d: DemandSource) => void;
}) {
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
          <Field label="dagg — max aggregate (mm)">
            <Num val={model.materials.aggSize ?? 19} step={1}
              onChange={(v) => dispatch({ type: 'SET_MAT', patch: { aggSize: v } })} />
          </Field>
          <Field label="Exposure (cover §20.5.1.3)">
            <select value={model.materials.exposure ?? 'interior'}
              onChange={(e) => dispatch({ type: 'SET_MAT', patch: { exposure: e.target.value as 'interior' | 'exterior' | 'cast-against-ground' } })}>
              <option value="interior">Interior (40 mm min)</option>
              <option value="exterior">Exterior (50 mm min)</option>
              <option value="cast-against-ground">Cast against ground (75 mm min)</option>
            </select>
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

      {/* Compression / hanger bars */}
      <div className="slab-card">
        <h4>Top bars (compression / hangers §9.7.6.4)</h4>
        <p className="ab-empty" style={{ marginBottom: '0.4rem' }}>
          At least 2 top bars are needed to support the stirrup cage (Wight §5-3). They also act as compression
          steel if the section is doubly-reinforced.
        </p>
        {(model.reinforcement.compression ?? []).map((bg, i) => (
          <div key={i} className="slab-fields">
            <Field label={`Top group ${i + 1} — bar`}>
              <select value={bg.bar}
                onChange={(e) => {
                  const arr = [...(model.reinforcement.compression ?? [])];
                  arr[i] = { ...arr[i], bar: e.target.value };
                  dispatch({ type: 'SET_COMPRESSION', list: arr });
                }}>
                {BAR_CATALOG.map((b) => <option key={b.label} value={b.label}>{b.label} ({b.db.toFixed(1)} mm)</option>)}
              </select>
            </Field>
            <Field label="Count">
              <Num val={bg.count} step={1}
                onChange={(v) => {
                  const arr = [...(model.reinforcement.compression ?? [])];
                  arr[i] = { ...arr[i], count: Math.max(1, Math.round(v)) };
                  dispatch({ type: 'SET_COMPRESSION', list: arr });
                }} />
            </Field>
            <Field label="">
              <button type="button" className="ab-btn ab-btn--ghost"
                onClick={() => {
                  const arr = (model.reinforcement.compression ?? []).filter((_, j) => j !== i);
                  dispatch({ type: 'SET_COMPRESSION', list: arr });
                }}>
                Remove
              </button>
            </Field>
          </div>
        ))}
        <div style={{ marginTop: '0.6rem' }}>
          <button type="button" className="ab-btn ab-btn--ghost"
            onClick={() => {
              const arr = [...(model.reinforcement.compression ?? []), { bar: '#4', count: 2 }];
              dispatch({ type: 'SET_COMPRESSION', list: arr });
            }}>
            + Add top bar group
          </button>
        </div>
      </div>

      {/* Skin reinforcement (h > 900 mm) */}
      <div className="slab-card">
        <h4>Skin reinforcement §9.7.2.3 {model.geometry.h > 900 ? '(REQUIRED, h > 900 mm)' : '(optional, h ≤ 900 mm)'}</h4>
        <div className="slab-fields">
          <Field label="Bar">
            <select value={model.reinforcement.skin?.bar ?? '#4'}
              onChange={(e) => dispatch({ type: 'SET_SKIN', skin: { bar: e.target.value, countPerFace: model.reinforcement.skin?.countPerFace ?? 0 } })}>
              {BAR_CATALOG.filter((b) => b.db <= 19).map((b) => <option key={b.label} value={b.label}>{b.label}</option>)}
            </select>
          </Field>
          <Field label="Count per face">
            <Num val={model.reinforcement.skin?.countPerFace ?? 0} step={1}
              onChange={(v) => dispatch({ type: 'SET_SKIN', skin: { bar: model.reinforcement.skin?.bar ?? '#4', countPerFace: Math.max(0, Math.round(v)) } })} />
          </Field>
        </div>
      </div>

      {/* Loads */}
      <div className="slab-card">
        <h4>Loads</h4>
        {engine === 'envelope' && (
          <p className="ab-empty" style={{ marginBottom: '0.6rem' }}>
            Envelope mode: Mu and Vu are derived from the demand source. Edit them in the <strong>Envelope</strong> tab.
          </p>
        )}
        <div className="slab-fields">
          {engine === 'single' && (
            <Field label="Mu (kN·m) — factored">
              <Num val={model.loads.Mu} step={10}
                onChange={(v) => dispatch({ type: 'SET_LOADS', patch: { Mu: v } })} />
            </Field>
          )}
          {engine === 'single' && (
            <Field label="Vu (kN) — factored">
              <Num val={model.loads.Vu} step={10}
                onChange={(v) => dispatch({ type: 'SET_LOADS', patch: { Vu: v } })} />
            </Field>
          )}
          <Field label="Tu (kN·m) — torsion">
            <Num val={model.loads.Tu ?? 0} step={5}
              onChange={(v) => dispatch({ type: 'SET_LOADS', patch: { Tu: v } })} />
          </Field>
          <Field label="Torsion type (§22.7.3)">
            <select value={model.loads.torsionType ?? 'equilibrium'}
              onChange={(e) => dispatch({ type: 'SET_LOADS', patch: { torsionType: e.target.value as 'equilibrium' | 'compatibility' } })}>
              <option value="equilibrium">Equilibrium (Tu fixed)</option>
              <option value="compatibility">Compatibility (Tu ≤ φ·Tcr)</option>
            </select>
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

      {/* Demand source (envelope mode only) */}
      {engine === 'envelope' && (
        <DemandCard demand={demand} setDemand={setDemand} L={model.geometry.L} />
      )}

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
          {/* Torsion (always shown — N/A row when Tu = 0) */}
          {!r.torsion.applies ? (
            <tr>
              <td>Torsion (ACI §22.7)</td>
              <td>Tu = 0</td>
              <td>Tth = {r.torsion.Tth.toFixed(2)} kN·m, Tcr = {r.torsion.Tcr.toFixed(2)} kN·m</td>
              <td>—</td>
              <td className="ab-pass">N/A</td>
            </tr>
          ) : r.torsion.neglected ? (
            <tr>
              <td>Torsion (ACI §22.7)</td>
              <td>Tu = {r.torsion.Tu.toFixed(2)} kN·m</td>
              <td>Tth = {r.torsion.Tth.toFixed(2)} kN·m → may be neglected (§9.5.4.1)</td>
              <td>{(r.torsion.Tu / Math.max(r.torsion.Tth, 0.001)).toFixed(3)}</td>
              <td className="ab-pass">✓ neglect</td>
            </tr>
          ) : (
            <>
              <tr>
                <td>Torsion (ACI §22.7)</td>
                <td>Tu = {r.torsion.TuRed.toFixed(2)} kN·m</td>
                <td>Tcr = {r.torsion.Tcr.toFixed(2)} kN·m, At/s = {r.torsion.AtPerS.toFixed(4)} mm²/mm, Al = {r.torsion.Al.toFixed(0)} mm²</td>
                <td className={r.torsion.interactionOk ? 'ab-pass' : 'ab-fail'}>{r.torsion.interactionRatio.toFixed(3)}</td>
                <td className={r.torsion.interactionOk ? 'ab-pass' : 'ab-fail'}>{r.torsion.interactionOk ? '✓' : '✗'}</td>
              </tr>
              <tr>
                <td>Stirrup spacing (torsion §9.7.6.3.3)</td>
                <td>s = {r.input.reinforcement.stirrup.spacing} mm</td>
                <td>s,max = min(ph/8, 300) = {r.torsion.sMaxTorsion.toFixed(0)} mm</td>
                <td>—</td>
                <td className={r.input.reinforcement.stirrup.spacing <= r.torsion.sMaxTorsion ? 'ab-pass' : 'ab-fail'}>
                  {r.input.reinforcement.stirrup.spacing <= r.torsion.sMaxTorsion ? '✓' : '✗'}
                </td>
              </tr>
            </>
          )}
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
    ...(result.torsion.steps.length > 0
      ? [{ title: 'Torsion (ACI §22.7 + §9.5.4 + §9.6.4)', steps: result.torsion.steps }]
      : []),
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
// DETAILING TAB — full code-mandated breakdown
// ============================================================================
function DetailingTab({ input, result }: { input: BeamInput; result: ReturnType<typeof analyze> }) {
  const r = result;
  const det = r.detailing;
  const tens = input.reinforcement.tension;
  const comp = input.reinforcement.compression ?? [];
  const skin = input.reinforcement.skin;
  const stir = input.reinforcement.stirrup;
  const g = input.geometry;

  const items = [
    { key: 'cover',              item: det.cover },
    { key: 'barFit',             item: det.barFit },
    { key: 'barSpacing',         item: det.barSpacing },
    { key: 'hangerBars',         item: det.hangerBars },
    { key: 'skinReinf',          item: det.skinReinf },
    { key: 'stirrupSize',        item: det.stirrupSize },
    { key: 'stirrupLegSpacing',  item: det.stirrupLegSpacing },
    { key: 'compressionLateral', item: det.compressionLateral },
  ];

  return (
    <div className="rc-detailing">
      {/* Status header */}
      <div className={`rc-status ${det.ok ? 'rc-status--pass' : 'rc-status--fail'}`} style={{ marginBottom: '0.8rem' }}>
        <div className="rc-status__icon">{det.ok ? '✓' : '✗'}</div>
        <div className="rc-status__text">
          <strong>{det.narrativeEn}</strong>
          <span className="rc-status__es">{det.narrativeEs}</span>
        </div>
      </div>

      {/* The 8 detailing sub-checks */}
      <div className="slab-card">
        <h4>Code-mandated detailing checks (ACI 318-25)</h4>
        <div className="rc-detailing__grid">
          {items.map(({ key, item }) => {
            const status = item.informational ? 'info' : (item.ok ? 'pass' : 'fail');
            return (
              <div key={key} className={`rc-detailing-item rc-detailing-item--${status}`}>
                <div className="rc-detailing-item__hdr">
                  <span className="rc-detailing-item__icon">
                    {item.informational ? 'ⓘ' : (item.ok ? '✓' : '✗')}
                  </span>
                  <strong className="rc-detailing-item__label">{item.label}</strong>
                  <span className="rc-detailing-item__ref">{item.ref}</span>
                </div>
                <p className="rc-detailing-item__note">{item.noteEn}</p>
                <p className="rc-detailing-item__note rc-detailing-item__note--es">{item.noteEs}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bar schedule */}
      <div className="slab-card">
        <h4>Bar schedule</h4>
        <div className="ab-table-scroll">
          <table className="ab-result-table">
            <thead>
              <tr><th>Mark</th><th>Position</th><th>Bar</th><th>Count</th><th>Length (mm)</th><th>Total mass (kg)</th></tr>
            </thead>
            <tbody>
              {tens.map((bg, i) => (
                <tr key={`t${i}`}>
                  <td>T{i + 1}</td>
                  <td>Bottom (tension)</td>
                  <td>{bg.bar}</td>
                  <td>{bg.count}</td>
                  <td>{g.L.toFixed(0)}</td>
                  <td>{(bg.count * (g.L / 1000) * (lookupBar(bg.bar)?.mass ?? 0)).toFixed(2)}</td>
                </tr>
              ))}
              {comp.map((bg, i) => (
                <tr key={`c${i}`}>
                  <td>C{i + 1}</td>
                  <td>Top (compression / hangers)</td>
                  <td>{bg.bar}</td>
                  <td>{bg.count}</td>
                  <td>{g.L.toFixed(0)}</td>
                  <td>{(bg.count * (g.L / 1000) * (lookupBar(bg.bar)?.mass ?? 0)).toFixed(2)}</td>
                </tr>
              ))}
              {skin && skin.countPerFace > 0 && (
                <tr>
                  <td>K1</td>
                  <td>Skin (both faces, per §9.7.2.3)</td>
                  <td>{skin.bar}</td>
                  <td>{skin.countPerFace * 2}</td>
                  <td>{g.L.toFixed(0)}</td>
                  <td>{(skin.countPerFace * 2 * (g.L / 1000) * (lookupBar(skin.bar)?.mass ?? 0)).toFixed(2)}</td>
                </tr>
              )}
              <tr>
                <td>S1</td>
                <td>Stirrup ({stir.legs} legs)</td>
                <td>{stir.bar}</td>
                <td>{Math.ceil(g.L / stir.spacing) + 1}</td>
                <td>{stir.spacing} c/c</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Strength checks (lighter, tied to flexure/shear/crack) */}
      <div className="slab-card">
        <h4>Strength checks (ACI 318-25)</h4>
        <ul style={{ lineHeight: 1.8, marginLeft: '1rem' }}>
          <li><strong>Min reinforcement §9.6.1.2</strong>: As,min = <code>{r.flexure.AsMin.toFixed(0)} mm²</code> &nbsp;
            ({r.flexure.As >= r.flexure.AsMin ? <span className="ab-pass">✓ provided {r.flexure.As.toFixed(0)} mm²</span> : <span className="ab-fail">✗ provided {r.flexure.As.toFixed(0)} mm²</span>})
          </li>
          <li><strong>Min stirrups §9.6.3.4</strong>: Av,min = <code>{r.shear.AvMin.toFixed(0)} mm²</code> &nbsp;
            ({r.shear.Av >= r.shear.AvMin ? <span className="ab-pass">✓ provided {r.shear.Av.toFixed(0)} mm²</span> : <span className="ab-fail">✗ provided {r.shear.Av.toFixed(0)} mm²</span>})
          </li>
          <li><strong>Max stirrup spacing §10.7.6.5</strong>: s,max = <code>{r.shear.sMax.toFixed(0)} mm</code> &nbsp;
            ({stir.spacing <= r.shear.sMax ? <span className="ab-pass">✓ s = {stir.spacing} mm</span> : <span className="ab-fail">✗ s = {stir.spacing} mm exceeds limit</span>})
          </li>
          <li><strong>Crack control §24.3.2</strong>: s,max = <code>{r.crack.sMax.toFixed(0)} mm</code> &nbsp;
            ({r.crack.s <= r.crack.sMax ? <span className="ab-pass">✓ s = {r.crack.s.toFixed(0)} mm</span> : <span className="ab-fail">✗ s = {r.crack.s.toFixed(0)} mm exceeds limit</span>})
          </li>
        </ul>
        <p className="slab-card__hint" style={{ marginTop: '0.5rem' }}>
          <em>Coming in Phase 3:</em> bar curtailment per §9.7.3, development length §25.4 with hook tables,
          lap splice §25.5, full elevation drawings, and stirrup zoning.
        </p>
      </div>
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
