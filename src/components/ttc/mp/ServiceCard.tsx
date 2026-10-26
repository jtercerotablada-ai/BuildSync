'use client';

import React from 'react';
import Link from 'next/link';
import { imagery, type Service } from '@/lib/ttc/site';
import type { SiteContent } from '@/lib/ttc/content';
import { Img } from './media';
import { Reveal } from './primitives';
import { Arrow, Diamond } from './home/glyphs';
import { useContent, useL } from './lang';

type Svc = SiteContent['services'][number] | Service;

/**
 * "Details" stays where it was pressed: the page scrolls by what the control
 * moved, in the same task, before anything is painted (a card that opens
 * above the fold would otherwise push its own summary down the screen). A
 * keyboard Enter or Space on a summary is a click too.
 */
function keepInPlace(e: React.MouseEvent<HTMLElement>) {
  const summary = e.currentTarget;
  const details = summary.parentElement;
  if (!(details instanceof HTMLDetailsElement)) return;
  e.preventDefault();
  const before = summary.getBoundingClientRect().top;
  details.open = !details.open;
  const moved = summary.getBoundingClientRect().top - before;
  if (Math.abs(moved) >= 0.5) window.scrollBy({ top: moved, behavior: 'instant' });
}

/**
 * One service on /services, as THE HOME'S CARD (HomeServices.tsx; the owner,
 * 2026-10-26: "esas imágenes del services horrible… tiene que ser claro,
 * lindo", the home being his standard): the photograph at 3/2, the track
 * tag, the service's name as the link, one line, the ring. The small
 * thumbnail row it replaces (a 9rem picture beside four lines of small
 * print) is gone.
 *
 * Under the home's card, what the home's card does not need: the first step
 * in the reader's terms (`service.card.next`), the quiet link that takes it
 * (the proposal form with this service preselected; a county program's own
 * label names the notice) and the fold with the three other answers — when
 * you need it, what is included, what you receive — closed by default and
 * still in the server HTML (each card line is printed on /services once,
 * shared-text.test.ts, and a crawler reads them).
 *
 * THE LINK IS THE TITLE AND THE WHOLE CARD IS THE TARGET: the title's `<a>`
 * stretches its `::after` over the card (home.css, `.h-card__link::after`).
 * The foot sits ABOVE that layer (dark.css, `.h-svc__foot`), so its own
 * link and the fold's summary can be pressed; nothing else in the card is a
 * link, and the photograph is `aria-hidden` with its alt in the catalogue.
 */
export function ServiceCard({ service, track }: { service: Svc; index?: number; track: string }) {
  const c = useContent();
  const l = useL();
  const u = c.ui;
  const href = l(`/services/${service.slug}`);
  // The slug, not a label: ContactForm maps it to this language's option.
  const contactHref = l(`/contact?service=${service.slug}`);

  return (
    <article className="h-card h-svc" style={{ '--ar': '3 / 2' } as React.CSSProperties}>
      <Reveal fx="img" className="h-ph">
        <div className="h-ph__in">
          <Img photo={imagery.services[service.slug]} sizes="(min-width: 900px) 44vw, 92vw" />
        </div>
      </Reveal>
      <div className="h-card__meta">
        <p className="h-track">
          <Diamond />
          {track}
        </p>
        <h3 className="h-card__title">
          <Link className="h-card__link" href={href}>
            {service.title}
          </Link>
        </h3>
        <p className="h-card__line">{service.summary}</p>
        <span className="h-ring" aria-hidden="true">
          <Arrow up />
        </span>
      </div>

      <div className="h-svc__foot">
        {/* The first step, in the reader's terms ("a photo from your phone
            will do"), right above the link that takes it. */}
        <p className="h-svc__step">{service.card.next}</p>
        {/* A county program's own label already names what to send and
            where ("Send the Miami-Dade Notice"). The generic one repeats on
            four cards, so it carries a hidden suffix that names the service
            in a screen reader's list of links. */}
        <Link href={contactHref} className="h-link">
          <span>
            {service.program ? (
              service.program.cta
            ) : (
              <>
                {u.requestProposal}
                <span className="mp-sr-only">: {service.title}</span>
              </>
            )}
          </span>
          <Arrow />
        </Link>
        <details className="h-fold">
          <summary className="h-fold__sum" onClick={keepInPlace}>
            <span>
              {c.servicesPage.cardMore}
              <span className="mp-sr-only">: {service.title}</span>
            </span>
            <span className="h-fold__plus" aria-hidden="true" />
          </summary>
          <dl className="h-fold__qa">
            <div>
              <dt>{u.whenYouNeedIt}</dt>
              <dd>{service.card.when}</dd>
            </div>
            <div>
              <dt>{u.whatsIncluded}</dt>
              {/* A no-break space before each dot, so a line never opens
                  with "·". */}
              <dd>{service.capabilities.join(' · ')}</dd>
            </div>
            <div>
              <dt>{u.whatYouReceive}</dt>
              <dd>{service.card.receive}</dd>
            </div>
          </dl>
        </details>
      </div>
    </article>
  );
}
