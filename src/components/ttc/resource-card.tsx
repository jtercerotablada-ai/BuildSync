'use client';

import React from 'react';
import Link from 'next/link';

interface ResourceCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  code?: string;
  status: 'available' | 'coming-soon';
  statusLabel: string;
  href?: string;
  openLabel?: string;
  /** Accepted for backward compatibility (older callers pass a stagger delay). */
  delay?: number;
}

export function ResourceCard({
  icon,
  title,
  description,
  code,
  status,
  statusLabel,
  href,
  openLabel,
}: ResourceCardProps) {
  const isAvailable = status === 'available' && !!href;

  const body = (
    <>
      <div className={`resource-card__status resource-card__status--${status}`}>
        {statusLabel}
      </div>
      <div className="service-card__icon">{icon}</div>
      <h3>{title}</h3>
      {code && code !== '—' && <span className="resource-card__code">{code}</span>}
      <p>{description}</p>
      {isAvailable && openLabel && (
        <span className="resource-card__action">
          {openLabel}
          <span className="btn__arrow">→</span>
        </span>
      )}
    </>
  );

  if (isAvailable && href) {
    return (
      <Link
        href={href}
        className="service-card resource-card resource-card--available"
        data-tilt
      >
        {body}
      </Link>
    );
  }

  return (
    <div
      className="service-card resource-card resource-card--coming-soon"
      data-tilt
    >
      {body}
    </div>
  );
}
