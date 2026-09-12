'use client';

import React from 'react';
import { imagery } from '@/lib/ttc/site';
import { Img } from './media';
import { Reveal, SectionHeading } from './primitives';
import { useContent } from './lang';

/** Service area — the territory from the air beside the two counties. */
export function SouthFloridaMap({ n = '06' }: { n?: string }) {
  const c = useContent();
  const a = c.serviceArea;
  return (
    <section
      className="mp-section mp-section--lg mp-surface--paper"
      aria-labelledby="mp-geo-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={a.eyebrow} />

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
            <Reveal delay={0.05}>
              <h2 id="mp-geo-title" className="mp-h2">
                {a.title}
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="mp-lead mp-geo__body">{a.body}</p>
            </Reveal>
            <Reveal delay={0.11}>
              <ul className="mp-geo__counties">
                {a.counties.map((co) => (
                  <li key={co.code}>
                    <span className="mp-geo__name">{co.name}</span>
                    <span className="mp-geo__note">{co.note}</span>
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
