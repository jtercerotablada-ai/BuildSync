'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { CockpitProject, ProjectType } from './types';
import { TYPE_COLOR, TYPE_LABEL, GATE_INDEX, GATE_LABEL, STATUS_COLOR } from './types';

interface PipelineStripProps {
  projects: CockpitProject[];
}

const TYPE_FILTERS: (ProjectType | 'ALL')[] = ['ALL', 'CONSTRUCTION', 'DESIGN', 'RECERTIFICATION', 'PERMIT'];

/**
 * Horizontal scrollable strip of project cards. Each card encodes:
 *  - Type via top-left color stripe
 *  - Gate via the 5-segment progress bar at the bottom
 *  - Status via the colored dot in the header
 *  - Money via the budget readout
 */
export function PipelineStrip({ projects }: PipelineStripProps) {
  const [filter, setFilter] = useState<(ProjectType | 'ALL')>('ALL');

  const filtered = filter === 'ALL' ? projects : projects.filter((p) => p.type === filter);

  return (
    <section className="cockpit-pipeline">
      <header className="cockpit-pipeline__header">
        <h2>Pipeline</h2>
        <div className="cockpit-pipeline__filters">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              className={`cockpit-pipeline__filter${filter === t ? ' is-active' : ''}`}
              onClick={() => setFilter(t)}
              style={t !== 'ALL' && filter === t ? { borderColor: TYPE_COLOR[t], color: TYPE_COLOR[t] } : undefined}
            >
              {t === 'ALL' ? 'All' : TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="cockpit-pipeline__empty">No projects in this category yet.</div>
      ) : (
        <div className="cockpit-pipeline__scroller">
          {filtered.map((p) => (
            <ProjectTile key={p.id} project={p} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectTile({ project }: { project: CockpitProject }) {
  const accent = project.type ? TYPE_COLOR[project.type] : '#666';
  const gateIdx = project.gate ? GATE_INDEX[project.gate] : 0;

  return (
    <Link href={`/projects/${project.id}`} className="cockpit-pipeline-tile">
      <div className="cockpit-pipeline-tile__stripe" style={{ background: accent }} />
      <div className="cockpit-pipeline-tile__body">
        <header className="cockpit-pipeline-tile__header">
          <span
            className="cockpit-pipeline-tile__status"
            style={{ background: STATUS_COLOR[project.status] }}
            title={project.status.replace('_', ' ')}
          />
          {project.type && (
            <span className="cockpit-pipeline-tile__type" style={{ color: accent }}>
              {TYPE_LABEL[project.type]}
            </span>
          )}
        </header>
        <h3 className="cockpit-pipeline-tile__name">{project.name}</h3>
        {project.clientName && <p className="cockpit-pipeline-tile__client">{project.clientName}</p>}
        {project.location && <p className="cockpit-pipeline-tile__loc">{project.location}</p>}

        <div className="cockpit-pipeline-tile__gates">
          {(['PRE_DESIGN', 'DESIGN', 'PERMITTING', 'CONSTRUCTION', 'CLOSEOUT'] as const).map((g, i) => (
            <span
              key={g}
              className="cockpit-pipeline-tile__gate"
              data-active={i <= gateIdx ? 'true' : 'false'}
              style={i <= gateIdx ? { background: accent } : undefined}
              title={GATE_LABEL[g]}
            />
          ))}
        </div>

        <footer className="cockpit-pipeline-tile__footer">
          {project.budget && project.currency && (
            <span className="cockpit-pipeline-tile__budget">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: project.currency,
                notation: 'compact',
                compactDisplay: 'short',
                maximumFractionDigits: 1,
              }).format(project.budget)}
            </span>
          )}
          <span className="cockpit-pipeline-tile__tasks">{project._count.tasks} tasks</span>
        </footer>
      </div>
    </Link>
  );
}
