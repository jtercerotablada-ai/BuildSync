'use client';

import React from 'react';
import Link from 'next/link';
import type { Photo } from '@/lib/ttc/media';
import { Img } from './media';
import { DarkHeroSentinel, RevealText, TechnicalEyebrow } from './primitives';
import { useContent, useL } from './lang';

export type Crumb = { href?: string; label: string };

/**
 * Shared opening band for every internal page — same surface, rhythm and
 * photographic treatment as the home hero. Crumb hrefs are canonical (English)
 * paths; they are localised here.
 *
 * Everything in this band is above the fold, so its entrances are CSS
 * keyframes (`mp-enter`) that run from the server HTML — the photo is the
 * page's LCP candidate and must not wait for React. See primitives.tsx.
 */
export function PageHero({
  eyebrow,
  titleLines,
  sub,
  facts,
  photo,
  crumbs,
}: {
  eyebrow: string;
  titleLines: React.ReactNode[];
  sub?: string;
  facts?: readonly { k: string; v: string }[];
  photo?: Photo;
  crumbs?: Crumb[];
}) {
  const c = useContent();
  const l = useL();
  return (
    <section className="mp-phero" aria-labelledby="mp-phero-title">
      {photo ? (
        <div className="mp-phero__photo mp-enter mp-enter--photo" aria-hidden="true">
          <Img photo={photo} priority sizes="100vw" />
        </div>
      ) : (
        <div className="mp-grid-bg" aria-hidden="true" />
      )}
      <div className="mp-shell">
        {crumbs?.length ? (
          <nav aria-label={c.ui.breadcrumb}>
            <ol className="mp-breadcrumbs">
              {crumbs.map((cr) => (
                <li key={cr.label}>
                  {cr.href ? (
                    <Link href={l(cr.href)}>{cr.label}</Link>
                  ) : (
                    <span aria-current="page">{cr.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="mp-phero__grid">
          <div>
            <TechnicalEyebrow className="mp-enter">{eyebrow}</TechnicalEyebrow>

            <RevealText
              as="h1"
              id="mp-phero-title"
              className="mp-phero__title"
              animateOnMount
              delay={0.06}
              lines={titleLines}
            />

            {sub ? <p className="mp-phero__sub mp-enter mp-enter--d2">{sub}</p> : null}

            {facts?.length ? (
              <dl className="mp-phero__facts mp-enter mp-enter--d3">
                {facts.map((f) => (
                  <div className="mp-phero__fact" key={f.k}>
                    <dt>{f.k}</dt>
                    <dd>{f.v}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </div>
      </div>
      <DarkHeroSentinel />
    </section>
  );
}
