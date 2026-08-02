'use client';

import React, { useMemo, useState } from 'react';
import {
  MapPin, Building2, ShieldCheck, SlidersHorizontal, CloudSnow, Home, Layers, Link2, Activity,
  Wind, Mountain, Gauge, ChevronDown, CheckCircle2, AlertTriangle, XCircle, Info,
  RotateCcw, Save, Upload, Share2, MoreVertical, FileDown, FileText, Copy, Printer,
} from 'lucide-react';
import type { UnitSystem } from '@/lib/beam/units';
import { fromSI, toSI, unitLabel } from '@/lib/beam/units';
import type {
  LoadGenInput, DesignCode, SiteData, StructureData, SnowData, SeismicData,
  RiskCategory, ExposureCategory, SiteClass, RoofType, Enclosure,
  SnowTerrain, RoofExposure, ThermalCondition, SeismicSystemPeriod,
  TopoFeature, GustMode,
  WindResult, SnowResult, SeismicResult,
} from '@/lib/load-gen/types';
import { DEFAULT_INPUT, solveLoads } from '@/lib/load-gen/solve';
import { cpWall } from '@/lib/load-gen/asce7-22-wind';
import { combosLRFD, combosASD, type ComboLine } from '@/lib/load-gen/asce7-22-combos';
import { SiteMap } from './SiteMap';
import { WindPressureDiagram } from './WindPressureDiagram';
import { SnowRoofDiagram } from './SnowRoofDiagram';
import { SeismicDiagram } from './SeismicDiagram';

type LoadTab = 'wind' | 'snow' | 'seismic' | 'combos';

const CODE_OPTIONS: Array<{ value: DesignCode; label: string; enabled: boolean }> = [
  { value: 'ASCE-7-22', label: 'ASCE 7-22 (US)', enabled: true },
  { value: 'ASCE-7-16', label: 'ASCE 7-16 (US)', enabled: false },
  { value: 'NBCC-2020', label: 'NBCC 2020 (Canada)', enabled: false },
  { value: 'EN-1991', label: 'EN 1991 (Europe)', enabled: false },
  { value: 'AS-NZS-1170', label: 'AS/NZS 1170 (AU/NZ)', enabled: false },
];
const EXPO_LABEL: Record<ExposureCategory, string> = { B: 'B — Urban / suburban', C: 'C — Open terrain', D: 'D — Flat unobstructed' };
const ENCL_LABEL: Record<Enclosure, string> = { enclosed: 'Enclosed', 'partially-enclosed': 'Partially enclosed', open: 'Open' };
const IMPORTANCE: Record<RiskCategory, number> = { I: 0.87, II: 1.0, III: 1.15, IV: 1.15 };

const useUnits = (units: UnitSystem) => ({
  lenU: units === 'imperial' ? 'ft' : 'm',
  mmToLen: (mm: number) => (units === 'imperial' ? mm / 304.8 : mm / 1000),
  lenToMm: (v: number) => (units === 'imperial' ? v * 304.8 : v * 1000),
});

function download(name: string, content: string, type: string) {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function LoadGenerator() {
  const [input, setInput] = useState<LoadGenInput>(DEFAULT_INPUT);
  const [units, setUnits] = useState<UnitSystem>('imperial');
  const [tab, setTab] = useState<LoadTab>('wind');
  const [menu, setMenu] = useState<null | 'export' | 'share' | 'kebab'>(null);

  const res = useMemo(() => solveLoads(input), [input]);

  // functional updates: a field edit made while an async USGS refetch is in flight must not clobber the newer state
  const setSite = (s: SiteData) => setInput((cur) => ({ ...cur, site: s }));
  const setStruct = (s: StructureData) => setInput((cur) => ({ ...cur, structure: s }));
  const setSnow = (s: SnowData) => setInput((cur) => ({ ...cur, snow: s }));
  const setSeismic = (s: SeismicData) => setInput((cur) => ({ ...cur, seismic: s }));

  const doPrint = () => { setMenu(null); if (typeof window !== 'undefined') window.print(); };
  const saveJson = () => { setMenu(null); download('load-gen-inputs.json', JSON.stringify(input, null, 2), 'application/json'); };
  const copyLink = () => { setMenu(null); if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(window.location.href).catch(() => {}); };
  const exportCsv = () => {
    setMenu(null);
    const w = res.wind; if (!w) return;
    const psf = (pa: number) => (pa * 0.0208854).toFixed(2);
    const cpw = cpWall(input.structure.L / Math.max(input.structure.B, 1));
    const lines = ['Surface,Zone,Cp,Net Pressure (psf)'];
    lines.push(`Windward Wall,Wall,${cpw.windward.toFixed(2)},${psf(w.mwfrs.walls.windwardDesign)}`);
    lines.push(`Leeward Wall,Wall,${cpw.leeward.toFixed(2)},${psf(w.mwfrs.walls.leewardDesign)}`);
    lines.push(`Side Wall,Wall,${cpw.side.toFixed(2)},${psf(w.mwfrs.walls.sideDesign)}`);
    w.mwfrs.roof.forEach((r) => lines.push(`Roof,${r.zone},${r.Cp.toFixed(2)},${psf(r.p)}`));
    download('wind-pressures.csv', lines.join('\n'), 'text/csv');
  };

  return (
    <div className="stl lg-cockpit">
      {/* toolbar */}
      <div className="lg-bar">
        <div className="lg-bar__group">
          <label className="lg-bar__field">
            <span>Design code</span>
            <select value={input.code} onChange={(e) => setInput({ ...input, code: e.target.value as DesignCode })}>
              {CODE_OPTIONS.map((c) => <option key={c.value} value={c.value} disabled={!c.enabled}>{c.label}{c.enabled ? '' : ' — soon'}</option>)}
            </select>
          </label>
          <label className="lg-bar__field">
            <span>Risk category</span>
            <select value={input.site.riskCategory} onChange={(e) => setSite({ ...input.site, riskCategory: e.target.value as RiskCategory })}>
              <option value="I">I — Low hazard</option>
              <option value="II">II — Standard</option>
              <option value="III">III — Substantial</option>
              <option value="IV">IV — Essential</option>
            </select>
          </label>
        </div>
        <div className="lg-bar__actions">
          <div className="stl-units"><span>Units</span>
            <div className="stl-seg" style={{ margin: 0 }}>
              <button type="button" className={units === 'imperial' ? 'is-active' : ''} onClick={() => setUnits('imperial')}>US</button>
              <button type="button" className={units === 'metric' ? 'is-active' : ''} onClick={() => setUnits('metric')}>SI</button>
            </div>
          </div>
          <button type="button" className="stl-btn lg-ibtn" onClick={() => setInput(DEFAULT_INPUT)}><RotateCcw size={13} /> Reset</button>
          <button type="button" className="stl-btn lg-ibtn" onClick={saveJson}><Save size={13} /> Save</button>
          <div className="lg-split">
            <button type="button" className="stl-btn lg-ibtn" onClick={doPrint}><Upload size={13} /> Export</button>
            <button type="button" className="stl-btn lg-split__caret" onClick={() => setMenu(menu === 'export' ? null : 'export')} aria-label="export options"><ChevronDown size={13} /></button>
            {menu === 'export' && <div className="lg-menu"><button onClick={doPrint}>Print / PDF</button><button onClick={exportCsv}>Download CSV</button><button onClick={saveJson}>Download JSON</button></div>}
          </div>
          <div className="lg-split">
            <button type="button" className="stl-btn stl-btn--primary lg-ibtn" onClick={doPrint}><Share2 size={13} /> Share / Print</button>
            <button type="button" className="stl-btn stl-btn--primary lg-split__caret" onClick={() => setMenu(menu === 'share' ? null : 'share')} aria-label="share options"><ChevronDown size={13} /></button>
            {menu === 'share' && <div className="lg-menu"><button onClick={doPrint}>Print</button><button onClick={copyLink}>Copy link</button></div>}
          </div>
          <div className="lg-split">
            <button type="button" className="stl-btn lg-kebab" onClick={() => setMenu(menu === 'kebab' ? null : 'kebab')} aria-label="more"><MoreVertical size={15} /></button>
            {menu === 'kebab' && <div className="lg-menu"><button onClick={() => { setMenu(null); setInput(DEFAULT_INPUT); }}>Reset all inputs</button><button onClick={saveJson}>Download inputs (JSON)</button></div>}
          </div>
        </div>
      </div>
      {menu && <div style={{ position: 'fixed', inset: 0, zIndex: 15 }} onClick={() => setMenu(null)} aria-hidden />}

      <div className="lg-tabs" role="tablist">
        {([['wind', 'Wind'], ['snow', 'Snow'], ['seismic', 'Seismic'], ['combos', 'Combinations']] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'wind' && <WindTab input={input} units={units} onSite={setSite} onStruct={setStruct} onSeismic={(patch) => setInput((cur) => ({ ...cur, seismic: { ...cur.seismic, ...patch } }))} result={res.wind} onGoCombos={() => setTab('combos')} onExportCsv={exportCsv} onPrint={doPrint} onSaveJson={saveJson} onCopyLink={copyLink} />}
      {tab === 'snow' && <SnowTab snow={input.snow} risk={input.site.riskCategory} structure={input.structure} units={units} onChange={setSnow} result={res.snow} />}
      {tab === 'seismic' && <SeismicTab seismic={input.seismic} site={input.site} units={units} onChange={setSeismic} onSite={setSite} result={res.seismic} />}
      {tab === 'combos' && <CombosTab S={res.snow?.governing ?? 0} SDS={res.seismic?.SDS ?? 0} units={units} />}
    </div>
  );
}

async function fetchUsgsSeismic(lat: number, lng: number, riskCategory: RiskCategory, siteClass: SiteClass): Promise<Partial<SeismicData>> {
  const r = await fetch('/api/load-gen/seismic-hazard', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lat, lng, riskCategory, siteClass }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? 'USGS lookup failed');
  const d = await r.json();
  const patch: Partial<SeismicData> = { SDS: d.sds, SD1: d.sd1, source: 'USGS' };
  if (typeof d.s1 === 'number') patch.S1 = d.s1;
  if (typeof d.tl === 'number') patch.TL = d.tl;
  return patch;
}

/* ═══════════════════════ WIND ═══════════════════════ */
function WindTab({ input, units, onSite, onStruct, onSeismic, result, onGoCombos, onExportCsv, onPrint, onSaveJson, onCopyLink }: {
  input: LoadGenInput; units: UnitSystem; onSite: (s: SiteData) => void; onStruct: (s: StructureData) => void; onSeismic: (patch: Partial<SeismicData>) => void; result: WindResult | null;
  onGoCombos: () => void; onExportCsv: () => void; onPrint: () => void; onSaveJson: () => void; onCopyLink: () => void;
}) {
  const site = input.site, structure = input.structure;
  const { lenU, mmToLen, lenToMm } = useUnits(units);
  const velU = unitLabel('velocity', units);
  const pu = unitLabel('pressureSmall', units);
  const disp = (pa: number) => fromSI(pa, 'pressureSmall', units);
  const fp = (pa: number) => `${disp(pa).toFixed(1)} ${pu}`;
  const [query, setQuery] = useState(site.location?.formattedAddress ?? '');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openOpt, setOpenOpt] = useState<'mwfrs' | 'cc' | 'combos' | null>('mwfrs');
  const [sortNet, setSortNet] = useState<null | 'asc' | 'desc'>(null);
  const [selRow, setSelRow] = useState<number | null>(null);

  const lookup = async () => {
    if (!query.trim()) return;
    setLoading(true); setErr(null);
    try {
      const g = await fetch('/api/load-gen/geocode', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: query }) }).then((r) => (r.ok ? r.json() : Promise.reject(r.json())));
      const e = await fetch('/api/load-gen/elevation', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lat: g.lat, lng: g.lng }) }).then((r) => r.json()).catch(() => ({ elevation_m: 0 }));
      const w = await fetch('/api/load-gen/wind-hazard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lat: g.lat, lng: g.lng, riskCategory: site.riskCategory }) }).then((r) => r.json());
      onSite({ ...site, location: { lat: g.lat, lng: g.lng, formattedAddress: g.formattedAddress, elevation: e.elevation_m ?? 0 }, V: w.V, V_source: w.source === 'ATC' ? 'ATC' : 'interpolated' });
      setQuery(g.formattedAddress);
      try { onSeismic(await fetchUsgsSeismic(g.lat, g.lng, site.riskCategory, site.siteClass)); } catch { /* seismic stays manual */ }
    } catch {
      setErr('Address lookup unavailable — enter the design wind speed manually.');
    } finally { setLoading(false); }
  };

  const setS = <K extends keyof StructureData>(k: K, v: StructureData[K]) => onStruct({ ...structure, [k]: v });

  const derived = useMemo(() => {
    if (!result) return null;
    const w = result.mwfrs, bd = result.breakdown;
    const cpw = cpWall(structure.L / Math.max(structure.B, 1));
    const qKdG = bd.qh * bd.Kd * w.G;
    const intP = bd.qh * bd.Kd * w.walls.GCpi_pos;
    const rows = [
      { surface: 'Windward Wall', dir: 'Windward', zone: 'Wall (Zone 4/5)', Cp: cpw.windward, ext: qKdG * cpw.windward, int: intP, net: w.walls.windwardDesign, ref: 'Fig 27.3-1' },
      { surface: 'Leeward Wall', dir: 'Leeward', zone: 'Wall', Cp: cpw.leeward, ext: qKdG * cpw.leeward, int: intP, net: w.walls.leewardDesign, ref: 'Fig 27.3-1' },
      { surface: 'Side Wall', dir: 'Side', zone: 'Wall', Cp: cpw.side, ext: qKdG * cpw.side, int: intP, net: w.walls.sideDesign, ref: 'Fig 27.3-1' },
      ...w.roof.map((r) => ({ surface: 'Roof', dir: 'Roof', zone: r.zone, Cp: r.Cp, ext: qKdG * r.Cp, int: intP, net: r.p, ref: 'Fig 27.3-1' })),
    ];
    let govIdx = 0;
    rows.forEach((r, i) => { if (Math.abs(r.net) > Math.abs(rows[govIdx].net)) govIdx = i; });
    const nets = rows.map((r) => r.net), cps = rows.map((r) => r.Cp);
    return {
      rows, govIdx, governing: rows[govIdx],
      netMin: Math.min(...nets), netMax: Math.max(...nets),
      cpMin: Math.min(...cps), cpMax: Math.max(...cps),
      qh: bd.qh, gcpi: w.walls.GCpi_pos, Kz: bd.Kz, Ke: bd.Ke, Kzt: bd.Kzt, G: w.G,
    };
  }, [result, structure.L, structure.B]);

  const complete = result && result.errors.length === 0;
  const I = IMPORTANCE[site.riskCategory];

  // dynamic input-scope checks (advisory)
  const checks: string[] = [];
  if (site.V_source === 'manual') checks.push('Design wind speed entered manually — verify against the ASCE 7 Hazard Tool mapped value.');
  if (mmToLen(structure.H) > (units === 'imperial' ? 60 : 18.3)) checks.push('Mean roof height exceeds 60 ft — confirm the Directional Procedure (Ch. 27) applies; low-rise C&C provisions differ.');
  if (structure.roofSlope > 45) checks.push('Roof slope exceeds 45° — outside the tabulated Cp coefficient range (Fig 27.3-1).');
  if (structure.enclosure === 'partially-enclosed') checks.push('Partially enclosed classification — internal pressure GCpi is increased to ±0.55.');
  if (structure.gustMode === 'flexible') checks.push('Flexible-building gust analysis selected — verify fundamental frequency n1 and damping β.');
  if (!site.location) checks.push('No address geocoded — wind speed, elevation (Ke) and seismic hazard are not site-verified.');

  const sortedRows = useMemo(() => {
    if (!derived) return [];
    if (!sortNet) return derived.rows.map((r, i) => ({ ...r, orig: i }));
    const arr = derived.rows.map((r, i) => ({ ...r, orig: i }));
    arr.sort((a, b) => (sortNet === 'asc' ? a.net - b.net : b.net - a.net));
    return arr;
  }, [derived, sortNet]);

  const notes = [
    `Design code: ASCE 7-22 · Risk Category ${site.riskCategory} · MWFRS Directional Procedure (Ch. 27) + Components & Cladding (Ch. 30).`,
    `Enclosure: ${ENCL_LABEL[structure.enclosure]} (GCpi = ±${derived?.gcpi.toFixed(2) ?? '0.18'}).`,
    `Gust-effect factor: ${structure.gustMode === 'default' ? '0.85 rigid (default)' : structure.gustMode === 'calculated' ? 'calculated rigid (Eq 26.11-6)' : 'flexible Gf (Eq 26.11-10)'}${result ? ` — G = ${result.mwfrs.G.toFixed(2)}` : ''}.`,
    `Topographic Kzt = ${(derived?.Kzt ?? structure.Kzt).toFixed(2)} (${structure.topo.feature === 'none' ? 'manual' : structure.topo.feature}) · Directionality Kd = ${structure.Kd.toFixed(2)} · Ground-elevation Ke = ${derived?.Ke.toFixed(3) ?? '—'}.`,
    `Units: ${units === 'imperial' ? 'US (mph, ft, psf)' : 'SI (m/s, m, Pa)'} · single velocity pressure qh at mean roof height, qi = qh (enclosed).`,
    'Preliminary design aid — a licensed P.E. must verify governing combinations before use.',
  ];

  const copyResults = () => {
    if (!derived || typeof navigator === 'undefined' || !navigator.clipboard) return;
    const lines = [
      'Wind Load Generator — ASCE 7-22',
      `Vult ${fromSI(site.V, 'velocity', units).toFixed(0)} ${velU} · Exposure ${site.exposure} · ${ENCL_LABEL[structure.enclosure]}`,
      `qz ${fp(derived.qh)} · GCpi ±${derived.gcpi.toFixed(2)} · G ${derived.G.toFixed(2)} · Kzt ${derived.Kzt.toFixed(2)} · Ke ${derived.Ke.toFixed(3)}`,
      `Governing ${derived.governing.surface === 'Roof' ? derived.governing.zone : derived.governing.surface}: ${fp(derived.governing.net)}`,
      ...derived.rows.map((r) => `${r.surface} (${r.zone}): Cp ${r.Cp.toFixed(2)}, net ${fp(r.net)}`),
    ];
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
  };

  return (
    <div className="stl-grid">
      {/* ── sidebar ── */}
      <aside className="stl-inputs lg-sidebar">
        <Step n={1} title="Site" icon={<MapPin size={14} />}>
          <div className="stl-field">
            <label>Project address</label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input placeholder="10465 SW 174th Terrace, Miami FL" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') lookup(); }} aria-label="Project address" />
              <button type="button" className="stl-add" style={{ width: 'auto', margin: 0, padding: '0 0.7rem', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }} onClick={lookup} disabled={loading}><MapPin size={13} />{loading ? '…' : 'Look up'}</button>
            </div>
            {err && <span className="stl-hint" style={{ color: '#b0322a' }}>{err}</span>}
          </div>
          <SelField label="Exposure category" tip="ASCE 7-22 §26.7 — surface roughness upwind of the site." value={site.exposure} onChange={(v) => onSite({ ...site, exposure: v as ExposureCategory })}
            options={[['B', 'B — Urban / suburban'], ['C', 'C — Open terrain'], ['D', 'D — Flat unobstructed']]} />
          <div className="stl-row2">
            <NumField label="Vult (3-s gust)" unit={velU} tip="Ultimate design wind speed (§26.5). Auto from the ASCE hazard map on address lookup, or manual." value={fromSI(site.V, 'velocity', units)} step={1} onChange={(v) => onSite({ ...site, V: toSI(v, 'velocity', units), V_source: 'manual' })} />
            <div className="stl-field"><label>Data source</label><input value={site.V_source === 'ATC' ? 'ASCE 7-22 (ATC)' : site.V_source === 'interpolated' ? 'ASCE 7-22 (interp.)' : 'Manual'} readOnly style={{ color: 'var(--lux-muted)' }} /></div>
          </div>
        </Step>

        <Step n={2} title="Building Geometry" icon={<Building2 size={14} />}>
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
        </Step>

        <Step n={3} title="Enclosure & Factors" icon={<ShieldCheck size={14} />}>
          <div className="stl-field"><label>Enclosure classification</label>
            <div className="stl-seg" style={{ margin: 0 }}>
              {(['enclosed', 'partially-enclosed', 'open'] as Enclosure[]).map((e) => (
                <button key={e} type="button" className={structure.enclosure === e ? 'is-active' : ''} onClick={() => setS('enclosure', e)}>{e === 'partially-enclosed' ? 'Partial' : e[0].toUpperCase() + e.slice(1)}</button>
              ))}
            </div>
          </div>
          <NumField label="Kd (directionality)" tip="Table 26.6-1. 0.85 for MWFRS of buildings — applied inside the pressure equations in 7-22." value={structure.Kd} step={0.01} onChange={(v) => setS('Kd', v || 0.85)} />
          <SelField label="Topographic feature (§26.8)" value={structure.topo.feature} onChange={(v) => setS('topo', { ...structure.topo, feature: v as TopoFeature })}
            options={[['none', 'None — Kzt manual'], ['ridge', '2-D ridge'], ['escarpment', '2-D escarpment'], ['hill', '3-D axisymmetric hill']]} />
          {structure.topo.feature === 'none' ? (
            <NumField label="Kzt (manual)" value={structure.Kzt} step={0.05} onChange={(v) => setS('Kzt', v || 1)} />
          ) : (
            <>
              <div className="stl-row2">
                <NumField label="Feature height H" unit={lenU} value={mmToLen(structure.topo.H)} step={5} onChange={(v) => setS('topo', { ...structure.topo, H: lenToMm(v) })} />
                <NumField label="Half-length Lh" unit={lenU} value={mmToLen(structure.topo.Lh)} step={10} onChange={(v) => setS('topo', { ...structure.topo, Lh: lenToMm(v) })} />
              </div>
              <NumField label="Distance from crest x" unit={lenU} value={mmToLen(structure.topo.x)} step={10} onChange={(v) => setS('topo', { ...structure.topo, x: lenToMm(v) })} />
            </>
          )}
          <SelField label="Gust-effect factor (§26.11)" value={structure.gustMode} onChange={(v) => setS('gustMode', v as GustMode)}
            options={[['default', '0.85 — rigid default'], ['calculated', 'Calculated — rigid Eq 26.11-6'], ['flexible', 'Flexible Gf — Eq 26.11-10']]} />
          {structure.gustMode === 'flexible' && (
            <div className="stl-row2">
              <NumField label="n1 (fund. frequency)" unit="Hz" value={structure.n1} step={0.05} onChange={(v) => setS('n1', Math.max(v || 0.5, 0.01))} />
              <NumField label="β (damping ratio)" value={structure.beta} step={0.005} onChange={(v) => setS('beta', Math.max(v || 0.02, 0.005))} />
            </div>
          )}
          {/* derived factor readouts */}
          <div className="lg-factors">
            <div className="lg-factor"><span>Importance factor, I</span><strong>{I.toFixed(2)} <em>Cat. {site.riskCategory}</em></strong></div>
            {derived && <div className="lg-factor"><span>Velocity exposure, Kz</span><strong>{derived.Kz.toFixed(2)} <em>Table 26.10-1</em></strong></div>}
            {derived && <div className="lg-factor"><span>Topographic, Kzt</span><strong>{derived.Kzt.toFixed(2)} <em>§26.8</em></strong></div>}
            {derived && <div className="lg-factor"><span>Ground elevation, Ke</span><strong>{derived.Ke.toFixed(3)} <em>§26.9</em></strong></div>}
            {derived && <div className="lg-factor"><span>Internal pressure, GCpi</span><strong>±{derived.gcpi.toFixed(2)} <em>§26.13-1</em></strong></div>}
            {derived && <div className="lg-factor"><span>Gust factor, G</span><strong>{derived.G.toFixed(2)} <em>§26.11</em></strong></div>}
          </div>
        </Step>

        <Step n={4} title="Analysis Options" icon={<SlidersHorizontal size={14} />}>
          <div className={`lg-arow${openOpt === 'mwfrs' ? ' is-open' : ''}`}>
            <button type="button" className="lg-arow__head" onClick={() => setOpenOpt(openOpt === 'mwfrs' ? null : 'mwfrs')}><b>MWFRS</b> <i>›</i></button>
            {openOpt === 'mwfrs' && <div className="lg-arow__body">Directional Procedure (Ch. 27), along-wind. {derived && `Governing surface: ${derived.governing.surface === 'Roof' ? derived.governing.zone : derived.governing.surface}.`}</div>}
          </div>
          <div className={`lg-arow${openOpt === 'cc' ? ' is-open' : ''}`}>
            <button type="button" className="lg-arow__head" onClick={() => setOpenOpt(openOpt === 'cc' ? null : 'cc')}><b>Components &amp; Cladding</b> <i>›</i></button>
            {openOpt === 'cc' && (
              <div className="lg-arow__body">
                {result ? (
                  <table className="stl-table" style={{ marginTop: '0.3rem' }}><tbody>
                    <Row k="Zone width a" v={`${mmToLen(result.cc.a).toFixed(2)} ${lenU}`} />
                    {result.cc.walls.map((z) => <Row key={z.label} k={z.label} v={`${fp(z.p_pos)} / ${fp(z.p_neg)}`} />)}
                    {result.cc.roof.map((z) => <Row key={z.label} k={z.label} v={`${fp(z.p_pos)} / ${fp(z.p_neg)}`} />)}
                  </tbody></table>
                ) : '—'}
              </div>
            )}
          </div>
          <div className={`lg-arow${openOpt === 'combos' ? ' is-open' : ''}`}>
            <button type="button" className="lg-arow__head" onClick={() => setOpenOpt(openOpt === 'combos' ? null : 'combos')}><b>Load Combinations</b> <i>›</i></button>
            {openOpt === 'combos' && <div className="lg-arow__body">ASCE 7-22 §2.3 (LRFD) / §2.4 (ASD). <button type="button" className="stl-btn stl-btn--ghost" style={{ marginTop: '0.4rem' }} onClick={onGoCombos}>Open Combinations →</button></div>}
          </div>
          <button type="button" className="lg-generate" onClick={lookup} disabled={loading}><Wind size={14} /> {loading ? 'Generating…' : 'Generate Wind Loads'}</button>
        </Step>
      </aside>

      {/* ── results ── */}
      <div className="lg-results">
        <div className="lg-titlecard">
          <div>
            <div className="lg-titlecard__h"><strong>Wind Load Generator</strong><span className="lg-titlecard__code">ASCE 7-22 · Wind Design</span></div>
            <p className="lg-titlecard__desc">Wind loads calculated for the selected structure in accordance with ASCE 7-22 provisions.</p>
          </div>
          {result && (complete
            ? <div className="lg-complete"><i><CheckCircle2 size={15} /></i> Analysis complete</div>
            : <div className="lg-complete lg-complete--warn"><i><AlertTriangle size={15} /></i> Review required</div>)}
        </div>

        {/* summary tiles */}
        <div className="lg-tiles">
          <Tile k="Vult (3-s gust)" icon={<Wind size={14} />} v={fromSI(site.V, 'velocity', units).toFixed(0)} unit={velU} sub="ASCE 7-22" tip="Ultimate design wind speed" />
          <Tile k="Exposure" icon={<Mountain size={14} />} v={site.exposure} sub={EXPO_LABEL[site.exposure].split('— ')[1]} tip="Surface roughness category §26.7" />
          <Tile k="Enclosure" icon={<Home size={14} />} v={ENCL_LABEL[structure.enclosure]} sub={`Kd = ${structure.Kd.toFixed(2)}`} tip="Enclosure classification §26.12" />
          <Tile k="Governing pressure" icon={<Gauge size={14} />} gov v={derived ? disp(derived.governing.net).toFixed(1) : '—'} unit={derived ? pu : undefined}
            sub={derived ? (derived.governing.surface === 'Roof' ? derived.governing.zone : derived.governing.surface) : undefined} tip="Largest-magnitude net design pressure" />
        </div>

        {/* validation */}
        <Validation errors={result?.errors ?? []} issues={result?.issues ?? []} checks={checks} />

        {/* address / coords bar */}
        {site.location && (
          <div className="lg-addr">
            <div className="lg-addr__item"><span>Address</span><strong>{site.location.formattedAddress ?? '—'}</strong></div>
            <div className="lg-addr__item"><span>Risk category</span><strong>{site.riskCategory}</strong></div>
            <div className="lg-addr__item"><span>Latitude</span><strong>{Math.abs(site.location.lat).toFixed(3)}° {site.location.lat >= 0 ? 'N' : 'S'}</strong></div>
            <div className="lg-addr__item"><span>Longitude</span><strong>{Math.abs(site.location.lng).toFixed(3)}° {site.location.lng >= 0 ? 'E' : 'W'}</strong></div>
            <div className="lg-addr__item"><span>Elevation</span><strong>{mmToLen(site.location.elevation * 1000).toFixed(0)} {lenU}</strong></div>
          </div>
        )}

        {/* diagram + map */}
        <div className="lg-diagrow">
          <div className="stl-card">
            <h4 className="stl-cardh">Wind Pressures on Building</h4>
            <WindPressureDiagram structure={structure} result={result} unitSystem={units} />
          </div>
          <div className="stl-card">
            <h4 className="stl-cardh">Site</h4>
            <div className="lg-map" style={{ border: '1px solid var(--lux-line-soft)' }}><SiteMap location={site.location} /></div>
          </div>
        </div>

        {derived && (
          <>
            {/* MWFRS summary */}
            <div className="lg-tiles">
              <Tile k="qz (at mean roof ht)" v={disp(derived.qh).toFixed(1)} unit={pu} tip="Velocity pressure at mean roof height, Eq 26.10-1" />
              <Tile k="Cp range (MWFRS)" v={`${derived.cpMin.toFixed(2)} to ${derived.cpMax.toFixed(2)}`} tip="External pressure coefficients, Fig 27.3-1" />
              <Tile k="Internal pressure GCpi" v={`±${derived.gcpi.toFixed(2)}`} tip="Internal pressure coefficient, Table 26.13-1" />
              <Tile k="Net pressure range" v={`${disp(derived.netMin).toFixed(1)} to ${disp(derived.netMax).toFixed(1)}`} unit={pu} tip="Min → max net design pressure" />
            </div>
            <p className="stl-note" style={{ margin: '-0.4rem 0 1rem' }}>Governing surface: <strong style={{ color: 'var(--lux-gold-deep)' }}>{derived.governing.surface === 'Roof' ? derived.governing.zone : derived.governing.surface}</strong> · Wind direction: along-wind (0°) · MWFRS external pressures.</p>

            {/* pressure summary table */}
            <div className="stl-panel">
              <h4 className="stl-cardh">Pressure Summary <span className="stl-tag">{pu}</span></h4>
              <div className="stl-tablewrap">
                <table className="stl-dtable lg-dtable">
                  <thead><tr>
                    <th>Surface</th><th>Direction</th><th>Zone</th><th>Cp</th><th>External</th><th>Internal</th>
                    <th className="is-sortable" onClick={() => setSortNet(sortNet === 'desc' ? 'asc' : sortNet === 'asc' ? null : 'desc')} title="Sort by net pressure">Net {sortNet === 'desc' ? '↓' : sortNet === 'asc' ? '↑' : ''}</th>
                    <th>Governing</th><th>Reference</th>
                  </tr></thead>
                  <tbody>
                    {sortedRows.map((r) => (
                      <tr key={r.orig} className={r.orig === derived.govIdx ? 'is-gov' : selRow === r.orig ? 'is-sel' : ''} onClick={() => setSelRow(selRow === r.orig ? null : r.orig)}>
                        <td className="stl-dt-name">{r.surface}</td>
                        <td className="stl-dt-name" style={{ fontWeight: 400, color: 'var(--lux-muted)' }}>{r.dir}</td>
                        <td className="stl-dt-name" style={{ fontWeight: 400, color: 'var(--lux-muted)' }}>{r.zone}</td>
                        <td>{r.Cp.toFixed(2)}</td>
                        <td>{disp(r.ext).toFixed(1)}</td>
                        <td>±{disp(r.int).toFixed(1)}</td>
                        <td><strong>{disp(r.net).toFixed(1)}</strong></td>
                        <td>{r.orig === derived.govIdx ? <span className="stl-pill stl-pill--ok">Governing</span> : <span className="stl-pill stl-pill--na">—</span>}</td>
                        <td className="stl-dt-ref">{r.ref}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* net pressure by surface */}
            <div className="stl-panel">
              <h4 className="stl-cardh">Net Pressure by Surface <span className="stl-tag">{pu}</span></h4>
              <NetPressureChart rows={derived.rows.map((r, i) => ({ label: r.surface === 'Roof' ? r.zone : r.surface, v: disp(r.net), gov: i === derived.govIdx, sel: i === selRow }))} unit={pu} onSelect={(i) => setSelRow(selRow === i ? null : i)} />
            </div>
          </>
        )}
        {!result && <div className="stl-card"><p className="stl-note">Enter site + building data to compute wind pressures.</p></div>}

        {/* notes / references */}
        <div className="lg-diagrow" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
          <div className="stl-card">
            <h4 className="stl-cardh">Notes &amp; Assumptions</h4>
            <ul className="stl-note" style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.6 }}>
              {notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
          <div className="stl-card">
            <h4 className="stl-cardh">References</h4>
            <table className="stl-table"><tbody>
              <Row k="General requirements" v="Wind loads" ref="ASCE 7-22 Ch. 26" />
              <Row k="MWFRS" v="Directional Procedure" ref="Ch. 27 · Fig 27.3-1" />
              <Row k="Components & Cladding" v="Low-rise" ref="Ch. 30" />
              <Row k="Internal pressure" v="GCpi" ref="Table 26.13-1" />
              <Row k="Load combinations" v="LRFD / ASD" ref="§2.3 / §2.4" />
            </tbody></table>
          </div>
        </div>

        {/* report / export */}
        <div className="lg-report">
          <h4 className="stl-cardh">Report / Export</h4>
          <p className="stl-note" style={{ margin: 0 }}>Download a complete report including inputs, factors, pressure tables and diagrams.</p>
          <div className="lg-report__grid">
            <button type="button" className="lg-report__btn lg-report__btn--primary" onClick={onPrint}><FileText size={15} /> Download PDF Report</button>
            <button type="button" className="lg-report__btn" onClick={onExportCsv}><FileDown size={15} /> Export CSV</button>
            <button type="button" className="lg-report__btn" onClick={copyResults}><Copy size={15} /> Copy Results</button>
            <button type="button" className="lg-report__btn" onClick={onPrint}><Printer size={15} /> Print Summary</button>
            <button type="button" className="lg-report__btn" onClick={onSaveJson}><Save size={15} /> Save Project</button>
            <button type="button" className="lg-report__btn" onClick={onCopyLink}><Share2 size={15} /> Share Link</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ SNOW ═══════════════════════ */
function SnowTab({ snow, risk, structure, units, onChange, result }: { snow: SnowData; risk: RiskCategory; structure: StructureData; units: UnitSystem; onChange: (s: SnowData) => void; result: SnowResult | null }) {
  const pu = unitLabel('pressureSmall', units);
  const { lenU, mmToLen, lenToMm } = useUnits(units);
  const disp = (pa: number) => fromSI(pa, 'pressureSmall', units);
  const fp = (pa: number) => `${disp(pa).toFixed(1)} ${pu}`;
  const set = <K extends keyof SnowData>(k: K, v: SnowData[K]) => onChange({ ...snow, [k]: v });
  const complete = result && result.errors.length === 0;
  return (
    <div className="stl-grid">
      <aside className="stl-inputs lg-sidebar">
        <Step n={1} title="Ground Snow" icon={<CloudSnow size={14} />}>
          <div className="stl-row2">
            <NumField label="Ground snow pg (ultimate)" unit={pu} value={fromSI(snow.pg, 'pressureSmall', units)} step={1} onChange={(v) => set('pg', toSI(v, 'pressureSmall', units))} />
            <NumField label="W2 (winter wind, 7.6-1)" value={snow.W2} step={0.05} onChange={(v) => set('W2', Math.max(0, Math.min(1, v)))} />
          </div>
          <span className="stl-hint">Ultimate, Risk-Category-{risk}-specific pg and Winter Wind Parameter W2 (0.25–0.65) from the ASCE 7-22 Hazard Tool. In 7-22 the importance factor Is is removed — risk is carried in pg.</span>
        </Step>
        <Step n={2} title="Roof Condition" icon={<Home size={14} />}>
          <SelField label="Terrain category" value={snow.terrain} onChange={(v) => set('terrain', v as SnowTerrain)}
            options={[['B', 'B — Urban / suburban'], ['C', 'C — Open terrain'], ['D', 'D — Flat unobstructed'], ['above-treeline', 'Above treeline'], ['alaska-no-trees', 'Alaska, no trees']]} />
          <SelField label="Roof exposure" value={snow.roofExposure} onChange={(v) => set('roofExposure', v as RoofExposure)}
            options={[['fully-exposed', 'Fully exposed'], ['partially-exposed', 'Partially exposed'], ['sheltered', 'Sheltered']]} />
          <SelField label="Thermal condition" value={snow.thermal} onChange={(v) => set('thermal', v as ThermalCondition)}
            options={[['heated', 'Heated — all other (Ct 1.0)'], ['heated-unventilated', 'Heated, unventilated roof (7.3-3)'], ['cold-ventilated', 'Cold / ventilated roof (1.2)'], ['unheated', 'Unheated / open-air (1.2)'], ['below-freezing', 'Kept below freezing (1.3)'], ['greenhouse', 'Heated greenhouse (0.85)']]} />
          {snow.thermal === 'heated-unventilated' && (
            <NumField label="Roof R-value" unit="h·ft²·°F/Btu" value={snow.roofR} step={5} onChange={(v) => set('roofR', v)} />
          )}
        </Step>
        <Step n={3} title="Roof Geometry" icon={<Building2 size={14} />}>
          <div className="stl-row2">
            <NumField label="Roof slope θ" unit="°" value={snow.roofSlope} step={1} onChange={(v) => set('roofSlope', v)} />
            <NumField label="Eave-to-ridge W" unit={lenU} value={mmToLen(snow.eaveToRidge)} step={1} onChange={(v) => set('eaveToRidge', lenToMm(v))} />
          </div>
          <label className="abx-ctrl abx-ctrl--check" style={{ paddingTop: '0.4rem' }}>
            <input type="checkbox" checked={snow.slippery} onChange={(e) => set('slippery', e.target.checked)} />
            <span>Unobstructed slippery surface (metal / membrane / glass)</span>
          </label>
        </Step>
        <Step n={4} title="Drift · Sliding (§7.7–7.9)" icon={<Layers size={14} />}>
          <label className="abx-ctrl abx-ctrl--check">
            <input type="checkbox" checked={snow.drift.step} onChange={(e) => set('drift', { ...snow.drift, step: e.target.checked })} />
            <span>Lower-roof step drift (leeward + windward)</span>
          </label>
          {snow.drift.step && (
            <div className="stl-row2">
              <NumField label="Upper-roof fetch lu" unit={lenU} value={mmToLen(snow.drift.luUpper)} step={5} onChange={(v) => set('drift', { ...snow.drift, luUpper: lenToMm(v) })} />
              <NumField label="Roof step height" unit={lenU} value={mmToLen(snow.drift.stepHeight)} step={1} onChange={(v) => set('drift', { ...snow.drift, stepHeight: lenToMm(v) })} />
            </div>
          )}
          {(snow.drift.step || snow.drift.sliding) && (
            <NumField label="Lower-roof length" unit={lenU} value={mmToLen(snow.drift.luLower)} step={5} onChange={(v) => set('drift', { ...snow.drift, luLower: lenToMm(v) })} />
          )}
          <label className="abx-ctrl abx-ctrl--check">
            <input type="checkbox" checked={snow.drift.parapet} onChange={(e) => set('drift', { ...snow.drift, parapet: e.target.checked })} />
            <span>Parapet drift (§7.8, windward)</span>
          </label>
          {snow.drift.parapet && (
            <div className="stl-row2">
              <NumField label="Parapet height" unit={lenU} value={mmToLen(snow.drift.parapetHeight)} step={0.5} onChange={(v) => set('drift', { ...snow.drift, parapetHeight: lenToMm(v) })} />
              <NumField label="Roof length upwind" unit={lenU} value={mmToLen(snow.drift.parapetLu)} step={5} onChange={(v) => set('drift', { ...snow.drift, parapetLu: lenToMm(v) })} />
            </div>
          )}
          <label className="abx-ctrl abx-ctrl--check">
            <input type="checkbox" checked={snow.drift.sliding} onChange={(e) => set('drift', { ...snow.drift, sliding: e.target.checked })} />
            <span>Sliding snow onto lower roof (§7.9)</span>
          </label>
        </Step>
      </aside>

      <div className="lg-results">
        <div className="lg-titlecard">
          <div><div className="lg-titlecard__h"><strong>Snow Load Generator</strong><span className="lg-titlecard__code">ASCE 7-22 · Snow Design</span></div>
            <p className="lg-titlecard__desc">Balanced, minimum, drift, unbalanced and sliding snow loads per ASCE 7-22 Ch. 7.</p></div>
          {result && (complete ? <div className="lg-complete"><i><CheckCircle2 size={15} /></i> Analysis complete</div> : <div className="lg-complete lg-complete--warn"><i><AlertTriangle size={15} /></i> Review required</div>)}
        </div>
        {result && (
          <div className="lg-tiles">
            <Tile k="pf — flat roof" icon={<CloudSnow size={14} />} v={disp(result.pf).toFixed(1)} unit={pu} sub="Eq 7.3-1" />
            <Tile k="ps — sloped balanced" icon={<Home size={14} />} v={disp(result.ps).toFixed(1)} unit={pu} sub={`Cs = ${result.Cs.toFixed(2)}`} />
            <Tile k="pm — minimum" icon={<Layers size={14} />} v={disp(result.pm).toFixed(1)} unit={pu} sub="§7.3.3" />
            <Tile k="Governing balanced" icon={<Gauge size={14} />} gov v={disp(result.governing).toFixed(1)} unit={pu} sub={result.minimumGoverns ? 'minimum governs' : 'sloped governs'} />
          </div>
        )}
        <div className="lg-diagrow">
          <div className="stl-card">
            <h4 className="stl-cardh">Building Model <span className="stl-tag">balanced snow · 3D</span></h4>
            <SnowRoofDiagram result={result} structure={structure} roofSlope={snow.roofSlope} unitSystem={units} />
          </div>
          <div className="stl-card">
            <h4 className="stl-cardh">Factors <span className="stl-tag">Ch. 7</span></h4>
            {result ? (
              <table className="stl-table"><tbody>
                <Row k="Ce (exposure, 7.3-1)" v={result.Ce.toFixed(2)} />
                <Row k="Ct (thermal, 7.3-2)" v={result.Ct.toFixed(2)} />
                <Row k="Cs (slope, 7.4-1)" v={result.Cs.toFixed(3)} />
                {result.rainOnSnow > 0 && <Row k="Rain-on-snow (7.10)" v={`+${fp(result.rainOnSnow)}`} />}
              </tbody></table>
            ) : <p className="stl-note">—</p>}
          </div>
        </div>
        {result?.drift && (result.drift.leeward || result.drift.parapet || result.drift.unbalanced?.applies || result.drift.sliding) && (
          <div className="stl-panel">
            <h4 className="stl-cardh">Drift · Unbalanced · Sliding <span className="stl-tag">§7.6–7.9 · Eq 7.6-1</span></h4>
            <table className="stl-table"><tbody>
              <Row k="γ (density, 7.7-1)" v={`${result.drift.gamma_pcf.toFixed(2)} pcf`} />
              {result.drift.leeward && <>
                <Row k="hb / hc" v={`${mmToLen(result.drift.hb).toFixed(2)} / ${mmToLen(result.drift.hc).toFixed(2)} ${lenU}`} ref={result.drift.required ? '' : 'hc/hb < 0.2 — not required'} />
                <tr><td colSpan={3} className="stl-note--head">Leeward step drift (lu = upper roof)</td></tr>
                <Row k="hd → h (capped)" v={`${mmToLen(result.drift.leeward.hd).toFixed(2)} → ${mmToLen(result.drift.leeward.h).toFixed(2)} ${lenU}`} ref={result.drift.leeward.capped ? 'capped' : ''} />
                <Row k="Surcharge pd · width w" v={<strong>{fp(result.drift.leeward.pd)} · {mmToLen(result.drift.leeward.w).toFixed(1)} {lenU}</strong>} />
                <Row k="Peak at step (ps + pd)" v={<strong>{fp(result.drift.leeward.peak)}</strong>} />
              </>}
              {result.drift.windward && <>
                <tr><td colSpan={3} className="stl-note--head">Windward step drift (0.75·hd, lu = lower roof)</td></tr>
                <Row k="hd → h (capped)" v={`${mmToLen(result.drift.windward.hd).toFixed(2)} → ${mmToLen(result.drift.windward.h).toFixed(2)} ${lenU}`} ref={result.drift.windward.capped ? 'capped' : ''} />
                <Row k="Surcharge pd · width w" v={<strong>{fp(result.drift.windward.pd)} · {mmToLen(result.drift.windward.w).toFixed(1)} {lenU}</strong>} />
              </>}
              {result.drift.parapet && <>
                <tr><td colSpan={3} className="stl-note--head">Parapet drift (§7.8)</td></tr>
                <Row k="0.75·hd → h (capped)" v={`${mmToLen(result.drift.parapet.hd).toFixed(2)} → ${mmToLen(result.drift.parapet.h).toFixed(2)} ${lenU}`} ref={result.drift.parapet.capped ? 'capped by hc' : ''} />
                <Row k="Surcharge pd · width w" v={<strong>{fp(result.drift.parapet.pd)} · {mmToLen(result.drift.parapet.w).toFixed(1)} {lenU}</strong>} />
              </>}
              {result.drift.unbalanced?.applies && <>
                <tr><td colSpan={3} className="stl-note--head">Unbalanced gable (§7.6.1){result.drift.unbalanced.simpleCase ? ' — simple case (W ≤ 20 ft)' : ''}</td></tr>
                <Row k="Windward side" v={fp(result.drift.unbalanced.windward)} />
                <Row k="Leeward side" v={result.drift.unbalanced.simpleCase
                  ? <strong>{fp(result.drift.unbalanced.leeward)}</strong>
                  : <strong>{fp(result.drift.unbalanced.leeward)} + {fp(result.drift.unbalanced.surcharge)}</strong>}
                  ref={result.drift.unbalanced.simpleCase ? '' : `over ${mmToLen(result.drift.unbalanced.extent).toFixed(1)} ${lenU} from ridge`} />
              </>}
              {result.drift.sliding && <>
                <tr><td colSpan={3} className="stl-note--head">Sliding snow (§7.9)</td></tr>
                <Row k="Added intensity · strip" v={<strong>{fp(result.drift.sliding.intensity)} · {mmToLen(result.drift.sliding.width).toFixed(1)} {lenU}</strong>} ref="0.4·pf·W over 15 ft" />
              </>}
            </tbody></table>
          </div>
        )}
        {result && <Issues issues={[...result.issues, ...(result.drift?.issues ?? [])]} errors={result.errors} />}
      </div>
    </div>
  );
}

/* ═══════════════════════ SEISMIC ═══════════════════════ */
function SeismicTab({ seismic, site, units, onChange, onSite, result }: { seismic: SeismicData; site: SiteData; units: UnitSystem; onChange: (s: SeismicData) => void; onSite: (s: SiteData) => void; result: SeismicResult | null }) {
  const forceU = unitLabel('force', units);
  const { lenU, mmToLen, lenToMm } = useUnits(units);
  const ff = (kn: number) => `${fromSI(kn, 'force', units).toFixed(1)} ${forceU}`;
  const set = <K extends keyof SeismicData>(k: K, v: SeismicData[K]) => onChange({ ...seismic, [k]: v });
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const complete = result && result.errors.length === 0;
  const refetch = async (siteClass: SiteClass) => {
    if (!site.location) return;
    setFetching(true); setFetchErr(null);
    try {
      onChange({ ...seismic, ...(await fetchUsgsSeismic(site.location.lat, site.location.lng, site.riskCategory, siteClass)) });
    } catch (e) {
      setFetchErr(e instanceof Error ? e.message : 'USGS lookup failed');
    } finally { setFetching(false); }
  };
  return (
    <div className="stl-grid">
      <aside className="stl-inputs lg-sidebar">
        <Step n={1} title="Design Ground Motion" icon={<Activity size={14} />}>
          <div className="stl-row2">
            <SelField label="Site class (Table 20.2-1)" value={site.siteClass} onChange={(v) => { onSite({ ...site, siteClass: v as SiteClass }); refetch(v as SiteClass); }}
              options={[['Default', 'Default — C/CD/D envelope'], ['A', 'A — Hard rock'], ['B', 'B — Medium hard rock'], ['BC', 'BC — Soft rock'], ['C', 'C — Very dense sand'], ['CD', 'CD — Dense sand'], ['D', 'D — Medium dense sand'], ['DE', 'DE — Loose sand'], ['E', 'E — Soft clay'], ['F', 'F — Site-specific']]} />
            <div className="stl-field">
              <label>USGS 7-22 geodatabase</label>
              <button type="button" className="stl-add" style={{ margin: 0, padding: '0.55rem 0.65rem' }} disabled={!site.location || fetching} onClick={() => refetch(site.siteClass)}>
                {fetching ? 'Fetching…' : site.location ? 'Fetch SDS / SD1 for site' : 'Look up an address first (Wind tab)'}
              </button>
            </div>
          </div>
          {fetchErr && <span className="stl-hint" style={{ color: '#b0322a' }}>{fetchErr}</span>}
          <div className="stl-row2">
            <NumField label="SDS (short-period)" unit="g" value={seismic.SDS} step={0.05} onChange={(v) => onChange({ ...seismic, SDS: v, source: 'manual' })} />
            <NumField label="SD1 (1-s period)" unit="g" value={seismic.SD1} step={0.02} onChange={(v) => onChange({ ...seismic, SD1: v, source: 'manual' })} />
          </div>
          <span className="stl-hint">
            {seismic.source === 'USGS' ? 'SDS / SD1 fetched from the USGS ASCE 7-22 geodatabase for this site & class. ' : ''}
            7-22 removed the Fa/Fv tables — the geodatabase carries site effects. Risk category {site.riskCategory} sets Ie.
          </span>
          <div className="stl-row2">
            <NumField label="S1 (mapped, at BC)" unit="g" value={seismic.S1} step={0.02} onChange={(v) => set('S1', v)} />
            <NumField label="TL (long-period)" unit="s" value={seismic.TL} step={1} onChange={(v) => set('TL', v || 8)} />
          </div>
        </Step>
        <Step n={2} title="Structural System" icon={<Building2 size={14} />}>
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
        </Step>
      </aside>

      <div className="lg-results">
        <div className="lg-titlecard">
          <div><div className="lg-titlecard__h"><strong>Seismic Load Generator</strong><span className="lg-titlecard__code">ASCE 7-22 · ELF §12.8</span></div>
            <p className="lg-titlecard__desc">Equivalent Lateral Force base shear and story distribution per ASCE 7-22 Ch. 11–12.</p></div>
          {result && (complete ? <div className="lg-complete"><i><CheckCircle2 size={15} /></i> Analysis complete</div> : <div className="lg-complete lg-complete--warn"><i><AlertTriangle size={15} /></i> Review required</div>)}
        </div>
        {result && (
          <div className="lg-tiles">
            <Tile k="SDS" icon={<Activity size={14} />} v={result.SDS.toFixed(3)} unit="g" sub={seismic.source === 'USGS' ? 'USGS' : 'manual'} />
            <Tile k="SD1" icon={<Activity size={14} />} v={result.SD1.toFixed(3)} unit="g" sub={`Ie = ${result.Ie.toFixed(2)}`} />
            <Tile k="V — base shear" icon={<Gauge size={14} />} gov v={fromSI(result.V, 'force', units).toFixed(0)} unit={forceU} sub={`Cs = ${result.Cs.toFixed(4)}`} />
            <Tile k="SDC" icon={<ShieldCheck size={14} />} v={result.SDC} sub={`Ta = ${result.Ta.toFixed(2)} s`} />
          </div>
        )}
        <div className="lg-diagrow">
          <div className="stl-card">
            <h4 className="stl-cardh">Building Model <span className="stl-tag">story forces · V · 3D</span></h4>
            <SeismicDiagram result={result} unitSystem={units} />
          </div>
          <div className="stl-card">
            <h4 className="stl-cardh">Design Spectrum &amp; Base Shear <span className="stl-tag">§11.4 · §12.8</span></h4>
            {result ? (
              <table className="stl-table"><tbody>
                <Row k="SMS / SM1 (= 1.5×SD)" v={`${result.SMS.toFixed(3)} / ${result.SM1.toFixed(3)}`} />
                <Row k="Ts = SD1/SDS" v={`${result.Ts.toFixed(3)} s`} />
                <Row k="Ta (approx. period)" v={`${result.Ta.toFixed(3)} s`} />
                <Row k="Cs" v={<strong>{result.Cs.toFixed(4)}</strong>} ref={result.CsControl} />
                <Row k="k (distribution exp.)" v={result.k.toFixed(2)} />
                <Row k="V — base shear" v={<strong>{ff(result.V)}</strong>} />
              </tbody></table>
            ) : <p className="stl-note">—</p>}
          </div>
        </div>
        {result && result.forces.length > 0 && (
          <div className="stl-panel">
            <h4 className="stl-cardh">Story Forces <span className="stl-tag">Fx / Vx</span></h4>
            <div className="stl-tablewrap"><table className="abx-table"><thead><tr><th>Level</th><th>hx ({lenU})</th><th>Cvx</th><th>Fx ({forceU})</th><th>Vx ({forceU})</th></tr></thead><tbody>
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
        {result && <Issues issues={result.issues} errors={result.errors} />}
      </div>
    </div>
  );
}

/* ═══════════════════════ COMBINATIONS ═══════════════════════ */
function CombosTab({ S, SDS, units }: { S: number; SDS: number; units: UnitSystem }) {
  const pu = unitLabel('pressureSmall', units);
  const disp = (pa: number) => fromSI(pa, 'pressureSmall', units);
  const fp = (pa: number) => `${disp(pa).toFixed(1)} ${pu}`;
  const [D, setD] = useState(20 * 47.880259);
  const [L, setL] = useState(50 * 47.880259);
  const [Lr, setLr] = useState(20 * 47.880259);
  const [R, setR] = useState(0);
  const [rho, setRho] = useState(1.0);

  const inputs = { D, L, Lr, R, S, SDS, rho };
  const lrfd = combosLRFD(inputs);
  const asd = combosASD(inputs);
  const maxLrfd = Math.max(...lrfd.map((c) => c.value ?? 0));
  const maxAsd = Math.max(...asd.map((c) => c.value ?? 0));

  const ComboTable = ({ rows, maxVal, title, tag }: { rows: ComboLine[]; maxVal: number; title: string; tag: string }) => (
    <div className="stl-panel">
      <h4 className="stl-cardh">{title} <span className="stl-tag">{tag}</span></h4>
      <div className="stl-tablewrap"><table className="abx-table"><thead><tr><th>Ref</th><th>Combination</th><th>Result</th></tr></thead><tbody>
        {rows.map((c) => (
          <tr key={c.id}>
            <td className="abx-mono">{c.id}</td>
            <td style={{ whiteSpace: 'normal' }}>{c.expr}</td>
            <td className="abx-mono" style={c.value !== null && c.value === maxVal ? { fontWeight: 700, color: 'var(--lux-ink)' } : undefined}>
              {c.value !== null ? fp(c.value) : c.kind === 'wind' ? '+ W terms' : '+ QE terms'}
            </td>
          </tr>
        ))}
      </tbody></table></div>
    </div>
  );

  return (
    <div className="stl-grid">
      <aside className="stl-inputs lg-sidebar">
        <Step n={1} title="Service Loads" icon={<Layers size={14} />}>
          <div className="stl-row2">
            <NumField label="Dead D" unit={pu} value={fromSI(D, 'pressureSmall', units)} step={1} onChange={(v) => setD(toSI(v, 'pressureSmall', units))} />
            <NumField label="Live L" unit={pu} value={fromSI(L, 'pressureSmall', units)} step={1} onChange={(v) => setL(toSI(v, 'pressureSmall', units))} />
          </div>
          <div className="stl-row2">
            <NumField label="Roof live Lr" unit={pu} value={fromSI(Lr, 'pressureSmall', units)} step={1} onChange={(v) => setLr(toSI(v, 'pressureSmall', units))} />
            <NumField label="Rain R" unit={pu} value={fromSI(R, 'pressureSmall', units)} step={1} onChange={(v) => setR(toSI(v, 'pressureSmall', units))} />
          </div>
          <SelField label="Redundancy ρ (§12.3.4)" value={String(rho)} onChange={(v) => setRho(parseFloat(v))}
            options={[['1', '1.0 — SDC B/C or compliant'], ['1.3', '1.3 — SDC D–F default']]} />
        </Step>
        <Step n={2} title="From the Other Tabs" icon={<Link2 size={14} />}>
          <table className="stl-table"><tbody>
            <Row k="Snow S (governing balanced)" v={<strong>{fp(S)}</strong>} ref="Snow tab" />
            <Row k="SDS (for Ev = 0.2·SDS·D)" v={<strong>{SDS.toFixed(3)} g</strong>} ref="Seismic tab" />
          </tbody></table>
          <span className="stl-hint">ASCE 7-22: snow is strength-level — 1.0S principal, 0.3S companion (LRFD), 0.7S (ASD), 0.15S with seismic. W and QE stay symbolic here.</span>
        </Step>
      </aside>

      <div className="lg-results">
        <div className="lg-titlecard">
          <div><div className="lg-titlecard__h"><strong>Load Combinations</strong><span className="lg-titlecard__code">ASCE 7-22 · §2.3 / §2.4</span></div>
            <p className="lg-titlecard__desc">Strength (LRFD) and allowable-stress (ASD) load combinations with 7-22 strength-level snow factors.</p></div>
          <div className="lg-complete"><i><CheckCircle2 size={15} /></i> Analysis complete</div>
        </div>
        <div className="lg-tiles">
          <Tile k="Max LRFD (gravity)" icon={<Gauge size={14} />} gov v={disp(maxLrfd).toFixed(1)} unit={pu} sub="§2.3 strength" />
          <Tile k="Max ASD (gravity)" icon={<Layers size={14} />} v={disp(maxAsd).toFixed(1)} unit={pu} sub="§2.4 allowable" />
          <Tile k="Snow S (from Snow tab)" icon={<CloudSnow size={14} />} v={disp(S).toFixed(1)} unit={pu} sub="governing balanced" />
          <Tile k="SDS (from Seismic tab)" icon={<Activity size={14} />} v={SDS.toFixed(3)} unit="g" sub="Ev = 0.2·SDS·D" />
        </div>
        <div className="lg-diagrow" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <ComboTable rows={lrfd} maxVal={maxLrfd} title="Strength Design" tag="LRFD · §2.3" />
          <ComboTable rows={asd} maxVal={maxAsd} title="Allowable Stress" tag="ASD · §2.4" />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ shared UI ═══════════════════════ */
function Step({ n, title, icon, defaultOpen = true, children }: { n: number; title: string; icon: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`lg-step${open ? ' is-open' : ''}`}>
      <button type="button" className="lg-step__h" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="lg-step__n">{n}</span>
        <span className="lg-step__ic">{icon}</span>
        <span className="lg-step__t">{title}</span>
        <ChevronDown size={15} className="lg-step__chev" />
      </button>
      {open && <div className="lg-step__body">{children}</div>}
    </section>
  );
}
function Tile({ k, v, unit, sub, gov, icon, tip }: { k: string; v: React.ReactNode; unit?: string; sub?: string; gov?: boolean; icon?: React.ReactNode; tip?: string }) {
  return (
    <div className={`lg-tile${gov ? ' lg-tile--gov' : ''}`} title={tip}>
      <div className="lg-tile__top">{icon ? <span className="lg-tile__ic">{icon}</span> : null}<div className="lg-tile__k">{k}</div></div>
      <div className="lg-tile__v">{v}{unit ? <span> {unit}</span> : null}</div>
      {sub ? <div className="lg-tile__sub">{sub}</div> : null}
    </div>
  );
}
function Tip({ text }: { text: string }) {
  return <span className="lg-tip" data-tip={text} aria-label={text}><Info size={12} strokeWidth={2} /></span>;
}
function Validation({ errors, issues, checks }: { errors: string[]; issues: string[]; checks: string[] }) {
  const warns = [...issues, ...checks];
  if (!errors.length && !warns.length) {
    return <div className="lg-valid"><div className="lg-valid__row lg-valid__row--ok"><i><CheckCircle2 size={15} /></i> Validated — inputs are within the scope of the ASCE 7-22 Directional Procedure.</div></div>;
  }
  return (
    <div className="lg-valid">
      {errors.map((e, i) => <div key={`e${i}`} className="lg-valid__row lg-valid__row--err"><i><XCircle size={15} /></i> {e}</div>)}
      {warns.map((w, i) => <div key={`w${i}`} className="lg-valid__row lg-valid__row--warn"><i><AlertTriangle size={15} /></i> {w}</div>)}
    </div>
  );
}
function NetPressureChart({ rows, unit, onSelect }: { rows: { label: string; v: number; gov: boolean; sel: boolean }[]; unit: string; onSelect?: (i: number) => void }) {
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.v)));
  return (
    <div>
      <div className="lg-chart">
        {rows.map((r, i) => {
          const w = (Math.abs(r.v) / maxAbs) * 50;
          return (
            <div key={i} className={`lg-chart__row${r.gov ? ' is-gov' : ''}${r.sel ? ' is-sel' : ''}`} onClick={() => onSelect?.(i)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
              <span className="lg-chart__lbl">{r.label}</span>
              <div className="lg-chart__track"><i className={`lg-chart__bar ${r.v >= 0 ? 'lg-chart__bar--pos' : 'lg-chart__bar--neg'}`} style={{ width: `${w}%` }} /></div>
              <span className="lg-chart__val">{r.v >= 0 ? '+' : ''}{r.v.toFixed(1)}</span>
            </div>
          );
        })}
      </div>
      <div className="lg-chart__axis"><span>−{maxAbs.toFixed(0)}</span><span>0</span><span>+{maxAbs.toFixed(0)} {unit}</span></div>
    </div>
  );
}
function NumField({ label, unit, value, step = 1, tip, onChange }: { label: string; unit?: string; value: number; step?: number; tip?: string; onChange: (v: number) => void }) {
  return (
    <label className="stl-field">
      <label>{label}{unit ? <span className="stl-unit"> ({unit})</span> : null}{tip ? <Tip text={tip} /> : null}</label>
      <input type="number" step={step} value={Number.isFinite(value) ? Math.round(value * 1000) / 1000 : ''} onChange={(e) => { const v = parseFloat(e.target.value); onChange(Number.isFinite(v) ? v : 0); }} />
    </label>
  );
}
function SelField({ label, value, onChange, options, tip }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; tip?: string }) {
  return (
    <label className="stl-field">
      <label>{label}{tip ? <Tip text={tip} /> : null}</label>
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
    <div className="abx-warnings" style={{ marginTop: '1rem', marginBottom: 0 }}>
      {errors.map((e, i) => <div key={`e${i}`} className="abx-warning" style={{ borderLeftColor: '#b0322a', background: 'rgba(176,50,42,0.06)', color: '#8a1c1c' }}>⚠ {e}</div>)}
      {issues.map((m, i) => <div key={`i${i}`} className="abx-warning">{m}</div>)}
    </div>
  );
}
