'use client';

import React, { useMemo } from 'react';
import type { BeamModel, Support, Load } from '@/lib/advanced-beam/types';

const INK = '#221e17', GOLD = '#c9a84c', GOLD_DEEP = '#9a7a2c', MUTED = '#8a8578';

interface Props {
  model: BeamModel;
  deflection?: { x: number; value: number }[];
  showDeformed?: boolean;
  supportLabels?: Record<string, string>;
}

function indexToLabel(i: number): string {
  let s = '', n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}
export function buildSupportLabels(supports: { id: string; position: number }[]): Record<string, string> {
  const ordered = [...supports].map((s, i) => ({ ...s, _orig: i })).sort((a, b) => a.position - b.position || a._orig - b._orig);
  const labels: Record<string, string> = {};
  ordered.forEach((s, i) => (labels[s.id] = indexToLabel(i)));
  return labels;
}

/** Light luxury-minimal schematic — ink structure, gold loads, deformed shape. */
export function AdvancedBeamSchematic({ model, deflection, showDeformed = false, supportLabels }: Props) {
  const labels = useMemo(() => supportLabels ?? buildSupportLabels(model.supports), [supportLabels, model.supports]);
  const L = model.totalLength || 1;
  const W = 1000, beamY = 200, beamHeight = 12, margin = 60, drawW = W - 2 * margin;
  const x2px = (x: number) => margin + (x / L) * drawW;

  const defScale = useMemo(() => {
    if (!showDeformed || !deflection || deflection.length === 0) return 0;
    let m = 0; for (const p of deflection) m = Math.max(m, Math.abs(p.value));
    return m === 0 ? 0 : 26 / m;
  }, [showDeformed, deflection]);

  const beamPath = useMemo(() => {
    if (!showDeformed || !deflection || deflection.length === 0 || defScale === 0) return null;
    const top: string[] = [], bot: string[] = [];
    for (const p of deflection) {
      const px = x2px(p.x), dy = -p.value * defScale;
      top.push(`${px.toFixed(2)},${(beamY + dy - beamHeight / 2).toFixed(2)}`);
      bot.unshift(`${px.toFixed(2)},${(beamY + dy + beamHeight / 2).toFixed(2)}`);
    }
    return `M ${top.join(' L ')} L ${bot.join(' L ')} Z`;
  }, [showDeformed, deflection, defScale, x2px]);

  const deflectedY = (x: number) => {
    if (!showDeformed || defScale === 0 || !deflection) return beamY;
    let lo = 0, hi = deflection.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (deflection[mid].x <= x) lo = mid; else hi = mid; }
    const x0 = deflection[lo].x, x1 = deflection[hi].x;
    if (x1 === x0) return beamY - deflection[lo].value * defScale;
    const t = (x - x0) / (x1 - x0);
    return beamY - ((1 - t) * deflection[lo].value + t * deflection[hi].value) * defScale;
  };

  return (
    <svg viewBox={`0 0 ${W} 300`} preserveAspectRatio="xMidYMid meet" className="stl-chart" role="img" aria-label="Beam schematic">
      <defs>
        <pattern id="abx-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" stroke={INK} strokeWidth="1" />
        </pattern>
      </defs>
      {beamPath
        ? <path d={beamPath} fill="rgba(201,168,76,0.12)" stroke={INK} strokeWidth="1.8" />
        : <rect x={margin} y={beamY - beamHeight / 2} width={drawW} height={beamHeight} fill="rgba(201,168,76,0.12)" stroke={INK} strokeWidth="1.8" />}

      {model.segments.length > 1 && model.segments.slice(0, -1).map((s) => (
        <line key={`segdiv-${s.id}`} x1={x2px(s.endPosition)} y1={beamY - beamHeight / 2 - 7} x2={x2px(s.endPosition)} y2={beamY + beamHeight / 2 + 7}
          stroke={GOLD_DEEP} strokeWidth="1.3" strokeDasharray="3 3" />
      ))}

      {model.hinges.map((h) => { const cx = x2px(h.position), cy = deflectedY(h.position); return (
        <g key={h.id}><circle cx={cx} cy={cy} r="5.5" fill="#fff" stroke={INK} strokeWidth="1.8" />
          <text x={cx} y={cy - 13} textAnchor="middle" fill={MUTED} fontSize="12">hinge</text></g>); })}

      {model.supports.map((s) => (
        <SupportSymbol key={s.id} support={s} label={labels[s.id] ?? s.id} cx={x2px(s.position)} cy={deflectedY(s.position)}
          side={s.position <= 0.02 * L ? 'left' : s.position >= 0.98 * L ? 'right' : 'mid'} />
      ))}
      {model.loads.map((ld) => <LoadSymbol key={ld.id} load={ld} L={L} x2px={x2px} beamYAt={deflectedY} beamHeight={beamHeight} />)}

      <line x1={margin} y1="276" x2={W - margin} y2="276" stroke="#d8d2c4" strokeWidth="1" />
      <line x1={margin} y1="272" x2={margin} y2="280" stroke={MUTED} strokeWidth="1" />
      <line x1={W - margin} y1="272" x2={W - margin} y2="280" stroke={MUTED} strokeWidth="1" />
      <text x={W / 2} y="293" textAnchor="middle" fill={MUTED} fontSize="13">{`L = ${L.toFixed(2)} m`}</text>
    </svg>
  );
}

function SupportSymbol({ support, label, cx, cy, side = 'mid' }: { support: Support; label: string; cx: number; cy: number; side?: 'left' | 'right' | 'mid' }) {
  const lbl = (y: number) => <text x={cx} y={y} textAnchor="middle" fill={INK} fontSize="15" fontWeight={600}>{label}</text>;
  switch (support.type) {
    case 'pin': return (<g>
      <polygon points={`${cx},${cy + 7} ${cx - 13},${cy + 30} ${cx + 13},${cy + 30}`} fill="none" stroke={INK} strokeWidth="1.8" />
      <line x1={cx - 20} y1={cy + 36} x2={cx + 20} y2={cy + 36} stroke={INK} strokeWidth="1.8" />
      <rect x={cx - 20} y={cy + 36} width="40" height="6" fill="url(#abx-hatch)" />{lbl(cy + 60)}</g>);
    case 'roller': return (<g>
      <circle cx={cx - 7} cy={cy + 17} r="5.5" fill="none" stroke={INK} strokeWidth="1.8" />
      <circle cx={cx + 7} cy={cy + 17} r="5.5" fill="none" stroke={INK} strokeWidth="1.8" />
      <line x1={cx - 20} y1={cy + 26} x2={cx + 20} y2={cy + 26} stroke={INK} strokeWidth="1.8" />
      <rect x={cx - 20} y={cy + 26} width="40" height="6" fill="url(#abx-hatch)" />{lbl(cy + 50)}</g>);
    case 'fixed': {
      // hatch (ground/fixity) goes OUTSIDE the beam: left-end support → hatch left; right-end → hatch right
      const hatchLeft = side === 'left';
      return (<g>
        <rect x={cx - 3} y={cy - 26} width="6" height="52" fill={INK} />
        <rect x={hatchLeft ? cx - 15 : cx + 3} y={cy - 30} width="12" height="60" fill="url(#abx-hatch)" />{lbl(cy + 50)}</g>);
    }
    case 'spring': return (<g>
      <path d={`M ${cx},${cy + 6} L ${cx - 7},${cy + 13} L ${cx + 7},${cy + 20} L ${cx - 7},${cy + 27} L ${cx + 7},${cy + 34} L ${cx},${cy + 42}`} fill="none" stroke={INK} strokeWidth="1.8" />
      <line x1={cx - 20} y1={cy + 46} x2={cx + 20} y2={cy + 46} stroke={INK} strokeWidth="1.8" />
      <rect x={cx - 20} y={cy + 46} width="40" height="6" fill="url(#abx-hatch)" />{lbl(cy + 70)}</g>);
    default: return <g>{lbl(cy + 22)}</g>;
  }
}

function LoadSymbol({ load, L, x2px, beamYAt, beamHeight }: {
  load: Load; L: number; x2px: (x: number) => number; beamYAt: (x: number) => number; beamHeight: number;
}) {
  const color = GOLD_DEEP;
  const beamTopY = (x: number) => beamYAt(x) - beamHeight / 2;
  const beamBotY = (x: number) => beamYAt(x) + beamHeight / 2;

  if (load.type === 'point') {
    const cx = x2px(load.position), isDown = load.direction === 'down';
    const tipY = isDown ? beamTopY(load.position) - 2 : beamBotY(load.position) + 2;
    const baseY = isDown ? tipY - 44 : tipY + 44;
    return (<g>
      <line x1={cx} y1={baseY} x2={cx} y2={tipY} stroke={color} strokeWidth="1.8" />
      <polygon points={isDown ? `${cx},${tipY} ${cx - 5},${tipY - 10} ${cx + 5},${tipY - 10}` : `${cx},${tipY} ${cx - 5},${tipY + 10} ${cx + 5},${tipY + 10}`} fill={color} />
      <text x={cx + 8} y={isDown ? baseY - 3 : baseY + 13} fill={color} fontSize="13">{`${load.magnitude} kN`}</text></g>);
  }
  if (load.type === 'distributed') {
    const aPos = Math.min(load.startPosition, load.endPosition), bPos = Math.max(load.startPosition, load.endPosition);
    const x1 = x2px(aPos), x2 = x2px(bPos), isDown = load.direction === 'down';
    const wMaxAbs = Math.max(Math.abs(load.startMagnitude), Math.abs(load.endMagnitude), 1e-9), arrowMaxLen = 32;
    const wA = load.startPosition <= load.endPosition ? load.startMagnitude : load.endMagnitude;
    const wB = load.startPosition <= load.endPosition ? load.endMagnitude : load.startMagnitude;
    const lenAt = (f: number) => arrowMaxLen * (Math.abs(wA + (wB - wA) * f) / wMaxAbs);
    const numArrows = Math.max(6, Math.min(20, Math.floor((x2 - x1) / 36)));
    const arrows: React.ReactElement[] = [], topPts: string[] = [];
    for (let i = 0; i <= numArrows; i++) {
      const f = i / numArrows, px = x1 + (x2 - x1) * f, xPos = aPos + (bPos - aPos) * f;
      const tipY = isDown ? beamTopY(xPos) - 2 : beamBotY(xPos) + 2, len = lenAt(f);
      const baseY = isDown ? tipY - len - 6 : tipY + len + 6;
      topPts.push(`${px.toFixed(1)},${baseY.toFixed(1)}`);
      if (len < 4) continue;
      arrows.push(<g key={`d-${load.id}-${i}`}>
        <line x1={px} y1={baseY} x2={px} y2={tipY} stroke={color} strokeWidth="1.3" opacity="0.85" />
        <polygon points={isDown ? `${px},${tipY} ${px - 3.5},${tipY - 7} ${px + 3.5},${tipY - 7}` : `${px},${tipY} ${px - 3.5},${tipY + 7} ${px + 3.5},${tipY + 7}`} fill={color} opacity="0.85" /></g>);
    }
    const labelY = isDown ? Math.min(...topPts.map((p) => parseFloat(p.split(',')[1]))) - 4 : Math.max(...topPts.map((p) => parseFloat(p.split(',')[1]))) + 13;
    return (<g>
      <polyline points={topPts.join(' ')} fill="none" stroke={color} strokeWidth="1.3" opacity="0.9" />{arrows}
      <text x={(x1 + x2) / 2} y={labelY} textAnchor="middle" fill={color} fontSize="13">
        {load.startMagnitude === load.endMagnitude ? `${load.startMagnitude} kN/m` : `${load.startMagnitude}→${load.endMagnitude} kN/m`}</text></g>);
  }
  if (load.type === 'moment') {
    const cx = x2px(load.position), cy = beamYAt(load.position) - 28, r = 16, isCcw = load.direction === 'ccw';
    const a1 = ((isCcw ? -30 : 210) * Math.PI) / 180, a2 = ((isCcw ? 210 : -30) * Math.PI) / 180;
    const x1a = cx + r * Math.cos(a1), y1a = cy + r * Math.sin(a1), x2a = cx + r * Math.cos(a2), y2a = cy + r * Math.sin(a2);
    return (<g>
      <path d={`M ${x1a},${y1a} A ${r},${r} 0 1,${isCcw ? 0 : 1} ${x2a},${y2a}`} fill="none" stroke={color} strokeWidth="1.8" />
      <polygon points={`${x2a},${y2a} ${x2a - (isCcw ? -8 : 8)},${y2a - 4} ${x2a - (isCcw ? -2 : 2)},${y2a + (isCcw ? 8 : -8)}`} fill={color} />
      <text x={cx} y={cy - 22} textAnchor="middle" fill={color} fontSize="13">{`${load.magnitude} kN·m`}</text></g>);
  }
  if (load.type === 'thermal') {
    const cx = x2px(L / 2), cy = beamYAt(L / 2) - 54;
    return <g><text x={cx} y={cy} textAnchor="middle" fill={color} fontSize="13">{`ΔT = ${load.deltaTGradient}°C`}</text></g>;
  }
  return null;
}
