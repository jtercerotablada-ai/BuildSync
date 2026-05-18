'use client';

import React from 'react';
import type { ConcreteMaterial } from '@/lib/retaining-wall/types';
import type { UnitSystem, Quantity } from '@/lib/beam/units';
import { fromSI, toSI, unitLabel } from '@/lib/beam/units';

interface Props {
  concrete: ConcreteMaterial;
  unitSystem: UnitSystem;
  onChange: (c: ConcreteMaterial) => void;
}

export function MaterialsPanel({ concrete, unitSystem, onChange }: Props) {
  const set = <K extends keyof ConcreteMaterial>(key: K, value: ConcreteMaterial[K]) =>
    onChange({ ...concrete, [key]: value });

  const stressU = unitLabel('stress', unitSystem);
  const unitWtU = unitLabel('unitWeight', unitSystem);
  const dimU = unitLabel('dimension', unitSystem);

  return (
    <div className="rw-panel">
      <h3 className="rw-panel__title">Concrete &amp; Reinforcement</h3>
      <p className="rw-panel__hint">
        ACI 318-19 inputs. Default: f&apos;c=28 MPa (4 ksi), fy=420 MPa (Grade 60).
      </p>
      <div className="rw-fields">
        <Field label={`f'c (${stressU})`} siValue={concrete.fc} q="stress" system={unitSystem} onChange={(v) => set('fc', v)} />
        <Field label={`fy (${stressU})`} siValue={concrete.fy} q="stress" system={unitSystem} onChange={(v) => set('fy', v)} />
        <Field label={`Es (${stressU})`} siValue={concrete.Es} q="stress" system={unitSystem} onChange={(v) => set('Es', v)} />
        <Field label={`γ (${unitWtU})`} siValue={concrete.gamma} q="unitWeight" system={unitSystem} onChange={(v) => set('gamma', v)} />
        <Field label={`Cover (${dimU})`} siValue={concrete.cover} q="dimension" system={unitSystem} onChange={(v) => set('cover', v)} />
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
