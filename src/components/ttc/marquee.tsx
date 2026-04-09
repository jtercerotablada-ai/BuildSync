'use client';

import React from 'react';

const clients = [
  'YOUR ARCHITECT PARTNER',
  'YOUR CONSTRUCTION FIRM',
  'YOUR DEVELOPER GROUP',
  'YOUR DESIGN STUDIO',
  'YOUR GENERAL CONTRACTOR',
  'YOUR ARCHITECTURE OFFICE',
  'YOUR REAL ESTATE PARTNER',
  'YOUR BUILDER CO.',
];

export function Marquee() {
  const items = [...clients, ...clients];

  return (
    <div className="ttc-marquee" style={{ padding: '2rem 0' }}>
      <div className="ttc-marquee__track">
        {items.map((item, i) => (
          <React.Fragment key={i}>
            <span>{item}</span>
            <span style={{ color: '#c9a84c' }}>{'\u00b7'}</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
