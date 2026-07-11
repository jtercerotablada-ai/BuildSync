'use client';

import React, { useMemo, useState } from 'react';
import type { UnitSystem } from '@/lib/beam/units';
import { fromSI, toSI, unitLabel } from '@/lib/beam/units';
import type {
  LoadGenInput, DesignCode, SiteData, StructureData, SnowData, SeismicData,
  RiskCategory, ExposureCategory, RoofType, Enclosure,
  SnowTerrain, RoofExposure, ThermalCondition, SeismicSystemPeriod,
  WindResult, SnowResult, SeismicResult,
} from '@/lib/load-gen/types';
import { DEFAULT_INPUT, solveLoads } from '@/lib/load-gen/solve';
import { SiteMap } from './SiteMap';
import { WindPressureDiagram } from './WindPressureDiagram';
import { SnowRoofDiagram } from './SnowRoofDiagram';
import { SeismicDiagram } from './SeismicDiagram';

type LoadTab = 'wind' | 'snow' | 'seismic';

const CODE_OPTIONS: Array<{ value: DesignCode; label: string; enabled: boolean }> = [
  { value: 'ASCE-7-22', label: 'ASCE 7-22 (US)', enabled: true },
  { value: 'ASCE-7-16', label: 'ASCE 7-16 (US)', enabled: false },
  { value: 'NBCC-2020', label: 'NBCC 2020 (Canada)', enabled: false },
  { value: 'EN-1991', label: 'EN 1991 (Europe)', enabled: false },
  { value: 'AS-NZS-1170', label: 'AS/NZS 1170 (AU/NZ)', enabled: false },
];

// ── length + force helpers (building dims in mm, seismic W in kN) ──
const useUnits = (units: UnitSystem) => ({
  lenU: units === 'imperial' ? 'ft' : 'm',
  mmToLen: (mm: number) => (units === 'imperial' ? mm / 304.8 : mm / 1000),
  lenToMm: (v: number) => (units === 'imperial' ? v * 304.8 : v * 1000),
});

export function LoadGenerator() {
  const [input, setInput] = useState<LoadGenInput>(DEFAULT_INPUT);
  const [units, setUnits] = useState<UnitSystem>('imperial');
  const [tab, setTab] = useState<LoadTab>('wind');

  const res = useMemo(() => solveLoads(input), [input]);

  const setSite = (s: SiteData) => setInput({ ...input, site: s });
  const setStruct = (s: StructureData) => setInput({ ...input, structure: s });
  const setSnow = (s: SnowData) => setInput({ ...input, snow: s });
  const setSeismic = (s: SeismicData) => setInput({ ...input, seismic: s });

  return (
    <div className="stl abx">
      <div className="stl-sheethead">
        <div>
          <div className="stl-brand">TERCERO TABLADA</div>
          <div className="stl-brand-sub">Civil &amp; Structural Engineering Inc.</div>
        </div>
        <div className="stl-sheettitle">
          <strong>LOAD GENERATOR</strong>
          <span className="stl-code">ASCE 7-22 · WIND · SNOW · SEISMIC</span>
        </div>
      </div>

      {/* control bar */}
      <div className="abx-controls">
        <div className="abx-ctrlbar">
          <label className="abx-ctrl">
            <span>Design code</span>
            <select
              style={{ width: 168 }}
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
          <label className="abx-ctrl">
            <span>Risk category</span>
            <select
              style={{ width: 150 }}
              value={input.site.riskCategory}
              onChange={(e) => setSite({ ...input.site, riskCategory: e.target.value as RiskCategory })}
            >
              <option value="I">I — Low hazard</option>
              <option value="II">II — Standard</option>
              <option value="III">III — Substantial</option>
              <option value="IV">IV — Essential</option>
            </select>
          </label>
          <div className="abx-ctrl">
            <span>Units</span>
            <div className="stl-seg" style={{ margin: 0 }}>
              <button type="button" className={units === 'imperial' ? 'is-active' : ''} onClick={() => setUnits('imperial')}>US</button>
              <button type="button" className={units === 'metric' ? 'is-active' : ''} onClick={() => setUnits('metric')}>SI</button>
            </div>
          </div>
          <div className="abx-ctrl">
            <span>&nbsp;</span>
            <button type="button" className="stl-add" style={{ width: 'auto', margin: 0, padding: '0.42rem 0.8rem' }} onClick={() => setInput(DEFAULT_INPUT)}>Reset</button>
          </div>
        </div>
      </div>

      {/* load-type tabs */}
      <div className="stl-seg abx-tabs" role="tablist">
        {([['wind', 'Wind'], ['snow', 'Snow'], ['seismic', 'Seismic']] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'wind' && <WindTab input={input} units={units} onSite={setSite} onStruct={setStruct} result={res.wind} />}
      {tab === 'snow' && <SnowTab snow={input.snow} risk={input.site.riskCategory} structure={input.structure} units={units} onChange={setSnow} result={res.snow} />}
      {tab === 'seismic' && <SeismicTab seismic={input.seismic} risk={input.site.riskCategory} units={units} onChange={setSeismic} result={res.seismic} />}

      <p className="stl-disclaimer">
        ASCE 7-22 wind (Ch. 26/27/30, Directional MWFRS + low-rise Components &amp; Cladding), snow (Ch. 7) and seismic
        Equivalent Lateral Force (Ch. 11–12). Ground snow pg and mapped spectral accelerations Ss / S1 are site-specific —
        obtain them from the ASCE 7 Hazard Tool for the project location. Results are preliminary design aids; a licensed
        P.E. must verify all governing load combinations, site-specific ground-motion requirements (§11.4.8) and
        irregularity/redundancy provisions before use.
      </p>
    </div>
  );
}

/* ═══════════════════════ WIND ═══════════════════════ */
function WindTab({ input, units, onSite, onStruct, result }: {
  input: LoadGenInput; units: UnitSystem; onSite: (s: SiteData) => void; onStruct: (s: StructureData) => void; result: WindResult | null;
}) {
  const site = input.site, structure = input.structure;
  const { lenU, mmToLen, lenToMm } = useUnits(units);
  const velU = unitLabel('velocity', units);
  const [query, setQuery] = useState(site.location?.formattedAddress ?? '');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<'break' | 'mwfrs' | 'cc'>('mwfrs');

  const lookup = async () => {
    if (!query.trim()) return;
    setLoading(true); setErr(null);
    try {
      const g = await fetch('/api/load-gen/geocode', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: query }) }).then((r) => (r.ok ? r.json() : Promise.reject(r.json())));
      const e = await fetch('/api/load-gen/elevation', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lat: g.lat, lng: g.lng }) }).then((r) => r.json()).catch(() => ({ elevation_m: 0 }));
      const w = await fetch('/api/load-gen/wind-hazard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lat: g.lat, lng: g.lng, riskCategory: site.riskCategory }) }).then((r) => r.json());
      onSite({ ...site, location: { lat: g.lat, lng: g.lng, formattedAddress: g.formattedAddress, elevation: e.elevation_m ?? 0 }, V: w.V, V_source: w.source === 'ATC' ? 'ATC' : 'interpolated' });
      setQuery(g.formattedAddress);
    } catch {
      setErr('Address lookup unavailable — enter the design wind speed manually.');
    } finally { setLoading(false); }
  };

  const setS = <K extends keyof StructureData>(k: K, v: StructureData[K]) => onStruct({ ...structure, [k]: v });

  return (
    <div className="stl-grid">
      <div className="stl-inputs">
        <div className="stl-h">Site</div>
        <div className="stl-field">
          <label>Project address</label>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input placeholder="10465 SW 174th Terrace, Miami FL" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') lookup(); }} />
            <button type="button" className="stl-add" style={{ width: 'auto', margin: 0, padding: '0 0.8rem', whiteSpace: 'nowrap' }} onClick={lookup} disabled={loading}>{loading ? '…' : 'Look up'}</button>
          </div>
          {err && <span className="stl-hint" style={{ color: '#b0322a' }}>{err}</span>}
          {site.location && <span className="stl-hint">lat {site.location.lat.toFixed(4)}, lng {site.location.lng.toFixed(4)} · elev {mmToLen(site.location.elevation * 1000).toFixed(0)} {lenU}</span>}
        </div>
        <SelField label="Exposure category" value={site.exposure} onChange={(v) => onSite({ ...site, exposure: v as ExposureCategory })}
          options={[['B', 'B — Urban / suburban'], ['C', 'C — Open terrain'], ['D', 'D — Flat unobstructed']]} />
        <div className="stl-row2">
          <NumField label={`V (3-s gust)`} unit={velU} value={fromSI(site.V, 'velocity', units)} step={1} onChange={(v) => onSite({ ...site, V: toSI(v, 'velocity', units), V_source: 'manual' })} />
          <div className="stl-field"><label>Source</label><input value={site.V_source.toUpperCase()} readOnly style={{ color: 'var(--lux-muted)' }} /></div>
        </div>

        <div className="stl-h">Building geometry</div>
        <div className="stl-row2">
          <NumField label="Mean roof height H" unit={lenU} value={mmToLen(structure.H)} step={1} onChange={(v) => setS('H', lenToMm(v))} />
          <NumField label="Length L (along wind)" unit={lenU} value={mmToLen(structure.L)} step={1} onChange={(v) => setS('L', lenToMm(v))} />
        </div>
        <div className="stl-row2">
          <NumField label="Width B (across wind)" unit={lenU} value={mmToLen(structure.B)} step={1} onChange={(v) => setS('B', lenToMm(v))} />
          <NumField label="Roof slope θ" unit="°" value={structure.roofSlope} step={1} onChange={(v) => setS('roofSlope', v)} />
        </div>
        <SelField label="Roof type" value={structure.roofType} onChange={(v) => setS('roofType', v as RoofType)}
          options={[['flat', 'Flat (< 7°)'], ['gable', 'Gable'], ['hip', 'Hip'], ['monoslope', 'Monoslope']]} />

        <div className="stl-h">Enclosure &amp; factors</div>
        <div className="stl-field"><label>Enclosure classification</label>
          <div className="stl-seg" style={{ margin: 0 }}>
            {(['enclosed', 'partially-enclosed', 'open'] as Enclosure[]).map((e) => (
              <button key={e} type="button" className={structure.enclosure === e ? 'is-active' : ''} onClick={() => setS('enclosure', e)}>{e === 'partially-enclosed' ? 'Partial' : e[0].toUpperCase() + e.slice(1)}</button>
            ))}
          </div>
        </div>
        <div className="stl-row2">
          <NumField label="Kd (§26.6-1)" value={structure.Kd} step={0.01} onChange={(v) => setS('Kd', v || 0.85)} />
          <NumField label="Kzt (§26.8)" value={structure.Kzt} step={0.05} onChange={(v) => setS('Kzt', v || 1)} />
        </div>
      </div>

      <div>
        <div className="stl-card stl-card--pmblock">
          <h4>Site <span className="stl-tag">location</span></h4>
          <div style={{ height: 190, overflow: 'hidden', border: '1px solid var(--lux-line-soft)' }}><SiteMap location={site.location} /></div>
        </div>
        <div className="stl-card stl-card--pmblock">
          <h4>Building model <span className="stl-tag">MWFRS pressures · 3D</span></h4>
          <WindPressureDiagram structure={structure} result={result} unitSystem={units} />
        </div>
        <WindResults result={result} units={units} view={view} setView={setView} />
      </div>
    </div>
  );
}

function WindResults({ result, units, view, setView }: { result: WindResult | null; units: UnitSystem; view: 'break' | 'mwfrs' | 'cc'; setView: (v: 'break' | 'mwfrs' | 'cc') => void }) {
  const pu = unitLabel('pressureSmall', units);
  const fp = (pa: number) => `${fromSI(pa, 'pressureSmall', units).toFixed(1)} ${pu}`;
  const { lenU, mmToLen } = useUnits(units);
  if (!result) return <div className="stl-card"><p className="stl-note">Enter site + building data to compute wind pressures.</p></div>;
  return (
    <div className="stl-card">
      <h4>Wind results <span className="stl-tag">ASCE 7-22 · Ch. 27 / 30</span></h4>
      <div className="stl-seg stl-seg--mini">
        {([['break', 'Velocity'], ['mwfrs', 'MWFRS'], ['cc', 'C&C']] as const).map(([k, l]) => (
          <button key={k} type="button" className={view === k ? 'is-active' : ''} onClick={() => setView(k)}>{l}</button>
        ))}
      </div>
      {view === 'break' && (
        <table className="stl-table"><tbody>
          <Row k="Kz / Kh" v={result.breakdown.Kz.toFixed(3)} />
          <Row k="Kzt" v={result.breakdown.Kzt.toFixed(2)} />
          <Row k="Kd" v={result.breakdown.Kd.toFixed(2)} />
          <Row k="Ke (elevation)" v={result.breakdown.Ke.toFixed(3)} />
          <Row k="qh (velocity pressure)" v={<strong>{fp(result.breakdown.qh)}</strong>} />
        </tbody></table>
      )}
      {view === 'mwfrs' && (
        <table className="stl-table"><tbody>
          <Row k="G (gust factor)" v={result.mwfrs.G.toFixed(2)} />
          <Row k="GCpi (±)" v={`${result.mwfrs.walls.GCpi_pos.toFixed(2)} / ${result.mwfrs.walls.GCpi_neg.toFixed(2)}`} />
          <Row k="Windward wall" v={<strong>{fp(result.mwfrs.walls.windwardDesign)}</strong>} />
          <Row k="Leeward wall" v={<strong>{fp(result.mwfrs.walls.leewardDesign)}</strong>} />
          <Row k="Side wall" v={<strong>{fp(result.mwfrs.walls.sideDesign)}</strong>} />
          {result.mwfrs.roof.map((r) => <Row key={r.zone} k={`${r.zone} (Cp ${r.Cp.toFixed(2)})`} v={fp(r.p)} />)}
        </tbody></table>
      )}
      {view === 'cc' && (
        <table className="stl-table"><tbody>
          <Row k="Zone width a" v={`${mmToLen(result.cc.a).toFixed(2)} ${lenU}`} />
          <tr><td colSpan={3} className="stl-note--head">Walls (+ / −), Aeff = 10 ft²</td></tr>
          {result.cc.walls.map((z) => <Row key={z.label} k={z.label} v={`${fp(z.p_pos)} / ${fp(z.p_neg)}`} />)}
          <tr><td colSpan={3} className="stl-note--head">Roof (+ / −)</td></tr>
          {result.cc.roof.map((z) => <Row key={z.label} k={z.label} v={`${fp(z.p_pos)} / ${fp(z.p_neg)}`} />)}
        </tbody></table>
      )}
      <Issues issues={result.issues} errors={result.errors} />
    </div>
  );
}

/* ═══════════════════════ SNOW ═══════════════════════ */
function SnowTab({ snow, risk, structure, units, onChange, result }: { snow: SnowData; risk: RiskCategory; structure: StructureData; units: UnitSystem; onChange: (s: SnowData) => void; result: SnowResult | null }) {
  const pu = unitLabel('pressureSmall', units);
  const { lenU, mmToLen, lenToMm } = useUnits(units);
  const fp = (pa: number) => `${fromSI(pa, 'pressureSmall', units).toFixed(1)} ${pu}`;
  const set = <K extends keyof SnowData>(k: K, v: SnowData[K]) => onChange({ ...snow, [k]: v });
  return (
    <div className="stl-grid">
      <div className="stl-inputs">
        <div className="stl-h">Ground snow</div>
        <NumField label="Ground snow pg (ultimate)" unit={pu} value={fromSI(snow.pg, 'pressureSmall', units)} step={1} onChange={(v) => set('pg', toSI(v, 'pressureSmall', units))} />
        <span className="stl-hint">Ultimate, Risk-Category-{risk}-specific pg from the ASCE 7-22 Hazard Tool. In 7-22 the importance factor Is is removed — risk is carried in pg.</span>

        <div className="stl-h">Roof condition</div>
        <SelField label="Terrain category" value={snow.terrain} onChange={(v) => set('terrain', v as SnowTerrain)}
          options={[['B', 'B — Urban / suburban'], ['C', 'C — Open terrain'], ['D', 'D — Flat unobstructed'], ['above-treeline', 'Above treeline'], ['alaska-no-trees', 'Alaska, no trees']]} />
        <SelField label="Roof exposure" value={snow.roofExposure} onChange={(v) => set('roofExposure', v as RoofExposure)}
          options={[['fully-exposed', 'Fully exposed'], ['partially-exposed', 'Partially exposed'], ['sheltered', 'Sheltered']]} />
        <SelField label="Thermal condition" value={snow.thermal} onChange={(v) => set('thermal', v as ThermalCondition)}
          options={[['heated', 'Heated — all other (Ct 1.0)'], ['heated-unventilated', 'Heated, unventilated roof (7.3-3)'], ['cold-ventilated', 'Cold / ventilated roof (1.2)'], ['unheated', 'Unheated / open-air (1.2)'], ['below-freezing', 'Kept below freezing (1.3)'], ['greenhouse', 'Heated greenhouse (0.85)']]} />
        {snow.thermal === 'heated-unventilated' && (
          <NumField label="Roof R-value" unit="h·ft²·°F/Btu" value={snow.roofR} step={5} onChange={(v) => set('roofR', v)} />
        )}

        <div className="stl-h">Roof geometry</div>
        <div className="stl-row2">
          <NumField label="Roof slope θ" unit="°" value={snow.roofSlope} step={1} onChange={(v) => set('roofSlope', v)} />
          <NumField label="Eave-to-ridge W" unit={lenU} value={mmToLen(snow.eaveToRidge)} step={1} onChange={(v) => set('eaveToRidge', lenToMm(v))} />
        </div>
        <label className="abx-ctrl abx-ctrl--check" style={{ paddingTop: '0.4rem' }}>
          <input type="checkbox" checked={snow.slippery} onChange={(e) => set('slippery', e.target.checked)} />
          <span>Unobstructed slippery surface (metal / membrane / glass)</span>
        </label>
      </div>

      <div>
        <div className="stl-card stl-card--pmblock">
          <h4>Building model <span className="stl-tag">balanced snow · 3D</span></h4>
          <SnowRoofDiagram result={result} structure={structure} roofSlope={snow.roofSlope} unitSystem={units} />
        </div>
        <div className="stl-cards">
          <div className="stl-card">
            <h4>Factors <span className="stl-tag">Ch. 7</span></h4>
            {result ? (
              <table className="stl-table"><tbody>
                <Row k="Ce (exposure, 7.3-1)" v={result.Ce.toFixed(2)} />
                <Row k="Ct (thermal, 7.3-2)" v={result.Ct.toFixed(2)} />
                <Row k="Cs (slope, 7.4-1)" v={result.Cs.toFixed(3)} />
              </tbody></table>
            ) : <p className="stl-note">—</p>}
          </div>
          <div className="stl-card">
            <h4>Snow loads <span className="stl-tag">psf / Pa</span></h4>
            {result ? (
              <table className="stl-table"><tbody>
                <Row k="pf — flat roof (7.3-1)" v={fp(result.pf)} />
                {result.rainOnSnow > 0 && <Row k="Rain-on-snow (7.10)" v={`+${fp(result.rainOnSnow)}`} />}
                <Row k="ps — sloped balanced (7.4)" v={fp(result.ps)} />
                <Row k="pm — minimum (7.3.3)" v={fp(result.pm)} />
                <Row k="Governing balanced" v={<strong>{fp(result.governing)}{result.minimumGoverns ? ' (min)' : ''}</strong>} />
              </tbody></table>
            ) : <p className="stl-note">—</p>}
          </div>
        </div>
        {result && <div className="stl-card" style={{ marginTop: '1rem' }}><Issues issues={result.issues} errors={result.errors} /></div>}
      </div>
    </div>
  );
}

/* ═══════════════════════ SEISMIC ═══════════════════════ */
function SeismicTab({ seismic, risk, units, onChange, result }: { seismic: SeismicData; risk: RiskCategory; units: UnitSystem; onChange: (s: SeismicData) => void; result: SeismicResult | null }) {
  const forceU = unitLabel('force', units);
  const { lenU, mmToLen, lenToMm } = useUnits(units);
  const ff = (kn: number) => `${fromSI(kn, 'force', units).toFixed(1)} ${forceU}`;
  const set = <K extends keyof SeismicData>(k: K, v: SeismicData[K]) => onChange({ ...seismic, [k]: v });
  return (
    <div className="stl-grid">
      <div className="stl-inputs">
        <div className="stl-h">Design ground motion</div>
        <div className="stl-row2">
          <NumField label="SDS (short-period)" unit="g" value={seismic.SDS} step={0.05} onChange={(v) => set('SDS', v)} />
          <NumField label="SD1 (1-s period)" unit="g" value={seismic.SD1} step={0.02} onChange={(v) => set('SD1', v)} />
        </div>
        <span className="stl-hint">ASCE 7-22 takes SDS / SD1 directly from the USGS Hazard Tool for the site class (Fa/Fv tables were removed). Risk category {risk} sets Ie.</span>
        <div className="stl-row2">
          <NumField label="S1 (mapped, at BC)" unit="g" value={seismic.S1} step={0.02} onChange={(v) => set('S1', v)} />
          <NumField label="TL (long-period)" unit="s" value={seismic.TL} step={1} onChange={(v) => set('TL', v || 8)} />
        </div>

        <div className="stl-h">Structural system</div>
        <SelField label="System (for period Ta)" value={seismic.systemPeriod} onChange={(v) => set('systemPeriod', v as SeismicSystemPeriod)}
          options={[['steel-moment', 'Steel moment frame'], ['concrete-moment', 'Concrete moment frame'], ['steel-ebf', 'Steel EBF'], ['steel-brb', 'Steel BRB frame'], ['other', 'All other systems']]} />
        <div className="stl-row2">
          <NumField label="R (Table 12.2-1)" value={seismic.R} step={0.5} onChange={(v) => set('R', v || 1)} />
          <NumField label="Height hn" unit={lenU} value={mmToLen(seismic.hn)} step={1} onChange={(v) => set('hn', lenToMm(v))} />
        </div>
        <div className="stl-row2">
          <NumField label="Seismic weight W" unit={forceU} value={fromSI(seismic.W, 'force', units)} step={10} onChange={(v) => set('W', toSI(v, 'force', units))} />
          <NumField label="Stories N" value={seismic.stories} step={1} onChange={(v) => set('stories', Math.max(1, Math.round(v)))} />
        </div>
      </div>

      <div>
        <div className="stl-card stl-card--pmblock">
          <h4>Building model <span className="stl-tag">story forces · V · 3D</span></h4>
          <SeismicDiagram result={result} unitSystem={units} />
        </div>
        <div className="stl-cards">
          <div className="stl-card">
            <h4>Design spectrum <span className="stl-tag">§11.4</span></h4>
            {result ? (
              <table className="stl-table"><tbody>
                <Row k="SMS / SM1 (= 1.5×SD)" v={`${result.SMS.toFixed(3)} / ${result.SM1.toFixed(3)}`} />
                <Row k="SDS" v={<strong>{result.SDS.toFixed(3)} g</strong>} />
                <Row k="SD1" v={<strong>{result.SD1.toFixed(3)} g</strong>} />
                <Row k="Ts = SD1/SDS" v={`${result.Ts.toFixed(3)} s`} />
                <Row k="Ie / SDC" v={<><strong>{result.Ie.toFixed(2)}</strong> / <span className="stl-cls stl-cls--noncompact">{result.SDC}</span></>} />
              </tbody></table>
            ) : <p className="stl-note">—</p>}
          </div>
          <div className="stl-card">
            <h4>Base shear <span className="stl-tag">ELF · §12.8</span></h4>
            {result ? (
              <table className="stl-table"><tbody>
                <Row k="Ta (approx. period)" v={`${result.Ta.toFixed(3)} s`} />
                <Row k="Cs" v={<strong>{result.Cs.toFixed(4)}</strong>} ref={result.CsControl} />
                <Row k="k (distribution exp.)" v={result.k.toFixed(2)} />
                <Row k="V — base shear" v={<strong>{ff(result.V)}</strong>} />
              </tbody></table>
            ) : <p className="stl-note">—</p>}
          </div>
        </div>
        {result && result.forces.length > 0 && (
          <div className="stl-card" style={{ marginTop: '1rem' }}>
            <h4>Story forces <span className="stl-tag">Fx / Vx</span></h4>
            <div className="abx-tablewrap"><table className="abx-table"><thead><tr><th>Level</th><th>hx ({lenU})</th><th>Cvx</th><th>Fx ({forceU})</th><th>Vx ({forceU})</th></tr></thead><tbody>
              {result.forces.map((f) => (
                <tr key={f.level}>
                  <td className="abx-lbl">{f.level}</td>
                  <td className="abx-mono">{mmToLen(f.hx).toFixed(1)}</td>
                  <td className="abx-mono">{f.Cvx.toFixed(3)}</td>
                  <td className="abx-mono">{fromSI(f.Fx, 'force', units).toFixed(1)}</td>
                  <td className="abx-mono">{fromSI(f.Vx, 'force', units).toFixed(1)}</td>
                </tr>
              ))}
            </tbody></table></div>
          </div>
        )}
        {result && <div className="stl-card" style={{ marginTop: '1rem' }}><Issues issues={result.issues} errors={result.errors} /></div>}
      </div>
    </div>
  );
}

/* ═══════════════════════ shared UI ═══════════════════════ */
function NumField({ label, unit, value, step = 1, onChange }: { label: string; unit?: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="stl-field">
      <label>{label}{unit ? <span className="stl-unit"> ({unit})</span> : null}</label>
      <input type="number" step={step} value={Number.isFinite(value) ? Math.round(value * 1000) / 1000 : ''} onChange={(e) => { const v = parseFloat(e.target.value); onChange(Number.isFinite(v) ? v : 0); }} />
    </label>
  );
}
function SelField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="stl-field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </label>
  );
}
function Row({ k, v, ref: refText }: { k: string; v: React.ReactNode; ref?: string }) {
  return <tr><td className="stl-k">{k}</td><td className="stl-v">{v}</td><td className="stl-ref">{refText}</td></tr>;
}
function Issues({ issues, errors }: { issues: string[]; errors: string[] }) {
  if (!issues.length && !errors.length) return null;
  return (
    <div className="abx-warnings" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
      {errors.map((e, i) => <div key={`e${i}`} className="abx-warning" style={{ borderLeftColor: '#b0322a', background: 'rgba(176,50,42,0.06)', color: '#8a1c1c' }}>⚠ {e}</div>)}
      {issues.map((m, i) => <div key={`i${i}`} className="abx-warning">{m}</div>)}
    </div>
  );
}
