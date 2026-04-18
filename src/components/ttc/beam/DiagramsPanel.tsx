'use client';

import React from 'react';
import type { DiagramPoint, Results } from '@/lib/beam/types';

interface DiagramProps {
  title: string;
  unit: string;
  data: DiagramPoint[];
  color: string;
  length: number;
  maxLabel?: string;
  minLabel?: string;
  maxValue?: number;
  maxPos?: number;
  minValue?: number;
  minPos?: number;
}

function Diagram({
  title,
  unit,
  data,
  color,
  length,
  maxLabel,
  minLabel,
  maxValue,
  maxPos,
  minValue,
  minPos,
}: DiagramProps) {
  const W = 1000;
  const H = 220;
  const padL = 70;
  const padR = 40;
  const padT = 28;
  const padB = 40;
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

  let yMin = Infinity;
  let yMax = -Infinity;
  for (const p of data) {
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

  const xOf = (x: number) => padL + (x / length) * plotW;
  const yOf = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const zeroY = yOf(0);
  const path = data
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.x).toFixed(2)} ${yOf(p.value).toFixed(2)}`)
    .join(' ');

  const fillPath =
    `M ${xOf(data[0].x).toFixed(2)} ${zeroY.toFixed(2)} ` +
    data.map((p) => `L ${xOf(p.x).toFixed(2)} ${yOf(p.value).toFixed(2)}`).join(' ') +
    ` L ${xOf(data[data.length - 1].x).toFixed(2)} ${zeroY.toFixed(2)} Z`;

  const yTicks = makeTicks(yMin, yMax, 4);
  const xTicks = makeTicks(0, length, 6);

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

        {maxValue !== undefined && maxPos !== undefined && Math.abs(maxValue) > 1e-9 && (
          <g>
            <circle cx={xOf(maxPos)} cy={yOf(maxValue)} r="3" fill={color} />
            <text
              x={xOf(maxPos)}
              y={yOf(maxValue) - 8}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={color}
              fontFamily="system-ui"
            >
              {maxLabel ?? 'max'} = {formatTick(maxValue)}
            </text>
          </g>
        )}
        {minValue !== undefined && minPos !== undefined && Math.abs(minValue) > 1e-9 && minValue !== maxValue && (
          <g>
            <circle cx={xOf(minPos)} cy={yOf(minValue)} r="3" fill={color} />
            <text
              x={xOf(minPos)}
              y={yOf(minValue) + 16}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={color}
              fontFamily="system-ui"
            >
              {minLabel ?? 'min'} = {formatTick(minValue)}
            </text>
          </g>
        )}

        <text x={W - padR} y={H - padB + 28} textAnchor="end" fontSize="10" fill="#8a8a8a" fontFamily="system-ui">
          x (m)
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
}

export function DiagramsPanel({ results, length }: Props) {
  if (!results.solved) return null;

  return (
    <div className="diagrams">
      <Diagram
        title="Shear Force"
        unit="kN"
        data={results.shear}
        color="#4a90c9"
        length={length}
        maxLabel="V⁺"
        minLabel="V⁻"
        maxValue={results.maxShear.value}
        maxPos={results.maxShear.position}
        minValue={results.minShear.value}
        minPos={results.minShear.position}
      />
      <Diagram
        title="Bending Moment"
        unit="kN·m"
        data={results.moment}
        color="#c9a84c"
        length={length}
        maxLabel="M⁺"
        minLabel="M⁻"
        maxValue={results.maxMoment.value}
        maxPos={results.maxMoment.position}
        minValue={results.minMoment.value}
        minPos={results.minMoment.position}
      />
      <Diagram
        title="Deflection"
        unit="mm"
        data={results.deflection}
        color="#a8c94a"
        length={length}
        maxLabel="δ"
        maxValue={results.maxDeflection.value}
        maxPos={results.maxDeflection.position}
      />
    </div>
  );
}
