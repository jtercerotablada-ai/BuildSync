'use client';

import React from 'react';
import { imagery, serviceArea } from '@/lib/ttc/site';
import { Img } from './media';
import { Reveal, SectionHeading } from './primitives';

/**
 * Service area — the territory, photographed from the air, beside the two
 * counties the practice works in. The county codes and coordinates that used
 * to annotate the list were drawing-set decoration; a client reads "Miami-Dade
 * County · High-Velocity Hurricane Zone" and has everything the plate said.
 */
export function SouthFloridaMap({ n = '06' }: { n?: string }) {
  return (
    <section
      className="mp-section mp-section--lg mp-surface--paper"
      aria-labelledby="mp-geo-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={serviceArea.eyebrow} />

        <div className="mp-geo__grid">
          <Reveal>
            <div className="mp-geo__photo">
              <Img
                photo={imagery.sections.southFlorida}
                sizes="(max-width: 1180px) 100vw, 50vw"
              />
            </div>
          </Reveal>

          <div className="mp-geo__copy">
            <Reveal delay={0.06}>
              <h2 id="mp-geo-title" className="mp-h2">
                {serviceArea.title}
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mp-lead mp-geo__body">{serviceArea.body}</p>
            </Reveal>

            <Reveal delay={0.14}>
              <ul className="mp-geo__counties">
                {serviceArea.counties.map((c) => (
                  <li key={c.code}>
                    <span className="mp-geo__name">{c.name}</span>
                    <span className="mp-geo__note">{c.note}</span>
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
