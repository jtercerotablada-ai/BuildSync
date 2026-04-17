'use client';

import React from 'react';

interface ValueItemProps {
  number: string;
  title: string;
  description: string;
}

export function ValueItem({ number, title, description }: ValueItemProps) {
  return (
    <div className="value-item">
      <span className="value-item__number">{number}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
