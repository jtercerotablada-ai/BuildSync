'use client';

import React from 'react';
import Link from 'next/link';
import { company, paths } from '@/lib/ttc/site';
import { Img } from './media';
import { Reveal, RevealText, SectionHeading, TextLink } from './primitives';

/**
 * The positioning statement and the two halves of the practice, as one
 * section. The headline says what the practice is; the two panels underneath
 * say which half a visitor is standing in and where to go next.
 *
 * Deliberately quiet: one photograph, one title, one sentence and one link per
 * panel. The seven-line capability lists that used to sit here are a single
 * line of text now — the service pages carry the detail.
 */
export function TwoPaths() {
  return (
    <section
      id="practice"
      className="mp-section mp-section--lg mp-surface--paper"
      aria-labelledby="mp-paths-title"
    >
      <div className="mp-shell">
        <SectionHeading n="01" label="The practice" />

        <div className="mp-paths__intro">
          <RevealText
            as="h2"
            className="mp-paths__title"
            lines={[
              company.positioning.line1,
              <React.Fragment key="l2">
                We protect <span className="mp-serif">existing</span> ones.
              </React.Fragment>,
            ]}
          />
          <span id="mp-paths-title" className="mp-form__hp">
            {company.positioning.line1} {company.positioning.line2}
          </span>
          <Reveal delay={0.12}>
            <p className="mp-paths__lede">
              One practice covering design, assessment, coordination and
              compliance for new and existing buildings throughout South
              Florida — with the same engineer accountable from the first
              load path to the last site visit.
            </p>
          </Reveal>
        </div>

        <div className="mp-paths">
          {paths.map((p, i) => (
            <Reveal
              as="div"
              key={p.key}
              delay={i * 0.08}
              className="mp-path"
            >
              <Link
                href={p.cta.href}
                className="mp-path__media"
                tabIndex={-1}
                aria-hidden="true"
              >
                <Img
                  photo={p.photo}
                  className="mp-path__photo"
                  sizes="(max-width: 900px) 100vw, 50vw"
                />
              </Link>

              <h3 className="mp-path__title">
                {p.title.split(p.serifWord)[0]}
                <span className="mp-serif">{p.serifWord}</span>
                {p.title.split(p.serifWord)[1]}
              </h3>
              <p className="mp-path__lede">{p.lede}</p>
              <p className="mp-path__caps">
                {p.capabilities.slice(0, 5).join(' · ')}
              </p>
              <div className="mp-path__cta">
                <TextLink href={p.cta.href}>{p.cta.label}</TextLink>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
