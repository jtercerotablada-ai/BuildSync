'use client';

import React from 'react';
import Link from 'next/link';
import { ServiceArt, type ArtKind } from './art';
import {
  DarkHeroSentinel,
  Reveal,
  RevealText,
  TechnicalEyebrow,
} from './primitives';

export type Crumb = { href?: string; label: string };

/**
 * Shared opening band for every internal page. Same surface and rhythm as the
 * home hero so the system reads as one site, but each page supplies its own
 * headline, facts and diagram — the structure varies, the language does not.
 */
export function PageHero({
  eyebrow,
  titleLines,
  plainTitle,
  sub,
  facts,
  art,
  crumbs,
}: {
  eyebrow: string;
  titleLines: React.ReactNode[];
  /** Plain-text version of the headline, for the accessible heading. */
  plainTitle: string;
  sub?: string;
  facts?: { k: string; v: string }[];
  art?: ArtKind;
  crumbs?: Crumb[];
}) {
  return (
    <section className="mp-phero" aria-labelledby="mp-phero-title">
      <div className="mp-phero__grid-bg" aria-hidden="true" />
      <div className="mp-shell">
        {crumbs?.length ? (
          <nav aria-label="Breadcrumb">
            <ol className="mp-breadcrumbs">
              {crumbs.map((c) => (
                <li key={c.label}>
                  {c.href ? (
                    <Link href={c.href}>{c.label}</Link>
                  ) : (
                    <span aria-current="page">{c.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="mp-phero__grid">
          <div>
            <Reveal y={12}>
              <TechnicalEyebrow dot>{eyebrow}</TechnicalEyebrow>
            </Reveal>

            <RevealText
              as="h1"
              className="mp-phero__title"
              animateOnMount
              delay={0.08}
              lines={titleLines}
            />
            <span id="mp-phero-title" className="mp-form__hp">
              {plainTitle}
            </span>

            {sub ? (
              <Reveal delay={0.22}>
                <p className="mp-phero__sub">{sub}</p>
              </Reveal>
            ) : null}

            {facts?.length ? (
              <Reveal delay={0.28}>
                <dl className="mp-phero__facts">
                  {facts.map((f) => (
                    <div className="mp-phero__fact" key={f.k}>
                      <dt>{f.k}</dt>
                      <dd>{f.v}</dd>
                    </div>
                  ))}
                </dl>
              </Reveal>
            ) : null}
          </div>

          {art ? (
            <Reveal delay={0.16} className="mp-phero__art">
              <ServiceArt kind={art} />
            </Reveal>
          ) : null}
        </div>
      </div>
      <DarkHeroSentinel />
    </section>
  );
}
