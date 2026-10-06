'use client';

import React, { useId, useMemo, useState } from 'react';
import { analyzePlate, plateFlexure, type BendAxis, type PlateInputs } from '@/lib/steel/aisc360-plate';

const GRADES = [
  { id: 'A36', label: 'ASTM A36', Fy: 36, Fu: 58 },
  { id: 'A572-50', label: 'ASTM A572 Gr. 50', Fy: 50, Fu: 65 },
  { id: 'A588-50', label: 'ASTM A588 (weathering)', Fy: 50, Fu: 70 },
  { id: 'custom', label: 'Custom…', Fy: 36, Fu: 58 },
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

/* Plate cross-section (depth vertical = bending depth for the selected axis) */
function SectionSVG({ b, t, axis }: { b: number; t: number; axis: BendAxis }) {
  const W = 240, H = 170, pad = 34;
  const big = Math.max(b, t), small = Math.min(b, t);
  const depth = axis === 'minor' ? small : big;   // vertical dimension in bending
  const width = axis === 'minor' ? big : small;   // horizontal dimension
  const sc = Math.min((W - 2 * pad) / width, (H - 2 * pad) / depth);
  const w = width * sc, h = depth * sc, x0 = W / 2 - w / 2, y0 = H / 2 - h / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stl-svg" role="img" aria-label="plate cross-section">
      <rect x={x0} y={y0} width={w} height={h} fill="rgba(201,168,76,0.08)" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      {/* neutral axis (bending) */}
      <line x1={x0 - 8} y1={H / 2} x2={x0 + w + 8} y2={H / 2} stroke={GOLD} strokeWidth={0.9} strokeDasharray="5 3" />
      <text x={x0 + w + 12} y={H / 2 + 3} className="stl-dim" style={{ fill: GOLDD }}>N.A.</text>
      <text x={W / 2} y={y0 - 6} textAnchor="middle" className="stl-dim">{fmt(width, 3)}″</text>
      <text x={x0 - 10} y={H / 2 + 3} textAnchor="end" className="stl-dim">{fmt(depth, 3)}″</text>
      <text x={W / 2} y={H - 6} textAnchor="middle" className="stl-dim">{axis === 'minor' ? 'minor axis · flatwise' : 'major axis · on edge'}</text>
    </svg>
  );
}

/* Mn vs Lb curve (major-axis LTB, F11.2) */
function LTBCurve({ b, t, Fy, Cb, Lb_ft }: { b: number; t: number; Fy: number; Cb: number; Lb_ft: number }) {
  const W = 360, H = 190, mL = 46, mR = 14, mT = 14, mB = 26;
  const phiMnAt = (L_ft: number) => kft(plateFlexure(b, t, Fy, 'major', L_ft * 12, Cb).phiMn);
  const phiMp = kft(plateFlexure(b, t, Fy, 'major', 0.01, Cb).phiMn);
  // find Lb where Mn ≈ 0.35 Mp for a sensible x-range
  const Lmax = Math.max(4, Math.ceil(((1.9 * 29000 / Fy) * t * t / b / 12) / 2) * 2);
  const pts = useMemo(() => {
    const arr: [number, number][] = [];
    for (let L = 0.1; L <= Lmax; L += Lmax / 120) arr.push([L, phiMnAt(L)]);
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b, t, Fy, Cb, Lmax]);
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
      <text x={W - mR} y={py(phiMp) - 4} textAnchor="end" className="stl-chart__lbl" style={{ fill: GOLDD }}>φMp {fmt(phiMp, 1)}</text>
      <path d={path} fill="none" stroke={INK} strokeWidth={1.6} />
      <line x1={px(LbC)} y1={mT} x2={px(LbC)} y2={py(0)} stroke={MARK} strokeWidth={0.9} strokeDasharray="3 3" />
      <circle cx={px(LbC)} cy={py(MnAt)} r={3.4} fill={MARK} />
      <text x={px(LbC)} y={py(MnAt) - 7} textAnchor="middle" className="stl-chart__lbl" style={{ fill: MARK, fontWeight: 600 }}>{fmt(MnAt, 1)}</text>
      <text x={(mL + W - mR) / 2} y={H - 4} textAnchor="middle" className="stl-chart__ax">Unbraced length Lb (ft) · φMn (kip·ft)</text>
      <text x={mL - 4} y={mT + 2} textAnchor="end" className="stl-chart__lbl">{fmt(yMax, 1)}</text>
    </svg>
  );
}

export function AiscPlateCalculator() {
  const [b, setB] = useState(8);      // width (in)
  const [t, setT] = useState(0.5);    // thickness (in)
  const [gradeId, setGradeId] = useState('A36');
  const grade = GRADES.find((g) => g.id === gradeId)!;
  const [cFy, setCFy] = useState(36), [cFu, setCFu] = useState(58);
  const Fy = gradeId === 'custom' ? cFy : grade.Fy;
  const Fu = gradeId === 'custom' ? cFu : grade.Fu;

  const [axis, setAxis] = useState<BendAxis>('minor');
  const [Lb, setLb] = useState(4);    // ft (major LTB)
  const [Cb, setCb] = useState(1);
  const [holeArea, setHoleArea] = useState(0); // in² (shear rupture net-area deduction)
  const [Mu, setMu] = useState(1);    // kip·ft
  const [Vu, setVu] = useState(30);   // kips

  const inp: PlateInputs = useMemo(() => ({
    b, t, Fy, Fu, axis, Lb: Lb * 12, Cb, holeArea, Mu: Mu * 12, Vu,
  }), [b, t, Fy, Fu, axis, Lb, Cb, holeArea, Mu, Vu]);
  const r = useMemo(() => analyzePlate(inp), [inp]);
  const fx = r.flexure, sh = r.shear, pr = r.props;
  const govPass = r.governing.ratio <= 1.0;

  return (
    <div className="stl">
      <div className="stl-sheethead">
        <div>
          <div className="stl-brand">TERCERO TABLADA</div>
          <div className="stl-brand-sub">Civil &amp; Structural Engineering Inc.</div>
        </div>
        <div className="stl-sheettitle">
          <strong>STEEL PLATE DESIGN</strong>
          <span className="stl-code">AISC 360-22 · LRFD</span>
        </div>
      </div>

      <div className="stl-grid">
        <aside className="stl-inputs">
          <h3 className="stl-h">Plate / bar</h3>
          <div className="stl-row2">
            <Num label="Width b" unit="in" value={b} onChange={setB} />
            <Num label="Thickness t" unit="in" value={t} onChange={setT} />
          </div>
          <SectionSVG b={b} t={t} axis={axis} />

          <h3 className="stl-h">Material</h3>
          <div className="stl-field">
            <label htmlFor="ap-grade">Grade</label>
            <select id="ap-grade" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
              {GRADES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </div>
          {gradeId === 'custom' ? (
            <div className="stl-row2"><Num label="Fy" unit="ksi" value={cFy} onChange={setCFy} /><Num label="Fu" unit="ksi" value={cFu} onChange={setCFu} /></div>
          ) : <p className="stl-note">Fy = {Fy} ksi · Fu = {Fu} ksi</p>}

          <h3 className="stl-h">Bending (F11)</h3>
          <div className="stl-field">
            <label>Bending axis</label>
            <div className="stl-seg" style={{ margin: 0 }}>
              <button type="button" className={axis === 'minor' ? 'is-active' : ''} onClick={() => setAxis('minor')}>Minor (flatwise)</button>
              <button type="button" className={axis === 'major' ? 'is-active' : ''} onClick={() => setAxis('major')}>Major (on edge)</button>
            </div>
          </div>
          {axis === 'major' && (
            <div className="stl-row2"><Num label="Lb — unbraced" unit="ft" value={Lb} onChange={setLb} /><Num label="Cb" value={Cb} onChange={setCb} step="0.05" /></div>
          )}
          <Num label="Mu — moment" unit="kip·ft" value={Mu} onChange={setMu} />

          <h3 className="stl-h">Shear (J4.2)</h3>
          <div className="stl-row2">
            <Num label="Vu — shear" unit="kips" value={Vu} onChange={setVu} />
            <Num label="Hole area" unit="in²" value={holeArea} onChange={setHoleArea} hint="net-area deduction" />
          </div>
        </aside>

        <section className="stl-results">
          <div className={`stl-verdict ${govPass ? 'is-pass' : 'is-fail'}`}>
            <div className="stl-verdict__mark">{govPass ? '✓' : '✗'}</div>
            <div>
              <strong>{govPass ? 'Plate adequate' : 'Plate OVERSTRESSED'}</strong>
              <span>PL {fmt(t, 3)}″ × {fmt(b, 2)}″ · {axis}-axis · governing: {r.governing.name}</span>
            </div>
            <div className="stl-verdict__ratio">{fmt(r.governing.ratio * 100, 0)}%</div>
          </div>

          <div className="stl-bars">
            <Bar label="Flexure — Mu / φMn" ratio={r.flexUtil} />
            <Bar label="Shear — Vu / φVn" ratio={r.shearUtil} />
          </div>

          <div className="stl-cards">
            <div className="stl-card">
              <h4>Section properties <span className="stl-tag">rectangle</span></h4>
              <table className="stl-table"><tbody>
                <Row k="Area A = b·t" v={fmt(pr.A, 3)} unit="in²" />
                <Row k={axis === 'minor' ? 'Sy = b·t²/6' : 'Sx = t·b²/6'} v={fmt(fx.S, 3)} unit="in³" />
                <Row k={axis === 'minor' ? 'Zy = b·t²/4' : 'Zx = t·b²/4'} v={fmt(fx.Z, 3)} unit="in³" ref="shape factor 1.5" />
                <Row k="I (bending)" v={fmt(axis === 'minor' ? pr.Iyy : pr.Ixx, 3)} unit="in⁴" />
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>Flexure <span className="stl-tag">Ch. {fx.clause}</span></h4>
              <table className="stl-table"><tbody>
                <Row k="My = Fy·S" v={fmt(kft(fx.My), 2)} unit="kip·ft" />
                <Row k="Mp = Fy·Z ≤ 1.6My" v={fmt(kft(fx.Mp), 2)} unit="kip·ft" />
                {fx.ltbParam !== undefined && <Row k="Lb·d/t²" v={fmt(fx.ltbParam, 0)} ref={`0.08E/Fy = ${fmt(0.08 * 29000 / Fy, 0)}`} />}
                <Row k="Governing" v={fx.governs} />
                <Row k="φMn" v={<strong>{fmt(kft(fx.phiMn), 2)}</strong>} unit="kip·ft" ref="φb = 0.90" />
                <Row k="Demand Mu" v={fmt(Mu, 2)} unit="kip·ft" />
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>Shear <span className="stl-tag">Ch. J4.2</span></h4>
              <table className="stl-table"><tbody>
                <Row k="Agv / Anv" v={`${fmt(sh.Agv, 2)} / ${fmt(sh.Anv, 2)}`} unit="in²" />
                <Row k="Yielding 0.6FyAgv" v={fmt(sh.phiVnYield, 1)} unit="kips" ref="φ = 1.00" />
                <Row k="Rupture 0.6FuAnv" v={fmt(sh.phiVnRupture, 1)} unit="kips" ref="φ = 0.75" />
                <Row k="Governing" v={sh.governs} />
                <Row k="φVn" v={<strong>{fmt(sh.phiVn, 1)}</strong>} unit="kips" />
                <Row k="Demand Vu" v={fmt(Vu, 1)} unit="kips" />
              </tbody></table>
            </div>

            {axis === 'major' ? (
              <div className="stl-card stl-card--wide">
                <h4>Design moment vs unbraced length <span className="stl-tag">F11.2 · LTB</span></h4>
                <LTBCurve b={b} t={t} Fy={Fy} Cb={Cb} Lb_ft={Lb} />
              </div>
            ) : (
              <div className="stl-card">
                <h4>Lateral-torsional buckling <span className="stl-tag">F11</span></h4>
                <p className="stl-note">Minor-axis (flatwise) bending of a solid rectangle has no lateral-torsional buckling and no local buckling — the nominal moment is the plastic yield moment Mp. Switch to major-axis to see the F11.2 LTB curve.</p>
              </div>
            )}
          </div>

          <p className="stl-disclaimer">
            AISC 360-22 (LRFD). Solid flat plates and rectangular bars — flexure per Section F11 (yielding F11-1;
            major-axis lateral-torsional buckling F11-3/F11-4 in the Lb·d/t² regions; φb = 0.90) and shear per Section
            J4.2 (yielding 0.6·Fy·Agv, φ = 1.00; rupture 0.6·Fu·Anv, φ = 0.75). Minor-axis bending of a solid rectangle
            has no LTB or local buckling. Bearing, block shear, connection and stability effects are not included —
            verify independently. A licensed P.E. review remains required.
          </p>
        </section>
      </div>
    </div>
  );
}
