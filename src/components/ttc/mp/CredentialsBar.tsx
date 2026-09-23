'use client';

import React from 'react';
import { Reveal } from './primitives';
import { useContent } from './lang';

/**
 * Accountability, stated once: who seals the deliverables.
 *
 * This file used to render a "Standards & accountability" band — a six-cell
 * grid headlined ACI 318, ASCE 7, AISC 360, ISO 19650. That is the
 * code-standard list the owner rejected for the client site (a board does not
 * choose an engineer by code number), so the grid is gone and only the plain
 * sealing statement remains. It is no longer a section of its own: About
 * places it inside the Principles section, where "how we hold the line" ends
 * with the person who signs.
 *
 * It names the engineer, so it belongs on /about (and its /es mirror) only.
 */
export function SealStatement({ className }: { className?: string }) {
  const c = useContent();
  const k = c.credentials;
  if (!k.sealedDeliverables) return null;
  return (
    <Reveal delay={0.06} className={`mp-creds__seal ${className ?? ''}`.trim()}>
      <span className="mp-creds__seal-mark" aria-hidden="true">
        P.E.
      </span>
      <p>{k.sealingStatement}</p>
    </Reveal>
  );
}
