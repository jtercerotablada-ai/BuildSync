'use client';

import React, { useReducer, useMemo, useState } from 'react';
import { analyzeCombinedFooting } from '@/lib/combined-footing/solver';
import { COMBINED_FOOTING_PRESETS } from '@/lib/combined-footing/presets';
import { buildCombinedCheckSummary, formatRatio } from '@/lib/combined-footing/format';
import type { CombinedFootingInput, CombinedColumn } from '@/lib/combined-footing/types';
import type { ColumnShape } from '@/lib/footing/types';

type Code = 'ACI 318-25' | 'ACI 318-19';
type Tab = 'inputs' | 'beam' | 'checks' | 'refs';

type Action =
  | { type: 'LOAD_PRESET'; input: CombinedFootingInput }
  | { type: 'SET_CODE'; code: Code }
  | { type: 'SET_GEOM'; patch: Partial<CombinedFootingInput['geometry']> }
  | { type: 'SET_SOIL'; patch: Partial<CombinedFootingInput['soil']> }
  | { type: 'SET_MAT'; patch: Partial<CombinedFootingInput['materials']> }
  | { type: 'SET_COL'; which: 1 | 2; patch: Partial<CombinedColumn> }
  | { type: 'SET_REINF'; patch: Partial<CombinedFootingInput['reinforcement']> };

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
      </section>

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
          ['beam', 'Beam analysis'],
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
      {tab === 'beam' && <BeamTab result={result} />}
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
