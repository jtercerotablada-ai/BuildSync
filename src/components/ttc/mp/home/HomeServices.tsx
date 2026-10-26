import React from 'react';
import Link from 'next/link';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { imagery } from '@/lib/ttc/site';
import { Img } from '../media';
import { Reveal } from '../primitives';
import { Arrow, Diamond } from './glyphs';
import { Words } from './Words';

/**
 * S3 · SERVICES. "Six services. One standard." The index of what the firm
 * does: each card is one photograph, a track tag, the service's title and one
 * plain line. A SERVER component.
 *
 * THE ORDER IS `home.order`, ALTERNATING new / existing, and nothing is a
 * lead: Miami-Dade Building Recertification and Broward BSIP are two cards of
 * eight, the same component, the same title element, the same size class, 4th
 * and 6th in the sequence. (views/home.test.ts holds this.)
 *
 * TWO COLUMNS ON A DESKTOP, ONE ON A PHONE. The left column is the four
 * new-building services, the right column the four existing-building ones,
 * dropped by `clamp(90px, 15vw, 260px)`. Each column opens with its own
 * legend (what the track is, in one line), so the dropped column carries its
 * legend down with it. Under 900 px the columns dissolve (`display: contents`)
 * and the page reads as the new-buildings legend and its four cards, then the
 * existing-buildings legend and its four, each card carrying its track tag:
 * the order of the markup, so the keyboard and a screen reader go the way the
 * eye does. `--o` on each card is its place in `home.order` (the ribbon runs
 * in that order; nothing in the stylesheets orders by it).
 *
 * THE LINK IS THE TITLE, AND THE WHOLE CARD IS THE TARGET — the pattern of
 * Typologies.tsx: the `<a>` holds the title alone (link text well under 120
 * characters, pages.test.ts) and its `::after` is stretched over the card.
 * Nothing else in a card is a link, the photograph is `aria-hidden` (its
 * written alt is the catalogue's, always printed), and the ring at the end is
 * a glyph.
 *
 * The threshold card shows `frameCraneSky`, as on /services.
 *
 * The photographs are stock and are never captioned as the firm's work: the
 * tag in the head says so ("Illustrative photographs").
 *
 * MOTION (spec E8 to E12), by attribute (home-motion.css):
 *   `[data-fx="words"]`   the h2: each word rises out of its mask (`Words`)
 *   `[data-fx="left"]`    each column's legend slides in from the left (E10)
 *   `[data-fx="img"]`     each photograph: clip-path reveal on `.h-ph__in`,
 *                         settle on its image (E12)
 * The head's label, tag, lede and link are wrapped in plain `Reveal`s, the
 * production fade-up (E9).
 */
export function HomeServices({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const h = c.home.services;
  const l = (href: string) => localePath(href, lang);

  const cards = c.home.order.map((slug, i) => {
    const s = c.services.find((x) => x.slug === slug);
    if (!s) throw new Error(`home.order: no service "${slug}"`);
    return { s, i, photo: imagery.services[slug], line: (h.lines as Record<string, string>)[slug] };
  });
  const columns = [
    { track: 'new' as const, legend: h.legend.new, cards: cards.filter((x) => x.s.track === 'new') },
    {
      track: 'existing' as const,
      legend: h.legend.existing,
      cards: cards.filter((x) => x.s.track === 'existing'),
    },
  ];

  return (
    <section
      id="services"
      className="h-plate h-svc-plate mp-surface--graphite"
      aria-labelledby="h-svc-title"
    >
      <div className="mp-grid-bg" aria-hidden="true" />
      <div className="h-wrap">
        <header className="h-head">
          <div className="h-head__top">
            <Reveal fx="up">
              <p className="h-label">{h.label}</p>
            </Reveal>
            <Reveal fx="up" delay={0.1}>
              <p className="h-tag">{h.tag}</p>
            </Reveal>
          </div>
          <Reveal as="h2" fx="words" id="h-svc-title" className="h-h2">
            <Words text={h.title} accent={h.accentWord} />
          </Reveal>
          <div className="h-head__foot">
            <Reveal fx="up" className="h-head__lede">
              <p className="h-lede">{h.lede}</p>
            </Reveal>
            <Reveal fx="up" delay={0.1}>
              <Link className="h-link" href={l('/services')}>
                <span>{h.all}</span>
                <Arrow />
              </Link>
            </Reveal>
          </div>
        </header>

        <div className="h-svc__cols">
          {columns.map((col) => (
            <div key={col.track} className="h-svc__col" data-track={col.track}>
              <Reveal
                fx="left"
                delay={col.track === 'new' ? 0 : 0.2}
                className="h-svc__legend"
                style={{ '--o': 0 } as React.CSSProperties}
              >
                <p className="h-track">
                  <Diamond />
                  {col.legend.k}
                </p>
                <p className="h-svc__legend-v">{col.legend.v}</p>
              </Reveal>

              {col.cards.map(({ s, i, photo, line }, k) => {
                /* 3/2 and 4/5 alternate down each column, and the two columns
                   start on opposite ones, so a row of the grid is never two
                   frames of one shape. */
                const tall = col.track === 'new' ? k % 2 === 1 : k % 2 === 0;
                return (
                  <article
                    key={s.slug}
                    className="h-card h-svc"
                    style={{ '--ar': tall ? '4 / 5' : '3 / 2', '--o': i + 1 } as React.CSSProperties}
                  >
                    <Reveal fx="img" className="h-ph">
                      <div className="h-ph__in">
                        <Img photo={photo} sizes="(min-width: 900px) 44vw, 92vw" />
                      </div>
                    </Reveal>
                    <div className="h-card__meta">
                      <p className="h-track">
                        <Diamond />
                        {col.legend.k}
                      </p>
                      <h3 className="h-card__title">
                        <Link className="h-card__link" href={l(`/services/${s.slug}`)}>
                          {s.title}
                        </Link>
                      </h3>
                      <p className="h-card__line">{line}</p>
                      <span className="h-ring" aria-hidden="true">
                        <Arrow up />
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
