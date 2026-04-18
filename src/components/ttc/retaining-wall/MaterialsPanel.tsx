'use client';

import React from 'react';
import type { ConcreteMaterial } from '@/lib/retaining-wall/types';

interface Props {
  concrete: ConcreteMaterial;
  onChange: (c: ConcreteMaterial) => void;
}

export function MaterialsPanel({ concrete, onChange }: Props) {
  const set = <K extends keyof ConcreteMaterial>(key: K, value: ConcreteMaterial[K]) =>
    onChange({ ...concrete, [key]: value });

  return (
    <div className="rw-panel">
      <h3 className="rw-panel__title">Concrete &amp; Reinforcement</h3>
      <p className="rw-panel__hint">ACI 318-19 inputs. Default: fc'=28 MPa (4 ksi), fy=420 MPa (Grade 60).</p>
      <div className="rw-fields">
        <Field label="f'c (MPa)" value={concrete.fc} onChange={(v) => set('fc', v)} />
        <Field label="fy (MPa)" value={concrete.fy} onChange={(v) => set('fy', v)} />
        <Field label="Es (MPa)" value={concrete.Es} onChange={(v) => set('Es', v)} step={1000} />
        <Field label="γ (kN/m³)" value={concrete.gamma} onChange={(v) => set('gamma', v)} />
        <Field label="Cover (mm)" value={concrete.cover} onChange={(v) => set('cover', v)} />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <label className="rw-field">
      <span className="rw-field__label">{label}</span>
      <input
        type="number"
        className="rw-field__input"
        value={value}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </label>
  );
}
