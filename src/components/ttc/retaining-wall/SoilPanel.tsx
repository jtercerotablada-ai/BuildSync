'use client';

import React from 'react';
import type { SoilLayer, BaseSoil, WaterTable, DrainageSystem } from '@/lib/retaining-wall/types';
import type { UnitSystem, Quantity } from '@/lib/beam/units';
import { fromSI, toSI, unitLabel } from '@/lib/beam/units';

interface Props {
  backfill: SoilLayer[];
  baseSoil: BaseSoil;
  water: WaterTable;
  drainage?: DrainageSystem;
  unitSystem: UnitSystem;
  onChangeBackfill: (b: SoilLayer[]) => void;
  onChangeBase: (b: BaseSoil) => void;
  onChangeWater: (w: WaterTable) => void;
  onChangeDrainage?: (d: DrainageSystem) => void;
}

const DEG = 180 / Math.PI;

export function SoilPanel({
  backfill,
  baseSoil,
  water,
  unitSystem,
  onChangeBackfill,
  onChangeBase,
  onChangeWater,
}: Props) {
  const updateLayer = (i: number, patch: Partial<SoilLayer>) => {
    onChangeBackfill(backfill.map((L, idx) => (idx === i ? { ...L, ...patch } : L)));
  };
  const addLayer = () => {
    onChangeBackfill([
      ...backfill,
      { name: `Layer ${backfill.length + 1}`, gamma: 18, phi: (30 * Math.PI) / 180, c: 0, thickness: 1000 },
    ]);
  };
  const removeLayer = (i: number) => {
    onChangeBackfill(backfill.filter((_, idx) => idx !== i));
  };
  const setBase = <K extends keyof BaseSoil>(key: K, value: BaseSoil[K]) =>
    onChangeBase({ ...baseSoil, [key]: value });

  const unitWtU = unitLabel('unitWeight', unitSystem);
  const pressU = unitLabel('pressure', unitSystem);
  const dimU = unitLabel('dimension', unitSystem);

  return (
    <div className="rw-panel">
      <h3 className="rw-panel__title">Soil Parameters</h3>

      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Backfill Layers (top → bottom)</div>
        <p className="rw-panel__hint">
          γ {unitWtU} · φ in degrees · c {pressU} · thickness {dimU} (0 = to bottom)
        </p>
        {backfill.map((L, i) => (
          <div key={i} className="rw-layer">
            <div className="rw-layer__head">
              <input
                className="rw-layer__name"
                value={L.name}
                onChange={(e) => updateLayer(i, { name: e.target.value })}
              />
              {backfill.length > 1 && (
                <button
                  className="rw-icon-btn rw-icon-btn--danger"
                  onClick={() => removeLayer(i)}
                  aria-label="Remove layer"
                >
                  ×
                </button>
              )}
            </div>
            <div className="rw-fields">
              <Field label={`γ (${unitWtU})`} siValue={L.gamma} q="unitWeight" system={unitSystem} onChange={(v) => updateLayer(i, { gamma: v })} />
              <RawField
                label="φ (°)"
                value={Math.round(L.phi * DEG * 100) / 100}
                onChange={(v) => updateLayer(i, { phi: (v * Math.PI) / 180 })}
              />
              <Field label={`c (${pressU})`} siValue={L.c} q="pressure" system={unitSystem} onChange={(v) => updateLayer(i, { c: v })} />
              <Field label={`Thick (${dimU})`} siValue={L.thickness} q="dimension" system={unitSystem} onChange={(v) => updateLayer(i, { thickness: v })} />
            </div>
          </div>
        ))}
        <button className="btn btn--ghost btn--xs" onClick={addLayer}>
          + Add layer
        </button>
      </div>

      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Base Soil (bearing + passive)</div>
        <div className="rw-fields">
          <Field label={`γ (${unitWtU})`} siValue={baseSoil.gamma} q="unitWeight" system={unitSystem} onChange={(v) => setBase('gamma', v)} />
          <RawField
            label="φ (°)"
            value={Math.round(baseSoil.phi * DEG * 100) / 100}
            onChange={(v) => setBase('phi', (v * Math.PI) / 180)}
          />
          <Field label={`c (${pressU})`} siValue={baseSoil.c} q="pressure" system={unitSystem} onChange={(v) => setBase('c', v)} />
          <RawField
            label="δ (°)"
            value={Math.round(baseSoil.delta * DEG * 100) / 100}
            onChange={(v) => setBase('delta', (v * Math.PI) / 180)}
          />
          <Field label={`ca (${pressU})`} siValue={baseSoil.ca} q="pressure" system={unitSystem} onChange={(v) => setBase('ca', v)} />
          <Field label={`Allowable q (${pressU})`} siValue={baseSoil.qAllow} q="pressure" system={unitSystem} onChange={(v) => setBase('qAllow', v)} />
        </div>
        <label className="rw-check">
          <input
            type="checkbox"
            checked={baseSoil.passiveEnabled}
            onChange={(e) => setBase('passiveEnabled', e.target.checked)}
          />
          <span>Include passive resistance at toe</span>
        </label>
      </div>

      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Water Table</div>
        <label className="rw-check">
          <input
            type="checkbox"
            checked={water.enabled}
            onChange={(e) => onChangeWater({ ...water, enabled: e.target.checked })}
          />
          <span>Water table present behind wall</span>
        </label>
        {water.enabled && (
          <div className="rw-fields">
            <Field label={`Depth (${dimU})`} siValue={water.depthFromStemTop} q="dimension" system={unitSystem} onChange={(v) => onChangeWater({ ...water, depthFromStemTop: v })} />
            <Field label={`γw (${unitWtU})`} siValue={water.gammaW} q="unitWeight" system={unitSystem} onChange={(v) => onChangeWater({ ...water, gammaW: v })} />
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  siValue,
  q,
  system,
  onChange,
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
  label,
  value,
  onChange,
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
