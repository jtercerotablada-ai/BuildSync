'use client';

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ButtonLink,
  DarkHeroSentinel,
  EASE,
  RevealText,
  Reveal,
} from './primitives';
import { VideoLoop } from './media';
import { imagery } from '@/lib/ttc/site';

const CAPABILITIES = [
  'Reinforced concrete',
  'Building recertification',
  'Safety inspections',
  'BIM coordination',
];

/**
 * The hero is a slow aerial pass over the South Florida waterfront. It says
 * where the practice works before a word is read.
 *
 * Nothing sits between the footage and the type any more — no grid overlay,
 * no scroll cue. The scrim is a fixed gradient so legibility never depends on
 * where the bright water happens to be in a given frame. `VideoLoop` paints
 * the poster first and only upgrades to video on the client; reduced motion
 * keeps the poster permanently. See `media.tsx`.
 */
export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="mp-hero mp-surface--graphite" aria-labelledby="mp-hero-title">
      <div className="mp-hero__bg" aria-hidden="true" />
      <motion.div
        className="mp-hero__photo"
        aria-hidden="true"
        initial={reduce ? false : { opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease: EASE }}
      >
        <VideoLoop clip={imagery.hero} priority />
      </motion.div>

      <div className="mp-shell mp-hero__body">
        <div>
          <motion.p
            className="mp-eyebrow mp-hero__eyebrow"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
          >
            Structural engineering · South Florida
          </motion.p>

          <RevealText
            as="h1"
            className="mp-hero__title"
            animateOnMount
            delay={0.12}
            lines={[
              'Engineering structures',
              <React.Fragment key="l2">
                that <span className="mp-serif">endure.</span>
              </React.Fragment>,
            ]}
          />
          {/* The accessible name for the section, kept out of the clipped markup */}
          <span id="mp-hero-title" className="mp-form__hp">
            Engineering structures that endure
          </span>

          <motion.p
            className="mp-hero__sub"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.42 }}
          >
            Reinforced-concrete design, building recertification, safety
            inspections and BIM coordination for projects across South Florida.
          </motion.p>

          <motion.div
            className="mp-cta-row"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.52 }}
          >
            <ButtonLink href="/contact" variant="solid">
              Start a project
            </ButtonLink>
            <ButtonLink href="/services" variant="line" arrow={false}>
              Explore our capabilities
            </ButtonLink>
          </motion.div>
        </div>
      </div>

      <div className="mp-hero__foot">
        <div className="mp-shell">
          <Reveal as="div" delay={0.7} y={10}>
            <ul className="mp-hero__caps">
              {CAPABILITIES.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>

      <DarkHeroSentinel />
    </section>
  );
}
