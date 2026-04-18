'use client';

import React from 'react';
import type { ShapeKind, TemplateParams } from '@/lib/section/types';
import { fromSI, toSI, unitLabel, type UnitSystem } from '@/lib/beam/units';

interface Props {
  params: TemplateParams;
  onChange: (p: TemplateParams) => void;
  unitSystem: UnitSystem;
}

const SHAPES: Array<{ id: ShapeKind; label: string; icon: string }> = [
  { id: 'rectangular', label: 'Rectangular', icon: '▭' },
  { id: 'hollow-rect', label: 'Hollow Rect', icon: '⬜' },
  { id: 'circular', label: 'Circular', icon: '●' },
  { id: 'hollow-circ', label: 'Hollow Circ', icon: '◯' },
  { id: 'i-shape', label: 'I / W', icon: 'I' },
  { id: 't-shape', label: 'T / WT', icon: 'T' },
  { id: 'angle', label: 'Angle L', icon: 'L' },
  { id: 'channel', label: 'Channel C', icon: '⊏' },
  { id: 'box-girder', label: 'Box Girder', icon: '▣' },
];

export function ShapeTemplatesPanel({ params, onChange, unitSystem }: Props) {
  const selectShape = (kind: ShapeKind) => onChange(defaultsFor(kind));
  const label = unitLabel('dimension', unitSystem);

  return (
    <div className="sb-panel">
      <h3 className="sb-panel__title">Shape Templates</h3>
      <div className="sb-shapes-grid">
        {SHAPES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`sb-shape-card ${params.kind === s.id ? 'is-active' : ''}`}
            onClick={() => selectShape(s.id)}
          >
            <span className="sb-shape-card__icon">{s.icon}</span>
            <span className="sb-shape-card__label">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="sb-panel__section">
        <div className="sb-panel__subtitle">Dimensions ({label})</div>
        <div className="sb-fields">{renderFields(params, onChange, unitSystem)}</div>
      </div>
    </div>
  );
}

function renderFields(
  p: TemplateParams,
  onChange: (p: TemplateParams) => void,
  system: UnitSystem
): React.ReactElement {
  const setField = <K extends keyof TemplateParams>(key: K, siValue: number) => {
    onChange({ ...p, [key]: siValue } as TemplateParams);
  };

  const display = (si: number) => {
    if (!isFinite(si)) return 0;
    const v = fromSI(si, 'dimension', system);
    return Math.round(v * 10000) / 10000;
  };
  const setFromInput = (key: string, imperialOrMetric: number) => {
    const si = toSI(imperialOrMetric, 'dimension', system);
    onChange({ ...p, [key]: si } as TemplateParams);
  };

  switch (p.kind) {
    case 'rectangular':
      return (
        <>
          <LabeledInput label="b (width)" value={display(p.b)} onChange={(v) => setFromInput('b', v)} />
          <LabeledInput label="h (height)" value={display(p.h)} onChange={(v) => setFromInput('h', v)} />
        </>
      );
    case 'hollow-rect':
    case 'box-girder':
      return (
        <>
          <LabeledInput label="B (outer w)" value={display(p.B)} onChange={(v) => setFromInput('B', v)} />
          <LabeledInput label="H (outer h)" value={display(p.H)} onChange={(v) => setFromInput('H', v)} />
          <LabeledInput label="tw (web t)" value={display(p.tw)} onChange={(v) => setFromInput('tw', v)} />
          <LabeledInput label="tf (flange t)" value={display(p.tf)} onChange={(v) => setFromInput('tf', v)} />
        </>
      );
    case 'circular':
      return <LabeledInput label="D (diameter)" value={display(p.D)} onChange={(v) => setFromInput('D', v)} />;
    case 'hollow-circ':
      return (
        <>
          <LabeledInput label="D (outer)" value={display(p.D)} onChange={(v) => setFromInput('D', v)} />
          <LabeledInput label="d (inner)" value={display(p.d)} onChange={(v) => setFromInput('d', v)} />
        </>
      );
    case 'i-shape':
    case 't-shape':
    case 'channel':
      return (
        <>
          <LabeledInput label="H (depth)" value={display(p.H)} onChange={(v) => setFromInput('H', v)} />
          <LabeledInput label="B (flange w)" value={display(p.B)} onChange={(v) => setFromInput('B', v)} />
          <LabeledInput label="tw (web t)" value={display(p.tw)} onChange={(v) => setFromInput('tw', v)} />
          <LabeledInput label="tf (flange t)" value={display(p.tf)} onChange={(v) => setFromInput('tf', v)} />
        </>
      );
    case 'angle':
      return (
        <>
          <LabeledInput label="H (leg 1)" value={display(p.H)} onChange={(v) => setFromInput('H', v)} />
          <LabeledInput label="B (leg 2)" value={display(p.B)} onChange={(v) => setFromInput('B', v)} />
          <LabeledInput label="t (thickness)" value={display(p.t)} onChange={(v) => setFromInput('t', v)} />
        </>
      );
  }
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="sb-field">
      <span className="sb-field__label">{label}</span>
      <input
        type="number"
        className="sb-field__input"
        value={value}
        min={0}
        step="any"
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </label>
  );
}

export function defaultsFor(kind: ShapeKind): TemplateParams {
  switch (kind) {
    case 'rectangular':
      return { kind, b: 100, h: 200 };
    case 'hollow-rect':
      return { kind, B: 200, H: 300, tw: 10, tf: 10 };
    case 'circular':
      return { kind, D: 150 };
    case 'hollow-circ':
      return { kind, D: 150, d: 120 };
    case 'i-shape':
      return { kind, H: 300, B: 150, tw: 10, tf: 15 };
    case 't-shape':
      return { kind, H: 200, B: 150, tw: 10, tf: 15 };
    case 'angle':
      return { kind, H: 100, B: 100, t: 10 };
    case 'channel':
      return { kind, H: 250, B: 100, tw: 8, tf: 12 };
    case 'box-girder':
      return { kind, B: 300, H: 400, tw: 15, tf: 15 };
  }
}
