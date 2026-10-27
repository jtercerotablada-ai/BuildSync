import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { Reveal } from '../primitives';

/**
 * What clients say about this service (2026-10-27): the owner's reviews,
 * word for word, each under the client's first name and initial
 * (`serviceReviews[slug]` in site.ts says where they come from). A
 * quotation in a <blockquote>, its author in the <figcaption>. The only
 * place on a page where a person of the firm may be named: in a client's
 * own words (the owner, 2026-10-27).
 *
 * No heading: the county-program pages sit at their ceiling of 23; the band
 * is named by its label. No stars, no rating, no Review markup. On a county
 * program it follows the fee; on the others, the steps.
 *
 * A SERVER component.
 */
export function ServiceReviews({ lang, slug, surface }: { lang: Lang; slug: string; surface: string }) {
  const c = getContent(lang);
  const r = c.serviceReviews[slug];
  if (!r?.items.length) return null;

  return (
    <section className={`h-plate ${surface} h-rev`} aria-label={r.label}>
      <div className="h-wrap">
        <Reveal as="p" fx="up" className="h-label">
          {r.label}
        </Reveal>
        <ul className="h-rev__list" data-count={r.items.length}>
          {r.items.map((it, i) => (
            <Reveal as="li" fx="up" delay={i * 0.06} key={it.name} className="h-rev__item">
              <figure className="h-rev__fig">
                <blockquote className="h-rev__q">
                  <p>{it.quote}</p>
                </blockquote>
                <figcaption className="h-rev__by">{it.name}</figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
        {r.note ? <p className="h-rev__note">{r.note}</p> : null}
      </div>
    </section>
  );
}
