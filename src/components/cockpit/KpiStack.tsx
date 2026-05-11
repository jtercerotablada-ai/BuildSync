'use client';

import React from 'react';
import { Briefcase, DollarSign, Users, FileSignature } from 'lucide-react';
import type { CockpitData } from './types';
import { TYPE_COLOR, TYPE_LABEL } from './types';

interface KpiStackProps {
  data: CockpitData;
}

function formatMoney(amount: number, currency: string) {
  if (amount >= 1_000_000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 1,
      notation: 'compact',
      compactDisplay: 'short',
    }).format(amount);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function KpiStack({ data }: KpiStackProps) {
  const total = (Object.values(data.countsByType) as number[]).reduce((a, b) => a + b, 0);

  return (
    <div className="cockpit-kpi-stack">
      {/* Active projects + type breakdown */}
      <div className="cockpit-kpi-card cockpit-kpi-card--projects">
        <div className="cockpit-kpi-card__head">
          <Briefcase size={14} />
          <span>Active Projects</span>
        </div>
        <div className="cockpit-kpi-card__number">{data.kpis.activeProjects}</div>
        <div className="cockpit-kpi-card__breakdown">
          {(Object.keys(data.countsByType) as (keyof typeof data.countsByType)[]).map((t) => {
            const count = data.countsByType[t];
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={t} className="cockpit-kpi-bar-row">
                <span className="cockpit-kpi-bar-row__label" style={{ color: TYPE_COLOR[t] }}>
                  {TYPE_LABEL[t]}
                </span>
                <div className="cockpit-kpi-bar-row__bar">
                  <div
                    className="cockpit-kpi-bar-row__fill"
                    style={{ width: `${pct}%`, background: TYPE_COLOR[t] }}
                  />
                </div>
                <span className="cockpit-kpi-bar-row__count">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue pipeline */}
      <div className="cockpit-kpi-card cockpit-kpi-card--revenue">
        <div className="cockpit-kpi-card__head">
          <DollarSign size={14} />
          <span>Revenue Pipeline</span>
        </div>
        <div className="cockpit-kpi-card__number">
          {formatMoney(data.kpis.totalBudget, data.kpis.currency)}
        </div>
        <div className="cockpit-kpi-card__sparkline">
          {data.revenuePipeline.length > 0 && (
            <Sparkline data={data.revenuePipeline.map((m) => m.revenue)} />
          )}
          <div className="cockpit-kpi-card__sparkline-labels">
            {data.revenuePipeline.map((m) => (
              <span key={m.month}>{m.month}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Team utilization gauge */}
      <div className="cockpit-kpi-card cockpit-kpi-card--util">
        <div className="cockpit-kpi-card__head">
          <Users size={14} />
          <span>Team Utilization</span>
        </div>
        <UtilizationGauge percent={data.kpis.teamUtilization} />
      </div>

      {/* P.E. Sign Queue */}
      <div className="cockpit-kpi-card cockpit-kpi-card--sign">
        <div className="cockpit-kpi-card__head">
          <FileSignature size={14} />
          <span>P.E. Sign Queue</span>
        </div>
        <div className="cockpit-kpi-card__number">{data.kpis.pendingSignatures}</div>
        <div className="cockpit-kpi-card__sub">
          {data.kpis.pendingSignatures === 0
            ? 'Inbox clear · no documents waiting'
            : 'Documents awaiting your P.E. seal'}
        </div>
        <a className="cockpit-kpi-card__link" href="/inbox?filter=signatures">
          Open queue →
        </a>
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const w = 100;
  const h = 32;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const points = data
    .map((v, i) => `${i * step},${h - (v / max) * (h - 4) - 2}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="cockpit-sparkline">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#c9a84c" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,${h} ${points} ${w},${h}`} fill="url(#spark-fill)" stroke="none" />
      <polyline points={points} fill="none" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UtilizationGauge({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  // Monochrome + gold gauge: low = gray, normal/high = gold tiers, max = black (severe).
  const color = clamped < 50 ? '#9ca3af' : clamped < 80 ? '#c9a84c' : clamped < 95 ? '#a8893a' : '#0a0a0a';

  return (
    <div className="cockpit-gauge">
      <svg viewBox="0 0 100 100" className="cockpit-gauge__svg">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#1f1f1f" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="cockpit-gauge__center">
        <span className="cockpit-gauge__value">{clamped}%</span>
        <span className="cockpit-gauge__label">load</span>
      </div>
    </div>
  );
}
