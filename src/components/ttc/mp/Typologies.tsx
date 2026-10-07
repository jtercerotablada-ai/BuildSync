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
 * county programs took its place; the home page keeps the headline, on
 * NewBuildings, so the two never share a page. `surface` exists because the
 * section now sits between a concrete track and the concrete "How we work":
 * the page passes `paper` to keep the surfaces alternating.
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
      className={`mp-section mp-section--lg ${
        surface === 'paper' ? 'mp-surface--paper' : 'mp-surface--concrete'
      }`}
      aria-labelledby="mp-typo-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={s.eyebrow} />

        <div className="mp-intro">
          <Reveal>
            <h2 id="mp-typo-title" className="mp-intro__title">
              {accent(s.title, s.accentWord)}
            </h2>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="mp-intro__lede">{s.lede}</p>
          </Reveal>
        </div>

        <ul className="mp-typo">
          {c.typologies.map((t, i) => (
            <Reveal as="li" key={t.n} delay={(i % 3) * 0.05} className="mp-typo__card">
              <div className="mp-typo__media">
                {/* The card's real rendered width, per the .mp-typo grid: one
                    column to 640, two to 900, then three inside the shell,
                    which caps at ~400 px until the 1500 / 2000 px steps
                    widen it. "33vw" overstated every desktop card (402 px is
                    28vw at 1440) and sent retina screens the 2000w master. */}
                <Img
                  photo={t.photo}
                  className="mp-typo__img"
                  sizes="(max-width: 640px) 92vw, (max-width: 900px) 45vw, (max-width: 1499px) 29vw, (max-width: 1999px) 470px, 540px"
                />
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
