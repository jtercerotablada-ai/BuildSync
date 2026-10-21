'use client';

import React from 'react';
import { ButtonLink, DarkHeroSentinel, Reveal, RevealText, TextLink } from './primitives';
import { accentLines } from './text';
import { useContent, useL } from './lang';
import { ReachRow } from './ReachRow';

/**
 * Closing band. Flat graphite over the plan grid: one row, the statement on
 * the left, the one action on the right — the same language as the hero so
 * the page closes where it opened. `asHero` registers it as a dark hero when
 * it sits under the header.
 *
 * No section number: it is not a section of the page's argument, it is the
 * way out of it. The eyebrow is a <div>, not a <p>: on the two county
 * programs "Next step" is already a paragraph (the callout's label), and the
 * page's paragraphs are counted for repeats. No email and service-area line
 * either — the footer prints both right below.
 *
 * Two flat children, and never a nested <section>: the tests cut the band
 * out of a page with a lazy match up to its first </section>.
 *
 * `secondary` overrides the second link for a page where the default
 * target is the page itself — /about must not close with "Meet the engineer"
 * pointing back up to its own #engineer section. It is a text link, so the
 * primary button is the band's one button.
 *
 * `service` is the slug of the service page this band closes. The primary
 * button then opens the form with that service already selected, like every
 * other button on that page — it used to drop the preset on the last screen.
 *
 * `assure` is the line beside the Call and WhatsApp links: the proposal is
 * free, and a reply usually comes within two hours. This band says it on
 * every page — except a page that has said it already. The two county
 * programs print it under their deadline, beside the button there, and pass
 * `assure={false}`: said again here it was one paragraph twice on a page.
 * The links themselves stay. On a phone (≤900px, where the fixed bar carries
 * Call and WhatsApp) mp.css hides the links here; they stay in the HTML.
 *
 * The section is named by its real headline (RevealText's `id`), not by a
 * visually hidden copy of it, so screen readers hear the title once.
 */
export function ContactCTA({
  asHero = false,
  secondary,
  service,
  assure = true,
  notice = true,
}: {
  asHero?: boolean;
  /** False where the page above already printed the free-proposal line. */
  assure?: boolean;
  /** False on a page whose reader holds no notice (a new building, /about,
      /projects, /services): WhatsApp says "Message us", not "Send the
      notice", and the chat opens without "I received a notice". */
  notice?: boolean;
  /** A service slug: the primary button keeps `?service=<slug>`. */
  service?: string;
  /** Canonical (English) href; localised here like the defaults. */
  secondary?: { href: string; label: string };
}) {
  const c = useContent();
  const l = useL();
  const k = c.closingCta;
  const second = secondary ?? k.secondary;
  const primaryHref = service ? `${k.primary.href}?service=${service}` : k.primary.href;
  return (
    <section className="mp-section mp-surface--graphite mp-close" aria-labelledby="mp-close-title">
      <div className="mp-grid-bg" aria-hidden="true" />
      <div className="mp-shell mp-close__inner">
        <div className="mp-close__lead">
          <div className="mp-eyebrow mp-close__eyebrow">{k.eyebrow}</div>

          <RevealText
            as="h2"
            id="mp-close-title"
            className="mp-close__title"
            lines={accentLines(k.titleLines, k.accentWord)}
          />

          <Reveal delay={0.08}>
            <p className="mp-close__body">{k.body}</p>
          </Reveal>
        </div>

        <div className="mp-close__act">
          <Reveal delay={0.12} className="mp-cta-row">
            <ButtonLink href={l(primaryHref)} variant="solid">
              {k.primary.label}
            </ButtonLink>
            <TextLink href={l(second.href)}>{second.label}</TextLink>
          </Reveal>

          {/* The other two ways in, and the two facts next to them: the
              proposal is free and a reply usually comes within two hours —
              unless the page has printed those two facts already (`assure`). */}
          <Reveal delay={0.13}>
            <ReachRow c={c} assure={assure} plain={!notice} className="mp-reach--close" />
          </Reveal>
        </div>
      </div>
      {asHero ? <DarkHeroSentinel /> : null}
    </section>
  );
}
