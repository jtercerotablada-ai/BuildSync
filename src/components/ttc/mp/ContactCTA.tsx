'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { stripLang } from '@/lib/ttc/i18n';
import { pageHoldsNotice } from '@/lib/ttc/notice-pages';
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
 * The two facts of the easy step — the proposal is free, and a reply
 * usually comes within two hours — end the band's own text
 * (`closingCta.body`), at reading size. They were a small grey line under
 * the buttons (`assure`), which the owner's no-small-print rule (October 20,
 * 2026) took out. Under the buttons there are only the Call and WhatsApp
 * links, and on a phone (≤900px, where the fixed bar carries both) mp.css
 * hides them here; they stay in the HTML.
 *
 * `notice`: left out, the band asks pageHoldsNotice (notice-pages.ts) about
 * the page it closes — the phone bar's rule — so the no-letter guide and
 * the assessments page do not say "Send the notice by WhatsApp". A view
 * that passes it (from site.ts `holdsNotice`, or a guide's `heroAction`)
 * overrides the rule; notice-pages.test.ts keeps the two in agreement.
 *
 * The section is named by its real headline (RevealText's `id`), not by a
 * visually hidden copy of it, so screen readers hear the title once.
 */
export function ContactCTA({
  asHero = false,
  secondary,
  service,
  notice,
}: {
  asHero?: boolean;
  /** False on a page whose reader holds no notice: WhatsApp says "Message
      us", not "Send the notice", and the chat opens without "I received a
      notice". Default: pageHoldsNotice of the page's own address. */
  notice?: boolean;
  /** A service slug: the primary button keeps `?service=<slug>`. */
  service?: string;
  /** Canonical (English) href; localised here like the defaults. */
  secondary?: { href: string; label: string };
}) {
  const c = useContent();
  const l = useL();
  const pathname = usePathname();
  const holds = notice ?? pageHoldsNotice(stripLang(pathname ?? '/'));
  const k = c.closingCta;
  const second = secondary ?? k.secondary;
  const primaryHref = service ? `${k.primary.href}?service=${service}` : k.primary.href;
  // On a county program's page (and its city pages, and a guide to one
  // program) the band's button says what every other button there says —
  // "Send the Miami-Dade Notice" — not a generic "Request a Proposal" for
  // the same form with the same program selected.
  const program = service ? c.services.find((s) => s.slug === service)?.program : undefined;
  const primaryLabel = holds && program ? program.cta : k.primary.label;
  return (
    <section className="mp-section mp-surface--graphite mp-close" aria-labelledby="mp-close-title">
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
              {primaryLabel}
            </ButtonLink>
            <TextLink href={l(second.href)}>{second.label}</TextLink>
          </Reveal>

          {/* The other two ways in. Nothing else under the buttons: the two
              facts are the end of the body above. */}
          <Reveal delay={0.13}>
            <ReachRow c={c} plain={!holds} className="mp-reach--close" />
          </Reveal>
        </div>
      </div>
      {asHero ? <DarkHeroSentinel /> : null}
    </section>
  );
}
