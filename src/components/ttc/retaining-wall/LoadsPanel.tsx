'use client';

import React from 'react';
import type {
  WallLoads,
  EarthPressureTheory,
  WallInput,
} from '@/lib/retaining-wall/types';

type SF = WallInput['safetyFactors'];

interface Props {
  loads: WallLoads;
  theory: EarthPressureTheory;
  safetyFactors: SF;
  onChangeLoads: (l: WallLoads) => void;
  onChangeTheory: (t: EarthPressureTheory) => void;
  onChangeSafety: (sf: SF) => void;
}

export function LoadsPanel({
  loads,
  theory,
  safetyFactors,
  onChangeLoads,
  onChangeTheory,
  onChangeSafety,
}: Props) {
  return (
    <div className="rw-panel">
      <h3 className="rw-panel__title">Loads &amp; Analysis</h3>

      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Surcharge</div>
        <div className="rw-fields">
          <Field
            label="q (kPa)"
            value={loads.surchargeQ}
            onChange={(v) => onChangeLoads({ ...loads, surchargeQ: v })}
          />
        </div>
      </div>

      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Seismic (Mononobe-Okabe)</div>
        <div className="rw-fields">
          <Field
            label="kh"
            value={loads.seismic.kh}
            onChange={(v) =>
              onChangeLoads({ ...loads, seismic: { ...loads.seismic, kh: v } })
            }
          />
          <Field
            label="kv"
            value={loads.seismic.kv}
            onChange={(v) =>
              onChangeLoads({ ...loads, seismic: { ...loads.seismic, kv: v } })
            }
          />
        </div>
        <p className="rw-panel__hint">Typical kh = 0.1 – 0.2 for moderate seismicity. 0 = static only.</p>
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
          <Field
            label="FS Overturning"
            value={safetyFactors.overturning}
            onChange={(v) => onChangeSafety({ ...safetyFactors, overturning: v })}
          />
          <Field
            label="FS Sliding"
            value={safetyFactors.sliding}
            onChange={(v) => onChangeSafety({ ...safetyFactors, sliding: v })}
          />
          <Field
            label="FS Bearing"
            value={safetyFactors.bearing}
            onChange={(v) => onChangeSafety({ ...safetyFactors, bearing: v })}
          />
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
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
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
