'use client';

import React, { useMemo, useReducer, useState } from 'react';
import { solve } from '@/lib/advanced-beam/solver';
import {
  MATERIAL_PRESETS,
  type BeamModel,
  type Segment,
  type Support,
  type Hinge,
  type Load,
  type SupportType,
  type LoadCase,
  type MaterialPreset,
} from '@/lib/advanced-beam/types';
import { AdvancedBeamSchematic, buildSupportLabels } from './AdvancedBeamSchematic';
import { AdvancedBeamDiagrams } from './AdvancedBeamDiagrams';

// ============================================================================
// State + reducer
// ============================================================================
type Action =
  | { type: 'SET_LENGTH'; length: number }
  | { type: 'LOAD_PRESET'; model: BeamModel }
  | { type: 'ADD_SEGMENT' }
  | { type: 'UPDATE_SEGMENT'; id: string; patch: Partial<Segment> }
  | { type: 'REMOVE_SEGMENT'; id: string }
  | { type: 'APPLY_MATERIAL_TO_SEGMENT'; id: string; material: MaterialPreset }
  | { type: 'ADD_SUPPORT'; supportType?: SupportType }
  | { type: 'UPDATE_SUPPORT'; id: string; patch: Partial<Support> }
  | { type: 'REMOVE_SUPPORT'; id: string }
  | { type: 'ADD_HINGE' }
  | { type: 'UPDATE_HINGE'; id: string; patch: Partial<Hinge> }
  | { type: 'REMOVE_HINGE'; id: string }
  | { type: 'ADD_LOAD'; loadType: Load['type'] }
  | { type: 'UPDATE_LOAD'; id: string; patch: Partial<Load> }
  | { type: 'REMOVE_LOAD'; id: string };

const idGen = (() => {
  let n = 0;
  return (prefix: string) => `${prefix}-${++n}-${Math.random().toString(36).slice(2, 6)}`;
})();

function reducer(state: BeamModel, action: Action): BeamModel {
  switch (action.type) {
    case 'SET_LENGTH': {
      const newL = Math.max(0.1, action.length);
      const segments = state.segments.map((s) => ({
        ...s,
        endPosition: Math.min(s.endPosition, newL),
        startPosition: Math.min(s.startPosition, newL),
      }));
      // Extend last segment to match new total length
      if (segments.length) {
        segments[segments.length - 1].endPosition = newL;
      }
      const supports = state.supports.map((s) => ({
        ...s,
        position: Math.min(s.position, newL),
      }));
      const hinges = state.hinges.map((h) => ({ ...h, position: Math.min(h.position, newL) }));
      const loads = state.loads.map((ld) => {
        if (ld.type === 'point' || ld.type === 'moment') {
          return { ...ld, position: Math.min(ld.position, newL) };
        } else if (ld.type === 'distributed') {
          return {
            ...ld,
            startPosition: Math.min(ld.startPosition, newL),
            endPosition: Math.min(ld.endPosition, newL),
          };
        }
        return ld;
      });
      return { ...state, totalLength: newL, segments, supports, hinges, loads };
    }
    case 'LOAD_PRESET':
      return action.model;
    case 'ADD_SEGMENT': {
      const last = state.segments[state.segments.length - 1];
      const start = last ? last.endPosition : 0;
      const end = Math.min(state.totalLength, start + (state.totalLength - start) / 2 || 1);
      const newSeg: Segment = {
        id: idGen('seg'),
        startPosition: start,
        endPosition: end,
        E: 200_000,
        I: 100e6,
        A: 5_000,
      };
      return { ...state, segments: [...state.segments, newSeg] };
    }
    case 'UPDATE_SEGMENT':
      return {
        ...state,
        segments: state.segments.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      };
    case 'REMOVE_SEGMENT':
      return { ...state, segments: state.segments.filter((s) => s.id !== action.id) };
    case 'APPLY_MATERIAL_TO_SEGMENT': {
      if (action.material === 'custom') {
        return {
          ...state,
          segments: state.segments.map((s) => (s.id === action.id ? { ...s, material: 'custom' } : s)),
        };
      }
      const preset = MATERIAL_PRESETS[action.material];
      return {
        ...state,
        segments: state.segments.map((s) =>
          s.id === action.id
            ? { ...s, material: action.material, E: preset.E, density: preset.density, alpha: preset.alpha }
            : s,
        ),
      };
    }
    case 'ADD_SUPPORT': {
      const newSup: Support = {
        id: idGen('sup'),
        position: state.totalLength / 2,
        type: action.supportType ?? 'roller',
      };
      return { ...state, supports: [...state.supports, newSup] };
    }
    case 'UPDATE_SUPPORT':
      return {
        ...state,
        supports: state.supports.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      };
    case 'REMOVE_SUPPORT':
      return { ...state, supports: state.supports.filter((s) => s.id !== action.id) };
    case 'ADD_HINGE': {
      const newH: Hinge = { id: idGen('h'), position: state.totalLength / 2 };
      return { ...state, hinges: [...state.hinges, newH] };
    }
    case 'UPDATE_HINGE':
      return {
        ...state,
        hinges: state.hinges.map((h) => (h.id === action.id ? { ...h, ...action.patch } : h)),
      };
    case 'REMOVE_HINGE':
      return { ...state, hinges: state.hinges.filter((h) => h.id !== action.id) };
    case 'ADD_LOAD': {
      const x = state.totalLength / 2;
      let load: Load;
      if (action.loadType === 'point') {
        load = { id: idGen('p'), type: 'point', position: x, magnitude: 10, direction: 'down', loadCase: 'live' };
      } else if (action.loadType === 'moment') {
        load = { id: idGen('m'), type: 'moment', position: x, magnitude: 10, direction: 'ccw', loadCase: 'live' };
      } else if (action.loadType === 'distributed') {
        load = {
          id: idGen('w'),
          type: 'distributed',
          startPosition: 0,
          endPosition: state.totalLength,
          startMagnitude: 5,
          endMagnitude: 5,
          direction: 'down',
          loadCase: 'live',
        };
      } else {
        const seg = state.segments[0];
        load = { id: idGen('t'), type: 'thermal', segmentId: seg ? seg.id : '', deltaTGradient: 20, loadCase: 'live' };
      }
      return { ...state, loads: [...state.loads, load] };
    }
    case 'UPDATE_LOAD':
      return {
        ...state,
        loads: state.loads.map((ld) => (ld.id === action.id ? ({ ...ld, ...action.patch } as Load) : ld)),
      };
    case 'REMOVE_LOAD':
      return { ...state, loads: state.loads.filter((ld) => ld.id !== action.id) };
  }
}

// ============================================================================
// Presets
// ============================================================================
const PRESETS: { label: string; build: () => BeamModel }[] = [
  {
    label: 'Simply Supported (point load)',
    build: () => buildPreset({
      L: 6,
      supports: [['pin', 0], ['roller', 6]],
      loads: [{ kind: 'point', x: 3, mag: 50 }],
    }),
  },
  {
    label: 'Simply Supported (UDL)',
    build: () => buildPreset({
      L: 6,
      supports: [['pin', 0], ['roller', 6]],
      loads: [{ kind: 'udl', a: 0, b: 6, w: 10 }],
    }),
  },
  {
    label: 'Cantilever (tip load)',
    build: () => buildPreset({
      L: 4,
      supports: [['fixed', 0]],
      loads: [{ kind: 'point', x: 4, mag: 30 }],
    }),
  },
  {
    label: 'Cantilever (UDL)',
    build: () => buildPreset({
      L: 4,
      supports: [['fixed', 0]],
      loads: [{ kind: 'udl', a: 0, b: 4, w: 8 }],
    }),
  },
  {
    label: 'Fixed–Fixed (UDL)',
    build: () => buildPreset({
      L: 6,
      supports: [['fixed', 0], ['fixed', 6]],
      loads: [{ kind: 'udl', a: 0, b: 6, w: 10 }],
    }),
  },
  {
    label: 'Propped cantilever (UDL)',
    build: () => buildPreset({
      L: 6,
      supports: [['fixed', 0], ['roller', 6]],
      loads: [{ kind: 'udl', a: 0, b: 6, w: 10 }],
    }),
  },
  {
    label: 'Two-span continuous',
    build: () => buildPreset({
      L: 12,
      supports: [['pin', 0], ['roller', 6], ['roller', 12]],
      loads: [{ kind: 'udl', a: 0, b: 12, w: 10 }],
    }),
  },
  {
    label: 'Three-span continuous',
    build: () => buildPreset({
      L: 18,
      supports: [['pin', 0], ['roller', 6], ['roller', 12], ['roller', 18]],
      loads: [{ kind: 'udl', a: 0, b: 18, w: 10 }],
    }),
  },
  {
    label: 'Gerber (cantilever + drop-in)',
    build: () => buildPreset({
      L: 12,
      supports: [['fixed', 0], ['roller', 12]],
      hinges: [6],
      loads: [{ kind: 'udl', a: 0, b: 12, w: 8 }],
    }),
  },
];

function buildPreset(opts: {
  L: number;
  supports: [SupportType, number][];
  loads?: ({ kind: 'point'; x: number; mag: number } | { kind: 'udl'; a: number; b: number; w: number })[];
  hinges?: number[];
}): BeamModel {
  const segId = idGen('seg');
  return {
    totalLength: opts.L,
    segments: [{
      id: segId,
      startPosition: 0,
      endPosition: opts.L,
      E: 200_000,
      I: 180e6,        // ~ W14x30
      A: 5710,
      material: 'steel-A992',
      density: 7850,
      alpha: 1.2e-5,
      h: 350,
    }],
    supports: opts.supports.map(([type, pos]) => ({
      id: idGen('sup'),
      position: pos,
      type,
    })),
    hinges: (opts.hinges ?? []).map((pos) => ({ id: idGen('h'), position: pos })),
    loads: (opts.loads ?? []).map((ld) =>
      ld.kind === 'point'
        ? { id: idGen('p'), type: 'point', position: ld.x, magnitude: ld.mag, direction: 'down', loadCase: 'live' as LoadCase }
        : {
            id: idGen('w'),
            type: 'distributed',
            startPosition: ld.a,
            endPosition: ld.b,
            startMagnitude: ld.w,
            endMagnitude: ld.w,
            direction: 'down',
            loadCase: 'live' as LoadCase,
          },
    ),
  };
}

// ============================================================================
// Component
// ============================================================================
type Tab = 'segments' | 'supports' | 'hinges' | 'loads';

export function AdvancedBeamCalculator() {
  const [model, dispatch] = useReducer(reducer, undefined, () => PRESETS[0].build());
  const [tab, setTab] = useState<Tab>('loads');
  const [showDeformed, setShowDeformed] = useState(true);
  const [computeModes, setComputeModes] = useState(0);

  const results = useMemo(() => solve(model, { computeModes }), [model, computeModes]);
  const supportLabels = useMemo(() => buildSupportLabels(model.supports), [model.supports]);
  const hingeLabels = useMemo(() => {
    const sorted = [...model.hinges].sort((a, b) => a.position - b.position);
    const map: Record<string, string> = {};
    sorted.forEach((h, i) => (map[h.id] = `H${i + 1}`));
    return map;
  }, [model.hinges]);

  return (
    <div className="ab-root">
      {/* TEMPLATES ROW */}
      <section className="ab-section">
        <header className="ab-section__header">
          <h3>Templates</h3>
          <p className="ab-section__subtitle">Start from a textbook setup, then edit.</p>
        </header>
        <div className="ab-presets">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="ab-preset-chip"
              onClick={() => dispatch({ type: 'LOAD_PRESET', model: p.build() })}>
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* TOP BAR: length + display toggles */}
      <section className="ab-section ab-topbar">
        <div className="ab-input-group">
          <label htmlFor="ab-length">Beam length L (m)</label>
          <input id="ab-length" type="number" min="0.1" step="0.1" value={model.totalLength}
            onChange={(e) => dispatch({ type: 'SET_LENGTH', length: parseFloat(e.target.value) || 0.1 })}
          />
        </div>
        <label className="ab-toggle">
          <input type="checkbox" checked={showDeformed}
            onChange={(e) => setShowDeformed(e.target.checked)} />
          <span>Show deformed shape</span>
        </label>
        <div className="ab-input-group ab-input-group--inline">
          <label htmlFor="ab-modes">Modes to compute</label>
          <input id="ab-modes" type="number" min="0" max="5" step="1" value={computeModes}
            onChange={(e) => setComputeModes(Math.max(0, Math.min(5, parseInt(e.target.value) || 0)))} />
        </div>
      </section>

      {/* SCHEMATIC */}
      <section className="ab-section ab-schematic-wrap">
        <AdvancedBeamSchematic
          model={model}
          deflection={results.deflection}
          showDeformed={showDeformed && results.solved}
          supportLabels={supportLabels}
        />
      </section>

      {/* WARNINGS */}
      {results.warnings.length > 0 && (
        <section className="ab-section ab-warnings">
          {results.warnings.map((w, i) => (
            <div key={i} className="ab-warning">⚠ {w}</div>
          ))}
        </section>
      )}

      {/* TABS */}
      <section className="ab-section">
        <nav className="ab-tabs" role="tablist">
          {([
            ['segments', `Segments (${model.segments.length})`],
            ['supports', `Supports (${model.supports.length})`],
            ['hinges',   `Hinges (${model.hinges.length})`],
            ['loads',    `Loads (${model.loads.length})`],
          ] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k}
              className={`ab-tab ${tab === k ? 'ab-tab--active' : ''}`}
              onClick={() => setTab(k)}>{label}</button>
          ))}
        </nav>

        {tab === 'segments' && <SegmentsTab model={model} dispatch={dispatch} />}
        {tab === 'supports' && <SupportsTab model={model} dispatch={dispatch} labels={supportLabels} />}
        {tab === 'hinges' && <HingesTab model={model} dispatch={dispatch} labels={hingeLabels} />}
        {tab === 'loads' && <LoadsTab model={model} dispatch={dispatch} />}
      </section>

      {/* RESULTS GRID */}
      <section className="ab-section ab-results-grid">
        <ReactionsPanel results={results} labels={supportLabels} />
        <KeyResultsPanel results={results} />
      </section>

      {/* DIAGRAMS */}
      <section className="ab-section">
        <header className="ab-section__header">
          <h3>Diagrams</h3>
          <p className="ab-section__subtitle">Live shear, moment, slope, and deflection plots.</p>
        </header>
        <AdvancedBeamDiagrams results={results} totalLength={model.totalLength} />
      </section>

      {/* MODES */}
      {results.modes && results.modes.length > 0 && (
        <section className="ab-section">
          <header className="ab-section__header">
            <h3>Natural modes</h3>
            <p className="ab-section__subtitle">Lowest bending modes (consistent mass matrix, free DOFs only).</p>
          </header>
          <div className="ab-modes">
            {results.modes.map((mode, i) => (
              <div className="ab-mode-card" key={i}>
                <h4>Mode {i + 1}</h4>
                <div className="ab-mode-card__metric">
                  <span>{mode.frequencyHz.toFixed(2)} Hz</span>
                  <span className="ab-mode-card__sub">ω = {mode.omega.toFixed(2)} rad/s</span>
                </div>
                <ModeShape shape={mode.shape} L={model.totalLength} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Tab panels
// ----------------------------------------------------------------------------

function SegmentsTab({ model, dispatch }: TabProps) {
  return (
    <div className="ab-table-wrap">
      <div className="ab-row-actions">
        <button type="button" className="ab-btn ab-btn--primary"
          onClick={() => dispatch({ type: 'ADD_SEGMENT' })}>+ Add segment</button>
      </div>
      <div className="ab-table-scroll">
        <table className="ab-table">
          <thead>
            <tr>
              <th>ID</th><th>Start (m)</th><th>End (m)</th><th>Material</th>
              <th>E (MPa)</th><th>I (mm⁴)</th><th>A (mm²)</th><th>h (mm)</th>
              <th>α (1/°C)</th><th>SW</th><th></th>
            </tr>
          </thead>
          <tbody>
            {model.segments.map((s, idx) => (
              <tr key={s.id}>
                <td data-label="Segment" className="ab-mono">#{idx + 1}</td>
                <td data-label="Start (m)"><Num val={s.startPosition} step={0.1}
                  onChange={(v) => dispatch({ type: 'UPDATE_SEGMENT', id: s.id, patch: { startPosition: v } })} /></td>
                <td data-label="End (m)"><Num val={s.endPosition} step={0.1}
                  onChange={(v) => dispatch({ type: 'UPDATE_SEGMENT', id: s.id, patch: { endPosition: v } })} /></td>
                <td data-label="Material">
                  <select value={s.material ?? 'custom'}
                    onChange={(e) => dispatch({ type: 'APPLY_MATERIAL_TO_SEGMENT', id: s.id, material: e.target.value as MaterialPreset })}>
                    <option value="custom">Custom</option>
                    {Object.entries(MATERIAL_PRESETS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </td>
                <td data-label="E (MPa)"><Num val={s.E} step={1000}
                  onChange={(v) => dispatch({ type: 'UPDATE_SEGMENT', id: s.id, patch: { E: v, material: 'custom' } })} /></td>
                <td data-label="I (mm⁴)"><Num val={s.I} step={1e6} sci
                  onChange={(v) => dispatch({ type: 'UPDATE_SEGMENT', id: s.id, patch: { I: v } })} /></td>
                <td data-label="A (mm²)"><Num val={s.A ?? 0} step={100}
                  onChange={(v) => dispatch({ type: 'UPDATE_SEGMENT', id: s.id, patch: { A: v || undefined } })} /></td>
                <td data-label="h (mm)"><Num val={s.h ?? 0} step={10}
                  onChange={(v) => dispatch({ type: 'UPDATE_SEGMENT', id: s.id, patch: { h: v || undefined } })} /></td>
                <td data-label="α (1/°C)"><Num val={s.alpha ?? 1.2e-5} step={1e-6} sci
                  onChange={(v) => dispatch({ type: 'UPDATE_SEGMENT', id: s.id, patch: { alpha: v } })} /></td>
                <td data-label="Self weight"><input type="checkbox" checked={!!s.selfWeight}
                  onChange={(e) => dispatch({ type: 'UPDATE_SEGMENT', id: s.id, patch: { selfWeight: e.target.checked } })} /></td>
                <td>
                  <button type="button" className="ab-btn ab-btn--danger" onClick={() => dispatch({ type: 'REMOVE_SEGMENT', id: s.id })}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SupportsTab({ model, dispatch, labels }: TabProps & { labels: Record<string, string> }) {
  return (
    <div className="ab-table-wrap">
      <div className="ab-row-actions">
        <button type="button" className="ab-btn" onClick={() => dispatch({ type: 'ADD_SUPPORT', supportType: 'pin' })}>+ Pin</button>
        <button type="button" className="ab-btn" onClick={() => dispatch({ type: 'ADD_SUPPORT', supportType: 'roller' })}>+ Roller</button>
        <button type="button" className="ab-btn" onClick={() => dispatch({ type: 'ADD_SUPPORT', supportType: 'fixed' })}>+ Fixed</button>
        <button type="button" className="ab-btn" onClick={() => dispatch({ type: 'ADD_SUPPORT', supportType: 'spring' })}>+ Spring</button>
      </div>
      <div className="ab-table-scroll">
        <table className="ab-table">
          <thead>
            <tr>
              <th>Label</th><th>Position (m)</th><th>Type</th>
              <th>k_v (kN/m)</th><th>k_r (kN·m/rad)</th>
              <th>Settle (mm)</th><th>Rotation (rad)</th><th></th>
            </tr>
          </thead>
          <tbody>
            {model.supports.map((s) => (
              <tr key={s.id}>
                <td data-label="Label" className="ab-label">{labels[s.id] ?? s.id.slice(0, 4)}</td>
                <td data-label="Position (m)"><Num val={s.position} step={0.1}
                  onChange={(v) => dispatch({ type: 'UPDATE_SUPPORT', id: s.id, patch: { position: v } })} /></td>
                <td data-label="Type">
                  <select value={s.type}
                    onChange={(e) => dispatch({ type: 'UPDATE_SUPPORT', id: s.id, patch: { type: e.target.value as SupportType } })}>
                    <option value="pin">Pin</option>
                    <option value="roller">Roller</option>
                    <option value="fixed">Fixed</option>
                    <option value="spring">Spring</option>
                    <option value="free">Free</option>
                  </select>
                </td>
                <td data-label="k_v (kN/m)">{s.type === 'spring' ?
                  <Num val={s.kv ?? 0} step={100}
                    onChange={(v) => dispatch({ type: 'UPDATE_SUPPORT', id: s.id, patch: { kv: v || undefined } })} />
                  : <span className="ab-na">—</span>}
                </td>
                <td data-label="k_r (kN·m/rad)">{s.type === 'spring' ?
                  <Num val={s.kr ?? 0} step={100}
                    onChange={(v) => dispatch({ type: 'UPDATE_SUPPORT', id: s.id, patch: { kr: v || undefined } })} />
                  : <span className="ab-na">—</span>}
                </td>
                <td data-label="Settle (mm)"><Num val={s.settlement ?? 0} step={1}
                  onChange={(v) => dispatch({ type: 'UPDATE_SUPPORT', id: s.id, patch: { settlement: v || undefined } })} /></td>
                <td data-label="Rotation (rad)">{(s.type === 'fixed' || s.type === 'spring') ?
                  <Num val={s.rotation ?? 0} step={1e-3} sci
                    onChange={(v) => dispatch({ type: 'UPDATE_SUPPORT', id: s.id, patch: { rotation: v || undefined } })} />
                  : <span className="ab-na">—</span>}
                </td>
                <td><button type="button" className="ab-btn ab-btn--danger" onClick={() => dispatch({ type: 'REMOVE_SUPPORT', id: s.id })}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HingesTab({ model, dispatch, labels }: TabProps & { labels: Record<string, string> }) {
  return (
    <div className="ab-table-wrap">
      <div className="ab-row-actions">
        <button type="button" className="ab-btn ab-btn--primary"
          onClick={() => dispatch({ type: 'ADD_HINGE' })}>+ Add hinge</button>
      </div>
      {model.hinges.length === 0 ? (
        <p className="ab-empty">No internal hinges. Add one to release moment continuity at a point.</p>
      ) : (
        <div className="ab-table-scroll">
          <table className="ab-table">
            <thead><tr><th>Label</th><th>Position (m)</th><th></th></tr></thead>
            <tbody>
              {model.hinges.map((h) => (
                <tr key={h.id}>
                  <td data-label="Label" className="ab-label">{labels[h.id] ?? h.id.slice(0, 4)}</td>
                  <td data-label="Position (m)"><Num val={h.position} step={0.1}
                    onChange={(v) => dispatch({ type: 'UPDATE_HINGE', id: h.id, patch: { position: v } })} /></td>
                  <td><button type="button" className="ab-btn ab-btn--danger" onClick={() => dispatch({ type: 'REMOVE_HINGE', id: h.id })}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LoadsTab({ model, dispatch }: TabProps) {
  return (
    <div className="ab-table-wrap">
      <div className="ab-row-actions">
        <button type="button" className="ab-btn" onClick={() => dispatch({ type: 'ADD_LOAD', loadType: 'point' })}>+ Point load</button>
        <button type="button" className="ab-btn" onClick={() => dispatch({ type: 'ADD_LOAD', loadType: 'distributed' })}>+ Distributed</button>
        <button type="button" className="ab-btn" onClick={() => dispatch({ type: 'ADD_LOAD', loadType: 'moment' })}>+ Moment</button>
        <button type="button" className="ab-btn" onClick={() => dispatch({ type: 'ADD_LOAD', loadType: 'thermal' })}>+ Thermal</button>
      </div>
      {model.loads.length === 0 ? (
        <p className="ab-empty">No loads. Add a point load, UDL, applied moment, or thermal gradient.</p>
      ) : (
        <div className="ab-table-scroll">
          <table className="ab-table">
            <thead>
              <tr><th>ID</th><th>Type</th><th>Position / range (m)</th><th>Magnitude</th><th>Dir / Case</th><th></th></tr>
            </thead>
            <tbody>
              {model.loads.map((ld, idx) => (
                <tr key={ld.id}>
                  <td data-label="Load" className="ab-mono">#{idx + 1}</td>
                  <td data-label="Type">{ld.type === 'point' ? 'Point (kN)' : ld.type === 'distributed' ? 'Distributed (kN/m)' : ld.type === 'moment' ? 'Moment (kN·m)' : 'Thermal (°C)'}</td>
                  <td data-label="Position / range (m)">
                    {ld.type === 'point' || ld.type === 'moment' ? (
                      <Num val={ld.position} step={0.1}
                        onChange={(v) => dispatch({ type: 'UPDATE_LOAD', id: ld.id, patch: { position: v } as Partial<Load> })} />
                    ) : ld.type === 'distributed' ? (
                      <span style={{ display: 'flex', gap: 6 }}>
                        <Num val={ld.startPosition} step={0.1}
                          onChange={(v) => dispatch({ type: 'UPDATE_LOAD', id: ld.id, patch: { startPosition: v } as Partial<Load> })} />
                        <span style={{ alignSelf: 'center', opacity: 0.6 }}>→</span>
                        <Num val={ld.endPosition} step={0.1}
                          onChange={(v) => dispatch({ type: 'UPDATE_LOAD', id: ld.id, patch: { endPosition: v } as Partial<Load> })} />
                      </span>
                    ) : (
                      <select value={ld.segmentId}
                        onChange={(e) => dispatch({ type: 'UPDATE_LOAD', id: ld.id, patch: { segmentId: e.target.value } as Partial<Load> })}>
                        {model.segments.map((s) => (
                          <option key={s.id} value={s.id}>{s.id.slice(0, 6)} ({s.startPosition}–{s.endPosition} m)</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td data-label="Magnitude">
                    {ld.type === 'point' || ld.type === 'moment' ? (
                      <Num val={ld.magnitude} step={1}
                        onChange={(v) => dispatch({ type: 'UPDATE_LOAD', id: ld.id, patch: { magnitude: v } as Partial<Load> })} />
                    ) : ld.type === 'distributed' ? (
                      <span style={{ display: 'flex', gap: 6 }}>
                        <Num val={ld.startMagnitude} step={1}
                          onChange={(v) => dispatch({ type: 'UPDATE_LOAD', id: ld.id, patch: { startMagnitude: v } as Partial<Load> })} />
                        <span style={{ alignSelf: 'center', opacity: 0.6 }}>→</span>
                        <Num val={ld.endMagnitude} step={1}
                          onChange={(v) => dispatch({ type: 'UPDATE_LOAD', id: ld.id, patch: { endMagnitude: v } as Partial<Load> })} />
                      </span>
                    ) : (
                      <Num val={ld.deltaTGradient} step={5}
                        onChange={(v) => dispatch({ type: 'UPDATE_LOAD', id: ld.id, patch: { deltaTGradient: v } as Partial<Load> })} />
                    )}
                  </td>
                  <td data-label="Direction">
                    {ld.type === 'point' || ld.type === 'distributed' ? (
                      <select value={ld.direction}
                        onChange={(e) => dispatch({ type: 'UPDATE_LOAD', id: ld.id, patch: { direction: e.target.value as 'down' | 'up' } as Partial<Load> })}>
                        <option value="down">Down</option>
                        <option value="up">Up</option>
                      </select>
                    ) : ld.type === 'moment' ? (
                      <select value={ld.direction}
                        onChange={(e) => dispatch({ type: 'UPDATE_LOAD', id: ld.id, patch: { direction: e.target.value as 'cw' | 'ccw' } as Partial<Load> })}>
                        <option value="ccw">CCW</option>
                        <option value="cw">CW</option>
                      </select>
                    ) : (
                      <span className="ab-na">—</span>
                    )}
                  </td>
                  <td><button type="button" className="ab-btn ab-btn--danger" onClick={() => dispatch({ type: 'REMOVE_LOAD', id: ld.id })}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface TabProps {
  model: BeamModel;
  dispatch: React.Dispatch<Action>;
}

// ----------------------------------------------------------------------------
// Result panels
// ----------------------------------------------------------------------------

function ReactionsPanel({ results, labels }: { results: import('@/lib/advanced-beam/types').Results; labels: Record<string, string> }) {
  return (
    <div className="ab-result-card">
      <h4>Reactions</h4>
      {results.reactions.length === 0 ? (
        <p className="ab-empty">—</p>
      ) : (
        <table className="ab-result-table">
          <thead>
            <tr><th>Support</th><th>Type</th><th>x (m)</th><th>V (kN)</th><th>M (kN·m)</th></tr>
          </thead>
          <tbody>
            {results.reactions.map((r) => (
              <tr key={r.supportId}>
                <td className="ab-label">{labels[r.supportId] ?? r.supportId.slice(0, 4)}</td>
                <td>{r.type}</td>
                <td>{r.position.toFixed(2)}</td>
                <td>{r.V.toFixed(3)}</td>
                <td>{r.M.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function KeyResultsPanel({ results }: { results: import('@/lib/advanced-beam/types').Results }) {
  const items: { label: string; v: string; loc?: string }[] = [
    { label: 'Max +V (shear)', v: `${results.maxShear.value.toFixed(2)} kN`, loc: `@ ${results.maxShear.position.toFixed(2)} m` },
    { label: 'Min −V (shear)', v: `${results.minShear.value.toFixed(2)} kN`, loc: `@ ${results.minShear.position.toFixed(2)} m` },
    { label: 'Max +M (sagging)', v: `${results.maxMoment.value.toFixed(2)} kN·m`, loc: `@ ${results.maxMoment.position.toFixed(2)} m` },
    { label: 'Min −M (hogging)', v: `${results.minMoment.value.toFixed(2)} kN·m`, loc: `@ ${results.minMoment.position.toFixed(2)} m` },
    { label: 'Max |δ| deflection', v: `${results.maxDeflection.value.toFixed(2)} mm`, loc: `@ ${results.maxDeflection.position.toFixed(2)} m` },
  ];
  return (
    <div className="ab-result-card">
      <h4>Key results</h4>
      <ul className="ab-key-list">
        {items.map((it) => (
          <li key={it.label}>
            <span className="ab-key-list__label">{it.label}</span>
            <span className="ab-key-list__value">{it.v} <small>{it.loc}</small></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModeShape({ shape, L }: { shape: { x: number; value: number }[]; L: number }) {
  if (!shape.length) return null;
  let m = 0;
  for (const p of shape) m = Math.max(m, Math.abs(p.value));
  if (m === 0) return null;
  const W = 240;
  const H = 60;
  const margin = 6;
  const drawW = W - 2 * margin;
  const x2 = (x: number) => margin + (x / L) * drawW;
  const y2 = (v: number) => H / 2 - (v / m) * (H / 2 - margin);
  const pts = shape.map((p) => `${x2(p.x).toFixed(1)},${y2(p.value).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ab-mode-svg">
      <line x1={margin} y1={H / 2} x2={W - margin} y2={H / 2} stroke="rgba(255,255,255,0.18)" />
      <polyline points={pts} fill="none" stroke="#c9a84c" strokeWidth="2" />
    </svg>
  );
}

// ----------------------------------------------------------------------------
// Numeric input helper
// ----------------------------------------------------------------------------

function Num({ val, onChange, step = 1, sci = false }: { val: number; onChange: (v: number) => void; step?: number; sci?: boolean }) {
  return (
    <input
      type="number"
      className="ab-num"
      step={step}
      value={Number.isFinite(val) ? (sci ? val.toExponential(3) : val) : ''}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        onChange(Number.isFinite(v) ? v : 0);
      }}
    />
  );
}
