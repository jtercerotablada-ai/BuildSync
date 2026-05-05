'use client';

import React, { useMemo, useState, useCallback } from 'react';
import type { WallInput, WallKind } from '@/lib/retaining-wall/types';
import { DEFAULT_INPUT, solveWall, defaultGeometryFor } from '@/lib/retaining-wall/solve';
import { autoDesign } from '@/lib/retaining-wall/autoDesign';
import { RetainingWallPrintReport } from './RetainingWallPrintReport';
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

// Generic 3D viewer for kinds other than cantilever
const WallViewer3D = dynamic(
  () => import('./WallViewer3D').then((m) => m.WallViewer3D),
  { ssr: false, loading: () => <div className="rw__empty">Loading 3D viewer…</div> },
);
// Dedicated photo-realistic viewer for cantilever walls — concrete texture,
// real rebar grid (vertical + horizontal stem + footing top + bottom),
// semi-transparent soil, SSAO + bloom + tone mapping.
const CantileverViewer3D = dynamic(
  () => import('./CantileverViewer3D').then((m) => m.CantileverViewer3D),
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

  const [cover2dDataUrl, setCover2dDataUrl] = useState<string | undefined>();

  const captureCover2d = useCallback(() => {
    // Find the first SVG inside the wall canvas — serialize to PNG via blob
    const svg = document.querySelector('.rw__canvas svg') as SVGSVGElement | null;
    if (!svg) return;
    try {
      const xml = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = svg.clientWidth || 900;
        canvas.height = svg.clientHeight || 600;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#0c0d12';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        try { setCover2dDataUrl(canvas.toDataURL('image/png')); } catch { /* CORS */ }
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch { /* swallow — print still works without snapshot */ }
  }, []);

  const handlePrint = useCallback(() => {
    captureCover2d();
    setTimeout(() => window.print(), 120);
  }, [captureCover2d]);

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
      {/* Print-only report (hidden on screen via .slab-print-portal CSS) */}
      {results && (
        <RetainingWallPrintReport input={input} result={results} cover2dDataUrl={cover2dDataUrl} />
      )}

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
          <button
            className="btn btn--accent"
            onClick={() => {
              const r = autoDesign(input);
              setInput(r.patchedInput);
            }}
            title="Iteratively size the wall until every check passes"
          >
            ⚙ Auto-Design
          </button>
          <button
            className="btn btn--accent slab-print-btn"
            onClick={handlePrint}
            title="Generate a multi-page PDF report"
          >
            ⎙ Print full report
          </button>
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
              code={input.code ?? 'ACI 318-25'}
              onChangeLoads={(l) => setInput((s) => ({ ...s, loads: l }))}
              onChangeTheory={(t) => setInput((s) => ({ ...s, theory: t }))}
              onChangeSafety={(sf) => setInput((s) => ({ ...s, safetyFactors: sf }))}
              onChangeCode={(c) => setInput((s) => ({ ...s, code: c }))}
            />
          )}
        </aside>

        <main className="rw__canvas">
          {results ? (
            <>
              <WallCanvas input={input} results={results} unitSystem={unitSystem} />
              <div className="rw__canvas-3d">
                {input.geometry.kind === 'cantilever' ? (
                  <CantileverViewer3D input={input} result={results} />
                ) : (
                  <WallViewer3D input={input} />
                )}
              </div>
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
