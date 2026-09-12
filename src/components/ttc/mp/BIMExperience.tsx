'use client';

import React from 'react';
import { imagery } from '@/lib/ttc/site';
import { VideoLoop } from './media';
import { ButtonLink, Reveal, SectionHeading } from './primitives';
import { useContent, useL } from './lang';

/**
 * BIM is shown, not listed — with a model rather than a drawing of one. The
 * clip is a structure assembling floor plate by floor plate: the one thing on
 * this site a camera cannot be pointed at.
 */
export function BIMExperience({ n = '05' }: { n?: string }) {
  const c = useContent();
  const l = useL();
  const b = c.bim;
  return (
    <section
      className="mp-section mp-section--lg mp-surface--graphite"
      aria-labelledby="mp-bim-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={b.eyebrow} />

        <div className="mp-bim__grid">
          <div>
            <Reveal>
              <h2 id="mp-bim-title" className="mp-bim__title">
                {b.title}
              </h2>
            </Reveal>
            <Reveal delay={0.06}>
              <p className="mp-bim__body">{b.body}</p>
            </Reveal>
            <Reveal delay={0.1}>
              <ul className="mp-bim__notes">
                {b.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </Reveal>
            <div className="mp-cta-row">
              <ButtonLink href={l(b.cta.href)} variant="line">
                {b.cta.label}
              </ButtonLink>
            </div>
          </div>

          <Reveal delay={0.08}>
            <div className="mp-bim__stage">
              <VideoLoop clip={imagery.clips.bim} className="mp-bim__clip" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
