'use client';

import React from 'react';
import { imagery } from '@/lib/ttc/site';
import { Img } from './media';
import { Reveal, SectionHeading } from './primitives';

/**
 * A closing wall of architecture on the Work page.
 *
 * This is the one place on the site that is purely atmospheric, and it is
 * honest precisely because it says nothing: no captions, no locations, no
 * years, no implied authorship. It is the material the practice works in —
 * concrete, reinforcement, houses, coastline — not a claim about who built it.
 *
 * The tiles are UNIFORM, which was not the first attempt. Varying the spans on
 * a repeating pattern looks better in a mockup and breaks in practice: with
 * mixed row and column spans the last row cannot be made to close on a straight
 * edge at 4, 3 AND 2 columns, and `grid-auto-flow: dense` fills the holes by
 * reordering — so the tail of the wall came out ragged and the sequence changed
 * with the viewport. A regular grid of twelve reads as a contact sheet, which
 * is the right reference for this site anyway, and it is correct at every width.
 */
export function Gallery({ n = '04' }: { n?: string }) {
  const items = imagery.gallery;

  return (
    <section
      className="mp-section mp-surface--graphite mp-gal-sec"
      aria-labelledby="mp-gal-title"
    >
      <div className="mp-shell">
        <SectionHeading
          n={n}
          label="The material"
          meta={`${String(items.length).padStart(2, '0')} frames`}
          className="mp-sechead--dark"
        />
        <h2 id="mp-gal-title" className="mp-form__hp">
          The material
        </h2>
        <Reveal>
          <p className="mp-gal__lede">
            Reinforced concrete, reinforcement, residences and the coastline
            they stand on — the vocabulary of the work, uncaptioned on purpose.
          </p>
        </Reveal>
      </div>

      <div className="mp-gal">
        {items.map((ph, i) => (
          <Reveal
            as="div"
            key={ph.src}
            delay={(i % 4) * 0.05}
            className="mp-gal__cell"
          >
            <Img
              photo={ph}
              sizes="(max-width: 720px) 50vw, (max-width: 1200px) 33vw, 25vw"
            />
          </Reveal>
        ))}
      </div>

      <div className="mp-shell">
        <p className="mp-note mp-gal__note">
          Licensed architectural photography, shown as material rather than as
          portfolio. No image on this page depicts a Tercero Tablada project.
        </p>
      </div>
    </section>
  );
}
