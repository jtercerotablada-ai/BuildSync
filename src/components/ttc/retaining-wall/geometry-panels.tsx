'use client';

// Per-kind geometry panels. Each panel renders the shared base fields
// (H_stem, t_top, t_bot, B_toe, B_heel, H_foot, β, frontFill, key) plus
// the kind-specific extension fields. Together with WallTypeChooser they
// replace the previous single-kind GeometryPanel.

import React from 'react';
import type {
  WallGeometry,
  CantileverGeometry,
  GravityGeometry,
  SemiGravityGeometry,
  LShapedGeometry,
  CounterfortGeometry,
  ButtressedGeometry,
  BasementGeometry,
  AbutmentGeometry,
} from '@/lib/retaining-wall/types';
import type { UnitSystem, Quantity } from '@/lib/beam/units';
import { fromSI, toSI, unitLabel } from '@/lib/beam/units';

// ─── Shared field primitives ───────────────────────────────────────────────

export function Field({
  label, siValue, q, system, onChange,
}: {
  label: string;
  siValue: number;
  q: Quantity;
  system: UnitSystem;
  onChange: (siNew: number) => void;
}) {
  const disp = fromSI(siValue, q, system);
  return (
    <label className="rw-field">
      <span className="rw-field__label">{label}</span>
      <input
        type="number"
        className="rw-field__input"
        value={Math.round(disp * 10000) / 10000}
        step="any"
        onChange={(e) => onChange(toSI(parseFloat(e.target.value) || 0, q, system))}
      />
    </label>
  );
}

export function RawField({
  label, value, onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="rw-field">
      <span className="rw-field__label">{label}</span>
      <input
        type="number"
        className="rw-field__input"
        value={value}
        step="any"
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </label>
  );
}

// ─── Shared base fields rendered by EVERY per-kind panel ───────────────────

interface BaseFieldsProps<G extends WallGeometry> {
  geometry: G;
  unitSystem: UnitSystem;
  onChange: (g: G) => void;
  /** Override the default stem heading (e.g. counterforts call it "Stem slab"). */
  stemTitle?: string;
  /** Hide B_toe input (for l-shaped which forces B_toe = 0). */
  hideToe?: boolean;
}

function BaseFields<G extends WallGeometry>({
  geometry, unitSystem, onChange, stemTitle, hideToe,
}: BaseFieldsProps<G>) {
  const dim = unitLabel('dimension', unitSystem);
  const deg = (geometry.backfillSlope * 180) / Math.PI;
  const set = <K extends keyof G>(key: K, value: G[K]) => onChange({ ...geometry, [key]: value });

  return (
    <>
      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">{stemTitle ?? 'Stem'}</div>
        <div className="rw-fields">
          <Field label={`H_stem (${dim})`} siValue={geometry.H_stem} q="dimension" system={unitSystem}
            onChange={(v) => set('H_stem' as keyof G, v as G[keyof G])} />
          <Field label={`t_top (${dim})`} siValue={geometry.t_stem_top} q="dimension" system={unitSystem}
            onChange={(v) => set('t_stem_top' as keyof G, v as G[keyof G])} />
          <Field label={`t_bot (${dim})`} siValue={geometry.t_stem_bot} q="dimension" system={unitSystem}
            onChange={(v) => set('t_stem_bot' as keyof G, v as G[keyof G])} />
          <RawField label="β slope (°)" value={Math.round(deg * 100) / 100}
            onChange={(v) => set('backfillSlope' as keyof G, ((v * Math.PI) / 180) as G[keyof G])} />
        </div>
      </div>

      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Footing</div>
        <div className="rw-fields">
          {!hideToe && (
            <Field label={`B_toe (${dim})`} siValue={geometry.B_toe} q="dimension" system={unitSystem}
              onChange={(v) => set('B_toe' as keyof G, v as G[keyof G])} />
          )}
          <Field label={`B_heel (${dim})`} siValue={geometry.B_heel} q="dimension" system={unitSystem}
            onChange={(v) => set('B_heel' as keyof G, v as G[keyof G])} />
          <Field label={`H_foot (${dim})`} siValue={geometry.H_foot} q="dimension" system={unitSystem}
            onChange={(v) => set('H_foot' as keyof G, v as G[keyof G])} />
          <Field label={`Front fill (${dim})`} siValue={geometry.frontFill} q="dimension" system={unitSystem}
            onChange={(v) => set('frontFill' as keyof G, v as G[keyof G])} />
        </div>
      </div>

      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Shear key (optional)</div>
        <label className="rw-check">
          <input type="checkbox" checked={!!geometry.key}
            onChange={(e) => set('key' as keyof G,
              (e.target.checked ? { width: 300, depth: 400, offsetFromHeel: 200 } : undefined) as G[keyof G])} />
          <span>Include shear key</span>
        </label>
        {geometry.key && (
          <div className="rw-fields">
            <Field label={`Width (${dim})`} siValue={geometry.key.width} q="dimension" system={unitSystem}
              onChange={(v) => set('key' as keyof G, { ...geometry.key!, width: v } as G[keyof G])} />
            <Field label={`Depth (${dim})`} siValue={geometry.key.depth} q="dimension" system={unitSystem}
              onChange={(v) => set('key' as keyof G, { ...geometry.key!, depth: v } as G[keyof G])} />
            <Field label={`From heel (${dim})`} siValue={geometry.key.offsetFromHeel} q="dimension" system={unitSystem}
              onChange={(v) => set('key' as keyof G, { ...geometry.key!, offsetFromHeel: v } as G[keyof G])} />
          </div>
        )}
      </div>
    </>
  );
}

// ─── Cantilever ────────────────────────────────────────────────────────────

export function CantileverGeometryPanel(p: { geometry: CantileverGeometry; unitSystem: UnitSystem; onChange: (g: CantileverGeometry) => void }) {
  return (
    <div className="rw-panel">
      <h3 className="rw-panel__title">Cantilever wall geometry</h3>
      <p className="rw-panel__hint">Single tapered stem on toe + heel. Most common reinforced-concrete retaining wall (ACI 318-25 §13.3 / §22.2).</p>
      <BaseFields {...p} />
    </div>
  );
}

// ─── Gravity ───────────────────────────────────────────────────────────────

export function GravityGeometryPanel({
  geometry, unitSystem, onChange,
}: { geometry: GravityGeometry; unitSystem: UnitSystem; onChange: (g: GravityGeometry) => void }) {
  const set = <K extends keyof GravityGeometry>(key: K, value: GravityGeometry[K]) => onChange({ ...geometry, [key]: value });
  return (
    <div className="rw-panel">
      <h3 className="rw-panel__title">Gravity (mass-concrete) wall</h3>
      <p className="rw-panel__hint">Mass concrete; stability comes from the wall&rsquo;s own weight. No tensile reinforcement is relied upon (ACI 318-25 §14 plain concrete, with §14.5 stress limits).</p>
      <BaseFields geometry={geometry} unitSystem={unitSystem} onChange={onChange} stemTitle="Wall body" />
      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Additional batter</div>
        <p className="rw-panel__sub-hint">In addition to the t_top → t_bot taper. Set 0 for vertical faces.</p>
        <div className="rw-fields">
          <RawField label="Front batter (°)" value={Math.round(geometry.batterFront * 18000 / Math.PI) / 100}
            onChange={(v) => set('batterFront', (v * Math.PI) / 180)} />
          <RawField label="Back batter (°)" value={Math.round(geometry.batterBack * 18000 / Math.PI) / 100}
            onChange={(v) => set('batterBack', (v * Math.PI) / 180)} />
        </div>
      </div>
    </div>
  );
}

// ─── Semi-gravity ─────────────────────────────────────────────────────────

export function SemiGravityGeometryPanel(p: { geometry: SemiGravityGeometry; unitSystem: UnitSystem; onChange: (g: SemiGravityGeometry) => void }) {
  return (
    <div className="rw-panel">
      <h3 className="rw-panel__title">Semi-gravity wall</h3>
      <p className="rw-panel__hint">Cantilever envelope with light vertical reinforcement only (temperature/shrinkage + minor flexure). Useful for short walls where full cantilever steel is overkill.</p>
      <BaseFields {...p} />
    </div>
  );
}

// ─── L-shaped ──────────────────────────────────────────────────────────────

export function LShapedGeometryPanel({
  geometry, unitSystem, onChange,
}: { geometry: LShapedGeometry; unitSystem: UnitSystem; onChange: (g: LShapedGeometry) => void }) {
  const set = <K extends keyof LShapedGeometry>(key: K, value: LShapedGeometry[K]) => onChange({ ...geometry, [key]: value });
  return (
    <div className="rw-panel">
      <h3 className="rw-panel__title">L-shaped wall (no toe)</h3>
      <p className="rw-panel__hint">Heel only — no toe slab. Used in dense urban / shallow-footing conditions where the toe cannot extend forward of the property line.</p>
      <BaseFields geometry={geometry} unitSystem={unitSystem} onChange={onChange} hideToe />
      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Stem lean</div>
        <div className="rw-fields">
          <RawField label="Forward lean (°)" value={Math.round(geometry.stemLean * 18000 / Math.PI) / 100}
            onChange={(v) => set('stemLean', (v * Math.PI) / 180)} />
        </div>
      </div>
    </div>
  );
}

// ─── Counterfort ──────────────────────────────────────────────────────────

export function CounterfortGeometryPanel({
  geometry, unitSystem, onChange,
}: { geometry: CounterfortGeometry; unitSystem: UnitSystem; onChange: (g: CounterfortGeometry) => void }) {
  const set = <K extends keyof CounterfortGeometry>(key: K, value: CounterfortGeometry[K]) => onChange({ ...geometry, [key]: value });
  const dim = unitLabel('dimension', unitSystem);
  return (
    <div className="rw-panel">
      <h3 className="rw-panel__title">Counterfort wall</h3>
      <p className="rw-panel__hint">Rear buttresses (counterforts) tie the stem to the heel slab. Stem becomes a slab spanning HORIZONTALLY between counterforts; heel becomes a slab spanning longitudinally. Counterfort acts as a T-beam in tension (ACI 318-25 §13.3 / §9.7).</p>
      <BaseFields geometry={geometry} unitSystem={unitSystem} onChange={onChange} stemTitle="Stem slab" />
      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Counterforts</div>
        <div className="rw-fields">
          <Field label={`Spacing S (${dim})`} siValue={geometry.counterfortSpacing} q="dimension" system={unitSystem}
            onChange={(v) => set('counterfortSpacing', v)} />
          <Field label={`Thickness bw (${dim})`} siValue={geometry.counterfortThickness} q="dimension" system={unitSystem}
            onChange={(v) => set('counterfortThickness', v)} />
        </div>
      </div>
    </div>
  );
}

// ─── Buttressed ───────────────────────────────────────────────────────────

export function ButtressedGeometryPanel({
  geometry, unitSystem, onChange,
}: { geometry: ButtressedGeometry; unitSystem: UnitSystem; onChange: (g: ButtressedGeometry) => void }) {
  const set = <K extends keyof ButtressedGeometry>(key: K, value: ButtressedGeometry[K]) => onChange({ ...geometry, [key]: value });
  const dim = unitLabel('dimension', unitSystem);
  return (
    <div className="rw-panel">
      <h3 className="rw-panel__title">Buttressed wall</h3>
      <p className="rw-panel__hint">Front buttresses act in compression (mirror of counterfort). Common in bridge abutments where rear space is constrained.</p>
      <BaseFields geometry={geometry} unitSystem={unitSystem} onChange={onChange} stemTitle="Stem slab" />
      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Buttresses (front)</div>
        <div className="rw-fields">
          <Field label={`Spacing S (${dim})`} siValue={geometry.buttressSpacing} q="dimension" system={unitSystem}
            onChange={(v) => set('buttressSpacing', v)} />
          <Field label={`Thickness bw (${dim})`} siValue={geometry.buttressThickness} q="dimension" system={unitSystem}
            onChange={(v) => set('buttressThickness', v)} />
        </div>
      </div>
    </div>
  );
}

// ─── Basement / restrained-top ────────────────────────────────────────────

export function BasementGeometryPanel({
  geometry, unitSystem, onChange,
}: { geometry: BasementGeometry; unitSystem: UnitSystem; onChange: (g: BasementGeometry) => void }) {
  const set = <K extends keyof BasementGeometry>(key: K, value: BasementGeometry[K]) => onChange({ ...geometry, [key]: value });
  const dim = unitLabel('dimension', unitSystem);
  return (
    <div className="rw-panel">
      <h3 className="rw-panel__title">Basement / restrained-top wall</h3>
      <p className="rw-panel__hint">Top is propped by a floor slab or diaphragm. The stem now spans from the footing (fixed) to the top tie (pinned or fixed) instead of cantilevering. Both faces typically need rebar.</p>
      <BaseFields geometry={geometry} unitSystem={unitSystem} onChange={onChange} />
      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Top support</div>
        <div className="rw-fields">
          <Field label={`Top elev. above footing top (${dim})`} siValue={geometry.topElevation} q="dimension" system={unitSystem}
            onChange={(v) => set('topElevation', v)} />
          <label className="rw-field">
            <span className="rw-field__label">Top fixity</span>
            <select className="rw-field__input" value={geometry.topFixity}
              onChange={(e) => set('topFixity', e.target.value as 'pinned' | 'fixed')}>
              <option value="pinned">Pinned (typical floor slab)</option>
              <option value="fixed">Fixed (rigid diaphragm)</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

// ─── Bridge abutment ──────────────────────────────────────────────────────

export function AbutmentGeometryPanel({
  geometry, unitSystem, onChange,
}: { geometry: AbutmentGeometry; unitSystem: UnitSystem; onChange: (g: AbutmentGeometry) => void }) {
  const set = <K extends keyof AbutmentGeometry>(key: K, value: AbutmentGeometry[K]) => onChange({ ...geometry, [key]: value });
  const dim = unitLabel('dimension', unitSystem);
  return (
    <div className="rw-panel">
      <h3 className="rw-panel__title">Bridge abutment</h3>
      <p className="rw-panel__hint">Stem + bridge seat + backwall (retains roadway fill above the seat) + optional wing walls. AASHTO LRFD §11.6 governs load combinations.</p>
      <BaseFields geometry={geometry} unitSystem={unitSystem} onChange={onChange} />
      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Bridge seat</div>
        <div className="rw-fields">
          <Field label={`Seat width (${dim})`} siValue={geometry.bridgeSeat.width} q="dimension" system={unitSystem}
            onChange={(v) => set('bridgeSeat', { ...geometry.bridgeSeat, width: v })} />
          <RawField label="Dead load (kN/m)" value={geometry.bridgeSeat.deadLoad}
            onChange={(v) => set('bridgeSeat', { ...geometry.bridgeSeat, deadLoad: v })} />
          <RawField label="Live load (kN/m)" value={geometry.bridgeSeat.liveLoad}
            onChange={(v) => set('bridgeSeat', { ...geometry.bridgeSeat, liveLoad: v })} />
        </div>
      </div>
      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Backwall</div>
        <div className="rw-fields">
          <Field label={`H (${dim})`} siValue={geometry.backwall.H} q="dimension" system={unitSystem}
            onChange={(v) => set('backwall', { ...geometry.backwall, H: v })} />
          <Field label={`t (${dim})`} siValue={geometry.backwall.t} q="dimension" system={unitSystem}
            onChange={(v) => set('backwall', { ...geometry.backwall, t: v })} />
        </div>
      </div>
      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Wing wall (optional)</div>
        <label className="rw-check">
          <input type="checkbox" checked={!!geometry.wingWall}
            onChange={(e) => set('wingWall',
              e.target.checked ? { length: 2000, H: 2000, t: 250 } : undefined)} />
          <span>Include wing wall</span>
        </label>
        {geometry.wingWall && (
          <div className="rw-fields">
            <Field label={`Length (${dim})`} siValue={geometry.wingWall.length} q="dimension" system={unitSystem}
              onChange={(v) => set('wingWall', { ...geometry.wingWall!, length: v })} />
            <Field label={`H (${dim})`} siValue={geometry.wingWall.H} q="dimension" system={unitSystem}
              onChange={(v) => set('wingWall', { ...geometry.wingWall!, H: v })} />
            <Field label={`t (${dim})`} siValue={geometry.wingWall.t} q="dimension" system={unitSystem}
              onChange={(v) => set('wingWall', { ...geometry.wingWall!, t: v })} />
          </div>
        )}
      </div>
    </div>
  );
}
