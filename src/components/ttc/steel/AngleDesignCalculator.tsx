'use client';

import React, { useId, useMemo, useState } from 'react';
import angleDb from '@/lib/steel/angle-shapes.json';
import {
  tension, compressionSingle, compressionDouble, flexureSingle, flexureDouble,
  type AngleSingle, type AngleDouble, type Material, type BendAxis, type ConnType, type TrussType,
} from '@/lib/steel/aiscAngle';

const DB = angleDb as { single: AngleSingle[]; double: AngleDouble[] };
const SINGLES = DB.single;
const DOUBLES = DB.double;
const BASES = [...new Map(SINGLES.map((s) => [s.designation, s])).values()]; // unique base sizes

const GRADES = [
  { id: 'A36', label: 'A36', Fy: 36, Fu: 58 },
  { id: 'A572-50', label: 'A572 Gr. 50', Fy: 50, Fu: 65 },
  { id: 'A529-50', label: 'A529 Gr. 50', Fy: 50, Fu: 65 },
  { id: 'custom', label: 'Custom…', Fy: 36, Fu: 58 },
];

const fmt = (x: number, d = 1) => (Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');

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
  if (!Number.isFinite(ratio)) return null;
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

function AngleSVG({ d, b, t, isDouble, orientation }: { d: number; b: number; t: number; isDouble: boolean; orientation?: string }) {
  const W = 220, H = 200, pad = 30;
  const sc = (Math.min(W, H) - 2 * pad) / Math.max(d, b, 1);
  const INK = '#221e17', FILL = 'rgba(201,168,76,0.08)';
  const Lpath = (ox: number, mirror: number) => {
    const bb = b * sc * mirror, dd = d * sc, tt = t * sc;
    const pts = [[0, 0], [bb, 0], [bb, tt], [Math.sign(mirror) * tt, tt], [Math.sign(mirror) * tt, dd], [0, dd]];
    return pts.map((p) => `${(ox + p[0]).toFixed(1)},${(H - pad - p[1]).toFixed(1)}`).join(' ');
  };
  if (!isDouble) {
    const ox = (W - b * sc) / 2;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="stl-svg" role="img" aria-label="angle section">
        <polygon points={Lpath(ox, 1)} fill={FILL} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
        <text x={W / 2} y={H - 8} textAnchor="middle" className="stl-dim">{fmt(d, 0)} × {fmt(b, 0)} × {fmt(t, 3)}</text>
      </svg>
    );
  }
  const cx = W / 2, gap = 8;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stl-svg" role="img" aria-label="double angle section">
      <polygon points={Lpath(cx - gap, -1)} fill={FILL} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
      <polygon points={Lpath(cx + gap, 1)} fill={FILL} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
      <line x1={cx} y1={pad} x2={cx} y2={H - pad} stroke="#c9a84c" strokeWidth={0.7} strokeDasharray="4 3" />
      <text x={W / 2} y={H - 8} textAnchor="middle" className="stl-dim">2L {fmt(d, 0)}×{fmt(b, 0)}×{fmt(t, 3)} {orientation !== 'equal' ? orientation : ''}</text>
    </svg>
  );
}

/* ── main ─────────────────────────────────────────────────────────────── */
export function AngleDesignCalculator() {
  const [config, setConfig] = useState<'single' | 'double'>('single');

  // single selection
  const [query, setQuery] = useState('');
  const sList = useMemo(() => { const q = query.trim().toUpperCase(); return SINGLES.filter((e) => !q || e.designation.toUpperCase().includes(q)); }, [query]);
  const [sDesig, setSDesig] = useState('L4X4X1/2');
  const single = useMemo(() => sList.find((e) => e.designation === sDesig) ?? sList[0] ?? SINGLES[0], [sList, sDesig]);

  // double selection
  const [baseDesig, setBaseDesig] = useState('L4X4X1/2');
  const baseAngle = BASES.find((b) => b.designation === baseDesig) ?? BASES[0];
  const [orientation, setOrientation] = useState<'equal' | 'LLBB' | 'SLBB'>('equal');
  const [gap, setGap] = useState('3/8');
  const dOptions = useMemo(() => DOUBLES.filter((d) => d.base === baseDesig), [baseDesig]);
  const orientOptions = useMemo(() => [...new Set(dOptions.map((d) => d.orientation))], [dOptions]);
  const gapOptions = useMemo(() => [...new Set(dOptions.filter((d) => d.orientation === orientation).map((d) => d.gap))], [dOptions, orientation]);
  const double = useMemo(() => {
    const o = orientOptions.includes(orientation) ? orientation : orientOptions[0];
    const g = dOptions.filter((d) => d.orientation === o).some((d) => d.gap === gap) ? gap : (dOptions.find((d) => d.orientation === o)?.gap ?? '0');
    return dOptions.find((d) => d.orientation === o && d.gap === g) ?? dOptions[0];
  }, [dOptions, orientation, gap, orientOptions]);

  const sec: AngleSingle | AngleDouble = config === 'single' ? single : double;
  const isDouble = config === 'double';

  // material
  const [gradeId, setGradeId] = useState('A36');
  const grade = GRADES.find((g) => g.id === gradeId)!;
  const [cFy, setCFy] = useState(36), [cFu, setCFu] = useState(58);
  const mat: Material = { Fy: gradeId === 'custom' ? cFy : grade.Fy, Fu: gradeId === 'custom' ? cFu : grade.Fu };

  // tension inputs
  const [connType, setConnType] = useState<ConnType>('bolted');
  const [connLong, setConnLong] = useState(true);
  const [boltDia, setBoltDia] = useState(0.75), [nBolts, setNBolts] = useState(4), [pitch, setPitch] = useState(3), [weldLen, setWeldLen] = useState(8);
  const [Put, setPut] = useState(80);
  // compression inputs
  const [Lcomp, setLcomp] = useState(96), [truss, setTruss] = useState<TrussType>('planar');
  const [Lcx, setLcx] = useState(120), [Lcy, setLcy] = useState(120), [connSpacing, setConnSpacing] = useState(48), [connWelded, setConnWelded] = useState(true);
  const [Puc, setPuc] = useState(40);
  // flexure inputs
  const axisOptions: { id: BendAxis; label: string }[] = single.equalLeg
    ? [{ id: 'geometric', label: 'Geometric (leg) axis' }, { id: 'principal-w', label: 'Major principal (w)' }, { id: 'principal-z', label: 'Minor principal (z)' }]
    : [{ id: 'principal-w', label: 'Major principal (w)' }, { id: 'principal-z', label: 'Minor principal (z)' }];
  const [axis, setAxis] = useState<BendAxis>('geometric');
  const [Lb, setLb] = useState(48), [Cb, setCb] = useState(1.14), [restrained, setRestrained] = useState(false), [shortComp, setShortComp] = useState(false);
  const [webComp, setWebComp] = useState(false);
  const [Mu, setMu] = useState(2);

  const activeAxis = config === 'single' && axisOptions.some((a) => a.id === axis) ? axis : axisOptions[0]?.id ?? 'principal-w';

  // results
  const tn = useMemo(() => tension(sec, mat, { conn: connType, boltDia, nPerLine: nBolts, connLength: connType === 'bolted' ? (nBolts - 1) * pitch : weldLen, connectedLegLong: connLong }), [sec, mat, connType, boltDia, nBolts, pitch, weldLen, connLong]);
  const comp = useMemo(() => isDouble
    ? compressionDouble(double, mat, { Lcx, Lcy, connSpacing, connWelded })
    : compressionSingle(single, mat, { L: Lcomp, truss, connectedLegLong: connLong }), [isDouble, double, single, mat, Lcx, Lcy, connSpacing, connWelded, Lcomp, truss, connLong]);
  const flex = useMemo(() => isDouble
    ? flexureDouble(double, mat, { Lb, Cb, webLegsInCompression: webComp })
    : flexureSingle(single, mat, { axis: activeAxis, Lb, Cb, restrained, shortLegCompression: shortComp }), [isDouble, double, single, mat, Lb, Cb, webComp, activeAxis, restrained, shortComp]);

  const phiPnC = comp.phiPn;
  const phiMn = flex.phiMn;
  const utilT = Put > 0 ? Put / tn.phiPn : 0;
  const utilC = Puc > 0 ? Puc / phiPnC : 0;
  const utilM = Mu > 0 ? (Mu * 12) / phiMn : 0; // Mu in kip-ft → kip-in
  const checks = [
    { name: 'Tension (Pu/φPn)', ratio: utilT },
    { name: 'Compression (Pu/φPn)', ratio: utilC },
    { name: 'Flexure (Mu/φMn)', ratio: utilM },
  ].filter((c) => c.ratio > 0);
  const gov = checks.length ? checks.reduce((a, b) => (b.ratio > a.ratio ? b : a)) : null;
  const pass = !gov || gov.ratio <= 1.0;

  return (
    <div className="stl">
      <div className="stl-sheethead">
        <div>
          <div className="stl-brand">TERCERO TABLADA</div>
          <div className="stl-brand-sub">Civil &amp; Structural Engineering Inc.</div>
        </div>
        <div className="stl-sheettitle"><strong>STEEL ANGLE DESIGN</strong><span className="stl-code">AISC 360-16 · LRFD</span></div>
      </div>

      <div className="stl-grid">
        <aside className="stl-inputs">
          <h3 className="stl-h">Configuration</h3>
          <div className="stl-seg" role="tablist">
            <button type="button" className={config === 'single' ? 'is-active' : ''} onClick={() => setConfig('single')}>Single angle</button>
            <button type="button" className={config === 'double' ? 'is-active' : ''} onClick={() => setConfig('double')}>Double angle</button>
          </div>

          {config === 'single' ? (
            <>
              <div className="stl-field"><label htmlFor="ang-search">Filter</label><input id="ang-search" type="search" placeholder="e.g. L4X4 or L6X4" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
              <div className="stl-field"><label htmlFor="ang-des">Angle ({sList.length})</label>
                <select id="ang-des" size={6} value={single.designation} onChange={(e) => setSDesig(e.target.value)} className="stl-listbox">
                  {sList.slice(0, 400).map((e) => <option key={e.designation} value={e.designation}>{e.designation}</option>)}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="stl-field"><label htmlFor="ang-base">Base angle</label>
                <select id="ang-base" size={5} value={baseDesig} onChange={(e) => setBaseDesig(e.target.value)} className="stl-listbox">
                  {BASES.map((b) => <option key={b.designation} value={b.designation}>{b.designation}</option>)}
                </select>
              </div>
              <div className="stl-row2">
                <div className="stl-field"><label htmlFor="ang-or">Orientation</label>
                  <select id="ang-or" value={orientation} onChange={(e) => setOrientation(e.target.value as 'equal' | 'LLBB' | 'SLBB')}>
                    {orientOptions.map((o) => <option key={o} value={o}>{o === 'equal' ? 'Back-to-back' : o}</option>)}
                  </select>
                </div>
                <div className="stl-field"><label htmlFor="ang-gap">Gap (in)</label>
                  <select id="ang-gap" value={gap} onChange={(e) => setGap(e.target.value)}>
                    {gapOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}
          <AngleSVG d={sec.d} b={sec.b} t={isDouble ? (double.tSingle ?? sec.t) : sec.t} isDouble={isDouble} orientation={isDouble ? double.orientation : undefined} />
          <div className="stl-props">
            <span>A <strong>{fmt(sec.A, 2)}</strong> in²</span>
            <span>rx <strong>{fmt(sec.rx, 2)}</strong> in</span>
            <span>{isDouble ? 'ry' : 'rz'} <strong>{fmt(isDouble ? sec.ry : (sec as AngleSingle).rz, 3)}</strong> in</span>
            <span>Sx <strong>{fmt(sec.Sx, 2)}</strong> in³</span>
          </div>

          <h3 className="stl-h">Material</h3>
          <div className="stl-field"><label htmlFor="ang-grade">Grade</label>
            <select id="ang-grade" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>{GRADES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select>
          </div>
          {gradeId === 'custom' ? <div className="stl-row2"><Num label="Fy" unit="ksi" value={cFy} onChange={setCFy} /><Num label="Fu" unit="ksi" value={cFu} onChange={setCFu} /></div> : <p className="stl-note">Fy = {mat.Fy} ksi · Fu = {mat.Fu} ksi</p>}

          <h3 className="stl-h">Tension (Ch. D)</h3>
          <div className="stl-seg" role="tablist">
            <button type="button" className={connType === 'bolted' ? 'is-active' : ''} onClick={() => setConnType('bolted')}>Bolted</button>
            <button type="button" className={connType === 'welded' ? 'is-active' : ''} onClick={() => setConnType('welded')}>Welded</button>
          </div>
          {!sec.equalLeg && (
            <div className="stl-field"><label htmlFor="ang-cl">Connected leg</label>
              <select id="ang-cl" value={connLong ? 'long' : 'short'} onChange={(e) => setConnLong(e.target.value === 'long')}><option value="long">Long leg</option><option value="short">Short leg</option></select>
            </div>
          )}
          {connType === 'bolted' ? (
            <><div className="stl-row2"><Num label="Bolt Ø" unit="in" value={boltDia} onChange={setBoltDia} /><Num label="Bolts / line" value={nBolts} onChange={setNBolts} /></div>
              <Num label="Bolt pitch" unit="in" value={pitch} onChange={setPitch} hint={`l = ${fmt((nBolts - 1) * pitch, 1)} in`} /></>
          ) : <Num label="Weld length l" unit="in" value={weldLen} onChange={setWeldLen} />}
          <Num label="Demand Pu (tension)" unit="k" value={Put} onChange={setPut} />

          <h3 className="stl-h">Compression (Ch. E)</h3>
          {isDouble ? (
            <><div className="stl-row2"><Num label="Lcx" unit="in" value={Lcx} onChange={setLcx} /><Num label="Lcy" unit="in" value={Lcy} onChange={setLcy} /></div>
              <div className="stl-row2"><Num label="Connector spacing a" unit="in" value={connSpacing} onChange={setConnSpacing} hint="0 = none" />
                <div className="stl-field"><label htmlFor="ang-cw">Connectors</label><select id="ang-cw" value={connWelded ? 'w' : 's'} onChange={(e) => setConnWelded(e.target.value === 'w')}><option value="w">Welded/pretens.</option><option value="s">Snug-tight</option></select></div>
              </div></>
          ) : (
            <><div className="stl-row2"><Num label="Length L" unit="in" value={Lcomp} onChange={setLcomp} />
              <div className="stl-field"><label htmlFor="ang-tr">Truss type</label><select id="ang-tr" value={truss} onChange={(e) => setTruss(e.target.value as TrussType)}><option value="planar">Planar / individual</option><option value="box">Box / space</option></select></div>
            </div></>
          )}
          <Num label="Demand Pu (compression)" unit="k" value={Puc} onChange={setPuc} />

          <h3 className="stl-h">Flexure ({isDouble ? 'F9' : 'F10'})</h3>
          {!isDouble && (
            <div className="stl-field"><label htmlFor="ang-ax">Bending axis</label>
              <select id="ang-ax" value={activeAxis} onChange={(e) => setAxis(e.target.value as BendAxis)}>{axisOptions.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
            </div>
          )}
          <div className="stl-row2"><Num label="Lb" unit="in" value={Lb} onChange={setLb} /><Num label="Cb" value={Cb} onChange={setCb} step="0.05" hint="≤ 1.5" /></div>
          {!isDouble && activeAxis === 'geometric' && (
            <div className="stl-field"><label htmlFor="ang-rs">Lateral restraint</label><select id="ang-rs" value={restrained ? 'y' : 'n'} onChange={(e) => setRestrained(e.target.value === 'y')}><option value="n">Unrestrained</option><option value="y">Restrained at max M</option></select></div>
          )}
          {!isDouble && activeAxis === 'principal-w' && !single.equalLeg && (
            <div className="stl-field"><label htmlFor="ang-tc">Compression toe</label><select id="ang-tc" value={shortComp ? 's' : 'l'} onChange={(e) => setShortComp(e.target.value === 's')}><option value="s">Short leg</option><option value="l">Long leg</option></select></div>
          )}
          {isDouble && (
            <div className="stl-field"><label htmlFor="ang-wc">Web legs (outstanding)</label><select id="ang-wc" value={webComp ? 'c' : 't'} onChange={(e) => setWebComp(e.target.value === 'c')}><option value="t">In tension</option><option value="c">In compression</option></select></div>
          )}
          <Num label="Demand Mu" unit="k·ft" value={Mu} onChange={setMu} />
        </aside>

        <section className="stl-results">
          <div className={`stl-verdict ${pass ? 'is-pass' : 'is-fail'}`}>
            <div className="stl-verdict__mark">{pass ? '✓' : '✗'}</div>
            <div><strong>{gov ? (pass ? 'Angle adequate' : 'Angle OVERSTRESSED') : 'Capacities computed'}</strong>
              <span>{sec.designation}{isDouble ? '' : ` (${single.equalLeg ? 'equal' : 'unequal'} leg)`} · {gov ? `governing: ${gov.name}` : 'enter demands for utilisation'}</span></div>
            {gov ? <div className="stl-verdict__ratio">{fmt(gov.ratio * 100, 0)}%</div> : null}
          </div>

          {checks.length > 0 && <div className="stl-bars">{checks.map((c) => <Bar key={c.name} label={c.name} ratio={c.ratio} />)}</div>}

          <div className="stl-cards">
            <div className="stl-card">
              <h4>Tension <span className="stl-tag">{tn.clause}</span></h4>
              <table className="stl-table"><tbody>
                <Row k="φt·Pn yield (D2a)" v={fmt(tn.phiPy)} unit="k" />
                <Row k="φt·Pn rupture (D2b)" v={fmt(tn.phiPr)} unit="k" ref={`U = ${fmt(tn.U, 3)}`} />
                <Row k="Governing φt·Pn" v={<strong>{fmt(tn.phiPn)}</strong>} unit="k" ref={tn.governs} />
              </tbody></table>
              <p className="stl-note">{tn.note}</p>
            </div>

            <div className="stl-card">
              <h4>Compression <span className="stl-tag">{isDouble ? (comp as ReturnType<typeof compressionDouble>).clause : (comp as ReturnType<typeof compressionSingle>).clause}</span></h4>
              <table className="stl-table"><tbody>
                {isDouble ? (<>
                  <Row k="x-axis flexural φPn" v={fmt((comp as ReturnType<typeof compressionDouble>).xAxis.phiPn)} unit="k" ref={`KL/r ${fmt((comp as ReturnType<typeof compressionDouble>).xAxis.KLr, 0)}`} />
                  <Row k="y-axis FTB φPn" v={fmt((comp as ReturnType<typeof compressionDouble>).yAxisFTB.phiPn)} unit="k" ref="E4-3 + E6" />
                  <Row k="Governing" v={<strong>{fmt(comp.phiPn)}</strong>} unit="k" ref={(comp as ReturnType<typeof compressionDouble>).governing} />
                </>) : (<>
                  <Row k="(Lc/r)eff" v={fmt((comp as ReturnType<typeof compressionSingle>).KLreff, 0)} ref={(comp as ReturnType<typeof compressionSingle>).clause} />
                  <Row k="Fcr" v={fmt((comp as ReturnType<typeof compressionSingle>).Fcr, 1)} unit="ksi" />
                  <Row k="φc·Pn" v={<strong>{fmt(comp.phiPn)}</strong>} unit="k" ref="φc = 0.90" />
                </>)}
                <Row k="Demand Pu" v={fmt(Puc)} unit="k" />
              </tbody></table>
              {(isDouble ? (comp as ReturnType<typeof compressionDouble>).slender : (comp as ReturnType<typeof compressionSingle>).slender) ? <p className="stl-note">Slender leg(s): E7 effective area applied.</p> : null}
              {!isDouble && !(comp as ReturnType<typeof compressionSingle>).valid ? <p className="stl-note">{(comp as ReturnType<typeof compressionSingle>).note}</p> : null}
            </div>

            <div className="stl-card">
              <h4>Flexure <span className="stl-tag">{flex.clause}</span></h4>
              <table className="stl-table"><tbody>
                <Row k="Yield-limit Mn" v={fmt((isDouble ? (flex as ReturnType<typeof flexureDouble>).Mp : (flex as ReturnType<typeof flexureSingle>).My) / 12, 1)} unit="k·ft" />
                {flex.Mcr != null && <Row k="Mcr (LTB)" v={fmt(flex.Mcr / 12, 1)} unit="k·ft" />}
                <Row k="φb·Mn" v={<strong>{fmt(phiMn / 12, 1)}</strong>} unit="k·ft" ref={flex.governs} />
                <Row k="Demand Mu" v={fmt(Mu, 1)} unit="k·ft" />
              </tbody></table>
              {flex.note ? <p className="stl-note">{flex.note}</p> : null}
            </div>

            <div className="stl-card">
              <h4>Section properties <span className="stl-tag">{isDouble ? '2L' : 'L'}</span></h4>
              <table className="stl-table"><tbody>
                <Row k="Area" v={fmt(sec.A, 2)} unit="in²" />
                <Row k="Ix / Sx" v={`${fmt(sec.Ix, 1)} / ${fmt(sec.Sx, 2)}`} />
                <Row k={isDouble ? 'rx / ry' : 'rx / rz'} v={`${fmt(sec.rx, 2)} / ${fmt(isDouble ? sec.ry : (single).rz, 3)}`} unit="in" />
                <Row k="Weight" v={fmt(sec.weight, 1)} unit="lb/ft" />
              </tbody></table>
            </div>
          </div>

          <p className="stl-disclaimer">
            AISC 360-16 (LRFD). Single (L) and double (2L) hot-rolled angles. Single-angle compression uses the
            E5 effective-slenderness method (angles connected through one leg); double-angle compression uses
            E3 (x) + E4 flexural-torsional (y) with E6 built-up modification. <strong>Block shear (J4.3)</strong> at
            connections and H2 biaxial interaction are not included — check separately. Verify connection eccentricity,
            bracing and load combinations independently. A licensed P.E. review remains required.
          </p>
        </section>
      </div>
    </div>
  );
}
