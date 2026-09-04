import React from 'react';
import { bim, imagery } from '@/lib/ttc/site';
import { VideoLoop } from './media';
import { ButtonLink, Reveal, SectionHeading } from './primitives';

/**
 * BIM is shown, not listed — and shown with a model rather than a drawing of
 * one. The clip is a structure assembling floor plate by floor plate: the one
 * thing on this site a camera cannot be pointed at.
 *
 * Plain server component; `VideoLoop` carries the only client code, and its
 * poster is what a reduced-motion visitor gets.
 */
export function BIMExperience({ n = '03' }: { n?: string }) {
  return (
    <section
      className="mp-section mp-section--lg mp-surface--graphite"
      aria-labelledby="mp-bim-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={bim.eyebrow} />

        <div className="mp-bim__grid">
          <div>
            <Reveal>
              <h2 id="mp-bim-title" className="mp-bim__title">
                {bim.title}
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="mp-bim__body">{bim.body}</p>
            </Reveal>

            <Reveal delay={0.14}>
              <ul className="mp-bim__notes">
                {bim.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </Reveal>

            <div className="mp-cta-row">
              <ButtonLink href="/services/bim-coordination" variant="line">
                BIM coordination in detail
              </ButtonLink>
            </div>
          </div>

          <Reveal delay={0.1}>
            <div className="mp-bim__stage">
              <VideoLoop clip={imagery.clips.bim} className="mp-bim__clip" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
