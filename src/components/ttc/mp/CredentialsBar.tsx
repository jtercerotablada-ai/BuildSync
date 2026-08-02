'use client';

import React from 'react';
import { credentials } from '@/lib/ttc/site';
import { Reveal, SectionHeading } from './primitives';

/**
 * Standards and accountability, stated once. Everything here is a design basis
 * the practice actually works to — no certification badges, no license
 * numbers, no affiliations that cannot be verified. See `site.ts` for the
 * editing rules.
 */
export function CredentialsBar({ n = '08' }: { n?: string }) {
  return (
    <section
      className="mp-section mp-surface--paper"
      aria-labelledby="mp-creds-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={credentials.eyebrow} meta="Design basis" />
        <h2 id="mp-creds-title" className="mp-form__hp">
          Standards and accountability
        </h2>

        <div className="mp-creds">
          {credentials.items.map((c, i) => (
            <Reveal as="div" key={c.k} delay={i * 0.04} className="mp-cred">
              <span className="mp-cred__k">{c.k}</span>
              <span className="mp-cred__v">{c.v}</span>
              <span className="mp-cred__note">{c.note}</span>
            </Reveal>
          ))}
        </div>

        {credentials.sealedDeliverables ? (
          <Reveal delay={0.08} className="mp-creds__seal">
            <span className="mp-creds__seal-mark" aria-hidden="true">
              P.E.
            </span>
            <p>{credentials.sealingStatement}</p>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
