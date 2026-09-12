'use client';

import React from 'react';
import { imagery } from '@/lib/ttc/site';
import { Img } from './media';
import { Reveal, SectionHeading } from './primitives';
import { useContent } from './lang';

/**
 * A closing wall of architecture on the Work page — purely atmospheric, and
 * honest precisely because it says nothing. TWELVE uniform tiles: the grid
 * runs 4 / 3 / 2 columns and twelve divides by all three.
 */
export function Gallery({ n = '03' }: { n?: string }) {
  const c = useContent();
  const items = imagery.gallery;
  return (
    <section className="mp-section mp-surface--graphite mp-gal-sec" aria-labelledby="mp-gal-title">
      <div className="mp-shell">
        <SectionHeading n={n} label={c.workSection.galleryEyebrow} />
        <h2 id="mp-gal-title" className="mp-form__hp">
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
