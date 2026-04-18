'use client';

import React, { useState } from 'react';
import type { SiteData, RiskCategory, ExposureCategory, SiteClass } from '@/lib/load-gen/types';
import type { UnitSystem } from '@/lib/beam/units';
import { fromSI, toSI, unitLabel } from '@/lib/beam/units';

interface Props {
  site: SiteData;
  unitSystem: UnitSystem;
  onChange: (s: SiteData) => void;
}

export function SiteDataPanel({ site, unitSystem, onChange }: Props) {
  const [query, setQuery] = useState(site.location?.formattedAddress ?? '');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const velocityU = unitLabel('velocity', unitSystem);
  const dimU = unitLabel('dimension', unitSystem);

  const lookupAddress = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const g = await fetch('/api/load-gen/geocode', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: query }),
      }).then(r => r.ok ? r.json() : Promise.reject(r.json()));
      const e = await fetch('/api/load-gen/elevation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lat: g.lat, lng: g.lng }),
      }).then(r => r.json()).catch(() => ({ elevation_m: 0 }));
      const w = await fetch('/api/load-gen/wind-hazard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lat: g.lat, lng: g.lng, riskCategory: site.riskCategory }),
      }).then(r => r.json());
      onChange({
        ...site,
        location: {
          lat: g.lat,
          lng: g.lng,
          formattedAddress: g.formattedAddress,
          elevation: e.elevation_m ?? 0,
        },
        V: w.V,
        V_source: w.source === 'ATC' ? 'ATC' : 'interpolated',
      });
      setQuery(g.formattedAddress);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message
        : typeof e === 'object' && e !== null && 'then' in e
          ? await (e as Promise<{ error?: string }>).then(x => x?.error ?? 'lookup failed')
          : 'lookup failed';
      setErr(typeof msg === 'string' ? msg : 'lookup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lg-panel">
      <h3 className="lg-panel__title">Site Data</h3>
      <div className="lg-field">
        <span className="lg-field__label">Project Address</span>
        <div className="lg-addr">
          <input
            className="lg-field__input"
            placeholder="10465 SW 174th Terrace, Miami, FL"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') lookupAddress(); }}
          />
          <button className="btn btn--primary" onClick={lookupAddress} disabled={loading}>
            {loading ? '…' : 'Look up'}
          </button>
        </div>
        {err && <div className="lg-field__error">{err}</div>}
        {site.location && (
          <div className="lg-field__meta">
            lat {site.location.lat.toFixed(4)}, lng {site.location.lng.toFixed(4)} · elev{' '}
            {fromSI(site.location.elevation * 1000, 'dimension', unitSystem).toFixed(0)}{' '}
            {dimU}
          </div>
        )}
      </div>

      <div className="lg-panel__section">
        <div className="lg-panel__subtitle">Classification</div>
        <div className="lg-fields">
          <label className="lg-field">
            <span className="lg-field__label">Risk Category</span>
            <select
              className="lg-field__input"
              value={site.riskCategory}
              onChange={(e) => onChange({ ...site, riskCategory: e.target.value as RiskCategory })}
            >
              <option value="I">I — Low hazard</option>
              <option value="II">II — Standard</option>
              <option value="III">III — Substantial</option>
              <option value="IV">IV — Essential</option>
            </select>
          </label>
          <label className="lg-field">
            <span className="lg-field__label">Exposure</span>
            <select
              className="lg-field__input"
              value={site.exposure}
              onChange={(e) => onChange({ ...site, exposure: e.target.value as ExposureCategory })}
            >
              <option value="B">B — Urban / suburban</option>
              <option value="C">C — Open terrain</option>
              <option value="D">D — Flat unobstructed</option>
            </select>
          </label>
          <label className="lg-field">
            <span className="lg-field__label">Site Class</span>
            <select
              className="lg-field__input"
              value={site.siteClass}
              onChange={(e) => onChange({ ...site, siteClass: e.target.value as SiteClass })}
            >
              <option value="Default">Default</option>
              <option value="A">A — Hard rock</option>
              <option value="B">B — Rock</option>
              <option value="C">C — Very dense soil</option>
              <option value="D">D — Stiff soil</option>
              <option value="E">E — Soft soil</option>
              <option value="F">F — Site-specific</option>
            </select>
          </label>
        </div>
      </div>

      <div className="lg-panel__section">
        <div className="lg-panel__subtitle">Design Wind Speed</div>
        <div className="lg-fields">
          <label className="lg-field">
            <span className="lg-field__label">V ({velocityU}) — 3-second gust</span>
            <input
              type="number"
              className="lg-field__input"
              value={Math.round(fromSI(site.V, 'velocity', unitSystem) * 10) / 10}
              step="any"
              onChange={(e) =>
                onChange({
                  ...site,
                  V: toSI(parseFloat(e.target.value) || 0, 'velocity', unitSystem),
                  V_source: 'manual',
                })
              }
            />
          </label>
          <div className="lg-field">
            <span className="lg-field__label">Source</span>
            <div className="lg-field__pill">{site.V_source.toUpperCase()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
