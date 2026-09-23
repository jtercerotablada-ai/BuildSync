'use client';

import React from 'react';
import { imagery } from '@/lib/ttc/site';
import { ButtonLink, DarkHeroSentinel, RevealText } from './primitives';
import { MotionToggle, VideoLoop } from './media';
import { accentLines } from './text';
import { useContent, useL } from './lang';

/**
 * The first screen answers two questions before a word of body copy is read:
 * what we do (the headline) and where (the eyebrow). One primary action, one
 * secondary. WHO is deliberately absent — the engineer is named on About and
 * Contact only, so the hero stays about the practice.
 *
 * The footage is a slow aerial pass over the South Florida waterfront. The
 * scrim is a fixed gradient so legibility never depends on where the bright
 * water happens to be in a given frame. `VideoLoop` paints the poster first
 * and only upgrades to video once the page has loaded; reduced motion keeps
 * the poster, and the toggle in the foot row stops the loop (WCAG 2.2.2).
 *
 * Every entrance here is a CSS keyframe (`mp-enter`, staggered by the
 * `--dN` modifiers), not Motion: this is the whole first screen, and it has
 * to paint from the server HTML without waiting for React. See primitives.tsx.
 */
export function Hero() {
  const c = useContent();
  const l = useL();
  const h = c.hero;

  return (
    <section className="mp-hero mp-surface--graphite" aria-labelledby="mp-hero-title">
      <div className="mp-hero__bg" aria-hidden="true" />
      <div className="mp-grid-bg" aria-hidden="true" />
      <div className="mp-hero__photo mp-enter mp-enter--photo" aria-hidden="true">
        <VideoLoop clip={imagery.hero} priority />
      </div>

      <div className="mp-shell mp-hero__body">
        <div className="mp-hero__col">
          <p className="mp-eyebrow mp-hero__eyebrow mp-enter mp-enter--d1">{h.eyebrow}</p>

          <RevealText
            as="h1"
            id="mp-hero-title"
            className="mp-hero__title"
            animateOnMount
            delay={0.1}
            lines={accentLines(h.titleLines, h.accentWord)}
          />

          <p className="mp-hero__sub mp-enter mp-enter--d4">{h.sub}</p>

          <div className="mp-cta-row mp-enter mp-enter--d5">
            <ButtonLink href={l(h.primary.href)} variant="solid">
              {h.primary.label}
            </ButtonLink>
            <ButtonLink href={l(h.secondary.href)} variant="line" arrow={false}>
              {h.secondary.label}
            </ButtonLink>
          </div>
        </div>
      </div>

      <div className="mp-hero__foot">
        <div className="mp-shell mp-hero__footrow mp-enter mp-enter--d6">
          <ul className="mp-hero__caps">
            {h.caps.map((cap) => (
              <li key={cap}>{cap}</li>
            ))}
          </ul>
          <MotionToggle />
        </div>
      </div>

      <DarkHeroSentinel />
    </section>
  );
}
