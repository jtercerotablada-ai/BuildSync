'use client';

import React from 'react';
import { AnimatedLine, Reveal, RevealText, SectionHeading } from './primitives';

const MARKS = [
  { k: 'New structures', v: 'Design, analysis, detailing' },
  { k: 'Existing buildings', v: 'Recertification, inspection, assessment' },
  { k: 'Coordination', v: 'BIM, peer review, compliance' },
];

export function StatementSection() {
  return (
    <section
      id="statement"
      className="mp-section mp-section--lg mp-surface--paper mp-statement"
      aria-labelledby="mp-statement-title"
      style={{ overflow: 'clip' }}
    >
      <span className="mp-ghost" aria-hidden="true">
        01
      </span>
      <div className="mp-shell">
        <SectionHeading n="01" label="Positioning" meta="Practice scope" />

        <div className="mp-statement__grid">
          <div>
            <RevealText
              as="h2"
              className="mp-statement__title"
              lines={[
                'We design new structures.',
                <React.Fragment key="l2">
                  We protect <span className="mp-serif">existing</span> ones.
                </React.Fragment>,
              ]}
            />
            <span id="mp-statement-title" className="mp-form__hp">
              We design new structures. We protect existing ones.
            </span>
            <AnimatedLine
              className="mp-rule mp-rule--gold"
              delay={0.35}
              duration={1.1}
            />
          </div>

          <div className="mp-statement__aside">
            <Reveal delay={0.1}>
              <p>
                Tercero Tablada Civil &amp; Structural Engineering Inc.
                provides structural engineering, building evaluation and BIM
                coordination for new and existing buildings throughout South
                Florida — one practice covering design, assessment,
                coordination and compliance.
              </p>
            </Reveal>
            <Reveal delay={0.18} className="mp-statement__marks">
              {MARKS.map((m) => (
                <span className="mp-statement__mark" key={m.k}>
                  <b>{m.k}</b>
                  <span>{m.v}</span>
                </span>
              ))}
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
