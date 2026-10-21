'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Reveal, SectionHeading } from './primitives';
import { useContent } from './lang';

/**
 * The one sequence Miami-Dade's recertification and Broward's BSIP share, on
 * /existing-buildings: six steps, report filed first, and no number at all —
 * each county's ages and deadlines live on its own page, which the
 * situation tiles above (01, 02) already link.
 *
 * A ruled grid (`.mp-timeline--grid`): three columns from 1101px, two from
 * 641px, one on a phone; each step is its node and title on one line and
 * its sentence under them, below a hairline. Read row by row, 01–03 then
 * 04–06. It used to be six full-width rows with a scroll-linked gold track
 * (motion/react, the only importer on the public site); the track was
 * decoration, and it is gone with the library.
 *
 * Each node still fills as its step enters view (IntersectionObserver).
 * With reduced motion every node is filled from the start — in CSS (mp.css,
 * reduced-motion block), not here: `useReducedMotion()` is null on the
 * server but the real preference on the first client render, so branching
 * the class on it shipped markup that hydration flagged and never repaired.
 * The markup below is identical on the server and the first client pass.
 *
 * No line under the steps: the "requirements vary… not a guaranteed
 * procedure" note was small print the page does not need — nothing here
 * promises an outcome.
 */
export function ProcessTimeline({ n = '03' }: { n?: string }) {
  const c = useContent();
  const t = c.existingPage.timeline;
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [seen, setSeen] = useState<boolean[]>(() => t.steps.map(() => false));

  useEffect(() => {
    const nodes = stepRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!nodes.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = nodes.indexOf(entry.target as HTMLDivElement);
          if (idx < 0) return;
          setSeen((prev) => {
            if (prev[idx]) return prev;
            const next = [...prev];
            next[idx] = true;
            return next;
          });
        });
      },
      { rootMargin: '0px 0px -40% 0px', threshold: 0 },
    );
    nodes.forEach((node) => io.observe(node));
    return () => io.disconnect();
  }, []);

  return (
    <section className="mp-section mp-surface--concrete" aria-labelledby="mp-recert-title">
      <div className="mp-shell">
        <SectionHeading n={n} label={t.eyebrow} />

        {/* Title over lede, across the shell — as section 01 opens. In a
            split the Spanish title took four lines of a narrow column. */}
        <div className="mp-intro mp-intro--wide">
          <Reveal>
            <h2 id="mp-recert-title" className="mp-intro__title">
              {t.title}
            </h2>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="mp-intro__lede">{t.lede}</p>
          </Reveal>
        </div>

        <div className="mp-timeline mp-timeline--grid">
          {t.steps.map((s, i) => (
            <div
              key={s.n}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              className={`mp-step${seen[i] ? ' is-in' : ''}`}
            >
              <div className="mp-step__node">
                <span className="mp-step__dot" aria-hidden="true" />
                <span className="mp-step__n">{s.n}</span>
              </div>
              <h3 className="mp-step__title">{s.title}</h3>
              <p className="mp-step__detail">{s.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
