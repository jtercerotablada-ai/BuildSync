'use client';

import React, { useMemo, useState } from 'react';
import type { WallInput } from '@/lib/retaining-wall/types';
import { DEFAULT_INPUT, solveWall } from '@/lib/retaining-wall/solve';
import { GeometryPanel } from './GeometryPanel';
import { MaterialsPanel } from './MaterialsPanel';
import { SoilPanel } from './SoilPanel';
import { LoadsPanel } from './LoadsPanel';
import { WallCanvas } from './WallCanvas';
import { StabilityResults } from './StabilityResults';
import { DesignResults } from './DesignResults';

type Tab = 'geometry' | 'materials' | 'soil' | 'loads' | 'design';

function tabLabel(t: Tab): string {
  return {
    geometry: 'Geometry',
    materials: 'Materials',
    soil: 'Soil',
    loads: 'Loads',
    design: 'Design',
  }[t];
}

export function RetainingWallCalculator() {
  const [tab, setTab] = useState<Tab>('geometry');
  const [input, setInput] = useState<WallInput>(DEFAULT_INPUT);
  const [view, setView] = useState<'stability' | 'design'>('stability');

  const results = useMemo(() => {
    try {
      return solveWall(input);
    } catch (e) {
      console.error('solveWall error', e);
      return null;
    }
  }, [input]);

  return (
    <div className="rw">
      <div className="rw__toolbar">
        <div className="rw__tabs" role="tablist">
          {(['geometry', 'materials', 'soil', 'loads', 'design'] as Tab[]).map((t) => (
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
            {(['geometry', 'materials', 'soil', 'loads', 'design'] as Tab[]).map((t) => (
              <option key={t} value={t}>
                {tabLabel(t)}
              </option>
            ))}
          </select>
        </div>

        <div className="rw__actions">
          <div className="rw__status">
            {results?.errors.length ? (
              <span className="rw__status-pill rw__status-pill--fail">
                {results.errors.length} FAIL
              </span>
            ) : (
              <span className="rw__status-pill rw__status-pill--ok">OK</span>
            )}
          </div>
          <button
            className="btn btn--ghost"
            onClick={() => setInput(DEFAULT_INPUT)}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="rw__body">
        <aside className="rw__side">
          {tab === 'geometry' && (
            <GeometryPanel
              geometry={input.geometry}
              onChange={(g) => setInput((s) => ({ ...s, geometry: g }))}
            />
          )}
          {tab === 'materials' && (
            <MaterialsPanel
              concrete={input.concrete}
              onChange={(c) => setInput((s) => ({ ...s, concrete: c }))}
            />
          )}
          {tab === 'soil' && (
            <SoilPanel
              backfill={input.backfill}
              baseSoil={input.baseSoil}
              water={input.water}
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
              onChangeLoads={(l) => setInput((s) => ({ ...s, loads: l }))}
              onChangeTheory={(t) => setInput((s) => ({ ...s, theory: t }))}
              onChangeSafety={(sf) => setInput((s) => ({ ...s, safetyFactors: sf }))}
            />
          )}
          {tab === 'design' && results && (
            <DesignResults results={results} />
          )}
        </aside>

        <main className="rw__canvas">
          {results ? (
            <WallCanvas input={input} results={results} />
          ) : (
            <div className="rw__empty">Enter geometry to build your wall</div>
          )}
          <div className="rw__canvas-footer">
            <div className="rw__label">
              Cantilever wall · H={(input.geometry.H_stem + input.geometry.H_foot) / 1000}m · B=
              {(
                (input.geometry.B_toe +
                  input.geometry.t_stem_bot +
                  input.geometry.B_heel) /
                1000
              ).toFixed(2)}
              m
            </div>
            <div className="rw__view-toggle seg" role="group" aria-label="Results view">
              <button
                type="button"
                className={view === 'stability' ? 'is-active' : ''}
                onClick={() => setView('stability')}
              >
                Stability
              </button>
              <button
                type="button"
                className={view === 'design' ? 'is-active' : ''}
                onClick={() => setView('design')}
              >
                Design
              </button>
            </div>
          </div>
        </main>

        <aside className="rw__props">
          {results && view === 'stability' && (
            <StabilityResults results={results} />
          )}
          {results && view === 'design' && <DesignResults results={results} />}
        </aside>
      </div>
    </div>
  );
}
