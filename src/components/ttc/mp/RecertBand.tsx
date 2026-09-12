'use client';

import React from 'react';
import { imagery } from '@/lib/ttc/site';
import { VideoBand } from './VideoBand';
import { accentLines } from './text';
import { useContent, useL } from './lang';

/**
 * The one video band on the home page: existing buildings and their clocks.
 * Every number here is per jurisdiction and was verified on the date recorded
 * in `site.ts` — never collapse Miami-Dade and Broward into one figure.
 */
export function RecertBand() {
  const c = useContent();
  const l = useL();
  const b = c.recertBand;
  return (
    <VideoBand
      eyebrow={b.eyebrow}
      titleLines={accentLines(b.titleLines, b.accentWord)}
      plainTitle={b.plainTitle}
      body={b.body}
      facts={b.facts.map((f) => ({ k: f.k, v: f.v }))}
      cta={{ href: l(b.cta.href), label: b.cta.label }}
      clip={imagery.clips.existing}
      align="right"
    />
  );
}
