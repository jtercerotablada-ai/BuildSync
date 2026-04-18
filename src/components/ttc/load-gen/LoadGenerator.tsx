'use client';

import React, { useMemo, useState } from 'react';
import type { UnitSystem } from '@/lib/beam/units';
import type { LoadGenInput, DesignCode } from '@/lib/load-gen/types';
import { DEFAULT_INPUT, solveLoadGen } from '@/lib/load-gen/solve';
import { SiteDataPanel } from './SiteDataPanel';
import { StructureDataPanel } from './StructureDataPanel';
import { SiteMap } from './SiteMap';
import { WindPressureDiagram } from './WindPressureDiagram';
import { ResultsPanel } from './ResultsPanel';

type Tab = 'site' | 'structure';

const CODE_OPTIONS: Array<{ value: DesignCode; label: string; enabled: boolean }> = [
  { value: 'ASCE-7-22', label: 'ASCE 7-22 (US)', enabled: true },
  { value: 'ASCE-7-16', label: 'ASCE 7-16 (US)', enabled: false },
  { value: 'ASCE-7-10', label: 'ASCE 7-10 (US)', enabled: false },
  { value: 'EN-1991', label: 'EN 1991 (Europe)', enabled: false },
  { value: 'NBCC-2020', label: 'NBCC 2020 (Canada)', enabled: false },
  { value: 'AS-NZS-1170', label: 'AS/NZS 1170 (AU/NZ)', enabled: false },
  { value: 'NSCP-2015', label: 'NSCP 2015 (PH)', enabled: false },
  { value: 'CFE-Viento-2020', label: 'CFE Viento 2020 (MX)', enabled: false },
  { value: 'CFE-Viento-2008', label: 'CFE Viento 2008 (MX)', enabled: false },
  { value: 'CTE-DB-SE-AE', label: 'CTE DB SE-AE (Spain)', enabled: false },
  { value: 'SANS-10160-3', label: 'SANS 10160-3 (ZA)', enabled: false },
  { value: 'IS-875-2015', label: 'IS 875:2015 (IN)', enabled: false },
];

export function LoadGenerator() {
  const [input, setInput] = useState<LoadGenInput>(DEFAULT_INPUT);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('imperial');
  const [tab, setTab] = useState<Tab>('site');

  const result = useMemo(() => solveLoadGen(input), [input]);

  return (
    <div className="lg">
      <div className="lg__toolbar">
        <div className="lg__tabs" role="tablist">
          {(['site', 'structure'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`lg__tab ${tab === t ? 'is-active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'site' ? 'Site' : 'Structure'}
            </button>
          ))}
        </div>
        <div className="lg__tabs-mobile">
          <label className="lg__tabs-mobile-label">Panel</label>
          <select
            className="lg__tabs-select"
            value={tab}
            onChange={(e) => setTab(e.target.value as Tab)}
          >
            <option value="site">Site</option>
            <option value="structure">Structure</option>
          </select>
        </div>

        <div className="lg__actions">
          <label className="lg-field-inline">
            <span>Code</span>
            <select
              className="lg-field-inline__input"
              value={input.code}
              onChange={(e) => setInput({ ...input, code: e.target.value as DesignCode })}
            >
              {CODE_OPTIONS.map((c) => (
                <option key={c.value} value={c.value} disabled={!c.enabled}>
                  {c.label}{c.enabled ? '' : ' — soon'}
                </option>
              ))}
            </select>
          </label>
          <div className="lg__units seg" role="group" aria-label="Unit system">
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
          <button className="btn btn--ghost" onClick={() => setInput(DEFAULT_INPUT)}>
            Reset
          </button>
        </div>
      </div>

      <div className="lg__body">
        <aside className="lg__side">
          {tab === 'site' && (
            <SiteDataPanel
              site={input.site}
              unitSystem={unitSystem}
              onChange={(s) => setInput({ ...input, site: s })}
            />
          )}
          {tab === 'structure' && (
            <StructureDataPanel
              structure={input.structure}
              unitSystem={unitSystem}
              onChange={(s) => setInput({ ...input, structure: s })}
            />
          )}
        </aside>

        <main className="lg__canvas">
          <div className="lg__canvas-map">
            <SiteMap location={input.site.location} />
          </div>
          <div className="lg__canvas-diagram">
            <WindPressureDiagram
              structure={input.structure}
              result={result}
              unitSystem={unitSystem}
            />
          </div>
        </main>
      </div>

      <div className="lg__results-wrap">
        <ResultsPanel result={result} unitSystem={unitSystem} />
      </div>
    </div>
  );
}
