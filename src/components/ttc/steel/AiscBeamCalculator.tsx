'use client';

import React, { useId, useMemo, useState } from 'react';
import aiscDb from '@/lib/steel/aisc-shapes.json';
import { flexureMajor, type SteelSection, type MemberInputs } from '@/lib/steel/aisc360';
import { analyzeBeam, type BeamInputs, type DeflCase } from '@/lib/steel/aisc360-beam';

const ALL: SteelSection[] = (aiscDb as { shapes: SteelSection[] }).shapes.filter((s) => s.family === 'W' || s.family === 'S');
const FAMILIES: { id: 'W' | 'S'; label: string }[] = [
  { id: 'W', label: 'W — Wide Flange' },
  { id: 'S', label: 'S — Standard Beam' },
];

const GRADES = [
  { id: 'A992', label: 'ASTM A992 (W-shapes)', Fy: 50, Fu: 65 },
  { id: 'A572-50', label: 'ASTM A572 Gr. 50', Fy: 50, Fu: 65 },
  { id: 'A36', label: 'ASTM A36', Fy: 36, Fu: 58 },
  { id: 'custom', label: 'Custom…', Fy: 50, Fu: 65 },
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
const kft = (kin: number) => kin / 12; // kip·in → kip·ft
const INK = '#221e17', GOLD = '#c9a84c', GOLDD = '#9a7a2c', LINE = '#cfc7b6', MARK = '#8a1c1c';

/* ── controls ─────────────────────────────────────────────────────────── */
function Num({ label, unit, value, onChange, step = 'any', hint }: {
  label: string; unit?: string; value: number; onChange: (v: number) => void; step?: string; hint?: string;
}) {
  const id = useId();
  return (
    <div className="stl-field">
      <label htmlFor={id}>{label} {unit ? <span className="stl-unit">({unit})</span> : null}</label>
      <input id={id} type="number" step={step} value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(parseFloat(e.target.value))} />
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
      <div className="stl-bar__track"><div className={`stl-bar__fill stl-bar__fill--${state}`} style={{ width: `${pct}%` }} /><div className="stl-bar__limit" /></div>
    </div>
  );
}
function Row({ k, v, unit, ref }: { k: string; v: React.ReactNode; unit?: string; ref?: string }) {
  return (<tr><td className="stl-k">{k}</td><td className="stl-v">{v}{unit ? <span className="stl-unit"> {unit}</span> : null}</td><td className="stl-ref">{ref}</td></tr>);
}

/* I-section drawing (inches) */
function SectionSVG({ s }: { s: SteelSection }) {
  const W = 220, H = 200, pad = 34;
  const sc = (Math.min(W, H) - 2 * pad) / Math.max(s.d, s.bf);
  const cx = W / 2, cy = H / 2;
  const bw = s.bf * sc, hh = s.d * sc, tf = s.tf * sc, tw = s.tw * sc, x0 = cx - bw / 2, y0 = cy - hh / 2;
  const pts = [[x0, y0], [x0 + bw, y0], [x0 + bw, y0 + tf], [cx + tw / 2, y0 + tf],
    [cx + tw / 2, y0 + hh - tf], [x0 + bw, y0 + hh - tf], [x0 + bw, y0 + hh], [x0, y0 + hh],
    [x0, y0 + hh - tf], [cx - tw / 2, y0 + hh - tf], [cx - tw / 2, y0 + tf], [x0, y0 + tf]]
    .map((p) => p.join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stl-svg" role="img" aria-label={`${s.designation} section`}>
      <polygon points={pts} fill="rgba(201,168,76,0.07)" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
      <line x1={cx} y1={y0 - 6} x2={cx} y2={y0 + hh + 6} stroke={GOLD} strokeWidth={0.8} strokeDasharray="4 3" />
      <text x={cx} y={H - 8} textAnchor="middle" className="stl-dim">d {fmt(s.d, 1)}″ · bf {fmt(s.bf, 1)}″</text>
    </svg>
  );
}

/* φMn vs unbraced-length curve (LTB, Ch F2) with Lp/Lr and current Lb marked */
function LTBCurve({ section, Fy, Cb, Lb_ft, Lp_ft, Lr_ft }: { section: SteelSection; Fy: number; Cb: number; Lb_ft: number; Lp_ft: number; Lr_ft: number }) {
  const W = 360, H = 200, mL = 44, mR = 14, mT = 14, mB = 28;
  const Lmax = Math.max(40, Math.ceil((Lr_ft * 1.4) / 5) * 5);
  const base: MemberInputs = {
    section, material: { Fy, Fu: 65 }, Lcx: 0, Lcy: 0, Lcz: 0, Lb: 0, Cb, An: section.A, U: 1, Pu: 0, Mux: 0, Muy: 0, Vu: 0,
  };
  const phiMnAt = (L_ft: number) => kft(flexureMajor({ ...base, Lb: L_ft * 12 }).phiRn);
  const phiMp = kft(0.9 * section.Zx * Fy);
  const pts = useMemo(() => {
    const arr: [number, number][] = [];
    for (let L = 0.5; L <= Lmax; L += 0.5) arr.push([L, phiMnAt(L)]);
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, Fy, Cb, Lmax]);
  const yMax = Math.max(phiMp * 1.08, ...pts.map((p) => p[1]));
  const px = (L: number) => mL + (L / Lmax) * (W - mL - mR);
  const py = (m: number) => mT + (1 - m / yMax) * (H - mT - mB);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ');
  const LbC = Math.min(Lb_ft, Lmax);
  const MnAt = phiMnAt(Lb_ft);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stl-chart" role="img" aria-label="Design moment vs unbraced length">
      <line x1={mL} y1={py(0)} x2={W - mR} y2={py(0)} stroke={LINE} strokeWidth={1} />
      <line x1={mL} y1={mT} x2={mL} y2={py(0)} stroke={LINE} strokeWidth={1} />
      {/* φMp plateau */}
      <line x1={mL} y1={py(phiMp)} x2={W - mR} y2={py(phiMp)} stroke={GOLD} strokeWidth={0.9} strokeDasharray="4 3" />
      <text x={W - mR} y={py(phiMp) - 4} textAnchor="end" className="stl-chart__lbl" style={{ fill: GOLDD }}>φMp {fmt(phiMp, 0)}</text>
      {/* Lp / Lr guides */}
      {[[Lp_ft, 'Lp'], [Lr_ft, 'Lr']].map(([L, t]) => (L as number) < Lmax ? (
        <g key={t as string}>
          <line x1={px(L as number)} y1={py(0)} x2={px(L as number)} y2={py(0) + 4} stroke={INK} strokeWidth={0.9} />
          <text x={px(L as number)} y={py(0) + 14} textAnchor="middle" className="stl-chart__ax">{t}</text>
        </g>
      ) : null)}
      <path d={path} fill="none" stroke={INK} strokeWidth={1.6} />
      {/* current Lb */}
      <line x1={px(LbC)} y1={mT} x2={px(LbC)} y2={py(0)} stroke={MARK} strokeWidth={0.9} strokeDasharray="3 3" />
      <circle cx={px(LbC)} cy={py(MnAt)} r={3.4} fill={MARK} />
      <text x={px(LbC)} y={py(MnAt) - 7} textAnchor="middle" className="stl-chart__lbl" style={{ fill: MARK, fontWeight: 600 }}>{fmt(MnAt, 0)}</text>
      <text x={(mL + W - mR) / 2} y={H - 4} textAnchor="middle" className="stl-chart__ax">Unbraced length Lb (ft) · φMn (kip·ft)</text>
      <text x={mL - 4} y={mT + 2} textAnchor="end" className="stl-chart__lbl">{fmt(yMax, 0)}</text>
      <text x={mL - 4} y={py(0)} textAnchor="end" className="stl-chart__lbl">0</text>
    </svg>
  );
}

/* ── main ─────────────────────────────────────────────────────────────── */
export function AiscBeamCalculator() {
  const [family, setFamily] = useState<'W' | 'S'>('W');
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toUpperCase().replace(/\s/g, '');
    return ALL.filter((e) => e.family === family && (!q || e.designation.toUpperCase().replace(/\s/g, '').includes(q)));
  }, [family, query]);
  const [desig, setDesig] = useState('W18X50');
  const section = useMemo(() => list.find((e) => e.designation === desig) ?? list[0] ?? ALL.find((e) => e.family === family)!, [list, desig, family]);

  const [gradeId, setGradeId] = useState('A992');
  const grade = GRADES.find((g) => g.id === gradeId)!;
  const [cFy, setCFy] = useState(50), [cFu, setCFu] = useState(65);
  const Fy = gradeId === 'custom' ? cFy : grade.Fy;
  const Fu = gradeId === 'custom' ? cFu : grade.Fu;

  const [Lb, setLb] = useState(6);     // ft
  const [Cb, setCb] = useState(1);
  const [Mu, setMu] = useState(200);   // kip·ft
  const [Vu, setVu] = useState(40);    // kips

  const [deflCase, setDeflCase] = useState<DeflCase>('ss-udl');
  const [wServ, setWServ] = useState(2);  // kip/ft
  const [pServ, setPServ] = useState(15); // kips
  const [Lspan, setLspan] = useState(25); // ft
  const [deflDen, setDeflDen] = useState(360);
  const caseMeta = DEFL_CASES.find((c) => c.id === deflCase)!;

  const inp: BeamInputs = useMemo(() => ({
    section, material: { Fy, Fu },
    Lb: Lb * 12, Cb, Mu: Mu * 12, Vu,
    deflCase, wService: wServ / 12, Pservice: pServ, Lspan: Lspan * 12, deflDen,
  }), [section, Fy, Fu, Lb, Cb, Mu, Vu, deflCase, wServ, pServ, Lspan, deflDen]);

  const r = useMemo(() => analyzeBeam(inp), [inp]);
  const fx = r.flexure, sh = r.shear, df = r.deflection, cls = r.classification;
  const govPass = r.governing.ratio <= 1.0;
  const deflInches = df.delta;

  return (
    <div className="stl">
      <div className="stl-sheethead">
        <div>
          <div className="stl-brand">TERCERO TABLADA</div>
          <div className="stl-brand-sub">Civil &amp; Structural Engineering Inc.</div>
        </div>
        <div className="stl-sheettitle">
          <strong>STEEL I-BEAM DESIGN</strong>
          <span className="stl-code">AISC 360-16 · LRFD</span>
        </div>
      </div>

      <div className="stl-grid">
        <aside className="stl-inputs">
          <h3 className="stl-h">Section</h3>
          <div className="stl-field">
            <label htmlFor="ab-fam">Family</label>
            <select id="ab-fam" value={family} onChange={(e) => { const f = e.target.value as 'W' | 'S'; setFamily(f); setQuery(''); const first = ALL.find((x) => x.family === f); if (first) setDesig(first.designation); }}>
              {FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.label} ({ALL.filter((x) => x.family === f.id).length})</option>)}
            </select>
          </div>
          <div className="stl-field">
            <label htmlFor="ab-search">Filter</label>
            <input id="ab-search" type="search" placeholder="e.g. W18 or W14X22" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="stl-field">
            <label htmlFor="ab-des">Designation ({list.length})</label>
            <select id="ab-des" size={6} value={section.designation} onChange={(e) => setDesig(e.target.value)} className="stl-listbox">
              {list.slice(0, 500).map((e) => <option key={e.designation} value={e.designation}>{e.designation}  ·  {fmt((e as { weight?: number }).weight ?? e.A * 3.4, 0)} plf</option>)}
            </select>
          </div>
          <SectionSVG s={section} />
          <div className="stl-props">
            <span>Zx <strong>{fmt(section.Zx, 0)}</strong> in³</span>
            <span>Sx <strong>{fmt(section.Sx, 0)}</strong> in³</span>
            <span>Ix <strong>{fmt(section.Ix, 0)}</strong> in⁴</span>
            <span>ry <strong>{fmt(section.ry, 2)}</strong> in</span>
          </div>

          <h3 className="stl-h">Material</h3>
          <div className="stl-field">
            <label htmlFor="ab-grade">Grade</label>
            <select id="ab-grade" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
              {GRADES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </div>
          {gradeId === 'custom' ? (
            <div className="stl-row2"><Num label="Fy" unit="ksi" value={cFy} onChange={setCFy} /><Num label="Fu" unit="ksi" value={cFu} onChange={setCFu} /></div>
          ) : (<p className="stl-note">Fy = {Fy} ksi · Fu = {Fu} ksi</p>)}

          <h3 className="stl-h">Length &amp; bracing</h3>
          <div className="stl-row2"><Num label="Lb — unbraced" unit="ft" value={Lb} onChange={setLb} /><Num label="Cb" value={Cb} onChange={setCb} step="0.05" hint="1.0 conservative; 1.14 UDL simple span" /></div>

          <h3 className="stl-h">Factored demands (LRFD)</h3>
          <div className="stl-row2"><Num label="Mu" unit="kip·ft" value={Mu} onChange={setMu} /><Num label="Vu" unit="kips" value={Vu} onChange={setVu} /></div>

          <h3 className="stl-h">Serviceability (deflection)</h3>
          <div className="stl-field">
            <label htmlFor="ab-case">Load case</label>
            <select id="ab-case" value={deflCase} onChange={(e) => setDeflCase(e.target.value as DeflCase)}>
              {DEFL_CASES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="stl-row2">
            {caseMeta.load === 'w'
              ? <Num label="Service w" unit="kip/ft" value={wServ} onChange={setWServ} />
              : <Num label="Service P" unit="kips" value={pServ} onChange={setPServ} />}
            <Num label="Span L" unit="ft" value={Lspan} onChange={setLspan} />
          </div>
          <div className="stl-field">
            <label htmlFor="ab-lim">Deflection limit</label>
            <select id="ab-lim" value={deflDen} onChange={(e) => setDeflDen(parseInt(e.target.value, 10))}>
              {DEFL_LIMITS.map((l) => <option key={l.den} value={l.den}>{l.label}</option>)}
            </select>
          </div>
        </aside>

        <section className="stl-results">
          <div className={`stl-verdict ${govPass ? 'is-pass' : 'is-fail'}`}>
            <div className="stl-verdict__mark">{govPass ? '✓' : '✗'}</div>
            <div>
              <strong>{govPass ? 'Beam adequate' : 'Beam OVERSTRESSED'}</strong>
              <span>{section.designation} · {r.overallClass} · governing: {r.governing.name}</span>
            </div>
            <div className="stl-verdict__ratio">{fmt(r.governing.ratio * 100, 0)}%</div>
          </div>

          <div className="stl-bars">
            <Bar label="Flexure — Mu / φMn" ratio={r.flexUtil} />
            <Bar label="Shear — Vu / φVn" ratio={r.shearUtil} />
            <Bar label="Deflection — δ / δlim" ratio={r.deflUtil} />
          </div>

          <div className="stl-cards">
            <div className="stl-card">
              <h4>Section classification <span className="stl-tag">Table B4.1b</span></h4>
              <table className="stl-table"><tbody>
                <Row k="Flange bf/2tf" v={fmt(cls.flangeLambda, 1)} ref={`${cls.flangeClassFlex} (λp ${fmt(cls.lpf, 1)} · λr ${fmt(cls.lrf, 1)})`} />
                <Row k="Web h/tw" v={fmt(cls.webLambda, 1)} ref={`${cls.webClassFlex} (λp ${fmt(cls.lpw, 1)} · λr ${fmt(cls.lrw, 1)})`} />
                <Row k="Overall" v={<span className={`stl-cls stl-cls--${r.overallClass}`}>{r.overallClass}</span>} ref={r.overallClass === 'compact' ? 'Mp attainable' : r.overallClass === 'noncompact' ? 'FLB reduces Mn' : 'slender'} />
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>Flexural strength <span className="stl-tag">{fx.clause}</span></h4>
              <table className="stl-table"><tbody>
                <Row k="Mp = Zx·Fy" v={fmt(kft(fx.Mp), 0)} unit="kip·ft" />
                <Row k="Lp" v={fmt((fx.Lp ?? 0) / 12, 2)} unit="ft" ref="F2-5" />
                <Row k="Lr" v={fmt((fx.Lr ?? 0) / 12, 2)} unit="ft" ref="F2-6" />
                <Row k="Governing mode" v={fx.governs} />
                <Row k="φMn" v={<strong>{fmt(kft(fx.phiRn), 0)}</strong>} unit="kip·ft" ref="φb = 0.90" />
                <Row k="Demand Mu" v={fmt(Mu, 0)} unit="kip·ft" />
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>Shear strength <span className="stl-tag">{sh.clause}</span></h4>
              <table className="stl-table"><tbody>
                <Row k="h/tw" v={fmt(cls.webLambda, 1)} ref={sh.detail} />
                <Row k="Aw = d·tw" v={fmt(section.d * section.tw, 2)} unit="in²" />
                <Row k="Vn = 0.6FyAwCv1" v={fmt(sh.Rn, 0)} unit="kips" />
                <Row k="φVn" v={<strong>{fmt(sh.phiRn, 0)}</strong>} unit="kips" />
                <Row k="Demand Vu" v={fmt(Vu, 0)} unit="kips" />
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>Serviceability deflection <span className="stl-tag">SLS</span></h4>
              <table className="stl-table"><tbody>
                <Row k="δ (service loads)" v={<strong>{fmt(deflInches, 2)}</strong>} unit="in" ref={df.formula} />
                <Row k="Limit L/" v={`${deflDen}`} unit={`= ${fmt(df.limit, 2)} in`} />
                <Row k="Span / δ" v={Number.isFinite(df.ratioSpan) ? fmt(df.ratioSpan, 0) : '∞'} ref={`≥ ${deflDen}`} />
              </tbody></table>
            </div>

            <div className="stl-card stl-card--wide">
              <h4>Design moment vs unbraced length <span className="stl-tag">Ch. F2 · LTB</span></h4>
              <LTBCurve section={section} Fy={Fy} Cb={Cb} Lb_ft={Lb} Lp_ft={(fx.Lp ?? 0) / 12} Lr_ft={(fx.Lr ?? 0) / 12} />
            </div>
          </div>

          <p className="stl-disclaimer">
            AISC 360-16 (LRFD). Hot-rolled doubly-symmetric W and S shapes in major-axis bending — flexural yielding /
            lateral-torsional buckling (Ch. F2) with flange local buckling (F3), shear (Ch. G2.1), and elastic
            serviceability deflection. Lb, Cb and factored demands are user inputs — verify bracing, load combinations,
            web local yielding/crippling and biaxial or combined effects independently. Shear uses a conservative
            fillet-free web height h ≈ d − 2tf; a licensed P.E. review remains required.
          </p>
        </section>
      </div>
    </div>
  );
}
