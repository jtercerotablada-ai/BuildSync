'use client';

import React from 'react';
import Link from 'next/link';
import { imagery } from '@/lib/ttc/site';
import { Img } from './media';
import { ButtonLink, Reveal, SectionHeading } from './primitives';
import { useContent, useL } from './lang';

/**
 * The person behind the practice.
 *
 * Two variants share one composition: `teaser` on the home page (name,
 * credential, two sentences, one link) and `full` on the About page
 * (biography, education, focus, approach, what it means for the client,
 * license verification when supplied).
 *
 * THE PORTRAIT SLOT IS HONEST. When `leadership.portrait` is null the figure
 * renders a typographic plate — the firm's real monogram over a darkened
 * photograph of structure, with the engineer's name and licensure as type.
 * No stock person, no silhouette, no "photo coming soon". Supplying the
 * portrait in `site.ts` swaps it in without touching this component.
 */
export function EngineerSection({
  n = '03',
  variant = 'teaser',
}: {
  n?: string;
  variant?: 'teaser' | 'full';
}) {
  const c = useContent();
  const l = useL();
  const e = c.leadership;
  const u = c.ui.engineer;
  const full = variant === 'full';

  return (
    <section
      id="engineer"
      className={`mp-section mp-section--lg mp-surface--paper mp-eng mp-eng--${variant}`}
      aria-labelledby="mp-eng-title"
    >
      <div className="mp-shell">
        <SectionHeading n={n} label={u.eyebrow} />

        <div className="mp-eng__grid">
          <Reveal>
            <figure className="mp-eng__figure">
              {e.portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.portrait.src}
                  alt={e.portrait.alt}
                  width={e.portrait.w}
                  height={e.portrait.h}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="mp-eng__plate">
                  <Img
                    photo={imagery.sections.engineer}
                    className="mp-eng__plate-bg"
                    sizes="(max-width: 900px) 100vw, 40vw"
                  />
                  <div className="mp-grid-bg" aria-hidden="true" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="mp-eng__plate-mark"
                    src={c.company.logo.light}
                    alt=""
                    width={c.company.logo.markSize.w}
                    height={c.company.logo.markSize.h}
                    loading="lazy"
                    decoding="async"
                  />
                  <dl className="mp-eng__plate-list">
                    {e.plate.map((r) => (
                      <div key={r.k}>
                        <dt>{r.k}</dt>
                        <dd>{r.v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              <figcaption className="mp-eng__caption">
                <span>{e.name}</span>
                <span>{e.credential}</span>
              </figcaption>
            </figure>
          </Reveal>

          <div className="mp-eng__copy">
            <Reveal delay={0.05}>
              <p className="mp-eng__role">
                {e.role} · {e.credential}
              </p>
              <h2 id="mp-eng-title" className="mp-eng__title">
                {e.name}
              </h2>
            </Reveal>

            <Reveal delay={0.1} className="mp-eng__body">
              {full ? (
                e.bio.map((p, i) => <p key={i}>{p}</p>)
              ) : (
                <p>{e.teaser}</p>
              )}
            </Reveal>

            {full ? (
              <>
                <Reveal delay={0.12}>
                  <blockquote className="mp-eng__quote">
                    <p>{e.approach}</p>
                    <cite>— {e.firstName}</cite>
                  </blockquote>
                </Reveal>

                <Reveal delay={0.14} className="mp-eng__meta">
                  <div>
                    <h3>{u.education}</h3>
                    <ul>
                      {e.education.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3>{u.focus}</h3>
                    <ul>
                      {e.focus.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                  {e.license ? (
                    <div>
                      <h3>{u.license}</h3>
                      <ul>
                        <li>{e.license.number}</li>
                        <li>
                          <a href={e.license.url} rel="noopener noreferrer" target="_blank">
                            {u.verify}
                          </a>
                        </li>
                      </ul>
                    </div>
                  ) : null}
                </Reveal>
              </>
            ) : null}

            <Reveal delay={0.16}>
              <h3 className="mp-eng__forlabel">{u.forYou}</h3>
              <ul className="mp-pillars mp-eng__for">
                {e.forYou.map((p) => (
                  <li key={p.k}>
                    <b>{p.k}</b>
                    <span>{p.v}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.18} className="mp-cta-row">
              {full ? (
                <ButtonLink href={l('/contact')} variant="solid">
                  {c.ui.requestProposal}
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink href={l('/about#engineer')} variant="line">
                    {u.readMore}
                  </ButtonLink>
                  <Link href={l('/contact')} className="mp-link">
                    {c.ui.requestProposal} <i aria-hidden="true">→</i>
                  </Link>
                </>
              )}
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
