'use client';

import React from 'react';
import { imagery, serviceArea } from '@/lib/ttc/site';
import { Img } from './media';
import { Reveal, SectionHeading } from './primitives';

/**
 * Service area — the territory, photographed from the air.
 *
 * This was a drawn "PLAN DIAGRAM — NOT TO SCALE": a rectangle with two dashed
 * county lines, captioned with its own disclaimer that it was not really a map.
 * It answered "where do you work?" with a decorative shape. The aerial answers
 * it with the place.
 *
 * Nothing was traded away for atmosphere: the county names, their notes and
 * their coordinates were the only information the plate carried, and they are
 * all still here as typography beside the photograph.
 */
export function SouthFloridaMap({ n = '10' }: { n?: string }) {
  return (
    <section
      className="mp-section mp-section--lg mp-surface--concrete"
      aria-labelledby="mp-geo-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={serviceArea.eyebrow} meta="Miami-Dade & Broward" />

        <div className="mp-geo__grid">
          <Reveal>
            <div className="mp-geo__photo">
              <Img
                photo={imagery.sections.southFlorida}
                sizes="(max-width: 900px) 100vw, 50vw"
              />
            </div>
            <p className="mp-geo__caption">{serviceArea.note}</p>
          </Reveal>

          <div>
            <Reveal delay={0.06}>
              <h2 id="mp-geo-title" className="mp-h2">
                {serviceArea.title}
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p
                className="mp-lead mp-measure"
                style={{ marginBlockStart: 'var(--mp-6)' }}
              >
                {serviceArea.body}
              </p>
            </Reveal>

            <Reveal delay={0.14}>
              <ul className="mp-geo__counties">
                {serviceArea.counties.map((c) => (
                  <li key={c.code}>
                    <span className="mp-geo__code">{c.code}</span>
                    <span>
                      <span className="mp-geo__name">{c.name}</span>
                      <span className="mp-geo__note">{c.note}</span>
                    </span>
                    <span className="mp-geo__coords">{c.coords}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
