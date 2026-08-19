'use client';

import React, { useId, useMemo, useState } from 'react';
import { analyzeBeam, type BeamInput, type SupportType } from '@/lib/beam-analysis/beamAnalysis';

const fmt = (x: number, d = 1) => (Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');

type Sup = { pos: number; type: SupportType };
type Pt = { pos: number; P: number };
type Ds = { x1: number; x2: number; w1: number; w2: number };
type Mo = { pos: number; M: number };

function Num({ label, unit, value, onChange, step = 'any', w }: { label?: string; unit?: string; value: number; onChange: (v: number) => void; step?: string; w?: string }) {
  const id = useId();
  return (
    <div className="stl-field" style={w ? { width: w } : undefined}>
      {label ? <label htmlFor={id}>{label} {unit ? <span className="stl-unit">({unit})</span> : null}</label> : null}
      <input id={id} type="number" step={step} value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

/* one stacked diagram panel (filled area with zero line + peak marker).
 * Luxury-minimal palette: ink line + subtle ink fill + gold peak markers. */
const INK = '#221e17', GOLD = '#c9a84c', GOLD_DEEP = '#9a7a2c';
function Panel({ xs, ys, W, H, y0, L, label, unit, invert }: {
  xs: number[]; ys: number[]; W: number; H: number; y0: number; L: number; label: string; unit: string; invert?: boolean;
}) {
  const mL = 46, mR = 10;
  const yAbs = Math.max(1e-9, ...ys.map((v) => Math.abs(v)));
  const px = (x: number) => mL + (x / L) * (W - mL - mR);
  const midY = y0 + H / 2;
  const s = invert ? -1 : 1;
  const py = (v: number) => midY - s * (v / yAbs) * (H / 2 - 6);
  const line = xs.map((x, i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)},${py(ys[i]).toFixed(1)}`).join(' ');
  const area = `M${px(0)},${midY.toFixed(1)} ${line.slice(1)} L${px(L).toFixed(1)},${midY.toFixed(1)} Z`;
  let iMax = 0, iMin = 0; ys.forEach((v, i) => { if (v > ys[iMax]) iMax = i; if (v < ys[iMin]) iMin = i; });
  const peaks = [iMax, iMin].filter((i, k, a) => a.indexOf(i) === k && Math.abs(ys[i]) > 1e-6 * yAbs);
  return (
    <g>
      <text x={mL} y={y0 + 12} className="stl-chart__lbl" style={{ fontWeight: 600, fill: INK }}>{label}</text>
      <line x1={mL} y1={midY} x2={W - mR} y2={midY} stroke="#cfc7b6" strokeWidth={1} />
      <path d={area} fill={INK} fillOpacity={0.06} />
      <path d={line} fill="none" stroke={INK} strokeWidth={1.5} />
      {peaks.map((i) => (
        <g key={i}>
          <circle cx={px(xs[i])} cy={py(ys[i])} r={3} fill={GOLD} stroke={INK} strokeWidth={0.6} />
          <text x={px(xs[i])} y={py(ys[i]) + (ys[i] >= 0 ? -5 : 12) * s} textAnchor="middle" className="stl-chart__lbl" style={{ fill: GOLD_DEEP, fontWeight: 600 }}>{fmt(ys[i], Math.abs(ys[i]) < 10 ? 2 : 0)}</text>
        </g>
      ))}
      <text x={mL - 4} y={y0 + 12} textAnchor="end" className="stl-chart__ax">{unit}</text>
    </g>
  );
}

const PRESETS: { id: string; label: string; sup: (L: number) => Sup[] }[] = [
  { id: 'ss', label: 'Simply supported', sup: (L) => [{ pos: 0, type: 'pin' }, { pos: L, type: 'roller' }] },
  { id: 'cant-l', label: 'Cantilever (fixed left)', sup: () => [{ pos: 0, type: 'fixed' }] },
  { id: 'cant-r', label: 'Cantilever (fixed right)', sup: (L) => [{ pos: L, type: 'fixed' }] },
  { id: 'ff', label: 'Fixed–fixed', sup: (L) => [{ pos: 0, type: 'fixed' }, { pos: L, type: 'fixed' }] },
  { id: 'prop', label: 'Propped cantilever', sup: (L) => [{ pos: 0, type: 'fixed' }, { pos: L, type: 'roller' }] },
  { id: 'two', label: 'Two-span', sup: (L) => [{ pos: 0, type: 'pin' }, { pos: L / 2, type: 'roller' }, { pos: L, type: 'roller' }] },
];

export function BeamAnalysisCalculator() {
  const [Lft, setLft] = useState(20);
  const [E, setE] = useState(29000), [I, setI] = useState(300);
  const [supports, setSupports] = useState<Sup[]>([{ pos: 0, type: 'pin' }, { pos: 20, type: 'roller' }]);
  const [points, setPoints] = useState<Pt[]>([]);
  const [dists, setDists] = useState<Ds[]>([{ x1: 0, x2: 20, w1: 1.5, w2: 1.5 }]);
  const [moments, setMoments] = useState<Mo[]>([]);

  const applyPreset = (id: string) => { const p = PRESETS.find((x) => x.id === id); if (p) setSupports(p.sup(Lft)); };

  // solve (convert ft/klf/kip·ft → in/kip·in/kip·in)
  const result = useMemo(() => {
    const L = Lft * 12;
    const inp: BeamInput = {
      L, EI: E * I,
      supports: supports.map((s) => ({ pos: Math.min(Math.max(s.pos, 0), Lft) * 12, type: s.type })),
      points: points.map((p) => ({ pos: Math.min(Math.max(p.pos, 0), Lft) * 12, P: p.P })),
      moments: moments.map((m) => ({ pos: Math.min(Math.max(m.pos, 0), Lft) * 12, M: m.M * 12 })),
      dists: dists.map((d) => ({ x1: Math.max(0, d.x1) * 12, x2: Math.min(Lft, d.x2) * 12, w1: d.w1 / 12, w2: d.w2 / 12 })),
    };
    try { return analyzeBeam(inp); } catch { return null; }
  }, [Lft, E, I, supports, points, dists, moments]);

  const stable = !!result && result.stable;

  // diagram data in display units (ft, kips, kip·ft, in)
  const xft = result ? result.x.map((v) => v / 12) : [];
  const shear = result ? result.shear : [];
  const momKft = result ? result.moment.map((v) => v / 12) : [];
  const defl = result ? result.deflection : [];
  const L = Lft;

  const W = 560, hSchem = 54, hPanel = 104, mT = 8;
  const totalH = mT + hSchem + hPanel * 3 + 20;
  const supX = (pos: number) => 46 + (pos / L) * (W - 46 - 10);

  return (
    <div className="stl">
      <div className="stl-sheethead">
        <div><div className="stl-brand">TERCERO TABLADA</div><div className="stl-brand-sub">Civil &amp; Structural Engineering Inc.</div></div>
        <div className="stl-sheettitle"><strong>BEAM ANALYSIS</strong><span className="stl-code">SHEAR · MOMENT · DEFLECTION</span></div>
      </div>

      <div className="stl-grid">
        <aside className="stl-inputs">
          <h3 className="stl-h">Beam</h3>
          <div className="stl-row2"><Num label="Length L" unit="ft" value={Lft} onChange={setLft} /><div /></div>
          <div className="stl-row2"><Num label="E" unit="ksi" value={E} onChange={setE} /><Num label="I" unit="in⁴" value={I} onChange={setI} /></div>
          <p className="stl-note">EI = {fmt(E * I / 1e6, 2)} ×10⁶ kip·in²</p>

          <h3 className="stl-h">Supports</h3>
          <div className="stl-field"><label htmlFor="bm-preset">Preset</label>
            <select id="bm-preset" defaultValue="" onChange={(e) => { applyPreset(e.target.value); e.target.value = ''; }}>
              <option value="" disabled>Choose a layout…</option>
              {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select></div>
          {supports.map((s, i) => (
            <div key={i} className="stl-editrow">
              <Num value={s.pos} onChange={(v) => setSupports(supports.map((x, j) => j === i ? { ...x, pos: v } : x))} />
              <select value={s.type} onChange={(e) => setSupports(supports.map((x, j) => j === i ? { ...x, type: e.target.value as SupportType } : x))}>
                <option value="pin">Pin</option><option value="roller">Roller</option><option value="fixed">Fixed</option>
              </select>
              <button type="button" className="stl-x" onClick={() => setSupports(supports.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button type="button" className="stl-add" onClick={() => setSupports([...supports, { pos: L, type: 'roller' }])}>+ support (pos ft)</button>

          <h3 className="stl-h">Point loads</h3>
          {points.map((p, i) => (
            <div key={i} className="stl-editrow">
              <Num value={p.pos} onChange={(v) => setPoints(points.map((x, j) => j === i ? { ...x, pos: v } : x))} />
              <Num value={p.P} onChange={(v) => setPoints(points.map((x, j) => j === i ? { ...x, P: v } : x))} />
              <button type="button" className="stl-x" onClick={() => setPoints(points.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button type="button" className="stl-add" onClick={() => setPoints([...points, { pos: L / 2, P: 10 }])}>+ point (pos ft, P kip ↓)</button>

          <h3 className="stl-h">Distributed loads</h3>
          {dists.map((d, i) => (
            <div key={i} className="stl-editrow stl-editrow--4">
              <Num value={d.x1} onChange={(v) => setDists(dists.map((x, j) => j === i ? { ...x, x1: v } : x))} />
              <Num value={d.x2} onChange={(v) => setDists(dists.map((x, j) => j === i ? { ...x, x2: v } : x))} />
              <Num value={d.w1} onChange={(v) => setDists(dists.map((x, j) => j === i ? { ...x, w1: v } : x))} />
              <Num value={d.w2} onChange={(v) => setDists(dists.map((x, j) => j === i ? { ...x, w2: v } : x))} />
              <button type="button" className="stl-x" onClick={() => setDists(dists.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <p className="stl-note stl-note--head">x₁ · x₂ (ft) · w₁ · w₂ (klf ↓)</p>
          <button type="button" className="stl-add" onClick={() => setDists([...dists, { x1: 0, x2: L, w1: 1, w2: 1 }])}>+ distributed</button>

          <h3 className="stl-h">Applied moments</h3>
          {moments.map((m, i) => (
            <div key={i} className="stl-editrow">
              <Num value={m.pos} onChange={(v) => setMoments(moments.map((x, j) => j === i ? { ...x, pos: v } : x))} />
              <Num value={m.M} onChange={(v) => setMoments(moments.map((x, j) => j === i ? { ...x, M: v } : x))} />
              <button type="button" className="stl-x" onClick={() => setMoments(moments.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button type="button" className="stl-add" onClick={() => setMoments([...moments, { pos: L / 2, M: 20 }])}>+ moment (pos ft, M kip·ft ↺)</button>
        </aside>

        <section className="stl-results">
          {!result ? <div className="stl-verdict is-fail"><div className="stl-verdict__mark">✗</div><div><strong>Cannot solve</strong><span>check inputs</span></div></div> : (<>
            <div className={`stl-verdict ${stable ? 'is-pass' : 'is-fail'}`}>
              <div className="stl-verdict__mark">{stable ? '✓' : '!'}</div>
              <div><strong>{stable ? 'Beam analysed' : 'Unstable / mechanism'}</strong>
                <span>{stable ? `Mmax ${fmt(result.Mmax / 12, 0)} · Mmin ${fmt(result.Mmin / 12, 0)} kip·ft · δmax ${fmt(Math.max(Math.abs(result.defMax), Math.abs(result.defMin)), 3)} in` : 'add supports to restrain rigid-body motion'}</span></div>
            </div>

            {stable && (<>
              <div className="stl-card stl-card--pmblock">
                <h4>Diagrams <span className="stl-tag">FEM · Euler-Bernoulli</span></h4>
                <svg viewBox={`0 0 ${W} ${totalH}`} className="stl-chart" role="img" aria-label="beam diagrams">
                  {/* beam schematic */}
                  <line x1={supX(0)} y1={mT + hSchem / 2} x2={supX(L)} y2={mT + hSchem / 2} stroke="#221e17" strokeWidth={2} />
                  {supports.map((s, i) => {
                    const cx = supX(Math.min(Math.max(s.pos, 0), L)), cy = mT + hSchem / 2;
                    return <g key={i}>
                      {s.type === 'fixed'
                        ? <rect x={cx - 3} y={cy - 12} width={6} height={24} fill="#221e17" />
                        : <polygon points={`${cx},${cy} ${cx - 6},${cy + 11} ${cx + 6},${cy + 11}`} fill="none" stroke="#221e17" strokeWidth={1.4} />}
                      {s.type === 'roller' && <line x1={cx - 7} y1={cy + 14} x2={cx + 7} y2={cy + 14} stroke="#221e17" strokeWidth={1.2} />}
                    </g>;
                  })}
                  {points.map((p, i) => { const cx = supX(Math.min(Math.max(p.pos, 0), L)), cy = mT + hSchem / 2; return <g key={i}><line x1={cx} y1={cy - 20} x2={cx} y2={cy - 2} stroke={GOLD_DEEP} strokeWidth={1.4} /><polygon points={`${cx},${cy - 1} ${cx - 3},${cy - 7} ${cx + 3},${cy - 7}`} fill={GOLD_DEEP} /></g>; })}
                  {dists.map((d, i) => { const x1 = supX(Math.max(0, d.x1)), x2 = supX(Math.min(L, d.x2)), cy = mT + hSchem / 2; return <g key={i}><line x1={x1} y1={cy - 16} x2={x2} y2={cy - 16} stroke={GOLD} strokeWidth={1.2} />{[0, 0.25, 0.5, 0.75, 1].map((t) => { const xx = x1 + t * (x2 - x1); return <line key={t} x1={xx} y1={cy - 16} x2={xx} y2={cy - 3} stroke={GOLD} strokeWidth={0.9} />; })}</g>; })}
                  <Panel xs={xft} ys={shear} W={W} H={hPanel} y0={mT + hSchem} L={L} label="Shear V" unit="kip" />
                  <Panel xs={xft} ys={momKft} W={W} H={hPanel} y0={mT + hSchem + hPanel} L={L} label="Moment M" unit="kip·ft" invert />
                  <Panel xs={xft} ys={defl} W={W} H={hPanel} y0={mT + hSchem + hPanel * 2} L={L} label="Deflection δ" unit="in" invert />
                  <text x={W / 2} y={totalH - 4} textAnchor="middle" className="stl-chart__ax">x (ft) · span {fmt(L, 0)} ft</text>
                </svg>
              </div>

              <div className="stl-cards">
                <div className="stl-card">
                  <h4>Reactions <span className="stl-tag">↑ kip</span></h4>
                  <table className="stl-table"><tbody>
                    {result.reactions.map((r, i) => (
                      <Row key={i} k={`@ ${fmt(r.pos / 12, 1)} ft${r.fixed ? ' (fixed)' : ''}`} v={<strong>{fmt(r.Rv, 1)}</strong>} unit="kip" ref={r.fixed ? `${fmt(r.Rm / 12, 0)} kip·ft` : ''} />
                    ))}
                    <Row k="ΣV equilibrium" v={fmt(result.reactSumV, 3)} unit="kip" ref="≈ 0" />
                  </tbody></table>
                </div>
                <div className="stl-card">
                  <h4>Envelope <span className="stl-tag">max / location</span></h4>
                  <table className="stl-table"><tbody>
                    <Row k="Vmax" v={<strong>{fmt(result.Vmax, 1)}</strong>} unit="kip" ref={`@ ${fmt(result.VmaxAt / 12, 1)} ft`} />
                    <Row k="Mmax (+)" v={<strong>{fmt(result.Mmax / 12, 1)}</strong>} unit="kip·ft" ref={`@ ${fmt(result.MmaxAt / 12, 1)} ft`} />
                    <Row k="Mmin (−)" v={<strong>{fmt(result.Mmin / 12, 1)}</strong>} unit="kip·ft" ref={`@ ${fmt(result.MminAt / 12, 1)} ft`} />
                    <Row k="δmax" v={<strong>{fmt(Math.abs(result.defMax) >= Math.abs(result.defMin) ? result.defMax : result.defMin, 3)}</strong>} unit="in" ref={`@ ${fmt((Math.abs(result.defMax) >= Math.abs(result.defMin) ? result.defMaxAt : result.defMinAt) / 12, 1)} ft`} />
                  </tbody></table>
                </div>
              </div>
            </>)}
          </>)}

          <p className="stl-disclaimer">
            Euler-Bernoulli first-order elastic analysis (direct stiffness / FEM) of a single prismatic beam with
            arbitrary pin/roller/fixed supports, point &amp; distributed (trapezoidal) loads and applied moments —
            reactions and the shear, moment and deflection diagrams. Sign convention: downward load &amp; deflection
            positive, sagging moment positive. Shear deformation, axial force, large displacement and dynamic effects
            are not included. Verify supports and loads independently.
          </p>
        </section>
      </div>
    </div>
  );
}

function Row({ k, v, unit, ref }: { k: string; v: React.ReactNode; unit?: string; ref?: string }) {
  return (<tr><td className="stl-k">{k}</td><td className="stl-v">{v}{unit ? <span className="stl-unit"> {unit}</span> : null}</td><td className="stl-ref">{ref}</td></tr>);
}
