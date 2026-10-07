'use client';

import React from 'react';
import Link from 'next/link';
import { imagery } from '@/lib/ttc/site';
import type { SiteContent } from '@/lib/ttc/content';
import { Img } from './media';
import { Reveal } from './primitives';
import { useContent, useL } from './lang';

type Situation = SiteContent['existingPage']['triggers']['items'][number];

/**
 * One situation on /existing-buildings, and the door out of it: what
 * happened, in the reader's words; a line written for that page; and one
 * link, to the service that answers it.
 *
 * It takes the place of the full service card on that page. The four cards
 * there were the four cards /services prints, sentence for sentence, so the
 * two pages were the same reading twice. /services keeps the full card
 * (ServiceCard); this one says less and starts from the other end — the
 * reader's situation first, the service's name last.
 *
 * The frame is the service card's (`.mp-svc`, same photograph, same grid),
 * so the two pages still look like one site. Three things differ:
 *   • The heading is the SITUATION and is not a link. The link is the
 *     service, by its short name — a link is named for where it goes.
 *   • The photograph is not clickable: on the service card the title's link
 *     reaches over it, and here the title is not a link.
 *   • No "When / What's included / What you receive / Next step" rows.
 *
 * The service is looked up by `slug`, so its name and its photograph can
 * never drift from /services. An item whose slug matches no service renders
 * nothing rather than a card with a dead link.
 */
export function SituationCard({ item, index }: { item: Situation; index: number }) {
  const c = useContent();
  const l = useL();
  const service = c.services.find((s) => s.slug === item.slug);
  if (!service) return null;

  return (
    <Reveal as="div" delay={(index % 2) * 0.05} className="mp-svc mp-svc--sit">
      <div className="mp-svc__media">
        <Img photo={imagery.services[service.slug]} sizes="(max-width: 900px) 100vw, 50vw" />
      </div>
      <div className="mp-svc__body">
        <p className="mp-svc__track">
          <span className="mp-secnum">{String(index + 1).padStart(2, '0')}</span>
        </p>
        <h3 className="mp-svc__title">{item.k}</h3>
        <p className="mp-svc__summary">{item.v}</p>
        <Link href={l(`/services/${service.slug}`)} className="mp-link mp-svc__go">
          {service.shortTitle} <i aria-hidden="true">→</i>
        </Link>
      </div>
    </Reveal>
  );
}
