'use client';

import React from 'react';
import type { WallResults } from '@/lib/retaining-wall/types';
import type { UnitSystem, Quantity } from '@/lib/beam/units';
import { fromSI, unitLabel } from '@/lib/beam/units';

interface Props {
  results: WallResults;
  unitSystem: UnitSystem;
}

export function StabilityResults({ results, unitSystem }: Props) {
  const { stability, pressure } = results;
  const forceU = unitLabel('forcePerLength', unitSystem);
  const momU = unitLabel('momentPerLength', unitSystem);
  const dimU = unitLabel('dimension', unitSystem);
  const pressU = unitLabel('pressure', unitSystem);

  const f = (si: number, q: Quantity, dig = 2) => fromSI(si, q, unitSystem).toFixed(dig);

  return (
    <div className="rw-results-grid">
      {/* Pressure section */}
      <section className="rw-results-block">
        <h4 className="rw-results-block__title">Earth Pressure</h4>
        <Row label="Active coeff Ka" value={pressure.K.toFixed(3)} />
        <Row label="Pa (soil)" value={`${f(pressure.Pa, 'forcePerLength')} ${forceU}`} />
        <Row label="Pq (surcharge)" value={`${f(pressure.Pq, 'forcePerLength')} ${forceU}`} />
        {pressure.Pw > 0 && <Row label="Pw (water)" value={`${f(pressure.Pw, 'forcePerLength')} ${forceU}`} />}
        {pressure.dPae > 0 && <Row label="ΔPae (seismic)" value={`${f(pressure.dPae, 'forcePerLength')} ${forceU}`} />}
        <Row label="Resultant ȳ" value={`${f(pressure.yBar, 'dimension')} ${dimU}`} />
      </section>

      {/* Forces & Moments */}
      <section className="rw-results-block">
        <h4 className="rw-results-block__title">Forces &amp; Moments</h4>
        <Row label="ΣV (vertical)" value={`${f(stability.sumV, 'forcePerLength')} ${forceU}`} />
        <Row label="ΣH (horizontal)" value={`${f(stability.sumH, 'forcePerLength')} ${forceU}`} />
        <Row label="Mr (resisting)" value={`${f(stability.Mr, 'momentPerLength')} ${momU}`} />
        <Row label="Mo (overturning)" value={`${f(stability.Mo, 'momentPerLength')} ${momU}`} />
        <Row label="Passive Pp" value={`${f(stability.passiveResistance, 'forcePerLength')} ${forceU}`} />
        {stability.keyContribution > 0 && (
          <Row label="Key ΔPp" value={`${f(stability.keyContribution, 'forcePerLength')} ${forceU}`} />
        )}
        <Row label="μ = tan δ" value={stability.slidingMu.toFixed(3)} />
      </section>

      {/* Stability Checks */}
      <section className="rw-results-block">
        <h4 className="rw-results-block__title">Stability Checks</h4>
        <CheckRow label="FS Overturning" value={stability.FS_overturning} ok={stability.overturningOk} />
        <CheckRow label="FS Sliding" value={stability.FS_sliding} ok={stability.slidingOk} />
        <Row label="Eccentricity e" value={`${f(stability.eccentricity, 'dimension', 0)} ${dimU}`} />
        <Row label="Kern B/6" value={`${f(stability.kern, 'dimension', 0)} ${dimU}`} />
        <CheckRow
          label="Eccentricity"
          value={`|e|=${f(Math.abs(stability.eccentricity), 'dimension', 0)} ${dimU}`}
          ok={stability.eccentricityOk}
          raw
        />
      </section>

      {/* Bearing */}
      <section className="rw-results-block">
        <h4 className="rw-results-block__title">Bearing</h4>
        <Row label="qmax" value={`${f(stability.qMax, 'pressure', 1)} ${pressU}`} />
        <Row label="qmin" value={`${f(stability.qMin, 'pressure', 1)} ${pressU}`} />
        <CheckRow
          label="Utilization"
          value={stability.bearingUtilization}
          ok={stability.bearingOk}
          percent
        />
      </section>

      {/* Errors / Warnings — full width row */}
      {(results.errors.length > 0 || results.issues.length > 0) && (
        <section className="rw-results-block rw-results-block--full">
          {results.errors.length > 0 && (
            <div className="rw-results__errors">
              {results.errors.map((e, i) => (
                <div key={i} className="rw-results__error">
                  <span className="rw-results__error-icon">⚠</span> {e}
                </div>
              ))}
            </div>
          )}
          {results.issues.length > 0 && (
            <div className="rw-results__issues">
              {results.issues.map((m, i) => (
                <div key={i} className="rw-results__issue">
                  {m}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rw-row">
      <span className="rw-row__label">{label}</span>
      <span className="rw-row__value">{value}</span>
    </div>
  );
}

function CheckRow({
  label,
  value,
  ok,
  percent,
  raw,
}: {
  label: string;
  value: number | string;
  ok: boolean;
  percent?: boolean;
  raw?: boolean;
}) {
  const text = raw
    ? String(value)
    : percent
    ? `${(Number(value) * 100).toFixed(0)}%`
    : typeof value === 'number' && isFinite(value)
    ? value.toFixed(2)
    : String(value);
  return (
    <div className={`rw-row rw-row--check ${ok ? 'is-ok' : 'is-fail'}`}>
      <span className="rw-row__label">{label}</span>
      <span className="rw-row__value">
        {text}
        <span className="rw-row__flag">{ok ? '✓' : '✗'}</span>
      </span>
    </div>
  );
}
