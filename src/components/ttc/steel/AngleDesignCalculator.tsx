'use client';

import React, { useId, useMemo, useState } from 'react';
import angleDb from '@/lib/steel/angle-shapes.json';
import {
  tension, compressionSingle, compressionDouble, flexureSingle, flexureDouble, shear,
  E as E_STEEL,
  type AngleSingle, type AngleDouble, type Material, type ConnType, type TrussType,
} from '@/lib/steel/aiscAngle';

const DB = angleDb as { single: AngleSingle[]; double: AngleDouble[] };
const SINGLES = DB.single;
const DOUBLES = DB.double;
const BASES = [...new Map(SINGLES.map((s) => [s.designation, s])).values()];

const GRADES = [
  { id: 'A36', label: 'A36', Fy: 36, Fu: 58 },
  { id: 'A572-50', label: 'A572 Gr. 50', Fy: 50, Fu: 65 },
  { id: 'A529-50', label: 'A529 Gr. 50', Fy: 50, Fu: 65 },
  { id: 'custom', label: 'Custom…', Fy: 36, Fu: 58 },
];

/* ── units ────────────────────────────────────────────────────────────── */
type UnitSys = 'imperial' | 'si';
const K = { F: 4.4482216, S: 6.8947573, L: 25.4, M: 1.3558179, A: 645.16, I: 416231.4, W: 1.4881639 };
function unitPack(sys: UnitSys) {
  const si = sys === 'si';
  return {
    sys, si,
    force: si ? 'kN' : 'k', stress: si ? 'MPa' : 'ksi', len: si ? 'mm' : 'in',
    moment: si ? 'kN·m' : 'k·ft', area: si ? 'mm²' : 'in²', inertia: si ? 'mm⁴' : 'in⁴',
    weight: si ? 'kg/m' : 'lb/ft',
    F: (k: number) => (si ? k * K.F : k), S: (x: number) => (si ? x * K.S : x),
    L: (x: number) => (si ? x * K.L : x), M: (x: number) => (si ? x * K.M : x),
    A: (x: number) => (si ? x * K.A : x), I: (x: number) => (si ? x * K.I : x),
    W: (x: number) => (si ? x * K.W : x),
    Fi: (v: number) => (si ? v / K.F : v), Si: (v: number) => (si ? v / K.S : v),
    Li: (v: number) => (si ? v / K.L : v), Mi: (v: number) => (si ? v / K.M : v),
  };
}
type UPack = ReturnType<typeof unitPack>;

const fmt = (x: number | null | undefined, d = 1) =>
  (x != null && Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const ustate = (r: number) => (r > 1 ? 'over' : r > 0.9 ? 'high' : 'ok');

/* ── controls ─────────────────────────────────────────────────────────── */
function Num({ label, unit, value, onChange, step = 'any', hint, dp }: {
  label: string; unit?: string; value: number; onChange: (v: number) => void; step?: string; hint?: string; dp?: number;
}) {
  const id = useId();
  const shown = Number.isFinite(value) ? (dp != null ? Math.round(value * 10 ** dp) / 10 ** dp : value) : '';
  return (
    <div className="stl-field">
      <label htmlFor={id}>{label} {unit ? <span className="stl-unit">({unit})</span> : null}</label>
      <input id={id} type="number" step={step} value={shown} onChange={(e) => onChange(parseFloat(e.target.value))} />
      {hint ? <small className="stl-hint">{hint}</small> : null}
    </div>
  );
}
/** units-aware numeric field bound to an imperial-valued setter */
function UNum({ label, u, kind, value, onChange, step, hint }: {
  label: string; u: UPack; kind: 'F' | 'S' | 'L' | 'M'; value: number; onChange: (imp: number) => void; step?: string; hint?: string;
}) {
  const to = u[kind], from = u[(kind + 'i') as 'Fi' | 'Si' | 'Li' | 'Mi'];
  const unit = kind === 'F' ? u.force : kind === 'S' ? u.stress : kind === 'L' ? u.len : u.moment;
  const dp = kind === 'L' && u.si ? 0 : 2;
  return <Num label={label} unit={unit} value={to(value)} onChange={(v) => onChange(from(v))} step={step} hint={hint} dp={dp} />;
}

function Gauge({ ratio }: { ratio: number }) {
  const st = ustate(ratio);
  const R = 52, C = 2 * Math.PI * R, frac = Math.max(0, Math.min(ratio, 1)), dash = C * frac;
  const color = st === 'over' ? '#b0322a' : st === 'high' ? '#d9a441' : 'var(--lux-gold)';
  return (
    <svg viewBox="0 0 130 130" className="stl-gauge" role="img" aria-label={`utilization ${Math.round(ratio * 100)}%`}>
      <circle cx="65" cy="65" r={R} fill="none" stroke="rgba(22,21,15,0.09)" strokeWidth="9" />
      <circle cx="65" cy="65" r={R} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${dash} ${C - dash}`} transform="rotate(-90 65 65)" />
      <text x="65" y="60" textAnchor="middle" className="stl-gauge__pct">{Math.round(ratio * 100)}%</text>
      <text x="65" y="80" textAnchor="middle" className="stl-gauge__lbl">UTILIZATION</text>
    </svg>
  );
}

/* dimensioned angle section */
function AngleSVG({ d, b, t, isDouble, orientation }: { d: number; b: number; t: number; isDouble: boolean; orientation?: string }) {
  const INK = 'var(--lux-ink)', FILL = 'rgba(201,168,76,0.12)', DIM = 'var(--lux-muted)';
  const W = 300, H = 248, mL = 66, mR = 46, mT = 26, mB = 50;
  const AH = (x: number, y: number, dir: 'u' | 'd' | 'l' | 'r', k: string) => {
    const s = 3;
    const p = dir === 'u' ? `${x},${y} ${x - s},${y + 2.4 * s} ${x + s},${y + 2.4 * s}`
      : dir === 'd' ? `${x},${y} ${x - s},${y - 2.4 * s} ${x + s},${y - 2.4 * s}`
      : dir === 'l' ? `${x},${y} ${x + 2.4 * s},${y - s} ${x + 2.4 * s},${y + s}`
      : `${x},${y} ${x - 2.4 * s},${y - s} ${x - 2.4 * s},${y + s}`;
    return <polygon key={k} points={p} fill={DIM} />;
  };
  const Lpoly = (ox: number, baseY: number, bw: number, dh: number, tt: number, m = 1) =>
    [[ox, baseY], [ox + m * bw, baseY], [ox + m * bw, baseY - tt],
      [ox + m * tt, baseY - tt], [ox + m * tt, baseY - dh], [ox, baseY - dh]]
      .map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

  if (!isDouble) {
    const sc = Math.min((W - mL - mR) / b, (H - mT - mB) / d);
    const bw = b * sc, dh = d * sc, tt = t * sc, ox = mL, baseY = H - mB;
    const dimX = ox - 28, dimY = baseY + 28, midY = baseY - dh / 2, midX = ox + bw / 2;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="stl-svg" role="img" aria-label="angle section with dimensions">
        <polygon points={Lpoly(ox, baseY, bw, dh, tt)} fill={FILL} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
        {/* height dimension (vertical leg) */}
        <line x1={ox} y1={baseY - dh} x2={dimX - 5} y2={baseY - dh} stroke={DIM} strokeWidth={0.5} />
        <line x1={ox} y1={baseY} x2={dimX - 5} y2={baseY} stroke={DIM} strokeWidth={0.5} />
        <line x1={dimX} y1={baseY - dh} x2={dimX} y2={baseY} stroke={DIM} strokeWidth={0.7} />
        {AH(dimX, baseY - dh + 0.4, 'u', 'vu')}{AH(dimX, baseY - 0.4, 'd', 'vd')}
        <text x={dimX - 7} y={midY} textAnchor="middle" className="stl-dim" transform={`rotate(-90 ${dimX - 7} ${midY})`}>{fmt(d, 2)} in</text>
        {/* width dimension (horizontal leg) */}
        <line x1={ox} y1={baseY} x2={ox} y2={dimY + 5} stroke={DIM} strokeWidth={0.5} />
        <line x1={ox + bw} y1={baseY} x2={ox + bw} y2={dimY + 5} stroke={DIM} strokeWidth={0.5} />
        <line x1={ox} y1={dimY} x2={ox + bw} y2={dimY} stroke={DIM} strokeWidth={0.7} />
        {AH(ox + 0.4, dimY, 'l', 'hl')}{AH(ox + bw - 0.4, dimY, 'r', 'hr')}
        <text x={midX} y={dimY + 13} textAnchor="middle" className="stl-dim">{fmt(b, 2)} in</text>
        {/* thickness callout */}
        <line x1={ox + tt} y1={baseY - tt} x2={ox + tt + 12} y2={baseY - tt - 12} stroke={DIM} strokeWidth={0.5} />
        <text x={ox + tt + 15} y={baseY - tt - 13} className="stl-dim" dominantBaseline="middle">t = {fmt(t, 3)} in</text>
      </svg>
    );
  }

  // double angle — back-to-back, dimensioned
  const sc = Math.min((W - mL - mR) / (2 * b), (H - mT - mB) / d);
  const bw = b * sc, dh = d * sc, tt = t * sc, gapPx = 8, cx = W / 2, baseY = H - mB;
  const rOx = cx + gapPx / 2, leftMost = cx - gapPx / 2 - bw;
  const dimX = leftMost - 26, midY = baseY - dh / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stl-svg" role="img" aria-label="double angle section with dimensions">
      <polygon points={Lpoly(rOx, baseY, bw, dh, tt, 1)} fill={FILL} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      <polygon points={Lpoly(cx - gapPx / 2, baseY, bw, dh, tt, -1)} fill={FILL} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      <line x1={cx} y1={mT} x2={cx} y2={baseY + 6} stroke={DIM} strokeWidth={0.6} strokeDasharray="4 3" />
      {/* height dimension */}
      <line x1={leftMost} y1={baseY - dh} x2={dimX - 5} y2={baseY - dh} stroke={DIM} strokeWidth={0.5} />
      <line x1={leftMost} y1={baseY} x2={dimX - 5} y2={baseY} stroke={DIM} strokeWidth={0.5} />
      <line x1={dimX} y1={baseY - dh} x2={dimX} y2={baseY} stroke={DIM} strokeWidth={0.7} />
      {AH(dimX, baseY - dh + 0.4, 'u', 'du')}{AH(dimX, baseY - 0.4, 'd', 'dd')}
      <text x={dimX - 7} y={midY} textAnchor="middle" className="stl-dim" transform={`rotate(-90 ${dimX - 7} ${midY})`}>{fmt(d, 2)} in</text>
      {/* thickness callout */}
      <line x1={rOx + tt} y1={baseY - tt} x2={rOx + tt + 12} y2={baseY - tt - 12} stroke={DIM} strokeWidth={0.5} />
      <text x={rOx + tt + 15} y={baseY - tt - 13} className="stl-dim" dominantBaseline="middle">t = {fmt(t, 3)} in</text>
      <text x={cx} y={baseY + 30} textAnchor="middle" className="stl-dim">2L {fmt(d, 0)}×{fmt(b, 0)}×{fmt(t, 3)}{orientation && orientation !== 'equal' ? ` ${orientation}` : ''}</text>
    </svg>
  );
}

function Prop({ k, v, u }: { k: string; v: React.ReactNode; u?: string }) {
  return (<div className="stl-prop"><span>{k}</span><strong>{v}{u ? <em> {u}</em> : null}</strong></div>);
}

/* ── main ─────────────────────────────────────────────────────────────── */
const D = {
  config: 'single' as 'single' | 'double',
  sDesig: 'L4X4X1/2', baseDesig: 'L4X4X1/2', orientation: 'equal' as 'equal' | 'LLBB' | 'SLBB', gap: '3/8',
  gradeId: 'A36', cFy: 36, cFu: 58,
  connType: 'bolted' as ConnType, connLong: true, boltDia: 0.75, nBolts: 4, pitch: 3, weldLen: 8,
  Lcomp: 48, truss: 'planar' as TrussType, Lcx: 48, Lcy: 48, connSpacing: 24, connWelded: true,
  Lb: 48, Cb: 1.14, restrained: false, shortComp: false, webComp: false,
  Put: 12, Puc: 20, Mu: 2, Muy: 1, Vu: 8,
};

export function AngleDesignCalculator() {
  const [config, setConfig] = useState<'single' | 'double'>(D.config);
  const [units, setUnits] = useState<UnitSys>('imperial');
  const [loadTab, setLoadTab] = useState<'axial' | 'moments' | 'combined'>('axial');
  const [includeSlender, setIncludeSlender] = useState(true);
  const [showTables, setShowTables] = useState(false);

  // section selection
  const [query, setQuery] = useState('');
  const sList = useMemo(() => { const q = query.trim().toUpperCase(); return SINGLES.filter((e) => !q || e.designation.toUpperCase().includes(q)); }, [query]);
  const [sDesig, setSDesig] = useState(D.sDesig);
  const single = useMemo(() => sList.find((e) => e.designation === sDesig) ?? sList[0] ?? SINGLES[0], [sList, sDesig]);
  const [baseDesig, setBaseDesig] = useState(D.baseDesig);
  const [orientation, setOrientation] = useState<'equal' | 'LLBB' | 'SLBB'>(D.orientation);
  const [gap, setGap] = useState(D.gap);
  const dOptions = useMemo(() => DOUBLES.filter((d) => d.base === baseDesig), [baseDesig]);
  const orientOptions = useMemo(() => [...new Set(dOptions.map((d) => d.orientation))], [dOptions]);
  const gapOptions = useMemo(() => [...new Set(dOptions.filter((d) => d.orientation === orientation).map((d) => d.gap))], [dOptions, orientation]);
  const double = useMemo(() => {
    const o = orientOptions.includes(orientation) ? orientation : orientOptions[0];
    const g = dOptions.filter((d) => d.orientation === o).some((d) => d.gap === gap) ? gap : (dOptions.find((d) => d.orientation === o)?.gap ?? '0');
    return dOptions.find((d) => d.orientation === o && d.gap === g) ?? dOptions[0];
  }, [dOptions, orientation, gap, orientOptions]);

  const isDouble = config === 'double';
  const sec: AngleSingle | AngleDouble = isDouble ? double : single;

  // material
  const [gradeId, setGradeId] = useState(D.gradeId);
  const grade = GRADES.find((g) => g.id === gradeId)!;
  const [cFy, setCFy] = useState(D.cFy), [cFu, setCFu] = useState(D.cFu);
  const mat: Material = { Fy: gradeId === 'custom' ? cFy : grade.Fy, Fu: gradeId === 'custom' ? cFu : grade.Fu };

  // connection & lengths
  const [connType, setConnType] = useState<ConnType>(D.connType);
  const [connLong, setConnLong] = useState(D.connLong);
  const [boltDia, setBoltDia] = useState(D.boltDia), [nBolts, setNBolts] = useState(D.nBolts), [pitch, setPitch] = useState(D.pitch), [weldLen, setWeldLen] = useState(D.weldLen);
  const [Lcomp, setLcomp] = useState(D.Lcomp), [truss, setTruss] = useState<TrussType>(D.truss);
  const [Lcx, setLcx] = useState(D.Lcx), [Lcy, setLcy] = useState(D.Lcy), [connSpacing, setConnSpacing] = useState(D.connSpacing), [connWelded, setConnWelded] = useState(D.connWelded);
  const [Lb, setLb] = useState(D.Lb), [Cb, setCb] = useState(D.Cb), [restrained, setRestrained] = useState(D.restrained), [shortComp, setShortComp] = useState(D.shortComp), [webComp, setWebComp] = useState(D.webComp);

  // demands
  const [Put, setPut] = useState(D.Put), [Puc, setPuc] = useState(D.Puc), [Mu, setMu] = useState(D.Mu), [Muy, setMuy] = useState(D.Muy), [Vu, setVu] = useState(D.Vu);

  const u = unitPack(units);

  function reset() {
    setConfig(D.config); setUnits('imperial'); setLoadTab('axial'); setIncludeSlender(true); setShowTables(false);
    setQuery(''); setSDesig(D.sDesig); setBaseDesig(D.baseDesig); setOrientation(D.orientation); setGap(D.gap);
    setGradeId(D.gradeId); setCFy(D.cFy); setCFu(D.cFu);
    setConnType(D.connType); setConnLong(D.connLong); setBoltDia(D.boltDia); setNBolts(D.nBolts); setPitch(D.pitch); setWeldLen(D.weldLen);
    setLcomp(D.Lcomp); setTruss(D.truss); setLcx(D.Lcx); setLcy(D.Lcy); setConnSpacing(D.connSpacing); setConnWelded(D.connWelded);
    setLb(D.Lb); setCb(D.Cb); setRestrained(D.restrained); setShortComp(D.shortComp); setWebComp(D.webComp);
    setPut(D.Put); setPuc(D.Puc); setMu(D.Mu); setMuy(D.Muy); setVu(D.Vu);
  }

  /* ── results ── */
  const tn = useMemo(() => tension(sec, mat, { conn: connType, boltDia, nPerLine: nBolts, connLength: connType === 'bolted' ? (nBolts - 1) * pitch : weldLen, connectedLegLong: connLong }),
    [sec, mat, connType, boltDia, nBolts, pitch, weldLen, connLong]);
  const comp = useMemo(() => (isDouble
    ? compressionDouble(double, mat, { Lcx, Lcy, connSpacing, connWelded })
    : compressionSingle(single, mat, { L: Lcomp, truss, connectedLegLong: connLong })),
    [isDouble, double, single, mat, Lcx, Lcy, connSpacing, connWelded, Lcomp, truss, connLong]);
  const flexMajor = useMemo(() => (isDouble
    ? flexureDouble(double, mat, { Lb, Cb, webLegsInCompression: webComp })
    : flexureSingle(single, mat, { axis: single.equalLeg ? 'geometric' : 'principal-w', Lb, Cb, restrained, shortLegCompression: shortComp })),
    [isDouble, double, single, mat, Lb, Cb, webComp, restrained, shortComp]);
  const flexMinor = useMemo(() => (isDouble
    ? null
    : flexureSingle(single, mat, { axis: single.equalLeg ? 'geometric' : 'principal-z', Lb, Cb, restrained, shortLegCompression: shortComp })),
    [isDouble, single, mat, Lb, Cb, restrained, shortComp]);
  const shr = useMemo(() => shear(sec, mat), [sec, mat]);

  const compS = !isDouble ? (comp as ReturnType<typeof compressionSingle>) : null;
  const compD = isDouble ? (comp as ReturnType<typeof compressionDouble>) : null;

  const phiMnMajor = flexMajor.phiMn / 12;                       // k·ft
  const phiMnMinor = flexMinor ? flexMinor.phiMn / 12 : null;    // k·ft

  const utilT = Put > 0 ? Put / tn.phiPn : 0;
  const utilC = Puc > 0 ? Puc / comp.phiPn : 0;
  const utilMx = Mu > 0 ? Mu / phiMnMajor : 0;
  const utilMy = phiMnMinor && Muy > 0 ? Muy / phiMnMinor : 0;
  const utilV = Vu > 0 ? Vu / shr.phiVn : 0;

  const summary = [
    { key: 'tension', label: 'Tension', sym: 'φTn', cap: tn.phiPn, capU: u.force, dem: Put, demU: u.force, ratio: utilT, clause: tn.clause, capC: (x: number) => u.F(x) },
    { key: 'compression', label: 'Compression', sym: 'φPn', cap: comp.phiPn, capU: u.force, dem: Puc, demU: u.force, ratio: utilC, clause: isDouble ? 'E3·E4·E6' : (compS!.clause), capC: (x: number) => u.F(x) },
    { key: 'major', label: 'Major Axis', sym: 'φMnₓ', cap: phiMnMajor, capU: u.moment, dem: Mu, demU: u.moment, ratio: utilMx, clause: flexMajor.clause, capC: (x: number) => u.M(x) },
    { key: 'minor', label: 'Minor Axis', sym: 'φMny', cap: phiMnMinor, capU: u.moment, dem: Muy, demU: u.moment, ratio: utilMy, clause: flexMinor ? flexMinor.clause : 'F9', capC: (x: number) => u.M(x) },
    { key: 'shear', label: 'Shear', sym: 'φVn', cap: shr.phiVn, capU: u.force, dem: Vu, demU: u.force, ratio: utilV, clause: shr.clause, capC: (x: number) => u.F(x) },
  ];

  const gov = summary.filter((s) => s.cap != null && s.ratio > 0).reduce<{ label: string; ratio: number; clause: string } | null>(
    (a, s) => (!a || s.ratio > a.ratio ? { label: s.label, ratio: s.ratio, clause: s.clause } : a), null);
  const pass = !gov || gov.ratio <= 1.0;

  // detailed limit-state rows
  const detail: { label: string; cap: number | null; capC?: (x: number) => number; capU?: string; dem: number | null; demC?: (x: number) => number; ratio: number | null; clause: string }[] = [
    { label: 'Tension (Yielding)', cap: tn.phiPy, capC: u.F, capU: u.force, dem: Put, demC: u.F, ratio: Put > 0 ? Put / tn.phiPy : 0, clause: 'D2(a)' },
    { label: 'Tension (Rupture)', cap: tn.phiPr, capC: u.F, capU: u.force, dem: Put, demC: u.F, ratio: Put > 0 ? Put / tn.phiPr : 0, clause: 'D2(b)' },
    { label: 'Compression', cap: comp.phiPn, capC: u.F, capU: u.force, dem: Puc, demC: u.F, ratio: utilC, clause: isDouble ? 'E3·E4·E6' : compS!.clause },
    { label: 'Flexure (Major Axis)', cap: phiMnMajor, capC: u.M, capU: u.moment, dem: Mu, demC: u.M, ratio: utilMx, clause: flexMajor.clause },
    { label: 'Flexure (Minor Axis)', cap: phiMnMinor, capC: u.M, capU: u.moment, dem: Muy, demC: u.M, ratio: utilMy, clause: flexMinor ? flexMinor.clause : 'F9' },
    { label: 'Shear', cap: shr.phiVn, capC: u.F, capU: u.force, dem: Vu, demC: u.F, ratio: utilV, clause: shr.clause },
    { label: 'Block Shear', cap: null, dem: null, ratio: null, clause: 'J4.3' },
    { label: 'Bearing', cap: null, dem: null, ratio: null, clause: 'J3.10' },
  ];

  // slenderness (member) rows + band
  const lam = (KLr: number) => (KLr / Math.PI) * Math.sqrt(mat.Fy / E_STEEL); // normalized λc
  const lam200 = (200 / Math.PI) * Math.sqrt(mat.Fy / E_STEEL);
  const LAM_TRANS = 4.71 / Math.PI; // ≈ 1.499 inelastic↔elastic
  const slendRows = isDouble
    ? [
      { axis: 'Flexural (x–x)', KLr: compD!.xAxis.KLr, gov: false },
      { axis: 'FTB (y–y), eff.', KLr: compD!.yAxisFTB.KLrm, gov: true },
    ]
    : [
      { axis: 'Geometric (x–x)', KLr: Lcomp / single.rx, gov: false },
      { axis: 'Geometric (y–y)', KLr: Lcomp / single.ry, gov: false },
      { axis: 'Effective (E5)', KLr: compS!.KLreff, gov: true },
    ];
  const govLam = lam(slendRows.find((r) => r.gov)!.KLr);
  const bandMax = Math.max(2.5, lam200 * 1.08);
  const zGreen = (LAM_TRANS / bandMax) * 100;
  const zAmber = ((lam200 - LAM_TRANS) / bandMax) * 100;
  const marker = Math.min((govLam / bandMax) * 100, 99);

  function doPrint() { if (typeof window !== 'undefined') window.print(); }

  return (
    <div className="stl stl-cockpit">
      {/* brand sheet header (unchanged from original) */}
      <div className="stl-sheethead">
        <div>
          <div className="stl-brand">TERCERO TABLADA</div>
          <div className="stl-brand-sub">Civil &amp; Structural Engineering Inc.</div>
        </div>
        <div className="stl-sheettitle">
          <strong>STEEL ANGLE DESIGN</strong>
          <span className="stl-code">AISC 360-16 · LRFD</span>
        </div>
      </div>
      <div className="stl-actions">
        <label className="stl-units">
          <span>Units</span>
          <select value={units} onChange={(e) => setUnits(e.target.value as UnitSys)}>
            <option value="imperial">Imperial (kips, ksi, in)</option>
            <option value="si">Metric (kN, MPa, mm)</option>
          </select>
        </label>
        <button type="button" className="stl-btn" onClick={reset}>Reset</button>
        <button type="button" className="stl-btn stl-btn--primary" onClick={doPrint}>Save / Export</button>
      </div>

      <div className="stl-grid">
        {/* ── sidebar (numbered steps) ── */}
        <aside className="stl-inputs">
          <section className="stl-step">
            <h3 className="stl-step__h"><i>1</i> Configuration</h3>
            <div className="stl-seg" role="tablist">
              <button type="button" className={config === 'single' ? 'is-active' : ''} onClick={() => setConfig('single')}>Single Angle (L)</button>
              <button type="button" className={config === 'double' ? 'is-active' : ''} onClick={() => setConfig('double')}>Double Angle (2L)</button>
            </div>
          </section>

          <section className="stl-step">
            <h3 className="stl-step__h"><i>2</i> Section &amp; Material</h3>
            {!isDouble ? (
              <>
                <div className="stl-field"><label htmlFor="ang-search">Shape filter</label><input id="ang-search" type="search" placeholder="e.g. L4X4 or L6X4" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
                <div className="stl-field"><label htmlFor="ang-des">Shape — AISC ({sList.length})</label>
                  <select id="ang-des" size={6} value={single.designation} onChange={(e) => setSDesig(e.target.value)} className="stl-listbox" data-lenis-prevent>
                    {sList.slice(0, 400).map((e) => <option key={e.designation} value={e.designation}>{e.designation}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="stl-field"><label htmlFor="ang-base">Base angle</label>
                  <select id="ang-base" size={5} value={baseDesig} onChange={(e) => setBaseDesig(e.target.value)} className="stl-listbox" data-lenis-prevent>
                    {BASES.map((b) => <option key={b.designation} value={b.designation}>{b.designation}</option>)}
                  </select>
                </div>
                <div className="stl-row2">
                  <div className="stl-field"><label htmlFor="ang-or">Orientation</label>
                    <select id="ang-or" value={orientation} onChange={(e) => setOrientation(e.target.value as 'equal' | 'LLBB' | 'SLBB')}>
                      {orientOptions.map((o) => <option key={o} value={o}>{o === 'equal' ? 'Back-to-back' : o}</option>)}
                    </select>
                  </div>
                  <div className="stl-field"><label htmlFor="ang-gap">Gap ({u.len})</label>
                    <select id="ang-gap" value={gap} onChange={(e) => setGap(e.target.value)}>
                      {gapOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}
            <div className="stl-field"><label htmlFor="ang-grade">Grade</label>
              <select id="ang-grade" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>{GRADES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select>
            </div>
            <div className="stl-row2">
              <UNum label="Fy" u={u} kind="S" value={mat.Fy} onChange={(v) => { setGradeId('custom'); setCFy(v); }} />
              <UNum label="Fu" u={u} kind="S" value={mat.Fu} onChange={(v) => { setGradeId('custom'); setCFu(v); }} />
            </div>
          </section>

          <section className="stl-step">
            <h3 className="stl-step__h"><i>3</i> Connection &amp; Effective Lengths</h3>
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
              <>
                <div className="stl-row2"><UNum label="Bolt Ø" u={u} kind="L" value={boltDia} onChange={setBoltDia} /><Num label="Bolts / line" value={nBolts} onChange={setNBolts} /></div>
                <UNum label="Bolt pitch" u={u} kind="L" value={pitch} onChange={setPitch} hint={`l = ${fmt(u.L((nBolts - 1) * pitch), 1)} ${u.len}`} />
              </>
            ) : <UNum label="Weld length l" u={u} kind="L" value={weldLen} onChange={setWeldLen} />}

            {!isDouble ? (
              <div className="stl-row2">
                <UNum label="Length L" u={u} kind="L" value={Lcomp} onChange={setLcomp} />
                <div className="stl-field"><label htmlFor="ang-tr">Truss type</label><select id="ang-tr" value={truss} onChange={(e) => setTruss(e.target.value as TrussType)}><option value="planar">Planar</option><option value="box">Box / space</option></select></div>
              </div>
            ) : (
              <>
                <div className="stl-row2"><UNum label="Lcx" u={u} kind="L" value={Lcx} onChange={setLcx} /><UNum label="Lcy" u={u} kind="L" value={Lcy} onChange={setLcy} /></div>
                <div className="stl-row2"><UNum label="Connector spacing a" u={u} kind="L" value={connSpacing} onChange={setConnSpacing} hint="0 = none" />
                  <div className="stl-field"><label htmlFor="ang-cw">Connectors</label><select id="ang-cw" value={connWelded ? 'w' : 's'} onChange={(e) => setConnWelded(e.target.value === 'w')}><option value="w">Welded/pretens.</option><option value="s">Snug-tight</option></select></div>
                </div>
              </>
            )}
            <div className="stl-row2"><UNum label="Lb (unbraced)" u={u} kind="L" value={Lb} onChange={setLb} /><Num label="Cb" value={Cb} onChange={setCb} step="0.05" hint="≤ 1.5" /></div>
          </section>

          <section className="stl-step">
            <h3 className="stl-step__h"><i>4</i> Applied Loads (Demands)</h3>
            <div className="stl-seg stl-seg--sm" role="tablist">
              <button type="button" className={loadTab === 'axial' ? 'is-active' : ''} onClick={() => setLoadTab('axial')}>Axial</button>
              <button type="button" className={loadTab === 'moments' ? 'is-active' : ''} onClick={() => setLoadTab('moments')}>Moments</button>
              <button type="button" className={loadTab === 'combined' ? 'is-active' : ''} onClick={() => setLoadTab('combined')}>Combined</button>
            </div>
            {loadTab === 'axial' && (
              <>
                <div className="stl-row2"><UNum label="Pu — Tension" u={u} kind="F" value={Put} onChange={setPut} /><UNum label="Pu — Compression" u={u} kind="F" value={Puc} onChange={setPuc} /></div>
                <UNum label="Vu — Shear" u={u} kind="F" value={Vu} onChange={setVu} />
                <p className="stl-note">Enter each factored (LRFD) demand as a positive magnitude.</p>
              </>
            )}
            {loadTab === 'moments' && (
              <>
                <div className="stl-row2"><UNum label="Mu — Major (x)" u={u} kind="M" value={Mu} onChange={setMu} /><UNum label="Mu — Minor (y)" u={u} kind="M" value={Muy} onChange={setMuy} /></div>
                {!isDouble && single.equalLeg && (
                  <div className="stl-field"><label htmlFor="ang-rs">Lateral restraint (geo. LTB)</label><select id="ang-rs" value={restrained ? 'y' : 'n'} onChange={(e) => setRestrained(e.target.value === 'y')}><option value="n">Unrestrained</option><option value="y">Restrained at Mmax</option></select></div>
                )}
                {!isDouble && !single.equalLeg && (
                  <div className="stl-field"><label htmlFor="ang-tc">Compression toe (w)</label><select id="ang-tc" value={shortComp ? 's' : 'l'} onChange={(e) => setShortComp(e.target.value === 's')}><option value="l">Long leg</option><option value="s">Short leg</option></select></div>
                )}
                {isDouble && (
                  <div className="stl-field"><label htmlFor="ang-wc">Outstanding legs</label><select id="ang-wc" value={webComp ? 'c' : 't'} onChange={(e) => setWebComp(e.target.value === 'c')}><option value="t">In tension</option><option value="c">In compression</option></select></div>
                )}
              </>
            )}
            {loadTab === 'combined' && (
              <ul className="stl-minilist">
                {summary.filter((s) => s.cap != null).map((s) => (
                  <li key={s.key}><span>{s.label}</span><strong className={`stl-u--${uState(s.ratio)}`}>{fmt(s.ratio * 100, 0)}%</strong></li>
                ))}
                <li className="stl-minilist__note">H2 biaxial + axial interaction is not automated — verify separately.</li>
              </ul>
            )}
          </section>

          <section className="stl-step">
            <h3 className="stl-step__h"><i>5</i> Design Preferences</h3>
            <label className="stl-toggle">
              <span>Include Slenderness Check (E5)</span>
              <input type="checkbox" checked={includeSlender} onChange={(e) => setIncludeSlender(e.target.checked)} />
              <i className="stl-toggle__track" aria-hidden />
            </label>
            <p className="stl-note">Resistance factors: φt = 0.90 / 0.75 · φc = 0.90 · φb = 0.90 · φv = 0.90.</p>
          </section>
        </aside>

        {/* ── results ── */}
        <section className="stl-results">
          {/* status + selected shape */}
          <div className="stl-toprow">
            <div className={`stl-status ${pass ? 'is-pass' : 'is-fail'}`}>
              <div className="stl-status__lead">
                <div className="stl-status__mark" aria-hidden>{pass ? '✓' : '✕'}</div>
                <div>
                  <span className="stl-status__k">Design Status</span>
                  <strong className="stl-status__v">{pass ? 'ADEQUATE' : 'OVERSTRESSED'}</strong>
                  <span className="stl-status__sub">{pass ? 'All limit states satisfied' : 'One or more limit states exceeded'}</span>
                </div>
              </div>
              <div className="stl-status__gov">
                <span className="stl-status__k">Governing Limit State</span>
                <strong>{gov ? gov.label : '—'}</strong>
                <div className="stl-status__govmeta"><span>Utilization</span><b>{gov ? fmt(gov.ratio * 100, 0) : '0'}%</b><em>{gov ? gov.clause : ''}</em></div>
              </div>
              <Gauge ratio={gov ? gov.ratio : 0} />
            </div>

            <div className="stl-shape">
              <h4 className="stl-cardh">Selected Shape</h4>
              <AngleSVG d={sec.d} b={sec.b} t={isDouble ? (double.tSingle ?? sec.t) : sec.t} isDouble={isDouble} orientation={isDouble ? double.orientation : undefined} />
              <div className="stl-shape__props">
                <Prop k="Section" v={sec.designation} />
                <Prop k="Area, A" v={fmt(u.A(sec.A), 2)} u={u.area} />
                <Prop k="Weight" v={fmt(u.W(sec.weight), 1)} u={u.weight} />
                <Prop k="Ix" v={fmt(u.I(sec.Ix), 2)} u={u.inertia} />
                <Prop k="Iy" v={fmt(u.I(sec.Iy), 2)} u={u.inertia} />
                <Prop k="rx" v={fmt(u.L(sec.rx), 2)} u={u.len} />
                <Prop k="ry" v={fmt(u.L(sec.ry), 2)} u={u.len} />
                {!isDouble ? <Prop k="J" v={fmt(u.I(single.J), 3)} u={u.inertia} /> : <Prop k="ro" v={fmt(u.L(sec.ro), 2)} u={u.len} />}
              </div>
            </div>
          </div>

          {/* capacity summary */}
          <div className="stl-capsum">
            {summary.map((s) => {
              const na = s.cap == null;
              const st = uState(s.ratio);
              return (
                <div key={s.key} className={`stl-cap ${na ? 'is-na' : ''}`}>
                  <div className="stl-cap__h">{s.label} <em>({s.sym})</em></div>
                  <div className="stl-cap__v">{na ? '—' : fmt(s.capC(s.cap!), s.capU === u.moment ? 1 : 1)}<span> {na ? '' : s.capU}</span></div>
                  <div className="stl-cap__foot">
                    <span className="stl-cap__dem">Dem {na ? '—' : `${fmt(s.capC(s.dem), 1)} ${s.demU}`}</span>
                    <span className={`stl-cap__u stl-u--${st}`}>{na ? '' : `${fmt(s.ratio * 100, 0)}%`}</span>
                  </div>
                  <div className="stl-cap__bar"><i className={`stl-u-fill--${st}`} style={{ width: `${Math.min(s.ratio, 1.2) / 1.2 * 100}%` }} /></div>
                </div>
              );
            })}
          </div>

          {/* detailed + slenderness */}
          <div className="stl-detailrow">
            <div className="stl-panel">
              <h4 className="stl-cardh">Detailed Capacity Checks</h4>
              <div className="stl-tablewrap">
                <table className="stl-dtable">
                  <thead><tr><th>Limit State</th><th>φRn</th><th>Demand</th><th>Util.</th><th>Status</th><th>Clause</th></tr></thead>
                  <tbody>
                    {detail.map((r) => {
                      const na = r.cap == null;
                      const st = r.ratio == null ? 'na' : uState(r.ratio);
                      return (
                        <tr key={r.label}>
                          <td className="stl-dt-name">{r.label}</td>
                          <td>{na ? '—' : `${fmt(r.capC!(r.cap!), 1)} ${r.capU}`}</td>
                          <td>{na || r.dem == null ? '—' : `${fmt(r.demC!(r.dem), 1)} ${r.capU}`}</td>
                          <td>{r.ratio == null ? '—' : `${fmt(r.ratio * 100, 0)}%`}</td>
                          <td>{na ? <span className="stl-pill stl-pill--na">N/A</span> : r.ratio! <= 1 ? <span className="stl-pill stl-pill--ok">OK</span> : <span className="stl-pill stl-pill--ng">NG</span>}</td>
                          <td className="stl-dt-ref">{r.clause}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="stl-note">{pass ? 'All computed limit states satisfied per AISC 360-16 (LRFD).' : 'Revise section, grade or bracing — a limit state is exceeded.'} Block shear (J4.3) &amp; bearing (J3.10) check separately.</p>
            </div>

            {includeSlender && (
              <div className="stl-panel">
                <h4 className="stl-cardh">Slenderness Check {isDouble ? '(E4/E6)' : '(E5)'}</h4>
                <div className="stl-tablewrap">
                  <table className="stl-dtable">
                    <thead><tr><th>Axis</th><th>KL/r</th><th>(KL/r)lim</th><th>λc</th><th>Status</th></tr></thead>
                    <tbody>
                      {slendRows.map((r) => (
                        <tr key={r.axis} className={r.gov ? 'is-gov' : ''}>
                          <td className="stl-dt-name">{r.axis}{r.gov ? ' •' : ''}</td>
                          <td>{fmt(r.KLr, 1)}</td>
                          <td>200</td>
                          <td>{fmt(lam(r.KLr), 3)}</td>
                          <td>{r.KLr <= 200 ? <span className="stl-pill stl-pill--ok">OK</span> : <span className="stl-pill stl-pill--ng">NG</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="stl-band">
                  <div className="stl-band__label"><span>Normalized slenderness λc</span><strong>{fmt(govLam, 3)}</strong></div>
                  <div className="stl-band__track">
                    <i className="stl-band__z stl-band__z--g" style={{ width: `${zGreen}%` }} />
                    <i className="stl-band__z stl-band__z--a" style={{ width: `${zAmber}%` }} />
                    <i className="stl-band__z stl-band__z--r" style={{ flex: 1 }} />
                    <i className="stl-band__mark" style={{ left: `${marker}%` }} />
                  </div>
                  <div className="stl-band__zones">
                    <span>Inelastic<br /><em>λc ≤ {fmt(LAM_TRANS, 2)}</em></span>
                    <span>Elastic<br /><em>≤ {fmt(lam200, 2)}</em></span>
                    <span>Exceeds KL/r 200</span>
                  </div>
                </div>
                <p className="stl-note">Governing axis for compression: {isDouble ? compD!.governing : `${compS!.clause}`}.</p>
              </div>
            )}
          </div>

          {/* notes */}
          <div className="stl-notes">
            <div className="stl-notes__head">
              <h4 className="stl-cardh">Notes &amp; References</h4>
              <button type="button" className="stl-btn stl-btn--ghost" onClick={() => setShowTables((v) => !v)}>{showTables ? 'Hide' : 'View'} AISC Tables</button>
            </div>
            <p className="stl-disclaimer">
              Design per <strong>AISC 360-16 (LRFD)</strong>. Single (L) &amp; double (2L) hot-rolled angles. Single-angle compression
              uses the E5 effective-slenderness method (angles connected through one leg); double-angle compression uses E3 (x) +
              E4 flexural-torsional (y) with E6 built-up modification; flexure per F10 (single) / F9 (double); shear per G4.
              Block shear (J4.3), bearing (J3.10) &amp; H2 biaxial interaction are not automated — check separately. Effective lengths,
              Cb and demands are user inputs. A licensed P.E. review remains required.
            </p>
            {showTables && (
              <div className="stl-tablewrap stl-tablewrap--tables">
                <table className="stl-dtable">
                  <thead><tr><th>Prop.</th><th>Value</th><th>Prop.</th><th>Value</th></tr></thead>
                  <tbody>
                    <tr><td className="stl-dt-name">A</td><td>{fmt(u.A(sec.A), 2)} {u.area}</td><td className="stl-dt-name">Weight</td><td>{fmt(u.W(sec.weight), 1)} {u.weight}</td></tr>
                    <tr><td className="stl-dt-name">Ix</td><td>{fmt(u.I(sec.Ix), 2)} {u.inertia}</td><td className="stl-dt-name">Iy</td><td>{fmt(u.I(sec.Iy), 2)} {u.inertia}</td></tr>
                    <tr><td className="stl-dt-name">Sx</td><td>{fmt(u.I(sec.Sx) / K.L, 2)} {u.si ? 'mm³' : 'in³'}</td><td className="stl-dt-name">Zx</td><td>{fmt(u.I(sec.Zx) / K.L, 2)} {u.si ? 'mm³' : 'in³'}</td></tr>
                    <tr><td className="stl-dt-name">rx</td><td>{fmt(u.L(sec.rx), 3)} {u.len}</td><td className="stl-dt-name">ry</td><td>{fmt(u.L(sec.ry), 3)} {u.len}</td></tr>
                    {!isDouble && <tr><td className="stl-dt-name">rz</td><td>{fmt(u.L(single.rz), 3)} {u.len}</td><td className="stl-dt-name">J</td><td>{fmt(u.I(single.J), 3)} {u.inertia}</td></tr>}
                    <tr><td className="stl-dt-name">ro</td><td>{fmt(u.L(sec.ro), 3)} {u.len}</td><td className="stl-dt-name">Fy / Fu</td><td>{fmt(u.S(mat.Fy), 0)} / {fmt(u.S(mat.Fu), 0)} {u.stress}</td></tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function uState(r: number) { return ustate(r); }
