import React from 'react';
import { TOOL_ICONS } from '@/components/ttc/tool-icons';

// DEV-ONLY review surface for the Resources icon set. Imports the real
// TOOL_ICONS so it always reflects tool-icons.tsx. Not linked anywhere.
export default function IconLabPage() {
  const entries = Object.entries(TOOL_ICONS);
  return (
    <div style={{ padding: '40px 48px 80px', background: '#f6f5f2', minHeight: '100vh' }}>
      <h1 style={{ fontFamily: 'var(--font-display, serif)', fontWeight: 500, margin: '0 0 4px' }}>
        Icon Lab — {entries.length} icons
      </h1>
      <p style={{ color: '#5b5b54', margin: '0 0 32px', fontSize: 14 }}>
        Duotone v2 · warm ink #221e17 + gold #c9a84c · rendered on the real card tile.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
          gap: '22px 14px',
          maxWidth: 1320,
        }}
      >
        {entries.map(([key, icon]) => (
          <div
            key={key}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, textAlign: 'center' }}
          >
            <div
              style={{
                width: 120,
                height: 120,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(201,168,76,0.08)',
                border: '1px solid rgba(201,168,76,0.25)',
                borderRadius: 14,
              }}
            >
              <div style={{ transform: 'scale(2)', display: 'flex' }}>{icon}</div>
            </div>
            <span style={{ fontSize: 11.5, color: '#221e17', fontFamily: 'monospace' }}>{key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
