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
 */
export function Typologies({ n = '02' }: { n?: string }) {
  const c = useContent();
  const l = useL();
  const s = c.typologiesSection;

  return (
    <section
      className="mp-section mp-section--lg mp-surface--concrete"
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
              <Link href={l(t.href)} className="mp-typo__link">
                <span className="mp-typo__media">
                  <Img
                    photo={t.photo}
                    className="mp-typo__img"
                    sizes="(max-width: 720px) 100vw, (max-width: 1080px) 50vw, 33vw"
                  />
                </span>
                <span className="mp-typo__body">
                  <span className="mp-typo__title">
                    {t.title}
                    <i aria-hidden="true">→</i>
                  </span>
                  <span className="mp-typo__lede">{t.lede}</span>
                </span>
              </Link>
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
