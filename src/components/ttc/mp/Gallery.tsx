'use client';

import React from 'react';
import { imagery } from '@/lib/ttc/site';
import { Img } from './media';
import { Reveal, SectionHeading } from './primitives';
import { useContent } from './lang';

/**
 * A closing wall of architecture on the Work page — purely atmospheric, and
 * honest precisely because it says nothing. Uniform full-bleed tiles in a
 * 2 / 3 / 4-column grid (≤720 px / ≤1200 px / wider — mp.css `.mp-gal`); the
 * wall closes on a straight edge at a given width only when the tile count
 * divides by that column count.
 *
 * `sizes` mirrors those breakpoints exactly: each tile is a half, third or
 * quarter of the viewport. Understating it made retina screens pick the 900w
 * file for tiles twice that wide; the 1200w rung now covers them.
 *
 * The section's name is the hidden h2. The visible label is the same words,
 * so it is hidden from assistive tech rather than read twice.
 */
export function Gallery({ n = '03' }: { n?: string }) {
  const c = useContent();
  const items = imagery.gallery;
  return (
    <section className="mp-section mp-surface--graphite mp-gal-sec" aria-labelledby="mp-gal-title">
      <div className="mp-shell">
        <div aria-hidden="true">
          <SectionHeading n={n} label={c.workSection.galleryEyebrow} />
        </div>
        <h2 id="mp-gal-title" className="mp-sr-only">
          {c.workSection.galleryEyebrow}
        </h2>
        <Reveal>
          <p className="mp-gal__lede">{c.workSection.galleryLede}</p>
        </Reveal>
      </div>

      <div className="mp-gal">
        {items.map((ph, i) => (
          <Reveal as="div" key={ph.src} delay={(i % 4) * 0.04} className="mp-gal__cell">
            <Img photo={ph} sizes="(max-width: 720px) 50vw, (max-width: 1200px) 33vw, 25vw" />
          </Reveal>
        ))}
      </div>

      <div className="mp-shell">
        <p className="mp-note mp-gal__note">{c.ui.galleryNote}</p>
      </div>
    </section>
  );
}
