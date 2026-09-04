'use client';

import React from 'react';
import { closingCta, contact } from '@/lib/ttc/site';
import {
  AnimatedLine,
  ButtonLink,
  DarkHeroSentinel,
  Reveal,
  RevealText,
  SectionHeading,
} from './primitives';

/**
 * Closing band. Flat graphite, one headline, two buttons, one gold rule — the
 * same language as the hero so the page closes where it opened.
 *
 * `asHero` is used on the Contact page, where this band sits directly under
 * the header and therefore needs to register as a dark hero.
 */
export function ContactCTA({
  n = '07',
  asHero = false,
}: {
  n?: string;
  asHero?: boolean;
}) {
  return (
    <section
      className="mp-section mp-section--lg mp-surface--graphite mp-close"
      aria-labelledby="mp-close-title"
    >
      <div className="mp-shell mp-close__inner">
        <SectionHeading n={n} label="Start" />

        <RevealText
          as="h2"
          className="mp-close__title"
          lines={[
            closingCta.line1,
            <React.Fragment key="l2">
              We’ll carry the{' '}
              <span className="mp-serif">responsibility.</span>
            </React.Fragment>,
          ]}
        />
        <span id="mp-close-title" className="mp-form__hp">
          {closingCta.line1} {closingCta.line2}
        </span>

        <Reveal delay={0.12}>
          <p className="mp-close__body">{closingCta.body}</p>
        </Reveal>

        <Reveal delay={0.18} className="mp-cta-row">
          <ButtonLink href={closingCta.primary.href} variant="solid">
            {closingCta.primary.label}
          </ButtonLink>
          <ButtonLink href={closingCta.secondary.href} variant="line">
            {closingCta.secondary.label}
          </ButtonLink>
        </Reveal>

        <AnimatedLine className="mp-rule mp-close__rule" delay={0.2} />
        <div className="mp-close__meta">
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
          <span>{contact.serviceAreaLabel}</span>
        </div>
      </div>
      {asHero ? <DarkHeroSentinel /> : null}
    </section>
  );
}
