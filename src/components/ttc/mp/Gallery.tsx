'use client';

import React from 'react';
import { imagery } from '@/lib/ttc/site';
import { Img } from './media';
import { Reveal, SectionHeading } from './primitives';
import { useContent } from './lang';

/**
 * The material, on the Work page: four frames of concrete, reinforcement and
 * the hands that place it — never a finished building, which on this page
 * would read as a portfolio. On paper, inside the shell: 2 columns up to
 * 720 px and 4 above (mp.css `.mp-gal`), so four tiles close on a straight
 * edge at every width.
 *
 * The note comes BEFORE the images, beside the section label from 901px: a
 * reader learns that no photograph is the firm's work before seeing one. It
 * is the page's one line on that, and it covers the hero's photograph too.
 *
 * `sizes` follows the tiles: half the viewport up to 720 px, then a quarter
 * of the shell's content box (about 23vw up to 1500px, never more than
 * ~420px on the widest shell), so a wide retina screen is not handed the
 * 2000w file for a 420px tile.
 *
 * The section's name is the hidden h2. The visible label is the same words,
 * so it is hidden from assistive tech rather than read twice.
 */
export function Gallery({ n = '03' }: { n?: string }) {
  const c = useContent();
  const items = imagery.gallery;
  return (
    <section className="mp-section mp-surface--paper mp-gal-sec" aria-labelledby="mp-gal-title">
      <div className="mp-shell">
        <h2 id="mp-gal-title" className="mp-sr-only">
          {c.workSection.galleryEyebrow}
        </h2>
        <div className="mp-gal__head">
          <div aria-hidden="true">
            <SectionHeading n={n} label={c.workSection.galleryEyebrow} />
          </div>
          <p className="mp-note mp-gal__note">{c.ui.galleryNote}</p>
        </div>
        <div className="mp-gal">
          {items.map((ph, i) => (
            <Reveal as="div" key={ph.src} delay={i * 0.04} className="mp-gal__cell">
              <Img photo={ph} sizes="(max-width: 720px) 50vw, (max-width: 1500px) 23vw, 420px" />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
