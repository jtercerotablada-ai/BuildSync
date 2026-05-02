'use client';

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import type { Results } from '@/lib/advanced-beam/types';

interface Props {
  results: Results;
  totalLength: number;
}

export function AdvancedBeamDiagrams({ results, totalLength }: Props) {
  if (!results.solved) {
    return (
      <div className="ab-diagrams ab-diagrams--empty">
        <p>Diagrams will appear after a successful solve.</p>
      </div>
    );
  }

  const fmt = (v: number, unit: string) => `${v.toFixed(2)} ${unit}`;

  const charts: ChartCfg[] = [
    {
      id: 'shear',
      title: 'Shear Force V (kN)',
      data: results.shear,
      color: '#4a90c9',
      areaColor: 'rgba(74, 144, 201, 0.18)',
      max: results.maxShear,
      min: results.minShear,
      unit: 'kN',
    },
    {
      id: 'moment',
      title: 'Bending Moment M (kN·m) — sagging positive',
      data: results.moment,
      color: '#c9a84c',
      areaColor: 'rgba(201, 168, 76, 0.20)',
      max: results.maxMoment,
      min: results.minMoment,
      unit: 'kN·m',
    },
    {
      id: 'slope',
      title: 'Slope θ (rad)',
      data: results.slope,
      color: '#9d6cd1',
      areaColor: 'rgba(157, 108, 209, 0.16)',
      unit: 'rad',
    },
    {
      id: 'deflection',
      title: 'Deflection δ (mm) — positive UP',
      data: results.deflection,
      color: '#5fb674',
      areaColor: 'rgba(95, 182, 116, 0.16)',
      max: { value: results.maxDeflection.value, position: results.maxDeflection.position },
      unit: 'mm',
    },
  ];

  return (
    <div className="ab-diagrams">
      {charts.map((c) => (
        <div className="ab-diagram-card" key={c.id}>
          <header className="ab-diagram-card__header">
            <h4>{c.title}</h4>
            <div className="ab-diagram-card__extrema">
              {c.max && (
                <span className="ab-extremum">
                  max <strong>{fmt(c.max.value, c.unit)}</strong> @ {c.max.position.toFixed(2)} m
                </span>
              )}
              {c.min && (
                <span className="ab-extremum">
                  min <strong>{fmt(c.min.value, c.unit)}</strong> @ {c.min.position.toFixed(2)} m
                </span>
              )}
            </div>
          </header>
          <div className="ab-diagram-card__chart">
            <ResponsiveContainer width="100%" height={170}>
              <ComposedChart data={c.data} margin={{ top: 6, right: 16, bottom: 6, left: 0 }}>
                <defs>
                  <linearGradient id={`grad-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.color} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={c.color} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="x"
                  domain={[0, totalLength]}
                  type="number"
                  tickFormatter={(v) => Number(v).toFixed(1)}
                  stroke="rgba(255,255,255,0.5)"
                  fontSize={11}
                  tick={{ fill: 'rgba(255,255,255,0.6)' }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.5)"
                  fontSize={11}
                  tick={{ fill: 'rgba(255,255,255,0.6)' }}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15,15,15,0.95)',
                    border: '1px solid rgba(201,168,76,0.4)',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => `x = ${Number(v).toFixed(3)} m`}
                  formatter={(v: number) => [`${Number(v).toFixed(3)} ${c.unit}`, '']}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                <Area type="monotone" dataKey="value" stroke="none" fill={`url(#grad-${c.id})`} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={c.color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}

interface ChartCfg {
  id: string;
  title: string;
  data: { x: number; value: number }[];
  color: string;
  areaColor: string;
  max?: { value: number; position: number };
  min?: { value: number; position: number };
  unit: string;
}
