'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  DarkHeroSentinel,
  EASE,
  Reveal,
  RevealText,
  TechnicalEyebrow,
} from './primitives';

export type Crumb = { href?: string; label: string };

/**
 * Shared opening band for every internal page — same surface, rhythm and
 * photographic treatment as the home hero, so the whole site opens the same
 * way. Each page supplies its own headline, facts and photograph.
 *
 * There is no line-art here any more. A drawing sitting next to a headline at
 * the top of every page read as decoration; the diagrams now appear only where
 * they carry information and have no photograph competing with them — the
 * service cards, the home expertise pane, the BIM viewer and the service-area
 * plate.
 */
export function PageHero({
  eyebrow,
  titleLines,
  plainTitle,
  sub,
  facts,
  photo,
  crumbs,
}: {
  eyebrow: string;
  titleLines: React.ReactNode[];
  /** Plain-text version of the headline, for the accessible heading. */
  plainTitle: string;
  sub?: string;
  facts?: { k: string; v: string }[];
  photo?: { src: string; alt: string };
  crumbs?: Crumb[];
}) {
  const reduce = useReducedMotion();
  return (
    <section className="mp-phero" aria-labelledby="mp-phero-title">
      {photo ? (
        <motion.div
          className="mp-phero__photo"
          aria-hidden="true"
          initial={reduce ? false : { opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: EASE }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.src}
            alt=""
            fetchPriority="high"
            decoding="async"
            width={1800}
            height={1350}
          />
        </motion.div>
      ) : null}
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

        </div>
      </div>
      <DarkHeroSentinel />
    </section>
  );
}
