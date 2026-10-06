'use client';

import React, { useId, useMemo, useState } from 'react';
import {
  interactionAxis, momentCapacityAt, biaxial, slenderness, detailing,
  rectBars, circBars, grossArea, Ec,
  type ColSection, type ColInteraction,
} from '@/lib/concrete/aciColumn';

const BARS: { id: string; area: number; dia: number }[] = [
  { id: '#3', area: 0.11, dia: 0.375 }, { id: '#4', area: 0.20, dia: 0.500 }, { id: '#5', area: 0.31, dia: 0.625 },
  { id: '#6', area: 0.44, dia: 0.750 }, { id: '#7', area: 0.60, dia: 0.875 }, { id: '#8', area: 0.79, dia: 1.000 },
  { id: '#9', area: 1.00, dia: 1.128 }, { id: '#10', area: 1.27, dia: 1.270 }, { id: '#11', area: 1.56, dia: 1.410 },
];
const bar = (id: string) => BARS.find((b) => b.id === id) ?? BARS[5];
const fmt = (x: number, d = 1) => (Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const kft = (kipin: number) => kipin / 12;

function Num({ label, unit, value, onChange, step = 'any', hint }: { label: string; unit?: string; value: number; onChange: (v: number) => void; step?: string; hint?: string }) {
  const id = useId();
  return (<div className="stl-field"><label htmlFor={id}>{label} {unit ? <span className="stl-unit">({unit})</span> : null}</label>
    <input id={id} type="number" step={step} value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(parseFloat(e.target.value))} />
    {hint ? <small className="stl-hint">{hint}</small> : null}</div>);
}
function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  const id = useId();
  return (<div className="stl-field"><label htmlFor={id}>{label}</label>
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></div>);
}
function Bar({ label, ratio }: { label: string; ratio: number }) {
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  const pct = Math.min(ratio, 1.35) / 1.35 * 100, state = ratio > 1 ? 'over' : ratio > 0.9 ? 'high' : 'ok';
  return (<div className="stl-bar"><div className="stl-bar__head"><span>{label}</span><strong className={`stl-bar__val stl-bar__val--${state}`}>{fmt(ratio, 2)}</strong></div>
    <div className="stl-bar__track"><div className={`stl-bar__fill stl-bar__fill--${state}`} style={{ width: `${pct}%` }} /><div className="stl-bar__limit" /></div></div>);
}
function Row({ k, v, unit, ref }: { k: string; v: React.ReactNode; unit?: string; ref?: string }) {
  return (<tr><td className="stl-k">{k}</td><td className="stl-v">{v}{unit ? <span className="stl-unit"> {unit}</span> : null}</td><td className="stl-ref">{ref}</td></tr>);
}

function SectionSVG({ section, bars }: { section: ColSection; bars: { x: number; y: number }[] }) {
  const W = 180, H = 180, pad = 22;
  const dim = section.kind === 'rect' ? Math.max(section.b, section.h) : section.D;
  const sc = (Math.min(W, H) - 2 * pad) / dim;
  const cx = W / 2, cy = H / 2, INK = '#221e17';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stl-svg" role="img" aria-label="column section">
      {section.kind === 'rect'
        ? <rect x={cx - section.b * sc / 2} y={cy - section.h * sc / 2} width={section.b * sc} height={section.h * sc} fill="rgba(201,168,76,0.08)" stroke={INK} strokeWidth={1.4} />
        : <circle cx={cx} cy={cy} r={section.D * sc / 2} fill="rgba(201,168,76,0.08)" stroke={INK} strokeWidth={1.4} />}
      {bars.map((b, i) => <circle key={i} cx={cx + b.x * sc} cy={cy - b.y * sc} r={2.6} fill={INK} />)}
    </svg>
  );
}

function PMDiagram({ res, Pu, Mu, phiMnAtPu, label }: { res: ColInteraction; Pu: number; Mu: number; phiMnAtPu: number; label: string }) {
  const W = 340, H = 260, mL = 44, mR = 12, mT = 14, mB = 30;
  const pts = res.points.map((p) => ({ x: Math.abs(kft(p.phiMn)), y: p.phiPn }));
  const xMax = Math.max(...pts.map((p) => p.x), kft(Mu), 1) * 1.1;
  const yMax = Math.max(...pts.map((p) => p.y), Pu) * 1.08;
  const yMin = Math.min(...pts.map((p) => p.y), 0) * 1.1;
  const px = (x: number) => mL + (x / xMax) * (W - mL - mR);
  const py = (y: number) => mT + (1 - (y - yMin) / (yMax - yMin)) * (H - mT - mB);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
  const inside = kft(Mu) <= phiMnAtPu && Pu <= res.phiPnMax;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stl-chart" role="img" aria-label={`${label} interaction diagram`}>
      <line x1={mL} y1={py(0)} x2={W - mR} y2={py(0)} stroke="#cfc7b6" strokeWidth={1} />
      <line x1={mL} y1={mT} x2={mL} y2={H - mB} stroke="#cfc7b6" strokeWidth={1} />
      <line x1={mL} y1={py(res.phiPnMax)} x2={W - mR} y2={py(res.phiPnMax)} stroke="#c9a84c" strokeWidth={0.9} strokeDasharray="4 3" />
      <text x={W - mR} y={py(res.phiPnMax) - 4} textAnchor="end" className="stl-chart__lbl">φPn,max {fmt(res.phiPnMax, 0)}</text>
      <path d={path} fill="rgba(34,30,23,0.05)" stroke="#221e17" strokeWidth={1.6} />
      <line x1={px(kft(Mu))} y1={py(0)} x2={px(kft(Mu))} y2={py(Pu)} stroke="#8a1c1c" strokeWidth={0.7} strokeDasharray="2 2" />
      <line x1={mL} y1={py(Pu)} x2={px(kft(Mu))} y2={py(Pu)} stroke="#8a1c1c" strokeWidth={0.7} strokeDasharray="2 2" />
      <circle cx={px(kft(Mu))} cy={py(Pu)} r={4} fill={inside ? '#2f8a52' : '#8a1c1c'} />
      <text x={(mL + W - mR) / 2} y={H - 3} textAnchor="middle" className="stl-chart__ax">φMn{label} (kip·ft)</text>
      <text x={mL - 4} y={mT + 4} textAnchor="end" className="stl-chart__lbl">φPn</text>
    </svg>
  );
}

export function ColumnCalculator() {
  const [shape, setShape] = useState<'rect' | 'circ'>('rect');
  const [b, setB] = useState(20), [h, setH] = useState(20), [D, setD] = useState(24);
  const [fc, setFc] = useState(5000), [fyKsi, setFyKsi] = useState(60);
  const [barId, setBarId] = useState('#9'), [nx, setNx] = useState(3), [ny, setNy] = useState(3), [nCirc, setNCirc] = useState(8);
  const [cover, setCover] = useState(1.5), [tieId, setTieId] = useState('#3');
  const [Pu, setPu] = useState(700), [Mux, setMux] = useState(300), [Muy, setMuy] = useState(120);
  const [slender, setSlender] = useState(false);
  const [k, setK] = useState(1.0), [luFt, setLuFt] = useState(12), [ratioM, setRatioM] = useState(1.0), [betaDns, setBetaDns] = useState(0.6), [transverse, setTransverse] = useState(false);
  const [diagAxis, setDiagAxis] = useState<'x' | 'y'>('x');
  const [alpha, setAlpha] = useState(1.0);

  const spiral = shape === 'circ';
  const section: ColSection = shape === 'rect' ? { kind: 'rect', b, h } : { kind: 'circ', D };
  const fck = fc / 1000, fy = fyKsi;
  const inset = cover + bar(tieId).dia + bar(barId).dia / 2;
  const bars = useMemo(() => shape === 'rect' ? rectBars(b, h, inset, bar(barId).area, nx, ny) : circBars(D, inset, bar(barId).area, nCirc), [shape, b, h, D, inset, barId, nx, ny, nCirc]);
  const nBars = bars.length;
  const Ag = grossArea(section);

  const iX = useMemo(() => interactionAxis(section, bars, fck, fy, 'x', spiral), [section, bars, fck, fy, spiral]);
  const iY = useMemo(() => interactionAxis(section, bars, fck, fy, 'y', spiral), [section, bars, fck, fy, spiral]);

  // slenderness (per axis) → magnified moments
  const slX = useMemo(() => slenderness({ section, axis: 'x', k, lu: luFt * 12, Pu, M1: ratioM * Mux * 12, M2: Mux * 12, fc: fck, betaDns, transverseLoad: transverse }), [section, k, luFt, Pu, ratioM, Mux, fck, betaDns, transverse]);
  const slY = useMemo(() => slenderness({ section, axis: 'y', k, lu: luFt * 12, Pu, M1: ratioM * Muy * 12, M2: Muy * 12, fc: fck, betaDns, transverseLoad: transverse }), [section, k, luFt, Pu, ratioM, Muy, fck, betaDns, transverse]);
  const Mcx = slender && slX.slender ? kft(slX.Mc) : Mux; // kip-ft
  const Mcy = slender && slY.slender ? kft(slY.Mc) : Muy;

  // biaxial / uniaxial check
  const uniaxial = Mcy < 0.01 * Math.max(Mcx, 1) || Mcx < 0.01 * Math.max(Mcy, 1);
  const bx = useMemo(() => biaxial(iX, iY, fck, Ag, Pu, Mcx * 12, Mcy * 12, spiral, alpha), [iX, iY, fck, Ag, Pu, Mcx, Mcy, spiral, alpha]);
  const phiMnX = momentCapacityAt(iX, Pu), phiMnY = momentCapacityAt(iY, Pu);
  const utilUniaxial = Mcy < 0.01 * Math.max(Mcx, 1) ? (Mcx * 12) / phiMnX : (Mcy * 12) / phiMnY;
  const pmRatio = uniaxial ? utilUniaxial : bx.ratio;

  const det = useMemo(() => detailing({ section, Ast: iX.Ast, nBars, spiral, longBarDia: bar(barId).dia, tieBarDia: bar(tieId).dia, cover, fc: fck, fyt: 60 }), [section, iX.Ast, nBars, spiral, barId, tieId, cover, fck]);

  const checks = [{ name: uniaxial ? 'Axial-flexure (uniaxial)' : `Biaxial (${bx.method === 'Bresler reciprocal' ? 'Bresler' : 'PCA contour'})`, ratio: pmRatio }];
  const gov = checks[0];
  const pass = gov.ratio <= 1.0 && det.rhoOk && det.barsOk;

  const diag = diagAxis === 'x' ? iX : iY;
  const diagMu = diagAxis === 'x' ? Mcx : Mcy;
  const diagPhiMn = diagAxis === 'x' ? phiMnX : phiMnY;

  return (
    <div className="stl">
      <div className="stl-sheethead">
        <div><div className="stl-brand">TERCERO TABLADA</div><div className="stl-brand-sub">Civil &amp; Structural Engineering Inc.</div></div>
        <div className="stl-sheettitle"><strong>CONCRETE COLUMN DESIGN</strong><span className="stl-code">ACI 318-19 · LRFD</span></div>
      </div>

      <div className="stl-grid">
        <aside className="stl-inputs">
          <h3 className="stl-h">Section</h3>
          <div className="stl-seg" role="tablist">
            <button type="button" className={shape === 'rect' ? 'is-active' : ''} onClick={() => setShape('rect')}>Rectangular (tied)</button>
            <button type="button" className={shape === 'circ' ? 'is-active' : ''} onClick={() => setShape('circ')}>Circular (spiral)</button>
          </div>
          {shape === 'rect'
            ? <div className="stl-row2"><Num label="b" unit="in" value={b} onChange={setB} /><Num label="h" unit="in" value={h} onChange={setH} /></div>
            : <Num label="Diameter D" unit="in" value={D} onChange={setD} />}
          <SectionSVG section={section} bars={bars} />
          <p className="stl-note">{nBars} bars · Ag = {fmt(Ag, 0)} in² · ρg = {(iX.Ast / Ag * 100).toFixed(2)}%</p>

          <h3 className="stl-h">Materials</h3>
          <div className="stl-row2"><Num label="f′c" unit="psi" value={fc} onChange={setFc} /><Num label="fy" unit="ksi" value={fyKsi} onChange={setFyKsi} /></div>

          <h3 className="stl-h">Reinforcement</h3>
          <div className="stl-row2"><Sel label="Bar" value={barId} onChange={setBarId} options={BARS.map((x) => ({ v: x.id, l: x.id }))} />
            {shape === 'circ' ? <Num label="Bars (ring)" value={nCirc} onChange={setNCirc} /> : <Sel label="Tie" value={tieId} onChange={setTieId} options={BARS.slice(0, 4).map((x) => ({ v: x.id, l: x.id }))} />}</div>
          {shape === 'rect' && <div className="stl-row2"><Num label="Bars / horiz. face" value={nx} onChange={setNx} /><Num label="Bars / vert. face" value={ny} onChange={setNy} /></div>}
          <Num label="Clear cover" unit="in" value={cover} onChange={setCover} />

          <h3 className="stl-h">Factored demands</h3>
          <Num label="Pu" unit="k" value={Pu} onChange={setPu} />
          <div className="stl-row2"><Num label="Mux" unit="k·ft" value={Mux} onChange={setMux} /><Num label="Muy" unit="k·ft" value={Muy} onChange={setMuy} /></div>
          {!uniaxial && <Num label="Contour α" value={alpha} onChange={setAlpha} step="0.05" hint="PCA (≥ threshold uses Bresler)" />}

          <h3 className="stl-h">Slenderness</h3>
          <Sel label="Consider slenderness" value={slender ? 'y' : 'n'} onChange={(v) => setSlender(v === 'y')} options={[{ v: 'n', l: 'Neglect / short column' }, { v: 'y', l: 'Consider (non-sway)' }]} />
          {slender && (<>
            <div className="stl-row2"><Num label="k" value={k} onChange={setK} step="0.05" /><Num label="lu" unit="ft" value={luFt} onChange={setLuFt} /></div>
            <div className="stl-row2"><Num label="M1/M2" value={ratioM} onChange={setRatioM} step="0.05" hint="+ single curv." /><Num label="βdns" value={betaDns} onChange={setBetaDns} step="0.05" /></div>
            <Sel label="Transverse load" value={transverse ? 'y' : 'n'} onChange={(v) => setTransverse(v === 'y')} options={[{ v: 'n', l: 'No (Cm by end ratio)' }, { v: 'y', l: 'Yes (Cm = 1.0)' }]} />
          </>)}
        </aside>

        <section className="stl-results">
          <div className={`stl-verdict ${pass ? 'is-pass' : 'is-fail'}`}>
            <div className="stl-verdict__mark">{pass ? '✓' : '✗'}</div>
            <div><strong>{pass ? 'Column adequate' : 'Column NG'}</strong>
              <span>{shape === 'rect' ? `${fmt(b, 0)}×${fmt(h, 0)} in` : `⌀${fmt(D, 0)} in`} · {nBars} bars · {uniaxial ? 'uniaxial' : bx.method}</span></div>
            <div className="stl-verdict__ratio">{fmt(gov.ratio * 100, 0)}%</div>
          </div>

          <div className="stl-bars">
            <Bar label={checks[0].name} ratio={pmRatio} />
            {slender && (slX.slender || slY.slender) && <Bar label="Slenderness δns (x)" ratio={slX.deltaNs / 1.4} />}
          </div>

          <div className="stl-card stl-card--pmblock">
              <h4>Axial-flexure interaction <span className="stl-tag">Ch. 22{uniaxial ? '' : ' · biaxial'}</span></h4>
              <div className="stl-seg stl-seg--mini" role="tablist">
                <button type="button" className={diagAxis === 'x' ? 'is-active' : ''} onClick={() => setDiagAxis('x')}>About X</button>
                <button type="button" className={diagAxis === 'y' ? 'is-active' : ''} onClick={() => setDiagAxis('y')}>About Y</button>
              </div>
              <div className="stl-pm">
                <PMDiagram res={diag} Pu={Pu} Mu={diagMu * 12} phiMnAtPu={diagPhiMn} label={diagAxis} />
                <table className="stl-table"><tbody>
                  <Row k="φPn,max" v={fmt(diag.phiPnMax)} unit="k" ref={spiral ? '0.75·0.85·Po' : '0.65·0.80·Po'} />
                  <Row k={`φMn${diagAxis} at Pu`} v={<strong>{fmt(kft(diagPhiMn))}</strong>} unit="k·ft" />
                  <Row k={`Demand M${diagAxis}`} v={fmt(diagMu)} unit="k·ft" ref={slender && (diagAxis === 'x' ? slX.slender : slY.slender) ? 'magnified' : ''} />
                  {!uniaxial && bx.method === 'Bresler reciprocal' && <Row k="Bresler φPn" v={<strong>{fmt(bx.phiPn ?? 0)}</strong>} unit="k" ref={`Pu ${fmt(Pu)}`} />}
                  {!uniaxial && bx.method === 'PCA load contour' && <Row k="Contour ratio" v={<strong className={bx.ratio <= 1 ? 'stl-good' : 'stl-bad'}>{fmt(bx.ratio, 2)}</strong>} ref={`α = ${fmt(bx.alpha ?? 1, 2)}`} />}
                  <Row k="Utilisation" v={<strong className={pmRatio <= 1 ? 'stl-good' : 'stl-bad'}>{fmt(pmRatio, 2)}</strong>} />
                </tbody></table>
              </div>
          </div>

          <div className="stl-cards">
            {slender && (
              <div className="stl-card">
                <h4>Slenderness <span className="stl-tag">§6.6.4</span></h4>
                <table className="stl-table"><tbody>
                  <Row k="klu/r (x)" v={fmt(slX.klu_r, 0)} ref={slX.slender ? `> ${fmt(slX.neglectLimit, 0)} slender` : 'short'} />
                  <Row k="Pc (x)" v={fmt(slX.Pc, 0)} unit="k" />
                  <Row k="δns (x)" v={<strong>{fmt(slX.deltaNs, 2)}</strong>} ref={`Cm ${fmt(slX.Cm, 2)}`} />
                  <Row k="Mcx (magnified)" v={fmt(kft(slX.Mc), 0)} unit="k·ft" ref={`M2,min ${fmt(kft(slX.M2min), 0)}`} />
                </tbody></table>
              </div>
            )}

            <div className="stl-card">
              <h4>Detailing <span className="stl-tag">§10.6 / §25.7</span></h4>
              <table className="stl-table"><tbody>
                <Row k="ρg (0.01–0.08)" v={<span className={det.rhoOk ? 'stl-good' : 'stl-bad'}>{(det.rho * 100).toFixed(2)}%</span>} ref={`Ast ${fmt(iX.Ast, 1)} in²`} />
                <Row k="Bars / min" v={<span className={det.barsOk ? 'stl-good' : 'stl-bad'}>{nBars} / {det.minBars}</span>} />
                <Row k={spiral ? 'Spiral ρs,min' : 'Tie spacing'} v={spiral ? `${((det.spiralRhoMin ?? 0) * 100).toFixed(3)}%` : fmt(det.tieSpacing, 0)} unit={spiral ? '' : 'in'} />
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>Section properties <span className="stl-tag">{shape === 'rect' ? 'Rect' : 'Circ'}</span></h4>
              <table className="stl-table"><tbody>
                <Row k="Ag" v={fmt(Ag, 0)} unit="in²" />
                <Row k="Po (nominal)" v={fmt(iX.Po, 0)} unit="k" ref="§22.4.2.2" />
                <Row k="Ec" v={fmt(Ec(fck), 0)} unit="ksi" />
              </tbody></table>
            </div>
          </div>

          <p className="stl-disclaimer">
            ACI 318-19 (LRFD). Rectangular tied and circular spiral columns — uniaxial &amp; biaxial P-M interaction
            (Ch. 22 strain compatibility, Bresler reciprocal / PCA load contour), non-sway slenderness magnification
            (§6.6.4) and detailing limits (§10.6/§10.7/§25.7). Sway (Δ) magnification, second-order frame analysis,
            shear/tie design for shear, and connection/splice design are not included. Factored demands and effective
            length are user inputs. A licensed P.E. review remains required.
          </p>
        </section>
      </div>
    </div>
  );
}
