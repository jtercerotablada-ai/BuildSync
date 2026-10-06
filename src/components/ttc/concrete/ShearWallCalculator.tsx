'use client';

import React, { useId, useMemo, useState } from 'react';
import {
  inplaneShear, interaction, momentCapacityAt, simplifiedAxial, minReinforcement, boundaryElement,
  type InteractionResult,
} from '@/lib/concrete/aciShearWall';

const BARS: { id: string; area: number }[] = [
  { id: '#3', area: 0.11 }, { id: '#4', area: 0.20 }, { id: '#5', area: 0.31 }, { id: '#6', area: 0.44 },
  { id: '#7', area: 0.60 }, { id: '#8', area: 0.79 }, { id: '#9', area: 1.00 }, { id: '#10', area: 1.27 }, { id: '#11', area: 1.56 },
];
const barArea = (id: string) => BARS.find((b) => b.id === id)?.area ?? 0.20;

const fmt = (x: number, d = 1) => (Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const kip = (lb: number) => lb / 1000;
const kipft = (lbin: number) => lbin / 12000;

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
function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  const id = useId();
  return (
    <div className="stl-field"><label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
    </div>
  );
}
function Bar({ label, ratio }: { label: string; ratio: number }) {
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  const pct = Math.min(ratio, 1.35) / 1.35 * 100;
  const state = ratio > 1 ? 'over' : ratio > 0.9 ? 'high' : 'ok';
  return (
    <div className="stl-bar"><div className="stl-bar__head"><span>{label}</span><strong className={`stl-bar__val stl-bar__val--${state}`}>{fmt(ratio, 2)}</strong></div>
      <div className="stl-bar__track"><div className={`stl-bar__fill stl-bar__fill--${state}`} style={{ width: `${pct}%` }} /><div className="stl-bar__limit" /></div>
    </div>
  );
}
function Row({ k, v, unit, ref }: { k: string; v: React.ReactNode; unit?: string; ref?: string }) {
  return (<tr><td className="stl-k">{k}</td><td className="stl-v">{v}{unit ? <span className="stl-unit"> {unit}</span> : null}</td><td className="stl-ref">{ref}</td></tr>);
}

/* Wall plan view */
function WallSVG({ lw, h }: { lw: number; h: number }) {
  const W = 340, H = 70, pad = 16;
  const len = W - 2 * pad;
  const thick = Math.max(8, Math.min(28, h / lw * len * 4));
  const y = (H - thick) / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stl-svg" role="img" aria-label="wall plan">
      <rect x={pad} y={y} width={len} height={thick} fill="rgba(201,168,76,0.08)" stroke="#221e17" strokeWidth={1.3} />
      <rect x={pad} y={y} width={thick * 0.9} height={thick} fill="rgba(34,30,23,0.12)" stroke="#221e17" strokeWidth={0.8} />
      <rect x={pad + len - thick * 0.9} y={y} width={thick * 0.9} height={thick} fill="rgba(34,30,23,0.12)" stroke="#221e17" strokeWidth={0.8} />
      <text x={W / 2} y={H - 3} textAnchor="middle" className="stl-dim">lw = {fmt(lw / 12, 1)} ft · h = {fmt(h, 0)} in</text>
    </svg>
  );
}

/* P-M interaction diagram */
function PMDiagram({ res, Pu, Mu, phiMnAtPu }: { res: InteractionResult; Pu: number; Mu: number; phiMnAtPu: number }) {
  const W = 360, H = 300, mL = 46, mR = 14, mT = 16, mB = 34;
  const pts = res.points.map((p) => ({ x: Math.abs(kipft(p.phiMn)), y: kip(p.phiPn) }));
  const xMax = Math.max(...pts.map((p) => p.x), kipft(Mu), 1) * 1.1;
  const yMax = Math.max(...pts.map((p) => p.y), kip(Pu)) * 1.08;
  const yMin = Math.min(...pts.map((p) => p.y), 0) * 1.1;
  const px = (x: number) => mL + (x / xMax) * (W - mL - mR);
  const py = (y: number) => mT + (1 - (y - yMin) / (yMax - yMin)) * (H - mT - mB);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
  const demandInside = kipft(Mu) <= phiMnAtPu && kip(Pu) <= kip(res.phiPnMax);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stl-chart" role="img" aria-label="P-M interaction diagram">
      {/* axes */}
      <line x1={mL} y1={py(0)} x2={W - mR} y2={py(0)} stroke="#cfc7b6" strokeWidth={1} />
      <line x1={mL} y1={mT} x2={mL} y2={H - mB} stroke="#cfc7b6" strokeWidth={1} />
      {/* φPn,max */}
      <line x1={mL} y1={py(kip(res.phiPnMax))} x2={W - mR} y2={py(kip(res.phiPnMax))} stroke="#c9a84c" strokeWidth={0.9} strokeDasharray="4 3" />
      <text x={W - mR} y={py(kip(res.phiPnMax)) - 4} textAnchor="end" className="stl-chart__lbl">φPn,max {fmt(kip(res.phiPnMax), 0)}</text>
      {/* envelope */}
      <path d={path} fill="rgba(34,30,23,0.05)" stroke="#221e17" strokeWidth={1.6} />
      {/* demand point */}
      <line x1={px(kipft(Mu))} y1={py(0)} x2={px(kipft(Mu))} y2={py(kip(Pu))} stroke="#8a1c1c" strokeWidth={0.7} strokeDasharray="2 2" />
      <line x1={mL} y1={py(kip(Pu))} x2={px(kipft(Mu))} y2={py(kip(Pu))} stroke="#8a1c1c" strokeWidth={0.7} strokeDasharray="2 2" />
      <circle cx={px(kipft(Mu))} cy={py(kip(Pu))} r={4} fill={demandInside ? '#2f8a52' : '#8a1c1c'} />
      {/* axis labels */}
      <text x={(mL + W - mR) / 2} y={H - 4} textAnchor="middle" className="stl-chart__ax">φMn (kip·ft)</text>
      <text x={mL} y={py(kip(Pu)) - 6} className="stl-chart__lbl stl-chart__lbl--mark"> Pu {fmt(kip(Pu), 0)}, Mu {fmt(kipft(Mu), 0)}</text>
      <text x={mL - 4} y={mT + 4} textAnchor="end" className="stl-chart__lbl">φPn</text>
    </svg>
  );
}

export function ShearWallCalculator() {
  // geometry
  const [lwFt, setLwFt] = useState(20), [h, setH] = useState(12), [hwFt, setHwFt] = useState(40), [lcFt, setLcFt] = useState(12);
  // material
  const [fc, setFc] = useState(4000), [fyKsi, setFyKsi] = useState(60), [lambda, setLambda] = useState(1);
  // reinforcement (bar-based)
  const [vBar, setVBar] = useState('#5'), [vSpc, setVSpc] = useState(12), [curtains, setCurtains] = useState(2);
  const [hBar, setHBar] = useState('#5'), [hSpc, setHSpc] = useState(12);
  const [beBar, setBeBar] = useState('#8'), [beN, setBeN] = useState(6), [beCover, setBeCover] = useState(6);
  // demands (factored)
  const [Vu, setVu] = useState(500), [Pu, setPu] = useState(800), [Mu, setMu] = useState(12000);
  // seismic
  const [special, setSpecial] = useState(false), [deltaU, setDeltaU] = useState(12);

  const lw = lwFt * 12, hw = hwFt * 12, lc = lcFt * 12, fy = fyKsi * 1000, hw_lw = hw / lw;
  const rho_l = (curtains * barArea(vBar)) / (h * vSpc);
  const rho_t = (curtains * barArea(hBar)) / (h * hSpc);
  const AsBoundary = beN * barArea(beBar);

  const shear = useMemo(() => inplaneShear({ lw, h, fc, fy, rho_t, hw_lw, lambda, special }), [lw, h, fc, fy, rho_t, hw_lw, lambda, special]);
  const inter = useMemo(() => interaction(lw, h, fc, fy, { rho_l, nLayers: 24, AsBoundary, dBoundary: beCover }), [lw, h, fc, fy, rho_l, AsBoundary, beCover]);
  const PuLb = Pu * 1000, MuLbin = Mu * 12000, VuLb = Vu * 1000;
  const phiMnAtPu = momentCapacityAt(inter, PuLb); // lb·in
  const axial = useMemo(() => simplifiedAxial(lw, h, fc, lc, 0.8), [lw, h, fc, lc]);
  const phiVc = shear.phi * shear.alpha_c * lambda * shear.sqrtFc * shear.Acv; // for the 0.5φVc trigger
  const minR = useMemo(() => minReinforcement({ lw, h, fc, fy, lambda, Vu: VuLb, phiVc, hw_lw, rho_t, barNo5OrSmaller: barArea(vBar) <= 0.31, special }), [lw, h, fc, fy, lambda, VuLb, phiVc, hw_lw, rho_t, vBar, special]);
  // c at factored Pu (nominal) for the SBE check
  const cAtPu = useMemo(() => {
    const p = inter.points; let best: number | null = null;
    for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1]; if ((a.Pn - PuLb) * (b.Pn - PuLb) <= 0) { const t = Math.abs(b.Pn - a.Pn) < 1 ? 0 : (PuLb - a.Pn) / (b.Pn - a.Pn); best = a.c + t * (b.c - a.c); break; } }
    // no crossing (Pu ≥ nominal PnMax → whole section in compression): cap at lw
    return Math.min(best ?? lw, lw);
  }, [inter, PuLb, lw]);
  const be = useMemo(() => boundaryElement({ lw, h, fc, c: cAtPu, Pu: PuLb, Mu: MuLbin, deltaU, hw }), [lw, h, fc, cAtPu, PuLb, MuLbin, deltaU, hw]);

  // utilisations
  const utilV = VuLb / shear.phiVn;
  const utilPM = phiMnAtPu > 0 ? MuLbin / phiMnAtPu : (Mu > 0 ? Infinity : 0);
  const utilAxial = PuLb > inter.phiPnMax ? PuLb / inter.phiPnMax : 0;
  const rhoLok = rho_l >= minR.rho_l_min, rhoTok = rho_t >= minR.rho_t_min;
  const checks = [
    { name: 'In-plane shear (Vu/φVn)', ratio: utilV },
    { name: 'Axial-flexure (Mu/φMn)', ratio: utilPM },
    { name: 'Axial cap (Pu/φPn,max)', ratio: PuLb / inter.phiPnMax },
  ];
  const gov = checks.reduce((a, b) => (b.ratio > a.ratio ? b : a));
  const pass = gov.ratio <= 1.0 && rhoLok && rhoTok;

  return (
    <div className="stl">
      <div className="stl-sheethead">
        <div><div className="stl-brand">TERCERO TABLADA</div><div className="stl-brand-sub">Civil &amp; Structural Engineering Inc.</div></div>
        <div className="stl-sheettitle"><strong>CONCRETE SHEAR WALL</strong><span className="stl-code">ACI 318-19 · LRFD</span></div>
      </div>

      <div className="stl-grid">
        <aside className="stl-inputs">
          <h3 className="stl-h">Geometry</h3>
          <div className="stl-row2"><Num label="Length lw" unit="ft" value={lwFt} onChange={setLwFt} /><Num label="Thickness h" unit="in" value={h} onChange={setH} /></div>
          <div className="stl-row2"><Num label="Height hw" unit="ft" value={hwFt} onChange={setHwFt} hint={`hw/lw = ${fmt(hw_lw, 2)}`} /><Num label="Clear story lc" unit="ft" value={lcFt} onChange={setLcFt} hint="axial §11.5.3" /></div>
          <WallSVG lw={lw} h={h} />

          <h3 className="stl-h">Materials</h3>
          <div className="stl-row2"><Num label="f′c" unit="psi" value={fc} onChange={setFc} /><Num label="fy" unit="ksi" value={fyKsi} onChange={setFyKsi} /></div>
          <Sel label="Concrete" value={String(lambda)} onChange={(v) => setLambda(parseFloat(v))} options={[{ v: '1', l: 'Normalweight (λ=1.0)' }, { v: '0.85', l: 'Sand-lightweight (λ=0.85)' }, { v: '0.75', l: 'Lightweight (λ=0.75)' }]} />

          <h3 className="stl-h">Vertical reinforcement</h3>
          <div className="stl-row2"><Sel label="Bar" value={vBar} onChange={setVBar} options={BARS.map((b) => ({ v: b.id, l: b.id }))} /><Num label="Spacing" unit="in" value={vSpc} onChange={setVSpc} /></div>
          <Sel label="Curtains" value={String(curtains)} onChange={(v) => setCurtains(parseInt(v, 10))} options={[{ v: '1', l: '1 curtain' }, { v: '2', l: '2 curtains' }]} />
          <p className="stl-note">ρl = {(rho_l * 100).toFixed(3)}%</p>

          <h3 className="stl-h">Horizontal reinforcement</h3>
          <div className="stl-row2"><Sel label="Bar" value={hBar} onChange={setHBar} options={BARS.map((b) => ({ v: b.id, l: b.id }))} /><Num label="Spacing" unit="in" value={hSpc} onChange={setHSpc} /></div>
          <p className="stl-note">ρt = {(rho_t * 100).toFixed(3)}%</p>

          <h3 className="stl-h">Boundary reinforcement</h3>
          <div className="stl-row2"><Sel label="Bar" value={beBar} onChange={setBeBar} options={BARS.map((b) => ({ v: b.id, l: b.id }))} /><Num label="Bars / end" value={beN} onChange={setBeN} /></div>
          <Num label="Cover to bars" unit="in" value={beCover} onChange={setBeCover} hint={`As = ${fmt(AsBoundary, 2)} in²/end`} />

          <h3 className="stl-h">Factored demands</h3>
          <div className="stl-row2"><Num label="Vu" unit="k" value={Vu} onChange={setVu} /><Num label="Pu" unit="k" value={Pu} onChange={setPu} /></div>
          <Num label="Mu (in-plane)" unit="k·ft" value={Mu} onChange={setMu} />

          <h3 className="stl-h">Seismic</h3>
          <Sel label="Wall type" value={special ? 's' : 'o'} onChange={(v) => setSpecial(v === 's')} options={[{ v: 'o', l: 'Ordinary (Ch. 11)' }, { v: 's', l: 'Special (§18.10)' }]} />
          {special && <Num label="Design displ. δu" unit="in" value={deltaU} onChange={setDeltaU} hint={`δu/hw = ${fmt(deltaU / hw, 4)}`} />}
        </aside>

        <section className="stl-results">
          <div className={`stl-verdict ${pass ? 'is-pass' : 'is-fail'}`}>
            <div className="stl-verdict__mark">{pass ? '✓' : '✗'}</div>
            <div><strong>{pass ? 'Wall adequate' : 'Wall NG'}</strong>
              <span>lw {fmt(lwFt, 0)} ft × {fmt(h, 0)} in · hw/lw {fmt(hw_lw, 1)} · governing: {gov.ratio > 1 ? gov.name : (!rhoLok || !rhoTok ? 'min reinforcement' : gov.name)}</span></div>
            <div className="stl-verdict__ratio">{fmt(Math.max(gov.ratio, rhoLok && rhoTok ? 0 : 1.01) * 100, 0)}%</div>
          </div>

          <div className="stl-bars">
            <Bar label="In-plane shear — Vu/φVn" ratio={utilV} />
            <Bar label="Axial-flexure — Mu/φMn" ratio={utilPM} />
            {PuLb / inter.phiPnMax > 0 && <Bar label="Axial cap — Pu/φPn,max" ratio={PuLb / inter.phiPnMax} />}
          </div>

          <div className="stl-card stl-card--pmblock">
              <h4>Axial-flexure interaction <span className="stl-tag">Ch. 22 · {special ? '§18.10' : '§11.5.2'}</span></h4>
              <div className="stl-pm">
                <PMDiagram res={inter} Pu={PuLb} Mu={MuLbin} phiMnAtPu={phiMnAtPu} />
                <table className="stl-table"><tbody>
                  <Row k="φPn,max" v={fmt(kip(inter.phiPnMax))} unit="k" ref="0.65·0.80·Po" />
                  <Row k="φMn at Pu" v={<strong>{fmt(kipft(phiMnAtPu))}</strong>} unit="k·ft" />
                  <Row k="Demand (Pu, Mu)" v={`${fmt(Pu)}, ${fmt(Mu)}`} unit="k, k·ft" />
                  <Row k="Ast (total vert.)" v={fmt(inter.Ast, 1)} unit="in²" />
                  <Row k="Utilisation Mu/φMn" v={<strong className={utilPM <= 1 ? 'stl-good' : 'stl-bad'}>{fmt(utilPM, 2)}</strong>} />
                </tbody></table>
              </div>
          </div>

          <div className="stl-cards">
            <div className="stl-card">
              <h4>In-plane shear <span className="stl-tag">{shear.clause}</span></h4>
              <table className="stl-table"><tbody>
                <Row k="Acv = h·lw" v={fmt(shear.Acv, 0)} unit="in²" />
                <Row k="αc (hw/lw)" v={fmt(shear.alpha_c, 2)} />
                <Row k="Vn" v={fmt(kip(shear.Vn))} unit="k" ref={shear.capped ? 'capped' : ''} />
                <Row k="φVn" v={<strong>{fmt(kip(shear.phiVn))}</strong>} unit="k" ref={`φ = ${shear.phi.toFixed(2)}`} />
                <Row k="Demand Vu" v={fmt(Vu)} unit="k" />
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>Minimum reinforcement <span className="stl-tag">§11.6 / §11.7</span></h4>
              <table className="stl-table"><tbody>
                <Row k="ρl provided / min" v={<span className={rhoLok ? 'stl-good' : 'stl-bad'}>{(rho_l * 100).toFixed(3)} / {(minR.rho_l_min * 100).toFixed(3)}%</span>} />
                <Row k="ρt provided / min" v={<span className={rhoTok ? 'stl-good' : 'stl-bad'}>{(rho_t * 100).toFixed(3)} / {(minR.rho_t_min * 100).toFixed(3)}%</span>} />
                <Row k="Curtains required" v={minR.twoCurtains ? '2' : '1'} ref={minR.twoCurtainReason} />
                <Row k="Max spacing" v={fmt(minR.spacingMax, 0)} unit="in" />
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>Simplified axial <span className="stl-tag">§11.5.3</span></h4>
              <table className="stl-table"><tbody>
                <Row k="φPn (k·lc/32h, k=0.8)" v={<strong>{fmt(kip(axial.phiPn))}</strong>} unit="k" ref="φ = 0.65" />
                <Row k="Demand Pu" v={fmt(Pu)} unit="k" />
                <Row k="Utilisation" v={<span className={Pu * 1000 <= axial.phiPn ? 'stl-good' : 'stl-bad'}>{fmt(PuLb / axial.phiPn, 2)}</span>} ref="e ≤ h/6" />
              </tbody></table>
            </div>

            {special && (
              <div className="stl-card">
                <h4>Special boundary elements <span className="stl-tag">§18.10.6</span></h4>
                <table className="stl-table"><tbody>
                  <Row k="c at Pu" v={fmt(be.cDemand, 1)} unit="in" />
                  <Row k="c-limit (18.10.6.2)" v={fmt(be.cLimit, 1)} unit="in" ref={be.requiredByDisp ? 'SBE req.' : 'ok'} />
                  <Row k="σ / 0.2f′c" v={`${fmt(be.sigma, 0)} / ${fmt(be.sigmaLimit, 0)}`} unit="psi" ref={be.requiredByStress ? 'SBE req.' : 'ok'} />
                  <Row k="SBE required" v={<strong className={be.requiredByDisp || be.requiredByStress ? 'stl-bad' : 'stl-good'}>{be.requiredByDisp || be.requiredByStress ? 'Yes' : 'No'}</strong>} ref={be.extent ? `extent ${fmt(be.extent, 0)} in` : ''} />
                </tbody></table>
              </div>
            )}
          </div>

          <p className="stl-disclaimer">
            ACI 318-19 (LRFD). Rectangular structural wall — in-plane shear (§11.5.4), axial-flexure P-M interaction
            (Ch. 22 strain compatibility), minimum reinforcement (§11.6/§11.7), simplified axial (§11.5.3) and, for
            special walls, boundary-element triggers (§18.10.6). Diaphragm/collector forces, sliding shear-friction,
            coupling beams, out-of-plane slenderness and foundation design are not included. Factored demands and δu
            are user inputs. A licensed P.E. review remains required.
          </p>
        </section>
      </div>
    </div>
  );
}
