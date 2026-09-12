'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { imagery } from '@/lib/ttc/site';
import { ButtonLink, DarkHeroSentinel, EASE, Reveal, RevealText } from './primitives';
import { VideoLoop } from './media';
import { accentLines } from './text';
import { useContent, useL } from './lang';

/**
 * The first screen answers three questions before a word of body copy is
 * read: what we do (the headline), where (the eyebrow), who is responsible
 * (the engineer plate). One primary action, one secondary.
 *
 * The footage is a slow aerial pass over the South Florida waterfront. The
 * scrim is a fixed gradient so legibility never depends on where the bright
 * water happens to be in a given frame. `VideoLoop` paints the poster first
 * and only upgrades to video on the client; reduced motion keeps the poster.
 */
export function Hero() {
  const c = useContent();
  const l = useL();
  const reduce = useReducedMotion();
  const h = c.hero;

  return (
    <section className="mp-hero mp-surface--graphite" aria-labelledby="mp-hero-title">
      <div className="mp-hero__bg" aria-hidden="true" />
      <div className="mp-grid-bg" aria-hidden="true" />
      <motion.div
        className="mp-hero__photo"
        aria-hidden="true"
        initial={reduce ? false : { opacity: 0, scale: 1.03 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: EASE }}
      >
        <VideoLoop clip={imagery.hero} priority />
      </motion.div>

      <div className="mp-shell mp-hero__body">
        <div className="mp-hero__col">
          <motion.p
            className="mp-eyebrow mp-hero__eyebrow"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.05 }}
          >
            {h.eyebrow}
          </motion.p>

          <RevealText
            as="h1"
            className="mp-hero__title"
            animateOnMount
            delay={0.1}
            lines={accentLines(h.titleLines, h.accentWord)}
          />
          <span id="mp-hero-title" className="mp-form__hp">
            {h.title}
          </span>

          <motion.p
            className="mp-hero__sub"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.32 }}
          >
            {h.sub}
          </motion.p>

          <motion.div
            className="mp-cta-row"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.4 }}
          >
            <ButtonLink href={l(h.primary.href)} variant="solid">
              {h.primary.label}
            </ButtonLink>
            <ButtonLink href={l(h.secondary.href)} variant="line" arrow={false}>
              {h.secondary.label}
            </ButtonLink>
          </motion.div>

          {/* The engineer plate: name, licensure, one link. Small on purpose —
              it is a signature under the headline, not a second hero. */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.5 }}
          >
            <Link href={l(h.plate.href)} className="mp-hero__plate">
              <span className="mp-hero__plate-mark" aria-hidden="true">
                P.E.
              </span>
              <span className="mp-hero__plate-body">
                <span className="mp-hero__plate-label">{h.plate.label}</span>
                <span className="mp-hero__plate-name">{c.leadership.name}</span>
                <span className="mp-hero__plate-role">
                  {c.leadership.role} · {c.leadership.credential}
                </span>
              </span>
              <span className="mp-hero__plate-go" aria-hidden="true">
                →
              </span>
            </Link>
          </motion.div>
        </div>
      </div>

      <div className="mp-hero__foot">
        <div className="mp-shell">
          <Reveal as="div" delay={0.6} y={8}>
            <ul className="mp-hero__caps">
              {h.caps.map((cap) => (
                <li key={cap}>{cap}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>

      <DarkHeroSentinel />
    </section>
  );
}
