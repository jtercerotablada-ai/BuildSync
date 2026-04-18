'use client';

import React from 'react';
import type { Point2D } from '@/lib/section/types';
import { fromSI, toSI, unitLabel, type UnitSystem } from '@/lib/beam/units';

interface Props {
  vertices: Point2D[];
  onChange: (v: Point2D[]) => void;
  unitSystem: UnitSystem;
  activeIndex: number | null;
  setActiveIndex: (i: number | null) => void;
}

export function PolygonEditorPanel({
  vertices,
  onChange,
  unitSystem,
  activeIndex,
  setActiveIndex,
}: Props) {
  const dimLabel = unitLabel('dimension', unitSystem);

  const updateVertex = (i: number, patch: Partial<Point2D>) => {
    const next = vertices.map((v, idx) => (idx === i ? { ...v, ...patch } : v));
    onChange(next);
  };

  const removeVertex = (i: number) => {
    if (vertices.length <= 3) return;
    onChange(vertices.filter((_, idx) => idx !== i));
    setActiveIndex(null);
  };

  const addVertex = () => {
    const last = vertices[vertices.length - 1] ?? { x: 0, y: 0 };
    const first = vertices[0] ?? { x: 100, y: 0 };
    const mid = { x: (last.x + first.x) / 2, y: (last.y + first.y) / 2 };
    onChange([...vertices, mid]);
  };

  const preset = (name: 'rect' | 'L' | 'triangle' | 'hex') => {
    if (name === 'rect')
      onChange([
        { x: 0, y: 0 },
        { x: 150, y: 0 },
        { x: 150, y: 200 },
        { x: 0, y: 200 },
      ]);
    else if (name === 'L')
      onChange([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 20 },
        { x: 20, y: 20 },
        { x: 20, y: 100 },
        { x: 0, y: 100 },
      ]);
    else if (name === 'triangle')
      onChange([
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 100, y: 173.2 },
      ]);
    else if (name === 'hex') {
      const r = 100;
      onChange(
        Array.from({ length: 6 }, (_, i) => ({
          x: r + r * Math.cos((i * Math.PI) / 3),
          y: r + r * Math.sin((i * Math.PI) / 3),
        }))
      );
    }
  };

  return (
    <div className="sb-panel">
      <h3 className="sb-panel__title">Polygon Editor</h3>
      <p className="sb-panel__hint">
        Define vertices in order (CCW or CW). Properties are computed via Green's theorem.
      </p>

      <div className="sb-panel__section">
        <div className="sb-panel__subtitle">Quick preset</div>
        <div className="sb-btn-row">
          <button type="button" className="btn btn--ghost btn--xs" onClick={() => preset('rect')}>
            Rectangle
          </button>
          <button type="button" className="btn btn--ghost btn--xs" onClick={() => preset('L')}>
            L-shape
          </button>
          <button type="button" className="btn btn--ghost btn--xs" onClick={() => preset('triangle')}>
            Triangle
          </button>
          <button type="button" className="btn btn--ghost btn--xs" onClick={() => preset('hex')}>
            Hexagon
          </button>
        </div>
      </div>

      <div className="sb-panel__section">
        <div className="sb-panel__subtitle">
          Vertices ({dimLabel}) — {vertices.length} points
        </div>
        <div className="sb-vertex-table">
          <div className="sb-vertex-table__head">
            <span>#</span>
            <span>x</span>
            <span>y</span>
            <span></span>
          </div>
          {vertices.map((v, i) => {
            const dx = fromSI(v.x, 'dimension', unitSystem);
            const dy = fromSI(v.y, 'dimension', unitSystem);
            const active = activeIndex === i;
            return (
              <div
                key={i}
                className={`sb-vertex-table__row ${active ? 'is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <span className="sb-vertex-table__idx">{i + 1}</span>
                <input
                  type="number"
                  className="sb-field__input sb-field__input--compact"
                  value={Math.round(dx * 1000) / 1000}
                  step="any"
                  onChange={(e) =>
                    updateVertex(i, { x: toSI(parseFloat(e.target.value) || 0, 'dimension', unitSystem) })
                  }
                />
                <input
                  type="number"
                  className="sb-field__input sb-field__input--compact"
                  value={Math.round(dy * 1000) / 1000}
                  step="any"
                  onChange={(e) =>
                    updateVertex(i, { y: toSI(parseFloat(e.target.value) || 0, 'dimension', unitSystem) })
                  }
                />
                <button
                  type="button"
                  className="sb-vertex-table__del"
                  onClick={() => removeVertex(i)}
                  disabled={vertices.length <= 3}
                  aria-label="Remove vertex"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        <button type="button" className="btn btn--ghost btn--xs" onClick={addVertex}>
          + Add vertex
        </button>
      </div>
    </div>
  );
}
