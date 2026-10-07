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
 * One service, in the client's terms: photograph, name, one-line summary and
 * the four questions every client asks — when do I need this, what does it
 * include, what do I get, what do I do next. Compact on the index pages;
 * the detail page carries the full lists.
 *
 * EVERY LINE ON THE CARD IS THE CARD'S OWN. Three of the four answers used
 * to be the first item of a list the service's page prints in full
 * (`when[0]`, `deliverables[0]`) or its whole "Next step" paragraph, and the
 * summary was that page's first line: each service was told twice in the
 * same words. The card now reads `service.card` (site.ts), the page keeps
 * its lists, and its first line is `heroSub`. The card is rendered on
 * /services only — /existing-buildings has its own (SituationCard).
 *
 * "Next step" ends in the step itself: a link to the proposal form with this
 * service preselected. The row used to tell the reader to "send the notice"
 * with nothing to tap, and the card's only link went to more reading.
 *
 * THE PHOTOGRAPH IS NOT A LINK OF ITS OWN. It used to be wrapped in a second
 * <a> to the service page, hidden from screen readers and out of the Tab
 * order — an image link with no text at all, which is how a crawler read it.
 * The title's link now reaches over the photograph instead (its `::after`,
 * mp.css `.mp-svc__title a::after`): a click on the picture still opens the
 * page, and the page is linked by its name. Only the photograph is covered —
 * the text and the two links under it stay selectable and tappable.
 */
export function ServiceCard({
  service,
  index,
  compact = false,
}: {
  service: Svc;
  index?: number;
  compact?: boolean;
}) {
  const c = useContent();
  const l = useL();
  const u = c.ui;
  const href = l(`/services/${service.slug}`);
  // The slug, not a label: ContactForm maps it to this language's option.
  const contactHref = l(`/contact?service=${service.slug}`);

  return (
    <Reveal as="div" delay={((index ?? 0) % 3) * 0.05} className="mp-svc">
      <div className="mp-svc__media">
        <Img
          photo={imagery.services[service.slug]}
          sizes="(max-width: 900px) 100vw, 50vw"
        />
      </div>
      <div className="mp-svc__body">
        <p className="mp-svc__track">
          <span className="mp-secnum">{service.n}</span>
          {service.track === 'new' ? u.newProjects : u.existingBuildings}
        </p>
        <h3 className="mp-svc__title">
          <Link href={href}>{service.title}</Link>
        </h3>
        <p className="mp-svc__summary">{service.summary}</p>

        {!compact ? (
          <dl className="mp-svc__qa">
            <div>
              <dt>{u.whenYouNeedIt}</dt>
              <dd>{service.card.when}</dd>
            </div>
            <div>
              <dt>{u.whatsIncluded}</dt>
              <dd>{service.capabilities.join(' · ')}</dd>
            </div>
            <div>
              <dt>{u.whatYouReceive}</dt>
              <dd>{service.card.receive}</dd>
            </div>
            <div>
              <dt>{u.nextStep}</dt>
              <dd>
                {service.card.next}
                {/* A county program's own label already names what to send
                    and where ("Send the Miami-Dade Notice"). The generic one
                    repeats on every other card, so it gets the same hidden
                    suffix as "See this service" below. */}
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
              </dd>
            </div>
          </dl>
        ) : null}

        {/* Eight "See this service" links on /services are indistinguishable
            in a screen reader's link list; the hidden suffix names each one
            without changing what a sighted visitor sees. */}
        <Link href={href} className="mp-link mp-svc__go">
          {u.exploreService}
          <span className="mp-sr-only">: {service.title}</span> <i aria-hidden="true">→</i>
        </Link>
      </div>
    </Reveal>
  );
}
