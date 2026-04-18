'use client';

import React, { useEffect, useState } from 'react';
import type { BeamModel, Load, Support, AppliedMoment } from '@/lib/beam/types';
import { LOAD_CASE_COLORS } from '@/lib/beam/types';

interface Props {
  beam: BeamModel;
  selectedId?: string | null;
}

function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 600px)');
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return phone;
}

export function BeamVisualizer({ beam, selectedId }: Props) {
  const phone = useIsPhone();
  const W = 1000;
  const H = phone ? 520 : 340;
  const padL = phone ? 50 : 60;
  const padR = phone ? 50 : 60;
  const padT = phone ? 170 : 110;
  const padB = phone ? 140 : 90;
  const beamLen = W - padL - padR;
  const beamY = padT + 40;
  const L = beam.length;
  const hasLength = L > 0;

  const xOf = (x: number) => padL + (x / Math.max(L, 0.001)) * beamLen;

  const loads = beam.loads;
  const supports = beam.supports;
  const moments = beam.moments;

  const guides: string[] = [];
  if (!hasLength) {
    guides.push('Enter beam length in the Beam tab to begin.');
  } else {
    if (supports.length === 0) guides.push('Add supports in the Supports tab.');
    if (loads.length === 0 && moments.length === 0 && !beam.selfWeight)
      guides.push('Add loads or moments (or enable Self Weight).');
  }

  return (
    <div className="beam-viz">
      <svg viewBox={`0 0 ${W} ${H}`} className="beam-viz__svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" markerWidth="8" markerHeight="8" refX="9" refY="5" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
            <path d="M1,1 L9,5 L1,9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
          <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#8a8a8a" strokeWidth="1" />
          </pattern>
        </defs>

        {hasLength && (
          <>
            <line
              x1={xOf(0)}
              y1={beamY}
              x2={xOf(L)}
              y2={beamY}
              stroke="#e8e2d3"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <line
              x1={xOf(0)}
              y1={beamY}
              x2={xOf(L)}
              y2={beamY}
              stroke="#2a2a2a"
              strokeWidth="1"
            />
          </>
        )}

        {hasLength && (
          <>
            {loads.filter((l) => l.type === 'distributed').map((l) => renderDistributed(l, xOf, beamY, selectedId === l.id))}
            {loads.filter((l) => l.type === 'point').map((l) => renderPointLoad(l, xOf, beamY, selectedId === l.id))}
            {moments.map((m) => renderMoment(m, xOf, beamY, selectedId === m.id))}
            {supports.map((s) => renderSupport(s, xOf, beamY, selectedId === s.id))}
          </>
        )}

        {hasLength && (
          <g className="beam-viz__dim">
            <line x1={xOf(0)} y1={H - padB + 22} x2={xOf(L)} y2={H - padB + 22} stroke="#8a8a8a" strokeWidth="0.8" />
            <line x1={xOf(0)} y1={H - padB + 16} x2={xOf(0)} y2={H - padB + 28} stroke="#8a8a8a" strokeWidth="0.8" />
            <line x1={xOf(L)} y1={H - padB + 16} x2={xOf(L)} y2={H - padB + 28} stroke="#8a8a8a" strokeWidth="0.8" />
            <text x={(xOf(0) + xOf(L)) / 2} y={H - padB + 42} textAnchor="middle" fontSize="12" fill="#a8a8a8" fontFamily="system-ui">
              L = {L.toFixed(3)} m
            </text>
          </g>
        )}

        {guides.length > 0 && (
          <g className="beam-viz__empty">
            {guides.map((g, i) => {
              const cy = hasLength ? 24 + i * 20 : H / 2 - ((guides.length - 1) * 22) / 2 + i * 22;
              return (
                <text
                  key={i}
                  x={W / 2}
                  y={cy}
                  textAnchor="middle"
                  fontSize={hasLength ? 12 : 14}
                  fill="#6f6f6f"
                  fontFamily="system-ui"
                  fontStyle="italic"
                >
                  {g}
                </text>
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
}

function renderSupport(s: Support, xOf: (x: number) => number, y: number, selected: boolean) {
  const cx = xOf(s.position);
  const color = selected ? '#c9a84c' : '#e8e2d3';
  const size = 18;

  if (s.type === 'pinned') {
    return (
      <g key={s.id} className={`beam-viz__support ${selected ? 'is-selected' : ''}`}>
        <polygon
          points={`${cx},${y + 4} ${cx - size},${y + size + 4} ${cx + size},${y + size + 4}`}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <line x1={cx - size - 6} y1={y + size + 4} x2={cx + size + 6} y2={y + size + 4} stroke={color} strokeWidth="1.5" />
        <rect x={cx - size - 6} y={y + size + 5} width={2 * size + 12} height={8} fill="url(#hatch)" />
        <text x={cx} y={y + size + 30} textAnchor="middle" fontSize="10" fill="#a8a8a8" fontFamily="system-ui">
          {s.position.toFixed(2)} m
        </text>
      </g>
    );
  }

  if (s.type === 'roller') {
    return (
      <g key={s.id} className={`beam-viz__support ${selected ? 'is-selected' : ''}`}>
        <circle cx={cx - 8} cy={y + 10} r="5" fill="none" stroke={color} strokeWidth="1.5" />
        <circle cx={cx + 8} cy={y + 10} r="5" fill="none" stroke={color} strokeWidth="1.5" />
        <line x1={cx - size - 6} y1={y + 16} x2={cx + size + 6} y2={y + 16} stroke={color} strokeWidth="1.5" />
        <rect x={cx - size - 6} y={y + 17} width={2 * size + 12} height={8} fill="url(#hatch)" />
        <text x={cx} y={y + size + 30} textAnchor="middle" fontSize="10" fill="#a8a8a8" fontFamily="system-ui">
          {s.position.toFixed(2)} m
        </text>
      </g>
    );
  }

  if (s.type === 'guided') {
    return (
      <g key={s.id} className={`beam-viz__support ${selected ? 'is-selected' : ''}`}>
        <rect x={cx - size} y={y + 4} width={2 * size} height={10} fill="none" stroke={color} strokeWidth="1.5" />
        <line x1={cx - size - 6} y1={y + 18} x2={cx + size + 6} y2={y + 18} stroke={color} strokeWidth="1.5" />
        <rect x={cx - size - 6} y={y + 19} width={2 * size + 12} height={8} fill="url(#hatch)" />
        <text x={cx} y={y + size + 30} textAnchor="middle" fontSize="10" fill="#a8a8a8" fontFamily="system-ui">
          {s.position.toFixed(2)} m
        </text>
      </g>
    );
  }

  // fixed
  const wallX = s.position < 0.5 ? cx - 6 : cx + 6;
  const side = s.position < 0.5 ? -1 : 1;
  return (
    <g key={s.id} className={`beam-viz__support ${selected ? 'is-selected' : ''}`}>
      <line x1={wallX} y1={y - 22} x2={wallX} y2={y + 22} stroke={color} strokeWidth="1.5" />
      <rect x={wallX + (side > 0 ? 0 : -12)} y={y - 22} width="12" height="44" fill="url(#hatch)" />
      <text x={cx} y={y + 40} textAnchor="middle" fontSize="10" fill="#a8a8a8" fontFamily="system-ui">
        {s.position.toFixed(2)} m
      </text>
    </g>
  );
}

function renderPointLoad(
  l: Extract<Load, { type: 'point' }>,
  xOf: (x: number) => number,
  y: number,
  selected: boolean
) {
  const cx = xOf(l.position);
  const color = selected ? '#c9a84c' : LOAD_CASE_COLORS[l.loadCase];
  const arrowLen = 60;
  const isDown = l.direction === 'down';
  const tailY = isDown ? y - arrowLen : y + arrowLen;
  const tipY = isDown ? y - 6 : y + 6;
  const marker = 'arrow';

  return (
    <g key={l.id} className={`beam-viz__load ${selected ? 'is-selected' : ''}`} style={{ color }}>
      <line
        x1={cx}
        y1={tailY}
        x2={cx}
        y2={tipY}
        stroke="currentColor"
        strokeWidth="2"
        markerEnd={`url(#${marker})`}
        strokeLinecap="round"
      />
      <text
        x={cx + 8}
        y={tailY + (isDown ? -4 : 14)}
        fontSize="11"
        fill="currentColor"
        fontFamily="system-ui"
        fontWeight="600"
      >
        {l.magnitude.toFixed(2)} kN
      </text>
    </g>
  );
}

function renderDistributed(
  l: Extract<Load, { type: 'distributed' }>,
  xOf: (x: number) => number,
  y: number,
  selected: boolean
) {
  const aPos = Math.min(l.startPosition, l.endPosition);
  const bPos = Math.max(l.startPosition, l.endPosition);
  const reversed = l.startPosition > l.endPosition;
  const wA = reversed ? l.endMagnitude : l.startMagnitude;
  const wB = reversed ? l.startMagnitude : l.endMagnitude;
  const x1 = xOf(aPos);
  const x2 = xOf(bPos);
  const isDown = l.direction === 'down';
  const color = selected ? '#c9a84c' : LOAD_CASE_COLORS[l.loadCase];
  const marker = 'arrow';

  const maxMag = Math.max(Math.abs(wA), Math.abs(wB), 1e-9);
  const beamEdgeGap = 8;          // distance between beam top and arrow tip
  const maxArrowLen = 60;          // visible arrow length at max |w|
  const minVisibleArrow = 10;      // skip arrows shorter than this (w ~= 0)
  const arrowLenAt = (ratio: number) => {
    const w = wA + (wB - wA) * ratio;
    return (Math.abs(w) / maxMag) * maxArrowLen;
  };

  const span = x2 - x1;
  const count = Math.max(4, Math.min(12, Math.round(span / 48)));

  const arrows = [];
  const tops: { x: number; y: number }[] = [];
  for (let i = 0; i <= count; i++) {
    const ratio = i / count;
    const x = x1 + ratio * span;
    const arrowLen = arrowLenAt(ratio);
    const tipY = isDown ? y - beamEdgeGap : y + beamEdgeGap;
    const tailY = isDown ? tipY - arrowLen : tipY + arrowLen;
    tops.push({ x, y: tailY });
    if (arrowLen >= minVisibleArrow) {
      arrows.push(
        <line
          key={`a${i}`}
          x1={x}
          y1={tailY}
          x2={x}
          y2={tipY}
          stroke="currentColor"
          strokeWidth="1.3"
          markerEnd={`url(#${marker})`}
        />
      );
    }
  }

  // Envelope: top line + closing sides down to the beam edge (creates a clean trapezoid / triangle shape)
  const edgeY = isDown ? y - beamEdgeGap : y + beamEdgeGap;
  const fillPath =
    `M ${x1.toFixed(2)} ${edgeY.toFixed(2)} ` +
    tops.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') +
    ` L ${x2.toFixed(2)} ${edgeY.toFixed(2)} Z`;

  const envelope = tops
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  // Label placed above the tallest top point (or below if isDown=false)
  const tallest = tops.reduce((acc, p) =>
    isDown ? (p.y < acc.y ? p : acc) : (p.y > acc.y ? p : acc), tops[0]);
  const labelY = tallest.y + (isDown ? -6 : 16);
  const magLabel =
    Math.abs(wA - wB) < 1e-9
      ? `${wA.toFixed(2)} kN/m`
      : `${wA.toFixed(2)} \u2192 ${wB.toFixed(2)} kN/m`;

  return (
    <g key={l.id} className={`beam-viz__load ${selected ? 'is-selected' : ''}`} style={{ color }}>
      <path d={fillPath} fill="currentColor" fillOpacity="0.08" stroke="none" />
      <path d={envelope} stroke="currentColor" strokeWidth="1.6" fill="none" />
      {arrows}
      <text
        x={tallest.x}
        y={labelY}
        fontSize="11"
        fill="currentColor"
        fontFamily="system-ui"
        textAnchor="middle"
        fontWeight="600"
        paintOrder="stroke"
        stroke="#0f0f0f"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        {magLabel}
      </text>
    </g>
  );
}

function renderMoment(m: AppliedMoment, xOf: (x: number) => number, y: number, selected: boolean) {
  const cx = xOf(m.position);
  const color = selected ? '#c9a84c' : '#b877c9';
  const r = 18;
  const isCCW = m.direction === 'ccw';
  const startAngle = isCCW ? 200 : -20;
  const endAngle = isCCW ? -20 : 200;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const sx = cx + r * Math.cos(rad(startAngle));
  const sy = y + r * Math.sin(rad(startAngle));
  const ex = cx + r * Math.cos(rad(endAngle));
  const ey = y + r * Math.sin(rad(endAngle));
  const largeArc = 1;
  const sweep = isCCW ? 0 : 1;

  return (
    <g key={m.id} className={`beam-viz__moment ${selected ? 'is-selected' : ''}`} style={{ color }}>
      <path
        d={`M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} ${sweep} ${ex} ${ey}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        markerEnd="url(#arrow)"
      />
      <text x={cx} y={y - r - 8} textAnchor="middle" fontSize="11" fill="currentColor" fontFamily="system-ui" fontWeight="600">
        {`${m.magnitude.toFixed(2)} kN\u00b7m`}
      </text>
    </g>
  );
}
