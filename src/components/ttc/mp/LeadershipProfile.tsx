'use client';

import React from 'react';
import { company, contact, imagery, leadership } from '@/lib/ttc/site';
import { Img } from './media';
import { Reveal, SectionHeading } from './primitives';

/**
 * Two states, both complete.
 *
 * `leadership.published === true` renders a full professional profile:
 * portrait, name, role, education, expertise, philosophy, biography and
 * verified credentials.
 *
 * While it is false — because no verified bio or portrait exists yet — the
 * section renders the practice-accountability composition instead. That is a
 * finished piece of content, not a placeholder: no empty frame, no "profile
 * forthcoming", nothing that tells a visitor the site is unfinished.
 */
export function LeadershipProfile({ n = '09' }: { n?: string }) {
  const f = leadership.fallback;
  const published = leadership.published;

  /**
   * The practice record shown until a real bio and portrait exist.
   *
   * This was an SVG drawing title block on graph paper. Two things were wrong
   * with it: it looked like a student exercise, and the text inside it was SVG
   * — unselectable, unsearchable, and awkward for a screen reader. It is real
   * markup now, set over a photograph. When `leadership.published` flips true
   * the portrait takes this slot and none of it renders.
   */
  const recordRows = [
    { k: 'Practice', v: company.name },
    { k: 'Discipline', v: company.discipline },
    { k: 'Service area', v: contact.serviceAreaLabel },
    { k: 'Responsibility', v: 'Engineer of record' },
    { k: 'Review', v: 'Internal check before issue' },
  ];

  return (
    <section
      className="mp-section mp-section--lg mp-surface--paper"
      aria-labelledby="mp-lead-title"
    >
      <div className="mp-shell">
        <SectionHeading
          n={n}
          label={published ? 'Leadership' : f.eyebrow}
        />

        <div className="mp-lead__grid">
          <Reveal>
            <figure className="mp-lead__figure">
              {published && leadership.portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={leadership.portrait}
                  alt={leadership.portraitAlt}
                  width={640}
                  height={800}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="mp-lead__record">
                  <Img
                    photo={imagery.sections.leadership}
                    className="mp-lead__record-bg"
                    sizes="(max-width: 900px) 100vw, 42vw"
                  />
                  <dl className="mp-lead__record-list">
                    {recordRows.map((r) => (
                      <div key={r.k}>
                        <dt>{r.k}</dt>
                        <dd>{r.v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              <figcaption className="mp-lead__caption">
                <span>{published ? leadership.name : company.name}</span>
                <span>{published ? leadership.role : 'Practice record'}</span>
              </figcaption>
            </figure>
          </Reveal>

          <div>
            <Reveal delay={0.06}>
              <h2 id="mp-lead-title" className="mp-lead__title">
                {published ? leadership.name : f.title}
              </h2>
            </Reveal>

            <Reveal delay={0.1} className="mp-lead__body">
              {(published ? leadership.bio : f.body).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {published && leadership.philosophy ? (
                <p>{leadership.philosophy}</p>
              ) : null}
            </Reveal>

            {published ? (
              <Reveal delay={0.14} className="mp-lead__meta">
                {leadership.education.length ? (
                  <div>
                    <h3>Education</h3>
                    <ul>
                      {leadership.education.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {leadership.expertise.length ? (
                  <div>
                    <h3>Areas of expertise</h3>
                    <ul>
                      {leadership.expertise.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {leadership.credentials.length ? (
                  <div>
                    <h3>Credentials</h3>
                    <ul>
                      {leadership.credentials.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </Reveal>
            ) : (
              <Reveal delay={0.14}>
                <ul className="mp-pillars">
                  {f.pillars.map((p) => (
                    <li key={p.k}>
                      <b>{p.k}</b>
                      <span>{p.v}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
