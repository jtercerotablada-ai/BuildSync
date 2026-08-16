'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { coreExpertise } from '@/lib/ttc/site';
import { ServiceArt } from './art';
import { EASE, Reveal, SectionHeading, TextLink } from './primitives';

/**
 * Editorial expertise section: the diagram pane is sticky and swaps as each
 * service scrolls into the reading zone. Below 1180px the sticky pane is
 * removed by CSS and each service renders its own diagram inline, so the
 * information is identical without the scroll choreography.
 */
export function CoreExpertise({ n = '03' }: { n?: string }) {
  const [active, setActive] = useState(0);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    const nodes = itemRefs.current.filter(Boolean) as HTMLElement[];
    if (!nodes.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the top of the reading zone.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (!visible.length) return;
        const idx = nodes.indexOf(visible[0].target as HTMLElement);
        if (idx >= 0) setActive(idx);
      },
      { rootMargin: '-30% 0px -50% 0px', threshold: 0 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  const current = coreExpertise[active];

  return (
    <section
      className="mp-section mp-section--lg mp-surface--paper"
      aria-labelledby="mp-expertise-title"
    >
      <div className="mp-shell">
        <SectionHeading
          n={n}
          label="Core expertise"
          meta={`${String(active + 1).padStart(2, '0')} / ${String(coreExpertise.length).padStart(2, '0')}`}
        />
        <h2 id="mp-expertise-title" className="mp-form__hp">
          Core expertise
        </h2>

        <div className="mp-expertise__grid">
          <div className="mp-expertise__sticky" aria-hidden="true">
            <div className="mp-expertise__viewport mp-frame">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current.slug}
                  className="mp-expertise__viewport-inner"
                  initial={reduce ? false : { opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.01 }}
                  transition={{ duration: 0.42, ease: EASE }}
                >
                  <ServiceArt kind={current.art} />
                </motion.div>
              </AnimatePresence>
              <div className="mp-expertise__vmeta">
                <span>
                  <b>{current.n}</b> — {current.shortTitle}
                </span>
                <span>{current.standards[0]}</span>
              </div>
            </div>
          </div>

          <div className="mp-expertise__list">
            {coreExpertise.map((s, i) => (
              <article
                key={s.slug}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                className={`mp-service${active === i ? ' is-active' : ''}`}
              >
                <Reveal>
                  <div className="mp-service__head">
                    <span className="mp-service__n">{s.n}</span>
                    <h3 className="mp-service__title">{s.title}</h3>
                  </div>

                  <div className="mp-service__art" aria-hidden="true">
                    <ServiceArt kind={s.art} />
                  </div>

                  <p className="mp-service__desc">{s.summary}</p>

                  <ul className="mp-service__caps">
                    {s.capabilities.slice(0, 5).map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>

                  <TextLink href={`/services/${s.slug}`}>
                    Explore service
                  </TextLink>
                </Reveal>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
