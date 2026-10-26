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
 * THE ORDER IS `home.order` — the owner's, 2026-10-26: Building
 * Recertification first, BSIP second ("de primero recertification y segundo
 * BSIP"), then the rest by the sales he expects of them: assessments and
 * repair design, milestone inspections, threshold inspections, peer review.
 * The two programs are still two cards of six, the same component, the same
 * title element, the same size class (views/home.test.ts holds the order).
 *
 * ONE GRID, TWO COLUMNS ON A DESKTOP, ONE ON A PHONE. The cards are in the
 * markup in `home.order`, two to a row, the left one first; the right column
 * is dropped by `clamp(90px, 15vw, 260px)` with a transform (home.css), so
 * the markup, the keyboard and a screen reader keep the order the eye reads
 * (left, right, left…) and the rows keep their height. Every card carries
 * its own track tag; the key that stood over the grid went on 2026-10-26.
 * Under 900 px the grid is one column, in the same order, no drop. `--o` on
 * each card is its place in `home.order` (the ribbon runs in that order;
 * nothing in the stylesheets orders by it).
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
 * The photographs are stock and are never captioned as the firm's work (the
 * /credits page says so; the "Illustrative photographs" tag that stood in
 * the head went on 2026-10-26 at the owner's word).
 *
 * MOTION (spec E8 to E12), by attribute (home-motion.css):
 *   `[data-fx="words"]`   the h2: each word rises out of its mask (`Words`)
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
  return (
    <section
      id="services"
      className="h-plate h-svc-plate mp-surface--graphite"
      aria-labelledby="h-svc-title"
    >
      <div className="h-wrap">
        <header className="h-head">
          <div className="h-head__top">
            <Reveal fx="up">
              <p className="h-label">{h.label}</p>
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

        {/* No key over the grid any more (the owner, 2026-10-26: "este texto no
            lo veo necesario"); each card carries its own track tag. */}
        <div className="h-svc__grid">
          {cards.map(({ s, i, photo, line }) => {
            /* One frame shape for all six, 3/2 (the owner, 2026-10-26: the
               rows must not differ in height — the middle row used to be
               4/5), so the two columns stay in step and the dropped right
               column keeps its spacing (home.css). */
            return (
              <article
                key={s.slug}
                className="h-card h-svc"
                style={{ '--ar': '3 / 2', '--o': i + 1 } as React.CSSProperties}
              >
                <Reveal fx="img" className="h-ph">
                  <div className="h-ph__in">
                    <Img photo={photo} sizes="(min-width: 900px) 44vw, 92vw" />
                  </div>
                </Reveal>
                <div className="h-card__meta">
                  <p className="h-track">
                    <Diamond />
                    {(h.legend as Record<string, { k: string; v: string }>)[s.track].k}
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
      </div>
    </section>
  );
}
