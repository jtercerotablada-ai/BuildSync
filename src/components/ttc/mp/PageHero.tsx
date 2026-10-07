'use client';

import React from 'react';
import Link from 'next/link';
import type { Photo } from '@/lib/ttc/media';
import { Img } from './media';
import { ButtonLink, DarkHeroSentinel, RevealText, TechnicalEyebrow } from './primitives';
import { useContent, useL } from './lang';

export type Crumb = { href?: string; label: string };

/** A hero button. `variant` defaults to solid for the first and line for the rest. */
export type HeroAction = { href: string; label: string; variant?: 'solid' | 'line' };

/**
 * Shared opening band for every internal page — same surface, rhythm and
 * photographic treatment as the home hero. Crumb and action hrefs are
 * canonical (English) paths; they are localised here.
 *
 * `actions` puts the page's own button on the first screen. A visitor who
 * arrives from a search lands on an inner page, not on Home, and on a phone
 * the first link to the form used to be three to twelve screens down. So the
 * buttons come right under the lede and ABOVE the facts: on a small screen
 * the action must not wait behind a list. `actionNote` is the one line under
 * them that says what to send. `children` render last, under the facts (the
 * engineer's credential on the two county-program pages).
 *
 * Everything in this band is above the fold, so its entrances are CSS
 * keyframes (`mp-enter`) that run from the server HTML — the photo is the
 * page's LCP candidate and must not wait for React. See primitives.tsx.
 */
export function PageHero({
  eyebrow,
  titleLines,
  sub,
  actions,
  actionNote,
  facts,
  photo,
  crumbs,
  children,
}: {
  eyebrow: string;
  titleLines: React.ReactNode[];
  sub?: string;
  actions?: readonly HeroAction[];
  actionNote?: string;
  facts?: readonly { k: string; v: string }[];
  photo?: Photo;
  crumbs?: Crumb[];
  children?: React.ReactNode;
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

            {actions?.length ? (
              <div className="mp-phero__action mp-enter mp-enter--d3">
                <div className="mp-cta-row">
                  {actions.map((a, i) => (
                    <ButtonLink
                      key={a.href}
                      href={l(a.href)}
                      variant={a.variant ?? (i === 0 ? 'solid' : 'line')}
                    >
                      {a.label}
                    </ButtonLink>
                  ))}
                </div>
                {actionNote ? <p className="mp-phero__note">{actionNote}</p> : null}
              </div>
            ) : null}

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

            {children ? <div className="mp-enter mp-enter--d4">{children}</div> : null}
          </div>
        </div>
      </div>
      <DarkHeroSentinel />
    </section>
  );
}
