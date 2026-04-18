'use client';

import React from 'react';
import type { WallResults, WallInput } from '@/lib/retaining-wall/types';

interface Props {
  results: WallResults;
}

export function StabilityResults({ results }: Props) {
  const { stability, pressure } = results;

  return (
    <div className="rw-panel">
      <h3 className="rw-panel__title">Stability Check</h3>

      <Row
        label="Active coeff Ka"
        value={pressure.K.toFixed(3)}
      />
      <Row
        label="Active thrust Pa"
        value={`${pressure.Pa.toFixed(1)} kN/m`}
      />
      <Row
        label="Surcharge thrust Pq"
        value={`${pressure.Pq.toFixed(1)} kN/m`}
      />
      {pressure.Pw > 0 && <Row label="Water thrust Pw" value={`${pressure.Pw.toFixed(1)} kN/m`} />}
      {pressure.dPae > 0 && <Row label="Seismic ΔPae" value={`${pressure.dPae.toFixed(1)} kN/m`} />}
      <Row label="Resultant height ȳ" value={`${(pressure.yBar / 1000).toFixed(2)} m`} />

      <Divider />

      <Row label="ΣV (vertical)" value={`${stability.sumV.toFixed(1)} kN/m`} />
      <Row label="ΣH (horizontal)" value={`${stability.sumH.toFixed(1)} kN/m`} />
      <Row label="Mr (resisting)" value={`${stability.Mr.toFixed(1)} kN·m/m`} />
      <Row label="Mo (overturning)" value={`${stability.Mo.toFixed(1)} kN·m/m`} />

      <Divider />

      <CheckRow
        label="Overturning FS"
        value={stability.FS_overturning}
        ok={stability.overturningOk}
      />
      <CheckRow label="Sliding FS" value={stability.FS_sliding} ok={stability.slidingOk} />

      <Divider />

      <Row label="Passive at toe Pp" value={`${stability.passiveResistance.toFixed(1)} kN/m`} />
      {stability.keyContribution > 0 && (
        <Row label="Shear key ΔPp" value={`${stability.keyContribution.toFixed(1)} kN/m`} />
      )}
      <Row label="Sliding μ = tan δ" value={stability.slidingMu.toFixed(3)} />

      <Divider />

      <Row label="Eccentricity e" value={`${stability.eccentricity.toFixed(0)} mm`} />
      <Row label="Kern B/6" value={`${stability.kern.toFixed(0)} mm`} />
      <CheckRow
        label="Eccentricity check"
        value={`|e| = ${Math.abs(stability.eccentricity).toFixed(0)}`}
        ok={stability.eccentricityOk}
        raw
      />

      <Divider />

      <Row label="qmax" value={`${stability.qMax.toFixed(1)} kPa`} />
      <Row label="qmin" value={`${stability.qMin.toFixed(1)} kPa`} />
      <CheckRow
        label="Bearing utilization"
        value={stability.bearingUtilization}
        ok={stability.bearingOk}
        percent
      />

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
    </div>
  );
}

function Divider() {
  return <div className="rw-divider" />;
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
