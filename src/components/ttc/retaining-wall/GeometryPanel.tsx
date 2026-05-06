'use client';

// Cantilever wall geometry panel — single-kind (cantilever-only).

import React from 'react';
import type { WallGeometry } from '@/lib/retaining-wall/types';
import type { UnitSystem, Quantity } from '@/lib/beam/units';
import { fromSI, toSI, unitLabel } from '@/lib/beam/units';

interface Props {
  geometry: WallGeometry;
  unitSystem: UnitSystem;
  onChange: (g: WallGeometry) => void;
}

export function GeometryPanel({ geometry, unitSystem, onChange }: Props) {
  const dim = unitLabel('dimension', unitSystem);
  const deg = (geometry.backfillSlope * 180) / Math.PI;
  const set = <K extends keyof WallGeometry>(key: K, value: WallGeometry[K]) =>
    onChange({ ...geometry, [key]: value });

  return (
    <div className="rw-panel">
      <h3 className="rw-panel__title">Cantilever wall geometry</h3>
      <p className="rw-panel__hint">
        Single tapered stem on toe + heel. Most common reinforced-concrete
        retaining wall (ACI 318-25 §13.3 / §22.2).
      </p>

      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Stem</div>
        <div className="rw-fields">
          <Field label={`Stem height (${dim})`} siValue={geometry.H_stem} q="dimension" system={unitSystem}
            onChange={(v) => set('H_stem', v)} />
          <Field label={`Top thickness (${dim})`} siValue={geometry.t_stem_top} q="dimension" system={unitSystem}
            onChange={(v) => set('t_stem_top', v)} />
          <Field label={`Base thickness (${dim})`} siValue={geometry.t_stem_bot} q="dimension" system={unitSystem}
            onChange={(v) => set('t_stem_bot', v)} />
          <RawField label="Backfill slope (°)" value={Math.round(deg * 100) / 100}
            onChange={(v) => set('backfillSlope', (v * Math.PI) / 180)} />
        </div>
      </div>

      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Footing</div>
        <div className="rw-fields">
          <Field label={`Toe width (${dim})`} siValue={geometry.B_toe} q="dimension" system={unitSystem}
            onChange={(v) => set('B_toe', v)} />
          <Field label={`Heel width (${dim})`} siValue={geometry.B_heel} q="dimension" system={unitSystem}
            onChange={(v) => set('B_heel', v)} />
          <Field label={`Footing thickness (${dim})`} siValue={geometry.H_foot} q="dimension" system={unitSystem}
            onChange={(v) => set('H_foot', v)} />
          <Field label={`Front fill (${dim})`} siValue={geometry.frontFill} q="dimension" system={unitSystem}
            onChange={(v) => set('frontFill', v)} />
        </div>
      </div>

      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Shear key (optional)</div>
        <label className="rw-check">
          <input type="checkbox" checked={!!geometry.key}
            onChange={(e) => set('key',
              e.target.checked
                ? { width: 300, depth: 400, offsetFromHeel: 200 }
                : undefined,
            )} />
          <span>Include shear key</span>
        </label>
        {geometry.key && (
          <div className="rw-fields">
            <Field label={`Width (${dim})`} siValue={geometry.key.width} q="dimension" system={unitSystem}
              onChange={(v) => set('key', { ...geometry.key!, width: v })} />
            <Field label={`Depth (${dim})`} siValue={geometry.key.depth} q="dimension" system={unitSystem}
              onChange={(v) => set('key', { ...geometry.key!, depth: v })} />
            <Field label={`From heel (${dim})`} siValue={geometry.key.offsetFromHeel} q="dimension" system={unitSystem}
              onChange={(v) => set('key', { ...geometry.key!, offsetFromHeel: v })} />
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
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

function RawField({
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
