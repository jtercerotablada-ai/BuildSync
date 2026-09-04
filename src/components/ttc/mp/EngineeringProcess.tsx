'use client';

import React from 'react';
import { engineeringProcess as ep } from '@/lib/ttc/site';
import { Reveal, SectionHeading, StaggerItem, StaggerList } from './primitives';

/**
 * The six stages of an engagement, as a plain grid: number, title, what
 * happens, what it settles. Three across on a desktop, two on a tablet, one
 * on a phone — the page scroll is the only scroll.
 *
 * This used to be a horizontal scroll-snap rail with a "scroll for all six"
 * hint. A rail hides four of the six stages behind a gesture on exactly the
 * screens where the reader is least likely to make it; a grid shows all six
 * at once and needs no hint.
 */
export function EngineeringProcess({ n = '05' }: { n?: string }) {
  return (
    <section
      className="mp-section mp-section--lg mp-surface--concrete"
      aria-labelledby="mp-process-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={ep.eyebrow} />

        <div className="mp-intro">
          <Reveal>
            <h2 id="mp-process-title" className="mp-intro__title">
              {ep.title}
            </h2>
          </Reveal>
        </div>

        <StaggerList className="mp-stages" as="div">
          {ep.stages.map((s) => (
            <StaggerItem key={s.n} className="mp-stage" as="div">
              <span className="mp-stage__n">{s.n}</span>
              <h3 className="mp-stage__title">{s.title}</h3>
              <p className="mp-stage__action">{s.action}</p>
              <p className="mp-stage__result">{s.result}</p>
            </StaggerItem>
          ))}
        </StaggerList>
      </div>
    </section>
  );
}
