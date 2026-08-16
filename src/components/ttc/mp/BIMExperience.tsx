import React from 'react';
import { bim, imagery } from '@/lib/ttc/site';
import { VideoLoop } from './media';
import {
  AnimatedLine,
  ButtonLink,
  Reveal,
  SectionHeading,
} from './primitives';

/**
 * BIM is shown, not listed — and shown with a model rather than a drawing of
 * one.
 *
 * This section used to hold an inline SVG wireframe with six layer toggles and
 * a wireframe/solid switch. It is gone for the same reason the line-art was
 * taken off the service cards: a diagram an engineer drew of a model is not a
 * model. It read as thin next to photography of real structure, and the
 * interactivity was demonstrating the drawing, not the practice.
 *
 * The clip is the thing itself — a structure assembling floor plate by floor
 * plate. Nothing left to toggle, no state to hold, so this is a plain server
 * component now; `VideoLoop` carries the only client code, and its poster is
 * what a reduced-motion visitor gets.
 */
export function BIMExperience({ n = '04' }: { n?: string }) {
  return (
    <section
      className="mp-section mp-section--lg mp-surface--graphite mp-grain"
      aria-labelledby="mp-bim-title"
      style={{ position: 'relative' }}
    >
      <div className="mp-shell" style={{ position: 'relative', zIndex: 1 }}>
        <SectionHeading n={n} label={bim.eyebrow} meta="Coordination" />

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
            <AnimatedLine delay={0.2} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
