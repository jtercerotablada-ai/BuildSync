'use client';

import React, { useMemo, useReducer, useState } from 'react';
import { solve } from '@/lib/advanced-beam/solver';
import {
  MATERIAL_PRESETS,
  type BeamModel, type Segment, type Support, type Hinge, type Load,
  type SupportType, type LoadCase, type MaterialPreset, type Results,
} from '@/lib/advanced-beam/types';
import { AdvancedBeamSchematic, buildSupportLabels } from './AdvancedBeamSchematic';
import { AdvancedBeamDiagrams } from './AdvancedBeamDiagrams';

/* ── state + reducer ─────────────────────────────────────────────────── */
type Action =
  | { type: 'SET_LENGTH'; length: number }
  | { type: 'LOAD_PRESET'; model: BeamModel }
  | { type: 'ADD_SEGMENT' } | { type: 'UPDATE_SEGMENT'; id: string; patch: Partial<Segment> } | { type: 'REMOVE_SEGMENT'; id: string }
  | { type: 'APPLY_MATERIAL_TO_SEGMENT'; id: string; material: MaterialPreset }
  | { type: 'ADD_SUPPORT'; supportType?: SupportType } | { type: 'UPDATE_SUPPORT'; id: string; patch: Partial<Support> } | { type: 'REMOVE_SUPPORT'; id: string }
  | { type: 'ADD_HINGE' } | { type: 'UPDATE_HINGE'; id: string; patch: Partial<Hinge> } | { type: 'REMOVE_HINGE'; id: string }
  | { type: 'ADD_LOAD'; loadType: Load['type'] } | { type: 'UPDATE_LOAD'; id: string; patch: Partial<Load> } | { type: 'REMOVE_LOAD'; id: string };

const idGen = (() => { let n = 0; return (p: string) => `${p}-${++n}-${Math.random().toString(36).slice(2, 6)}`; })();

function reducer(state: BeamModel, action: Action): BeamModel {
  switch (action.type) {
    case 'SET_LENGTH': {
      const newL = Math.max(0.1, action.length);
      const segments = state.segments.map((s) => ({ ...s, endPosition: Math.min(s.endPosition, newL), startPosition: Math.min(s.startPosition, newL) }));
      if (segments.length) segments[segments.length - 1].endPosition = newL;
      const supports = state.supports.map((s) => ({ ...s, position: Math.min(s.position, newL) }));
      const hinges = state.hinges.map((h) => ({ ...h, position: Math.min(h.position, newL) }));
      const loads = state.loads.map((ld) =>
        ld.type === 'point' || ld.type === 'moment' ? { ...ld, position: Math.min(ld.position, newL) }
          : ld.type === 'distributed' ? { ...ld, startPosition: Math.min(ld.startPosition, newL), endPosition: Math.min(ld.endPosition, newL) } : ld);
      return { ...state, totalLength: newL, segments, supports, hinges, loads };
    }
    case 'LOAD_PRESET': return action.model;
    case 'ADD_SEGMENT': {
      const last = state.segments[state.segments.length - 1];
      const start = last ? last.endPosition : 0;
      const end = Math.min(state.totalLength, start + (state.totalLength - start) / 2 || 1);
      return { ...state, segments: [...state.segments, { id: idGen('seg'), startPosition: start, endPosition: end, E: 200_000, I: 100e6, A: 5_000 }] };
    }
    case 'UPDATE_SEGMENT': return { ...state, segments: state.segments.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)) };
    case 'REMOVE_SEGMENT': return { ...state, segments: state.segments.filter((s) => s.id !== action.id) };
    case 'APPLY_MATERIAL_TO_SEGMENT': {
      if (action.material === 'custom') return { ...state, segments: state.segments.map((s) => (s.id === action.id ? { ...s, material: 'custom' } : s)) };
      const preset = MATERIAL_PRESETS[action.material];
      return { ...state, segments: state.segments.map((s) => (s.id === action.id ? { ...s, material: action.material, E: preset.E, density: preset.density, alpha: preset.alpha } : s)) };
    }
    case 'ADD_SUPPORT': return { ...state, supports: [...state.supports, { id: idGen('sup'), position: state.totalLength / 2, type: action.supportType ?? 'roller' }] };
    case 'UPDATE_SUPPORT': return { ...state, supports: state.supports.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)) };
    case 'REMOVE_SUPPORT': return { ...state, supports: state.supports.filter((s) => s.id !== action.id) };
    case 'ADD_HINGE': return { ...state, hinges: [...state.hinges, { id: idGen('h'), position: state.totalLength / 2 }] };
    case 'UPDATE_HINGE': return { ...state, hinges: state.hinges.map((h) => (h.id === action.id ? { ...h, ...action.patch } : h)) };
    case 'REMOVE_HINGE': return { ...state, hinges: state.hinges.filter((h) => h.id !== action.id) };
    case 'ADD_LOAD': {
      const x = state.totalLength / 2; let load: Load;
      if (action.loadType === 'point') load = { id: idGen('p'), type: 'point', position: x, magnitude: 10, direction: 'down', loadCase: 'live' };
      else if (action.loadType === 'moment') load = { id: idGen('m'), type: 'moment', position: x, magnitude: 10, direction: 'ccw', loadCase: 'live' };
      else if (action.loadType === 'distributed') load = { id: idGen('w'), type: 'distributed', startPosition: 0, endPosition: state.totalLength, startMagnitude: 5, endMagnitude: 5, direction: 'down', loadCase: 'live' };
      else { const seg = state.segments[0]; load = { id: idGen('t'), type: 'thermal', segmentId: seg ? seg.id : '', deltaTGradient: 20, loadCase: 'live' }; }
      return { ...state, loads: [...state.loads, load] };
    }
    case 'UPDATE_LOAD': return { ...state, loads: state.loads.map((ld) => (ld.id === action.id ? ({ ...ld, ...action.patch } as Load) : ld)) };
    case 'REMOVE_LOAD': return { ...state, loads: state.loads.filter((ld) => ld.id !== action.id) };
  }
}

/* ── templates ───────────────────────────────────────────────────────── */
const PRESETS: { label: string; build: () => BeamModel }[] = [
  { label: 'Simply supported · point', build: () => buildPreset({ L: 6, supports: [['pin', 0], ['roller', 6]], loads: [{ kind: 'point', x: 3, mag: 50 }] }) },
  { label: 'Simply supported · UDL', build: () => buildPreset({ L: 6, supports: [['pin', 0], ['roller', 6]], loads: [{ kind: 'udl', a: 0, b: 6, w: 10 }] }) },
  { label: 'Cantilever · tip', build: () => buildPreset({ L: 4, supports: [['fixed', 0]], loads: [{ kind: 'point', x: 4, mag: 30 }] }) },
  { label: 'Cantilever · UDL', build: () => buildPreset({ L: 4, supports: [['fixed', 0]], loads: [{ kind: 'udl', a: 0, b: 4, w: 8 }] }) },
  { label: 'Fixed–fixed · UDL', build: () => buildPreset({ L: 6, supports: [['fixed', 0], ['fixed', 6]], loads: [{ kind: 'udl', a: 0, b: 6, w: 10 }] }) },
  { label: 'Propped cantilever', build: () => buildPreset({ L: 6, supports: [['fixed', 0], ['roller', 6]], loads: [{ kind: 'udl', a: 0, b: 6, w: 10 }] }) },
  { label: 'Two-span continuous', build: () => buildPreset({ L: 12, supports: [['pin', 0], ['roller', 6], ['roller', 12]], loads: [{ kind: 'udl', a: 0, b: 12, w: 10 }] }) },
  { label: 'Three-span continuous', build: () => buildPreset({ L: 18, supports: [['pin', 0], ['roller', 6], ['roller', 12], ['roller', 18]], loads: [{ kind: 'udl', a: 0, b: 18, w: 10 }] }) },
  { label: 'Gerber (hinge)', build: () => buildPreset({ L: 12, supports: [['fixed', 0], ['roller', 12]], hinges: [6], loads: [{ kind: 'udl', a: 0, b: 12, w: 8 }] }) },
];
function buildPreset(opts: { L: number; supports: [SupportType, number][]; loads?: ({ kind: 'point'; x: number; mag: number } | { kind: 'udl'; a: number; b: number; w: number })[]; hinges?: number[] }): BeamModel {
  return {
    totalLength: opts.L,
    segments: [{ id: idGen('seg'), startPosition: 0, endPosition: opts.L, E: 200_000, I: 180e6, A: 5710, material: 'steel-A992', density: 7850, alpha: 1.2e-5, h: 350 }],
    supports: opts.supports.map(([type, pos]) => ({ id: idGen('sup'), position: pos, type })),
    hinges: (opts.hinges ?? []).map((pos) => ({ id: idGen('h'), position: pos })),
    loads: (opts.loads ?? []).map((ld) => ld.kind === 'point'
      ? { id: idGen('p'), type: 'point', position: ld.x, magnitude: ld.mag, direction: 'down', loadCase: 'live' as LoadCase }
      : { id: idGen('w'), type: 'distributed', startPosition: ld.a, endPosition: ld.b, startMagnitude: ld.w, endMagnitude: ld.w, direction: 'down', loadCase: 'live' as LoadCase }),
  };
}

/* ── component ───────────────────────────────────────────────────────── */
type Tab = 'segments' | 'supports' | 'hinges' | 'loads';
interface TabProps { model: BeamModel; dispatch: React.Dispatch<Action> }
const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');

export function AdvancedBeamCalculator() {
  const [model, dispatch] = useReducer(reducer, undefined, () => PRESETS[6].build());
  const [tab, setTab] = useState<Tab>('loads');
  const [showDeformed, setShowDeformed] = useState(true);
  const [computeModes, setComputeModes] = useState(0);

  const results = useMemo(() => solve(model, { computeModes }), [model, computeModes]);
  const supportLabels = useMemo(() => buildSupportLabels(model.supports), [model.supports]);
  const hingeLabels = useMemo(() => {
    const sorted = [...model.hinges].sort((a, b) => a.position - b.position);
    const map: Record<string, string> = {}; sorted.forEach((h, i) => (map[h.id] = `H${i + 1}`)); return map;
  }, [model.hinges]);

  return (
    <div className="stl abx">
      <div className="stl-sheethead">
        <div><div className="stl-brand">TERCERO TABLADA</div><div className="stl-brand-sub">Civil &amp; Structural Engineering Inc.</div></div>
        <div className="stl-sheettitle"><strong>ADVANCED BEAM ANALYSIS</strong><span className="stl-code">MULTI-SPAN FEM · EULER-BERNOULLI</span></div>
      </div>

      {/* templates + controls */}
      <div className="abx-controls">
        <div className="abx-chips">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="abx-chip" onClick={() => dispatch({ type: 'LOAD_PRESET', model: p.build() })}>{p.label}</button>
          ))}
        </div>
        <div className="abx-ctrlbar">
          <label className="abx-ctrl"><span>Length L (m)</span>
            <input type="number" min="0.1" step="0.1" value={model.totalLength} onChange={(e) => dispatch({ type: 'SET_LENGTH', length: parseFloat(e.target.value) || 0.1 })} /></label>
          <label className="abx-ctrl abx-ctrl--check"><input type="checkbox" checked={showDeformed} onChange={(e) => setShowDeformed(e.target.checked)} /><span>Deformed shape</span></label>
          <label className="abx-ctrl"><span>Modes</span>
            <input type="number" min="0" max="5" step="1" value={computeModes} onChange={(e) => setComputeModes(Math.max(0, Math.min(5, parseInt(e.target.value) || 0)))} /></label>
        </div>
      </div>

      {/* schematic */}
      <div className="stl-card stl-card--pmblock">
        <h4>Model <span className="stl-tag">schematic{showDeformed ? ' · deformed' : ''}</span></h4>
        <AdvancedBeamSchematic model={model} deflection={results.deflection} showDeformed={showDeformed && results.solved} supportLabels={supportLabels} />
      </div>

      {results.warnings.length > 0 && (
        <div className="abx-warnings">{results.warnings.map((w, i) => <div key={i} className="abx-warning">⚠ {w}</div>)}</div>
      )}

      {/* inputs */}
      <div className="stl-card stl-card--pmblock">
        <div className="stl-seg abx-tabs" role="tablist">
          {([['segments', `Segments · ${model.segments.length}`], ['supports', `Supports · ${model.supports.length}`], ['hinges', `Hinges · ${model.hinges.length}`], ['loads', `Loads · ${model.loads.length}`]] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
        {tab === 'segments' && <SegmentsTab model={model} dispatch={dispatch} />}
        {tab === 'supports' && <SupportsTab model={model} dispatch={dispatch} labels={supportLabels} />}
        {tab === 'hinges' && <HingesTab model={model} dispatch={dispatch} labels={hingeLabels} />}
        {tab === 'loads' && <LoadsTab model={model} dispatch={dispatch} />}
      </div>

      {/* diagrams */}
      <div className="stl-card stl-card--pmblock">
        <h4>Diagrams <span className="stl-tag">V · M · θ · δ</span></h4>
        <AdvancedBeamDiagrams results={results} totalLength={model.totalLength} />
      </div>

      {/* results */}
      <div className="stl-cards">
        <ReactionsPanel results={results} labels={supportLabels} />
        <KeyResultsPanel results={results} />
      </div>

      {results.modes && results.modes.length > 0 && (
        <div className="stl-card stl-card--pmblock">
          <h4>Natural modes <span className="stl-tag">consistent mass</span></h4>
          <div className="abx-modes">
            {results.modes.map((mode, i) => (
              <div className="abx-mode" key={i}>
                <div className="abx-mode__hz"><strong>{mode.frequencyHz.toFixed(2)}</strong> Hz<span>ω {mode.omega.toFixed(1)} rad/s</span></div>
                <ModeShape shape={mode.shape} L={model.totalLength} idx={i + 1} />
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="stl-disclaimer">
        First-order elastic direct-stiffness (FEM) Euler-Bernoulli analysis of a multi-span beam with variable EI,
        internal hinges, spring supports, prescribed settlements/rotations, thermal gradients and self-weight, plus
        natural-mode analysis. Sign convention: downward load positive, sagging moment positive, deflection reported in
        mm (up positive). Metric units. Verify the model independently; a licensed P.E. review remains required.
      </p>
    </div>
  );
}

/* ── input tables ────────────────────────────────────────────────────── */
function SegmentsTab({ model, dispatch }: TabProps) {
  return (
    <>
      <div className="abx-tablewrap"><table className="abx-table"><thead><tr>
        <th>#</th><th>Start</th><th>End</th><th>Material</th><th>E (MPa)</th><th>I (mm⁴)</th><th>A (mm²)</th><th>h (mm)</th><th>α (1/°C)</th><th>SW</th><th></th>
      </tr></thead><tbody>
        {model.segments.map((s, idx) => (
          <tr key={s.id}>
            <td className="abx-mono">{idx + 1}</td>
            <td><Num val={s.startPosition} step={0.1} onChange={(v) => dispatch({ type: 'UPDATE_SEGMENT', id: s.id, patch: { startPosition: v } })} /></td>
            <td><Num val={s.endPosition} step={0.1} onChange={(v) => dispatch({ type: 'UPDATE_SEGMENT', id: s.id, patch: { endPosition: v } })} /></td>
            <td><select value={s.material ?? 'custom'} onChange={(e) => dispatch({ type: 'APPLY_MATERIAL_TO_SEGMENT', id: s.id, material: e.target.value as MaterialPreset })}>
              <option value="custom">Custom</option>{Object.entries(MATERIAL_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></td>
            <td><Num val={s.E} step={1000} onChange={(v) => dispatch({ type: 'UPDATE_SEGMENT', id: s.id, patch: { E: v, material: 'custom' } })} /></td>
            <td><Num val={s.I} step={1e6} sci onChange={(v) => dispatch({ type: 'UPDATE_SEGMENT', id: s.id, patch: { I: v } })} /></td>
            <td><Num val={s.A ?? 0} step={100} onChange={(v) => dispatch({ type: 'UPDATE_SEGMENT', id: s.id, patch: { A: v || undefined } })} /></td>
            <td><Num val={s.h ?? 0} step={10} onChange={(v) => dispatch({ type: 'UPDATE_SEGMENT', id: s.id, patch: { h: v || undefined } })} /></td>
            <td><Num val={s.alpha ?? 1.2e-5} step={1e-6} sci onChange={(v) => dispatch({ type: 'UPDATE_SEGMENT', id: s.id, patch: { alpha: v } })} /></td>
            <td><input type="checkbox" checked={!!s.selfWeight} onChange={(e) => dispatch({ type: 'UPDATE_SEGMENT', id: s.id, patch: { selfWeight: e.target.checked } })} /></td>
            <td><button type="button" className="stl-x" onClick={() => dispatch({ type: 'REMOVE_SEGMENT', id: s.id })}>×</button></td>
          </tr>
        ))}
      </tbody></table></div>
      <button type="button" className="stl-add" onClick={() => dispatch({ type: 'ADD_SEGMENT' })}>+ segment</button>
    </>
  );
}
function SupportsTab({ model, dispatch, labels }: TabProps & { labels: Record<string, string> }) {
  return (
    <>
      <div className="abx-tablewrap"><table className="abx-table"><thead><tr>
        <th>Lbl</th><th>x (m)</th><th>Type</th><th>k_v (kN/m)</th><th>k_r (kN·m/rad)</th><th>Settle (mm)</th><th>Rot (rad)</th><th></th>
      </tr></thead><tbody>
        {model.supports.map((s) => (
          <tr key={s.id}>
            <td className="abx-lbl">{labels[s.id] ?? s.id.slice(0, 4)}</td>
            <td><Num val={s.position} step={0.1} onChange={(v) => dispatch({ type: 'UPDATE_SUPPORT', id: s.id, patch: { position: v } })} /></td>
            <td><select value={s.type} onChange={(e) => dispatch({ type: 'UPDATE_SUPPORT', id: s.id, patch: { type: e.target.value as SupportType } })}>
              <option value="pin">Pin</option><option value="roller">Roller</option><option value="fixed">Fixed</option><option value="spring">Spring</option><option value="free">Free</option></select></td>
            <td>{s.type === 'spring' ? <Num val={s.kv ?? 0} step={100} onChange={(v) => dispatch({ type: 'UPDATE_SUPPORT', id: s.id, patch: { kv: v || undefined } })} /> : <span className="abx-na">—</span>}</td>
            <td>{s.type === 'spring' ? <Num val={s.kr ?? 0} step={100} onChange={(v) => dispatch({ type: 'UPDATE_SUPPORT', id: s.id, patch: { kr: v || undefined } })} /> : <span className="abx-na">—</span>}</td>
            <td><Num val={s.settlement ?? 0} step={1} onChange={(v) => dispatch({ type: 'UPDATE_SUPPORT', id: s.id, patch: { settlement: v || undefined } })} /></td>
            <td>{(s.type === 'fixed' || s.type === 'spring') ? <Num val={s.rotation ?? 0} step={1e-3} sci onChange={(v) => dispatch({ type: 'UPDATE_SUPPORT', id: s.id, patch: { rotation: v || undefined } })} /> : <span className="abx-na">—</span>}</td>
            <td><button type="button" className="stl-x" onClick={() => dispatch({ type: 'REMOVE_SUPPORT', id: s.id })}>×</button></td>
          </tr>
        ))}
      </tbody></table></div>
      <div className="abx-addrow">
        {(['pin', 'roller', 'fixed', 'spring'] as const).map((t) => <button key={t} type="button" className="stl-add abx-addinline" onClick={() => dispatch({ type: 'ADD_SUPPORT', supportType: t })}>+ {t}</button>)}
      </div>
    </>
  );
}
function HingesTab({ model, dispatch, labels }: TabProps & { labels: Record<string, string> }) {
  return (
    <>
      {model.hinges.length === 0 ? <p className="stl-note">No internal hinges. Add one to release moment continuity at a point (e.g. a Gerber beam).</p> : (
        <div className="abx-tablewrap"><table className="abx-table"><thead><tr><th>Lbl</th><th>Position (m)</th><th></th></tr></thead><tbody>
          {model.hinges.map((h) => (
            <tr key={h.id}><td className="abx-lbl">{labels[h.id] ?? h.id.slice(0, 4)}</td>
              <td><Num val={h.position} step={0.1} onChange={(v) => dispatch({ type: 'UPDATE_HINGE', id: h.id, patch: { position: v } })} /></td>
              <td><button type="button" className="stl-x" onClick={() => dispatch({ type: 'REMOVE_HINGE', id: h.id })}>×</button></td></tr>
          ))}
        </tbody></table></div>
      )}
      <button type="button" className="stl-add" onClick={() => dispatch({ type: 'ADD_HINGE' })}>+ hinge</button>
    </>
  );
}
function LoadsTab({ model, dispatch }: TabProps) {
  const up = (id: string, patch: Partial<Load>) => dispatch({ type: 'UPDATE_LOAD', id, patch });
  return (
    <>
      {model.loads.length === 0 ? <p className="stl-note">No loads. Add a point load, distributed (trapezoidal) load, applied moment or thermal gradient.</p> : (
        <div className="abx-tablewrap"><table className="abx-table"><thead><tr>
          <th>Type</th><th>Position / range (m)</th><th>Magnitude</th><th>Dir</th><th>Case</th><th></th>
        </tr></thead><tbody>
          {model.loads.map((ld) => (
            <tr key={ld.id}>
              <td className="abx-lbl">{ld.type === 'point' ? 'Point kN' : ld.type === 'distributed' ? 'UDL kN/m' : ld.type === 'moment' ? 'Moment kN·m' : 'Thermal °C'}</td>
              <td>{ld.type === 'point' || ld.type === 'moment'
                ? <Num val={ld.position} step={0.1} onChange={(v) => up(ld.id, { position: v } as Partial<Load>)} />
                : ld.type === 'distributed'
                  ? <span className="abx-pair"><Num val={ld.startPosition} step={0.1} onChange={(v) => up(ld.id, { startPosition: v } as Partial<Load>)} /><i>→</i><Num val={ld.endPosition} step={0.1} onChange={(v) => up(ld.id, { endPosition: v } as Partial<Load>)} /></span>
                  : <select value={ld.segmentId} onChange={(e) => up(ld.id, { segmentId: e.target.value } as Partial<Load>)}>{model.segments.map((s, i) => <option key={s.id} value={s.id}>Seg {i + 1}</option>)}</select>}</td>
              <td>{ld.type === 'point' || ld.type === 'moment'
                ? <Num val={ld.magnitude} step={1} onChange={(v) => up(ld.id, { magnitude: v } as Partial<Load>)} />
                : ld.type === 'distributed'
                  ? <span className="abx-pair"><Num val={ld.startMagnitude} step={1} onChange={(v) => up(ld.id, { startMagnitude: v } as Partial<Load>)} /><i>→</i><Num val={ld.endMagnitude} step={1} onChange={(v) => up(ld.id, { endMagnitude: v } as Partial<Load>)} /></span>
                  : <Num val={ld.deltaTGradient} step={5} onChange={(v) => up(ld.id, { deltaTGradient: v } as Partial<Load>)} />}</td>
              <td>{ld.type === 'point' || ld.type === 'distributed'
                ? <select value={ld.direction} onChange={(e) => up(ld.id, { direction: e.target.value as 'down' | 'up' } as Partial<Load>)}><option value="down">↓</option><option value="up">↑</option></select>
                : ld.type === 'moment'
                  ? <select value={ld.direction} onChange={(e) => up(ld.id, { direction: e.target.value as 'cw' | 'ccw' } as Partial<Load>)}><option value="ccw">↺</option><option value="cw">↻</option></select>
                  : <span className="abx-na">—</span>}</td>
              <td><select value={ld.loadCase ?? 'live'} onChange={(e) => up(ld.id, { loadCase: e.target.value as LoadCase } as Partial<Load>)}><option value="dead">Dead</option><option value="live">Live</option><option value="wind">Wind</option><option value="snow">Snow</option><option value="seismic">Seismic</option></select></td>
              <td><button type="button" className="stl-x" onClick={() => dispatch({ type: 'REMOVE_LOAD', id: ld.id })}>×</button></td>
            </tr>
          ))}
        </tbody></table></div>
      )}
      <div className="abx-addrow">
        {(['point', 'distributed', 'moment', 'thermal'] as const).map((t) => <button key={t} type="button" className="stl-add abx-addinline" onClick={() => dispatch({ type: 'ADD_LOAD', loadType: t })}>+ {t}</button>)}
      </div>
    </>
  );
}

/* ── result panels ───────────────────────────────────────────────────── */
function ReactionsPanel({ results, labels }: { results: Results; labels: Record<string, string> }) {
  return (
    <div className="stl-card">
      <h4>Reactions <span className="stl-tag">↑ kN · kN·m</span></h4>
      {results.reactions.length === 0 ? <p className="stl-note">—</p> : (
        <table className="stl-table"><tbody>
          {results.reactions.map((r) => (
            <Row key={r.supportId} k={`${labels[r.supportId] ?? '—'} · ${r.type} @ ${fmt(r.position, 1)} m`} v={<strong>{fmt(r.V, 2)}</strong>} unit="kN" ref={Math.abs(r.M) > 1e-6 ? `${fmt(r.M, 1)} kN·m` : ''} />
          ))}
        </tbody></table>
      )}
    </div>
  );
}
function KeyResultsPanel({ results }: { results: Results }) {
  const rows: [string, number, string, number][] = [
    ['Max +V', results.maxShear.value, 'kN', results.maxShear.position],
    ['Min −V', results.minShear.value, 'kN', results.minShear.position],
    ['Max +M (sag)', results.maxMoment.value, 'kN·m', results.maxMoment.position],
    ['Min −M (hog)', results.minMoment.value, 'kN·m', results.minMoment.position],
    ['Max |δ|', results.maxDeflection.value, 'mm', results.maxDeflection.position],
  ];
  return (
    <div className="stl-card">
      <h4>Envelope <span className="stl-tag">max / location</span></h4>
      <table className="stl-table"><tbody>
        {rows.map(([label, v, unit, pos]) => <Row key={label} k={label} v={<strong>{fmt(v, 2)}</strong>} unit={unit} ref={`@ ${fmt(pos, 2)} m`} />)}
      </tbody></table>
    </div>
  );
}
function ModeShape({ shape, L, idx }: { shape: { x: number; value: number }[]; L: number; idx: number }) {
  if (!shape.length) return null;
  let m = 0; for (const p of shape) m = Math.max(m, Math.abs(p.value));
  if (m === 0) return null;
  const W = 240, H = 56, margin = 6, drawW = W - 2 * margin;
  const x2 = (x: number) => margin + (x / L) * drawW;
  const y2 = (v: number) => H / 2 - (v / m) * (H / 2 - margin);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="abx-modesvg">
      <text x={margin} y={12} className="stl-chart__lbl" style={{ fill: '#221e17', fontWeight: 600 }}>Mode {idx}</text>
      <line x1={margin} y1={H / 2} x2={W - margin} y2={H / 2} stroke="#e6e0d2" />
      <polyline points={shape.map((p) => `${x2(p.x).toFixed(1)},${y2(p.value).toFixed(1)}`).join(' ')} fill="none" stroke="#221e17" strokeWidth="1.6" />
    </svg>
  );
}
function Row({ k, v, unit, ref }: { k: string; v: React.ReactNode; unit?: string; ref?: string }) {
  return (<tr><td className="stl-k">{k}</td><td className="stl-v">{v}{unit ? <span className="stl-unit"> {unit}</span> : null}</td><td className="stl-ref">{ref}</td></tr>);
}

/* ── numeric input ───────────────────────────────────────────────────── */
function Num({ val, onChange, step = 1, sci = false }: { val: number; onChange: (v: number) => void; step?: number; sci?: boolean }) {
  return (
    <input type="number" className="abx-num" step={step} value={Number.isFinite(val) ? (sci ? val.toExponential(2) : val) : ''}
      onChange={(e) => { const v = parseFloat(e.target.value); onChange(Number.isFinite(v) ? v : 0); }} />
  );
}
