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
 *
 * `secondary` overrides the second button for a page where the default
 * target is the page itself — /about must not close with "Meet the engineer"
 * pointing back up to its own #engineer section.
 *
 * The section is named by its real headline (RevealText's `id`), not by a
 * visually hidden copy of it, so screen readers hear the title once.
 */
export function ContactCTA({
  n = '07',
  asHero = false,
  secondary,
}: {
  n?: string;
  asHero?: boolean;
  /** Canonical (English) href; localised here like the defaults. */
  secondary?: { href: string; label: string };
}) {
  const c = useContent();
  const l = useL();
  const k = c.closingCta;
  const second = secondary ?? k.secondary;
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
          id="mp-close-title"
          className="mp-close__title"
          lines={accentLines(k.titleLines, k.accentWord)}
        />

        <Reveal delay={0.08}>
          <p className="mp-close__body">{k.body}</p>
        </Reveal>

        <Reveal delay={0.12} className="mp-cta-row">
          <ButtonLink href={l(k.primary.href)} variant="solid">
            {k.primary.label}
          </ButtonLink>
          <ButtonLink href={l(second.href)} variant="line">
            {second.label}
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
