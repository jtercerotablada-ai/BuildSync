'use client';

import React from 'react';

interface ValueItemProps {
  number: string;
  title: string;
  description: string;
  delay?: number;
}

export function ValueItem({ number, title, description, delay }: ValueItemProps) {
  return (
    <div className="value-item" data-aos="fade-up" data-aos-delay={delay}>
      <span className="value-item__number">{number}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
