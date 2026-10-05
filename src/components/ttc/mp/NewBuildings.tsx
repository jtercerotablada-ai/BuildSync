'use client';

import React from 'react';
import Link from 'next/link';
import { imagery } from '@/lib/ttc/site';
import { MotionToggle, VideoLoop } from './media';
import { ButtonLink, Reveal, SectionHeading } from './primitives';
import { accent } from './text';
import { useContent, useL } from './lang';

/**
 * The design side of the practice, in one section of the home page.
 *
 * It replaced three: the "I am building something new" door, the six-photo
 * typology grid (now on /services) and the BIM stage. One paragraph says what
 * gets designed, how it is coordinated and what is issued; the four
 * new-project services are listed as links, read straight from the `services`
 * array so the list can never disagree with /services; and the model clip
 * stays, because it is the one thing on this site a camera cannot be pointed
 * at — a structure assembling floor plate by floor plate.
 *
 * `id="new-buildings"` is the target of the hero strip's last link. If the id
 * changes, change `hero.caps` in site.ts and site.es.ts with it.
 *
 * The clip loops for as long as the section is on screen, so the stage
 * carries a pause control in its corner (WCAG 2.2.2) — the same shared switch
 * as the hero's.
 */
export function NewBuildings({ n = '03' }: { n?: string }) {
  const c = useContent();
  const l = useL();
  const b = c.newBuildings;
  const services = c.services.filter((s) => s.track === 'new');

  return (
    <section
      id="new-buildings"
      className="mp-section mp-section--lg mp-surface--graphite"
      aria-labelledby="mp-newb-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={b.eyebrow} />

        <div className="mp-bim__grid">
          <div>
            <Reveal>
              <h2 id="mp-newb-title" className="mp-bim__title">
                {accent(b.title, b.accentWord)}
              </h2>
            </Reveal>
            <Reveal delay={0.06}>
              <p className="mp-bim__body">{b.body}</p>
            </Reveal>
            <Reveal delay={0.1}>
              <ul className="mp-linklist">
                {services.map((s) => (
                  <li key={s.slug}>
                    <Link href={l(`/services/${s.slug}`)}>
                      <span>{s.title}</span>
                      <i aria-hidden="true">→</i>
                    </Link>
                  </li>
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
              <MotionToggle className="mp-bim__toggle" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
