'use client';

import React from 'react';
import { serviceArea } from '@/lib/ttc/site';
import { SouthFloridaPlate } from './art';
import { Reveal, SectionHeading } from './primitives';

/**
 * Service-area plate. Deliberately a schematic plan diagram rather than a
 * cartographic map: it reads as a drawing, carries real coordinates, and does
 * not pretend to a geographic precision it does not have. Labelled as such.
 */
export function SouthFloridaMap({ n = '10' }: { n?: string }) {
  return (
    <section
      className="mp-section mp-section--lg mp-surface--concrete"
      aria-labelledby="mp-geo-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={serviceArea.eyebrow} meta="Plan diagram" />

        <div className="mp-geo__grid">
          <Reveal>
            <div className="mp-geo__plate mp-frame">
              <SouthFloridaPlate />
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
