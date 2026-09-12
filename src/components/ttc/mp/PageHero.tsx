'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import type { Photo } from '@/lib/ttc/media';
import { Img } from './media';
import {
  DarkHeroSentinel,
  EASE,
  Reveal,
  RevealText,
  TechnicalEyebrow,
} from './primitives';
import { useContent, useL } from './lang';

export type Crumb = { href?: string; label: string };

/**
 * Shared opening band for every internal page — same surface, rhythm and
 * photographic treatment as the home hero. Crumb hrefs are canonical (English)
 * paths; they are localised here.
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
  plainTitle: string;
  sub?: string;
  facts?: readonly { k: string; v: string }[];
  photo?: Photo;
  crumbs?: Crumb[];
}) {
  const reduce = useReducedMotion();
  const c = useContent();
  const l = useL();
  return (
    <section className="mp-phero" aria-labelledby="mp-phero-title">
      {photo ? (
        <motion.div
          className="mp-phero__photo"
          aria-hidden="true"
          initial={reduce ? false : { opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: EASE }}
        >
          <Img photo={photo} priority sizes="100vw" />
        </motion.div>
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
            <Reveal y={8}>
              <TechnicalEyebrow>{eyebrow}</TechnicalEyebrow>
            </Reveal>

            <RevealText
              as="h1"
              className="mp-phero__title"
              animateOnMount
              delay={0.06}
              lines={titleLines}
            />
            <span id="mp-phero-title" className="mp-form__hp">
              {plainTitle}
            </span>

            {sub ? (
              <Reveal delay={0.16}>
                <p className="mp-phero__sub">{sub}</p>
              </Reveal>
            ) : null}

            {facts?.length ? (
              <Reveal delay={0.2}>
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
