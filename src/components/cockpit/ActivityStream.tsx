'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Activity } from 'lucide-react';
import type { ActivityItem } from './types';

interface ActivityStreamProps {
  items: ActivityItem[];
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function ActivityStream({ items }: ActivityStreamProps) {
  const [open, setOpen] = useState(true);
  const visible = open ? items : items.slice(0, 3);

  return (
    <section className="cockpit-activity">
      <header className="cockpit-activity__header">
        <Activity size={14} />
        <h2>Recent Activity</h2>
        <button
          className="cockpit-activity__toggle"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Collapse activity' : 'Expand activity'}
        >
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </header>
      {items.length === 0 ? (
        <p className="cockpit-activity__empty">No activity yet.</p>
      ) : (
        <ul className="cockpit-activity__list">
          {visible.map((a) => {
            const person = a.assignee || a.creator;
            const isDone = !!a.completedAt;
            return (
              <li key={a.id} className="cockpit-activity-row">
                <span
                  className="cockpit-activity-row__dot"
                  style={{ background: a.project.color }}
                />
                <span className="cockpit-activity-row__main">
                  <Link href={`/projects/${a.project.id}`} className="cockpit-activity-row__project">
                    {a.project.name}
                  </Link>
                  <span className="cockpit-activity-row__verb">
                    {isDone ? 'completed' : 'updated'}
                  </span>
                  <span className="cockpit-activity-row__task">{a.name}</span>
                </span>
                <span className="cockpit-activity-row__by">{person?.name || 'someone'}</span>
                <span className="cockpit-activity-row__time">{timeAgo(a.updatedAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
