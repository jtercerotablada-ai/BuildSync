'use client';

import React from 'react';
import { Reveal, SectionHeading } from './primitives';
import { useContent } from './lang';

/**
 * Standards and accountability, stated once. Everything here is a design basis
 * the practice actually works to — no badges, no affiliations that cannot be
 * verified.
 */
export function CredentialsBar({ n = '08' }: { n?: string }) {
  const c = useContent();
  const k = c.credentials;
  return (
    <section className="mp-section mp-surface--paper" aria-labelledby="mp-creds-title">
      <div className="mp-shell">
        <SectionHeading n={n} label={k.eyebrow} />
        <h2 id="mp-creds-title" className="mp-form__hp">
          {k.eyebrow}
        </h2>

        <div className="mp-creds">
          {k.items.map((it, i) => (
            <Reveal as="div" key={it.k} delay={i * 0.03} className="mp-cred">
              <span className="mp-cred__k">{it.k}</span>
              <span className="mp-cred__v">{it.v}</span>
              <span className="mp-cred__note">{it.note}</span>
            </Reveal>
          ))}
        </div>

        {k.sealedDeliverables ? (
          <Reveal delay={0.06} className="mp-creds__seal">
            <span className="mp-creds__seal-mark" aria-hidden="true">
              P.E.
            </span>
            <p>{k.sealingStatement}</p>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
