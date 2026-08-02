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
import { HERO_GEOMETRY } from './art';
import { imagery } from '@/lib/ttc/site';

const CAPABILITIES = [
  'Reinforced concrete',
  'Building recertification',
  'Safety inspections',
  'BIM coordination',
];

/**
 * The hero visual is a building section that draws itself — the same way a set
 * gets drawn. It is pure SVG: no photography, no WebGL, no video, and nothing
 * the browser has to download beyond the markup already in the document.
 */
export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="mp-hero mp-surface--graphite" aria-labelledby="mp-hero-title">
      <div className="mp-hero__bg" aria-hidden="true" />
      {/* Architectural crop, heavily treated — it gives the graphite band a
          material to be made of. Decorative: nothing depends on seeing it. */}
      <div className="mp-hero__photo" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagery.hero.src}
          alt=""
          fetchPriority="low"
          decoding="async"
          width={1920}
          height={2400}
        />
      </div>
      <motion.div
        className="mp-hero__grid"
        aria-hidden="true"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 0.55 }}
        transition={{ duration: 1.4, ease: EASE }}
      />

      <div className="mp-shell mp-hero__body">
        <div>
          <motion.p
            className="mp-eyebrow mp-eyebrow--dot mp-hero__eyebrow"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
          >
            Structural Engineering · South Florida
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

        <div className="mp-hero__art">
          <HeroDrawing />
        </div>
      </div>

      <div className="mp-hero__foot">
        <div className="mp-shell mp-hero__foot-inner">
          <Reveal as="div" delay={0.7} y={10}>
            <ul className="mp-hero__caps">
              {CAPABILITIES.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Reveal>
          <a className="mp-hero__scroll" href="#statement">
            <span aria-hidden="true" />
            Scroll
          </a>
        </div>
      </div>

      <DarkHeroSentinel />
    </section>
  );
}

/* ── the self-drawing section ─────────────────────────────────────────────── */

function HeroDrawing() {
  const reduce = useReducedMotion();
  const g = HERO_GEOMETRY;
  const GOLD = 'var(--mp-gold)';

  const draw = (delay: number, dur = 1.1) =>
    reduce
      ? {}
      : ({
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: {
            pathLength: { duration: dur, ease: EASE, delay },
            opacity: { duration: 0.2, delay },
          },
        } as const);

  const fade = (delay: number, to = 1) =>
    reduce
      ? {}
      : ({
          initial: { opacity: 0 },
          animate: { opacity: to },
          transition: { duration: 0.5, ease: EASE, delay },
        } as const);

  return (
    <svg viewBox={g.viewBox} fill="none" aria-hidden="true" className="mp-hero__svg">
      <defs>
        <pattern id="mp-h-grid" width="44" height="44" patternUnits="userSpaceOnUse">
          <path
            d="M44 0H0V44"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeOpacity="0.1"
          />
        </pattern>
        <pattern
          id="mp-h-hatch"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="8"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeOpacity="0.26"
          />
        </pattern>
      </defs>

      <motion.rect width="620" height="780" fill="url(#mp-h-grid)" {...fade(0)} />

      {/* shear-wall core */}
      <motion.rect
        x={g.coreX}
        y={g.levels[0]}
        width={g.coreW}
        height={g.groundY - g.levels[0]}
        fill="url(#mp-h-hatch)"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.4"
        {...fade(1.35)}
      />

      {/* columns */}
      <g stroke="currentColor" fill="none" strokeWidth="1.3" strokeOpacity="0.68">
        {g.columns.map((x, i) => (
          <motion.rect
            key={x}
            x={x}
            y={g.levels[0]}
            width={g.colW}
            height={g.groundY - g.levels[0]}
            {...draw(0.34 + i * 0.07, 1.1)}
          />
        ))}
      </g>

      {/* slabs */}
      <g stroke="currentColor" fill="none" strokeWidth="1.4" strokeOpacity="0.82">
        {g.levels.map((y, i) => (
          <motion.rect
            key={y}
            x={g.slabX}
            y={y}
            width={g.slabW}
            height={11}
            {...draw(0.62 + i * 0.075, 0.85)}
          />
        ))}
      </g>

      {/* foundation mat */}
      <motion.rect
        x={g.matX}
        y={g.groundY}
        width={g.matW}
        height={g.matH}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.75"
        fill="none"
        {...draw(0.28, 0.9)}
      />

      {/* ground line + earth hatch */}
      <g stroke="currentColor" fill="none">
        <motion.line
          x1={60}
          y1={g.groundY}
          x2={560}
          y2={g.groundY}
          strokeWidth="1.6"
          strokeOpacity="0.7"
          {...draw(0.14, 0.8)}
        />
        <motion.g {...fade(0.55, 0.4)}>
          {Array.from({ length: 32 }, (_, i) => 60 + i * 16).map((x) => (
            <line key={x} x1={x} y1={g.groundY} x2={x - 10} y2={g.groundY + 13} strokeWidth="0.9" />
          ))}
        </motion.g>
      </g>

      {/* level markers */}
      <motion.g {...fade(1.15)}>
        {g.levels.map((y, i) => (
          <g key={y}>
            <line
              x1={112}
              y1={y + 5}
              x2={g.slabX}
              y2={y + 5}
              stroke={GOLD}
              strokeWidth="1"
              strokeOpacity="0.8"
            />
            <circle cx={110} cy={y + 5} r="2.6" fill={GOLD} />
            <text x={62} y={y + 9} className="mp-hero__svgtext">
              {i === 0 ? 'ROOF' : `L0${g.levels.length - i}`}
            </text>
          </g>
        ))}
      </motion.g>

      {/* node markers */}
      <motion.g fill={GOLD} {...fade(1.45)}>
        {g.levels.slice(1).map((y) =>
          g.columns.map((x) => (
            <circle key={`${x}-${y}`} cx={x + g.colW / 2} cy={y + 5} r="2.4" />
          )),
        )}
      </motion.g>

      {/* dimensions */}
      <motion.g stroke={GOLD} fill="none" strokeWidth="1" {...fade(1.6)}>
        <line x1={530} y1={g.levels[0]} x2={530} y2={g.groundY} />
        <line x1={525} y1={g.levels[0]} x2={535} y2={g.levels[0]} />
        <line x1={525} y1={g.groundY} x2={535} y2={g.groundY} />
        <line x1={g.matX} y1={720} x2={g.matX + g.matW} y2={720} />
        <line x1={g.matX} y1={715} x2={g.matX} y2={725} />
        <line x1={g.matX + g.matW} y1={715} x2={g.matX + g.matW} y2={725} />
      </motion.g>

      <motion.g {...fade(1.75)}>
        <text x={539} y={410} className="mp-hero__svgtext mp-hero__svgtext--gold">
          H
        </text>
        <text x={252} y={711} className="mp-hero__svgtext mp-hero__svgtext--gold">
          GRID 1–4
        </text>
        <text x={60} y={758} className="mp-hero__svgtext">
          SECTION A–A · TYP.
        </text>
      </motion.g>
    </svg>
  );
}
