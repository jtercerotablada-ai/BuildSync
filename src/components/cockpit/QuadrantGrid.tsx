'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, ShieldAlert, TrendingUp } from 'lucide-react';
import type { CockpitData } from './types';
import { TYPE_COLOR, TYPE_LABEL, STATUS_COLOR } from './types';

interface QuadrantGridProps {
  data: CockpitData;
}

export function QuadrantGrid({ data }: QuadrantGridProps) {
  return (
    <div className="cockpit-quadrants">
      <CriticalPath data={data} />
      <TeamPanel data={data} />
      <CompliancePanel data={data} />
      <RevenuePanel data={data} />
    </div>
  );
}

function CriticalPath({ data }: { data: CockpitData }) {
  return (
    <section className="cockpit-quadrant cockpit-quadrant--critical">
      <header className="cockpit-quadrant__header">
        <AlertTriangle size={14} />
        <h2>Critical Path</h2>
        <span className="cockpit-quadrant__count">{data.criticalPath.length}</span>
      </header>
      {data.criticalPath.length === 0 ? (
        <div className="cockpit-quadrant__empty">All clear · no tasks due in the next 14 days.</div>
      ) : (
        <ul className="cockpit-quadrant__list">
          {data.criticalPath.map((t) => {
            const due = new Date(t.dueDate);
            const daysOut = Math.ceil((due.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
            const urgent = daysOut <= 3;
            return (
              <li key={t.id} className="cockpit-critical-row">
                <Link href={`/projects/${t.project.id}`} className="cockpit-critical-row__project">
                  <span className="cockpit-critical-row__dot" style={{ background: t.project.type ? TYPE_COLOR[t.project.type] : '#666' }} />
                  {t.project.name}
                </Link>
                <span className="cockpit-critical-row__task">{t.name}</span>
                <span
                  className={`cockpit-critical-row__due${urgent ? ' is-urgent' : ''}`}
                >
                  <Clock size={11} />
                  {daysOut === 0 ? 'today' : daysOut === 1 ? 'tomorrow' : `${daysOut}d`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TeamPanel({ data }: { data: CockpitData }) {
  const maxLoad = Math.max(...data.team.map((m) => m.load), 1);
  return (
    <section className="cockpit-quadrant cockpit-quadrant--team">
      <header className="cockpit-quadrant__header">
        <span className="cockpit-quadrant__header-glyph">●</span>
        <h2>Team Load</h2>
        <span className="cockpit-quadrant__count">{data.team.length}</span>
      </header>
      {data.team.length === 0 ? (
        <div className="cockpit-quadrant__empty">No team members yet.</div>
      ) : (
        <ul className="cockpit-quadrant__list">
          {data.team.map((m) => {
            const pct = (m.load / maxLoad) * 100;
            const overload = m.load > 8;
            return (
              <li key={m.id} className="cockpit-team-row">
                <Avatar name={m.name} image={m.image} />
                <span className="cockpit-team-row__name">{m.name || m.email}</span>
                <div className="cockpit-team-row__bar">
                  <div
                    className="cockpit-team-row__fill"
                    style={{ width: `${pct}%`, background: overload ? '#0a0a0a' : '#c9a84c' }}
                  />
                </div>
                <span className="cockpit-team-row__load">{m.load}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CompliancePanel({ data }: { data: CockpitData }) {
  return (
    <section id="compliance" className="cockpit-quadrant cockpit-quadrant--compliance">
      <header className="cockpit-quadrant__header">
        <ShieldAlert size={14} />
        <h2>Compliance Watch</h2>
        <span className="cockpit-quadrant__count">{data.compliance.length}</span>
      </header>
      {data.compliance.length === 0 ? (
        <div className="cockpit-quadrant__empty">No permits or recerts expiring in 60 days.</div>
      ) : (
        <ul className="cockpit-quadrant__list">
          {data.compliance.map((p) => {
            const end = p.endDate ? new Date(p.endDate) : null;
            const days = end ? Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : 0;
            const urgent = days <= 14;
            return (
              <li key={p.id} className="cockpit-compliance-row">
                <Link href={`/projects/${p.id}`} className="cockpit-compliance-row__name">
                  <span className="cockpit-compliance-row__type" style={{ color: p.type ? TYPE_COLOR[p.type] : '#666' }}>
                    {p.type ? TYPE_LABEL[p.type] : 'Project'}
                  </span>
                  <span className="cockpit-compliance-row__title">{p.name}</span>
                  {p.location && <span className="cockpit-compliance-row__loc">{p.location}</span>}
                </Link>
                <span
                  className={`cockpit-compliance-row__due${urgent ? ' is-urgent' : ''}`}
                  style={{ background: STATUS_COLOR[p.status] }}
                >
                  {days <= 0 ? 'expired' : `${days}d`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RevenuePanel({ data }: { data: CockpitData }) {
  const max = Math.max(...data.revenuePipeline.map((m) => m.revenue), 1);
  return (
    <section className="cockpit-quadrant cockpit-quadrant--revenue">
      <header className="cockpit-quadrant__header">
        <TrendingUp size={14} />
        <h2>Revenue Pipeline</h2>
      </header>
      {data.revenuePipeline.length === 0 || max <= 1 ? (
        <div className="cockpit-quadrant__empty">No revenue scheduled in the next 6 months.</div>
      ) : (
        <div className="cockpit-revenue-chart">
          {data.revenuePipeline.map((m) => {
            const h = (m.revenue / max) * 100;
            return (
              <div key={m.month} className="cockpit-revenue-bar-group">
                <div className="cockpit-revenue-bar-wrap">
                  <div className="cockpit-revenue-bar" style={{ height: `${h}%` }}>
                    {m.revenue > 0 && (
                      <span className="cockpit-revenue-bar__value">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: data.kpis.currency,
                          notation: 'compact',
                          maximumFractionDigits: 1,
                        }).format(m.revenue)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="cockpit-revenue-bar-label">{m.month}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Avatar({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={name || ''} className="cockpit-avatar" />;
  }
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return <span className="cockpit-avatar cockpit-avatar--initials">{initials}</span>;
}
