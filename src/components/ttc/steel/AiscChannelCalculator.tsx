'use client';

import React, { useId, useMemo, useState } from 'react';
import channelDb from '@/lib/steel/channel-shapes.json';
import {
  analyzeChannel, flexureChannelMajor,
  type ChannelSection, type ChannelInputs, type DeflCase,
} from '@/lib/steel/aisc360-channel';

const ALL: ChannelSection[] = (channelDb as { shapes: ChannelSection[] }).shapes;
const FAMILIES: { id: 'C' | 'MC'; label: string }[] = [
  { id: 'C', label: 'C — Standard channel' },
  { id: 'MC', label: 'MC — Miscellaneous channel' },
];
const GRADES = [
  { id: 'A36', label: 'ASTM A36', Fy: 36, Fu: 58 },
  { id: 'A572-50', label: 'ASTM A572 Gr. 50', Fy: 50, Fu: 65 },
  { id: 'custom', label: 'Custom…', Fy: 36, Fu: 58 },
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
const kft = (kin: number) => kin / 12;
const INK = '#221e17', GOLD = '#c9a84c', GOLDD = '#9a7a2c', LINE = '#cfc7b6', MARK = '#8a1c1c';

function Num({ label, unit, value, onChange, step = 'any', hint }: { label: string; unit?: string; value: number; onChange: (v: number) => void; step?: string; hint?: string }) {
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

/* Channel (C) section drawing — web left, flanges opening right */
function SectionSVG({ s }: { s: ChannelSection }) {
  const W = 220, H = 200, pad = 40;
  const sc = (Math.min(W, H) - 2 * pad) / Math.max(s.d, s.bf);
  const bw = s.bf * sc, hh = s.d * sc, tf = s.tf * sc, tw = s.tw * sc;
  const x0 = W / 2 - bw / 2, y0 = H / 2 - hh / 2;
  const pts = [
    [x0, y0], [x0 + bw, y0], [x0 + bw, y0 + tf], [x0 + tw, y0 + tf],
    [x0 + tw, y0 + hh - tf], [x0 + bw, y0 + hh - tf], [x0 + bw, y0 + hh], [x0, y0 + hh],
  ].map((p) => p.join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stl-svg" role="img" aria-label={`${s.designation} section`}>
      <polygon points={pts} fill="rgba(201,168,76,0.07)" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
      <line x1={x0 - 6} y1={H / 2} x2={x0 + bw + 6} y2={H / 2} stroke={GOLD} strokeWidth={0.8} strokeDasharray="4 3" />
      <text x={W / 2} y={H - 8} textAnchor="middle" className="stl-dim">d {fmt(s.d, 1)}″ · bf {fmt(s.bf, 2)}″</text>
    </svg>
  );
}

/* φMn vs unbraced-length curve (LTB, Ch F2) */
function LTBCurve({ section, Fy, Cb, Lb_ft, Lp_ft, Lr_ft }: { section: ChannelSection; Fy: number; Cb: number; Lb_ft: number; Lp_ft: number; Lr_ft: number }) {
  const W = 360, H = 200, mL = 44, mR = 14, mT = 14, mB = 28;
  const Lmax = Math.max(30, Math.ceil((Lr_ft * 1.5) / 5) * 5);
  const phiMnAt = (L_ft: number) => kft(flexureChannelMajor(section, Fy, L_ft * 12, Cb).phiMn);
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
  const LbC = Math.min(Lb_ft, Lmax), MnAt = phiMnAt(Lb_ft);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stl-chart" role="img" aria-label="Design moment vs unbraced length">
      <line x1={mL} y1={py(0)} x2={W - mR} y2={py(0)} stroke={LINE} strokeWidth={1} />
      <line x1={mL} y1={mT} x2={mL} y2={py(0)} stroke={LINE} strokeWidth={1} />
      <line x1={mL} y1={py(phiMp)} x2={W - mR} y2={py(phiMp)} stroke={GOLD} strokeWidth={0.9} strokeDasharray="4 3" />
      <text x={W - mR} y={py(phiMp) - 4} textAnchor="end" className="stl-chart__lbl" style={{ fill: GOLDD }}>φMp {fmt(phiMp, 0)}</text>
      {[[Lp_ft, 'Lp'], [Lr_ft, 'Lr']].map(([L, t]) => (L as number) < Lmax ? (
        <g key={t as string}>
          <line x1={px(L as number)} y1={py(0)} x2={px(L as number)} y2={py(0) + 4} stroke={INK} strokeWidth={0.9} />
          <text x={px(L as number)} y={py(0) + 14} textAnchor="middle" className="stl-chart__ax">{t}</text>
        </g>
      ) : null)}
      <path d={path} fill="none" stroke={INK} strokeWidth={1.6} />
      <line x1={px(LbC)} y1={mT} x2={px(LbC)} y2={py(0)} stroke={MARK} strokeWidth={0.9} strokeDasharray="3 3" />
      <circle cx={px(LbC)} cy={py(MnAt)} r={3.4} fill={MARK} />
      <text x={px(LbC)} y={py(MnAt) - 7} textAnchor="middle" className="stl-chart__lbl" style={{ fill: MARK, fontWeight: 600 }}>{fmt(MnAt, 0)}</text>
      <text x={(mL + W - mR) / 2} y={H - 4} textAnchor="middle" className="stl-chart__ax">Unbraced length Lb (ft) · φMn (kip·ft)</text>
      <text x={mL - 4} y={mT + 2} textAnchor="end" className="stl-chart__lbl">{fmt(yMax, 0)}</text>
      <text x={mL - 4} y={py(0)} textAnchor="end" className="stl-chart__lbl">0</text>
    </svg>
  );
}

export function AiscChannelCalculator() {
  const [family, setFamily] = useState<'C' | 'MC'>('C');
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toUpperCase().replace(/\s/g, '');
    return ALL.filter((e) => e.family === family && (!q || e.designation.toUpperCase().replace(/\s/g, '').includes(q)));
  }, [family, query]);
  const [desig, setDesig] = useState('C12X20.7');
  const section = useMemo(() => list.find((e) => e.designation === desig) ?? list[0] ?? ALL.find((e) => e.family === family)!, [list, desig, family]);

  const [gradeId, setGradeId] = useState('A36');
  const grade = GRADES.find((g) => g.id === gradeId)!;
  const [cFy, setCFy] = useState(36);
  const Fy = gradeId === 'custom' ? cFy : grade.Fy;

  const [Lb, setLb] = useState(5);       // ft
  const [Cb, setCb] = useState(1);
  const [Mu, setMu] = useState(50);      // kip·ft (major)
  const [Muy, setMuy] = useState(0);     // kip·ft (minor)
  const [Vu, setVu] = useState(20);      // kips
  const [Pu, setPu] = useState(0);       // kips (axial compression)
  const [KL, setKL] = useState(10);      // ft (compression effective length, all axes)

  const [deflCase, setDeflCase] = useState<DeflCase>('ss-udl');
  const [wServ, setWServ] = useState(1);  // kip/ft
  const [pServ, setPServ] = useState(8);  // kips
  const [Lspan, setLspan] = useState(15); // ft
  const [deflDen, setDeflDen] = useState(360);
  const caseMeta = DEFL_CASES.find((c) => c.id === deflCase)!;

  const inp: ChannelInputs = useMemo(() => ({
    section, Fy, Lb: Lb * 12, Cb,
    Mux: Mu * 12, Muy: Muy * 12, Vu, Pu, Lcx: KL * 12, Lcy: KL * 12, Lcz: KL * 12,
    deflCase, wService: wServ / 12, Pservice: pServ, Lspan: Lspan * 12, deflDen,
  }), [section, Fy, Lb, Cb, Mu, Muy, Vu, Pu, KL, deflCase, wServ, pServ, Lspan, deflDen]);

  const r = useMemo(() => analyzeChannel(inp), [inp]);
  const fx = r.flexMajor, sh = r.shear, cp = r.compression, df = r.deflection, cls = r.classification;
  const govPass = r.governing.ratio <= 1.0;

  return (
    <div className="stl">
      <div className="stl-sheethead">
        <div>
          <div className="stl-brand">TERCERO TABLADA</div>
          <div className="stl-brand-sub">Civil &amp; Structural Engineering Inc.</div>
        </div>
        <div className="stl-sheettitle">
          <strong>STEEL CHANNEL DESIGN</strong>
          <span className="stl-code">AISC 360-16 · LRFD</span>
        </div>
      </div>

      <div className="stl-grid">
        <aside className="stl-inputs">
          <h3 className="stl-h">Section</h3>
          <div className="stl-field">
            <label htmlFor="ac-fam">Family</label>
            <select id="ac-fam" value={family} onChange={(e) => { const f = e.target.value as 'C' | 'MC'; setFamily(f); setQuery(''); const first = ALL.find((x) => x.family === f); if (first) setDesig(first.designation); }}>
              {FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.label} ({ALL.filter((x) => x.family === f.id).length})</option>)}
            </select>
          </div>
          <div className="stl-field">
            <label htmlFor="ac-search">Filter</label>
            <input id="ac-search" type="search" placeholder="e.g. C12 or C15X33.9" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="stl-field">
            <label htmlFor="ac-des">Designation ({list.length})</label>
            <select id="ac-des" size={6} value={section.designation} onChange={(e) => setDesig(e.target.value)} className="stl-listbox">
              {list.map((e) => <option key={e.designation} value={e.designation}>{e.designation}  ·  {fmt(e.weight, 1)} plf</option>)}
            </select>
          </div>
          <SectionSVG s={section} />
          <div className="stl-props">
            <span>Zx <strong>{fmt(section.Zx, 1)}</strong> in³</span>
            <span>Sx <strong>{fmt(section.Sx, 1)}</strong> in³</span>
            <span>Ix <strong>{fmt(section.Ix, 0)}</strong> in⁴</span>
            <span>ry <strong>{fmt(section.ry, 2)}</strong> in</span>
          </div>

          <h3 className="stl-h">Material</h3>
          <div className="stl-field">
            <label htmlFor="ac-grade">Grade</label>
            <select id="ac-grade" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
              {GRADES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </div>
          {gradeId === 'custom' ? <Num label="Fy" unit="ksi" value={cFy} onChange={setCFy} /> : <p className="stl-note">Fy = {Fy} ksi (channels are typically A36)</p>}

          <h3 className="stl-h">Bending &amp; bracing</h3>
          <div className="stl-row2"><Num label="Lb — unbraced" unit="ft" value={Lb} onChange={setLb} /><Num label="Cb" value={Cb} onChange={setCb} step="0.05" hint="1.0 conservative" /></div>
          <div className="stl-row2"><Num label="Mu (major)" unit="kip·ft" value={Mu} onChange={setMu} /><Num label="Mu (minor)" unit="kip·ft" value={Muy} onChange={setMuy} /></div>
          <Num label="Vu — shear" unit="kips" value={Vu} onChange={setVu} />

          <h3 className="stl-h">Compression buckling</h3>
          <div className="stl-row2"><Num label="Pu — axial" unit="kips" value={Pu} onChange={setPu} hint="0 = beam only" /><Num label="KL (all axes)" unit="ft" value={KL} onChange={setKL} /></div>

          <h3 className="stl-h">Serviceability (deflection)</h3>
          <div className="stl-field">
            <label htmlFor="ac-case">Load case</label>
            <select id="ac-case" value={deflCase} onChange={(e) => setDeflCase(e.target.value as DeflCase)}>
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
            <label htmlFor="ac-lim">Deflection limit</label>
            <select id="ac-lim" value={deflDen} onChange={(e) => setDeflDen(parseInt(e.target.value, 10))}>
              {DEFL_LIMITS.map((l) => <option key={l.den} value={l.den}>{l.label}</option>)}
            </select>
          </div>
        </aside>

        <section className="stl-results">
          <div className={`stl-verdict ${govPass ? 'is-pass' : 'is-fail'}`}>
            <div className="stl-verdict__mark">{govPass ? '✓' : '✗'}</div>
            <div>
              <strong>{govPass ? 'Channel adequate' : 'Channel OVERSTRESSED'}</strong>
              <span>{section.designation} · {r.overallClass} · governing: {r.governing.name}</span>
            </div>
            <div className="stl-verdict__ratio">{fmt(r.governing.ratio * 100, 0)}%</div>
          </div>

          <div className="stl-bars">
            <Bar label="Flexure major — Mu / φMn" ratio={r.flexUtil} />
            <Bar label="Shear — Vu / φVn" ratio={r.shearUtil} />
            {Pu > 0 && <Bar label="Compression — Pu / φPn" ratio={r.comprUtil} />}
            {Pu > 0 && <Bar label={`Combined ${r.h1Eq} — axial + flexure`} ratio={r.h1Util} />}
            {Muy > 0 && <Bar label="Flexure minor — Muy / φMny" ratio={r.flexMinorUtil} />}
            <Bar label="Deflection — δ / δlim" ratio={r.deflUtil} />
          </div>

          <div className="stl-cards">
            <div className="stl-card">
              <h4>Classification <span className="stl-tag">Table B4.1b</span></h4>
              <table className="stl-table"><tbody>
                <Row k="Flange bf/tf" v={fmt(cls.flangeLambda, 1)} ref={`${cls.flangeClassFlex} (λp ${fmt(cls.lpf, 1)} · λr ${fmt(cls.lrf, 1)})`} />
                <Row k="Web h/tw" v={fmt(cls.webLambda, 1)} ref={`${cls.webClassFlex} (λp ${fmt(cls.lpw, 1)} · λr ${fmt(cls.lrw, 1)})`} />
                <Row k="Overall" v={<span className={`stl-cls stl-cls--${r.overallClass}`}>{r.overallClass}</span>} ref="b = full bf (channel)" />
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>Flexure (major) <span className="stl-tag">{fx.clause}</span></h4>
              <table className="stl-table"><tbody>
                <Row k="Mp = Zx·Fy" v={fmt(kft(fx.Mp), 1)} unit="kip·ft" />
                <Row k="c (F2-8b)" v={fmt(fx.c, 3)} ref="(ho/2)√(Iy/Cw)" />
                <Row k="Lp · Lr" v={`${fmt(fx.Lp / 12, 2)} · ${fmt(fx.Lr / 12, 2)}`} unit="ft" />
                <Row k="Governing" v={fx.governs} />
                <Row k="φMn" v={<strong>{fmt(kft(fx.phiMn), 1)}</strong>} unit="kip·ft" ref="φb = 0.90" />
                <Row k="Demand Mu" v={fmt(Mu, 1)} unit="kip·ft" />
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>Shear <span className="stl-tag">Ch. G2.1(b)</span></h4>
              <table className="stl-table"><tbody>
                <Row k="Aw = d·tw" v={fmt(section.d * section.tw, 2)} unit="in²" ref={sh.detail} />
                <Row k="Vn = 0.6FyAwCv1" v={fmt(sh.Vn, 1)} unit="kips" />
                <Row k="φVn" v={<strong>{fmt(sh.phiVn, 1)}</strong>} unit="kips" ref="φv = 0.90" />
                <Row k="Demand Vu" v={fmt(Vu, 1)} unit="kips" />
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>Compression <span className="stl-tag">Ch. E3 / E4</span></h4>
              <table className="stl-table"><tbody>
                <Row k="Fey (weak, E3)" v={fmt(cp.Fey, 1)} unit="ksi" />
                <Row k="Fe-FTB (E4)" v={fmt(cp.FeFTB, 1)} unit="ksi" ref="Fex ↔ Fez" />
                <Row k="Fcr · Ae" v={`${fmt(cp.Fcr, 2)} ksi · ${fmt(cp.Ae, 2)} in²`} ref={cp.mode} />
                <Row k="φPn" v={<strong>{fmt(cp.phiPn, 1)}</strong>} unit="kips" ref="φc = 0.90" />
                <Row k="Demand Pu" v={fmt(Pu, 1)} unit="kips" />
                {Pu > 0 && <Row k={`Combined ${r.h1Eq}`} v={<strong>{fmt(r.h1Util, 2)}</strong>} ref="≤ 1.0 (H1-1)" />}
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>Flexure (minor) <span className="stl-tag">Ch. F6</span></h4>
              <table className="stl-table"><tbody>
                <Row k="φMny" v={<strong>{fmt(kft(r.flexMinor.phiMn), 2)}</strong>} unit="kip·ft" ref={r.flexMinor.governs} />
                <Row k="Demand Muy" v={fmt(Muy, 2)} unit="kip·ft" />
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>Deflection <span className="stl-tag">SLS</span></h4>
              <table className="stl-table"><tbody>
                <Row k="δ (service)" v={<strong>{fmt(df.delta, 2)}</strong>} unit="in" ref={df.formula} />
                <Row k="Limit L/" v={`${deflDen}`} unit={`= ${fmt(df.limit, 2)} in`} />
                <Row k="Span / δ" v={Number.isFinite(df.ratioSpan) ? fmt(df.ratioSpan, 0) : '∞'} ref={`≥ ${deflDen}`} />
              </tbody></table>
            </div>

            <div className="stl-card stl-card--wide">
              <h4>Design moment vs unbraced length <span className="stl-tag">Ch. F2 · LTB (channel c)</span></h4>
              <LTBCurve section={section} Fy={Fy} Cb={Cb} Lb_ft={Lb} Lp_ft={fx.Lp / 12} Lr_ft={fx.Lr / 12} />
            </div>
          </div>

          <p className="stl-disclaimer">
            AISC 360-16 (LRFD). Hot-rolled C and MC channels — major-axis flexure / lateral-torsional buckling
            (Ch. F2 with the channel c = (ho/2)√(Iy/Cw)), minor-axis flexure (F6), shear (G2.1(b), φv = 0.90),
            elastic serviceability deflection, and axial compression with flexural (E3) and flexural-torsional (E4)
            buckling, with the E7 slender-element reduction and the H1-1 combined axial + flexure interaction. Channel
            flanges use b = full bf; the AISC-tabulated h/tw, ro and H are used for classification, shear, E4 and E7.
            Web local yielding/crippling and connection design are not included — verify independently. A licensed P.E.
            review remains required.
          </p>
        </section>
      </div>
    </div>
  );
}
