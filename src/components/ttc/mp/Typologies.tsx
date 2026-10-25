'use client';

import React from 'react';
import Link from 'next/link';
import { Img } from './media';
import { Reveal, SectionHeading } from './primitives';
import { accent } from './text';
import { useContent, useL } from './lang';

/**
 * "What we design" — answers *do you do my kind of building?* in buildings
 * rather than in services. Each card is a photograph, a title and one line.
 *
 * ⚠ These photographs illustrate a TYPOLOGY, never a job. The footnote saying
 * so is part of the section, not decoration.
 *
 * THE LINK IS THE TITLE, AND THE WHOLE CARD IS STILL THE TARGET. The card
 * used to be one <a> around the photograph, the title and the line under it,
 * so the link's text was two hundred characters long: a screen reader's list
 * of links read the whole card out for each one, and a search engine got a
 * paragraph where it wanted the name of the page. Now the <a> holds the
 * title alone and its `::after` is stretched over the card (mp.css, 08), so
 * a click or a tap anywhere on the card still opens the page and the focus
 * ring is still drawn around the card. Nothing else in a card may become a
 * link: it would sit under that layer.
 *
 * Rendered on /services, after the two tracks. It left the home page when the
 * county programs took its place; the home page has its own building-types
 * rail (home/HomeTypes.tsx), so the two never share a page.
 *
 * A RULED LIST, NOT A PHOTO GRID. Six large colour photographs (930px of the
 * page at 1440, 2,600px on a phone) answered one question. Each typology is
 * now a row — a small greyscale photograph, the name, one line — in two
 * columns from 900px, like the service rows above it, and the intro sets
 * its title beside its lede (`.mp-intro--split`). The page uses the default
 * `concrete` surface, between the paper tracks and the paper "How we work".
 */
export function Typologies({
  n = '03',
  surface = 'concrete',
}: {
  n?: string;
  surface?: 'paper' | 'concrete';
}) {
  const c = useContent();
  const l = useL();
  const s = c.typologiesSection;

  return (
    <section
      className={`mp-section ${surface === 'paper' ? 'mp-surface--paper' : 'mp-surface--concrete'}`}
      aria-labelledby="mp-typo-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={s.eyebrow} />

        <div className="mp-intro mp-intro--split">
          <Reveal>
            <h2 id="mp-typo-title" className="mp-intro__title">
              {accent(s.title, s.accentWord)}
            </h2>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="mp-intro__lede">{s.lede}</p>
          </Reveal>
        </div>

        <ul className="mp-typo mp-typo--list">
          {c.typologies.map((t, i) => (
            <Reveal as="li" key={t.n} delay={(i % 2) * 0.05} className="mp-typo__card">
              <div className="mp-typo__media">
                {/* A thumbnail: 10rem wide, 6rem on a phone (mp.css,
                    `.mp-typo--list`). The smallest rendition is 900w. */}
                <Img photo={t.photo} className="mp-typo__img" sizes="(max-width: 720px) 96px, 160px" />
              </div>
              <div className="mp-typo__body">
                <p className="mp-typo__title">
                  <Link href={l(t.href)} className="mp-typo__link">
                    {t.title}
                  </Link>
                  <i aria-hidden="true">→</i>
                </p>
                <p className="mp-typo__lede">{t.lede}</p>
              </div>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={0.06}>
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
