'use client';

import React from 'react';
import type { WallKind } from '@/lib/retaining-wall/types';

interface Props {
  kind: WallKind;
  onChange: (k: WallKind) => void;
}

interface KindOption {
  k: WallKind;
  label: string;
  glyph: string;     // little ASCII / unicode hint
  short: string;     // one-line description for tooltip
}

const KIND_OPTIONS: KindOption[] = [
  { k: 'cantilever',  label: 'Cantilever',  glyph: '⌐',  short: 'Single tapered stem on toe + heel.' },
  { k: 'gravity',     label: 'Gravity',     glyph: '▰',  short: 'Mass concrete; stability only.' },
  { k: 'semi-gravity',label: 'Semi-gravity',glyph: '▰',  short: 'Cantilever with light steel only.' },
  { k: 'l-shaped',    label: 'L-shaped',    glyph: 'L',  short: 'No toe; heel only.' },
  { k: 'counterfort', label: 'Counterfort', glyph: '╠',  short: 'Rear buttresses; stem spans horizontally.' },
  { k: 'buttressed',  label: 'Buttressed',  glyph: '╣',  short: 'Front buttresses (compression).' },
  { k: 'basement',    label: 'Basement',    glyph: '╓',  short: 'Propped at top by floor slab.' },
  { k: 'abutment',    label: 'Bridge abut.',glyph: '⊥',  short: 'Bridge seat + backwall + wing wall.' },
];

export function WallTypeChooser({ kind, onChange }: Props) {
  return (
    <section className="rw-type-chooser" aria-label="Wall type">
      <div className="rw-type-chooser__header">
        <span className="rw-type-chooser__title">Wall type</span>
        <span className="rw-type-chooser__hint">Pick the geometry; the design checks adapt automatically.</span>
      </div>

      {/* Desktop / tablet — segmented buttons */}
      <div className="rw-type-chooser__row" role="radiogroup">
        {KIND_OPTIONS.map((opt) => (
          <button
            key={opt.k}
            type="button"
            role="radio"
            aria-checked={kind === opt.k}
            title={opt.short}
            className={`rw-type-chooser__btn ${kind === opt.k ? 'is-active' : ''}`}
            onClick={() => onChange(opt.k)}
          >
            <span className="rw-type-chooser__glyph" aria-hidden>{opt.glyph}</span>
            <span className="rw-type-chooser__label">{opt.label}</span>
          </button>
        ))}
      </div>

      {/* Mobile — collapses to <select> */}
      <label className="rw-type-chooser__mobile">
        <span className="rw-type-chooser__mobile-label">Wall type</span>
        <select
          className="rw-type-chooser__select"
          value={kind}
          onChange={(e) => onChange(e.target.value as WallKind)}
        >
          {KIND_OPTIONS.map((opt) => (
            <option key={opt.k} value={opt.k}>{opt.label}</option>
          ))}
        </select>
      </label>
    </section>
  );
}
