'use client';

import React from 'react';
import {
  AnimatedLine,
  ButtonLink,
  DarkHeroSentinel,
  Reveal,
  RevealText,
  SectionHeading,
} from './primitives';
import { accentLines } from './text';
import { useContent, useL } from './lang';

/**
 * Closing band. Flat graphite over the plan grid, one headline, two buttons,
 * one gold rule — the same language as the hero so the page closes where it
 * opened. `asHero` registers it as a dark hero when it sits under the header.
 */
export function ContactCTA({
  n = '07',
  asHero = false,
}: {
  n?: string;
  asHero?: boolean;
}) {
  const c = useContent();
  const l = useL();
  const k = c.closingCta;
  return (
    <section
      className="mp-section mp-section--lg mp-surface--graphite mp-close"
      aria-labelledby="mp-close-title"
    >
      <div className="mp-grid-bg" aria-hidden="true" />
      <div className="mp-shell mp-close__inner">
        <SectionHeading n={n} label={k.eyebrow} />

        <RevealText
          as="h2"
          className="mp-close__title"
          lines={accentLines(k.titleLines, k.accentWord)}
        />
        <span id="mp-close-title" className="mp-form__hp">
          {k.plainTitle}
        </span>

        <Reveal delay={0.08}>
          <p className="mp-close__body">{k.body}</p>
        </Reveal>

        <Reveal delay={0.12} className="mp-cta-row">
          <ButtonLink href={l(k.primary.href)} variant="solid">
            {k.primary.label}
          </ButtonLink>
          <ButtonLink href={l(k.secondary.href)} variant="line">
            {k.secondary.label}
          </ButtonLink>
        </Reveal>

        <AnimatedLine className="mp-rule mp-close__rule" delay={0.14} />
        <div className="mp-close__meta">
          <a href={`mailto:${c.contact.email}`}>{c.contact.email}</a>
          <span>{c.contact.serviceAreaLabel}</span>
        </div>
      </div>
      {asHero ? <DarkHeroSentinel /> : null}
    </section>
  );
}
