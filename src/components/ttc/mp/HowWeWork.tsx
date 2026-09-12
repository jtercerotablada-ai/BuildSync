'use client';

import React from 'react';
import { Reveal, SectionHeading, StaggerItem, StaggerList } from './primitives';
import { useContent } from './lang';

/**
 * The client-facing process: five steps, each split into what the client does
 * and what they get. A plain grid, no rail — every step visible at once on
 * every screen.
 */
export function HowWeWork({ n = '04' }: { n?: string }) {
  const c = useContent();
  const w = c.howWeWork;

  return (
    <section
      className="mp-section mp-section--lg mp-surface--concrete"
      aria-labelledby="mp-how-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={w.eyebrow} />

        <div className="mp-intro">
          <Reveal>
            <h2 id="mp-how-title" className="mp-intro__title">
              {w.title}
            </h2>
          </Reveal>
          <Reveal delay={0.06}>
            <p className="mp-intro__lede">{w.lede}</p>
          </Reveal>
        </div>

        <StaggerList className="mp-steps" as="div">
          {w.steps.map((s) => (
            <StaggerItem key={s.n} className="mp-stepcard" as="div">
              <span className="mp-stepcard__n">{s.n}</span>
              <h3 className="mp-stepcard__title">{s.title}</h3>
              <p className="mp-stepcard__do">{s.youDo}</p>
              <p className="mp-stepcard__get">{s.youGet}</p>
            </StaggerItem>
          ))}
        </StaggerList>
      </div>
    </section>
  );
}
