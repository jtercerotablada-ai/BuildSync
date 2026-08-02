'use client';

import React from 'react';
import { engineeringProcess as ep } from '@/lib/ttc/site';
import { Reveal, SectionHeading, StaggerItem, StaggerList } from './primitives';

/**
 * The six stages of an engagement. Horizontal on wide screens using native
 * scroll-snap — the page scroll is never hijacked, and the same list stacks
 * vertically on narrow screens. Keyboard users tab through the stages and the
 * container scrolls them into view natively.
 */
export function EngineeringProcess({ n = '07' }: { n?: string }) {
  return (
    <section
      className="mp-section mp-surface--paper"
      aria-labelledby="mp-process-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={ep.eyebrow} meta="Assess → Deliver" />
        <Reveal>
          <h2
            id="mp-process-title"
            className="mp-h2"
            style={{ marginBlockEnd: 'var(--mp-8)', maxWidth: '18ch' }}
          >
            {ep.title}
          </h2>
        </Reveal>
      </div>

      <div className="mp-shell">
        {/* A horizontally scrollable region must be operable by keyboard —
            tabbing to it lets arrow keys move through the six stages. */}
        <StaggerList
          className="mp-stages"
          as="div"
          tabIndex={0}
          role="group"
          ariaLabel="Engineering process stages — scroll horizontally"
        >
          {ep.stages.map((s) => (
            <StaggerItem key={s.n} className="mp-stage" as="div">
              <div className="mp-stage__top">
                <h3 className="mp-stage__title">{s.title}</h3>
                <span className="mp-stage__n">{s.n}</span>
              </div>
              <p className="mp-stage__action">{s.action}</p>
              <p className="mp-stage__result">{s.result}</p>
              <dl className="mp-stage__deliverable">
                <dt>Deliverable</dt>
                <dd>{s.deliverable}</dd>
              </dl>
            </StaggerItem>
          ))}
        </StaggerList>

        <p className="mp-stages__hint" aria-hidden="true">
          <span>Scroll for all six stages</span>
          <span>→</span>
        </p>
      </div>
    </section>
  );
}
