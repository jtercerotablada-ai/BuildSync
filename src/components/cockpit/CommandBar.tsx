'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, FileSignature, Clock } from 'lucide-react';

interface CommandBarProps {
  userName?: string | null;
  alerts: {
    overdueCount: number;
    pendingSignatures: number;
    expiringCompliance: number;
  };
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function CommandBar({ userName, alerts }: CommandBarProps) {
  const [, force] = useState(0);

  // Refresh greeting/date every minute so the user never sees a stale "evening"
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="cockpit-command-bar">
      <div className="cockpit-command-bar__left">
        <h1>
          {greeting()}
          {userName ? `, ${userName.split(' ')[0]}` : ''}
        </h1>
        <p>{formatDate()}</p>
      </div>

      <div className="cockpit-command-bar__alerts">
        {alerts.overdueCount > 0 && (
          <a href="/my-tasks?filter=overdue" className="cockpit-alert cockpit-alert--danger">
            <Clock size={14} />
            <span>
              <strong>{alerts.overdueCount}</strong> overdue
            </span>
          </a>
        )}
        {alerts.pendingSignatures > 0 && (
          <a href="/inbox?filter=signatures" className="cockpit-alert cockpit-alert--info">
            <FileSignature size={14} />
            <span>
              <strong>{alerts.pendingSignatures}</strong> P.E. signatures
            </span>
          </a>
        )}
        {alerts.expiringCompliance > 0 && (
          <a href="#compliance" className="cockpit-alert cockpit-alert--warning">
            <AlertTriangle size={14} />
            <span>
              <strong>{alerts.expiringCompliance}</strong> expiring
            </span>
          </a>
        )}
      </div>
    </div>
  );
}
