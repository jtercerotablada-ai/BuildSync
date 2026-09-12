'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import { ButtonLink, Reveal, SectionHeading } from './primitives';
import { useContent, useL } from './lang';

/**
 * Recertification timeline. The gold track fills as the section scrolls and
 * each node fills as it enters view; with reduced motion the track is drawn
 * complete and the nodes are filled from the start.
 */
export function ProcessTimeline({ n = '03' }: { n?: string }) {
  const c = useContent();
  const l = useL();
  const t = c.existingPage.timeline;
  const reduce = useReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [seen, setSeen] = useState<boolean[]>(() => t.steps.map(() => false));

  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ['start 70%', 'end 60%'],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    restDelta: 0.001,
  });

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
    <section
      className="mp-section mp-section--lg mp-surface--concrete"
      aria-labelledby="mp-recert-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={t.eyebrow} />

        <div className="mp-split" style={{ marginBlockEnd: 'var(--mp-12)' }}>
          <Reveal>
            <h2 id="mp-recert-title" className="mp-split__title">
              {t.title}
            </h2>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="mp-lead mp-measure">{t.lede}</p>
            <div className="mp-cta-row">
              <ButtonLink href={l(t.cta.href)} variant="line">
                {t.cta.label}
              </ButtonLink>
            </div>
          </Reveal>
        </div>

        <div className="mp-timeline" ref={listRef}>
          <div className="mp-timeline__track" aria-hidden="true" />
          <motion.div
            className="mp-timeline__progress"
            aria-hidden="true"
            style={reduce ? { height: '100%' } : { height: '100%', scaleY: progress }}
          />
          {t.steps.map((s, i) => (
            <div
              key={s.n}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              className={`mp-step${reduce || seen[i] ? ' is-in' : ''}`}
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

        <p className="mp-disclaimer">{c.ui.processDisclaimer}</p>
      </div>
    </section>
  );
}
