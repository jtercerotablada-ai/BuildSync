'use client';

import React from 'react';
import type { StructureData, RoofType, Enclosure } from '@/lib/load-gen/types';
import type { UnitSystem } from '@/lib/beam/units';
import { fromSI, toSI, unitLabel } from '@/lib/beam/units';

interface Props {
  structure: StructureData;
  unitSystem: UnitSystem;
  onChange: (s: StructureData) => void;
}

export function StructureDataPanel({ structure, unitSystem, onChange }: Props) {
  const dimU = unitLabel('dimension', unitSystem);
  const set = <K extends keyof StructureData>(key: K, value: StructureData[K]) =>
    onChange({ ...structure, [key]: value });

  const DimField = ({ label, keyName }: { label: string; keyName: 'H' | 'L' | 'B' }) => (
    <label className="lg-field">
      <span className="lg-field__label">{label} ({dimU})</span>
      <input
        type="number"
        className="lg-field__input"
        value={Math.round(fromSI(structure[keyName], 'dimension', unitSystem) * 100) / 100}
        step="any"
        onChange={(e) =>
          set(keyName, toSI(parseFloat(e.target.value) || 0, 'dimension', unitSystem))
        }
      />
    </label>
  );

  return (
    <div className="lg-panel">
      <h3 className="lg-panel__title">Structure Data</h3>

      <div className="lg-panel__section">
        <div className="lg-panel__subtitle">Building Geometry</div>
        <div className="lg-fields">
          <DimField label="Mean roof height H" keyName="H" />
          <DimField label="Length L (along wind)" keyName="L" />
          <DimField label="Width B (across wind)" keyName="B" />
        </div>
      </div>

      <div className="lg-panel__section">
        <div className="lg-panel__subtitle">Roof</div>
        <div className="lg-fields">
          <label className="lg-field">
            <span className="lg-field__label">Roof type</span>
            <select
              className="lg-field__input"
              value={structure.roofType}
              onChange={(e) => set('roofType', e.target.value as RoofType)}
            >
              <option value="flat">Flat (&lt; 7°)</option>
              <option value="gable">Gable</option>
              <option value="hip">Hip</option>
              <option value="monoslope">Monoslope</option>
            </select>
          </label>
          <label className="lg-field">
            <span className="lg-field__label">Slope θ (°)</span>
            <input
              type="number"
              className="lg-field__input"
              value={structure.roofSlope}
              step="any"
              onChange={(e) => set('roofSlope', parseFloat(e.target.value) || 0)}
            />
          </label>
        </div>
      </div>

      <div className="lg-panel__section">
        <div className="lg-panel__subtitle">Enclosure</div>
        <div className="seg" role="group">
          <button
            type="button"
            className={structure.enclosure === 'enclosed' ? 'is-active' : ''}
            onClick={() => set('enclosure', 'enclosed' as Enclosure)}
          >
            Enclosed
          </button>
          <button
            type="button"
            className={structure.enclosure === 'partially-enclosed' ? 'is-active' : ''}
            onClick={() => set('enclosure', 'partially-enclosed' as Enclosure)}
          >
            Partially
          </button>
          <button
            type="button"
            className={structure.enclosure === 'open' ? 'is-active' : ''}
            onClick={() => set('enclosure', 'open' as Enclosure)}
          >
            Open
          </button>
        </div>
      </div>

      <div className="lg-panel__section">
        <div className="lg-panel__subtitle">Directionality &amp; Topography</div>
        <div className="lg-fields">
          <label className="lg-field">
            <span className="lg-field__label">Kd (§26.6-1)</span>
            <input
              type="number"
              className="lg-field__input"
              value={structure.Kd}
              step="0.01"
              onChange={(e) => set('Kd', parseFloat(e.target.value) || 0.85)}
            />
          </label>
          <label className="lg-field">
            <span className="lg-field__label">Kzt (§26.8-1)</span>
            <input
              type="number"
              className="lg-field__input"
              value={structure.Kzt}
              step="0.05"
              onChange={(e) => set('Kzt', parseFloat(e.target.value) || 1)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
