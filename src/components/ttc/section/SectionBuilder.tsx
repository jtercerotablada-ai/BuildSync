'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SectionCanvas, type HeatmapMode } from './SectionCanvas';
import { ShapeTemplatesPanel, defaultsFor } from './ShapeTemplatesPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { DatabasePanel, type UnifiedEntry } from './DatabasePanel';
import { PolygonEditorPanel } from './PolygonEditorPanel';
import { CompositeEditorPanel } from './CompositeEditorPanel';
import { SavedSectionsPanel } from './SavedSectionsPanel';
import { computeTemplate } from '@/lib/section/compute-template';
import { computePolygon } from '@/lib/section/compute-polygon';
import { computeComposite } from '@/lib/section/compute-composite';
import { sectionWeightPerLength, sectionYoungs } from '@/lib/section/compute';
import { aiscToSectionProperties, findAISC } from '@/lib/section/aisc-loader';
import { findIntl, intlToSectionProperties } from '@/lib/section/international-loader';
import type {
  CompositeOperand,
  CompositeParams,
  Point2D,
  SavedSection,
  SectionProperties,
  SectionSource,
  TemplateParams,
} from '@/lib/section/types';
import {
  MATERIAL_PRESETS,
  type MaterialPreset,
} from '@/lib/beam/types';
import {
  toSI,
  fromSI,
  unitLabel,
  type UnitSystem,
} from '@/lib/beam/units';

type Tab = 'templates' | 'database' | 'custom' | 'composite' | 'saved';

const STORAGE_KEY = 'ttc:saved-sections';
const PENDING_KEY = 'ttc:beam-pending-section';

interface State {
  source: SectionSource;
  material: MaterialPreset;
  label: string;
}

const initialState: State = {
  source: { type: 'template', params: defaultsFor('i-shape') },
  material: 'steel',
  label: 'I-shape 300×150',
};

export function SectionBuilder() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('templates');
  const [state, setState] = useState<State>(initialState);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [moment, setMoment] = useState<number>(0); // applied M in SI (kN·m)
  const [shear, setShear] = useState<number>(0); // applied V in SI (kN)
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('off');
  const [savedSections, setSavedSections] = useState<SavedSection[]>([]);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [activeVertex, setActiveVertex] = useState<number | null>(null);
  const [activeOperandId, setActiveOperandId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedSections(JSON.parse(raw));
    } catch {
      // ignore corrupted storage
    }
  }, []);

  const persistSaved = useCallback((list: SavedSection[]) => {
    setSavedSections(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore quota errors
    }
  }, []);

  const properties = useMemo<SectionProperties>(() => {
    if (state.source.type === 'template') return computeTemplate(state.source.params);
    if (state.source.type === 'polygon') return computePolygon(state.source.params.vertices);
    if (state.source.type === 'composite') return computeComposite(state.source.params);
    if (state.source.type === 'database') {
      const standard = state.source.ref.standard ?? 'AISC';
      if (standard === 'AISC') {
        const entry = findAISC(state.source.ref.designation);
        if (entry) return aiscToSectionProperties(entry);
      } else {
        const entry = findIntl(state.source.ref.designation);
        if (entry) return intlToSectionProperties(entry);
      }
    }
    return computeTemplate(defaultsFor('rectangular'));
  }, [state.source]);

  const weightPerLength = useMemo(
    () => sectionWeightPerLength(properties.A, state.material),
    [properties.A, state.material]
  );

  const setTemplate = (params: TemplateParams) => {
    setState((s) => ({ ...s, source: { type: 'template', params }, label: labelForTemplate(params) }));
    setActiveSavedId(null);
  };

  const setPolygon = (vertices: Point2D[]) => {
    setState((s) => ({
      ...s,
      source: { type: 'polygon', params: { vertices } },
      label: `Polygon (${vertices.length} pts)`,
    }));
    setActiveSavedId(null);
  };

  const setComposite = (params: CompositeParams) => {
    setState((s) => ({
      ...s,
      source: { type: 'composite', params },
      label: `Composite (${params.operands.length} ops)`,
    }));
    setActiveSavedId(null);
  };

  const setDatabase = (u: UnifiedEntry) => {
    const standard: 'AISC' | 'EN' | 'BS' =
      u.source === 'aisc'
        ? 'AISC'
        : u.entry.family === 'UB' || u.entry.family === 'UC'
        ? 'BS'
        : 'EN';
    setState((s) => ({
      ...s,
      source: {
        type: 'database',
        ref: { designation: u.entry.designation, family: u.entry.family, standard },
      },
      label: u.entry.designation,
    }));
    setActiveSavedId(null);
  };

  const handleTabSwitch = (t: Tab) => {
    if (t === 'templates' && state.source.type !== 'template') setTemplate(defaultsFor('i-shape'));
    if (t === 'custom' && state.source.type !== 'polygon') {
      setPolygon([
        { x: 0, y: 0 },
        { x: 150, y: 0 },
        { x: 150, y: 200 },
        { x: 0, y: 200 },
      ]);
    }
    if (t === 'composite' && state.source.type !== 'composite') {
      const iOp: CompositeOperand = {
        id: `op-${Date.now()}-i`,
        params: { kind: 'i-shape', H: 300, B: 150, tw: 10, tf: 15 },
        dx: 0,
        dy: 0,
        op: 'add',
      };
      const plate: CompositeOperand = {
        id: `op-${Date.now()}-p`,
        params: { kind: 'rectangular', b: 200, h: 20 },
        dx: -25,
        dy: 300,
        op: 'add',
      };
      setComposite({ operands: [iOp, plate] });
    }
    setTab(t);
  };

  const handleSave = () => {
    const name = prompt('Name this section', state.label) ?? state.label;
    if (!name.trim()) return;
    const saved: SavedSection = {
      id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      material: state.material,
      source: state.source,
      props: properties,
      createdAt: Date.now(),
    };
    persistSaved([saved, ...savedSections]);
    setActiveSavedId(saved.id);
    setTab('saved');
  };

  const handleLoad = (s: SavedSection) => {
    setState({ source: s.source, material: s.material, label: s.name });
    setActiveSavedId(s.id);
  };

  const handleRename = (id: string, name: string) => {
    persistSaved(savedSections.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  const handleDelete = (id: string) => {
    persistSaved(savedSections.filter((s) => s.id !== id));
    if (activeSavedId === id) setActiveSavedId(null);
  };

  const handleUseInBeam = () => {
    const E = sectionYoungs(state.material);
    const payload = {
      label: state.label,
      material: state.material,
      E,
      I: properties.Ix,
      A: properties.A,
    };
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
    } catch {
      // storage may be unavailable (private mode) — still navigate
    }
    router.push('/resources/beam');
  };

  const handleReset = () => {
    setState(initialState);
    setActiveSavedId(null);
    setMoment(0);
    setShear(0);
    setHeatmapMode('off');
  };

  const momentDisplay = fromSI(moment, 'moment', unitSystem);
  const momentUnit = unitLabel('moment', unitSystem);
  const shearDisplay = fromSI(shear, 'force', unitSystem);
  const shearUnit = unitLabel('force', unitSystem);

  return (
    <div className="sb">
      <div className="sb__toolbar">
        <div className="sb__tabs" role="tablist">
          {(['templates', 'database', 'custom', 'composite', 'saved'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`sb__tab ${tab === t ? 'is-active' : ''}`}
              onClick={() => handleTabSwitch(t)}
            >
              {tabLabel(t)}
              {t === 'saved' && savedSections.length > 0 && (
                <span className="sb__tab-count">{savedSections.length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="sb__tabs-mobile">
          <select
            className="sb__tabs-select"
            value={tab}
            onChange={(e) => handleTabSwitch(e.target.value as Tab)}
          >
            {(['templates', 'database', 'custom', 'composite', 'saved'] as Tab[]).map((t) => (
              <option key={t} value={t}>
                {tabLabel(t)}
              </option>
            ))}
          </select>
        </div>

        <div className="sb__actions">
          <label className="sb__field-inline">
            <span>Material</span>
            <select
              value={state.material}
              onChange={(e) => setState((s) => ({ ...s, material: e.target.value as MaterialPreset }))}
            >
              {Object.entries(MATERIAL_PRESETS).map(([id, preset]) => (
                <option key={id} value={id}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </label>

          <div className="sb__units seg" role="group" aria-label="Unit system">
            <button
              type="button"
              className={unitSystem === 'metric' ? 'is-active' : ''}
              onClick={() => setUnitSystem('metric')}
              title="Metric (SI)"
            >
              Metric
            </button>
            <button
              type="button"
              className={unitSystem === 'imperial' ? 'is-active' : ''}
              onClick={() => setUnitSystem('imperial')}
              title="Imperial (US)"
            >
              Imperial
            </button>
          </div>

          <label className="sb__field-inline">
            <span>M ({momentUnit})</span>
            <input
              type="number"
              step="any"
              value={Math.round(momentDisplay * 10000) / 10000}
              onChange={(e) =>
                setMoment(toSI(parseFloat(e.target.value) || 0, 'moment', unitSystem))
              }
              className="sb__field-inline-input"
            />
          </label>

          <label className="sb__field-inline">
            <span>V ({shearUnit})</span>
            <input
              type="number"
              step="any"
              value={Math.round(shearDisplay * 10000) / 10000}
              onChange={(e) =>
                setShear(toSI(parseFloat(e.target.value) || 0, 'force', unitSystem))
              }
              className="sb__field-inline-input"
            />
          </label>

          <div className="sb__heatmap seg" role="group" aria-label="Stress heatmap mode">
            <button
              type="button"
              className={heatmapMode === 'off' ? 'is-active' : ''}
              onClick={() => setHeatmapMode('off')}
              title="No stress overlay"
            >
              Off
            </button>
            <button
              type="button"
              className={heatmapMode === 'sigma' ? 'is-active' : ''}
              onClick={() => setHeatmapMode('sigma')}
              title="Bending stress σ = M·y/Ix"
            >
              σ
            </button>
            <button
              type="button"
              className={heatmapMode === 'tau' ? 'is-active' : ''}
              onClick={() => setHeatmapMode('tau')}
              title="Shear stress τ = V·Q/(I·t)"
            >
              τ
            </button>
          </div>

          <button className="btn btn--ghost" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>

      <div className="sb__body">
        <aside className="sb__side">
          {tab === 'templates' && state.source.type === 'template' && (
            <ShapeTemplatesPanel
              params={state.source.params}
              onChange={setTemplate}
              unitSystem={unitSystem}
            />
          )}
          {tab === 'database' && (
            <DatabasePanel
              onSelect={setDatabase}
              activeDesignation={
                state.source.type === 'database' ? state.source.ref.designation : undefined
              }
            />
          )}
          {tab === 'custom' && state.source.type === 'polygon' && (
            <PolygonEditorPanel
              vertices={state.source.params.vertices}
              onChange={setPolygon}
              unitSystem={unitSystem}
              activeIndex={activeVertex}
              setActiveIndex={setActiveVertex}
            />
          )}
          {tab === 'composite' && state.source.type === 'composite' && (
            <CompositeEditorPanel
              params={state.source.params}
              onChange={setComposite}
              unitSystem={unitSystem}
              activeOperandId={activeOperandId}
              setActiveOperandId={setActiveOperandId}
            />
          )}
          {tab === 'saved' && (
            <SavedSectionsPanel
              sections={savedSections}
              onLoad={handleLoad}
              onRename={handleRename}
              onDelete={handleDelete}
              unitSystem={unitSystem}
              activeId={activeSavedId}
            />
          )}
        </aside>

        <main className="sb__canvas">
          <SectionCanvas
            props={properties}
            M={moment}
            V={shear}
            heatmapMode={heatmapMode}
            unitSystem={unitSystem}
            onVertexClick={
              state.source.type === 'polygon'
                ? (i) => setActiveVertex(i === activeVertex ? null : i)
                : undefined
            }
            activeVertex={activeVertex}
          />

          <div className="sb__canvas-footer">
            <div className="sb__label">{state.label}</div>
            <div className="sb__canvas-buttons">
              <button className="btn btn--ghost" onClick={handleSave}>
                Save
              </button>
              <button className="btn btn--primary" onClick={handleUseInBeam}>
                Use in Beam Calculator →
              </button>
            </div>
          </div>
        </main>

        <aside className="sb__props">
          <PropertiesPanel
            props={properties}
            unitSystem={unitSystem}
            weightPerLength={weightPerLength}
          />
        </aside>
      </div>
    </div>
  );
}

function tabLabel(t: Tab): string {
  return {
    templates: 'Templates',
    database: 'Database',
    custom: 'Custom',
    composite: 'Composite',
    saved: 'Saved',
  }[t];
}

function labelForTemplate(p: TemplateParams): string {
  switch (p.kind) {
    case 'rectangular':
      return `Rect ${p.b}×${p.h}`;
    case 'hollow-rect':
      return `HSS ${p.B}×${p.H}×${p.tw}`;
    case 'circular':
      return `Circ D=${p.D}`;
    case 'hollow-circ':
      return `Tube D=${p.D}/d=${p.d}`;
    case 'i-shape':
      return `I-shape ${p.H}×${p.B}`;
    case 't-shape':
      return `T-shape ${p.H}×${p.B}`;
    case 'angle':
      return `Angle L${p.H}×${p.B}×${p.t}`;
    case 'channel':
      return `Channel C${p.H}×${p.B}`;
    case 'box-girder':
      return `Box ${p.B}×${p.H}`;
  }
}
