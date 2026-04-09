'use client';

import React from 'react';

interface ServiceCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function ServiceCard({ icon, title, description }: ServiceCardProps) {
  return (
    <div
      style={{
        padding: '2.5rem 2rem',
        background: '#141414',
        border: '1px solid #222',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#c9a84c';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#222';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          color: '#c9a84c',
          marginBottom: '1.5rem',
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          fontFamily: 'var(--ttc-font-heading)',
          fontSize: '1.25rem',
          fontWeight: 400,
          color: '#fff',
          marginBottom: '1rem',
          lineHeight: 1.3,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: '#999',
          fontSize: '0.9375rem',
          lineHeight: 1.7,
        }}
      >
        {description}
      </p>
    </div>
  );
}
