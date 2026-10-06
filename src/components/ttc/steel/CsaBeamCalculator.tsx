'use client';

import React, { useId, useMemo, useState } from 'react';
import csaDb from '@/lib/steel/csa-shapes.json';
import {
  analyzeBeam, flexure, classify,
  type CsaSection, type IFamily, type BeamInputs, type DeflCase,
} from '@/lib/steel/csaS16';

const ALL: CsaSection[] = (csaDb as { shapes: CsaSection[] }).shapes;
const FAMILIES: { id: IFamily; label: string }[] = [
  { id: 'W', label: 'W — Wide Flange' },
  { id: 'S', label: 'S — Standard Beam' },
];

const GRADES = [
  { id: '350W', label: 'CSA G40.21 350W', Fy: 350, Fu: 450 },
  { id: '300W', label: 'CSA G40.21 300W', Fy: 300, Fu: 450 },
  { id: '400W', label: 'CSA G40.21 400W', Fy: 400, Fu: 520 },
  { id: 'custom', label: 'Custom…', Fy: 350, Fu: 450 },
];

const DEFL_CASES: { id: DeflCase; label: string; load: 'w' | 'P' }[] = [
  { id: 'ss-udl', label: 'Simply supported — UDL', load: 'w' },
  { id: 'ss-point', label: 'Simply supported — central point', load: 'P' },
  { id: 'cant-udl', label: 'Cantilever — UDL', load: 'w' },
  { id: 'cant-point', label: 'Cantilever — end point', load: 'P' },
];
const DEFL_LIMITS = [
  { den: 360, label: 'L/360 — live, floors' },
  { den: 240, label: 'L/240 — total load' },
  { den: 180, label: 'L/180 — roofs' },
];

const fmt = (x: number, d = 1) => (Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const kNm = (nmm: number) => nmm / 1e6;
const kN = (n: number) => n / 1e3;

/* ── controls ─────────────────────────────────────────────────────────── */
function Num({ label, unit, value, onChange, step = 'any', hint }: {
  label: string; unit?: string; value: number; onChange: (v: number) => void; step?: string; hint?: string;
}) {
  const id = useId();
  return (
    <div className="stl-field">
      <label htmlFor={id}>{label} {unit ? <span className="stl-unit">({unit})</span> : null}</label>
      <input id={id} type="number" step={step} value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
      {hint ? <small className="stl-hint">{hint}</small> : null}
    </div>
  );
}

function Bar({ label, ratio }: { label: string; ratio: number }) {
  const pct = Math.min(ratio, 1.35) / 1.35 * 100;
  const state = ratio > 1 ? 'over' : ratio > 0.9 ? 'high' : 'ok';
  return (
    <div className="stl-bar">
      <div className="stl-bar__head"><span>{label}</span><strong className={`stl-bar__val stl-bar__val--${state}`}>{fmt(ratio, 2)}</strong></div>
      <div className="stl-bar__track">
        <div className={`stl-bar__fill stl-bar__fill--${state}`} style={{ width: `${pct}%` }} />
        <div className="stl-bar__limit" />
      </div>
    </div>
  );
}

function Row({ k, v, unit, ref }: { k: string; v: React.ReactNode; unit?: string; ref?: string }) {
  return (<tr><td className="stl-k">{k}</td><td className="stl-v">{v}{unit ? <span className="stl-unit"> {unit}</span> : null}</td><td className="stl-ref">{ref}</td></tr>);
}

/* I-section drawing (metric) */
function SectionSVG({ s }: { s: CsaSection }) {
  const W = 220, H = 200, pad = 34;
  const sc = (Math.min(W, H) - 2 * pad) / Math.max(s.d, s.bf);
  const cx = W / 2, cy = H / 2;
  const INK = '#221e17';
  const bw = s.bf * sc, hh = s.d * sc, tf = s.tf * sc, tw = s.tw * sc, x0 = cx - bw / 2, y0 = cy - hh / 2;
  const pts = [[x0, y0], [x0 + bw, y0], [x0 + bw, y0 + tf], [cx + tw / 2, y0 + tf],
    [cx + tw / 2, y0 + hh - tf], [x0 + bw, y0 + hh - tf], [x0 + bw, y0 + hh], [x0, y0 + hh],
    [x0, y0 + hh - tf], [cx - tw / 2, y0 + hh - tf], [cx - tw / 2, y0 + tf], [x0, y0 + tf]]
    .map((p) => p.join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stl-svg" role="img" aria-label={`${s.designation} section`}>
      <polygon points={pts} fill="rgba(201,168,76,0.07)" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
      <line x1={cx} y1={y0 - 6} x2={cx} y2={y0 + hh + 6} stroke="#c9a84c" strokeWidth={0.8} strokeDasharray="4 3" />
      <text x={cx} y={H - 8} textAnchor="middle" className="stl-dim">d {fmt(s.d, 0)} · b {fmt(s.bf, 0)} mm</text>
    </svg>
  );
}

/* Mr vs unbraced-length curve (LTB) with current Lb marked */
function LTBCurve({ s, Fy, omega2, Lb, phiMp }: { s: CsaSection; Fy: number; omega2: number; Lb: number; phiMp: number }) {
  const W = 340, H = 190, mL = 40, mR = 12, mT = 14, mB = 26;
  const cls = useMemo(() => classify(s, Fy), [s, Fy]);
  const Lmax = 16; // m
  const pts = useMemo(() => {
    const arr: [number, number][] = [];
    for (let L = 0.3; L <= Lmax; L += 0.2) arr.push([L, kNm(flexure(s, Fy, L * 1000, omega2, cls).Mr)]);
    return arr;
  }, [s, Fy, omega2, cls]);
  const yMax = Math.max(phiMp * 1.08, ...pts.map((p) => p[1]));
  const px = (L: number) => mL + (L / Lmax) * (W - mL - mR);
  const py = (m: number) => mT + (1 - m / yMax) * (H - mT - mB);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ');
  const LbClamped = Math.min(Lb / 1000, Lmax);
  const MrAt = kNm(flexure(s, Fy, Lb, omega2, cls).Mr);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stl-chart" role="img" aria-label="Moment resistance vs unbraced length">
      {/* axes */}
      <line x1={mL} y1={py(0)} x2={W - mR} y2={py(0)} stroke="#cfc7b6" strokeWidth={1} />
      <line x1={mL} y1={mT} x2={mL} y2={py(0)} stroke="#cfc7b6" strokeWidth={1} />
      {/* phiMp plateau */}
      <line x1={mL} y1={py(phiMp)} x2={W - mR} y2={py(phiMp)} stroke="#c9a84c" strokeWidth={0.9} strokeDasharray="4 3" />
      <text x={W - mR} y={py(phiMp) - 4} textAnchor="end" className="stl-chart__lbl">φMp {fmt(phiMp, 0)}</text>
      {/* curve */}
      <path d={path} fill="none" stroke="#221e17" strokeWidth={1.6} />
      {/* current Lb marker */}
      <line x1={px(LbClamped)} y1={mT} x2={px(LbClamped)} y2={py(0)} stroke="#8a1c1c" strokeWidth={0.9} strokeDasharray="3 3" />
      <circle cx={px(LbClamped)} cy={py(MrAt)} r={3.4} fill="#8a1c1c" />
      <text x={px(LbClamped)} y={py(MrAt) - 7} textAnchor="middle" className="stl-chart__lbl stl-chart__lbl--mark">{fmt(MrAt, 0)}</text>
      {/* axis labels */}
      <text x={(mL + W - mR) / 2} y={H - 4} textAnchor="middle" className="stl-chart__ax">Unbraced length Lb (m)</text>
      <text x={mL - 4} y={mT + 2} textAnchor="end" className="stl-chart__lbl">{fmt(yMax, 0)}</text>
      <text x={mL - 4} y={py(0)} textAnchor="end" className="stl-chart__lbl">0</text>
    </svg>
  );
}

/* ── main ─────────────────────────────────────────────────────────────── */
export function CsaBeamCalculator() {
  const [family, setFamily] = useState<IFamily>('W');
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toUpperCase();
    return ALL.filter((e) => e.family === family && (!q || e.designation.toUpperCase().includes(q) || e.imperial.toUpperCase().includes(q)));
  }, [family, query]);
  const [desig, setDesig] = useState('W360×64');
  const section = useMemo(() => list.find((e) => e.designation === desig) ?? list[0] ?? ALL.find((e) => e.family === family)!, [list, desig, family]);

  const [gradeId, setGradeId] = useState('350W');
  const grade = GRADES.find((g) => g.id === gradeId)!;
  const [cFy, setCFy] = useState(350), [cFu, setCFu] = useState(450);
  const Fy = gradeId === 'custom' ? cFy : grade.Fy;
  const Fu = gradeId === 'custom' ? cFu : grade.Fu;

  const [Lb, setLb] = useState(4);       // m
  const [omega2, setOmega2] = useState(1);
  const [aStiff, setAStiff] = useState(0); // m, 0 = unstiffened

  const [Mf, setMf] = useState(250);     // kN·m
  const [Vf, setVf] = useState(300);     // kN

  const [deflCase, setDeflCase] = useState<DeflCase>('ss-udl');
  const [wServ, setWServ] = useState(18); // kN/m
  const [pServ, setPServ] = useState(60); // kN
  const [Lspan, setLspan] = useState(6);  // m
  const [deflDen, setDeflDen] = useState(360);
  const caseMeta = DEFL_CASES.find((c) => c.id === deflCase)!;

  const inp: BeamInputs = useMemo(() => ({
    section, material: { Fy, Fu },
    Lb: Lb * 1000, omega2, a: aStiff * 1000,
    Mf: Mf * 1e6, Vf: Vf * 1e3,
    deflCase, wService: wServ /* kN/m == N/mm */, Pservice: pServ * 1e3, Lspan: Lspan * 1000, deflDen,
  }), [section, Fy, Fu, Lb, omega2, aStiff, Mf, Vf, deflCase, wServ, pServ, Lspan, deflDen]);

  const r = useMemo(() => analyzeBeam(inp), [inp]);
  const cls = r.classification, fx = r.flexure, sh = r.shear, df = r.deflection;
  const govPass = r.governing.ratio <= 1.0;
  const phiMp = kNm(0.9 * section.Zx * Fy);

  return (
    <div className="stl">
      <div className="stl-sheethead">
        <div>
          <div className="stl-brand">TERCERO TABLADA</div>
          <div className="stl-brand-sub">Civil &amp; Structural Engineering Inc.</div>
        </div>
        <div className="stl-sheettitle">
          <strong>STEEL I-BEAM DESIGN</strong>
          <span className="stl-code">CSA S16-14 · LSD</span>
        </div>
      </div>

      <div className="stl-grid">
        <aside className="stl-inputs">
          <h3 className="stl-h">Section</h3>
          <div className="stl-field">
            <label htmlFor="csa-fam">Family</label>
            <select id="csa-fam" value={family} onChange={(e) => { const f = e.target.value as IFamily; setFamily(f); setQuery(''); const first = ALL.find((x) => x.family === f); if (first) setDesig(first.designation); }}>
              {FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.label} ({ALL.filter((x) => x.family === f.id).length})</option>)}
            </select>
          </div>
          <div className="stl-field">
            <label htmlFor="csa-search">Filter</label>
            <input id="csa-search" type="search" placeholder="e.g. W360 or W14" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="stl-field">
            <label htmlFor="csa-des">Designation ({list.length})</label>
            <select id="csa-des" size={6} value={section.designation} onChange={(e) => setDesig(e.target.value)} className="stl-listbox">
              {list.slice(0, 400).map((e) => <option key={e.designation} value={e.designation}>{e.designation}  ·  {e.imperial}</option>)}
            </select>
          </div>
          <SectionSVG s={section} />
          <div className="stl-props">
            <span>Zx <strong>{fmt(section.Zx / 1e3, 0)}</strong> ×10³</span>
            <span>Sx <strong>{fmt(section.Sx / 1e3, 0)}</strong> ×10³</span>
            <span>Ix <strong>{fmt(section.Ix / 1e6, 0)}</strong> ×10⁶</span>
            <span>ry <strong>{fmt(section.ry, 1)}</strong> mm</span>
          </div>

          <h3 className="stl-h">Material</h3>
          <div className="stl-field">
            <label htmlFor="csa-grade">Grade</label>
            <select id="csa-grade" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
              {GRADES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </div>
          {gradeId === 'custom' ? (
            <div className="stl-row2"><Num label="Fy" unit="MPa" value={cFy} onChange={setCFy} /><Num label="Fu" unit="MPa" value={cFu} onChange={setCFu} /></div>
          ) : (<p className="stl-note">Fy = {Fy} MPa · Fu = {Fu} MPa</p>)}

          <h3 className="stl-h">Length &amp; bracing</h3>
          <div className="stl-row2"><Num label="Lb — unbraced" unit="m" value={Lb} onChange={setLb} /><Num label="ω₂" value={omega2} onChange={setOmega2} step="0.05" hint="1.0 for UDL / uniform M" /></div>
          <Num label="Stiffener spacing a" unit="m" value={aStiff} onChange={setAStiff} hint="0 = unstiffened web" />

          <h3 className="stl-h">Factored demands (ULS)</h3>
          <div className="stl-row2"><Num label="Mf" unit="kN·m" value={Mf} onChange={setMf} /><Num label="Vf" unit="kN" value={Vf} onChange={setVf} /></div>

          <h3 className="stl-h">Serviceability (deflection)</h3>
          <div className="stl-field">
            <label htmlFor="csa-case">Load case</label>
            <select id="csa-case" value={deflCase} onChange={(e) => setDeflCase(e.target.value as DeflCase)}>
              {DEFL_CASES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="stl-row2">
            {caseMeta.load === 'w'
              ? <Num label="Service w" unit="kN/m" value={wServ} onChange={setWServ} />
              : <Num label="Service P" unit="kN" value={pServ} onChange={setPServ} />}
            <Num label="Span L" unit="m" value={Lspan} onChange={setLspan} />
          </div>
          <div className="stl-field">
            <label htmlFor="csa-lim">Deflection limit</label>
            <select id="csa-lim" value={deflDen} onChange={(e) => setDeflDen(parseInt(e.target.value, 10))}>
              {DEFL_LIMITS.map((l) => <option key={l.den} value={l.den}>{l.label}</option>)}
            </select>
          </div>
        </aside>

        <section className="stl-results">
          <div className={`stl-verdict ${govPass ? 'is-pass' : 'is-fail'}`}>
            <div className="stl-verdict__mark">{govPass ? '✓' : '✗'}</div>
            <div>
              <strong>{govPass ? 'Beam adequate' : 'Beam OVERSTRESSED'}</strong>
              <span>{section.designation} ({section.imperial}) · Class {cls.overall} · governing: {r.governing.name}</span>
            </div>
            <div className="stl-verdict__ratio">{fmt(r.governing.ratio * 100, 0)}%</div>
          </div>

          <div className="stl-bars">
            <Bar label="Flexure — Mf / Mr" ratio={r.flexUtil} />
            <Bar label="Shear — Vf / Vr" ratio={r.shearUtil} />
            <Bar label="Deflection — δ / δlim" ratio={r.deflUtil} />
          </div>

          <div className="stl-cards">
            <div className="stl-card">
              <h4>Section classification <span className="stl-tag">Cl. 11 / Table 1</span></h4>
              <table className="stl-table"><tbody>
                <Row k="Flange bel/t" v={fmt(cls.flangeBT, 1)} ref={`Class ${cls.flangeClass} (≤ ${fmt(cls.flangeLimits[cls.flangeClass <= 3 ? cls.flangeClass - 1 : 2], 1)})`} />
                <Row k="Web h/w" v={fmt(cls.webHW, 1)} ref={`Class ${cls.webClass} (≤ ${fmt(cls.webLimits[cls.webClass <= 3 ? cls.webClass - 1 : 2], 1)})`} />
                <Row k="Overall class" v={<span className={`stl-cls stl-cls--${cls.overall <= 2 ? 'compact' : cls.overall === 3 ? 'noncompact' : 'slender'}`}>Class {cls.overall}</span>} ref={cls.overall <= 2 ? 'plastic/compact' : cls.overall === 3 ? 'non-compact' : 'slender'} />
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>Flexural resistance <span className="stl-tag">{fx.clause}</span></h4>
              <table className="stl-table"><tbody>
                <Row k="Mp = Zx·Fy" v={fmt(kNm(fx.Mp), 0)} unit="kN·m" />
                <Row k="My = Sx·Fy" v={fmt(kNm(fx.My), 0)} unit="kN·m" />
                <Row k="Mu (elastic LTB)" v={fmt(kNm(fx.Mu), 0)} unit="kN·m" ref="13.6" />
                <Row k="Governing mode" v={fx.governs === 'LTB' ? `LTB (${fx.ltbMode})` : 'Yielding'} />
                <Row k="Mr" v={<strong>{fmt(kNm(fx.Mr), 0)}</strong>} unit="kN·m" ref="φ = 0.90" />
                <Row k="Demand Mf" v={fmt(Mf, 0)} unit="kN·m" />
              </tbody></table>
              {fx.classNote ? <p className="stl-note">{fx.classNote}</p> : null}
            </div>

            <div className="stl-card">
              <h4>Shear resistance <span className="stl-tag">{sh.clause}</span></h4>
              <table className="stl-table"><tbody>
                <Row k="h/w" v={fmt(sh.hw, 1)} ref={sh.stiffened ? `kv = ${fmt(sh.kv, 2)}` : 'unstiffened'} />
                <Row k="Fs" v={fmt(sh.Fs, 0)} unit="MPa" ref={sh.mode} />
                <Row k="Aw = d·w" v={fmt(sh.Aw, 0)} unit="mm²" />
                <Row k="Vr" v={<strong>{fmt(kN(sh.Vr), 0)}</strong>} unit="kN" ref="φ = 0.90" />
                <Row k="Demand Vf" v={fmt(Vf, 0)} unit="kN" />
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>Serviceability deflection <span className="stl-tag">SLS</span></h4>
              <table className="stl-table"><tbody>
                <Row k="δ (specified loads)" v={<strong>{fmt(df.delta, 1)}</strong>} unit="mm" ref={df.formula} />
                <Row k="Limit L/" v={`${deflDen}`} unit={`= ${fmt(df.limit, 1)} mm`} />
                <Row k="Span / δ" v={fmt(df.ratioSpan, 0)} ref={`≥ ${deflDen}`} />
              </tbody></table>
            </div>

            <div className="stl-card stl-card--wide">
              <h4>Moment resistance vs unbraced length <span className="stl-tag">Cl. 13.6</span></h4>
              <LTBCurve s={section} Fy={Fy} omega2={omega2} Lb={Lb * 1000} phiMp={phiMp} />
            </div>
          </div>

          <p className="stl-disclaimer">
            CSA S16-14 (Limit States Design). Hot-rolled doubly-symmetric I-sections in major-axis bending.
            Unbraced length Lb, ω₂ and factored demands are user inputs — verify bracing, load combinations
            (NBCC) and web bearing/crippling independently. Deflection is a serviceability check under specified
            (unfactored) loads. Engineering judgment and a licensed P.Eng. review remain required.
          </p>
        </section>
      </div>
    </div>
  );
}
