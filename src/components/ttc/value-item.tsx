'use client';

import React from 'react';

interface ValueItemProps {
  number: string;
  title: string;
  description: string;
}

export function ValueItem({ number, title, description }: ValueItemProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '1.5rem',
        alignItems: 'flex-start',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--ttc-font-heading)',
          fontSize: '2.5rem',
          fontWeight: 400,
          color: '#c9a84c',
          lineHeight: 1,
          flexShrink: 0,
          opacity: 0.5,
        }}
      >
        {number}
      </span>
      <div>
        <h3
          style={{
            fontFamily: 'var(--ttc-font-heading)',
            fontSize: '1.25rem',
            fontWeight: 400,
            color: '#fff',
            marginBottom: '0.5rem',
          }}
        >
          {title}
        </h3>
        <p
          style={{
            color: '#a3a3a3',
            fontSize: '0.9375rem',
            lineHeight: 1.7,
          }}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
