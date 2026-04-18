'use client';

import React, { useMemo, useReducer, useState, useCallback } from 'react';
import { BeamVisualizer } from './BeamVisualizer';
import { DiagramsPanel } from './DiagramsPanel';
import { solve } from '@/lib/beam/solver';
import {
  MATERIAL_PRESETS,
  LOAD_CASE_LABELS,
  type AppliedMoment,
  type BeamModel,
  type Load,
  type LoadCase,
  type LoadDirection,
  type MaterialPreset,
  type Results,
  type Support,
  type SupportType,
} from '@/lib/beam/types';

type Tab = 'beam' | 'section' | 'supports' | 'loads' | 'moments';

type Action =
  | { type: 'SET_LENGTH'; length: number }
  | { type: 'SET_MATERIAL'; material: MaterialPreset; E?: number; density?: number }
  | { type: 'SET_E'; E: number }
  | { type: 'SET_I'; I: number }
  | { type: 'SET_A'; A: number | undefined }
  | { type: 'SET_LABEL'; label: string }
  | { type: 'TOGGLE_SELF_WEIGHT' }
  | { type: 'SET_DENSITY'; density: number }
  | { type: 'ADD_SUPPORT'; support: Support }
  | { type: 'UPDATE_SUPPORT'; id: string; patch: Partial<Support> }
  | { type: 'REMOVE_SUPPORT'; id: string }
  | { type: 'ADD_LOAD'; load: Load }
  | { type: 'REMOVE_LOAD'; id: string }
  | { type: 'ADD_MOMENT'; moment: AppliedMoment }
  | { type: 'UPDATE_MOMENT'; id: string; patch: Partial<AppliedMoment> }
  | { type: 'REMOVE_MOMENT'; id: string }
  | { type: 'RESET' };

const initialModel: BeamModel = {
  length: 0,
  section: {
    material: 'steel',
    E: 200000,
    I: 1.12e8,
    A: undefined,
    label: '',
  },
  supports: [],
  loads: [],
  moments: [],
  selfWeight: false,
  density: 7850,
};

function reducer(state: BeamModel, action: Action): BeamModel {
  switch (action.type) {
    case 'SET_LENGTH':
      return { ...state, length: Math.max(0, action.length) };
    case 'SET_MATERIAL': {
      if (action.material === 'custom') {
        return { ...state, section: { ...state.section, material: 'custom' } };
      }
      const preset = MATERIAL_PRESETS[action.material];
      return {
        ...state,
        section: { ...state.section, material: action.material, E: preset.E },
        density: preset.density,
      };
    }
    case 'SET_E':
      return { ...state, section: { ...state.section, E: action.E } };
    case 'SET_I':
      return { ...state, section: { ...state.section, I: action.I } };
    case 'SET_A':
      return { ...state, section: { ...state.section, A: action.A } };
    case 'SET_LABEL':
      return { ...state, section: { ...state.section, label: action.label } };
    case 'TOGGLE_SELF_WEIGHT':
      return { ...state, selfWeight: !state.selfWeight };
    case 'SET_DENSITY':
      return { ...state, density: action.density };
    case 'ADD_SUPPORT':
      return { ...state, supports: [...state.supports, action.support] };
    case 'UPDATE_SUPPORT':
      return {
        ...state,
        supports: state.supports.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      };
    case 'REMOVE_SUPPORT':
      return { ...state, supports: state.supports.filter((s) => s.id !== action.id) };
    case 'ADD_LOAD':
      return { ...state, loads: [...state.loads, action.load] };
    case 'REMOVE_LOAD':
      return { ...state, loads: state.loads.filter((l) => l.id !== action.id) };
    case 'ADD_MOMENT':
      return { ...state, moments: [...state.moments, action.moment] };
    case 'UPDATE_MOMENT':
      return {
        ...state,
        moments: state.moments.map((m) => (m.id === action.id ? { ...m, ...action.patch } : m)),
      };
    case 'REMOVE_MOMENT':
      return { ...state, moments: state.moments.filter((m) => m.id !== action.id) };
    case 'RESET':
      return initialModel;
    default:
      return state;
  }
}

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function BeamCalculator() {
  const [model, dispatch] = useReducer(reducer, initialModel);
  const [tab, setTab] = useState<Tab>('beam');
  const [results, setResults] = useState<Results | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSolve = useCallback(() => {
    const r = solve(model);
    setResults(r);
  }, [model]);

  const issues = useMemo(() => validate(model), [model]);

  return (
    <div className="beam-calc">
      <div className="beam-calc__toolbar">
        <div className="beam-calc__tabs" role="tablist">
          {(['beam', 'section', 'supports', 'loads', 'moments'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`beam-calc__tab ${tab === t ? 'is-active' : ''}`}
              onClick={() => setTab(t)}
            >
              {tabLabel(t)}
              <span className="beam-calc__tab-count">{tabCount(model, t)}</span>
            </button>
          ))}
        </div>
        <div className="beam-calc__tabs-mobile">
          <label className="beam-calc__tabs-mobile-label">Section</label>
          <select
            className="beam-calc__tabs-select"
            value={tab}
            onChange={(e) => setTab(e.target.value as Tab)}
          >
            {(['beam', 'section', 'supports', 'loads', 'moments'] as Tab[]).map((t) => {
              const c = tabCount(model, t);
              return (
                <option key={t} value={t}>
                  {tabLabel(t)}
                  {c ? ` (${c})` : ''}
                </option>
              );
            })}
          </select>
        </div>
        <div className="beam-calc__actions">
          <label className="beam-calc__toggle">
            <input
              type="checkbox"
              checked={model.selfWeight}
              onChange={() => dispatch({ type: 'TOGGLE_SELF_WEIGHT' })}
            />
            <span>Self Weight</span>
          </label>
          <button className="btn btn--ghost" onClick={() => dispatch({ type: 'RESET' })}>
            Reset
          </button>
          <button
            className="btn btn--primary beam-calc__solve"
            onClick={handleSolve}
            disabled={issues.length > 0}
          >
            <span>Solve</span>
            <span className="btn__arrow">→</span>
          </button>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="beam-calc__issues">
          {issues.map((msg, i) => (
            <div key={i} className="beam-calc__issue">
              {msg}
            </div>
          ))}
        </div>
      )}

      <div className="beam-calc__body">
        <aside className="beam-calc__panel">
          {tab === 'beam' && <BeamPanel model={model} dispatch={dispatch} />}
          {tab === 'section' && <SectionPanel model={model} dispatch={dispatch} />}
          {tab === 'supports' && (
            <SupportsPanel
              model={model}
              dispatch={dispatch}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
            />
          )}
          {tab === 'loads' && (
            <LoadsPanel
              model={model}
              dispatch={dispatch}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
            />
          )}
          {tab === 'moments' && (
            <MomentsPanel
              model={model}
              dispatch={dispatch}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
            />
          )}
        </aside>

        <main className="beam-calc__canvas">
          <BeamVisualizer beam={model} selectedId={selectedId} />
        </main>
      </div>

      {results?.solved && (
        <section className="beam-calc__results">
          <h3 className="beam-calc__results-title">Results</h3>
          <ResultsSummary results={results} />
          <DiagramsPanel results={results} length={model.length} />
        </section>
      )}

      {results && !results.solved && results.warnings.length > 0 && (
        <section className="beam-calc__results beam-calc__results--error">
          <h3 className="beam-calc__results-title">Cannot solve</h3>
          {results.warnings.map((w, i) => (
            <div key={i} className="beam-calc__issue">
              {w}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function tabLabel(t: Tab): string {
  return { beam: 'Beam', section: 'Section', supports: 'Supports', loads: 'Loads', moments: 'Moments' }[t];
}

function tabCount(m: BeamModel, t: Tab): string {
  if (t === 'supports') return String(m.supports.length);
  if (t === 'loads') return String(m.loads.length);
  if (t === 'moments') return String(m.moments.length);
  return '';
}

function validate(m: BeamModel): string[] {
  const issues: string[] = [];
  if (m.length <= 0) issues.push('Enter beam length in the Beam tab.');
  if (m.section.E <= 0) issues.push('Young\u2019s Modulus (E) must be greater than zero.');
  if (m.section.I <= 0) issues.push('Moment of Inertia (I) must be greater than zero.');
  if (m.supports.length < 1) issues.push('Add at least one support.');
  const hasFixed = m.supports.some((s) => s.type === 'fixed');
  const hasGuided = m.supports.some((s) => s.type === 'guided');
  const vertSupports = m.supports.filter((s) => s.type !== 'guided').length;
  if (vertSupports < 1 && m.supports.length > 0) {
    issues.push('Unstable: add at least one vertical support (pinned, roller, or fixed).');
  }
  if (m.supports.length > 0 && !hasFixed && !hasGuided && vertSupports < 2) {
    issues.push('Unstable: need \u22652 vertical supports or 1 fixed/guided support.');
  }
  if (m.length > 0 && m.supports.some((s) => s.position < 0 || s.position > m.length)) {
    issues.push('Support positions must be within beam length.');
  }
  if (m.loads.length === 0 && !m.selfWeight && m.moments.length === 0 && m.supports.length > 0) {
    issues.push('Add at least one load or moment (or enable Self Weight).');
  }
  return issues;
}

interface PanelProps {
  model: BeamModel;
  dispatch: React.Dispatch<Action>;
}

interface SelectablePanelProps extends PanelProps {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

function BeamPanel({ model, dispatch }: PanelProps) {
  return (
    <div className="panel">
      <h4 className="panel__title">Beam Geometry</h4>
      <label className="panel__field">
        <span>Length</span>
        <div className="panel__input-group">
          <input
            type="number"
            step="0.1"
            min="0"
            value={model.length}
            onChange={(e) => dispatch({ type: 'SET_LENGTH', length: parseFloat(e.target.value) || 0 })}
          />
          <span className="panel__unit">m</span>
        </div>
      </label>
      <div className="panel__hint">
        Total beam length in meters. Add supports and loads in the other tabs.
      </div>
    </div>
  );
}

function SectionPanel({ model, dispatch }: PanelProps) {
  const isCustom = model.section.material === 'custom';
  return (
    <div className="panel">
      <h4 className="panel__title">Section Properties</h4>

      <label className="panel__field">
        <span>Material</span>
        <select
          value={model.section.material}
          onChange={(e) => dispatch({ type: 'SET_MATERIAL', material: e.target.value as MaterialPreset })}
        >
          {(Object.keys(MATERIAL_PRESETS) as Array<keyof typeof MATERIAL_PRESETS>).map((k) => (
            <option key={k} value={k}>
              {MATERIAL_PRESETS[k].label}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </label>

      <label className="panel__field">
        <span>Young's Modulus (E)</span>
        <div className="panel__input-group">
          <input
            type="number"
            step="1000"
            value={model.section.E}
            disabled={!isCustom}
            onChange={(e) => dispatch({ type: 'SET_E', E: parseFloat(e.target.value) || 0 })}
          />
          <span className="panel__unit">MPa</span>
        </div>
      </label>

      <label className="panel__field">
        <span>Moment of Inertia (Iz)</span>
        <div className="panel__input-group">
          <input
            type="number"
            step="1e6"
            value={model.section.I}
            onChange={(e) => dispatch({ type: 'SET_I', I: parseFloat(e.target.value) || 0 })}
          />
          <span className="panel__unit">mm⁴</span>
        </div>
      </label>

      <label className="panel__field">
        <span>Area (A) — optional for self-weight</span>
        <div className="panel__input-group">
          <input
            type="number"
            step="100"
            value={model.section.A ?? ''}
            onChange={(e) =>
              dispatch({ type: 'SET_A', A: e.target.value === '' ? undefined : parseFloat(e.target.value) })
            }
          />
          <span className="panel__unit">mm²</span>
        </div>
      </label>

      <label className="panel__field">
        <span>Density</span>
        <div className="panel__input-group">
          <input
            type="number"
            step="10"
            value={model.density}
            onChange={(e) => dispatch({ type: 'SET_DENSITY', density: parseFloat(e.target.value) || 0 })}
          />
          <span className="panel__unit">kg/m³</span>
        </div>
      </label>

      <div className="panel__hint">
        {model.section.material === 'steel' && 'Default: ASTM A36 Steel, E = 200,000 MPa.'}
        {model.section.material === 'concrete' && 'Default: Concrete f\u2019c = 28 MPa, E ≈ 24,870 MPa.'}
        {model.section.material === 'aluminum' && 'Default: Aluminum 6061-T6, E = 69,000 MPa.'}
        {model.section.material === 'wood' && 'Default: Douglas Fir, E = 13,000 MPa.'}
        {isCustom && 'Enter your own E value.'}
      </div>
    </div>
  );
}

function SupportsPanel({ model, dispatch, selectedId, setSelectedId }: SelectablePanelProps) {
  const [type, setType] = useState<SupportType>('pinned');
  const [pos, setPos] = useState<string>('0');

  const add = () => {
    const p = parseFloat(pos);
    if (isNaN(p) || p < 0 || p > model.length) return;
    const id = newId('sup');
    dispatch({ type: 'ADD_SUPPORT', support: { id, type, position: p } });
    setPos('');
  };

  return (
    <div className="panel">
      <h4 className="panel__title">Supports</h4>

      <div className="panel__field">
        <span>Support Type</span>
        <div className="support-type-grid">
          {(['pinned', 'roller', 'fixed', 'guided'] as SupportType[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`support-type-btn ${type === t ? 'is-active' : ''}`}
              onClick={() => setType(t)}
              aria-label={t}
            >
              <SupportIcon type={t} />
              <span>{t}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="panel__field">
        <span>Position</span>
        <div className="panel__input-group">
          <input
            type="number"
            step="0.1"
            min="0"
            max={model.length}
            value={pos}
            onChange={(e) => setPos(e.target.value)}
            placeholder="Support location"
          />
          <span className="panel__unit">m</span>
          <div className="panel__quick">
            <button type="button" onClick={() => setPos('0')}>
              L
            </button>
            <button type="button" onClick={() => setPos((model.length / 2).toString())}>
              M
            </button>
            <button type="button" onClick={() => setPos(model.length.toString())}>
              R
            </button>
          </div>
        </div>
      </label>

      <button className="btn btn--primary panel__add" onClick={add}>
        Add Support
      </button>

      <div className="panel__list">
        {model.supports.map((s) => (
          <div
            key={s.id}
            className={`panel__item ${selectedId === s.id ? 'is-selected' : ''}`}
            onMouseEnter={() => setSelectedId(s.id)}
            onMouseLeave={() => setSelectedId(null)}
          >
            <SupportIcon type={s.type} small />
            <div className="panel__item-body">
              <div className="panel__item-title">{s.type}</div>
              <div className="panel__item-meta">x = {s.position.toFixed(3)} m</div>
            </div>
            <input
              type="number"
              className="panel__item-input"
              step="0.1"
              min="0"
              max={model.length}
              value={s.position}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_SUPPORT',
                  id: s.id,
                  patch: { position: parseFloat(e.target.value) || 0 },
                })
              }
            />
            <button
              className="panel__item-del"
              onClick={() => dispatch({ type: 'REMOVE_SUPPORT', id: s.id })}
              aria-label="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadsPanel({ model, dispatch, selectedId, setSelectedId }: SelectablePanelProps) {
  const [loadType, setLoadType] = useState<'point' | 'distributed'>('point');
  const [direction, setDirection] = useState<LoadDirection>('down');
  const [pos, setPos] = useState('');
  const [pos2, setPos2] = useState('');
  const [mag, setMag] = useState('10');
  const [mag2, setMag2] = useState('10');
  const [loadCase, setLoadCase] = useState<LoadCase>('dead');

  const add = () => {
    if (loadType === 'point') {
      const p = parseFloat(pos);
      const M = parseFloat(mag);
      if (isNaN(p) || isNaN(M)) return;
      dispatch({
        type: 'ADD_LOAD',
        load: {
          id: newId('pl'),
          type: 'point',
          position: p,
          magnitude: Math.abs(M),
          direction,
          loadCase,
        },
      });
      setPos('');
    } else {
      const a = parseFloat(pos);
      const b = parseFloat(pos2);
      const W1 = parseFloat(mag);
      const W2 = parseFloat(mag2);
      if (isNaN(a) || isNaN(b) || isNaN(W1)) return;
      dispatch({
        type: 'ADD_LOAD',
        load: {
          id: newId('dl'),
          type: 'distributed',
          startPosition: a,
          endPosition: b,
          startMagnitude: Math.abs(W1),
          endMagnitude: Math.abs(isNaN(W2) ? W1 : W2),
          direction,
          loadCase,
        },
      });
      setPos('');
      setPos2('');
    }
  };

  return (
    <div className="panel">
      <h4 className="panel__title">Loads</h4>

      <div className="panel__field">
        <span>Load Type</span>
        <div className="seg">
          <button
            type="button"
            className={loadType === 'point' ? 'is-active' : ''}
            onClick={() => setLoadType('point')}
          >
            Point
          </button>
          <button
            type="button"
            className={loadType === 'distributed' ? 'is-active' : ''}
            onClick={() => setLoadType('distributed')}
          >
            Distributed
          </button>
        </div>
      </div>

      <div className="panel__field">
        <span>Direction</span>
        <div className="seg">
          <button
            type="button"
            className={direction === 'down' ? 'is-active' : ''}
            onClick={() => setDirection('down')}
          >
            ↓ Down
          </button>
          <button
            type="button"
            className={direction === 'up' ? 'is-active' : ''}
            onClick={() => setDirection('up')}
          >
            ↑ Up
          </button>
        </div>
      </div>

      {loadType === 'point' ? (
        <>
          <label className="panel__field">
            <span>Position</span>
            <div className="panel__input-group">
              <input
                type="number"
                step="0.1"
                min="0"
                max={model.length}
                value={pos}
                onChange={(e) => setPos(e.target.value)}
              />
              <span className="panel__unit">m</span>
              <div className="panel__quick">
                <button type="button" onClick={() => setPos('0')}>
                  L
                </button>
                <button type="button" onClick={() => setPos((model.length / 2).toString())}>
                  M
                </button>
                <button type="button" onClick={() => setPos(model.length.toString())}>
                  R
                </button>
              </div>
            </div>
          </label>
          <label className="panel__field">
            <span>Magnitude</span>
            <div className="panel__input-group">
              <input type="number" step="0.1" value={mag} onChange={(e) => setMag(e.target.value)} />
              <span className="panel__unit">kN</span>
            </div>
          </label>
        </>
      ) : (
        <>
          <label className="panel__field">
            <span>Start Position</span>
            <div className="panel__input-group">
              <input
                type="number"
                step="0.1"
                min="0"
                max={model.length}
                value={pos}
                onChange={(e) => setPos(e.target.value)}
              />
              <span className="panel__unit">m</span>
            </div>
          </label>
          <label className="panel__field">
            <span>End Position</span>
            <div className="panel__input-group">
              <input
                type="number"
                step="0.1"
                min="0"
                max={model.length}
                value={pos2}
                onChange={(e) => setPos2(e.target.value)}
              />
              <span className="panel__unit">m</span>
            </div>
          </label>
          <label className="panel__field">
            <span>{'Start Magnitude (w\u2081)'}</span>
            <div className="panel__input-group">
              <input type="number" step="0.1" value={mag} onChange={(e) => setMag(e.target.value)} />
              <span className="panel__unit">kN/m</span>
            </div>
          </label>
          <label className="panel__field">
            <span>{'End Magnitude (w\u2082) \u2014 leave equal for UDL, differ for trapezoidal/triangular'}</span>
            <div className="panel__input-group">
              <input type="number" step="0.1" value={mag2} onChange={(e) => setMag2(e.target.value)} />
              <span className="panel__unit">kN/m</span>
              <div className="panel__quick">
                <button type="button" onClick={() => setMag2(mag)} title="Match start (uniform)">
                  =
                </button>
                <button type="button" onClick={() => setMag2('0')} title="Zero (triangular)">
                  0
                </button>
              </div>
            </div>
          </label>
        </>
      )}

      <label className="panel__field">
        <span>Load Case</span>
        <select value={loadCase} onChange={(e) => setLoadCase(e.target.value as LoadCase)}>
          {(Object.keys(LOAD_CASE_LABELS) as LoadCase[]).map((k) => (
            <option key={k} value={k}>
              {LOAD_CASE_LABELS[k]}
            </option>
          ))}
        </select>
      </label>

      <button className="btn btn--primary panel__add" onClick={add}>
        Add Load
      </button>

      <div className="panel__list">
        {model.loads.map((l) => (
          <div
            key={l.id}
            className={`panel__item ${selectedId === l.id ? 'is-selected' : ''}`}
            onMouseEnter={() => setSelectedId(l.id)}
            onMouseLeave={() => setSelectedId(null)}
          >
            <div className="panel__item-icon">
              {l.direction === 'down' ? '↓' : '↑'}
            </div>
            <div className="panel__item-body">
              <div className="panel__item-title">
                {l.type === 'point'
                  ? `Point ${l.magnitude} kN @ ${l.position.toFixed(2)} m`
                  : l.startMagnitude === l.endMagnitude
                    ? `UDL ${l.startMagnitude} kN/m [${l.startPosition.toFixed(2)}\u2013${l.endPosition.toFixed(2)}] m`
                    : `${l.startMagnitude}\u2192${l.endMagnitude} kN/m [${l.startPosition.toFixed(2)}\u2013${l.endPosition.toFixed(2)}] m`}
              </div>
              <div className="panel__item-meta">{LOAD_CASE_LABELS[l.loadCase]}</div>
            </div>
            <button
              className="panel__item-del"
              onClick={() => dispatch({ type: 'REMOVE_LOAD', id: l.id })}
              aria-label="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MomentsPanel({ model, dispatch, selectedId, setSelectedId }: SelectablePanelProps) {
  const [pos, setPos] = useState('');
  const [mag, setMag] = useState('10');
  const [dir, setDir] = useState<'cw' | 'ccw'>('ccw');

  const add = () => {
    const p = parseFloat(pos);
    const M = parseFloat(mag);
    if (isNaN(p) || isNaN(M)) return;
    dispatch({
      type: 'ADD_MOMENT',
      moment: { id: newId('m'), position: p, magnitude: Math.abs(M), direction: dir },
    });
    setPos('');
  };

  return (
    <div className="panel">
      <h4 className="panel__title">Applied Moments</h4>

      <label className="panel__field">
        <span>Position</span>
        <div className="panel__input-group">
          <input
            type="number"
            step="0.1"
            min="0"
            max={model.length}
            value={pos}
            onChange={(e) => setPos(e.target.value)}
          />
          <span className="panel__unit">m</span>
          <div className="panel__quick">
            <button type="button" onClick={() => setPos('0')}>
              L
            </button>
            <button type="button" onClick={() => setPos((model.length / 2).toString())}>
              M
            </button>
            <button type="button" onClick={() => setPos(model.length.toString())}>
              R
            </button>
          </div>
        </div>
      </label>

      <label className="panel__field">
        <span>Magnitude</span>
        <div className="panel__input-group">
          <input type="number" step="0.1" value={mag} onChange={(e) => setMag(e.target.value)} />
          <span className="panel__unit">kN·m</span>
        </div>
      </label>

      <div className="panel__field">
        <span>Direction</span>
        <div className="seg">
          <button type="button" className={dir === 'ccw' ? 'is-active' : ''} onClick={() => setDir('ccw')}>
            ↺ CCW
          </button>
          <button type="button" className={dir === 'cw' ? 'is-active' : ''} onClick={() => setDir('cw')}>
            ↻ CW
          </button>
        </div>
      </div>

      <button className="btn btn--primary panel__add" onClick={add}>
        Add Moment
      </button>

      <div className="panel__list">
        {model.moments.map((m) => (
          <div
            key={m.id}
            className={`panel__item ${selectedId === m.id ? 'is-selected' : ''}`}
            onMouseEnter={() => setSelectedId(m.id)}
            onMouseLeave={() => setSelectedId(null)}
          >
            <div className="panel__item-icon">{m.direction === 'ccw' ? '↺' : '↻'}</div>
            <div className="panel__item-body">
              <div className="panel__item-title">
                {m.magnitude} kN·m @ {m.position.toFixed(2)} m
              </div>
              <div className="panel__item-meta">{m.direction === 'ccw' ? 'Counter-clockwise' : 'Clockwise'}</div>
            </div>
            <button
              className="panel__item-del"
              onClick={() => dispatch({ type: 'REMOVE_MOMENT', id: m.id })}
              aria-label="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SupportIcon({ type, small }: { type: SupportType; small?: boolean }) {
  const size = small ? 22 : 30;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {type === 'pinned' && (
        <>
          <polygon points="16,8 6,24 26,24" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <line x1="3" y1="24" x2="29" y2="24" stroke="currentColor" strokeWidth="1.5" />
          <line x1="5" y1="27" x2="8" y2="24" stroke="currentColor" strokeWidth="1" />
          <line x1="11" y1="27" x2="14" y2="24" stroke="currentColor" strokeWidth="1" />
          <line x1="17" y1="27" x2="20" y2="24" stroke="currentColor" strokeWidth="1" />
          <line x1="23" y1="27" x2="26" y2="24" stroke="currentColor" strokeWidth="1" />
        </>
      )}
      {type === 'roller' && (
        <>
          <circle cx="11" cy="19" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <circle cx="21" cy="19" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <line x1="3" y1="24" x2="29" y2="24" stroke="currentColor" strokeWidth="1.5" />
          <line x1="5" y1="27" x2="8" y2="24" stroke="currentColor" strokeWidth="1" />
          <line x1="11" y1="27" x2="14" y2="24" stroke="currentColor" strokeWidth="1" />
          <line x1="17" y1="27" x2="20" y2="24" stroke="currentColor" strokeWidth="1" />
          <line x1="23" y1="27" x2="26" y2="24" stroke="currentColor" strokeWidth="1" />
        </>
      )}
      {type === 'fixed' && (
        <>
          <line x1="8" y1="4" x2="8" y2="28" stroke="currentColor" strokeWidth="1.5" />
          <line x1="8" y1="16" x2="28" y2="16" stroke="currentColor" strokeWidth="1.5" />
          <line x1="4" y1="6" x2="8" y2="10" stroke="currentColor" strokeWidth="1" />
          <line x1="4" y1="12" x2="8" y2="16" stroke="currentColor" strokeWidth="1" />
          <line x1="4" y1="18" x2="8" y2="22" stroke="currentColor" strokeWidth="1" />
          <line x1="4" y1="24" x2="8" y2="28" stroke="currentColor" strokeWidth="1" />
        </>
      )}
      {type === 'guided' && (
        <>
          <rect x="8" y="12" width="16" height="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <line x1="4" y1="24" x2="28" y2="24" stroke="currentColor" strokeWidth="1.5" />
          <line x1="6" y1="27" x2="9" y2="24" stroke="currentColor" strokeWidth="1" />
          <line x1="12" y1="27" x2="15" y2="24" stroke="currentColor" strokeWidth="1" />
          <line x1="18" y1="27" x2="21" y2="24" stroke="currentColor" strokeWidth="1" />
          <line x1="24" y1="27" x2="27" y2="24" stroke="currentColor" strokeWidth="1" />
        </>
      )}
    </svg>
  );
}

function ResultsSummary({ results }: { results: Results }) {
  return (
    <div className="results-summary">
      <div className="results-summary__reactions">
        <h4>Reactions</h4>
        <table>
          <thead>
            <tr>
              <th>Support</th>
              <th>x (m)</th>
              <th>Vertical (kN)</th>
              <th>Moment (kN·m)</th>
            </tr>
          </thead>
          <tbody>
            {results.reactions.map((r, i) => (
              <tr key={r.supportId}>
                <td>#{i + 1} {r.type}</td>
                <td>{r.position.toFixed(3)}</td>
                <td>{r.V.toFixed(3)}</td>
                <td>{r.type === 'fixed' ? r.M.toFixed(3) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="results-summary__extremes">
        <div className="results-summary__card">
          <div className="results-summary__card-label">Max Shear V⁺</div>
          <div className="results-summary__card-value">{results.maxShear.value.toFixed(3)} kN</div>
          <div className="results-summary__card-sub">@ {results.maxShear.position.toFixed(3)} m</div>
        </div>
        <div className="results-summary__card">
          <div className="results-summary__card-label">Min Shear V⁻</div>
          <div className="results-summary__card-value">{results.minShear.value.toFixed(3)} kN</div>
          <div className="results-summary__card-sub">@ {results.minShear.position.toFixed(3)} m</div>
        </div>
        <div className="results-summary__card">
          <div className="results-summary__card-label">Max Moment M⁺</div>
          <div className="results-summary__card-value">{results.maxMoment.value.toFixed(3)} kN·m</div>
          <div className="results-summary__card-sub">@ {results.maxMoment.position.toFixed(3)} m</div>
        </div>
        <div className="results-summary__card">
          <div className="results-summary__card-label">Min Moment M⁻</div>
          <div className="results-summary__card-value">{results.minMoment.value.toFixed(3)} kN·m</div>
          <div className="results-summary__card-sub">@ {results.minMoment.position.toFixed(3)} m</div>
        </div>
        <div className="results-summary__card">
          <div className="results-summary__card-label">Max Deflection δ</div>
          <div className="results-summary__card-value">{results.maxDeflection.value.toFixed(3)} mm</div>
          <div className="results-summary__card-sub">@ {results.maxDeflection.position.toFixed(3)} m</div>
        </div>
      </div>
    </div>
  );
}
