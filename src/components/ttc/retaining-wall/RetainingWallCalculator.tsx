'use client';

import React, { useMemo, useState } from 'react';
import type { WallInput, WallKind } from '@/lib/retaining-wall/types';
import { DEFAULT_INPUT, solveWall, defaultGeometryFor } from '@/lib/retaining-wall/solve';
import type { UnitSystem } from '@/lib/beam/units';
import { GeometryPanel } from './GeometryPanel';
import { MaterialsPanel } from './MaterialsPanel';
import { SoilPanel } from './SoilPanel';
import { LoadsPanel } from './LoadsPanel';
import { WallCanvas } from './WallCanvas';
import { StabilityResults } from './StabilityResults';
import { DesignResults } from './DesignResults';
import { WallTypeChooser } from './WallTypeChooser';
import dynamic from 'next/dynamic';

// 3D viewer is loaded only when the user picks counterfort / buttressed —
// keeps the bundle small for the common cantilever case.
const WallViewer3D = dynamic(
  () => import('./WallViewer3D').then((m) => m.WallViewer3D),
  { ssr: false, loading: () => <div className="rw__empty">Loading 3D viewer…</div> },
);

type Tab = 'geometry' | 'materials' | 'soil' | 'loads';
type ResultTab = 'stability' | 'design';

function tabLabel(t: Tab): string {
  return { geometry: 'Geometry', materials: 'Materials', soil: 'Soil', loads: 'Loads' }[t];
}

export function RetainingWallCalculator() {
  const [tab, setTab] = useState<Tab>('geometry');
  const [resultTab, setResultTab] = useState<ResultTab>('stability');
  const [input, setInput] = useState<WallInput>(DEFAULT_INPUT);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');

  const results = useMemo(() => {
    try {
      return solveWall(input);
    } catch (e) {
      console.error('solveWall error', e);
      return null;
    }
  }, [input]);

  const failCount = results?.errors.length ?? 0;
  const issueCount = results?.issues.length ?? 0;

  const handleKindChange = (k: WallKind) => {
    setInput((s) => {
      const newGeom = defaultGeometryFor(k, s.geometry);
      // Bridge abutments auto-switch to AASHTO LRFD; everything else keeps current code.
      const newCode = k === 'abutment' ? 'AASHTO LRFD' : (s.code === 'AASHTO LRFD' ? 'ACI 318-25' : s.code);
      return { ...s, geometry: newGeom, code: newCode };
    });
  };

  return (
    <div className="rw">
      <WallTypeChooser kind={input.geometry.kind} onChange={handleKindChange} />

      <div className="rw__toolbar">
        <div className="rw__tabs" role="tablist">
          {(['geometry', 'materials', 'soil', 'loads'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`rw__tab ${tab === t ? 'is-active' : ''}`}
              onClick={() => setTab(t)}
            >
              {tabLabel(t)}
            </button>
          ))}
        </div>
        <div className="rw__tabs-mobile">
          <label className="rw__tabs-mobile-label">Tool</label>
          <select
            className="rw__tabs-select"
            value={tab}
            onChange={(e) => setTab(e.target.value as Tab)}
          >
            {(['geometry', 'materials', 'soil', 'loads'] as Tab[]).map((t) => (
              <option key={t} value={t}>
                {tabLabel(t)}
              </option>
            ))}
          </select>
        </div>

        <div className="rw__actions">
          <div className="rw__units seg" role="group" aria-label="Unit system">
            <button
              type="button"
              className={unitSystem === 'metric' ? 'is-active' : ''}
              onClick={() => setUnitSystem('metric')}
            >
              Metric
            </button>
            <button
              type="button"
              className={unitSystem === 'imperial' ? 'is-active' : ''}
              onClick={() => setUnitSystem('imperial')}
            >
              Imperial
            </button>
          </div>
          <div className="rw__status">
            {failCount > 0 ? (
              <span className="rw__status-pill rw__status-pill--fail">{failCount} FAIL</span>
            ) : issueCount > 0 ? (
              <span className="rw__status-pill rw__status-pill--warn">{issueCount} WARN</span>
            ) : (
              <span className="rw__status-pill rw__status-pill--ok">OK</span>
            )}
          </div>
          <button className="btn btn--ghost" onClick={() => setInput(DEFAULT_INPUT)}>
            Reset
          </button>
        </div>
      </div>

      <div className="rw__body rw__body--layout2">
        <aside className="rw__side">
          {tab === 'geometry' && (
            <GeometryPanel
              geometry={input.geometry}
              unitSystem={unitSystem}
              onChange={(g) => setInput((s) => ({ ...s, geometry: g }))}
            />
          )}
          {tab === 'materials' && (
            <MaterialsPanel
              concrete={input.concrete}
              unitSystem={unitSystem}
              onChange={(c) => setInput((s) => ({ ...s, concrete: c }))}
            />
          )}
          {tab === 'soil' && (
            <SoilPanel
              backfill={input.backfill}
              baseSoil={input.baseSoil}
              water={input.water}
              unitSystem={unitSystem}
              onChangeBackfill={(b) => setInput((s) => ({ ...s, backfill: b }))}
              onChangeBase={(b) => setInput((s) => ({ ...s, baseSoil: b }))}
              onChangeWater={(w) => setInput((s) => ({ ...s, water: w }))}
            />
          )}
          {tab === 'loads' && (
            <LoadsPanel
              loads={input.loads}
              theory={input.theory}
              safetyFactors={input.safetyFactors}
              unitSystem={unitSystem}
              onChangeLoads={(l) => setInput((s) => ({ ...s, loads: l }))}
              onChangeTheory={(t) => setInput((s) => ({ ...s, theory: t }))}
              onChangeSafety={(sf) => setInput((s) => ({ ...s, safetyFactors: sf }))}
            />
          )}
        </aside>

        <main className="rw__canvas">
          {results ? (
            <>
              <WallCanvas input={input} results={results} unitSystem={unitSystem} />
              {(input.geometry.kind === 'counterfort' || input.geometry.kind === 'buttressed') && (
                <div className="rw__canvas-3d">
                  <WallViewer3D input={input} />
                </div>
              )}
            </>
          ) : (
            <div className="rw__empty">Enter geometry to build your wall</div>
          )}
        </main>
      </div>

      <div className="rw__results">
        <div className="rw__results-tabs seg" role="group" aria-label="Results view">
          <button
            type="button"
            className={resultTab === 'stability' ? 'is-active' : ''}
            onClick={() => setResultTab('stability')}
          >
            Stability
          </button>
          <button
            type="button"
            className={resultTab === 'design' ? 'is-active' : ''}
            onClick={() => setResultTab('design')}
          >
            Design (ACI 318)
          </button>
        </div>
        {results && resultTab === 'stability' && (
          <StabilityResults results={results} unitSystem={unitSystem} />
        )}
        {results && resultTab === 'design' && (
          <DesignResults results={results} unitSystem={unitSystem} />
        )}
      </div>
    </div>
  );
}
