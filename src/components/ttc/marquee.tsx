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
    <div className="marquee">
      <div className="marquee__track">
        {items.map((item, i) => (
          <React.Fragment key={i}>
            <span>{item}</span>
            <span>{'\u00b7'}</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
