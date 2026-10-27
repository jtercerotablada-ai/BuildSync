import React from 'react';
import { getContent } from '@/lib/ttc/content';
import type { Lang } from '@/lib/ttc/i18n';
import { Reveal } from '../primitives';

/**
 * The program's clock: its numbers, large, on one gold hairline — the four a
 * board asks first (when it is due, how often, how long to file, how long to
 * repair; on the threshold page, what makes a building one). The big firms
 * print a band of their own counts here; this firm prints the OWNER's numbers
 * instead, and every one of them is the program's verified row said again
 * (`serviceClock` in site.ts; service-clock.test.ts holds each number to the
 * rows, so the band cannot drift from them).
 *
 * Typographic, not drawn (the owner rejects line art): a huge sans numeral,
 * its unit in the italic serif, a mono caption under it, and the exception
 * in the reading grey. No heading — the program pages sit at their ceiling
 * of 23, and the rows under "When it applies" carry the section; the band is
 * named by its label for assistive tech.
 *
 * A SERVER component.
 */
export function ServiceClock({ lang, slug }: { lang: Lang; slug: string }) {
  const c = getContent(lang);
  const k = c.serviceClock[slug];
  if (!k) return null;

  return (
    <section className="h-plate mp-surface--graphite h-clock" aria-label={k.label}>
      <div className="h-wrap">
        <Reveal as="p" fx="up" className="h-label">
          {k.label}
        </Reveal>
        <ol className="h-clock__line">
          {k.items.map((it, i) => (
            <Reveal as="li" fx="up" delay={i * 0.08} key={`${it.n}-${it.k}`} className="h-clock__item">
              <p className="h-clock__n">
                <span className="h-clock__num">{it.n}</span>{' '}
                <span className="h-clock__unit mp-serif">{it.unit}</span>
              </p>
              <p className="h-clock__k">{it.k}</p>
              {it.sub ? <p className="h-clock__sub">{it.sub}</p> : null}
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
