import React from 'react';

export const serviceIcons: Record<string, React.ReactNode> = {
  predesign: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
      <path d="M6 42h36M10 42V22l14-10 14 10v20" />
      <rect x="18" y="30" width="12" height="12" />
    </svg>
  ),
  structural: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
      <rect x="4" y="4" width="40" height="40" rx="2" />
      <path d="M4 16h40M4 28h40M16 4v40M28 4v40" />
    </svg>
  ),
  review: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
      <circle cx="24" cy="24" r="18" />
      <path d="M24 12v24M12 24h24" />
      <path d="M16 16l16 16M32 16L16 32" />
    </svg>
  ),
  postTension: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
      <path d="M6 42h36" />
      <rect x="10" y="10" width="28" height="32" rx="1" />
      <path d="M10 20h28M10 30h28" />
      <path d="M18 10V6M30 10V6" />
    </svg>
  ),
  bimDev: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
      <path d="M8 42L24 6l16 36" />
      <path d="M14 30h20" />
      <path d="M18 42h12" />
    </svg>
  ),
  digital: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
      <rect x="6" y="6" width="16" height="16" rx="2" />
      <rect x="26" y="6" width="16" height="16" rx="2" />
      <rect x="6" y="26" width="16" height="16" rx="2" />
      <rect x="26" y="26" width="16" height="16" rx="2" />
    </svg>
  ),
  coordination: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
      <circle cx="16" cy="16" r="8" />
      <circle cx="32" cy="16" r="8" />
      <circle cx="24" cy="32" r="8" />
    </svg>
  ),
  clash: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
      <path d="M12 12l24 24M36 12L12 36" />
      <circle cx="24" cy="24" r="18" />
    </svg>
  ),
  bimAudit: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
      <path d="M6 42V14l18-8 18 8v28" />
      <path d="M6 14l18 8 18-8" />
      <path d="M24 22v20" />
    </svg>
  ),
};
