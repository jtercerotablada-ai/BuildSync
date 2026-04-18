'use client';

import React from 'react';
import type { WallGeometry } from '@/lib/retaining-wall/types';

interface Props {
  geometry: WallGeometry;
  onChange: (g: WallGeometry) => void;
}

export function GeometryPanel({ geometry, onChange }: Props) {
  const set = <K extends keyof WallGeometry>(key: K, value: WallGeometry[K]) => {
    onChange({ ...geometry, [key]: value });
  };

  const deg = (geometry.backfillSlope * 180) / Math.PI;

  return (
    <div className="rw-panel">
      <h3 className="rw-panel__title">Wall Geometry</h3>
      <p className="rw-panel__hint">Cantilever wall — stem + footing (heel + toe). All dimensions in mm.</p>

      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Stem</div>
        <div className="rw-fields">
          <Field label="H_stem (height)" value={geometry.H_stem} onChange={(v) => set('H_stem', v)} />
          <Field label="t_top" value={geometry.t_stem_top} onChange={(v) => set('t_stem_top', v)} />
          <Field label="t_bot" value={geometry.t_stem_bot} onChange={(v) => set('t_stem_bot', v)} />
          <Field
            label="β (slope, °)"
            value={Math.round(deg * 100) / 100}
            onChange={(v) => set('backfillSlope', (v * Math.PI) / 180)}
          />
        </div>
      </div>

      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Footing</div>
        <div className="rw-fields">
          <Field label="B_toe" value={geometry.B_toe} onChange={(v) => set('B_toe', v)} />
          <Field label="B_heel" value={geometry.B_heel} onChange={(v) => set('B_heel', v)} />
          <Field label="H_foot" value={geometry.H_foot} onChange={(v) => set('H_foot', v)} />
          <Field label="Front fill" value={geometry.frontFill} onChange={(v) => set('frontFill', v)} />
        </div>
      </div>

      <div className="rw-panel__section">
        <div className="rw-panel__subtitle">Shear Key (optional)</div>
        <label className="rw-check">
          <input
            type="checkbox"
            checked={!!geometry.key}
            onChange={(e) =>
              set(
                'key',
                e.target.checked
                  ? { width: 300, depth: 400, offsetFromHeel: 200 }
                  : undefined,
              )
            }
          />
          <span>Include shear key</span>
        </label>
        {geometry.key && (
          <div className="rw-fields">
            <Field
              label="Width"
              value={geometry.key.width}
              onChange={(v) =>
                set('key', { ...geometry.key!, width: v })
              }
            />
            <Field
              label="Depth"
              value={geometry.key.depth}
              onChange={(v) => set('key', { ...geometry.key!, depth: v })}
            />
            <Field
              label="From heel"
              value={geometry.key.offsetFromHeel}
              onChange={(v) =>
                set('key', { ...geometry.key!, offsetFromHeel: v })
              }
            />
          </div>
        )}
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
