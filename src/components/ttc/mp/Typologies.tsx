'use client';

import React from 'react';
import Link from 'next/link';
import { typologies } from '@/lib/ttc/site';
import { Img } from './media';
import { Reveal, SectionHeading } from './primitives';

/**
 * "What we design" — the section that answers the visitor's first question,
 * *do you do my kind of building?*, in buildings rather than in services.
 *
 * Each card is a photograph, a title and one sentence. The number plates,
 * track tags and deliverable chips that used to cover the card are gone; the
 * service page a card links to carries all of that.
 *
 * ⚠ These photographs illustrate a TYPOLOGY, never a job. The footnote saying
 * so is part of the section, not decoration: it is what keeps a page full of
 * buildings from reading as a portfolio the practice has not published yet.
 */
export function Typologies({ n = '02' }: { n?: string }) {
  return (
    <section
      className="mp-section mp-section--lg mp-surface--paper"
      aria-labelledby="mp-typo-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label="What we design" />

        <div className="mp-intro">
          <Reveal>
            <h2 id="mp-typo-title" className="mp-intro__title">
              From a single house to a{' '}
              <span className="mp-serif">mid-rise</span> concrete frame.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mp-intro__lede">
              The same practice, the same load path, the same detailing
              standard — scaled to the building in front of us. If your
              project is not on this list, it is worth a conversation rather
              than an assumption.
            </p>
          </Reveal>
        </div>

        <ul className="mp-typo">
          {typologies.map((t, i) => (
            <Reveal
              as="li"
              key={t.n}
              delay={(i % 3) * 0.07}
              className="mp-typo__card"
            >
              <Link href={t.href} className="mp-typo__link">
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

        <Reveal delay={0.1}>
          <p className="mp-note">
            Photographs illustrate the kind of structure described. They are not
            Tercero Tablada projects — published case studies appear on{' '}
            <Link href="/projects">Work</Link>, with client permission.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
