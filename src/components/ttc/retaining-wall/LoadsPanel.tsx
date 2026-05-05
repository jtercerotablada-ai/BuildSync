'use client';

import React from 'react';
import type {
  WallLoads,
  EarthPressureTheory,
  WallInput,
  WallCode,
} from '@/lib/retaining-wall/types';
import type { UnitSystem, Quantity } from '@/lib/beam/units';
import { fromSI, toSI, unitLabel } from '@/lib/beam/units';

type SF = WallInput['safetyFactors'];

interface Props {
  loads: WallLoads;
  theory: EarthPressureTheory;
  safetyFactors: SF;
  unitSystem: UnitSystem;
  code: WallCode;
  onChangeLoads: (l: WallLoads) => void;
  onChangeTheory: (t: EarthPressureTheory) => void;
  onChangeSafety: (sf: SF) => void;
  onChangeCode: (c: WallCode) => void;
}

export function LoadsPanel({
  loads,
  theory,
  safetyFactors,
  unitSystem,
  code,
  onChangeLoads,
  onChangeTheory,
  onChangeSafety,
  onChangeCode,
}: Props) {
  const pressU = unitLabel('pressure', unitSystem);

  return (
    <div className="rw-panel">
      <h3 className="rw-panel__title">Loads &amp; Analysis</h3>

      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Design code</div>
        <label className="rw-field">
          <span className="rw-field__label">Code</span>
          <select
            className="rw-field__input"
            value={code}
            onChange={(e) => onChangeCode(e.target.value as WallCode)}
          >
            <option value="ACI 318-25">ACI 318-25 (SI Units, latest)</option>
            <option value="ACI 318-19">ACI 318-19</option>
            <option value="AASHTO LRFD">AASHTO LRFD (bridge abutments)</option>
          </select>
        </label>
        <p className="rw-panel__hint">
          ACI 318-25 is the default. Bridge abutments auto-switch to AASHTO LRFD §11.6.
        </p>
      </div>

      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Surcharge</div>
        <div className="rw-fields">
          <Field
            label={`q (${pressU})`}
            siValue={loads.surchargeQ}
            q="pressure"
            system={unitSystem}
            onChange={(v) => onChangeLoads({ ...loads, surchargeQ: v })}
          />
        </div>
      </div>

      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Seismic (Mononobe-Okabe)</div>
        <div className="rw-fields">
          <RawField
            label="kh"
            value={loads.seismic.kh}
            onChange={(v) => onChangeLoads({ ...loads, seismic: { ...loads.seismic, kh: v } })}
          />
          <RawField
            label="kv"
            value={loads.seismic.kv}
            onChange={(v) => onChangeLoads({ ...loads, seismic: { ...loads.seismic, kv: v } })}
          />
        </div>
        <p className="rw-panel__hint">Typical kh = 0.1–0.2 for moderate seismicity. 0 = static only.</p>
      </div>

      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Earth Pressure Theory</div>
        <div className="seg" role="group">
          <button
            type="button"
            className={theory === 'rankine' ? 'is-active' : ''}
            onClick={() => onChangeTheory('rankine')}
          >
            Rankine
          </button>
          <button
            type="button"
            className={theory === 'coulomb' ? 'is-active' : ''}
            onClick={() => onChangeTheory('coulomb')}
          >
            Coulomb
          </button>
        </div>
        <p className="rw-panel__hint">
          Rankine: vertical wall back, no wall friction. Coulomb: accounts for δ and α.
        </p>
      </div>

      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Safety Factors</div>
        <div className="rw-fields">
          <RawField label="FS Overturning" value={safetyFactors.overturning} onChange={(v) => onChangeSafety({ ...safetyFactors, overturning: v })} />
          <RawField label="FS Sliding" value={safetyFactors.sliding} onChange={(v) => onChangeSafety({ ...safetyFactors, sliding: v })} />
          <RawField label="FS Bearing" value={safetyFactors.bearing} onChange={(v) => onChangeSafety({ ...safetyFactors, bearing: v })} />
        </div>
        <div className="seg" role="group" aria-label="Eccentricity limit">
          <button
            type="button"
            className={safetyFactors.eccentricity === 'kern' ? 'is-active' : ''}
            onClick={() => onChangeSafety({ ...safetyFactors, eccentricity: 'kern' })}
          >
            e ≤ B/6 (kern)
          </button>
          <button
            type="button"
            className={safetyFactors.eccentricity === 'B/3' ? 'is-active' : ''}
            onClick={() => onChangeSafety({ ...safetyFactors, eccentricity: 'B/3' })}
          >
            e ≤ B/3
          </button>
        </div>
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
