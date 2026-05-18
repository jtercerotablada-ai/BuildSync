'use client';

import React from 'react';
import type { ConcreteShape, RcParams, RebarLayer } from '@/lib/section/rc-types';
import { REBAR_ASTM, findBar } from '@/lib/section/rc-rebar-presets';
import { fromSI, toSI, unitLabel, type UnitSystem } from '@/lib/beam/units';

interface Props {
  params: RcParams;
  onChange: (p: RcParams) => void;
  unitSystem: UnitSystem;
  activeLayerId: string | null;
  setActiveLayerId: (id: string | null) => void;
}

// Quick dim input (SI-backed).
function DimInput({
  siValue,
  unitSystem,
  onChange,
  step = 1,
}: {
  siValue: number;
  unitSystem: UnitSystem;
  onChange: (siValue: number) => void;
  step?: number;
}) {
  const display = fromSI(siValue, 'dimension', unitSystem);
  return (
    <input
      type="number"
      step={step}
      min={0}
      value={Math.round(display * 10000) / 10000}
      onChange={(e) =>
        onChange(toSI(parseFloat(e.target.value) || 0, 'dimension', unitSystem))
      }
    />
  );
}

function StressInput({
  siValue,
  unitSystem,
  onChange,
  step = 1,
}: {
  siValue: number;
  unitSystem: UnitSystem;
  onChange: (siValue: number) => void;
  step?: number;
}) {
  const display = fromSI(siValue, 'stress', unitSystem);
  return (
    <input
      type="number"
      step={step}
      min={0}
      value={Math.round(display * 10000) / 10000}
      onChange={(e) =>
        onChange(toSI(parseFloat(e.target.value) || 0, 'stress', unitSystem))
      }
    />
  );
}

export function RcEditorPanel({
  params,
  onChange,
  unitSystem,
  activeLayerId,
  setActiveLayerId,
}: Props) {
  const dimLabel = unitLabel('dimension', unitSystem);
  const stressLabel = unitLabel('stress', unitSystem);
  const areaLabel = unitLabel('A', unitSystem);

  const setShape = (kind: ConcreteShape['kind']) => {
    if (kind === params.concrete.kind) return;
    const h = params.concrete.h;
    const next: ConcreteShape =
      kind === 'rectangular'
        ? { kind: 'rectangular', b: 300, h }
        : { kind: 't-beam', bw: 300, bf: 900, hf: 150, h };
    onChange({ ...params, concrete: next });
  };

  const setShapeDim = <K extends string>(key: K, siValue: number) => {
    onChange({
      ...params,
      concrete: { ...params.concrete, [key]: siValue } as ConcreteShape,
    });
  };

  const addLayer = (where: 'top' | 'bot') => {
    const h = params.concrete.h;
    const bar = REBAR_ASTM.find((b) => b.id === '#8')!;
    const count = where === 'top' ? 2 : 3;
    const depth = where === 'top' ? 60 : h - 60;
    const id = `ly-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const layer: RebarLayer = {
      id,
      depth,
      area: count * bar.area,
      count,
      label: `${count} ${bar.id}`,
    };
    onChange({ ...params, layers: [...params.layers, layer] });
    setActiveLayerId(id);
  };

  const updateLayer = (id: string, patch: Partial<RebarLayer>) => {
    onChange({
      ...params,
      layers: params.layers.map((L) => (L.id === id ? { ...L, ...patch } : L)),
    });
  };

  const setLayerBar = (id: string, barId: string) => {
    const bar = findBar(barId);
    if (!bar) return;
    const L = params.layers.find((x) => x.id === id);
    if (!L) return;
    updateLayer(id, {
      area: L.count * bar.area,
      label: `${L.count} ${bar.id}`,
    });
  };

  const setLayerCount = (id: string, count: number) => {
    const L = params.layers.find((x) => x.id === id);
    if (!L) return;
    // Keep per-bar area constant; multiply by new count.
    const areaPerBar = L.count > 0 ? L.area / L.count : 510;
    updateLayer(id, {
      count,
      area: areaPerBar * count,
      label: L.label?.replace(/^\d+/, String(count)) ?? `${count} bars`,
    });
  };

  const removeLayer = (id: string) => {
    onChange({ ...params, layers: params.layers.filter((L) => L.id !== id) });
    if (activeLayerId === id) setActiveLayerId(null);
  };

  const setMaterial = <K extends keyof RcParams['materials']>(
    key: K,
    value: number
  ) => {
    onChange({
      ...params,
      materials: { ...params.materials, [key]: value },
    });
  };

  const applyPreset = (name: 'textbook' | 'slab-strip' | 'col-300sq' | 't-beam') => {
    if (name === 'textbook') {
      onChange({
        concrete: { kind: 'rectangular', b: 300, h: 500 },
        layers: [
          { id: 'bot', depth: 440, area: 4 * 510, count: 4, label: '4 #8' },
        ],
        materials: { fc: 28, fy: 420, Es: 200_000 },
      });
    } else if (name === 'slab-strip') {
      onChange({
        concrete: { kind: 'rectangular', b: 1000, h: 200 },
        layers: [
          { id: 'bot', depth: 170, area: 8 * 129, count: 8, label: '#4 @ 125' },
        ],
        materials: { fc: 25, fy: 420, Es: 200_000 },
      });
    } else if (name === 'col-300sq') {
      onChange({
        concrete: { kind: 'rectangular', b: 300, h: 300 },
        layers: [
          { id: 'top', depth: 50, area: 4 * 510, count: 4, label: '4 #8 top' },
          { id: 'bot', depth: 250, area: 4 * 510, count: 4, label: '4 #8 bot' },
        ],
        materials: { fc: 28, fy: 420, Es: 200_000 },
      });
    } else if (name === 't-beam') {
      onChange({
        concrete: { kind: 't-beam', bw: 300, bf: 900, hf: 150, h: 600 },
        layers: [
          { id: 'bot', depth: 540, area: 6 * 510, count: 6, label: '6 #8' },
        ],
        materials: { fc: 28, fy: 420, Es: 200_000 },
      });
    }
    setActiveLayerId(null);
  };

  const shape = params.concrete;

  return (
    <div className="sb-panel">
      <div className="sb-panel__group">
        <div className="sb-panel__label">RC Presets</div>
        <div className="sb-rc__presets">
          <button className="btn btn--ghost btn--sm" onClick={() => applyPreset('textbook')}>
            Beam 300×500
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => applyPreset('slab-strip')}>
            Slab strip
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => applyPreset('col-300sq')}>
            Column 300²
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => applyPreset('t-beam')}>
            T-beam
          </button>
        </div>
      </div>

      <div className="sb-panel__group">
        <div className="sb-panel__label">Concrete shape</div>
        <div className="seg" role="group" aria-label="Concrete shape">
          <button
            type="button"
            className={shape.kind === 'rectangular' ? 'is-active' : ''}
            onClick={() => setShape('rectangular')}
          >
            Rect
          </button>
          <button
            type="button"
            className={shape.kind === 't-beam' ? 'is-active' : ''}
            onClick={() => setShape('t-beam')}
          >
            T-beam
          </button>
        </div>
      </div>

      {shape.kind === 'rectangular' && (
        <div className="sb-panel__grid-2">
          <label className="sb-field">
            <span>b ({dimLabel})</span>
            <DimInput
              siValue={shape.b}
              unitSystem={unitSystem}
              onChange={(v) => setShapeDim('b', v)}
            />
          </label>
          <label className="sb-field">
            <span>h ({dimLabel})</span>
            <DimInput
              siValue={shape.h}
              unitSystem={unitSystem}
              onChange={(v) => setShapeDim('h', v)}
            />
          </label>
        </div>
      )}

      {shape.kind === 't-beam' && (
        <div className="sb-panel__grid-2">
          <label className="sb-field">
            <span>bf ({dimLabel})</span>
            <DimInput
              siValue={shape.bf}
              unitSystem={unitSystem}
              onChange={(v) => setShapeDim('bf', v)}
            />
          </label>
          <label className="sb-field">
            <span>hf ({dimLabel})</span>
            <DimInput
              siValue={shape.hf}
              unitSystem={unitSystem}
              onChange={(v) => setShapeDim('hf', v)}
            />
          </label>
          <label className="sb-field">
            <span>bw ({dimLabel})</span>
            <DimInput
              siValue={shape.bw}
              unitSystem={unitSystem}
              onChange={(v) => setShapeDim('bw', v)}
            />
          </label>
          <label className="sb-field">
            <span>h ({dimLabel})</span>
            <DimInput
              siValue={shape.h}
              unitSystem={unitSystem}
              onChange={(v) => setShapeDim('h', v)}
            />
          </label>
        </div>
      )}

      <div className="sb-panel__group">
        <div className="sb-panel__row">
          <div className="sb-panel__label">Rebar layers</div>
          <div className="sb-rc__layer-buttons">
            <button className="btn btn--ghost btn--sm" onClick={() => addLayer('top')}>
              + Top
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => addLayer('bot')}>
              + Bottom
            </button>
          </div>
        </div>

        {params.layers.length === 0 && (
          <div className="sb-panel__empty">No layers. Add top or bottom reinforcement.</div>
        )}

        <div className="sb-rc__layers">
          {params.layers.map((L) => {
            const bar = inferBar(L);
            const active = activeLayerId === L.id;
            return (
              <div
                key={L.id}
                className={`sb-rc__layer ${active ? 'is-active' : ''}`}
                onClick={() => setActiveLayerId(active ? null : L.id)}
              >
                <div className="sb-rc__layer-head">
                  <span className="sb-rc__layer-title">{L.label ?? L.id}</span>
                  <button
                    className="btn btn--ghost btn--xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLayer(L.id);
                    }}
                    title="Remove layer"
                  >
                    ×
                  </button>
                </div>
                <div className="sb-rc__layer-grid">
                  <label className="sb-field">
                    <span>Bar</span>
                    <select
                      value={bar?.id ?? '#8'}
                      onChange={(e) => setLayerBar(L.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {REBAR_ASTM.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="sb-field">
                    <span>Count</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={L.count}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        setLayerCount(L.id, Math.max(1, parseInt(e.target.value, 10) || 1))
                      }
                    />
                  </label>
                  <label className="sb-field">
                    <span>d ({dimLabel})</span>
                    <DimInput
                      siValue={L.depth}
                      unitSystem={unitSystem}
                      onChange={(v) => updateLayer(L.id, { depth: v })}
                    />
                  </label>
                  <label className="sb-field">
                    <span>As ({areaLabel})</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={Math.round(fromSI(L.area, 'A', unitSystem) * 100) / 100}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateLayer(L.id, {
                          area: toSI(parseFloat(e.target.value) || 0, 'A', unitSystem),
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sb-panel__group">
        <div className="sb-panel__label">Materials</div>
        <div className="sb-panel__grid-3">
          <label className="sb-field">
            <span>f&apos;c ({stressLabel})</span>
            <StressInput
              siValue={params.materials.fc}
              unitSystem={unitSystem}
              onChange={(v) => setMaterial('fc', v)}
            />
          </label>
          <label className="sb-field">
            <span>fy ({stressLabel})</span>
            <StressInput
              siValue={params.materials.fy}
              unitSystem={unitSystem}
              onChange={(v) => setMaterial('fy', v)}
            />
          </label>
          <label className="sb-field">
            <span>Es ({stressLabel})</span>
            <StressInput
              siValue={params.materials.Es}
              unitSystem={unitSystem}
              onChange={(v) => setMaterial('Es', v)}
              step={1000}
            />
          </label>
        </div>
        <div className="sb-panel__hint">
          Ec, fr, β1 auto per ACI 318 (editable if needed).
        </div>
      </div>
    </div>
  );
}

function inferBar(L: RebarLayer) {
  if (L.count <= 0) return REBAR_ASTM[5];
  const areaPer = L.area / L.count;
  let best = REBAR_ASTM[0];
  let bestErr = Infinity;
  for (const b of REBAR_ASTM) {
    const err = Math.abs(b.area - areaPer);
    if (err < bestErr) {
      bestErr = err;
      best = b;
    }
  }
  return best;
}
