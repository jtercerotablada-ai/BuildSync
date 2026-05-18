'use client';

import React, { useState } from 'react';
import type { WindResult } from '@/lib/load-gen/types';
import type { UnitSystem } from '@/lib/beam/units';
import { fromSI, unitLabel } from '@/lib/beam/units';

interface Props {
  result: WindResult | null;
  unitSystem: UnitSystem;
}

type View = 'site' | 'mwfrs' | 'cc';

export function ResultsPanel({ result, unitSystem }: Props) {
  const [view, setView] = useState<View>('mwfrs');
  const pu = unitLabel('pressureSmall', unitSystem);
  const vu = unitLabel('velocity', unitSystem);
  const dimU = unitLabel('dimension', unitSystem);

  if (!result) {
    return (
      <div className="lg-results lg-results--empty">
        Enter site + structure data to calculate wind loads.
      </div>
    );
  }

  const fp = (pa: number) => `${fromSI(pa, 'pressureSmall', unitSystem).toFixed(1)} ${pu}`;

  return (
    <div className="lg-results">
      <div className="lg-results__tabs seg" role="group">
        <button type="button" className={view === 'site' ? 'is-active' : ''} onClick={() => setView('site')}>
          Site Data
        </button>
        <button type="button" className={view === 'mwfrs' ? 'is-active' : ''} onClick={() => setView('mwfrs')}>
          MWFRS
        </button>
        <button type="button" className={view === 'cc' ? 'is-active' : ''} onClick={() => setView('cc')}>
          C&amp;C
        </button>
      </div>

      {view === 'site' && (
        <section className="lg-results-block">
          <h4>Velocity Pressure Breakdown</h4>
          <Row label="V (design wind speed)" value={`${fromSI(result.breakdown.V, 'velocity', unitSystem).toFixed(1)} ${vu}`} />
          <Row label="Kz / Kh" value={result.breakdown.Kz.toFixed(3)} />
          <Row label="Kzt" value={result.breakdown.Kzt.toFixed(2)} />
          <Row label="Kd" value={result.breakdown.Kd.toFixed(2)} />
          <Row label="Ke" value={result.breakdown.Ke.toFixed(3)} />
          <Row label="qh" value={fp(result.breakdown.qh)} />
        </section>
      )}

      {view === 'mwfrs' && (
        <section className="lg-results-block">
          <h4>MWFRS Design Pressures</h4>
          <Row label="G (gust factor)" value={result.mwfrs.G.toFixed(2)} />
          <Row label="GCpi (+)" value={result.mwfrs.walls.GCpi_pos.toFixed(2)} />
          <Row label="GCpi (−)" value={result.mwfrs.walls.GCpi_neg.toFixed(2)} />
          <div className="lg-row lg-row--sep" />
          <Row label="Windward wall (design)" value={fp(result.mwfrs.walls.windwardDesign)} strong pos />
          <Row label="Leeward wall (design)" value={fp(result.mwfrs.walls.leewardDesign)} strong neg />
          <Row label="Side wall (design)" value={fp(result.mwfrs.walls.sideDesign)} strong neg />
          <div className="lg-row lg-row--sep" />
          <h5 className="lg-subhead">Roof</h5>
          {result.mwfrs.roof.map((r) => (
            <Row key={r.zone} label={`${r.zone} (Cp = ${r.Cp.toFixed(2)})`} value={fp(r.p)} neg={r.p < 0} />
          ))}
        </section>
      )}

      {view === 'cc' && (
        <section className="lg-results-block">
          <h4>Components &amp; Cladding (Aeff = 10 ft²)</h4>
          <Row label="Zone boundary a" value={`${fromSI(result.cc.a, 'dimension', unitSystem).toFixed(2)} ${dimU}`} />
          <div className="lg-row lg-row--sep" />
          <h5 className="lg-subhead">Walls</h5>
          {result.cc.walls.map((z) => (
            <div key={z.label} className="lg-cc-row">
              <span className="lg-cc-row__label">{z.label}</span>
              <span className="lg-cc-row__pos">{fp(z.p_pos)}</span>
              <span className="lg-cc-row__neg">{fp(z.p_neg)}</span>
            </div>
          ))}
          <h5 className="lg-subhead">Roof</h5>
          {result.cc.roof.map((z) => (
            <div key={z.label} className="lg-cc-row">
              <span className="lg-cc-row__label">{z.label}</span>
              <span className="lg-cc-row__pos">{fp(z.p_pos)}</span>
              <span className="lg-cc-row__neg">{fp(z.p_neg)}</span>
            </div>
          ))}
        </section>
      )}

      {(result.errors.length > 0 || result.issues.length > 0) && (
        <section className="lg-results-block lg-results-block--issues">
          {result.errors.map((e, i) => (
            <div key={`err-${i}`} className="lg-issue lg-issue--err">⚠ {e}</div>
          ))}
          {result.issues.map((m, i) => (
            <div key={`iss-${i}`} className="lg-issue lg-issue--warn">{m}</div>
          ))}
        </section>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  pos,
  neg,
}: {
  label: string;
  value: string;
  strong?: boolean;
  pos?: boolean;
  neg?: boolean;
}) {
  return (
    <div className={`lg-row ${strong ? 'lg-row--strong' : ''} ${pos ? 'is-pos' : ''} ${neg ? 'is-neg' : ''}`}>
      <span className="lg-row__label">{label}</span>
      <span className="lg-row__value">{value}</span>
    </div>
  );
}
