import React from 'react';
import Link from 'next/link';
import { getContent } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { Img } from '../media';
import { Reveal } from '../primitives';
import { Arrow } from '../home/glyphs';
import { Words } from '../home/Words';

/**
 * "Do we inspect your kind of building?" on /services, as a plate in the
 * home's language (2026-10-26): the label, the headline with its italic
 * word, the lede, then the six building types as the home's cards — a
 * photograph at 4/5, the type's name as the link, the ring, and this
 * page's own line under each (the home's rail has titles only; here the
 * line says what the firm reads in that kind of building).
 *
 * It replaces the ruled list of small thumbnails (Typologies.tsx), which the
 * owner called "horrible". The words are the same (`typologiesSection`,
 * `typologies`, the note under them); only the shape is the home's.
 *
 * THE LINK IS THE TITLE AND THE WHOLE CARD IS THE TARGET (the home's
 * pattern): the `<a>` holds the name alone and its `::after` is stretched
 * over the card; nothing else in a card is a link. The photographs
 * illustrate a kind of building, never a project: the note says so and
 * points at the typical engagements.
 *
 * A SERVER component: the page's words stay in the HTML and none ship as
 * data.
 */
export function TypesPlate({ lang }: { lang: Lang }) {
  const c = getContent(lang);
  const s = c.typologiesSection;
  const l = (href: string) => localePath(href, lang);

  return (
    <section className="h-plate mp-surface--graphite" aria-labelledby="mp-typo-title">
      <div className="h-wrap">
        <header className="h-head">
          <div className="h-head__top">
            <Reveal as="p" fx="up" className="h-label">
              {s.eyebrow}
            </Reveal>
          </div>
          <Reveal as="h2" fx="words" id="mp-typo-title" className="h-h2">
            <Words text={s.title} accent={s.accentWord} />
          </Reveal>
          <div className="h-head__foot">
            <Reveal fx="up" className="h-head__lede">
              <p className="h-lede">{s.lede}</p>
            </Reveal>
          </div>
        </header>

        <ul className="h-tgrid mp-typo">
          {c.typologies.map((t, i) => (
            <li key={t.n} className="h-card h-type mp-typo__card">
              <Reveal fx="img" className="h-ph" style={{ '--ar': '4 / 5' } as React.CSSProperties}>
                <div className="h-ph__in">
                  <Img photo={t.photo} sizes="(min-width: 900px) 30vw, (min-width: 561px) 46vw, 92vw" />
                </div>
              </Reveal>
              <div className="h-card__meta">
                <p className="h-card__title h-type__title">
                  <Link href={l(t.href)} className="h-card__link mp-typo__link">
                    {t.title}
                  </Link>
                </p>
                <p className="h-card__line">{t.lede}</p>
                <span className="h-ring" aria-hidden="true">
                  <Arrow up />
                </span>
              </div>
              {/* The card's place in the list, for a reader of the markup;
                  the home's cards carry no numeral either way. */}
              <span className="mp-sr-only">{String(i + 1).padStart(2, '0')}</span>
            </li>
          ))}
        </ul>

        <Reveal fx="up">
          <p className="mp-note">
            {c.ui.typologiesNote}{' '}
            <Link href={l('/projects')}>{c.ui.typologiesNoteLink}</Link>
            {c.ui.typologiesNoteEnd}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
