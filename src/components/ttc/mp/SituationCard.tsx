'use client';

import React from 'react';
import Link from 'next/link';
import type { SiteContent } from '@/lib/ttc/content';
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
 * A text tile with its own frame (`.mp-sit`), not the service card's: no
 * photograph. The four frames it used to print are the /services cards' and
 * the service pages' heroes, so on this page they were the third showing of
 * each, and a quarter of its height. Two columns, four from 1500px, ruled
 * rows on a phone with the number on the title's line.
 *   • The heading is the SITUATION and is not a link. The link is the
 *     service, by its short name — a link is named for where it goes.
 *   • No "When / What's included / What you receive / Next step" rows.
 *
 * `mp-svc--sit` stays on the root as a hook: shared-text.test.ts finds each
 * tile by it and reads up to the first `</div></div>`, so the tile keeps
 * exactly one inner div.
 *
 * The service is looked up by `slug`, so its name can never drift from
 * /services. An item whose slug matches no service renders nothing rather
 * than a tile with a dead link.
 */
export function SituationCard({ item, index }: { item: Situation; index: number }) {
  const c = useContent();
  const l = useL();
  const service = c.services.find((s) => s.slug === item.slug);
  if (!service) return null;

  return (
    <Reveal as="div" delay={index * 0.04} className="mp-sit mp-svc--sit">
      <div className="mp-sit__body">
        <p className="mp-sit__n">
          <span className="mp-secnum">{String(index + 1).padStart(2, '0')}</span>
        </p>
        <h3 className="mp-sit__title">{item.k}</h3>
        <p className="mp-sit__line">{item.v}</p>
        <Link href={l(`/services/${service.slug}`)} className="mp-link mp-sit__go">
          {service.shortTitle} <i aria-hidden="true">→</i>
        </Link>
      </div>
    </Reveal>
  );
}
