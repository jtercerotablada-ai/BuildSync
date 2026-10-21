'use client';

import React from 'react';
import Link from 'next/link';
import { imagery, type Service } from '@/lib/ttc/site';
import type { SiteContent } from '@/lib/ttc/content';
import { Img } from './media';
import { Reveal } from './primitives';
import { useContent, useL } from './lang';

type Svc = SiteContent['services'][number] | Service;

/**
 * "Details" stays where it was pressed. While one row is open the two
 * columns stop sharing row heights (mp.css, `.mp-tracks:has(...)`), so a
 * row whose rows above had been stretched by the column beside it moves up
 * when it opens — the last rows of New projects, 121px at 1440 in English
 * and 218px in Spanish (2026-10-20) — and back down when it closes. The
 * page scrolls by what the control moved, in the same task, before anything
 * is painted. A keyboard Enter or Space on a summary is a click too.
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
 * One service as a row of the /services index: a small photograph, the name
 * (the link to the service's page), one line on what it is, the first step
 * in the client's terms and the link that takes it. The service's page
 * carries the full lists; this row is how a reader finds the right one.
 *
 * ONE LINK PER ACTION. The row used to end in a "See This Service" link
 * under a title that already opened the same page, on all eight cards. The
 * title is the only way to the page now, and the row's other link is the
 * step: the proposal form with this service preselected.
 *
 * THE THREE OTHER ANSWERS ARE IN A <details>. "When you need it", "What's
 * included" and "What you receive" were four ruled rows of small print on
 * every card, half of each card's height. They are one tap away, closed by
 * default, and still in the server HTML: each card line is printed on
 * /services once (shared-text.test.ts), and a crawler reads them.
 *
 * EVERY LINE ON THE ROW IS THE ROW'S OWN. The summary and `service.card`
 * (site.ts) are written for this page and printed nowhere else; the
 * service's page has its own first line (`heroSub`) and its own lists. The
 * row is rendered on /services only — /existing-buildings has its own card
 * (SituationCard), which shares the base `.mp-svc` frame.
 *
 * THE PHOTOGRAPH IS NOT A LINK OF ITS OWN. The title's link reaches over it
 * (its `::after`, mp.css `.mp-svc__title a::after`): a click on
 * the picture still opens the page, and the page is linked by its name. The
 * arrow after the title is CSS, so the heading's text stays the name.
 */
export function ServiceCard({ service, index }: { service: Svc; index?: number }) {
  const c = useContent();
  const l = useL();
  const u = c.ui;
  const href = l(`/services/${service.slug}`);
  // The slug, not a label: ContactForm maps it to this language's option.
  const contactHref = l(`/contact?service=${service.slug}`);

  return (
    <Reveal as="div" delay={((index ?? 0) % 4) * 0.05} className="mp-svc mp-svc--row">
      <div className="mp-svc__media">
        {/* A thumbnail: 9rem wide, 6rem on a phone and in the narrower
            two-column widths (mp.css). The smallest rendition in the srcset
            is 900w, so even a retina screen no longer pulls the 2000w
            master that "50vw" asked for. */}
        <Img photo={imagery.services[service.slug]} sizes="(max-width: 720px) 96px, 144px" />
      </div>
      <div className="mp-svc__body">
        <h3 className="mp-svc__title">
          <Link href={href}>{service.title}</Link>
        </h3>
        <p className="mp-svc__summary">{service.summary}</p>
        {/* The first step, in the reader's terms ("a photo from your phone
            will do"), right above the link that takes it. */}
        <p className="mp-svc__step">{service.card.next}</p>
        {/* A county program's own label already names what to send and
            where ("Send the Miami-Dade Notice"). The generic one repeats on
            six rows, so it carries a hidden suffix that names the service
            in a screen reader's list of links. */}
        <Link href={contactHref} className="mp-link mp-svc__next">
          {service.program ? (
            service.program.cta
          ) : (
            <>
              {u.requestProposal}
              <span className="mp-sr-only">: {service.title}</span>
            </>
          )}{' '}
          <i aria-hidden="true">→</i>
        </Link>
        <details className="mp-svc__more">
          <summary className="mp-svc__toggle" onClick={keepInPlace}>
            {c.servicesPage.cardMore}
            <span className="mp-sr-only">: {service.title}</span>
          </summary>
          <dl className="mp-svc__qa">
            <div>
              <dt>{u.whenYouNeedIt}</dt>
              <dd>{service.card.when}</dd>
            </div>
            <div>
              <dt>{u.whatsIncluded}</dt>
              {/* A no-break space before each dot, so a line never opens
                  with "·". */}
              <dd>{service.capabilities.join(' · ')}</dd>
            </div>
            <div>
              <dt>{u.whatYouReceive}</dt>
              <dd>{service.card.receive}</dd>
            </div>
          </dl>
        </details>
      </div>
    </Reveal>
  );
}
