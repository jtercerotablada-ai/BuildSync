'use client';

import React from 'react';
import Link from 'next/link';
import { typologies } from '@/lib/ttc/site';
import { Img } from './media';
import { Reveal, SectionHeading } from './primitives';

/**
 * "What we design" — the section the site was missing.
 *
 * Everything else here answers in the language of engineering: analysis,
 * detailing, coordination, peer review. A visitor with a house or a small
 * apartment building arrives asking something simpler — *do you do my kind of
 * building?* — and had no way to find out. This answers that first, in
 * buildings, and only then sends them to the service that covers it.
 *
 * ⚠ These photographs illustrate a TYPOLOGY, never a job. The footnote saying
 * so is part of the section, not decoration: it is what keeps a page full of
 * buildings from reading as a portfolio the practice has not published yet.
 */
export function Typologies({ n = '03' }: { n?: string }) {
  return (
    <section
      className="mp-section mp-surface--paper mp-typo-sec"
      aria-labelledby="mp-typo-title"
    >
      <span className="mp-ghost" aria-hidden="true">
        {n}
      </span>
      <div className="mp-shell">
        <SectionHeading
          n={n}
          label="What we design"
          meta={`${typologies.length} typologies`}
        />

        <div className="mp-typo-intro">
          <h2 id="mp-typo-title" className="mp-typo-intro__title">
            From a single house to a{' '}
            <span className="mp-serif">mid-rise</span> concrete frame.
          </h2>
          <p className="mp-typo-intro__lede">
            The same practice, the same load path, the same detailing standard —
            scaled to the building in front of us. If your project is not on this
            list, it is worth a conversation rather than an assumption.
          </p>
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
                    sizes="(max-width: 720px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  <span className="mp-typo__num">{t.n}</span>
                  <span className="mp-typo__track" aria-hidden="true">
                    {t.track === 'new' ? 'New structure' : 'Existing building'}
                  </span>
                </span>

                <span className="mp-typo__body">
                  <span className="mp-typo__title">{t.title}</span>
                  <span className="mp-typo__lede">{t.lede}</span>
                  <span className="mp-typo__delivers">
                    {t.delivers.map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </span>
                  <span className="mp-typo__cta">
                    See how we run it
                    <i aria-hidden="true">→</i>
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={0.1}>
          <p className="mp-note mp-typo__note">
            Photographs illustrate the kind of structure described. They are not
            Tercero Tablada projects — published case studies appear on{' '}
            <Link href="/projects">Work</Link>, with client permission.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
