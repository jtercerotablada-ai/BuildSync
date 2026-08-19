'use client';

import React, { useId, useMemo, useState } from 'react';
import steelDb from '@/lib/steel/aisc-shapes.json';
import { buildISection, buildHSSRect, buildRound } from '@/lib/steel/section-props';
import {
  analyzeMember,
  type SteelSection,
  type SteelFamily,
  type MemberInputs,
  type MemberResult,
} from '@/lib/steel/aisc360';

interface RawShape {
  designation: string; family: string; weight: number;
  A: number; d: number; bf: number; tf: number; tw: number;
  Ix: number; Sx: number; Zx: number; rx: number;
  Iy: number; Sy: number; Zy: number; ry: number; J: number; Cw: number;
}
const ALL_SHAPES = (steelDb as { shapes: RawShape[] }).shapes;

const SUPPORTED: SteelFamily[] = ['W', 'S', 'HSS-R', 'HSS-C', 'Pipe'];
const FAMILY_LABEL: Record<string, string> = {
  W: 'W — Wide Flange', S: 'S — American Std Beam',
  'HSS-R': 'HSS — Rect / Square', 'HSS-C': 'HSS — Round', Pipe: 'Pipe',
};

const GRADES = [
  { id: 'A992', label: 'A992 (W-shapes)', Fy: 50, Fu: 65 },
  { id: 'A500C-R', label: 'A500 Gr. C (HSS rect)', Fy: 50, Fu: 62 },
  { id: 'A500C-C', label: 'A500 Gr. C (HSS round)', Fy: 46, Fu: 62 },
  { id: 'A36', label: 'A36', Fy: 36, Fu: 58 },
  { id: 'A572-50', label: 'A572 Gr. 50', Fy: 50, Fu: 65 },
  { id: 'A53B', label: 'A53 Gr. B (pipe)', Fy: 35, Fu: 60 },
  { id: 'custom', label: 'Custom…', Fy: 50, Fu: 65 },
];

function toSection(e: RawShape): SteelSection {
  return { ...e, family: e.family as SteelFamily };
}
const fmt = (x: number, d = 1) => (Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');

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

function SectionSVG({ s }: { s: SteelSection }) {
  const W = 220, H = 200, pad = 34;
  const round = s.family === 'HSS-C' || s.family === 'Pipe';
  const hss = s.family === 'HSS-R';
  const sc = (Math.min(W, H) - 2 * pad) / Math.max(s.d, s.bf);
  const cx = W / 2, cy = H / 2;
  const INK = '#221e17';
  if (round) {
    const R = (s.d / 2) * sc, r = R - s.tf * sc;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="stl-svg" role="img" aria-label={`${s.designation} section`}>
        <circle cx={cx} cy={cy} r={R} fill="rgba(201,168,76,0.06)" stroke={INK} strokeWidth={1.4} />
        <circle cx={cx} cy={cy} r={r} fill="#fff" stroke={INK} strokeWidth={1.1} />
        <text x={cx} y={H - 8} textAnchor="middle" className="stl-dim">D = {fmt(s.d, 2)} in · t = {fmt(s.tf, 3)}</text>
      </svg>
    );
  }
  if (hss) {
    const bw = s.bf * sc, hh = s.d * sc, t = s.tf * sc, x = cx - bw / 2, y = cy - hh / 2;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="stl-svg" role="img" aria-label={`${s.designation} section`}>
        <rect x={x} y={y} width={bw} height={hh} fill="rgba(201,168,76,0.06)" stroke={INK} strokeWidth={1.4} />
        <rect x={x + t} y={y + t} width={bw - 2 * t} height={hh - 2 * t} fill="#fff" stroke={INK} strokeWidth={1.1} />
        <text x={cx} y={H - 8} textAnchor="middle" className="stl-dim">{fmt(s.bf, 2)} × {fmt(s.d, 2)} × {fmt(s.tf, 3)}</text>
      </svg>
    );
  }
  const bw = s.bf * sc, hh = s.d * sc, tf = s.tf * sc, tw = s.tw * sc, x0 = cx - bw / 2, y0 = cy - hh / 2;
  const pts = [[x0, y0], [x0 + bw, y0], [x0 + bw, y0 + tf], [cx + tw / 2, y0 + tf],
    [cx + tw / 2, y0 + hh - tf], [x0 + bw, y0 + hh - tf], [x0 + bw, y0 + hh], [x0, y0 + hh],
    [x0, y0 + hh - tf], [cx - tw / 2, y0 + hh - tf], [cx - tw / 2, y0 + tf], [x0, y0 + tf]]
    .map((p) => p.join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stl-svg" role="img" aria-label={`${s.designation} section`}>
      <polygon points={pts} fill="rgba(201,168,76,0.07)" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
      <line x1={cx} y1={y0 - 6} x2={cx} y2={y0 + hh + 6} stroke="#c9a84c" strokeWidth={0.8} strokeDasharray="4 3" />
      <text x={cx} y={H - 8} textAnchor="middle" className="stl-dim">d = {fmt(s.d, 2)} · bf = {fmt(s.bf, 2)} in</text>
    </svg>
  );
}

function Row({ k, v, unit, ref }: { k: string; v: React.ReactNode; unit?: string; ref?: string }) {
  return (<tr><td className="stl-k">{k}</td><td className="stl-v">{v}{unit ? <span className="stl-unit"> {unit}</span> : null}</td><td className="stl-ref">{ref}</td></tr>);
}

type SectionMode = 'library' | 'custom';
type CustomKind = 'I' | 'HSS-R' | 'HSS-C';

/* ── main ─────────────────────────────────────────────────────────────── */
export function SteelMemberCalculator() {
  const [mode, setMode] = useState<SectionMode>('library');

  // library
  const [family, setFamily] = useState<SteelFamily>('W');
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toUpperCase();
    return ALL_SHAPES.filter((e) => e.family === family && (!q || e.designation.toUpperCase().includes(q)));
  }, [family, query]);
  const [desig, setDesig] = useState('W14X90');
  const libEntry = useMemo(() => list.find((e) => e.designation === desig) ?? list[0] ?? ALL_SHAPES.find((e) => e.family === family), [list, desig, family]);

  // custom
  const [ckind, setCkind] = useState<CustomKind>('I');
  const [cd, setCd] = useState(14), [cbf, setCbf] = useState(8), [ctf, setCtf] = useState(0.5), [ctw, setCtw] = useState(0.375);
  const [cB, setCB] = useState(8), [cH, setCH] = useState(8), [ct, setCt] = useState(0.5);
  const [cD, setCD] = useState(8), [cDt, setCDt] = useState(0.375);

  const section = useMemo<SteelSection | null>(() => {
    if (mode === 'custom') {
      if (ckind === 'I') return buildISection(cd, cbf, ctf, ctw);
      if (ckind === 'HSS-R') return buildHSSRect(cB, cH, ct);
      return buildRound(cD, cDt);
    }
    return libEntry ? toSection(libEntry) : null;
  }, [mode, ckind, cd, cbf, ctf, ctw, cB, cH, ct, cD, cDt, libEntry]);

  // material
  const [gradeId, setGradeId] = useState('A992');
  const grade = GRADES.find((g) => g.id === gradeId)!;
  const [cFy, setCFy] = useState(50), [cFu, setCFu] = useState(65);
  const activeFy = gradeId === 'custom' ? cFy : grade.Fy;
  const activeFu = gradeId === 'custom' ? cFu : grade.Fu;

  // length / bracing
  const [Lx, setLx] = useState(14), [Kx, setKx] = useState(1);
  const [Ly, setLy] = useState(14), [Ky, setKy] = useState(1);
  const [Lb, setLb] = useState(14), [Cb, setCb] = useState(1);

  // demands
  const [axialKind, setAxialKind] = useState<'compression' | 'tension'>('compression');
  const [P, setP] = useState(400), [Mux, setMux] = useState(120), [Muy, setMuy] = useState(0), [Vu, setVu] = useState(30);
  const [anFrac, setAnFrac] = useState(1), [U, setU] = useState(1); // net-area fraction An/Ag and shear-lag U

  const result: MemberResult | null = useMemo(() => {
    if (!section) return null;
    const inp: MemberInputs = {
      section, material: { Fy: activeFy, Fu: activeFu },
      Lcx: Kx * Lx * 12, Lcy: Ky * Ly * 12, Lcz: Ky * Ly * 12, Lb: Lb * 12, Cb,
      An: Math.max(0.01, anFrac) * section.A, U,
      Pu: axialKind === 'tension' ? Math.abs(P) : -Math.abs(P),
      Mux: Mux * 12, Muy: Muy * 12, Vu,
    };
    return analyzeMember(inp);
  }, [section, activeFy, activeFu, Lx, Kx, Ly, Ky, Lb, Cb, axialKind, P, Mux, Muy, Vu, anFrac, U]);

  if (!section || !result) return null;
  const r = result;
  const govPass = r.governing.ratio <= 1.0;
  const cls = r.slenderness;

  return (
    <div className="stl">
      <div className="stl-sheethead">
        <div>
          <div className="stl-brand">TERCERO TABLADA</div>
          <div className="stl-brand-sub">Civil &amp; Structural Engineering Inc.</div>
        </div>
        <div className="stl-sheettitle">
          <strong>STEEL MEMBER DESIGN</strong>
          <span className="stl-code">AISC 360-22 · LRFD</span>
        </div>
      </div>

      <div className="stl-grid">
        <aside className="stl-inputs">
          <h3 className="stl-h">Section</h3>
          <div className="stl-seg" role="tablist">
            <button type="button" className={mode === 'library' ? 'is-active' : ''} onClick={() => setMode('library')}>Library</button>
            <button type="button" className={mode === 'custom' ? 'is-active' : ''} onClick={() => setMode('custom')}>Custom</button>
          </div>

          {mode === 'library' ? (
            <>
              <div className="stl-field">
                <label htmlFor="stl-fam">Family</label>
                <select id="stl-fam" value={family} onChange={(e) => { const f = e.target.value as SteelFamily; setFamily(f); setQuery(''); const first = ALL_SHAPES.find((x) => x.family === f); if (first) setDesig(first.designation); }}>
                  {SUPPORTED.map((f) => <option key={f} value={f}>{FAMILY_LABEL[f]} ({ALL_SHAPES.filter((x) => x.family === f).length})</option>)}
                </select>
              </div>
              <div className="stl-field">
                <label htmlFor="stl-search">Filter</label>
                <input id="stl-search" type="search" placeholder="e.g. W14 or 8X8" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="stl-field">
                <label htmlFor="stl-des">Designation ({list.length})</label>
                <select id="stl-des" size={6} value={libEntry?.designation} onChange={(e) => setDesig(e.target.value)} className="stl-listbox">
                  {list.slice(0, 400).map((e) => <option key={e.designation} value={e.designation}>{e.designation}</option>)}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="stl-field">
                <label htmlFor="stl-ck">Shape</label>
                <select id="stl-ck" value={ckind} onChange={(e) => setCkind(e.target.value as CustomKind)}>
                  <option value="I">I-shape (doubly-symmetric)</option>
                  <option value="HSS-R">HSS — rectangular / square</option>
                  <option value="HSS-C">HSS — round / pipe</option>
                </select>
              </div>
              {ckind === 'I' && (<>
                <div className="stl-row2"><Num label="d — depth" unit="in" value={cd} onChange={setCd} /><Num label="bf — flange" unit="in" value={cbf} onChange={setCbf} /></div>
                <div className="stl-row2"><Num label="tf — flange t" unit="in" value={ctf} onChange={setCtf} /><Num label="tw — web t" unit="in" value={ctw} onChange={setCtw} /></div>
              </>)}
              {ckind === 'HSS-R' && (
                <div className="stl-row2"><Num label="B — width" unit="in" value={cB} onChange={setCB} /><Num label="H — height" unit="in" value={cH} onChange={setCH} /></div>
              )}
              {ckind === 'HSS-R' && <Num label="t — wall" unit="in" value={ct} onChange={setCt} />}
              {ckind === 'HSS-C' && (
                <div className="stl-row2"><Num label="D — outside dia." unit="in" value={cD} onChange={setCD} /><Num label="t — wall" unit="in" value={cDt} onChange={setCDt} /></div>
              )}
              <p className="stl-note">Sharp-corner properties (built-up / plated member).</p>
            </>
          )}

          <SectionSVG s={section} />
          <div className="stl-props">
            <span>A <strong>{fmt(section.A, 2)}</strong> in²</span>
            <span>Zx <strong>{fmt(section.Zx, 1)}</strong> in³</span>
            <span>rx <strong>{fmt(section.rx, 2)}</strong> in</span>
            <span>ry <strong>{fmt(section.ry, 2)}</strong> in</span>
          </div>

          <h3 className="stl-h">Material</h3>
          <div className="stl-field">
            <label htmlFor="stl-grade">Grade</label>
            <select id="stl-grade" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
              {GRADES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </div>
          {gradeId === 'custom' ? (
            <div className="stl-row2"><Num label="Fy" unit="ksi" value={cFy} onChange={setCFy} /><Num label="Fu" unit="ksi" value={cFu} onChange={setCFu} /></div>
          ) : (<p className="stl-note">Fy = {activeFy} ksi · Fu = {activeFu} ksi</p>)}

          <h3 className="stl-h">Length &amp; bracing</h3>
          <div className="stl-row2"><Num label="Lx" unit="ft" value={Lx} onChange={setLx} /><Num label="Kx" value={Kx} onChange={setKx} /></div>
          <div className="stl-row2"><Num label="Ly" unit="ft" value={Ly} onChange={setLy} /><Num label="Ky" value={Ky} onChange={setKy} /></div>
          <div className="stl-row2"><Num label="Lb (LTB)" unit="ft" value={Lb} onChange={setLb} /><Num label="Cb" value={Cb} onChange={setCb} hint="1.0 conservative" /></div>

          <h3 className="stl-h">Demands (factored, LRFD)</h3>
          <div className="stl-seg" role="tablist">
            <button type="button" className={axialKind === 'compression' ? 'is-active' : ''} onClick={() => setAxialKind('compression')}>Compression</button>
            <button type="button" className={axialKind === 'tension' ? 'is-active' : ''} onClick={() => setAxialKind('tension')}>Tension</button>
          </div>
          <Num label={`Pu (${axialKind})`} unit="kips" value={P} onChange={setP} />
          {axialKind === 'tension' && (
            <div className="stl-row2"><Num label="An / Ag" value={anFrac} onChange={setAnFrac} step="0.01" hint="net/gross" /><Num label="U (shear-lag)" value={U} onChange={setU} step="0.05" /></div>
          )}
          <div className="stl-row2"><Num label="Mux" unit="k·ft" value={Mux} onChange={setMux} /><Num label="Muy" unit="k·ft" value={Muy} onChange={setMuy} /></div>
          <Num label="Vu" unit="kips" value={Vu} onChange={setVu} />
        </aside>

        <section className="stl-results">
          <div className={`stl-verdict ${govPass ? 'is-pass' : 'is-fail'}`}>
            <div className="stl-verdict__mark">{govPass ? '✓' : '✗'}</div>
            <div>
              <strong>{govPass ? 'Member adequate' : 'Member OVERSTRESSED'}</strong>
              <span>Governing: {r.governing.name} — utilisation {fmt(r.governing.ratio, 2)}</span>
            </div>
            <div className="stl-verdict__ratio">{fmt(r.governing.ratio * 100, 0)}%</div>
          </div>

          <div className="stl-bars">
            {r.axialCheck.kind !== 'none' && <Bar label={`Axial (${r.axialCheck.kind})`} ratio={r.axialCheck.ratio} />}
            <Bar label="Bending — major" ratio={r.bendingXCheck} />
            {Muy !== 0 && <Bar label="Bending — minor" ratio={r.bendingYCheck} />}
            <Bar label="Shear" ratio={r.shearCheck} />
            {r.combined && <Bar label={`Combined axial+flexure (${r.combined.equation})`} ratio={r.combined.ratio} />}
          </div>

          <div className="stl-cards">
            <div className="stl-card">
              <h4>Section classification <span className="stl-tag">Table B4.1</span></h4>
              <table className="stl-table"><tbody>
                <Row k="Flange (flexure)" v={<span className={`stl-cls stl-cls--${cls.flangeClassFlex}`}>{cls.flangeClassFlex}</span>} ref={`λ = ${fmt(cls.flangeLambda, 1)}`} />
                <Row k="Web (flexure)" v={<span className={`stl-cls stl-cls--${cls.webClassFlex}`}>{cls.webClassFlex}</span>} ref={`λ = ${fmt(cls.webLambda, 1)}`} />
                <Row k="Compression elements" v={cls.flangeSlenderComp || cls.webSlenderComp ? <span className="stl-cls stl-cls--slender">slender</span> : <span className="stl-cls stl-cls--compact">non-slender</span>} />
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>{r.axialCheck.kind === 'tension' ? 'Axial tension' : 'Axial compression'} <span className="stl-tag">{r.axialCheck.kind === 'tension' ? r.tension.clause : r.compression.clause}</span></h4>
              <table className="stl-table"><tbody>
                {r.axialCheck.kind === 'tension' ? (<>
                  <Row k="Governing limit state" v={r.tension.detail} />
                  <Row k="φt·Pn" v={<strong>{fmt(r.tension.phiRn)}</strong>} unit="kips" ref={`φt = ${r.tension.phi.toFixed(2)}`} />
                </>) : (<>
                  <Row k="Buckling mode" v={r.compression.mode} />
                  <Row k="Lc/r (governing)" v={fmt(r.compression.slendernessRatio, 0)} />
                  <Row k="Fe (elastic)" v={fmt(r.compression.Fe, 1)} unit="ksi" ref="E3-4 / E4" />
                  <Row k="Fcr (critical)" v={fmt(r.compression.Fcr, 1)} unit="ksi" ref="E3-2/E3-3" />
                  {r.compression.slender && <Row k="Ae (effective)" v={fmt(r.compression.Ae, 2)} unit="in²" ref="E7" />}
                  <Row k="φc·Pn" v={<strong>{fmt(r.compression.phiRn)}</strong>} unit="kips" ref="φc = 0.90" />
                </>)}
                <Row k="Demand Pu" v={fmt(Math.abs(P))} unit="kips" />
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>Flexure — major axis <span className="stl-tag">{r.flexureMajor.clause}</span></h4>
              <table className="stl-table"><tbody>
                <Row k="Mp = Fy·Zx" v={fmt(r.flexureMajor.Mp / 12)} unit="k·ft" />
                {r.flexureMajor.Lp !== undefined && <Row k="Lp / Lr" v={`${fmt(r.flexureMajor.Lp / 12)} / ${fmt((r.flexureMajor.Lr ?? 0) / 12)}`} unit="ft" ref="F2-5 / F2-6" />}
                <Row k="Governing" v={r.flexureMajor.governs} />
                <Row k="φb·Mn" v={<strong>{fmt(r.flexureMajor.phiRn / 12)}</strong>} unit="k·ft" ref="φb = 0.90" />
                <Row k="Demand Mux" v={fmt(Mux)} unit="k·ft" />
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>Flexure — minor axis <span className="stl-tag">{r.flexureMinor.clause}</span></h4>
              <table className="stl-table"><tbody>
                <Row k="Governing" v={r.flexureMinor.governs} />
                <Row k="φb·Mn" v={<strong>{fmt(r.flexureMinor.phiRn / 12)}</strong>} unit="k·ft" />
                <Row k="Demand Muy" v={fmt(Muy)} unit="k·ft" />
              </tbody></table>
            </div>

            <div className="stl-card">
              <h4>Shear <span className="stl-tag">{r.shear.clause}</span></h4>
              <table className="stl-table"><tbody>
                <Row k="Detail" v={r.shear.detail} />
                <Row k="φv·Vn" v={<strong>{fmt(r.shear.phiRn)}</strong>} unit="kips" ref={`φv = ${r.shear.phi.toFixed(2)}`} />
                <Row k="Demand Vu" v={fmt(Vu)} unit="kips" />
              </tbody></table>
            </div>

            {r.combined && (
              <div className="stl-card">
                <h4>Combined axial + flexure <span className="stl-tag">H1-1 ({r.combined.equation})</span></h4>
                <table className="stl-table"><tbody>
                  <Row k="Pr / Pc" v={fmt(r.combined.Pr / r.combined.Pc, 3)} ref={`${fmt(r.combined.Pr)} / ${fmt(r.combined.Pc)} k`} />
                  <Row k="Mrx / Mcx" v={fmt(r.combined.Mrx / r.combined.Mcx, 3)} ref={`${fmt(r.combined.Mrx / 12)} / ${fmt(r.combined.Mcx / 12)} k·ft`} />
                  {Muy !== 0 && <Row k="Mry / Mcy" v={fmt(r.combined.Mry / r.combined.Mcy, 3)} />}
                  <Row k="Interaction ratio" v={<strong className={r.combined.pass ? 'stl-good' : 'stl-bad'}>{fmt(r.combined.ratio, 3)}</strong>} ref="≤ 1.0" />
                </tbody></table>
              </div>
            )}
          </div>

          <p className="stl-disclaimer">
            AISC 360-22 (LRFD). Doubly-symmetric I-shapes, HSS and pipe. Effective lengths, Cb and demands are user inputs —
            verify bracing and load combinations independently. Custom sections use idealised sharp-corner properties.
            Engineering judgment and a licensed P.E. review remain required.
          </p>
        </section>
      </div>
    </div>
  );
}
