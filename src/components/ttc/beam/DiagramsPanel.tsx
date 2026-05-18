'use client';

import React, { useEffect, useState } from 'react';
import type { DiagramPoint, Results } from '@/lib/beam/types';
import { fromSI, unitLabel, type UnitSystem, type Quantity } from '@/lib/beam/units';

interface DiagramProps {
  title: string;
  unit: string;
  data: DiagramPoint[];
  color: string;
  length: number;
  valueQuantity: Quantity;
  unitSystem: UnitSystem;
  xUnit: string;
  maxLabel?: string;
  minLabel?: string;
  maxValue?: number;
  maxPos?: number;
  minValue?: number;
  minPos?: number;
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

function Diagram({
  title,
  unit,
  data,
  color,
  length,
  valueQuantity,
  unitSystem,
  xUnit,
  maxLabel,
  minLabel,
  maxValue,
  maxPos,
  minValue,
  minPos,
}: DiagramProps) {
  const phone = useIsPhone();
  const convV = (v: number) => fromSI(v, valueQuantity, unitSystem);
  const convX = (x: number) => fromSI(x, 'position', unitSystem);
  const LConv = convX(length);
  const W = 1000;
  const H = phone ? 300 : 220;
  const padL = phone ? 85 : 70;
  const padR = phone ? 30 : 40;
  const padT = phone ? 36 : 28;
  const padB = phone ? 56 : 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  if (data.length === 0 || length <= 0) {
    return (
      <div className="diagram">
        <div className="diagram__title">{title}</div>
        <div className="diagram__empty">No data</div>
      </div>
    );
  }

  // Work entirely in display units so axis ticks/labels are consistent.
  const pts = data.map((p) => ({ x: convX(p.x), value: convV(p.value) }));

  let yMin = Infinity;
  let yMax = -Infinity;
  for (const p of pts) {
    if (p.value < yMin) yMin = p.value;
    if (p.value > yMax) yMax = p.value;
  }
  if (Math.abs(yMax - yMin) < 1e-9) {
    const pad = Math.max(Math.abs(yMax), 1) * 0.1;
    yMin -= pad;
    yMax += pad;
  }
  const pad = (yMax - yMin) * 0.1;
  yMin -= pad;
  yMax += pad;

  if (yMin > 0) yMin = 0;
  if (yMax < 0) yMax = 0;

  const xOf = (x: number) => padL + (x / Math.max(LConv, 1e-9)) * plotW;
  const yOf = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const zeroY = yOf(0);
  const path = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.x).toFixed(2)} ${yOf(p.value).toFixed(2)}`)
    .join(' ');

  const fillPath =
    `M ${xOf(pts[0].x).toFixed(2)} ${zeroY.toFixed(2)} ` +
    pts.map((p) => `L ${xOf(p.x).toFixed(2)} ${yOf(p.value).toFixed(2)}`).join(' ') +
    ` L ${xOf(pts[pts.length - 1].x).toFixed(2)} ${zeroY.toFixed(2)} Z`;

  const yTicks = makeTicks(yMin, yMax, 4);
  const xTicks = makeTicks(0, LConv, 6);

  const maxValueConv = maxValue !== undefined ? convV(maxValue) : undefined;
  const maxPosConv = maxPos !== undefined ? convX(maxPos) : undefined;
  const minValueConv = minValue !== undefined ? convV(minValue) : undefined;
  const minPosConv = minPos !== undefined ? convX(minPos) : undefined;

  return (
    <div className="diagram">
      <div className="diagram__title">
        <span>{title}</span>
        <span className="diagram__unit">{unit}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="diagram__svg" preserveAspectRatio="xMidYMid meet">
        <g className="diagram__grid">
          {yTicks.map((t, i) => (
            <g key={`y${i}`}>
              <line
                x1={padL}
                y1={yOf(t)}
                x2={W - padR}
                y2={yOf(t)}
                stroke={Math.abs(t) < 1e-9 ? '#3a3a3a' : '#242424'}
                strokeWidth={Math.abs(t) < 1e-9 ? 1 : 0.5}
              />
              <text
                x={padL - 8}
                y={yOf(t) + 4}
                textAnchor="end"
                fontSize="10"
                fill="#8a8a8a"
                fontFamily="system-ui"
              >
                {formatTick(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <g key={`x${i}`}>
              <line x1={xOf(t)} y1={padT} x2={xOf(t)} y2={H - padB} stroke="#242424" strokeWidth="0.5" />
              <text
                x={xOf(t)}
                y={H - padB + 16}
                textAnchor="middle"
                fontSize="10"
                fill="#8a8a8a"
                fontFamily="system-ui"
              >
                {t.toFixed(t >= 10 ? 0 : 2)}
              </text>
            </g>
          ))}
        </g>

        <path d={fillPath} fill={color} fillOpacity="0.18" stroke="none" />
        <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />

        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="#4a4a4a" strokeWidth="0.8" />
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#4a4a4a" strokeWidth="0.8" />

        {maxValueConv !== undefined && maxPosConv !== undefined && Math.abs(maxValueConv) > 1e-9 && (() => {
          const mx = xOf(maxPosConv);
          const near0 = mx < padL + 40;
          const nearL = mx > W - padR - 40;
          const anchor = near0 ? 'start' : nearL ? 'end' : 'middle';
          const dx = near0 ? 6 : nearL ? -6 : 0;
          return (
            <g>
              <circle cx={mx} cy={yOf(maxValueConv)} r="3" fill={color} />
              <text
                x={mx + dx}
                y={yOf(maxValueConv) - 8}
                textAnchor={anchor}
                fontSize="10"
                fontWeight="700"
                fill={color}
                fontFamily="system-ui"
                paintOrder="stroke"
                stroke="#0f0f0f"
                strokeWidth="3"
                strokeLinejoin="round"
              >
                {maxLabel ?? 'max'} = {formatTick(maxValueConv)}
              </text>
            </g>
          );
        })()}
        {minValueConv !== undefined && minPosConv !== undefined && Math.abs(minValueConv) > 1e-9 && Math.abs(minValueConv - (maxValueConv ?? 0)) > 1e-6 && (() => {
          const mx = xOf(minPosConv);
          const near0 = mx < padL + 40;
          const nearL = mx > W - padR - 40;
          const anchor = near0 ? 'start' : nearL ? 'end' : 'middle';
          const dx = near0 ? 6 : nearL ? -6 : 0;
          return (
            <g>
              <circle cx={mx} cy={yOf(minValueConv)} r="3" fill={color} />
              <text
                x={mx + dx}
                y={yOf(minValueConv) + 16}
                textAnchor={anchor}
                fontSize="10"
                fontWeight="700"
                fill={color}
                fontFamily="system-ui"
                paintOrder="stroke"
                stroke="#0f0f0f"
                strokeWidth="3"
                strokeLinejoin="round"
              >
                {minLabel ?? 'min'} = {formatTick(minValueConv)}
              </text>
            </g>
          );
        })()}

        <text x={W - padR} y={H - padB + 28} textAnchor="end" fontSize="10" fill="#8a8a8a" fontFamily="system-ui">
          x ({xUnit})
        </text>
      </svg>
    </div>
  );
}

function makeTicks(min: number, max: number, count: number): number[] {
  const step = (max - min) / count;
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) ticks.push(min + i * step);
  return ticks;
}

function formatTick(v: number): string {
  if (Math.abs(v) < 0.001) return '0';
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 100) return v.toFixed(1);
  if (Math.abs(v) >= 10) return v.toFixed(2);
  return v.toFixed(3);
}

interface Props {
  results: Results;
  length: number;
  unitSystem?: UnitSystem;
}

export function DiagramsPanel({ results, length, unitSystem = 'metric' }: Props) {
  if (!results.solved) return null;
  const xUnit = unitLabel('position', unitSystem);
  const uForce = unitLabel('force', unitSystem);
  const uMom = unitLabel('moment', unitSystem);
  const uDef = unitLabel('deflection', unitSystem);

  return (
    <div className="diagrams">
      <Diagram
        title="Shear Force"
        unit={uForce}
        data={results.shear}
        color="#4a90c9"
        length={length}
        valueQuantity="force"
        unitSystem={unitSystem}
        xUnit={xUnit}
        maxLabel="V⁺"
        minLabel="V⁻"
        maxValue={results.maxShear.value}
        maxPos={results.maxShear.position}
        minValue={results.minShear.value}
        minPos={results.minShear.position}
      />
      <Diagram
        title="Bending Moment"
        unit={uMom}
        data={results.moment}
        color="#c9a84c"
        length={length}
        valueQuantity="moment"
        unitSystem={unitSystem}
        xUnit={xUnit}
        maxLabel="M⁺"
        minLabel="M⁻"
        maxValue={results.maxMoment.value}
        maxPos={results.maxMoment.position}
        minValue={results.minMoment.value}
        minPos={results.minMoment.position}
      />
      <Diagram
        title="Deflection"
        unit={uDef}
        data={results.deflection}
        color="#a8c94a"
        length={length}
        valueQuantity="deflection"
        unitSystem={unitSystem}
        xUnit={xUnit}
        maxLabel="δ"
        maxValue={results.maxDeflection.value}
        maxPos={results.maxDeflection.position}
      />
    </div>
  );
}
